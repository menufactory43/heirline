// Test de charge : N vrais clients Colyseus (WebSocket) dans le secteur, qui bougent et tirent à 20 Hz.
// Mesure : bande passante reçue par client, durée du tick serveur (/api/stats), CPU et mémoire du serveur (ps).
// npx tsx tests/charge.ts http://127.0.0.1:2792 60 60 [pid-serveur]   (serveur lancé avec HEIRLINE_DEBUG, jamais celui du jeu)
import { execSync } from 'node:child_process'

const base = process.argv[2] ?? 'http://127.0.0.1:2700'
const N = Number(process.argv[3] ?? 60)
const DUREE = Number(process.argv[4] ?? 60)
const PID = process.argv[5]
const DEBUG = process.env.HEIRLINE_DEBUG ?? 'capture41'

// compter les octets reçus sur chaque WebSocket
let recu = 0, messages = 0
const WS = globalThis.WebSocket
;(globalThis as any).WebSocket = class extends WS {
  constructor(url: any, p?: any) {
    super(url, p)
    this.addEventListener('message', (e: any) => { messages++; recu += e.data?.byteLength ?? e.data?.size ?? String(e.data).length })
  }
}

const { Client } = await import('@colyseus/sdk') // après le compteur, qui doit remplacer WebSocket avant
const { carteMap } = await import('../shared/cartes/index.ts')
const { isSolidTile, T } = await import('../shared/map.ts')
const { CITY } = await import('../shared/consts.ts')
const carte = carteMap('ossara')
// des tuiles où l'on tient debout : un tiers dans Port-Ancre, le reste sur tout le continent (régions, ÉDEN)
const sol = (x: number, y: number) => { const t = carte.tiles[y * carte.w + x]; return !isSolidTile(t) && t !== T.MER }
function place(i: number): [number, number] {
  let k = i * 7919
  for (let n = 0; n < 5000; n++) {
    k = (k * 1103515245 + 12345) >>> 0
    const port = i % 3 === 0
    const x = port ? CITY.x0 + 4 + (k % (CITY.x1 - CITY.x0 - 8)) : 20 + (k % 360), y = port ? CITY.y0 + 4 + ((k >>> 8) % (CITY.y1 - CITY.y0 - 8)) : 20 + ((k >>> 8) % 360)
    if (sol(x, y)) return [x * 16 + 8, y * 16 + 8]
  }
  return [carte.points.spawn.x, carte.points.spawn.y]
}
const classes = ['fantassin', 'medic', 'ingenieur']
const rooms: any[] = []
const t0 = Date.now()
for (let i = 0; i < N; i++) {
  const inv = await (await fetch(`${base}/api/invite`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ famille: `Charge${i}` }) })).json()
  const c = new Client(base)
  const room = await c.joinOrCreate('secteur', { token: inv.token, cls: classes[i % 3], carte: 'ossara' })
  room.onMessage('*', () => {})
  const input = room.input({ mode: 'reliable' })
  // répartir les clients sur le continent : un tiers à Port-Ancre (la ville, ses habitants), le reste
  // dans les régions, des plaines aux taches d'ÉDEN (camps, faune, créatures au-delà du front)
  const [x, y] = place(i)
  room.send('tp', { code: DEBUG, x, y })
  rooms.push({ room, input, a: Math.random() * 6.28, t: 0 })
}
console.log(`${N} clients connectés en ${((Date.now() - t0) / 1000).toFixed(1)} s`)
await fetch(`${base}/api/stats`) // remise à zéro
recu = 0; messages = 0
const cpu: number[] = []
const start = Date.now()
const timer = setInterval(() => {
  for (const r of rooms) {
    r.t -= 0.05
    if (r.t <= 0) { r.a += (Math.random() - 0.5) * 2.5; r.t = 0.5 + Math.random() * 1.5 }
    r.input.data.mx = Math.cos(r.a); r.input.data.my = Math.sin(r.a); r.input.data.aim = r.a; r.input.data.fire = Math.random() < 0.7
    r.input.send()
  }
}, 50)
const cpuTimer = setInterval(() => { if (PID) { try { cpu.push(Number(execSync(`ps -o %cpu= -p ${PID}`).toString().trim())) } catch {} } }, 2000)
await new Promise((r) => setTimeout(r, DUREE * 1000))
clearInterval(timer); clearInterval(cpuTimer)
const s = (Date.now() - start) / 1000
const stats = await (await fetch(`${base}/api/stats`)).json()
const etat = await (await fetch(`${base}/api/etat`)).json()
const mem = PID ? Number(execSync(`ps -o rss= -p ${PID}`).toString().trim()) / 1024 : stats.mem / 1048576
const res = {
  clients: N, copies: new Set(rooms.map((r) => r.room.roomId)).size, dureeS: Math.round(s), soldatsEnLigne: etat.soldatsEnLigne, soldatsIA: etat.soldatsIA,
  ko_s_par_client: +(recu / s / N / 1024).toFixed(2), messages_s_par_client: +(messages / s / N).toFixed(1),
  intervalle_tick_ms_moyen: +stats.tickMoyen.toFixed(2), intervalle_tick_ms_ecart: +stats.ecart.toFixed(2), intervalle_tick_ms_max: +stats.max.toFixed(1),
  calcul_ms_moyen: +stats.calculMoyenMs.toFixed(2), calcul_ms_max: +stats.calculMaxMs.toFixed(1),
  cpu_pct_moyen: cpu.length ? +(cpu.reduce((a, b) => a + b, 0) / cpu.length).toFixed(1) : null, cpu_pct_max: cpu.length ? Math.max(...cpu) : null,
  memoire_mo: Math.round(mem),
}
console.log(JSON.stringify(res, null, 2))
for (const r of rooms) r.room.leave(true)
setTimeout(() => process.exit(0), 1500)
