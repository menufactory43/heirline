// Les terres d'ÉDEN, au nord-est : la chair a remplacé le sol. Les ruches y sont nées ; la principale garde
// l'entrée du nid. Le Jardin Parfait, où ÉDEN fait pousser ce qu'il croit être un monde pour des humains.
import { T } from '../tiles.ts'
import type { RegionDef } from './types.ts'

export const EDEN: RegionDef = {
  id: 'eden', nom: "Terres d'ÉDEN", niveau: [16, 20], couleur: '#8b2f80',
  centre: [322, 90], poids: 1,
  sol: T.CHAIRSOL, amas: T.CHAIR, seuil: 0.62,
  arbres: 0.018, arbreV: [4],
  camps: [[[0, 1, 2], 8, 5], [[11, 2], 6, 4], [[1, 11], 5, 4]],
  noeuds: [['pieces', 6]],
  lieux: [
    { id: 'gueule', nom: 'La Gueule du nid', x0: 322, y0: 64, x1: 338, y1: 80 },
  ],
  pois: [
    { id: 'jardin', nom: 'Le Jardin Parfait', x: 352, y: 124, r: 8 },
  ],
}
