// Réseau SpacetimeDB : la plateforme ne fournit ni prédiction ni interpolation, tout est écrit ici à la main.
import { DbConnection } from './stdb'
import { moveStep, TICK_HZ } from '../../commun/sim'
import type { Net, Inp, Ent } from './net'

const DELAY = 100 // ms de retard d'affichage des autres, comme le lerp de Colyseus
interface Snap { t: number; x: number; y: number }

export function connectStdb(uri: string, queued = false): Promise<Net> {
  return new Promise((resolve, reject) => {
    const conn = DbConnection.builder()
      .withUri(uri).withDatabaseName('heirline-essai')
      .onConnect((c, identity) => {
        const myHex = identity.toHexString()
        const hist = new Map<string, Snap[]>()
        const bullets = new Map<string, { t: number; x: number; y: number; vx: number; vy: number }>()
        const pending: { seq: number; mx: number; my: number; t: number }[] = []
        const pred = { x: 0, y: 0 }; let have = false
        let err = { x: 0, y: 0 }
        let seq = 0, acc = 0, last = 0, ack = 0

        const onPlayer = (row: any) => {
          const id = row.identity.toHexString(), now = performance.now()
          if (id === myHex) {
            // réconciliation : repartir de la vérité du serveur, rejouer les entrées pas encore confirmées
            const before = { x: pred.x + err.x, y: pred.y + err.y }
            while (pending.length && pending[0].seq <= row.lastSeq) {
              const p = pending.shift()!
              if (p.seq === row.lastSeq) { const d = now - p.t; ack = ack ? ack * 0.9 + d * 0.1 : d }
            }
            pred.x = row.x; pred.y = row.y
            for (const p of pending) moveStep(pred, p.mx, p.my, 1 / TICK_HZ)
            if (have) err = { x: before.x - pred.x, y: before.y - pred.y }
            have = true
          }
          const h = hist.get(id) ?? []; h.push({ t: now, x: row.x, y: row.y }); if (h.length > 20) h.shift(); hist.set(id, h)
        }
        c.db.player.onInsert((_ctx, r) => onPlayer(r))
        c.db.player.onUpdate((_ctx, _o, r) => onPlayer(r))
        c.db.player.onDelete((_ctx, r) => hist.delete(r.identity.toHexString()))
        c.db.bullet.onInsert((_ctx, b) => bullets.set(String(b.id), { t: performance.now(), x: b.x, y: b.y, vx: b.vx, vy: b.vy }))
        c.db.bullet.onUpdate((_ctx, _o, b) => bullets.set(String(b.id), { t: performance.now(), x: b.x, y: b.y, vx: b.vx, vy: b.vy }))
        c.db.bullet.onDelete((_ctx, b) => bullets.delete(String(b.id)))

        c.subscriptionBuilder().onApplied(() => resolve(net)).subscribe(['SELECT * FROM player', 'SELECT * FROM bullet'])

        const net: Net = {
          name: queued ? 'SpacetimeDB 2.13 (par tick)' : 'SpacetimeDB 2.13 (immédiat)',
          frame(now: number, inp: Inp) {
            if (!last) last = now
            acc += now - last; last = now
            const step = 1000 / TICK_HZ
            if (acc > step * 5) acc = step
            while (acc >= step) {
              acc -= step; seq++
              ;(queued ? c.reducers.inputQueued : c.reducers.input)({ seq, mx: inp.mx, my: inp.my, aim: inp.aim, fire: inp.fire })
              pending.push({ seq, mx: inp.mx, my: inp.my, t: now })
              if (have) moveStep(pred, inp.mx, inp.my, 1 / TICK_HZ)
            }
            // l'erreur de prédiction se résorbe en douceur
            err.x *= 0.85; err.y *= 0.85
          },
          players(now: number) {
            const out: Ent[] = []
            for (const row of c.db.player.iter()) {
              const id = row.identity.toHexString(), me = id === myHex
              let x = row.x, y = row.y
              if (me && have) { x = pred.x + err.x; y = pred.y + err.y }
              else {
                const h = hist.get(id); const tt = now - DELAY
                if (h && h.length > 1) {
                  let i = h.length - 1; while (i > 0 && h[i - 1].t > tt) i--
                  const a = h[Math.max(0, i - 1)], b = h[i]
                  const k = b.t === a.t ? 1 : Math.max(0, Math.min(1, (tt - a.t) / (b.t - a.t)))
                  x = a.x + (b.x - a.x) * k; y = a.y + (b.y - a.y) * k
                }
              }
              out.push({ id, x, y, angle: row.angle, hp: row.hp, score: row.score, me })
            }
            return out
          },
          bullets(now: number) {
            const out: { id: string; x: number; y: number }[] = []
            for (const [id, b] of bullets) { const d = (now - b.t) / 1000 - DELAY / 1000; out.push({ id, x: b.x + b.vx * d, y: b.y + b.vy * d }) }
            return out
          },
          ackMs: () => ack,
        }
      })
      .onConnectError((_c, e) => reject(e))
      .build()
    void conn
  })
}
