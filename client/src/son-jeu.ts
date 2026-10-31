// Ce que le jeu fait entendre : les bruitages des effets venus du serveur, les tirs, la marche du robot, le monorail,
// et, deux fois par seconde, la musique et l'ambiance de l'endroit (lieu habité, région, épave, nid, arène, boss).
// Tout passe par son.ts ; ici on ne fait que décider quoi jouer, et où.
import { TILE } from '../../shared/consts.ts'
import { CLASS_IDS, E, ENEMIES } from '../../shared/rules.ts'
import { QUEST_BY_ID, questComplete } from '../../shared/quests.ts'
import { t } from '../../shared/i18n/index.ts'
import { zoneIdAt } from '../../shared/map.ts'
import { lieuAt } from '../../shared/regions/index.ts'
import * as son from './son.ts'
import { palier } from './vfx.ts'
import { zoneOfClient, type GameScene } from './scene.ts'

// les trois classes venues avec les talents empruntent un tir proche en attendant les leurs
const CLASSE_SON: Record<string, string> = { fantassin: 'fan', medic: 'med', ingenieur: 'ing', eclaireur: 'med', demolisseur: 'ing', brouilleur: 'fan' }
/** le son du tir d'un soldat : sa classe, et la version chargée à partir du palier 3 (niveau 10) */
export function sonTir(cls: number, niveau: number) {
  return `tir_${CLASSE_SON[CLASS_IDS[cls]] ?? 'fan'}_${palier(niveau) >= 3 ? 2 : 1}`
}

/** la musique et l'ambiance de chaque région du continent */
const REGION: Record<string, [string, string]> = {
  plaines: ['explo', 'plaines'], foret: ['explo', 'foret'], marais: ['sombre', 'marais'],
  plateaux: ['explo', 'plateaux'], cimetiere: ['sombre', 'cimetiere'], eden: ['eden', 'eden'],
}
/** le bruitage de chaque compétence (celles des talents reprennent les plus proches) */
const SON_COMP: Record<string, string> = {
  bouclier: 'bouclier', injection: 'injection', adrenaline: 'adrenaline', tourelle: 'tourelle_pose', surcharge: 'surcharge', grenade: 'grenade_lance',
  marquage: 'flash', piege: 'tourelle_pose', mortier: 'grenade_lance', onde: 'zone_boum', champ: 'surcharge', leurre: 'tourelle_pose',
  bastion: 'bouclier', percee: 'esquive', tir_lourd: 'flash', filet: 'grenade_lance', perfusion: 'injection', toxine: 'crache',
  blindage: 'repare', essaim: 'tourelle_pose', tapis: 'grenade_lance', brasier: 'zone_boum', court_circuit: 'surcharge', voile: 'esquive',
  ricochet: 'touche_metal', devore: 'morsure', spore_soin: 'injection', recycle: 'repare',
}
const BORD_DE_MER = new Set(['port', 'anse'])
const BOSS = new Set<number>([E.COUVEUSE, E.ENGLOUTISSEUR, E.GUEULE, E.SEMEUR, E.PEPINIERE, E.GREFFIER, E.GLANEUSE])

export function brancherSon(sc: GameScene) {
  const moi = () => sc.net?.room?.sessionId
  sc.events.on('fx', (ev: any) => surEffet(sc, ev, moi()))
  sc.events.on('tir', (me: any) => son.joue(sonTir(me.cls, me.level)))
  sc.events.on('son', (id: string, x?: number, y?: number) => son.joue(id, { x, y }))
  sc.events.on('postupdate', () => image(sc))
  // l'interface : chaque bouton cliqué fait un petit bruit (les écrans, le menu, les dialogues)
  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement)?.closest?.('button')
    if (b && !b.disabled) son.joue(b.classList.contains('danger') ? 'ui_ferme' : 'ui_clic')
  }, { capture: true })
}

// ------------------------------------------------------------------ les effets du serveur
let bossTombeT = -1e9
function surEffet(_sc: GameScene, ev: any, mine?: string) {
  const at = { x: ev.x, y: ev.y }
  switch (ev.k) {
    case 'touche': son.joue(ev.m || ev.a ? 'touche_metal' : 'touche_chair', at); break
    case 'aie': if (ev.sid === mine) son.joue('aie'); else if (ev.sid) son.joue('touche_chair', { ...at, vol: 0.5 }); break
    case 'mort': {
      const def = ENEMIES[ev.kind]
      if (ev.kind === E.SAC) { son.joue('sac_creve', at); break }
      if (BOSS.has(ev.kind)) { son.joue('boss_mort', at); son.jingle('victoire'); bossTombeT = performance.now(); break }
      son.joue(def?.famille === 'machine' ? 'mort_machine' : def?.famille === 'faune' ? 'mort_bete' : 'mort_eden', at)
      break
    }
    case 'mur': son.joue('touche_mur', at); break
    case 'crache': son.joue('crache', at); break
    case 'morsure': son.joue('morsure', at); break
    case 'eclosion': son.joue('eclosion', at); break
    case 'panne': son.joue('panne', at); break
    case 'repare': son.joue('repare', at); break
    case 'bulle': son.joue('bulle', at); break
    case 'butin': if (!ev.sid || ev.sid === mine) son.joue(`butin_${Math.max(0, Math.min(3, ev.r ?? 0))}`); break
    case 'tele': son.joue('zone_annonce', { ...at, vol: ev.ami ? 0.4 : 1 }); break
    case 'vfx': son.joue(ev.nom === 'pince' ? 'morsure' : 'panne', at); break
    case 'boom': {
      // les zones des Hauts : des sons déjà là (CC0), choisis à la cause de la zone
      let k = ''
      try { k = String(JSON.parse(ev.src ?? '{}').k ?? '').replace('srv.tueur.', '') } catch { /* rien */ }
      const hauts = ({ essaim: 'eclosion', epines: 'morsure', rature: 'crache', encre: 'crache', appel: 'boum', vitres: 'zone_boum', pages: 'zone_boum', fils: 'zone_boum', pylone: 'boum_eden' } as Record<string, string>)[k]
      if (hauts) { son.joue(hauts, at); break }
      if (ev.f === 'colonnes') son.joue('colonne_spores', at)
      else if (ev.f === 'grille' || ev.f === 'anneau') son.joue('zone_boum', at)
      else son.joue(ev.ami ? 'boum' : 'boum_eden', at)
      break
    }
    case 'boum': son.joue('boum', at); break
    case 'grenade': son.joue('grenade_lance', at); break
    case 'sk': son.joue(SON_COMP[ev.s] ?? 'ui_clic', at); break
    case 'zone': son.joue(ev.z === 'perfusion' ? 'injection' : 'zone_annonce', { ...at, vol: 0.5 }); break
    case 'niveau': if (ev.sid === mine || !ev.sid) son.joue('niveau'); break
    case 'aterre':
      if (ev.sid === mine) { son.joue('aterre'); if (ev.regle === 'mort-definitive') son.jingle('mort') }
      else son.joue('aterre', { ...at, vol: 0.4 })
      break
    case 'evac': if (ev.sid === mine) son.jingle('mort'); break
  }
}

// ------------------------------------------------------------------ à chaque image
const vus = { balles: new Set<string>(), ennemis: new Set<string>() }
const joueurs = new Map<string, { dash: boolean; monte: boolean; nom: string }>()
const robots = new Map<string, { x: number; y: number; mode: number; pasT: number }>()
const rames = new Map<string, { phase: string; portes: number; prochain: string; frein: boolean }>()
let choixT = 0, criT = 0, dernierBalles = 0

function image(sc: GameScene) {
  const st = sc.net?.room?.state
  if (!st || !sc.map) return
  const me = sc.net.self()
  const mine = sc.net.room.sessionId
  const now = performance.now()
  if (me) son.auditeur(me.x, me.y)

  // les tirs des autres (les nôtres sonnent tout de suite, au doigt : voir l'événement « tir »)
  const balles = new Set<string>()
  let nouvelles = 0
  st.bullets?.forEach((b: any, id: string) => {
    balles.add(id)
    if (vus.balles.has(id)) return
    if (++nouvelles > 6) return // un tir de groupe : quelques sons suffisent
    if (b.team === 0) {
      if (b.o === me?.num) return
      let p: any = null
      st.players?.forEach((q: any) => { if (q.num === b.o) p = q })
      son.joue(p ? sonTir(p.cls, p.level) : 'tir_fan_1', { x: b.x, y: b.y, vol: 0.7 })
    } else if (b.team === 2) son.joue(b.k === 3 ? 'tir_tourelle' : 'tir_rob', { x: b.x, y: b.y })
    else son.joue(b.k === 1 ? 'tir_machine' : 'tir_eden', { x: b.x, y: b.y })
  })
  vus.balles = balles
  dernierBalles = balles.size

  // les soldats : la ruée, monter sur son robot, en descendre, la relève
  st.players?.forEach((p: any, sid: string) => {
    const avant = joueurs.get(sid)
    const dash = p.dashT > 0
    if (avant) {
      const at = sid === mine ? {} : { x: p.x, y: p.y }
      if (dash && !avant.dash) son.joue('esquive', at)
      if (p.monte !== avant.monte) son.joue(p.monte ? 'monture_monte' : 'monture_descend', at)
      if (sid === mine && avant.nom && p.name && p.name !== avant.nom) son.joue('releve')
    }
    joueurs.set(sid, { dash, monte: !!p.monte, nom: p.name })
  })

  // le robot : ses pas quand il marche, l'avant-poste qui se plante
  st.robots?.forEach((r: any, id: string) => {
    const avant = robots.get(id)
    if (!avant) { robots.set(id, { x: r.x, y: r.y, mode: r.mode, pasT: 0 }); return }
    const v = Math.hypot(r.x - avant.x, r.y - avant.y) / Math.max(0.001, sc.game.loop.delta / 1000)
    if ((r.mode === 0 || r.mode === 6) && v > 20) {
      avant.pasT -= sc.game.loop.delta / 1000
      if (avant.pasT <= 0) { avant.pasT = r.mode === 6 ? 0.22 : 0.34; son.joue('robot_pas', { x: r.x, y: r.y, vol: r.owner === mine ? 1 : 0.6 }) }
    }
    if (r.mode === 2 && avant.mode !== 2) son.joue('avantposte', { x: r.x, y: r.y })
    avant.x = r.x; avant.y = r.y; avant.mode = r.mode
  })

  // ÉDEN qui arrive : un cri de temps en temps, pas à chaque bête
  const ennemis = new Set<string>()
  st.enemies?.forEach((e: any, id: string) => {
    ennemis.add(id)
    if (vus.ennemis.has(id) || !me) return
    if (ENEMIES[e.kind]?.famille === 'eden' && !BOSS.has(e.kind) && e.kind !== E.SAC && e.kind !== E.OEUF && now - criT > 5000 && Math.hypot(e.x - me.x, e.y - me.y) < 320) {
      criT = now
      son.joue('cri_eden', { x: e.x, y: e.y })
    }
  })
  vus.ennemis = ennemis

  monorail(sc, mine)

  if (now - choixT > 500) { choixT = now; choisir(sc, st, me) }
}

// ------------------------------------------------------------------ le monorail
function monorail(sc: GameScene, mine: string) {
  const presentes = new Set<string>()
  for (const r of sc.rail.rames.values()) {
    const e = r.etat
    if (!e) continue
    presentes.add(r.sid)
    const a = rames.get(r.sid)
    const nous = r.sid === mine
    const at = nous ? {} : { x: e.x, y: e.y }
    if (!a) {
      rames.set(r.sid, { phase: e.phase, portes: e.portes, prochain: e.prochain, frein: false })
      if (e.phase === 'approche') son.joue('rail_cloche', at)
      continue
    }
    // l'arrivée : le frein crisse quand la rame ralentit vers une gare
    if (!a.frein && e.v > 0 && e.v < 70 && (e.phase === 'approche' || (e.phase === 'voyage' && e.prochain === r.tr.vers))) { a.frein = true; son.joue('rail_frein', at) }
    if (e.v > 120) a.frein = false
    if ((e.portes > 0.5) !== (a.portes > 0.5)) son.joue('rail_portes', at)
    if (a.phase === 'montee' && e.phase === 'voyage') { son.joue('rail_depart', at); if (nous) son.joue('rail_cloche') }
    if (nous && e.phase === 'voyage' && e.prochain !== a.prochain) son.joue('rail_annonce')
    if (nous && a.phase === 'approche' && e.phase === 'montee') son.joue('rail_annonce')
    a.phase = e.phase; a.portes = e.portes; a.prochain = e.prochain
    // le roulement : plus fort en vitesse ; pour une rame qui passe au loin, selon la distance
    const k = Math.min(1, e.v / 150)
    son.couche(`rail:${r.sid}`, k > 0.03 ? 'rail' : null, k * (nous && e.abord ? 1 : son.attenuation(e.x, e.y) * 0.8), 'fx')
  }
  for (const sid of [...rames.keys()]) if (!presentes.has(sid)) { rames.delete(sid); son.couche(`rail:${sid}`, null) }
}

// ------------------------------------------------------------------ la musique et l'ambiance de l'endroit
function choisir(sc: GameScene, st: any, me: any) {
  const carte = sc.map.carte
  let mus: string | null = 'explo', amb: string | null = 'plaines'
  if (sc.kind === 'concession') { mus = 'sombre'; amb = 'cimetiere' }
  else if (carte === 'nid' || carte === 'gueule' || carte === 'gueule_h' || carte === 'semeur' || carte === 'metier_raid') { mus = 'nid'; amb = 'nid' }
  else if (carte === 'antre' || carte === 'antre_h') { mus = 'sombre'; amb = 'marais' }
  else if (carte === 'serre' || carte === 'serre_h' || carte === 'registre' || carte === 'registre_h') { mus = 'sombre'; amb = 'nid' }
  else if (carte === 'constance') { mus = 'epave'; amb = 'epave' }
  else if (me) {
    const tx = Math.floor(me.x / TILE), ty = Math.floor(me.y / TILE)
    const reg = REGION[zoneIdAt(tx, ty)] ?? REGION.plaines
    mus = reg[0]; amb = reg[1]
    const lieu = lieuAt(tx, ty)
    if (lieu?.habite) { mus = 'ville'; if (BORD_DE_MER.has(lieu.id)) amb = 'port' }
  }
  // au-delà du front : la guerre au loin, par-dessus l'ambiance
  const dela = me && sc.kind === 'secteur' && carte === 'ossara' && zoneOfClient(st, sc.map, me.x, me.y) === 'dela'
  son.couche('front', dela ? 'front' : null, 0.8)
  son.couche('pluie', sc.kind === 'secteur' && carte === 'ossara' && st.meteo === 1 ? 'pluie' : null, 0.9)
  // un boss : l'arène fermée, ou un boss du monde tout près ; la rage au dernier tiers
  let boss: any = null
  if (me) st.enemies?.forEach((e: any) => { if (BOSS.has(e.kind) && Math.hypot(e.x - me.x, e.y - me.y) < 460 && e.hp < e.maxHp) boss = e })
  if (sc.arene.ferme && sc.arene.surCarte()) mus = sc.arene.phase >= 3 ? 'boss_rage' : 'boss'
  else if (boss) mus = boss.hp / boss.maxHp < 0.34 ? 'boss_rage' : 'boss'
  // juste après la victoire, on laisse passer le jingle avant de reprendre
  if (performance.now() - bossTombeT < 6000) mus = null
  son.musique(mus)
  son.ambiance(amb)
}

/** pour les tests : les sons que ce fichier peut demander */
export const SONS_JEU = { REGION, sonTir }
export const nbBalles = () => dernierBalles

// ------------------------------------------------------------------ les quêtes
type Quetes = { actives: { id: string; prog: number[] }[]; faites: string[] }
/** une quête prise, une quête qui devient prête à rendre, une quête rendue */
export function sonQuetes(avant: Quetes, apres: Quetes) {
  if (apres.faites.length > avant.faites.length) return son.joue('quete_rendue')
  const pret = (q: Quetes) => new Set(q.actives.filter((a) => { const d = QUEST_BY_ID[a.id]; return d && questComplete(d, a.prog) }).map((a) => a.id))
  const p0 = pret(avant), p1 = pret(apres)
  if ([...p1].some((id) => !p0.has(id))) return son.joue('quete_prete')
  if (apres.actives.some((a) => !avant.actives.find((b) => b.id === a.id))) son.joue('quete_prise')
}

// ------------------------------------------------------------------ l'écran des réglages du son
const PAS = 0.1
/** le contenu de l'écran Son : quatre volumes et la coupure ; action(a) le met à jour, rend true s'il faut le redessiner */
export function ecranSonHtml(titre: string) {
  const r = son.reglages
  const ligne = (b: 'mus' | 'amb' | 'fx' | 'ui') => `<div class="rangee son-ligne"><span>${t(`ui.son.${b}`)}</span>
    <button data-a="${b}-">−</button><b>${Math.round(r[b] * 100)} %</b><button data-a="${b}+">+</button></div>`
  return `${titre}
    ${ligne('mus')}${ligne('amb')}${ligne('fx')}${ligne('ui')}
    <div class="rangee"><button data-a="muet" class="${r.muet ? 'principal' : ''}">${t(r.muet ? 'ui.son.remettre' : 'ui.son.couper')}</button></div>
    <p class="doux">${t('ui.son.credits')}</p>`
}
export function actionSon(a: string) {
  const r = son.reglages
  if (a === 'muet') r.muet = !r.muet
  else {
    const b = a.slice(0, -1) as 'mus' | 'amb' | 'fx' | 'ui', s = a.slice(-1)
    if (!(b in r)) return false
    r[b] = Math.max(0, Math.min(1, Math.round((r[b] + (s === '+' ? PAS : -PAS)) * 10) / 10))
  }
  son.enregistrer()
  son.joue('ui_clic')
  return true
}
