// Campagne 2, les Hauts de Glane : la lecture de la Pépinière (fonctions pures et dans le monde), les familles de
// créatures (Glaneur qui éteint les robots, Bouturé qui repousse, Fileuse qui tend un fil), le butin des niveaux 20 à 35.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lue, compter, oublier, multLecture, codeLecture, LECTURE, type Comptes } from '../shared/lecture.ts'
import { E } from '../shared/rules.ts'
import { TABLES, butinEquip } from '../shared/butin.ts'
import { rollEquip, LEGENDAIRES, SET_BY_ID, R_LEGENDAIRE } from '../shared/items.ts'
import { carteMap } from '../shared/cartes/index.ts'
import { TILE } from '../shared/consts.ts'
import { World } from '../server/world/World.ts'

test('la lecture : une source qui domine est lue, elle s\'oublie en dix minutes, un bourgeon tué fait oublier', () => {
  const c: Comptes = [0, 0, 0, 0]
  for (let i = 0; i < 8; i++) compter(c, 'balle', 1)
  assert.equal(lue(c).src, null, 'trop peu de morts pour lire')
  for (let i = 0; i < 8; i++) compter(c, 'balle', 1)
  compter(c, 'explosion', 2)
  assert.equal(lue(c).src, 'balle')
  assert.equal(codeLecture(c), 'balle:89')
  assert.equal(multLecture(E.GLANEUR, 'balle', 'balle'), 1 - LECTURE.reduc)
  assert.equal(multLecture(E.RAMPANT, 'balle', 'balle'), 1, 'les créatures d\'Ossara ne lisent pas')
  assert.equal(multLecture(E.GLANEUR, 'explosion', 'balle'), 1)
  // varier : trois sources à parts égales, plus rien n'est lu
  const v: Comptes = [10, 10, 10, 0]
  assert.equal(lue(v).src, null)
  // un bourgeon abattu aux balles fait oublier 15 % des balles
  compter(c, 'balle', 0, true)
  assert.ok(Math.abs(c[0] - 16 * 0.85) < 1e-9)
  oublier(c, 600)
  assert.ok(c[0] < 16 * 0.85 * 0.37 && lue(c).src === null, 'oublié en dix minutes')
})

function monde() {
  const w = new World({ mode: 'secteur', map: carteMap('ossara') }, { fx() {}, log() {} })
  const p = w.addPlayer({ sid: 'moi', account: 'a', soldierId: 0, given: 'T', family: 'B', generation: 1, cls: 'fantassin', level: 25, xp: 0, x: 476 * TILE, y: 277 * TILE })
  return { w, p }
}

test('dans le monde : les morts des Hauts sont comptées par source, double près d\'un bourgeon ; la source lue fait 30 % de moins', () => {
  const { w, p } = monde()
  const x = 540 * TILE, y = 160 * TILE
  const g = w.spawnEnemy(E.GLANEUR, x, y, { level: 25 })
  w.damageEnemy(g, 99999, p, false, false, 'balle')
  assert.equal(w.localLecture[0], 1)
  w.spawnEnemy(E.BOURGEON, x + 40, y, { level: 25 })
  const g2 = w.spawnEnemy(E.GLANEUR, x, y, { level: 25 })
  w.damageEnemy(g2, 99999, p, false, false, 'balle')
  assert.equal(w.localLecture[0], 3, 'près d\'un bourgeon, une mort compte double')
  // une rampante d'Ossara ne compte pas
  const r = w.spawnEnemy(E.RAMPANT, x, y, { level: 25 })
  w.damageEnemy(r, 99999, p, false, false, 'balle')
  assert.equal(w.localLecture[0], 3)
  // la lecture établie : 30 % de moins aux balles, rien aux explosions
  w.localLecture[0] = 40
  const g3 = w.spawnEnemy(E.BOUTURE, x, y, { level: 25 })
  const pv = g3.e.hp
  w.damageEnemy(g3, 100, p, false, false, 'balle')
  assert.equal(pv - g3.e.hp, 70)
  w.damageEnemy(g3, 100, p, false, false, 'explosion')
  assert.equal(pv - g3.e.hp, 170)
  // le Masque de sève : la Pépinière ne lit pas ce soldat
  p.eff.add('masque_seve')
  w.damageEnemy(g3, 100, p, false, false, 'balle')
  assert.equal(pv - g3.e.hp, 270)
})

test('le Glaneur éteint un robot à la quatrième morsure ; la Bobine du Tisserand le protège', () => {
  const { w, p } = monde()
  w.giveRobot(p, 5)
  const rs = p.robot!
  for (let i = 0; i < 3; i++) w.glaner(rs)
  assert.notEqual(rs.r.mode, 3)
  w.glaner(rs)
  assert.equal(rs.r.mode, 3, 'éteint')
  const b = monde()
  b.w.giveRobot(b.p, 5)
  b.p.eff.add('bobine')
  for (let i = 0; i < 6; i++) b.w.glaner(b.p.robot!)
  assert.notEqual(b.p.robot!.r.mode, 3)
})

test('le Bouturé laisse un pot qui repousse en 8 s (une seule fois) ; la Fileuse tend un fil annoncé', () => {
  const { w, p } = monde()
  const x = 590 * TILE, y = 262 * TILE
  const b = w.spawnEnemy(E.BOUTURE, x, y, { level: 28 })
  const plein = b.e.maxHp
  w.damageEnemy(b, 99999, p, false, false, 'balle')
  const pot = [...w.enemies.values()].find((e) => e.kind === E.POT)
  assert.ok(pot, 'un pot')
  for (let i = 0; i < 20 * 8.5; i++) w.stepEnemy(pot!, 1 / 20)
  const re = [...w.enemies.values()].find((e) => e.kind === E.BOUTURE && e.repousse)
  assert.ok(re && !w.enemies.has(pot!.id), 'il a repoussé')
  assert.ok(re!.e.maxHp < plein * 0.7, 'plus faible')
  w.damageEnemy(re!, 99999, p, false, false, 'balle')
  assert.equal([...w.enemies.values()].filter((e) => e.kind === E.POT).length, 0, 'pas de second pot')
  // la Fileuse : un tir sur trois est un fil (une ligne annoncée d'une seconde)
  const f = w.spawnEnemy(E.FILEUSE, p.s.x + 100, p.s.y, { level: 30 })
  let lignes = 0
  for (let i = 0; i < 20 * 8; i++) { const n = w.teles.length; w.stepEnemy(f, 1 / 20); if (w.teles.length > n && w.teles[w.teles.length - 1].kind === 'ligne') lignes++ }
  assert.ok(lignes >= 1, `${lignes} fils`)
})

test('le butin des Hauts : quatre tables, la Trame du Métier sur les élites, des légendaires des Hauts à partir du niveau 20', () => {
  for (const id of ['lisiere', 'champs', 'pepiniere', 'metier']) { assert.ok(TABLES[id], id); assert.equal(TABLES[id].ensemble?.id, 'trame') }
  assert.ok(SET_BY_ID.trame)
  const hauts = LEGENDAIRES.filter((l) => l.niveau === 20).map((l) => l.id)
  assert.equal(hauts.length, 5)
  let R = 1
  const rnd = () => { R = (R * 16807) % 2147483647; return R / 2147483647 }
  for (let i = 0; i < 400; i++) assert.ok(!hauts.includes(rollEquip('arme', 12, R_LEGENDAIRE, 'fantassin', rnd).leg ?? ''), 'pas avant le niveau 20')
  let vu = 0
  for (let i = 0; i < 400; i++) if (rollEquip('arme', 25, R_LEGENDAIRE, 'fantassin', rnd).leg === 'fil') vu++
  assert.ok(vu > 50, `Fil du Métier ${vu}/400`)
  // une élite des Champs donne au moins un objet, de son niveau
  const it = butinEquip({ kind: E.RETOURNE, level: 27, elite: true, endroit: 'champs', cls: 'fantassin' }, rnd)
  assert.ok(it.length >= 1 && it.every((x) => x.l === 27))
})
