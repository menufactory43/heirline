// Les donjons : l'Antre de l'Engloutisseur et le Gosier de la Gueule (normal et héroïque). Les cartes vont en lacets
// jusqu'à l'arène ; les arènes sont évitables par un soldat « parfait » (la même méthode que tests/arene-evitable :
// il ne fait que marcher à sa vitesse de base vers l'endroit sûr le plus proche, sans esquive ni soins ni tir) ; une
// zone à la fois ; peu d'éclairs ; le butin de l'héroïque est meilleur.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ARENE, TOUCHE_R, balles, posBalle, clampArene, graine } from '../shared/motifs.ts'
import { carteMap } from '../shared/cartes/index.ts'
import { CARTES, DONJONS, PASSAGES, type CarteId } from '../shared/monde.ts'
import { E } from '../shared/rules.ts'
import { NEST, PLAYER_R, TILE } from '../shared/consts.ts'
import { isSolidTile } from '../shared/map.ts'
import { butinEquip } from '../shared/butin.ts'
import { World, type PSim, type InputCmd } from '../server/world/World.ts'

const ZONES = new Set(['le reflux de la vase', "le saut de l'Engloutisseur", 'les crocs de la Gueule', 'la langue de la Gueule', 'les dents de la Gueule', "l'essaim de la Pépinière", "la haie d'épines", 'les vitres de la Serre', 'la rature du Greffier', 'les pages du Registre', "l'encre du Registre"])
const PAS = 0.05, HORIZON = 8
/** les causes des zones, telles que le serveur les envoie (clé de traduction) */
const ZONES_K = ['reflux', 'plongee', 'crocs', 'langue', 'dents', 'essaim', 'epines', 'vitres', 'rature', 'pages', 'encre']
const estZone = (k: string) => ZONES.has(k) || ZONES_K.some((z) => k.includes(`srv.tueur.${z}\\"`) || k.includes(`srv.tueur.${z}"`))
const ZK = new Set(['grille', 'colonnes', 'anneau', 'ligne', 'cercle'])

test('chaque donjon va en lacets de l\'entrée à la porte de l\'arène', () => {
  for (const c of DONJONS) {
    const m = carteMap(c)
    const sortie = PASSAGES.find((p) => p.carte === c)!
    const sx = sortie.x + sortie.sortie[0], sy = sortie.y + sortie.sortie[1]
    const dist = new Int32Array(m.w * m.h).fill(-1)
    const file = [sy * m.w + sx]; dist[file[0]] = 0
    while (file.length) {
      const i = file.shift()!, x = i % m.w, y = (i / m.w) | 0
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = (y + dy) * m.w + x + dx
        if (dist[j] < 0 && !isSolidTile(m.tiles[j])) { dist[j] = dist[i] + 1; file.push(j) }
      }
    }
    const porte = ((NEST.doorY0 + NEST.doorY1) >> 1) * m.w + NEST.x0 + 2
    assert.ok(dist[porte] > 0, `${c} : la porte de l'arène est atteignable`)
    const droit = Math.abs(NEST.x0 + 2 - sx) + Math.abs(((NEST.doorY0 + NEST.doorY1) >> 1) - sy)
    assert.ok(dist[porte] > droit * 2.5, `${c} : ${dist[porte]} pas contre ${droit} à vol d'oiseau (des lacets)`)
  }
})

function sur(w: World, x: number, y: number) {
  for (const t of w.teles) if (ZK.has(t.kind) && w.inTele(t, x, y, PLAYER_R + 1)) return false
  const b = w.arene!.boss?.e
  if (b && Math.hypot(x - b.x, y - b.y) < 44) return false
  return true
}
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
const urgence = (w: World) => Math.min(Infinity, ...w.teles.filter((z) => ZK.has(z.kind)).map((z) => z.t))

function parfait(w: World, p: PSim): InputCmd {
  const a = w.arene!, s = p.s, v = s.vit, bo = a.borne
  let cible = { x: s.x, y: s.y }
  if (!sur(w, s.x, s.y)) {
    let bd = Infinity
    for (let y = bo.y0; y <= bo.y1; y += 6) for (let x = bo.x0; x <= bo.x1; x += 6) {
      const d = Math.hypot(x - s.x, y - s.y)
      if (d < bd && sur(w, x, y)) { bd = d; cible = { x, y } }
    }
  } else {
    const rx = (bo.x0 + bo.x1) / 2, ry = bo.y1 - 40
    if (sur(w, rx, ry)) cible = { x: s.x + (rx - s.x) * 0.2, y: s.y + (ry - s.y) * 0.2 }
  }
  let best: [number, number] = [0, 0], bs = Infinity
  for (let k = -1; k < 16; k++) {
    const mx = k < 0 ? 0 : Math.cos(k * Math.PI / 8), my = k < 0 ? 0 : Math.sin(k * Math.PI / 8)
    const q = { x: s.x, y: s.y }
    let score = 0
    for (let i = 1; i <= HORIZON; i++) {
      q.x += mx * v * PAS; q.y += my * v * PAS
      clampArene(q, bo)
      if (balleSur(w, q.x, q.y, w.time + i * PAS)) score += 1000 / i
    }
    score += Math.hypot(q.x - cible.x, q.y - cible.y)
    if (!sur(w, q.x, q.y)) score += urgence(w) < 0.6 ? 5000 : 60
    if (score < bs) { bs = score; best = [mx, my] }
  }
  return { mx: best[0], my: best[1], aim: s.angle, fire: false }
}

function combat(carte: CarteId, seed: number) {
  const r = Math.random
  Math.random = graine(seed)
  try {
    let flashes = 0
    const w = new World({ mode: 'secteur', map: carteMap(carte) }, { fx() {}, log() {}, arene: (t: string) => { if (t === 'aflash') flashes++ } })
    const niveau = CARTES[carte].arene!.niveau
    const p = w.addPlayer({ sid: 'moi', account: 'a', soldierId: 0, given: 'Parfait', family: 'Banc', generation: 1, cls: 'fantassin', level: niveau, xp: 0, x: (ARENE.x0 + ARENE.x1) / 2, y: ARENE.y1 - 36 })
    p.auto = { think: (ww: World, pp: PSim) => parfait(ww, pp) } as any
    const coups: Record<string, number> = {}
    const dmg = w.damagePlayer.bind(w)
    w.damagePlayer = (q, n, by) => { if (q === p && q.s.etat === 0) { coups[by] = (coups[by] ?? 0) + 1; if (process.env.DBG) console.log('coup', by, w.time.toFixed(1), 'phase', w.arene!.phase, 'teles', w.teles.map((t) => t.kind + ':' + t.t.toFixed(1)).join(','), 'motifs', w.arene!.motifs.length, 'pos', p.s.x.toFixed(0), p.s.y.toFixed(0), 'borne', JSON.stringify(w.arene!.borne)) } dmg(q, n, by) }
    const phases = new Set<number>()
    let finie = false, deuxZones = 0
    for (let i = 0; i < 20 * 200 && !finie; i++) {
      w.step(1 / 20)
      const a = w.arene!
      if (a.ferme) phases.add(a.phase)
      if (w.teles.filter((z) => ZK.has(z.kind)).length > 1) deuxZones++
      if (a.ferme) {
        const b = a.boss
        if (b && w.enemies.has(b.id)) w.damageEnemy(b, b.e.maxHp / 100 / 20, null)
        // les adds (sangsues, pots, boutures, porte-noms) : les coéquipiers s'en chargent
        for (const es of [...w.enemies.values()]) if (es.kind === E.SANGSUE || es.kind === E.POT || es.kind === E.BOUTURE || es.kind === E.PORTENOM) w.removeEnemy(es.id)
      }
      if (phases.size === 3 && !a.boss) finie = true
      if (p.s.etat !== 0) break
    }
    return { phases: [...phases].sort(), coups, mort: p.s.etat !== 0, finie, duree: w.time, flashes, deuxZones }
  } finally { Math.random = r }
}

for (const carte of DONJONS) test(`${carte} : un soldat parfait évite toutes les zones (6 graines)`, { timeout: 600000 }, () => {
  for (let seed = 1; seed <= 6; seed++) {
    const r = combat(carte, seed)
    console.log(`${carte} graine ${seed} : ${r.duree.toFixed(0)} s, phases ${r.phases.join('')}, éclairs ${r.flashes}, coups ${JSON.stringify(r.coups)}`)
    assert.ok(!r.mort, `graine ${seed} : le soldat parfait est tombé`)
    assert.ok(r.finie, `graine ${seed} : pas allé au bout`)
    assert.deepEqual(r.phases, [1, 2, 3])
    assert.equal(r.deuxZones, 0, 'jamais deux zones annoncées à la fois')
    assert.deepEqual(Object.entries(r.coups).filter(([k]) => estZone(k)), [], `graine ${seed} : coups de zone`)
    assert.ok(Object.values(r.coups).reduce((a, b) => a + b, 0) <= 8, `graine ${seed} : trop de balles`)
    assert.ok(r.flashes / (r.duree / 60) <= 10, `graine ${seed} : ${r.flashes} éclairs en ${r.duree.toFixed(0)} s`)
  }
})

test('l\'héroïque : plus de PV, et un meilleur butin', () => {
  const pv = (c: CarteId) => { const w = new World({ mode: 'secteur', map: carteMap(c) }, { fx() {}, log() {}, arene() {} }); w.arene!.eveil(1); return w.arene!.boss!.e.maxHp }
  assert.ok(pv('antre_h') > pv('antre') * 1.4)
  assert.ok(pv('gueule_h') > pv('gueule') * 1.4)
  assert.ok(pv('serre_h') > pv('serre') * 1.4)
  assert.ok(pv('registre_h') > pv('registre') * 1.4)
  const R = graine(4)
  let n = 0, nh = 0
  for (let i = 0; i < 200; i++) { n += butinEquip({ kind: E.GUEULE, level: 20, elite: false, endroit: 'gueule', cls: 'medic' }, R).length; nh += butinEquip({ kind: E.GUEULE, level: 20, elite: false, endroit: 'gueule_h', cls: 'medic' }, R).length }
  assert.ok(nh > n)
  void TILE
})
