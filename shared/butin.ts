// Les tables de butin : par endroit (région du continent, épave de la Constance, nid) et par boss. Un tirage est une
// fonction pure du générateur R : le même R donne le même butin (tests, simulation tools/sim-butin.ts).
import { E, ENEMIES, type ClassId } from './rules.ts'
import { rollEquip, ENSEMBLES, PIECES_SET, R_LEGENDAIRE, R_ENSEMBLE, type Item, type TypeEquip } from './items.ts'

export interface TableButin {
  /** chance d'un objet d'équipement : créature ordinaire, élite (au moins un objet) */
  objet: number; objetElite: number
  /** chances cumulées de rareté pour un objet ordinaire : peu commun, rare, épique, légendaire */
  rarete: [number, number, number, number]
  /** les bases qui tombent ici, et leur poids */
  bases: Partial<Record<TypeEquip, number>>
  /** une pièce d'ensemble peut tomber d'une élite ici */
  ensemble?: { id: string; chance: number }
}
const TOUT: Partial<Record<TypeEquip, number>> = { arme: 3, armure: 2, casque: 2, gants: 2, bottes: 2, module: 2, chassis: 1, canon: 1 }
export const TABLES: Record<string, TableButin> = {
  plaines: { objet: 0.08, objetElite: 1, rarete: [0.3, 0.05, 0.01, 0.001], bases: { ...TOUT, chassis: 0.5, canon: 0.5 } },
  foret: { objet: 0.1, objetElite: 1, rarete: [0.33, 0.07, 0.015, 0.002], bases: { ...TOUT, bottes: 3 } },
  marais: { objet: 0.1, objetElite: 1, rarete: [0.35, 0.09, 0.02, 0.003], bases: { ...TOUT, gants: 3 } },
  plateaux: { objet: 0.11, objetElite: 1.2, rarete: [0.36, 0.1, 0.025, 0.004], bases: { ...TOUT, armure: 3, casque: 3 } },
  // le Cimetière des Machines : des pièces de robot
  cimetiere: { objet: 0.12, objetElite: 1.2, rarete: [0.38, 0.12, 0.03, 0.005], bases: { ...TOUT, chassis: 3, canon: 3, module: 3 } },
  eden: { objet: 0.12, objetElite: 1.4, rarete: [0.4, 0.14, 0.04, 0.006], bases: TOUT },
  constance: { objet: 0.12, objetElite: 1.3, rarete: [0.4, 0.14, 0.04, 0.006], bases: { ...TOUT, chassis: 2, canon: 2 }, ensemble: { id: 'constance', chance: 0.06 } },
  nid: { objet: 0.12, objetElite: 1.3, rarete: [0.4, 0.15, 0.04, 0.006], bases: TOUT },
  // les donjons : plus généreux que dehors, l'héroïque encore plus
  antre: { objet: 0.14, objetElite: 1.4, rarete: [0.42, 0.15, 0.04, 0.006], bases: { ...TOUT, bottes: 3 } },
  antre_h: { objet: 0.18, objetElite: 1.8, rarete: [0.55, 0.25, 0.08, 0.015], bases: { ...TOUT, bottes: 3 } },
  gueule: { objet: 0.14, objetElite: 1.4, rarete: [0.45, 0.17, 0.05, 0.008], bases: { ...TOUT, casque: 3 } },
  semeur: { objet: 0.2, objetElite: 2, rarete: [0.6, 0.3, 0.1, 0.02], bases: { ...TOUT } },
  gueule_h: { objet: 0.18, objetElite: 1.8, rarete: [0.58, 0.28, 0.09, 0.018], bases: { ...TOUT, casque: 3 } },
  // campagne 2 : les Hauts de Glane (niveaux 20 à 35) ; la Trame du Métier tombe des élites, plus souvent vers le Métier
  lisiere: { objet: 0.12, objetElite: 1.3, rarete: [0.42, 0.15, 0.04, 0.007], bases: { ...TOUT, bottes: 3 }, ensemble: { id: 'trame', chance: 0.03 } },
  champs: { objet: 0.13, objetElite: 1.4, rarete: [0.44, 0.17, 0.05, 0.008], bases: { ...TOUT, chassis: 3, canon: 3 }, ensemble: { id: 'trame', chance: 0.04 } },
  pepiniere: { objet: 0.13, objetElite: 1.4, rarete: [0.46, 0.18, 0.05, 0.009], bases: { ...TOUT, casque: 3, module: 3 }, ensemble: { id: 'trame', chance: 0.05 } },
  metier: { objet: 0.14, objetElite: 1.5, rarete: [0.48, 0.2, 0.06, 0.01], bases: { ...TOUT, arme: 4, gants: 3 }, ensemble: { id: 'trame', chance: 0.06 } },
  // les donjons des Hauts : la Serre (casques et modules) et le Registre (armes et gants), l'héroïque plus généreux
  serre: { objet: 0.15, objetElite: 1.5, rarete: [0.5, 0.2, 0.06, 0.01], bases: { ...TOUT, casque: 3, module: 3 }, ensemble: { id: 'trame', chance: 0.07 } },
  serre_h: { objet: 0.19, objetElite: 1.9, rarete: [0.62, 0.3, 0.1, 0.02], bases: { ...TOUT, casque: 3, module: 3 }, ensemble: { id: 'trame', chance: 0.1 } },
  registre: { objet: 0.15, objetElite: 1.5, rarete: [0.52, 0.22, 0.07, 0.012], bases: { ...TOUT, arme: 3, gants: 3 }, ensemble: { id: 'trame', chance: 0.07 } },
  metier_raid: { objet: 0.2, objetElite: 2, rarete: [0.62, 0.32, 0.11, 0.022], bases: { ...TOUT }, ensemble: { id: 'trame', chance: 0.12 } },
  registre_h: { objet: 0.19, objetElite: 1.9, rarete: [0.64, 0.32, 0.11, 0.022], bases: { ...TOUT, arme: 3, gants: 3 }, ensemble: { id: 'trame', chance: 0.1 } },
}
/** les boss : combien d'objets, la chance d'un légendaire, l'ensemble qu'ils portent */
export const TABLES_BOSS: Record<number, { objets: number; leg: number; ensemble: string; pieces: number }> = {
  [E.COUVEUSE]: { objets: 2, leg: 0.15, ensemble: 'couveuse', pieces: 1 },
  [E.ENGLOUTISSEUR]: { objets: 2, leg: 0.15, ensemble: 'engloutisseur', pieces: 1 },
  [E.SEMEUR]: { objets: 4, leg: 0.35, ensemble: 'constance', pieces: 1 },
  [E.GUEULE]: { objets: 3, leg: 0.22, ensemble: 'couveuse', pieces: 0 },
  [E.PEPINIERE]: { objets: 3, leg: 0.24, ensemble: 'trame', pieces: 1 },
  [E.GREFFIER]: { objets: 3, leg: 0.26, ensemble: 'trame', pieces: 1 },
  [E.GLANEUSE]: { objets: 4, leg: 0.38, ensemble: 'trame', pieces: 1 },
}

function pioche<K extends string>(poids: Partial<Record<K, number>>, R: () => number): K {
  const l = Object.entries(poids) as [K, number][]
  let x = R() * l.reduce((a, [, v]) => a + v, 0)
  for (const [k, v] of l) { x -= v; if (x <= 0) return k }
  return l[l.length - 1][0]
}
function rareteDe(t: TableButin, R: () => number, plancher = 0) {
  const x = R()
  const r = x < t.rarete[3] ? R_LEGENDAIRE : x < t.rarete[2] ? 3 : x < t.rarete[1] ? 2 : x < t.rarete[0] ? 1 : 0
  return r === R_LEGENDAIRE ? r : Math.max(plancher, r)
}

/** L'équipement que lâche une créature tuée à cet endroit (les matériaux sont tirés à part). */
export function butinEquip(o: { kind: number; level: number; elite: boolean; endroit: string; cls: ClassId }, R: () => number = Math.random): Item[] {
  const def = ENEMIES[o.kind]
  const t = TABLES[o.endroit] ?? TABLES.plaines
  const out: Item[] = []
  const boss = TABLES_BOSS[o.kind]
  if (boss) {
    // l'héroïque d'un donjon : un objet et une pièce de plus, deux fois plus de légendaires
    const h = o.endroit.endsWith('_h') ? 1 : 0
    for (let i = 0; i < boss.objets + h; i++) out.push(rollEquip(pioche(t.bases, R), o.level, R() < boss.leg * (1 + h) ? R_LEGENDAIRE : R() < 0.4 ? 3 : 2, o.cls, R))
    for (let i = 0; i < (boss.pieces ? boss.pieces + h : 0); i++) out.push(rollEquip(PIECES_SET[Math.floor(R() * 4)], o.level, R_ENSEMBLE, o.cls, R, { set: boss.ensemble }))
    return out
  }
  if (def.passif) { if (R() < 0.02) out.push(rollEquip(pioche(t.bases, R), o.level, rareteDe(t, R), o.cls, R)); return out }
  const n = o.elite ? t.objetElite : t.objet
  for (let k = 0; k < Math.floor(n) + (R() < n % 1 ? 1 : 0); k++) out.push(rollEquip(pioche(t.bases, R), o.level, rareteDe(t, R, o.elite ? 1 : 0), o.cls, R))
  if (o.elite && t.ensemble && R() < t.ensemble.chance) out.push(rollEquip(PIECES_SET[Math.floor(R() * 4)], o.level, R_ENSEMBLE, o.cls, R, { set: t.ensemble.id }))
  return out
}
export const ENDROITS_BUTIN = Object.keys(TABLES)
void ENSEMBLES
