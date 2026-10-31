// Tests des règles : concessions (validation, budget, récompense), mort selon le front, relève, front et avant-postes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateConcession, concessionCost, rewardFor, LIMITS, textProblem } from '../shared/bricks.ts'
import { zoneAt, deathRule, stepRuches, pushFrontByKill, ecartBordure, sousBiomasse, RUCHES, RAYONS_DEPART, FRONT } from '../shared/front.ts'
import { heirLevel, xpToNext } from '../shared/rules.ts'
import { TILE, PORT_W, NEST } from '../shared/consts.ts'
import { generateSector, SECTOR_SEED, isSolidTile } from '../shared/map.ts'
import { World } from '../server/world/World.ts'
import { measureConcession } from '../server/measure.ts'
import { Db } from '../server/db.ts'
import { exemple } from './exemple.ts'

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o))

// ---------------------------------------------------------------- concessions
test('une concession correcte est acceptée', () => {
  const v = validateConcession(exemple)
  assert.deepEqual(v.erreurs, [])
  assert.ok(v.ok)
  assert.ok(v.cout > 0 && v.cout <= LIMITS.budgetPuissance)
})

test('du code ou un champ inconnu est refusé (schéma fermé)', () => {
  const c: any = clone(exemple); c.script = 'process.exit()'
  assert.equal(validateConcession(c).ok, false)
  const d: any = clone(exemple); d.vagues[0].groupes[0].brique = 'dragon'
  assert.equal(validateConcession(d).ok, false)
})

test('le budget de puissance est respecté', () => {
  const c: any = clone(exemple)
  c.vagues = Array.from({ length: 8 }, () => ({ delai: 2, groupes: [{ brique: 'cuirasse', nombre: 10, x: 30, y: 11, variante: { pv: 2 } }] }))
  const v = validateConcession(c)
  assert.equal(v.ok, false)
  assert.ok(v.cout > LIMITS.budgetPuissance)
  assert.ok(v.erreurs.some((e) => /budget/i.test(e)), v.erreurs.join(' / '))
})

test('budget technique : trop d\'ennemis, ennemis sur le départ, départ dans un mur, hors carte', () => {
  const a: any = clone(exemple); a.vagues[0].groupes[0].nombre = 41
  assert.equal(validateConcession(a).ok, false)
  const b: any = clone(exemple); b.vagues[0].groupes[0].x = 5; b.vagues[0].groupes[0].y = 11
  assert.equal(validateConcession(b).ok, false)
  const c: any = clone(exemple); c.depart = { x: 12, y: 5 }
  assert.equal(validateConcession(c).ok, false)
  const d: any = clone(exemple); d.boss.x = 80
  assert.equal(validateConcession(d).ok, false)
})

test('textes filtrés : liens et insultes refusés', () => {
  assert.ok(textProblem('va sur https://exemple.com'))
  assert.equal(textProblem('La serre respire.'), null)
  const c: any = clone(exemple); c.textes.intro = 'www.pub.com'
  assert.equal(validateConcession(c).ok, false)
})

test('la récompense vient de la mesure du serveur et reste bornée', () => {
  const facile = rewardFor(100, { gagne: true, dureeS: 20, degatsSubis: 0 })
  const dure = rewardFor(100, { gagne: true, dureeS: 200, degatsSubis: 400 })
  assert.ok(dure.ferraille > facile.ferraille)
  const enorme = rewardFor(100000, { gagne: true, dureeS: 999, degatsSubis: 9999 })
  assert.ok(enorme.ferraille <= 150)
  assert.ok(rewardFor(1, { gagne: false, dureeS: 1, degatsSubis: 0 }).ferraille >= 5)
})

test('la passe de bots mesure une concession (headless)', () => {
  const v = validateConcession(exemple)
  const m = measureConcession(v.concession!, 240)
  assert.ok(m.dureeS > 0)
  assert.ok(m.tues > 0, 'les bots tuent des ennemis')
  assert.ok(m.calculMs < 15000)
})

// ---------------------------------------------------------------- front et mort
test('zones : Port-Ancre, derrière, au-delà (dans une tache), nid, abri', () => {
  const r = [...RAYONS_DEPART]
  assert.equal(zoneAt(r, 199 * TILE, 312 * TILE), 'port')
  assert.equal(zoneAt(r, 150 * TILE, 300 * TILE), 'derriere', 'les plaines, loin des ruches')
  const h = RUCHES[0]
  assert.equal(zoneAt(r, h.x * TILE, (h.y + 10) * TILE), 'dela', 'au cœur de la Grande Ruche')
  assert.equal(zoneAt(r, (NEST.x0 + 3) * TILE, (NEST.y0 + 3) * TILE, [], 'nid'), 'nid')
  assert.equal(zoneAt(r, 2 * TILE, 2 * TILE, [], 'nid'), 'dela', 'hors de l\'enclos du nid')
  assert.equal(zoneAt(r, h.x * TILE, h.y * TILE, [], 'abri'), 'derriere', 'l\'épave est une carte à l\'abri')
  // une poche tenue autour d'un avant-poste actif
  const x = h.x * TILE, y = (h.y + 10) * TILE
  assert.equal(zoneAt(r, x, y, [{ x, y, actif: true }]), 'derriere')
  assert.equal(zoneAt(r, x, y, [{ x, y, actif: false }]), 'dela')
})

test('règles de mort selon le front', () => {
  assert.equal(deathRule('port').ensuite, 'evacuation')
  assert.equal(deathRule('derriere').ensuite, 'evacuation')
  assert.equal(deathRule('dela').ensuite, 'mort-definitive')
  assert.equal(deathRule('nid').ensuite, 'mort-definitive')
  assert.equal(deathRule('concession').ensuite, 'reapparition')
})

test('les ruches : la tache grandit, recule avec les mises à mort près de la bordure, reste bornée', () => {
  const r = [...RAYONS_DEPART]
  stepRuches(r, 100, [])
  assert.ok(r.every((x, i) => x > RAYONS_DEPART[i]), 'chaque ruche grandit')
  // une mise à mort juste sur la bordure de la Grande Ruche
  const h = RUCHES[0], a = 1.0
  const rb = r[0] * (1 + 0.18 * Math.sin(3 * a + h.phi) + 0.1 * Math.sin(7 * a + h.psi))
  const kx = (h.x + Math.cos(a) * rb) * TILE, ky = (h.y + Math.sin(a) * rb) * TILE
  assert.ok(Math.abs(ecartBordure(h, r[0], kx / TILE, ky / TILE)) < 0.01)
  const avant = r[0]
  assert.equal(pushFrontByKill(r, kx, ky), 0)
  assert.ok(r[0] < avant)
  // loin de toute bordure : rien ne bouge
  const copie = [...r]
  assert.equal(pushFrontByKill(r, 150 * TILE, 300 * TILE), -1)
  assert.deepEqual(r, copie)
  const g = [...RAYONS_DEPART]
  stepRuches(g, 1e6, [])
  assert.ok(g.every((x, i) => x === RUCHES[i].rmax), 'plafond')
  for (let i = 0; i < 1e5; i++) pushFrontByKill(g, kx, ky)
  assert.ok(g[0] >= RUCHES[0].rmin, 'plancher')
})

test('les ruches font des taches, pas un mur : plusieurs foyers, une bordure irrégulière', () => {
  const r = [...RAYONS_DEPART]
  const foyers = RUCHES.filter((h, i) => sousBiomasse(r, h.x, h.y) === i)
  assert.equal(foyers.length, RUCHES.length, 'chaque ruche est dans sa propre tache')
  // la bordure n'est pas un cercle : son rayon varie selon la direction
  const h = RUCHES[0], rs: number[] = []
  for (let a = 0; a < Math.PI * 2; a += 0.2) { let d = 0; while (ecartBordure(h, r[0], h.x + Math.cos(a) * d, h.y + Math.sin(a) * d) < 0) d += 0.25; rs.push(d) }
  assert.ok(Math.max(...rs) - Math.min(...rs) > 8, `amplitude ${Math.max(...rs) - Math.min(...rs)}`)
})

test('un avant-poste actif planté dans une tache fait reculer sa ruche', () => {
  const sans = [...RAYONS_DEPART], avec = [...RAYONS_DEPART]
  const h = RUCHES[0]
  const o = { x: (h.x - RAYONS_DEPART[0] + 6) * TILE, y: h.y * TILE, actif: true }
  for (let i = 0; i < 300; i++) { stepRuches(sans, 1, []); stepRuches(avec, 1, [o]) }
  assert.ok(avec[0] < sans[0], `${avec[0]} < ${sans[0]}`)
  assert.equal(avec[1], sans[1], 'les autres ruches ne bougent pas')
  void FRONT
})

// ---------------------------------------------------------------- relève et progression
test('relève : l\'héritier garde la moitié des niveaux', () => {
  assert.equal(heirLevel(1), 1)
  assert.equal(heirLevel(9), 4)
  assert.equal(heirLevel(30), 15)
  assert.ok(xpToNext(10) > xpToNext(2))
})

function world(hooks: any = {}) {
  const map = generateSector(SECTOR_SEED)
  const w = new World({ mode: 'secteur', map }, { fx() {}, log() {}, ...hooks })
  return w
}
const free = (w: World, x0: number, y: number) => { for (let x = x0; x < x0 + 40; x++) if (!isSolidTile(w.map.tiles[y * w.map.w + x])) return x; return x0 }

test('à terre au-delà du front sans aide : mort définitive', () => {
  let mort = 0
  const w = world({ permadeath: () => { mort++ } })
  const tx = free(w, 300, 82)
  const p = w.addPlayer({ sid: 'a', account: 'A', soldierId: 1, given: 'Ugo', family: 'Test', generation: 1, cls: 'fantassin', level: 5, xp: 0, x: tx * TILE + 8, y: 82 * TILE + 8 })
  assert.equal(w.zoneOf(p.s.x, p.s.y), 'dela')
  w.enemies.clear(); w.state.enemies.clear()
  p.invulT = 0
  w.damagePlayer(p, 9999, 'un test')
  assert.equal(p.s.etat, 1)
  assert.equal(p.downRule, 'mort-definitive')
  for (let i = 0; i < 20 * 10 && p.s.etat === 1; i++) w.stepDowned(p, 0.05)
  assert.equal(mort, 1)
  assert.equal(p.s.etat, 2)
})

test('à terre derrière le front : évacuation et sac perdu, jamais de mort définitive', () => {
  let mort = 0, evac = 0
  const w = world({ permadeath: () => { mort++ }, evacuate: () => { evac++ } })
  const tx = free(w, 140, 300)
  const p = w.addPlayer({ sid: 'b', account: 'B', soldierId: 2, given: 'Ana', family: 'Test', generation: 1, cls: 'medic', level: 3, xp: 0, x: tx * TILE + 8, y: 300 * TILE + 8 })
  assert.equal(w.zoneOf(p.s.x, p.s.y), 'derriere')
  p.sac = 50; p.invulT = 0
  w.damagePlayer(p, 9999, 'un test')
  assert.equal(p.downRule, 'evacuation')
  for (let i = 0; i < 20 * 15 && p.s.etat === 1; i++) w.stepDowned(p, 0.05)
  assert.equal(mort, 0); assert.equal(evac, 1)
  assert.equal(p.s.etat, 0); assert.equal(p.sac, 0)
  assert.ok(p.s.x / TILE < PORT_W)
})

test('un allié relève un soldat à terre au-delà du front', () => {
  let mort = 0
  const w = world({ permadeath: () => { mort++ } })
  const tx = free(w, 300, 82)
  const p = w.addPlayer({ sid: 'c', account: 'C', soldierId: 3, given: 'Léo', family: 'Test', generation: 1, cls: 'fantassin', level: 2, xp: 0, x: tx * TILE + 8, y: 82 * TILE + 8 })
  w.addPlayer({ sid: 'd', account: 'D', soldierId: 4, given: 'Mia', family: 'Test', generation: 1, cls: 'medic', level: 2, xp: 0, x: tx * TILE + 14, y: 82 * TILE + 8 })
  p.invulT = 0
  w.damagePlayer(p, 9999, 'un test')
  for (let i = 0; i < 20 * 10 && p.s.etat === 1; i++) w.stepDowned(p, 0.05)
  assert.equal(p.s.etat, 0); assert.equal(mort, 0)
})

// ---------------------------------------------------------------- base : lignée et plafond
test('lignée : mort, héritier, plafond journalier des concessions', () => {
  const d = new Db(join(tmpdir(), `heirline-test-${Date.now()}.db`))
  const a = d.createGuest('Varenne')
  const s1 = d.createSoldier(a.id, 'fantassin', 12, 1)
  d.killSoldier(s1, { killer: 'un Rampant', x: 0, y: 0, family: a.family })
  assert.equal(d.livingSoldier(a.id), undefined)
  const s2 = d.createSoldier(a.id, 'medic', heirLevel(s1.level), 2)
  assert.equal(s2.level, 6)
  assert.equal(d.lineage(a.id).length, 2)
  assert.equal(d.deaths(5).length, 1)
  assert.equal(d.concessionLoot(a.id, 200, LIMITS.plafondJour), 200)
  assert.equal(d.concessionLoot(a.id, 200, LIMITS.plafondJour), LIMITS.plafondJour - 200)
  assert.equal(d.concessionLoot(a.id, 200, LIMITS.plafondJour), 0)
  const p = d.publishConcession(a.id, undefined, 'x', '{}', '{}')
  const b = d.createGuest()
  assert.throws(() => d.publishConcession(b.id, p.id, 'y', '{}', '{}'))
  assert.equal(d.publishConcession(a.id, p.id, 'x2', '{}', '{}').version, 2)
})
