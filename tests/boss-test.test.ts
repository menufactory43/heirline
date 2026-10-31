// Le bouton « aller voir un boss », de bout en bout (vrai serveur, port 2793, base jetable) : le soldat part au nid en
// soldat de test au niveau du boss, y meurt (mort de test : retour à Port-Ancre, sans perte), et sa vraie fiche
// (niveau, XP, sac, équipement, robot) est intacte ; il n'y a ni mort définitive ni avant-poste.
import { trx } from '../shared/i18n/index.ts'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { Client, type Room } from '@colyseus/sdk'
import { BOSS_TEST, ENTREES_TEST } from '../shared/boss-test.ts'
import { REGION_BY_ID } from '../shared/regions/index.ts'
import { portLibre } from './port-libre.ts'
import { ARENE } from '../shared/motifs.ts'

const PORT = await portLibre(), BASE = `http://127.0.0.1:${PORT}`, CODE = 'essai-boss'
const dir = mkdtempSync(join(tmpdir(), 'heirline-boss-'))
const DB = join(dir, 'h.db')
let srv: ChildProcess
const rooms: Room<any>[] = []
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function jusqua(f: () => boolean, ms = 15000) { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('délai dépassé'); await attendre(100) } }

before(async () => {
  srv = spawn(process.execPath, ['--import', 'tsx', 'server/main.ts'], {
    cwd: new URL('..', import.meta.url).pathname, stdio: ['ignore', 'pipe', 'pipe'],
    // la Couveuse et ses sacs très forts, des balles qui font très mal : le soldat de test, immobile, tombe malgré les
    // soins des soldats IA (leurs talents et la Perfusion compris)
    env: { ...process.env, PORT: String(PORT), HEIRLINE_DB: DB, HEIRLINE_TEST: CODE, NODE_ENV: 'test', HEIRLINE_BOSS_PV: '20', HEIRLINE_BOSS_DGT: '10' },
  })
  let log = ''
  srv.stdout!.on('data', (d) => { log += d; if (process.env.BAVARD) process.stdout.write(d) }); srv.stderr!.on('data', (d) => { log += d })
  for (let i = 0; i < 120; i++) { try { if ((await fetch(BASE + '/api/cartes')).ok) return } catch { /* pas encore */ } await attendre(250) }
  throw new Error('serveur de test muet :\n' + log)
})
after(async () => {
  for (const r of rooms) await r.leave(true).catch(() => {})
  srv?.kill('SIGTERM')
  await attendre(300)
  rmSync(dir, { recursive: true, force: true })
})

test('un aller-retour au boss en soldat de test laisse la vraie fiche intacte', { timeout: 240000 }, async () => {
  const token = (await (await fetch(BASE + '/api/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ famille: 'Essai' }) })).json()).token as string
  const client = new Client(BASE)
  let room = await client.joinOrCreate('secteur', { token, carte: 'ossara', cls: 'medic' })
  const logs: string[] = []
  const suivre = (r: Room<any>) => { r.onMessage('*', () => {}); r.onMessage('log', (m: any) => logs.push(trx('fr', m.t))) }
  suivre(room); rooms.push(room)
  await attendre(600)
  const base = new DatabaseSync(DB)
  const fiche = () => base.prepare('SELECT id, level, xp, sac, inv_json, equip_json, talents_json, alive FROM soldiers WHERE alive = 1').all()
  const robot = () => base.prepare('SELECT level, state, pertes FROM robots').all()
  const avant = { fiche: fiche(), robot: robot() }
  assert.equal(avant.fiche.length, 1)

  // le bouton : vers la Couveuse (passage vers une instance du nid)
  const passage = new Promise<any>((res) => room.onMessage('passage', res))
  room.send('voyage', { code: CODE, dest: 'couveuse' })
  const p = await passage
  assert.equal(p.carte, 'nid')
  await room.leave(true)
  room = await client.joinOrCreate(p.salon, { token, carte: 'nid' })
  suivre(room); rooms.push(room)
  const me = () => room.state?.players?.get(room.sessionId)
  await jusqua(() => !!me())
  assert.equal(me().level, BOSS_TEST.couveuse.niveau, 'soldat de test au niveau du boss')
  assert.ok(me().x > ARENE.x0 && me().y > ARENE.y0, 'dans l\'arène')

  // il reste planté là : la mort de test le renvoie à Port-Ancre
  const retour = new Promise<any>((res) => room.onMessage('passage', res))
  const r = await retour
  assert.equal(r.carte, 'ossara')
  assert.ok(logs.some((l) => /Mort de test/.test(l)), logs.join(' | '))
  await room.leave(true)
  room = await client.joinOrCreate('secteur', { token, carte: 'ossara' })
  suivre(room); rooms.push(room)
  await jusqua(() => !!room.state?.players?.get(room.sessionId))
  await attendre(600)

  // la vraie fiche : rien n'a bougé, pas de mort, pas d'avant-poste, le robot est toujours avec lui
  assert.deepEqual(fiche(), avant.fiche)
  assert.deepEqual(robot(), avant.robot)
  assert.equal(base.prepare('SELECT COUNT(*) n FROM deaths').get()!.n, 0)
  assert.equal(room.state.players.get(room.sessionId).level, (avant.fiche[0] as any).level)
  base.close()
})

test('visites de test : une région au niveau de son cœur, l\'entrée d\'un donjon ; la vraie fiche reste intacte', { timeout: 120000 }, async () => {
  const token = (await (await fetch(BASE + '/api/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ famille: 'Visite' }) })).json()).token as string
  const client = new Client(BASE)
  let room = await client.joinOrCreate('secteur', { token, carte: 'ossara', cls: 'fantassin' })
  room.onMessage('*', () => {}); rooms.push(room)
  const me = () => room.state?.players?.get(room.sessionId)
  await jusqua(() => !!me())
  const niveau0 = me().level
  // le marais : sur le continent, téléportation au cœur, soldat de test au niveau haut de la région
  room.send('voyage', { code: CODE, dest: 'region:marais' })
  await jusqua(() => me().level === REGION_BY_ID.marais.niveau[1])
  const [cx, cy] = REGION_BY_ID.marais.centre
  assert.ok(Math.hypot(me().x / 16 - cx, me().y / 16 - cy) < 40, 'au cœur du marais')
  // l'entrée de l'Antre : un passage vers l'instance, au départ du parcours (pas dans l'arène)
  const passage = new Promise<any>((res) => room.onMessage('passage', res))
  room.send('voyage', { code: CODE, dest: 'entree:antre' })
  const p = await passage
  assert.equal(p.carte, 'antre')
  await room.leave(true)
  room = await client.joinOrCreate(p.salon, { token, carte: 'antre' })
  room.onMessage('*', () => {}); rooms.push(room)
  await jusqua(() => !!me())
  assert.equal(me().level, ENTREES_TEST.antre.niveau)
  assert.ok(me().y > ARENE.y1 || me().x < ARENE.x0 || me().x > ARENE.x1, 'au départ des lacets, hors de l\'arène')
  // retour : la vraie fiche revient
  const retour = new Promise<any>((res) => room.onMessage('passage', res))
  room.send('voyage', { code: CODE, dest: 'port' })
  const r = await retour
  await room.leave(true)
  room = await client.joinOrCreate(r.salon ?? 'secteur', { token, carte: 'ossara' })
  room.onMessage('*', () => {}); rooms.push(room)
  await jusqua(() => !!me())
  assert.equal(me().level, niveau0)
})
