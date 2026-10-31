// Le butin et l'équipement : raretés, affixes, légendaires, ensembles, tables par endroit et par boss, recyclage,
// et les effets portés (server/world/equipement.ts) dans un monde sans réseau.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rollEquip, totalStats, effetsPortes, piecesSet, recyclage, slotsFor, isEquip, itemKey, LEGENDAIRES, ENSEMBLES, PIECES_SET, NB_AFFIXES, STAT_KEYS, TYPES_EQUIP, R_LEGENDAIRE, R_ENSEMBLE, type Equip } from '../shared/items.ts'
import { butinEquip, TABLES, TABLES_BOSS } from '../shared/butin.ts'
import { graine } from '../shared/motifs.ts'
import { E } from '../shared/rules.ts'
import { aCle } from '../shared/i18n/index.ts'
import { World } from '../server/world/World.ts'
import { carteMap } from '../shared/cartes/index.ts'

test('chaque rareté a ses affixes, chaque objet un nom traduit et un emplacement', () => {
  const R = graine(7)
  for (const b of TYPES_EQUIP) for (let r = 0; r <= 3; r++) {
    const it = rollEquip(b, 20, r, 'medic', R)
    assert.ok(isEquip(it) && slotsFor(it).length, b)
    assert.ok(aCle(itemKey(it)), `${b} ${r} : ${itemKey(it)}`)
    const base = rollEquip(b, 20, 0, 'medic', graine(1))
    assert.ok(Object.keys(it.s).length >= Object.keys(base.s).length, `${b} ${r}`)
  }
  for (const l of LEGENDAIRES) { const it = rollEquip(l.base, 30, R_LEGENDAIRE, 'fantassin', R, { leg: l.id }); assert.equal(it.leg, l.id); assert.ok(aCle(itemKey(it)), l.id); assert.ok(aCle(`legendaire.${l.id}.desc`)) }
  for (const e of ENSEMBLES) for (const b of PIECES_SET) { const it = rollEquip(b, 30, R_ENSEMBLE, 'fantassin', R, { set: e.id }); assert.equal(it.set, e.id); assert.ok(aCle(itemKey(it)), `${e.id} ${b}`) }
  // un ensemble sur une base qui n'en a pas : un épique ordinaire
  assert.equal(rollEquip('arme', 30, R_ENSEMBLE, 'fantassin', R, { set: 'couveuse' }).r, 3)
  assert.equal(NB_AFFIXES.length, 6)
})

test('le même générateur donne le même butin', () => {
  const o = { kind: E.RAMPANT, level: 12, elite: true, endroit: 'marais', cls: 'eclaireur' as const }
  const a = butinEquip(o, graine(42)).map((i) => ({ ...i, u: '' })), b = butinEquip(o, graine(42)).map((i) => ({ ...i, u: '' }))
  assert.deepEqual(a, b)
})

test('les tables : un boss lâche une pièce de son ensemble, une élite au moins un objet peu commun', () => {
  const R = graine(3)
  for (const [k, tb] of Object.entries(TABLES_BOSS)) {
    const l = butinEquip({ kind: Number(k), level: 16, elite: false, endroit: 'nid', cls: 'medic' }, R)
    assert.equal(l.filter((i) => i.set === tb.ensemble).length, tb.pieces)
    assert.ok(l.filter((i) => !i.set).every((i) => i.r >= 2))
  }
  for (const endroit of Object.keys(TABLES)) for (let i = 0; i < 50; i++) {
    const l = butinEquip({ kind: E.CRACHEUR, level: 10, elite: true, endroit, cls: 'medic' }, R)
    assert.ok(l.length >= 1 && l.every((it) => it.r >= 1), endroit)
  }
  // sur 20 000 créatures ordinaires des plaines : des objets, rarement des légendaires
  let n = 0, leg = 0
  for (let i = 0; i < 20000; i++) for (const it of butinEquip({ kind: E.RAMPANT, level: 3, elite: false, endroit: 'plaines', cls: 'medic' }, R)) { n++; if (it.r === R_LEGENDAIRE) leg++ }
  assert.ok(n > 1200 && n < 2000, `objets ${n}`)
  assert.ok(leg >= 0 && leg < 10, `légendaires ${leg}`)
})

test('ensembles : bonus à deux pièces, effet à quatre ; recyclage selon la rareté', () => {
  const R = graine(9)
  const eq: Equip = {}
  for (const b of PIECES_SET.slice(0, 2)) eq[b] = rollEquip(b, 20, R_ENSEMBLE, 'medic', R, { set: 'engloutisseur' })
  const sans = totalStats({ casque: eq.casque })
  assert.equal(piecesSet(eq).engloutisseur, 2)
  assert.ok(totalStats(eq).deg >= sans.deg + 8)
  assert.ok(!effetsPortes(eq).has('set:engloutisseur'))
  for (const b of PIECES_SET) eq[b] = rollEquip(b, 20, R_ENSEMBLE, 'medic', R, { set: 'engloutisseur' })
  assert.ok(effetsPortes(eq).has('set:engloutisseur'))
  const r0 = recyclage(rollEquip('arme', 10, 0, 'medic', R)), r4 = recyclage(rollEquip('arme', 10, R_LEGENDAIRE, 'medic', R))
  assert.ok(r4.ferraille > r0.ferraille && r4.pieces > r0.pieces)
  for (const k of STAT_KEYS) assert.ok(Number.isFinite(totalStats(eq)[k]), k)
})

test('les effets portés agissent dans le monde', () => {
  const w = new World({ mode: 'secteur', map: carteMap('ossara') }, { fx() {}, log() {} })
  const p = w.addPlayer({ sid: 'p', account: 'a', soldierId: 0, given: 'T', family: 'B', generation: 1, cls: 'fantassin', level: 20, xp: 0 })
  const R = graine(5)
  // Gantelets du Recycleur : un ennemi tué rend 1 s d'esquive
  p.equip = { gants: rollEquip('gants', 20, R_LEGENDAIRE, 'fantassin', R, { leg: 'recycleur' }) }
  w.applyEquip(p)
  assert.ok(p.eff.has('recycleur'))
  p.s.dashCd = 2
  const es = w.spawnEnemy(E.RAMPANT, p.s.x + 40, p.s.y)
  w.damageEnemy(es, 99999, p)
  assert.equal(p.s.dashCd, 1)
  // les affixes s'ajoutent aux bonus des talents, plafonnés
  p.equip = { casque: { ...rollEquip('casque', 20, 0, 'fantassin', R), s: { crit: 90 } } }
  w.applyEquip(p)
  assert.equal(p.mods.crit, 40)
  // Cuirasse du Rappel : sous 25 % de PV, une onde ; pas deux fois en 30 s
  p.equip = { armure: rollEquip('armure', 20, R_LEGENDAIRE, 'fantassin', R, { leg: 'rappel' }) }
  w.applyEquip(p)
  const proche = w.spawnEnemy(E.RAMPANT, p.s.x + 30, p.s.y)
  p.s.hp = Math.round(p.s.maxHp * 0.3); p.invulT = 0
  w.damagePlayer(p, p.s.maxHp * 0.1, 'essai')
  assert.ok((proche.stt?.stunT ?? 0) > 0, 'étourdi par l\'onde')
  assert.ok(p.effT.rappel > 29)
})

test('équilibrage (tools/sim-butin.ts) : la puissance monte avec le niveau, sans s\'envoler', async () => {
  const { simuler } = await import('../tools/sim-butin.ts')
  for (const g of [1, 2, 3]) {
    const { lignes } = simuler(g)
    const p = (n: number) => lignes.find((x) => x.niveau === n)!.puissance
    assert.ok(p(10) > p(1) && p(20) > p(10) && p(30) >= p(20), `graine ${g}`)
    assert.ok(p(30) > 5 && p(30) < 14, `graine ${g} : ×${p(30)} au niveau 30`)
  }
})
