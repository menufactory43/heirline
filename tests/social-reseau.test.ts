// Le social de bout en bout, sur un vrai serveur lancé à part (port libre, base jetable) avec de vrais clients
// Colyseus : groupe (invitation acceptée), entrée du groupe dans la même instance de donjon, refus d'un intrus qui
// annonce le groupe d'un autre, groupe de cinq au complet, échange verrouillé puis confirmé, duel.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { Client, type Room } from '@colyseus/sdk'
import { portLibre } from './port-libre.ts'

const PORT = await portLibre(), BASE = `http://127.0.0.1:${PORT}`
const dir = mkdtempSync(join(tmpdir(), 'heirline-social-'))
const DB = join(dir, 'h.db')
let srv: ChildProcess
const rooms: Room<any>[] = []
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms))

before(async () => {
  srv = spawn(process.execPath, ['--import', 'tsx', 'server/main.ts'], {
    cwd: new URL('..', import.meta.url).pathname, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT), HEIRLINE_DB: DB, NODE_ENV: 'test' },
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

interface Joueur { token: string; account: string; room: Room<any>; boite: { type: string; m: any }[] }
async function joueur(famille: string): Promise<Joueur> {
  const { token } = await (await fetch(BASE + '/api/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ famille }) })).json()
  const j = { token, account: '', room: null as any, boite: [] as { type: string; m: any }[] }
  await entrer(j, 'secteur', 'ossara')
  const base = new DatabaseSync(DB)
  j.account = (base.prepare('SELECT id FROM accounts WHERE token = ?').get(token) as { id: string }).id
  base.close()
  return j
}
async function entrer(j: Joueur, salon: 'secteur' | 'nid', carte: string, extra: any = {}) {
  if (j.room) { await j.room.leave(true).catch(() => {}); rooms.splice(rooms.indexOf(j.room), 1) }
  j.room = await new Client(BASE).joinOrCreate(salon, { token: j.token, carte, cls: 'fantassin', ...extra })
  j.room.onMessage('*', (type: any, m: any) => j.boite.push({ type: String(type), m }))
  rooms.push(j.room)
  await attendre(500)
}
/** le dernier message d'un type reçu (attend jusqu'à 4 s) */
async function recu(j: Joueur, type: string, depuis = 0, ms = 4000) {
  for (let t = 0; t < ms; t += 100) { const r = j.boite.slice(depuis).reverse().find((x) => x.type === type); if (r) return r.m; await attendre(100) }
  throw new Error(`pas de « ${type} »`)
}
const social = (j: Joueur, m: any) => j.room.send('social', m)
async function grouper(chef: Joueur, autres: Joueur[]) {
  for (const o of autres) {
    const n = o.boite.length
    social(chef, { a: 'inviter', type: 'groupe', sid: o.room.sessionId })
    assert.equal((await recu(o, 'invitation', n)).type, 'groupe')
    social(o, { a: 'repondre', type: 'groupe', oui: true })
  }
  await attendre(400)
  return (await recu(chef, 'groupe')).id as string
}

test('groupe, instance du groupe, intrus refusé, cinq au complet', { timeout: 60000 }, async () => {
  const [a, b, c, d, e, intrus] = await Promise.all(['Ra', 'Rb', 'Rc', 'Rd', 'Re', 'Rx'].map(joueur))
  const g = await grouper(a, [b, c, d, e])
  const gb = await recu(b, 'groupe')
  assert.equal(gb.id, g); assert.equal(gb.membres.length, 5)
  // tout le groupe (cinq) entre dans la même instance de l'Antre
  for (const j of [a, b, c, d, e]) await entrer(j, 'nid', 'antre', { groupe: g })
  assert.equal(new Set([a, b, c, d, e].map((j) => j.room.roomId)).size, 1, 'une seule instance pour le groupe : ' + [a, b, c, d, e].map((j) => j.room.roomId + '/' + j.room.state.players.size).join(' '))
  assert.equal(a.room.state.players.size >= 5, true)
  // un intrus qui annonce l'identifiant du groupe est refusé
  await assert.rejects(() => entrer(intrus, 'nid', 'antre', { groupe: g }))
  // un membre qui prétend ne pas avoir de groupe ne se glisse pas dans une autre instance non plus
  await assert.rejects(() => new Client(BASE).joinOrCreate('nid', { token: e.token, carte: 'gueule', cls: 'fantassin' }))
  // seul, l'intrus a sa propre instance
  intrus.room = null as any
  await entrer(intrus, 'nid', 'antre')
  assert.notEqual(intrus.room.roomId, a.room.roomId)
})

test('échange verrouillé puis confirmé, puis duel', { timeout: 60000 }, async () => {
  const a = await joueur('Ta'), b = await joueur('Tb')
  const base = new DatabaseSync(DB)
  base.prepare('UPDATE accounts SET scrap = 150 WHERE id = ?').run(a.account)
  base.close()
  social(a, { a: 'inviter', type: 'echange', sid: b.room.sessionId })
  assert.equal((await recu(b, 'invitation')).type, 'echange')
  let n = a.boite.length
  social(b, { a: 'repondre', type: 'echange', oui: true })
  await recu(a, 'echange', n)
  social(a, { a: 'offre', u: [], f: 120 })
  await attendre(200)
  // confirmer avant les deux verrous : rien
  social(a, { a: 'confirmer' }); social(b, { a: 'confirmer' })
  await attendre(300)
  let lire = new DatabaseSync(DB)
  assert.equal((lire.prepare('SELECT scrap FROM accounts WHERE id = ?').get(b.account) as any).scrap, 0)
  lire.close()
  social(a, { a: 'verrou' }); social(b, { a: 'verrou' })
  await attendre(300)
  const v = await recu(a, 'echange')
  assert.ok(v.moi.verrou && v.lui.verrou && v.moi.f === 120)
  social(a, { a: 'confirmer' }); social(b, { a: 'confirmer' })
  await attendre(500)
  lire = new DatabaseSync(DB)
  assert.equal((lire.prepare('SELECT scrap FROM accounts WHERE id = ?').get(a.account) as any).scrap, 30)
  assert.equal((lire.prepare('SELECT scrap FROM accounts WHERE id = ?').get(b.account) as any).scrap, 120)
  lire.close()
  assert.equal(a.boite.filter((x) => x.type === 'echange').at(-1)!.m, null, 'la fenêtre se ferme')
  // le duel : invitation, acceptation, les deux sont prévenus ; un abandon y met fin, sans mort
  n = b.boite.length
  social(a, { a: 'inviter', type: 'duel', sid: b.room.sessionId })
  assert.equal((await recu(b, 'invitation', n)).type, 'duel')
  n = a.boite.length
  social(b, { a: 'repondre', type: 'duel', oui: true })
  const du = await recu(a, 'duel', n)
  assert.equal(du.sid, b.room.sessionId)
  n = b.boite.length
  social(a, { a: 'abandon' })
  await attendre(400)
  assert.equal(b.boite.slice(n).filter((x) => x.type === 'duel').at(-1)?.m, null)
  const moiB = b.room.state.players.get(b.room.sessionId)
  assert.equal(moiB.etat, 0)
})
