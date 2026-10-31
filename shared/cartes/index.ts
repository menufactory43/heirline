// La carte de chaque salle du graphe du monde (générée une fois par processus, identique partout).
import { generateWorld, SECTOR_SEED, type GameMap } from '../map.ts'
import { generateConstance } from './constance.ts'
import { generateNid } from './nid.ts'
import { generateDonjon } from './donjon.ts'
import type { CarteId } from '../monde.ts'

const cache = new Map<CarteId, GameMap>()
export function carteMap(id: CarteId): GameMap {
  let m = cache.get(id)
  if (!m) {
    m = id === 'constance' ? generateConstance() : id === 'nid' ? generateNid() : id === 'antre' || id === 'antre_h' ? generateDonjon(id, 'vase') : id === 'semeur' ? generateDonjon(id, 'chair', 233) : id === 'gueule' || id === 'gueule_h' ? generateDonjon(id, 'chair', 131) : id === 'serre' || id === 'serre_h' ? generateDonjon(id, 'serre', 271) : id === 'metier_raid' ? generateDonjon(id, 'metier', 353) : id === 'registre' || id === 'registre_h' ? generateDonjon(id, 'registre', 307) : generateWorld(SECTOR_SEED)
    cache.set(id, m)
  }
  return m
}
