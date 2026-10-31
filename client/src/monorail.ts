// Le monorail de la Première Vague, à l'écran : le rail surélevé sur ses piliers (mort et abîmé vers les haltes pas
// encore réparées), et les rames en route sur cette copie de la carte. Le serveur n'envoie que le départ (le soldat, les
// gares du chemin, le temps écoulé) : la marche de la rame se calcule ici avec le même code (shared/monorail.ts).
import Phaser from 'phaser'
import { TILE } from '../../shared/consts.ts'
import { T } from '../../shared/tiles.ts'
import { STATION_BY_ID, STATIONS } from '../../shared/monde.ts'
import { TRONCONS, GARES_MER, RAIL_H, ligneTroncon, surLigne, longueur, trajet, etatRame, type Trajet, type EtatRame } from '../../shared/monorail.ts'
import * as ui from './ui.ts'
import { t } from '../../shared/i18n/index.ts'
import type { GameScene } from './scene.ts'

const nom = (id: string) => STATION_BY_ID[id] ? t(`station.${id}.nom`) : id
const LIGNE = { col: 'ui.rail.ligne_col', ouest: 'ui.rail.ligne_ouest', glane: 'ui.rail.ligne_glane', mer: 'ui.rail.ligne_mer' }

interface RameV {
  sid: string; tr: Trajet; recu: number; e: number
  c: Phaser.GameObjects.Container; caisse: Phaser.GameObjects.Sprite; dedans: Phaser.GameObjects.Image; soldat: Phaser.GameObjects.Sprite
  phare: Phaser.GameObjects.Image; mer?: boolean
  fumeeT: number; etat: EtatRame | null; annonce: string; abord: boolean
}

export class RailVue {
  sc: GameScene
  objets: Phaser.GameObjects.GameObject[] = []
  cle = ''
  rames = new Map<string, RameV>()
  zoomK = 1

  constructor(sc: GameScene) { this.sc = sc }

  /** Le rail et ses piliers, sur le continent ; les tronçons vers une halte fermée sont morts (rouille, poutres tombées). */
  construire(ouvertes: string[]) {
    const sc = this.sc
    const cle = sc.map?.carte === 'ossara' ? ouvertes.slice().sort().join(',') : '-'
    if (cle === this.cle) return
    this.cle = cle
    for (const o of this.objets) o.destroy()
    this.objets = []
    if (sc.map?.carte !== 'ossara') return
    const ouv = (id: string) => ouvertes.includes(id) || !!STATION_BY_ID[id]?.ouverte
    const pres = (x: number, y: number) => STATIONS.some((g) => Math.hypot(g.x * TILE + 8 - x, g.y * TILE + 13 - y) < 26)
    const eau = (x: number, y: number) => { const t = sc.map.tiles[Math.floor(y / TILE) * sc.map.w + Math.floor(x / TILE)]; return t === T.EAU || t === T.MER }
    TRONCONS.forEach((t, ti) => {
      if (t.ligne === 'mer') return // la barge : ni rail ni piliers
      const mort = !(ouv(t.a) && ouv(t.b))
      const l = ligneTroncon(t)
      // la poutre, en morceaux de 24 px (un tronçon mort en a perdu quelques-uns, et ceux qui restent penchent)
      for (let i = 1; i < l.x.length; i++) {
        const x0 = l.x[i - 1], y0 = l.y[i - 1], x1 = l.x[i], y1 = l.y[i]
        const L = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0)
        const n = Math.max(1, Math.round(L / 24))
        for (let k = 0; k < n; k++) {
          const h = (ti * 977 + i * 131 + k * 37) % 11
          if (mort && h < 2) continue
          const m = (k + 0.5) / n
          const piece = sc.add.tileSprite(x0 + (x1 - x0) * m, y0 + (y1 - y0) * m - RAIL_H, L / n + 1, 6, mort ? 'rail_poutre_mort' : 'rail_poutre')
            .setRotation(a + (mort && h < 4 ? (h - 2.5) * 0.06 : 0)).setDepth(5200)
          this.objets.push(piece)
        }
      }
      // les piliers, tous les 44 px, pas dans l'eau ni sous les gares
      const Lt = longueur(l)
      for (let s = 22; s < Lt - 10; s += 44) {
        const p = surLigne(l, s)
        if (pres(p.x, p.y) || eau(p.x, p.y)) continue
        const h = Math.floor(s) % 7
        const pil = sc.add.image(p.x, p.y + 1, mort ? 'rail_pilier_mort' : 'rail_pilier').setOrigin(0.5, 1).setDepth(p.y)
        if (mort && h < 2) pil.setRotation((h - 0.5) * 0.12)
        this.objets.push(pil)
      }
    })
  }

  /** Une rame part (ou est déjà en route, pour un client qui arrive) : ids les gares du chemin, e le temps écoulé. */
  depart(m: { sid: string; ids: string[]; e: number }) {
    this.retirer(m.sid)
    const tr = trajet(m.ids[0], m.ids[m.ids.length - 1], (id) => m.ids.includes(id))
    if (!tr) return
    const sc = this.sc
    const cls = sc.net.room.state.players?.get(m.sid)?.cls ?? 0
    const dedans = sc.add.image(0, 0, 'rame_dedans').setOrigin(0.5, 0)
    const soldat = sc.add.sprite(0, 0, `soldat${cls}`, 0).setVisible(false)
    const caisse = sc.add.sprite(0, 0, 'rame_cote', 0).setOrigin(0.5, 0)
    const c = sc.add.container(0, 0, [dedans, soldat, caisse]).setDepth(5210)
    const phare = sc.add.image(0, 0, 'halo').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe9a0).setAlpha(0.55).setScale(0.9).setDepth(4000)
    const mer = GARES_MER.has(m.ids[0])
    if (mer) { caisse.setTexture('barge', 0); dedans.setTexture('barge_dedans') }
    this.rames.set(m.sid, { sid: m.sid, tr, recu: performance.now(), e: m.e, c, caisse, dedans, soldat, phare, fumeeT: 0, etat: null, annonce: '', abord: false, mer })
  }

  retirer(sid: string) {
    const r = this.rames.get(sid)
    if (!r) return
    r.c.destroy(); r.phare.destroy()
    this.rames.delete(sid)
    if (sid === this.sc.net.room?.sessionId) document.getElementById('rail-annonce')?.remove()
  }

  /** le soldat est dans une rame (on le cache, ainsi que son robot : ils voyagent dedans) */
  aBord(sid: string) { return !!this.rames.get(sid)?.etat?.abord }

  vider() { for (const sid of [...this.rames.keys()]) this.retirer(sid); this.cle = '' }

  /** Un pas : les rames avancent, la caméra suit la nôtre (le point à suivre, ou null). */
  maj(dt: number): { x: number; y: number } | null {
    const sc = this.sc
    this.construire(sc.garesOuvertes)
    const moi = sc.net.room?.sessionId
    let suivre: { x: number; y: number } | null = null
    const t = sc.time.now / 1000
    for (const r of [...this.rames.values()]) {
      const el = r.e + (performance.now() - r.recu) / 1000 + sc.net.ping / 2000
      const e = etatRame(r.tr, el)
      if (e.phase === 'fini' && el > r.tr.total + 1.2) { this.retirer(r.sid); continue }
      r.etat = e
      if (r.mer) { this.majBarge(r, e, el, t, dt); if (r.sid === moi) { if (e.abord || e.phase === 'voyage') suivre = { x: e.x, y: e.y + 4 }; this.annoncer(r, e) } r.abord = e.abord; continue }
      const vue = Math.abs(Math.sin(e.a)) > 0.8 ? (Math.sin(e.a) > 0 ? 'face' : 'dos') : 'cote'
      const ouvert = e.portes > 0.5 ? 1 : 0
      if (vue === 'cote') {
        const g = Math.cos(e.a) < 0
        r.caisse.setTexture('rame_cote', ouvert).setFlipX(g)
        r.dedans.setTexture('rame_dedans').setFlipX(g)
        r.c.setRotation(Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(g ? e.a - Math.PI : e.a), -0.32, 0.32))
        r.soldat.setPosition(g ? 9 : -9, 12).setFlipX(g)
      } else {
        r.caisse.setTexture('rame_face', vue === 'face' ? 0 : 1).setFlipX(false)
        r.dedans.setTexture('rame_face_dedans').setFlipX(false)
        r.c.setRotation(0)
        r.soldat.setPosition(0, 12).setFlipX(false)
      }
      // le roulis, plus fort en vitesse ; la rame qui s'efface après avoir déposé
      const k = Math.min(1, e.v / 160)
      r.c.rotation += Math.sin(t * 9 + r.recu) * 0.025 * k
      r.c.setPosition(e.x, e.y - RAIL_H + Math.sin(t * 13) * 0.6 * k)
      r.c.setAlpha(e.phase === 'fini' ? Math.max(0, 1 - (el - r.tr.total) / 1.2) : e.phase === 'approche' ? Math.min(1, el / 0.6) : 1)
      r.soldat.setVisible(e.abord)
      // les phares : une flaque de lumière sur le sol devant la rame
      r.phare.setVisible(e.phase !== 'fini').setPosition(e.x + Math.cos(e.a) * 34, e.y + Math.sin(e.a) * 34)
      // les étincelles du rail (plus au freinage), la vapeur qui fuit des tôles
      if (e.v > 50 && Math.random() < dt * (4 + e.v / 60)) sc.spark(e.x - Math.cos(e.a) * 12, e.y - RAIL_H + 2, 0xffd27a, 2, 0.5)
      // pixelfx : une gerbe d'étincelles sur le rail de temps en temps, plus souvent au freinage
      if (e.v > 30 && Math.random() < dt * (e.phase === 'approche' ? 3 : 0.8)) sc.vfx.joue('rail', e.x - Math.cos(e.a) * 12, e.y - RAIL_H + 2, { angle: e.a + Math.PI, depth: (e.y ?? 0) + 40 })
      if ((e.phase === 'approche' || (e.phase === 'voyage' && e.v < 140)) && e.v > 10 && Math.random() < dt * 10) sc.spark(e.x + Math.cos(e.a) * 14, e.y - RAIL_H + 2, 0xfff0b0, 3, 0.7)
      if ((r.fumeeT -= dt) <= 0 && e.phase !== 'fini') {
        r.fumeeT = e.v > 20 ? 0.18 : 0.6
        const f = sc.add.image(e.x - Math.cos(e.a) * 20, e.y - RAIL_H + 6, 'halo').setTint(0xb8bec4).setAlpha(0.45).setScale(0.25).setDepth(5215)
        sc.tweens.add({ targets: f, y: f.y - 14, x: f.x - Math.cos(e.a) * 10, alpha: 0, scale: 0.7, duration: 900, onComplete: () => f.destroy() })
      }
      if (r.sid === moi) {
        if (e.abord || e.phase === 'voyage') suivre = { x: e.x, y: e.y - RAIL_H + 14 }
        this.annoncer(r, e)
      }
      r.abord = e.abord
    }
    // la caméra recule un peu pendant le trajet
    const cible = suivre ? 0.72 : 1
    const avant = this.zoomK
    this.zoomK += (cible - this.zoomK) * Math.min(1, dt * 2.5)
    if (Math.abs(this.zoomK - 1) < 0.003) this.zoomK = 1
    if (this.zoomK !== 1 || avant !== 1) sc.cameras.main.setZoom(sc.zoomLevel * this.zoomK)
    return suivre
  }

  /** La barge : toujours vue de côté, elle tangue sur la houle et laisse un sillage d'écume (pas d'étincelles de rail). */
  majBarge(r: RameV, e: EtatRame, el: number, t: number, dt: number) {
    const sc = this.sc
    const g = Math.cos(e.a) < 0
    r.caisse.setTexture('barge', e.portes > 0.5 ? 1 : 0).setFlipX(g)
    r.dedans.setFlipX(g)
    r.soldat.setPosition(g ? 4 : -4, 6).setFlipX(g).setVisible(e.abord)
    r.c.setRotation(Math.sin(t * 1.7 + r.recu) * 0.05)
    r.c.setPosition(e.x, e.y - 14 + Math.sin(t * 2.3) * 1.2)
    r.c.setAlpha(e.phase === 'fini' ? Math.max(0, 1 - (el - r.tr.total) / 1.2) : e.phase === 'approche' ? Math.min(1, el / 0.6) : 1)
    r.phare.setVisible(false)
    if ((r.fumeeT -= dt) <= 0 && e.phase !== 'fini') {
      r.fumeeT = e.v > 20 ? 0.12 : 0.7
      // l'écume derrière la coque, et un peu de fumée de la cheminée
      const f = sc.add.image(e.x - Math.cos(e.a) * 22, e.y + 8, 'halo').setTint(0xe8f4ff).setAlpha(0.5).setScale(0.22, 0.12).setDepth(5205)
      sc.tweens.add({ targets: f, alpha: 0, scaleX: 0.6, duration: 1100, onComplete: () => f.destroy() })
      if (Math.random() < 0.5) {
        const fu = sc.add.image(e.x + (g ? 10 : -10), e.y - 14, 'halo').setTint(0x9aa0a6).setAlpha(0.4).setScale(0.2).setDepth(5215)
        sc.tweens.add({ targets: fu, y: fu.y - 16, alpha: 0, scale: 0.6, duration: 1000, onComplete: () => fu.destroy() })
      }
    }
  }

  /** Les annonces de la rame : la ligne, les gares traversées, le terminus ; parfois, une vieille annonce enregistrée. */
  annoncer(r: RameV, e: EtatRame) {
    let s = ''
    const ligne = t(LIGNE[(TRONCONS.find((x) => (x.a === r.tr.ids[0] && x.b === r.tr.ids[1]) || (x.b === r.tr.ids[0] && x.a === r.tr.ids[1]))?.ligne) ?? 'col'])
    if (e.phase === 'approche') s = t('ui.rail.entre', { ligne })
    else if (e.phase === 'montee') s = t('ui.rail.direction', { ligne, gare: nom(r.tr.vers) })
    else if (e.phase === 'voyage') s = e.prochain === r.tr.vers ? t('ui.rail.prochain', { gare: nom(r.tr.vers) }) : t('ui.rail.sans_arret', { gare: nom(e.prochain) })
    else if (e.phase === 'descente') s = t('ui.rail.terminus', { gare: nom(r.tr.vers) })
    if (s === r.annonce) return
    r.annonce = s
    if (e.phase === 'montee' && Math.floor(r.recu) % 3 === 0) ui.log(t('ui.rail.vieille_annonce'), '#9fc3d9')

    const hc = document.getElementById('hc')
    if (!hc || !s) return
    document.getElementById('rail-annonce')?.remove()
    const d = document.createElement('div')
    d.id = 'rail-annonce'
    d.textContent = s
    hc.appendChild(d)
  }
}
