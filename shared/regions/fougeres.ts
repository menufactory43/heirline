// La forêt des Fougères, à l'ouest : le Poste de la Fougère, Haute-Sève (le village des Fertiles),
// la Clairière aux Spores, la Source Noire. Des fougères géantes, des Fougerôdes, une rivière à passer à gué.
import { T } from '../tiles.ts'
import type { RegionDef } from './types.ts'

export const FOUGERES: RegionDef = {
  id: 'foret', nom: 'Forêt des Fougères', niveau: [4, 8], couleur: '#3f7a4a',
  centre: [72, 238], poids: 1,
  sol: T.MOUSSE, amas: T.ROC, seuil: 0.68,
  arbres: 0.075, arbreV: [0, 1],
  camps: [[[13], 6, 3], [[7], 9, 4], [[6, 7], 4, 4], [[0, 1], 4, 4]],
  noeuds: [['herbe', 28], ['champignon', 8]],
  lieux: [
    { id: 'fougere', nom: 'Poste de la Fougère', x0: 64, y0: 206, x1: 86, y1: 224, habite: true, decale: [-82, 156] },
    { id: 'hauteseve', nom: 'Haute-Sève', x0: 37, y0: 264, x1: 63, y1: 286, habite: true, decale: [-129, 126] },
  ],
  pois: [
    { id: 'clairiere', nom: 'La Clairière aux Spores', x: 112, y: 238, r: 6 },
    // là où naît la Claire, au pied des falaises
    { id: 'source', nom: 'La Source Noire', x: 118, y: 176, r: 6 },
  ],
}
