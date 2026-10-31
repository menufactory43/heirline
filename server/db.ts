// La persistance : comptes, soldats et lignées, robots, morts, clés d'API, concessions et leurs versions.
// SQLite intégré à Node 22 (node:sqlite).
import { DatabaseSync } from 'node:sqlite'
import { randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ClassId } from '../shared/rules.ts'

export interface Account { id: string; token: string; family: string; scrap: number; loot_day: string; loot_today: number }
export interface Soldier { id: number; account: string; given: string; cls: ClassId; level: number; xp: number; generation: number; alive: number; created: number; died: number | null; death_json: string | null; inv_json?: string; equip_json?: string; sac?: number; pos_json?: string; talents_json?: string }
export interface RobotRow { account: string; level: number; state: 'avec' | 'avant-poste' | 'atelier'; ox: number; oy: number; ohp: number; ountil: number; pertes: number; carte: string }
export interface ConcessionRow { id: string; owner: string; name: string; version: number; json: string; reward_json: string; plays: number; created: number; updated: number }

const PRENOMS = ['Ada', 'Bastien', 'Céleste', 'Dario', 'Élise', 'Fanny', 'Gaspard', 'Héloïse', 'Ilan', 'Jeanne', 'Kenji', 'Lina', 'Malo', 'Nora', 'Octave', 'Paloma', 'Quentin', 'Rosa', 'Sacha', 'Tess', 'Ugo', 'Vera', 'Wassim', 'Yuna', 'Zélie']
const FAMILLES = ['Arnaud', 'Berthier', 'Castel', 'Delmas', 'Esteve', 'Faure', 'Garnier', 'Hachet', 'Imbert', 'Joly', 'Kervella', 'Lacombe', 'Marchal', 'Noyer', 'Orsini', 'Pradel', 'Quéré', 'Roussel', 'Sauvage', 'Tessier', 'Vidal', 'Weber']
export const randomGiven = () => PRENOMS[Math.floor(Math.random() * PRENOMS.length)]
export const unusedGiven = (used: Set<string>) => { const free = PRENOMS.filter((n) => !used.has(n)); return free.length ? free[Math.floor(Math.random() * free.length)] : randomGiven() + ' ' + (used.size + 1) }
export const randomFamily = () => FAMILLES[Math.floor(Math.random() * FAMILLES.length)]
const id = (n = 9) => randomBytes(n).toString('base64url')

export class Db {
  db: DatabaseSync
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, token TEXT UNIQUE, family TEXT, scrap INTEGER DEFAULT 0, loot_day TEXT DEFAULT '', loot_today INTEGER DEFAULT 0, created INTEGER);
      CREATE TABLE IF NOT EXISTS soldiers (id INTEGER PRIMARY KEY AUTOINCREMENT, account TEXT, given TEXT, cls TEXT, level INTEGER, xp INTEGER, generation INTEGER, alive INTEGER, created INTEGER, died INTEGER, death_json TEXT);
      CREATE TABLE IF NOT EXISTS robots (account TEXT PRIMARY KEY, level INTEGER DEFAULT 1, state TEXT DEFAULT 'avec', ox REAL DEFAULT 0, oy REAL DEFAULT 0, ohp REAL DEFAULT 0, ountil INTEGER DEFAULT 0, pertes INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS deaths (id INTEGER PRIMARY KEY AUTOINCREMENT, account TEXT, family TEXT, given TEXT, cls TEXT, level INTEGER, generation INTEGER, killer TEXT, x REAL, y REAL, at INTEGER);
      CREATE TABLE IF NOT EXISTS apikeys (key TEXT PRIMARY KEY, account TEXT, created INTEGER);
      CREATE TABLE IF NOT EXISTS concessions (id TEXT PRIMARY KEY, owner TEXT, name TEXT, version INTEGER, json TEXT, reward_json TEXT, plays INTEGER DEFAULT 0, created INTEGER, updated INTEGER);
      CREATE TABLE IF NOT EXISTS concession_versions (id TEXT, version INTEGER, json TEXT, reward_json TEXT, created INTEGER, PRIMARY KEY (id, version));
      CREATE TABLE IF NOT EXISTS publications (account TEXT, at INTEGER);
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS quests (account TEXT, id TEXT, etat TEXT, prog_json TEXT, at INTEGER, PRIMARY KEY (account, id));
      -- les guildes (server/social.ts) : une lignée dans une guilde au plus ; rang 0 membre, 1 officier, 2 chef
      CREATE TABLE IF NOT EXISTS guildes (id TEXT PRIMARY KEY, nom TEXT UNIQUE COLLATE NOCASE, tag TEXT, created INTEGER);
      CREATE TABLE IF NOT EXISTS guilde_membres (account TEXT PRIMARY KEY, guilde TEXT, rang INTEGER DEFAULT 0, depuis INTEGER);
    `)
    // colonnes ajoutées avec le monde ouvert : sac, équipement, ferraille portée, choix de la trame
    for (const sql of [
      "ALTER TABLE soldiers ADD COLUMN inv_json TEXT DEFAULT '[]'",
      "ALTER TABLE soldiers ADD COLUMN equip_json TEXT DEFAULT '{}'",
      'ALTER TABLE soldiers ADD COLUMN sac INTEGER DEFAULT 0',
      "ALTER TABLE accounts ADD COLUMN flags_json TEXT DEFAULT '{}'",
      // le continent et ses cartes reliées : sur quelle carte un avant-poste est planté
      "ALTER TABLE robots ADD COLUMN carte TEXT DEFAULT 'ossara'",
      // reprendre là où on s'est arrêté : { carte, x, y } (server/reprise.ts)
      "ALTER TABLE soldiers ADD COLUMN pos_json TEXT DEFAULT ''",
      // talents, spécialité, maîtrise, héritage (shared/talents.ts)
      "ALTER TABLE soldiers ADD COLUMN talents_json TEXT DEFAULT '{}'",
    ]) { try { this.db.exec(sql) } catch { /* déjà là */ } }
  }

  // --- guildes ---
  guilde(id: string) { return this.db.prepare('SELECT id, nom, tag FROM guildes WHERE id = ?').get(id) as { id: string; nom: string; tag: string } | undefined }
  guildeParNom(nom: string) { return this.db.prepare('SELECT id, nom, tag FROM guildes WHERE nom = ?').get(nom) as { id: string; nom: string; tag: string } | undefined }
  creerGuilde(nom: string, tag: string, chef: string) {
    const g = { id: id(), nom, tag }
    this.db.prepare('INSERT INTO guildes (id, nom, tag, created) VALUES (?, ?, ?, ?)').run(g.id, nom, tag, Date.now())
    this.rejoindreGuilde(chef, g.id, 2)
    return g
  }
  guildeDe(account: string) { return this.db.prepare('SELECT guilde, rang FROM guilde_membres WHERE account = ?').get(account) as { guilde: string; rang: number } | undefined }
  rejoindreGuilde(account: string, guilde: string, rang = 0) { this.db.prepare('INSERT OR REPLACE INTO guilde_membres (account, guilde, rang, depuis) VALUES (?, ?, ?, ?)').run(account, guilde, rang, Date.now()) }
  quitterGuilde(account: string) { this.db.prepare('DELETE FROM guilde_membres WHERE account = ?').run(account) }
  rangGuilde(account: string, rang: number) { this.db.prepare('UPDATE guilde_membres SET rang = ? WHERE account = ?').run(rang, account) }
  membresGuilde(guilde: string) { return this.db.prepare('SELECT m.account, m.rang, a.family FROM guilde_membres m JOIN accounts a ON a.id = m.account WHERE m.guilde = ? ORDER BY m.rang DESC, m.depuis').all(guilde) as { account: string; rang: number; family: string }[] }
  supprimerGuilde(guilde: string) { this.db.prepare('DELETE FROM guilde_membres WHERE guilde = ?').run(guilde); this.db.prepare('DELETE FROM guildes WHERE id = ?').run(guilde) }

  // --- comptes ---
  createGuest(family?: string): Account {
    const a = { id: id(), token: id(18), family: (family || randomFamily()).slice(0, 20) }
    this.db.prepare('INSERT INTO accounts (id, token, family, created) VALUES (?, ?, ?, ?)').run(a.id, a.token, a.family, Date.now())
    this.db.prepare('INSERT INTO robots (account) VALUES (?)').run(a.id)
    return this.account(a.id)!
  }
  account(id: string) { return this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Account | undefined }
  accountByToken(token: string) { return this.db.prepare('SELECT * FROM accounts WHERE token = ?').get(token) as Account | undefined }
  addScrap(account: string, n: number) { this.db.prepare('UPDATE accounts SET scrap = MAX(0, scrap + ?) WHERE id = ?').run(Math.round(n), account) }
  setFamily(account: string, family: string) { this.db.prepare('UPDATE accounts SET family = ? WHERE id = ?').run(family.slice(0, 20), account) }

  /** Butin de concession : plafonné par jour. Rend ce qui a vraiment été donné. */
  concessionLoot(account: string, wanted: number, cap: number) {
    const a = this.account(account)!
    const day = new Date().toISOString().slice(0, 10)
    const today = a.loot_day === day ? a.loot_today : 0
    const give = Math.max(0, Math.min(wanted, cap - today))
    this.db.prepare('UPDATE accounts SET loot_day = ?, loot_today = ?, scrap = scrap + ? WHERE id = ?').run(day, today + give, give, account)
    return give
  }

  // --- soldats et lignée ---
  livingSoldier(account: string) { return this.db.prepare('SELECT * FROM soldiers WHERE account = ? AND alive = 1 ORDER BY id DESC LIMIT 1').get(account) as Soldier | undefined }
  lineage(account: string) { return this.db.prepare('SELECT * FROM soldiers WHERE account = ? ORDER BY generation').all(account) as unknown as Soldier[] }
  createSoldier(account: string, cls: ClassId, level: number, generation: number, given = randomGiven(), talents: unknown = {}): Soldier {
    const r = this.db.prepare('INSERT INTO soldiers (account, given, cls, level, xp, generation, alive, created, talents_json) VALUES (?, ?, ?, ?, 0, ?, 1, ?, ?)').run(account, given, cls, level, generation, Date.now(), JSON.stringify(talents))
    return this.db.prepare('SELECT * FROM soldiers WHERE id = ?').get(Number(r.lastInsertRowid)) as unknown as Soldier
  }
  savePos(id: number, pos: { carte: string; x: number; y: number }) { this.db.prepare('UPDATE soldiers SET pos_json = ? WHERE id = ?').run(JSON.stringify({ carte: pos.carte, x: Math.round(pos.x), y: Math.round(pos.y) }), id) }
  saveSoldier(s: { id: number; level: number; xp: number; inv?: unknown; equip?: unknown; sac?: number; talents?: unknown }) {
    if (s.inv === undefined) this.db.prepare('UPDATE soldiers SET level = ?, xp = ? WHERE id = ?').run(s.level, s.xp, s.id)
    else this.db.prepare('UPDATE soldiers SET level = ?, xp = ?, inv_json = ?, equip_json = ?, sac = ? WHERE id = ?').run(s.level, s.xp, JSON.stringify(s.inv), JSON.stringify(s.equip ?? {}), Math.round(s.sac ?? 0), s.id)
    if (s.talents !== undefined) this.db.prepare('UPDATE soldiers SET talents_json = ? WHERE id = ?').run(JSON.stringify(s.talents), s.id)
  }
  killSoldier(s: Soldier, info: { killer: string; x: number; y: number; family: string; carte?: string }) {
    this.db.prepare('UPDATE soldiers SET alive = 0, died = ?, death_json = ? WHERE id = ?').run(Date.now(), JSON.stringify(info), s.id)
    this.db.prepare('INSERT INTO deaths (account, family, given, cls, level, generation, killer, x, y, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(s.account, info.family, s.given, s.cls, s.level, s.generation, info.killer, info.x, info.y, Date.now())
  }
  deaths(limit = 30) { return this.db.prepare('SELECT family, given, cls, level, generation, killer, at FROM deaths ORDER BY id DESC LIMIT ?').all(limit) }

  // --- robots ---
  robot(account: string) { return this.db.prepare('SELECT * FROM robots WHERE account = ?').get(account) as unknown as RobotRow }
  setRobot(account: string, r: Partial<RobotRow>) {
    const cur = this.robot(account)
    const n = { ...cur, ...r }
    this.db.prepare('UPDATE robots SET level = ?, state = ?, ox = ?, oy = ?, ohp = ?, ountil = ?, pertes = ?, carte = ? WHERE account = ?').run(n.level, n.state, n.ox, n.oy, n.ohp, n.ountil, n.pertes, n.carte ?? 'ossara', account)
  }
  outposts() {
    return this.db.prepare(`SELECT r.*, a.family, (SELECT given FROM soldiers s WHERE s.account = r.account AND s.alive = 0 ORDER BY s.died DESC LIMIT 1) AS given
      FROM robots r JOIN accounts a ON a.id = r.account WHERE r.state = 'avant-poste'`).all() as unknown as (RobotRow & { family: string; given: string })[]
  }

  // --- clés d'API ---
  createKey(account: string) { const k = 'hl_' + id(24); this.db.prepare('INSERT INTO apikeys (key, account, created) VALUES (?, ?, ?)').run(k, account, Date.now()); return k }
  accountByKey(key: string) {
    const r = this.db.prepare('SELECT account FROM apikeys WHERE key = ?').get(key) as { account: string } | undefined
    return r ? this.account(r.account) : undefined
  }
  revokeKeys(account: string) { this.db.prepare('DELETE FROM apikeys WHERE account = ?').run(account) }

  // --- concessions ---
  concessions() { return this.db.prepare('SELECT c.id, c.owner, c.name, c.version, c.reward_json, c.plays, c.updated, a.family AS owner_family FROM concessions c JOIN accounts a ON a.id = c.owner ORDER BY c.plays DESC, c.updated DESC LIMIT 100').all() as any[] }
  concession(id: string) { return this.db.prepare('SELECT * FROM concessions WHERE id = ?').get(id) as ConcessionRow | undefined }
  concessionVersion(id: string, version: number) { return this.db.prepare('SELECT * FROM concession_versions WHERE id = ? AND version = ?').get(id, version) as { json: string; reward_json: string } | undefined }
  versions(id: string) { return this.db.prepare('SELECT version, created FROM concession_versions WHERE id = ? ORDER BY version DESC').all(id) }
  publishConcession(owner: string, cid: string | undefined, name: string, json: string, reward: string) {
    const now = Date.now()
    const cur = cid ? this.concession(cid) : undefined
    if (cid && !cur) throw new Error('concession inconnue')
    if (cur && cur.owner !== owner) throw new Error("cette concession appartient à quelqu'un d'autre")
    const theId = cur?.id ?? id(6)
    const version = (cur?.version ?? 0) + 1
    if (cur) this.db.prepare('UPDATE concessions SET name = ?, version = ?, json = ?, reward_json = ?, updated = ? WHERE id = ?').run(name, version, json, reward, now, theId)
    else this.db.prepare('INSERT INTO concessions (id, owner, name, version, json, reward_json, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(theId, owner, name, version, json, reward, now, now)
    this.db.prepare('INSERT INTO concession_versions (id, version, json, reward_json, created) VALUES (?, ?, ?, ?, ?)').run(theId, version, json, reward, now)
    this.db.prepare('INSERT INTO publications (account, at) VALUES (?, ?)').run(owner, now)
    return { id: theId, version }
  }
  publicationsLastHour(owner: string) { return (this.db.prepare('SELECT COUNT(*) AS n FROM publications WHERE account = ? AND at > ?').get(owner, Date.now() - 3600_000) as { n: number }).n }
  countPlay(id: string) { this.db.prepare('UPDATE concessions SET plays = plays + 1 WHERE id = ?').run(id) }

  // --- quêtes et choix ---
  quests(account: string) { return this.db.prepare('SELECT id, etat, prog_json FROM quests WHERE account = ?').all(account) as { id: string; etat: string; prog_json: string }[] }
  setQuest(account: string, id: string, etat: string, prog: number[]) {
    this.db.prepare('INSERT INTO quests (account, id, etat, prog_json, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(account, id) DO UPDATE SET etat = excluded.etat, prog_json = excluded.prog_json, at = excluded.at').run(account, id, etat, JSON.stringify(prog), Date.now())
  }
  dropQuest(account: string, id: string) { this.db.prepare('DELETE FROM quests WHERE account = ? AND id = ?').run(account, id) }
  flags(account: string): Record<string, string> { try { return JSON.parse((this.db.prepare('SELECT flags_json FROM accounts WHERE id = ?').get(account) as any)?.flags_json || '{}') } catch { return {} } }
  setFlag(account: string, k: string, v: string) { const f = this.flags(account); f[k] = v; this.db.prepare('UPDATE accounts SET flags_json = ? WHERE id = ?').run(JSON.stringify(f), account) }
  incr(key: string) { const n = Number(this.get(key) ?? 0) + 1; this.set(key, String(n)); return n }

  // --- divers ---
  get(key: string) { return (this.db.prepare('SELECT value FROM kv WHERE key = ?').get(key) as { value: string } | undefined)?.value }
  set(key: string, value: string) { this.db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value) }
}

let shared: Db | null = null
export function db() { return (shared ??= new Db(process.env.HEIRLINE_DB ?? new URL('../data/heirline.db', import.meta.url).pathname)) }
export function setDb(d: Db) { shared = d }
