// Bots de charge : N connexions qui bougent, visent et tirent comme des joueurs, à 20 entrées/s.
export {}
// Mesure la bande passante par client, la régularité des mises à jour reçues et le délai de confirmation.
// Usage : tsx bots.ts <colyseus|stdb> <N> <secondes> [lag]
const [backend = 'colyseus', nStr = '50', secStr = '30', lagArg] = process.argv.slice(2)
const N = Number(nStr), SEC = Number(secStr), LAG = lagArg === 'lag'

// compteur d'octets autour du WebSocket natif de Node
let up = 0, down = 0
const Native = globalThis.WebSocket
class CountingWS extends Native {
  constructor(url: any, protocols?: any) {
    super(url, protocols)
    this.addEventListener('message', (e: any) => {
      const d = e.data; down += typeof d === 'string' ? Buffer.byteLength(d) : (d.byteLength ?? d.size ?? 0)
    })
  }
  send(d: any) { up += typeof d === 'string' ? Buffer.byteLength(d) : (d.byteLength ?? d.length ?? 0); super.send(d) }
}
;(globalThis as any).WebSocket = CountingWS

const { moveStep } = await import('../commun/sim.ts')
void moveStep

interface Bot { tick(): void; acks: number[]; gaps: number[] }
const bots: Bot[] = []

function brain() {
  let mx = 0, my = 0, aim = 0, change = 0
  return () => {
    if (--change <= 0) { const a = Math.random() * Math.PI * 2; mx = Math.cos(a); my = Math.sin(a); change = 20 + Math.random() * 30 }
    aim += (Math.random() - 0.5) * 0.6
    return { mx, my, aim: ((aim % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), fire: Math.random() < 0.5 }
  }
}

async function colyseusBot(): Promise<Bot> {
  const { Client } = await import('@colyseus/sdk')
  const client = new Client(`ws://${process.env.BOT_HOST ?? '127.0.0.1'}:${LAG ? 2667 : 2567}`)
  const room: any = await client.joinOrCreate('arena')
  const input: any = room.input({ mode: 'reliable' })
  const think = brain(); const sentAt = new Map<number, number>(); let sent = 0
  const bot: Bot = { acks: [], gaps: [], tick() {
    const i = think(); Object.assign(input.data, i); input.send(); sent = input.sentCount; sentAt.set(sent, performance.now())
  } }
  // la confirmation est lue dès l'arrivée du patch (pas au prochain envoi), comme côté SpacetimeDB
  const checkAck = () => {
    const lp = input.lastProcessed
    if (lp && sentAt.has(lp)) { bot.acks.push(performance.now() - sentAt.get(lp)!); for (const k of sentAt.keys()) if (k <= lp) sentAt.delete(k) }
  }
  let lastPatch = 0
  room.onStateChange(() => { checkAck(); const t = performance.now(); if (lastPatch) bot.gaps.push(t - lastPatch); lastPatch = t })
  return bot
}

async function stdbBot(): Promise<Bot> {
  const { DbConnection } = await import('./src/stdb/index.ts')
  return new Promise((resolve, reject) => {
    DbConnection.builder().withUri(`ws://${process.env.BOT_HOST ?? '127.0.0.1'}:${LAG ? 3100 : 3000}`).withDatabaseName('heirline-essai')
      .onConnect((c, identity) => {
        const me = identity.toHexString()
        const think = brain(); const sentAt = new Map<number, number>(); let seq = 0, lastUpd = 0
        const bot: Bot = { acks: [], gaps: [], tick() {
          const i = think(); seq++; sentAt.set(seq, performance.now())
          ;(backend === 'stdbq' ? c.reducers.inputQueued : c.reducers.input)({ seq, ...i })
        } }
        c.db.player.onUpdate((_ctx, _o, r) => {
          const t = performance.now()
          if (r.identity.toHexString() === me && sentAt.has(r.lastSeq)) {
            bot.acks.push(t - sentAt.get(r.lastSeq)!); for (const k of sentAt.keys()) if (k <= r.lastSeq) sentAt.delete(k)
          }
        })
        // « mise à jour reçue » = un message serveur (une transaction appliquée), mesuré sur les balles qui bougent à chaque tick
        c.db.bullet.onUpdate(() => { const t = performance.now(); if (t - lastUpd > 5) { if (lastUpd) bot.gaps.push(t - lastUpd); lastUpd = t } })
        c.subscriptionBuilder().onApplied(() => resolve(bot)).subscribe(['SELECT * FROM player', 'SELECT * FROM bullet'])
      })
      .onConnectError((_c, e) => reject(e)).build()
  })
}

for (let i = 0; i < N; i++) {
  bots.push(await (backend.startsWith('stdb') ? stdbBot() : colyseusBot()))
  await new Promise(r => setTimeout(r, 20))
}
console.error(`${N} bots ${backend}${LAG ? ' (4G simulée)' : ''} connectés`)
up = 0; down = 0
const t0 = performance.now()
const timer = setInterval(() => { for (const b of bots) b.tick() }, 50)
await new Promise(r => setTimeout(r, SEC * 1000))
clearInterval(timer)
const secs = (performance.now() - t0) / 1000
const all = (k: 'acks' | 'gaps') => bots.flatMap(b => b[k].slice(10))
const st = (a: number[]) => { const n = a.length || 1; const m = a.reduce((s, v) => s + v, 0) / n; const sd = Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / n); const s = [...a].sort((x, y) => x - y); return { n: a.length, moy: +m.toFixed(1), ecart: +sd.toFixed(1), p50: +(s[Math.floor(n * .5)] ?? 0).toFixed(1), p95: +(s[Math.floor(n * .95)] ?? 0).toFixed(1) } }
console.log(JSON.stringify({
  backend, N, lag: LAG, secs: +secs.toFixed(1),
  montant_ko_s_par_client: +(up / secs / N / 1024).toFixed(2),
  descendant_ko_s_par_client: +(down / secs / N / 1024).toFixed(2),
  confirmation_ms: st(all('acks')),
  ecart_entre_mises_a_jour_ms: st(all('gaps')),
}))
process.exit(0)
