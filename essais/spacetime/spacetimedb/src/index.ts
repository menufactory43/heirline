// Essai SpacetimeDB : même règles que l'essai Colyseus.
// Une entrée = un pas de déplacement (reducer `input`), les projectiles avancent dans un reducer planifié à 20 Hz.
import { schema, table, t } from 'spacetimedb/server'
import { ScheduleAt } from 'spacetimedb'

const W = 1600, H = 1000, TICK_HZ = 20, SPEED = 160, RADIUS = 10
const BULLET_SPEED = 520, BULLET_LIFE = 1.0, FIRE_COOLDOWN = 0.15, DAMAGE = 10, MAX_HP = 100
const DT = 1 / TICK_HZ

const player = table({ name: 'player', public: true }, {
  identity: t.identity().primaryKey(),
  x: t.f32(), y: t.f32(), angle: t.f32(),
  hp: t.u8(), score: t.u16(),
  lastSeq: t.u32(),
  cooldown: t.f32(),
})

const bullet = table({ name: 'bullet', public: true }, {
  id: t.u64().primaryKey().autoInc(),
  x: t.f32(), y: t.f32(), vx: t.f32(), vy: t.f32(),
  owner: t.identity(),
  life: t.f32(),
})

const tickStat = table({ name: 'tick_stat', public: true }, {
  id: t.u8().primaryKey(),
  n: t.u32(), sum: t.f64(), sumSq: t.f64(), max: t.f64(), lastMicros: t.i64(),
})

// Variante « par tick » : les entrées attendent dans une table privée et le tick les applique toutes,
// pour n'avoir qu'une transaction (donc un message par client) par tick, comme Colyseus.
const queuedInput = table({ name: 'queued_input' }, {
  id: t.u64().primaryKey().autoInc(),
  owner: t.identity(),
  seq: t.u32(), mx: t.f32(), my: t.f32(), aim: t.f32(), fire: t.bool(),
})

const tickTimer = table({ name: 'tick_timer' }, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
})

const spacetimedb = schema({ player, bullet, tickStat, tickTimer, queuedInput })
export default spacetimedb

function respawn(rnd: () => number) { return { x: 100 + rnd() * (W - 200), y: 100 + rnd() * (H - 200) } }

export const init = spacetimedb.init(ctx => {
  ctx.db.tickTimer.insert({ scheduledId: 0n, scheduledAt: ScheduleAt.interval(BigInt(1_000_000 / TICK_HZ)) })
  ctx.db.tickStat.insert({ id: 0, n: 0, sum: 0, sumSq: 0, max: 0, lastMicros: 0n })
})

export const onConnect = spacetimedb.clientConnected(ctx => {
  const old = ctx.db.player.identity.find(ctx.sender)
  if (old) ctx.db.player.identity.delete(ctx.sender)
  const p = respawn(() => ctx.random())
  ctx.db.player.insert({ identity: ctx.sender, x: p.x, y: p.y, angle: 0, hp: MAX_HP, score: 0, lastSeq: 0, cooldown: 0 })
})

export const onDisconnect = spacetimedb.clientDisconnected(ctx => {
  ctx.db.player.identity.delete(ctx.sender)
})

function applyInput(ctx: any, sender: any, seq: number, mx: number, my: number, aim: number, fire: boolean) {
    const p = ctx.db.player.identity.find(sender)
    if (!p || seq <= p.lastSeq) return
    const l = Math.hypot(mx, my)
    if (l > 1) { mx /= l; my /= l }
    p.x = Math.max(RADIUS, Math.min(W - RADIUS, p.x + mx * SPEED * DT))
    p.y = Math.max(RADIUS, Math.min(H - RADIUS, p.y + my * SPEED * DT))
    p.angle = aim
    p.lastSeq = seq
    p.cooldown -= DT
    if (fire && p.cooldown <= 0) {
      p.cooldown = FIRE_COOLDOWN
      ctx.db.bullet.insert({
        id: 0n,
        x: p.x + Math.cos(aim) * (RADIUS + 4), y: p.y + Math.sin(aim) * (RADIUS + 4),
        vx: Math.cos(aim) * BULLET_SPEED, vy: Math.sin(aim) * BULLET_SPEED,
        owner: sender, life: BULLET_LIFE,
      })
    }
    ctx.db.player.identity.update(p)
}

export const input = spacetimedb.reducer(
  { seq: t.u32(), mx: t.f32(), my: t.f32(), aim: t.f32(), fire: t.bool() },
  (ctx, { seq, mx, my, aim, fire }) => applyInput(ctx, ctx.sender, seq, mx, my, aim, fire)
)

export const inputQueued = spacetimedb.reducer(
  { seq: t.u32(), mx: t.f32(), my: t.f32(), aim: t.f32(), fire: t.bool() },
  (ctx, a) => { ctx.db.queuedInput.insert({ id: 0n, owner: ctx.sender, ...a }) }
)

export const tick = spacetimedb.reducer(
  { onSchedule: tickTimer },
  { timer: tickTimer.rowType },
  (ctx, _args) => {
    // régularité du tick, mesurée avec l'horloge du serveur
    const now = ctx.timestamp.microsSinceUnixEpoch
    const st = ctx.db.tickStat.id.find(0)!
    if (st.lastMicros > 0n) {
      const d = Number(now - st.lastMicros) / 1000
      st.n += 1; st.sum += d; st.sumSq += d * d; if (d > st.max) st.max = d
    }
    st.lastMicros = now
    ctx.db.tickStat.id.update(st)

    for (const q of [...ctx.db.queuedInput.iter()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      applyInput(ctx, q.owner, q.seq, q.mx, q.my, q.aim, q.fire)
      ctx.db.queuedInput.id.delete(q.id)
    }
    const players = [...ctx.db.player.iter()]
    for (const b of ctx.db.bullet.iter()) {
      b.x += b.vx * DT; b.y += b.vy * DT; b.life -= DT
      let hit = false
      for (const p of players) {
        if (p.identity.equals(b.owner)) continue
        if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 < RADIUS * RADIUS) {
          hit = true
          const cur = ctx.db.player.identity.find(p.identity)!
          if (cur.hp <= DAMAGE) {
            const r = respawn(() => ctx.random()); cur.hp = MAX_HP; cur.x = r.x; cur.y = r.y
            const k = ctx.db.player.identity.find(b.owner)
            if (k) { k.score += 1; ctx.db.player.identity.update(k) }
          } else cur.hp -= DAMAGE
          ctx.db.player.identity.update(cur)
          Object.assign(p, cur)
          break
        }
      }
      if (hit || b.life <= 0 || b.x < 0 || b.x > W || b.y < 0 || b.y > H) ctx.db.bullet.id.delete(b.id)
      else ctx.db.bullet.id.update(b)
    }
  }
)

export const resetStats = spacetimedb.reducer(ctx => {
  const st = ctx.db.tickStat.id.find(0)!
  ctx.db.tickStat.id.update({ ...st, n: 0, sum: 0, sumSq: 0, max: 0 })
})
