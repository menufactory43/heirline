// Le bouton de test « aller voir un boss » : chaque boss a son niveau prévu. Le soldat du joueur y est remplacé, le
// temps du test, par un soldat de test à ce niveau (stats, équipement, robot) ; rien de ce qui s'y passe ne touche sa
// vraie fiche, et une mort de test le ramène à Port-Ancre sans rien perdre (server/rooms/Secteur.ts, debutTest).
import type { ClassId } from './rules.ts'
import { rollEquip, type Equip } from './items.ts'
import { graine } from './motifs.ts'

import type { CarteId } from './monde.ts'

export interface BossTest { nom: string; lieu: string; niveau: number; robot: number; carte: CarteId }
export const BOSS_TEST: Record<string, BossTest> = {
  // l'arène de la Couveuse est réglée pour un groupe de niveau 15–16 (tests/arene.test.ts)
  couveuse: { nom: 'La Couveuse', lieu: 'une instance du nid', niveau: 16, robot: 8, carte: 'nid' },
  // les donjons : l'Antre (marais, niveaux 12–13) et le Gosier (sous la Grande Ruche), puis leurs héroïques
  engloutisseur: { nom: "L'Engloutisseur", lieu: "l'Antre de l'Engloutisseur", niveau: 13, robot: 6, carte: 'antre' },
  engloutisseur_h: { nom: "L'Engloutisseur (héroïque)", lieu: "l'Antre, en héroïque", niveau: 18, robot: 8, carte: 'antre_h' },
  gueule: { nom: 'La Gueule', lieu: 'le Gosier', niveau: 19, robot: 9, carte: 'gueule' },
  gueule_h: { nom: 'La Gueule (héroïque)', lieu: 'le Gosier, en héroïque', niveau: 24, robot: 10, carte: 'gueule_h' },
  // les Hauts de Glane (campagne 2)
  pepiniere: { nom: 'La Pépinière', lieu: 'la Serre', niveau: 27, robot: 10, carte: 'serre' },
  pepiniere_h: { nom: 'La Pépinière (héroïque)', lieu: 'la Serre, en héroïque', niveau: 32, robot: 10, carte: 'serre_h' },
  greffier: { nom: 'Le Greffier', lieu: 'le Registre', niveau: 30, robot: 10, carte: 'registre' },
  greffier_h: { nom: 'Le Greffier (héroïque)', lieu: 'le Registre, en héroïque', niveau: 35, robot: 10, carte: 'registre_h' },
  glaneuse: { nom: 'La Glaneuse (raid)', lieu: "l'assaut du Métier, à dix", niveau: 33, robot: 10, carte: 'metier_raid' },
  semeur: { nom: 'Le Semeur (raid)', lieu: "l'offensive du Semeur, à dix", niveau: 20, robot: 10, carte: 'semeur' },
}

/** L'équipement du soldat de test : une tenue complète rare de son niveau (sans pièces de robot), toujours la même. */
export function equipementTest(cls: ClassId, niveau: number): Equip {
  const R = graine(niveau * 31 + cls.length)
  return {
    arme: rollEquip('arme', niveau, 2, cls, R),
    armure: rollEquip('armure', niveau, 2, cls, R),
    module1: rollEquip('module', niveau, 2, cls, R),
    module2: rollEquip('module', niveau, 2, cls, R),
    casque: rollEquip('casque', niveau, 2, cls, R),
    gants: rollEquip('gants', niveau, 2, cls, R),
    bottes: rollEquip('bottes', niveau, 2, cls, R),
  }
}

/** Les autres visites de test, avec le même soldat de test sans risque : l'entrée des donjons (le parcours en lacets,
 *  pas seulement l'arène), et chaque région du continent au niveau de son cœur. Identifiants : « entree:<carte> »,
 *  « region:<id> ». */
export const ENTREES_TEST: Record<string, { carte: CarteId; niveau: number; robot: number }> = {
  antre: { carte: 'antre', niveau: 13, robot: 6 },
  gueule: { carte: 'gueule', niveau: 19, robot: 9 },
  serre: { carte: 'serre', niveau: 27, robot: 10 },
  registre: { carte: 'registre', niveau: 30, robot: 10 },
}
export function niveauRegionTest(niveau: [number, number]) { return niveau[1] }
/** Niveau et robot d'une visite de test (boss, entrée de donjon, région), ou null si l'identifiant est inconnu. */
export function testDef(id: string, regions: { id: string; niveau: [number, number] }[]): { niveau: number; robot: number } | null {
  if (BOSS_TEST[id]) return BOSS_TEST[id]
  if (id.startsWith('entree:')) return ENTREES_TEST[id.slice(7)] ?? null
  if (id.startsWith('region:')) {
    const r = regions.find((x) => x.id === id.slice(7))
    if (!r) return null
    const niveau = niveauRegionTest(r.niveau)
    return { niveau, robot: Math.max(1, Math.min(10, Math.round(niveau / 2.5))) }
  }
  return null
}
