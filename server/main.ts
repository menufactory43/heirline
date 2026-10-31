// Le serveur de jeu : salles Colyseus (secteur, concessions), API REST, serveur MCP pour les agents IA, et le client.
import type { Lang } from '../shared/i18n/index.ts'
import { defineServer, defineRoom, matchMaker } from 'colyseus'
import express from 'express'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { Secteur } from './rooms/Secteur.ts'
import { ConcessionRoom } from './rooms/ConcessionRoom.ts'
import { tickStats } from './rooms/GameRoom.ts'
import { monitorEventLoopDelay } from 'node:perf_hooks'
// le retard de la boucle d'événements : si elle prend du retard, tous les ticks de toutes les salles en prennent
const boucle = monitorEventLoopDelay({ resolution: 10 }); boucle.enable()
import { reprise } from './reprise.ts'
import { db, type Account } from './db.ts'
import * as agents from './agents.ts'
import { Central, setCentral } from './central.ts'
import { migrer, migrerTrame } from './migration.ts'
import { completerRayons } from '../shared/front.ts'

// --- la base suit la version du monde, puis le service central (ruches, avant-postes, heure) démarre
const rapport = migrer(db())
if (rapport) console.log('Migration du monde :', JSON.stringify(rapport))
const rapportTrame = migrerTrame(db())
if (rapportTrame) console.log('Migration de la trame :', JSON.stringify(rapportTrame))
const centre = new Central({
  load: () => {
    let rayons: number[] | undefined
    try { const r = JSON.parse(db().get('ruches') || 'null'); rayons = completerRayons(r) } catch { /* rien */ }
    const h = Number(db().get('heure'))
    const outposts = db().outposts().filter((o) => o.ountil > 0).map((o) => ({ id: 'a' + o.account, account: o.account, family: o.family, given: o.given ?? '', level: o.level, carte: (o.carte || 'ossara') as any, x: o.ox, y: o.oy, hp: o.ohp, maxHp: Math.max(o.ohp, 1), until: o.ountil }))
    return { rayons, heure: db().get('heure') ? h : undefined, outposts, semeurVaincu: Number(db().get('semeur_vaincu') || 0), glaneuseVaincue: Number(db().get('glaneuse_vaincue') || 0) }
  },
  save: (c) => {
    db().set('ruches', JSON.stringify(c.rayons.map((r) => Math.round(r * 100) / 100)))
    db().set('heure', String(c.heure))
    db().set('semeur_vaincu', String(c.semeurVaincu))
    db().set('glaneuse_vaincue', String(c.glaneuseVaincue))
    for (const o of c.outposts.values()) db().setRobot(o.account, { ohp: o.hp })
  },
  outpostDestroyed: (o) => {
    const rob = db().robot(o.account)
    db().setRobot(o.account, { state: 'atelier', level: Math.max(1, rob.level - 1), pertes: rob.pertes + 1, ox: 0, oy: 0, ohp: 0, ountil: 0 })
  },
})
// les PV max d'un avant-poste : deux fois ceux du robot (voir Secteur.onPermadeath)
for (const o of centre.outposts.values()) o.maxHp = Math.max(o.hp, Math.round(80 * (1 + 0.15 * (o.level - 1))) * 2)
setCentral(centre)
centre.start()

const PORT = Number(process.env.PORT ?? 2700)
const DIST = fileURLToPath(new URL('../dist', import.meta.url))

// --- limites de requêtes des agents (par clé, 60 par minute)
const hits = new Map<string, number[]>()
function limited(key: string, max = 60, fenetre = 60_000) {
  const now = Date.now()
  const a = (hits.get(key) ?? []).filter((t) => now - t < fenetre)
  a.push(now); hits.set(key, a)
  return a.length > max
}
// les compteurs oubliés au bout d'une heure
setInterval(() => { const now = Date.now(); for (const [k, a] of hits) if (!a.length || now - a[a.length - 1] > 3_600_000) hits.delete(k) }, 600_000).unref()

/** L'adresse du client : derrière le tunnel Cloudflare, cf-connecting-ip (posé par Cloudflare, impossible à falsifier
 *  à travers lui) ; sinon l'adresse de la connexion. */
function ipClient(req: express.Request) {
  const cf = req.headers['cf-connecting-ip']
  return String(Array.isArray(cf) ? cf[0] : cf ?? req.socket.remoteAddress ?? '').replace(/^::ffff:/, '')
}
/** Réseau local (Wi-Fi de la maison), jamais par le tunnel : seul cas où les pages de mesure répondent. */
function reseauLocal(req: express.Request) {
  if (req.headers['cf-connecting-ip']) return false
  return /^(127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|::1$)/.test(ipClient(req))
}

function bearer(req: express.Request) {
  const h = String(req.headers.authorization ?? '')
  return h.startsWith('Bearer ') ? h.slice(7).trim() : ''
}
function agentAccount(req: express.Request, res: express.Response): Account | null {
  const key = bearer(req)
  const a = key ? db().accountByKey(key) : undefined
  if (!a) { res.status(401).json({ erreur: 'clé d\'API manquante ou inconnue (en-tête Authorization: Bearer <clé>)' }); return null }
  if (limited(key)) { res.status(429).json({ erreur: 'trop de requêtes : 60 par minute au plus' }); return null }
  return a
}
function playerAccount(req: express.Request, res: express.Response): Account | null {
  const t = String(req.headers['x-heirline-token'] ?? '')
  const a = t ? db().accountByToken(t) : undefined
  if (!a) { res.status(401).json({ erreur: 'jeton de joueur inconnu' }); return null }
  return a
}
function publicUrl(req: express.Request) {
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol)
  return `${proto}://${req.headers['x-forwarded-host'] ?? req.headers.host}`
}

// --- le serveur MCP : un serveur par requête (sans session), lié au compte de la clé
/** La langue des réponses aux agents : ?lang=fr ou l'en-tête x-heirline-lang (anglais par défaut). */
function langOf(req: express.Request): Lang { return agents.langue(req.query.lang ?? req.headers['x-heirline-lang']) }

function mcpFor(a: Account, l: Lang) {
  const s = new McpServer({ name: 'heirline', version: '0.1.0' }, {
    instructions: "Heirline is a shooter MMO where EDEN, a biomass, is reshaping the planet Ossara. You act for the player who owns this key. You can read the front, the open world (regions, inhabitants, the player's quests), the player's bloodline, and build concessions: playable sectors published live. Read heirline_briques first (catalog, limits, schema), then publish with heirline_concession_publier; the server validates it, has two AI soldiers play it to measure difficulty, and sets the reward itself. Names and texts come back in English; connect with ?lang=fr (or the x-heirline-lang: fr header) for French. Field names are the same in both languages.",
  })
  const json = (o: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(o, null, 2) }] })
  s.registerTool('heirline_front', { title: 'State of the front', description: "EDEN's hives (center, radius, trend) whose biomass patches form the front, the outposts left by the dead (shared HP), the Brooder, recent deaths.", inputSchema: {} }, async () => json(agents.front(l)))
  s.registerTool('heirline_cartes', { title: 'World graph', description: 'The maps (the continent of Ossara, the wreck of the Constance, the Nest instances), the passages linking them, the monorail stations (and those your bloodline has repaired), the number of open copies of each map and their players.', inputSchema: {} }, async () => json(await agents.cartes(db().account(a.id)!, l)))
  s.registerTool('heirline_moi', { title: 'My soldier, robot and bloodline', description: "The player's living soldier, their robot (level, state, outpost), their scrap and their whole bloodline.", inputSchema: {} }, async () => json(agents.me(db().account(a.id)!, l)))
  s.registerTool('heirline_briques', { title: 'Brick catalog', description: 'The closed list of bricks (enemies, bosses, walls, floors), the limits, the rules and the JSON schema of a concession.', inputSchema: {} }, async () => json(agents.bricks()))
  s.registerTool('heirline_concessions_lister', { title: 'List concessions', description: 'Published concessions, most played first.', inputSchema: {} }, async () => json(agents.listConcessions()))
  s.registerTool('heirline_concession_lire', { title: 'Read a concession', description: 'The content, reward and versions of a concession.', inputSchema: { id: z.string() } }, async ({ id }) => json(agents.getConcession(id) ?? { erreur: 'unknown concession' }))
  s.registerTool('heirline_concession_publier', {
    title: 'Publish a concession (live)',
    description: 'Creates a concession, or publishes a new version if id is given (you must be its creator). The content must follow the heirline_briques schema. Publication is immediate.',
    inputSchema: { concession: z.record(z.string(), z.any()).describe('the content, following the schema'), id: z.string().optional().describe('to update an existing concession') },
  }, async ({ concession, id }) => json(agents.publish(db().account(a.id)!, concession, id)))
  s.registerTool('heirline_monde', { title: 'The open world', description: "Ossara's regions and their levels, places, time of day and weather, the state of both bosses, and what the bloodlines chose about Highsap.", inputSchema: {} }, async () => json({ ...agents.monde(l), bestiaire: agents.bestiaire(l) }))
  s.registerTool('heirline_quetes', { title: 'My quests', description: "The soldier's active quests (with each objective's progress), completed ones, those available and who gives them, where the bloodline stands in the campaign (act, next step, ending), texts already read (Constance logs, data cores, gravestones), their bag and equipment.", inputSchema: {} }, async () => json(agents.quetes(db().account(a.id)!, l)))
  s.registerTool('heirline_pnj', { title: 'Inhabitants', description: "Ossara's inhabitants: current position, activity (they follow their day), shop, quests they give. Optional filter by place id (port, ferme, anse, fougere, hauteseve, postemarais, relais, mine, bastion, casse, campepave, cimetiere).", inputSchema: { lieu: z.string().optional() } }, async ({ lieu }) => json(agents.pnj(lieu, l)))
  s.registerTool('heirline_concession_revenir', { title: 'Roll back to a version', description: 'Republishes an old version of one of your concessions.', inputSchema: { id: z.string(), version: z.number().int() } }, async ({ id, version }) => json(agents.rollback(db().account(a.id)!, id, version)))
  return s
}

const server = defineServer({
  rooms: {
    // une salle par carte ; une carte pleine (seuil par carte) ouvre une copie ; le nid : une instance par groupe
    secteur: defineRoom(Secteur).filterBy(['carte']),
    // un groupe (server/social.ts) entre dans la même instance
    nid: defineRoom(Secteur).filterBy(['carte', 'groupe']),
    concession: defineRoom(ConcessionRoom).filterBy(['cid', 'version']),
  },
  express: (app) => {
    app.use('/api', express.json({ limit: '200kb' }))
    app.use('/mcp', express.json({ limit: '200kb' }))
    // en-têtes de sécurité (le jeu est public par le tunnel heirline.praxeongames.com)
    app.disable('x-powered-by')
    app.use((_req, res, next) => {
      res.setHeader('x-content-type-options', 'nosniff')
      res.setHeader('referrer-policy', 'strict-origin-when-cross-origin')
      res.setHeader('x-frame-options', 'SAMEORIGIN')
      res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()')
      next()
    })
    app.use((req, res, next) => { res.setHeader('access-control-allow-origin', '*'); res.setHeader('access-control-allow-headers', '*'); if (req.method === 'OPTIONS') return res.end(); next() })

    // --- le joueur (jeton d'invité)
    app.post('/api/invite', (req, res) => {
      // création de comptes : 10 par heure et par adresse
      if (!reseauLocal(req) && limited('invite:' + ipClient(req), 10, 3_600_000)) return res.status(429).json({ erreur: 'trop de comptes créés depuis cette adresse, réessaie plus tard' })
      const fam = typeof req.body?.famille === 'string' ? req.body.famille.trim().slice(0, 20) : ''
      const a = db().createGuest(fam || undefined)
      res.json({ token: a.token, famille: a.family })
    })
    // carte : où reprend le soldat (le salon de jeu revérifie et replace de toute façon)
    app.get('/api/moi', (req, res) => { const a = playerAccount(req, res); if (!a) return; const s = db().livingSoldier(a.id); res.json({ ...agents.me(a, langOf(req)), vivant: !!s, carte: reprise(s?.pos_json).carte }) })
    app.post('/api/famille', (req, res) => {
      const a = playerAccount(req, res); if (!a) return
      const f = String(req.body?.famille ?? '').trim().slice(0, 20)
      if (f.length < 2) return res.status(400).json({ erreur: 'nom trop court' })
      db().setFamily(a.id, f); res.json({ famille: f })
    })
    app.post('/api/cle', (req, res) => {
      const a = playerAccount(req, res); if (!a) return
      if (limited('cle:' + a.id, 5, 3_600_000)) return res.status(429).json({ erreur: 'trop de clés demandées, réessaie plus tard' })
      db().revokeKeys(a.id)
      const key = db().createKey(a.id)
      const url = publicUrl(req)
      res.json({ cle: key, mcp: `${url}/mcp`, commande: `claude mcp add --transport http heirline ${url}/mcp --header "Authorization: Bearer ${key}"` })
    })
    app.get('/api/concessions', (_req, res) => res.json(agents.listConcessions()))
    app.get('/api/concessions/:id/:version', (req, res) => {
      const row = db().concessionVersion(req.params.id, Number(req.params.version))
      row ? res.json({ contenu: JSON.parse(row.json), recompense: JSON.parse(row.reward_json) }) : res.status(404).json({ erreur: 'concession inconnue' })
    })
    app.get('/api/morts', (_req, res) => res.json(db().deaths(40)))
    app.get('/api/etat', (req, res) => res.json(agents.front(langOf(req))))
    app.get('/api/stats', (req, res) => {
      // mesures du serveur (bancs) : réseau local seulement
      if (!reseauLocal(req)) return res.status(404).end()
      const a = tickStats.ticks, n = a.length || 1
      const mean = a.reduce((s, v) => s + v, 0) / n
      const sd = Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / n)
      const st = tickStats.stepMs, m2 = st.reduce((s, v) => s + v, 0) / (st.length || 1)
      const tri = [...st].sort((x, y) => x - y), pc = (q: number) => tri.length ? tri[Math.min(tri.length - 1, Math.floor(q * tri.length))] : 0
      res.json({ n: a.length, tickMoyen: mean, ecart: sd, max: Math.max(0, ...a), calculMoyenMs: m2, calculP95Ms: pc(0.95), calculP99Ms: pc(0.99), calculMaxMs: Math.max(0, ...st), boucleP50Ms: boucle.percentile(50) / 1e6, boucleP99Ms: boucle.percentile(99) / 1e6, boucleMaxMs: boucle.max / 1e6, mem: process.memoryUsage().rss })
      boucle.reset()
      tickStats.ticks = []; tickStats.stepMs = []
    })

    // --- les agents (clé d'API)
    app.get('/api/agent/front', (req, res) => { if (agentAccount(req, res)) res.json(agents.front(langOf(req))) })
    app.get('/api/agent/moi', (req, res) => { const a = agentAccount(req, res); if (a) res.json(agents.me(a, langOf(req))) })
    app.get('/api/agent/monde', (req, res) => { if (agentAccount(req, res)) res.json({ ...agents.monde(langOf(req)), bestiaire: agents.bestiaire(langOf(req)) }) })
    app.get('/api/agent/quetes', (req, res) => { const a = agentAccount(req, res); if (a) res.json(agents.quetes(a, langOf(req))) })
    app.get('/api/agent/pnj', (req, res) => { if (agentAccount(req, res)) res.json(agents.pnj(typeof req.query.lieu === 'string' ? req.query.lieu : undefined, langOf(req))) })
    app.get('/api/monde', (req, res) => res.json(agents.monde(langOf(req))))
    app.get('/api/cartes', async (req, res) => { res.json(await agents.cartes(undefined, langOf(req))) })
    app.get('/api/agent/cartes', async (req, res) => { const a = agentAccount(req, res); if (a) res.json(await agents.cartes(a, langOf(req))) })
    app.get('/api/agent/briques', (req, res) => { if (agentAccount(req, res)) res.json(agents.bricks()) })
    app.get('/api/agent/concessions', (req, res) => { if (agentAccount(req, res)) res.json(agents.listConcessions()) })
    app.get('/api/agent/concessions/:id', (req, res) => { if (agentAccount(req, res)) { const c = agents.getConcession(req.params.id); c ? res.json(c) : res.status(404).json({ erreur: 'concession inconnue' }) } })
    app.post('/api/agent/concessions', (req, res) => { const a = agentAccount(req, res); if (a) { const r = agents.publish(a, req.body?.concession ?? req.body, req.body?.id); res.status(r.ok ? 200 : 400).json(r) } })
    app.post('/api/agent/concessions/:id/retour', (req, res) => { const a = agentAccount(req, res); if (a) { const r = agents.rollback(a, req.params.id, Number(req.body?.version)); res.status(r.ok ? 200 : 400).json(r) } })

    // --- MCP (Streamable HTTP, sans session)
    app.post('/mcp', async (req, res) => {
      const a = agentAccount(req, res); if (!a) return
      const s = mcpFor(a, langOf(req))
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
      res.on('close', () => { transport.close(); s.close() })
      await s.connect(transport)
      await transport.handleRequest(req as any, res as any, req.body)
    })
    app.get('/mcp', (_req, res) => res.status(405).json({ erreur: 'utiliser POST' }))
    app.delete('/mcp', (_req, res) => res.status(405).json({ erreur: 'sans session' }))

    // --- le client
    if (existsSync(DIST)) {
      // la page jamais gardée en cache (sinon un téléphone relance un client périmé après une mise à jour) ;
      // les fichiers de assets/ portent leur empreinte dans leur nom, ils se gardent pour toujours
      app.use(express.static(DIST, {
        index: 'index.html',
        setHeaders: (res, f) => res.setHeader('Cache-Control', /[\\/]assets[\\/]/.test(f) ? 'public, max-age=31536000, immutable' : f.endsWith('.html') ? 'no-cache' : 'public, max-age=3600'),
      }))
    }
  },
})

server.listen(PORT, '0.0.0.0').then(async () => {
  console.log(`Heirline : http://0.0.0.0:${PORT}`)
  const room = await matchMaker.createRoom('secteur', { carte: 'ossara' })
  const inst = matchMaker.getLocalRoomById(room.roomId) as unknown as Secteur
  agents.setSecteur(inst)
})
