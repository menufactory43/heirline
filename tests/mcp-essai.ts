// Un vrai client MCP (Streamable HTTP) : crée un compte, prend une clé, liste les outils, publie une concession.
// npx tsx tests/mcp-essai.ts http://127.0.0.1:2700 [jeton-joueur]
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { exemple } from './exemple.ts'

const base = process.argv[2] ?? 'http://127.0.0.1:2700'
let token = process.argv[3]
if (!token) token = (await (await fetch(`${base}/api/invite`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ famille: 'Agent' }) })).json()).token
const cle = await (await fetch(`${base}/api/cle`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-heirline-token': token }, body: '{}' })).json()
console.log('commande :', cle.commande)
const client = new Client({ name: 'essai', version: '1.0.0' })
await client.connect(new StreamableHTTPClientTransport(new URL(cle.mcp), { requestInit: { headers: { Authorization: `Bearer ${cle.cle}` } } }))
const tools = await client.listTools()
console.log('outils :', tools.tools.map((t) => t.name).join(', '))
const txt = (r: any) => JSON.parse(r.content[0].text)
const front = txt(await client.callTool({ name: 'heirline_front', arguments: {} }))
console.log('front :', JSON.stringify(front).slice(0, 300))
const cartes = txt(await client.callTool({ name: 'heirline_cartes', arguments: {} }))
console.log('cartes :', JSON.stringify(cartes).slice(0, 400))
const monde = txt(await client.callTool({ name: 'heirline_monde', arguments: {} }))
console.log('monde :', JSON.stringify(monde).slice(0, 600))
const quetes = txt(await client.callTool({ name: 'heirline_quetes', arguments: {} }))
console.log('quêtes :', JSON.stringify(quetes).slice(0, 500))
const pnj = txt(await client.callTool({ name: 'heirline_pnj', arguments: { lieu: 'port' } }))
console.log('habitants de Port-Ancre :', JSON.stringify(pnj).slice(0, 500))
const br = txt(await client.callTool({ name: 'heirline_briques', arguments: {} }))
console.log('briques :', Object.keys(br.ennemis).join(', '), '· budget', br.limites.budgetPuissance)
const mauvais = txt(await client.callTool({ name: 'heirline_concession_publier', arguments: { concession: { ...exemple, vagues: [{ delai: 1, groupes: [{ brique: 'cuirasse', nombre: 40, x: 30, y: 11 }] }] } } }))
console.log('refus attendu :', mauvais.ok, mauvais.erreurs)
const t0 = Date.now()
const pub = txt(await client.callTool({ name: 'heirline_concession_publier', arguments: { concession: { ...exemple, nom: process.env.NOM ?? exemple.nom } } }))
console.log('publication :', JSON.stringify(pub), `(${Date.now() - t0} ms)`)
const liste = txt(await client.callTool({ name: 'heirline_concessions_lister', arguments: {} }))
console.log('concessions :', liste.map((c: any) => `${c.id} ${c.nom} v${c.version}`).join(' | '))
await client.close()
