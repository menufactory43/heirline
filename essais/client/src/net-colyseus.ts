// Réseau Colyseus 0.18 : prédiction et interpolation fournies par le SDK.
import { Client } from '@colyseus/sdk'
import { Predict } from '@colyseus/sdk/predict'
import { moveStep } from '../../commun/sim'
import type { Net, Inp, Ent } from './net'

export async function connectColyseus(url: string): Promise<Net> {
  const client = new Client(url)
  const room: any = await client.joinOrCreate('arena')
  const predict: any = Predict.get(room, { mode: 'lerp', delay: 100 })
  predict.attachAll('players', { fields: ['x', 'y'] })
  predict.attachAll('bullets', { fields: ['x', 'y'] })
  const input: any = room.input({ mode: 'reliable' })
  let me: any = null
  const sentAt = new Map<number, number>()
  let sent = 0, ack = 0

  return {
    name: 'Colyseus 0.18',
    frame(now: number, inp: Inp) {
      if (!me) {
        const self = room.state.players?.get(room.sessionId)
        if (self) {
          me = predict.reconciler(self, {
            input, fields: ['x', 'y'],
            step: (ctx: any, state: any, cmd: any) => moveStep(state, cmd.mx, cmd.my, ctx.dt),
          })
        }
      }
      const n = predict.tick(now)
      for (let i = 0; i < n; i++) {
        input.data.mx = inp.mx; input.data.my = inp.my; input.data.aim = inp.aim; input.data.fire = inp.fire
        input.send(); sent = input.sentCount; sentAt.set(sent, now)
      }
      const lp = input.lastProcessed as number | undefined
      if (lp && sentAt.has(lp)) { const d = now - sentAt.get(lp)!; ack = ack ? ack * 0.9 + d * 0.1 : d; for (const k of sentAt.keys()) if (k <= lp) sentAt.delete(k) }
    },
    players() {
      const out: Ent[] = []
      room.state.players?.forEach((p: any, id: string) => out.push({
        id, x: predict.value(p, 'x'), y: predict.value(p, 'y'), angle: p.angle, hp: p.hp, score: p.score, me: id === room.sessionId,
      }))
      return out
    },
    bullets() {
      const out: { id: string; x: number; y: number }[] = []
      room.state.bullets?.forEach((b: any, id: string) => out.push({ id, x: predict.value(b, 'x'), y: predict.value(b, 'y') }))
      return out
    },
    ackMs: () => ack,
  }
}
