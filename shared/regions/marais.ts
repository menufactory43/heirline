// Le marais de la Sève, à l'est de Port-Ancre, au-delà de la rivière : le Poste du Marais, les balises noyées,
// l'antre de l'Engloutisseur près de la côte. Boue, mares, sangsues, et une ruche qui remonte de l'est.
import { T } from '../tiles.ts'
import type { RegionDef } from './types.ts'

export const MARAIS: RegionDef = {
  id: 'marais', nom: 'Marais de la Sève', niveau: [8, 12], couleur: '#4d6a5a',
  centre: [328, 262], poids: 1,
  sol: T.BOUE, amas: T.EAU, seuil: 0.55, variantes: [[T.MARE, 0.06]],
  arbres: 0.02, arbreV: [3],
  camps: [[[8], 9, 4], [[9, 8], 5, 3], [[1, 0], 5, 4]],
  noeuds: [['champignon', 18]],
  lieux: [
    { id: 'postemarais', nom: 'Poste du Marais', x0: 310, y0: 272, x1: 327, y1: 287, habite: true, decale: [89, 156] },
  ],
  pois: [
    { id: 'antre', nom: "L'antre de l'Engloutisseur", x: 348, y: 312, r: 9 },
  ],
}
