// La vie d'Ossara : l'heure et le temps qu'il fait, les habitants et leurs journées, les gardes qui tirent,
// l'escorte, les bulles de conversation, les ressources qui repoussent et les lampes qui retombent en panne.
import { msg } from '../../shared/i18n/index.ts'
import { TILE, DAY_S, NPC_R } from '../../shared/consts.ts'
import { lineOfSight, type GameMap } from '../../shared/map.ts'
import { moveStep } from '../../shared/rules.ts'
import { NPCS, routineSpot, FLANERIE, type NpcDef } from '../../shared/npcs.ts'
import { findPath, nearestFree } from '../../shared/path.ts'
import { Npc, type NpcT } from '../schema.ts'
import type { World, PSim, ExtraTarget } from './World.ts'

export interface NSim {
  id: string; def: NpcDef; n: NpcT
  path: [number, number][]; dest: [number, number] | null; act: number
  thinkT: number; flanT: number; flanSpot: [number, number] | null; rondeI: number
  escort: { p: PSim; vers: { x: number; y: number; r: number }; quest: string; hp: number } | null
  shootCd: number; bubbleT: number; homeTile: [number, number]
}

export interface VieHooks {
  escortDone?(p: PSim, npc: string, quest: string): void
  escortFail?(p: PSim, npc: string, quest: string): void
}

export class Vie {
  w: World
  map: GameMap
  npcs = new Map<string, NSim>()
  meteoT = 240
  bubbleAcc = 0
  regrow = new Map<string, number>()   // nœud → instant où il repousse
  breakAt = new Map<string, number>()  // panne réparée → instant où elle retombe
  hooks: VieHooks = {}
  hourAcc = 0

  constructor(w: World) {
    this.w = w
    this.map = w.map
    const st = w.state
    st.heure = 9
    for (const p of this.map.monde?.pannes ?? []) st.pannes.set(p.id, 0)
    // les habitants vivent sur le continent ; les cartes reliées (épave, nid) n'en ont pas
    for (const def of this.map.carte === 'ossara' ? NPCS : []) {
      const n = new Npc()
      const spot = nearestFree(this.map, def.poste[0], def.poste[1]) ?? def.poste
      n.x = spot[0] * TILE + 8; n.y = spot[1] * TILE + 8
      const ns: NSim = { id: def.id, def, n, path: [], dest: null, act: 0, thinkT: Math.random(), flanT: 0, flanSpot: null, rondeI: 0, escort: null, shootCd: 0, bubbleT: 6 + Math.random() * 20, homeTile: spot }
      this.npcs.set(def.id, ns)
      st.npcs.set(def.id, n)
    }
    w.extraTargets = () => this.escortTargets()
  }

  get heure() { return this.w.state.heure }

  step(dt: number) {
    const st = this.w.state
    // l'heure : une journée d'Ossara dure DAY_S secondes (avec le service central, c'est lui qui la tient)
    this.hourAcc += dt
    if (!this.w.central && this.hourAcc >= 1) { st.heure = (st.heure + this.hourAcc * 24 / DAY_S) % 24; this.hourAcc = 0 }
    // le temps : des averses et des brumes de quelques minutes
    this.meteoT -= dt
    if (!this.w.central && this.meteoT <= 0) {
      const r = Math.random()
      st.meteo = st.meteo !== 0 ? 0 : r < 0.5 ? 1 : 2
      this.meteoT = st.meteo === 0 ? 240 + Math.random() * 240 : 120 + Math.random() * 120
    }
    for (const ns of this.npcs.values()) this.stepNpc(ns, dt)
    this.bubbleAcc += dt
    if (this.bubbleAcc >= 1) { this.bubbleAcc = 0; this.stepSlow() }
  }

  /** Une fois par seconde : bulles, repousse des nœuds, pannes qui reviennent. */
  stepSlow() {
    const now = this.w.time
    for (const [id, t] of this.regrow) if (now >= t) { this.regrow.delete(id); this.w.state.pris.delete(id) }
    for (const [id, t] of this.breakAt) if (now >= t) { this.breakAt.delete(id); this.w.state.pannes.set(id, 0) }
    const humains = [...this.w.players.values()].filter((p) => !p.bot && p.s.etat === 0)
    for (const ns of this.npcs.values()) {
      ns.bubbleT -= 1
      if (ns.bubbleT > 0 || ns.act === 4 || ns.escort) continue
      const near = humains.some((p) => Math.abs(p.s.x - ns.n.x) < 260 && Math.abs(p.s.y - ns.n.y) < 180)
      if (!near) { ns.bubbleT = 3; continue }
      ns.bubbleT = 14 + Math.random() * 22
      const i = Math.floor(Math.random() * ns.def.bulles.length)
      this.w.hooks.fx(ns.n.x, ns.n.y, { k: 'bulle', id: ns.id, s: msg(`pnj.${ns.id}.bulles.${i}`) })
    }
  }

  /** La destination d'un habitant à cette heure. */
  wanted(ns: NSim): { spot: [number, number]; act: number } {
    const d = ns.def
    const h = this.heure
    if (d.routine === 'garde' && d.ronde) return { spot: d.ronde[ns.rondeI % d.ronde.length], act: 1 }
    const base = routineSpot(d, h)
    if (base.act === 4) return base
    if (d.routine === 'passant') {
      ns.flanT -= 0.5
      if (!ns.flanSpot || ns.flanT <= 0) {
        const pts = FLANERIE[d.lieu] ?? [d.poste]
        ns.flanSpot = pts[Math.floor(Math.random() * pts.length)]
        ns.flanT = 25 + Math.random() * 35
      }
      return { spot: ns.flanSpot, act: 3 }
    }
    if (d.routine === 'enfant') {
      ns.flanT -= 0.5
      if (!ns.flanSpot || ns.flanT <= 0) { ns.flanSpot = [d.poste[0] + Math.floor(Math.random() * 9) - 4, d.poste[1] + Math.floor(Math.random() * 7) - 3]; ns.flanT = 3 + Math.random() * 5 }
      return { spot: ns.flanSpot, act: 1 }
    }
    return base
  }

  stepNpc(ns: NSim, dt: number) {
    const n = ns.n
    if (ns.escort) { this.stepEscort(ns, dt); return }
    // un garde tire sur ce qui approche
    if (ns.def.arme) {
      ns.shootCd -= dt
      let cible = null as null | { x: number; y: number }
      if (ns.shootCd <= 0) {
        let bd = 175
        for (const es of this.w.enemies.values()) {
          if (es.boss) continue
          const d = Math.abs(es.e.x - n.x) + Math.abs(es.e.y - n.y)
          if (d < bd * 1.4 && Math.hypot(es.e.x - n.x, es.e.y - n.y) < bd && lineOfSight(this.map, n.x, n.y, es.e.x, es.e.y)) { bd = Math.hypot(es.e.x - n.x, es.e.y - n.y); cible = es.e }
        }
        if (cible) {
          ns.shootCd = 0.55
          const a = Math.atan2(cible.y - n.y, cible.x - n.x) + (Math.random() - 0.5) * 0.08
          this.w.addBullet(n.x + Math.cos(a) * 8, n.y + Math.sin(a) * 8, Math.cos(a) * 320, Math.sin(a) * 320, 2, 12, 0.7, null, null, 3)
          n.act = 6; n.dir = Math.cos(a) < 0 ? -1 : 1
          return
        } else ns.shootCd = 0.4
      }
      if (n.act === 6 && ns.shootCd > 0.2) return
    }
    ns.thinkT -= dt
    if (ns.thinkT <= 0) {
      ns.thinkT = 0.5
      const want = this.wanted(ns)
      const tx = Math.floor(n.x / TILE), ty = Math.floor(n.y / TILE)
      const arrived = Math.abs(tx - want.spot[0]) <= 0 && Math.abs(ty - want.spot[1]) <= 0
      if (arrived) {
        ns.act = want.act
        if (ns.def.routine === 'garde' && ns.def.ronde && !ns.path.length) { ns.rondeI++; ns.thinkT = 1.5 + Math.random() * 2 }
      } else if (!ns.dest || ns.dest[0] !== want.spot[0] || ns.dest[1] !== want.spot[1]) {
        ns.dest = want.spot
        const path = findPath(this.map, tx, ty, want.spot[0], want.spot[1], 6000)
        if (path) ns.path = path
        else if (!this.watched(n.x, n.y)) { const f = nearestFree(this.map, want.spot[0], want.spot[1]) ?? want.spot; n.x = f[0] * TILE + 8; n.y = f[1] * TILE + 8; ns.path = [] }
      }
    }
    if (ns.path.length) {
      const [px, py] = ns.path[0]
      const gx = px * TILE + 8, gy = py * TILE + 8
      const dx = gx - n.x, dy = gy - n.y, d = Math.hypot(dx, dy)
      const sp = (ns.def.look.petit ? 40 : 32) * dt
      if (d <= sp) { n.x = gx; n.y = gy; ns.path.shift() }
      else { n.x += dx / d * sp; n.y += dy / d * sp; if (Math.abs(dx) > 0.5) n.dir = dx < 0 ? -1 : 1 }
      n.act = 1
    } else n.act = ns.act
  }

  /** Quelqu'un voit-il cet endroit ? (pour ne pas faire apparaître un habitant sous les yeux d'un joueur) */
  watched(x: number, y: number) {
    for (const p of this.w.players.values()) if (!p.bot && Math.abs(p.s.x - x) < 420 && Math.abs(p.s.y - y) < 300) return true
    return false
  }

  // ---------------------------------------------------------------- l'escorte
  startEscort(npcId: string, p: PSim, vers: { x: number; y: number; r: number }, quest: string) {
    const ns = this.npcs.get(npcId)
    if (!ns) return 'inconnu'
    if (ns.escort && ns.escort.p !== p && this.w.players.has(ns.escort.p.sid)) return 'occupe'
    ns.escort = { p, vers, quest, hp: 140 }
    ns.path = []; ns.dest = null
    return 'ok'
  }

  stepEscort(ns: NSim, dt: number) {
    const e = ns.escort!, n = ns.n
    if (!this.w.players.has(e.p.sid) || e.p.s.etat === 2) { this.endEscort(ns, false); return }
    const p = e.p.s
    const d = Math.hypot(p.x - n.x, p.y - n.y)
    if (d > 300) { n.x = p.x - 14; n.y = p.y + 4 }
    else if (d > 26) {
      const body = { x: n.x, y: n.y }
      moveStep(body, (p.x - n.x) / d, (p.y - n.y) / d, dt, d > 80 ? 92 : 70, this.map, NPC_R)
      if (Math.abs(body.x - n.x) > 0.3) n.dir = body.x < n.x ? -1 : 1
      n.x = body.x; n.y = body.y
      n.act = 5
    } else n.act = 0
    if (Math.hypot(n.x - e.vers.x, n.y - e.vers.y) < e.vers.r) this.endEscort(ns, true)
  }

  endEscort(ns: NSim, ok: boolean) {
    const e = ns.escort
    ns.escort = null
    if (!e) return
    if (ok) this.hooks.escortDone?.(e.p, ns.id, e.quest)
    else {
      this.hooks.escortFail?.(e.p, ns.id, e.quest)
      ns.n.x = ns.homeTile[0] * TILE + 8; ns.n.y = ns.homeTile[1] * TILE + 8
    }
    // de retour chez lui, à pied s'il est arrivé
    ns.dest = null; ns.path = []
    if (ok) ns.thinkT = 8
  }

  escortTargets(): ExtraTarget[] {
    const out: ExtraTarget[] = []
    for (const ns of this.npcs.values()) {
      const e = ns.escort
      if (!e) continue
      out.push({
        x: ns.n.x, y: ns.n.y,
        hit: (dmg: number) => {
          if (!ns.escort) return
          ns.escort.hp -= dmg
          this.w.hooks.fx(ns.n.x, ns.n.y, { k: 'aie', x: ns.n.x, y: ns.n.y, n: Math.round(dmg), sid: '' })
          if (ns.escort.hp <= 0) { this.w.hooks.fx(ns.n.x, ns.n.y, { k: 'txt', x: ns.n.x, y: ns.n.y - 16, s: `${ns.def.nom} s'effondre`, c: '#ff6b6b' }); this.endEscort(ns, false) }
        },
        alive: () => !!ns.escort,
      })
    }
    return out
  }

  // ---------------------------------------------------------------- ressources et pannes
  pick(id: string, p: PSim) {
    const nd = this.map.monde?.noeuds.find((q) => q.id === id)
    if (!nd || this.w.state.pris.has(id)) return null
    if (Math.hypot(nd.x - p.s.x, nd.y - p.s.y) > 34) return null
    this.w.state.pris.set(id, 1)
    this.regrow.set(id, this.w.time + (nd.type === 'noyau' || nd.type === 'echantillon' ? 45 : 90))
    return nd
  }

  repair(id: string, p: PSim) {
    const pn = this.map.monde?.pannes.find((q) => q.id === id)
    if (!pn || this.w.state.pannes.get(id) === 1) return null
    if (Math.hypot(pn.x - p.s.x, pn.y - p.s.y) > 40) return null
    this.w.state.pannes.set(id, 1)
    this.breakAt.set(id, this.w.time + 480)
    this.w.hooks.fx(pn.x, pn.y, { k: 'repare', x: pn.x, y: pn.y })
    return pn
  }
}
