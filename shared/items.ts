// Les objets : équipement (arme, armure, modules) avec rareté et caractéristiques, matériaux, soins.
// Les mêmes définitions servent au serveur (butin, boutiques, effets) et au client (sac, infobulles).
import type { ClassId } from './rules.ts'

export type Slot = 'arme' | 'casque' | 'armure' | 'gants' | 'bottes' | 'module1' | 'module2' | 'chassis' | 'canon'
export const SLOTS: Slot[] = ['arme', 'casque', 'armure', 'gants', 'bottes', 'module1', 'module2', 'chassis', 'canon']
/** Les caractéristiques d'un objet. pv : des PV en plus (pas un pourcentage) ; les autres sont des pourcentages, et
 *  les affixes (crit… relever) s'ajoutent aux bonus des talents (shared/talents.ts, Mods). */
export interface Stats {
  deg?: number; cad?: number; pv?: number; red?: number; vit?: number; robot?: number
  robotPv?: number; crit?: number; critDeg?: number; cdr?: number; soin?: number; zone?: number; puissance?: number; portee?: number; vol?: number; esquive?: number; relever?: number
}
export const STAT_KEYS: (keyof Stats)[] = ['deg', 'cad', 'pv', 'red', 'vit', 'robot', 'robotPv', 'crit', 'critDeg', 'cdr', 'soin', 'zone', 'puissance', 'portee', 'vol', 'esquive', 'relever']
export interface Item {
  u: string        // identifiant unique
  b: string        // base (voir BASES)
  r: number        // rareté 0..3
  l: number        // niveau
  c?: ClassId      // pour une arme : la classe qui la porte
  s: Stats
  n: number        // quantité (matériaux, soins)
  nom?: string
  /** un légendaire : son effet (LEGENDAIRES) */
  leg?: string
  /** une pièce d'ensemble (ENSEMBLES) */
  set?: string
}
export type Equip = Partial<Record<Slot, Item>>

export const RARETES = [
  { nom: 'Commun', couleur: '#c9d1d9' },
  { nom: 'Peu commun', couleur: '#7dff9a' },
  { nom: 'Rare', couleur: '#7fb8ff' },
  { nom: 'Épique', couleur: '#c48bff' },
  { nom: 'Légendaire', couleur: '#ffa640' },
  { nom: "Pièce d'ensemble", couleur: '#4fe3c1' },
]
export const R_LEGENDAIRE = 4, R_ENSEMBLE = 5

export type TypeEquip = 'arme' | 'casque' | 'armure' | 'gants' | 'bottes' | 'module' | 'chassis' | 'canon'
export const TYPES_EQUIP: TypeEquip[] = ['arme', 'casque', 'armure', 'gants', 'bottes', 'module', 'chassis', 'canon']
export interface BaseDef { nom: string; type: TypeEquip | 'mat' | 'soin' | 'quete'; icone: string; desc: string; pile?: number; prix?: number }
export const BASES: Record<string, BaseDef> = {
  arme: { nom: 'Arme', type: 'arme', icone: 'arme', desc: "Remplace l'arme de ta classe." },
  armure: { nom: 'Armure', type: 'armure', icone: 'armure', desc: 'Des points de vie et de la résistance.' },
  module: { nom: 'Module', type: 'module', icone: 'module', desc: 'Un circuit de la Colonie, branché sur ta combinaison.' },
  casque: { nom: 'Casque', type: 'casque', icone: 'casque', desc: 'Des points de vie, et ce que les affixes y ajoutent.' },
  gants: { nom: 'Gants', type: 'gants', icone: 'gants', desc: 'De la cadence de tir.' },
  bottes: { nom: 'Bottes', type: 'bottes', icone: 'bottes', desc: 'De la vitesse de marche.' },
  chassis: { nom: 'Châssis de robot', type: 'chassis', icone: 'chassis', desc: 'Se monte sur ton robot : des PV pour lui.' },
  canon: { nom: 'Canon de robot', type: 'canon', icone: 'canon', desc: 'Se monte sur ton robot : des dégâts pour lui.' },
  piece: { nom: 'Pièces de robot', type: 'mat', icone: 'piece', desc: "Servoteurs, câbles, plaques : l'atelier en demande pour améliorer un robot.", pile: 99, prix: 6 },
  viande: { nom: 'Viande de Broutard', type: 'mat', icone: 'viande', desc: 'La cantine en fait un ragoût.', pile: 50, prix: 2 },
  spore: { nom: "Spore d'ÉDEN", type: 'mat', icone: 'spore', desc: 'Un sac de spores tiède. Il bouge encore.', pile: 50, prix: 3 },
  herbe: { nom: 'Fougère-sang', type: 'mat', icone: 'herbe', desc: "Une herbe qui arrête les saignements. Les Fertiles savent la préparer.", pile: 50, prix: 2 },
  champignon: { nom: 'Lumivesse', type: 'mat', icone: 'champignon', desc: 'Un champignon du marais qui luit dans le noir.', pile: 50, prix: 3 },
  peau: { nom: 'Soie de Fougerôde', type: 'mat', icone: 'peau', desc: 'Solide comme du câble.', pile: 50, prix: 4 },
  noyau: { nom: 'Cœur de données', type: 'quete', icone: 'noyau', desc: 'La mémoire d\'une machine de la Première Vague.', pile: 5 },
  echantillon: { nom: "Échantillon d'ÉDEN", type: 'quete', icone: 'spore', desc: 'Un fragment du Jardin Parfait, scellé dans du verre.', pile: 5 },
  // les clins d'œil de l'épave (docs/histoire.md § 8) : ça ne se vend pas, ça se garde
  cassette: { nom: 'Cassette « Rembobine »', type: 'quete', icone: 'noyau', desc: "Une loutre sur l'étiquette. Quelqu'un l'a écoutée jusqu'à user la bande.", pile: 1 },
  tamagoyle_casse: { nom: 'Tamagoyle cassé', type: 'quete', icone: 'module', desc: "Un petit œuf à trois boutons, l'écran éteint. Joss, à l'atelier, saurait peut-être.", pile: 1 },
  tamagoyle: { nom: 'Tamagoyle', type: 'quete', icone: 'module', desc: 'Une petite gargouille cligne des yeux sur l\'écran. Elle a faim. Joss refuse de dire ce que c\'est.', pile: 1 },
  // les Hauts de Glane
  fil: { nom: 'Fil du Métier', type: 'mat', icone: 'peau', desc: 'Un fil de cuivre et de sève, tiré d\'une Fileuse. Il vibre quand on le tend vers le nord.', pile: 50, prix: 6 },
  bouture: { nom: 'Bouture vive', type: 'mat', icone: 'herbe', desc: 'Une tige coupée sur un Bouturé. Elle cherche la terre.', pile: 50, prix: 5 },
  puce: { nom: 'Puce de recensement', type: 'quete', icone: 'noyau', desc: 'Une puce arrachée à un robot retourné : une ligne de chiffres, un nom de lignée.', pile: 20 },
  trousse: { nom: 'Trousse de soins', type: 'soin', icone: 'trousse', desc: 'Rend 45 % des PV. Touche le bouton pour l\'utiliser.', pile: 10, prix: 12 },
  baume: { nom: 'Baume des Fertiles', type: 'soin', icone: 'baume', desc: 'Rend 70 % des PV.', pile: 10, prix: 22 },
}

export const NOMS_ARME: Record<ClassId, string[]> = {
  fantassin: ["Fusil d'assaut", 'Carabine du Corps', 'Fusil Matricule', 'Ancre-de-feu'],
  medic: ['Pistolet', 'Pistolet de service', 'Pistolet à aiguilles', 'Serment'],
  ingenieur: ['Fusil à pompe', 'Riveteuse', 'Fusil de brèche', 'Marteau-pilon'],
  eclaireur: ['Fusil de précision', 'Carabine longue', 'Fusil de veille', 'Dernier Mot'],
  demolisseur: ['Lance-grenades', 'Tromblon', 'Lance-charges', 'Grand Tonnerre'],
  brouilleur: ['Lance-arcs', 'Émetteur', 'Brouilleur de crête', 'Murmure'],
}
export const NOMS_ARMURE = ['Gilet de toile', 'Plastron renforcé', 'Armure du Corps', 'Carapace de la Première Vague']
export const NOMS_TENUE: Record<'casque' | 'gants' | 'bottes' | 'chassis' | 'canon', string[]> = {
  casque: ['Calot de toile', 'Casque cabossé', 'Casque du Corps', 'Heaume de la Première Vague'],
  gants: ['Mitaines', 'Gants de manœuvre', 'Gants de tireur', 'Poignes du Corps'],
  bottes: ['Brodequins', 'Bottes de marche', 'Bottes de patrouille', 'Bottes du Corps'],
  chassis: ['Châssis de récup', 'Châssis renforcé', 'Châssis blindé', "Châssis d'atelier"],
  canon: ['Canon rafistolé', 'Canon calibré', 'Canon de garde', "Canon d'atelier"],
}

// ------------------------------------------------------------------ affixes, légendaires, ensembles
/** Les affixes : une ligne de plus sur l'objet, tirée dans cette liste (valeur au niveau l : a + b·l, ± 25 %). */
export const AFFIXES: { k: keyof Stats; a: number; b: number; sur?: TypeEquip[] }[] = [
  { k: 'crit', a: 1, b: 0.08 }, { k: 'critDeg', a: 4, b: 0.3 }, { k: 'cdr', a: 1, b: 0.07 }, { k: 'vol', a: 0.4, b: 0.03 },
  { k: 'esquive', a: 2, b: 0.12, sur: ['bottes', 'gants', 'armure', 'casque'] }, { k: 'soin', a: 3, b: 0.2 }, { k: 'zone', a: 3, b: 0.2 },
  { k: 'puissance', a: 3, b: 0.2 }, { k: 'portee', a: 3, b: 0.15, sur: ['arme', 'casque', 'module'] }, { k: 'relever', a: 6, b: 0.3 },
  { k: 'deg', a: 1, b: 0.12 }, { k: 'pv', a: 3, b: 1.1 }, { k: 'red', a: 1, b: 0.08, sur: ['armure', 'casque', 'gants', 'bottes', 'chassis'] },
  { k: 'robot', a: 3, b: 0.25, sur: ['module', 'chassis', 'canon'] }, { k: 'robotPv', a: 3, b: 0.25, sur: ['module', 'chassis', 'canon'] },
]
/** nombre d'affixes selon la rareté */
export const NB_AFFIXES = [0, 1, 2, 3, 3, 2]
/** Les légendaires : un effet chacun, que le monde applique (server/world/equipement.ts). */
export interface LegendaireDef { id: string; base: TypeEquip; nom: string; desc: string; /** ne tombe qu'à partir de ce niveau (les Hauts de Glane : 20) */ niveau?: number }
export const LEGENDAIRES: LegendaireDef[] = [
  { id: 'ricochet', base: 'arme', nom: 'La Dernière Cartouche', desc: 'Un tir sur huit rebondit sur deux ennemis proches.' },
  { id: 'visiere', base: 'casque', nom: 'Visière du Guetteur', desc: 'Tes coups critiques marquent la cible : 25 % de dégâts en plus pendant 4 s.' },
  { id: 'rappel', base: 'armure', nom: 'Cuirasse du Rappel', desc: 'Une fois toutes les 30 s, un coup qui te fait passer sous 25 % de PV libère une onde qui repousse et étourdit 1 s.' },
  { id: 'recycleur', base: 'gants', nom: 'Gantelets du Recycleur', desc: "Chaque ennemi tué rend 1 s de recharge à ton esquive." },
  { id: 'braise', base: 'bottes', nom: 'Semelles de Braise', desc: 'Ton esquive laisse derrière toi un feu de 3 s qui brûle les ennemis.' },
  { id: 'condensateur', base: 'module', nom: 'Condensateur fêlé', desc: "Après une compétence, une chance sur cinq que sa recharge soit remise à zéro." },
  { id: 'porteur', base: 'chassis', nom: 'Châssis du Porteur', desc: 'Si ton robot est à moins de 160 px, il prend 20 % des dégâts qui te sont faits.' },
  { id: 'jumeau', base: 'canon', nom: 'Canon jumeau', desc: 'Ton robot tire deux balles à chaque tir.' },
  // campagne 2 : les Hauts de Glane (à partir du niveau 20) ; ils jouent avec la lecture de la Pépinière et les Glaneurs
  { id: 'fil', base: 'arme', niveau: 20, nom: 'Le Fil du Métier', desc: 'Chaque tir laisse un fil sur une créature des Hauts ; au cinquième, elle est ligotée 1,5 s et les fils tombent.' },
  { id: 'masque_seve', base: 'casque', niveau: 20, nom: 'Masque de sève', desc: 'La Pépinière ne lit pas tes coups : ils ne comptent pas dans sa lecture, et sa réduction ne s\'applique pas à toi.' },
  { id: 'recenseur', base: 'gants', niveau: 20, nom: 'Gants du Recenseur', desc: '4 % de dégâts en plus par source différente utilisée ces 6 dernières secondes (balles, explosions, robot, compétences), jusqu\'à 16 %.' },
  { id: 'sillon', base: 'bottes', niveau: 20, nom: 'Bottes du Sillon', desc: 'Ton esquive te rend 6 % de tes PV par ennemi frôlé (60 px), jusqu\'à 18 %.' },
  { id: 'bobine', base: 'module', niveau: 20, nom: 'Bobine du Tisserand', desc: 'Les Glaneurs ne peuvent pas éteindre ton robot, et il regagne 2 % de ses PV par seconde.' },
]
export const LEG_BY_ID: Record<string, LegendaireDef> = Object.fromEntries(LEGENDAIRES.map((l) => [l.id, l]))
/** Les ensembles : quatre pièces (casque, armure, gants, bottes), un bonus à deux pièces, un effet à quatre. */
export interface EnsembleDef { id: string; nom: string; source: string; deux: Stats; quatre: string; noms: Record<'casque' | 'armure' | 'gants' | 'bottes', string> }
export const ENSEMBLES: EnsembleDef[] = [
  { id: 'couveuse', nom: 'Dépouille de la Couveuse', source: 'La Couveuse', deux: { soin: 12 }, quatre: 'Chaque ennemi que tu tues éclate en une spore qui soigne de 4 % toi et les alliés proches.',
    noms: { casque: 'Crâne de la Couveuse', armure: 'Carapace de la Couveuse', gants: 'Griffes de la Couveuse', bottes: 'Pattes de la Couveuse' } },
  { id: 'engloutisseur', nom: "Mâchoires de l'Engloutisseur", source: "L'Engloutisseur", deux: { deg: 8 }, quatre: 'Toutes les 10 s, ton prochain tir est dévorant : 150 % de dégâts en plus, et il attire les petits ennemis vers l\'impact.',
    noms: { casque: "Mufle de l'Engloutisseur", armure: "Panse de l'Engloutisseur", gants: "Crocs de l'Engloutisseur", bottes: "Écailles de l'Engloutisseur" } },
  { id: 'constance', nom: 'Équipage de la Constance', source: 'La Constance', deux: { robot: 15 }, quatre: 'Tant que ton robot est à moins de 120 px, vous prenez tous deux 15 % de dégâts en moins, et il tire sur ce que tu touches.',
    noms: { casque: 'Casquette de bosco', armure: 'Vareuse du bord', gants: 'Gants de quart', bottes: 'Bottes de pont' } },
  { id: 'trame', nom: 'Trame du Métier', source: 'Les Hauts de Glane', deux: { cdr: 8 }, quatre: 'Chaque source différente que tu utilises tisse un fil (quatre au plus) ; avec les quatre, ta prochaine compétence ne se recharge pas et les fils tombent.',
    noms: { casque: 'Capuche de trame', armure: 'Cotte de chaîne et trame', gants: 'Doigts de navette', bottes: 'Pas de lisière' } },
]
export const SET_BY_ID: Record<string, EnsembleDef> = Object.fromEntries(ENSEMBLES.map((e) => [e.id, e]))
export const PIECES_SET = ['casque', 'armure', 'gants', 'bottes'] as const
export const NOMS_MODULE: Record<string, string[]> = {
  vit: ['Servo de jambe', 'Servo de jambe affûté', 'Jambes de coureur', 'Ressorts du Semeur'],
  robot: ['Relais du robot', 'Relais calibré', 'Lien de lignée', "Cœur d'atelier"],
  deg: ['Viseur', 'Viseur stabilisé', 'Viseur de tireur', 'Œil de la Colonie'],
  pv: ['Plaque dorsale', 'Plaque doublée', 'Bouclier de nuque', 'Ossature greffée'],
}

let seq = 0
export function uid() { return Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 5) }

/** Un objet d'équipement tiré au sort. `R` : tirage (0..1). Rareté 4 : légendaire (o.leg sinon au hasard parmi ceux
 *  de la base) ; 5 : pièce d'ensemble (o.set obligatoire, la base doit être une des quatre pièces). */
export function rollEquip(base: TypeEquip, level: number, rarity: number, cls: ClassId, R: () => number = Math.random, o: { leg?: string; set?: string } = {}): Item {
  const l = Math.max(1, Math.round(level)), r = Math.max(0, Math.min(5, rarity))
  // la qualité : le légendaire et l'ensemble valent un épique, plus leur effet
  const q = 1 + 0.5 * Math.min(3, r)
  const it: Item = { u: uid(), b: base, r, l, s: {}, n: 1 }
  const nr = Math.min(3, r)
  if (base === 'arme') {
    it.c = cls
    it.s.deg = Math.round((4 + l * 1.4) * q)
    if (r >= 1) it.s.cad = Math.round(3 + nr * 3 + R() * 3)
    if (r >= 3) it.s.vit = 4
    it.nom = NOMS_ARME[cls][nr]
  } else if (base === 'armure') {
    it.s.pv = Math.round((6 + l * 3.5) * q)
    if (r >= 1) it.s.red = Math.round(2 + nr * 3)
    it.nom = NOMS_ARMURE[nr]
  } else if (base === 'casque') { it.s.pv = Math.round((2 + l * 1) * q); it.nom = NOMS_TENUE.casque[nr] }
  else if (base === 'gants') { it.s.cad = Math.round((1 + l * 0.08) * q); it.nom = NOMS_TENUE.gants[nr] }
  else if (base === 'bottes') { it.s.vit = Math.round((1.5 + l * 0.06) * q); it.nom = NOMS_TENUE.bottes[nr] }
  else if (base === 'chassis') { it.s.robotPv = Math.round((6 + l * 0.6) * q); it.nom = NOMS_TENUE.chassis[nr] }
  else if (base === 'canon') { it.s.robot = Math.round((6 + l * 0.7) * q); it.nom = NOMS_TENUE.canon[nr] }
  else {
    const kinds = ['vit', 'robot', 'deg', 'pv']
    const k = kinds[Math.floor(R() * kinds.length)]
    if (k === 'vit') it.s.vit = Math.round((3 + l * 0.25) * q)
    if (k === 'robot') it.s.robot = Math.round((6 + l * 0.8) * q)
    if (k === 'deg') it.s.deg = Math.round((2 + l * 0.6) * q)
    if (k === 'pv') it.s.pv = Math.round((4 + l * 2) * q)
    if (nr >= 2) { const k2 = kinds[(kinds.indexOf(k) + 1 + Math.floor(R() * 3)) % 4]; if (k2 === 'pv') it.s.pv = (it.s.pv ?? 0) + Math.round(l * 1.5); else if (k2 === 'deg') it.s.deg = (it.s.deg ?? 0) + Math.round(1 + l * 0.3); else if (k2 === 'vit') it.s.vit = (it.s.vit ?? 0) + 3; else it.s.robot = (it.s.robot ?? 0) + Math.round(4 + l * 0.4) }
    it.nom = NOMS_MODULE[k][nr]
  }
  // les affixes : des lignes différentes, permises sur cette base
  const pool = AFFIXES.filter((a) => !a.sur || a.sur.includes(base))
  for (let i = 0; i < NB_AFFIXES[r] && pool.length; i++) {
    const a = pool.splice(Math.floor(R() * pool.length), 1)[0]
    const v = (a.a + a.b * l) * (0.75 + 0.5 * R()) * (1 + 0.15 * nr)
    it.s[a.k] = (it.s[a.k] ?? 0) + (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10)
  }
  if (r === R_LEGENDAIRE) {
    const choix = LEGENDAIRES.filter((d) => d.base === base && (d.niveau ?? 0) <= l)
    const d = (o.leg && LEG_BY_ID[o.leg]?.base === base ? LEG_BY_ID[o.leg] : null) ?? choix[Math.floor(R() * choix.length)]
    if (d) { it.leg = d.id; it.nom = d.nom } else it.r = 3
  }
  if (r === R_ENSEMBLE) {
    const e = o.set ? SET_BY_ID[o.set] : null
    if (e && (PIECES_SET as readonly string[]).includes(base)) { it.set = e.id; it.nom = e.noms[base as typeof PIECES_SET[number]] } else it.r = 3
  }
  return it
}

export function material(b: string, n = 1): Item { return { u: uid(), b, r: 0, l: 1, s: {}, n } }

export function itemName(it: Item) { return it.nom ?? BASES[it.b]?.nom ?? it.b }
/** la clé de traduction du nom d'un objet (shared/i18n) : les noms tirés au sort sont retrouvés dans leurs listes */
export function itemKey(it: Item): string {
  if (it.nom) {
    if (it.b === 'arme') for (const [c, l] of Object.entries(NOMS_ARME)) { const i = l.indexOf(it.nom); if (i >= 0) return `equip.arme.${c}.${i}` }
    if (it.b === 'armure') { const i = NOMS_ARMURE.indexOf(it.nom); if (i >= 0) return `equip.armure.${i}` }
    if (it.b === 'module') for (const [k, l] of Object.entries(NOMS_MODULE)) { const i = l.indexOf(it.nom); if (i >= 0) return `equip.module.${k}.${i}` }
    if (it.leg && LEG_BY_ID[it.leg]) return `legendaire.${it.leg}.nom`
    if (it.set && SET_BY_ID[it.set]) return `ensemble.${it.set}.${it.b}`
    if (it.b in NOMS_TENUE) { const i = NOMS_TENUE[it.b as keyof typeof NOMS_TENUE].indexOf(it.nom); if (i >= 0) return `equip.${it.b}.${i}` }
  }
  return `objet.${it.b}.nom`
}
export function isEquip(it: Item) { return (TYPES_EQUIP as string[]).includes(BASES[it.b]?.type ?? '') }
export function slotsFor(it: Item): Slot[] { const t = BASES[it.b]?.type; return t === 'module' ? ['module1', 'module2'] : t && (SLOTS as string[]).includes(t) ? [t as Slot] : [] }
/** Un objet du robot (châssis, canon) : il se monte sur le robot, pas sur le soldat. */
export const pourRobot = (it: Item) => it.b === 'chassis' || it.b === 'canon'

/** Ce que paie un marchand pour un objet, et ce qu'il le vend. */
export function sellValue(it: Item) {
  const base = BASES[it.b]
  if (base?.type === 'quete') return 0
  if (base?.prix) return Math.max(1, Math.round(base.prix * it.n * 0.5))
  return Math.round(5 * it.l * (1 + 2 * Math.min(4, it.r)))
}
/** Ce que rend le recyclage d'un objet d'équipement : de la ferraille (banque) et des pièces de robot. */
export function recyclage(it: Item): { ferraille: number; pieces: number } {
  if (!isEquip(it)) return { ferraille: 0, pieces: 0 }
  const r = Math.min(5, it.r)
  return { ferraille: Math.round(3 * it.l * (1 + r)), pieces: [1, 1, 2, 3, 6, 5][r] }
}
export function buyPrice(it: Item) {
  const base = BASES[it.b]
  if (base?.prix) return base.prix * it.n
  return Math.round(5 * it.l * (1 + 2 * it.r) * 4)
}

/** Les caractéristiques cumulées de l'équipement porté, avec les bonus d'ensemble à deux pièces. */
export function totalStats(eq: Equip): Required<Stats> {
  const t = Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Required<Stats>
  for (const s of SLOTS) { const it = eq[s]; if (!it) continue; for (const k of STAT_KEYS) t[k] += it.s[k] ?? 0 }
  for (const [id, n] of Object.entries(piecesSet(eq))) if (n >= 2) for (const [k, v] of Object.entries(SET_BY_ID[id]?.deux ?? {})) t[k as keyof Stats] += v as number
  t.red = Math.min(40, t.red); t.vit = Math.min(30, t.vit); t.cad = Math.min(35, t.cad)
  return t
}
/** combien de pièces de chaque ensemble sont portées */
export function piecesSet(eq: Equip): Record<string, number> {
  const n: Record<string, number> = {}
  for (const s of SLOTS) { const id = eq[s]?.set; if (id) n[id] = (n[id] ?? 0) + 1 }
  return n
}
/** les effets portés : légendaires, et ensembles complets (« set:<id> ») */
export function effetsPortes(eq: Equip): Set<string> {
  const e = new Set<string>()
  for (const s of SLOTS) { const l = eq[s]?.leg; if (l) e.add(l) }
  for (const [id, n] of Object.entries(piecesSet(eq))) if (n >= 4) e.add('set:' + id)
  return e
}

export const STAT_NOMS: Record<keyof Stats, string> = {
  deg: '% dégâts', cad: '% cadence', pv: ' PV', red: '% résistance', vit: '% vitesse', robot: '% dégâts du robot',
  robotPv: '% PV du robot', crit: '% critique', critDeg: '% dégâts critiques', cdr: '% recharge plus rapide', soin: '% soins', zone: '% rayon',
  puissance: '% puissance', portee: '% portée', vol: '% vol de vie', esquive: "% recharge d'esquive plus rapide", relever: '% vitesse pour relever',
}
export function statLines(it: Item) { return (Object.keys(it.s) as (keyof Stats)[]).filter((k) => it.s[k]).map((k) => `+${it.s[k]}${STAT_NOMS[k]}`) }

export const INV_MAX = 30
/** on peut porter un objet jusqu'à ce nombre de niveaux au-dessus du sien */
export const NIVEAU_MARGE = 3

/** Ajoute un objet au sac (les matériaux s'empilent). Rend false si le sac est plein. */
export function addToInv(inv: Item[], it: Item): boolean {
  const pile = BASES[it.b]?.pile
  if (pile) {
    for (const o of inv) if (o.b === it.b && o.n < pile) { const k = Math.min(pile - o.n, it.n); o.n += k; it.n -= k; if (!it.n) return true }
  }
  if (inv.length >= INV_MAX) return false
  inv.push(it)
  return true
}
export function countInv(inv: Item[], b: string) { let n = 0; for (const o of inv) if (o.b === b) n += o.n; return n }
export function takeFromInv(inv: Item[], b: string, n: number) {
  if (countInv(inv, b) < n) return false
  for (let i = inv.length - 1; i >= 0 && n > 0; i--) if (inv[i].b === b) { const k = Math.min(n, inv[i].n); inv[i].n -= k; n -= k; if (!inv[i].n) inv.splice(i, 1) }
  return true
}
