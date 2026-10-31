// Les plateaux rocheux, au nord de Port-Ancre : un massif cerné de falaises qu'on ne franchit que par les cols.
// Le Relais du Col, la Mine, les Ruines de la Première Vague, et le Bastion face à ÉDEN.
import { T } from '../tiles.ts'
import type { RegionDef } from './types.ts'

export const PLATEAUX: RegionDef = {
  id: 'plateaux', nom: 'Plateaux de Basalte', niveau: [10, 14], couleur: '#7a7466',
  centre: [196, 145], poids: 1.08,
  sol: T.SOL, amas: T.ROC, seuil: 0.6, variantes: [[T.HERBE, 0.08]],
  arbres: 0.004, arbreV: [2],
  camps: [[[6], 6, 4], [[10], 4, 3], [[2, 1], 4, 4], [[13], 3, 3]],
  noeuds: [['pieces', 8], ['herbe', 6]],
  lieux: [
    { id: 'relais', nom: 'Relais du Col', x0: 190, y0: 207, x1: 210, y1: 221, habite: true },
    { id: 'mine', nom: 'La Mine', x0: 140, y0: 130, x1: 160, y1: 146, habite: true },
    { id: 'ruines', nom: 'Ruines de la Première Vague', x0: 205, y0: 110, x1: 229, y1: 134, decale: [-117, -18] },
    { id: 'bastion', nom: 'Bastion de la Colonie', x0: 256, y0: 152, x1: 277, y1: 170, habite: true },
  ],
  pois: [],
}
