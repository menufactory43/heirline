// Ce que le secteur et les concessions ont en commun : entrées, pas fixe à 20 Hz, compensation de latence,
// zone d'intérêt par client (StateView), effets envoyés seulement à ceux qui les voient.
import type { Texte } from '../../shared/i18n/index.ts'
import { Room, type Client } from 'colyseus'
import { StateView } from '@colyseus/schema'
import { TICK_HZ, VIEW_IN, VIEW_OUT, DT } from '../../shared/consts.ts'
import { robotUpgradeCost, ROBOT, CLASS_IDS, type ClassId } from '../../shared/rules.ts'
import { nettoyer, peutPrendre, peutSpecialiser, peutMaitriser, pointsLibres, pointsPris, coutRaz, paramsCompetence } from '../../shared/talents.ts'
import { msg } from '../../shared/i18n/index.ts'
import { World, type PSim } from '../world/World.ts'
import { Input } from '../schema.ts'
import { db, type Account, type Soldier } from '../db.ts'
import { readFileSync } from 'node:fs'

/** Le client en service : le nom (avec empreinte) du script de dist/index.html. Un client qui n'a pas le même se recharge. */
export const VERSION_CLIENT = (() => {
  try { return /assets\/(index-[\w-]+\.js)/.exec(readFileSync(new URL('../../dist/index.html', import.meta.url), 'utf8'))?.[1] ?? '' } catch { return '' }
})()

export interface ClientData { account: Account; soldier: Soldier; fx: any[]; seen: Set<object>; lastMe: string }
export const tickStats = { ticks: [] as number[], last: 0, stepMs: [] as number[] }

export abstract class GameRoom extends Room {
  world!: World
  inputs: any
  rewind: any
  tick = 0
  data = new Map<string, ClientData>()

  setupWorld(world: World) {
    this.world = world
    this.state = world.state
    this.inputs = this.defineInput(Input as any, { bufferMaxSize: 32 })
    this.rewind = this.allowRewindState({ maxRewindMs: 400 })
    this.rewind.attachAll(world.state.enemies, { fields: ['x', 'y'] })
    world.rewindFor = (p, es) => {
      if (Math.abs(es.e.x - p.s.x) > 400 || Math.abs(es.e.y - p.s.y) > 400) return es.e
      const seen = this.rewind.lastSeenBy(p.sid)
      return { x: seen.value(es.e, 'x'), y: seen.value(es.e, 'y') }
    }
    world.onBullet = (bs) => {
      for (const c of this.clients) {
        const me = this.world.players.get(c.sessionId)
        if (me && Math.abs(me.s.x - bs.x) < VIEW_IN && Math.abs(me.s.y - bs.y) < VIEW_IN) c.view?.add(bs.b)
      }
    }
    this.patchRate = 1000 / TICK_HZ
    this.setFixedTimestep(() => this.step(), TICK_HZ)

    this.onMessage('skill', (c, m: { i: number; tx?: number; ty?: number }) => { const p = this.world.players.get(c.sessionId); if (p && (m?.i === 0 || m?.i === 1 || m?.i === 2)) this.world.skill(p, m.i, num(m.tx), num(m.ty)) })
    // les talents : un rang de plus, tout reprendre (contre de la ferraille), choisir sa spécialité, sa maîtrise
    this.onMessage('talent', (c, m: { id: string }) => this.talent(c, (p) => {
      const non = peutPrendre(p.cls, p.level, p.talents, String(m?.id)); if (non) return non
      p.talents.r[m.id] = (p.talents.r[m.id] ?? 0) + 1; return null
    }))
    this.onMessage('specialite', (c, m: { id: string }) => this.talent(c, (p) => {
      const non = peutSpecialiser(p.cls, p.level, p.talents, String(m?.id)); if (non) return non
      p.talents.spec = m.id; return null
    }))
    this.onMessage('maitrise', (c, m: { id: string }) => this.talent(c, (p) => {
      const non = peutMaitriser(p.level, p.talents, String(m?.id)); if (non) return non
      p.talents.maitrise = m.id; return null
    }))
    this.onMessage('talents_raz', (c) => this.talent(c, (p, d) => {
      if (!pointsPris(p.talents)) return 'ui.talents.rien_a_reprendre'
      const cout = coutRaz(p.level)
      if (!p.test) { const acc = db().account(d.account.id)!; if (acc.scrap < cout) return 'ui.talents.pas_assez'; db().addScrap(d.account.id, -cout) }
      p.talents.r = {}; return null
    }))
    this.onMessage('dash', (c, m: { dx: number; dy: number }) => { const p = this.world.players.get(c.sessionId); if (p) this.world.dash(p, num(m?.dx) ?? 0, num(m?.dy) ?? 0) })
    this.onMessage('ordre', (c) => { const p = this.world.players.get(c.sessionId); if (p) this.world.order(p) })
    // téléportation de test (captures, bancs) : seulement si HEIRLINE_DEBUG est défini, avec ce code
    // la lecture de la Pépinière imposée (captures) : seulement avec HEIRLINE_DEBUG et son code
    if (process.env.HEIRLINE_DEBUG) this.onMessage('lecture', (c, m: { code: string; c: number[] }) => { if (m?.code === process.env.HEIRLINE_DEBUG && Array.isArray(m.c) && m.c.length === 4) { const l = this.world.lecture; for (let i = 0; i < 4; i++) l[i] = Number(m.c[i]) || 0 } })
    if (process.env.HEIRLINE_DEBUG) this.onMessage('tp', (c, m: { code: string; x: number; y: number }) => { const p = this.world.players.get(c.sessionId); if (p && m?.code === process.env.HEIRLINE_DEBUG) { p.s.x = Number(m.x); p.s.y = Number(m.y) } })
    this.onMessage('ping', (c, t: number) => c.send('pong', t))
  }

  /** un changement de talents : validé par le serveur, appliqué, enregistré, renvoyé */
  talent(c: Client, fn: (p: PSim, d: ClientData) => string | null) {
    const p = this.world.players.get(c.sessionId), d = this.data.get(c.sessionId)
    if (!p || !d || p.bot) return
    const non = fn(p, d)
    if (non) return c.send('log', { t: msg(non), color: '#ff9b6b' })
    this.world.applyTalents(p)
    this.saveSoldier(p)
    d.lastMe = ''
    this.sendMe(c)
  }

  step() {
    const now = performance.now()
    if (tickStats.last) { tickStats.ticks.push(now - tickStats.last); if (tickStats.ticks.length > 4000) tickStats.ticks.shift() }
    tickStats.last = now
    for (const [sid, p] of this.world.players) {
      if (p.bot) continue
      const acc = this.inputs.get(sid)
      if (!acc) continue
      for (const inp of acc) p.pending.push({ mx: inp.mx, my: inp.my, aim: inp.aim, fire: !!inp.fire, dash: !!inp.dash })
    }
    this.world.step(DT)
    this.tick++
    if (this.tick % 4 === 0) this.updateViews()
    for (const c of this.clients) {
      const d = this.data.get(c.sessionId)
      if (d && d.fx.length) { c.send('fx', d.fx); d.fx = [] }
    }
    if (this.tick % 10 === 0) for (const c of this.clients) this.sendMe(c)
    tickStats.stepMs.push(performance.now() - now); if (tickStats.stepMs.length > 4000) tickStats.stepMs.shift()
    this.afterStep()
  }
  afterStep() {}

  /** Chaque client ne reçoit que ce qui l'entoure. */
  updateViews() {
    for (const c of this.clients) {
      const me = this.world.players.get(c.sessionId)
      const d = this.data.get(c.sessionId)
      if (!me || !c.view || !d) continue
      const cx = me.s.x, cy = me.s.y
      const consider = (obj: any, x: number, y: number) => {
        const dd = Math.max(Math.abs(x - cx), Math.abs(y - cy))
        const vu = d.seen.has(obj)
        if (!vu && dd < VIEW_IN) { c.view!.add(obj); d.seen.add(obj) }
        else if (vu && dd > VIEW_OUT) { c.view!.remove(obj); d.seen.delete(obj) }
      }
      for (const p of this.world.players.values()) if (p !== me) consider(p.s, p.s.x, p.s.y)
      for (const r of this.world.robots.values()) consider(r.r, r.r.x, r.r.y)
      for (const e of this.world.enemies.values()) consider(e.e, e.e.x, e.e.y)
      this.world.state.npcs.forEach((n: any) => consider(n, n.x, n.y))
      // ce qui a quitté le monde ne doit plus rester dans l'ensemble
      for (const o of d.seen) if ((o as any).__gone) d.seen.delete(o)
    }
  }

  fxHook(x: number, y: number, ev: any) {
    for (const c of this.clients) {
      const d = this.data.get(c.sessionId)
      if (!d) continue
      if (ev.sid && ev.sid !== c.sessionId && (ev.k === 'evac' || ev.k === 'txt' || ev.k === 'butin')) continue
      const me = this.world.players.get(c.sessionId)
      if (!me || Math.abs(me.s.x - x) < VIEW_OUT && Math.abs(me.s.y - y) < VIEW_OUT) d.fx.push(ev)
    }
  }

  /** un message pour tous les joueurs du salon (une clé à traduire, ou un texte libre : celui d'une concession) */
  logHook(t: Texte, color = '#c9d1d9') { this.broadcast('log', { t, color }) }

  /** Ce que le salon ajoute à « moi » (le secteur : les gares ouvertes, la selle). */
  extraMe(_p: any): Record<string, unknown> { return {} }

  sendMe(c: Client) {
    const p = this.world.players.get(c.sessionId)
    const d = this.data.get(c.sessionId)
    if (!p || !d) return
    const acc = db().account(d.account.id)!
    const rob = db().robot(d.account.id)
    const me = {
      xp: p.xp, level: p.level, sac: p.sac, banque: acc.scrap, cd: p.cd.map((v) => Math.ceil(v * 10) / 10), dashCd: Math.ceil(p.s.dashCd * 10) / 10,
      zone: this.world.zoneOf(p.s.x, p.s.y), robot: { level: rob.level, etat: rob.state, ox: rob.ox, oy: rob.oy, cout: robotUpgradeCost(rob.level), max: ROBOT.niveauMax },
      soldat: { given: p.given, family: p.family, generation: p.generation, cls: p.cls }, revive: p.revive,
      carte: this.world.map.carte, monte: p.s.monte, ...this.extraMe(p),
      comp: p.comps, cdMax: p.comps.map((id) => (id ? Math.round(paramsCompetence(id, p.talents, p.mods).cd * 10) / 10 : 0)),
      talents: p.talents, points: pointsLibres(p.level, p.talents), coutRaz: coutRaz(p.level), test: !!p.test,
      mods: p.mods,
    }
    const s = JSON.stringify(me)
    if (s !== d.lastMe) { d.lastMe = s; c.send('moi', me) }
  }

  /** Le compte et le soldat vivant (ou l'héritier à créer) d'un client qui se connecte. */
  static authenticate(options: any): { account: Account; soldier: Soldier | null } {
    const account = options?.token ? db().accountByToken(String(options.token)) : undefined
    if (!account) throw new Error('compte inconnu')
    return { account, soldier: db().livingSoldier(account.id) ?? null }
  }

  addClientPlayer(client: Client, account: Account, soldier: Soldier, x?: number, y?: number): PSim {
    const p = this.world.addPlayer({
      sid: client.sessionId, account: account.id, soldierId: soldier.id, given: soldier.given, family: account.family,
      generation: soldier.generation, cls: soldier.cls, level: soldier.level, xp: soldier.xp, x, y,
      inv: parseJson(soldier.inv_json, []), equip: parseJson(soldier.equip_json, {}), sac: soldier.sac ?? 0,
      talents: nettoyer(soldier.cls, soldier.level, parseJson(soldier.talents_json, {})),
    })
    const rob = db().robot(account.id)
    if (rob.state === 'avec') this.world.giveRobot(p, rob.level)
    client.view = new StateView()
    client.view.add(p.s)
    if (VERSION_CLIENT) client.send('version', VERSION_CLIENT)
    this.data.set(client.sessionId, { account, soldier, fx: [], seen: new Set(), lastMe: '' })
    return p
  }

  // un soldat de test (bouton « aller voir un boss ») n'est jamais enregistré : la vraie fiche reste intacte
  saveSoldier(p: PSim) { if (p.soldierId && !p.test) db().saveSoldier({ id: p.soldierId, level: p.level, xp: p.xp, inv: p.inv, equip: p.equip, sac: p.sac, talents: p.talents }) }
}

export function parseJson<T>(s: string | undefined, d: T): T { try { return s ? JSON.parse(s) : d } catch { return d } }
export function num(v: unknown) { return typeof v === 'number' && Number.isFinite(v) ? v : undefined }
export function validClass(c: unknown): c is ClassId { return typeof c === 'string' && (CLASS_IDS as string[]).includes(c) }
