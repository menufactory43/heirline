// Une concession : une instance séparée, construite par l'agent IA d'un joueur. Jamais de mort définitive ici.
// Chaque salle joue UNE version : ceux qui sont dedans la finissent, la nouvelle vaut à la prochaine entrée.
import type { Client } from 'colyseus'
import { World } from '../world/World.ts'
import { GameRoom } from './GameRoom.ts'
import { concessionMap } from '../../shared/concessionMap.ts'
import { LIMITS, type Concession } from '../../shared/bricks.ts'
import { db } from '../db.ts'

export class ConcessionRoom extends GameRoom {
  maxClients = 8
  cid = ''
  version = 0
  reward = { ferraille: 0, xp: 0 }

  onCreate(options: { cid: string; version: number }) {
    const row = db().concessionVersion(String(options.cid), Number(options.version))
    if (!row) throw new Error('concession introuvable')
    this.cid = options.cid; this.version = Number(options.version)
    const c = JSON.parse(row.json) as Concession
    this.reward = JSON.parse(row.reward_json)
    this.setMetadata({ cid: this.cid, version: this.version, nom: c.nom })
    const world = new World({ mode: 'concession', map: concessionMap(c), concession: c }, {
      fx: (x, y, ev) => this.fxHook(x, y, ev),
      log: (t, col) => this.logHook(t, col),
      victory: () => this.victory(),
    })
    this.setupWorld(world)
    if (c.textes.intro) this.clock.setTimeout(() => this.logHook(c.textes.intro!, '#c9d1d9'), 800)
  }

  onAuth(_client: Client, options: any) {
    const { account, soldier } = GameRoom.authenticate(options)
    if (!soldier) throw new Error('il faut un soldat vivant')
    return { account, soldier }
  }

  onJoin(client: Client, _o: any, auth: any) {
    this.addClientPlayer(client, auth.account, auth.soldier)
    db().countPlay(this.cid)
    client.send('concession', { cid: this.cid, version: this.version, reward: this.reward })
  }

  onLeave(client: Client) {
    const p = this.world.players.get(client.sessionId)
    if (p) { this.saveSoldier(p); this.world.removePlayer(client.sessionId) }
    this.data.delete(client.sessionId)
  }

  victory() {
    for (const c of this.clients) {
      const p = this.world.players.get(c.sessionId)
      if (!p) continue
      const ferraille = db().concessionLoot(p.account, this.reward.ferraille, LIMITS.plafondJour)
      this.world.giveXp(p, this.reward.xp, 0)
      this.saveSoldier(p)
      c.send('fin', { ferraille, xp: this.reward.xp, plafond: LIMITS.plafondJour, plafonne: ferraille < this.reward.ferraille })
    }
  }
}
