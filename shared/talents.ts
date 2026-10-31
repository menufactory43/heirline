// La progression d'un soldat (SPEC § 5) : les compétences qui s'ouvrent avec le niveau, l'arbre de talents de la
// classe, la spécialité (niveau 15, deux par classe, 12 en tout) et sa maîtrise (niveau 30, deux par spécialité, 24 en
// tout). Mêmes données pour le serveur (qui valide tout) et le client (qui affiche).
//
// Un talent n'est qu'un ensemble de bonus par rang (Mods) : sa description se déduit de ses bonus. Une maîtrise
// ajoute des bonus, change les nombres de la compétence de spécialité, et peut porter une règle (drapeau) que le
// monde applique (server/world/competences.ts).
import type { ClassId } from './rules.ts'

/** Les bonus d'un soldat, en points de pourcentage (sauf mention). */
export interface Mods {
  deg: number; cad: number; pv: number; red: number; vit: number; robot: number; robotPv: number
  /** chance de coup critique (%), et dégâts du critique en plus des 50 % de base */
  crit: number; critDeg: number
  /** recharge des compétences plus courte */
  cdr: number
  /** soins donnés */
  soin: number
  /** rayon des compétences de zone */
  zone: number
  /** dégâts des compétences */
  puissance: number
  /** portée des balles */
  portee: number
  /** part des dégâts infligés rendue en PV */
  vol: number
  /** recharge de la ruée plus courte */
  esquive: number
  /** relever un allié plus vite */
  relever: number
}
export const MOD_KEYS: (keyof Mods)[] = ['deg', 'cad', 'pv', 'red', 'vit', 'robot', 'robotPv', 'crit', 'critDeg', 'cdr', 'soin', 'zone', 'puissance', 'portee', 'vol', 'esquive', 'relever']
export const MODS_ZERO = (): Mods => Object.fromEntries(MOD_KEYS.map((k) => [k, 0])) as unknown as Mods
/** les plafonds : au-delà, plus rien */
export const MOD_MAX: Partial<Record<keyof Mods, number>> = { cdr: 40, crit: 40, vol: 12, esquive: 50, red: 60 }

// ------------------------------------------------------------------ les compétences
/** Les niveaux où s'ouvrent les trois emplacements : la 1re compétence, la 2e, puis celle de la spécialité. */
export const SLOT_NIVEAU = [1, 4, 15] as const
export const NIVEAU_SPECIALITE = 15
/** l'héritier d'une lignée qui a déjà suivi une spécialité la retrouve plus tôt (voir Talents.herite) */
export const NIVEAU_SPECIALITE_HERITEE = 10
export const NIVEAU_MAITRISE = 30

/** Les nombres de chaque compétence. Les maîtrises et les talents les modifient (paramsCompetence). */
export interface SkillParams { cd: number; r?: number; dur?: number; dmg?: number; n?: number; red?: number; soin?: number; len?: number; cad?: number; dps?: number; mul?: number; delai?: number; stun?: number }
export const PARAMS: Record<string, SkillParams> = {
  bouclier: { cd: 12, dur: 4, red: 60 },
  grenade: { cd: 8, r: 46, dmg: 55 },
  injection: { cd: 10, r: 90, soin: 35 },
  adrenaline: { cd: 15, r: 70, dur: 4 },
  tourelle: { cd: 16, dur: 12 },
  surcharge: { cd: 14, dur: 6, soin: 30 },
  marquage: { cd: 12, r: 60, dur: 8 },
  piege: { cd: 10, dmg: 60, r: 40, n: 2, dur: 30 },
  mortier: { cd: 11, r: 60, dmg: 90, delai: 1.1 },
  onde: { cd: 9, r: 70, dmg: 30, stun: 0.6 },
  champ: { cd: 13, r: 70, dur: 5 },
  leurre: { cd: 15, dur: 6 },
  // les compétences de spécialité
  bastion: { cd: 18, r: 70, dur: 6, red: 40 },
  percee: { cd: 10, len: 110, dmg: 50, dur: 4, cad: 30 },
  tir_lourd: { cd: 9, dmg: 160, len: 420, delai: 0.5 },
  filet: { cd: 12, r: 55, dur: 2.5 },
  perfusion: { cd: 20, r: 80, dur: 6, soin: 5 },
  toxine: { cd: 12, r: 60, dur: 5, dps: 14 },
  blindage: { cd: 16, dur: 6, red: 50, soin: 40 },
  essaim: { cd: 18, n: 3, dur: 10 },
  tapis: { cd: 14, n: 5, dmg: 70, r: 34 },
  brasier: { cd: 15, r: 60, dur: 5, dps: 22 },
  court_circuit: { cd: 13, r: 60, dmg: 40, dur: 2.5 },
  voile: { cd: 16, dur: 4, mul: 3 },
}

// ------------------------------------------------------------------ spécialités et maîtrises
export interface SpecDef { id: string; cls: ClassId; nom: string; desc: string; competence: string; competenceNom: string; competenceDesc: string }
export interface MaitriseDef {
  id: string; spec: string; nom: string; desc: string
  mods?: Partial<Mods>
  /** ce qui change dans la compétence de spécialité : + pour les nombres ajoutés, × pour les multipliés */
  plus?: Partial<SkillParams>; fois?: Partial<SkillParams>
  /** une règle que le monde applique */
  drapeau?: string
}

export const SPECS: SpecDef[] = [
  { id: 'rempart', cls: 'fantassin', nom: 'Rempart', desc: 'Encaisser, tenir la ligne, protéger le groupe.', competence: 'bastion', competenceNom: 'Bastion', competenceDesc: 'Tu plantes ton fanion : toi et les alliés proches prenez 40 % de dégâts en moins pendant 6 s, et les ennemis autour s\'en prennent à toi.' },
  { id: 'assaut', cls: 'fantassin', nom: 'Assaut', desc: 'Les dégâts et le mouvement : entrer, frapper, ressortir.', competence: 'percee', competenceNom: 'Percée', competenceDesc: 'Tu fonces vers la visée en blessant tout sur ton passage (50 dégâts), puis ta cadence monte de 30 % pendant 4 s.' },
  { id: 'tireur', cls: 'eclaireur', nom: "Tireur d'élite", desc: 'Un tir, une cible, de très loin.', competence: 'tir_lourd', competenceNom: 'Tir perforant', competenceDesc: 'Une demi-seconde de visée, puis un tir qui traverse tout sur sa ligne : 160 dégâts.' },
  { id: 'pisteur', cls: 'eclaireur', nom: 'Pisteur', desc: 'Les pièges, le marquage, la chasse.', competence: 'filet', competenceNom: 'Filet', competenceDesc: 'Un filet lancé vers la visée : les ennemis pris restent immobiles 2,5 s et sont marqués.' },
  { id: 'chirurgien', cls: 'medic', nom: 'Chirurgien de terrain', desc: 'Garder tout le monde debout.', competence: 'perfusion', competenceNom: 'Perfusion', competenceDesc: 'Une aura de soins autour de toi pendant 6 s : 5 % des PV par seconde aux alliés proches, robots compris.' },
  { id: 'biochimiste', cls: 'medic', nom: 'Biochimiste', desc: 'Retourner la chimie d\'ÉDEN contre elle.', competence: 'toxine', competenceNom: 'Toxine', competenceDesc: 'Un nuage vers la visée pendant 5 s : 14 dégâts par seconde, deux fois plus contre la biomasse d\'ÉDEN.' },
  { id: 'mecanicien', cls: 'ingenieur', nom: 'Mécanicien', desc: 'Un robot plus solide, qui encaisse pour toi.', competence: 'blindage', competenceNom: 'Blindage', competenceDesc: 'Ton robot se répare de 40 %, prend 50 % de dégâts en moins et attire les ennemis pendant 6 s.' },
  { id: 'dronier', cls: 'ingenieur', nom: 'Drônier', desc: 'Des essaims de petites machines.', competence: 'essaim', competenceNom: 'Essaim', competenceDesc: 'Trois drones tournent autour de toi pendant 10 s et tirent sur ce qui approche.' },
  { id: 'artificier', cls: 'demolisseur', nom: 'Artificier', desc: 'Les explosifs, en quantité.', competence: 'tapis', competenceNom: 'Tapis de bombes', competenceDesc: 'Cinq charges tombent en ligne vers la visée, l\'une après l\'autre : 70 dégâts chacune.' },
  { id: 'incendiaire', cls: 'demolisseur', nom: 'Incendiaire', desc: 'Le feu, qui tient le terrain.', competence: 'brasier', competenceNom: 'Brasier', competenceDesc: 'Un cercle de feu autour de toi pendant 5 s : 22 dégâts par seconde aux ennemis dedans.' },
  { id: 'parasite', cls: 'brouilleur', nom: 'Parasite', desc: 'Brouiller les signaux d\'ÉDEN.', competence: 'court_circuit', competenceNom: 'Court-circuit', competenceDesc: 'Une décharge vers la visée : 40 dégâts, et les ennemis touchés sont étourdis 2,5 s (un boss est seulement ralenti).' },
  { id: 'spectre', cls: 'brouilleur', nom: 'Spectre', desc: 'Disparaître, frapper, disparaître.', competence: 'voile', competenceNom: 'Voile', competenceDesc: 'Tu disparais 4 s : les ennemis te perdent de vue, et ton premier tir fait trois fois plus de dégâts.' },
]
export const SPEC_BY_ID: Record<string, SpecDef> = Object.fromEntries(SPECS.map((s) => [s.id, s]))
export const specsDe = (cls: ClassId) => SPECS.filter((s) => s.cls === cls)

export const MAITRISES: MaitriseDef[] = [
  { id: 'inebranlable', spec: 'rempart', nom: 'Inébranlable', desc: 'Bastion dure 3 s de plus et retire 55 % des dégâts. +10 % PV.', mods: { pv: 10 }, plus: { dur: 3, red: 15 } },
  { id: 'phalange', spec: 'rempart', nom: 'Phalange', desc: 'Bastion relève aussitôt les alliés à terre dans sa zone. +6 % résistance.', mods: { red: 6 }, drapeau: 'phalange' },
  { id: 'fureur', spec: 'assaut', nom: 'Fureur', desc: 'Chaque ennemi tué rend 1 s de recharge à tes compétences. +8 % cadence.', mods: { cad: 8 }, drapeau: 'fureur' },
  { id: 'belier', spec: 'assaut', nom: 'Bélier', desc: 'Percée fait 90 dégâts et étourdit 1,5 s ce qu\'elle traverse.', fois: { dmg: 1.8 }, plus: { stun: 1.5 } },
  { id: 'faucon', spec: 'tireur', nom: 'Œil de faucon', desc: '+15 % de chance de critique sur les cibles à plus de 200 px. +20 % portée.', mods: { portee: 20 }, drapeau: 'faucon' },
  { id: 'execution', spec: 'tireur', nom: 'Exécution', desc: 'Tir perforant fait trois fois plus de dégâts aux ennemis sous 30 % de PV, et se recharge 3 s plus vite.', plus: { cd: -3 }, drapeau: 'execution' },
  { id: 'meute', spec: 'pisteur', nom: 'Meute', desc: 'Filet pose aussi une mine sous chaque ennemi pris (trois au plus).', drapeau: 'meute' },
  { id: 'traque', spec: 'pisteur', nom: 'Traque', desc: 'Les ennemis marqués prennent 40 % de dégâts en plus au lieu de 25 %. +6 % vitesse.', mods: { vit: 6 }, drapeau: 'traque' },
  { id: 'ange', spec: 'chirurgien', nom: 'Ange gardien', desc: 'Une fois par minute, un allié proche qui devait tomber reste à 1 PV, intouchable 3 s.', drapeau: 'ange' },
  { id: 'transfusion', spec: 'chirurgien', nom: 'Transfusion', desc: 'Perfusion soigne 8 % par seconde, et les compétences des alliés dedans se rechargent deux fois plus vite.', plus: { soin: 3 }, drapeau: 'transfusion' },
  { id: 'contagion', spec: 'biochimiste', nom: 'Contagion', desc: 'Un ennemi qui meurt dans la Toxine fait éclore un nouveau nuage, une fois par nuage.', drapeau: 'contagion' },
  { id: 'acide', spec: 'biochimiste', nom: 'Acide', desc: 'Tes tirs rongent la biomasse : 30 % de dégâts en plus sur 3 s. +5 % dégâts.', mods: { deg: 5 }, drapeau: 'acide' },
  { id: 'forteresse', spec: 'mecanicien', nom: 'Forteresse ambulante', desc: 'Ton robot a 40 % de PV en plus, et Blindage dure 10 s.', mods: { robotPv: 40 }, plus: { dur: 4 } },
  { id: 'artilleur', spec: 'mecanicien', nom: 'Artilleur', desc: 'Ton robot fait 35 % de dégâts en plus, et ses tirs éclatent en zone.', mods: { robot: 35 }, drapeau: 'artilleur' },
  { id: 'nuee', spec: 'dronier', nom: 'Nuée', desc: 'Essaim lâche cinq drones.', plus: { n: 2 } },
  { id: 'kamikaze', spec: 'dronier', nom: 'Kamikaze', desc: 'À la fin d\'Essaim, chaque drone plonge sur l\'ennemi le plus proche et explose (60 dégâts).', drapeau: 'kamikaze' },
  { id: 'chaine', spec: 'artificier', nom: 'Réaction en chaîne', desc: 'Tes explosions ont une chance sur quatre d\'en déclencher une seconde à côté.', drapeau: 'chaine' },
  { id: 'saturation', spec: 'artificier', nom: 'Saturation', desc: 'Tapis de bombes largue huit charges, plus larges.', plus: { n: 3 }, fois: { r: 1.25 } },
  { id: 'phenix', spec: 'incendiaire', nom: 'Phénix', desc: 'Tant que ton Brasier brûle, tu reprends 3 % de PV par seconde.', drapeau: 'phenix' },
  { id: 'napalm', spec: 'incendiaire', nom: 'Napalm', desc: 'Tes tirs enflamment : un ennemi touché brûle 3 s (10 dégâts par seconde).', drapeau: 'napalm' },
  { id: 'surtension', spec: 'parasite', nom: 'Surtension', desc: 'Court-circuit saute sur trois autres ennemis proches.', drapeau: 'surtension' },
  { id: 'sourdine', spec: 'parasite', nom: 'Sourdine', desc: 'Tes tirs ralentissent de 40 %, et un ennemi ralenti prend 15 % de dégâts en plus.', drapeau: 'sourdine' },
  { id: 'ombre', spec: 'spectre', nom: 'Ombre', desc: 'Voile dure 6 s, et tu y vas 30 % plus vite.', plus: { dur: 2 }, drapeau: 'ombre' },
  { id: 'assassin', spec: 'spectre', nom: 'Assassin', desc: 'Le tir qui sort du Voile étourdit 2 s, et un ennemi tué sous le Voile le prolonge de 2 s.', drapeau: 'assassin' },
]
export const MAITRISE_BY_ID: Record<string, MaitriseDef> = Object.fromEntries(MAITRISES.map((m) => [m.id, m]))
export const maitrisesDe = (spec: string) => MAITRISES.filter((m) => m.spec === spec)

// ------------------------------------------------------------------ les talents
/** Un talent : jusqu'à 5 rangs ; chaque rang ajoute ses bonus. Le palier s'ouvre avec les points mis dans l'arbre
 *  (0, 5, 10). L'identifiant complet est « arbre.id » (arbre = classe ou spécialité). */
export interface TalentDef { id: string; arbre: string; nom: string; palier: 0 | 1 | 2; rang: Partial<Mods> }
export const RANG_MAX = 5
export const PALIER_POINTS = [0, 5, 10]

const T = (arbre: string, l: [string, string, 0 | 1 | 2, Partial<Mods>][]): TalentDef[] => l.map(([id, nom, palier, rang]) => ({ id: `${arbre}.${id}`, arbre, nom, palier, rang }))

export const TALENTS: TalentDef[] = [
  // les classes
  ...T('fantassin', [['cuir', 'Cuir épais', 0, { pv: 3 }], ['gachette', 'Gâchette sensible', 0, { cad: 2 }], ['tenir', 'Tenir la ligne', 1, { red: 2 }], ['discipline', 'Discipline', 1, { cdr: 3 }], ['veteran', 'Vétéran', 2, { deg: 3 }], ['endurance', 'Endurance', 2, { esquive: 4 }]]),
  ...T('medic', [['serment', 'Serment', 0, { soin: 4 }], ['constitution', 'Constitution', 0, { pv: 3 }], ['calme', 'Calme', 1, { cdr: 3 }], ['gestes', 'Gestes sûrs', 1, { relever: 10 }], ['pas_vifs', 'Pas vifs', 2, { vit: 2 }], ['aiguilles', 'Aiguilles', 2, { deg: 3 }]]),
  ...T('ingenieur', [['soudure', 'Soudure', 0, { robotPv: 5 }], ['calibrage', 'Calibrage', 0, { robot: 4 }], ['outillage', 'Outillage', 1, { cdr: 3 }], ['tablier', 'Tablier de cuir', 1, { red: 2 }], ['ingenieux', 'Ingénieux', 2, { puissance: 4 }], ['chevrotine', 'Chevrotine', 2, { deg: 3 }]]),
  ...T('eclaireur', [['oeil_vif', 'Œil vif', 0, { deg: 3 }], ['jambes', 'Longues jambes', 0, { vit: 2 }], ['souffle', 'Souffle retenu', 1, { crit: 2 }], ['longue_vue', 'Longue-vue', 1, { portee: 5 }], ['mise_a_mort', 'Mise à mort', 2, { critDeg: 10 }], ['camouflage', 'Camouflage', 2, { esquive: 4 }]]),
  ...T('demolisseur', [['poudre', 'Poudre noire', 0, { puissance: 4 }], ['carrure', 'Carrure', 0, { pv: 3 }], ['souffle_large', 'Souffle large', 1, { zone: 4 }], ['rechargement', 'Rechargement', 1, { cad: 2 }], ['tete_froide', 'Tête froide', 2, { cdr: 3 }], ['grosse_charge', 'Grosse charge', 2, { deg: 3 }]]),
  ...T('brouilleur', [['frequence', 'Fréquence', 0, { cad: 2 }], ['furtif', 'Furtif', 0, { vit: 2 }], ['interference', 'Interférence', 1, { puissance: 4 }], ['siphon', 'Siphon', 1, { vol: 1 }], ['reflexes', 'Réflexes', 2, { esquive: 4 }], ['resonance', 'Résonance', 2, { zone: 4 }]]),
  // les spécialités
  ...T('rempart', [['murs', 'Murs', 0, { pv: 3 }], ['bouclier_lourd', 'Bouclier lourd', 0, { red: 2 }], ['provocation', 'Provocation', 1, { cdr: 3 }], ['carapace', 'Carapace', 1, { pv: 2, red: 1 }], ['garde', 'Garde du corps', 2, { zone: 4 }], ['coup_de_crosse', 'Coup de crosse', 2, { deg: 3 }]]),
  ...T('assaut', [['elan', 'Élan', 0, { vit: 2 }], ['rafale', 'Rafale', 0, { cad: 2 }], ['acharnement', 'Acharnement', 1, { deg: 3 }], ['charge', 'Charge', 1, { esquive: 4 }], ['massacre', 'Massacre', 2, { critDeg: 10 }], ['instinct', 'Instinct', 2, { crit: 2 }]]),
  ...T('tireur', [['calibre', 'Gros calibre', 0, { deg: 3 }], ['stabilite', 'Stabilité', 0, { crit: 2 }], ['balistique', 'Balistique', 1, { portee: 5 }], ['patience', 'Patience', 1, { critDeg: 10 }], ['concentration', 'Concentration', 2, { cdr: 3 }], ['perforant', 'Perforant', 2, { puissance: 4 }]]),
  ...T('pisteur', [['collets', 'Collets', 0, { puissance: 4 }], ['pistes', 'Pistes', 0, { vit: 2 }], ['terrain', 'Lecture du terrain', 1, { zone: 4 }], ['flair', 'Flair', 1, { crit: 2 }], ['embuscade', 'Embuscade', 2, { deg: 3 }], ['sang_froid', 'Sang-froid', 2, { cdr: 3 }]]),
  ...T('chirurgien', [['bistouri', 'Bistouri', 0, { soin: 4 }], ['triage', 'Triage', 0, { relever: 10 }], ['garrot', 'Garrot', 1, { pv: 3 }], ['protocole', 'Protocole', 1, { cdr: 3 }], ['veille', 'Veille', 2, { zone: 4 }], ['miracle', 'Petits miracles', 2, { soin: 4 }]]),
  ...T('biochimiste', [['culture', 'Culture', 0, { puissance: 4 }], ['virulence', 'Virulence', 0, { deg: 3 }], ['incubation', 'Incubation', 1, { zone: 4 }], ['mutagene', 'Mutagène', 1, { crit: 2 }], ['immunite', 'Immunité', 2, { red: 2 }], ['catalyse', 'Catalyse', 2, { cdr: 3 }]]),
  ...T('mecanicien', [['renforts', 'Renforts', 0, { robotPv: 5 }], ['servos', 'Servos', 0, { robot: 4 }], ['boulons', 'Boulons', 1, { red: 2 }], ['entretien', 'Entretien', 1, { cdr: 3 }], ['hydraulique', 'Hydraulique', 2, { robotPv: 5 }], ['surpuissance', 'Surpuissance', 2, { robot: 4 }]]),
  ...T('dronier', [['rotors', 'Rotors', 0, { puissance: 4 }], ['essaim_dense', 'Essaim dense', 0, { cdr: 3 }], ['telemetrie', 'Télémétrie', 1, { crit: 2 }], ['batteries', 'Batteries', 1, { robot: 4 }], ['micro_missiles', 'Micro-missiles', 2, { deg: 3 }], ['escorte', 'Escorte', 2, { red: 2 }]]),
  ...T('artificier', [['meche_courte', 'Mèche courte', 0, { cdr: 3 }], ['charge_creuse', 'Charge creuse', 0, { puissance: 4 }], ['souffle', 'Souffle', 1, { zone: 4 }], ['detonateur', 'Détonateur', 1, { deg: 3 }], ['demineur', 'Démineur', 2, { red: 2 }], ['bouquet', 'Bouquet final', 2, { critDeg: 10 }]]),
  ...T('incendiaire', [['combustible', 'Combustible', 0, { puissance: 4 }], ['bruleur', 'Brûleur', 0, { cad: 2 }], ['ignifuge', 'Peau ignifugée', 1, { red: 2 }], ['tisonnier', 'Tisonnier', 1, { deg: 3 }], ['foyer', 'Foyer', 2, { zone: 4 }], ['cendres', 'Cendres', 2, { vol: 1 }]]),
  ...T('parasite', [['virus', 'Virus', 0, { puissance: 4 }], ['signal', 'Signal saturé', 0, { cdr: 3 }], ['brouillage', 'Brouillage', 1, { zone: 4 }], ['parasitage', 'Parasitage', 1, { vol: 1 }], ['ecrasement', 'Écrasement', 2, { deg: 3 }], ['retour', 'Retour de flamme', 2, { crit: 2 }]]),
  ...T('spectre', [['pas_feutres', 'Pas feutrés', 0, { vit: 2 }], ['lame', 'Lame', 0, { critDeg: 10 }], ['evanescence', 'Évanescence', 1, { esquive: 4 }], ['point_faible', 'Point faible', 1, { crit: 2 }], ['disparition', 'Disparition', 2, { cdr: 3 }], ['dague', 'Dague', 2, { deg: 3 }]]),
]
export const TALENT_BY_ID: Record<string, TalentDef> = Object.fromEntries(TALENTS.map((t) => [t.id, t]))
export const talentsDe = (arbre: string) => TALENTS.filter((t) => t.arbre === arbre)

// ------------------------------------------------------------------ l'état d'un soldat
/** Ce qui est gardé dans la fiche du soldat (soldiers.talents_json). */
export interface Talents {
  /** rang de chaque talent pris */
  r: Record<string, number>
  spec?: string
  maitrise?: string
  /** points en plus, venus de l'ancêtre */
  bonus?: number
  /** la spécialité qu'avait l'ancêtre (même classe) : elle s'ouvre plus tôt */
  herite?: string
}
export const TALENTS_VIDES = (): Talents => ({ r: {} })

export const pointsTotal = (level: number, t: Talents) => Math.max(0, level - 1) + (t.bonus ?? 0)
export const pointsPris = (t: Talents) => Object.values(t.r).reduce((a, b) => a + b, 0)
export const pointsArbre = (t: Talents, arbre: string) => Object.entries(t.r).reduce((a, [id, n]) => a + (TALENT_BY_ID[id]?.arbre === arbre ? n : 0), 0)
export const pointsLibres = (level: number, t: Talents) => pointsTotal(level, t) - pointsPris(t)
export function niveauSpecialite(t: Talents, spec?: string) { return spec && t.herite === spec ? NIVEAU_SPECIALITE_HERITEE : NIVEAU_SPECIALITE }

/** Ce qu'il en coûte (ferraille de la lignée) pour reprendre ses points. */
export const coutRaz = (level: number) => 15 * level

/** Peut-on prendre un rang de plus dans ce talent ? (null si oui, sinon la raison : une clé i18n) */
export function peutPrendre(cls: ClassId, level: number, t: Talents, id: string): string | null {
  const d = TALENT_BY_ID[id]
  if (!d) return 'ui.talents.inconnu'
  if (d.arbre !== cls && d.arbre !== t.spec) return 'ui.talents.autre_arbre'
  if ((t.r[id] ?? 0) >= RANG_MAX) return 'ui.talents.au_max'
  if (pointsLibres(level, t) <= 0) return 'ui.talents.plus_de_points'
  if (pointsArbre(t, d.arbre) < PALIER_POINTS[d.palier]) return 'ui.talents.palier_ferme'
  return null
}
export function peutSpecialiser(cls: ClassId, level: number, t: Talents, spec: string): string | null {
  const s = SPEC_BY_ID[spec]
  if (!s || s.cls !== cls) return 'ui.talents.inconnu'
  if (t.spec) return 'ui.talents.deja_spec'
  if (level < niveauSpecialite(t, spec)) return 'ui.talents.trop_tot'
  return null
}
export function peutMaitriser(level: number, t: Talents, id: string): string | null {
  const m = MAITRISE_BY_ID[id]
  if (!m || m.spec !== t.spec) return 'ui.talents.inconnu'
  if (t.maitrise) return 'ui.talents.deja_maitrise'
  if (level < NIVEAU_MAITRISE) return 'ui.talents.trop_tot'
  return null
}

/** Range une fiche venue de la base ou d'un client : on ne garde que ce qui est permis, dans l'ordre des paliers. */
export function nettoyer(cls: ClassId, level: number, brut: unknown): Talents {
  const b = (brut && typeof brut === 'object' ? brut : {}) as Partial<Talents>
  const t: Talents = { r: {} }
  const bonus = Math.max(0, Math.min(3, Math.floor(Number(b.bonus) || 0)))
  if (bonus) t.bonus = bonus
  if (typeof b.herite === 'string' && SPEC_BY_ID[b.herite]?.cls === cls) t.herite = b.herite
  if (typeof b.spec === 'string' && !peutSpecialiser(cls, level, t, b.spec)) t.spec = b.spec
  if (typeof b.maitrise === 'string' && t.spec && !peutMaitriser(level, t, b.maitrise)) t.maitrise = b.maitrise
  const voulu = b.r && typeof b.r === 'object' ? Object.entries(b.r as Record<string, number>) : []
  voulu.sort((x, y) => (TALENT_BY_ID[x[0]]?.palier ?? 9) - (TALENT_BY_ID[y[0]]?.palier ?? 9))
  for (const [id, n] of voulu) for (let i = 0; i < Math.min(RANG_MAX, Number(n) || 0); i++) { if (peutPrendre(cls, level, t, id)) break; t.r[id] = (t.r[id] ?? 0) + 1 }
  return t
}

/** Les bonus cumulés des talents et de la maîtrise. */
export function modsDe(t: Talents): Mods {
  const m = MODS_ZERO()
  for (const [id, n] of Object.entries(t.r)) { const d = TALENT_BY_ID[id]; if (d) for (const [k, v] of Object.entries(d.rang)) m[k as keyof Mods] += (v as number) * n }
  const ma = t.maitrise ? MAITRISE_BY_ID[t.maitrise] : null
  if (ma?.mods) for (const [k, v] of Object.entries(ma.mods)) m[k as keyof Mods] += v as number
  for (const [k, v] of Object.entries(MOD_MAX)) m[k as keyof Mods] = Math.min(m[k as keyof Mods], v as number)
  return m
}
export const drapeau = (t: Talents, d: string) => !!t.maitrise && MAITRISE_BY_ID[t.maitrise]?.drapeau === d

/** Les compétences d'un soldat, par emplacement : l'id, ou null si l'emplacement n'est pas encore ouvert. */
export function competencesDe(cls: ClassId, level: number, t: Talents, base: [string, string]): [string | null, string | null, string | null] {
  return [
    level >= SLOT_NIVEAU[0] ? base[0] : null,
    level >= SLOT_NIVEAU[1] ? base[1] : null,
    t.spec ? SPEC_BY_ID[t.spec]?.competence ?? null : null,
  ]
}

/** Les nombres d'une compétence pour ce soldat : maîtrise, puis talents (recharge, rayon, puissance, soins). */
export function paramsCompetence(id: string, t: Talents, m: Mods): SkillParams {
  const p: SkillParams = { ...(PARAMS[id] ?? { cd: 10 }) }
  const ma = t.maitrise ? MAITRISE_BY_ID[t.maitrise] : null
  if (ma && SPEC_BY_ID[ma.spec]?.competence === id) {
    for (const [k, v] of Object.entries(ma.plus ?? {})) (p as any)[k] = ((p as any)[k] ?? 0) + (v as number)
    for (const [k, v] of Object.entries(ma.fois ?? {})) if ((p as any)[k] !== undefined) (p as any)[k] *= v as number
  }
  p.cd = Math.max(1, p.cd * (1 - m.cdr / 100))
  if (p.r) p.r *= 1 + m.zone / 100
  if (p.dmg) p.dmg *= 1 + m.puissance / 100
  if (p.dps) p.dps *= 1 + m.puissance / 100
  if (p.soin) p.soin *= 1 + m.soin / 100
  return p
}

/** Une répartition automatique (soldats IA, soldats de test) : la première spécialité, la première maîtrise, et les
 *  talents pris palier par palier, dans l'ordre. */
export function talentsAuto(cls: ClassId, level: number, choix = 0): Talents {
  const t: Talents = { r: {} }
  const sp = specsDe(cls)[choix % 2]
  if (sp && level >= NIVEAU_SPECIALITE) t.spec = sp.id
  if (t.spec && level >= NIVEAU_MAITRISE) t.maitrise = maitrisesDe(t.spec)[choix % 2]?.id
  const ordre = [...talentsDe(cls), ...(t.spec ? talentsDe(t.spec) : [])]
  let garde = 400
  while (pointsLibres(level, t) > 0 && garde-- > 0) {
    const id = ordre.find((d) => !peutPrendre(cls, level, t, d.id))?.id
    if (!id) break
    t.r[id] = (t.r[id] ?? 0) + 1
  }
  return t
}

/** Ce que l'héritier reçoit de l'ancêtre : un point de talent par tranche de 15 niveaux (3 au plus), et la spécialité
 *  de l'ancêtre s'ouvre plus tôt s'il reprend la même classe. */
export function heritage(ancetre: { cls: ClassId; level: number; talents?: Talents | null } | null, cls: ClassId): Talents {
  const t: Talents = { r: {} }
  if (!ancetre) return t
  t.bonus = Math.min(3, Math.floor(ancetre.level / 15))
  if (ancetre.cls === cls && ancetre.talents?.spec) t.herite = ancetre.talents.spec
  return t
}
