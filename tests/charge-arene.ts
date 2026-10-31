// Test de charge de l'arène de la Couveuse : N vrais clients Colyseus (WebSocket) au nid, par groupes de quatre
// (une instance par groupe), en pilote automatique. Mesure la bande passante reçue par client pendant le combat, et
// la compare à ce que coûteraient les mêmes balles envoyées une à une (positions à 20 Hz).
// npx tsx tests/charge-arene.ts http://127.0.0.1:2795 8 40   (serveur de banc, adresse du réseau local : outils de test permis)
const base = process.argv[2] ?? 'http://127.0.0.1:2795'
const N = Number(process.argv[3] ?? 8)
const DUREE = Number(process.argv[4] ?? 40)

let recu = 0, messages = 0
const WS = globalThis.WebSocket
;(globalThis as any).WebSocket = class extends WS {
  constructor(url: any, p?: any) {
    super(url, p)
    this.addEventListener('message', (e: any) => { messages++; recu += e.data?.byteLength ?? e.data?.size ?? String(e.data).length })
  }
}
const { Client } = await import('@colyseus/sdk')
const { balles, posBalle } = await import('../shared/motifs.ts')

const motifs = new Map<string, any>() // un exemplaire par motif (toutes les instances), pour compter les balles en vol
let nMotifs = 0, octetsMotifs = 0
const rooms: any[] = []
for (let i = 0; i < N; i++) {
  const inv = await (await fetch(`${base}/api/invite`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ famille: `Arene${i}` }) })).json()
  const room = await new Client(base).joinOrCreate('nid', { token: inv.token, cls: ['fantassin', 'medic', 'ingenieur'][i % 3], carte: 'nid' })
  room.onMessage('*', () => {})
  room.onMessage('motif', (m: any) => { nMotifs++; octetsMotifs += JSON.stringify(m).length; motifs.set(room.roomId + ':' + m.id, { ...m, recu: performance.now() / 1000 }) })
  rooms.push(room)
}
await new Promise((r) => setTimeout(r, 1500))
for (const r of rooms) { r.send('voyage', { dest: 'couveuse' }); r.send('autopilote', { on: true }) }
console.log(`${N} clients, ${new Set(rooms.map((r) => r.roomId)).size} instances du nid`)
await new Promise((r) => setTimeout(r, 4000)) // la porte se referme, le combat démarre
recu = 0; messages = 0; nMotifs = 0; octetsMotifs = 0
const t0 = performance.now() / 1000
let maxVol = 0, sommeVol = 0, n = 0
const timer = setInterval(() => {
  // les balles en vol, par instance (vu du client : temps local depuis la réception)
  const now = performance.now() / 1000
  const parSalle = new Map<string, number>()
  for (const [k, m] of motifs) {
    const t = m.t0 + (now - m.recu) - m.dt
    let v = 0
    for (const b of balles(m)) if (posBalle(m, b, t)) v++
    if (!v && t > m.t0 + 1) { motifs.delete(k); continue }
    const salle = k.split(':')[0]
    parSalle.set(salle, (parSalle.get(salle) ?? 0) + v)
  }
  for (const v of parSalle.values()) { maxVol = Math.max(maxVol, v); sommeVol += v; n++ }
}, 100)
await new Promise((r) => setTimeout(r, DUREE * 1000))
clearInterval(timer)
const s = performance.now() / 1000 - t0
const etats = rooms.map((r) => r.state.bossPv)
const moy = n ? sommeVol / n : 0
const res = {
  clients: N, instances: new Set(rooms.map((r) => r.roomId)).size, dureeS: Math.round(s),
  ko_s_par_client: +(recu / s / N / 1024).toFixed(2), messages_s_par_client: +(messages / s / N).toFixed(1),
  motifs_s_par_instance: +(nMotifs / s / N).toFixed(2), octets_par_motif: nMotifs ? Math.round(octetsMotifs / nMotifs) : 0,
  balles_en_vol_moyen: Math.round(moy), balles_en_vol_max: maxVol,
  // la même chose balle par balle : position et vitesse quantifiées (~10 octets) à 20 Hz, sans compter les en-têtes
  ko_s_si_balle_par_balle: +(moy * 10 * 20 / 1024).toFixed(1),
  pv_boss_fin: etats,
}
console.log(JSON.stringify(res, null, 2))
for (const r of rooms) await r.leave().catch(() => {})
process.exit(0)
export {}
