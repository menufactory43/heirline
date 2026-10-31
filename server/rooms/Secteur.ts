// Une carte du monde (le continent, l'épave de la Constance, ou une instance du nid), servie par un salon.
// Une carte pleine ouvre une copie (filtre sur la carte, seuil par carte) ; ce qui doit être pareil dans
// toutes les copies (ruches, avant-postes, heure, temps) vient du service central.
import { social, type Salle, type Canal } from '../social.ts'
import type { Client } from 'colyseus'
import { TILE } from '../../shared/consts.ts'
import { isSolidTile, T } from '../../shared/map.ts'
import { carteMap } from '../../shared/cartes/index.ts'
import { CARTES, PASSAGE_BY_ID, STATION_BY_ID, STATIONS, STATION_COUT, STATION_R, isCarte, type CarteId, type Passage } from '../../shared/monde.ts'
import { CLASS_IDS, ENEMIES, heirLevel, robotHp, robotUpgradeCost, robotPartsCost, ROBOT, type ClassId } from '../../shared/rules.ts'
import { countInv, takeFromInv, SLOTS, type Slot } from '../../shared/items.ts'
import { ENDROIT_BY_ID } from '../../shared/journaux.ts'
import { NPC_BY_ID } from '../../shared/npcs.ts'
import { World, type PSim } from '../world/World.ts'
import { Vie } from '../world/Vie.ts'
import { BotBrain } from '../world/bots.ts'
import { ARENE } from '../../shared/motifs.ts'
import { trajet, quai } from '../../shared/monorail.ts'
import { reprise, depart, type Pos } from '../reprise.ts'
import { Ossara } from '../ossara.ts'
import { GameRoom, validClass, parseJson } from './GameRoom.ts'
import { BOSS_TEST, ENTREES_TEST, equipementTest, testDef } from '../../shared/boss-test.ts'
import { REGIONS } from '../../shared/regions/index.ts'
import { heritage, nettoyer, talentsAuto } from '../../shared/talents.ts'
import { pvRobot } from '../world/competences.ts'
import { db, randomGiven, unusedGiven } from '../db.ts'
import { central, type CentralListener } from '../central.ts'
import { msg, ref, lireCause, type Texte } from '../../shared/i18n/index.ts'

export const sectorMap = carteMap('ossara')

/** Les arrivées attendues : un soldat qui prend un passage est attendu sur l'autre carte, à cet endroit. */
const arrivees = new Map<string, { carte: CarteId; x: number; y: number; until: number; test?: string }>()
export function arriveeDe(p: Passage) { return { x: (p.x + p.sortie[0]) * TILE + 8, y: (p.y + p.sortie[1]) * TILE + 8 } }

const connexions = new Map<string, number[]>()
function tropDeConnexions(ip: string) {
  const now = Date.now()
  const a = (connexions.get(ip) ?? []).filter((t) => now - t < 60_000)
  a.push(now); connexions.set(ip, a)
  if (connexions.size > 5000) for (const [k, v] of connexions) if (now - v[v.length - 1] > 60_000) connexions.delete(k)
  return a.length > 40
}

export class Secteur extends GameRoom {
  maxClients = 200
  autoDispose = false
  carte: CarteId = 'ossara'
  ecoute: CentralListener = { log: (t, c) => this.logHook(t, c) }
  passT = new Map<string, number>()
  saveT = 0
  nestBots = new Set<string>()
  noHumanInNestT = 0
  vie!: Vie
  ossara!: Ossara

  /** cette copie vue du social (server/social.ts) */
  salle!: Salle
  groupeInstance = ''
  avertis = new Map<string, number>()

  onCreate(options: any) {
    this.carte = isCarte(options?.carte) ? options.carte : 'ossara'
    // une instance de groupe : le groupe pour lequel elle a été ouverte (revérifié côté serveur à chaque entrée)
    this.groupeInstance = CARTES[this.carte].instance && typeof options?.groupe === 'string' ? options.groupe.slice(0, 32) : ''
    this.salle = {
      carte: this.carte, instance: !!CARTES[this.carte].instance,
      temps: () => this.world.time,
      joueur: (sid) => this.world.players.get(sid),
      envoyer: (sid, type, m) => this.clients.find((c) => c.sessionId === sid)?.send(type, m),
      diffuser: (type, m) => this.broadcast(type, m),
      sauver: (p) => this.saveSoldier(p),
      pousserInv: (p) => this.ossara.pushInv(p),
    }
    this.maxClients = CARTES[this.carte].seuil
    // le continent reste ouvert ; les cartes reliées et les instances du nid se ferment quand elles sont vides
    this.autoDispose = this.carte !== 'ossara'
    this.setMetadata({ carte: this.carte, groupe: this.groupeInstance || undefined })
    const c = central()
    c.listeners.add(this.ecoute)
    const world = new World({ mode: 'secteur', map: carteMap(this.carte), central: c }, {
      fx: (x, y, ev) => this.fxHook(x, y, ev),
      log: (t, c) => this.logHook(t, c),
      bank: (p, n) => { if (!p.bot && !p.test) db().addScrap(p.account, n) },
      levelUp: (p) => { if (!p.bot) this.saveSoldier(p) },
      finTest: (p, raison) => this.finTest(p, raison),
      evacuate: (p) => this.onEvacuate(p),
      duelFin: (g, p) => social().finDuel(this.salle, g, p, 'ko'),
      // arrivé au quai : la position est gardée tout de suite (une coupure juste après ne ramène pas au départ)
      railFin: (p) => { if (!p.bot) this.saveSoldier(p) },
      permadeath: (p, killer) => this.onPermadeath(p, killer),
      // un soldat de test ne gagne rien (quêtes, butin, exploits) ; un boss tombé met fin à son test
      kill: (by, es, near) => {
        if (ENEMIES[es.kind]?.boss) for (const q of this.world.players.values()) if (q.test && !q.test.finA) q.test.finA = this.world.time + 8
        // le boss d'un donjon tombé : l'héroïque s'ouvre pour les lignées présentes (pas pour un soldat de test)
        const ar = CARTES[this.carte]?.arene
        if (ar && es === this.world.arene?.boss) for (const q of this.world.players.values()) if (!q.bot && !q.test && q.account && this.world.arene.dedans(q.s.x, q.s.y)) {
          const k = 'donjon_' + (ar.normale ?? this.carte)
          if (db().flags(q.account)[k] !== '1') { db().setFlag(q.account, k, '1'); if (!ar.heroique && CARTES[(this.carte + '_h') as CarteId]) this.dire(q, msg('srv.donjon.heroique_ouvert', { donjon: ref(`carte.${this.carte}.nom`) }), '#ffd36b') }
        }
        this.ossara.onKill(by?.test ? null : by, es, near.filter((q) => !q.test))
      },
      // l'arène du nid : une instance de quatre au plus, tout le monde reçoit tout
      arene: (type, msg) => this.broadcast(type, msg),
    })
    this.vie = new Vie(world)
    world.life = this.vie
    this.ossara = new Ossara(world, this.vie, {
      send: (p, type, msg) => this.clients.find((c) => c.sessionId === p.sid)?.send(type, msg),
      log: (t, c) => this.logHook(t, c),
    })
    this.ossara.onFlag = (p, k) => { if (k === 'selle') this.dire(p, msg('srv.robot.selle'), '#7fd6ff') }
    this.setupWorld(world)

    this.onMessage('interact', (c) => this.interact(c))
    // le social : discussion, groupes, guildes, échanges, duels
    const compte = (c: Client) => this.world.players.get(c.sessionId)?.account ?? ''
    this.onMessage('chat', (c, m: { c: Canal; t: string; a?: string }) => { const a = compte(c); if (a) social().chat(a, m?.c, m?.t, typeof m?.a === 'string' ? m.a : undefined) })
    this.onMessage('social', (c, m: any) => { const a = compte(c); if (a) social().action(a, m) })
    this.onMessage('upgrade', (c) => this.upgrade(c))
    this.onMessage('releve', (c, m: { cls: ClassId }) => this.releve(c, m?.cls))
    // Ossara : parler, commercer, s'équiper, ramasser, réparer
    // un soldat de test ne commerce pas, ne s'équipe pas, ne fait pas avancer ses quêtes
    const P = (c: Client) => { const p = this.world.players.get(c.sessionId); return p && !p.bot && !p.test ? p : null }
    const str = (v: unknown) => typeof v === 'string' ? v.slice(0, 64) : ''
    this.onMessage('parler', (c, m: { id: string }) => { const p = P(c); if (!p) return; const d = this.ossara.talk(p, str(m?.id)); if (d) c.send('dialogue', d) })
    this.onMessage('choix', (c, m: { id: string; o: string }) => { const p = P(c); if (!p) return; const d = this.ossara.choose(p, str(m?.id), str(m?.o)); c.send('dialogue', d ?? { fin: true }) })
    this.onMessage('acheter', (c, m: { i: number }) => { const p = P(c); if (p && Number.isInteger(m?.i)) this.ossara.buy(p, m.i) })
    this.onMessage('vendre', (c, m: { u: string }) => { const p = P(c); if (p) this.ossara.sell(p, str(m?.u)) })
    this.onMessage('equiper', (c, m: { u: string; slot?: Slot }) => { const p = P(c); if (p) this.ossara.equip(p, str(m?.u), SLOTS.includes(m?.slot as Slot) ? m.slot : undefined) })
    this.onMessage('retirer', (c, m: { slot: Slot }) => { const p = P(c); if (p && SLOTS.includes(m?.slot)) this.ossara.unequip(p, m.slot) })
    this.onMessage('utiliser', (c, m: { u: string }) => { const p = P(c); if (p) this.ossara.use(p, str(m?.u)) })
    this.onMessage('jeter', (c, m: { u: string }) => { const p = P(c); if (p) this.ossara.drop(p, str(m?.u)) })
    this.onMessage('recycler', (c, m: { u: string }) => { const p = P(c); if (p) this.ossara.recycle(p, str(m?.u)) })
    this.onMessage('ramasser', (c, m: { id: string }) => { const p = P(c); if (p) this.ossara.pick(p, str(m?.id)) })
    this.onMessage('reparer', (c, m: { id: string }) => { const p = P(c); if (p) this.ossara.repair(p, str(m?.id)) })
    // lire : une stèle, une plaque, un journal posé (ou la porte scellée) ; relire : un texte déjà gardé au journal
    this.onMessage('lire', (c, m: { id: string }) => { const p = P(c); if (p) this.ossara.lire(p, str(m?.id)) })
    this.onMessage('relire', (c, m: { id: string }) => { const p = P(c); if (p) this.ossara.relire(p, str(m?.id)) })
    // la monture : monter sur son robot (avec la selle), en descendre
    this.onMessage('monture', (c) => {
      const p = P(c); if (!p) return
      if (p.s.monte) { this.world.mount(p, false); return }
      if (this.ossara.state(p.account).flags.selle !== '1') return c.send('log', { t: msg('srv.robot.sans_selle'), color: '#ff9b6b' })
      if (!this.world.mount(p, true)) c.send('log', { t: msg('srv.robot.absent'), color: '#ff9b6b' })
    })
    // le monorail : réparer une station, ou voyager vers une station ouverte
    this.onMessage('station', (c, m: { id: string; vers?: string }) => { const p = P(c); if (p) this.station(c, p, str(m?.id), str(m?.vers)) })
    // voyage de test vers les boss : pour les joueurs du réseau local, ou avec le code HEIRLINE_TEST (lien ?test=…)
    this.onMessage('voyage', (c, m: { code?: string; dest: string }) => {
      const p0 = this.world.players.get(c.sessionId), p = p0 && !p0.bot ? p0 : null
      const permis = (c as any).auth?.local || (!!process.env.HEIRLINE_TEST && m?.code === process.env.HEIRLINE_TEST)
      if (!p || !permis) return
      this.voyageTest(c, p, str(m?.dest))
    })
    // pilote automatique de test (vidéos, captures) : le soldat joue seul, avec le cerveau des soldats IA
    this.onMessage('autopilote', (c, m: { code?: string; on?: boolean }) => {
      const p = this.world.players.get(c.sessionId)
      const permis = (c as any).auth?.local || (!!process.env.HEIRLINE_TEST && m?.code === process.env.HEIRLINE_TEST)
      if (!p || p.bot || !permis) return
      p.auto = m?.on === false ? null : new BotBrain()
      p.s.bot = !!p.auto
    })

    const nBots = Number(process.env.BOTS ?? 0)
    for (let i = 0; i < nBots; i++) this.spawnLoadBot(i)
  }

  onAuth(_client: Client, options: any, context?: { ip?: string; headers?: any }) {
    // joueur du réseau local (Wi-Fi de la maison, pas le tunnel) : il a droit aux outils de test
    const ip = String(context?.ip ?? '').replace(/^::ffff:/, '')
    const viaTunnel = !!(context?.headers?.get?.('cf-connecting-ip') ?? context?.headers?.['cf-connecting-ip'])
    const local = !viaTunnel && /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)
    // par le tunnel : 40 connexions par minute et par adresse au plus (une reconnexion, un passage de carte en font une)
    if (viaTunnel) {
      const cf = context?.headers?.get?.('cf-connecting-ip') ?? context?.headers?.['cf-connecting-ip']
      if (tropDeConnexions(String(cf))) throw new Error('trop de connexions, réessaie dans une minute')
    }
    const { account, soldier } = GameRoom.authenticate(options)
    // une instance : le groupe vient de l'état du serveur, jamais de ce que dit le client ; celui qui annonce le
    // groupe d'un autre (ou un groupe qui n'est pas le sien) est refusé
    if (CARTES[this.carte].instance && !social().peutEntrer(account.id, this.groupeInstance)) throw new Error('groupe')
    if (soldier) return { account, soldier, local }
    // pas de soldat vivant : premier soldat, ou héritier de la lignée
    const cls = validClass(options?.cls) ? options.cls : null
    if (!cls) throw new Error('choisir une classe')
    const lignee = db().lineage(account.id)
    const last = lignee[lignee.length - 1]
    const s = db().createSoldier(account.id, cls, last ? heirLevel(last.level) : 1, last ? last.generation + 1 : 1, options?.given ? String(options.given).slice(0, 16) : randomGiven(), heritageDe(last, cls))
    return { account, soldier: s, local }
  }

  onJoin(client: Client, _options: any, auth: any) {
    // arrivé par un passage : à la sortie de ce passage ; sinon là où le soldat s'était arrêté (sa fiche, revérifiée)
    const a = arrivees.get(auth.account.id)
    const ici = a && a.carte === this.carte && a.until > Date.now() ? a : null
    if (a) arrivees.delete(auth.account.id)
    const r = ici ? null : reprise(auth.soldier?.pos_json)
    // le client a rejoint une autre carte que celle de la fiche : il y est renvoyé (c'est le serveur qui décide)
    const ailleurs = r && r.carte !== this.carte ? r : null
    const lieu = ici ?? (r && !ailleurs ? r : null)
    this.ossara.forget(auth.account.id)
    const p = this.addClientPlayer(client, auth.account, auth.soldier, lieu?.x, lieu?.y)
    if (ailleurs) this.clock.setTimeout(() => this.passer(p, null, ailleurs), 0)
    if (ici?.test) this.debutTest(p, ici.test)
    this.passT.set(p.sid, this.world.time + 2)
    if (!ici && !ailleurs) this.logHook(msg('srv.annonce.rejoint', { qui: `${p.given} ${p.family}` }), '#8fb3c9')
    this.ossara.pushQuests(p)
    this.ossara.pushInv(p)
    social().entrer(this.salle, p)
    if (this.world.arene) client.send('arene-etat', this.world.arene.pourNouveau())
    // les rames en route sur cette copie
    for (const q of this.world.players.values()) if (q.rail) client.send('rame', { sid: q.sid, ids: q.rail.tr.ids, e: this.world.time - q.rail.t0 })
  }

  onDrop(client: Client) {
    // Une coupure ne tue jamais pour de bon : le soldat est intouchable le temps de revenir.
    const p = this.world.players.get(client.sessionId)
    if (p) { (p as any).dropped = true; p.invulT = 1e9; if (p.s.etat === 1) p.downRule = 'evacuation' }
    this.allowReconnection(client, 20)
  }
  onReconnect(client: Client) {
    const p = this.world.players.get(client.sessionId)
    if (p) { (p as any).dropped = false; p.invulT = 2 }
  }

  onLeave(client: Client) {
    const p = this.world.players.get(client.sessionId)
    // le sac (ferraille portée, objets) est enregistré : une coupure ne le fait jamais perdre
    if (p) { social().sortir(p.account, p.sid); this.saveSoldier(p); this.world.removePlayer(client.sessionId); this.ossara.offers.delete(client.sessionId) }
    this.data.delete(client.sessionId)
  }

  onDispose() { central().listeners.delete(this.ecoute) }

  afterStep() {
    this.saveT++
    if (this.saveT % 20 === 0) for (const p of this.world.players.values()) if (!p.bot && !p.test && p.s.etat === 0) this.ossara.checkExplore(p)
    if (this.saveT % 20 === 0) this.suiviTests()
    if (this.saveT % 20 === 0) { social().step(this.salle); if (this.carte === 'ossara') social().balayer() }
    if (this.saveT % 4 === 0) this.checkPassages()
    if (this.saveT % (20 * 10) === 0) for (const p of this.world.players.values()) if (!p.bot) this.saveSoldier(p)
    if (this.saveT % 40 === 0 && CARTES[this.carte].instance) this.manageNestBots()
    if (this.saveT % 20 === 0 && this.carte === 'ossara') this.ossara.robotsQuiDansent()
  }

  extraMe(p: PSim) {
    const f = this.ossara.state(p.account).flags
    return { gares: STATIONS.filter((x) => x.ouverte || f['st_' + x.id] === '1').map((x) => x.id), selle: f.selle === '1' }
  }

  // ---------------------------------------------------------------- le graphe du monde
  /** Un soldat sur un sas : il passe sur l'autre carte (le client quitte ce salon et rejoint l'autre). */
  checkPassages() {
    for (const p of this.world.players.values()) {
      if (p.bot || p.s.etat !== 0 || (this.passT.get(p.sid) ?? 0) > this.world.time) continue
      for (const pa of this.world.map.passages) {
        if (Math.hypot((pa.x * TILE + 8) - p.s.x, (pa.y * TILE + 8) - p.s.y) > 11) continue
        // le sas de la Constance reste scellé tant que personne ne l'a ouvert pour cette lignée (acte 2)
        if (PASSAGE_BY_ID[pa.arrivee]?.carte === 'constance' && this.ossara.state(p.account).flags.cle_constance !== '1') {
          this.passT.set(p.sid, this.world.time + 4)
          this.dire(p, msg('srv.monde.sas_scelle'), '#ff9b6b')
          break
        }
        // un groupe plus grand que l'instance : averti avant d'entrer (il repasse dans les 20 s pour entrer quand même)
        const dest = CARTES[PASSAGE_BY_ID[pa.arrivee]?.carte]
        if (dest?.instance) {
          const n = social().depasse(p.account, dest.seuil)
          if (n && this.world.time - (this.avertis.get(p.account) ?? -99) > 20) {
            this.avertis.set(p.account, this.world.time)
            this.passT.set(p.sid, this.world.time + 4)
            this.dire(p, msg('srv.social.donjon_limite', { n: dest.seuil, g: n }), '#ff9b6b')
            break
          }
        }
        // le raid : à partir de son niveau minimum
        const rd = CARTES[PASSAGE_BY_ID[pa.arrivee]?.carte]?.raid
        if (rd && p.level < rd.niveauMin) {
          this.passT.set(p.sid, this.world.time + 4)
          this.dire(p, msg('srv.raid.niveau_min', { n: rd.niveauMin }), '#ff9b6b')
          break
        }
        // l'héroïque d'un donjon : seulement après une victoire en normal (pour la lignée)
        const ar = CARTES[PASSAGE_BY_ID[pa.arrivee]?.carte]?.arene
        if (ar?.heroique && ar.normale && db().flags(p.account)['donjon_' + ar.normale] !== '1') {
          this.passT.set(p.sid, this.world.time + 4)
          this.dire(p, msg('srv.donjon.heroique_ferme', { donjon: ref(`carte.${ar.normale}.nom`) }), '#ff9b6b')
          break
        }
        this.passer(p, PASSAGE_BY_ID[pa.arrivee])
        break
      }
    }
  }

  /** Envoie un soldat sur une autre carte, à un endroit précis (un passage, une gare, une destination de test). */
  passer(p: PSim, vers: Passage | null, ou?: { carte: CarteId; x: number; y: number; test?: string }) {
    const c = this.clients.find((cl) => cl.sessionId === p.sid)
    if (!c) return
    const dest = ou ?? (vers ? { carte: vers.carte, ...arriveeDe(vers) } : null)
    if (!dest) return
    this.passT.set(p.sid, this.world.time + 5)
    this.world.mount(p, false)
    this.saveSoldier(p)
    // la fiche garde la destination ; pas pour un départ en test (la vraie fiche reste où elle était)
    if (!dest.test && !p.test && p.soldierId) db().savePos(p.soldierId, dest)
    arrivees.set(p.account, { ...dest, until: Date.now() + 60_000 })
    c.send('passage', { carte: dest.carte, salon: CARTES[dest.carte].salon, nom: msg(`carte.${dest.carte}.nom`) })
  }

  /** un message pour un seul joueur */
  dire(p: PSim, t: Texte, color: string) { this.clients.find((cl) => cl.sessionId === p.sid)?.send('log', { t, color }) }

  /** Les gares du monorail de la Première Vague : réparées une fois par lignée, puis voyage immédiat. */
  station(c: Client, p: PSim, id: string, vers: string) {
    const st = STATION_BY_ID[id]
    if (!st || this.carte !== 'ossara' || p.s.etat !== 0) return
    if (Math.hypot(st.x * TILE + 8 - p.s.x, st.y * TILE + 8 - p.s.y) > STATION_R + 10) return c.send('log', { t: msg('srv.gare.approche'), color: '#ff9b6b' })
    const gare = (id: string) => ref(`station.${id}.nom`)
    const s = this.ossara.state(p.account)
    const ouverte = (x: typeof st) => x.ouverte || s.flags['st_' + x.id] === '1'
    if (!ouverte(st)) {
      const acc = db().account(p.account)!
      const pieces = countInv(p.inv, 'piece')
      if (pieces < STATION_COUT.pieces || acc.scrap < STATION_COUT.ferraille) return c.send('log', { t: msg('srv.gare.reparer', { gare: gare(st.id), pieces: STATION_COUT.pieces, ferraille: STATION_COUT.ferraille, aPieces: pieces, aFerraille: acc.scrap }), color: '#ff9b6b' })
      takeFromInv(p.inv, 'piece', STATION_COUT.pieces); db().addScrap(p.account, -STATION_COUT.ferraille)
      s.flags['st_' + st.id] = '1'; db().setFlag(p.account, 'st_' + st.id, '1')
      this.ossara.pushInv(p); this.ossara.pushQuests(p)
      this.world.hooks.fx(p.s.x, p.s.y, { k: 'repare', x: st.x * TILE + 8, y: st.y * TILE + 8 })
      return c.send('log', { t: msg('srv.gare.reparee', { gare: gare(st.id) }), color: '#7fd6ff' })
    }
    const to = STATION_BY_ID[vers]
    if (!to || to.id === st.id) return
    if (!ouverte(to)) return c.send('log', { t: msg('srv.gare.hors_service', { gare: gare(to.id) }), color: '#ff9b6b' })
    if (p.rail) return
    // un vrai trajet : la rame arrive, on monte, elle suit le rail par les gares ouvertes ; tous les clients de la copie
    // reçoivent le départ (les gares du chemin), chacun calcule la marche de la rame
    const tr = trajet(st.id, to.id, (id) => ouverte(STATION_BY_ID[id]))
    if (!tr) return c.send('log', { t: msg('srv.gare.pas_de_ligne', { gare: gare(to.id) }), color: '#ff9b6b' })
    this.world.partirRail(p, tr)
    this.broadcast('rame', { sid: p.sid, ids: tr.ids, e: 0 })
    c.send('log', { t: tr.ids.length > 2 ? msg('srv.gare.depart_par', { de: gare(st.id), vers: gare(to.id), par: tr.ids.slice(1, -1).map(gare) }) : msg('srv.gare.depart', { de: gare(st.id), vers: gare(to.id) }), color: '#7fd6ff' })
  }

  // ---------------------------------------------------------------- le soldat de test (bouton « aller voir un boss »)
  /** Le soldat devient un soldat de test au niveau du boss : stats, équipement, robot. Rien n'est enregistré. */
  debutTest(p: PSim, boss: string) {
    const b = testDef(boss, REGIONS)
    if (!b || p.bot) return
    p.test = { boss, niveau: b.niveau }
    p.level = b.niveau; p.xp = 0; p.sac = 0; p.inv = []; p.equip = equipementTest(p.cls, b.niveau)
    p.talents = talentsAuto(p.cls, b.niveau)
    p.s.level = b.niveau
    this.world.applyTalents(p)
    p.s.hp = p.s.maxHp
    const lvl = Math.min(ROBOT.niveauMax, b.robot)
    if (p.robot && p.robot.kind === 'robot') { const r = p.robot.r; p.robot.level = lvl; r.level = lvl; r.maxHp = pvRobot(lvl, p); r.hp = r.maxHp; r.mode = 0 }
    else this.world.giveRobot(p, lvl)
    // le seul souvenir gardé : ce boss a été vu
    if (BOSS_TEST[boss]) db().setFlag(p.account, 'boss_vu_' + boss, '1')
    const c = this.clients.find((cl) => cl.sessionId === p.sid)
    const quoi = BOSS_TEST[boss] ? ref(`bosstest.${boss}.nom`) : boss.startsWith('entree:') ? ref(`carte.${boss.slice(7)}.nom`) : ref(`region.${boss.slice(7)}.nom`)
    c?.send('log', { t: msg('srv.test.debut', { boss: quoi, niveau: b.niveau, robot: lvl }), color: '#7fd6ff' })
    this.ossara.pushInv(p)
  }

  /** Fin du test : la vraie fiche revient (niveau, XP, sac, équipement, robot), relue telle qu'elle est en base. */
  finTest(p: PSim, raison: 'mort' | 'victoire' | 'depart') {
    if (!p.test) return
    p.test = null
    // dans une instance (nid, donjon, raid), le soldat attend son départ avec sa vraie fiche : il n'y gagne plus rien
    if (CARTES[this.carte]?.instance) p.apresTest = true
    const s = db().livingSoldier(p.account)
    if (s) { p.level = s.level; p.xp = s.xp; p.inv = parseJson(s.inv_json, []); p.equip = parseJson(s.equip_json, {}); p.sac = s.sac ?? 0; p.talents = nettoyer(p.cls, p.level, parseJson(s.talents_json, {})) }
    p.s.level = p.level
    this.world.applyTalents(p)
    p.s.hp = p.s.maxHp
    const rob = db().robot(p.account)
    if (p.robot && p.robot.kind === 'robot') {
      if (rob.state === 'avec') { const r = p.robot.r; p.robot.level = rob.level; r.level = rob.level; r.maxHp = pvRobot(rob.level, p); r.hp = r.maxHp; r.mode = 0 }
      else { this.world.removeRobot(p.robot.id); p.robot = null }
    } else if (rob.state === 'avec') this.world.giveRobot(p, rob.level)
    const c = this.clients.find((cl) => cl.sessionId === p.sid)
    c?.send('log', { t: msg(raison === 'mort' ? 'srv.test.mort' : 'srv.test.fin'), color: '#7fd6ff' })
    this.ossara.pushInv(p)
    if (raison === 'mort') {
      const sp = sectorMap.points.spawn
      if (this.carte === 'ossara') this.teleport(p, sp.x, sp.y)
      else this.passer(p, null, { carte: 'ossara', x: sp.x, y: sp.y })
    }
  }

  /** chaque seconde : un boss tombé il y a 8 s, ou un soldat de test parti loin de l'antre, et le test s'arrête */
  suiviTests() {
    for (const p of this.world.players.values()) {
      if (!p.test) continue
      if (p.test.finA && this.world.time >= p.test.finA) { this.finTest(p, 'victoire'); continue }
      const b = sectorMap.monde?.boss
      if (p.test.boss === 'engloutisseur' && this.carte === 'ossara' && b && Math.hypot(p.s.x - b.x, p.s.y - b.y) > 1100) this.finTest(p, 'depart')
    }
  }

  teleport(p: PSim, x: number, y: number) {
    this.world.mount(p, false)
    p.s.x = x; p.s.y = y
    if (p.robot) { p.robot.r.x = x - 14; p.robot.r.y = y + 6 }
    this.passT.set(p.sid, this.world.time + 2)
  }

  /** « Test : aller voir un boss » : l'Engloutisseur (continent), la Couveuse (une instance du nid), l'épave ; et pour
   *  l'histoire, Cantor, le Tertre, la passerelle de la Constance. */
  voyageTest(c: Client, p: PSim, dest: string) {
    // une autre destination que les boss : le vrai soldat reprend sa place
    const visite = !!testDef(dest, REGIONS)
    if (p.test && !visite) this.finTest(p, 'depart')
    if (visite && !BOSS_TEST[dest]) {
      // l'entrée d'un donjon (son départ, avant les lacets), ou le cœur d'une région du continent
      let carte: CarteId, x: number, y: number
      if (dest.startsWith('entree:')) { carte = ENTREES_TEST[dest.slice(7)].carte; const sp = carteMap(carte).points.spawn; x = sp.x; y = sp.y }
      else { carte = 'ossara'; [x, y] = libreProche(REGIONS.find((r) => r.id === dest.slice(7))!.centre) }
      if (p.test) this.finTest(p, 'depart')
      if (this.carte === carte) { this.teleport(p, x, y); this.debutTest(p, dest) }
      else this.passer(p, null, { carte, x, y, test: dest })
    } else if (BOSS_TEST[dest]) {
      // directement dans l'arène du boss, en bas : la porte se referme et le boss s'éveille
      const carte = BOSS_TEST[dest].carte, x = (ARENE.x0 + ARENE.x1) / 2, y = ARENE.y1 - 36
      if (this.carte === carte) { this.teleport(p, x, y); this.debutTest(p, dest) }
      else this.passer(p, null, { carte, x, y, test: dest })
    } else if (dest === 'constance') {
      if (this.carte !== 'constance') this.passer(p, PASSAGE_BY_ID.constance_sas)
    } else if (dest === 'cantor' || dest === 'tertre' || dest === 'passerelle') {
      // l'histoire : Cantor au camp de l'Épave, la tombe à l'écart du Tertre, le journal de Varga sur la passerelle
      const e = ENDROIT_BY_ID[dest === 'tertre' ? 'tertre_wipe' : 'passerelle_varga']
      let x = e.x * TILE + 8, y = e.y * TILE + 8 + 10
      if (dest === 'cantor') { const n = NPC_BY_ID.septieme.poste; x = n[0] * TILE + 30; y = n[1] * TILE + 8 } // le poste est déjà placé sur le continent
      const carte = dest === 'passerelle' ? 'constance' : 'ossara'
      if (this.carte === carte) this.teleport(p, x, y)
      else this.passer(p, null, { carte, x, y })
    } else if (dest === 'port') {
      const sp = sectorMap.points.spawn
      if (this.carte === 'ossara') this.teleport(p, sp.x, sp.y)
      else this.passer(p, null, { carte: 'ossara', x: sp.x, y: sp.y })
    } else return
    c.send('log', { t: msg('srv.test.voyage'), color: '#c48bff' })
  }

  // ---------------------------------------------------------------- la mort
  onEvacuate(p: PSim) {
    if (p.bot) { if (!p.sid.startsWith('charge-')) this.world.removePlayer(p.sid); return }
    this.saveSoldier(p)
    // l'évacuation ramène à Port-Ancre, quelle que soit la carte
    if (!p.test && p.soldierId) db().savePos(p.soldierId, depart())
  }

  /** La fiche, plus la position : en route en monorail, la gare d'arrivée ; à terre, Port-Ancre (l'évacuation). */
  override saveSoldier(p: PSim) {
    super.saveSoldier(p)
    if (!p.soldierId || p.test || p.bot || p.s.etat === 2) return
    db().savePos(p.soldierId, this.posDe(p))
  }
  posDe(p: PSim): Pos {
    if (p.rail) { const q = quai(p.rail.tr.vers); return { carte: this.carte, x: q.x, y: q.y } }
    if (p.s.etat !== 0) return depart()
    return { carte: this.carte, x: p.s.x, y: p.s.y }
  }


  onPermadeath(p: PSim, killer: string) {
    if (p.sid.startsWith('charge-')) { p.s.etat = 0; p.s.hp = p.s.maxHp; p.s.x = this.world.map.points.spawn.x + 30; p.s.y = this.world.map.points.spawn.y; return }
    if (p.bot) { this.world.removePlayer(p.sid); this.nestBots.delete(p.sid); return }
    const d = this.data.get(p.sid)
    const soldier = db().livingSoldier(p.account)
    if (soldier) { soldier.level = p.level; db().saveSoldier({ id: soldier.id, level: p.level, xp: p.xp }); db().killSoldier({ ...soldier, level: p.level }, { killer, x: p.s.x, y: p.s.y, family: p.family, carte: this.carte }) }
    // le robot se plante là où son soldat est tombé
    const rob = db().robot(p.account)
    const x = p.robot?.r.x ?? p.s.x, y = p.robot?.r.y ?? p.s.y
    if (p.robot) this.world.removeRobot(p.robot.id)
    let robotMsg = false
    if (rob.state === 'avec') {
      const until = Date.now() + ROBOT.outpostMs
      const hp = robotHp(rob.level) * 2
      db().setRobot(p.account, { state: 'avant-poste', ox: x, oy: y, ohp: hp, ountil: until, carte: this.carte })
      // l'avant-poste est dans le service central : toutes les copies de la carte le voient, avec les mêmes PV
      central().addOutpost({ id: 'a' + p.account, account: p.account, family: p.family, given: p.given, level: rob.level, carte: this.carte, x, y, hp, maxHp: hp, until })
      this.world.syncCentral()
      robotMsg = true
    }
    const nid = this.world.zoneOf(p.s.x, p.s.y) === 'nid'
    const mort = msg(nid ? 'srv.annonce.mort_nid' : 'srv.annonce.mort', { qui: `${p.given} ${p.family}`, niveau: p.level, g: p.generation, tueur: lireCause(killer) })
    this.logHook(robotMsg ? [mort, msg('srv.annonce.robot_tient')] : mort, '#ff6b6b')
    const client = this.clients.find((c) => c.sessionId === p.sid)
    client?.send('releve', { given: p.given, family: p.family, level: p.level, generation: p.generation, killer: lireCause(killer), heritierNiveau: heirLevel(p.level), robot: rob.state === 'avec' ? { x, y } : null })
    if (d) d.soldier = { ...d.soldier, alive: 0 }
  }

  releve(c: Client, cls: ClassId) {
    const d = this.data.get(c.sessionId)
    if (!d || !validClass(cls)) return
    if (db().livingSoldier(d.account.id)) return
    const old = this.world.players.get(c.sessionId)
    const lignee = db().lineage(d.account.id)
    const last = lignee[lignee.length - 1]
    const s = db().createSoldier(d.account.id, cls, heirLevel(last?.level ?? 1), (last?.generation ?? 0) + 1, undefined, heritageDe(last, cls))
    if (old) this.world.removePlayer(c.sessionId)
    this.data.delete(c.sessionId)
    const p = this.addClientPlayer(c, d.account, s)
    this.ossara.pushInv(p); this.ossara.pushQuests(p)
    this.logHook(msg('srv.annonce.releve', { qui: `${p.given} ${p.family}`, g: s.generation }), '#ffd36b')
  }

  // ---------------------------------------------------------------- Port-Ancre
  interact(c: Client) {
    const p = this.world.players.get(c.sessionId)
    const d = this.data.get(c.sessionId)
    if (!p || !d || p.s.etat !== 0 || p.test) return
    const rob = db().robot(p.account)
    // récupérer son robot planté
    const op = this.world.robots.get('a' + p.account)
    if (op && Math.hypot(op.r.x - p.s.x, op.r.y - p.s.y) < 30 && rob.state === 'avant-poste') {
      central().removeOutpost(op.id)
      this.world.removeRobot(op.id)
      db().setRobot(p.account, { state: 'avec', ohp: 0, ountil: 0 })
      this.world.giveRobot(p, rob.level, op.r.x, op.r.y)
      this.logHook(msg('srv.annonce.robot_recupere', { qui: `${p.given} ${p.family}` }), '#7fd6ff')
      return
    }
    // reprendre son robot réparé à l'atelier
    const at = this.world.map.points.atelier
    if (this.carte === 'ossara' && rob.state === 'atelier' && Math.hypot(at.x - p.s.x, at.y - p.s.y) < 60) {
      db().setRobot(p.account, { state: 'avec' })
      this.world.giveRobot(p, rob.level, at.x, at.y)
      c.send('log', { t: msg('srv.robot.sort'), color: '#7fd6ff' })
    }
  }

  upgrade(c: Client) {
    const p = this.world.players.get(c.sessionId)
    if (!p || p.test) return
    const at = this.world.map.points.atelier
    if (this.carte !== 'ossara' || Math.hypot(at.x - p.s.x, at.y - p.s.y) > 60) return c.send('log', { t: msg('srv.robot.atelier'), color: '#ff9b6b' })
    const rob = db().robot(p.account)
    const acc = db().account(p.account)!
    const cost = robotUpgradeCost(rob.level)
    if (rob.state === 'avant-poste') return c.send('log', { t: msg('srv.robot.avant_poste'), color: '#ff9b6b' })
    if (rob.level >= ROBOT.niveauMax) return c.send('log', { t: msg('srv.robot.max'), color: '#ff9b6b' })
    if (acc.scrap < cost) return c.send('log', { t: msg('srv.ferraille.manque', { n: cost, a: acc.scrap }), color: '#ff9b6b' })
    const parts = robotPartsCost(rob.level)
    if (countInv(p.inv, 'piece') < parts) return c.send('log', { t: msg('srv.robot.pieces', { n: parts, a: countInv(p.inv, 'piece') }), color: '#ff9b6b' })
    takeFromInv(p.inv, 'piece', parts)
    this.ossara.pushInv(p)
    db().addScrap(p.account, -cost)
    db().setRobot(p.account, { level: rob.level + 1 })
    if (p.robot) { p.robot.level = rob.level + 1; p.robot.r.level = rob.level + 1; p.robot.r.maxHp = pvRobot(rob.level + 1, p); p.robot.r.hp = p.robot.r.maxHp }
    c.send('log', { t: msg('srv.robot.ameliore', { n: rob.level + 1 }), color: '#7fd6ff' })
    this.sendMe(c)
  }

  // ---------------------------------------------------------------- soldats IA
  manageNestBots() {
    const humains = [...this.world.players.values()].filter((p) => !p.bot && p.s.etat === 0 && this.world.zoneOf(p.s.x, p.s.y) === 'nid')
    for (const sid of [...this.nestBots]) if (!this.world.players.has(sid)) this.nestBots.delete(sid)
    if (!humains.length) {
      this.noHumanInNestT += 2
      if (this.noHumanInNestT > 10) for (const sid of this.nestBots) { this.world.removePlayer(sid); this.nestBots.delete(sid) }
      return
    }
    this.noHumanInNestT = 0
    const raid = CARTES[this.carte].raid
    const want = Math.max(0, (raid?.joueurs ?? 4) - humains.length)
    let i = 0
    const avant = this.nestBots.size
    while (this.nestBots.size < want) {
      const leader = humains[i++ % humains.length]
      const b = new BotBrain(); b.leader = leader
      const sid = 'ia-' + Math.random().toString(36).slice(2, 8)
      // en raid, les IA comblent les rôles : deux tanks (fantassins), deux soigneurs (médics), le reste tire
      const cls = raid ? classeManquante([...humains, ...[...this.nestBots].map((s) => this.world.players.get(s)!).filter(Boolean)]) : CLASS_IDS[(this.nestBots.size + 1) % 3]
      const door = this.world.map.points.nid
      const used = new Set([...this.world.players.values()].map((q) => q.given))
      const p = this.world.addPlayer({ sid, account: '', soldierId: 0, given: unusedGiven(used), family: 'Colonie', generation: 1, cls, level: Math.max(1, leader.level), xp: 0, bot: b, x: door.x - 20, y: door.y + (this.nestBots.size - 1) * 14 })
      this.world.giveRobot(p, Math.max(1, Math.min(ROBOT.niveauMax, Math.round(leader.level / 2))))
      this.nestBots.add(sid)
      b.role = roleDe(cls)
      // l'assaut du Métier : l'ingénieur veille les robots que la Glaneuse veut glaner
      b.veille = cls === 'ingenieur' && CARTES[this.carte].arene?.profil === 'glaneuse'
      if (!raid) this.logHook(msg('srv.annonce.ia_nid', { qui: p.given }), '#8fb3c9')
    }
    if (raid && this.nestBots.size > avant) {
      const tous = [...this.world.players.values()].filter((q) => q.s.etat === 0 && (q.bot ? this.nestBots.has(q.sid) : humains.includes(q)))
      const n = (r: string) => tous.filter((q) => roleDe(q.cls) === r).length
      this.logHook(msg('srv.raid.roles', { tank: n('tank'), soin: n('soin'), dps: n('dps') }), '#d8e06a')
    }
  }

  spawnLoadBot(i: number) {
    const b = new BotBrain(); b.roaming = true
    const m = this.world.map
    const x = (4 + Math.random() * (m.w - 8)) * TILE, y = (4 + Math.random() * (m.h - 8)) * TILE
    const p = this.world.addPlayer({ sid: 'charge-' + i, account: '', soldierId: 0, given: 'Charge' + i, family: 'Banc', generation: 1, cls: CLASS_IDS[i % 3], level: 5, xp: 0, bot: b, x, y })
    if (isSolidTile(this.world.map.tiles[Math.floor(y / TILE) * this.world.map.w + Math.floor(x / TILE)])) { p.s.x = this.world.map.points.spawn.x + 40; p.s.y = this.world.map.points.spawn.y }
    this.world.giveRobot(p, 3)
  }
}

/** ce que l'héritier reçoit de l'ancêtre (points de talent, spécialité plus tôt : shared/talents.ts) */
function heritageDe(last: { cls: ClassId; level: number; talents_json?: string } | undefined, cls: ClassId) {
  return heritage(last ? { cls: last.cls, level: last.level, talents: nettoyer(last.cls, last.level, parseJson(last.talents_json, {})) } : null, cls)
}

/** le rôle d'un soldat en raid, d'après sa classe */
export function roleDe(cls: ClassId): 'tank' | 'soin' | 'dps' { return cls === 'fantassin' ? 'tank' : cls === 'medic' ? 'soin' : 'dps' }
/** la classe d'une IA de raid : un tank, puis un soigneur, jusqu'à deux de chaque ; ensuite des tireurs variés */
export function classeManquante(groupe: { cls: ClassId }[]): ClassId {
  const n = (r: string) => groupe.filter((q) => roleDe(q.cls) === r).length
  if (n('tank') < 2 && n('tank') <= n('soin')) return 'fantassin'
  if (n('soin') < 2) return 'medic'
  if (n('tank') < 2) return 'fantassin'
  const dps: ClassId[] = ['eclaireur', 'demolisseur', 'ingenieur', 'brouilleur']
  return dps[groupe.filter((q) => roleDe(q.cls) === 'dps').length % dps.length]
}

/** une case où l'on tient debout près d'un point du continent (en tuiles), en pixels */
function libreProche([cx, cy]: [number, number]): [number, number] {
  const m = carteMap('ossara')
  for (let r = 0; r < 40; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
    const x = Math.round(cx) + dx, y = Math.round(cy) + dy
    if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue
    if (!isSolidTile(m.tiles[y * m.w + x]) && m.tiles[y * m.w + x] !== T.MER) return [x * TILE + 8, y * TILE + 8]
  }
  return [m.points.spawn.x, m.points.spawn.y]
}
