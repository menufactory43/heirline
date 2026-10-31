// Essai Colyseus 0.18 : serveur autoritaire à 20 Hz, entrées tamponnées, prédiction côté client.
import { defineServer, defineRoom, Room } from 'colyseus'
import { schema, t, MapSchema } from '@colyseus/schema'
import { W, H, TICK_HZ, RADIUS, BULLET_SPEED, BULLET_LIFE, FIRE_COOLDOWN, DAMAGE, MAX_HP, moveStep } from '../commun/sim.ts'

export const Player = schema({
  x: t.float32().default(0),
  y: t.float32().default(0),
  angle: t.angle(),
  hp: t.uint8().default(MAX_HP),
  score: t.uint16().default(0),
}, 'Player')

export const Bullet = schema({
  x: t.float32().default(0),
  y: t.float32().default(0),
  vx: t.float32().default(0),
  vy: t.float32().default(0),
}, 'Bullet')

export const State = schema({
  players: t.map(Player),
  bullets: t.map(Bullet),
}, 'State')

export const Input = schema({
  mx: t.quantized({ min: -1, max: 1, bits: 8 }),
  my: t.quantized({ min: -1, max: 1, bits: 8 }),
  aim: t.angle(),
  fire: t.boolean().default(false),
}, 'Input')

type P = InstanceType<typeof Player>
interface BulletSim { b: InstanceType<typeof Bullet>; owner: string; life: number }

// Statistiques du tick (écart entre deux pas, en ms) pour la mesure.
export const stats = { ticks: [] as number[], last: 0 }

class Arena extends Room<{ state: InstanceType<typeof State>; input: InstanceType<typeof Input> }> {
  state = new State()
  inputs = this.defineInput(Input as any, { bufferMaxSize: 32 }) as any
  cooldown = new Map<string, number>()
  bullets = new Map<string, BulletSim>()
  nextId = 0
  maxClients = 200

  onCreate() {
    // Réglage par défaut : patch sur son propre minuteur à 20 Hz. (Essai d'un patch envoyé juste après chaque pas,
    // patchRate = null + broadcastPatch() : la confirmation tombe à ~50 ms mais les patchs n'arrivent plus qu'à ~5/s, abandonné.)
    this.patchRate = 1000 / TICK_HZ
    this.setFixedTimestep((ctx) => this.step(ctx.dt), TICK_HZ)
  }

  onJoin(client: any) {
    const p = new Player()
    p.x = 100 + Math.random() * (W - 200); p.y = 100 + Math.random() * (H - 200)
    this.state.players.set(client.sessionId, p)
  }

  onLeave(client: any) { this.state.players.delete(client.sessionId) }

  step(dt: number) {
    const now = performance.now()
    if (stats.last) { stats.ticks.push(now - stats.last); if (stats.ticks.length > 2000) stats.ticks.shift() }
    stats.last = now
    for (const [sid, p] of this.state.players) {
      for (const inp of this.inputs.get(sid)) {
        moveStep(p, inp.mx, inp.my, dt)
        p.angle = inp.aim
        const cd = (this.cooldown.get(sid) ?? 0) - dt
        this.cooldown.set(sid, cd)
        if (inp.fire && cd <= 0) { this.cooldown.set(sid, FIRE_COOLDOWN); this.spawnBullet(sid, p) }
      }
    }
    for (const [id, s] of this.bullets) {
      s.b.x += s.b.vx * dt; s.b.y += s.b.vy * dt; s.life -= dt
      let hit = false
      for (const [sid, p] of this.state.players) {
        if (sid === s.owner) continue
        if ((p.x - s.b.x) ** 2 + (p.y - s.b.y) ** 2 < RADIUS * RADIUS) {
          hit = true
          if (p.hp <= DAMAGE) {
            p.hp = MAX_HP; p.x = 100 + Math.random() * (W - 200); p.y = 100 + Math.random() * (H - 200)
            const killer = this.state.players.get(s.owner); if (killer) killer.score++
          } else p.hp -= DAMAGE
          break
        }
      }
      if (hit || s.life <= 0 || s.b.x < 0 || s.b.x > W || s.b.y < 0 || s.b.y > H) {
        this.bullets.delete(id); this.state.bullets.delete(id)
      }
    }
  }

  spawnBullet(owner: string, p: P) {
    const b = new Bullet()
    b.x = p.x + Math.cos(p.angle) * (RADIUS + 4); b.y = p.y + Math.sin(p.angle) * (RADIUS + 4)
    b.vx = Math.cos(p.angle) * BULLET_SPEED; b.vy = Math.sin(p.angle) * BULLET_SPEED
    const id = String(this.nextId++)
    this.bullets.set(id, { b, owner, life: BULLET_LIFE })
    this.state.bullets.set(id, b)
  }
}

const server = defineServer({
  rooms: { arena: defineRoom(Arena) },
})

const PORT = Number(process.env.PORT ?? 2567)
server.listen(PORT).then(() => console.log(`colyseus sur ${PORT}`))

// Mesure : GET /stats (tick) sur un petit serveur à part pour ne pas dépendre du routeur.
import http from 'node:http'
http.createServer((_req, res) => {
  const a = stats.ticks; const n = a.length || 1
  const mean = a.reduce((s, v) => s + v, 0) / n
  const sd = Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / n)
  res.setHeader('access-control-allow-origin', '*')
  res.end(JSON.stringify({ n: a.length, mean, sd, max: Math.max(0, ...a), p99: [...a].sort((x, y) => x - y)[Math.floor(n * 0.99)] ?? 0 }))
  stats.ticks = []
}).listen(PORT + 1000)
