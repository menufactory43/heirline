// Le graphe du monde : les cartes (le continent et les cartes reliées), les passages qui les relient,
// les stations du monorail, et la version du monde (pour migrer les données quand la carte change).
// Chaque carte est un salon Colyseus ; une carte pleine en ouvre une copie (seuil réglable).
// Tous les identifiants sont stables : la base, les quêtes et les agents s'y réfèrent.

/** Version du monde : 1 = la bande de 480 × 200 et son front en bandes ; 2 = le continent, les ruches, les cartes reliées. */
export const WORLD_VERSION = 2

export type CarteId = 'ossara' | 'constance' | 'nid' | 'antre' | 'antre_h' | 'gueule' | 'gueule_h' | 'semeur' | 'serre' | 'serre_h' | 'registre' | 'registre_h' | 'metier_raid'
/** le boss d'une arène (une instance qui finit en arène de paysage) */
export type ProfilArene = 'couveuse' | 'engloutisseur' | 'gueule' | 'semeur' | 'pepiniere' | 'greffier' | 'glaneuse'

export interface CarteDef {
  id: CarteId; nom: string
  /** le type de salon Colyseus qui la sert */
  salon: 'secteur' | 'nid'
  /** joueurs par copie : au-delà, une copie de plus s'ouvre */
  seuil: number
  /** une carte d'instance : chaque groupe a sa copie (le nid) */
  instance?: boolean
  /** une instance qui finit en arène : son boss, l'héroïque (ouverte après une victoire), le niveau prévu */
  arene?: { profil: ProfilArene; heroique: boolean; niveau: number; normale?: CarteId }
  /** un raid : dix soldats (des IA complètent, avec des rôles), niveau minimum pour entrer */
  raid?: { joueurs: number; niveauMin: number }
}

const env = (k: string, d: number) => Number((globalThis as any).process?.env?.[k] ?? d)
/** la taille d'un groupe de donjon : l'instance accueille tout le groupe ; les soldats IA ne complètent que jusqu'à 4 */
export const DONJON_GROUPE = 5
export const CARTES: Record<CarteId, CarteDef> = {
  ossara: { id: 'ossara', nom: "Ossara, le continent", salon: 'secteur', seuil: env('HEIRLINE_COPIE_MAX', 200) },
  constance: { id: 'constance', nom: 'Épave de la Constance', salon: 'secteur', seuil: env('HEIRLINE_COPIE_MAX', 200) },
  nid: { id: 'nid', nom: 'Le nid', salon: 'nid', seuil: DONJON_GROUPE, instance: true, arene: { profil: 'couveuse', heroique: false, niveau: 16 } },
  // les donjons : un parcours en lacets, puis l'arène ; l'héroïque s'ouvre après une victoire en normal
  antre: { id: 'antre', nom: "L'Antre de l'Engloutisseur", salon: 'nid', seuil: DONJON_GROUPE, instance: true, arene: { profil: 'engloutisseur', heroique: false, niveau: 13 } },
  antre_h: { id: 'antre_h', nom: "L'Antre de l'Engloutisseur (héroïque)", salon: 'nid', seuil: DONJON_GROUPE, instance: true, arene: { profil: 'engloutisseur', heroique: true, niveau: 18, normale: 'antre' } },
  gueule: { id: 'gueule', nom: 'Le Gosier', salon: 'nid', seuil: DONJON_GROUPE, instance: true, arene: { profil: 'gueule', heroique: false, niveau: 19 } },
  semeur: { id: 'semeur', nom: "L'offensive du Semeur", salon: 'nid', seuil: 10, instance: true, raid: { joueurs: 10, niveauMin: 18 }, arene: { profil: 'semeur', heroique: false, niveau: 20 } },
  gueule_h: { id: 'gueule_h', nom: 'Le Gosier (héroïque)', salon: 'nid', seuil: DONJON_GROUPE, instance: true, arene: { profil: 'gueule', heroique: true, niveau: 24, normale: 'gueule' } },
  // les Hauts de Glane (campagne 2) : la Serre de la Pépinière, le Registre du Greffier sous le Mât de relais
  serre: { id: 'serre', nom: 'La Serre', salon: 'nid', seuil: DONJON_GROUPE, instance: true, arene: { profil: 'pepiniere', heroique: false, niveau: 27 } },
  serre_h: { id: 'serre_h', nom: 'La Serre (héroïque)', salon: 'nid', seuil: DONJON_GROUPE, instance: true, arene: { profil: 'pepiniere', heroique: true, niveau: 32, normale: 'serre' } },
  registre: { id: 'registre', nom: 'Le Registre', salon: 'nid', seuil: DONJON_GROUPE, instance: true, arene: { profil: 'greffier', heroique: false, niveau: 30 } },
  // le raid de la campagne 2 : l'assaut du Métier, contre la Glaneuse, à dix
  metier_raid: { id: 'metier_raid', nom: "L'assaut du Métier", salon: 'nid', seuil: 10, instance: true, raid: { joueurs: 10, niveauMin: 30 }, arene: { profil: 'glaneuse', heroique: false, niveau: 33 } },
  registre_h: { id: 'registre_h', nom: 'Le Registre (héroïque)', salon: 'nid', seuil: DONJON_GROUPE, instance: true, arene: { profil: 'greffier', heroique: true, niveau: 35, normale: 'registre' } },
}
/** les cartes qui sont des donjons (pas le nid) */
export const DONJONS: CarteId[] = ['antre', 'antre_h', 'gueule', 'gueule_h', 'serre', 'serre_h', 'registre', 'registre_h']
export const CARTE_IDS = Object.keys(CARTES) as CarteId[]
export function isCarte(c: unknown): c is CarteId { return typeof c === 'string' && c in CARTES }

/** Un passage : en marchant dessus, on passe sur une autre carte, au passage d'arrivée. Tuiles. */
export interface Passage {
  id: string; nom: string; carte: CarteId
  x: number; y: number
  vers: CarteId; arrivee: string
  /** de quel côté on ressort en arrivant ici (tuiles) */
  sortie: [number, number]
}
export const PASSAGES: Passage[] = [
  { id: 'sas_constance', nom: 'Sas de la Constance', carte: 'ossara', x: 84, y: 90, vers: 'constance', arrivee: 'constance_sas', sortie: [0, 3] },
  { id: 'constance_sas', nom: 'Sortie vers le Cimetière', carte: 'constance', x: 6, y: 40, vers: 'ossara', arrivee: 'sas_constance', sortie: [3, 0] },
  { id: 'gueule_nid', nom: 'La Gueule du nid', carte: 'ossara', x: 330, y: 76, vers: 'nid', arrivee: 'nid_sortie', sortie: [0, 4] },
  { id: 'nid_sortie', nom: 'Sortie du nid', carte: 'nid', x: 4, y: 21, vers: 'ossara', arrivee: 'gueule_nid', sortie: [3, 0] },
  // l'Antre, au fond des marais (là où l'Engloutisseur rôdait), et le Gosier, sous la Grande Ruche
  { id: 'antre_entree', nom: "L'Antre de l'Engloutisseur", carte: 'ossara', x: 330, y: 338, vers: 'antre', arrivee: 'antre_sortie', sortie: [-3, 0] },
  { id: 'antre_entree_h', nom: "L'Antre (héroïque)", carte: 'ossara', x: 330, y: 344, vers: 'antre_h', arrivee: 'antre_h_sortie', sortie: [-3, 0] },
  { id: 'antre_sortie', nom: "Sortie de l'Antre", carte: 'antre', x: 3, y: 70, vers: 'ossara', arrivee: 'antre_entree', sortie: [3, 0] },
  { id: 'antre_h_sortie', nom: "Sortie de l'Antre", carte: 'antre_h', x: 3, y: 70, vers: 'ossara', arrivee: 'antre_entree_h', sortie: [3, 0] },
  { id: 'gueule_entree', nom: 'Le Gosier', carte: 'ossara', x: 318, y: 84, vers: 'gueule', arrivee: 'gueule_sortie', sortie: [0, 3] },
  { id: 'gueule_entree_h', nom: 'Le Gosier (héroïque)', carte: 'ossara', x: 312, y: 84, vers: 'gueule_h', arrivee: 'gueule_h_sortie', sortie: [0, 3] },
  { id: 'semeur_entree', nom: "L'offensive du Semeur", carte: 'ossara', x: 306, y: 84, vers: 'semeur', arrivee: 'semeur_sortie', sortie: [0, 3] },
  { id: 'semeur_sortie', nom: "Retour au front", carte: 'semeur', x: 3, y: 70, vers: 'ossara', arrivee: 'semeur_entree', sortie: [3, 0] },
  { id: 'gueule_sortie', nom: 'Sortie du Gosier', carte: 'gueule', x: 3, y: 70, vers: 'ossara', arrivee: 'gueule_entree', sortie: [3, 0] },
  { id: 'gueule_h_sortie', nom: 'Sortie du Gosier', carte: 'gueule_h', x: 3, y: 70, vers: 'ossara', arrivee: 'gueule_entree_h', sortie: [3, 0] },
  // la Serre, au fond des Serres (côté nord de l'armature), et le Registre, creusé sous le pied du Mât de relais
  { id: 'serre_entree', nom: 'La Serre', carte: 'ossara', x: 596, y: 245, vers: 'serre', arrivee: 'serre_sortie', sortie: [0, 3] },
  { id: 'serre_entree_h', nom: 'La Serre (héroïque)', carte: 'ossara', x: 601, y: 245, vers: 'serre_h', arrivee: 'serre_h_sortie', sortie: [0, 3] },
  { id: 'serre_sortie', nom: 'Sortie de la Serre', carte: 'serre', x: 3, y: 70, vers: 'ossara', arrivee: 'serre_entree', sortie: [3, 0] },
  { id: 'serre_h_sortie', nom: 'Sortie de la Serre', carte: 'serre_h', x: 3, y: 70, vers: 'ossara', arrivee: 'serre_entree_h', sortie: [3, 0] },
  { id: 'registre_entree', nom: 'Le Registre', carte: 'ossara', x: 546, y: 80, vers: 'registre', arrivee: 'registre_sortie', sortie: [0, 3] },
  { id: 'registre_entree_h', nom: 'Le Registre (héroïque)', carte: 'ossara', x: 551, y: 80, vers: 'registre_h', arrivee: 'registre_h_sortie', sortie: [0, 3] },
  { id: 'registre_sortie', nom: 'Sortie du Registre', carte: 'registre', x: 3, y: 70, vers: 'ossara', arrivee: 'registre_entree', sortie: [3, 0] },
  { id: 'metier_entree', nom: "L'assaut du Métier", carte: 'ossara', x: 575, y: 34, vers: 'metier_raid', arrivee: 'metier_sortie', sortie: [0, 3] },
  { id: 'metier_sortie', nom: 'Retour aux Hauts', carte: 'metier_raid', x: 3, y: 70, vers: 'ossara', arrivee: 'metier_entree', sortie: [3, 0] },
  { id: 'registre_h_sortie', nom: 'Sortie du Registre', carte: 'registre_h', x: 3, y: 70, vers: 'ossara', arrivee: 'registre_entree_h', sortie: [3, 0] },
]
export const PASSAGE_BY_ID: Record<string, Passage> = Object.fromEntries(PASSAGES.map((p) => [p.id, p]))

/** Les stations du monorail de la Première Vague, sur le continent. Réparées une fois par lignée (compte). */
export interface Station { id: string; nom: string; x: number; y: number; lieu: string; ouverte?: boolean }
export const STATIONS: Station[] = [
  { id: 'st_port', nom: 'Gare de Port-Ancre', x: 227, y: 316, lieu: 'port', ouverte: true },
  { id: 'st_fougere', nom: 'Halte de la Fougère', x: 80, y: 228, lieu: 'fougere' },
  { id: 'st_marais', nom: 'Halte du Marais', x: 320, y: 291, lieu: 'postemarais' },
  { id: 'st_col', nom: 'Halte du Col', x: 214, y: 216, lieu: 'relais', ouverte: true },
  { id: 'st_epave', nom: "Halte de l'Épave", x: 104, y: 118, lieu: 'campepave' },
  { id: 'st_bastion', nom: 'Halte du Bastion', x: 266, y: 173, lieu: 'bastion' },
  // campagne 2 : la ligne de Glane (du Bastion aux Hauts, par l'isthme) et la barge de Relâche (la mer)
  { id: 'st_gue', nom: 'Halte du Gué', x: 448, y: 111, lieu: 'gue_glane' },
  { id: 'st_champs', nom: 'Halte des Champs', x: 527, y: 211, lieu: 'sillon' },
  { id: 'st_mat', nom: 'Halte du Mât', x: 548, y: 88, lieu: 'mat' },
  { id: 'st_anse', nom: "Embarcadère d'Anse-Grise", x: 255, y: 347, lieu: 'anse', ouverte: true },
  { id: 'st_relache', nom: 'Quai de Relâche', x: 454, y: 279, lieu: 'relache', ouverte: true },
]
export const STATION_BY_ID: Record<string, Station> = Object.fromEntries(STATIONS.map((s) => [s.id, s]))
/** Réparer une station : des pièces de robot et de la ferraille, une fois pour toute la lignée. */
export const STATION_COUT = { pieces: 2, ferraille: 60 }
export const STATION_R = 30 // px : distance pour réparer ou prendre le monorail
