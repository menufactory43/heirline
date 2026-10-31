// L'interface en HTML, dans le thème d'Heirline : les cadres 9-tranches dessinés ici (métal riveté, écran vert,
// plaques d'identité, boutons), le HUD (soldat, robot, quêtes, zone, boss, minicarte, heure), les écrans,
// la grande carte du continent. Les icônes sont dans icones.ts, la police pixel dans public/pochoir.woff2.
import { TILE } from '../../shared/consts.ts'
import { RARETES, BASES, STAT_KEYS, LEG_BY_ID, SET_BY_ID, piecesSet, itemName, itemKey, isEquip, type Item, type Equip } from '../../shared/items.ts'
import { t, aCle } from '../../shared/i18n/index.ts'
import { isSolidTile, T, type GameMap } from '../../shared/map.ts'
import { CLASSES, CLASS_IDS, xpToNext, type ClassId } from '../../shared/rules.ts'
import { RUCHES, ecartBordure } from '../../shared/front.ts'
import { REGIONS, LIEUX } from '../../shared/regions/index.ts'
import { STATIONS, STATION_BY_ID } from '../../shared/monde.ts'
import { TRONCONS } from '../../shared/monorail.ts'
import { icone, iconeToile, ico, ICONE_COMP } from './icones.ts'
import { SLOT_NIVEAU } from '../../shared/talents.ts'

const $ = <E extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as E
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

// --------------------------------------------------------------- les cadres 9-tranches, dessinés au pixel
type RGBA = [number, number, number, number]
const hex = (c: string, a = 255): RGBA => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a] }
interface CadreDef {
  n: number; contour: string; clair: string; sombre: string; fond: string; fondA?: number
  chanfrein?: number; rivets?: boolean; biseau?: number; interieur?: string; lueur?: string; coins?: string; inverse?: boolean
}
function dessinerCadre(d: CadreDef) {
  const N = d.n
  const cv = document.createElement('canvas'); cv.width = N; cv.height = N
  const c = cv.getContext('2d')!
  const img = c.createImageData(N, N)
  const set = (x: number, y: number, col: RGBA) => { const i = (y * N + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = col[3] }
  const O = hex(d.contour), L = hex(d.inverse ? d.sombre : d.clair), D = hex(d.inverse ? d.clair : d.sombre), F = hex(d.fond, Math.round((d.fondA ?? 1) * 255))
  const I = d.interieur ? hex(d.interieur) : null, G = d.lueur ? hex(d.lueur) : null
  const ch = d.chanfrein ?? 0, bis = d.biseau ?? 1
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const xr = N - 1 - x, yr = N - 1 - y
    const coin = Math.min(x + y, xr + y, x + yr, xr + yr)
    if (coin < ch) continue
    const e = Math.min(x, y, xr, yr)
    if (e === 0 || coin === ch) { set(x, y, O); continue }
    if (e <= bis) {
      // biseau : clair en haut et à gauche, sombre en bas et à droite
      const haut = y <= bis && y <= x && y <= xr, gauche = x <= bis && x <= y && x <= yr
      set(x, y, haut || gauche ? L : D); continue
    }
    if (I && e === bis + 1) { set(x, y, I); continue }
    if (G && e === bis + 2) { set(x, y, G); continue }
    set(x, y, F)
  }
  if (d.rivets) for (const [x, y] of [[3, 3], [N - 5, 3], [3, N - 5], [N - 5, N - 5]]) { set(x, y, hex('#b8c2b4')); set(x + 1, y, hex('#7d877a')); set(x, y + 1, hex('#7d877a')); set(x + 1, y + 1, hex('#1a1e19')) }
  if (d.coins) { const K = hex(d.coins); for (let k = 0; k < 2; k++) { set(ch + 1 + k, 1, K); set(1, ch + 1 + k, K); set(N - 2 - ch - k, 1, K); set(N - 2, ch + 1 + k, K); set(ch + 1 + k, N - 2, K); set(1, N - 2 - ch - k, K); set(N - 2 - ch - k, N - 2, K); set(N - 2, N - 2 - ch - k, K) } }
  c.putImageData(img, 0, 0)
  return `url(${cv.toDataURL()})`
}

let themeFait = false
/** Pose les cadres du thème dans des variables CSS (--f-plaque, --f-btn…). Une fois, au démarrage. */
export function initTheme() {
  if (themeFait) return
  themeFait = true
  const acier = { contour: '#070807', clair: '#6c766c', sombre: '#1c211c' }
  const v: Record<string, string> = {
    plaque: dessinerCadre({ n: 24, ...acier, fond: '#1f2520', fondA: 0.92, chanfrein: 3, rivets: true, biseau: 1, interieur: '#2c332c' }),
    mince: dessinerCadre({ n: 12, ...acier, fond: '#1a1f1a', fondA: 0.86, chanfrein: 2 }),
    'mince-chaud': dessinerCadre({ n: 12, contour: '#070807', clair: '#ffb347', sombre: '#7a3e10', fond: '#241a10', fondA: 0.9, chanfrein: 2 }),
    eden: dessinerCadre({ n: 12, contour: '#0a040c', clair: '#c88aff', sombre: '#4a1a5a', fond: '#1c0e22', fondA: 0.9, chanfrein: 2 }),
    crt: dessinerCadre({ n: 16, ...acier, fond: '#0b150b', chanfrein: 2, biseau: 2, interieur: '#020402', lueur: '#1e3a18' }),
    tag: dessinerCadre({ n: 12, contour: '#1a1c18', clair: '#eef2e8', sombre: '#6f786c', fond: '#b6beb0', chanfrein: 3 }),
    'tag-froid': dessinerCadre({ n: 12, contour: '#0a1418', clair: '#e0f6ff', sombre: '#3a7a90', fond: '#7fc4da', chanfrein: 3 }),
    'tag-vert': dessinerCadre({ n: 12, contour: '#0a140a', clair: '#d8ffc0', sombre: '#3a7a2a', fond: '#8ad06a', chanfrein: 3 }),
    btn: dessinerCadre({ n: 12, ...acier, fond: '#2a322b', fondA: 0.94, chanfrein: 2 }),
    'btn-bas': dessinerCadre({ n: 12, ...acier, fond: '#20271f', fondA: 0.96, chanfrein: 2, inverse: true }),
    chaud: dessinerCadre({ n: 12, contour: '#1a0c02', clair: '#ffe0a0', sombre: '#9a5414', fond: '#f0962e', chanfrein: 2 }),
    'chaud-bas': dessinerCadre({ n: 12, contour: '#1a0c02', clair: '#ffe0a0', sombre: '#9a5414', fond: '#d07a1e', chanfrein: 2, inverse: true }),
    danger: dessinerCadre({ n: 12, contour: '#120404', clair: '#e8705a', sombre: '#5a1a12', fond: '#3a1712', fondA: 0.94, chanfrein: 2 }),
    comp: dessinerCadre({ n: 16, ...acier, fond: '#232a24', fondA: 0.9, chanfrein: 4, biseau: 1, interieur: '#30382f', coins: '#ff9b3d' }),
    'comp-bas': dessinerCadre({ n: 16, ...acier, fond: '#1a201a', fondA: 0.95, chanfrein: 4, biseau: 1, coins: '#ffd36b', inverse: true }),
  }
  const st = document.documentElement.style
  for (const [k, u] of Object.entries(v)) st.setProperty('--f-' + k, u)
  // les icônes posées dans le HTML (data-ico)
  for (const im of document.querySelectorAll<HTMLImageElement>('img[data-ico]')) im.src = icone(im.dataset.ico!)
}

// --------------------------------------------------------------- les écrans
/** Le nom d'un objet dans la langue du joueur (les noms tirés au sort sont dans shared/i18n/contenu/objets.ts). */
export function nomObjet(it: Item) { const k = itemKey(it); return aCle(k) ? t(k) : itemName(it) }
const statsObjet = (it: Item) => Object.keys(it.s).filter((k) => (it.s as any)[k]).map((k) => `+${(it.s as any)[k]}${t(`stat.${k}`)}`)
const metaObjet = (it: Item) => isEquip(it) ? `${t(`rarete.${it.r ?? 0}.nom`)} · ${t('ui.niv', { n: it.l })}${it.c ? ` · ${esc(t(`classe.${it.c}.nom`))}` : ''}` : esc(BASES[it.b] ? t(`objet.${it.b}.desc`) : '')

/** L'en-tête d'un écran : icône, titre, bouton fermer. */
export function entete(titre: string, icon?: string, fermer = true) {
  return `<div class="entete">${icon ? ico(icon) : ''}<h2>${titre}</h2>${fermer ? `    <button class="fermer-x" data-a="fermer" title="${t('ui.fermer')}">${ico('fermer')}</button>` : ''}</div>`
}

export function showScreen(html: string, onClick?: (action: string, el: HTMLElement) => void, opts: { bas?: boolean } = {}) {
  const e = $('ecran'), b = $('ecran-boite')
  b.innerHTML = html
  e.classList.remove('cache')
  e.classList.toggle('bas', !!opts.bas)
  b.onclick = (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-a]')
    if (!t) return
    if (t.dataset.a === 'fermer') return hideScreen()
    onClick?.(t.dataset.a!, t)
  }
}
export function hideScreen() { $('ecran').classList.add('cache') }
export function screenOpen() { return !$('ecran').classList.contains('cache') }

// --------------------------------------------------------------- messages et bandeau
export function log(text: string, color = '#d9e4cf') {
  const j = $('journal')
  const d = document.createElement('div')
  d.textContent = text; d.style.color = color
  j.appendChild(d)
  while (j.children.length > 4) j.firstChild!.remove()
  setTimeout(() => { d.style.opacity = '0' }, 7000)
  setTimeout(() => d.remove(), 8200)
}
let bandeauT: any = null
export function banner(html: string, ms = 3500) {
  const b = $('bandeau')
  b.innerHTML = html; b.classList.remove('cache')
  clearTimeout(bandeauT)
  if (ms > 0) bandeauT = setTimeout(() => b.classList.add('cache'), ms)
}
export function hideBanner() { $('bandeau').classList.add('cache') }

// --------------------------------------------------------------- le HUD
let portraitCls = -1
let skillsVus = ''
/** Les trois emplacements : la compétence, un cadenas avec le niveau où elle s'ouvre, ou rien (spécialité à choisir). */
export function setSkills(comp: (string | null)[], level: number) {
  const cle = comp.join() + '|' + (comp[1] ? '' : level)
  if (cle === skillsVus) return
  skillsVus = cle
  for (let i = 0; i < 3; i++) {
    const b = $(`b-sk${i}`)
    const id = comp[i]
    b.classList.toggle('cache', i === 2 && !id)
    b.classList.toggle('verrou', !id)
    if (!id) {
      b.querySelector('.nom')!.textContent = t('ui.hud.niveau', { n: SLOT_NIVEAU[i] })
      ;(b.querySelector('img') as HTMLImageElement).src = icone('cadenas')
      b.title = t('ui.hud.verrou', { n: SLOT_NIVEAU[i] })
      continue
    }
    b.querySelector('.nom')!.textContent = t(`competence.${id}.nom`)
    b.classList.toggle('long', t(`competence.${id}.nom`).length >= 10) // « Overcharge », « Adrénaline » : on serre les lettres
    ;(b.querySelector('img') as HTMLImageElement).src = icone(ICONE_COMP[id] ?? 'action')
    b.title = t('ui.hud.competence', { nom: t(`competence.${id}.nom`), desc: t(`competence.${id}.desc`) })
  }
}

/** Une pastille sur le bouton du menu quand il y a des talents à placer ou un choix à faire. */
export function setBadgeTalents(on: boolean) { document.querySelector('[data-ui="menu"]')?.classList.toggle('a-faire', on) }

/** Le portrait du soldat (la première image de sa feuille), dessiné dans l'écran vert. */
export function setPortrait(src: CanvasImageSource | null, cls: number) {
  if (!src || cls === portraitCls) return
  portraitCls = cls
  const cv = $<HTMLCanvasElement>('portrait-cv')
  const c = cv.getContext('2d')!
  c.clearRect(0, 0, 16, 16); c.drawImage(src, 0, 0, 16, 16, 0, 0, 16, 16)
}

const ETAT_ROBOT = ['avec', 'atelier', 'avant-poste', 'aucun']
export function updateHud(me: any, self: any, robot?: any) {
  if (!me) return
  const s = me.soldat
  const nom = `${esc(s.given)} ${esc(s.family)}<small>${esc(CLASSES[s.cls as ClassId] ? t(`classe.${s.cls}.nom`) : '')} · G${s.generation}</small>`
  const n = $('nom-soldat'); if (n.dataset.v !== nom) { n.dataset.v = nom; n.innerHTML = nom }
  if (self) {
    const k = self.maxHp ? self.hp / self.maxHp : 1
    $('pv').style.width = `${Math.max(0, k) * 100}%`
    const barre = $('pv').parentElement!
    barre.classList.toggle('moyen', k <= 0.5 && k > 0.25); barre.classList.toggle('bas', k <= 0.25)
    $('pv-txt').textContent = `${Math.ceil(self.hp)} / ${self.maxHp}`
  }
  $('xp').style.width = `${Math.min(100, me.xp / xpToNext(me.level) * 100)}%`
  $('niveau').textContent = t('ui.hud.niveau', { n: me.level })
  $('ferraille').textContent = String(me.banque)
  $('sac').textContent = me.sac ? t('ui.hud.sac', { n: me.sac }) : ''
  const r = me.robot
  const pr = $('plaque-robot')
  pr.classList.toggle('monte', !!me.monte)
  // rien à signaler (avec toi, en pleine forme) : sur téléphone, la plaque du robot se cache
  pr.classList.toggle('calme', !me.monte && r.etat === 'avec' && (!robot || !robot.maxHp || robot.hp >= robot.maxHp))
  $('etat-robot').textContent = me.monte ? t('ui.hud.robot_monte', { n: r.level }) : t('ui.hud.robot', { n: r.level, etat: ETAT_ROBOT.includes(r.etat) ? t(`ui.hud.robot_${r.etat.replace('-', '_')}`) : r.etat })
  $('robot-pv').style.width = robot && robot.maxHp ? `${Math.max(0, robot.hp / robot.maxHp) * 100}%` : r.etat === 'avec' ? '100%' : '0%'
  const cds = [me.cd?.[0] ?? 0, me.cd?.[1] ?? 0, me.cd?.[2] ?? 0, me.dashCd ?? 0]
  const max = [me.cdMax?.[0] || 10, me.cdMax?.[1] || 10, me.cdMax?.[2] || 10, 1.6]
  ;['b-sk0', 'b-sk1', 'b-sk2', 'b-dash'].forEach((id, i) => {
    const el = $(id)
    el.classList.toggle('recharge', cds[i] > 0)
    const cd = el.querySelector<HTMLElement>('.cd')!
    cd.textContent = cds[i] > 0 ? (cds[i] >= 1 ? String(Math.ceil(cds[i])) : cds[i].toFixed(1)) : ''
    cd.style.setProperty('--reste', `${Math.min(100, cds[i] / max[i] * 100)}%`)
  })
  // la monture : avec la selle, si le robot est là
  const mt = $('b-monture')
  mt.classList.toggle('cache', !me.selle)
  mt.classList.toggle('actif', !!me.monte)
  mt.classList.toggle('eteint', !me.monte && r.etat !== 'avec')
  const im = mt.querySelector('img') as HTMLImageElement
  const want = me.monte ? 'descendre' : 'monture'
  if (im.dataset.ico !== want) { im.dataset.ico = want; im.src = icone(want) }
  mt.title = t(me.monte ? 'ui.hud.descendre' : 'ui.hud.monter')
  $('b-ordre').classList.toggle('eteint', r.etat !== 'avec' || !!me.monte)
}

export function setZone(zone: string, region = '', lecture = '') {
  const z = $('zone')
  const key = zone + '|' + region + '|' + lecture
  if (z.dataset.z === key) return
  z.dataset.z = key
  z.className = 'cadre tag ' + zone
  const [src, part] = lecture.split(':')
  const lu = src ? `<span class="lecture">${esc(t('ui.pepiniere.lit', { src: t(`ui.pepiniere.${src}`), part }))}</span>` : ''
  z.innerHTML = `${region ? `<span class="region">${esc(region)}</span>` : ''}${esc(aCle(`ui.zone.${zone}`) ? t(`ui.zone.${zone}`) : zone)}${lu}`
}

export function setClock(heure: number, meteo: number) {
  const h = Math.floor(heure), m = Math.floor((heure - h) * 60 / 10) * 10
  const jour = heure >= 6.5 && heure < 19.5
  const key = `${h}:${m}:${meteo}:${jour}`
  const e = $('horloge')
  if (e.dataset.k === key) return
  e.dataset.k = key
  e.innerHTML = `${ico(jour ? 'soleil' : 'lune', 'ico p')}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}${meteo === 1 ? ico('pluie', 'ico p') : meteo === 2 ? ico('brume', 'ico p') : ''}`
}

/** Le grand titre quand on arrive dans un lieu. */
let lieuT: any = null
export function placeTitle(nom: string, sous: string) {
  const e = $('lieu-titre')
  e.innerHTML = `<b>${esc(nom)}</b><small>${esc(sous)}</small>`
  e.classList.remove('cache', 'part'); void e.offsetWidth; e.classList.add('vient')
  clearTimeout(lieuT)
  lieuT = setTimeout(() => { e.classList.add('part') }, 2600)
}

export function setBoss(pct: number | null, label = t('ennemi.4.nom')) {
  const b = $('boss')
  if (pct === null) { b.classList.add('cache'); return }
  b.classList.remove('cache')
  $('boss-nom').textContent = label
  $('boss-pv').style.width = `${pct}%`
}

export function setAction(label: string | null, icon = 'action') {
  const a = $('action-ctx')
  if (!label) { a.classList.add('cache'); return }
  a.classList.remove('cache')
  $('action-txt').textContent = label
  const im = $<HTMLImageElement>('ico-action')
  if (im.dataset.ico !== icon) { im.dataset.ico = icon; im.src = icone(icon) }
}

// --------------------------------------------------------------- les cartes (écran vert)
/** Couleur d'une tuile, avant passage au vert. */
function tileColor(t: number): [number, number, number] {
  switch (t) {
    case T.HERBE: return [70, 96, 52]
    case T.MOUSSE: return [44, 74, 50]
    case T.BOUE: return [74, 62, 44]
    case T.EAU: return [26, 44, 66]
    case T.MER: return [8, 14, 22]
    case T.SABLE: return [150, 140, 104]
    case T.GUE: return [70, 100, 110]
    case T.PONT: return [170, 130, 80]
    case T.FALAISE: return [118, 110, 100]
    case T.MARE: return [52, 78, 70]
    case T.FERRAILLE: return [86, 72, 58]
    case T.PAVE: return [120, 114, 104]
    case T.PLANCHER: return [128, 96, 62]
    case T.MURP: return [170, 160, 140]
    case T.MURB: return [150, 120, 92]
    case T.CHAMP: return [118, 104, 52]
    case T.CLOTURE: case T.PALISSADE: return [122, 98, 70]
    case T.RACINE: return [96, 78, 90]
    case T.CHAIRSOL: case T.NIDSOL: return [84, 34, 74]
    case T.CHAIR: return [110, 40, 96]
    case T.ARBRE: return [30, 50, 30]
    case T.MEUBLE: return [110, 82, 54]
    case T.ROUTE: case T.DALLE: return [140, 142, 140]
    case T.METAL: return [104, 114, 128]
    case T.ROC: return [92, 90, 94]
    case T.SAS: case T.SCELLE: return [220, 170, 60]
    case T.EPAVE: case T.CAISSE: return [126, 110, 94]
    default: return isSolidTile(t) ? [64, 62, 66] : [62, 64, 56]
  }
}
/** Le même terrain, en phosphore vert (les éléments d'ÉDEN restent violets, le sas orange). */
function vert(t: number): [number, number, number] {
  const [r, g, b] = tileColor(t)
  if (t === T.CHAIRSOL || t === T.NIDSOL || t === T.CHAIR) return [r, g, b]
  if (t === T.SAS || t === T.SCELLE) return [255, 155, 61]
  const l = Math.min(255, (0.3 * r + 0.59 * g + 0.11 * b) * 1.15)
  return [Math.round(l * 0.32), Math.round(12 + l * 0.98), Math.round(l * 0.3)]
}

export interface Repere { x: number; y: number; c: string; g?: string }

export class Minimap {
  base = document.createElement('canvas')
  cv = $<HTMLCanvasElement>('minicarte')
  map: GameMap | null = null
  // une fenêtre autour du soldat, 2 pixels par tuile
  vw = 64; vh = 44
  biome: ImageData | null = null
  bioKey = ''

  setMap(map: GameMap) {
    this.map = map
    this.base.width = map.w; this.base.height = map.h
    this.cv.width = this.vw * 2; this.cv.height = this.vh * 2
    const ctx = this.base.getContext('2d')!
    const img = ctx.createImageData(map.w, map.h)
    for (let i = 0; i < map.w * map.h; i++) { const c = vert(map.tiles[i]); img.data.set([c[0], c[1], c[2], 255], i * 4) }
    ctx.putImageData(img, 0, 0)
    this.bioKey = ''
  }

  /** Les taches d'ÉDEN sur une fenêtre de tuiles, en violet translucide. */
  biomasse(ctx: CanvasRenderingContext2D, st: any, k: number, ox: number, oy: number, w: number, h: number) {
    const m = this.map
    if (!m || m.zoneCarte !== 'continent' || !st.ruches?.length) return
    const r: number[] = []; for (let i = 0; i < RUCHES.length; i++) r.push(st.ruches[i] ?? RUCHES[i].r0)
    const cx = ox + w / 2, cy = oy + h / 2, demi = Math.hypot(w, h) / 2
    const proches = RUCHES.map((hh, i) => ({ hh, rr: r[i] })).filter(({ hh, rr }) => Math.hypot(cx - hh.x, cy - hh.y) < rr * 1.3 + demi)
    if (!proches.length) return
    const pas = k >= 2 ? 1 : 2
    for (let ty = oy; ty < oy + h; ty += pas) for (let tx = ox; tx < ox + w; tx += pas) {
      let e = Infinity
      for (const p of proches) e = Math.min(e, ecartBordure(p.hh, p.rr, tx + 0.5, ty + 0.5))
      if (e >= 0) continue
      ctx.fillStyle = e > -1.2 ? 'rgba(232,130,255,0.85)' : 'rgba(150,40,170,0.42)'
      ctx.fillRect((tx - ox) * k, (ty - oy) * k, k * pas, k * pas)
    }
  }

  /** Avant-postes, créatures, habitants, repères de quête, soldats. */
  /** les gares ouvertes pour la lignée (le monorail : lignes en service, tronçons morts) */
  garesOuv: string[] = []
  /** les cadres des noms écrits sur la grande carte (pixels du canevas), pour ne pas les couper en la centrant */
  noms: { x0: number; y0: number; x1: number; y1: number }[] = []
  overlay(ctx: CanvasRenderingContext2D, st: any, mySid: string, k: number, ox: number, oy: number, markers?: Repere[]) {
    const X = (tx: number) => (tx - ox) * k, Y = (ty: number) => (ty - oy) * k
    const s = Math.max(2, k)
    // le monorail : la ligne du Col et celle de l'Ouest, en service en clair, mortes en pointillé rouille
    if (this.map?.carte === 'ossara') {
      const ouv = (id: string) => this.garesOuv.includes(id) || !!STATION_BY_ID[id]?.ouverte
      for (const t of TRONCONS) {
        const vif = ouv(t.a) && ouv(t.b)
        ctx.save()
        ctx.lineWidth = Math.max(1.5, k * 0.6); ctx.lineJoin = 'round'
        ctx.strokeStyle = vif ? (t.ligne === 'col' ? '#7fd6ff' : '#b8e8ff') : '#8a5a3a'
        ctx.setLineDash(vif ? [] : [k * 1.5, k * 1.5])
        ctx.beginPath()
        t.pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x + 0.5), Y(y + 0.5)) : ctx.moveTo(X(x + 0.5), Y(y + 0.5))))
        ctx.stroke()
        ctx.restore()
      }
      for (const g of STATIONS) {
        ctx.fillStyle = '#000'; ctx.fillRect(X(g.x + 0.5) - s - 1, Y(g.y + 0.5) - s - 1, 2 * s + 2, 2 * s + 2)
        ctx.fillStyle = ouv(g.id) ? '#7fd6ff' : '#5a4a44'; ctx.fillRect(X(g.x + 0.5) - s, Y(g.y + 0.5) - s, 2 * s, 2 * s)
      }
    }
    st.outposts?.forEach((o: any) => {
      ctx.fillStyle = '#000'; ctx.fillRect(X(o.x / TILE) - s - 1, Y(o.y / TILE) - s - 1, 2 * s + 2, 2 * s + 2)
      ctx.fillStyle = o.actif ? '#7fd6ff' : '#4a5a72'; ctx.fillRect(X(o.x / TILE) - s, Y(o.y / TILE) - s, 2 * s, 2 * s)
    })
    st.enemies?.forEach((e: any) => {
      const boss = e.kind === 4 || e.kind === 12
      ctx.fillStyle = boss ? '#ff3b5c' : e.elite ? '#ffd36b' : '#ff6ad8'
      const z = boss ? 3 * s : s
      ctx.fillRect(X(e.x / TILE) - z / 2, Y(e.y / TILE) - z / 2, z, z)
    })
    st.npcs?.forEach((n: any) => { if (n.act === 4) return; ctx.fillStyle = '#e8f0c0'; ctx.fillRect(X(n.x / TILE) - s / 2, Y(n.y / TILE) - s / 2, s, s) })
    for (const q of markers ?? []) {
      if (q.g) { // un habitant : son signe, en couleur, cerné de noir
        const fs = Math.max(8, Math.round(k * 4 / 8) * 8)
        ctx.font = `${fs}px Pochoir, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(q.g, X(q.x), Y(q.y) - s)
        ctx.fillStyle = q.c; ctx.fillText(q.g, X(q.x), Y(q.y) - s)
        continue
      }
      ctx.fillStyle = '#000'; ctx.fillRect(X(q.x) - s - 1, Y(q.y) - s - 1, 2 * s + 2, 2 * s + 2); ctx.fillStyle = q.c; ctx.fillRect(X(q.x) - s, Y(q.y) - s, 2 * s, 2 * s)
    }
    st.players?.forEach((p: any, sid: string) => {
      if (p.etat === 2) return
      const moi = sid === mySid
      const z = (moi ? 3 : 2) * Math.max(1, k / 1.5)
      if (moi) { ctx.fillStyle = '#000'; ctx.fillRect(X(p.x / TILE) - z / 2 - 1, Y(p.y / TILE) - z / 2 - 1, z + 2, z + 2) }
      ctx.fillStyle = moi ? '#ffffff' : p.bot ? '#9fc3d9' : '#ffd36b'
      ctx.fillRect(X(p.x / TILE) - z / 2, Y(p.y / TILE) - z / 2, z, z)
    })
  }

  draw(st: any, mySid: string, me: { x: number; y: number }, markers?: Repere[]) {
    if (!this.map) return
    const ctx = this.cv.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#0b150b'; ctx.fillRect(0, 0, this.cv.width, this.cv.height)
    const vw = Math.min(this.vw, this.map.w), vh = Math.min(this.vh, this.map.h)
    const ox = Math.max(0, Math.min(this.map.w - vw, Math.round(me.x / TILE - vw / 2)))
    const oy = Math.max(0, Math.min(this.map.h - vh, Math.round(me.y / TILE - vh / 2)))
    ctx.drawImage(this.base, ox, oy, vw, vh, 0, 0, vw * 2, vh * 2)
    this.biomasse(ctx, st, 2, ox, oy, vw, vh)
    this.overlay(ctx, st, mySid, 2, ox, oy, markers)
  }

  /** La grande carte : tout le continent (ou la carte reliée), régions, lieux, gares, sas, ruches, avant-postes. */
  full(cv: HTMLCanvasElement, st: any, mySid: string, markers: Repere[], gares: string[] = []) {
    const m = this.map!
    const k = Math.max(2, Math.min(6, Math.floor(900 / Math.max(m.w, m.h))))
    cv.width = m.w * k; cv.height = m.h * k
    const ctx = cv.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(this.base, 0, 0, m.w * k, m.h * k)
    this.biomasse(ctx, st, k, 0, 0, m.w, m.h)
    // les lignes de balayage de l'écran vert
    ctx.fillStyle = 'rgba(0,0,0,0.16)'; for (let y = 0; y < cv.height; y += 3) ctx.fillRect(0, y, cv.width, 1)
    // les noms ne se chevauchent pas : posés par ordre d'importance, chacun glisse en haut ou en bas
    // jusqu'à trouver une place libre (sinon, un nom secondaire n'est pas écrit)
    const poses: { x0: number; y0: number; x1: number; y1: number }[] = []
    this.noms = poses
    const libre = (b: { x0: number; y0: number; x1: number; y1: number }) => b.x0 >= 0 && b.x1 <= cv.width && b.y0 >= 0 && b.y1 <= cv.height && poses.every((o) => b.x1 <= o.x0 || b.x0 >= o.x1 || b.y1 <= o.y0 || b.y0 >= o.y1)
    const texte = (s: string | string[], x: number, y: number, col: string | string[], taille: number | number[] = 16, oblige = false) => {
      const lignes = Array.isArray(s) ? s : [s], tailles = lignes.map((_, i) => Array.isArray(taille) ? taille[i] : taille)
      const cols = lignes.map((_, i) => Array.isArray(col) ? col[i] : col)
      let w = 0
      for (let i = 0; i < lignes.length; i++) { ctx.font = `${tailles[i]}px Pochoir, monospace`; w = Math.max(w, ctx.measureText(lignes[i]).width) }
      const h = tailles.reduce((a, b) => a + b + 2, 0)
      for (const dy of [0, -1, 1, -2, 2, -3, 3].map((d) => d * (h / 2 + 2))) {
        const b = { x0: x - w / 2 - 3, x1: x + w / 2 + 3, y0: y + dy - h / 2 - 1, y1: y + dy + h / 2 + 1 }
        if (!libre(b) && !(oblige && dy === 3 * (h / 2 + 2))) continue
        poses.push(b)
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        let yy = b.y0 + 1
        for (let i = 0; i < lignes.length; i++) {
          ctx.font = `${tailles[i]}px Pochoir, monospace`
          const cy = yy + (tailles[i] + 2) / 2
          ctx.lineWidth = tailles[i] >= 16 ? 4 : 3; ctx.strokeStyle = '#000'; ctx.strokeText(lignes[i], x, cy); ctx.fillStyle = cols[i]; ctx.fillText(lignes[i], x, cy)
          yy += tailles[i] + 2
        }
        return
      }
    }
    const img = (nom: string, x: number, y: number, z = 16) => ctx.drawImage(iconeToile(nom), Math.round(x - z / 2), Math.round(y - z / 2), z, z)
    if (m.carte === 'ossara') {
      const lieux = LIEUX.filter((l) => l.habite || ['port', 'epave', 'casse', 'ruines', 'mine'].includes(l.id))
      for (const l of lieux) { ctx.strokeStyle = l.id === 'port' ? '#7fd6ff' : '#d8ffc0'; ctx.lineWidth = 1; ctx.strokeRect(l.x0 * k + 0.5, l.y0 * k + 0.5, (l.x1 - l.x0) * k, (l.y1 - l.y0) * k) }
      // d'abord Port-Ancre et les lieux, puis les ruches, puis les grandes régions là où il reste de la place
      for (const l of [...lieux].sort((a, b) => Number(b.id === 'port') - Number(a.id === 'port'))) texte(t(`lieu.${l.id}.nom`), (l.x0 + l.x1) / 2 * k, l.y0 * k - 7, l.id === 'port' ? '#7fd6ff' : '#f0f0d8', 8, true)
      for (const h of RUCHES) texte(t(`lieu.${h.id}.nom`), h.x * k, h.y * k, '#f0b8ff', 8, true)
      for (const r of REGIONS) texte([t(`region.${r.id}.nom`).toUpperCase(), t('ui.niv', { n: `${r.niveau[0]}-${r.niveau[1]}` })], r.centre[0] * k, r.centre[1] * k - 14, ['#d8ffc0', '#7fbf62'], [16, 8])
      for (const s of STATIONS) {
        const ouverte = s.ouverte || gares.includes(s.id)
        img('gare', s.x * k, s.y * k, k >= 3 ? 16 : 12)
        if (!ouverte) { ctx.strokeStyle = '#ff6a5a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x * k - 6, s.y * k - 6); ctx.lineTo(s.x * k + 6, s.y * k + 6); ctx.stroke() }
      }
    }
    for (const p of m.passages) {
      ctx.strokeStyle = '#ff9b3d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x * k + k / 2, p.y * k + k / 2, 7, 0, Math.PI * 2); ctx.stroke()
      texte(t(`passage.${p.id}.nom`), p.x * k, p.y * k + 16, '#ffd36b', 8, true)
    }
    this.overlay(ctx, st, mySid, k, 0, 0, markers)
    // les PV partagés des avant-postes
    st.outposts?.forEach((o: any) => {
      if (!o.maxHp) return
      const x = o.x / TILE * k, y = o.y / TILE * k
      ctx.fillStyle = '#000'; ctx.fillRect(x - 11, y - 12, 22, 4); ctx.fillStyle = '#7fd6ff'; ctx.fillRect(x - 10, y - 11, 20 * o.hp / o.maxHp, 2)
    })
  }
}

// --------------------------------------------------------------- les objets
export function itemHtml(it: Item, icon: string, extra = '') {
  const r = RARETES[it.r] ?? RARETES[0]
  const stats = statsObjet(it)
  return `<div class="objet"><img src="${icon}" alt=""><div class="objet-txt"><b style="color:${r.couleur}">${esc(nomObjet(it))}${it.n > 1 ? ` ×${it.n}` : ''}</b><small>${metaObjet(it)}</small>${stats.length ? `<small class="stats">${stats.join(' · ')}</small>` : ''}</div>${extra}</div>`
}
/** Une case d'objet (sac, équipement) : icône, cadre aux couleurs de la rareté, nombre. */
export function caseHtml(it: Item | undefined, icon: string, attrs = '', choisi = false) {
  if (!it) return `<div class="case vide" ${attrs}></div>`
  return `<button class="case${choisi ? ' choisi' : ''}" data-r="${it.r ?? 0}" ${attrs} title="${esc(nomObjet(it))}"><img src="${icon}" alt="">${it.n > 1 ? `<span class="n">${it.n}</span>` : ''}</button>`
}
/** La fiche d'un objet : nom en couleur de rareté, niveau, statistiques, effet légendaire, ensemble (pièces portées). */
export function ficheHtml(it: Item, extra = '', porte: Equip = {}) {
  const r = RARETES[it.r] ?? RARETES[0]
  const stats = statsObjet(it)
  let eff = ''
  if (it.leg && LEG_BY_ID[it.leg]) eff = `<small class="leg">${esc(t(`legendaire.${it.leg}.desc`))}</small>`
  if (it.set && SET_BY_ID[it.set]) {
    const n = piecesSet(porte)[it.set] ?? 0, e = SET_BY_ID[it.set]
    const deux = Object.entries(e.deux).map(([k, v]) => `+${v}${t(`stat.${k}`)}`).join(' · ')
    eff = `<small class="set">${esc(t(`ensemble.${it.set}.nom`))} (${n}/4)</small><small class="${n >= 2 ? 'set' : ''}">${t('ui.sac.set_deux', { b: deux })}</small><small class="${n >= 4 ? 'set' : ''}">${t('ui.sac.set_quatre', { b: esc(t(`ensemble.${it.set}.quatre`)) })}</small>`
  }
  return `<div class="fiche"><b style="color:${r.couleur}">${esc(nomObjet(it))}${it.n > 1 ? ` ×${it.n}` : ''}</b>
    <small>${metaObjet(it)}</small>
    ${stats.length ? `<small class="stats">${stats.join(' · ')}</small>` : ''}${eff}${extra}</div>`
}
/** La comparaison avec l'objet porté au même endroit : ce qu'on gagne (vert) et ce qu'on perd (rouge). */
export function compareHtml(it: Item, porte: Item | undefined) {
  if (!porte) return `<small class="cmp plus">${t('ui.sac.emplacement_vide')}</small>`
  const l: string[] = []
  for (const k of STAT_KEYS) {
    const d = Math.round(((it.s[k] ?? 0) - (porte.s[k] ?? 0)) * 10) / 10
    if (d) l.push(`<span class="${d > 0 ? 'plus' : 'moins'}">${d > 0 ? '+' : ''}${d}${t(`stat.${k}`)}</span>`)
  }
  if (porte.leg && porte.leg !== it.leg) l.push(`<span class="moins">− ${esc(nomObjet(porte))}</span>`)
  return `<small class="cmp">${t('ui.sac.compare', { nom: esc(nomObjet(porte)) })} ${l.length ? l.join(' · ') : t('ui.sac.pareil')}</small>`
}

// --------------------------------------------------------------- choix de classe
export function classPicker(selected: ClassId | null, portraits: Record<string, string>, compact = false) {
  return `<div class="classes${compact ? ' compact' : ''}">${CLASS_IDS.map((id) => {
    const c = CLASSES[id]
    return `<button class="classe${selected === id ? ' choisie' : ''}" data-a="classe" data-cls="${id}">
      <div class="tete"><img src="${portraits[id] ?? ''}" alt=""><div><b>${t(`classe.${id}.nom`)}</b><div class="arme">${esc(t(`classe.${id}.arme`))} · ${t('ui.hud.pv', { n: c.pv })}</div></div></div>
      ${c.competences.map((k) => `<div class="competence"><img src="${icone(ICONE_COMP[k.id] ?? 'action')}" alt=""><span>${esc(t(`competence.${k.id}.nom`))} <i>${esc(t(`competence.${k.id}.desc`))}</i></span></div>`).join('')}</button>`

  }).join('')}</div>`
}
