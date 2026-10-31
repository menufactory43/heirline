// Le Cimetière des Machines, au nord-ouest : l'épave de la Constance (le vaisseau de la Première Vague,
// écrasé), les carcasses des drones devenus Rouillards, la Casse des Ferrailleurs, le camp de l'Épave et Cantor.
import { T } from '../tiles.ts'
import type { RegionDef } from './types.ts'

export const CIMETIERE: RegionDef = {
  id: 'cimetiere', nom: 'Cimetière des Machines', niveau: [12, 16], couleur: '#7a6a5a',
  centre: [80, 92], poids: 1,
  sol: T.FERRAILLE, amas: T.ROC, seuil: 0.66, variantes: [[T.SOL, 0.25]],
  arbres: 0, arbreV: [2],
  camps: [[[10], 10, 3], [[11, 0], 5, 4], [[2, 1], 4, 4]],
  noeuds: [['pieces', 24]],
  lieux: [
    { id: 'epave', nom: 'Épave de la Constance', x0: 54, y0: 66, x1: 108, y1: 94 },
    { id: 'campepave', nom: "Camp de l'Épave", x0: 86, y0: 100, x1: 106, y1: 116, habite: true },
    { id: 'casse', nom: 'La Casse', x0: 125, y0: 60, x1: 150, y1: 81, habite: true, decale: [-136, 32] },
  ],
  pois: [
    { id: 'champ_epaves', nom: 'Le Champ des Carcasses', x: 46, y: 124, r: 8 },
  ],
}
