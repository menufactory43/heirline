// Ce qui fait d'Ossara un monde à vivre : les quêtes et leurs dialogues, le sac et l'équipement, les marchands,
// le butin. Sans réseau : le salon du secteur branche `send`, et les tests appellent les méthodes directement.
import { NPC_BY_ID, BOUTIQUES } from '../shared/npcs.ts'
import { QUESTS, QUEST_BY_ID, questAvailable, questComplete, objectiveTarget, type QuestDef, type Recompense, type FinCampagne, type FinCampagne2 } from '../shared/quests.ts'
import { LECTURE_BY_ID, ENDROIT_BY_ID, COEURS, LIRE_R, PLACE, saisonDe } from '../shared/journaux.ts'
import { RAYONS_DEPART, NB_RUCHES_C1, pushFrontAll } from '../shared/front.ts'
import { regionIdAt, lieuAt } from '../shared/regions/index.ts'
import { CONSTANCE_LIEUX } from '../shared/cartes/constance.ts'
import {
  rollEquip, recyclage, NIVEAU_MARGE, material, addToInv, countInv, takeFromInv, sellValue, buyPrice, isEquip, slotsFor, itemKey, BASES, RARETES,
  type Item, type Slot,
} from '../shared/items.ts'
import { ENEMIES, E } from '../shared/rules.ts'
import { butinEquip } from '../shared/butin.ts'
import { TILE } from '../shared/consts.ts'
import type { World, PSim, ESim } from './world/World.ts'
import type { Vie } from './world/Vie.ts'
import { db } from './db.ts'
import { msg, ref, tr, lireCause, type Texte, type Msg, type Lang } from '../shared/i18n/index.ts'

export interface Dialogue { npc: string; nom: Texte; titre?: Texte; texte: Texte; options: { id: string; label: Texte }[] }
/** Ce qu'on envoie au client pour l'écran de lecture. `auto` : ouvert sans qu'on l'ait demandé (en arrivant). */
export interface LectureMsg { id: string; titre: Texte; source?: Texte; texte: Texte; auto?: boolean }
interface AccState { done: Set<string>; active: Map<string, number[]>; flags: Record<string, string> }
export interface OssaraIO { send(p: PSim, type: string, msg: any): void; log(m: Texte, color?: string): void }
/** les textes des habitants : leur nom et leur titre, en clés */
const nomPnj = (id: string): Msg => msg(`pnj.${id}.nom`)
const titrePnj = (id: string): Msg | undefined => (NPC_BY_ID[id]?.titre ? msg(`pnj.${id}.titre`) : undefined)
const nomQ = (id: string) => ref(`quete.${id}.nom`)

const TALK_R = 46

export class Ossara {
  w: World
  vie: Vie
  io: OssaraIO
  acc = new Map<string, AccState>()
  offers = new Map<string, { npc: string; items: Item[] }>()

  constructor(w: World, vie: Vie, io: OssaraIO) {
    this.w = w; this.vie = vie; this.io = io
    vie.hooks.escortDone = (p, npc, quest) => this.progress(p, (o) => o.t === 'escorte' && o.npc === npc, 1, quest)
    vie.hooks.escortFail = (p, npc) => this.log(p, msg('srv.escorte.retour', { pnj: ref(`pnj.${npc}.nom`) }), '#ff9b6b')
  }

  /** un message pour un seul joueur, dans le journal de son écran */
  log(p: PSim, t: Texte, color: string) {
    this.io.send(p, 'log', { t, color })
  }

  state(account: string): AccState {
    let s = this.acc.get(account)
    if (!s) {
      s = { done: new Set(), active: new Map(), flags: db().flags(account) }
      for (const r of db().quests(account)) {
        if (!QUEST_BY_ID[r.id]) continue
        if (r.etat === 'fini') s.done.add(r.id)
        else s.active.set(r.id, (JSON.parse(r.prog_json || '[]') as number[]).slice(0, QUEST_BY_ID[r.id].objectifs.length))
      }
      this.acc.set(account, s)
    }
    return s
  }

  // ---------------------------------------------------------------- envois
  pushQuests(p: PSim) {
    if (!p.account) return
    const s = this.state(p.account)
    this.recountItems(p)
    this.io.send(p, 'quetes', {
      actives: [...s.active].map(([id, prog]) => ({ id, prog })),
      faites: [...s.done], flags: s.flags,
      choix: { colonie: Number(db().get('choix_colonie') ?? 0), fertiles: Number(db().get('choix_fertiles') ?? 0) },
    })
  }
  pushInv(p: PSim) { this.io.send(p, 'inv', { inv: p.inv, equip: p.equip, st: p.st }) }

  // ---------------------------------------------------------------- progression
  /** Fait avancer les objectifs qui répondent à `match` (de `n`), pour une quête précise ou toutes. */
  progress(p: PSim, match: (o: QuestDef['objectifs'][number]) => boolean, n = 1, only?: string) {
    if (!p.account) return
    const s = this.state(p.account)
    let changed = false
    for (const [id, prog] of s.active) {
      if (only && id !== only) continue
      const q = QUEST_BY_ID[id]
      q.objectifs.forEach((o, i) => {
        if (!match(o)) return
        const max = objectiveTarget(o)
        if ((prog[i] ?? 0) >= max) return
        prog[i] = Math.min(max, (prog[i] ?? 0) + n)
        changed = true
        if (o.t === 'explorer' && o.lecture) this.unlock(p, o.lecture, true)
        this.log(p, msg('srv.quete.progres', { quete: nomQ(q.id), obj: ref(`quete.${q.id}.obj.${i}`), n: prog[i], max }), '#ffd36b')
      })
      if (changed) {
        db().setQuest(p.account, id, 'en_cours', prog)
        if (questComplete(q, prog)) this.log(p, msg('srv.quete.a_rendre', { quete: nomQ(q.id), pnj: ref(`pnj.${q.rendre}.nom`) }), '#7dff9a')
      }
    }
    if (changed) this.pushQuests(p)
  }

  /** Les objectifs « ramasser » suivent ce que contient le sac. */
  recountItems(p: PSim) {
    if (!p.account) return
    const s = this.state(p.account)
    for (const [id, prog] of s.active) {
      const q = QUEST_BY_ID[id]
      q.objectifs.forEach((o, i) => { if (o.t === 'ramasser') prog[i] = Math.min(o.n, countInv(p.inv, o.b)) })
    }
  }

  tourButin = 0
  onKill(by: PSim | null, es: ESim, near: PSim[]) {
    const def = ENEMIES[es.kind]
    const credit = new Set<PSim>(near)
    if (by && !by.bot) credit.add(by)
    for (const p of credit) this.progress(p, (o) => o.t === 'tuer' && (!o.kinds || o.kinds.includes(es.kind)) && (!o.famille || o.famille === def.famille))
    // le butin va au tueur, ou au soldat le plus proche ; dans un groupe, chacun son tour (sur un boss, chacun le sien)
    const grp = by?.groupe ? near.filter((q) => q.groupe === by.groupe && q.account && !q.test) : []
    if (grp.length > 1 && def.boss) { for (const q of grp) this.loot(q, es); return }
    const looter = grp.length > 1 ? grp[this.tourButin++ % grp.length] : by && !by.bot ? by : near[0]
    if (def.boss && looter?.account && (es.kind === E.ENGLOUTISSEUR || es.kind === E.COUVEUSE)) {
      const k = 'exploit_' + (es.kind === E.ENGLOUTISSEUR ? 'engloutisseur' : 'couveuse')
      if (!db().get(k) && !estBanc(looter.family)) db().set(k, `${looter.given} ${looter.family}`)
    }
    if (looter && looter.account) this.loot(looter, es)
  }

  loot(p: PSim, es: ESim) {
    const def = ENEMIES[es.kind]
    const got: Item[] = []
    const roll = (b: string, chance: number, n = 1) => { if (Math.random() < chance) got.push(material(b, n)) }
    if (es.kind === E.BROUTARD || es.kind === E.CORNEFEUILLE) roll('viande', 0.75)
    if (es.kind === E.FOUGERODE) roll('peau', 0.55)
    if (es.kind === E.ROUILLARD) roll('piece', 0.6, 1 + Math.floor(Math.random() * 2))
    if (es.kind === E.SANGSUE) roll('champignon', 0.15)
    // les Hauts de Glane
    if (es.kind === E.FILEUSE) roll('fil', 0.5)
    if (es.kind === E.BOUTURE && !es.repousse) roll('bouture', 0.45)
    if (es.kind === E.RETOURNE || es.kind === E.BALISE) { roll('piece', 0.6, 1 + Math.floor(Math.random() * 2)); if (this.needs(p, 'puce')) roll('puce', 0.5); else roll('puce', 0.08) }
    if (es.kind === E.POT || es.kind === E.PORTENOM) return
    if (def.famille === 'eden' && this.needs(p, 'spore')) roll('spore', 0.45)
    // l'équipement : la table de l'endroit (région, épave, nid) ou du boss (shared/butin.ts)
    got.push(...butinEquip({ kind: es.kind, level: es.level, elite: es.elite, endroit: this.endroit(es.e.x, es.e.y), cls: p.cls }))
    if (def.boss || es.elite) got.push(material('piece', 2 + Math.floor(Math.random() * 3)))
    for (const it of got) this.give(p, it, es.e.x, es.e.y)
  }

  /** l'endroit d'une table de butin : la carte, ou la région sur le continent */
  endroit(x: number, y: number) {
    const c = this.w.map.carte
    return c === 'ossara' || !c ? regionIdAt(Math.floor(x / TILE), Math.floor(y / TILE)) : c
  }

  needs(p: PSim, b: string) {
    const s = this.state(p.account)
    for (const id of s.active.keys()) for (const o of QUEST_BY_ID[id].objectifs) if (o.t === 'ramasser' && o.b === b) return true
    return false
  }

  /** Met un objet dans le sac, et le montre au joueur. */
  give(p: PSim, it: Item, x = p.s.x, y = p.s.y) {
    const nom = ref(itemKey(it)), n = it.n
    if (!addToInv(p.inv, it)) { this.log(p, msg('srv.sac.plein_laisse', { objet: nom }), '#ff9b6b'); return false }
    const col = isEquip(it) ? RARETES[it.r].couleur : '#e9ecef'
    this.w.hooks.fx(x, y, { k: 'butin', x, y, s: n > 1 ? msg('srv.sac.butin', { objet: nom, n }) : msg(itemKey(it)), c: col, r: isEquip(it) ? it.r : 0, sid: p.sid })
    this.recountItems(p)
    this.pushInv(p)
    if (this.state(p.account).active.size) this.pushQuests(p)
    return true
  }

  checkExplore(p: PSim) {
    if (!p.account) return
    const s = this.state(p.account)
    if (!s.active.size) return
    const pois = this.w.map.monde?.pois ?? []
    for (const [id, prog] of s.active) QUEST_BY_ID[id].objectifs.forEach((o, i) => {
      if (o.t !== 'explorer' || (prog[i] ?? 0) >= 1) return
      const poi = pois.find((q) => q.id === o.lieu)
      if (poi && Math.hypot(poi.x - p.s.x, poi.y - p.s.y) < poi.r) this.progress(p, (oo) => oo === o, 1, id)
    })
  }

  // ---------------------------------------------------------------- dialogues
  near(p: PSim, npc: string) {
    const ns = this.vie.npcs.get(npc)
    return !!ns && p.s.etat === 0 && Math.hypot(ns.n.x - p.s.x, ns.n.y - p.s.y) < TALK_R
  }

  talk(p: PSim, npc: string): Dialogue | null {
    if (!this.near(p, npc) || !p.account) return null
    // parler à quelqu'un fait avancer les objectifs « parler »
    this.progress(p, (o) => o.t === 'parler' && o.npc === npc)
    return this.menu(p, npc)
  }

  menu(p: PSim, npc: string, texte?: Texte): Dialogue {
    const def = NPC_BY_ID[npc]
    const s = this.state(p.account)
    const options: Dialogue['options'] = []
    for (const [id, prog] of s.active) { const q = QUEST_BY_ID[id]; if (q.rendre === npc && questComplete(q, prog)) options.push({ id: 'rendre:' + id, label: ['? ', msg(`quete.${id}.nom`)] }) }
    for (const q of QUESTS) if (q.donneur === npc && questAvailable(q, s.done, new Set(s.active.keys()), p.level, s.flags)) options.push({ id: 'voir:' + q.id, label: ['! ', msg(`quete.${q.id}.nom`)] })
    for (const [id, prog] of s.active) {
      const q = QUEST_BY_ID[id]
      if (q.donneur !== npc || questComplete(q, prog)) continue
      const esc = q.objectifs.findIndex((o) => o.t === 'escorte' && o.npc === npc)
      if (esc >= 0 && !(prog[esc] >= 1) && !this.vie.npcs.get(npc)?.escort) options.push({ id: 'escorte:' + id, label: msg('srv.dlg.en_route') })
      else options.push({ id: 'info:' + id, label: ['… ', msg(`quete.${id}.nom`)] })
    }
    if (npc === 'joss' && countInv(p.inv, 'tamagoyle_casse') > 0) options.push({ id: 'tama', label: msg('srv.dlg.tama') })
    if (def.boutique) options.push({ id: 'boutique', label: msg(def.boutique === 'cantine' ? 'srv.dlg.cuisine' : 'srv.dlg.commerce') })
    options.push({ id: 'bye', label: msg('srv.dlg.bye') })
    return { npc, nom: nomPnj(npc), titre: titrePnj(npc), texte: texte ?? this.greeting(p, npc), options }
  }

  greeting(p: PSim, npc: string): Texte {
    const def = NPC_BY_ID[npc]
    const f = this.state(p.account).flags
    // Cantor chante toujours ; les autres parlent parfois de la lignée, ou de ce qui s'est fait sur le serveur
    const sp = this.ligneSpeciale(p, npc)
    if (sp) return sp
    // le choix se voit dans les voix d'Ossara
    if (f.choix === 'colonie' && (npc === 'maelle' || npc === 'ondine' || npc === 'fertile1')) return msg(npc === 'maelle' ? 'srv.salut.maelle_colonie' : 'srv.salut.fertile_colonie')
    if (f.choix === 'fertiles' && npc === 'ysolde') return msg('srv.salut.ysolde_fertiles')
    if (f.choix === 'fertiles' && npc === 'maelle') return msg('srv.salut.maelle_fertiles')
    if (f.choix === 'colonie' && npc === 'ysolde') return msg('srv.salut.ysolde_colonie')
    return msg(`pnj.${npc}.salut.${Math.floor(Math.random() * def.salut.length)}`)
  }

  /** Les lignes qui viennent du serveur : les ancêtres morts du soldat, les morts chantés par Cantor, les exploits. */
  ligneSpeciale(p: PSim, npc: string): Texte | null {
    const anc = this.ancetres(p.account)
    if (npc === 'septieme') {
      const morts = (db().deaths(200) as { given: string; family: string }[]).filter((d) => !estBanc(d.family)).map((d) => `${d.given} ${d.family}`.toUpperCase())
      const noms = [...new Set(morts)].slice(0, 6)
      const chant = noms.length ? msg('srv.cantor.chant', { noms: noms.join(', ') }) : msg('srv.cantor.chant_vide')
      const a = anc[0]
      return a ? [chant, '\n\n', msg('srv.cantor.ancetre', { nom: a.nom, ou: a.ou, tueur: a.tueur })] : chant
    }
    if (npc === 'odile' && Math.random() < 0.4) { const e = this.exploit(); if (e) return e }
    const a = anc.length && Math.random() < 0.4 ? pick(anc) : null
    if (!a) return null
    if (!['ysolde', 'joss', 'odile', 'ilona', 'agathe', 'nadia'].includes(npc)) return null
    return msg(`srv.ancetre.${npc}`, { nom: a.nom, g: a.generation, ou: a.ou, tueur: a.tueur })
  }

  /** Ce qui s'est fait de notable sur le serveur, tel qu'Odile le raconte à la cantine. */
  exploit(): Texte | null {
    const out: Texte[] = []
    const eng = db().get('exploit_engloutisseur'), couv = db().get('exploit_couveuse')
    if (eng) out.push(msg('srv.exploit.engloutisseur', { nom: eng }))
    if (couv) out.push(msg('srv.exploit.couveuse', { nom: couv }))
    const vieille = (db().db.prepare('SELECT a.family AS family, MAX(s.generation) AS g FROM soldiers s JOIN accounts a ON a.id = s.account GROUP BY s.account ORDER BY g DESC LIMIT 20').all() as { family: string; g: number }[]).find((v) => !estBanc(v.family))
    if (vieille && vieille.g >= 2) out.push(msg('srv.exploit.lignee', { famille: vieille.family, n: vieille.g }))
    return out.length ? pick(out) : null
  }

  choose(p: PSim, npc: string, id: string): Dialogue | null {
    if (!this.near(p, npc) || !p.account) return null
    const s = this.state(p.account)
    const [k, qid] = id.split(':')
    const q = qid ? QUEST_BY_ID[qid] : undefined
    if (k === 'bye') return null
    if (k === 'boutique') { this.openShop(p, npc); return null }
    if (k === 'tama' && npc === 'joss') {
      if (!takeFromInv(p.inv, 'tamagoyle_casse', 1)) return this.menu(p, npc)
      this.give(p, material('tamagoyle', 1))
      return { npc, nom: nomPnj(npc), titre: titrePnj(npc), options: [{ id: 'menu', label: msg('srv.dlg.quoi') }, { id: 'bye', label: msg('srv.dlg.bye') }],
        texte: msg('srv.dlg.tama_texte') }
    }
    if (!q) return this.menu(p, npc)
    if (k === 'voir') {
      if (q.donneur !== npc || !questAvailable(q, s.done, new Set(s.active.keys()), p.level, s.flags)) return this.menu(p, npc)
      const objs: Texte[] = q.objectifs.flatMap((_, i) => [i ? '\n' : '', '• ', msg(`quete.${q.id}.obj.${i}`)])
      return { npc, nom: nomPnj(npc), titre: titrePnj(npc), texte: [msg(`quete.${q.id}.intro`), '\n\n', ...objs], options: [{ id: 'accepter:' + q.id, label: msg('srv.dlg.accepter') }, { id: 'menu', label: msg('srv.dlg.plus_tard') }] }
    }
    if (k === 'accepter') {
      if (q.donneur !== npc || !questAvailable(q, s.done, new Set(s.active.keys()), p.level, s.flags)) return this.menu(p, npc)
      const prog = q.objectifs.map(() => 0)
      s.active.set(q.id, prog)
      db().setQuest(p.account, q.id, 'en_cours', prog)
      this.log(p, msg('srv.quete.nouvelle', { quete: nomQ(q.id) }), '#ffd36b')
      if (q.aAccepter) this.setFlag(p, q.aAccepter[0], q.aAccepter[1])
      // un texte déjà lu compte (le carnet de Danet lu avant qu'on le demande)
      if (q.objectifs.some((o, i) => o.t === 'lire' && s.flags['lu_' + o.id] === '1' && (prog[i] = 1))) db().setQuest(p.account, q.id, 'en_cours', prog)
      // un objectif peut être déjà rempli (objets dans le sac, ou parler à celui qui la donne)
      this.recountItems(p)
      this.progress(p, (o) => o.t === 'parler' && o.npc === npc, 1, q.id)
      this.pushQuests(p)
      return this.menu(p, npc, msg('srv.dlg.bien'))
    }
    if (k === 'info') {
      const prog = s.active.get(q.id) ?? []
      const objs: Texte[] = q.objectifs.flatMap((o, i) => [i ? '\n' : '', `${(prog[i] ?? 0) >= objectiveTarget(o) ? '✔' : '•'} `, msg(`quete.${q.id}.obj.${i}`), ` (${prog[i] ?? 0}/${objectiveTarget(o)})`])
      return { ...this.menu(p, npc), texte: [msg(`quete.${q.id}.intro`), '\n\n', ...objs] }
    }
    if (k === 'escorte') {
      const o = q.objectifs.find((oo) => oo.t === 'escorte')
      const poi = o && o.t === 'escorte' ? this.w.map.monde?.pois.find((pp) => pp.id === o.vers) : null
      if (!o || !poi || !s.active.has(q.id)) return this.menu(p, npc)
      const r = this.vie.startEscort(npc, p, { x: poi.x, y: poi.y, r: Math.min(poi.r, 70) }, q.id)
      if (r !== 'ok') return this.menu(p, npc, msg('srv.dlg.deja_escorte'))
      return { npc, nom: nomPnj(npc), texte: msg('srv.dlg.je_te_suis'), options: [{ id: 'bye', label: msg('srv.dlg.en_route') }] }
    }
    if (k === 'rendre' || k === 'choixA' || k === 'choixB') {
      const prog = s.active.get(q.id)
      if (!prog || q.rendre !== npc || !questComplete(q, prog)) return this.menu(p, npc)
      if (q.choix && k === 'rendre') {
        return { npc, nom: nomPnj(npc), titre: titrePnj(npc), texte: msg(`quete.${q.id}.question`), options: [{ id: 'choixA:' + q.id, label: msg(`quete.${q.id}.a.label`) }, { id: 'choixB:' + q.id, label: msg(`quete.${q.id}.b.label`) }] }
      }
      // les objets demandés sont remis
      for (const o of q.objectifs) if (o.t === 'ramasser' && !takeFromInv(p.inv, o.b, o.n)) return this.menu(p, npc, msg('srv.dlg.manque'))
      s.active.delete(q.id); s.done.add(q.id)
      db().setQuest(p.account, q.id, 'fini', prog)
      this.reward(p, q.recompense, q)
      let texte: Texte = msg(`quete.${q.id}.fin`)
      if (q.id === 'les_ruches') this.affaiblirRuches(p)
      if (q.fins && q.campagne === 2) {
        const fin = this.finCampagne2(p)
        texte = msg(`quete.${q.id}.fins.${fin}`)
        this.setFlag(p, 'fin_c2', fin)
        db().incr('fin_c2_' + fin)
        this.io.log(msg(fin === 'repli' ? 'srv.annonce.metier_garde' : 'srv.annonce.metier_tombe', { qui: `${p.given} ${p.family}` }), '#c48bff')
      } else if (q.fins) {
        const fin = this.finCampagne(p)
        texte = msg(`quete.${q.id}.fins.${fin}`)
        this.setFlag(p, 'fin_c1', fin)
        // le serveur compte les fins des lignées : la majorité dit d'où part la campagne 2
        db().incr('fin_c1_' + fin)
        this.io.log(msg(fin === 'evacuation' ? 'srv.annonce.ligne_perdue' : 'srv.annonce.ligne_tenue', { qui: `${p.given} ${p.family}` }), '#c48bff')
      }
      if (q.choix) {
        const c = k === 'choixA' ? q.choix.a : q.choix.b
        const cle = q.choix.cle ?? 'choix'
        s.flags[cle] = c.flag
        db().setFlag(p.account, cle, c.flag)
        const n = db().incr('choix_' + c.flag)
        this.reward(p, c.recompense, q)
        texte = msg(`quete.${q.id}.${k === 'choixA' ? 'a' : 'b'}.texte`)
        this.io.log(msg(`srv.annonce.choix_${c.flag}`, { n }), '#c48bff')
      }
      this.log(p, msg('srv.quete.terminee', { quete: nomQ(q.id) }), '#7dff9a')
      this.pushQuests(p)
      this.pushInv(p)
      return { npc, nom: nomPnj(npc), titre: titrePnj(npc), texte, options: [{ id: 'menu', label: msg('srv.dlg.continuer') }] }
    }
    return this.menu(p, npc)
  }

  reward(p: PSim, r: Recompense, q: QuestDef) {
    if (r.xp) this.w.giveXp(p, r.xp, 0)
    if (r.ferraille) { db().addScrap(p.account, r.ferraille); this.log(p, msg('srv.quete.ferraille', { n: r.ferraille }), '#ffd36b') }
    if (r.objet) this.give(p, rollEquip(r.objet.b, Math.max(q.niveau, p.level), r.objet.r, p.cls))
    for (const it of r.items ?? []) this.give(p, material(it.b, it.n))
    if (r.flag) { this.setFlag(p, r.flag[0], r.flag[1]); this.onFlag?.(p, r.flag[0], r.flag[1]) }
    if (r.lecture) this.unlock(p, r.lecture, true)
  }
  setFlag(p: PSim, k: string, v: string) { const s = this.state(p.account); s.flags[k] = v; db().setFlag(p.account, k, v) }
  /** un drapeau de lignée vient d'être posé (la selle : le salon prévient le client) */
  onFlag: ((p: PSim, k: string, v: string) => void) | null = null
  /** oublie l'état mis en cache d'un compte : il vient d'arriver d'une autre carte, la base fait foi */
  forget(account: string) { this.acc.delete(account) }


  // ---------------------------------------------------------------- lectures (shared/journaux.ts)
  /** Débloque un texte pour la lignée (il reste dans le journal), fait avancer les objectifs « lire »,
   *  et l'envoie à l'écran. `auto` : on ne l'a pas demandé (arrivée dans un lieu, récompense, ramassage). */
  unlock(p: PSim, id: string, auto = false, texte?: Texte) {
    const l = LECTURE_BY_ID[id]
    if (!l || !p.account) return
    const s = this.state(p.account)
    const neuf = s.flags['lu_' + id] !== '1'
    if (neuf) { this.setFlag(p, 'lu_' + id, '1'); this.log(p, msg('srv.lu', { titre: ref(`lecture.${id}.titre`) }), '#c9b6ff') }
    this.progress(p, (o) => o.t === 'lire' && o.id === id)
    if (neuf) this.pushQuests(p)
    const m: LectureMsg = { ...lectureTextes(id), texte: texte ?? msg(`lecture.${id}.texte`), auto }
    this.io.send(p, 'lecture', m)
  }

  /** Relire un texte déjà débloqué (depuis le journal). */
  relire(p: PSim, id: string) {
    const l = LECTURE_BY_ID[id]
    if (!l || this.state(p.account).flags['lu_' + id] !== '1') return
    this.io.send(p, 'lecture', lectureTextes(id) satisfies LectureMsg)
  }

  /** Un endroit où lire ou agir : stèles, plaques, journaux posés, la porte scellée de la passerelle. */
  lire(p: PSim, endroit: string) {
    const e = ENDROIT_BY_ID[endroit]
    if (!e || !p.account || p.s.etat !== 0 || (this.w.map.carte ?? 'ossara') !== e.carte) return
    if (Math.hypot(e.x * TILE + 8 - p.s.x, e.y * TILE + 8 - p.s.y) > LIRE_R + 12) return
    const s = this.state(p.account)
    if (e.id === 'stele_saisons') return this.io.send(p, 'lecture', { id: e.id, titre: msg('srv.stele.titre'), source: msg('srv.stele.source'), texte: this.steleSaisons() } satisfies LectureMsg)
    if (e.id === 'porte_scellee') {
      if (s.flags.acte2 !== '1') return this.io.send(p, 'lecture', { id: e.id, titre: msg('srv.porte.titre'), source: msg('srv.porte.source'), texte: msg('srv.porte.texte') } satisfies LectureMsg)
      this.log(p, msg('srv.porte.ouverte'), '#c9b6ff')
      return this.teleport(p, 90, 21)
    }
    if (e.id === 'salle_sortie') return this.teleport(p, 85, 21)
    if (e.objet && s.flags['obj_' + e.id] !== '1') {
      if (!this.give(p, material(e.objet, 1))) return
      this.setFlag(p, 'obj_' + e.id, '1')
    }
    if (e.lecture) this.unlock(p, e.lecture)
  }

  teleport(p: PSim, tx: number, ty: number) {
    this.w.mount(p, false)
    p.s.x = tx * TILE + 8; p.s.y = ty * TILE + 8
    if (p.robot) { p.robot.r.x = p.s.x - 14; p.robot.r.y = p.s.y + 6 }
  }

  /** Le premier mort définitif de chaque saison, pour toujours (lu dans la table des morts). */
  steleSaisons() {
    const rows = db().db.prepare('SELECT family, given, generation, killer, at FROM deaths ORDER BY at ASC').all() as { family: string; given: string; generation: number; killer: string; at: number }[]
    const vues = new Set<string>()
    const lignes: Texte[] = []
    for (const r of rows) {
      if (estBanc(r.family)) continue
      const sa = saisonDe(r.at)
      if (vues.has(sa.cle)) continue
      vues.add(sa.cle)
      if (lignes.length) lignes.push('\n')
      lignes.push(msg('srv.stele.ligne', { saison: msg(`srv.saison.${sa.saison}`, { an: sa.an }), nom: `${r.given} ${r.family}`, g: r.generation, tueur: lireCause(r.killer, true) }))
    }
    return [msg('srv.stele.intro'), '\n\n', ...(lignes.length ? lignes : [msg('srv.stele.vide')])]
  }

  /** La fin de la campagne 1 : le front (toutes les lignées) et le choix de Haute-Sève (celle-ci). */
  /** La fin de la campagne 2 : les foyers des Hauts (avec 8 tuiles de marge par victoire de l'assaut du Métier, au plus
   *  trois) et le choix du Métier de la lignée. */
  finCampagne2(p: PSim): FinCampagne2 {
    const r = this.w.ruches
    const marge = 8 * Math.min(3, this.w.glaneuseVaincue)
    let s = 0, s0 = 0
    for (let i = NB_RUCHES_C1; i < RAYONS_DEPART.length; i++) { s += r[i]; s0 += RAYONS_DEPART[i] }
    if (s > s0 + marge) return 'repli'
    return this.state(p.account).flags.choix2 === 'laisser' ? 'victoire_laisse' : 'victoire_delivres'
  }

  finCampagne(p: PSim): FinCampagne {
    const r = this.w.ruches
    // chaque victoire du raid contre le Semeur (tout le serveur, cette campagne) donne de la marge à la ligne : 8 tuiles, au plus 3 fois
    const marge = 8 * Math.min(3, this.w.semeurVaincu)
    // seules les ruches d'Ossara comptent : les foyers des Hauts sont la campagne 2
    const somme = (a: ArrayLike<number>) => { let s = 0; for (let i = 0; i < NB_RUCHES_C1; i++) s += a[i]; return s }
    const tenu = somme(r) <= somme(RAYONS_DEPART) + marge
    if (!tenu) return 'evacuation'
    return this.state(p.account).flags.choix === 'colonie' ? 'victoire_colonie' : 'victoire_fertiles'
  }

  /** « Les ruches » rendue : toutes les ruches reculent un peu, pour toute la Colonie (service central). */
  affaiblirRuches(p: PSim) {
    if (this.w.central) this.w.central.pushAll(1, 1); else pushFrontAll(this.w.ruches, 1, 1)
    this.io.log(msg('srv.annonce.ruches', { qui: `${p.given} ${p.family}` }), '#7dff9a')
  }

  /** Les ancêtres morts de ce soldat (le plus récent d'abord), avec l'endroit et le tueur. */
  ancetres(account: string) {
    return db().lineage(account).filter((x) => !x.alive && x.death_json).reverse().map((x) => {
      let d: { killer?: string; x?: number; y?: number; carte?: string } = {}
      try { d = JSON.parse(x.death_json!) } catch { /* rien */ }
      return { nom: x.given, generation: x.generation, ou: endroitDe(d.carte, d.x, d.y), tueur: d.killer ? lireCause(d.killer, true) : msg('srv.tueur.eden') }
    })
  }

  /** Port-Ancre : un robot laissé immobile deux minutes sur la place, avec son soldat, se met à danser.
   *  Appelé une fois par seconde sur le continent ; le client anime le robot (bit 2 de `fx`). */
  immobile = new Map<string, { x: number; y: number; t: number }>()
  robotsQuiDansent() {
    for (const p of this.w.players.values()) {
      if (p.bot || !p.robot) continue
      const r = p.robot
      const surPlace = Math.hypot(r.r.x / TILE - PLACE.x, r.r.y / TILE - PLACE.y) < PLACE.r && p.s.etat === 0 && r.r.mode !== 6 && r.r.mode !== 3
      const im = this.immobile.get(p.sid)
      if (!surPlace || !im || Math.hypot(im.x - p.s.x, im.y - p.s.y) > 3) { this.immobile.set(p.sid, { x: p.s.x, y: p.s.y, t: this.w.time }); r.danse = false; continue }
      const danse = this.w.time - im.t >= PLACE.attente
      if (danse && !r.danse) this.log(p, msg('srv.robot.danse'), '#7fd6ff')
      r.danse = danse
    }
    for (const sid of this.immobile.keys()) if (!this.w.players.has(sid)) this.immobile.delete(sid)
  }

  // ---------------------------------------------------------------- marchands
  openShop(p: PSim, npc: string) {
    const def = NPC_BY_ID[npc]
    if (!def.boutique) return
    const flags = this.state(p.account).flags
    if (def.boutique === 'fertile' && flags.choix !== 'fertiles') {
      this.io.send(p, 'dialogue', { npc, nom: nomPnj(npc), titre: titrePnj(npc), texte: msg(flags.choix === 'colonie' ? 'srv.boutique.fertile_colonie' : 'srv.boutique.fertile_inconnu'), options: [{ id: 'bye', label: msg('srv.dlg.bye') }] } satisfies Dialogue)
      return
    }
    const b = BOUTIQUES[def.boutique]
    const lvl = Math.max(1, p.level)
    const items = b.vend.map((v, i) => {
      if (v.b === 'arme' || v.b === 'armure' || v.b === 'module') { const R = seeded(hashStr(npc + i + lvl + Math.floor(Date.now() / 3600_000))); return rollEquip(v.b, lvl + (v.r ?? 0), v.r ?? 0, p.cls, R) }
      return material(v.b, v.b === 'piece' ? 3 : 1)
    })
    this.offers.set(p.sid, { npc, items })
    this.io.send(p, 'boutique', { npc, nom: msg(`boutique.${def.boutique}.nom`), vend: items.map((it) => ({ it, prix: buyPrice(it) })), achete: b.achete, banque: db().account(p.account)!.scrap })
  }

  buy(p: PSim, i: number) {
    const o = this.offers.get(p.sid)
    if (!o || !this.near(p, o.npc)) return
    const it = o.items[i]
    if (!it) return
    const prix = buyPrice(it)
    const acc = db().account(p.account)!
    if (acc.scrap < prix) return this.log(p, msg('srv.ferraille.manque', { n: prix, a: acc.scrap }), '#ff9b6b')
    const copy: Item = { ...JSON.parse(JSON.stringify(it)), u: it.u + Math.random().toString(36).slice(2, 5) }
    if (!this.give(p, copy)) return
    db().addScrap(p.account, -prix)
    this.log(p, msg('srv.boutique.achete', { objet: ref(itemKey(copy)), n: prix }), '#ffd36b')
    this.openShop(p, o.npc)
  }

  sell(p: PSim, u: string) {
    const o = this.offers.get(p.sid)
    if (!o || !this.near(p, o.npc)) return
    const b = BOUTIQUES[NPC_BY_ID[o.npc].boutique!]
    const idx = p.inv.findIndex((it) => it.u === u)
    if (idx < 0) return
    const it = p.inv[idx]
    if (BASES[it.b]?.type === 'quete') return this.log(p, msg('srv.boutique.invendable'), '#ff9b6b')
    if (b.achete !== 'tout' && !b.achete.includes(it.b)) return this.log(p, msg('srv.boutique.n_achete_pas', { pnj: ref(`pnj.${o.npc}.nom`) }), '#ff9b6b')
    const v = sellValue(it)
    p.inv.splice(idx, 1)
    db().addScrap(p.account, v)
    this.log(p, msg('srv.boutique.vendu', { objet: ref(itemKey(it)), n: v }), '#ffd36b')
    this.recountItems(p)
    this.pushInv(p)
    this.openShop(p, o.npc)
  }

  // ---------------------------------------------------------------- sac et équipement
  equip(p: PSim, u: string, slot?: Slot) {
    const idx = p.inv.findIndex((it) => it.u === u)
    if (idx < 0) return
    const it = p.inv[idx]
    const slots = slotsFor(it)
    if (!slots.length) return
    if (it.b === 'arme' && it.c && it.c !== p.cls) return this.log(p, msg('srv.sac.autre_classe'), '#ff9b6b')
    if (it.l > p.level + NIVEAU_MARGE) return this.log(p, msg('srv.sac.trop_haut', { n: it.l - NIVEAU_MARGE }), '#ff9b6b')
    const sl = slot && slots.includes(slot) ? slot : slots.find((s) => !p.equip[s]) ?? slots[0]
    const old = p.equip[sl]
    p.inv.splice(idx, 1)
    if (old) p.inv.push(old)
    p.equip[sl] = it
    this.w.applyEquip(p)
    this.pushInv(p)
  }

  unequip(p: PSim, slot: Slot) {
    const it = p.equip[slot]
    if (!it) return
    if (!addToInv(p.inv, it)) return this.log(p, msg('srv.sac.plein'), '#ff9b6b')
    delete p.equip[slot]
    this.w.applyEquip(p)
    this.pushInv(p)
  }

  use(p: PSim, u: string) {
    const it = p.inv.find((x) => x.u === u)
    if (!it || p.s.etat !== 0) return
    if (it.b === 'trousse' || it.b === 'baume') {
      if (p.s.hp >= p.s.maxHp) return
      takeFromInv(p.inv, it.b, 1)
      this.w.heal(p, p.s.maxHp * (it.b === 'baume' ? 0.7 : 0.45))
      this.pushInv(p)
    }
  }

  /** Recycler un objet d'équipement, n'importe où : de la ferraille à la banque, des pièces de robot au sac. */
  recycle(p: PSim, u: string) {
    const idx = p.inv.findIndex((x) => x.u === u)
    if (idx < 0 || !isEquip(p.inv[idx])) return
    const it = p.inv[idx], g = recyclage(it)
    p.inv.splice(idx, 1)
    if (!p.test) db().addScrap(p.account, g.ferraille)
    addToInv(p.inv, material('piece', g.pieces))
    this.log(p, msg('srv.sac.recycle', { objet: ref(itemKey(it)), n: g.ferraille, p: g.pieces }), '#ffd36b')
    this.w.hooks.fx(p.s.x, p.s.y, { k: 'sk', s: 'recycle', x: p.s.x, y: p.s.y })
    this.recountItems(p); this.pushInv(p)
  }

  drop(p: PSim, u: string) {
    const idx = p.inv.findIndex((x) => x.u === u)
    if (idx < 0 || BASES[p.inv[idx].b]?.type === 'quete') return
    p.inv.splice(idx, 1)
    this.recountItems(p); this.pushInv(p); this.pushQuests(p)
  }

  // ---------------------------------------------------------------- ressources et pannes
  pick(p: PSim, id: string) {
    const nd = this.vie.pick(id, p)
    if (!nd) return
    const b = { herbe: 'herbe', champignon: 'champignon', pieces: 'piece', noyau: 'noyau', echantillon: 'echantillon' }[nd.type]
    if (!this.give(p, material(b, nd.type === 'pieces' ? 2 : 1), nd.x, nd.y)) return
    // un cœur de données se lit : le suivant de la série que la lignée n'a pas encore lu
    if (nd.type === 'noyau') { const f = this.state(p.account).flags; const id = COEURS.find((c) => f['lu_' + c] !== '1'); if (id) this.unlock(p, id, true) }
  }

  repair(p: PSim, id: string) {
    const pn = this.vie.repair(id, p)
    if (!pn) return
    this.log(p, msg(pn.type === 'lampe' ? 'srv.panne.lampe' : 'srv.panne.balise'), '#7fd6ff')
    this.progress(p, (o) => o.t === 'reparer' && o.type === pn.type)
  }

  /** Pour les agents IA : où en est ce compte, dans la langue de l'agent. */
  summary(account: string, l: Lang = 'en') {
    const s = this.state(account)
    const n = (k: string) => tr(l, k)
    return {
      actives: [...s.active].map(([id, prog]) => {
        const q = QUEST_BY_ID[id]
        return { id, nom: n(`quete.${id}.nom`), donneur: n(`pnj.${q.donneur}.nom`), rendre: n(`pnj.${q.rendre}.nom`), terminee: questComplete(q, prog), objectifs: q.objectifs.map((o, i) => ({ texte: n(`quete.${id}.obj.${i}`), fait: prog[i] ?? 0, total: objectiveTarget(o) })) }
      }),
      faites: [...s.done].map((id) => (QUEST_BY_ID[id] ? n(`quete.${id}.nom`) : id)),
      choix: s.flags.choix ?? null,
      campagne: this.campagne(account, l),
      lectures: Object.keys(LECTURE_BY_ID).filter((id) => s.flags['lu_' + id] === '1').map((id) => ({ id, titre: n(`lecture.${id}.titre`), texte: n(`lecture.${id}.texte`) })),
    }
  }

  /** Où en est la lignée dans la campagne 1 : l'acte, le prochain pas de la trame, la fin si elle est jouée. */
  campagne(account: string, l: Lang = 'en') {
    const s = this.state(account)
    const trame = QUESTS.filter((q) => q.principale && (!q.flag || s.flags[q.flag[0]] === q.flag[1] || !s.flags[q.flag[0]]))
    const prochaine = trame.find((q) => !s.done.has(q.id) && !(q.id === 'la_constance' && s.done.has('la_constance_c')) && !(q.id === 'la_constance_c' && s.done.has('la_constance')))
    return {
      nom: tr(l, 'srv.agent.campagne1'),
      acte: prochaine?.acte ?? 3,
      prochainPas: prochaine ? { id: prochaine.id, nom: tr(l, `quete.${prochaine.id}.nom`), enCours: s.active.has(prochaine.id), donneur: tr(l, `pnj.${prochaine.donneur}.nom`) } : null,
      fin: s.flags.fin_c1 ?? null,
      salleSecreteOuverte: s.flags.acte2 === '1',
    }
  }
}

/** Les comptes des bancs de charge (« Charge12 », « Banc ») ne sont pas des lignées : on ne les chante pas. */
function estBanc(family: string) { return /^(Charge\d+|Banc)$/.test(family) }
/** Le nom d'un endroit d'Ossara (lieu habité, sinon région), ou de l'épave, ou du nid. */
export function endroitDe(carte: string | undefined, x?: number, y?: number): Msg {
  if (carte === 'nid') return msg('srv.ou.nid')
  if (carte && carte !== 'ossara' && carte !== 'constance') return msg('srv.ou.donjon', { lieu: ref(`carte.${carte}.nom`) })
  if (x === undefined || y === undefined) return msg('srv.ou.front')
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE)
  if (carte === 'constance') { const l = CONSTANCE_LIEUX.find((c) => tx >= c.x0 && tx <= c.x1 && ty >= c.y0 && ty <= c.y1); return l ? msg('srv.ou.epave_salle', { salle: ref(`lieu.${l.id}.nom`) }) : msg('srv.ou.epave') }
  const l = lieuAt(tx, ty)
  if (l) return msg('srv.ou.pres', { lieu: ref(`lieu.${l.id}.nom`) })
  const r = regionIdAt(tx, ty)
  return r ? msg(`srv.ou.region.${r}`) : msg('srv.ou.front')
}
/** l'écran de lecture d'un texte de shared/journaux.ts, en clés */
function lectureTextes(id: string): LectureMsg {
  const l = LECTURE_BY_ID[id]
  return { id, titre: msg(`lecture.${id}.titre`), source: l.source ? msg(`lecture.${id}.source`) : undefined, texte: msg(`lecture.${id}.texte`) }
}

function pick<T>(a: T[]) { return a[Math.floor(Math.random() * a.length)] }

function hashStr(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h >>> 0 }
function seeded(seed: number) { let a = seed; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
export { TILE }
