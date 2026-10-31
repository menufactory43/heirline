// Les Hauts de Glane (campagne 2) : le massif à l'est d'Ossara, de l'autre côté du détroit, où la Glaneuse tisse son
// Métier. Quatre régions, de la Lisière (au bout de l'isthme et autour de Relâche) au Haut-Métier (les mâts de relais).
// Coordonnées en tuiles du continent (x ≥ 400) ; les lieux posés à la main n'ont pas de décalage.
import { T } from '../tiles.ts'
import type { RegionDef } from './types.ts'

// les créatures des Hauts (E de shared/rules.ts, en chiffres : rules.ts importe les régions)
const GLANEUR = 17, RETOURNE = 18, BOURGEON = 19, BOUTURE = 20, FILEUSE = 28

export const LISIERE: RegionDef = {
  id: 'lisiere', nom: 'La Lisière', niveau: [20, 24], couleur: '#8a9a6a',
  centre: [452, 205], poids: 1.15,
  sol: T.HERBE, amas: T.ROC, seuil: 0.66, variantes: [[T.SOL, 0.18], [T.FERRAILLE, 0.03]],
  arbres: 0.006, arbreV: [2],
  camps: [[[GLANEUR], 9, 4], [[RETOURNE], 5, 3], [[GLANEUR, RETOURNE], 5, 4]],
  noeuds: [['herbe', 10], ['pieces', 8]],
  lieux: [
    { id: 'relache', nom: 'Relâche', x0: 458, y0: 262, x1: 494, y1: 292, habite: true },
    { id: 'gue_glane', nom: 'Le Gué de Glane', x0: 438, y0: 90, x1: 458, y1: 108, habite: true },
  ],
  pois: [
    { id: 'greves', nom: 'Les Grèves de rouille', x: 430, y: 240, r: 8 },
    { id: 'lande_vent', nom: 'La lande au vent', x: 470, y: 160, r: 9 },
  ],
}

export const CHAMPS_FER: RegionDef = {
  id: 'champs', nom: 'Les Champs de Fer', niveau: [24, 29], couleur: '#8a7a6a',
  centre: [538, 170], poids: 1,
  sol: T.FERRAILLE, amas: T.METAL, seuil: 0.7, variantes: [[T.SOL, 0.3]],
  arbres: 0, arbreV: [2],
  camps: [[[RETOURNE], 8, 4], [[GLANEUR, RETOURNE], 7, 5], [[BOUTURE], 3, 3]],
  noeuds: [['pieces', 22]],
  lieux: [
    { id: 'sillon', nom: 'Le Sillon', x0: 520, y0: 196, x1: 534, y1: 208, habite: true },
  ],
  pois: [
    { id: 'sillons', nom: 'Les sillons de robots', x: 560, y: 150, r: 12 },
    { id: 'robot_cassette', nom: 'Un robot assis', x: 506, y: 176, r: 3 },
  ],
}

export const PEPINIERE: RegionDef = {
  id: 'pepiniere', nom: 'La Pépinière', niveau: [27, 32], couleur: '#5a9a5a',
  centre: [590, 262], poids: 0.95,
  sol: T.MOUSSE, amas: T.RACINE, seuil: 0.7, variantes: [[T.CHAIRSOL, 0.06]],
  arbres: 0.05, arbreV: [0, 1, 4],
  camps: [[[BOURGEON], 8, 3], [[BOUTURE], 6, 3], [[BOURGEON, BOUTURE], 6, 4]],
  noeuds: [['herbe', 16], ['champignon', 10]],
  lieux: [
    { id: 'serres', nom: 'Les Serres', x0: 586, y0: 244, x1: 606, y1: 260 },
  ],
  pois: [
    { id: 'verriere', nom: 'La grande verrière', x: 612, y: 232, r: 8 },
  ],
}

export const HAUT_METIER: RegionDef = {
  id: 'metier', nom: 'Le Haut-Métier', niveau: [30, 35], couleur: '#7a6a9a',
  centre: [548, 58], poids: 1,
  sol: T.SOL, amas: T.ROC, seuil: 0.62, variantes: [[T.FERRAILLE, 0.1], [T.CHAIRSOL, 0.04]],
  arbres: 0.002, arbreV: [2],
  camps: [[[FILEUSE], 7, 4], [[RETOURNE, FILEUSE], 7, 5], [[BOUTURE, GLANEUR], 6, 5]],
  noeuds: [['pieces', 14]],
  lieux: [
    { id: 'mat', nom: 'Le Mât de relais', x0: 540, y0: 70, x1: 556, y1: 84 },
  ],
  pois: [
    { id: 'mat_grave', nom: 'Le mât gravé', x: 520, y: 46, r: 4 },
    { id: 'metier_vue', nom: 'Le Métier', x: 566, y: 34, r: 10 },
  ],
}

export const HAUTS: RegionDef[] = [LISIERE, CHAMPS_FER, PEPINIERE, HAUT_METIER]
