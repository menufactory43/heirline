// Les effets de l'équipement : légendaires et ensembles complets (shared/items.ts, LEGENDAIRES et ENSEMBLES).
// Le monde appelle ces crochets aux bons moments ; chaque effet est porté dans p.eff, ses minuteries dans p.effT.
import { ENEMIES } from '../../shared/rules.ts'
import type { World, PSim, BSim, ESim } from './World.ts'
import { marquer, etourdir, poserZone } from './competences.ts'

const a = (p: PSim, e: string) => p.eff.has(e)

/** combien de sources différentes ce soldat a utilisées ces 6 dernières secondes (balles, explosions, robot, compétences) */
export function sourcesRecentes(p: PSim) { let n = 0; for (const s of ['balle', 'explosion', 'robot', 'competence']) if (p.effT['src_' + s] > 0) n++; return n }

/** chaque pas : les recharges des effets */
export function step(p: PSim, dt: number) {
  for (const k in p.effT) if (p.effT[k] > 0) p.effT[k] = Math.max(0, p.effT[k] - dt)
}

/** un tir part : le ricochet compte les tirs, le tir dévorant (ensemble de l'Engloutisseur) se recharge */
export function surTir(p: PSim, bs: BSim) {
  if (a(p, 'ricochet')) { p.effT.ricN = (p.effT.ricN ?? 0) + 1; if (p.effT.ricN >= 8) { p.effT.ricN = 0; bs.ricochet = 2 } }
  if (a(p, 'set:engloutisseur') && !(p.effT.devore > 0)) { p.effT.devore = 10; bs.devore = true; bs.dmg *= 2.5 }
}

/** une balle d'un soldat touche : marque des critiques, rebonds, tir dévorant, cible pour le robot */
export function surTouche(w: World, bs: BSim, es: ESim, crit: boolean, n: number) {
  const p = bs.ownerP
  if (!p) return
  if (crit && a(p, 'visiere')) marquer(es, 4, 0.25)
  // le Fil du Métier : au cinquième fil, la créature des Hauts est ligotée
  if (a(p, 'fil') && es.kind >= 17 && es.kind <= 28 && !ENEMIES[es.kind].boss) {
    es.fils = (es.fils ?? 0) + 1
    if (es.fils >= 5) { es.fils = 0; etourdir(es, 1.5); w.hooks.fx(es.e.x, es.e.y, { k: 'txt', x: es.e.x, y: es.e.y - 16, s: '⌇', c: '#ffd27a' }) }
  }
  if (a(p, 'set:constance')) p.effT.cible = 0, p.cibleRobot = es.id
  if (bs.devore) {
    w.hooks.fx(es.e.x, es.e.y, { k: 'sk', s: 'devore', x: es.e.x, y: es.e.y })
    for (const o of w.enemies.values()) {
      if (o === es || o.boss || ENEMIES[o.kind].boss) continue
      const d = Math.hypot(o.e.x - es.e.x, o.e.y - es.e.y)
      if (d > 8 && d < 70) { const k = Math.min(40, d - 8) / d; o.e.x -= (o.e.x - es.e.x) * k; o.e.y -= (o.e.y - es.e.y) * k }
    }
  }
  if (bs.ricochet) {
    const vus = new Set([es.id])
    let x = es.e.x, y = es.e.y
    for (let i = 0; i < bs.ricochet; i++) {
      let best: ESim | null = null, bd = 110
      for (const o of w.enemies.values()) { if (vus.has(o.id) || o.e.hp <= 0) continue; const d = Math.hypot(o.e.x - x, o.e.y - y); if (d < bd) { bd = d; best = o } }
      if (!best) break
      vus.add(best.id)
      w.hooks.fx(x, y, { k: 'sk', s: 'ricochet', x, y, x2: best.e.x, y2: best.e.y })
      w.damageEnemy(best, n * 0.6, p, false, false, 'balle')
      x = best.e.x; y = best.e.y
    }
  }
}

/** les dégâts reçus par un soldat, avant de les retirer : le robot en prend une part, l'équipage de la Constance */
export function reduire(w: World, p: PSim, n: number) {
  const rb = p.robot
  const proche = (r: number) => !!rb && rb.kind === 'robot' && rb.r.mode !== 3 && rb.r.mode !== 6 && Math.hypot(rb.r.x - p.s.x, rb.r.y - p.s.y) < r
  if (a(p, 'set:constance') && proche(120)) n *= 0.85
  if (a(p, 'porteur') && proche(160)) { w.damageRobot(rb!, n * 0.2); n *= 0.8 }
  return n
}

/** après un coup : la Cuirasse du Rappel */
export function apresCoup(w: World, p: PSim) {
  if (!a(p, 'rappel') || p.s.hp <= 0 || p.s.hp > p.s.maxHp * 0.25 || p.effT.rappel > 0) return
  p.effT.rappel = 30
  w.hooks.fx(p.s.x, p.s.y, { k: 'sk', s: 'onde', x: p.s.x, y: p.s.y, r: 80 })
  for (const es of w.enemies.values()) {
    const d = Math.hypot(es.e.x - p.s.x, es.e.y - p.s.y)
    if (d > 80) continue
    etourdir(es, 1)
    if (!es.boss && d > 1) { const k = Math.min(36, 80 - d) / d; es.e.x += (es.e.x - p.s.x) * k; es.e.y += (es.e.y - p.s.y) * k }
  }
}

/** un ennemi tombe sous les coups d'un soldat */
export function surKill(w: World, p: PSim | null, es: ESim) {
  if (!p) return
  if (a(p, 'recycleur')) p.s.dashCd = Math.max(0, p.s.dashCd - 1)
  if (a(p, 'set:couveuse')) {
    w.hooks.fx(es.e.x, es.e.y, { k: 'sk', s: 'spore_soin', x: es.e.x, y: es.e.y })
    for (const q of w.players.values()) if (q.s.etat === 0 && Math.hypot(q.s.x - es.e.x, q.s.y - es.e.y) < 90) w.heal(q, q.s.maxHp * 0.04, q !== p)
  }
}

/** une esquive commence : les Semelles de Braise */
export function surEsquive(w: World, p: PSim) {
  // les Bottes du Sillon : des PV par ennemi frôlé
  if (a(p, 'sillon')) {
    let n = 0
    for (const es of w.enemies.values()) if (es.e.hp > 0 && Math.hypot(es.e.x - p.s.x, es.e.y - p.s.y) < 60 && ++n >= 3) break
    if (n) w.heal(p, p.s.maxHp * 0.06 * n, false)
  }
  if (!a(p, 'braise')) return
  poserZone(w, { kind: 'brasier', x: p.s.x, y: p.s.y, r: 26, t: 3, owner: p, suit: false, dps: 14 * (1 + p.level * 0.08), soin: 0 })
}

/** une compétence vient d'être lancée : le Condensateur fêlé */
export function surCompetence(w: World, p: PSim, i: number) {
  // la Trame du Métier : avec les quatre sources récentes, cette compétence ne se recharge pas, et les fils tombent
  if (a(p, 'set:trame') && sourcesRecentes(p) >= 4) {
    p.cd[i] = 0
    for (const s of ['balle', 'explosion', 'robot', 'competence']) p.effT['src_' + s] = 0
    w.hooks.fx(p.s.x, p.s.y, { k: 'txt', x: p.s.x, y: p.s.y - 18, s: '⌇⌇⌇⌇', c: '#ffd27a' })
    return
  }
  if (!a(p, 'condensateur') || p.cd[i] <= 1 || Math.random() >= 0.2) return
  p.cd[i] = 0
  w.hooks.fx(p.s.x, p.s.y, { k: 'txt', x: p.s.x, y: p.s.y - 18, s: '↺', c: '#ffa640' })
}
