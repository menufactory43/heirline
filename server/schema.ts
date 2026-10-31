// L'état synchronisé avec les clients (Colyseus Schema 5). Les collections marquées .view() ne partent qu'aux
// clients qui les voient : chaque client a sa StateView, mise à jour selon la distance.
import { schema, t } from '@colyseus/schema'

const pos = () => t.quantized({ min: 0, max: 8192, bits: 16 })

export const Player = schema({
  x: t.float32().default(0),
  y: t.float32().default(0),
  angle: t.angle(),
  hp: t.uint16().default(100),
  maxHp: t.uint16().default(100),
  cls: t.uint8().default(0),
  name: t.string().default(''),
  family: t.string().default(''),
  level: t.uint8().default(1),
  etat: t.uint8().default(0),     // 0 debout, 1 à terre, 2 hors du monde
  fx: t.uint8().default(0),       // bits : 1 bouclier, 2 adrénaline
  downT: t.float32().default(0),  // secondes restantes à terre
  bot: t.boolean().default(false),
  num: t.uint16().default(0),     // numéro court, pour reconnaître ses propres balles
  vit: t.uint8().default(74),     // vitesse de marche (équipement compris), pour la prédiction
  dashT: t.float32().default(0),  // la ruée, prédite côté client comme le déplacement
  dashCd: t.float32().default(0),
  dvx: t.float32().default(0),
  dvy: t.float32().default(0),
  arme: t.uint8().default(0),     // rareté de l'arme portée (couleur des tirs)
  monte: t.boolean().default(false), // sur son robot (monture) : plus vite, prédit côté client
  rame: t.boolean().default(false),  // dans le monorail : la position vient du trajet, pas des entrées
  esq: t.uint8().default(0),         // recharge de la ruée plus courte (%, talents), pour la prédiction
}, 'Player')

export const Robot = schema({
  x: pos(), y: pos(),
  angle: t.angle(),
  hp: t.uint16().default(80),
  maxHp: t.uint16().default(80),
  owner: t.string().default(''),
  mode: t.uint8().default(0),     // 0 suit, 1 tient, 2 avant-poste, 3 hors service, 4 tourelle, 5 avant-poste éteint, 6 monture
  level: t.uint8().default(1),
  family: t.string().default(''),
  fx: t.uint8().default(0),       // 1 surcharge
}, 'Robot')

export const Enemy = schema({
  x: pos(), y: pos(),
  kind: t.uint8().default(0),
  hp: t.uint16().default(10),
  maxHp: t.uint16().default(10),
  angle: t.angle(),
  armure: t.boolean().default(false), // la Couveuse est cuirassée tant qu'aucun robot n'est près d'elle
  tint: t.uint32().default(0),
  level: t.uint8().default(1),
  elite: t.boolean().default(false),
  fuit: t.boolean().default(false),
  st: t.uint8().default(0),       // bits : 1 ralenti, 2 étourdi, 4 marqué, 8 en feu
  nom: t.string().default(''),    // un porte-nom du Greffier : le nom du soldat tombé qu'il porte
}, 'Enemy')

export const Bullet = schema({
  x: pos(), y: pos(),
  vx: t.float32().default(0),
  vy: t.float32().default(0),
  team: t.uint8().default(0),     // 0 soldat, 1 ÉDEN, 2 robot ou tourelle
  o: t.uint16().default(0),       // numéro du tireur
  k: t.uint8().default(0),        // aspect : 0 acide, 1 laser rouge, 2 épine, 3 balle de garde
}, 'Bullet')

/** Un habitant : la fiche (nom, visage) est partagée, seul le mouvement passe sur le réseau. */
export const Npc = schema({
  x: pos(), y: pos(),
  act: t.uint8().default(0),      // 0 debout, 1 marche, 2 travaille, 3 discute, 4 dort, 5 escorte, 6 tire
  dir: t.int8().default(1),       // -1 gauche, 1 droite
}, 'Npc')

export const Outpost = schema({
  x: pos(), y: pos(),
  family: t.string().default(''),
  given: t.string().default(''),
  actif: t.boolean().default(true),
  hp: t.uint16().default(0),       // PV partagés par toutes les copies de la carte (service central)
  maxHp: t.uint16().default(0),
}, 'Outpost')

export const State = schema({
  players: t.map(Player).view(),
  robots: t.map(Robot).view(),
  enemies: t.map(Enemy).view(),
  bullets: t.map(Bullet).view(),
  npcs: t.map(Npc).view(),
  heure: t.float32().default(9),    // l'heure d'Ossara, 0..24
  meteo: t.uint8().default(0),      // 0 clair, 1 pluie, 2 brume
  pris: t.map('uint8'),             // nœuds de ressources ramassés (en attente de repousse)
  pannes: t.map('uint8'),           // lampes et balises : 1 réparée
  boss2: t.uint8().default(0),      // l'Engloutisseur : % de PV, 0 s'il dort
  ruches: t.array('float32'),
  lecture: t.string().default(''),  // la lecture de la Pépinière (campagne 2) : "balle:52", ou rien      // le rayon de chaque ruche (tuiles), dans l'ordre de RUCHES : le front est leur bordure
  outposts: t.map(Outpost),
  bossPv: t.uint8().default(0),     // en % ; 0 = pas de Couveuse en vie
  vague: t.uint8().default(0),      // concession : vague en cours
  vagues: t.uint8().default(0),
  fini: t.boolean().default(false),
}, 'State')

export const Input = schema({
  mx: t.quantized({ min: -1, max: 1, bits: 8 }),
  my: t.quantized({ min: -1, max: 1, bits: 8 }),
  aim: t.angle(),
  fire: t.boolean().default(false),
  dash: t.boolean().default(false),
}, 'Input')

export type PlayerT = InstanceType<typeof Player>
export type RobotT = InstanceType<typeof Robot>
export type EnemyT = InstanceType<typeof Enemy>
export type BulletT = InstanceType<typeof Bullet>
export type NpcT = InstanceType<typeof Npc>
export type OutpostT = InstanceType<typeof Outpost>
export type StateT = InstanceType<typeof State>
