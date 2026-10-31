// Tests du monde v2 : le graphe des cartes et ses passages, le service central partagé par deux copies,
// la migration de la base (les lignées survivent), la monture (vitesse partagée avec la prédiction, descente).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { T, isSolidTile, type GameMap } from '../shared/map.ts'
import { carteMap } from '../shared/cartes/index.ts'
import { CARTES, PASSAGES, PASSAGE_BY_ID, STATIONS, CARTE_IDS, WORLD_VERSION } from '../shared/monde.ts'
import { TILE, NEST } from '../shared/consts.ts'
import { RUCHES, RAYONS_DEPART, ecartBordure } from '../shared/front.ts'
import { MONTURE, vitesseSoldat, applyMove } from '../shared/rules.ts'
import { QUEST_BY_ID } from '../shared/quests.ts'
import { findPath } from '../shared/path.ts'
import { Central, type OutpostRec } from '../server/central.ts'
import { World } from '../server/world/World.ts'
import { Vie } from '../server/world/Vie.ts'
import { Ossara } from '../server/ossara.ts'
import { Db, setDb, db } from '../server/db.ts'
import { migrer, versionDuMonde } from '../server/migration.ts'

const tuile = (m: GameMap, x: number, y: number) => m.tiles[y * m.w + x]
const libre = (m: GameMap, x: number, y: number) => !isSolidTile(tuile(m, x, y))

// ---------------------------------------------------------------- le graphe
test('graphe : chaque passage a son retour, un sas sur sa carte, une sortie libre', () => {
  for (const p of PASSAGES) {
    const m = carteMap(p.carte)
    assert.equal(tuile(m, p.x, p.y), T.SAS, `${p.id} : un sas en ${p.x},${p.y}`)
    assert.ok(libre(m, p.x + p.sortie[0], p.y + p.sortie[1]), `${p.id} : sortie libre`)
    const a = PASSAGE_BY_ID[p.arrivee]
    assert.ok(a, `${p.id} → ${p.arrivee}`)
    assert.equal(a.carte, p.vers)
    assert.equal(a.arrivee, p.id, 'le passage d\'arrivée ramène ici')
    assert.ok(m.passages.some((q) => q.id === p.id), 'la carte connaît ses passages')
  }
  // toutes les cartes du graphe sont reliées au continent
  for (const c of CARTE_IDS) if (c !== 'ossara') assert.ok(PASSAGES.some((p) => p.carte === 'ossara' && p.vers === c), c)
})

test('graphe : l\'épave de la Constance, sa passerelle et sa salle cachée (scellée : on y entre par la porte, après l\'acte 2)', () => {
  const m = carteMap('constance')
  assert.equal(m.carte, 'constance'); assert.equal(m.zoneCarte, 'abri')
  const sas = PASSAGE_BY_ID.constance_sas
  const dx = sas.x + sas.sortie[0], dy = sas.y + sas.sortie[1]
  // la passerelle se traverse depuis le sas
  assert.ok(findPath(m, dx, dy, 78, 21, 200000), 'la passerelle est atteignable')
  // derrière, une porte soudée ; la salle cachée existe mais on n'y entre pas
  assert.equal(tuile(m, 87, 21), T.SCELLE)
  assert.ok(isSolidTile(T.SCELLE))
  assert.ok(libre(m, 90, 21), 'la salle cachée a un sol')
  assert.ok(!findPath(m, dx, dy, 90, 21, 200000), 'on n\'y marche pas : la porte scellée y fait entrer, après l\'acte 2')
  // vide : ni camp, ni ressource, ni habitant
  const dedans = (x: number, y: number) => x >= 88 * TILE && x <= 94 * TILE && y >= 17 * TILE && y <= 26 * TILE
  assert.ok(!m.monde!.camps.some((c) => dedans(c.x, c.y)))
  assert.ok(!m.monde!.noeuds.some((n) => dedans(n.x, n.y)))
})

test('graphe : le nid, une instance de groupe ; la Gueule sur le continent', () => {
  const m = carteMap('nid')
  assert.equal(CARTES.nid.salon, 'nid'); assert.equal(CARTES.nid.seuil, 5); assert.ok(CARTES.nid.instance) // un groupe de donjon (cinq) entre au complet
  assert.equal(m.zoneCarte, 'nid')
  const s = PASSAGE_BY_ID.nid_sortie
  assert.ok(findPath(m, s.x + s.sortie[0], s.y + s.sortie[1], Math.floor(m.points.nid.x / TILE), Math.floor(m.points.nid.y / TILE) + 3, 200000), 'de la sortie au cœur du nid')
  assert.ok(m.points.nid.x / TILE >= NEST.x0 && m.points.nid.x / TILE <= NEST.x1)
  // la Gueule est dans la Grande Ruche : on y va au-delà du front
  const g = PASSAGE_BY_ID.gueule_nid
  assert.ok(ecartBordure(RUCHES[0], RAYONS_DEPART[0], g.x, g.y) < 0)
})

test('copies : un seuil par carte (réglable), le nid par groupes de 4', () => {
  assert.equal(CARTES.ossara.seuil, Number(process.env.HEIRLINE_COPIE_MAX ?? 200))
  assert.equal(CARTES.constance.salon, 'secteur')
  const src = readFileSync(new URL('../server/main.ts', import.meta.url), 'utf8')
  assert.match(src, /defineRoom\(Secteur\)\.filterBy\(\['carte'\]\)/, 'une salle par carte, et des copies')
  const sal = readFileSync(new URL('../server/rooms/Secteur.ts', import.meta.url), 'utf8')
  assert.match(sal, /this\.maxClients = /, 'une copie pleine en ouvre une autre')
})

// ---------------------------------------------------------------- le monorail
test('monorail : les gares sont sur le continent, au sec, reliées à Port-Ancre ; Port-Ancre et le Col ouverts au départ', () => {
  const m = carteMap('ossara')
  const sp = m.points.spawn
  for (const g of STATIONS) {
    assert.ok(libre(m, g.x, g.y + 2), `${g.id} : on peut s'y tenir`)
    assert.ok(findPath(m, Math.floor(sp.x / TILE), Math.floor(sp.y / TILE), g.x, g.y + 2, 400000), `${g.id} reliée`)
  }
  assert.deepEqual(STATIONS.filter((g) => g.ouverte).map((g) => g.id), ['st_port', 'st_col', 'st_anse', 'st_relache'])
  assert.equal(m.stations.length, STATIONS.length)
})

// ---------------------------------------------------------------- le service central
function copie(c: Central) {
  const w = new World({ mode: 'secteur', map: carteMap('ossara'), central: c }, { fx() {}, log() {} })
  return w
}
test('service central : deux copies voient les mêmes ruches, la même heure, les mêmes avant-postes', () => {
  const morts: OutpostRec[] = []
  const c = new Central({ load: () => ({ outposts: [] }), save() {}, outpostDestroyed: (o) => { morts.push(o) } })
  const a = copie(c), b = copie(c)
  for (let i = 0; i < 40; i++) { c.step(1); a.step(0.05); b.step(0.05) }
  assert.deepEqual([...a.state.ruches], [...b.state.ruches])
  assert.equal(a.state.heure, b.state.heure)
  // une mise à mort près de la bordure, dans la copie A, fait reculer la ruche pour la copie B
  const r0 = c.rayons[0]
  const h = RUCHES[0], ang = 2
  const rb = r0 * (1 + 0.18 * Math.sin(3 * ang + h.phi) + 0.1 * Math.sin(7 * ang + h.psi))
  c.killNear((h.x + Math.cos(ang) * rb) * TILE, (h.y + Math.sin(ang) * rb) * TILE)
  assert.ok(b.ruches[0] < r0, 'la copie B voit la ruche reculer')
  for (let i = 0; i < 21; i++) b.step(0.05) // l'état synchronisé suit chaque seconde
  assert.ok(Math.abs(b.state.ruches[0] - c.rayons[0]) < 1e-4)
  // un avant-poste : présent dans les deux copies, PV partagés
  c.addOutpost({ id: 'aX', account: 'X', family: 'Meff', given: 'Ana', level: 3, carte: 'ossara', x: 300 * TILE, y: 80 * TILE, hp: 100, maxHp: 100, until: Date.now() + 60_000 })
  a.step(0.05); b.step(0.05)
  assert.equal(a.state.outposts.get('aX')?.hp, 100); assert.equal(b.state.outposts.get('aX')?.hp, 100)
  a.damageRobot(a.robots.get('aX')!, 30)
  b.step(0.05)
  assert.equal(b.state.outposts.get('aX')?.hp, 70, 'le coup reçu dans A se voit dans B')
  b.damageRobot(b.robots.get('aX')!, 50)
  a.step(0.05)
  assert.equal(a.state.outposts.get('aX')?.hp, 20)
  // achevé dans les deux copies au même moment : il ne tombe qu'une fois
  a.damageRobot(a.robots.get('aX')!, 40)
  if (b.robots.get('aX')) b.damageRobot(b.robots.get('aX')!, 40)
  a.step(0.05); b.step(0.05)
  assert.equal(morts.length, 1)
  assert.ok(!a.state.outposts.has('aX') && !b.state.outposts.has('aX'))
})

// ---------------------------------------------------------------- la migration
test('migration v1 → v2 : la lignée « Meff » survit, l\'avant-poste rentre à l\'atelier, l\'ancien front s\'efface', () => {
  const d = new Db(':memory:')
  const acc = d.createGuest('Meff')
  const g1 = d.createSoldier(acc.id, 'fantassin', 12, 1, 'Ana')
  d.killSoldier(g1, { killer: 'un Cuirassé', x: 4000, y: 900, family: 'Meff' })
  const g2 = d.createSoldier(acc.id, 'medic', 6, 2, 'Bram')
  d.killSoldier(g2, { killer: 'la Couveuse', x: 7200, y: 1600, family: 'Meff' })
  d.createSoldier(acc.id, 'ingenieur', 4, 3, 'Cleo')
  d.setRobot(acc.id, { state: 'avant-poste', level: 4, ox: 7100, oy: 1580, ohp: 200, ountil: Date.now() + 1e6 })
  d.set('front', JSON.stringify(new Array(10).fill(240)))
  d.db.prepare("DELETE FROM kv WHERE key = 'monde_version'").run()
  assert.equal(versionDuMonde(d), 1)
  const avant = d.lineage(acc.id).map((s) => [s.given, s.generation, s.level, s.alive])
  const r = migrer(d)!
  assert.equal(r.de, 1); assert.equal(r.vers, WORLD_VERSION)
  assert.equal(r.avantPostesRentres, 1); assert.ok(r.frontEfface)
  assert.deepEqual(d.lineage(acc.id).map((s) => [s.given, s.generation, s.level, s.alive]), avant, 'la lignée est intacte')
  assert.equal(d.account(acc.id)!.family, 'Meff')
  assert.equal(d.deaths().length, 2, 'le tableau des morts aussi')
  const rob = d.robot(acc.id)
  assert.equal(rob.state, 'atelier'); assert.equal(rob.level, 4, 'pas de perte de niveau')
  assert.equal(d.get('front'), undefined)
  assert.equal(Number(d.get('monde_version')), WORLD_VERSION)
  assert.ok(JSON.parse(d.get('migration_2')!).avantPostesRentres === 1)
  assert.equal(migrer(d), null, 'une seconde fois : rien à faire')
  // une base neuve est directement en v2
  const neuve = new Db(':memory:')
  assert.equal(versionDuMonde(neuve), WORLD_VERSION)
  assert.equal(migrer(neuve), null)
})

// ---------------------------------------------------------------- la monture
function avecRobot() {
  setDb(new Db(':memory:'))
  const w = new World({ mode: 'secteur', map: carteMap('ossara') }, { fx() {}, log() {} })
  const acc = db().createGuest('Essai')
  const p = w.addPlayer({ sid: 's1', account: acc.id, soldierId: 0, given: 'Ana', family: 'Essai', generation: 1, cls: 'fantassin', level: 4, xp: 0 })
  w.giveRobot(p, 2)
  w.enemies.clear(); w.state.enemies.clear()
  return { w, p, acc }
}
const marcher = (w: World, p: any, s: number, fire = false) => { const x0 = p.s.x; for (let i = 0; i < s * 20; i++) { p.pending.push({ mx: 1, my: 0, aim: 0, fire, dash: false }); w.stepPlayer(p, 0.05) } return p.s.x - x0 }

test('monture : ×1,6 avec la même fonction que la prédiction du client, descente au coup et au tir', () => {
  const { w, p } = avecRobot()
  const sp = w.map.points.spawn
  p.s.x = sp.x; p.s.y = sp.y
  const aPied = marcher(w, p, 1)
  p.s.x = sp.x; p.s.y = sp.y
  assert.ok(w.mount(p, true))
  assert.equal(p.s.monte, true); assert.equal(p.robot!.r.mode, 6)
  assert.equal(vitesseSoldat(p.s), p.s.vit * MONTURE.vitesse)
  const monte = marcher(w, p, 1)
  assert.ok(Math.abs(monte / aPied - MONTURE.vitesse) < 0.05, `rapport ${monte / aPied}`)
  // la prédiction du client : applyMove avec vitesseSoldat, le même résultat pas à pas
  const etat = { x: sp.x, y: sp.y, dashT: 0, dashCd: 0, dvx: 0, dvy: 0 }
  const serveur = { ...etat }
  for (let i = 0; i < 20; i++) { applyMove(etat, { mx: 1, my: 0.3, aim: 0 }, 0.05, vitesseSoldat(p.s), w.map); applyMove(serveur, { mx: 1, my: 0.3, aim: 0 }, 0.05, vitesseSoldat({ vit: p.s.vit, fx: p.s.fx, monte: true }), w.map) }
  assert.deepEqual(etat, serveur)
  const net = readFileSync(new URL('../client/src/net.ts', import.meta.url), 'utf8')
  assert.match(net, /applyMove\(state, c, ctx\.dt, vitesseSoldat\(s\)/, 'le client prédit avec vitesseSoldat')
  // un coup : on descend
  p.invulT = 0
  w.damagePlayer(p, 5, 'un test')
  assert.equal(p.s.monte, false); assert.equal(p.robot!.r.mode, 0)
  // un tir : on descend
  assert.ok(w.mount(p, true))
  marcher(w, p, 0.2, true)
  assert.equal(p.s.monte, false)
  // une compétence : on descend
  assert.ok(w.mount(p, true))
  w.skill(p, 0, p.s.x + 50, p.s.y)
  assert.equal(p.s.monte, false)
})

test('monture : pas de robot, pas de monture ; la quête « La selle » pose le drapeau', () => {
  const { w, p, acc } = avecRobot()
  p.robot!.r.mode = 3
  assert.equal(w.mount(p, true), false, 'robot hors service')
  const vie = new Vie(w); w.life = vie
  const o = new Ossara(w, vie, { send() {}, log() {} })
  const q = QUEST_BY_ID.la_selle
  assert.equal(q.donneur, 'joss'); assert.equal(q.niveau, MONTURE.niveauQuete)
  o.reward(p, q.recompense, q)
  assert.equal(o.state(acc.id).flags.selle, '1')
  assert.equal(db().flags(acc.id).selle, '1')
})
