// Le réseau : Colyseus 0.18, prédiction du soldat local et réconciliation, interpolation des autres.
import { Client, type Room } from '@colyseus/sdk'
import { Predict } from '@colyseus/sdk/predict'
import { applyMove, vitesseSoldat } from '../../shared/rules.ts'
import type { GameMap } from '../../shared/map.ts'

export interface Cmd { mx: number; my: number; aim: number; fire: boolean }

export class Net {
  client = new Client(location.origin)
  room!: Room<any>
  predict: any
  input: any
  me: any = null
  map!: GameMap
  handlers = new Map<string, (m: any) => void>()
  ping = 0
  kind: 'secteur' | 'concession' = 'secteur'
  pingTimer: any = null
  meObj: any = null
  dashNext = false
  /** une borne de plus pour la prédiction (l'arène fermée du nid) */
  clamp: ((s: { x: number; y: number }) => void) | null = null

  /** Rejoindre un salon : 'secteur' (le continent, l'épave), 'nid' (une instance) ou 'concession'. */
  async join(salon: 'secteur' | 'nid' | 'concession', opts: any, map: GameMap) {
    this.kind = salon === 'concession' ? 'concession' : 'secteur'
    this.map = map
    this.me = null
    this.meObj = null
    this.room = await this.client.joinOrCreate(salon, opts)
    this.predict = Predict.get(this.room, { mode: 'lerp', delay: 100 })
    this.predict.attachAll('players', { fields: ['x', 'y'] })
    this.predict.attachAll('robots', { fields: ['x', 'y'] })
    this.predict.attachAll('enemies', { fields: ['x', 'y'] })
    this.predict.attachAll('npcs', { fields: ['x', 'y'] })
    this.input = this.room.input({ mode: 'reliable' })
    for (const [type, fn] of this.handlers) this.room.onMessage(type, fn)
    this.room.onMessage('pong', (t: number) => { this.ping = this.ping ? this.ping * 0.8 + (performance.now() - t) * 0.2 : performance.now() - t })
    clearInterval(this.pingTimer)
    this.pingTimer = setInterval(() => { try { this.room.send('ping', performance.now()) } catch { /* salle quittée */ } }, 2000)
    return this.room
  }

  on(type: string, fn: (m: any) => void) { this.handlers.set(type, fn); if (this.room) this.room.onMessage(type, fn) }

  async leave() { try { await this.room.leave(true) } catch { /* déjà parti */ } }

  self() { return this.room?.state?.players?.get(this.room.sessionId) }

  /** Un tour de boucle : envoie les entrées au rythme fixe, et branche la prédiction sur notre soldat. */
  frame(now: number, cmd: Cmd) {
    if (!this.room) return
    const cur = this.self()
    if (cur !== this.meObj) { this.me = null; this.meObj = cur }
    if (!this.me) {
      const self = cur
      if (self) {
        this.me = this.predict.reconciler(self, {
          input: this.input, fields: ['x', 'y', 'dashT', 'dashCd', 'dvx', 'dvy'],
          // la même fonction que le serveur : marche et ruée prédites ensemble
          step: (ctx: any, state: any, c: any) => {
            const s = this.self()
            if (!s || s.etat !== 0 || s.rame) return
            applyMove(state, c, ctx.dt, vitesseSoldat(s), this.map, s.esq ?? 0)
            this.clamp?.(state)
          },
        })
      }
    }
    const n = this.predict.tick(now)
    for (let i = 0; i < n; i++) {
      this.input.data.mx = cmd.mx; this.input.data.my = cmd.my; this.input.data.aim = cmd.aim; this.input.data.fire = cmd.fire
      this.input.data.dash = this.dashNext
      this.dashNext = false
      this.input.send()
    }
  }

  /** La ruée part avec la prochaine entrée : prédite tout de suite, confirmée par le serveur. */
  dash() { this.dashNext = true }

  value(obj: any, f: 'x' | 'y') { return this.predict ? this.predict.value(obj, f) : obj[f] }
}
