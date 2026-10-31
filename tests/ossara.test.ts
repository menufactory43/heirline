// Tests du monde ouvert : quêtes (dialogues, objectifs, choix moral), sac et marchands, journées des habitants,
// gardes, chemins, et la ruée prédite.
import { trx } from '../shared/i18n/index.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateWorld, SECTOR_SEED, isSolidTile } from '../shared/map.ts'
import { TILE } from '../shared/consts.ts'
import { E, applyMove, DASH } from '../shared/rules.ts'
import { routineSpot, NPC_BY_ID, NPCS } from '../shared/npcs.ts'
import { STATIONS, PASSAGES } from '../shared/monde.ts'
import { findPath } from '../shared/path.ts'
import { countInv, rollEquip, material, addToInv, INV_MAX } from '../shared/items.ts'
import { QUESTS } from '../shared/quests.ts'
import { World, type PSim } from '../server/world/World.ts'
import { Vie } from '../server/world/Vie.ts'
import { Ossara } from '../server/ossara.ts'
import { Db, setDb, db } from '../server/db.ts'

const MAP = generateWorld(SECTOR_SEED)

function monde() {
  setDb(new Db(':memory:'))
  const sent: { type: string; msg: any }[] = []
  const w = new World({ mode: 'secteur', map: MAP }, { fx() {}, log() {} })
  const vie = new Vie(w)
  w.life = vie
  const o = new Ossara(w, vie, { send: (_p, type, msg) => sent.push({ type, msg }), log() {} })
  w.hooks.kill = (by, es, near) => o.onKill(by, es, near)
  const acc = db().createGuest('Essai')
  const p = w.addPlayer({ sid: 's1', account: acc.id, soldierId: 0, given: 'Ana', family: 'Essai', generation: 1, cls: 'fantassin', level: 1, xp: 0 })
  return { w, vie, o, p, acc, sent }
}
const goTo = (m: ReturnType<typeof monde>, npc: string) => { const n = m.vie.npcs.get(npc)!.n; m.p.s.x = n.x + 10; m.p.s.y = n.y + 6 }

test('le monde : Ossara et les Hauts de Glane sur une carte de 640 × 400, Port-Ancre relié à chaque habitant, gare et sas', () => {
  assert.equal(MAP.w, 640); assert.equal(MAP.h, 400)
  const sp = MAP.points.spawn
  const libre = (x: number, y: number) => { for (let r = 0; r < 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!isSolidTile(MAP.tiles[(y + dy) * MAP.w + x + dx])) return [x + dx, y + dy]; return [x, y] }
  const cibles: [string, number, number][] = [
    ...NPCS.map((n) => [n.id, n.poste[0], n.poste[1]] as [string, number, number]),
    ...STATIONS.map((g) => [g.id, g.x, g.y + 2] as [string, number, number]),
    ...PASSAGES.filter((pa) => pa.carte === 'ossara').map((pa) => [pa.id, pa.x + pa.sortie[0], pa.y + pa.sortie[1]] as [string, number, number]),
  ]
  for (const [id, x, y] of cibles) {
    const [fx, fy] = libre(x, y)
    assert.ok(findPath(MAP, Math.floor(sp.x / TILE), Math.floor(sp.y / TILE), fx, fy, 400000), `chemin vers ${id} (${x},${y})`)
  }
  assert.ok(MAP.monde!.batiments.length >= 20)
  assert.ok(MAP.monde!.camps.length >= 60)
  assert.ok(QUESTS.filter((q) => !q.campagne).length >= 15 && QUESTS.filter((q) => !q.campagne).length <= 40)
})

test('quête : accepter, parler, rendre, récompense', () => {
  const m = monde()
  goTo(m, 'ysolde')
  const d = m.o.talk(m.p, 'ysolde')!
  assert.ok(d.options.some((o) => o.id === 'voir:matricule'), 'Ysolde propose Matricule (!)')
  m.o.choose(m.p, 'ysolde', 'voir:matricule')
  m.o.choose(m.p, 'ysolde', 'accepter:matricule')
  assert.ok(m.o.state(m.acc.id).active.has('matricule'))
  goTo(m, 'joss'); m.o.talk(m.p, 'joss')
  goTo(m, 'nadia'); m.o.talk(m.p, 'nadia')
  goTo(m, 'ysolde')
  const d2 = m.o.talk(m.p, 'ysolde')!
  assert.ok(d2.options.some((o) => o.id === 'rendre:matricule'), 'la quête se rend (?)')
  const xp0 = m.p.xp + m.p.level * 1000
  m.o.choose(m.p, 'ysolde', 'rendre:matricule')
  assert.ok(m.o.state(m.acc.id).done.has('matricule'))
  assert.ok(m.p.inv.some((it) => it.b === 'armure'), 'armure reçue')
  assert.equal(countInv(m.p.inv, 'trousse'), 2)
  assert.ok(m.p.xp + m.p.level * 1000 > xp0)
  assert.ok(db().account(m.acc.id)!.scrap >= 25)
  // trop loin : pas de dialogue
  m.p.s.x += 200
  assert.equal(m.o.talk(m.p, 'ysolde'), null)
})

test('quête : objectifs « tuer » et « ramasser », butin des créatures', () => {
  const m = monde()
  goTo(m, 'aldo')
  m.o.choose(m.p, 'aldo', 'accepter:rodeurs_aldo')
  m.o.choose(m.p, 'odile', 'accepter:ragout') // trop loin d'Odile : refusé
  assert.ok(!m.o.state(m.acc.id).active.has('ragout'))
  for (let i = 0; i < 6; i++) { const es = m.w.spawnEnemy(E.RODEUR, m.p.s.x + 40, m.p.s.y, { level: 2 }); m.w.damageEnemy(es, 9999, m.p) }
  const prog = m.o.state(m.acc.id).active.get('rodeurs_aldo')!
  assert.equal(prog[0], 6)
  goTo(m, 'odile'); m.o.choose(m.p, 'odile', 'accepter:ragout')
  for (let i = 0; i < 40 && countInv(m.p.inv, 'viande') < 5; i++) { const es = m.w.spawnEnemy(E.BROUTARD, m.p.s.x + 30, m.p.s.y, { level: 1 }); m.w.damageEnemy(es, 9999, m.p) }
  assert.ok(countInv(m.p.inv, 'viande') >= 5)
  m.o.recountItems(m.p)
  assert.equal(m.o.state(m.acc.id).active.get('ragout')![0], 5)
  m.o.choose(m.p, 'odile', 'rendre:ragout')
  assert.ok(m.o.state(m.acc.id).done.has('ragout'))
  assert.ok(countInv(m.p.inv, 'viande') < 40, 'la viande a été remise')
})

test('le choix : il change les drapeaux, le compteur global et la boutique des Fertiles', () => {
  const m = monde()
  const s = m.o.state(m.acc.id)
  for (const id of ['matricule', 'ce_qui_pousse', 'message_fougere', 'les_fertiles', 'la_seve']) s.done.add(id)
  m.p.level = 6
  goTo(m, 'corinne'); m.o.choose(m.p, 'corinne', 'accepter:le_choix')
  goTo(m, 'ysolde'); m.o.talk(m.p, 'ysolde')
  const d = m.o.choose(m.p, 'ysolde', 'rendre:le_choix')!
  assert.deepEqual(d.options.map((o) => o.id), ['choixA:le_choix', 'choixB:le_choix'])
  m.o.choose(m.p, 'ysolde', 'choixB:le_choix')
  assert.equal(s.flags.choix, 'fertiles')
  assert.equal(db().flags(m.acc.id).choix, 'fertiles')
  assert.equal(db().get('choix_fertiles'), '1')
  goTo(m, 'ondine'); m.sent.length = 0
  m.o.openShop(m.p, 'ondine')
  assert.ok(m.sent.some((x) => x.type === 'boutique'), 'Ondine vend aux amis des Fertiles')
  // l'autre voie ferme la boutique
  s.flags.choix = 'colonie'; m.sent.length = 0
  m.o.openShop(m.p, 'ondine')
  assert.ok(!m.sent.some((x) => x.type === 'boutique'))
  assert.ok(trx('fr', m.o.greeting(m.p, 'maelle')).includes('patrouilles'))
})

test('sac et marchands : acheter, vendre, s\'équiper', () => {
  const m = monde()
  db().addScrap(m.acc.id, 500)
  goTo(m, 'nadia')
  m.o.openShop(m.p, 'nadia')
  const offer = m.o.offers.get('s1')!
  const i = offer.items.findIndex((it) => it.b === 'armure')
  m.o.buy(m.p, i)
  const bought = m.p.inv.find((it) => it.b === 'armure')!
  assert.ok(bought)
  assert.ok(db().account(m.acc.id)!.scrap < 500)
  const hp0 = m.p.s.maxHp
  m.o.equip(m.p, bought.u)
  assert.ok(m.p.s.maxHp > hp0, 'l\'armure donne des PV')
  assert.ok(!m.p.inv.includes(bought))
  m.o.unequip(m.p, 'armure')
  assert.equal(m.p.s.maxHp, hp0)
  const scrap = db().account(m.acc.id)!.scrap
  m.o.sell(m.p, bought.u)
  assert.ok(db().account(m.acc.id)!.scrap > scrap)
  // une arme d'une autre classe est refusée ; un module de vitesse accélère
  const fusil = rollEquip('arme', 3, 1, 'medic'); m.p.inv.push(fusil)
  m.o.equip(m.p, fusil.u); assert.ok(!m.p.equip.arme)
  const mod = rollEquip('module', 3, 0, 'fantassin'); mod.s = { vit: 10 }; m.p.inv.push(mod)
  // trop haut pour lui : refusé
  const haut = rollEquip('module', 9, 0, 'fantassin'); m.p.inv.push(haut)
  m.o.equip(m.p, haut.u); assert.ok(m.p.inv.includes(haut))
  m.o.equip(m.p, mod.u); assert.ok(m.p.s.vit > 74)
  // le sac a une limite, les matériaux s'empilent
  const inv: any[] = []
  for (let k = 0; k < 30; k++) addToInv(inv, material('herbe', 5))
  assert.equal(inv.length, 3)
  for (let k = 0; k < 40; k++) addToInv(inv, rollEquip('module', 1, 0, 'fantassin'))
  assert.equal(inv.length, INV_MAX)
})

test('les habitants suivent leur journée, les gardes tirent', () => {
  const m = monde()
  assert.deepEqual(routineSpot(NPC_BY_ID.joss, 10).spot, NPC_BY_ID.joss.poste)
  assert.deepEqual(routineSpot(NPC_BY_ID.joss, 23).spot, NPC_BY_ID.joss.maison)
  assert.equal(routineSpot(NPC_BY_ID.joss, 23).act, 4)
  assert.deepEqual(routineSpot(NPC_BY_ID.joss, 20).spot, NPC_BY_ID.joss.soir)
  // le soir, Joss va à la cantine : il y arrive à pied
  m.w.state.heure = 20
  m.p.s.x = 30 * TILE; m.p.s.y = 100 * TILE
  for (let i = 0; i < 20 * 120; i++) { m.w.state.heure = 20; m.w.step(0.05) }
  const j = m.vie.npcs.get('joss')!.n
  const [sx, sy] = NPC_BY_ID.joss.soir!
  assert.ok(Math.hypot(j.x - (sx * TILE + 8), j.y - (sy * TILE + 8)) < 20, `Joss à la cantine (${j.x / TILE}, ${j.y / TILE})`)
  // un Rampant entré dans la ville : le sergent Morel tire
  const morel = m.vie.npcs.get('morel')!.n
  const es = m.w.spawnEnemy(E.RAMPANT, morel.x - 60, morel.y, { level: 1 })
  es.speedMul = 0
  for (let i = 0; i < 20 * 6 && m.w.enemies.has(es.id); i++) m.w.step(0.05)
  assert.ok(!m.w.enemies.has(es.id), 'le Rampant est abattu par la garde')
})

test('la ruée est la même fonction côté serveur et côté client', () => {
  const free = MAP.points.spawn
  const a = { x: free.x, y: free.y, dashT: 0, dashCd: 0, dvx: 0, dvy: 0 }
  const b = { ...a }
  const cmds = [{ mx: 1, my: 0, aim: 0, dash: true }, { mx: 1, my: 0, aim: 0 }, { mx: 0, my: 1, aim: 0, dash: true }, { mx: 0, my: 0, aim: 0 }]
  for (const c of cmds) { applyMove(a, c, 0.05, 74, MAP); applyMove(b, c, 0.05, 74, MAP) }
  assert.deepEqual(a, b)
  assert.ok(a.x - free.x > 74 * 0.1 + DASH.vitesse * 0.09, 'la ruée porte plus loin que la marche')
  assert.ok(a.dashCd > 0, 'la seconde ruée attend la recharge')
  assert.ok(!isSolidTile(MAP.tiles[Math.floor(a.y / TILE) * MAP.w + Math.floor(a.x / TILE)]))
})
