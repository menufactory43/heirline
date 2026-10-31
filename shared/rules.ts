// Règles du jeu : classes, ennemis, progression, déplacement. Mêmes nombres côté serveur et client.
import { TILE, PLAYER_R } from './consts.ts'
import { solidAtPx } from './map.ts'

export type ClassId = 'fantassin' | 'medic' | 'ingenieur' | 'eclaireur' | 'demolisseur' | 'brouilleur'

export interface Weapon {
  nom: string; degats: number; cadence: number; dispersion: number; balles: number; vitesse: number; portee: number
  /** la balle traverse autant d'ennemis en plus */
  perce?: number
  /** la balle éclate en zone (rayon, px) au premier contact ou au bout de sa course */
  zone?: number
  /** la balle ralentit l'ennemi touché (part de la vitesse retirée, 1 s) */
  ralentit?: number
}
export interface Skill { id: string; nom: string; recharge: number; desc: string }
export interface ClassDef { id: ClassId; nom: string; pv: number; vitesse: number; arme: Weapon; competences: [Skill, Skill]; couleur: string }

export const CLASSES: Record<ClassId, ClassDef> = {
  fantassin: {
    id: 'fantassin', nom: 'Fantassin', pv: 130, vitesse: 74, couleur: '#7d8a5a',
    arme: { nom: "Fusil d'assaut", degats: 9, cadence: 0.11, dispersion: 0.05, balles: 1, vitesse: 330, portee: 0.75 },
    competences: [
      { id: 'bouclier', nom: 'Bouclier', recharge: 12, desc: 'Encaisse 60 % de dégâts en moins pendant 4 s.' },
      { id: 'grenade', nom: 'Grenade', recharge: 8, desc: 'Lancée vers la visée, explose en zone.' },
    ],
  },
  medic: {
    id: 'medic', nom: 'Médic', pv: 105, vitesse: 80, couleur: '#d8d8d0',
    arme: { nom: 'Pistolet', degats: 15, cadence: 0.26, dispersion: 0.02, balles: 1, vitesse: 360, portee: 0.7 },
    competences: [
      { id: 'injection', nom: 'Injection', recharge: 10, desc: 'Soigne 35 % des PV de tous ceux qui sont autour, robots compris.' },
      { id: 'adrenaline', nom: 'Adrénaline', recharge: 15, desc: 'Toi et tes alliés proches allez 40 % plus vite pendant 4 s ; relève les alliés à terre autour.' },
    ],
  },
  ingenieur: {
    id: 'ingenieur', nom: 'Ingénieur', pv: 115, vitesse: 74, couleur: '#d08a2c',
    arme: { nom: 'Fusil à pompe', degats: 7, cadence: 0.7, dispersion: 0.32, balles: 6, vitesse: 300, portee: 0.42 },
    competences: [
      { id: 'tourelle', nom: 'Tourelle', recharge: 16, desc: 'Pose une tourelle qui tire 12 s.' },
      { id: 'surcharge', nom: 'Surcharge', recharge: 14, desc: 'Ton robot tire deux fois plus vite et se répare de 30 % pendant 6 s.' },
    ],
  },
  // les trois classes de la deuxième vague de recrues (SPEC § 5) : distance, zone, contrôle
  eclaireur: {
    id: 'eclaireur', nom: 'Éclaireur', pv: 100, vitesse: 78, couleur: '#6f8f9a',
    arme: { nom: 'Fusil de précision', degats: 34, cadence: 0.85, dispersion: 0.006, balles: 1, vitesse: 520, portee: 0.85, perce: 1 },
    competences: [
      { id: 'marquage', nom: 'Marquage', recharge: 12, desc: 'Marque les ennemis vers la visée : ils prennent 25 % de dégâts en plus pendant 8 s.' },
      { id: 'piege', nom: 'Piège', recharge: 10, desc: 'Pose une mine à tes pieds : elle saute quand un ennemi passe (60 dégâts). Deux au plus.' },
    ],
  },
  demolisseur: {
    id: 'demolisseur', nom: 'Démolisseur', pv: 125, vitesse: 70, couleur: '#8a4a3a',
    arme: { nom: 'Lance-grenades', degats: 20, cadence: 0.95, dispersion: 0.04, balles: 1, vitesse: 230, portee: 0.75, zone: 26 },
    competences: [
      { id: 'mortier', nom: 'Mortier', recharge: 11, desc: 'Un obus tombe vers la visée après une annonce : 90 dégâts en zone.' },
      { id: 'onde', nom: 'Onde de choc', recharge: 9, desc: 'Repousse et étourdit 0,6 s tout ce qui t\'entoure (30 dégâts).' },
    ],
  },
  brouilleur: {
    id: 'brouilleur', nom: 'Brouilleur', pv: 110, vitesse: 80, couleur: '#5a4a8a',
    arme: { nom: 'Lance-arcs', degats: 5, cadence: 0.08, dispersion: 0.03, balles: 1, vitesse: 400, portee: 0.5, ralentit: 0.2 },
    competences: [
      { id: 'champ', nom: 'Champ de brouillage', recharge: 13, desc: 'Un champ vers la visée pendant 5 s : les ennemis dedans vont deux fois moins vite.' },
      { id: 'leurre', nom: 'Leurre', recharge: 15, desc: 'Un double holographique vers la visée attire les ennemis pendant 6 s.' },
    ],
  },
}
export const CLASS_IDS = Object.keys(CLASSES) as ClassId[]

export const LEVEL_MAX = 50
export function xpToNext(level: number) { return Math.round(60 * Math.pow(level, 1.5)) }
export function hpFor(cls: ClassId, level: number) { return Math.round(CLASSES[cls].pv * (1 + 0.06 * (level - 1))) }
export function dmgMul(level: number) { return 1 + 0.05 * (level - 1) }

/** L'héritier reprend la moitié du niveau de l'ancêtre. */
export function heirLevel(ancestorLevel: number) { return Math.max(1, Math.floor(ancestorLevel / 2)) }

export const ROBOT = {
  pvBase: 80, degatsBase: 6, cadence: 0.5, portee: 170, vitesse: 82, niveauMax: 20,
  outpostMs: Number((globalThis as any).process?.env?.OUTPOST_MS ?? 20 * 60_000),
}
export function robotHp(level: number) { return Math.round(ROBOT.pvBase * (1 + 0.15 * (level - 1))) }
export function robotDmg(level: number) { return ROBOT.degatsBase * (1 + 0.12 * (level - 1)) }
export function robotUpgradeCost(level: number) { return 40 * level }
/** Les pièces de robot demandées par l'atelier pour passer au niveau suivant. */
export function robotPartsCost(level: number) { return Math.floor(level / 3) }

export type EnemyKind = number
export const E = {
  RAMPANT: 0, CRACHEUR: 1, CUIRASSE: 2, OEUF: 3, COUVEUSE: 4,
  BROUTARD: 5, RODEUR: 6, FOUGERODE: 7, SANGSUE: 8, GONFLE: 9, ROUILLARD: 10, GREFFE: 11, ENGLOUTISSEUR: 12, CORNEFEUILLE: 13, SAC: 14, GUEULE: 15, SEMEUR: 16,
  // campagne 2, les Hauts de Glane
  GLANEUR: 17, RETOURNE: 18, BOURGEON: 19, BOUTURE: 20, PYLONE: 21, PEPINIERE: 22, GREFFIER: 23, GLANEUSE: 24, PORTENOM: 25, POT: 26, BALISE: 27, FILEUSE: 28,
} as const
export type Famille = 'eden' | 'faune' | 'machine'
export interface EnemyDef {
  nom: string; pv: number; vitesse: number; rayon: number; degats: number; portee: number; cadence: number; xp: number; ferraille: number; cout: number
  famille: Famille
  /** une bête qui ne s'en prend à personne et fuit quand on la blesse */
  passif?: boolean
  /** tir à distance : aspect du projectile (0 acide, 1 laser, 2 épine) et vitesse */
  tir?: { k: number; v: number }
  /** explose au contact, avec une annonce au sol */
  explose?: boolean
  /** soigne ce qu'il mord */
  draine?: boolean
  boss?: boolean
}
export const ENEMIES: Record<number, EnemyDef> = {
  [E.RAMPANT]: { nom: 'Rampant', pv: 28, vitesse: 62, rayon: 6, degats: 8, portee: 14, cadence: 0.8, xp: 6, ferraille: 2, cout: 3, famille: 'eden' },
  [E.CRACHEUR]: { nom: 'Cracheur', pv: 34, vitesse: 38, rayon: 6, degats: 10, portee: 150, cadence: 1.6, xp: 9, ferraille: 3, cout: 5, famille: 'eden', tir: { k: 0, v: 150 } },
  [E.CUIRASSE]: { nom: 'Cuirassé', pv: 140, vitesse: 34, rayon: 9, degats: 22, portee: 18, cadence: 1.4, xp: 22, ferraille: 8, cout: 14, famille: 'eden' },
  [E.OEUF]: { nom: 'Œuf', pv: 45, vitesse: 0, rayon: 6, degats: 0, portee: 0, cadence: 99, xp: 3, ferraille: 1, cout: 2, famille: 'eden' },
  [E.COUVEUSE]: { nom: 'La Couveuse', pv: 2600, vitesse: 22, rayon: 22, degats: 30, portee: 30, cadence: 1.2, xp: 400, ferraille: 120, cout: 160, famille: 'eden', boss: true },
  [E.BROUTARD]: { nom: 'Broutard', pv: 30, vitesse: 44, rayon: 7, degats: 0, portee: 0, cadence: 99, xp: 4, ferraille: 0, cout: 1, famille: 'faune', passif: true },
  [E.RODEUR]: { nom: 'Rôdeur', pv: 36, vitesse: 70, rayon: 6, degats: 7, portee: 14, cadence: 0.9, xp: 7, ferraille: 1, cout: 3, famille: 'faune' },
  [E.FOUGERODE]: { nom: 'Fougerôde', pv: 32, vitesse: 78, rayon: 6, degats: 8, portee: 13, cadence: 0.7, xp: 8, ferraille: 1, cout: 3, famille: 'faune' },
  [E.SANGSUE]: { nom: 'Sangsue des marais', pv: 44, vitesse: 46, rayon: 6, degats: 9, portee: 13, cadence: 1.0, xp: 9, ferraille: 1, cout: 4, famille: 'faune', draine: true },
  [E.GONFLE]: { nom: 'Gonflé', pv: 40, vitesse: 30, rayon: 8, degats: 34, portee: 26, cadence: 99, xp: 9, ferraille: 2, cout: 5, famille: 'eden', explose: true },
  [E.ROUILLARD]: { nom: 'Rouillard', pv: 46, vitesse: 52, rayon: 6, degats: 9, portee: 170, cadence: 1.3, xp: 11, ferraille: 6, cout: 5, famille: 'machine', tir: { k: 1, v: 240 } },
  [E.GREFFE]: { nom: 'Greffé', pv: 58, vitesse: 44, rayon: 6, degats: 11, portee: 160, cadence: 1.5, xp: 13, ferraille: 4, cout: 6, famille: 'eden', tir: { k: 2, v: 190 } },
  [E.ENGLOUTISSEUR]: { nom: "L'Engloutisseur", pv: 5200, vitesse: 26, rayon: 26, degats: 34, portee: 34, cadence: 1.3, xp: 600, ferraille: 180, cout: 200, famille: 'faune', boss: true },
  // un sac de ponte de la Couveuse : une pièce du boss, accrochée à son flanc (voir server/world/arene.ts)
  [E.SAC]: { nom: 'Sac de ponte', pv: 520, vitesse: 0, rayon: 11, degats: 0, portee: 0, cadence: 99, xp: 60, ferraille: 20, cout: 30, famille: 'eden' },
  // la Gueule : une bouche de chair grande comme une salle, au fond du Gosier (server/world/arene.ts, profil gueule)
  [E.SEMEUR]: { nom: 'Le Semeur', pv: 5200, vitesse: 0, rayon: 24, degats: 40, portee: 34, cadence: 1.2, xp: 1400, ferraille: 400, cout: 300, famille: 'eden', boss: true },
  [E.GUEULE]: { nom: 'La Gueule', pv: 4200, vitesse: 0, rayon: 26, degats: 36, portee: 34, cadence: 1.3, xp: 700, ferraille: 200, cout: 220, famille: 'eden', boss: true },
  [E.CORNEFEUILLE]: { nom: 'Cornefeuille', pv: 40, vitesse: 58, rayon: 7, degats: 0, portee: 0, cadence: 99, xp: 5, ferraille: 0, cout: 1, famille: 'faune', passif: true },
  // ------------------------------------------------------------------ campagne 2 : les Hauts de Glane
  [E.GLANEUR]: { nom: 'Glaneur', pv: 40, vitesse: 72, rayon: 7, degats: 10, portee: 15, cadence: 0.8, xp: 10, ferraille: 2, cout: 4, famille: 'eden' },
  [E.RETOURNE]: { nom: 'Robot retourné', pv: 60, vitesse: 48, rayon: 7, degats: 10, portee: 180, cadence: 1.2, xp: 13, ferraille: 7, cout: 6, famille: 'machine', tir: { k: 1, v: 250 } },
  [E.BOURGEON]: { nom: 'Bourgeon-espion', pv: 50, vitesse: 0, rayon: 7, degats: 9, portee: 190, cadence: 1.6, xp: 9, ferraille: 1, cout: 4, famille: 'eden', tir: { k: 2, v: 200 } },
  [E.BOUTURE]: { nom: 'Bouturé', pv: 150, vitesse: 36, rayon: 9, degats: 20, portee: 18, cadence: 1.3, xp: 22, ferraille: 6, cout: 13, famille: 'eden' },
  [E.PYLONE]: { nom: 'Pylône du Métier', pv: 300, vitesse: 0, rayon: 10, degats: 0, portee: 0, cadence: 99, xp: 30, ferraille: 10, cout: 10, famille: 'machine' },
  [E.PEPINIERE]: { nom: 'La Pépinière', pv: 2600, vitesse: 22, rayon: 18, degats: 34, portee: 30, cadence: 1.2, xp: 600, ferraille: 160, cout: 200, famille: 'eden', boss: true },
  [E.GREFFIER]: { nom: 'Le Greffier', pv: 2800, vitesse: 22, rayon: 18, degats: 38, portee: 30, cadence: 1.2, xp: 700, ferraille: 180, cout: 220, famille: 'eden', boss: true },
  [E.GLANEUSE]: { nom: 'La Glaneuse', pv: 2800, vitesse: 22, rayon: 20, degats: 40, portee: 30, cadence: 1.2, xp: 1200, ferraille: 300, cout: 300, famille: 'eden', boss: true },
  [E.PORTENOM]: { nom: 'Porte-nom', pv: 90, vitesse: 26, rayon: 7, degats: 0, portee: 0, cadence: 99, xp: 6, ferraille: 0, cout: 3, famille: 'eden' },
  [E.POT]: { nom: 'Pot de bouture', pv: 60, vitesse: 0, rayon: 7, degats: 0, portee: 0, cadence: 99, xp: 4, ferraille: 1, cout: 2, famille: 'eden' },
  [E.BALISE]: { nom: 'Balise glanée', pv: 120, vitesse: 0, rayon: 8, degats: 12, portee: 220, cadence: 1.0, xp: 10, ferraille: 4, cout: 6, famille: 'machine', tir: { k: 1, v: 260 } },
  [E.FILEUSE]: { nom: 'Fileuse', pv: 70, vitesse: 40, rayon: 8, degats: 12, portee: 160, cadence: 1.8, xp: 15, ferraille: 3, cout: 7, famille: 'eden', tir: { k: 0, v: 170 } },
}
/** La force d'une créature selon son niveau (et si c'est une élite). */
export function enemyHp(kind: number, level: number, elite = false) { return Math.round(ENEMIES[kind].pv * (1 + 0.18 * (level - 1)) * (elite ? 3 : 1)) }
export function enemyDmg(kind: number, level: number, elite = false) { return ENEMIES[kind].degats * (1 + 0.12 * (level - 1)) * (elite ? 1.5 : 1) }
export function enemyXp(kind: number, level: number, elite = false) { return Math.round(ENEMIES[kind].xp * (1 + 0.5 * (level - 1)) * (elite ? 3 : 1)) }

export interface Body { x: number; y: number }
export interface MapLike { w: number; h: number; tiles: Uint8Array }

/** Déplacement d'un pas avec collisions par axe : le même calcul côté serveur et dans la prédiction. */
export function moveStep(b: Body, mx: number, my: number, dt: number, speed: number, m: MapLike, r = PLAYER_R) {
  const l = Math.hypot(mx, my)
  if (l > 1) { mx /= l; my /= l }
  const nx = b.x + mx * speed * dt
  if (!hits(m, nx, b.y, r)) b.x = nx
  const ny = b.y + my * speed * dt
  if (!hits(m, b.x, ny, r)) b.y = ny
  b.x = Math.max(r, Math.min(m.w * TILE - r, b.x))
  b.y = Math.max(r, Math.min(m.h * TILE - r, b.y))
}

export function hits(m: MapLike, x: number, y: number, r: number) {
  return solidAtPx(m, x - r, y - r) || solidAtPx(m, x + r, y - r) || solidAtPx(m, x - r, y + r) || solidAtPx(m, x + r, y + r)
}

/** Le robot en monture : le soldat va plus vite, et descend dès qu'il tire ou qu'il est touché. */
export const MONTURE = { vitesse: 1.6, niveauQuete: 3 }
/** La vitesse de marche d'un soldat : la même formule pour le serveur et la prédiction du client. */
export function vitesseSoldat(s: { vit: number; fx: number; monte?: boolean }) { return s.vit * (s.fx & 2 ? 1.4 : 1) * (s.monte ? MONTURE.vitesse : 1) }

/** La ruée : courte, invulnérable, rechargée en 1,6 s. */
export const DASH = { vitesse: 300, duree: 0.16, recharge: 1.6 }
export interface MoverState { x: number; y: number; dashT: number; dashCd: number; dvx: number; dvy: number }
/**
 * Une entrée appliquée au soldat : marche, puis ruée si elle est demandée et prête. Le serveur et la prédiction
 * du client appellent exactement cette fonction, entrée par entrée, avec le même pas.
 */
export function applyMove(st: MoverState, c: { mx: number; my: number; aim: number; dash?: boolean }, dt: number, speed: number, m: MapLike, esquive = 0) {
  st.dashCd = Math.max(0, st.dashCd - dt)
  if (c.dash && st.dashCd <= 0) {
    let dx = c.mx, dy = c.my
    let l = Math.hypot(dx, dy)
    if (l < 0.1) { dx = Math.cos(c.aim); dy = Math.sin(c.aim); l = 1 }
    st.dvx = dx / l; st.dvy = dy / l; st.dashT = DASH.duree; st.dashCd = DASH.recharge * (1 - Math.min(50, esquive) / 100)
  }
  moveStep(st, c.mx, c.my, dt, speed, m, PLAYER_R)
  if (st.dashT > 0) {
    st.dashT = Math.max(0, st.dashT - dt)
    moveStep(st, st.dvx, st.dvy, dt, DASH.vitesse, m, PLAYER_R)
  }
}
