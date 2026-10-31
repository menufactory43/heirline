// Test de bout en bout, sur un vrai serveur lancé à part (port 2791, base jetable) : les copies d'une carte
// (seuil abaissé à 2), le service central vu par deux copies, les passages (sas de la Constance, aller et
// retour), les instances du nid par groupes de 5, le monorail (gare réparée puis voyage), la monture.
import { trx } from '../shared/i18n/index.ts'
import { test, before, after } from 'node:test'
import { RUCHES } from '../shared/front.ts'
import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { Client, type Room } from '@colyseus/sdk'
import { PASSAGE_BY_ID, STATION_BY_ID } from '../shared/monde.ts'
import { portLibre } from './port-libre.ts'
import { TILE } from '../shared/consts.ts'

const PORT = await portLibre(), BASE = `http://127.0.0.1:${PORT}`, DEBUG = 'essai-debug', CODE = 'essai'
const dir = mkdtempSync(join(tmpdir(), 'heirline-reseau-'))
const DB = join(dir, 'h.db')
let srv: ChildProcess
const rooms: Room<any>[] = []
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms))

before(async () => {
  srv = spawn(process.execPath, ['--import', 'tsx', 'server/main.ts'], {
    cwd: new URL('..', import.meta.url).pathname, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT), HEIRLINE_DB: DB, HEIRLINE_COPIE_MAX: '2', HEIRLINE_TEST: CODE, HEIRLINE_DEBUG: DEBUG, NODE_ENV: 'test' },
  })
  let log = ''
  srv.stdout!.on('data', (d) => { log += d }); srv.stderr!.on('data', (d) => { log += d })
  for (let i = 0; i < 120; i++) { try { if ((await fetch(BASE + '/api/cartes')).ok) return } catch { /* pas encore */ } await attendre(250) }
  throw new Error('serveur de test muet :\n' + log)
})
after(async () => {
  for (const r of rooms) await r.leave(true).catch(() => {})
  srv?.kill('SIGTERM')
  await attendre(300)
  rmSync(dir, { recursive: true, force: true })
})

async function compte(famille: string) {
  const r = await fetch(BASE + '/api/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ famille }) })
  return (await r.json()).token as string
}
async function entrer(token: string, salon: 'secteur' | 'nid', carte: string) {
  const room = await new Client(BASE).joinOrCreate(salon, { token, carte, cls: 'fantassin' })
  room.onMessage('*', () => {})
  rooms.push(room)
  await attendre(400)
  return room
}
const moi = (r: Room<any>) => r.state.players.get(r.sessionId)
function message<T = any>(r: Room<any>, type: string, ms = 4000): Promise<T> {
  return new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('pas de ' + type)), ms); r.onMessage(type, (m: T) => { clearTimeout(t); ok(m) }) })
}
async function quitter(r: Room<any>) { await r.leave(true).catch(() => {}); rooms.splice(rooms.indexOf(r), 1) }

test('copies : au-delà du seuil (2), une deuxième copie du continent s\'ouvre', async () => {
  const salles = []
  for (const f of ['Alpha', 'Bravo', 'Charlie']) salles.push(await entrer(await compte(f), 'secteur', 'ossara'))
  const ids = new Set(salles.map((r) => r.roomId))
  assert.equal(ids.size, 2, `copies : ${[...ids].join(', ')}`)
  const cartes = await (await fetch(BASE + '/api/cartes')).json()
  const ossara = (cartes.cartes ?? cartes).find?.((c: any) => c.id === 'ossara')
  if (ossara) assert.ok((ossara.copies?.length ?? ossara.copies) >= 2)
  // le service central : les deux copies voient les mêmes ruches et la même heure
  await attendre(1300)
  const [a, , c] = salles
  assert.notEqual(a.roomId, c.roomId)
  // chaque copie recopie les rayons du service central une fois par seconde (au centième de tuile près)
  const ra = [...a.state.ruches] as number[], rc = [...c.state.ruches] as number[]
  assert.equal(ra.length, RUCHES.length)
  assert.ok(ra.every((x, i) => Math.abs(x - rc[i]) < 0.05), `${ra.join(' ')} / ${rc.join(' ')}`)
  assert.ok(Math.abs(a.state.heure - c.state.heure) < 0.02, `${a.state.heure} / ${c.state.heure}`)
  for (const r of salles) await quitter(r)
})

test('passages : le sas de la Constance, aller (voyage de test) et retour (à pied sur le sas)', async () => {
  const token = await compte('Delta')
  let r = await entrer(token, 'secteur', 'ossara')
  const p1 = message(r, 'passage')
  r.send('voyage', { code: CODE, dest: 'constance' })
  const m = await p1
  assert.equal(m.carte, 'constance'); assert.equal(m.salon, 'secteur')
  await quitter(r)
  r = await entrer(token, 'secteur', 'constance')
  const sas = PASSAGE_BY_ID.constance_sas
  const p = moi(r)
  assert.ok(Math.hypot(p.x - ((sas.x + sas.sortie[0]) * TILE + 8), p.y - ((sas.y + sas.sortie[1]) * TILE + 8)) < 20, `arrivée ${p.x},${p.y}`)
  // retour : marcher sur le sas
  await attendre(2200)
  const p2 = message(r, 'passage')
  r.send('tp', { code: DEBUG, x: sas.x * TILE + 8, y: sas.y * TILE + 8 })
  const m2 = await p2
  assert.equal(m2.carte, 'ossara')
  await quitter(r)
  r = await entrer(token, 'secteur', 'ossara')
  const dehors = PASSAGE_BY_ID.sas_constance
  const q = moi(r)
  assert.ok(Math.hypot(q.x - ((dehors.x + dehors.sortie[0]) * TILE + 8), q.y - ((dehors.y + dehors.sortie[1]) * TILE + 8)) < 20, `retour ${q.x},${q.y}`)
  await quitter(r)
})

test('instances : le nid par groupes de 5 (la taille d\'un groupe de donjon)', async () => {
  const salles = []
  for (const f of ['N1', 'N2', 'N3', 'N4', 'N5', 'N6']) salles.push(await entrer(await compte(f), 'nid', 'nid'))
  const parSalle = new Map<string, number>()
  for (const r of salles) parSalle.set(r.roomId, (parSalle.get(r.roomId) ?? 0) + 1)
  assert.deepEqual([...parSalle.values()].sort(), [1, 5])
  for (const r of salles) await quitter(r)
})

test('monorail : une gare fermée refuse, se répare (pièces + ferraille), puis on y voyage', async () => {
  const token = await compte('Echo')
  let r = await entrer(token, 'secteur', 'ossara')
  const fou = STATION_BY_ID.st_fougere, port = STATION_BY_ID.st_port
  // depuis Port-Ancre, la Fougère est hors service
  r.send('tp', { code: DEBUG, x: port.x * TILE + 8, y: (port.y + 1) * TILE + 8 })
  await attendre(300)
  const refus = message(r, 'log')
  r.send('station', { id: port.id, vers: fou.id })
  assert.match(trx('fr', (await refus).t), /hors service/)
  await quitter(r)
  await attendre(400)
  // de quoi réparer : 3 pièces de robot dans le sac, 100 ferraille à l'abri
  const d = new DatabaseSync(DB)
  const acc = d.prepare('SELECT id FROM accounts WHERE token = ?').get(token) as { id: string }
  d.prepare('UPDATE accounts SET scrap = 100 WHERE id = ?').run(acc.id)
  d.prepare('UPDATE soldiers SET inv_json = ? WHERE account = ? AND alive = 1').run(JSON.stringify([{ u: 'p1', b: 'piece', r: 0, l: 1, s: {}, n: 3 }]), acc.id)
  d.close()
  r = await entrer(token, 'secteur', 'ossara')
  r.send('tp', { code: DEBUG, x: fou.x * TILE + 8, y: (fou.y + 1) * TILE + 8 })
  await attendre(300)
  const ok = message(r, 'log')
  r.send('station', { id: fou.id })
  assert.match(trx('fr', (await ok).t), /remise en service/)
  await attendre(700)
  // retour à Port-Ancre, puis le monorail jusqu'à la Fougère
  r.send('tp', { code: DEBUG, x: port.x * TILE + 8, y: (port.y + 1) * TILE + 8 })
  await attendre(300)
  // un vrai trajet : la rame passe par le Col ; pendant le voyage, le soldat suit le rail (champ « rame »), puis il est
  // déposé sur le quai de la Fougère
  const depart = message(r, 'rame')
  r.send('station', { id: port.id, vers: fou.id })
  const rame = await depart
  assert.deepEqual(rame.ids, ['st_port', 'st_col', 'st_fougere'])
  await attendre(6000)
  assert.equal(moi(r).rame, true, 'en route')
  const t0 = Date.now()
  while (moi(r).rame && Date.now() - t0 < 30000) await attendre(200)
  const p = moi(r)
  assert.equal(p.rame, false)
  assert.ok(Math.hypot(p.x - (fou.x * TILE + 8), p.y - ((fou.y + 2) * TILE + 8)) < 24, `arrivée ${p.x},${p.y}`)
  const d2 = new DatabaseSync(DB)
  assert.equal((d2.prepare('SELECT scrap FROM accounts WHERE id = ?').get(acc.id) as any).scrap, 40)
  d2.close()
  await quitter(r)
})

test('monture : sans selle, refus ; avec la selle, on monte et on descend', async () => {
  const token = await compte('Foxtrot')
  let r = await entrer(token, 'secteur', 'ossara')
  const refus = message(r, 'log')
  r.send('monture')
  assert.match(trx('fr', (await refus).t), /selle/)
  await quitter(r)
  await attendre(300)
  const d = new DatabaseSync(DB)
  d.prepare('UPDATE accounts SET flags_json = ? WHERE token = ?').run(JSON.stringify({ selle: '1' }), token)
  d.close()
  r = await entrer(token, 'secteur', 'ossara')
  await attendre(500)
  r.send('monture')
  await attendre(400)
  assert.equal(moi(r).monte, true)
  let robotMonte = false
  r.state.robots.forEach((x: any) => { if (x.owner === r.sessionId && x.mode === 6) robotMonte = true })
  assert.ok(robotMonte, 'le robot est en mode monture')
  r.send('monture')
  await attendre(400)
  assert.equal(moi(r).monte, false)
  await quitter(r)
})

// ---------------------------------------------------------------- reprendre là où on s'est arrêté
const carteMoi = async (token: string) => (await (await fetch(BASE + '/api/moi', { headers: { 'x-heirline-token': token } })).json()).carte
const pres = (p: { x: number; y: number }, x: number, y: number, d = 20) => Math.hypot(p.x - x, p.y - y) < d

test('reprise : déconnecté sur le continent, on revient au même endroit (et jamais dans un mur)', async () => {
  const token = await compte('Golf')
  let r = await entrer(token, 'secteur', 'ossara')
  const col = STATION_BY_ID.st_col, x = col.x * TILE + 8 + 16, y = (col.y + 2) * TILE + 8
  r.send('tp', { code: DEBUG, x, y })
  await attendre(300)
  await quitter(r)
  await attendre(400)
  assert.equal(await carteMoi(token), 'ossara')
  r = await entrer(token, 'secteur', 'ossara')
  assert.ok(pres(moi(r), x, y), `reprise ${moi(r).x},${moi(r).y} au lieu de ${x},${y}`)
  // le robot suiveur revient avec le soldat
  let robot: any = null
  r.state.robots.forEach((q: any) => { if (q.owner === r.sessionId) robot = q })
  assert.ok(robot && pres(robot, x, y, 40), 'le robot suit')
  await quitter(r)
  await attendre(400)
  // une position abîmée (dans un mur) : la case libre la plus proche
  const d = new DatabaseSync(DB)
  const acc = d.prepare('SELECT id FROM accounts WHERE token = ?').get(token) as { id: string }
  const { carteMap } = await import('../shared/cartes/index.ts')
  const { isSolidTile } = await import('../shared/map.ts')
  const m = carteMap('ossara')
  let mur = -1
  for (let i = (col.y - 6) * m.w + col.x - 30; i < m.tiles.length; i++) if (isSolidTile(m.tiles[i])) { mur = i; break }
  const mx = (mur % m.w) * TILE + 8, my = Math.floor(mur / m.w) * TILE + 8
  d.prepare('UPDATE soldiers SET pos_json = ? WHERE account = ? AND alive = 1').run(JSON.stringify({ carte: 'ossara', x: mx, y: my }), acc.id)
  d.close()
  r = await entrer(token, 'secteur', 'ossara')
  const q = moi(r)
  assert.ok(!isSolidTile(m.tiles[Math.floor(q.y / TILE) * m.w + Math.floor(q.x / TILE)]), `pas dans le mur (${q.x},${q.y})`)
  assert.ok(pres(q, mx, my, 12 * TILE * 1.5), 'tout près du mur, pas au départ')
  await quitter(r)
})

test('reprise : l\'instance du nid refermée, on ressort par la Gueule ; le serveur renvoie sur la bonne carte', async () => {
  const token = await compte('Hotel')
  let r = await entrer(token, 'secteur', 'ossara')
  const g = PASSAGE_BY_ID.gueule_nid
  await attendre(2200)
  const vers = message(r, 'passage')
  r.send('tp', { code: DEBUG, x: g.x * TILE + 8, y: g.y * TILE + 8 })
  assert.equal((await vers).carte, 'nid')
  await quitter(r)
  r = await entrer(token, 'nid', 'nid')
  await quitter(r)
  await attendre(500)
  assert.equal(await carteMoi(token), 'ossara')
  // un client qui demande le nid quand même : le serveur le renvoie sur le continent
  const r2 = await new Client(BASE).joinOrCreate('nid', { token, carte: 'nid' })
  rooms.push(r2)
  const renvoi = message(r2, 'passage')
  r2.onMessage('*', () => {})
  assert.equal((await renvoi).carte, 'ossara')
  await quitter(r2)
  r = await entrer(token, 'secteur', 'ossara')
  assert.ok(pres(moi(r), (g.x + g.sortie[0]) * TILE + 8, (g.y + g.sortie[1]) * TILE + 8), `sortie de la Gueule ${moi(r).x},${moi(r).y}`)
  await quitter(r)
})

test('reprise : parti en plein trajet de monorail, on reprend à la gare d\'arrivée', async () => {
  const token = await compte('India')
  let r = await entrer(token, 'secteur', 'ossara')
  const port = STATION_BY_ID.st_port, col = STATION_BY_ID.st_col
  r.send('tp', { code: DEBUG, x: port.x * TILE + 8, y: (port.y + 1) * TILE + 8 })
  await attendre(300)
  const depart = message(r, 'rame')
  r.send('station', { id: port.id, vers: col.id })
  await depart
  await attendre(4000)
  assert.equal(moi(r).rame, true, 'en route')
  await quitter(r)
  await attendre(400)
  r = await entrer(token, 'secteur', 'ossara')
  assert.ok(pres(moi(r), col.x * TILE + 8, (col.y + 2) * TILE + 8, 24), `quai du Col ${moi(r).x},${moi(r).y}`)
  assert.equal(moi(r).rame, false)
  await quitter(r)
})

test('reprise : le soldat de test n\'est jamais enregistré, la vraie fiche reprend d\'où elle était partie', async () => {
  const token = await compte('Juliet')
  let r = await entrer(token, 'secteur', 'ossara')
  const col = STATION_BY_ID.st_col, x = col.x * TILE + 8 - 16, y = (col.y + 2) * TILE + 8
  r.send('tp', { code: DEBUG, x, y })
  await attendre(300)
  const vers = message(r, 'passage')
  r.send('voyage', { code: CODE, dest: 'couveuse' })
  assert.equal((await vers).carte, 'nid')
  await quitter(r)
  r = await entrer(token, 'nid', 'nid')
  await attendre(600)
  await quitter(r)
  await attendre(500)
  assert.equal(await carteMoi(token), 'ossara')
  r = await entrer(token, 'secteur', 'ossara')
  assert.ok(pres(moi(r), x, y), `avant le test ${moi(r).x},${moi(r).y} au lieu de ${x},${y}`)
  await quitter(r)
})
