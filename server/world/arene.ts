// L'arène de la Couveuse, au fond du nid. Quand un soldat y entre, la porte se referme (des murs de chair) et le
// combat se joue dans une arène large (faite pour le téléphone en paysage), la Couveuse en haut, ses deux sacs sur
// les flancs, comme dans un jeu de tir.
//  - La Couveuse porte deux sacs de ponte, des pièces qu'on peut crever : chaque sac crache son flot d'acide et pond.
//    Tant qu'un sac vit, elle est cuirassée (sauf robot près d'elle) ; chaque sac crevé la fait enrager.
//  - Phase 1 (100 → 66 %) : flots croisés des sacs, salves visées, vagues de spores à trou, la ponte en damier.
//  - Phase 2 (66 → 33 %) : la ruche se referme (les murs avancent des côtés et du bas), spirales, colonnes de spores.
//  - Phase 3 (33 → 0 %) : elle arrache le sol (des cases deviennent de l'acide ou du vide), anneaux autour des soldats.
// Les balles partent en motifs (shared/motifs.ts) : le serveur envoie motif, instant et graine, le client dessine,
// le serveur vérifie les touches avec le même calcul.
import { msg, cause, type Msg } from '../../shared/i18n/index.ts'
import { TILE } from '../../shared/consts.ts'
import { E } from '../../shared/rules.ts'
import { ARENE, ARENE_COLS, ARENE_ROWS, RETRECI, RETRECI_BAS, SOL, borneArene, clampArene, caseSol, touche, finMotif, graine, balles, posBalle, type Motif, type MotifKind } from '../../shared/motifs.ts'
import type { World, ESim, PSim, RSim } from './World.ts'
type RSimLike = RSim
import { CARTES, type CarteId, type ProfilArene } from '../../shared/monde.ts'
import { RUCHES } from '../../shared/front.ts'
import type { Tele } from './World.ts'
import { PLAYER_R } from '../../shared/consts.ts'
import { db } from '../db.ts'

/** une droite (point, direction unitaire) coupée à un rectangle : les deux paramètres d'entrée et de sortie */
function coupe(x: number, y: number, ux: number, uy: number, x0: number, y0: number, x1: number, y1: number): [number, number] {
  let t0 = -1e4, t1 = 1e4
  for (const [p, q0, q1] of [[ux, x0 - x, x1 - x], [uy, y0 - y, y1 - y]] as const) {
    if (Math.abs(p) < 1e-9) continue
    const a = q0 / p, b = q1 / p
    t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b))
  }
  return [t0, t1]
}

/** les noms qu'appelle le Greffier quand le serveur n'a pas encore de morts */
const NOMS_ANCIENS = ['Aubert, Léa', 'Lenoir, Hugo', 'Marest, Iris', 'Ferrand, Paul', 'Ferrand, Jeanne', 'Okafor, Ben', 'Vidal, Rose', 'Kerbrat, Yann', 'Sato, Mina', 'Delorme, Louis']

/** Ce qui change d'un boss d'arène à l'autre : le boss, ses salves par phase, ses textes. La Couveuse a ses sacs et
 *  arrache le sol ; l'Engloutisseur plonge, fait refluer la vase et aspire ; la Gueule fait tomber ses crocs, balaie
 *  de la langue et lâche ses dents en damier. Les zones restent une à la fois, toujours annoncées. */
const PROFILS: Record<ProfilArene, { kind: number; pv: number; corps: string[][]; eveil: string; c: string; b2: string; b3: string; tueur: string }> = {
  couveuse: { kind: E.COUVEUSE, pv: 9, corps: [['vise', 'vague', 'vise'], ['spirale', 'vise', 'vague'], ['spirale', 'vague', 'vise', 'spirale']], eveil: 'srv.monde.couveuse_eveil', c: '#c48bff', b2: 'srv.arene.b_ruche', b3: 'srv.arene.b_sol', tueur: 'srv.tueur.couveuse' },
  engloutisseur: { kind: E.ENGLOUTISSEUR, pv: 4.2, corps: [['vise', 'vague', 'vise'], ['vague', 'vise', 'spirale'], ['spirale', 'vise', 'vague']], eveil: 'srv.donjon.englou_eveil', c: '#9fd08a', b2: 'srv.donjon.b_reflux', b3: 'srv.donjon.b_aspire', tueur: 'srv.tueur.engloutisseur' },
  // le raid : le Semeur, à dix ; les salves comptent moins que les mécaniques de groupe (semis, greffes, désherbage)
  semeur: { kind: E.SEMEUR, pv: 45, corps: [['vise', 'vague'], ['vise', 'spirale', 'vague'], ['vise', 'vague', 'spirale']], eveil: 'srv.raid.eveil', c: '#d8e06a', b2: 'srv.raid.b_greffes', b3: 'srv.raid.b_desherbage', tueur: 'srv.tueur.semeur' },
  // les Hauts de Glane : la Pépinière lit le groupe (essaim ou épines), le Greffier appelle les morts et rature
  pepiniere: { kind: E.PEPINIERE, pv: 6.2, corps: [['vise', 'vague', 'vise'], ['vise', 'spirale', 'vague'], ['spirale', 'vise', 'vague', 'vise']], eveil: 'srv.donjon.pep_eveil', c: '#8fe0a0', b2: 'srv.donjon.b_pep2', b3: 'srv.donjon.b_vitres', tueur: 'srv.tueur.pepiniere' },
  greffier: { kind: E.GREFFIER, pv: 6.6, corps: [['vise', 'vague', 'vise'], ['vague', 'vise', 'spirale'], ['spirale', 'vise', 'vague', 'vise']], eveil: 'srv.donjon.gref_eveil', c: '#c8b8ff', b2: 'srv.donjon.b_gref2', b3: 'srv.donjon.b_pages', tueur: 'srv.tueur.greffier' },
  // le raid de la campagne 2 : la Glaneuse, à dix ; la glane (veiller les robots), la pince (les tanks), le Métier, l'appel
  glaneuse: { kind: E.GLANEUSE, pv: 42, corps: [['vise', 'vague'], ['vise', 'spirale', 'vague'], ['vise', 'vague', 'spirale']], eveil: 'srv.raid.glaneuse_eveil', c: '#ffb86b', b2: 'srv.raid.b_metier', b3: 'srv.raid.b_appel', tueur: 'srv.tueur.glaneuse' },
  gueule: { kind: E.GUEULE, pv: 5.5, corps: [['vise', 'vague', 'vise'], ['spirale', 'vise', 'vague'], ['spirale', 'vague', 'vise', 'spirale']], eveil: 'srv.donjon.gueule_eveil', c: '#ff8a6b', b2: 'srv.donjon.b_langue', b3: 'srv.donjon.b_dents', tueur: 'srv.tueur.gueule_boss' },
}

/** Réglage de test (vidéos, bancs) : multiplie les PV de la Couveuse et de ses sacs. Jamais sur le serveur du jeu. */
/** le boss d'un profil d'arène */
export const bossKind = (p: ProfilArene) => PROFILS[p].kind

const PV_TEST = Number(process.env.HEIRLINE_BOSS_PV ?? 1) || 1
/** Réglage de test : multiplie les dégâts des balles (le test du soldat de test doit mourir malgré les soins des IA). */
const DGT_TEST = Number(process.env.HEIRLINE_BOSS_DGT ?? 1) || 1

/** la Couveuse en haut de l'arène, ses sacs écartés sur les flancs */
const BOSS_Y = ARENE.y0 + 36, SAC_DX = 150, SAC_Y = ARENE.y0 + 52

interface MotifVivant { m: Motif; fin: number; mortes: Set<number>; dmg: number; src: string }
interface Veine { cases: number[]; t: number; vers: number; vie: number }

export class Arene {
  w: World
  /** 0 au repos (porte ouverte), 1 combat (porte refermée) */
  etat = 0
  phase = 1
  sol = new Uint8Array(ARENE_COLS * ARENE_ROWS)
  veines: Veine[] = []
  motifs: MotifVivant[] = []
  boss: ESim | null = null
  sacs: (ESim | null)[] = [null, null]
  nextId = 1
  atkT = 2.5; sacT = 1.2; zoneT = 5; ponteT = 7
  solT = 0; reposT = 0; soinT = 0
  ordre = 0
  zonesP3 = 0
  swayT = 0

  /** le boss de cette arène, et l'héroïque (plus de PV, plus de dégâts, des salves plus serrées) */
  profil: ProfilArene
  heroique: boolean
  /** l'Engloutisseur : le saut (cible, temps avant l'impact, temps posé), l'aspiration */
  plonge: { x: number; y: number; t: number; pose: number } | null = null
  aspireT = 0; aspireCd = 12; addsT = 6
  /** le Semeur : la sève (une taille que personne n'a prise : +10 % de dégâts, jusqu'à 5), le pommier du désherbage */
  seve = 0
  tour = 0
  pommier: { x: number; y: number } | null = null
  /** la Pépinière : les positions du groupe (soldats et robots) sur les 8 dernières secondes, la doctrine lue */
  releves: { x: number; y: number }[][] = []
  releveT = 0; potT = 6
  doctrine: 'essaim' | 'epines' | '' = ''
  /** le Greffier : l'appel (prochain), l'encre gagnée par les porte-noms arrivés (des bandes de plus à la rature) */
  appelT = 8; encre = 0
  noms: string[] = []
  /** la Glaneuse : la pince (prochain coup), les deux pylônes du Métier (phase 2), les robots glanés (chacun la renforce) */
  pinceT = 3; glanes = 0; tirPylone = 0
  pylones: ESim[] = []
  constructor(w: World, profil: ProfilArene = 'couveuse', heroique = false) { this.w = w; this.profil = profil; this.heroique = heroique }
  get P() { return PROFILS[this.profil] }
  /** un boss de la campagne 2 */
  get c2() { return this.profil === 'pepiniere' || this.profil === 'greffier' || this.profil === 'glaneuse' }
  /** multiplicateurs de l'héroïque */
  get hDmg() { return this.heroique ? 1.3 : 1 }
  get hCad() { return this.heroique ? 0.85 : 1 }

  get ferme() { return this.etat === 1 }
  get borne() { return borneArene(this.phase) }
  get now() { return this.w.time }

  /** dans l'enclos (au-delà de la porte) */
  dedans(x: number, y: number) { return x > ARENE.x0 + 4 && x < ARENE.x1 && y > ARENE.y0 && y < ARENE.y1 }

  // ------------------------------------------------------------------ réveil, fermeture, fin
  eveil(hpMul: number) {
    const cx = (ARENE.x0 + ARENE.x1) / 2, cy = BOSS_Y
    // un combat en trois phases : bien plus de PV que l'ancienne Couveuse, qu'un groupe tuait sans bouger
    const h = (this.heroique ? 1.6 : 1) * (this.profil === 'semeur' || this.profil === 'glaneuse' ? this.forceFront() : 1)
    // les boss des Hauts sont réglés pour des groupes de leur niveau (les arènes d'Ossara le sont pour le niveau 13 à 24)
    const nv = this.c2 ? CARTES[this.w.map.carte as CarteId]?.arene?.niveau ?? 19 : 19
    this.boss = this.w.spawnEnemy(this.P.kind, cx, cy, { hpMul: hpMul * this.P.pv * h * PV_TEST * (1 + 0.09 * (nv - 19)) })
    this.boss.dmg *= this.hDmg * (1 + 0.06 * (nv - 19))
    this.sacs = this.profil === 'couveuse' ? [-1, 1].map((s) => this.w.spawnEnemy(E.SAC, cx + s * SAC_DX, SAC_Y, { hpMul: hpMul * 3.6 * h * PV_TEST })) : [null, null]
    this.phase = 1
    this.plonge = null; this.aspireT = 0; this.aspireCd = 12; this.addsT = 6; this.seve = 0; this.pommier = null
    this.releves = []; this.doctrine = ''; this.potT = 6; this.appelT = 8; this.encre = 0
    this.pinceT = 3; this.pylones = []; this.glanes = 0; this.tirPylone = 0
    this.w.hooks.log(msg(this.P.eveil), this.P.c)
    this.envoyer()
  }

  fermer() {
    this.etat = 1
    this.phase = 1
    this.atkT = 2.2; this.sacT = 1.2; this.zoneT = 6; this.ponteT = 8; this.ordre = 0
    // tout le groupe est pris dedans : la chair se referme sur la porte
    const vivants = [...this.w.players.values()].filter((p) => p.s.etat === 0)
    vivants.forEach((p, i) => {
      if (!this.dedans(p.s.x, p.s.y)) { p.s.x = (ARENE.x0 + ARENE.x1) / 2 - 90 + (i % 4) * 60; p.s.y = ARENE.y1 - 34 - Math.floor(i / 4) * 20 }
      if (p.robot && p.robot.kind === 'robot') { p.robot.r.x = p.s.x - 10; p.robot.r.y = p.s.y + 8 }
    })
    this.w.hooks.log(msg('srv.arene.referme'), '#c48bff')
    if (this.profil === 'pepiniere') this.lire()
    else this.flash(msg('srv.arene.b_referme'))
    this.envoyer()
  }

  /** la Couveuse tombée, ou un sac crevé */
  mort(es: ESim) {
    if (es === this.boss) {
      for (const s of this.sacs) if (s && this.w.enemies.has(s.id)) this.w.removeEnemy(s.id)
      this.sacs = [null, null]; this.boss = null
      this.ouvrir()
      this.soinT = 5
      return
    }
    if (es.kind === E.PYLONE) {
      this.pylones = this.pylones.filter((p) => p !== es)
      if (!this.pylones.length && this.boss) this.flash(msg('srv.raid.b_pylones'))
      return
    }
    if (es.kind === E.BALISE && es.robotGlane) {
      // la balise détruite : le robot glané se rallume
      const rs = this.w.robots.get(es.robotGlane)
      if (rs && rs.r.mode === 3) { rs.offT = 0.01; this.w.hooks.fx(rs.r.x, rs.r.y, { k: 'txt', x: rs.r.x, y: rs.r.y - 16, s: msg('srv.raid.rallume'), c: '#7fd6ff' }) }
      return
    }
    const i = this.sacs.indexOf(es)
    if (i < 0) return
    this.sacs[i] = null
    const b = this.boss
    if (b) {
      this.w.hooks.fx(b.e.x, b.e.y, { k: 'txt', x: b.e.x, y: b.e.y - 44, s: msg('srv.arene.enrage'), c: '#ff6bd8' })
      this.flash(msg(this.sacs.some(Boolean) ? 'srv.arene.b_sac' : 'srv.arene.b_plus_de_sacs'))
    }
  }

  /** Le raid est lié au front : la Grande Ruche (ruche_nord) donne sa force au Semeur, de 0,8 (repoussée au plancher)
   *  à 1,3 (à son plafond). */
  forceFront() {
    // la Glaneuse : le foyer du Métier
    const i = this.profil === 'glaneuse' ? Math.max(0, RUCHES.findIndex((x) => x.id === 'foyer_metier')) : 0
    const r = this.w.central ? this.w.central.rayons[i] : this.w.ruches[i]
    const h = RUCHES[i]
    return Math.max(0.8, Math.min(1.3, 0.8 + 0.5 * (r - h.rmin) / (h.rmax - h.rmin)))
  }

  ouvrir() {
    this.etat = 0
    this.motifs = []
    this.envoyer()
  }

  /** personne debout dans l'arène : le nid se rouvre et la Couveuse se rendort */
  remiseAZero() {
    for (const es of [this.boss, ...this.sacs]) if (es && this.w.enemies.has(es.id)) this.w.removeEnemy(es.id)
    for (const es of [...this.w.enemies.values()]) if ((es.kind === E.OEUF || es.kind === E.RAMPANT || es.kind === E.SANGSUE || es.kind === E.GREFFE || es.kind === E.POT || es.kind === E.BOUTURE || es.kind === E.PORTENOM || es.kind === E.PYLONE || es.kind === E.BALISE) && this.dedans(es.e.x, es.e.y)) this.w.removeEnemy(es.id)
    this.plonge = null; this.aspireT = 0; this.seve = 0; this.pommier = null; this.releves = []; this.doctrine = ''; this.encre = 0; this.pylones = []; this.glanes = 0
    // les robots glanés se rallument
    for (const rs of this.w.robots.values()) if (rs.kind === 'robot' && rs.r.mode === 3 && rs.offT > 1000) rs.offT = 0.01
    this.boss = null; this.sacs = [null, null]
    this.w.state.bossPv = 0
    this.w.teles = []
    this.sol.fill(0); this.veines = []
    this.phase = 1
    this.w.bossRespawnAt = this.w.time + 8
    this.w.hooks.log(msg('srv.arene.rouvre'), '#8fb3c9')
    this.ouvrir()
  }

  // ------------------------------------------------------------------ le pas
  /** le corps : il oscille en haut de l'arène, les sacs suivent ses flancs */
  stepBoss(es: ESim, dt: number) {
    this.boss = es
    const e = es.e
    this.w.state.bossPv = Math.max(1, Math.round(e.hp / e.maxHp * 100))
    if (!this.ferme) { e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.03 * dt); return }
    this.swayT += dt * (1 + 0.25 * this.enrage())
    const cx = (ARENE.x0 + ARENE.x1) / 2
    const hx = cx + Math.sin(this.swayT * 0.45) * (this.profil === 'gueule' ? 14 : this.profil === 'semeur' || this.profil === 'glaneuse' ? 8 : this.phase >= 2 ? 40 : 60), hy = BOSS_Y + Math.sin(this.swayT * 0.9) * 4
    if (this.plonge) {
      // l'Engloutisseur en l'air : il retombe sur le cercle, s'y pose, puis regagne le haut de l'arène
      const pl = this.plonge
      if (pl.t > 0) { pl.t -= dt; if (pl.t <= 0) { e.x = pl.x; e.y = pl.y; this.w.hooks.fx(e.x, e.y, { k: 'boom', x: e.x, y: e.y, r: 34, f: 'cercle' }) } }
      else if ((pl.pose -= dt) <= 0) { const k = Math.min(1, dt * 2.5); e.x += (hx - e.x) * k; e.y += (hy - e.y) * k; if (Math.hypot(hx - e.x, hy - e.y) < 4) this.plonge = null }
    } else { e.x = hx; e.y = hy }
    // l'aspiration : les soldats sont tirés vers la gueule, à moins de la moitié de leur vitesse
    if (this.aspireT > 0) {
      this.aspireT -= dt
      if (this.aspireT <= 0) this.envoyer()
      for (const p of this.w.players.values()) {
        if (p.s.etat !== 0 || !this.dedans(p.s.x, p.s.y)) continue
        const d = Math.hypot(e.x - p.s.x, e.y - p.s.y)
        if (d > 44) { const v = p.s.vit * 0.42 * dt; p.s.x += (e.x - p.s.x) / d * v; p.s.y += (e.y - p.s.y) / d * v; clampArene(p.s, this.borne) }
      }
    }
    // les sacs tiennent les flancs, ils ne suivent le corps que de loin
    this.sacs.forEach((s, i) => { if (s) { s.e.x = cx + (i ? SAC_DX : -SAC_DX) + (e.x - cx) * 0.3; s.e.y = SAC_Y + Math.sin(this.swayT * 1.3 + i * 2) * 5 } })
    let robotPres = false
    for (const rs of this.w.robots.values()) if (rs.r.mode !== 3 && rs.r.mode !== 5 && rs.r.mode !== 6 && Math.hypot(rs.r.x - e.x, rs.r.y - e.y) < 120) { robotPres = true; break }
    e.armure = this.profil === 'glaneuse' ? this.pylones.some((p) => this.w.enemies.has(p.id)) : !robotPres && this.sacs.some(Boolean)
    // au corps à corps, elle écrase
    for (const p of this.w.players.values()) if (p.s.etat === 0 && Math.hypot(p.s.x - e.x, p.s.y - e.y) < 30 && es.cd <= 0) { es.cd = 1; this.w.damagePlayer(p, es.dmg * 0.6, cause(this.P.tueur)) }
  }

  /** 0, 1 ou 2 sacs crevés */
  enrage() { return this.boss ? this.sacs.filter((s) => !s).length : 0 }

  step(dt: number) {
    if (this.soinT > 0) { this.soinT -= dt; if (this.soinT <= 0) { this.sol.fill(0); this.veines = []; this.phase = 1; this.envoyer() } }
    const b = this.boss
    if (!b || !this.w.enemies.has(b.id)) { if (this.ferme) this.ouvrir(); return }
    if (!this.ferme) {
      for (const p of this.w.players.values()) if (!p.bot && p.s.etat === 0 && this.dedans(p.s.x, p.s.y)) { this.fermer(); break }
      return
    }
    const vivants = [...this.w.players.values()].filter((p) => p.s.etat === 0 && this.dedans(p.s.x, p.s.y))
    if (!vivants.length) { this.reposT += dt; if (this.reposT > 4) this.remiseAZero(); return }
    this.reposT = 0
    const bo = this.borne
    for (const rs of this.w.robots.values()) if (this.dedans(rs.r.x, rs.r.y) || rs.owner && this.dedans(rs.owner.s.x, rs.owner.s.y)) clampArene(rs.r, bo)

    // les phases
    const k = b.e.hp / b.e.maxHp
    // (pas pendant qu'une zone est annoncée : les murs qui avancent pousseraient le soldat dedans)
    if (this.phase === 1 && k <= 0.66 && !this.zoneEnCours()) this.phase2()
    else if (this.phase === 2 && k <= 0.33 && !this.zoneEnCours()) this.phase3()

    const rage = this.enrage()
    const cad = (1 - 0.14 * rage - 0.08 * (this.phase - 1)) * this.hCad
    this.stepProfil(dt, vivants)
    this.atkT -= dt; this.sacT -= dt; this.zoneT -= dt; this.ponteT -= dt
    // les balles et les zones alternent : peu avant une zone, plus de nouvelle salve ; la zone tombe quand
    // l'arène s'est vidée, une à la fois (jamais deux annonces en même temps), puis les salves reprennent
    // dans les donjons, jamais plus de quatre motifs en vol : la Couveuse garde sa densité (c'est le grand nid)
    const plein = this.profil !== 'couveuse' && this.motifs.length >= 4
    const calme = this.zoneT <= 1.2 || this.zoneEnCours() || this.aspireT > 0 || plein
    if (!calme && this.atkT <= 0) this.attaqueCorps(vivants, cad)
    if (!calme && this.sacT <= 0) { this.sacT = (this.profil === 'gueule' ? 4.6 : 3.6) * cad; this.attaqueSacs() }
    if (this.zoneT <= 0) {
      if (this.zoneEnCours() || this.ballesEnVol() > 8) this.zoneT = 0.3
      else this.attaqueZone(vivants, Math.max(0.8, cad))
    }
    if (this.ponteT <= 0 && this.profil === 'couveuse') { this.ponteT = 9; this.ponte() }

    this.touches()
    this.stepSol(dt, vivants)
    const now = this.now
    this.motifs = this.motifs.filter((mv) => mv.fin > now)
  }

  phase2() {
    this.phase = 2
    this.flash(msg(this.P.b2))
    if (this.profil === 'couveuse') this.w.hooks.log(msg('srv.arene.murs'), '#c48bff')
    for (const p of this.w.players.values()) if (p.s.etat !== 2 && this.dedans(p.s.x, p.s.y)) clampArene(p.s, this.borne)
    this.zoneT = 2.5; this.atkT = Math.max(this.atkT, 1.4)
    if (this.profil === 'pepiniere') this.lire()
    if (this.profil === 'glaneuse') {
      // le Métier : deux pylônes se dressent sur les flancs ; tant qu'il en reste un, elle est cuirassée
      const bo = this.borne
      this.pylones = [bo.x0 + 40, bo.x1 - 40].map((x) => this.w.spawnEnemy(E.PYLONE, x, ARENE.y0 + 70, { level: this.boss?.level ?? 33, hpMul: 9 * PV_TEST }))
      this.w.hooks.log(msg('srv.raid.pylones'), this.P.c)
    }
    this.envoyer()
  }

  phase3() {
    this.phase = 3
    this.flash(msg(this.P.b3))
    if (this.profil === 'couveuse') this.w.hooks.log(msg('srv.arene.sol'), '#c48bff')
    this.zonesP3 = 1; this.zoneT = Math.max(this.zoneT, 1.5) // le sol s'arrache en premier
    if (this.profil === 'pepiniere') this.lire()
    this.envoyer()
  }

  // ------------------------------------------------------------------ les attaques
  motif(k: MotifKind, x: number, y: number, a: number, n: number, p: number, delai: number, dmg: number, src: string) {
    const m: Motif = { id: this.nextId++, k, t0: this.now + delai, seed: (Math.random() * 2 ** 31) >>> 0, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, a: Math.round(a * 1000) / 1000, n, p }
    this.motifs.push({ m, fin: finMotif(m), mortes: new Set(), dmg: dmg * DGT_TEST * this.hDmg, src })
    this.w.hooks.arene?.('motif', { ...m, dt: delai })
  }

  /** la cause d'une salve du corps, selon le boss */
  src(k: 'vise' | 'vague' | 'spirale') {
    return ({ couveuse: { vise: 'srv.tueur.salve', vague: 'srv.tueur.vague_spores', spirale: 'srv.tueur.spirale' }, engloutisseur: { vise: 'srv.tueur.vase_salve', vague: 'srv.tueur.maree', spirale: 'srv.tueur.vase' }, gueule: { vise: 'srv.tueur.crachat', vague: 'srv.tueur.rot', spirale: 'srv.tueur.haleine' }, semeur: { vise: 'srv.tueur.graines', vague: 'srv.tueur.semailles', spirale: 'srv.tueur.pollen' }, pepiniere: { vise: 'srv.tueur.epines_pep', vague: 'srv.tueur.semis_pep', spirale: 'srv.tueur.pollen_pep' }, greffier: { vise: 'srv.tueur.plume', vague: 'srv.tueur.encre_vague', spirale: 'srv.tueur.feuillets' }, glaneuse: { vise: 'srv.tueur.boulons', vague: 'srv.tueur.moisson', spirale: 'srv.tueur.navette' } } as const)[this.profil][k]
  }

  attaqueCorps(vivants: PSim[], cad: number) {
    const b = this.boss!.e
    const l = this.P.corps[this.phase - 1]
    let a = l[this.ordre++ % l.length]
    // la Gueule ne rote pas pendant que ses dents ou sa langue sont annoncées : on aurait deux choses à lire à la fois
    if (a === 'vague' && this.profil === 'gueule' && this.w.teles.some((t) => t.kind === 'grille' || t.kind === 'ligne' || t.kind === 'colonnes')) a = 'vise'
    const dmg = this.boss!.dmg * 0.32
    const bo = this.borne
    if (a === 'vise') {
      const cible = vivants[Math.floor(Math.random() * vivants.length)]
      this.motif('vise', b.x, b.y + 18, Math.atan2(cible.s.y - (b.y + 18), cible.s.x - b.x), 3 + (this.phase === 3 ? 1 : 0), 0, 0.3, dmg, cause(this.src('vise')))
      this.atkT = 2.2 * cad
    } else if (a === 'vague') {
      this.motif('vague', bo.x0 - 6, ARENE.y0 + 60, 0, this.phase === 3 ? 4 : 3, bo.x1 - bo.x0 + 12, 0.35, dmg, cause(this.src('vague')))
      this.atkT = 3.4 * cad
    } else {
      // la grosse attaque : elle blanchit avant de tourner
      this.flash()
      this.motif('spirale', b.x, b.y + 6, Math.random() * 6.28, 24 + 4 * this.phase, Math.random() < 0.5 ? 1 : -1, 0.6, dmg, cause(this.src('spirale')))
      this.atkT = (2.4 + 0.11 * (24 + 4 * this.phase)) * cad
    }
  }

  attaqueSacs() {
    const dmg = (this.boss?.dmg ?? 30) * 0.28
    if (this.profil === 'gueule') {
      // la salive : deux filets depuis les commissures, qui se croisent (à partir de la phase 2)
      const b = this.boss?.e
      if (!b || this.phase < 2) return
      ;[-1, 1].forEach((sg, i) => { const x = b.x + sg * 34, y = b.y + 14, tx = i ? ARENE.x0 + 30 : ARENE.x1 - 30; this.motif('serpent', x, y, Math.atan2(ARENE.y1 - y, tx - x), 22, i ? -1 : 1, 0.3, dmg, cause('srv.tueur.salive')) })
      return
    }
    this.sacs.forEach((s, i) => {
      if (!s) return
      // chaque sac vise le coin bas opposé et balaie : les deux flots se croisent au milieu
      const tx = i ? ARENE.x0 + 30 : ARENE.x1 - 30
      this.motif('serpent', s.e.x, s.e.y + 8, Math.atan2(ARENE.y1 - s.e.y, tx - s.e.x), 30, i ? -1 : 1, 0.25, dmg, cause('srv.tueur.acide_sac'))
    })
  }

  /** les balles encore dans l'arène */
  ballesEnVol() {
    const now = this.now
    let n = 0
    for (const mv of this.motifs) {
      if (now < mv.m.t0) { n += 10; continue }
      const bs = balles(mv.m)
      for (let i = 0; i < bs.length; i++) if (!mv.mortes.has(i) && posBalle(mv.m, bs[i], now)) n++
    }
    return n
  }

  /** une zone de la Couveuse encore annoncée (ou une veine du sol qui se fissure) */
  zoneEnCours() {
    return this.w.teles.some((t) => t.kind === 'grille' || t.kind === 'colonnes' || t.kind === 'anneau' || (t.kind === 'ligne' || t.kind === 'cercle') && this.dedans(t.x + 8, t.y)) || this.veines.some((v) => v.t > 0) || !!this.plonge
  }

  /** Une zone à la fois, toujours annoncée au moins 1,2 s avec un contour net, et toujours avec un chemin sûr atteignable
   *  à la vitesse de base sans esquive (tests/arene-evitable.test.ts). En phase 3, anneaux et sol arraché alternent. */
  attaqueZone(vivants: PSim[], cad: number) {
    const bo = this.borne
    const dmg = (this.boss?.dmg ?? 30) * 0.9
    if (this.profil === 'engloutisseur') return this.zoneEnglou(vivants, cad, dmg)
    if (this.profil === 'gueule') return this.zoneGueule(vivants, cad, dmg)
    if (this.profil === 'semeur') return this.zoneSemeur(vivants, cad)
    if (this.profil === 'pepiniere') return this.zonePepiniere(vivants, cad, dmg)
    if (this.profil === 'greffier') return this.zoneGreffier(vivants, cad, dmg)
    if (this.profil === 'glaneuse') return this.zoneGlaneuse(vivants, cad, dmg)
    if (this.phase === 1) {
      // la ponte en damier : une case sur deux s'ouvre sous les pieds
      const x0 = bo.x0 - 6, y0 = ARENE.y0 + 4 * TILE
      this.w.addTele({ kind: 'grille', x: x0, y: y0, x2: bo.x1 + 6, y2: ARENE.y1, r: 2 * TILE, r2: this.ordre % 2, t: 1.5, total: 1.5, dmg, src: cause('srv.tueur.ponte') })
      this.zoneT = 9 * cad
    } else if (this.phase === 2) {
      // les spores tombent en colonnes, avec des couloirs entre elles
      this.flash()
      // quatre colonnes étroites, assez écartées pour laisser de vrais couloirs (au moins ~25 px entre deux)
      const larg = bo.x1 - bo.x0, n = 4
      const cols: number[] = []
      const R = graine((Math.random() * 2 ** 31) >>> 0)
      for (let i = 0; i < n; i++) cols.push(Math.round(bo.x0 + larg * (i + 0.35 + R() * 0.3) / n))
      this.w.addTele({ kind: 'colonnes', x: bo.x0, y: ARENE.y0 + 52, x2: bo.x1, y2: bo.y1 + 6, r: 12, cols, t: 1.6, total: 1.6, dmg, src: cause('srv.tueur.spores') })
      this.zoneT = 8 * cad
    } else if (this.zonesP3++ % 2 === 0) {
      // un anneau autour d'un soldat : rester au centre, ou sortir
      const p = vivants[Math.floor(Math.random() * vivants.length)]
      this.w.addTele({ kind: 'anneau', x: p.s.x, y: p.s.y, x2: 0, y2: 0, r: 50, r2: 22, t: 1.3, total: 1.3, dmg, src: cause('srv.tueur.anneau') })
      this.zoneT = 6 * cad
    } else {
      this.arracher()
      this.zoneT = 6 * cad
    }
  }

  // ------------------------------------------------------------------ l'Engloutisseur et la Gueule
  /** ce qui ne passe pas par les zones : les sangsues des trous de vase, l'aspiration */
  stepProfil(dt: number, _vivants: PSim[]) {
    if (this.profil === 'pepiniere') return this.stepPepiniere(dt)
    if (this.profil === 'greffier') return this.stepGreffier(dt)
    if (this.profil === 'glaneuse') return this.stepGlaneuse(dt)
    if (this.profil === 'semeur') {
      if (this.phase === 2 && (this.addsT -= dt) <= 0) {
        this.addsT = 16
        const n = [...this.w.enemies.values()].filter((e) => e.kind === E.GREFFE && this.dedans(e.e.x, e.e.y)).length
        for (const sx of [ARENE.x0 + 40, ARENE.x1 - 40]) if (n < 4) this.w.spawnEnemy(E.GREFFE, sx, ARENE.y0 + 60, { level: this.boss?.level ?? 20 })
      }
      return
    }
    if (this.profil !== 'engloutisseur') return
    if (this.phase >= 2 && (this.addsT -= dt) <= 0) {
      this.addsT = 10
      const n = [...this.w.enemies.values()].filter((e) => e.kind === E.SANGSUE && this.dedans(e.e.x, e.e.y)).length
      for (const sx of [ARENE.x0 + 40, ARENE.x1 - 40]) if (n < 4) {
        this.w.spawnEnemy(E.SANGSUE, sx, ARENE.y0 + 60, { level: this.boss?.level ?? 13 })
        this.w.hooks.fx(sx, ARENE.y0 + 60, { k: 'txt', x: sx, y: ARENE.y0 + 46, s: msg('srv.monde.vase'), c: '#9fd08a' })
      }
    }
    if (this.phase >= 3 && !this.plonge && !this.zoneEnCours() && (this.aspireCd -= dt) <= 0) {
      this.aspireCd = 14 * this.hCad; this.aspireT = 3
      this.flash(msg('srv.donjon.b_aspire_court'))
      this.envoyer()
      const b = this.boss!.e
      this.motif('spirale', b.x, b.y + 6, 0, 18, 1, 0.5, (this.boss?.dmg ?? 30) * 0.3, cause('srv.tueur.vase'))
    }
  }

  /** l'Engloutisseur : le saut sur un soldat, puis (phase 2) la vase qui reflue sous le groupe, en alternance */
  zoneEnglou(vivants: PSim[], cad: number, dmg: number) {
    const bo = this.borne, b = this.boss!.e
    if (this.phase >= 2 && this.ordre++ % 2 === 1) {
      // la bande où se tiennent le plus de soldats (48 px de haut), annoncée puis submergée
      const bandes = [0, 1, 2, 3].map((i) => bo.y0 + 64 + i * 40).filter((y) => y < bo.y1 - 10)
      let by = bandes[0], bn = -1
      for (const y of bandes) { const n = vivants.filter((p) => Math.abs(p.s.y - y) < 24).length; if (n > bn) { bn = n; by = y } }
      this.w.addTele({ kind: 'ligne', x: bo.x0 - 6, y: by, x2: bo.x1 + 6, y2: by, r: 22, t: 1.5, total: 1.5, dmg, src: cause('srv.tueur.reflux') })
      this.zoneT = 7 * cad
      return
    }
    const p = vivants[Math.floor(Math.random() * vivants.length)]
    const x = Math.max(bo.x0 + 20, Math.min(bo.x1 - 20, p.s.x)), y = Math.max(ARENE.y0 + 70, Math.min(bo.y1 - 20, p.s.y))
    this.w.addTele({ kind: 'cercle', x, y, x2: 0, y2: 0, r: 36, t: 1.4, total: 1.4, dmg, src: cause('srv.tueur.plongee') })
    this.plonge = { x, y, t: 1.4, pose: 1.2 }
    this.w.hooks.fx(b.x, b.y, { k: 'txt', x: b.x, y: b.y - 40, s: msg('srv.donjon.plonge'), c: '#9fd08a' })
    this.zoneT = 7.5 * cad
  }

  /** la Gueule : les crocs en colonnes, la langue qui balaie une rangée, les dents en damier */
  zoneGueule(vivants: PSim[], cad: number, dmg: number) {
    const bo = this.borne
    if (this.phase === 1) {
      this.flash()
      const larg = bo.x1 - bo.x0, n = 4, cols: number[] = []
      const R = graine((Math.random() * 2 ** 31) >>> 0)
      for (let i = 0; i < n; i++) cols.push(Math.round(bo.x0 + larg * (i + 0.35 + R() * 0.3) / n))
      this.w.addTele({ kind: 'colonnes', x: bo.x0, y: ARENE.y0 + 52, x2: bo.x1, y2: bo.y1 + 6, r: 12, cols, t: 1.6, total: 1.6, dmg, src: cause('srv.tueur.crocs') })
      this.zoneT = 8 * cad
    } else if (this.phase === 2) {
      // la langue : la rangée d'un soldat, d'un bord à l'autre
      const p = vivants[Math.floor(Math.random() * vivants.length)]
      const y = Math.max(ARENE.y0 + 70, Math.min(bo.y1 - 12, p.s.y))
      this.w.addTele({ kind: 'ligne', x: bo.x0 - 6, y, x2: bo.x1 + 6, y2: y, r: 16, t: 1.4, total: 1.4, dmg, src: cause('srv.tueur.langue') })
      this.zoneT = 6.5 * cad
    } else {
      const x0 = bo.x0 - 6, y0 = ARENE.y0 + 4 * TILE
      this.w.addTele({ kind: 'grille', x: x0, y: y0, x2: bo.x1 + 6, y2: ARENE.y1, r: 2 * TILE, r2: this.ordre++ % 2, t: 1.5, total: 1.5, dmg, src: cause('srv.tueur.dents') })
      this.zoneT = 7 * cad
    }
  }

  // ------------------------------------------------------------------ la Pépinière (la Serre)
  /** ce qu'elle voit : les soldats debout et les robots actifs dans l'arène (un robot compte comme un soldat) */
  silhouettes() {
    const l: { x: number; y: number }[] = []
    for (const p of this.w.players.values()) if (p.s.etat === 0 && this.dedans(p.s.x, p.s.y)) l.push({ x: p.s.x, y: p.s.y })
    for (const rs of this.w.robots.values()) if (rs.r.mode !== 3 && rs.r.mode !== 5 && rs.r.mode !== 6 && this.dedans(rs.r.x, rs.r.y)) l.push({ x: rs.r.x, y: rs.r.y })
    return l
  }

  /** La lecture : la part des silhouettes qui ont une voisine à moins de 48 px, sur les 8 dernières secondes. Serrés,
   *  elle répond par l'essaim (un cercle sur le plus gros groupe) ; dispersés, par les épines (une bande sur le plus seul). */
  lire() {
    let n = 0, serres = 0
    for (const r of this.releves) for (const a of r) { n++; if (r.some((b) => b !== a && Math.hypot(a.x - b.x, a.y - b.y) < 48)) serres++ }
    this.doctrine = n && serres / n >= 0.5 ? 'essaim' : 'epines'
    this.flash(msg(this.doctrine === 'essaim' ? 'srv.donjon.b_essaim' : 'srv.donjon.b_epines'))
    this.w.hooks.log(msg(this.doctrine === 'essaim' ? 'srv.donjon.lu_essaim' : 'srv.donjon.lu_epines'), this.P.c)
  }

  stepPepiniere(dt: number) {
    if ((this.releveT -= dt) <= 0) { this.releveT = 0.5; this.releves.push(this.silhouettes()); if (this.releves.length > 16) this.releves.shift() }
    // les boutures en pot : deux pots tous les 12 s (quatre au plus) ; un pot qui reste seul éclot (World, E.POT)
    if ((this.potT -= dt) <= 0) {
      this.potT = 12 * this.hCad
      const pots = [...this.w.enemies.values()].filter((e) => e.kind === E.POT && this.dedans(e.e.x, e.e.y)).length
      const bo = this.borne
      for (let k = 0; k < 2 && pots + k < 4; k++) {
        const x = bo.x0 + 30 + Math.random() * (bo.x1 - bo.x0 - 60), y = ARENE.y0 + 90 + Math.random() * Math.max(10, bo.y1 - ARENE.y0 - 120)
        const pot = this.w.spawnEnemy(E.POT, x, y, { level: this.boss?.level ?? 27 })
        if (pot) pot.hatchT = 7
      }
    }
  }

  zonePepiniere(vivants: PSim[], cad: number, dmg: number) {
    const bo = this.borne
    // phase 3 : la serre se ferme, les vitres tombent en colonnes, une fois sur deux
    if (this.phase === 3 && this.zonesP3++ % 2 === 1) {
      this.flash()
      const larg = bo.x1 - bo.x0, n = 4, cols: number[] = []
      const R = graine((Math.random() * 2 ** 31) >>> 0)
      for (let i = 0; i < n; i++) cols.push(Math.round(bo.x0 + larg * (i + 0.35 + R() * 0.3) / n))
      this.w.addTele({ kind: 'colonnes', x: bo.x0, y: ARENE.y0 + 52, x2: bo.x1, y2: bo.y1 + 6, r: 12, cols, t: 1.6, total: 1.6, dmg, src: cause('srv.tueur.vitres') })
      this.zoneT = 7 * cad
      return
    }
    const sil = this.silhouettes()
    if (!sil.length) sil.push(...vivants.map((p) => ({ x: p.s.x, y: p.s.y })))
    const voisins = (a: { x: number; y: number }) => sil.filter((b) => Math.hypot(a.x - b.x, a.y - b.y) < 48)
    if (this.doctrine === 'essaim') {
      // le cercle sur le plus gros groupe (le milieu de la silhouette la plus entourée et de ses voisines)
      const c = sil.reduce((a, b) => voisins(b).length > voisins(a).length ? b : a)
      const g = voisins(c)
      const x = Math.max(bo.x0 + 20, Math.min(bo.x1 - 20, g.reduce((t, q) => t + q.x, 0) / g.length)), y = Math.max(ARENE.y0 + 70, Math.min(bo.y1 - 20, g.reduce((t, q) => t + q.y, 0) / g.length))
      this.w.addTele({ kind: 'cercle', x: Math.round(x), y: Math.round(y), x2: 0, y2: 0, r: 42, t: 1.5, total: 1.5, dmg, src: cause('srv.tueur.essaim') })
      this.zoneT = 6.5 * cad
    } else {
      // la bande d'épines sur la silhouette la plus seule, d'un bord à l'autre
      const c = sil.reduce((a, b) => voisins(b).length < voisins(a).length ? b : a)
      const y = Math.max(ARENE.y0 + 70, Math.min(bo.y1 - 12, c.y))
      this.w.addTele({ kind: 'ligne', x: bo.x0 - 6, y: Math.round(y), x2: bo.x1 + 6, y2: Math.round(y), r: 16, t: 1.4, total: 1.4, dmg, src: cause('srv.tueur.epines') })
      this.zoneT = 6.5 * cad
    }
  }

  // ------------------------------------------------------------------ le Greffier (le Registre)
  /** un nom de soldat tombé sur ce serveur (les plus récents d'abord), ou un nom ancien */
  nomSuivant() {
    if (!this.noms.length) {
      let morts: string[] = []
      try { morts = (db().deaths(40) as { family: string; given: string }[]).map((d) => `${d.family}, ${d.given}`) } catch { /* pas de base (tests) */ }
      this.noms = morts.length ? morts : [...NOMS_ANCIENS]
    }
    return this.noms.shift()!
  }

  stepGreffier(dt: number) {
    if ((this.appelT -= dt) > 0) return
    // l'appel : des noms se lèvent dans les coins du bas et marchent vers lui
    this.appelT = 13 * this.hCad
    const n = 2 + (this.heroique ? 1 : 0) + (this.phase === 3 ? 1 : 0)
    const deja = [...this.w.enemies.values()].filter((e) => e.kind === E.PORTENOM && this.dedans(e.e.x, e.e.y)).length
    const bo = this.borne
    const noms: string[] = []
    for (let k = 0; k < n && deja + k < 5; k++) {
      const x = k % 2 ? bo.x1 - 24 : bo.x0 + 24, y = bo.y1 - 18 - Math.floor(k / 2) * 26
      const pn = this.w.spawnEnemy(E.PORTENOM, x, y, { level: this.boss?.level ?? 30 })
      if (!pn) continue
      pn.e.nom = this.nomSuivant(); noms.push(pn.e.nom)
    }
    if (noms.length) this.w.hooks.log(msg('srv.donjon.appel', { noms: noms.join(' · ') }), this.P.c)
  }

  /** Un porte-nom marche vers le Greffier. Les balles ne lui font rien : un soldat qui va le toucher le rend (le nom
   *  est rendu à la lignée, le groupe reprend 5 % de ses PV). S'il atteint le Greffier, le nom est cousu au registre et
   *  sa prochaine rature s'élargit d'une bande. */
  stepPorteNom(es: ESim, dt: number) {
    const b = this.boss?.e
    if (!b || !this.ferme) return
    const touche = [...this.w.players.values()].find((p) => p.s.etat === 0 && Math.hypot(p.s.x - es.e.x, p.s.y - es.e.y) < PLAYER_R + 9)
    if (touche) {
      for (const p of this.w.players.values()) if (p.s.etat === 0 && this.dedans(p.s.x, p.s.y)) this.w.heal(p, p.s.maxHp * 0.05)
      this.w.hooks.fx(es.e.x, es.e.y, { k: 'txt', x: es.e.x, y: es.e.y - 18, s: msg('srv.donjon.nom_rendu', { nom: es.e.nom }), c: '#e8dcc0' })
      this.w.removeEnemy(es.id)
      return
    }
    const d = Math.hypot(b.x - es.e.x, b.y - es.e.y)
    if (d < 30) {
      this.encre = Math.min(3, this.encre + 1)
      this.w.hooks.fx(b.x, b.y, { k: 'txt', x: b.x, y: b.y - 44, s: msg('srv.donjon.recousu', { nom: es.e.nom }), c: '#c8b8ff' })
      this.w.removeEnemy(es.id)
      return
    }
    const v = 26 * dt
    es.e.x += (b.x - es.e.x) / d * v; es.e.y += (b.y - es.e.y) / d * v
    es.e.angle = Math.atan2(b.y - es.e.y, b.x - es.e.x)
  }

  zoneGreffier(vivants: PSim[], cad: number, dmg: number) {
    const bo = this.borne, b = this.boss!.e
    if (this.phase === 3) {
      const k = this.zonesP3++ % 3
      if (k === 1) {
        // les pages tombent en colonnes
        this.flash()
        const larg = bo.x1 - bo.x0, n = 4, cols: number[] = []
        const R = graine((Math.random() * 2 ** 31) >>> 0)
        for (let i = 0; i < n; i++) cols.push(Math.round(bo.x0 + larg * (i + 0.35 + R() * 0.3) / n))
        this.w.addTele({ kind: 'colonnes', x: bo.x0, y: ARENE.y0 + 52, x2: bo.x1, y2: bo.y1 + 6, r: 12, cols, t: 1.6, total: 1.6, dmg, src: cause('srv.tueur.pages') })
        this.zoneT = 6.5 * cad
        return
      }
      if (k === 2) {
        // l'encre monte en anneau au milieu de l'arène : rester au centre, ou sur les bords
        const cx = Math.round((bo.x0 + bo.x1) / 2), cy = Math.round((ARENE.y0 + 70 + bo.y1) / 2)
        this.w.addTele({ kind: 'anneau', x: cx, y: cy, x2: 0, y2: 0, r: 104, r2: 44, t: 1.6, total: 1.6, dmg, src: cause('srv.tueur.encre') })
        this.zoneT = 6.5 * cad
        return
      }
    }
    // la rature : une bande sur la droite qui passe par les deux soldats les plus éloignés l'un de l'autre (seul : du
    // Greffier au soldat), prolongée jusqu'aux bords ; chaque porte-nom recousu l'élargit
    let a = { x: b.x, y: b.y + 20 }, c = { x: vivants[0].s.x, y: vivants[0].s.y }, best = -1
    for (const p of vivants) for (const q of vivants) { const d = Math.hypot(p.s.x - q.s.x, p.s.y - q.s.y); if (p !== q && d > best) { best = d; a = { x: p.s.x, y: p.s.y }; c = { x: q.s.x, y: q.s.y } } }
    const d = Math.hypot(c.x - a.x, c.y - a.y) || 1, ux = (c.x - a.x) / d, uy = (c.y - a.y) / d
    const r = 14 + 8 * this.encre
    // la droite, coupée aux bords de l'arène
    const [t0, t1] = coupe(a.x, a.y, ux, uy, bo.x0 - 6, ARENE.y0 + 40, bo.x1 + 6, bo.y1 + 6)
    this.w.addTele({ kind: 'ligne', x: Math.round(a.x + ux * t0), y: Math.round(a.y + uy * t0), x2: Math.round(a.x + ux * t1), y2: Math.round(a.y + uy * t1), r, t: 1.5, total: 1.5, dmg: dmg * (1 + 0.15 * this.encre), src: cause('srv.tueur.rature') })
    if (this.encre) this.w.hooks.fx(b.x, b.y, { k: 'txt', x: b.x, y: b.y - 40, s: msg('srv.donjon.rature_large', { n: this.encre }), c: '#c8b8ff' })
    this.encre = 0
    this.zoneT = 6 * cad
  }

  // ------------------------------------------------------------------ la Glaneuse (l'assaut du Métier)
  /** les robots qu'elle peut glaner : actifs, dans l'arène */
  robotsGlanables() { return [...this.w.robots.values()].filter((rs) => rs.kind === 'robot' && rs.owner && rs.r.mode !== 3 && rs.r.mode !== 5 && rs.r.mode !== 6 && this.dedans(rs.r.x, rs.r.y)) }

  stepGlaneuse(dt: number) {
    // la glane : un câble de sève tire le robot visé vers elle (il s'arrête à 90 px) ; le cercle le suit
    const bb = this.boss?.e
    for (const t of this.w.teles) if (t.sp === 'glane' && t.suit) {
      const rs = this.w.robots.get(t.suit)
      if (!rs || rs.r.mode === 3) continue
      rs.r.mode = 1
      if (bb) { const d = Math.hypot(bb.x - rs.r.x, bb.y - rs.r.y); if (d > 90) { const v = Math.min(d - 90, 30 * dt); rs.r.x += (bb.x - rs.r.x) / d * v; rs.r.y += (bb.y - rs.r.y) / d * v } }
      t.x = rs.r.x; t.y = rs.r.y
    }
    // la pince : le soldat le plus proche d'elle prend le coup ; un tank (fantassin, démolisseur) l'encaisse, un autre
    // en prend trois fois plus
    if ((this.pinceT -= dt) > 0 || !this.boss) return
    this.pinceT = 2.6 * this.hCad
    const b = this.boss.e
    let cible: PSim | null = null, bd = 1e9
    for (const p of this.w.players.values()) if (p.s.etat === 0 && this.dedans(p.s.x, p.s.y)) { const d = Math.hypot(p.s.x - b.x, p.s.y - b.y); if (d < bd) { bd = d; cible = p } }
    if (!cible) return
    const tank = cible.cls === 'fantassin' || cible.cls === 'demolisseur'
    this.w.hooks.fx(cible.s.x, cible.s.y, { k: 'txt', x: cible.s.x, y: cible.s.y - 20, s: msg(tank ? 'srv.raid.pince' : 'srv.raid.pince_dure'), c: tank ? '#ffd27a' : '#ff6b4a' })
    this.w.hooks.fx(cible.s.x, cible.s.y, { k: 'vfx', nom: 'pince', x: cible.s.x, y: cible.s.y })
    this.w.damagePlayer(cible, this.boss.dmg * 1.4 * (tank ? 1 : 3), cause('srv.tueur.pince'))
  }

  /** La glane (le robot le plus loin de son soldat, à veiller) une fois sur deux ; sinon la zone de la phase : rien en
   *  phase 1, les bandes des pylônes l'un après l'autre en phase 2, l'appel (grand cercle autour d'elle, puis les fils
   *  en colonnes) en phase 3. */
  zoneGlaneuse(vivants: PSim[], cad: number, dmg: number) {
    const bo = this.borne, b = this.boss!.e
    const tour = this.tour++
    if (tour % 2 === 0) {
      let best: RSimLike | null = null, bd = -1
      for (const rs of this.robotsGlanables()) { const d = Math.hypot(rs.r.x - rs.owner!.s.x, rs.r.y - rs.owner!.s.y); if (d > bd) { bd = d; best = rs } }
      if (best) {
        this.w.addTele({ kind: 'cercle', x: best.r.x, y: best.r.y, x2: 0, y2: 0, r: 30, t: 4, total: 4, dmg: 0, src: cause('srv.tueur.glaneuse'), sp: 'glane', suit: best.id })
        this.flash(msg('srv.raid.b_glane'))
        this.zoneT = 6 * cad
        return
      }
    }
    if (this.phase === 2 && this.pylones.some((p) => this.w.enemies.has(p.id))) {
      // un pylône balaie : une bande de lui jusqu'au bout de l'arène, à travers un soldat
      const vifs = this.pylones.filter((p) => this.w.enemies.has(p.id))
      const py = vifs[this.tirPylone++ % vifs.length].e
      const cible = vivants[Math.floor(Math.random() * vivants.length)]
      const d = Math.hypot(cible.s.x - py.x, cible.s.y - py.y) || 1, ux = (cible.s.x - py.x) / d, uy = (cible.s.y - py.y) / d
      const [, L] = coupe(py.x, py.y, ux, uy, bo.x0 - 6, ARENE.y0 + 40, bo.x1 + 6, bo.y1 + 6)
      this.w.addTele({ kind: 'ligne', x: py.x, y: py.y, x2: Math.round(py.x + ux * L), y2: Math.round(py.y + uy * L), r: 18, t: 1.6, total: 1.6, dmg: dmg * 0.9, src: cause('srv.tueur.pylone') })
      this.zoneT = 5 * cad
      return
    }
    if (this.phase === 3) {
      if (tour % 4 === 1) {
        // l'appel : elle émet, tout ce qui est près d'elle brûle
        this.w.addTele({ kind: 'cercle', x: Math.round(b.x), y: Math.round(b.y + 20), x2: 0, y2: 0, r: 110, t: 2, total: 2, dmg: dmg * 1.2, src: cause('srv.tueur.appel') })
        this.flash(msg('srv.raid.b_emet'))
      } else {
        const larg = bo.x1 - bo.x0, n = 5, cols: number[] = []
        const R = graine((Math.random() * 2 ** 31) >>> 0)
        for (let i = 0; i < n; i++) cols.push(Math.round(bo.x0 + larg * (i + 0.35 + R() * 0.3) / n))
        this.w.addTele({ kind: 'colonnes', x: bo.x0, y: ARENE.y0 + 52, x2: bo.x1, y2: bo.y1 + 6, r: 12, cols, t: 1.7, total: 1.7, dmg, src: cause('srv.tueur.fils') })
      }
      this.zoneT = 5.5 * cad
      return
    }
    this.zoneT = 3 * cad
  }

  // ------------------------------------------------------------------ le Semeur (raid)
  /** Le Semeur alterne la taille (sur le tank) et la mécanique de sa phase : le semis (phase 1, les graines à partager),
   *  les greffes (phase 2, s'écarter), le désherbage (phase 3, se serrer sous le pommier). */
  zoneSemeur(vivants: PSim[], cad: number) {
    const bo = this.borne, b = this.boss!.e, dmg = this.boss!.dmg
    if (this.tour++ % 2 === 0) {
      // la taille : une ligne du Semeur jusqu'un peu au-delà du soldat le plus proche (le tank la prend, les autres s'écartent)
      const t = vivants.reduce((a, p) => Math.hypot(p.s.x - b.x, p.s.y - b.y) < Math.hypot(a.s.x - b.x, a.s.y - b.y) ? p : a)
      const d = Math.hypot(t.s.x - b.x, t.s.y - b.y) || 1, l = d + 40
      this.w.addTele({ kind: 'ligne', x: b.x, y: b.y, x2: b.x + (t.s.x - b.x) / d * l, y2: b.y + (t.s.y - b.y) / d * l, r: 14, t: 1.6, total: 1.6, dmg: dmg * 1.6 * (1 + 0.1 * this.seve), src: cause('srv.tueur.taille'), sp: 'taille' })
      this.zoneT = 4.5 * cad
      return
    }
    if (this.phase === 1) {
      // le semis : deux graines au sol ; il faut s'y tenir à plusieurs, sinon elles germent
      const partage = vivants.length >= 6 ? 3 : 2
      const y = bo.y1 - 60, R = graine((Math.random() * 2 ** 31) >>> 0)
      for (const k of [0.25, 0.75]) this.w.addTele({ kind: 'cercle', x: Math.round(bo.x0 + (bo.x1 - bo.x0) * (k + (R() - 0.5) * 0.12)), y, x2: 0, y2: 0, r: 30, t: 3.4, total: 3.4, dmg: dmg * 2.4, src: cause('srv.tueur.semis'), sp: 'semis', partage })
      this.flash(msg('srv.raid.b_semis'))
      this.zoneT = 6.5 * cad
    } else if (this.phase === 2) {
      // les greffes : trois soldats marqués (pas le plus proche du Semeur) ; la greffe éclate sur ceux qui restent collés
      const tri = [...vivants].sort((p, q) => Math.hypot(p.s.x - b.x, p.s.y - b.y) - Math.hypot(q.s.x - b.x, q.s.y - b.y)).slice(1)
      for (let i = tri.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tri[i], tri[j]] = [tri[j], tri[i]] }
      for (const p of tri.slice(0, Math.min(3, Math.max(1, vivants.length - 2)))) this.w.addTele({ kind: 'cercle', x: p.s.x, y: p.s.y, x2: 0, y2: 0, r: 30, t: 3.0, total: 3.0, dmg: dmg * 1.1, src: cause('srv.tueur.greffe'), sp: 'greffe', suit: p.sid })
      this.flash(msg('srv.raid.b_greffes_court'))
      this.zoneT = 7 * cad
    } else {
      // le désherbage : tout le sol brûle, sauf sous le pommier ; le pommier repousse ailleurs à chaque fois
      // il repousse à 30–70 px du milieu du raid : tout le monde l'atteint à pied avant le feu
      const R = graine((Math.random() * 2 ** 31) >>> 0)
      const mx = vivants.reduce((a, p) => a + p.s.x, 0) / vivants.length, my = vivants.reduce((a, p) => a + p.s.y, 0) / vivants.length
      const ang = R() * Math.PI * 2, dist = 30 + R() * 40
      const x = Math.max(bo.x0 + 50, Math.min(bo.x1 - 50, mx + Math.cos(ang) * dist)), y = Math.max(ARENE.y0 + 100, Math.min(bo.y1 - 40, my + Math.sin(ang) * dist))
      this.pommier = { x: Math.round(x), y: Math.round(y) }
      this.w.addTele({ kind: 'anneau', x: this.pommier.x, y: this.pommier.y, x2: 0, y2: 0, r: 900, r2: 54, t: 3.4, total: 3.4, dmg: dmg * 1.4, src: cause('srv.tueur.desherbage'), sp: 'desherbage' })
      this.flash(msg('srv.raid.b_pommier'))
      this.zoneT = 7 * cad
    }
  }

  /** L'éclatement d'une zone du Semeur (appelé par World.stepTeles) ; true si elle est traitée ici. */
  boomSp(t: Tele) {
    const w = this.w
    const dedans = [...w.players.values()].filter((p) => p.s.etat === 0 && w.inTele(t, p.s.x, p.s.y, PLAYER_R))
    if (t.sp === 'semis') {
      const n = dedans.length
      if (n >= (t.partage ?? 2)) { for (const p of dedans) w.damagePlayer(p, t.dmg / n, t.src); return true }
      // pas assez de monde : la graine germe (deux greffés) et tout le raid prend un éclat de sève
      for (const p of dedans) w.damagePlayer(p, t.dmg / Math.max(1, n), t.src)
      for (const p of w.players.values()) if (p.s.etat === 0 && this.dedans(p.s.x, p.s.y) && !dedans.includes(p)) w.damagePlayer(p, t.dmg * 0.15, t.src)
      for (const s of [-1, 1]) w.spawnEnemy(E.GREFFE, t.x + s * 16, t.y, { level: this.boss?.level ?? 20 })
      w.hooks.fx(t.x, t.y, { k: 'txt', x: t.x, y: t.y - 30, s: msg('srv.raid.germe'), c: '#d8e06a' })
      return true
    }
    if (t.sp === 'glane') {
      const rs = t.suit ? w.robots.get(t.suit) : undefined
      if (!rs || rs.r.mode === 3) return true
      // veillé : un soldat (pas forcément le sien) se tient près du robot quand le cercle se referme
      const veille = [...w.players.values()].some((p) => p.s.etat === 0 && Math.hypot(p.s.x - rs.r.x, p.s.y - rs.r.y) < t.r + 4)
      if (veille) { rs.r.mode = 0; w.hooks.fx(rs.r.x, rs.r.y, { k: 'txt', x: rs.r.x, y: rs.r.y - 18, s: msg('srv.raid.veille'), c: '#7fd6ff' }); return true }
      // glané : le robot s'éteint, une balise se lève à sa place et tire pour elle ; elle se renforce
      rs.r.mode = 3; rs.offT = 1e6
      const bal = w.spawnEnemy(E.BALISE, rs.r.x + 8, rs.r.y, { level: this.boss?.level ?? 33 })
      if (bal) { bal.robotGlane = rs.id; bal.e.hp = bal.e.maxHp = Math.min(65000, bal.e.maxHp * 3); bal.dmg *= 1.6 }
      this.glanes++
      // elle tisse le robot au Métier : +15 % de dégâts, et elle reprend 3 % de ses PV
      if (this.boss) { this.boss.dmg *= 1.15; this.boss.e.hp = Math.min(this.boss.e.maxHp, this.boss.e.hp + this.boss.e.maxHp * 0.03) }
      w.hooks.fx(rs.r.x, rs.r.y, { k: 'txt', x: rs.r.x, y: rs.r.y - 18, s: msg('srv.raid.glane'), c: '#ffb86b' })
      w.hooks.fx(rs.r.x, rs.r.y, { k: 'vfx', nom: 'glane', x: rs.r.x, y: rs.r.y })
      return true
    }
    if (t.sp === 'greffe') {
      for (const p of dedans) w.damagePlayer(p, p.sid === t.suit ? t.dmg * 0.4 : t.dmg, t.src)
      return true
    }
    if (t.sp === 'taille') {
      for (const p of dedans) w.damagePlayer(p, t.dmg, t.src)
      // personne ne l'a prise : le Semeur se nourrit (sève)
      if (!dedans.length && this.boss && this.seve < 5) {
        this.seve++; this.boss.dmg *= 1.1
        const b = this.boss.e
        w.hooks.fx(b.x, b.y, { k: 'txt', x: b.x, y: b.y - 40, s: msg('srv.raid.seve', { n: this.seve }), c: '#d8e06a' })
      }
      return true
    }
    return false
  }

  ponte() {
    const n = [...this.w.enemies.values()].filter((e) => e.kind === E.OEUF || e.kind === E.RAMPANT).length
    if (n > 6) return
    for (const s of this.sacs) {
      if (!s) continue
      const x = s.e.x + (Math.random() - 0.5) * 50, y = s.e.y + 40 + Math.random() * 50
      this.w.spawnEnemy(E.OEUF, x, y, { wave: -1 })
      this.w.hooks.fx(s.e.x, s.e.y, { k: 'txt', x: s.e.x, y: s.e.y - 18, s: msg('srv.arene.il_pond'), c: '#c48bff' })
    }
  }

  /** Phase 3 : une veine du sol se fissure (1,4 s d'annonce), puis devient de l'acide ou du vide pendant 9 s, et cicatrise.
   *  Au plus 25 % du sol abîmé : la plus vieille veine cicatrise d'abord. */
  arracher() {
    this.flash()
    const bo = this.borne
    const c0 = Math.ceil((bo.x0 - ARENE.x0) / TILE), c1 = Math.floor((bo.x1 - ARENE.x0) / TILE)
    // pas sous la Couveuse (les 4 premières rangées), ni sous les murs du bas
    const r0 = 4, r1 = ARENE_ROWS - (this.phase >= 2 ? RETRECI_BAS : 0)
    const vide = Math.random() < 0.4
    for (let v = 0; v < 2; v++) {
      let cx = c0 + Math.floor(Math.random() * (c1 - c0)), cy = r0 + Math.floor(Math.random() * (r1 - r0))
      const cases: number[] = []
      const len = 6 + Math.floor(Math.random() * 5)
      const horiz = Math.random() < 0.7
      for (let i = 0; i < len; i++) {
        if (cx >= c0 && cx < c1 && cy >= r0 && cy < r1) {
          const id = cy * ARENE_COLS + cx
          if (this.sol[id] === SOL.INTACT) { this.sol[id] = SOL.FISSURE; cases.push(id) }
        }
        if (horiz) { cx += Math.random() < 0.8 ? 1 : 0; cy += Math.random() < 0.3 ? (Math.random() < 0.5 ? 1 : -1) : 0 }
        else { cy += Math.random() < 0.8 ? 1 : 0; cx += Math.random() < 0.3 ? (Math.random() < 0.5 ? 1 : -1) : 0 }
      }
      if (cases.length) this.veines.push({ cases, t: 1.4, vers: vide ? SOL.VIDE : SOL.ACIDE, vie: 9 })
    }
    let mauvaises = 0
    for (const s of this.sol) if (s) mauvaises++
    while (mauvaises > this.sol.length * 0.25 && this.veines.length > 2) {
      const v = this.veines.shift()!
      for (const id of v.cases) { if (this.sol[id]) mauvaises--; this.sol[id] = SOL.INTACT }
    }
    this.envoyer()
  }

  stepSol(dt: number, vivants: PSim[]) {
    let change = false
    for (const v of this.veines) {
      if (v.t > 0) {
        v.t -= dt
        if (v.t <= 0) { for (const id of v.cases) if (this.sol[id] === SOL.FISSURE) this.sol[id] = v.vers; change = true }
      } else if ((v.vie -= dt) <= 0) { for (const id of v.cases) this.sol[id] = SOL.INTACT; change = true }
    }
    this.veines = this.veines.filter((v) => v.t > 0 || v.vie > 0)
    if (change) this.envoyer()
    this.solT -= dt
    if (this.solT > 0) return
    this.solT = 0.5
    for (const p of vivants) {
      const c = caseSol(p.s.x, p.s.y)
      const s = c >= 0 ? this.sol[c] : 0
      if (s === SOL.ACIDE) this.w.damagePlayer(p, 7, cause('srv.tueur.acide'))
      else if (s === SOL.VIDE) this.w.damagePlayer(p, 13, cause('srv.tueur.vide'))
    }
  }

  /** les balles des motifs : le même calcul que le client, au temps du monde */
  touches() {
    const now = this.now
    for (const mv of this.motifs) {
      if (now < mv.m.t0) continue
      for (const p of this.w.players.values()) {
        if (p.s.etat !== 0 || p.invulT > 0 || p.s.dashT > 0) continue
        const i = touche(mv.m, now, p.s.x, p.s.y, mv.mortes)
        if (i < 0) continue
        mv.mortes.add(i)
        this.w.damagePlayer(p, mv.dmg, mv.src)
        this.w.hooks.arene?.('bh', { m: mv.m.id, i, v: p.sid })
      }
    }
  }

  // ------------------------------------------------------------------ messages
  /** l'éclair blanc avant une grosse attaque ; avec un bandeau pour les changements de phase */
  flash(bandeau?: Msg) {
    const b = this.boss?.e
    this.w.hooks.arene?.('aflash', { x: b?.x ?? 0, y: b?.y ?? 0, s: bandeau ?? '' })

  }

  snapshot() {
    return { e: this.etat, ph: this.phase, sol: Array.from(this.sol).join(''), r: RETRECI, rb: RETRECI_BAS, t: this.now, pf: this.profil, h: this.heroique ? 1 : 0, asp: this.aspireT > 0 ? 1 : 0 }
  }

  /** ce qu'un client qui arrive doit savoir : l'état et les motifs encore en vol */
  pourNouveau() {
    const now = this.now
    return { arene: this.snapshot(), motifs: this.motifs.map((mv) => ({ ...mv.m, dt: mv.m.t0 - now, mortes: [...mv.mortes] })) }
  }

  envoyer() { this.w.hooks.arene?.('arene', this.snapshot()) }
}

