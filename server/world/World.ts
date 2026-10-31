// La simulation d'un monde (le secteur ou une concession), sans réseau ni base de données : le salon Colyseus
// l'enveloppe, et la même classe sert aux tests et à la passe des bots qui mesure les concessions.
import { msg, ref, cause, type Texte } from '../../shared/i18n/index.ts'
import { etatRame, quai, type Trajet } from '../../shared/monorail.ts'
import { TILE, PLAYER_R, ROBOT_R, REVIVE_R, REVIVE_S, NEST, HAUTS_X, type Zone } from '../../shared/consts.ts'
import { lineOfSight, shotBlockedAtPx, niveauAt, type GameMap, type Camp } from '../../shared/map.ts'
import {
  CLASSES, CLASS_IDS, ENEMIES, E, ROBOT, moveStep, hits, hpFor, dmgMul, xpToNext, LEVEL_MAX, robotHp, robotDmg,
  enemyHp, enemyDmg, enemyXp, applyMove, vitesseSoldat, type ClassId,
} from '../../shared/rules.ts'
import { totalStats, effetsPortes, type Item, type Equip, type Stats } from '../../shared/items.ts'
import * as eqp from './equipement.ts'
import { CARTES, type CarteId } from '../../shared/monde.ts'
/** les affixes de l'équipement qui s'ajoutent aux bonus des talents (les autres restent dans PSim.st) */
const AFFIXES_MODS = ['robotPv', 'crit', 'critDeg', 'cdr', 'soin', 'zone', 'puissance', 'portee', 'vol', 'esquive', 'relever'] as const
import { zoneAt, deathRule, stepRuches, pushFrontByKill, pushFrontAll, ecartBordure, RUCHES, RAYONS_DEPART, type OutpostLike } from '../../shared/front.ts'
import type { Central } from '../central.ts'
import { estDesHauts, compter, oublier, lue, multLecture, codeLecture, LECTURE, type Source, type Comptes } from '../../shared/lecture.ts'
import { State, Player, Robot, Enemy, Bullet, Outpost, type PlayerT, type RobotT, type EnemyT, type BulletT, type StateT } from '../schema.ts'
import type { Concession } from '../../shared/bricks.ts'
import { ENEMY_BRICKS } from '../../shared/bricks.ts'
import { BotBrain } from './bots.ts'
import { Arene, bossKind } from './arene.ts'
import { clampArene } from '../../shared/motifs.ts'
import { MODS_ZERO, MOD_MAX, TALENTS_VIDES, modsDe, competencesDe, paramsCompetence, talentsAuto, drapeau, type Talents, type Mods } from '../../shared/talents.ts'
import { lancer, stepZones, stepMinuteries, stepStatuts, stepMachine, multDegatsRecus, statuts, ralentir, bruler, etourdir, exploser, surMortDansZone, pvRobot, type Statuts, type ZoneEff } from './competences.ts'

export type InputCmd = { mx: number; my: number; aim: number; fire: boolean; dash?: boolean }

export interface PSim {
  sid: string; num: number; s: PlayerT
  account: string; soldierId: number; given: string; family: string; generation: number
  cls: ClassId; level: number; xp: number; sac: number
  cdFire: number; cd: number[]; dashCd: number; dashT: number; dashVx: number; dashVy: number
  shieldT: number; adrenT: number; invulT: number; healAcc?: number
  /** talents, spécialité, maîtrise (shared/talents.ts) et leurs bonus cumulés */
  talents: Talents; mods: Mods
  /** l'ensemble de la Constance : le robot tire sur ce que son soldat touche */
  cibleRobot?: string
  /** les bonus des seuls talents (applyTalents) ; mods = talents + affixes de l'équipement */
  modsT?: Mods
  /** effets portés (légendaires, ensembles complets) et leurs compteurs (server/world/equipement.ts) */
  eff: Set<string>; effT: Record<string, number>
  /** les compétences par emplacement (null : pas encore ouvert) */
  comps: (string | null)[]
  shieldRed: number
  /** Percée : cadence en plus ; Bastion : zone de protection ; Voile : invisible, premier tir multiplié ; Ange gardien */
  cadT: number; cadK: number; rempartT: number; rempartR: number; rempartRed: number; voileT: number; voileMul: number; angeCd: number
  downT: number; downRule: 'evacuation' | 'mort-definitive' | 'reapparition'; revive: number
  lastKiller: string; lastMoveX: number; lastMoveY: number
  robot: RSim | null
  bot: BotBrain | null
  pending: InputCmd[]
  degatsSubis: number
  inv: Item[]; equip: Equip; st: Required<Stats>
  /** une ruée demandée hors des entrées (bots, ancien message) */
  wantDash: boolean
  /** pilote automatique de test : un joueur dont le soldat est mené par le cerveau des soldats IA */
  auto?: BotBrain | null
  /** soldat de test (bouton « aller voir un boss ») : niveau du boss, rien n'est enregistré, et à terre il est ramené
   *  à Port-Ancre avec sa vraie fiche, sans rien perdre (Secteur.debutTest / finTest) */
  test?: { boss: string; niveau: number; finA?: number } | null
  /** le test vient de finir dans une instance : la vraie fiche ne gagne rien d'ici au départ (XP, ferraille, butin) */
  apresTest?: boolean
  /** le social (server/social.ts) : le groupe (XP et butin partagés), le duel en cours (contre une session) */
  groupe?: string
  duel?: { contre: string; debut: number; fin: number }
  /** en monorail : le trajet et son départ (temps du monde) ; la position en découle, sans entrées ni dégâts */
  rail?: { tr: Trajet; t0: number } | null
}
export interface RSim {
  id: string; r: RobotT; kind: 'robot' | 'tourelle' | 'avant-poste' | 'leurre' | 'mine' | 'drone'
  owner: PSim | null; account: string; level: number
  cd: number; overT: number; offT: number; ttl: number; until: number
  targetT: number; target: ESim | null
  /** il danse (laissé immobile deux minutes sur la place de Port-Ancre, voir Secteur) */
  danse?: boolean
  /** Blindage du mécanicien : moins de dégâts, et il attire les coups */
  blindT: number; blindRed: number
  /** campagne 2 : morsures de Glaneur (à quatre, le robot s'éteint) et leur oubli */
  glane?: number; glaneT?: number
  /** un drone : sa place sur l'orbite ; une mine : sa charge */
  orbite?: number; mine?: { dmg: number; r: number }
}
export interface ESim {
  id: string; e: EnemyT; kind: number; speedMul: number; dmgMul: number
  /** au-delà du plafond de PV (65 000, ce que l'état transporte) : les coups comptent moins d'autant (le raid) */
  resist?: number
  cd: number; thinkT: number; target: { x: number; y: number; hit: (d: number, by: string) => void; alive: () => boolean } | null
  homeX: number; homeY: number; wanderX: number; wanderY: number; idleT: number
  hatchT: number; boss: BossState | null; farT: number; wave: number
  level: number; elite: boolean; dmg: number; camp: string | null; fleeT: number; fleeX: number; fleeY: number; boomT: number; leashT: number
  /** ralentie, étourdie, marquée, en feu, provoquée (competences.ts) ; un boss garde cette part de sa vitesse */
  stt?: Statuts; speedMulStatut?: number
  /** campagne 2 : la dernière source qui l'a touchée (la lecture de la Pépinière), les fils du Fil du Métier, un Bouturé qui a déjà repoussé */
  lastSrc?: Source; fils?: number; repousse?: boolean
  /** une balise glanée : le robot éteint qu'elle remplace (la détruire le rallume) */
  robotGlane?: string
}
export interface BSim {
  id: string; b: BulletT; x: number; y: number; team: number; dmg: number; life: number; ownerP: PSim | null; ownerR: RSim | null; ownerNum: number; src: string; aoe?: { r: number; dmg: number }
  /** les balles des soldats : traverse encore n ennemis, éclate en zone, ralentit, effets de maîtrise, tir sorti du Voile */
  perce?: number; vus?: Set<string>; ricochet?: number; devore?: boolean; zone?: number; ralentit?: number; sourdine?: boolean; napalm?: boolean; acide?: boolean; ox?: number; oy?: number; assassin?: boolean
}
/** Une attaque annoncée au sol. Les zones de la Couveuse : 'grille' (cases de r px dans le rectangle x,y–x2,y2, une
 *  sur deux selon r2), 'colonnes' (bandes verticales de demi-largeur r centrées sur cols, de y à y2), 'anneau'
 *  (entre r2 et r autour de x,y). */
export interface Tele { kind: 'cercle' | 'ligne' | 'grille' | 'colonnes' | 'anneau'; x: number; y: number; x2: number; y2: number; r: number; t: number; total: number; dmg: number; src: string; r2?: number; cols?: number[]; stun?: number
  /** les zones du raid : sp (semis, greffe, taille, desherbage), partage (soldats requis), suit (la greffe suit ce soldat) */
  sp?: 'semis' | 'greffe' | 'taille' | 'desherbage' | 'glane'; partage?: number; suit?: string }
interface BossState { phaseT: number; next: number; spawned: number }

export interface WorldHooks {
  fx(x: number, y: number, ev: any): void
  log(t: Texte, color?: string): void
  reward?(p: PSim, xp: number, scrap: number): void
  levelUp?(p: PSim): void
  bank?(p: PSim, n: number): void
  evacuate?(p: PSim): void
  railFin?(p: PSim): void
  permadeath?(p: PSim, killer: string): void
  /** un duel tombé à 1 PV : jamais à terre, jamais de mort */
  duelFin?(gagnant: PSim, perdant: PSim): void
  outpostDestroyed?(rs: RSim): void
  victory?(): void
  /** une créature tombée : butin et quêtes (le tueur, ou null pour un robot sans maître, une tourelle, un garde) */
  kill?(by: PSim | null, es: ESim, near: PSim[]): void
  /** l'arène de la Couveuse : son état, les motifs de balles, les balles qui ont touché (à tous les clients de la salle) */
  arene?(type: string, msg: any): void
  /** la fin d'un test de boss (mort de test, victoire, départ) : le vrai soldat reprend sa place */
  finTest?(p: PSim, raison: 'mort' | 'victoire' | 'depart'): void
}
/** Une cible qui n'est ni un soldat ni un robot : un habitant escorté. */
export interface ExtraTarget { x: number; y: number; hit(n: number, by: string): void; alive(): boolean }
export interface Life { step(dt: number): void }

export interface WorldOpts { mode: 'secteur' | 'concession'; map: GameMap; concession?: Concession; bossMul?: number; central?: Central | null }

let NEXT = 1
const nid = () => (NEXT++).toString(36)

export class World {
  state: StateT = new State()
  map: GameMap
  mode: 'secteur' | 'concession'
  players = new Map<string, PSim>()
  robots = new Map<string, RSim>()
  enemies = new Map<string, ESim>()
  bullets = new Map<string, BSim>()
  teles: Tele[] = []
  /** les rayons des ruches quand il n'y a pas de service central (tests, bancs) */
  localRuches: number[] = [...RAYONS_DEPART]
  /** la lecture de la Pépinière sans service central (tests, bancs) */
  localLecture: Comptes = [0, 0, 0, 0]
  get lecture(): Comptes { return this.central?.lecture ?? this.localLecture }
  central: Central | null = null
  /** les avant-postes actifs (poches tenues dans la biomasse), recalculés à chaque pas */
  poches: OutpostLike[] = []
  time = 0
  playerNum = 1
  hooks: WorldHooks
  concession?: Concession
  bossRespawnAt = 0
  waveIdx = -1
  waveWait = 0
  rewindFor: ((p: PSim, e: ESim) => { x: number; y: number }) | null = null
  stats = { kills: 0, spawned: 0 }
  frontAcc = 0
  spawnAcc = 0
  camps = new Map<string, { alive: Set<string>; respawnAt: number }>()
  boss2: ESim | null = null
  boss2RespawnAt = 0
  boss2FarT = 0
  life: Life | null = null
  /** l'arène de la Couveuse (seulement sur la carte du nid) */
  arene: Arene | null = null
  extraTargets: (() => ExtraTarget[]) | null = null
  /** les zones des compétences qui durent, et les effets à retardement */
  zones: ZoneEff[] = []
  timers: { t: number; fn: () => void }[] = []
  nid() { return nid() }
  shotBlocked(x: number, y: number) { return shotBlockedAtPx(this.map, x, y) }

  constructor(opts: WorldOpts, hooks: WorldHooks) {
    this.map = opts.map
    this.mode = opts.mode
    this.hooks = hooks
    this.concession = opts.concession
    this.central = opts.central ?? null
    if (this.mode === 'secteur') for (const r of this.ruches) this.state.ruches.push(r)
    if (this.concession) { this.state.vagues = this.concession.vagues.length; this.waveWait = 2 }
    const ca = CARTES[this.map.carte as CarteId]?.arene
    if (ca) this.arene = new Arene(this, ca.profil, ca.heroique)
  }

  /** les rayons des ruches : ceux du service central (partagés par toutes les copies), sinon les nôtres */
  get ruches(): number[] { return this.central?.rayons ?? this.localRuches }
  /** les victoires du raid contre le Semeur (sans service central : celles de cette salle) */
  localSemeur = 0
  get semeurVaincu(): number { return this.central?.semeurVaincu ?? this.localSemeur }
  set semeurVaincu(n: number) { if (this.central) this.central.semeurVaincu = n; else this.localSemeur = n }
  /** les victoires de l'assaut du Métier (campagne 2), comme celles contre le Semeur */
  localGlaneuse = 0
  get glaneuseVaincue(): number { return this.central?.glaneuseVaincue ?? this.localGlaneuse }
  setRuches(values: number[]) {
    const r = this.ruches
    for (let i = 0; i < r.length; i++) if (Number.isFinite(values[i])) r[i] = values[i]
    for (let i = 0; i < r.length; i++) this.state.ruches[i] = r[i]
  }

  zoneOf(x: number, y: number): Zone { return this.mode === 'concession' ? 'concession' : zoneAt(this.ruches, x, y, this.poches, this.map.zoneCarte) }

  // ------------------------------------------------------------------ joueurs
  addPlayer(o: { sid: string; account: string; soldierId: number; given: string; family: string; generation: number; cls: ClassId; level: number; xp: number; bot?: BotBrain | null; x?: number; y?: number; inv?: Item[]; equip?: Equip; sac?: number; talents?: Talents }): PSim {
    const s = new Player()
    const p: PSim = {
      sid: o.sid, num: this.playerNum++, s, account: o.account, soldierId: o.soldierId, given: o.given, family: o.family, generation: o.generation,
      cls: o.cls, level: o.level, xp: o.xp, sac: 0, cdFire: 0, cd: [0, 0, 0], dashCd: 0, dashT: 0, dashVx: 0, dashVy: 0,
      shieldT: 0, adrenT: 0, invulT: 2,
      talents: o.talents ?? (o.bot ? talentsAuto(o.cls, o.level, Math.random() < 0.5 ? 0 : 1) : TALENTS_VIDES()), mods: MODS_ZERO(), eff: new Set(), effT: {}, comps: [null, null, null], shieldRed: 60,
      cadT: 0, cadK: 0, rempartT: 0, rempartR: 0, rempartRed: 0, voileT: 0, voileMul: 1, angeCd: 0, downT: 0, downRule: 'evacuation', revive: 0, lastKiller: '', lastMoveX: 1, lastMoveY: 0,
      robot: null, bot: o.bot ?? null, pending: [], degatsSubis: 0,
      inv: o.inv ?? [], equip: o.equip ?? {}, st: totalStats(o.equip ?? {}), wantDash: false,
    }
    const sp = this.map.points.spawn
    s.x = o.x ?? sp.x + (Math.random() - 0.5) * 24
    s.y = o.y ?? sp.y + (Math.random() - 0.5) * 24
    s.cls = CLASS_IDS.indexOf(o.cls)
    s.name = o.given; s.family = o.family; s.level = o.level
    p.sac = o.sac ?? 0
    this.applyTalents(p)
    s.hp = s.maxHp
    s.bot = !!o.bot
    s.num = p.num
    this.players.set(o.sid, p)
    this.state.players.set(o.sid, s)
    return p
  }

  /** L'équipement porté change les PV max, la vitesse et la couleur des tirs ; les talents s'y ajoutent. */
  applyEquip(p: PSim) {
    p.st = totalStats(p.equip)
    p.eff = effetsPortes(p.equip)
    // les affixes s'ajoutent aux talents (dégâts, cadence, résistance, vitesse et robot restent dans st)
    const m = { ...(p.modsT ?? modsDe(p.talents)) }
    for (const k of AFFIXES_MODS) m[k] += p.st[k]
    for (const [k, v] of Object.entries(MOD_MAX)) m[k as keyof Mods] = Math.min(m[k as keyof Mods], v as number)
    p.mods = m
    const s = p.s
    const ratio = s.maxHp ? s.hp / s.maxHp : 1
    s.maxHp = Math.round((hpFor(p.cls, p.level) + p.st.pv) * (1 + p.mods.pv / 100))
    s.hp = Math.max(s.etat === 0 ? 1 : 0, Math.min(s.maxHp, Math.round(s.maxHp * ratio)))
    this.majVitesse(p)
    s.arme = Math.min(3, p.equip.arme?.r ?? 0)
    // le robot : talents et châssis changent ses PV
    const rb = p.robot
    if (rb && rb.kind === 'robot') { const k = rb.r.maxHp ? rb.r.hp / rb.r.maxHp : 1; rb.r.maxHp = pvRobot(rb.level, p); rb.r.hp = Math.round(rb.r.maxHp * k) }
  }
  /** la vitesse de marche synchronisée (la prédiction du client s'en sert) : équipement, talents, Voile de l'Ombre */
  majVitesse(p: PSim) {
    const ombre = p.voileT > 0 && drapeau(p.talents, 'ombre') ? 1.3 : 1
    p.s.vit = Math.round(CLASSES[p.cls].vitesse * (1 + Math.min(45, p.st.vit + p.mods.vit) / 100) * ombre)
    p.s.esq = Math.round(p.mods.esquive)
  }
  /** Les talents changent : bonus, compétences ouvertes, PV du robot ; puis l'équipement par-dessus. */
  applyTalents(p: PSim) {
    p.modsT = modsDe(p.talents); p.mods = { ...p.modsT }
    p.comps = competencesDe(p.cls, p.level, p.talents, [CLASSES[p.cls].competences[0].id, CLASSES[p.cls].competences[1].id])
    this.applyEquip(p)
  }

  removePlayer(sid: string) {
    const p = this.players.get(sid)
    if (!p) return
    if (p.robot && p.robot.kind === 'robot') this.removeRobot(p.robot.id)
    for (const r of [...this.robots.values()]) if (r.owner === p && r.kind !== 'robot') this.removeRobot(r.id)
    this.zones = this.zones.filter((z) => z.owner !== p)
    ;(p.s as any).__gone = true
    this.players.delete(sid)
    this.state.players.delete(sid)
  }

  giveRobot(p: PSim, level: number, x?: number, y?: number) {
    const r = new Robot()
    const rs: RSim = { id: 'r' + nid(), r, kind: 'robot', owner: p, account: p.account, level, cd: 0, overT: 0, offT: 0, ttl: 0, until: 0, targetT: 0, target: null, blindT: 0, blindRed: 0 }
    r.x = x ?? p.s.x - 12; r.y = y ?? p.s.y + 6
    r.owner = p.sid; r.level = level; r.maxHp = pvRobot(level, p); r.hp = r.maxHp; r.family = p.family; r.mode = 0
    p.robot = rs
    this.robots.set(rs.id, rs)
    this.state.robots.set(rs.id, r)
    return rs
  }

  addOutpost(account: string, family: string, given: string, level: number, x: number, y: number, hp: number, until: number, maxHp = robotHp(level) * 2): RSim {
    const r = new Robot()
    const rs: RSim = { id: 'a' + account, r, kind: 'avant-poste', owner: null, account, level, cd: 0, overT: 0, offT: 0, ttl: 0, until, targetT: 0, target: null, blindT: 0, blindRed: 0 }
    r.x = x; r.y = y; r.level = level; r.maxHp = maxHp; r.hp = Math.max(1, Math.min(r.maxHp, hp)); r.family = family
    r.mode = Date.now() < until ? 2 : 5
    this.robots.set(rs.id, rs)
    this.state.robots.set(rs.id, r)
    const o = new Outpost()
    o.x = x; o.y = y; o.family = family; o.given = given; o.actif = r.mode === 2; o.hp = r.hp; o.maxHp = r.maxHp
    this.state.outposts.set(rs.id, o)
    return rs
  }

  removeRobot(id: string) {
    const rs = this.robots.get(id)
    if (!rs) return
    if (rs.owner && rs.owner.robot === rs) rs.owner.robot = null
    ;(rs.r as any).__gone = true
    this.robots.delete(id)
    this.state.robots.delete(id)
    this.state.outposts.delete(id)
  }

  // ------------------------------------------------------------------ actions
  /** Ruée demandée hors des entrées (bots) : appliquée à la prochaine entrée. */
  dash(p: PSim, _dx = 0, _dy = 0) { if (p.s.etat === 0 && p.s.dashCd <= 0) p.wantDash = true }

  /** Une compétence, par emplacement (0, 1 : celles de la classe ; 2 : celle de la spécialité). */
  skill(p: PSim, i: number, tx?: number, ty?: number) {
    if (p.rail) return
    const id = p.comps[i]
    if (!id || p.s.etat !== 0 || p.cd[i] > 0) return
    this.mount(p, false)
    const P = paramsCompetence(id, p.talents, p.mods)
    const ok = lancer(this, p, id, P, tx, ty)
    p.cd[i] = ok ? P.cd : 1
    if (ok) eqp.surCompetence(this, p, i)
  }

  /** Monter sur son robot, ou en descendre. La selle (une quête de l'atelier) est vérifiée par le salon. */
  mount(p: PSim, on: boolean) {
    const r = p.robot
    if (!on) {
      if (!p.s.monte) return false
      p.s.monte = false
      if (r && r.kind === 'robot' && r.r.mode === 6) { r.r.mode = 0; const a = p.s.angle + Math.PI * 0.75; r.r.x = p.s.x + Math.cos(a) * 12; r.r.y = p.s.y + Math.sin(a) * 12; if (hits(this.map, r.r.x, r.r.y, ROBOT_R)) { r.r.x = p.s.x; r.r.y = p.s.y } }
      return true
    }
    if (p.s.monte || p.s.etat !== 0 || !r || r.kind !== 'robot' || r.r.mode === 3) return false
    p.s.monte = true
    r.r.mode = 6; r.r.x = p.s.x; r.r.y = p.s.y + 1
    this.hooks.fx(p.s.x, p.s.y, { k: 'sk', s: 'surcharge', x: p.s.x, y: p.s.y, r: 14 })
    return true
  }

  order(p: PSim) {
    const r = p.robot
    if (!r || r.kind !== 'robot' || r.r.mode === 3 || r.r.mode === 6) return
    r.r.mode = r.r.mode === 0 ? 1 : 0
    this.hooks.fx(r.r.x, r.r.y, { k: 'txt', x: r.r.x, y: r.r.y - 12, s: msg(r.r.mode === 1 ? 'srv.robot.je_tiens' : 'srv.robot.je_te_suis'), c: '#7fd6ff' })
  }

  heal(p: PSim, n: number, discret = false) {
    if (p.s.etat !== 0) return
    p.healAcc = (p.healAcc ?? 0) + n
    const avant = p.s.hp
    p.s.hp = Math.min(p.s.maxHp, Math.round(p.s.hp + p.healAcc))
    p.healAcc -= p.s.hp - avant
    if (p.s.hp >= p.s.maxHp) p.healAcc = 0
    if (!discret) this.hooks.fx(p.s.x, p.s.y, { k: 'txt', x: p.s.x, y: p.s.y - 14, s: '+' + Math.round(n), c: '#7dff9a' })
  }

  standUp(p: PSim, frac: number) {
    p.s.etat = 0; p.s.hp = Math.max(1, Math.round(p.s.maxHp * frac)); p.revive = 0; p.s.downT = 0; p.invulT = 1.5
    this.hooks.fx(p.s.x, p.s.y, { k: 'txt', x: p.s.x, y: p.s.y - 16, s: msg('srv.monde.releve'), c: '#ffd36b' })
  }

  // ------------------------------------------------------------------ dégâts
  /** un coup de duel : l'armure compte, mais on ne descend jamais sous 1 PV ; à 1 PV, le duel est perdu */
  coupDuel(p: PSim, n: number, by: PSim) {
    if (p.invulT > 0 || p.s.dashT > 0) return
    if (p.shieldT > 0) n *= 1 - p.shieldRed / 100
    n *= 1 - Math.min(60, p.st.red + p.mods.red) / 100
    const k = Math.max(1, Math.round(n))
    p.s.hp = Math.max(1, p.s.hp - k)
    this.hooks.fx(p.s.x, p.s.y, { k: 'aie', x: p.s.x, y: p.s.y, n: k, sid: p.sid })
    if (p.s.hp <= 1) this.hooks.duelFin?.(by, p)
  }

  damagePlayer(p: PSim, n: number, by: string) {
    if (p.s.etat !== 0 || p.invulT > 0 || p.s.dashT > 0 || p.rail) return
    if (p.shieldT > 0) n *= 1 - p.shieldRed / 100
    // le Bastion d'un rempart proche (le plus fort)
    let rempart = 0
    for (const q of this.players.values()) if (q.rempartT > 0 && q.s.etat === 0 && dist(q.s, p.s) < q.rempartR) rempart = Math.max(rempart, q.rempartRed)
    n *= 1 - rempart / 100
    n *= 1 - Math.min(60, p.st.red + p.mods.red) / 100
    n = Math.max(1, Math.round(eqp.reduire(this, p, n)))
    // Ange gardien : un médic proche qui la maîtrise retient un coup fatal, une fois par minute
    if (n >= p.s.hp) for (const q of this.players.values()) {
      if (q.angeCd > 0 || q.s.etat !== 0 || dist(q.s, p.s) > 140 || !drapeau(q.talents, 'ange')) continue
      q.angeCd = 60; p.s.hp = 1; p.invulT = 3
      this.hooks.fx(p.s.x, p.s.y, { k: 'sk', s: 'ange', x: p.s.x, y: p.s.y })
      return
    }
    p.s.hp = Math.max(0, p.s.hp - n)
    p.degatsSubis += n
    this.mount(p, false)
    p.lastKiller = by
    this.hooks.fx(p.s.x, p.s.y, { k: 'aie', x: p.s.x, y: p.s.y, n, sid: p.sid })
    eqp.apresCoup(this, p)
    // diagnostic de l'arène : la source de chaque dégât reçu par un joueur (pas un soldat IA)
    if (this.arene?.ferme && !p.bot) console.log(`[arene] ${p.given} ${p.family} -${n} (${p.s.hp}/${p.s.maxHp}) par ${by} en ${Math.round(p.s.x)},${Math.round(p.s.y)} t=${this.time.toFixed(1)}${p.auto ? ' auto' : ''}`)
    if (p.s.hp <= 0) this.knockDown(p)
  }

  knockDown(p: PSim) {
    this.mount(p, false)
    const rule = p.test ? { aTerre: 0, ensuite: 'reapparition' as const } : deathRule(this.zoneOf(p.s.x, p.s.y))
    p.s.etat = 1
    p.downRule = rule.ensuite
    p.downT = rule.ensuite === 'reapparition' ? 2.5 : rule.aTerre
    p.s.downT = p.downT
    p.revive = 0
    this.hooks.fx(p.s.x, p.s.y, { k: 'aterre', x: p.s.x, y: p.s.y, sid: p.sid, regle: rule.ensuite })
  }

  damageEnemy(es: ESim, n: number, by: PSim | null, dot = false, crit = false, src: Source = 'competence') {
    // un porte-nom du Greffier ne se tue pas : on le rend en allant le toucher (Arene.stepPorteNom)
    if (es.kind === E.PORTENOM && this.arene && n < 1e6) return
    if (es.e.hp <= 0) return
    if (es.e.armure) n *= 0.3
    // campagne 2 : la lecture de la Pépinière (la source lue fait 30 % de moins aux créatures des Hauts), les Gants du Recenseur
    if (estDesHauts(es.kind)) {
      if (!by?.eff.has('masque_seve')) { n *= multLecture(es.kind, src, lue(this.lecture).src); es.lastSrc = src } else es.lastSrc = undefined
    }
    if (by) { by.effT['src_' + src] = 6; if (by.eff.has('recenseur')) n *= 1 + 0.04 * eqp.sourcesRecentes(by) }
    n *= multDegatsRecus(es) * (es.resist ?? 1)
    n = Math.max(1, Math.round(n))
    es.e.hp = Math.max(0, es.e.hp - n)
    if (by && by.mods.vol > 0 && by.s.etat === 0) this.heal(by, n * by.mods.vol / 100, true)
    this.hooks.fx(es.e.x, es.e.y, { k: 'touche', x: es.e.x, y: es.e.y, n, a: es.e.armure ? 1 : 0, ...(dot ? { d: 1 } : {}), ...(crit ? { c: 1 } : {}) })
    if (ENEMIES[es.kind].passif && by) { es.fleeT = 4; es.fleeX = by.s.x; es.fleeY = by.s.y }
    // une bête de camp blessée appelle les autres
    if (es.camp && by) for (const id of this.camps.get(es.camp)?.alive ?? []) { const o = this.enemies.get(id); if (o && !o.target && !ENEMIES[o.kind].passif) o.thinkT = 0 }
    if (es.e.hp <= 0) this.killEnemy(es, by)
  }

  damageRobot(rs: RSim, n: number) {
    const r = rs.r
    if (r.mode === 3 || r.mode === 5 || r.mode === 6 || r.mode === 8 || r.mode === 9) return
    if (rs.kind === 'avant-poste' && this.central) {
      // les PV d'un avant-poste sont partagés par toutes les copies : le service central les tient
      r.hp = this.central.hitOutpost(rs.id, Math.round(n))
      const o = this.state.outposts.get(rs.id); if (o) o.hp = r.hp
      this.hooks.fx(r.x, r.y, { k: 'touche', x: r.x, y: r.y, n: Math.round(n), m: 1 })
      if (r.hp <= 0) { this.hooks.fx(r.x, r.y, { k: 'boum', x: r.x, y: r.y, r: 26 }); this.removeRobot(rs.id) }
      return
    }
    if (rs.blindT > 0) n *= 1 - rs.blindRed / 100
    r.hp = Math.max(0, r.hp - Math.round(n))
    this.hooks.fx(r.x, r.y, { k: 'touche', x: r.x, y: r.y, n: Math.round(n), m: 1 })
    if (r.hp > 0) return
    if (rs.kind === 'leurre') { this.hooks.fx(r.x, r.y, { k: 'sk', s: 'leurre_fin', x: r.x, y: r.y }); this.removeRobot(rs.id); return }
    if (rs.kind === 'robot') { r.mode = 3; rs.offT = 15; this.hooks.fx(r.x, r.y, { k: 'panne', x: r.x, y: r.y }) }
    else if (rs.kind === 'tourelle') { this.hooks.fx(r.x, r.y, { k: 'boum', x: r.x, y: r.y, r: 16 }); this.removeRobot(rs.id) }
    else { this.hooks.fx(r.x, r.y, { k: 'boum', x: r.x, y: r.y, r: 26 }); this.hooks.outpostDestroyed?.(rs); this.removeRobot(rs.id) }
  }

  killEnemy(es: ESim, by: PSim | null) {
    const def = ENEMIES[es.kind]
    this.stats.kills++
    eqp.surKill(this, by, es)
    this.hooks.fx(es.e.x, es.e.y, { k: 'mort', x: es.e.x, y: es.e.y, kind: es.kind, el: es.elite ? 1 : 0 })
    if (es.lastSrc && estDesHauts(es.kind)) this.compterLecture(es)
    // le Bouturé laisse un pot : il repousse en 8 s si on ne le casse pas (une seule fois)
    if (es.kind === E.BOUTURE && !es.repousse && this.mode === 'secteur') { for (let i = 0; i < (es.elite ? 2 : 1); i++) { const p = this.spawnEnemy(E.POT, es.e.x + (i ? 10 : 0), es.e.y + (i ? 6 : 0), { level: es.level }); if (p) p.hatchT = 8 } }
    if (this.mode === 'secteur') {
      if (def.famille === 'eden') { if (this.central) this.central.killNear(es.e.x, es.e.y); else pushFrontByKill(this.ruches, es.e.x, es.e.y) }
      if (es.kind === E.COUVEUSE) {
        if (this.central) this.central.pushAll(3, 1); else pushFrontAll(this.ruches, 3, 1)
        this.hooks.log(msg('srv.monde.couveuse_tombee'), '#ffd36b')
        this.bossRespawnAt = this.time + 120
      }
      if (es.kind === E.SEMEUR) {
        // l'offensive du Semeur gagnée : la Grande Ruche recule fort, les autres un peu
        if (this.central) { this.central.rayons[0] -= 12; this.central.pushAll(4, 1); this.central.semeurVaincu++ } else { this.ruches[0] -= 12; pushFrontAll(this.ruches, 4, 1); this.localSemeur++ }
        this.hooks.log(msg('srv.raid.semeur_tombe'), '#ffd36b')
      }
      if (es.kind === E.GLANEUSE) {
        // l'assaut du Métier gagné : le foyer du Métier recule fort, les trois foyers des Hauts un peu
        const i = RUCHES.findIndex((r) => r.id === 'foyer_metier')
        if (this.central) { this.central.rayons[i] -= 12; this.central.pushAll(4, 2); this.central.glaneuseVaincue++ } else { this.ruches[i] -= 12; pushFrontAll(this.ruches, 4, 2); this.localGlaneuse++ }
        this.hooks.log(msg('srv.raid.glaneuse_tombe'), '#ffd36b')
      }
      if (es.kind === E.ENGLOUTISSEUR) {
        this.hooks.log(msg('srv.monde.englou_tombe'), '#ffd36b')
        this.boss2 = null; this.boss2RespawnAt = this.time + 600; this.state.boss2 = 0
      }
      const zone = this.zoneOf(es.e.x, es.e.y)
      const mul = zone === 'dela' || zone === 'nid' ? 2 : 1
      const xp = enemyXp(es.kind, es.level, es.elite) * mul
      const scrap = Math.round(def.ferraille * (1 + 0.15 * (es.level - 1)) * (es.elite ? 3 : 1) * mul)
      const nearby = [...this.players.values()].filter((q) => !q.bot && q.s.etat === 0 && dist(q.s, es.e) < 320)
      if (def.boss) for (const q of nearby) this.giveXp(q, xp, scrap)
      else if (by?.groupe) {
        // un groupe : l'XP du coup est partagée entre les membres proches, avec un bonus de 25 % par membre de plus
        const grp = [...this.players.values()].filter((q) => !q.bot && q.groupe === by.groupe && q.s.etat === 0 && dist(q.s, es.e) < 640)
        if (!grp.includes(by)) grp.push(by)
        const part = Math.round(xp * (1 + 0.25 * (grp.length - 1)) / grp.length)
        for (const q of grp) this.giveXp(q, part, q === by ? scrap : 0)
        for (const q of nearby) if (!grp.includes(q)) this.giveXp(q, Math.round(xp / 2), 0)
      } else {
        if (by && !by.bot) this.giveXp(by, xp, scrap)
        for (const q of nearby) if (q !== by) this.giveXp(q, Math.round(xp / 2), 0)
      }
      this.hooks.kill?.(by?.apresTest ? null : by, es, nearby.filter((q) => !q.apresTest))
      if (es.camp) {
        const c = this.camps.get(es.camp)
        if (c) { c.alive.delete(es.id); if (!c.alive.size) c.respawnAt = this.time + 60 + Math.random() * 40 }
      }
    }
    if (es.kind === E.COUVEUSE) this.state.bossPv = 0
    // les maîtrises qui se déclenchent sur une créature tombée
    surMortDansZone(this, es)
    if (by && drapeau(by.talents, 'fureur')) for (let i = 0; i < by.cd.length; i++) by.cd[i] = Math.max(0, by.cd[i] - 1)
    if (by && by.voileT > 0 && drapeau(by.talents, 'assassin')) by.voileT += 2
    this.arene?.mort(es)
    this.removeEnemy(es.id)
  }

  giveXp(p: PSim, xp: number, scrap: number) {
    if (p.apresTest) return
    p.sac += scrap
    p.xp += xp
    let up = false
    while (p.level < LEVEL_MAX && p.xp >= xpToNext(p.level)) { p.xp -= xpToNext(p.level); p.level++; up = true }
    if (up) {
      p.s.level = p.level; this.applyTalents(p); p.s.hp = p.s.maxHp
      this.hooks.fx(p.s.x, p.s.y, { k: 'niveau', x: p.s.x, y: p.s.y, sid: p.sid, n: p.level })
      this.hooks.levelUp?.(p)
    }
    this.hooks.reward?.(p, xp, scrap)
  }

  // ------------------------------------------------------------------ ennemis
  spawnEnemy(kind: number, x: number, y: number, o: { hpMul?: number; speedMul?: number; tint?: number; wave?: number; level?: number; elite?: boolean; camp?: string } = {}): ESim {
    const level = Math.max(1, Math.round(o.level ?? 1)), elite = !!o.elite
    const e = new Enemy()
    e.x = x; e.y = y; e.kind = kind
    const pv = enemyHp(kind, level, elite) * (o.hpMul ?? 1)
    e.maxHp = Math.min(65000, Math.round(pv)); e.hp = e.maxHp
    e.tint = o.tint ?? 0
    e.level = level; e.elite = elite
    const es: ESim = {
      id: 'e' + nid(), e, kind, speedMul: (o.speedMul ?? 1) * (elite ? 1.1 : 1), dmgMul: 1, cd: 1 + Math.random(), thinkT: Math.random() * 0.4, target: null,
      homeX: x, homeY: y, wanderX: x, wanderY: y, idleT: 0, hatchT: kind === E.OEUF ? 4 : 0,
      boss: ENEMIES[kind].boss ? { phaseT: 2.5, next: 0, spawned: 0 } : null, farT: 0, wave: o.wave ?? -1,
      level, elite, dmg: enemyDmg(kind, level, elite), camp: o.camp ?? null, fleeT: 0, fleeX: 0, fleeY: 0, boomT: 0, leashT: 0,
    }
    if (pv > 65000) es.resist = 65000 / pv
    this.enemies.set(es.id, es)
    this.state.enemies.set(es.id, e)
    this.stats.spawned++
    return es
  }

  removeEnemy(id: string) { const es = this.enemies.get(id); if (es) (es.e as any).__gone = true; this.enemies.delete(id); this.state.enemies.delete(id) }

  addTele(t: Tele) {
    this.teles.push(t)
    this.hooks.fx(t.x, t.y, { k: 'tele', f: t.kind, x: t.x, y: t.y, x2: t.x2, y2: t.y2, r: t.r, t: t.total, ami: t.dmg < 0 ? 1 : 0, r2: t.r2, cols: t.cols, sp: t.sp, partage: t.partage, suit: t.suit })
  }

  inTele(t: Tele, x: number, y: number, pad = 0) {
    if (t.kind === 'cercle') return Math.hypot(x - t.x, y - t.y) < t.r + pad
    if (t.kind === 'anneau') { const d = Math.hypot(x - t.x, y - t.y); return d < t.r + pad && d > (t.r2 ?? 0) - pad }
    if (t.kind === 'colonnes') return y > t.y - pad && y < t.y2 + pad && (t.cols ?? []).some((c) => Math.abs(x - c) < t.r + pad)
    if (t.kind === 'grille') {
      if (x < t.x || x > t.x2 || y < t.y || y > t.y2) return false
      // la case sous le soldat (pas de marge : les cases se touchent, on se tient dans une case sûre)
      return (Math.floor((x - t.x) / t.r) + Math.floor((y - t.y) / t.r)) % 2 === (t.r2 ?? 0)
    }
    return distToSeg(x, y, t.x, t.y, t.x2, t.y2) < t.r + pad
  }

  // ------------------------------------------------------------------ le pas de simulation
  step(dt: number) {
    this.time += dt
    if (this.mode === 'secteur') {
      if (this.central) this.syncCentral()
      this.poches = []
      for (const rs of this.robots.values()) if (rs.kind === 'avant-poste') this.poches.push({ x: rs.r.x, y: rs.r.y, actif: rs.r.mode === 2 })
    }
    for (const p of this.players.values()) this.stepPlayer(p, dt)
    for (const rs of [...this.robots.values()]) this.stepRobot(rs, dt)
    for (const es of [...this.enemies.values()]) this.stepEnemy(es, dt)
    this.stepBullets(dt)
    this.stepTeles(dt)
    stepZones(this, dt)
    stepMinuteries(this)
    this.arene?.step(dt)
    if (this.mode === 'secteur') { this.stepSector(dt); this.life?.step(dt) }
    else this.stepConcession(dt)
  }

  stepPlayer(p: PSim, dt: number) {
    const s = p.s
    eqp.step(p, dt)
    // Transfusion : dans la Perfusion d'un chirurgien qui la maîtrise, les compétences se rechargent deux fois plus vite
    let cdK = 1
    for (const z of this.zones) if (z.kind === 'perfusion' && drapeau(z.owner.talents, 'transfusion') && Math.hypot(z.x - s.x, z.y - s.y) < z.r) { cdK = 2; break }
    p.cdFire -= dt; for (let i = 0; i < p.cd.length; i++) p.cd[i] = Math.max(0, p.cd[i] - dt * cdK)
    p.shieldT = Math.max(0, p.shieldT - dt); p.adrenT = Math.max(0, p.adrenT - dt); p.invulT = Math.max(0, p.invulT - dt)
    p.cadT = Math.max(0, p.cadT - dt); p.rempartT = Math.max(0, p.rempartT - dt); p.angeCd = Math.max(0, p.angeCd - dt)
    if (p.voileT > 0) { p.voileT = Math.max(0, p.voileT - dt); if (!p.voileT) this.majVitesse(p) }
    s.fx = (p.shieldT > 0 ? 1 : 0) | (p.adrenT > 0 ? 2 : 0) | (p.rempartT > 0 ? 4 : 0) | (p.voileT > 0 ? 8 : 0) | (p.cadT > 0 ? 16 : 0)
    if (p.bot) p.pending.push(p.bot.think(this, p, dt))
    else if (p.auto) p.pending = [p.auto.think(this, p, dt)]
    const cmds = p.pending; p.pending = []
    if (p.rail) { this.stepRail(p); return }
    if (s.etat === 1) { this.stepDowned(p, dt); return }
    if (s.etat !== 0) return
    const def = CLASSES[p.cls]
    // même vitesse que la prédiction du client : la valeur synchronisée
    let fire = false
    for (const c of cmds) {
      if (p.wantDash) { c.dash = true; p.wantDash = false }
      const wasDash = s.dashT > 0
      if (c.fire && s.monte) this.mount(p, false) // on descend pour tirer
      applyMove(s, c, dt, vitesseSoldat(s), this.map, s.esq)
      if (!wasDash && s.dashT > 0) { p.invulT = Math.max(p.invulT, 0.22); eqp.surEsquive(this, p) }
      if (this.arene?.ferme) clampArene(s, this.arene.borne)
      if (Math.abs(c.mx) + Math.abs(c.my) > 0.1) { p.lastMoveX = c.mx; p.lastMoveY = c.my }
      s.angle = c.aim
      fire ||= c.fire
    }
    if (fire && p.cdFire <= 0) {
      p.cdFire = def.arme.cadence * (1 - Math.min(60, p.st.cad + p.mods.cad + (p.cadT > 0 ? p.cadK : 0)) / 100)
      this.shoot(p)
    }
  }

  /** Le monorail : le soldat attend sur le quai, monte, puis suit la rame ; à l'arrivée, il descend sur le quai. */
  stepRail(p: PSim) {
    const { tr, t0 } = p.rail!
    const e = etatRame(tr, this.time - t0)
    const s = p.s
    s.rame = true; s.dashT = 0
    if (e.phase === 'fini' || (e.phase === 'descente' && !e.abord)) {
      const q = quai(tr.vers)
      s.x = q.x; s.y = q.y; s.rame = false
      p.rail = null
      p.invulT = Math.max(p.invulT, 1)
      if (p.robot?.kind === 'robot' && p.robot.r.mode !== 6) { p.robot.r.x = q.x - 12; p.robot.r.y = q.y + 6 }
      this.hooks.railFin?.(p)
      return
    }
    if (e.abord) { s.x = e.x; s.y = e.y; s.angle = e.a }
  }

  /** Partir en monorail (le trajet déjà calculé et vérifié par la salle). */
  partirRail(p: PSim, tr: Trajet) {
    if (p.s.dashT > 0) p.s.dashT = 0
    const q = quai(tr.de)
    p.s.x = q.x; p.s.y = q.y
    p.rail = { tr, t0: this.time }
  }

  stepDowned(p: PSim, dt: number) {
    p.downT -= dt
    p.s.downT = Math.max(0, p.downT)
    if (p.downRule !== 'reapparition') {
      let helper = 0
      for (const q of this.players.values()) if (q !== p && q.s.etat === 0 && dist(q.s, p.s) < REVIVE_R) helper = Math.max(helper, 1 + q.mods.relever / 100)
      p.revive = helper ? p.revive + dt * helper : Math.max(0, p.revive - dt * 0.5)
      if (p.revive >= REVIVE_S) { this.standUp(p, 0.4); return }
    }
    if (p.downT > 0) return
    if (p.downRule === 'reapparition' && p.test && this.hooks.finTest) {
      p.s.etat = 0; p.s.hp = p.s.maxHp; p.invulT = 2
      this.hooks.finTest(p, 'mort')
      return
    }
    if (p.downRule === 'reapparition') {
      const sp = this.map.points.spawn
      p.s.x = sp.x; p.s.y = sp.y; p.s.etat = 0; p.s.hp = p.s.maxHp; p.invulT = 2
      if (p.robot) { p.robot.r.x = sp.x - 10; p.robot.r.y = sp.y + 6 }
    } else if (p.downRule === 'evacuation') {
      const perdu = p.sac
      p.sac = 0
      const sp = this.map.points.spawn
      p.s.x = sp.x; p.s.y = sp.y; p.s.etat = 0; p.s.hp = p.s.maxHp; p.invulT = 2
      if (p.robot && p.robot.kind === 'robot') { p.robot.r.x = sp.x - 12; p.robot.r.y = sp.y + 6; p.robot.r.mode = 0; p.robot.r.hp = p.robot.r.maxHp; p.robot.offT = 0 }
      this.hooks.fx(p.s.x, p.s.y, { k: 'evac', sid: p.sid, perdu })
      this.hooks.evacuate?.(p)
    } else {
      p.s.etat = 2
      this.hooks.permadeath?.(p, p.lastKiller || 'ÉDEN')
    }
  }

  shoot(p: PSim) {
    const w = CLASSES[p.cls].arme
    const a = p.s.angle
    // le tir qui sort du Voile : multiplié, et il lève le Voile
    let mul = 1, assassin = false
    if (p.voileT > 0) { mul = p.voileMul; assassin = drapeau(p.talents, 'assassin'); p.voileT = 0; this.majVitesse(p) }
    const dmg = w.degats * dmgMul(p.level) * (1 + (p.st.deg + p.mods.deg) / 100) * mul
    const life = w.portee * (1 + p.mods.portee / 100)
    for (let i = 0; i < w.balles; i++) {
      const aa = a + (Math.random() - 0.5) * 2 * w.dispersion
      const bs = this.addBullet(p.s.x + Math.cos(a) * 9, p.s.y + Math.sin(a) * 9, Math.cos(aa) * w.vitesse, Math.sin(aa) * w.vitesse, 0, dmg, life, p, null)
      if (!bs) continue
      bs.ox = p.s.x; bs.oy = p.s.y
      if (w.perce) { bs.perce = w.perce; bs.vus = new Set() }
      if (w.zone) bs.zone = w.zone * (1 + p.mods.zone / 100)
      if (w.ralentit) { const sd = drapeau(p.talents, 'sourdine'); bs.ralentit = sd ? 0.4 : w.ralentit; bs.sourdine = sd }
      if (drapeau(p.talents, 'napalm')) bs.napalm = true
      if (drapeau(p.talents, 'acide')) bs.acide = true
      if (assassin) bs.assassin = true
      eqp.surTir(p, bs)
    }
  }

  /** Une balle d'un soldat touche une créature : critique, effets de l'arme et des maîtrises. */
  touche(bs: BSim, es: ESim) {
    const p = bs.ownerP
    let n = bs.dmg, crit = false
    if (p) {
      let ch = p.mods.crit
      if (drapeau(p.talents, 'faucon') && bs.ox !== undefined && Math.hypot(es.e.x - bs.ox, es.e.y - (bs.oy ?? 0)) > 200) ch += 15
      if (ch > 0 && Math.random() * 100 < ch) { crit = true; n *= 1.5 + p.mods.critDeg / 100 }
    }
    if (bs.zone) { exploser(this, p, es.e.x, es.e.y, bs.zone, n); return }
    // l'Artilleur : les tirs du robot éclatent
    if (bs.ownerR?.kind === 'robot' && bs.ownerR.owner && drapeau(bs.ownerR.owner.talents, 'artilleur')) { exploser(this, bs.ownerR.owner, es.e.x, es.e.y, 20, n, { chaine: false }); return }
    this.damageEnemy(es, n, p ?? bs.ownerR?.owner ?? null, false, crit, bs.ownerR ? 'robot' : 'balle')
    eqp.surTouche(this, bs, es, crit, n)
    if (es.e.hp <= 0) return
    if (bs.ralentit) ralentir(es, bs.ralentit, 1, bs.sourdine)
    if (bs.napalm) bruler(es, 3, 10 * dmgMul(p?.level ?? 1), p)
    if (bs.acide && ENEMIES[es.kind].famille === 'eden') bruler(es, 3, n * 0.3 / 3, p)
    if (bs.assassin) etourdir(es, 2)
  }

  addBullet(x: number, y: number, vx: number, vy: number, team: number, dmg: number, life: number, ownerP: PSim | null, ownerR: RSim | null, k = 0, src = ''): BSim | null {
    if (shotBlockedAtPx(this.map, x, y)) return null
    const b = new Bullet()
    b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.team = team; b.k = k
    // le numéro du joueur qui tire, ou du maître du robot : le client en tire la classe et le palier des effets
    b.o = ownerP?.num ?? ownerR?.owner?.num ?? 0
    const bs: BSim = { id: 'b' + nid(), b, x, y, team, dmg, life, ownerP, ownerR, ownerNum: ownerP?.num ?? 0, src }
    this.bullets.set(bs.id, bs)
    this.state.bullets.set(bs.id, b)
    this.onBullet?.(bs)
    return bs
  }
  onBullet: ((bs: BSim) => void) | null = null

  stepBullets(dt: number) {
    // une seule copie des créatures par pas (et non une par balle) ; une créature tombée pendant le pas est sautée
    const ens = [...this.enemies.values()]
    for (const bs of [...this.bullets.values()]) {
      const b = bs.b
      const x0 = bs.x, y0 = bs.y
      const x1 = x0 + b.vx * dt, y1 = y0 + b.vy * dt
      bs.life -= dt
      let done = bs.life <= 0
      // murs : deux échantillons sur le trajet
      for (const k of [0.5, 1]) if (!done && shotBlockedAtPx(this.map, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k)) {
        done = true; this.hooks.fx(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, { k: 'mur', x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k })
      }
      if (!done) {
        if (bs.team === 1) {
          for (const p of this.players.values()) {
            if (p.s.etat !== 0) continue
            if (distToSeg(p.s.x, p.s.y, x0, y0, x1, y1) < PLAYER_R + 2) { this.damagePlayer(p, bs.dmg, bs.src || cause('srv.tueur.cracheur')); done = true; break }
          }
          if (!done && this.extraTargets) for (const t of this.extraTargets()) {
            if (t.alive() && distToSeg(t.x, t.y, x0, y0, x1, y1) < PLAYER_R + 2) { t.hit(bs.dmg, bs.src); done = true; break }
          }
          if (!done) for (const rs of this.robots.values()) {
            if (rs.r.mode === 3 || rs.r.mode === 5 || rs.r.mode === 6 || rs.r.mode === 8 || rs.r.mode === 9) continue
            if (distToSeg(rs.r.x, rs.r.y, x0, y0, x1, y1) < ROBOT_R + 2) { this.damageRobot(rs, bs.dmg); done = true; break }
          }
        } else {
          // un duel consenti : les balles du duelliste touchent son adversaire (et lui seul)
          const o = bs.ownerP, du = o?.duel
          if (o && du && this.time >= du.debut) {
            const q = this.players.get(du.contre)
            if (q && q.duel?.contre === o.sid && q.s.etat === 0 && distToSeg(q.s.x, q.s.y, x0, y0, x1, y1) < PLAYER_R + 2) { this.coupDuel(q, bs.dmg, o); done = true }
          }
          // tri grossier d'abord : une créature loin du trajet (au-delà de ce qu'elle a pu parcourir pendant le retour en
          // arrière de 400 ms) est sautée sans calculer sa position passée ni la distance au segment
          const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, demi = Math.abs(x1 - x0) / 2 + Math.abs(y1 - y0) / 2 + 80
          if (!done) for (const es of ens) {
            if (bs.vus?.has(es.id) || es.e.hp <= 0 || !this.enemies.has(es.id)) continue
            if (Math.abs(es.e.x - cx) > demi + 40 || Math.abs(es.e.y - cy) > demi + 40) continue
            const pos = bs.ownerP && !bs.ownerP.bot && this.rewindFor ? this.rewindFor(bs.ownerP, es) : es.e
            const r = ENEMIES[es.kind].rayon + 2
            if (distToSeg(pos.x, pos.y, x0, y0, x1, y1) < r) {
              this.touche(bs, es)
              if (bs.perce && bs.perce > 0) { bs.perce--; bs.vus!.add(es.id); continue }
              done = true; break
            }
          }
        }
      }
      if (!done && bs.zone && bs.life <= dt && bs.team === 0) { done = true; exploser(this, bs.ownerP, x1, y1, bs.zone, bs.dmg) }
      if (done) { this.bullets.delete(bs.id); this.state.bullets.delete(bs.id) }
      else { bs.x = x1; bs.y = y1 } // la position synchronisée reste celle du départ : le client extrapole
    }
  }

  stepTeles(dt: number) {
    if (!this.teles.length) return
    const keep: Tele[] = []
    for (const t of this.teles) {
      t.t -= dt
      // la greffe suit son soldat, puis se fige 0,9 s avant d'éclater (le temps de s'écarter)
      if (t.suit && t.t > 0.9) { const q = this.players.get(t.suit); if (q && q.s.etat === 0) { t.x = q.s.x; t.y = q.s.y } }
      if (t.t > 0) { keep.push(t); continue }
      this.hooks.fx(t.x, t.y, { k: 'boom', f: t.kind, x: t.x, y: t.y, x2: t.x2, y2: t.y2, r: t.r, ami: t.dmg < 0 ? 1 : 0, r2: t.r2, cols: t.cols, sp: t.sp, src: t.src })
      if (t.dmg < 0) { // grenade d'un soldat : touche ÉDEN
        const by = this.players.get(t.src) ?? null
        for (const es of [...this.enemies.values()]) if (this.inTele(t, es.e.x, es.e.y, ENEMIES[es.kind].rayon)) { this.damageEnemy(es, -t.dmg, by, false, false, 'explosion'); if (t.stun && es.e.hp > 0) etourdir(es, t.stun) }
        if (by && t.kind === 'cercle' && drapeau(by.talents, 'chaine') && Math.random() < 0.25) { const a = Math.random() * Math.PI * 2; exploser(this, by, t.x + Math.cos(a) * t.r * 0.8, t.y + Math.sin(a) * t.r * 0.8, t.r * 0.8, -t.dmg * 0.6, { chaine: false }) }
      } else if (t.sp && this.arene?.boomSp(t)) {
        // traité par l'arène (raid)
      } else {
        for (const p of this.players.values()) if (this.inTele(t, p.s.x, p.s.y, PLAYER_R)) this.damagePlayer(p, t.dmg, t.src)
        for (const rs of [...this.robots.values()]) if (this.inTele(t, rs.r.x, rs.r.y, ROBOT_R)) this.damageRobot(rs, t.dmg * 0.6)
      }
    }
    this.teles = keep
  }

  // ------------------------------------------------------------------ robots
  stepRobot(rs: RSim, dt: number) {
    const r = rs.r
    if (stepMachine(this, rs, dt)) return
    rs.cd -= dt; rs.overT = Math.max(0, rs.overT - dt); rs.targetT -= dt; rs.blindT = Math.max(0, rs.blindT - dt)
    if (rs.glane && (rs.glaneT = (rs.glaneT ?? 0) - dt) <= 0) rs.glane = 0
    if (rs.kind === 'robot' && rs.owner?.eff.has('bobine') && r.mode !== 3 && r.hp < r.maxHp) r.hp = Math.min(r.maxHp, r.hp + r.maxHp * 0.02 * dt)
    r.fx = (rs.overT > 0 ? 1 : 0) | (rs.danse ? 2 : 0) | (rs.blindT > 0 ? 4 : 0)
    if (rs.kind === 'tourelle') { rs.ttl -= dt; if (rs.ttl <= 0) { this.hooks.fx(r.x, r.y, { k: 'boum', x: r.x, y: r.y, r: 10 }); this.removeRobot(rs.id); return } }
    if (rs.kind === 'avant-poste') {
      const actif = Date.now() < rs.until
      if (!actif && r.mode === 2) { r.mode = 5; const o = this.state.outposts.get(rs.id); if (o) o.actif = false }
      if (!actif) return
    }
    if (r.mode === 3) {
      rs.offT -= dt
      if (rs.offT <= 0) { r.mode = 0; r.hp = Math.round(r.maxHp * 0.5) }
      return
    }
    // le soldat est en monorail : son robot (monté ou suiveur) voyage avec lui
    if (rs.kind === 'robot' && rs.owner?.rail) { r.x = rs.owner.s.x; r.y = rs.owner.s.y + 1; return }
    // en monture : le robot porte son soldat, il ne tire pas
    if (r.mode === 6) {
      if (!rs.owner || !rs.owner.s.monte) { r.mode = 0; return }
      r.x = rs.owner.s.x; r.y = rs.owner.s.y + 1; r.angle = rs.owner.s.angle
      return
    }
    // déplacement du robot compagnon
    if (rs.kind === 'robot' && rs.owner) {
      const o = rs.owner.s
      let tx = r.x, ty = r.y
      if (o.etat === 1) { tx = o.x + 8; ty = o.y } // il vient protéger son soldat à terre
      else if (r.mode === 0) { const a = o.angle + Math.PI * 0.75; tx = o.x + Math.cos(a) * 16; ty = o.y + Math.sin(a) * 16 }
      const d = Math.hypot(tx - r.x, ty - r.y)
      if (d > 4) {
        const sp = ROBOT.vitesse * (d > 80 ? 1.8 : 1) * (rs.owner.adrenT > 0 ? 1.4 : 1)
        moveStep(r, (tx - r.x) / d, (ty - r.y) / d, dt, Math.min(sp, d / dt), this.map, ROBOT_R)
        if (d > 260) { r.x = o.x; r.y = o.y } // trop loin, coincé : il recolle à son soldat
      }
    }
    // tir
    if (rs.targetT <= 0) {
      rs.targetT = 0.3
      const range = rs.kind === 'tourelle' ? 190 : ROBOT.portee
      let best: ESim | null = null, bd = range
      for (const es of this.enemies.values()) {
        const d = Math.hypot(es.e.x - r.x, es.e.y - r.y)
        if (d < bd && lineOfSight(this.map, r.x, r.y, es.e.x, es.e.y)) { bd = d; best = es }
      }
      // l'équipage de la Constance : il tire sur ce que son soldat touche, s'il le voit
      const f = rs.kind === 'robot' && rs.owner?.cibleRobot && rs.owner.eff.has('set:constance') ? this.enemies.get(rs.owner.cibleRobot) : null
      if (f && Math.hypot(f.e.x - r.x, f.e.y - r.y) < range && lineOfSight(this.map, r.x, r.y, f.e.x, f.e.y)) best = f
      rs.target = best
    }
    const t = rs.target
    if (t && this.enemies.has(t.id)) {
      r.angle = Math.atan2(t.e.y - r.y, t.e.x - r.x)
      if (rs.cd <= 0) {
        const tourelle = rs.kind === 'tourelle'
        rs.cd = tourelle ? 0.3 : rs.kind === 'avant-poste' ? 0.6 : (rs.overT > 0 ? ROBOT.cadence / 2 : ROBOT.cadence)
        const dmg = (tourelle ? 7 * dmgMul(rs.level) * (1 + (rs.owner?.mods.puissance ?? 0) / 100) : robotDmg(rs.level)) * (1 + ((rs.owner?.st.robot ?? 0) + (rs.owner?.mods.robot ?? 0)) / 100)
        const v = 340
        this.addBullet(r.x + Math.cos(r.angle) * 6, r.y + Math.sin(r.angle) * 6, Math.cos(r.angle) * v, Math.sin(r.angle) * v, 2, dmg, 0.65, null, rs)
        // le Canon jumeau : une seconde balle, un peu décalée
        if (rs.kind === 'robot' && rs.owner?.eff.has('jumeau')) { const b2 = r.angle + 0.08; this.addBullet(r.x + Math.cos(b2) * 6, r.y + Math.sin(b2) * 6, Math.cos(b2) * v, Math.sin(b2) * v, 2, dmg, 0.65, null, rs) }
      }
    }
  }

  // ------------------------------------------------------------------ campagne 2
  /** un Glaneur cherche d'abord les robots (le temps de choisir sa cible) */
  glaneurCherche = false
  /** une morsure de Glaneur sur un robot : à la quatrième en 6 s, le robot s'éteint (la Bobine du Tisserand protège) */
  glaner(ref: any) {
    const rs = ref && 'r' in ref && !('s' in ref) ? ref as RSim : null
    if (!rs || rs.kind !== 'robot' || rs.r.mode === 3 || rs.owner?.eff.has('bobine')) return
    rs.glane = (rs.glane ?? 0) + 1; rs.glaneT = 6
    this.hooks.fx(rs.r.x, rs.r.y, { k: 'txt', x: rs.r.x, y: rs.r.y - 14, s: '·'.repeat(rs.glane), c: '#c48bff' })
    if (rs.glane >= 4) { rs.glane = 0; rs.r.mode = 3; rs.offT = 6; this.hooks.fx(rs.r.x, rs.r.y, { k: 'panne', x: rs.r.x, y: rs.r.y }) }
  }
  /** une créature des Hauts tombée : la Pépinière compte sa source (double près d'un bourgeon-espion) */
  compterLecture(es: ESim) {
    if (es.kind === E.BOURGEON) { compter(this.lecture, es.lastSrc!, 0, true); return }
    let pres = false
    for (const o of this.enemies.values()) if (o !== es && o.kind === E.BOURGEON && o.e.hp > 0 && Math.hypot(o.e.x - es.e.x, o.e.y - es.e.y) < LECTURE.rayonBourgeon) { pres = true; break }
    compter(this.lecture, es.lastSrc!, pres ? 2 : 1)
  }

  // ------------------------------------------------------------------ ÉDEN
  targetsNear(x: number, y: number, range: number) {
    let best: ESim['target'] = null, bd = range
    for (const p of this.players.values()) {
      if (p.s.etat !== 0 || p.voileT > 0) continue
      const d = Math.hypot(p.s.x - x, p.s.y - y)
      if (d < bd) { bd = d; best = { x: p.s.x, y: p.s.y, hit: (n, by) => this.damagePlayer(p, n, by), alive: () => p.s.etat === 0 && this.players.has(p.sid) } ; (best as any).ref = p }
    }
    for (const rs of this.robots.values()) {
      if (rs.r.mode === 3 || rs.r.mode === 5 || rs.r.mode === 6 || rs.r.mode === 8 || rs.r.mode === 9) continue
      // il préfère les soldats ; un leurre ou un robot blindé attire les coups
      const d = Math.hypot(rs.r.x - x, rs.r.y - y) * (rs.kind === 'leurre' ? 0.35 : rs.blindT > 0 ? 0.5 : this.glaneurCherche && rs.kind === 'robot' ? 0.6 : 1.15)
      if (d < bd) { bd = d; best = { x: rs.r.x, y: rs.r.y, hit: (n) => this.damageRobot(rs, n), alive: () => this.robots.has(rs.id) && rs.r.mode !== 3 } ; (best as any).ref = rs }
    }
    if (this.extraTargets) for (const t of this.extraTargets()) {
      if (!t.alive()) continue
      const d = Math.hypot(t.x - x, t.y - y) * 0.9 // l'escorté attire les coups
      if (d < bd) { bd = d; best = { x: t.x, y: t.y, hit: t.hit, alive: t.alive }; (best as any).ref = { s: t } }
    }
    return best
  }

  stepEnemy(es: ESim, dt: number) {
    const e = es.e, def = ENEMIES[es.kind]
    es.cd -= dt; es.thinkT -= dt
    if (es.kind === E.OEUF) {
      es.hatchT -= dt
      if (es.hatchT <= 0) {
        this.hooks.fx(e.x, e.y, { k: 'eclosion', x: e.x, y: e.y })
        for (let i = 0; i < 2; i++) this.spawnEnemy(E.RAMPANT, e.x + (i ? 6 : -6), e.y, { wave: es.wave, tint: e.tint, level: es.level })
        this.removeEnemy(es.id)
      }
      return
    }
    if (es.kind === E.POT) {
      // dans la Serre, un pot ne pousse que s'il reste seul (personne à moins de 56 px)
      if (this.arene?.ferme && this.arene.dedans(e.x, e.y) && [...this.players.values()].some((p) => p.s.etat === 0 && Math.hypot(p.s.x - e.x, p.s.y - e.y) < 56)) return
      es.hatchT -= dt
      if (es.hatchT <= 0) {
        this.hooks.fx(e.x, e.y, { k: 'eclosion', x: e.x, y: e.y })
        const b = this.spawnEnemy(E.BOUTURE, e.x, e.y, { level: es.level })
        if (b) { b.repousse = true; b.e.hp = b.e.maxHp = Math.round(b.e.maxHp * 0.6) }
        this.removeEnemy(es.id)
      }
      return
    }
    if (es.kind === E.PORTENOM && this.arene) { stepStatuts(this, es, dt); this.arene.stepPorteNom(es, dt); return } // un nom appelé par le Greffier
    if (es.kind === E.SAC) { stepStatuts(this, es, dt); return } // une pièce de la Couveuse : l'arène la mène
    const garde = stepStatuts(this, es, dt)
    if (es.boss) es.speedMulStatut = garde
    else if (garde <= 0) return
    // un boss ralenti vit au ralenti (hors arène : ses motifs y restent réglés à la seconde près)
    if (es.boss) { const bdt = dt * Math.max(0.4, garde); if (this.arene && es === this.arene.boss) this.arene.stepBoss(es, dt); else if (es.kind === E.ENGLOUTISSEUR) this.stepBoss2(es, bdt); else this.stepBoss(es, bdt); return }
    // le Gonflé amorcé : il éclate
    if (es.boomT > 0) {
      es.boomT -= dt
      if (es.boomT <= 0) { this.hooks.fx(e.x, e.y, { k: 'eclosion', x: e.x, y: e.y }); this.removeEnemy(es.id); this.onCampLoss(es) }
      return
    }
    let mx = 0, my = 0
    if (def.passif) {
      // une bête paisible : elle broute, et détale quand on la blesse
      es.fleeT = Math.max(0, es.fleeT - dt)
      e.fuit = es.fleeT > 0
      if (es.fleeT > 0) {
        const d = Math.hypot(e.x - es.fleeX, e.y - es.fleeY) || 1
        mx = (e.x - es.fleeX) / d; my = (e.y - es.fleeY) / d
        moveStep(e, mx, my, dt, def.vitesse * 1.6, this.map, def.rayon)
        e.angle = Math.atan2(my, mx)
        return
      }
      this.wander(es, dt, 70, 0.35)
      return
    }
    // retarget
    const aggro = (def.tir ? 210 : def.famille === 'faune' ? 160 : 190) + (es.elite ? 40 : 0)
    // provoqué (Bastion, Leurre, Blindage) : il va vers celui qui l'appelle
    const tt = es.stt?.taunt
    if (tt && es.stt!.tauntT > 0 && es.thinkT <= 0) {
      es.thinkT = 0.3
      if ('sid' in tt) { const q = tt; if (q.s.etat === 0 && this.players.has(q.sid)) { es.target = { x: q.s.x, y: q.s.y, hit: (n, by) => this.damagePlayer(q, n, by), alive: () => q.s.etat === 0 && this.players.has(q.sid) }; (es.target as any).ref = q } }
      else { const rr = tt; if (this.robots.has(rr.id)) { es.target = { x: rr.r.x, y: rr.r.y, hit: (n) => this.damageRobot(rr, n), alive: () => this.robots.has(rr.id) && rr.r.mode !== 3 }; (es.target as any).ref = rr } }
    } else if (es.thinkT <= 0) {
      es.thinkT = 0.4 + Math.random() * 0.2
      this.glaneurCherche = es.kind === E.GLANEUR
      const t = this.targetsNear(e.x, e.y, aggro)
      this.glaneurCherche = false
      es.target = t && lineOfSight(this.map, e.x, e.y, t.x, t.y) ? t : (es.target && es.target.alive() && Math.hypot(es.target.x - e.x, es.target.y - e.y) < aggro * 1.5 ? es.target : null)
      if (es.target) { const ref = (es.target as any).ref; es.target.x = ref.s ? ref.s.x : ref.r.x; es.target.y = ref.s ? ref.s.y : ref.r.y }
      // une bête de camp ne poursuit pas jusqu'au bout du monde
      if (es.camp && Math.hypot(e.x - es.homeX, e.y - es.homeY) > 420) { es.target = null; es.leashT = 4 }
    }
    if (es.leashT > 0) {
      es.leashT -= dt
      const d = Math.hypot(es.homeX - e.x, es.homeY - e.y)
      if (d > 8) moveStep(e, (es.homeX - e.x) / d, (es.homeY - e.y) / d, dt, def.vitesse * 1.3, this.map, def.rayon)
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.25 * dt)
      return
    }
    if (es.target && (es.target as any).ref?.voileT > 0) es.target = null
    const t = es.target
    if (t && t.alive()) {
      const ref = (t as any).ref
      const tx = ref.s ? ref.s.x : ref.r.x, ty = ref.s ? ref.s.y : ref.r.y
      const d = Math.hypot(tx - e.x, ty - e.y)
      e.angle = Math.atan2(ty - e.y, tx - e.x)
      if (def.tir) {
        if (d > 130) { mx = (tx - e.x) / d; my = (ty - e.y) / d } else if (d < 80) { mx = -(tx - e.x) / d; my = -(ty - e.y) / d }
        if (es.cd <= 0 && d < def.portee) {
          es.cd = def.cadence * (es.elite ? 0.75 : 1)
          const v = def.tir.v
          const shots = es.elite ? [-0.12, 0, 0.12] : [0]
          if (es.kind === E.FILEUSE && (es.wave = (es.wave + 1) % 3) === 0) {
            // la Fileuse tend un fil : une ligne annoncée, d'elle jusqu'au-delà de sa cible, qui claque après 1 s
            const L = Math.min(def.portee + 40, d + 60)
            this.addTele({ kind: 'ligne', x: e.x, y: e.y, x2: e.x + Math.cos(e.angle) * L, y2: e.y + Math.sin(e.angle) * L, r: 9, t: 1, total: 1, dmg: es.dmg * 1.6, src: killerName(es) })
          } else {
            for (const da of shots) this.addBullet(e.x, e.y, Math.cos(e.angle + da) * v, Math.sin(e.angle + da) * v, 1, es.dmg, 1.3, null, null, def.tir.k, killerName(es))
            this.hooks.fx(e.x, e.y, { k: 'crache', x: e.x, y: e.y, t: def.tir.k })
          }
        }
      } else if (def.explose) {
        if (d > 22) { mx = (tx - e.x) / d; my = (ty - e.y) / d }
        else {
          es.boomT = 0.9
          this.addTele({ kind: 'cercle', x: e.x, y: e.y, x2: 0, y2: 0, r: 44, t: 0.9, total: 0.9, dmg: es.dmg, src: killerName(es) })
          this.hooks.fx(e.x, e.y, { k: 'txt', x: e.x, y: e.y - 14, s: '!', c: '#ff6b6b' })
          return
        }
      } else {
        if (d > def.portee + 4) { mx = (tx - e.x) / d; my = (ty - e.y) / d }
        else if (es.cd <= 0) {
          es.cd = def.cadence
          t.hit(es.dmg, killerName(es))
          if (def.draine) e.hp = Math.min(e.maxHp, e.hp + Math.round(es.dmg))
          if (es.kind === E.GLANEUR) this.glaner((t as any).ref)
          this.hooks.fx(e.x, e.y, { k: 'morsure', x: tx, y: ty })
        }
      }
    } else {
      es.target = null
      this.wander(es, dt, es.camp ? 60 : 110, 0.45)
      return
    }
    if (mx || my) {
      const before = e.x + e.y
      const v = def.vitesse * es.speedMul * garde
      moveStep(e, mx, my, dt, v, this.map, def.rayon)
      if (Math.abs(e.x + e.y - before) < 0.01 && es.target) { moveStep(e, -my, mx, dt, v, this.map, def.rayon) } // contourne
    }
  }

  /** Errance autour du point d'origine. */
  wander(es: ESim, dt: number, r: number, pace: number) {
    const e = es.e, def = ENEMIES[es.kind]
    es.idleT -= dt
    if (es.idleT <= 0) {
      es.idleT = 2 + Math.random() * 3
      // en errance hors des camps, ÉDEN pousse vers l'ouest
      const bias = !es.camp && def.famille === 'eden' ? 0.65 : 0.5
      es.wanderX = es.homeX + (Math.random() - bias) * r * 2; es.wanderY = es.homeY + (Math.random() - 0.5) * r * 2
    }
    const d = Math.hypot(es.wanderX - e.x, es.wanderY - e.y)
    if (d > 6) { moveStep(e, (es.wanderX - e.x) / d * pace, (es.wanderY - e.y) / d * pace, dt, def.vitesse, this.map, def.rayon); e.angle = Math.atan2(es.wanderY - e.y, es.wanderX - e.x) }
  }

  onCampLoss(es: ESim) {
    if (!es.camp) return
    const c = this.camps.get(es.camp)
    if (c) { c.alive.delete(es.id); if (!c.alive.size) c.respawnAt = this.time + 60 + Math.random() * 40 }
  }

  stepBoss(es: ESim, dt: number) {
    const e = es.e, b = es.boss!, def = ENEMIES[E.COUVEUSE]
    // La Couveuse n'est vulnérable que si un robot est près d'elle : ÉDEN ne digère pas le métal.
    let robotPres = false
    for (const rs of this.robots.values()) if (rs.r.mode !== 3 && rs.r.mode !== 5 && rs.r.mode !== 6 && Math.hypot(rs.r.x - e.x, rs.r.y - e.y) < 120) { robotPres = true; break }
    e.armure = !robotPres
    this.state.bossPv = Math.max(1, Math.round(e.hp / e.maxHp * 100))
    const cibles = [...this.players.values()].filter((p) => p.s.etat === 0 && Math.hypot(p.s.x - e.x, p.s.y - e.y) < 340)
    if (!cibles.length) { e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02 * dt); return }
    const near = cibles.reduce((a, p) => Math.hypot(p.s.x - e.x, p.s.y - e.y) < Math.hypot(a.s.x - e.x, a.s.y - e.y) ? p : a)
    const dn = Math.hypot(near.s.x - e.x, near.s.y - e.y)
    e.angle = Math.atan2(near.s.y - e.y, near.s.x - e.x)
    if (dn > 40) moveStep(e, (near.s.x - e.x) / dn * 0.6, (near.s.y - e.y) / dn * 0.6, dt, def.vitesse, this.map, 14)
    if (dn < def.rayon + 10 && es.cd <= 0) { es.cd = def.cadence; this.damagePlayer(near, def.degats * 0.6, cause('srv.tueur.couveuse')) }
    b.phaseT -= dt
    if (b.phaseT > 0) return
    const enrage = e.hp < e.maxHp * 0.5
    b.phaseT = enrage ? 2.6 : 3.4
    const attaques = enrage ? ['spores', 'racine', 'ponte', 'onde'] : ['spores', 'racine', 'ponte']
    const a = attaques[b.next++ % attaques.length]
    if (a === 'spores') for (const p of cibles.slice(0, 6)) this.addTele({ kind: 'cercle', x: p.s.x, y: p.s.y, x2: 0, y2: 0, r: 30, t: 1.3, total: 1.3, dmg: 34, src: cause('srv.tueur.spores') })
    if (a === 'racine') {
      const p = cibles[Math.floor(Math.random() * cibles.length)]
      const ang = Math.atan2(p.s.y - e.y, p.s.x - e.x)
      this.addTele({ kind: 'ligne', x: e.x, y: e.y, x2: e.x + Math.cos(ang) * 320, y2: e.y + Math.sin(ang) * 320, r: 11, t: 1.0, total: 1.0, dmg: 44, src: cause('srv.tueur.racine') })
    }
    if (a === 'ponte') {
      for (let i = 0; i < 3; i++) {
        const ang = Math.random() * Math.PI * 2, d = 60 + Math.random() * 80
        const x = e.x + Math.cos(ang) * d, y = e.y + Math.sin(ang) * d
        if (!hits(this.map, x, y, 6)) this.spawnEnemy(E.OEUF, x, y, { wave: es.wave })
      }
      this.hooks.fx(e.x, e.y, { k: 'txt', x: e.x, y: e.y - 30, s: msg('srv.monde.elle_pond'), c: '#c48bff' })
    }
    if (a === 'onde') this.addTele({ kind: 'cercle', x: e.x, y: e.y, x2: 0, y2: 0, r: 95, t: 1.6, total: 1.6, dmg: 40, src: cause('srv.tueur.onde') })
  }

  /** L'Engloutisseur : la bête du marais. Vagues de vase en éventail, gueule qui s'abat, sangsues. */
  stepBoss2(es: ESim, dt: number) {
    const e = es.e, b = es.boss!, def = ENEMIES[E.ENGLOUTISSEUR]
    this.state.boss2 = Math.max(1, Math.round(e.hp / e.maxHp * 100))
    const cibles = [...this.players.values()].filter((p) => p.s.etat === 0 && Math.hypot(p.s.x - e.x, p.s.y - e.y) < 380)
    if (!cibles.length) {
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.03 * dt)
      const d = Math.hypot(es.homeX - e.x, es.homeY - e.y)
      if (d > 10) moveStep(e, (es.homeX - e.x) / d, (es.homeY - e.y) / d, dt, def.vitesse, this.map, 16)
      return
    }
    const near = cibles.reduce((a, p) => Math.hypot(p.s.x - e.x, p.s.y - e.y) < Math.hypot(a.s.x - e.x, a.s.y - e.y) ? p : a)
    const dn = Math.hypot(near.s.x - e.x, near.s.y - e.y)
    e.angle = Math.atan2(near.s.y - e.y, near.s.x - e.x)
    if (dn > 50 && Math.hypot(es.homeX - e.x, es.homeY - e.y) < 200) moveStep(e, (near.s.x - e.x) / dn * 0.7, (near.s.y - e.y) / dn * 0.7, dt, def.vitesse, this.map, 16)
    if (dn < def.rayon + 12 && es.cd <= 0) { es.cd = def.cadence; this.damagePlayer(near, es.dmg * 0.7, cause('srv.tueur.engloutisseur')) }
    b.phaseT -= dt
    if (b.phaseT > 0) return
    const enrage = e.hp < e.maxHp * 0.4
    b.phaseT = enrage ? 2.4 : 3.2
    const a = ['vagues', 'gueule', 'vagues', 'sangsues'][b.next++ % 4]
    if (a === 'vagues') {
      const base = Math.atan2(near.s.y - e.y, near.s.x - e.x)
      const n = enrage ? 5 : 3
      for (let i = 0; i < n; i++) {
        const ang = base + (i - (n - 1) / 2) * 0.42
        this.addTele({ kind: 'ligne', x: e.x, y: e.y, x2: e.x + Math.cos(ang) * 270, y2: e.y + Math.sin(ang) * 270, r: 12, t: 1.1, total: 1.1, dmg: es.dmg * 1.2, src: cause('srv.tueur.vague_englou') })
      }
    }
    if (a === 'gueule') for (const p of cibles.slice(0, enrage ? 4 : 2)) this.addTele({ kind: 'cercle', x: p.s.x, y: p.s.y, x2: 0, y2: 0, r: 38, t: 1.25, total: 1.25, dmg: es.dmg * 1.5, src: cause('srv.tueur.gueule') })
    if (a === 'sangsues') {
      for (let i = 0; i < (enrage ? 4 : 3); i++) {
        const ang = Math.random() * Math.PI * 2, d = 50 + Math.random() * 60
        const x = e.x + Math.cos(ang) * d, y = e.y + Math.sin(ang) * d
        if (!hits(this.map, x, y, 6)) this.spawnEnemy(E.SANGSUE, x, y, { level: 10 })
      }
      this.hooks.fx(e.x, e.y, { k: 'txt', x: e.x, y: e.y - 34, s: msg('srv.monde.vase'), c: '#9fd08a' })
    }
  }

  // ------------------------------------------------------------------ le service central
  /** Recopie l'état partagé (heure, temps, ruches, avant-postes et leurs PV) dans cette copie de la carte. */
  syncCentral() {
    const c = this.central!, st = this.state
    if (Math.abs(st.heure - c.heure) > 0.002) st.heure = c.heure
    if (st.meteo !== c.meteo) st.meteo = c.meteo
    const carte = this.map.carte
    for (const o of c.outposts.values()) {
      if (o.carte !== carte) continue
      const rs = this.robots.get(o.id)
      if (!rs) { this.addOutpost(o.account, o.family, o.given, o.level, o.x, o.y, o.hp, o.until, o.maxHp); continue }
      if (rs.r.hp !== o.hp) { rs.r.hp = o.hp; const so = this.state.outposts.get(o.id); if (so) so.hp = o.hp }
      rs.until = o.until
    }
    for (const rs of [...this.robots.values()]) if (rs.kind === 'avant-poste' && !c.outposts.has(rs.id)) this.removeRobot(rs.id)
  }

  // ------------------------------------------------------------------ le secteur
  stepSector(dt: number) {
    this.frontAcc += dt
    if (this.frontAcc >= 1) {
      // sans service central (tests, bancs), la salle fait grandir ses ruches elle-même
      if (!this.central && this.map.zoneCarte === 'continent') stepRuches(this.localRuches, this.frontAcc, this.poches)
      this.frontAcc = 0
      const r = this.ruches
      for (let i = 0; i < r.length; i++) if (Math.abs(this.state.ruches[i] - r[i]) > 0.01) this.state.ruches[i] = r[i]
      // la lecture de la Pépinière : oubliée peu à peu (le service central le fait pour tout le serveur), montrée à tous
      if (!this.central) oublier(this.localLecture, 1)
      const code = codeLecture(this.lecture)
      if (this.state.lecture !== code) this.state.lecture = code
      // dépôt de la ferraille à Port-Ancre
      for (const p of this.players.values()) if (!p.bot && p.sac > 0 && p.s.etat === 0 && this.zoneOf(p.s.x, p.s.y) === 'port') {
        const n = p.sac; p.sac = 0; this.hooks.bank?.(p, n)
        this.hooks.fx(p.s.x, p.s.y, { k: 'txt', x: p.s.x, y: p.s.y - 16, s: `+${n} ferraille à l'abri`, c: '#ffd36b', sid: p.sid })
      }
    }
    this.spawnAcc += dt
    if (this.spawnAcc >= 1) { this.spawnAcc = 0; this.spawnAroundPlayers(); this.stepCamps(); this.cullEnemies(1); if (this.arene) this.stepNest(); this.stepBoss2Spawn(1) }
  }

  spawnAroundPlayers() {
    if (this.map.zoneCarte !== 'continent') return
    const pres = (x: number, y: number) => { let m = Infinity; const r = this.ruches; for (let i = 0; i < RUCHES.length; i++) m = Math.min(m, ecartBordure(RUCHES[i], r[i], x / TILE, y / TILE)); return m }
    for (const p of this.players.values()) {
      if (p.s.etat !== 0) continue
      if (pres(p.s.x, p.s.y) > 14) continue
      let n = 0
      for (const es of this.enemies.values()) if (!es.boss && !es.camp && Math.abs(es.e.x - p.s.x) < 480 && Math.abs(es.e.y - p.s.y) < 480) n++
      if (n >= 9) continue
      for (let tries = 0; tries < 6; tries++) {
        const a = Math.random() * Math.PI * 2, d = 240 + Math.random() * 180
        const x = p.s.x + Math.cos(a) * d, y = p.s.y + Math.sin(a) * d
        const ecart = pres(x, y)
        if (ecart > -1.5 || hits(this.map, x, y, 9)) continue
        if (this.zoneOf(x, y) !== 'dela') continue
        let tooClose = false
        for (const q of this.players.values()) if (Math.hypot(q.s.x - x, q.s.y - y) < 200) { tooClose = true; break }
        if (tooClose) continue
        const depth = Math.min(1, -ecart / 30)
        const count = 2 + Math.floor(Math.random() * 3)
        const level = levelAt(x, y)
        for (let i = 0; i < count; i++) {
          const r = Math.random()
          // dans les Hauts, les foyers de la Glaneuse lâchent ses Glaneurs, des robots retournés et des Bouturés
          const kind = x >= HAUTS_X * TILE ? (r < 0.1 + depth * 0.15 ? E.BOUTURE : r < 0.45 ? E.RETOURNE : E.GLANEUR)
            : r < 0.1 + depth * 0.15 ? E.CUIRASSE : r < 0.4 ? E.CRACHEUR : r < 0.5 && level >= 10 ? E.GONFLE : E.RAMPANT
          const ox = x + (Math.random() - 0.5) * 30, oy = y + (Math.random() - 0.5) * 30
          if (!hits(this.map, ox, oy, ENEMIES[kind].rayon)) this.spawnEnemy(kind, ox, oy, { level, elite: Math.random() < 0.05 })
        }
        break
      }
    }
  }

  /** Les camps de créatures : ils se peuplent quand quelqu'un approche, et repoussent un peu après avoir été vidés. */
  stepCamps() {
    const camps = this.map.monde?.camps
    if (!camps) return
    const humans = [...this.players.values()].filter((p) => p.s.etat !== 2)
    for (const c of camps) {
      let st = this.camps.get(c.id)
      if (!st) { st = { alive: new Set(), respawnAt: 0 }; this.camps.set(c.id, st) }
      for (const id of st.alive) if (!this.enemies.has(id)) st.alive.delete(id)
      if (st.alive.size || this.time < st.respawnAt) continue
      let near = false
      for (const p of humans) if (Math.abs(p.s.x - c.x) < 560 && Math.abs(p.s.y - c.y) < 400) { near = true; break }
      if (!near) continue
      this.populateCamp(c, st)
    }
  }

  populateCamp(c: Camp, st: { alive: Set<string> }) {
    for (let i = 0; i < c.n; i++) {
      const kind = c.kinds[Math.floor(Math.random() * c.kinds.length)]
      const a = Math.random() * Math.PI * 2, d = 8 + Math.random() * 34
      let x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d
      if (hits(this.map, x, y, ENEMIES[kind].rayon)) { x = c.x; y = c.y }
      const passif = ENEMIES[kind].passif
      const es = this.spawnEnemy(kind, x, y, { level: c.niveau + Math.floor(Math.random() * 3) - 1, elite: !passif && Math.random() < 0.06, camp: c.id })
      es.homeX = c.x; es.homeY = c.y
      st.alive.add(es.id)
    }
  }

  /** L'Engloutisseur s'éveille quand quelqu'un approche de son antre. */
  stepBoss2Spawn(dt: number) {
    const lair = this.map.monde?.boss
    // l'Engloutisseur vit maintenant dans son Antre (une instance, server/world/arene.ts) : plus sur le continent
    if (!lair || !(globalThis as any).process?.env?.HEIRLINE_ENGLOU_CONTINENT) return
    const near = [...this.players.values()].filter((p) => p.s.etat === 0 && Math.hypot(p.s.x - lair.x, p.s.y - lair.y) < 640)
    if (this.boss2 && !this.enemies.has(this.boss2.id)) this.boss2 = null
    if (!this.boss2) {
      if (near.length && this.time >= this.boss2RespawnAt) {
        const n = Math.max(1, near.length)
        this.boss2 = this.spawnEnemy(E.ENGLOUTISSEUR, lair.x, lair.y, { level: 12, hpMul: 0.45 + 0.3 * Math.min(n, 6) / 2 })
        this.hooks.log(msg('srv.monde.englou_eveil'), '#9fd08a')
      }
      return
    }
    this.boss2FarT = near.length ? 0 : this.boss2FarT + dt
    if (this.boss2FarT > 60) { this.removeEnemy(this.boss2.id); this.boss2 = null; this.state.boss2 = 0 }
  }

  cullEnemies(dt: number) {
    for (const es of [...this.enemies.values()]) {
      if (es.boss) continue
      let near = false
      for (const p of this.players.values()) if (Math.abs(p.s.x - es.e.x) < 900 && Math.abs(p.s.y - es.e.y) < 900) { near = true; break }
      es.farT = near ? 0 : es.farT + dt
      if (es.farT > 10) this.removeEnemy(es.id)
    }
  }

  stepNest() {
    const humainsNid = [...this.players.values()].filter((p) => !p.bot && p.s.etat !== 2 && this.zoneOf(p.s.x, p.s.y) === 'nid')
    const kind = this.arene ? bossKind(this.arene.profil) : E.COUVEUSE
    const boss = [...this.enemies.values()].find((es) => es.kind === kind)
    if (humainsNid.length || [...this.players.values()].some((p) => !p.bot)) this.peupler()
    if (!boss && humainsNid.length && this.time >= this.bossRespawnAt) {
      const c = this.map.points.nidCentre
      const n = Math.max(1, humainsNid.length + [...this.players.values()].filter((p) => p.bot).length)
      if (this.arene) this.arene.eveil(0.6 + 0.4 * Math.min(n, 8) / 4)
      else this.spawnEnemy(E.COUVEUSE, c.x + 40, c.y, { hpMul: 0.6 + 0.4 * Math.min(n, 8) / 4 })
      if (!this.arene) this.hooks.log(msg('srv.monde.couveuse_eveil'), '#c48bff')
    }
  }

  /** Un donjon : des groupes de créatures sur les lacets du parcours, posés une fois par instance (niveau du donjon). */
  peuple = false
  peupler() {
    const ca = CARTES[this.map.carte as CarteId]?.arene
    if (this.peuple || !ca || this.map.carte === 'nid') return
    this.peuple = true
    const kinds = ca.profil === 'engloutisseur' ? [E.SANGSUE, E.RODEUR, E.GONFLE, E.SANGSUE] : ca.profil === 'pepiniere' ? [E.BOUTURE, E.GLANEUR, E.BOURGEON, E.RETOURNE] : ca.profil === 'greffier' ? [E.FILEUSE, E.RETOURNE, E.GLANEUR, E.BOUTURE] : [E.RAMPANT, E.CRACHEUR, E.GREFFE, E.CUIRASSE]
    for (let i = 0; ; i++) {
      const pt = (this.map.points as any)['etape' + i] as { x: number; y: number } | undefined
      if (!pt) break
      const n = 3 + (i % 2) + (ca.heroique ? 1 : 0)
      for (let k = 0; k < n; k++) {
        const es = this.spawnEnemy(kinds[(i + k) % kinds.length], pt.x + (k - n / 2) * 18, pt.y + ((k % 2) - 0.5) * 14, { level: ca.niveau - 1, elite: k === 0 && i % 2 === 1, hpMul: ca.heroique ? 1.4 : 1 })
        es.homeX = pt.x; es.homeY = pt.y
      }
    }
  }

  // ------------------------------------------------------------------ concession
  stepConcession(dt: number) {
    const c = this.concession!
    if (this.state.fini) return
    const alive = [...this.enemies.values()].filter((es) => es.wave === this.waveIdx).length
    if (this.waveIdx >= 0 && alive > 0) return
    if (this.waveIdx === c.vagues.length - 1 && alive === 0) {
      this.state.fini = true
      this.hooks.log(c.textes.victoire || msg('srv.monde.concession_nettoyee'), '#ffd36b')
      this.hooks.victory?.()
      return
    }
    this.waveWait -= dt
    if (this.waveWait > 0) return
    this.waveIdx++
    const v = c.vagues[this.waveIdx]
    this.state.vague = this.waveIdx + 1
    for (const g of v.groupes) {
      const kind = ENEMY_BRICKS[g.brique]
      const tint = g.variante?.teinte ? parseInt(g.variante.teinte.slice(1), 16) : 0
      for (let i = 0; i < g.nombre; i++) {
        const a = (i / g.nombre) * Math.PI * 2, d = g.nombre > 1 ? 10 + g.nombre : 0
        let x = (g.x + 0.5) * TILE + Math.cos(a) * d, y = (g.y + 0.5) * TILE + Math.sin(a) * d
        if (hits(this.map, x, y, ENEMIES[kind].rayon)) { x = (g.x + 0.5) * TILE; y = (g.y + 0.5) * TILE }
        this.spawnEnemy(kind, x, y, { hpMul: g.variante?.pv, speedMul: g.variante?.vitesse, tint, wave: this.waveIdx })
      }
    }
    if (c.boss && this.waveIdx === c.vagues.length - 1) this.spawnEnemy(E.COUVEUSE, (c.boss.x + 0.5) * TILE, (c.boss.y + 0.5) * TILE, { hpMul: c.boss.pv, wave: this.waveIdx })
    const next = c.vagues[this.waveIdx + 1]
    this.waveWait = next ? next.delai : 0
    this.hooks.log(msg('srv.monde.vague', { n: this.waveIdx + 1, total: c.vagues.length }), '#c48bff')
  }
}

export function dist(a: { x: number; y: number }, b: { x: number; y: number }) { return Math.hypot(a.x - b.x, a.y - b.y) }
export function distToSeg(px: number, py: number, x0: number, y0: number, x1: number, y1: number) {
  const dx = x1 - x0, dy = y1 - y0
  const l2 = dx * dx + dy * dy
  let k = l2 ? ((px - x0) * dx + (py - y0) * dy) / l2 : 0
  k = Math.max(0, Math.min(1, k))
  return Math.hypot(px - (x0 + dx * k), py - (y0 + dy * k))
}
export { NEST }

/** Le niveau des créatures à cet endroit : celui de la région, croissant en s'éloignant de Port-Ancre. */
export function levelAt(x: number, y: number) { return niveauAt(x / TILE, y / TILE) }

/** la cause de mort gardée en base quand une créature tue (un Msg en JSON, voir shared/i18n) */
export function killerName(es: ESim) {
  return cause(es.elite ? 'srv.tueur.elite' : 'srv.tueur.niveau', { qui: ref(`ennemi.${es.kind}.un`), n: es.level })
}

