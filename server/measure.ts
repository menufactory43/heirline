// La passe des bots : avant qu'une concession soit publiée, deux soldats IA la jouent sans réseau, en accéléré.
// Ce qu'ils mesurent (victoire, durée, dégâts subis) fixe la récompense, jamais le créateur.
import { World } from './world/World.ts'
import { BotBrain } from './world/bots.ts'
import { concessionMap } from '../shared/concessionMap.ts'
import { DT } from '../shared/consts.ts'
import type { Concession } from '../shared/bricks.ts'

export function measureConcession(c: Concession, maxS = 240) {
  const map = concessionMap(c)
  let gagne = false
  const w = new World({ mode: 'concession', map, concession: c }, { fx() {}, log() {}, victory() { gagne = true } })
  const equipe: ['fantassin' | 'medic' | 'ingenieur', number][] = [['fantassin', 6], ['medic', 6]]
  equipe.forEach(([cls, level], i) => {
    const b = new BotBrain(); b.hunt = true
    const p = w.addPlayer({ sid: 'mesure' + i, account: '', soldierId: 0, given: 'Mesure', family: 'IA', generation: 1, cls, level, xp: 0, bot: b })
    w.giveRobot(p, 3)
  })
  let t = 0
  const t0 = performance.now()
  while (t < maxS && !gagne) { w.step(DT); t += DT }
  const degatsSubis = [...w.players.values()].reduce((s, p) => s + p.degatsSubis, 0)
  return { gagne, dureeS: Math.round(t), degatsSubis, tues: w.stats.kills, calculMs: Math.round(performance.now() - t0) }
}
