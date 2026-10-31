// Les compétences des soldats et ce qu'elles laissent derrière elles : zones qui durent (champ, nuage, aura, brasier),
// états des créatures (ralenties, étourdies, marquées, en feu, provoquées), minuteries. Les nombres viennent de
// shared/talents.ts (PARAMS, modifiés par la maîtrise et les talents) ; le monde (World.ts) appelle ce module.
import { TILE, PLAYER_R, ROBOT_R } from '../../shared/consts.ts'
import { ENEMIES, hits, dmgMul, robotHp, moveStep } from '../../shared/rules.ts'
import { drapeau, type SkillParams } from '../../shared/talents.ts'
import { msg } from '../../shared/i18n/index.ts'
import { Robot } from '../schema.ts'
import type { World, PSim, ESim, RSim } from './World.ts'

/** Ce que porte une créature : ralentie, étourdie, marquée, en feu, provoquée. */
export interface Statuts {
  slowT: number; slowK: number; sourdine: boolean
  stunT: number
  markT: number; markK: number
  burnT: number; burnDps: number; burnBy: PSim | null; burnAcc: number
  tauntT: number; taunt: PSim | RSim | null
}
export function statuts(es: ESim): Statuts {
  return (es.stt ??= { slowT: 0, slowK: 0, sourdine: false, stunT: 0, markT: 0, markK: 0, burnT: 0, burnDps: 0, burnBy: null, burnAcc: 0, tauntT: 0, taunt: null })
}
const estBoss = (es: ESim) => !!ENEMIES[es.kind].boss || es.kind === 14
export function ralentir(es: ESim, k: number, t: number, sourdine = false) { const s = statuts(es); if (k >= s.slowK || s.slowT <= 0) { s.slowK = k; s.sourdine = sourdine } s.slowT = Math.max(s.slowT, t) }
/** étourdir (un boss n'est que ralenti de moitié) */
export function etourdir(es: ESim, t: number) { if (estBoss(es)) ralentir(es, 0.5, t); else statuts(es).stunT = Math.max(statuts(es).stunT, t) }
export function marquer(es: ESim, t: number, k: number) { const s = statuts(es); s.markT = Math.max(s.markT, t); s.markK = Math.max(s.markK, k) }
export function bruler(es: ESim, t: number, dps: number, by: PSim | null) { const s = statuts(es); s.burnT = Math.max(s.burnT, t); s.burnDps = Math.max(s.burnDps, dps); s.burnBy = by }
export function provoquer(es: ESim, t: number, qui: PSim | RSim) { if (estBoss(es)) return; const s = statuts(es); s.tauntT = t; s.taunt = qui; es.thinkT = 0 }

/** Le multiplicateur des dégâts reçus par une créature (marque, sourdine). */
export function multDegatsRecus(es: ESim) {
  const s = es.stt
  if (!s) return 1
  let m = 1
  if (s.markT > 0) m += s.markK
  if (s.sourdine && s.slowT > 0) m += 0.15
  return m
}

/** Un pas des états d'une créature. Rend la part de vitesse gardée (0 : immobile). */
export function stepStatuts(w: World, es: ESim, dt: number): number {
  const s = es.stt
  if (!s) return 1
  s.slowT = Math.max(0, s.slowT - dt); s.stunT = Math.max(0, s.stunT - dt); s.markT = Math.max(0, s.markT - dt); s.tauntT = Math.max(0, s.tauntT - dt)
  if (s.burnT > 0) {
    s.burnT -= dt
    s.burnAcc += s.burnDps * dt
    if (s.burnAcc >= 4) { const n = Math.floor(s.burnAcc); s.burnAcc -= n; w.damageEnemy(es, n, s.burnBy, true) }
  }
  if (s.tauntT <= 0) s.taunt = null
  es.e.st = (s.slowT > 0 ? 1 : 0) | (s.stunT > 0 ? 2 : 0) | (s.markT > 0 ? 4 : 0) | (s.burnT > 0 ? 8 : 0)
  if (s.stunT > 0) return 0
  return s.slowT > 0 ? 1 - s.slowK : 1
}

// ------------------------------------------------------------------ les zones qui durent
export interface ZoneEff {
  id: number; kind: 'champ' | 'toxine' | 'brasier' | 'perfusion'
  x: number; y: number; r: number; t: number
  owner: PSim; suit: boolean; dps: number; soin: number; acc: number
  /** Contagion : le nuage a déjà fait éclore un autre nuage */
  eclos?: boolean
}
let ZID = 1
export function poserZone(w: World, z: Omit<ZoneEff, 'id' | 'acc'>) {
  const zz: ZoneEff = { ...z, id: ZID++, acc: 0 }
  w.zones.push(zz)
  w.hooks.fx(z.x, z.y, { k: 'zone', z: z.kind, x: z.x, y: z.y, r: z.r, t: z.t, sid: z.suit ? z.owner.sid : undefined, ami: 1 })
  return zz
}
export function stepZones(w: World, dt: number) {
  if (!w.zones.length) return
  const garde: ZoneEff[] = []
  for (const z of w.zones) {
    z.t -= dt
    if (z.suit) { z.x = z.owner.s.x; z.y = z.owner.s.y }
    if (z.t <= 0 || (z.suit && (z.owner.s.etat !== 0 || !w.players.has(z.owner.sid)))) continue
    garde.push(z)
    z.acc += dt
    const tick = z.acc >= 0.25
    if (tick) z.acc -= 0.25
    if (z.kind === 'champ') { for (const es of w.enemies.values()) if (Math.hypot(es.e.x - z.x, es.e.y - z.y) < z.r + ENEMIES[es.kind].rayon) ralentir(es, 0.5, 0.35) }
    if (!tick) continue
    if (z.kind === 'toxine' || z.kind === 'brasier') {
      for (const es of [...w.enemies.values()]) {
        if (Math.hypot(es.e.x - z.x, es.e.y - z.y) > z.r + ENEMIES[es.kind].rayon) continue
        const mul = z.kind === 'toxine' && ENEMIES[es.kind].famille === 'eden' ? 2 : 1
        w.damageEnemy(es, z.dps * 0.25 * mul, z.owner, true)
      }
      if (z.kind === 'brasier' && drapeau(z.owner.talents, 'phenix')) w.heal(z.owner, z.owner.s.maxHp * 0.03 * 0.25, true)
    }
    if (z.kind === 'perfusion') {
      for (const q of w.players.values()) if (q.s.etat === 0 && Math.hypot(q.s.x - z.x, q.s.y - z.y) < z.r) w.heal(q, q.s.maxHp * z.soin / 100 * 0.25, true)
      for (const r of w.robots.values()) if ((r.kind === 'robot' || r.kind === 'tourelle') && r.r.mode !== 3 && Math.hypot(r.r.x - z.x, r.r.y - z.y) < z.r) r.r.hp = Math.min(r.r.maxHp, r.r.hp + r.r.maxHp * z.soin / 100 * 0.25)
    }
  }
  w.zones = garde
}
/** Contagion : un ennemi mort dans un nuage d'un biochimiste qui la maîtrise en fait éclore un autre. */
export function surMortDansZone(w: World, es: ESim) {
  for (const z of w.zones) {
    if (z.kind !== 'toxine' || z.eclos || !drapeau(z.owner.talents, 'contagion')) continue
    if (Math.hypot(es.e.x - z.x, es.e.y - z.y) > z.r) continue
    z.eclos = true
    poserZone(w, { kind: 'toxine', x: es.e.x, y: es.e.y, r: z.r, t: Math.max(2, z.t + 1), owner: z.owner, suit: false, dps: z.dps, soin: 0, eclos: true })
    return
  }
}

// ------------------------------------------------------------------ minuteries
export function plusTard(w: World, t: number, fn: () => void) { w.timers.push({ t: w.time + t, fn }) }
export function stepMinuteries(w: World) {
  if (!w.timers.length) return
  const prets = w.timers.filter((m) => m.t <= w.time)
  if (!prets.length) return
  w.timers = w.timers.filter((m) => m.t > w.time)
  for (const m of prets) m.fn()
}

// ------------------------------------------------------------------ outils
const vers = (p: PSim, tx: number | undefined, ty: number | undefined, max: number, def = 110) => {
  const { x, y } = p.s, a = p.s.angle
  let gx = tx ?? x + Math.cos(a) * def, gy = ty ?? y + Math.sin(a) * def
  const d = Math.hypot(gx - x, gy - y)
  if (d > max) { gx = x + (gx - x) / d * max; gy = y + (gy - y) / d * max }
  return { gx, gy }
}
function ennemisDans(w: World, x: number, y: number, r: number) {
  return [...w.enemies.values()].filter((es) => Math.hypot(es.e.x - x, es.e.y - y) < r + ENEMIES[es.kind].rayon && !ENEMIES[es.kind].passif)
}
/** une petite machine du soldat (leurre, mine, drone) : un robot du monde, d'un genre à part */
function machine(w: World, p: PSim, kind: 'leurre' | 'mine' | 'drone', x: number, y: number, ttl: number, hp: number, mode: number): RSim {
  const r = new Robot()
  const rs: RSim = { id: kind[0] + w.nid(), r, kind, owner: p, account: p.account, level: p.level, cd: 0, overT: 0, offT: 0, ttl, until: 0, targetT: 0, target: null, blindT: 0, blindRed: 0 }
  r.x = x; r.y = y; r.mode = mode; r.level = p.level; r.maxHp = hp; r.hp = hp; r.owner = p.sid; r.family = p.family
  w.robots.set(rs.id, rs); w.state.robots.set(rs.id, r)
  return rs
}
export function poserMine(w: World, p: PSim, x: number, y: number, P: SkillParams, max: number) {
  const mines = [...w.robots.values()].filter((r) => r.owner === p && r.kind === 'mine')
  while (mines.length >= max) { const o = mines.shift()!; w.removeRobot(o.id) }
  const rs = machine(w, p, 'mine', x, y, P.dur ?? 30, 1, 8)
  rs.mine = { dmg: P.dmg ?? 60, r: P.r ?? 40 }
  return rs
}

/** Une explosion d'un soldat : dégâts en zone aux créatures, avec la Réaction en chaîne de l'artificier. */
export function exploser(w: World, p: PSim | null, x: number, y: number, r: number, dmg: number, o: { stun?: number; chaine?: boolean } = {}) {
  w.hooks.fx(x, y, { k: 'boum', x, y, r, ami: 1 })
  for (const es of ennemisDans(w, x, y, r)) { w.damageEnemy(es, dmg, p, false, false, 'explosion'); if (o.stun) etourdir(es, o.stun) }
  if (p && o.chaine !== false && drapeau(p.talents, 'chaine') && Math.random() < 0.25) {
    const a = Math.random() * Math.PI * 2
    plusTard(w, 0.2, () => exploser(w, p, x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, r * 0.8, dmg * 0.6, { chaine: false }))
  }
}

// ------------------------------------------------------------------ lancer une compétence
/** Rend false si la compétence n'a rien fait (le temps de recharge n'est alors pas compté en entier). */
export function lancer(w: World, p: PSim, id: string, P: SkillParams, tx?: number, ty?: number): boolean {
  const { x, y } = p.s
  const lv = dmgMul(p.level)
  const fx = (ev: any, ex = x, ey = y) => w.hooks.fx(ex, ey, { k: 'sk', s: id, x: ex, y: ey, ...ev })
  switch (id) {
    // --- Fantassin
    case 'bouclier': p.shieldT = P.dur!; p.shieldRed = P.red!; fx({}); return true
    case 'grenade': {
      const { gx, gy } = vers(p, tx, ty, 140)
      w.addTele({ kind: 'cercle', x: gx, y: gy, x2: 0, y2: 0, r: P.r!, t: 0.65, total: 0.65, dmg: -P.dmg! * lv, src: p.sid })
      w.hooks.fx(x, y, { k: 'grenade', x, y, x2: gx, y2: gy, t: 0.65 })
      return true
    }
    // --- Médic
    case 'injection': {
      for (const q of w.players.values()) if (q.s.etat === 0 && Math.hypot(q.s.x - x, q.s.y - y) < P.r!) w.heal(q, q.s.maxHp * P.soin! / 100)
      for (const r of w.robots.values()) if ((r.kind === 'robot' || r.kind === 'tourelle') && Math.hypot(r.r.x - x, r.r.y - y) < P.r!) r.r.hp = Math.min(r.r.maxHp, r.r.hp + r.r.maxHp * P.soin! / 100)
      fx({ r: P.r }); return true
    }
    case 'adrenaline': {
      for (const q of w.players.values()) {
        if (Math.hypot(q.s.x - x, q.s.y - y) > P.r!) continue
        if (q.s.etat === 0) q.adrenT = P.dur!
        else if (q.s.etat === 1) w.standUp(q, 0.4)
      }
      fx({ r: P.r }); return true
    }
    // --- Ingénieur
    case 'tourelle': {
      const a = p.s.angle
      let px = x + Math.cos(a) * 18, py = y + Math.sin(a) * 18
      if (hits(w.map, px, py, ROBOT_R)) { px = x; py = y }
      const r = new Robot()
      const rs: RSim = { id: 't' + w.nid(), r, kind: 'tourelle', owner: p, account: p.account, level: p.level, cd: 0, overT: 0, offT: 0, ttl: P.dur!, until: 0, targetT: 0, target: null, blindT: 0, blindRed: 0 }
      r.x = px; r.y = py; r.mode = 4; r.level = p.level; r.maxHp = 70 + 4 * p.level; r.hp = r.maxHp; r.owner = p.sid; r.family = p.family
      w.robots.set(rs.id, rs); w.state.robots.set(rs.id, r)
      w.hooks.fx(px, py, { k: 'sk', s: 'tourelle', x: px, y: py })
      return true
    }
    case 'surcharge': {
      const rb = p.robot
      if (!rb || rb.kind !== 'robot') return false
      rb.overT = P.dur!; rb.r.hp = Math.min(rb.r.maxHp, rb.r.hp + rb.r.maxHp * P.soin! / 100); rb.offT = 0
      if (rb.r.mode === 3) rb.r.mode = 0
      w.hooks.fx(rb.r.x, rb.r.y, { k: 'sk', s: 'surcharge', x: rb.r.x, y: rb.r.y })
      return true
    }
    // --- Éclaireur
    case 'marquage': {
      const { gx, gy } = vers(p, tx, ty, 220, 140)
      const k = drapeau(p.talents, 'traque') ? 0.4 : 0.25
      for (const es of ennemisDans(w, gx, gy, P.r!)) marquer(es, P.dur!, k)
      fx({ r: P.r }, gx, gy); return true
    }
    case 'piege': { poserMine(w, p, x, y, { ...P, dmg: P.dmg! * lv }, P.n ?? 2); fx({}); return true }
    // --- Démolisseur
    case 'mortier': {
      const { gx, gy } = vers(p, tx, ty, 200, 150)
      w.addTele({ kind: 'cercle', x: gx, y: gy, x2: 0, y2: 0, r: P.r!, t: P.delai!, total: P.delai!, dmg: -P.dmg! * lv, src: p.sid })
      w.hooks.fx(x, y, { k: 'grenade', x, y, x2: gx, y2: gy, t: P.delai, gros: 1 })
      return true
    }
    case 'onde': {
      for (const es of ennemisDans(w, x, y, P.r!)) {
        w.damageEnemy(es, P.dmg! * lv, p)
        if (!es.e.hp) continue
        etourdir(es, P.stun!)
        if (!estBoss(es)) { const d = Math.hypot(es.e.x - x, es.e.y - y) || 1; for (let i = 0; i < 6; i++) moveStep(es.e, (es.e.x - x) / d, (es.e.y - y) / d, 0.05, 200, w.map, ENEMIES[es.kind].rayon) }
      }
      fx({ r: P.r }); return true
    }
    // --- Brouilleur
    case 'champ': {
      const { gx, gy } = vers(p, tx, ty, 200, 120)
      poserZone(w, { kind: 'champ', x: gx, y: gy, r: P.r!, t: P.dur!, owner: p, suit: false, dps: 0, soin: 0 })
      return true
    }
    case 'leurre': {
      const { gx, gy } = vers(p, tx, ty, 150, 70)
      const px = hits(w.map, gx, gy, ROBOT_R) ? x : gx, py = hits(w.map, gx, gy, ROBOT_R) ? y : gy
      const rs = machine(w, p, 'leurre', px, py, P.dur!, Math.round(60 + 10 * p.level), 7)
      rs.r.angle = p.s.angle
      for (const es of ennemisDans(w, px, py, 200)) provoquer(es, P.dur!, rs)
      fx({}, px, py); return true
    }
    // --- les spécialités
    case 'bastion': {
      p.rempartT = P.dur!; p.rempartR = P.r!; p.rempartRed = P.red!
      for (const es of ennemisDans(w, x, y, P.r! * 1.6)) provoquer(es, P.dur!, p)
      if (drapeau(p.talents, 'phalange')) for (const q of w.players.values()) if (q.s.etat === 1 && Math.hypot(q.s.x - x, q.s.y - y) < P.r!) w.standUp(q, 0.5)
      w.hooks.fx(x, y, { k: 'zone', z: 'bastion', x, y, r: P.r, t: P.dur, sid: p.sid, ami: 1 })
      return true
    }
    case 'percee': {
      const a = p.s.angle, dx = Math.cos(a), dy = Math.sin(a)
      const x0 = x, y0 = y
      for (let i = 0; i < 12; i++) moveStep(p.s, dx, dy, 1, P.len! / 12, w.map, PLAYER_R)
      p.invulT = Math.max(p.invulT, 0.3)
      for (const es of [...w.enemies.values()]) {
        if (ENEMIES[es.kind].passif) continue
        if (distSeg(es.e.x, es.e.y, x0, y0, p.s.x, p.s.y) < ENEMIES[es.kind].rayon + 8) { w.damageEnemy(es, P.dmg! * lv, p); if (P.stun && es.e.hp > 0) etourdir(es, P.stun) }
      }
      p.cadT = P.dur!; p.cadK = P.cad!
      w.hooks.fx(x0, y0, { k: 'sk', s: 'percee', x: x0, y: y0, x2: p.s.x, y2: p.s.y })
      return true
    }
    case 'tir_lourd': {
      const a = p.s.angle
      w.hooks.fx(x, y, { k: 'sk', s: 'visee', x, y, a, len: P.len, t: P.delai })
      plusTard(w, P.delai!, () => {
        if (p.s.etat !== 0) return
        const sx = p.s.x, sy = p.s.y, ex = sx + Math.cos(a) * P.len!, ey = sy + Math.sin(a) * P.len!
        const fin = finDeLigne(w, sx, sy, ex, ey)
        for (const es of [...w.enemies.values()]) {
          if (distSeg(es.e.x, es.e.y, sx, sy, fin.x, fin.y) > ENEMIES[es.kind].rayon + 5) continue
          const exec = drapeau(p.talents, 'execution') && es.e.hp < es.e.maxHp * 0.3 ? 3 : 1
          w.damageEnemy(es, P.dmg! * lv * exec * (1 + (p.mods.deg + p.st.deg) / 100), p)
        }
        w.hooks.fx(sx, sy, { k: 'sk', s: 'tir_lourd', x: sx, y: sy, x2: fin.x, y2: fin.y })
      })
      return true
    }
    case 'filet': {
      const { gx, gy } = vers(p, tx, ty, 200, 120)
      const pris = ennemisDans(w, gx, gy, P.r!)
      for (const es of pris) { if (estBoss(es)) ralentir(es, 0.6, P.dur!); else statuts(es).stunT = Math.max(statuts(es).stunT, P.dur!); marquer(es, 8, drapeau(p.talents, 'traque') ? 0.4 : 0.25) }
      if (drapeau(p.talents, 'meute')) for (const es of pris.slice(0, 3)) poserMine(w, p, es.e.x, es.e.y, { ...PARAMS_MINE, dmg: 60 * lv }, 5)
      w.hooks.fx(x, y, { k: 'grenade', x, y, x2: gx, y2: gy, t: 0.25, filet: 1 })
      fx({ r: P.r }, gx, gy); return true
    }
    case 'perfusion': { poserZone(w, { kind: 'perfusion', x, y, r: P.r!, t: P.dur!, owner: p, suit: true, dps: 0, soin: P.soin! }); return true }
    case 'toxine': {
      const { gx, gy } = vers(p, tx, ty, 190, 120)
      poserZone(w, { kind: 'toxine', x: gx, y: gy, r: P.r!, t: P.dur!, owner: p, suit: false, dps: P.dps! * lv, soin: 0 })
      w.hooks.fx(x, y, { k: 'grenade', x, y, x2: gx, y2: gy, t: 0.35, fiole: 1 })
      return true
    }
    case 'blindage': {
      const rb = p.robot
      if (!rb || rb.kind !== 'robot' || rb.r.mode === 6) return false
      if (rb.r.mode === 3) { rb.r.mode = 0; rb.offT = 0 }
      rb.r.hp = Math.min(rb.r.maxHp, rb.r.hp + rb.r.maxHp * P.soin! / 100)
      rb.blindT = P.dur!; rb.blindRed = P.red!
      for (const es of ennemisDans(w, rb.r.x, rb.r.y, 160)) provoquer(es, P.dur!, rb)
      w.hooks.fx(rb.r.x, rb.r.y, { k: 'zone', z: 'blindage', x: rb.r.x, y: rb.r.y, r: 20, t: P.dur, rid: rb.id, ami: 1 })
      return true
    }
    case 'essaim': {
      const n = Math.round(P.n!)
      for (let i = 0; i < n; i++) { const d = machine(w, p, 'drone', x, y, P.dur!, 1, 9); d.orbite = i / n * Math.PI * 2 }
      fx({ n }); return true
    }
    case 'tapis': {
      const a = Math.atan2((ty ?? y + Math.sin(p.s.angle)) - y, (tx ?? x + Math.cos(p.s.angle)) - x)
      const n = Math.round(P.n!)
      for (let i = 0; i < n; i++) {
        const d = 50 + i * 34, cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d
        if (hits(w.map, cx, cy, 1)) break
        const t = 0.8 + i * 0.16
        w.addTele({ kind: 'cercle', x: cx, y: cy, x2: 0, y2: 0, r: P.r!, t, total: t, dmg: -P.dmg! * lv, src: p.sid })
      }
      fx({}); return true
    }
    case 'brasier': { poserZone(w, { kind: 'brasier', x, y, r: P.r!, t: P.dur!, owner: p, suit: true, dps: P.dps! * lv, soin: 0 }); return true }
    case 'court_circuit': {
      const { gx, gy } = vers(p, tx, ty, 200, 120)
      const touches = ennemisDans(w, gx, gy, P.r!)
      for (const es of touches) { w.damageEnemy(es, P.dmg! * lv, p); if (es.e.hp > 0) etourdir(es, P.dur!) }
      fx({ r: P.r }, gx, gy)
      if (drapeau(p.talents, 'surtension')) {
        let de = touches[0]?.e ?? { x: gx, y: gy }
        const deja = new Set(touches)
        for (let i = 0; i < 3; i++) {
          let best: ESim | null = null, bd = 130
          for (const es of w.enemies.values()) { if (deja.has(es) || ENEMIES[es.kind].passif) continue; const d = Math.hypot(es.e.x - de.x, es.e.y - de.y); if (d < bd) { bd = d; best = es } }
          if (!best) break
          deja.add(best)
          w.hooks.fx(de.x, de.y, { k: 'sk', s: 'arc', x: de.x, y: de.y, x2: best.e.x, y2: best.e.y })
          w.damageEnemy(best, P.dmg! * lv * 0.7, p); if (best.e.hp > 0) etourdir(best, P.dur! * 0.7)
          de = best.e
        }
      }
      return true
    }
    case 'voile': {
      p.voileT = P.dur!; p.voileMul = P.mul!
      for (const es of w.enemies.values()) if (es.target && (es.target as any).ref === p) { es.target = null; es.thinkT = 0.5 }
      w.majVitesse(p)
      fx({}); return true
    }
  }
  return false
}
const PARAMS_MINE: SkillParams = { cd: 0, dmg: 60, r: 40, dur: 20 }

/** Le pas des petites machines du soldat (leurre, mine, drone). Rend true si le robot a été traité ici. */
export function stepMachine(w: World, rs: RSim, dt: number): boolean {
  const r = rs.r
  if (rs.kind === 'leurre') {
    rs.ttl -= dt
    r.angle += dt * 0.5
    if (rs.ttl <= 0) { w.hooks.fx(r.x, r.y, { k: 'sk', s: 'leurre_fin', x: r.x, y: r.y }); w.removeRobot(rs.id) }
    return true
  }
  if (rs.kind === 'mine') {
    rs.ttl -= dt
    if (rs.ttl <= 0) { w.removeRobot(rs.id); return true }
    for (const es of w.enemies.values()) {
      if (ENEMIES[es.kind].passif || Math.hypot(es.e.x - r.x, es.e.y - r.y) > 18 + ENEMIES[es.kind].rayon) continue
      w.removeRobot(rs.id)
      exploser(w, rs.owner, r.x, r.y, rs.mine?.r ?? 40, rs.mine?.dmg ?? 60)
      break
    }
    return true
  }
  if (rs.kind === 'drone') {
    const o = rs.owner
    rs.ttl -= dt
    if (!o || o.s.etat !== 0 || rs.ttl <= 0) {
      if (o && drapeau(o.talents, 'kamikaze')) {
        let best: ESim | null = null, bd = 220
        for (const es of w.enemies.values()) { if (ENEMIES[es.kind].passif) continue; const d = Math.hypot(es.e.x - r.x, es.e.y - r.y); if (d < bd) { bd = d; best = es } }
        if (best) { const b = best; w.hooks.fx(r.x, r.y, { k: 'sk', s: 'arc', x: r.x, y: r.y, x2: b.e.x, y2: b.e.y }); exploser(w, o, b.e.x, b.e.y, 30, 60 * dmgMul(o.level) * (1 + o.mods.puissance / 100)) }
      }
      w.removeRobot(rs.id)
      return true
    }
    rs.orbite = (rs.orbite ?? 0) + dt * 2.2
    r.x = o.s.x + Math.cos(rs.orbite) * 22; r.y = o.s.y + Math.sin(rs.orbite) * 16 - 6
    rs.cd -= dt; rs.targetT -= dt
    if (rs.targetT <= 0) {
      rs.targetT = 0.3
      let best: ESim | null = null, bd = 170
      for (const es of w.enemies.values()) { if (ENEMIES[es.kind].passif) continue; const d = Math.hypot(es.e.x - r.x, es.e.y - r.y); if (d < bd) { bd = d; best = es } }
      rs.target = best
    }
    const t = rs.target
    if (t && w.enemies.has(t.id)) {
      r.angle = Math.atan2(t.e.y - r.y, t.e.x - r.x)
      if (rs.cd <= 0) {
        rs.cd = 0.45
        const dmg = 4.5 * dmgMul(o.level) * (1 + (o.mods.puissance + o.mods.robot) / 100)
        w.addBullet(r.x, r.y, Math.cos(r.angle) * 360, Math.sin(r.angle) * 360, 2, dmg, 0.55, null, rs)
      }
    }
    return true
  }
  return false
}

/** Les PV max d'un robot de soldat, avec ses talents (Soudure, Forteresse…). */
export function pvRobot(level: number, owner: PSim | null) { return Math.round(robotHp(level) * (1 + (owner?.mods.robotPv ?? 0) / 100)) }

function distSeg(px: number, py: number, x0: number, y0: number, x1: number, y1: number) {
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy
  const k = l2 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2)) : 0
  return Math.hypot(px - (x0 + dx * k), py - (y0 + dy * k))
}
/** le bout d'une ligne de tir : le premier mur */
function finDeLigne(w: World, x0: number, y0: number, x1: number, y1: number) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (TILE / 2))
  for (let i = 1; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; if (w.shotBlocked(x, y)) return { x, y } }
  return { x: x1, y: y1 }
}

/** pour les messages (texte flottant) */
export const texteMaitrise = (id: string) => msg(`maitrise.${id}.nom`)
