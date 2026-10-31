// Les plaines de la côte : Port-Ancre et son port, la ferme des Aldo, le hameau de pêcheurs d'Anse-Grise,
// le Tertre des Colons. Des herbes, des bêtes qui broutent, des Rôdeurs la nuit.
import { T } from '../tiles.ts'
import type { RegionDef } from './types.ts'

export const PLAINES: RegionDef = {
  id: 'plaines', nom: 'Plaines de la côte', niveau: [1, 4], couleur: '#8b864a',
  centre: [200, 292], poids: 1.05,
  sol: T.HERBE, amas: T.ROC, seuil: 0.72, variantes: [[T.SOL, 0.12]],
  arbres: 0.008, arbreV: [2],
  camps: [[[5], 8, 4], [[6], 6, 3], [[13], 5, 3], [[0], 3, 4]],
  noeuds: [['herbe', 12]],
  lieux: [
    { id: 'port', nom: 'Port-Ancre', x0: 168, y0: 282, x1: 231, y1: 333, habite: true, decale: [160, 208] },
    { id: 'ferme', nom: 'Ferme des Aldo', x0: 123, y0: 282, x1: 153, y1: 302, habite: true, decale: [45, 206] },
    { id: 'anse', nom: 'Anse-Grise', x0: 238, y0: 334, x1: 262, y1: 350, habite: true },
  ],
  pois: [
    { id: 'tertre', nom: 'Le Tertre des Colons', x: 150, y: 255, r: 6 },
  ],
}
