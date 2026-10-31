// L'arène de la Couveuse est évitable : un soldat « parfait » qui ne fait que marcher à sa vitesse de base (pas
// d'esquive, pas de soins, pas de tir) vers l'endroit sûr le plus proche, avec ce qu'un joueur voit à l'écran (les
// zones annoncées, le sol fissuré, les balles), traverse les trois phases sans un seul coup de zone, sur 10 graines.
// Les balles qui le touchent quand même sont comptées. La Couveuse et ses sacs perdent leurs PV au fil du temps (les
// coéquipiers qui tirent) ; les œufs sont retirés à la ponte (ce ne sont pas des zones).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ARENE, SOL, TOUCHE_R, balles, posBalle, caseSol, clampArene, graine } from '../shared/motifs.ts'
import { carteMap } from '../shared/cartes/index.ts'
import { E } from '../shared/rules.ts'
import { PLAYER_R } from '../shared/consts.ts'
import { World, type PSim, type InputCmd } from '../server/world/World.ts'

const ZONES = new Set(['la ponte de la Couveuse', 'les spores de la Couveuse', "l'anneau de la Couveuse", "l'acide du nid", 'le vide sous le nid'])
const PAS = 0.05, HORIZON = 8

/** ce que le soldat voit : un point est-il sûr (zones annoncées, sol abîmé ou fissuré, corps de la Couveuse) ? */
function sur(w: World, x: number, y: number) {
  const a = w.arene!
  for (const t of w.teles) if ((t.kind === 'grille' || t.kind === 'colonnes' || t.kind === 'anneau') && w.inTele(t, x, y, PLAYER_R + 1)) return false
  for (const [dx, dy] of [[0, 0], [-3, 0], [3, 0], [0, -3], [0, 3]]) { const c = caseSol(x + dx, y + dy); if (c >= 0 && a.sol[c] !== SOL.INTACT) return false }
  const b = a.boss?.e
  if (b && Math.hypot(x - b.x, y - b.y) < 40) return false
  return true
}

/** les balles visibles qui passeraient sur ce point à l'instant t (marge d'un pixel et demi) */
function balleSur(w: World, x: number, y: number, t: number) {
  for (const mv of w.arene!.motifs) {
    if (t < mv.m.t0 - 0.05) continue
    const bs = balles(mv.m)
    for (let i = 0; i < bs.length; i++) {
      if (mv.mortes.has(i)) continue
      const p = posBalle(mv.m, bs[i], t)
      if (p && (p.x - x) ** 2 + (p.y - y) ** 2 < (bs[i].r + TOUCHE_R + 1.5) ** 2) return true
    }
  }
  return false
}

/** le temps avant que tombe la première zone annoncée (ou la fissure du sol) */
function urgence(w: World) {
  let t = Infinity
  for (const z of w.teles) if (z.kind === 'grille' || z.kind === 'colonnes' || z.kind === 'anneau') t = Math.min(t, z.t)
  for (const v of w.arene!.veines) if (v.t > 0) t = Math.min(t, v.t)
  return t
}

function parfait(w: World, p: PSim): InputCmd {
  const a = w.arene!, s = p.s, v = s.vit, bo = a.borne
  // la cible : là où il est s'il y est sûr, sinon le point sûr le plus proche (une grille de 6 px)
  let cible = { x: s.x, y: s.y }
  if (!sur(w, s.x, s.y)) {
    let bd = Infinity
    for (let y = bo.y0; y <= bo.y1; y += 6) for (let x = bo.x0; x <= bo.x1; x += 6) {
      const d = Math.hypot(x - s.x, y - s.y)
      if (d < bd && sur(w, x, y)) { bd = d; cible = { x, y } }
    }
  } else {
    // au repos, il revient doucement vers le bas de l'arène, au milieu (loin du corps)
    const rx = (bo.x0 + bo.x1) / 2, ry = bo.y1 - 40
    if (sur(w, rx, ry)) cible = { x: s.x + (rx - s.x) * 0.2, y: s.y + (ry - s.y) * 0.2 }
  }
  // le pas : parmi 16 directions et l'arrêt, celui qui évite les balles des 0,4 s à venir et finit le plus près de la cible
  let best: [number, number] = [0, 0], bs = Infinity
  for (let k = -1; k < 16; k++) {
    const mx = k < 0 ? 0 : Math.cos(k * Math.PI / 8), my = k < 0 ? 0 : Math.sin(k * Math.PI / 8)
    const q = { x: s.x, y: s.y }
    let score = 0
    for (let i = 1; i <= HORIZON; i++) {
      q.x += mx * v * PAS; q.y += my * v * PAS
      clampArene(q, bo)
      if (balleSur(w, q.x, q.y, w.time + i * PAS)) score += 1000 / i
      const c = caseSol(q.x, q.y)
      if (c >= 0 && (a.sol[c] === SOL.ACIDE || a.sol[c] === SOL.VIDE)) score += 300
    }
    score += Math.hypot(q.x - cible.x, q.y - cible.y)
    // finir dans une zone : peu grave au début de l'annonce, rédhibitoire juste avant qu'elle tombe (le remplissage du
    // contour montre le temps qui reste)
    if (!sur(w, q.x, q.y)) score += urgence(w) < 0.6 ? 5000 : 60
    if (score < bs) { bs = score; best = [mx, my] }
  }
  return { mx: best[0], my: best[1], aim: s.angle, fire: false }
}

function combat(seed: number) {
  const r = Math.random
  Math.random = graine(seed)
  try {
    const w = new World({ mode: 'secteur', map: carteMap('nid') }, { fx() {}, log() {}, arene() {} })
    const p = w.addPlayer({ sid: 'moi', account: 'a', soldierId: 0, given: 'Parfait', family: 'Banc', generation: 1, cls: 'fantassin', level: 16, xp: 0, x: (ARENE.x0 + ARENE.x1) / 2, y: ARENE.y1 - 36 })
    p.auto = { think: (ww: World, pp: PSim) => parfait(ww, pp) } as any
    const coups: Record<string, number> = {}
    const dmg = w.damagePlayer.bind(w)
    w.damagePlayer = (q, n, by) => {
      if (q === p && q.s.etat === 0) coups[by] = (coups[by] ?? 0) + 1
      if (process.env.BAVARD && ZONES.has(by)) console.log('ZONE', by, Math.round(q.s.x), Math.round(q.s.y), 'dash', q.s.dashT, 'tele', JSON.stringify(w.teles.map((t) => [t.kind, t.x, t.y, t.x2, t.y2, t.r, t.r2, +t.t.toFixed(2)])), 'borne', JSON.stringify(w.arene!.borne))
      dmg(q, n, by)
    }
    const phases = new Set<number>()
    let finie = false
    for (let i = 0; i < 20 * 260 && !finie; i++) {
      w.step(1 / 20)
      const a = w.arene!
      if (a.ferme) phases.add(a.phase)
      // les coéquipiers : les sacs tombent vers 15 et 30 s, la Couveuse en ~110 s ; ils tuent les œufs
      if (a.ferme) {
        a.sacs.forEach((sac, k) => { if (sac && w.enemies.has(sac.id) && w.time > 15 + k * 15) w.damageEnemy(sac, sac.e.maxHp, null) })
        const b = a.boss
        if (b && w.enemies.has(b.id)) w.damageEnemy(b, b.e.maxHp / 110 / 20, null)
        for (const es of [...w.enemies.values()]) if (es.kind === E.OEUF || es.kind === E.RAMPANT) w.removeEnemy(es.id)
      }
      if (phases.size === 3 && !a.boss) finie = true
      // le soldat parfait ne doit jamais tomber
      if (p.s.etat !== 0) break
    }
    return { phases: [...phases].sort(), coups, mort: p.s.etat !== 0, finie, duree: w.time, pv: `${p.s.hp}/${p.s.maxHp}` }
  } finally { Math.random = r }
}

test('un soldat parfait, sans esquive ni soins, évite toutes les zones de la Couveuse (10 graines)', { timeout: 600000 }, () => {
  const total: Record<string, number> = {}
  for (let seed = 1; seed <= 10; seed++) {
    const r = combat(seed)
    for (const [k, n] of Object.entries(r.coups)) total[k] = (total[k] ?? 0) + n
    console.log(`graine ${seed} : ${r.duree.toFixed(0)} s, phases ${r.phases.join('')}, PV ${r.pv}, coups ${JSON.stringify(r.coups)}`)
    assert.ok(!r.mort, `graine ${seed} : le soldat parfait est tombé`)
    assert.ok(r.finie, `graine ${seed} : le combat n'est pas allé au bout`)
    assert.deepEqual(r.phases, [1, 2, 3])
    const zones = Object.entries(r.coups).filter(([k]) => ZONES.has(k))
    assert.equal(zones.length, 0, `graine ${seed} : coups de zone ${JSON.stringify(zones)}`)
    // quelques balles tolérées (le soldat parfait ne prévoit que 0,4 s), mais pas plus de 6 par combat
    const nb = Object.values(r.coups).reduce((a, b) => a + b, 0)
    assert.ok(nb <= 6, `graine ${seed} : ${nb} balles`)
  }
  console.log('touches sur 10 combats, par source :', JSON.stringify(total))
})
