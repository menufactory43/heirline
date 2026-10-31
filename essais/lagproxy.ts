// Proxy TCP qui imite la 4G : délai aller et retour (rtt/2 chacun, ± gigue) et pertes.
// Sur TCP une perte ne fait pas disparaître le paquet : il revient après une retransmission (~1 RTT de plus)
// et bloque tout ce qui suit (blocage en tête de ligne). C'est ce que subit un WebSocket sur un réseau mobile.
// Usage : tsx lagproxy.ts <port d'écoute> <port cible> <rtt ms> <perte %>
import net from 'node:net'
const [listen, target, rtt = '120', loss = '2'] = process.argv.slice(2)
const RTT = Number(rtt), LOSS = Number(loss) / 100, JITTER = 10

function pipe(from: net.Socket, to: net.Socket) {
  let releaseAt = 0
  from.on('data', chunk => {
    const now = Date.now()
    let t = now + RTT / 2 + (Math.random() * 2 - 1) * JITTER
    if (Math.random() < LOSS) t += RTT + 200 // retransmission TCP (RTO minimal ~200 ms)
    releaseAt = Math.max(releaseAt, t) // l'ordre est gardé : un paquet en retard retient les suivants
    setTimeout(() => { if (!to.destroyed) to.write(chunk) }, releaseAt - now)
  })
  from.on('close', () => setTimeout(() => to.destroy(), RTT))
  from.on('error', () => to.destroy())
}
net.createServer(c => {
  c.setNoDelay(true)
  const s = net.connect(Number(target), '127.0.0.1'); s.setNoDelay(true)
  pipe(c, s); pipe(s, c)
}).listen(Number(listen), '0.0.0.0', () => console.log(`proxy 4G ${listen} -> ${target} (rtt ${RTT} ms, perte ${loss} %)`))
