// L'arène de la Couveuse : les motifs de balles sont déterministes (même graine, mêmes balles, au serveur comme au
// client, qui reçoit le motif en JSON), et un vrai combat de soldats IA traverse les trois phases.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { balles, posBalle, touche, finMotif, MOTIF_KINDS, ARENE, borneArene, clampArene, type Motif } from '../shared/motifs.ts'
import { carteMap } from '../shared/cartes/index.ts'
import { isSolidTile } from '../shared/map.ts'
import { E } from '../shared/rules.ts'
import { NEST, TILE } from '../shared/consts.ts'
import { World } from '../server/world/World.ts'
import { BotBrain } from '../server/world/bots.ts'

const motif = (k: Motif['k'], seed: number): Motif => ({ id: 1, k, t0: 10, seed, x: (ARENE.x0 + ARENE.x1) / 2, y: ARENE.y0 + 60, a: 1.2, n: 4, p: k === 'vague' ? 200 : 1 })

test('même graine, mêmes balles ; le motif passé en JSON (le réseau) donne les mêmes positions', () => {
  for (const k of MOTIF_KINDS) {
    const serveur = motif(k, 123456)
    const client: Motif = JSON.parse(JSON.stringify(serveur)) // ce que reçoit le téléphone
    const a = balles(serveur), b = balles(client)
    assert.ok(a.length > 0, k)
    assert.deepEqual(a, b, k)
    for (let t = 10; t < finMotif(serveur); t += 0.05) for (let i = 0; i < a.length; i++) assert.deepEqual(posBalle(serveur, a[i], t), posBalle(client, b[i], t), `${k} balle ${i} à ${t}`)
  }
})

test('une autre graine change le motif (sauf les salves visées, qui ne tirent qu\'un écart)', () => {
  for (const k of ['serpent', 'spirale', 'vague'] as const) assert.notDeepEqual(balles(motif(k, 1)), balles(motif(k, 2)), k)
})

test('les balles ne dépendent pas de Math.random', () => {
  const r = Math.random
  Math.random = () => { throw new Error('Math.random appelé') }
  try { for (const k of MOTIF_KINDS) balles(motif(k, 99)) } finally { Math.random = r }
})

test('la touche serveur tombe là où le client dessine la balle', () => {
  const m = motif('spirale', 7)
  const bs = balles(m)
  const t = m.t0 + bs[5].ts + 0.5
  const p = posBalle(m, bs[5], t)!
  assert.equal(touche(m, t, p.x, p.y), touche(JSON.parse(JSON.stringify(m)), t, p.x, p.y))
  assert.ok(touche(m, t, p.x, p.y) >= 0)
  assert.equal(touche(m, t, p.x, p.y, new Set(bs.map((_, i) => i))), -1) // balles déjà mortes
})

test('chaque rangée d\'une vague a un trou d\'au moins 30 px', () => {
  for (let seed = 1; seed < 40; seed++) {
    const m: Motif = { id: 1, k: 'vague', t0: 0, seed, x: ARENE.x0, y: ARENE.y0 + 80, a: 0, n: 4, p: ARENE.x1 - ARENE.x0 }
    const rangs = new Map<number, number[]>()
    for (const b of balles(m)) rangs.set(b.ts, [...(rangs.get(b.ts) ?? []), b.x])
    for (const xs of rangs.values()) {
      xs.push(m.x, m.x + m.p) // les bords de l'arène
      xs.sort((a, b) => a - b)
      let trou = 0
      for (let i = 1; i < xs.length; i++) trou = Math.max(trou, xs[i] - xs[i - 1])
      assert.ok(trou >= 30, `graine ${seed}`)
    }
  }
})

test('l\'arène tient dans l\'enclos, large (faite pour le paysage), et la ruche resserrée garde de la place', () => {
  const m = carteMap('nid')
  for (let y = NEST.y0 + 1; y < NEST.y1; y++) for (let x = NEST.x0 + 1; x < NEST.x1; x++) assert.ok(!isSolidTile(m.tiles[y * m.w + x]), `${x},${y}`)
  assert.ok(ARENE.x1 - ARENE.x0 > (ARENE.y1 - ARENE.y0) * 1.5)
  const b = borneArene(2), b1 = borneArene(1)
  assert.ok(b.x1 - b.x0 > 300 && b.y1 - b.y0 > 150)
  assert.ok(b.y1 < b1.y1 && b.x0 > b1.x0 && b.x1 < b1.x1, 'les murs avancent des côtés et du bas')
  const s = { x: ARENE.x0, y: ARENE.y1 + 50 }
  clampArene(s, b)
  assert.ok(s.x === b.x0 && s.y === b.y1)
})

test('un combat de soldats IA dans l\'arène traverse les trois phases', () => {
  const msgs: Record<string, number> = {}
  const w = new World({ mode: 'secteur', map: carteMap('nid') }, { fx() {}, log() {}, arene: (t) => { msgs[t] = (msgs[t] ?? 0) + 1 } })
  const cx = (ARENE.x0 + ARENE.x1) / 2
  // un « joueur » (pilote automatique) et trois soldats IA, niveau 15
  const chef = w.addPlayer({ sid: 'moi', account: 'a', soldierId: 0, given: 'Test', family: 'Banc', generation: 1, cls: 'fantassin', level: 15, xp: 0, x: cx, y: ARENE.y1 - 30 })
  chef.auto = new BotBrain()
  for (let i = 0; i < 3; i++) { const b = new BotBrain(); b.leader = chef; w.addPlayer({ sid: 'ia' + i, account: '', soldierId: 0, given: 'IA' + i, family: 'Colonie', generation: 1, cls: (['medic', 'ingenieur', 'fantassin'] as const)[i], level: 15, xp: 0, bot: b, x: cx - 40 + i * 40, y: ARENE.y1 - 40 }) }
  for (const p of w.players.values()) w.giveRobot(p, 5)
  const phases = new Set<number>()
  let sacs = 0
  for (let t = 0; t < 20 * 400 && !(w.arene!.boss === null && phases.size === 3); t++) {
    w.step(1 / 20)
    if (w.arene!.ferme) phases.add(w.arene!.phase)
    sacs = Math.max(sacs, w.arene!.sacs.filter((s) => !s).length)
    // personne ne sort de l'arène fermée
    if (w.arene!.ferme) for (const p of w.players.values()) if (p.s.etat === 0) { const b = w.arene!.borne; assert.ok(p.s.x >= b.x0 - 0.01 && p.s.x <= b.x1 + 0.01, `x ${p.s.x}`) }
  }
  assert.deepEqual([...phases].sort(), [1, 2, 3], `phases vues : ${[...phases]}`)
  console.log('durée', w.time.toFixed(0), 'motifs', msgs.motif)
  assert.ok(msgs.motif > 10, `motifs : ${msgs.motif}`) // moins dense depuis que balles et zones alternent
  assert.ok(msgs.aflash > 3)
  assert.ok(sacs >= 1, 'au moins un sac crevé')
  assert.ok([...w.enemies.values()].every((e) => e.kind !== E.COUVEUSE), 'la Couveuse est tombée')
  assert.equal(w.arene!.ferme, false, 'le nid se rouvre')
  console.log(`combat : ${w.time.toFixed(0)} s, ${msgs.motif} motifs, soldats debout ${[...w.players.values()].filter((p) => p.s.etat === 0).length}/4, dégâts subis ${[...w.players.values()].map((p) => p.degatsSubis).join(' ')}`)
  void TILE
})
