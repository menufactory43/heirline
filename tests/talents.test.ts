// Les talents : les règles (shared/talents.ts), puis le serveur (port 2794, base jetable) qui refuse ce qui n'est pas
// permis et garde ce qui l'est dans la fiche du soldat.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { Client, type Room } from '@colyseus/sdk'
import { trx } from '../shared/i18n/index.ts'
import { CLASS_IDS, CLASSES } from '../shared/rules.ts'
import { portLibre } from './port-libre.ts'
import {
  nettoyer, peutPrendre, peutSpecialiser, peutMaitriser, pointsLibres, pointsTotal, modsDe, talentsAuto, heritage,
  competencesDe, paramsCompetence, specsDe, maitrisesDe, talentsDe, TALENTS, SPECS, MAITRISES, MOD_MAX, RANG_MAX, coutRaz,
} from '../shared/talents.ts'

test('chaque classe a deux spécialités, chacune deux maîtrises et un arbre de six talents', () => {
  for (const c of CLASS_IDS) {
    assert.equal(specsDe(c).length, 2, c)
    assert.equal(talentsDe(c).length, 6, c)
    for (const s of specsDe(c)) { assert.equal(maitrisesDe(s.id).length, 2, s.id); assert.equal(talentsDe(s.id).length, 6, s.id) }
  }
  assert.equal(SPECS.length, 12); assert.equal(MAITRISES.length, 24); assert.equal(TALENTS.length, 18 * 6)
})

test('les points : un par niveau après le premier, et le palier se mérite', () => {
  const t = { r: {} as Record<string, number> }
  assert.equal(pointsLibres(1, t), 0)
  assert.equal(peutPrendre('fantassin', 1, t, 'fantassin.cuir'), 'ui.talents.plus_de_points')
  assert.equal(peutPrendre('fantassin', 10, t, 'fantassin.veteran'), 'ui.talents.palier_ferme')
  assert.equal(peutPrendre('fantassin', 10, t, 'medic.serment'), 'ui.talents.autre_arbre')
  assert.equal(peutPrendre('fantassin', 10, t, 'nimporte.quoi'), 'ui.talents.inconnu')
  t.r['fantassin.cuir'] = RANG_MAX
  assert.equal(peutPrendre('fantassin', 10, t, 'fantassin.cuir'), 'ui.talents.au_max')
  assert.equal(peutPrendre('fantassin', 10, t, 'fantassin.tenir'), null, 'cinq points dans l\'arbre ouvrent le palier 2')
  assert.equal(coutRaz(20), 300)
})

test('nettoyer ne garde que ce qui est permis, même d\'une fiche trafiquée', () => {
  const t = nettoyer('fantassin', 5, { r: { 'fantassin.cuir': 99, 'fantassin.veteran': 3, 'medic.serment': 2 }, spec: 'rempart', maitrise: 'phalange', bonus: 50 })
  assert.equal(t.spec, undefined, 'pas de spécialité au niveau 5')
  assert.equal(t.maitrise, undefined)
  assert.equal(t.bonus, 3, 'le bonus d\'héritage plafonne à 3')
  assert.ok(pointsLibres(5, t) >= 0)
  assert.equal(t.r['medic.serment'], undefined)
  assert.equal(t.r['fantassin.cuir'], RANG_MAX)
  assert.equal(nettoyer('medic', 40, { spec: 'rempart' }).spec, undefined, 'une spécialité d\'une autre classe')
  assert.deepEqual(nettoyer('fantassin', 3, 'n\'importe quoi'), { r: {} })
})

test('spécialité au 15, maîtrise au 30, définitives ; héritage', () => {
  const t = { r: {} } as any
  assert.equal(peutSpecialiser('fantassin', 14, t, 'rempart'), 'ui.talents.trop_tot')
  assert.equal(peutSpecialiser('fantassin', 15, t, 'tireur'), 'ui.talents.inconnu')
  assert.equal(peutSpecialiser('fantassin', 15, t, 'rempart'), null)
  t.spec = 'rempart'
  assert.equal(peutSpecialiser('fantassin', 15, t, 'assaut'), 'ui.talents.deja_spec')
  assert.equal(peutMaitriser(29, t, 'phalange'), 'ui.talents.trop_tot')
  assert.equal(peutMaitriser(30, t, 'fureur'), 'ui.talents.inconnu', 'une maîtrise d\'une autre spécialité')
  assert.equal(peutMaitriser(30, t, 'phalange'), null)
  // l'héritier : des points et, dans la même classe, la spécialité de l'ancêtre plus tôt
  const h = heritage({ cls: 'fantassin', level: 33, talents: { r: {}, spec: 'assaut' } }, 'fantassin')
  assert.equal(h.bonus, 2); assert.equal(h.herite, 'assaut')
  assert.equal(pointsTotal(1, h), 2)
  assert.equal(peutSpecialiser('fantassin', 10, h, 'assaut'), null)
  assert.equal(peutSpecialiser('fantassin', 10, h, 'rempart'), 'ui.talents.trop_tot')
  assert.equal(heritage({ cls: 'medic', level: 60, talents: { r: {}, spec: 'chirurgien' } }, 'fantassin').herite, undefined)
  assert.equal(heritage(null, 'medic').bonus, undefined)
})

test('les compétences s\'ouvrent avec le niveau, la troisième avec la spécialité', () => {
  const b: [string, string] = [CLASSES.fantassin.competences[0].id, CLASSES.fantassin.competences[1].id]
  assert.deepEqual(competencesDe('fantassin', 1, { r: {} }, b), [b[0], null, null])
  assert.deepEqual(competencesDe('fantassin', 4, { r: {} }, b), [b[0], b[1], null])
  assert.deepEqual(competencesDe('fantassin', 15, { r: {}, spec: 'assaut' }, b), [b[0], b[1], 'percee'])
})

test('les bonus plafonnent, la maîtrise change la compétence, la répartition auto est valide pour tous', () => {
  const m = modsDe({ r: Object.fromEntries(TALENTS.map((d) => [d.id, RANG_MAX])) })
  for (const [k, v] of Object.entries(MOD_MAX)) assert.ok((m as any)[k] <= (v as number), k)
  const base = paramsCompetence('bastion', { r: {}, spec: 'rempart' }, modsDe({ r: {} }))
  const maitre = paramsCompetence('bastion', { r: {}, spec: 'rempart', maitrise: 'inebranlable' }, modsDe({ r: {} }))
  assert.equal(maitre.dur! - base.dur!, 3)
  for (const c of CLASS_IDS) for (const lv of [1, 4, 15, 30, 60]) for (const ch of [0, 1]) {
    const t = talentsAuto(c, lv, ch)
    assert.deepEqual(nettoyer(c, lv, t), t, `${c} ${lv} ${ch}`)
    assert.equal(pointsLibres(lv, t), 0, `${c} ${lv} : tous les points placés`)
  }
})

// ------------------------------------------------------------------ le serveur
const PORT = await portLibre(), BASE = `http://127.0.0.1:${PORT}`
const dir = mkdtempSync(join(tmpdir(), 'heirline-talents-'))
const DB = join(dir, 'h.db')
let srv: ChildProcess
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function jusqua(f: () => boolean, ms = 15000) { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('délai dépassé'); await attendre(50) } }
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
after(async () => { srv?.kill('SIGTERM'); await attendre(300); rmSync(dir, { recursive: true, force: true }) })

test('le serveur refuse ce qui n\'est pas permis et enregistre le reste', { timeout: 60000 }, async () => {
  const token = (await (await fetch(BASE + '/api/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ famille: 'Talent' }) })).json()).token as string
  const client = new Client(BASE)
  const entrer = async (cls?: string) => {
    const room: Room<any> = await client.joinOrCreate('secteur', { token, carte: 'ossara', ...(cls ? { cls } : {}) })
    const s = { moi: null as any, logs: [] as string[], room }
    room.onMessage('*', () => {}); room.onMessage('moi', (m: any) => { s.moi = m }); room.onMessage('log', (m: any) => s.logs.push(trx('fr', m.t)))
    await jusqua(() => !!s.moi)
    return s
  }
  let s = await entrer('fantassin')
  assert.equal(s.moi.points, 0)
  assert.deepEqual(s.moi.comp.slice(1), [null, null], 'niveau 1 : une seule compétence')
  s.room.send('talent', { id: 'fantassin.cuir' })
  s.room.send('specialite', { id: 'rempart' })
  await jusqua(() => s.logs.length >= 2)
  assert.match(s.logs.join('|'), /Plus de points/); assert.match(s.logs.join('|'), /Niveau trop bas/)
  await s.room.leave(true); await attendre(400)

  // niveau 20 (directement dans la base jetable), on revient
  const base = new DatabaseSync(DB)
  base.prepare('UPDATE soldiers SET level = 20 WHERE alive = 1').run()
  s = await entrer()
  assert.equal(s.moi.points, 19)
  assert.equal(s.moi.comp.filter(Boolean).length, 2)
  for (let i = 0; i < 5; i++) s.room.send('talent', { id: 'fantassin.cuir' })
  s.room.send('talent', { id: 'medic.serment' })
  s.room.send('specialite', { id: 'tireur' })
  s.room.send('specialite', { id: 'assaut' })
  s.room.send('specialite', { id: 'rempart' })
  await jusqua(() => s.moi.talents.spec === 'assaut' && s.moi.talents.r['fantassin.cuir'] === 5 && s.logs.length >= 3)
  assert.equal(s.moi.comp[2], 'percee')
  assert.equal(s.moi.points, 14)
  const enBase = JSON.parse((base.prepare('SELECT talents_json FROM soldiers WHERE alive = 1').get() as any).talents_json)
  assert.equal(enBase.spec, 'assaut'); assert.equal(enBase.r['fantassin.cuir'], 5); assert.equal(enBase.r['medic.serment'], undefined)

  // tout reprendre coûte de la ferraille : sans le sou, refusé ; avec, les points reviennent mais pas la spécialité
  base.prepare('UPDATE accounts SET scrap = 0').run()
  s.room.send('talents_raz')
  await jusqua(() => s.logs.some((l) => /Pas assez/.test(l)))
  base.prepare('UPDATE accounts SET scrap = 1000').run()
  s.room.send('talents_raz')
  await jusqua(() => s.moi.points === 19)
  assert.equal(s.moi.talents.spec, 'assaut')
  assert.equal((base.prepare('SELECT scrap FROM accounts').get() as any).scrap, 1000 - coutRaz(20))
  await s.room.leave(true)
  base.close()
})
