// Ce qu'une région d'Ossara décrit : son terrain (lu par le générateur), ses bêtes, ses ressources,
// et le contenu posé à la main (lieux habités, points d'intérêt, stations du monorail, passages).
// Toutes les coordonnées sont en tuiles, sur le continent (400 × 400).

export type NoeudType = 'herbe' | 'noyau' | 'pieces' | 'champignon' | 'echantillon'

export interface LieuDef {
  /** identifiant stable : les quêtes, les PNJ et la base s'y réfèrent */
  id: string
  nom: string
  /** rectangle du lieu */
  x0: number; y0: number; x1: number; y1: number
  /** un lieu habité tient : la biomasse n'y compte pas (les palissades et les gardes) */
  habite?: boolean
  /**
   * décalage appliqué au contenu posé à la main pour ce lieu (bâtiments, habitants) : ce contenu garde
   * les coordonnées de son premier dessin, et le lieu le place où il est sur le continent
   */
  decale?: [number, number]
}

export interface PoiDef { id: string; nom: string; x: number; y: number; r: number }

export interface RegionDef {
  id: string
  nom: string
  /** niveau des créatures, du bord proche de Port-Ancre au cœur de la région */
  niveau: [number, number]
  couleur: string
  /** centre et poids : chaque tuile appartient à la région dont le centre (pondéré, bruité) est le plus proche */
  centre: [number, number]
  poids: number
  /** le sol, les amas (roche, eau, chair…) et leur seuil de bruit (plus haut = plus rares) */
  sol: number; amas: number; seuil: number
  /** remplacements du sol, au hasard : [tuile, probabilité] */
  variantes?: [number, number][]
  /** densité d'arbres et variantes d'image */
  arbres: number; arbreV: number[]
  /** camps de créatures : [types (indices d'ENEMIES), nombre de camps, taille] */
  camps: [number[], number, number][]
  noeuds: [NoeudType, number][]
  lieux: LieuDef[]
  pois: PoiDef[]
}
