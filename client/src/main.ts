// Le point d'entrée : compte invité, choix de classe, secteur, concessions, relève, et tous les écrans.
import { initSocial, ecranSocial, ecranEchange, etat as etatSocial } from './social.ts'
import Phaser from 'phaser'
import { zoneIdAt, zoneDef, lieuAt, type GameMap } from '../../shared/map.ts'
import { carteMap } from '../../shared/cartes/index.ts'
import { CARTES, STATIONS, STATION_BY_ID, STATION_COUT, STATION_R, PASSAGE_BY_ID, isCarte, type CarteId } from '../../shared/monde.ts'
import { CONSTANCE_LIEUX } from '../../shared/cartes/constance.ts'
import { concessionMap } from '../../shared/concessionMap.ts'
import { balles, posBalle, TOUCHE_R } from '../../shared/motifs.ts'
import { BOSS_TEST, ENTREES_TEST, niveauRegionTest } from '../../shared/boss-test.ts'
import { REGIONS } from '../../shared/regions/index.ts'
import { CLASSES, CLASS_IDS, MONTURE, type ClassId } from '../../shared/rules.ts'
import { NPC_BY_ID, factionOf } from '../../shared/npcs.ts'
import { QUESTS, QUEST_BY_ID, questAvailable, questComplete, objectiveTarget, questMarkFor, MARK_STYLE, type QuestMark, type Recompense } from '../../shared/quests.ts'
import { SLOTS, BASES, sellValue, slotsFor, totalStats, recyclage, isEquip, STAT_NOMS, INV_MAX, type Item, type Slot } from '../../shared/items.ts'
import { itemIcon } from './pixel2.ts'
import { SPEC_BY_ID, MAITRISE_BY_ID, specsDe, maitrisesDe, talentsDe, RANG_MAX, PALIER_POINTS, MOD_KEYS, peutPrendre, peutSpecialiser, peutMaitriser, niveauSpecialite, pointsArbre, NIVEAU_MAITRISE, type Talents } from '../../shared/talents.ts'
import { TILE, HAUTS_X } from '../../shared/consts.ts'
import { GameScene, devicePixelRatioCap } from './scene.ts'
import { Net } from './net.ts'
import { Controls } from './controls.ts'
import * as ui from './ui.ts'
import { esc, entete } from './ui.ts'
import { ico, ICONE_COMP } from './icones.ts'
import { ENDROITS, LIRE_R, LECTURE_BY_ID, LECTURES } from '../../shared/journaux.ts'
import { lectureHtml, lecturesHtml, type LectureMsg } from './lecture.ts'
import * as son from './son.ts'
import { brancherSon, sonQuetes, ecranSonHtml, actionSon } from './son-jeu.ts'
import { t, tx, setLang, lang, langueDepart, lireCause, CLE_LANGUE, type Lang } from '../../shared/i18n/index.ts'

// la langue, avant tout rendu : celle du navigateur au premier lancement, puis le réglage du menu
setLang(langueDepart(localStorage.getItem(CLE_LANGUE), navigator.language))
document.documentElement.lang = lang()
for (const e of document.querySelectorAll<HTMLElement>('[data-i18n]')) e.textContent = t(e.dataset.i18n!)
for (const e of document.querySelectorAll<HTMLElement>('[data-i18n-title]')) e.title = t(e.dataset.i18nTitle!)

const KEY = 'heirline.token'
let token = localStorage.getItem(KEY) ?? ''
const net = new Net()
const controls = new Controls(document.body)
/** la carte du graphe du monde où l'on est (le continent, l'épave, le nid) */
let carte: CarteId = 'ossara'
let map: GameMap = carteMap('ossara')
const minimap = new ui.Minimap()
let me: any = null
let kind: 'secteur' | 'concession' = 'secteur'
let concessionInfo: any = null
let portraits: Record<string, string> = {}
let pos = { x: 0, y: 0, zone: 'port' }
let actionKind: string | null = null
let actionLabel = ''
// le monde ouvert : quêtes, sac, boutique, dialogue en cours
let quetes: { actives: { id: string; prog: number[] }[]; faites: string[]; flags: Record<string, string>; choix: { colonie: number; fertiles: number } } = { actives: [], faites: [], flags: {}, choix: { colonie: 0, fertiles: 0 } }
let sac: { inv: Item[]; equip: Partial<Record<Slot, Item>>; st: any } = { inv: [], equip: {}, st: {} }
let boutique: any = null
let ecran: '' | 'dialogue' | 'sac' | 'journal' | 'boutique' | 'carte' | 'gare' | 'lecture' | 'talents' = ''
let sacChoisi = ''
let lieuCourant = ''
let regionCourante = ''

async function api(path: string, body?: unknown) {
  const r = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', 'x-heirline-token': token, 'x-heirline-lang': lang() }, body: body === undefined ? undefined : JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(j.erreur ?? r.statusText), { status: r.status })
  return j
}

// --------------------------------------------------------------- Phaser
const dpr = devicePixelRatioCap()
const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', backgroundColor: '#0b0d12', pixelArt: true, roundPixels: true,
  width: Math.round(innerWidth * dpr), height: Math.round(innerHeight * dpr),
  scale: { mode: Phaser.Scale.NONE },
  scene: [GameScene], fps: { target: 60 },
  input: { keyboard: false, mouse: false, touch: false },
})
/** l'échelle de l'interface (HUD, écrans) : 1 sur téléphone, tablette et petit bureau ; ×2 à partir de 1600 × 900, ×3 en 4K.
 *  Entière, pour que la police pixel reste nette ; sans elle, en 1920 × 1080, tout le HUD tenait dans un timbre-poste. */
function echelleUi() { const z = Math.max(1, Math.floor(Math.min(innerWidth / 800, innerHeight / 450))); document.documentElement.style.setProperty('--z', String(z)) }
echelleUi()
const resize = () => { game.scale.resize(Math.round(innerWidth * dpr), Math.round(innerHeight * dpr)); echelleUi() }
addEventListener('resize', resize)
addEventListener('orientationchange', () => setTimeout(resize, 200))

const scene = () => game.scene.getScene('jeu') as GameScene
const sceneReady = new Promise<GameScene>((res) => {
  const check = () => { const s = game.scene.getScene('jeu') as GameScene | null; if (s?.ready) res(s); else setTimeout(check, 30) }
  check()
})
sceneReady.then(brancherSon)

// --------------------------------------------------------------- réseau
net.on('fx', (list: any[]) => {
  scene()?.fx(list)
  for (const ev of list) {
    if (ev.sid !== net.room?.sessionId) continue
    if (ev.k === 'aterre') {
      const k = ev.regle === 'mort-definitive' ? 'definitive' : ev.regle === 'reapparition' ? 'reapparition' : 'evacuation'
      ui.banner(`<b${k === 'definitive' ? ' style="color:#ff5b5b"' : ''}>${t(`ui.aterre.titre_${k}`)}</b><br>${t(`ui.aterre.${k}`)}`, 6000)
    }
    if (ev.k === 'evac') ui.banner(`<b>${t('ui.aterre.evacue')}</b>${ev.perdu ? `<br>${t('ui.aterre.sac_perdu', { n: ev.perdu })}` : ''}`, 4500)
    if (ev.k === 'niveau') ui.log(t('ui.niveau', { n: ev.n }), '#ffd36b')
  }
})
net.on('log', (m: any) => ui.log(tx(m.t), m.color))
// le serveur sert un autre client que celui-ci (mise à jour, page restée en cache) : on recharge, une fois
net.on('version', (v: string) => {
  if (!(import.meta as any).env?.PROD || !v || import.meta.url.includes(v)) return
  const deja = sessionStorage.getItem('heirline.recharge')
  if (deja === v) return ui.log(t('ui.mise_a_jour'), '#ff9b6b')
  sessionStorage.setItem('heirline.recharge', v)
  location.reload()
})
// l'arène de la Couveuse : son état, les motifs de balles (forme, instant, graine), les balles qui ont touché
net.on('rame', (m) => scene()?.rail.depart(m))
net.on('arene', (m: any) => scene()?.arene?.etatRecu(m))
net.on('arene-etat', (m: any) => scene()?.arene?.nouveau(m))
net.on('motif', (m: any) => scene()?.arene?.motif(m))
net.on('bh', (m: any) => scene()?.arene?.touche(m))
net.on('aflash', (m: any) => scene()?.arene?.flash(m))
net.on('moi', (m: any) => {
  me = m
  const sc = scene(); if (sc) { sc.etatRobot = m.robot?.etat ?? ''; sc.garesOuvertes = m.gares ?? [] }
  ui.setSkills(m.comp ?? [], m.level)
  ui.setBadgeTalents(aChoisir(m))
  const cleT = JSON.stringify([m.talents, m.points, m.level, m.coutRaz])
  if (cleT !== talentsVus) { talentsVus = cleT; if (ecran === 'talents' && ui.screenOpen()) talentsScreen() }
  const i = CLASS_IDS.indexOf(m.soldat.cls)
  if (i >= 0 && game.textures.exists(`soldat${i}`)) ui.setPortrait(game.textures.get(`soldat${i}`).getSourceImage() as HTMLCanvasElement, i)
  ui.updateHud(me, net.self(), monRobot())
})
// un sas, une gare vers une autre carte, ou un voyage de test : on quitte ce salon et on rejoint l'autre
let enPassage = false
net.on('passage', async (m: any) => {
  if (enPassage || !isCarte(m.carte)) return
  enPassage = true
  ui.banner(`<b>${esc(tx(m.nom))}</b><br>${t('ui.passage.on_passe')}`, 2500)
  son.joue('passage')
  scene()?.transition?.()
  try { await net.leave(); await joinCarte(m.carte) } catch (e: any) { ui.log(t('ui.passage.impossible', { e: e.message }), '#ff9b6b'); await joinCarte('ossara').catch(() => location.reload()) }
  enPassage = false
})
net.on('releve', (m: any) => releveScreen(m))
initSocial({ net, me: () => me, sac: () => sac, scene: () => scene(), carte: () => carte, nomObjet: ui.nomObjet, ecran: (e) => { ecran = e as any }, ecranOuvert: () => (ui.screenOpen() ? ecran : '') })
let quetesRecues = false
net.on('quetes', (m: any) => {
  // une quête de plus dans les faites : l'effet « quête rendue » (pas au premier message, qui charge l'état)
  if (quetesRecues && m.faites?.length > quetes.faites.length) scene()?.effetQuete?.()
  if (quetesRecues) sonQuetes(quetes, m)
  quetesRecues = true
  quetes = m; if (ecran === 'journal' && ui.screenOpen()) journalScreen()
})
net.on('inv', (m: any) => { sac = m; if (ecran === 'sac' && ui.screenOpen()) sacScreen(); if (ecran === 'boutique' && ui.screenOpen() && boutique) boutiqueScreen() })
net.on('boutique', (m: any) => { boutique = m; boutiqueScreen() })
// un texte à lire : ouvert tout de suite, sauf s'il arrive tout seul pendant un autre écran (il reste au journal)
net.on('lecture', (m: LectureMsg) => { if (m.auto && ui.screenOpen() && ecran !== 'lecture') return ui.log(t('ui.lecture.a_relire', { titre: tx(m.titre) }), '#c9b6ff'); lectureScreen(m) })
function lectureScreen(m: LectureMsg) {
  ecran = 'lecture'
  son.joue('lecture')
  ui.showScreen(lectureHtml(m), (a) => { if (a === 'journal') journalScreen() })
}
// le robot qui danse sur la place (fx & 2, voir le serveur) : une gigue par-dessus l'animation de la scène
sceneReady.then((sc) => sc.events.on('postupdate', () => {
  net.room?.state?.robots?.forEach((r: any, id: string) => {
    const v = sc.robots.get(id)
    if (!v) return
    if (!(r.fx & 2)) { if (v.body.angle) v.body.setAngle(0).setScale(1); return }
    const t = sc.time.now / 1000
    // le saut, avec un écrasement à l'atterrissage et un étirement en l'air
    const saut = Math.abs(Math.sin(t * 6)), ecrase = saut < 0.25 ? (0.25 - saut) * 0.9 : -saut * 0.08
    v.body.setY(-4 - Math.round(saut * 4)).setAngle(Math.sin(t * 3) * 14).setFlipX(Math.sin(t * 1.5) > 0).setScale(1 + ecrase, 1 - ecrase)
  })
}))
net.on('dialogue', (m: any) => {
  if (m.fin) { if (ecran === 'dialogue') { ui.hideScreen(); ecran = '' } return }
  dialogueScreen(m)
})
net.on('concession', (m: any) => { concessionInfo = { ...concessionInfo, ...m } })
net.on('fin', (m: any) => {
  ui.showScreen(`<h2>${t('ui.fin.titre')}</h2>
    <p>${esc(concessionInfo?.contenu?.textes?.victoire ?? t('ui.fin.nettoye'))}</p>
    <p>${t('ui.fin.recompense', { ferraille: `<b style="color:#ffd36b">+${m.ferraille} ${t('ui.ferraille')}</b>`, xp: m.xp })}${m.plafonne ? `<br><span class="doux">${t('ui.fin.plafond', { n: m.plafond })}</span>` : ''}</p>
    <div class="rangee"><button class="principal" data-a="retour">${t('ui.fin.retour')}</button><button data-a="fermer">${t('ui.fin.rester')}</button></div>`, (a) => { if (a === 'retour') backToSector() })
})

/** Rejoindre une carte du graphe du monde : son salon (une copie, ouverte au besoin), sa carte, sa minicarte. */
async function joinCarte(c: CarteId, opts: any = {}) {
  const s = await sceneReady
  kind = 'secteur'
  carte = c
  map = carteMap(c)
  s.buildMap(map, 'secteur')
  minimap.setMap(map)
  lieuCourant = ''; regionCourante = ''
  // une instance : le groupe entre dans la même copie
  const groupe = CARTES[c].instance && etatSocial.groupe ? { groupe: etatSocial.groupe.id } : {}
  await net.join(CARTES[c].salon, { token, carte: c, ...groupe, ...opts }, map)
  s.net = net; s.controls = controls
  net.clamp = (b) => s.arene.clamp(b)
  watchRoom()
  document.getElementById('hud')!.classList.remove('cache')
  ui.hideScreen()
  if (c !== 'ossara') ui.placeTitle(t(`carte.${c}.nom`), t(CARTES[c].instance ? 'ui.carte.mort_definitive' : 'ui.carte.reliee'))
}
const joinSector = (opts: any = {}) => joinCarte(carte, opts)

function watchRoom() {
  net.room.onLeave((code: number) => {
    if (code === 1000 || code === 4000) return
    ui.banner(t('ui.connexion_perdue'), 0)
    setTimeout(() => location.reload(), 2500)
  })
}

async function joinConcession(cid: string, version: number) {
  const s = await sceneReady
  const data = await api(`/api/concessions/${encodeURIComponent(cid)}/${version}`)
  concessionInfo = data
  const cmap: GameMap = concessionMap(data.contenu)
  await net.leave()
  kind = 'concession'
  s.buildMap(cmap, 'concession')
  minimap.setMap(cmap)
  try { await net.join('concession', { token, cid, version }, cmap) } catch (e: any) { ui.log(t('ui.concession.entree_impossible', { e: e.message }), '#ff9b6b'); return backToSector() }

  s.net = net
  watchRoom()
  ui.hideScreen()
  ui.banner(`<b>${esc(data.contenu.nom)}</b><br><span style="font-size:12px">${esc(data.contenu.description ?? '')}</span>`, 4000)
}

async function backToSector() {
  await net.leave()
  ui.hideScreen()
  await joinCarte('ossara')
}

function monRobot() {
  let r: any = null
  net.room?.state?.robots?.forEach((x: any) => { if (x.owner === net.room.sessionId) r = x })
  return r
}

// --------------------------------------------------------------- les boutons
controls.onButton = (b) => {
  if (!net.room || ui.screenOpen()) return
  const s = scene(); const self = net.self()
  if (!self) return
  const aim = s ? lastAim : 0
  if (b === 'sk0' || b === 'sk1' || b === 'sk2') net.room.send('skill', { i: Number(b[2]), tx: pos.x + Math.cos(aim) * 100, ty: pos.y + Math.sin(aim) * 100 })
  if (b === 'talents') talentsScreen()
  if (b === 'dash' && (me?.dashCd ?? 0) <= 0) net.dash()
  if (b === 'ordre') net.room.send('ordre')
  if (b === 'monture' && kind === 'secteur') net.room.send('monture')
  if (b === 'action') doAction()
}
let lastAim = 0

document.querySelector('[data-ui="menu"]')!.addEventListener('pointerdown', (e) => { e.stopPropagation(); menuScreen() })
for (const [k, fn] of [['sac', () => sacScreen()], ['journal', () => journalScreen()], ['carte', () => carteScreen()]] as const) {
  document.querySelector(`[data-ui="${k}"]`)!.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (net.room) fn() })
}
addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement)?.tagName === 'INPUT' || !net.room) return
  const open = ui.screenOpen()
  if (e.code === 'Escape' && open) { ui.hideScreen(); ecran = '' }
  if (e.code === 'KeyI' || e.code === 'Tab') { e.preventDefault(); if (open && ecran === 'sac') ui.hideScreen(); else if (kind === 'secteur') sacScreen() }
  if (e.code === 'KeyJ') { if (open && ecran === 'journal') ui.hideScreen(); else if (kind === 'secteur') journalScreen() }
  if (e.code === 'KeyM') { if (open && ecran === 'carte') ui.hideScreen(); else carteScreen() }
  if (e.code === 'Escape' && !open) menuScreen()
})

const NOEUDS_TXT = ['herbe', 'champignon', 'pieces', 'noyau', 'echantillon']
let actionIcone = 'action'
function nearestAction(): string | null {
  if (!me || kind !== 'secteur') return null
  const st = net.room.state
  const p = map.points
  const d = (q: { x: number; y: number }) => Math.hypot(q.x - pos.x, q.y - pos.y)
  if (me.robot?.etat === 'avant-poste' && Math.hypot(me.robot.ox - pos.x, me.robot.oy - pos.y) < 30) { actionLabel = t('ui.action.reprendre_robot'); actionIcone = 'robot'; return 'reprendre' }
  // le plus proche d'abord : un habitant, une ressource, une panne
  let best: string | null = null, bd = Infinity
  st.npcs?.forEach((n: any, id: string) => {
    if (n.act === 4 || !NPC_BY_ID[id]) return
    const dd = Math.hypot(net.value(n, 'x') - pos.x, net.value(n, 'y') - pos.y)
    if (dd < 40 && dd < bd) { bd = dd; best = 'parler:' + id; actionLabel = t(`pnj.${id}.nom`); actionIcone = 'parler' }
  })
  for (const n of map.monde?.noeuds ?? []) {
    if (st.pris?.has?.(n.id)) continue
    const dd = d(n)
    if (dd < 30 && dd < bd) { bd = dd; best = 'ramasser:' + n.id; actionLabel = t(NOEUDS_TXT.includes(n.type) ? `ui.action.noeud_${n.type}` : 'ui.action.ramasser'); actionIcone = n.type === 'pieces' ? 'pieces' : 'sac' }
  }
  for (const pn of map.monde?.pannes ?? []) {
    if (st.pannes?.get?.(pn.id) === 1) continue
    const dd = d(pn)
    if (dd < 36 && dd < bd) { bd = dd; best = 'reparer:' + pn.id; actionLabel = t(pn.type === 'lampe' ? 'ui.action.reparer_lampe' : 'ui.action.reparer_balise'); actionIcone = 'surcharge' }
  }
  // ce qui se lit : stèles, plaques, journaux posés, la porte scellée
  for (const e of ENDROITS) {
    if (e.carte !== carte) continue
    const dd = Math.hypot(e.x * TILE + 8 - pos.x, e.y * TILE + 8 - pos.y)
    if (dd < LIRE_R && dd < bd) { bd = dd; best = 'lire:' + e.id; actionLabel = t(`endroit.${e.id}.label`); actionIcone = 'journal' }
  }
  if (carte === 'ossara') for (const g of STATIONS) {
    const dd = Math.hypot(g.x * TILE + 8 - pos.x, g.y * TILE + 8 - pos.y)
    if (dd < STATION_R && dd < bd) { bd = dd; best = 'gare:' + g.id; actionLabel = t(garesOuvertes().includes(g.id) ? 'ui.action.monorail' : 'ui.action.reparer_gare', { gare: t(`station.${g.id}.nom`) }); actionIcone = 'gare' }
  }
  if (best) return best
  if (carte !== 'ossara') return null
  actionIcone = 'action'
  if (d(p.atelier) < 50) { actionLabel = t('ui.action.atelier'); actionIcone = 'robot'; return 'atelier' }
  if (d(p.porte) < 44) { actionLabel = t('ui.action.concessions'); return 'concessions' }
  if (d(p.tableau) < 40) { actionLabel = t('ui.action.morts'); actionIcone = 'crane'; return 'morts' }
  return null
}
function garesOuvertes(): string[] { return me?.gares ?? STATIONS.filter((g) => g.ouverte).map((g) => g.id) }

function doAction() {
  const [k, id] = (actionKind ?? '').split(':')
  switch (k) {
    case 'reprendre': net.room.send('interact'); break
    case 'atelier': atelierScreen(); break
    case 'concessions': concessionsScreen(); break
    case 'morts': mortsScreen(); break
    case 'parler': net.room.send('parler', { id }); break
    case 'ramasser': net.room.send('ramasser', { id }); break
    case 'reparer': net.room.send('reparer', { id }); break
    case 'lire': net.room.send('lire', { id }); break
    case 'gare': gareScreen(id); break
  }
}

// --------------------------------------------------------------- quêtes : marqueurs ! et ?
function questMarker(npc: string): QuestMark | null {
  if (!me) return null
  return questMarkFor(npc, quetes.actives, quetes.faites, me.level, quetes.flags)
}
/** Où aller pour une quête en cours : le prochain objectif, sinon celui qui attend le rapport. */
function questTarget(a: { id: string; prog: number[] }): { x: number; y: number } | null {
  const q = QUEST_BY_ID[a.id]
  if (!q) return null
  // un texte à lire peut être sur une autre carte (l'épave) : on vise l'endroit s'il est ici
  const i0 = q.objectifs.findIndex((o, k) => (a.prog[k] ?? 0) < objectiveTarget(o))
  const o0 = q.objectifs[i0]
  if (!questComplete(q, a.prog) && o0?.t === 'lire') { const e = ENDROITS.find((x) => x.lecture === o0.id && x.carte === carte); if (e) return { x: e.x, y: e.y } }
  if (o0?.t === 'explorer' && carte !== 'ossara') { const pp = map.monde?.pois.find((x) => x.id === o0.lieu); if (pp) return { x: pp.x / TILE, y: pp.y / TILE } }
  if (carte !== 'ossara') return null
  // ce qui est dans l'épave : on vise son sas, au Cimetière des Machines
  const sas = PASSAGE_BY_ID.sas_constance
  if (o0 && !questComplete(q, a.prog) && ((o0.t === 'lire' && ENDROITS.find((x) => x.lecture === o0.id)?.carte === 'constance') || (o0.t === 'explorer' && CONSTANCE_LIEUX.some((l) => l.id === o0.lieu)))) return { x: sas.x, y: sas.y }
  const npcAt = (id: string) => { const n = net.room?.state?.npcs?.get(id); if (n) return { x: n.x / TILE, y: n.y / TILE }; const def = NPC_BY_ID[id]; return def ? { x: def.poste[0], y: def.poste[1] } : null }
  if (questComplete(q, a.prog)) return npcAt(q.rendre)
  const i = q.objectifs.findIndex((o, k) => (a.prog[k] ?? 0) < objectiveTarget(o))
  const o = q.objectifs[i]
  const poi = (id?: string) => { const pp = map.monde?.pois.find((x) => x.id === id); return pp ? { x: pp.x / TILE, y: pp.y / TILE } : null }
  if (o.t === 'parler') return npcAt(o.npc)
  if (o.t === 'explorer') return poi(o.lieu)
  if (o.t === 'escorte') return poi(o.vers)
  if ((o.t === 'tuer' || o.t === 'ramasser' || o.t === 'lire') && o.ou) return poi(o.ou)
  if (o.t === 'reparer') { const pn = map.monde?.pannes.find((x) => x.type === o.type && net.room.state.pannes?.get?.(x.id) !== 1); return pn ? { x: pn.x / TILE, y: pn.y / TILE } : null }
  return null
}
function questMarkers() {
  const out: { x: number; y: number; c: string; g?: string }[] = []
  for (const a of quetes.actives) { const q = QUEST_BY_ID[a.id]; if (q && questComplete(q, a.prog)) continue; const t = questTarget(a); if (t) out.push({ ...t, c: q?.principale ? '#ffd36b' : '#f0e6d0' }) }
  // les PNJ : ! à prendre, ? gris en cours, ? jaune à rendre
  net.room?.state?.npcs?.forEach((n: any, id: string) => { const mk = questMarker(id); if (mk && n.act !== 4) out.push({ x: n.x / TILE, y: n.y / TILE, c: MARK_STYLE[mk].c, g: MARK_STYLE[mk].g }) })
  return out
}
/** La quête suivie (une seule, au choix dans le journal ; localStorage heirline.quete-suivie). Par défaut : la plus
 *  récente de l'histoire principale, sinon la plus récente. */
function queteSuivie() {
  const act = quetes.actives
  if (!act.length) return null
  const choix = localStorage.getItem('heirline.quete-suivie')
  return act.find((a) => a.id === choix) ?? [...act].reverse().find((a) => QUEST_BY_ID[a.id]?.principale) ?? act[act.length - 1]
}
let suiviHtml = ''
/** Le bloc de quête à gauche : une seule ligne (« La selle — Tuer des Racleurs 2/4 »), « ? » jaune quand elle est à rendre, une
 *  pastille s'il y a d'autres quêtes à rendre ; un toucher ouvre le journal, le chevron le replie en une icône. */
function updateTracker() {
  const el = document.getElementById('suivi')!
  const a = kind === 'secteur' ? queteSuivie() : null
  let html = ''
  if (a && QUEST_BY_ID[a.id]) {
    const q = QUEST_BY_ID[a.id]
    const fini = questComplete(q, a.prog)
    const autres = quetes.actives.filter((x) => x !== a && QUEST_BY_ID[x.id] && questComplete(QUEST_BY_ID[x.id], x.prog)).length
    const i = q.objectifs.findIndex((o, k) => (a.prog[k] ?? 0) < objectiveTarget(o))
    const o = q.objectifs[i]
    const ligne = fini ? t('ui.suivi.rendre', { pnj: t(`pnj.${q.rendre}.nom`) }) : t(`quete.${q.id}.obj.${i}`)
    const compte = fini ? '' : objectiveTarget(o) > 1 ? `<span class="n">${a.prog[i] ?? 0}/${objectiveTarget(o)}</span>` : ''
    const replie = localStorage.getItem('heirline.suivi-replie') === '1'
    const marque = fini ? '<i class="marque rendre">?</i>' : `<i class="marque${q.principale ? ' principale' : ''}">!</i>`
    const pastille = autres ? `<i class="pastille" title="${t('ui.suivi.autres')}">${autres}</i>` : ''
    html = replie
      ? `<div class="quete-suivie replie" data-s="ouvrir">${marque}${pastille}</div>`
      : `<div class="quete-suivie${q.principale ? ' principale' : ''}${fini ? ' fini' : ''}" data-s="journal">${marque}<span class="l"><b>${esc(t(`quete.${q.id}.nom`))}</b> — ${esc(ligne)}</span>${compte}${pastille}<i class="replier" data-s="replier">‹</i></div>`
  }
  if (html === suiviHtml) return
  suiviHtml = html
  el.innerHTML = html
}
document.getElementById('suivi')!.addEventListener('pointerdown', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-s]')
  if (!t) return
  e.stopPropagation(); e.preventDefault()
  if (t.dataset.s === 'replier') localStorage.setItem('heirline.suivi-replie', '1')
  else if (t.dataset.s === 'ouvrir') localStorage.setItem('heirline.suivi-replie', '0')
  else if (t.dataset.s === 'journal' && kind === 'secteur') journalScreen()
  suiviHtml = ''; updateTracker()
})

// --------------------------------------------------------------- les écrans
function titleScreen() {
  son.musique('titre')
  ui.showScreen(`<div class="titre"><h1>HEIRLINE</h1><div class="sous">${t('ui.titre.sous')}</div>
    <p>${t('ui.titre.p1')}</p>
    <p class="doux">${t('ui.titre.p2')}</p>
    <div class="rangee" style="justify-content:center"><label>${t('ui.titre.famille')} <input id="famille" maxlength="20" placeholder="${t('ui.titre.au_hasard')}" autocomplete="off"></label></div>
    <div class="rangee" style="justify-content:center"><button class="principal" data-a="entrer">${t('ui.titre.entrer')}</button></div>
    <div class="rangee" style="justify-content:center"><button class="petit" data-a="langue">${t('ui.menu.langue', { langue: t('ui.menu.langue_nom') })}</button></div></div>`, async (a) => {
    if (a === 'langue') return changerLangue()
    if (a !== 'entrer') return
    const f = (document.getElementById('famille') as HTMLInputElement).value.trim()
    const r = await api('/api/invite', { famille: f })
    token = r.token; localStorage.setItem(KEY, token)
    await start()
  })
}

function classScreen(lignee: any[]) {
  son.musique('titre')
  const last = lignee[lignee.length - 1]
  let cls: ClassId | null = null
  const render = () => ui.showScreen(`${entete(t(last ? 'ui.classe.heritier' : 'ui.classe.premier'), 'crane', false)}
    <p class="doux">${last ? `${t('ui.classe.tombe', { nom: esc(last.prenom) })}${last.mort?.killer ? ` (${esc(last.mort.killer)})` : ''}. ${t('ui.classe.part_du', { n: Math.max(1, Math.floor(last.niveau / 2)) })}` : t('ui.classe.choisis')}</p>
    ${ui.classPicker(cls, portraits)}
    <div class="rangee collant"><button class="principal" data-a="go" ${cls ? '' : 'disabled'}>${t('ui.classe.partir')}</button></div>`, async (a, el) => {
    if (a === 'classe') { cls = el.dataset.cls as ClassId; render() }
    if (a === 'go' && cls) { try { await joinSector({ cls }) } catch (e: any) { ui.log(e.message, '#ff9b6b') } }
  })
  render()
}

function releveScreen(m: any) {
  let cls: ClassId | null = null
  const render = () => ui.showScreen(`${entete(t('ui.releve.titre'), 'crane', false)}
    <div class="plaque-id"><div class="tag-metal"><b>${esc(m.given)} ${esc(m.family)}</b>${t('ui.gen_niv', { g: m.generation, n: m.level })}<br>† ${esc(m.killer ? tx(m.killer) : t('srv.tueur.eden'))}</div>
    <div><p class="mort">${t('ui.releve.definitif')}</p>
    <p>${m.robot ? t('ui.releve.robot', { avant_poste: `<span class="chaud">${t('ui.releve.avant_poste')}</span>` }) : t('ui.releve.sans_robot')}</p></div></div>
    <p class="doux">${t('ui.releve.heritier', { famille: esc(m.family), n: m.heritierNiveau })}</p>
    ${ui.classPicker(cls, portraits, true)}
    <div class="rangee collant"><button class="principal" data-a="go" ${cls ? '' : 'disabled'}>${t('ui.releve.prendre')}</button></div>`, (a, el) => {
    if (a === 'classe') { cls = el.dataset.cls as ClassId; render() }
    if (a === 'go' && cls) { net.room.send('releve', { cls }); ui.hideScreen(); ui.hideBanner() }
  })
  render()
}

function atelierScreen() {
  const r = me?.robot
  if (!r) return
  const etat: Record<string, string> = { avec: t('ui.atelier.avec'), atelier: t('ui.atelier.repare'), 'avant-poste': t('ui.atelier.avant_poste'), aucun: t('ui.atelier.aucun') }
  const robotImg = (() => { const t = game.textures.exists('robot') ? game.textures.get('robot').getSourceImage() as HTMLCanvasElement : null; if (!t) return ''; const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.getContext('2d')!.drawImage(t, 0, 0, 16, 16, 0, 0, 16, 16); return c.toDataURL() })()
  ui.showScreen(`${entete(t('ui.atelier.titre'), 'robot')}
    <div class="atelier"><div class="robot-vue cadre crt"><img src="${robotImg}" alt=""></div>
    <div><p>${t('ui.atelier.niveau', { n: `<span class="chaud">${r.level}</span>`, max: r.max })} · ${etat[r.etat] ?? ''}</p>
    <div class="crans">${Array.from({ length: r.max }, (_, i) => `<i class="${i < r.level ? 'on' : ''}"></i>`).join('')}</div>
    <p><span class="ferraille">${ico('ferraille', 'ico p')} ${me.banque}</span> ${t('ui.atelier.a_l_abri')}${me.sac ? t('ui.atelier.au_sac_long', { n: me.sac }) : ''}.</p>
    <p>${me.selle ? `${ico('monture', 'ico p')} ${t('ui.atelier.selle', { v: MONTURE.vitesse })}` : `<span class="doux">${t('ui.atelier.sans_selle', { n: MONTURE.niveauQuete })}</span>`}</p>
    <div class="rangee">
      ${r.level < r.max ? `<button class="principal" data-a="up">${t('ui.atelier.ameliorer')} · ${r.cout} ${ico('ferraille', 'ico p')}</button>` : ''}
      ${r.etat === 'atelier' ? `<button data-a="prendre">${t('ui.action.reprendre_robot')}</button>` : ''}
    </div></div></div>
    <p class="doux">${t('ui.atelier.note')}</p><p class="doux">${t('ui.atelier.eden')}</p>`, (a) => {
    if (a === 'up') { net.room.send('upgrade'); setTimeout(atelierScreen, 300) }
    if (a === 'prendre') { net.room.send('interact'); ui.hideScreen() }
  })
}

/** Une gare du monorail de la Première Vague : la réparer, ou partir vers une gare ouverte. */
function gareScreen(id: string) {
  const g = STATION_BY_ID[id]
  if (!g) return
  ecran = 'gare'
  const ouvertes = garesOuvertes()
  const ici = ouvertes.includes(id)
  const lignes = STATIONS.filter((x) => x.id !== id).map((x) => {
    const ok = ouvertes.includes(x.id)
    return `<div class="item gare">${ico('gare', 'ico p')}<span class="nom-gare">${esc(t(`station.${x.id}.nom`))}<small>${t(ok ? 'ui.gare.en_service' : 'ui.gare.hors_service')}</small></span>${ok && ici ? `<button class="petit principal" data-a="partir" data-id="${x.id}">${t('ui.gare.partir')}</button>` : `<span class="puce ${ok ? 'p-vert' : ''}">${t(ok ? 'ui.gare.ouverte' : 'ui.gare.fermee')}</span>`}</div>`
  }).join('')
  ui.showScreen(`${entete(esc(t(`station.${g.id}.nom`)), 'gare')}
    ${ici ? `<p>${t('ui.gare.ici')}</p>` : `<p>${t('ui.gare.a_reparer', { pieces: `<span class="chaud">${t('ui.gare.n_pieces', { n: STATION_COUT.pieces })}</span>`, ferraille: `<span class="chaud">${STATION_COUT.ferraille} ${t('ui.ferraille')}</span>` })}</p><div class="rangee"><button class="principal" data-a="reparer">${t('ui.gare.reparer')}</button></div>`}
    <h3>${t('ui.gare.la_ligne')}</h3><div class="liste">${lignes}</div>`, (a, el) => {
    if (a === 'reparer') { net.room.send('station', { id }); setTimeout(() => gareScreen(id), 400) }
    if (a === 'partir') { net.room.send('station', { id, vers: el.dataset.id }); ui.hideScreen() }
  })
}

async function concessionsScreen() {
  const list = await api('/api/concessions').catch(() => [])
  ui.showScreen(`${entete(t('ui.concession.titre'), 'carte')}
    <p class="doux">${t('ui.concession.intro')}</p>
    <div class="liste">${list.length ? list.map((c: any) => `<div class="item"><div><b class="chaud">${esc(c.nom)}</b> <span class="doux">v${c.version}</span><small>${t('ui.concession.ligne', { qui: esc(c.createur), n: c.parties, ferraille: c.recompense.ferraille, d: esc(c.recompense.difficulte) })}</small></div><button class="principal" data-a="jouer" data-id="${esc(c.id)}" data-v="${c.version}">${t('ui.concession.entrer')}</button></div>`).join('') : `<p>${t('ui.concession.aucune')}</p>`}</div>`, (a, el) => {
    if (a === 'jouer') joinConcession(el.dataset.id!, Number(el.dataset.v))
  })
}

async function mortsScreen() {
  const list = await api('/api/morts').catch(() => [])
  ui.showScreen(`${entete(t('ui.action.morts'), 'crane')}
    <div class="liste">${list.length ? list.map((d: any) => `<div class="item"><div><b class="mort">${esc(d.given)} ${esc(d.family)}</b> <span class="doux">${t('ui.gen_niv_court', { g: d.generation, n: d.level })} · ${esc(CLASSES[d.cls as ClassId] ? t(`classe.${d.cls}.nom`) : d.cls)}</span><small>${esc(d.killer ? tx(lireCause(d.killer)) : t('srv.tueur.eden'))} · ${new Date(d.at).toLocaleString(lang() === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' })}</small></div></div>`).join('') : `<p>${t('ui.morts.personne')}</p>`}</div>`)
}

async function ligneeScreen() {
  const m = await api('/api/moi')
  ui.showScreen(`${entete(t('ui.lignee.titre', { famille: esc(m.famille) }), 'crane')}
    <div class="liste">${m.lignee.map((s: any) => `<div class="item"><div><b class="${s.vivant ? 'chaud' : 'mort'}">${s.vivant ? '' : '† '}${esc(s.prenom)}</b> <span class="doux">${t('ui.gen_cls_niv', { g: s.generation, cls: esc(s.classe), n: s.niveau })}</span><small>${s.vivant ? t('ui.lignee.en_vie') : `${t('ui.lignee.mort')}${s.mort?.killer ? ` — ${esc(s.mort.killer)}` : ''}`}</small></div></div>`).join('')}</div>`)
}

async function cleScreen() {
  ui.showScreen(`${entete(t('ui.cle.titre'), 'menu')}
    <p>${t('ui.cle.intro')}</p>
    <div class="rangee"><button class="principal" data-a="gen">${t('ui.cle.creer')}</button></div><div id="cle-res"></div>`, async (a) => {
    if (a !== 'gen') return
    const r = await api('/api/cle', {})
    document.getElementById('cle-res')!.innerHTML = `<p>${t('ui.cle.cle')}</p><pre class="cle">${esc(r.cle)}</pre>
      <p>${t('ui.cle.terminal')}</p><pre class="cle">${esc(r.commande)}</pre>
      <p class="doux">${t('ui.cle.mcp', { url: esc(r.mcp) })}</p>
      <div class="rangee"><button data-a="copier">${t('ui.cle.copier')}</button></div>`
    ;(document.querySelector('[data-a="copier"]') as HTMLElement).onclick = () => navigator.clipboard?.writeText(r.commande).then(() => ui.log(t('ui.cle.copiee'), '#9be37a'))

  })
}

// --------------------------------------------------------------- le monde ouvert : dialogue, sac, boutique, journal, carte
const portraitCache = new Map<string, string>()
function npcPortrait(id: string) {
  const hit = portraitCache.get(id)
  if (hit) return hit
  const tex = game.textures.exists('pnj_' + id) ? game.textures.get('pnj_' + id) : null
  if (!tex) return ''
  const src = tex.getSourceImage() as HTMLCanvasElement
  const fw = 16, fh = src.height
  const c = document.createElement('canvas'); c.width = fw; c.height = fh
  c.getContext('2d')!.drawImage(src, 0, 0, fw, fh, 0, 0, fw, fh)
  const url = c.toDataURL()
  portraitCache.set(id, url)
  return url
}

/** Les récompenses d'une quête, en petites plaques (XP, ferraille, objets, selle). */
function recompensesHtml(r: Recompense) {
  const out: string[] = []
  if (r.xp) out.push(`<span class="recompense">${ico('xp', 'ico p')}${r.xp} XP</span>`)
  if (r.ferraille) out.push(`<span class="recompense">${ico('ferraille', 'ico p')}${r.ferraille}</span>`)
  if (r.objet) out.push(`<span class="recompense">${ico('sac', 'ico p')}${t(`objet.${r.objet.b}.nom`)}</span>`)
  for (const it of r.items ?? []) out.push(`<span class="recompense">${ico('sac', 'ico p')}${esc(BASES[it.b] ? t(`objet.${it.b}.nom`) : it.b)}${it.n > 1 ? ` ×${it.n}` : ''}</span>`)
  if (r.flag?.[0] === 'selle') out.push(`<span class="recompense">${ico('monture', 'ico p')}${t('ui.recompense.selle')}</span>`)
  return out.length ? `<div class="recompenses"><span class="lbl">${t('ui.recompense.titre')}</span>${out.join('')}</div>` : ''
}

function dialogueScreen(d: any) {
  ecran = 'dialogue'
  const opts = d.options.map((o: any) => {
    const k = o.id.split(':')[0]
    const cls = k === 'rendre' ? 'opt rendre' : k === 'voir' || k === 'accepter' ? 'opt quete' : k === 'info' ? 'opt encours' : k.startsWith('choix') ? 'opt choix' : o.id === 'bye' ? 'opt bye' : 'opt'
    const icon = k === 'rendre' || k === 'voir' || k === 'accepter' ? 'quete' : k === 'info' ? 'journal' : k === 'boutique' ? 'ferraille' : k === 'escorte' ? 'esquive' : o.id === 'bye' ? 'fermer' : 'parler'
    const label = tx(o.label).replace(/^[!?…] /, '')
    return `<button class="${cls}" data-a="o" data-o="${esc(o.id)}">${ico(icon, 'ico p')}<span>${esc(label)}</span></button>`
  }).join('')
  // la quête dont on parle : ses récompenses
  const qid = d.options.map((o: any) => o.id.split(':')).find(([k]: string[]) => k === 'accepter' || k === 'rendre' || k.startsWith('choix'))?.[1]
  const q = qid ? QUEST_BY_ID[qid] : null
  const f = factionOf(d.npc)
  ui.showScreen(`<div class="dialogue"><div class="portrait cadre crt"><img src="${npcPortrait(d.npc)}" alt=""></div>
    <div class="dialogue-txt"><div class="qui"><h2>${esc(tx(d.nom))}</h2><span class="puce ${f.couleur ? 'p-' + f.couleur : ''}">${esc(t(`faction.${f.id}.nom`))}</span></div>
    ${d.titre ? `<div class="role">${esc(tx(d.titre))}</div>` : ''}
    <p class="dit">${esc(tx(d.texte)).replace(/\n/g, '<br>')}</p>${q ? recompensesHtml(q.recompense) : ''}</div>
    <div class="options">${opts}</div></div>`, (a, el) => {
    if (a !== 'o') return
    if (el.dataset.o === 'bye') { ui.hideScreen(); ecran = ''; return }
    net.room.send('choix', { id: d.npc, o: el.dataset.o })
  }, { bas: true })
}

function icon(it: Item) { return itemIcon(scene(), it.b, it.c) }
function statsTxt() {
  const st = totalStats(sac.equip)
  const l = (Object.keys(STAT_NOMS) as (keyof typeof STAT_NOMS)[]).filter((k) => (st as any)[k]).map((k) => `+${(st as any)[k]}${t(`stat.${k}`)}`)
  return l.length ? l.join(' · ') : t('ui.sac.aucun_bonus')
}
const SLOT_NOM: Record<Slot, string> = { arme: 'objet.arme.nom', casque: 'objet.casque.nom', armure: 'objet.armure.nom', gants: 'objet.gants.nom', bottes: 'objet.bottes.nom', module1: 'objet.module.nom', module2: 'objet.module.nom', chassis: 'ui.sac.robot_chassis', canon: 'ui.sac.robot_canon' }

function sacScreen() {
  ecran = 'sac'
  const eq = SLOTS.map((sl) => {
    const it = sac.equip[sl]
    return `<div class="emplacement" data-a="voir" data-u="eq:${sl}">${ui.caseHtml(it, it ? icon(it) : '', `data-a="voir" data-u="eq:${sl}"`, sacChoisi === 'eq:' + sl)}<span class="lbl">${t(SLOT_NOM[sl])}</span></div>`
  }).join('')
  const cases = sac.inv.map((it) => ui.caseHtml(it, icon(it), `data-a="voir" data-u="${it.u}"`, sacChoisi === it.u)).join('')
  const vides = Array.from({ length: Math.max(0, INV_MAX - sac.inv.length) }, () => '<div class="case vide"></div>').join('')
  // la fiche de l'objet choisi, et ce qu'on peut en faire
  let fiche = `<div class="fiche"><small>${t('ui.sac.touche')}</small></div>`
  if (sacChoisi.startsWith('eq:')) {
    const sl = sacChoisi.slice(3) as Slot, it = sac.equip[sl]
    if (it) fiche = ui.ficheHtml(it, `<div class="rangee"><button class="petit" data-a="retirer" data-s="${sl}">${t('ui.sac.retirer')}</button></div>`, sac.equip)
  } else if (sacChoisi) {
    const it = sac.inv.find((x) => x.u === sacChoisi)
    if (it) {
      const b = BASES[it.b]
      const sl = slotsFor(it)
      const btns = sl.length ? `<button class="petit principal" data-a="equiper" data-u="${it.u}">${t('ui.sac.equiper')}</button>` : b?.type === 'soin' ? `<button class="petit principal" data-a="utiliser" data-u="${it.u}">${t('ui.sac.utiliser')}</button>` : ''
      const g = recyclage(it)
      const recycler = isEquip(it) ? `<button class="petit" data-a="recycler" data-u="${it.u}">${t('ui.sac.recycler', { n: g.ferraille, p: g.pieces })}</button>` : ''
      // la comparaison avec ce qui est porté au même endroit (le premier module vide, sinon le premier)
      const porte = sl.length ? sac.equip[sl.find((x) => !sac.equip[x]) ?? sl[0]] : undefined
      fiche = ui.ficheHtml(it, `${sl.length ? ui.compareHtml(it, porte) : ''}<div class="rangee">${btns}${recycler}${b?.type !== 'quete' ? `<button class="petit danger" data-a="jeter" data-u="${it.u}">${t('ui.sac.jeter')}</button>` : ''}</div>`, sac.equip)
    }
  }
  ui.showScreen(`${entete(`${t('ui.sac.titre')} <small>${sac.inv.length} / ${INV_MAX}</small>`, 'sac')}
    <div class="sac"><div><div class="poupee">${eq}</div>
      <p class="doux">${statsTxt()}<br><span class="ferraille">${ico('ferraille', 'ico p')} ${me?.banque ?? 0}</span> ${t('ui.atelier.a_l_abri')}${me?.sac ? t('ui.sac.au_sac', { n: me.sac }) : ''}</p></div>
    <div><div class="grille-objets">${cases}${vides}</div>${fiche}</div></div>`, (a, el) => {
    if (a === 'voir') { sacChoisi = el.dataset.u ?? ''; sacScreen() }
    if (a === 'equiper') { net.room.send('equiper', { u: el.dataset.u }); sacChoisi = '' }
    if (a === 'retirer') { net.room.send('retirer', { slot: el.dataset.s }); sacChoisi = '' }
    if (a === 'utiliser') net.room.send('utiliser', { u: el.dataset.u })
    if (a === 'jeter') { net.room.send('jeter', { u: el.dataset.u }); sacChoisi = '' }
    if (a === 'recycler') { net.room.send('recycler', { u: el.dataset.u }); sacChoisi = '' }
  })
}

function boutiqueScreen() {
  if (!boutique) return
  ecran = 'boutique'
  const b = boutique
  const prix = (n: number, signe = '') => `<span class="prix">${signe}${n}${ico('ferraille', 'ico p')}</span>`
  const vend = b.vend.map((o: any, i: number) => ui.itemHtml(o.it, icon(o.it), `<button class="petit principal" data-a="acheter" data-i="${i}" ${o.prix > (b.banque ?? 0) ? 'disabled' : ''}>${prix(o.prix)}</button>`)).join('')
  const achete = (it: Item) => BASES[it.b]?.type !== 'quete' && (b.achete === 'tout' || b.achete.includes(it.b))
  const mien = sac.inv.filter(achete).map((it) => ui.itemHtml(it, icon(it), `<button class="petit" data-a="vendre" data-u="${it.u}">${prix(sellValue(it), '+')}</button>`)).join('')
  const pnj = NPC_BY_ID[b.npc] ? t(`pnj.${b.npc}.nom`) : ''
  ui.showScreen(`${entete(`${esc(tx(b.nom))} <small>${esc(pnj)}</small>`, 'ferraille')}
    <p class="doux">${t('ui.boutique.banque', { n: `<span class="ferraille">${ico('ferraille', 'ico p')} ${b.banque}</span>` })}</p>
    <div class="deux-col"><div><h3>${t('ui.boutique.a_vendre')}</h3><div class="objets">${vend}</div></div>
    <div><h3>${t('ui.boutique.rachete', { pnj: esc(pnj) })}</h3><div class="objets">${mien || `<p class="doux">${t('ui.boutique.rien')}</p>`}</div></div></div>`, (a, el) => {
    if (a === 'acheter') net.room.send('acheter', { i: Number(el.dataset.i) })
    if (a === 'vendre') net.room.send('vendre', { u: el.dataset.u })
  })
}

function journalScreen() {
  ecran = 'journal'
  const ligne = (a: { id: string; prog: number[] }) => {
    const q = QUEST_BY_ID[a.id]
    if (!q) return ''
    const fini = questComplete(q, a.prog)
    const objs = q.objectifs.map((o, i) => { const ok = (a.prog[i] ?? 0) >= objectiveTarget(o); return `<li class="${ok ? 'ok' : ''}">${ok ? '✔' : '•'} ${esc(t(`quete.${q.id}.obj.${i}`))}${objectiveTarget(o) > 1 ? ` <span>${a.prog[i] ?? 0}/${objectiveTarget(o)}</span>` : ''}</li>` }).join('')
    const suivie = queteSuivie()?.id === a.id
    return `<div class="quete${q.principale ? ' principale' : ''}"><div class="titre-q">${ico(fini ? 'quete' : q.principale ? 'xp' : 'journal', 'ico p')}<b>${esc(t(`quete.${q.id}.nom`))}</b><span class="puce">${t('ui.niv', { n: q.niveau })}</span><span class="puce p-vert">${esc(zoneDef(q.zone) ? t(`region.${q.zone}.nom`) : q.zone)}</span>${suivie ? `<span class="puce p-suivie">${t('ui.journal.suivie')}</span>` : `<button class="petit" data-a="suivre" data-id="${a.id}">${t('ui.journal.suivre')}</button>`}</div>
      <ul>${objs}</ul>${fini ? `<small class="fini">${t('ui.journal.terminee', { pnj: esc(t(`pnj.${q.rendre}.nom`)) })}</small>` : `<small class="doux">${t('ui.journal.donnee', { pnj: esc(t(`pnj.${q.donneur}.nom`)) })}</small>`}${recompensesHtml(q.recompense)}</div>`
  }
  const done = new Set(quetes.faites), active = new Set(quetes.actives.map((a) => a.id))
  const dispo = QUESTS.filter((q) => questAvailable(q, done, active, me?.level ?? 1, quetes.flags))
  const c = quetes.choix
  const tot = c.colonie + c.fertiles
  ui.showScreen(`${entete(`${t('ui.journal.titre')} <small>${t('ui.journal.terminees', { n: quetes.faites.length, total: QUESTS.length })}</small>`, 'journal')}
    ${lecturesHtml(quetes.flags) ? `<div class="rangee vers-lectures"><button class="petit" data-a="lectures">${ico('journal', 'ico p')} ${t('ui.journal.lectures', { n: LECTURES.filter((l) => quetes.flags['lu_' + l.id] === '1').length })} ▼</button></div>` : ''}
    ${quetes.actives.length ? quetes.actives.map(ligne).join('') : `<p class="doux">${t('ui.journal.aucune')}</p>`}
    ${dispo.length ? `<h3>${t('ui.journal.on_t_attend')}</h3><div class="dispo">${dispo.map((q) => `<span class="recompense">${ico('quete', 'ico p')}${esc(t(`quete.${q.id}.nom`))} <span class="doux">· ${esc(t(`pnj.${q.donneur}.nom`))}</span></span>`).join('')}</div>` : ''}
    <h3>${t('lieu.hauteseve.nom')}</h3>
    <p class="doux">${t(quetes.flags.choix === 'colonie' ? 'ui.journal.choix_colonie' : quetes.flags.choix === 'fertiles' ? 'ui.journal.choix_fertiles' : 'ui.journal.choix_aucun')}
    ${tot ? `<br>${t('ui.journal.choix_ossara', { livre: t('ui.journal.n_livre', { n: c.colonie }), protege: t('ui.journal.n_protege', { n: c.fertiles }) })}` : ''}</p>
    ${lecturesHtml(quetes.flags)}`, (a, el) => { if (a === 'suivre' && el.dataset.id) { localStorage.setItem('heirline.quete-suivie', el.dataset.id); localStorage.setItem('heirline.suivi-replie', '0'); suiviHtml = ''; journalScreen(); return } if (a === 'lectures') document.getElementById('lectures')?.scrollIntoView({ behavior: 'smooth' }); if (a === 'relire' && el.dataset.id && LECTURE_BY_ID[el.dataset.id]) net.room.send('relire', { id: el.dataset.id }) })
}

function carteScreen() {
  ecran = 'carte'
  const titre = kind === 'concession' ? t('ui.carte.concession') : t(`carte.${carte}.nom`)
  const leg = (c: string, k: string) => `<span><i style="background:${c}"></i>${t(`ui.carte.${k}`)}</span>`
  ui.showScreen(`${entete(titre, 'carte')}
    <div class="grande-carte cadre crt"><canvas id="grande-carte"></canvas></div>
    <div class="legende">${leg('#fff', 'toi')}${leg('#ffd36b', 'soldats')}${leg('#9fc3d9', 'soldats_ia')}${leg('#e8f0c0', 'habitants')}${leg('#c060e0', 'biomasse')}${leg('#7fd6ff', 'avant_postes')}${leg('#ff9b3d', 'sas')}${carte === 'ossara' ? '<span>' + ico('gare', 'ico p') + ` ${t('ui.carte.gares')}</span>` : ''}</div>`)
  minimap.garesOuv = garesOuvertes()
  minimap.full(document.getElementById('grande-carte') as HTMLCanvasElement, net.room.state, net.room.sessionId, kind === 'secteur' ? questMarkers() : [], garesOuvertes())
  const gc = document.querySelector('.grande-carte') as HTMLElement
  // centrer sur le soldat
  const cv = document.getElementById('grande-carte') as HTMLCanvasElement
  const k = cv.width / (kind === 'secteur' ? map.w : cv.width)
  gc.scrollLeft = pos.x / TILE * k - gc.clientWidth / 2
  gc.scrollTop = pos.y / TILE * k - gc.clientHeight / 2
  // un nom à cheval sur le bord haut ou bas de la vue : la vue glisse pour le montrer en entier
  const haut = gc.scrollTop, bas = haut + gc.clientHeight
  const coupeH = minimap.noms.filter((b) => b.y0 < haut && b.y1 > haut).reduce((m, b) => Math.min(m, b.y0 - 4), haut)
  if (coupeH < haut) gc.scrollTop = coupeH
  else { const coupeB = minimap.noms.filter((b) => b.y0 < bas && b.y1 > bas).reduce((m, b) => Math.max(m, b.y1 + 4), bas); if (coupeB > bas) gc.scrollTop = haut + coupeB - bas }
}

const codeTest = (() => {
  const q = new URLSearchParams(location.search).get('test')
  if (q) localStorage.setItem('heirline.test', q)
  return q ?? localStorage.getItem('heirline.test')
})()
// sur le Wi-Fi de la maison (adresse 192.168…), les outils de test sont là sans code
const testLocal = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname)

function bossScreen() {
  ui.showScreen(`${entete(t('ui.test.titre'), 'crane')}
    <div class="liste">
      ${Object.entries(BOSS_TEST).map(([id, b]) => `<button data-a="${id}">${esc(t(`bosstest.${id}.nom`))} — ${t('ui.niv', { n: b.niveau })} <span class="doux">(${esc(t(`bosstest.${id}.lieu`))})</span></button>`).join('')}
      <p class="doux">${t('ui.test.note')}</p>
      <h3>${t('ui.test.entrees')}</h3>
      ${Object.entries(ENTREES_TEST).map(([id, e]) => `<button data-a="entree:${id}">${esc(t(`carte.${e.carte}.nom`))} — ${t('ui.niv', { n: e.niveau })}</button>`).join('')}
      <h3>${t('ui.test.regions')}</h3>
      ${REGIONS.map((r) => `<button data-a="region:${r.id}">${esc(t(`region.${r.id}.nom`))} — ${t('ui.niv', { n: niveauRegionTest(r.niveau) })}</button>`).join('')}
      <h3>${t('ui.test.autres')}</h3>
      <button data-a="constance">${t('ui.test.constance')}</button>
      <button data-a="cantor">${t('ui.test.cantor')}</button>
      <button data-a="tertre">${t('lieu.tertre.nom')}</button>
      <button data-a="passerelle">${t('ui.test.passerelle')}</button>
      <button data-a="port">${t('ui.test.port')}</button>
    </div>`, (a) => {
    if ((a in BOSS_TEST || a.startsWith('entree:') || a.startsWith('region:') || ['constance', 'cantor', 'tertre', 'passerelle', 'port'].includes(a)) && net.room) { net.room.send('voyage', { code: codeTest, dest: a }); ui.hideScreen() }
  })
}

/** les réglages du son : quatre volumes et la coupure, enregistrés sur l'appareil */
function sonScreen() {
  ui.showScreen(ecranSonHtml(entete(t('ui.son.titre'), 'son')), (a) => { if (actionSon(a)) sonScreen() })
}
// ------------------------------------------------------------------ les talents
let talentsVus = ''
let ongletTalents: 'classe' | 'spec' | 'maitrise' = 'classe'
/** Quelque chose à faire dans l'écran des talents : des points à placer, une spécialité ou une maîtrise à choisir. */
function aChoisir(m: any) {
  const tl: Talents | undefined = m?.talents
  if (!tl) return false
  const cls = m.soldat.cls as ClassId
  return m.points > 0 || (!tl.spec && specsDe(cls).some((s) => !peutSpecialiser(cls, m.level, tl, s.id))) || (!!tl.spec && !tl.maitrise && m.level >= NIVEAU_MAITRISE)
}
/** « +2 % de dégâts » : ce que donne un rang (ou une maîtrise), lisible. */
function modsTxt(mods: Record<string, number> | undefined, n = 1) {
  return MOD_KEYS.filter((k) => mods?.[k]).map((k) => t(`ui.talents.mod.${k}`, { v: Math.round(mods![k] * n * 10) / 10 })).join(' · ')
}
function talentsScreen() {
  if (!me?.talents) return
  ecran = 'talents'
  const tl: Talents = me.talents, cls = me.soldat.cls as ClassId, lv = me.level as number
  if (ongletTalents !== 'classe' && !tl.spec) ongletTalents = 'spec'
  const arbreHtml = (arbre: string) => [0, 1, 2].map((pal) => {
    const ouvert = pointsArbre(tl, arbre) >= PALIER_POINTS[pal]
    const cartes = talentsDe(arbre).filter((d) => d.palier === pal).map((d) => {
      const r = tl.r[d.id] ?? 0, non = peutPrendre(cls, lv, tl, d.id)
      const pips = Array.from({ length: RANG_MAX }, (_, i) => `<i class="${i < r ? 'plein' : ''}"></i>`).join('')
      return `<button class="talent ${r ? 'pris' : ''} ${non ? 'non' : ''}" data-a="t:${d.id}" title="${esc(non ? t(non) : '')}">
        <b>${esc(t(`talent.${d.arbre}.${d.id.split('.')[1]}`))}</b><span class="pips">${pips}</span><small>${esc(modsTxt(d.rang as Record<string, number>))} ${t('ui.talents.par_rang')}</small></button>`
    }).join('')
    return `<div class="palier ${ouvert ? '' : 'ferme'}"><div class="palier-t">${ouvert ? t('ui.talents.palier', { n: pal + 1 }) : t('ui.talents.palier_pts', { n: PALIER_POINTS[pal] })}</div>${cartes}</div>`
  }).join('')
  const choix = (a: string, id: string, nom: string, desc: string, extra: string, non: string | null) =>
    `<button class="choix-talent ${non ? 'non' : ''}" data-a="${a}:${id}"><b>${esc(nom)}</b><small>${esc(desc)}</small>${extra}${non ? `<em>${esc(non === 'ui.talents.trop_tot' ? t('ui.talents.niveau_requis', { n: a === 's' ? niveauSpecialite(tl, id) : NIVEAU_MAITRISE }) : t(non))}</em>` : `<em class="ok">${t('ui.talents.choisir')}</em>`}</button>`
  let corps = ''
  if (ongletTalents === 'classe') corps = `<div class="arbre">${arbreHtml(cls)}</div>`
  else if (ongletTalents === 'spec') {
    if (tl.spec) corps = `<p class="doux">${esc(t(`specialite.${tl.spec}.desc`))} · ${ico(ICONE_COMP_SPEC(tl.spec))} <b>${esc(t(`competence.${SPEC_BY_ID[tl.spec].competence}.nom`))}</b></p><div class="arbre">${arbreHtml(tl.spec)}</div>`
    else corps = `<p class="doux">${t('ui.talents.spec_note', { n: niveauSpecialite(tl) })}</p><div class="choix-2">${specsDe(cls).map((s) => choix('s', s.id, t(`specialite.${s.id}.nom`), t(`specialite.${s.id}.desc`),
      `<span class="comp-spec">${ico(ICONE_COMP_SPEC(s.id))} <b>${esc(t(`competence.${s.competence}.nom`))}</b> — ${esc(t(`competence.${s.competence}.desc`))}</span>${tl.herite === s.id ? `<span class="herite">${t('ui.talents.herite')}</span>` : ''}`, peutSpecialiser(cls, lv, tl, s.id))).join('')}</div>`
  } else {
    if (!tl.spec) corps = `<p class="doux">${t('ui.talents.maitrise_sans_spec')}</p>`
    else if (tl.maitrise) { const m = MAITRISE_BY_ID[tl.maitrise]; corps = `<div class="choix-2"><div class="choix-talent pris"><b>${esc(t(`maitrise.${m.id}.nom`))}</b><small>${esc(t(`maitrise.${m.id}.desc`))}</small></div></div>` }
    else corps = `<p class="doux">${t('ui.talents.maitrise_note', { n: NIVEAU_MAITRISE })}</p><div class="choix-2">${maitrisesDe(tl.spec).map((m) => choix('m', m.id, t(`maitrise.${m.id}.nom`), t(`maitrise.${m.id}.desc`), '', peutMaitriser(lv, tl, m.id))).join('')}</div>`
  }
  const onglet = (id: typeof ongletTalents, label: string) => `<button class="${ongletTalents === id ? 'actif' : ''}" data-a="o:${id}">${label}</button>`
  const nomSpec = tl.spec ? t(`specialite.${tl.spec}.nom`) : t('ui.talents.specialite')
  ui.showScreen(`${entete(t('ui.talents.titre'), 'talents')}
    <div class="talents-haut"><span class="${me.points > 0 ? 'chaud' : 'doux'}">${t('ui.talents.points', { n: me.points })}</span>
      <span class="onglets">${onglet('classe', t(`classe.${cls}.nom`))}${onglet('spec', nomSpec)}${onglet('maitrise', tl.maitrise ? t(`maitrise.${tl.maitrise}.nom`) : t('ui.talents.maitrise'))}</span>
      <button class="petit raz" data-a="raz" title="${t('ui.talents.raz_t')}">${me.test ? t('ui.talents.raz_test') : `${t('ui.talents.raz', { n: me.coutRaz })} ${ico('ferraille')}`}</button></div>
    ${corps}`, (a) => {
    const [k, id] = a.split(/:(.*)/)
    if (k === 'o') { ongletTalents = id as typeof ongletTalents; talentsScreen() }
    if (k === 't') net.room?.send('talent', { id })
    if (k === 's') net.room?.send('specialite', { id })
    if (k === 'm') net.room?.send('maitrise', { id })
    if (a === 'raz') net.room?.send('talents_raz')
  })
}
const ICONE_COMP_SPEC = (spec: string) => ICONE_COMP[SPEC_BY_ID[spec]?.competence] ?? 'action'

function menuScreen() {
  const s = scene()
  const tuile = (a: string, icon: string, label: string, cls = '') => `<button class="${cls}" data-a="${a}">${ico(icon)}<span>${label}</span></button>`
  ui.showScreen(`${entete(t('ui.menu.titre'), 'menu')}
    <div class="grille-menu">
      ${tuile('talents', 'talents', t('ui.menu.talents'), aChoisir(me) ? 'a-faire' : '')}${tuile('sac', 'sac', t('ui.menu.sac'))}${tuile('journal', 'journal', t('ui.journal.titre'))}${tuile('carte', 'carte', t('ui.menu.carte'))}${tuile('lignee', 'crane', t('ui.menu.lignee'))}
      ${tuile('morts', 'crane', t('ui.action.morts'))}${tuile('cle', 'menu', t('ui.menu.cle'))}${tuile('assist', 'visee', t('ui.menu.visee', { v: t(`ui.menu.visee_${s?.assist ?? 1}`) }))}${tuile('tremble', 'tremblement', t('ui.menu.tremblements', { v: t(`ui.menu.tremblements_${s?.tremblements ?? 1}`) }))}${tuile('ping', 'front', t('ui.menu.ping', { v: t(pingVisible() ? 'ui.menu.ping_on' : 'ui.menu.ping_off') }))}
      ${tuile('social', 'social', t('ui.social.titre'))}${tuile('son', 'son', t('ui.menu.son'))}${tuile('langue', 'carte', t('ui.menu.langue', { langue: t('ui.menu.langue_nom') }))}
      ${(codeTest || testLocal) && kind !== 'concession' ? tuile('boss', 'crane', t('ui.test.titre')) : ''}
      ${kind === 'concession' ? tuile('quitter', 'fermer', t('ui.menu.quitter'), 'danger') : ''}
    </div>
    <p class="doux">${t('ui.menu.pied', { famille: esc(me?.soldat?.family ?? ''), ou: esc(kind === 'concession' ? t('ui.carte.concession') : t(`carte.${carte}.nom`)), ping: Math.round(net.ping) })}</p>`, (a) => {
    if (a === 'langue') return changerLangue()
    if (a === 'son') return sonScreen()
    if (a === 'social') return ecranSocial()
    if (a === 'talents') talentsScreen()
    if (a === 'sac') sacScreen()
    if (a === 'journal') journalScreen()
    if (a === 'carte') carteScreen()
    if (a === 'boss') bossScreen()
    if (a === 'cle') cleScreen()
    if (a === 'lignee') ligneeScreen()
    if (a === 'morts') mortsScreen()
    if (a === 'assist' && s) { s.assist = (s.assist + 1) % 3; localStorage.setItem('heirline.assist', String(s.assist)); menuScreen() }
    if (a === 'ping') { localStorage.setItem('heirline.ping', pingVisible() ? '0' : '1'); majPing(); menuScreen() }
    if (a === 'tremble' && s) { s.tremblements = (s.tremblements + 1) % 3; localStorage.setItem('heirline.tremblements', String(s.tremblements)); menuScreen() }
    if (a === 'quitter') backToSector()
  })
}

/** Le réglage de langue : on passe à l'autre, on le garde, et on recharge proprement (le serveur garde la partie). */
/** l'indicateur de ping sous la minicarte : affiché par défaut, désactivable dans le menu */
function pingVisible() { return localStorage.getItem('heirline.ping') !== '0' }
function majPing() { const el = document.getElementById('ping')!; el.style.display = pingVisible() ? '' : 'none' }
majPing()
function changerLangue() {
  const l: Lang = lang() === 'fr' ? 'en' : 'fr'
  localStorage.setItem(CLE_LANGUE, l)
  location.reload()
}

// --------------------------------------------------------------- boucle d'interface

function makePortraits() {
  const out: Record<string, string> = {}
  CLASS_IDS.forEach((id, i) => {
    const src = game.textures.get(`soldat${i}`).getSourceImage() as HTMLCanvasElement
    const c = document.createElement('canvas'); c.width = 16; c.height = 16
    c.getContext('2d')!.drawImage(src, 0, 0, 16, 16, 0, 0, 16, 16)
    out[id] = c.toDataURL()
  })
  return out
}

let hudT = 0
let wasDown = false
function uiLoop(now: number) {
  requestAnimationFrame(uiLoop)
  const s = scene()
  controls.enabled = !ui.screenOpen()
  if (!s || !net.room?.state) return
  if (now - hudT < 100) return
  hudT = now
  const st = net.room.state
  ui.updateHud(me, net.self(), monRobot())
  let region = ''
  if (kind === 'secteur' && carte === 'ossara') {
    const tx = Math.floor(pos.x / TILE), ty = Math.floor(pos.y / TILE)
    const z = zoneDef(zoneIdAt(tx, ty))
    const lieu = lieuAt(tx, ty)
    const nomLieu = lieu ? t(`lieu.${lieu.id}.nom`) : '', nomZone = t(`region.${z.id}.nom`)
    region = lieu ? nomLieu : `${nomZone} · ${t('ui.niv', { n: `${z.niveau[0]}-${z.niveau[1]}` })}`
    const cle = lieu?.id ?? z.id
    if (cle !== lieuCourant) {
      if (lieuCourant || regionCourante) ui.placeTitle(lieu ? nomLieu : nomZone, lieu ? nomZone : t('ui.niveaux', { a: z.niveau[0], b: z.niveau[1] }))
      lieuCourant = cle
    }
    regionCourante = z.id
  } else if (kind === 'secteur') region = t(`carte.${carte}.nom`)
  else region = concessionInfo?.contenu?.nom ?? t('ui.carte.concession')
  if (kind === 'secteur') ui.setClock(st.heure ?? 12, st.meteo ?? 0)
  // dans les Hauts : ce que la Pépinière a lu (la source qui fait 30 % de moins aux créatures des Hauts)
  ui.setZone(pos.zone, region, carte === 'ossara' && pos.x >= HAUTS_X * TILE ? (st.lecture ?? '') : '')
  updateTracker()
  minimap.garesOuv = garesOuvertes()
  minimap.draw(st, net.room.sessionId, pos, kind === 'secteur' ? questMarkers() : [])
  if (pingVisible()) document.getElementById('ping')!.textContent = `${Math.round(net.ping)} ms`
  if (kind === 'secteur') {
    let boss: any = null
    st.enemies?.forEach((e: any) => { if ((e.kind === 4 || e.kind === 12 || e.kind === 15 || e.kind === 16) && Math.hypot(e.x - pos.x, e.y - pos.y) < 520) boss = e })
    const ar = CARTES[carte]?.arene
    const auNid = !!ar && pos.zone === 'nid'
    const kb = boss?.kind ?? (ar?.profil === 'engloutisseur' ? 12 : ar?.profil === 'gueule' ? 15 : ar?.profil === 'semeur' ? 16 : ar?.profil === 'pepiniere' ? 22 : ar?.profil === 'greffier' ? 23 : ar?.profil === 'glaneuse' ? 24 : 4)
    ui.setBoss(boss ? Math.round(boss.hp / boss.maxHp * 100) : auNid && st.bossPv ? st.bossPv : null, t(`ennemi.${kb}.nom`))
  } else {
    let boss: any = null
    st.enemies?.forEach((e: any) => { if (e.kind === 4) boss = e })
    ui.setBoss(boss ? Math.round(boss.hp / boss.maxHp * 100) : st.vagues ? Math.round(st.vague / st.vagues * 100) : null, boss ? t('ui.couveuse_mineure') : t('srv.monde.vague', { n: st.vague, total: st.vagues }))
  }
  const etat = net.self()?.etat ?? 0
  if (wasDown && etat === 0) ui.hideBanner()
  wasDown = etat === 1
  actionKind = nearestAction()
  ui.setAction(actionKind ? actionLabel : null, actionIcone)
  if (!ui.screenOpen()) ecran = ''
}

async function start() {
  ui.initTheme()
  await document.fonts.load('16px Pochoir').catch(() => {})
  const s = await sceneReady
  s.assist = Number(localStorage.getItem('heirline.assist') ?? 1)
  s.onFrame = (info) => { pos = info }
  s.markerFor = questMarker
  const origUpdate = s.update.bind(s)
  s.update = (t: number, d: number) => { origUpdate(t, d); lastAim = (s as any).lastAim ?? lastAim }
  if (!Object.keys(portraits).length) portraits = makePortraits()
  if (!token) return titleScreen()
  let m: any
  try { m = await api('/api/moi') } catch (e: any) {
    if (e.status === 401) { token = ''; localStorage.removeItem(KEY); return titleScreen() }
    ui.showScreen(`${entete(t('ui.erreur.injoignable'), 'fermer', false)}<p>${esc(e.message)}</p><div class="rangee"><button data-a="r">${t('ui.erreur.reessayer')}</button></div>`, () => location.reload())
    return
  }
  if (!m.vivant) return classScreen(m.lignee)
  // reprendre là où on s'est arrêté : la carte vient du serveur (qui replace le soldat à sa position)
  if (isCarte(m.carte)) carte = m.carte
  try { await joinSector() } catch (e: any) {
    if (String(e.message).includes('classe')) return classScreen(m.lignee)
    ui.showScreen(`${entete(t('ui.erreur.rejoindre'), 'fermer', false)}<p>${esc(e.message)}</p><div class="rangee"><button data-a="r">${t('ui.erreur.reessayer')}</button></div>`, () => location.reload())
  }
}

requestAnimationFrame(uiLoop)
start()
;(window as any).heirline = { net, game, scene, controls, son, motifs: { balles, posBalle, TOUCHE_R }, ecrans: { social: ecranSocial, echange: ecranEchange, son: sonScreen, talents: talentsScreen, sac: sacScreen, journal: journalScreen, carte: carteScreen, menu: menuScreen, atelier: atelierScreen, gare: gareScreen, boss: bossScreen, releve: releveScreen, morts: mortsScreen, lignee: ligneeScreen, cle: cleScreen } }
