// L'arène de la Couveuse, côté téléphone : la caméra d'arène (en paysage, l'arène large tient à l'écran), la chair qui
// referme la porte puis les côtés, le sol arraché, les zones propres à la Couveuse (damier, colonnes, anneaux), et
// les balles des motifs, calculées ici avec le même code que le serveur (shared/motifs.ts).
import Phaser from 'phaser'
import { TILE, NEST } from '../../shared/consts.ts'
import { E } from '../../shared/rules.ts'
import { CARTES, type CarteId } from '../../shared/monde.ts'
import { ARENE, ARENE_COLS, ARENE_ROWS, RETRECI, RETRECI_BAS, SOL, balles, posBalle, borneArene, clampArene, type Motif } from '../../shared/motifs.ts'
import { TILESET } from './pixel.ts'
import type { GameScene } from './scene.ts'
import { tx, type Texte } from '../../shared/i18n/index.ts'

const NOM_BALLE = ['balle-acide', 'balle-spore', 'balle-eden']
const LUEUR = [0xb6ff4a, 0xffd040, 0xff6bd8]

interface MotifV { m: Motif; recu: number; dt: number; mortes: Set<number>; spr: Map<number, { s: Phaser.GameObjects.Sprite; h: Phaser.GameObjects.Image }>; fin: number }
interface ZoneV { f: string; ev: any; t: number; total: number; deco?: Phaser.GameObjects.Sprite | null }

export class AreneVue {
  sc: GameScene
  etat = 0
  phase = 1
  sol = new Uint8Array(ARENE_COLS * ARENE_ROWS)
  motifs: MotifV[] = []
  libres: { s: Phaser.GameObjects.Sprite; h: Phaser.GameObjects.Image }[] = []
  murs: Phaser.GameObjects.Image[] = []
  mursCles = ''
  bulles = new Map<number, Phaser.GameObjects.Sprite>()
  gSol: Phaser.GameObjects.Graphics
  gZones: Phaser.GameObjects.Graphics
  gMurs: Phaser.GameObjects.Graphics
  zones: ZoneV[] = []
  voile: Phaser.GameObjects.Rectangle
  zoom = 0
  actifCam = false
  anneau!: Phaser.GameObjects.Image
  chevron!: Phaser.GameObjects.Image
  point!: Phaser.GameObjects.Image
  fleche!: Phaser.GameObjects.Image
  cache: Phaser.GameObjects.Rectangle[] = []
  /** diagnostic (window.heirline.scene().arene.diag) : motifs reçus, balles dessinées à cette image, au plus */
  diag = { motifs: 0, touches: 0, dessinees: 0, max: 0, dernierT: 0, avance: 0 }

  constructor(sc: GameScene) {
    this.sc = sc
    this.gSol = sc.add.graphics().setDepth(-980)
    this.gZones = sc.add.graphics().setDepth(-900)
    this.gMurs = sc.add.graphics().setDepth(5400)
    this.voile = sc.add.rectangle(0, 0, 10, 10, 0xffffff, 0).setOrigin(0, 0).setDepth(7000)
    // une tuile de chair pour les murs qui poussent
    if (!sc.textures.exists('murchair')) {
      const t = sc.textures.createCanvas('murchair', 16, 16)!
      t.getContext().drawImage(sc.tileset, TILESET.CHAIR_HAUT * 16, 0, 16, 16, 0, 0, 16, 16)
      t.refresh()
    }
    this.reperes()
  }

  get ferme() { return this.etat === 1 }
  /** le boss de cette arène (couveuse, engloutisseur, gueule) : la teinte des murs */
  profil = 'couveuse'
  get borne() { return borneArene(this.phase) }
  dedans(x: number, y: number) { return x > ARENE.x0 + 4 && x < ARENE.x1 && y > ARENE.y0 && y < ARENE.y1 }
  /** au nid, dans l'enclos, ou combat en cours : la caméra tient l'arène */
  surCarte() { return !!CARTES[this.sc.map?.carte as CarteId]?.arene }

  /** la prédiction du soldat : la même borne que le serveur */
  clamp(s: { x: number; y: number }) { if (this.ferme && this.surCarte()) clampArene(s, this.borne) }

  // ------------------------------------------------------------------ messages
  etatRecu(a: any) {
    const avant = this.etat, phAvant = this.phase, solAvant = this.sol.slice()
    this.etat = a.e; this.phase = a.ph; this.profil = a.pf ?? 'couveuse'
    for (let i = 0; i < this.sol.length; i++) this.sol[i] = Number(a.sol?.[i] ?? 0)
    if (!this.ferme) for (const mv of this.motifs) this.rendreMotif(mv)
    if (!this.ferme) this.motifs = []
    // une case qui vient d'être arrachée : la chair jaillit
    for (let i = 0; i < this.sol.length; i++) if ((this.sol[i] === SOL.ACIDE || this.sol[i] === SOL.VIDE) && solAvant[i] === SOL.FISSURE) {
      const [x, y] = this.centreCase(i)
      this.sc.vfx.joue('sol-arrache', x, y, { depth: -970 })
      this.sc.events.emit('son', 'sol_arrache', x, y)
    }
    // la chair qui ferme l'enclos, puis les murs qui avancent
    if ((avant === 0 && this.etat === 1) || (phAvant < 2 && this.phase >= 2)) this.sc.events.emit('son', 'mur_chair')
    if (avant !== this.etat || phAvant !== this.phase) this.majMurs(avant === 0 && this.etat === 1, phAvant < 2 && this.phase >= 2)
    this.dessineSol()
  }

  nouveau(m: { arene: any; motifs: any[] }) {
    for (const mv of this.motifs) this.rendreMotif(mv)
    this.motifs = []
    this.etatRecu(m.arene)
    for (const x of m.motifs ?? []) this.motif(x)
  }

  motif(x: any) {
    const m: Motif = { id: x.id, k: x.k, t0: x.t0, seed: x.seed, x: x.x, y: x.y, a: x.a, n: x.n, p: x.p }
    let fin = 0
    for (const b of balles(m)) fin = Math.max(fin, b.ts + b.life)
    this.motifs.push({ m, recu: performance.now(), dt: x.dt, mortes: new Set(x.mortes ?? []), spr: new Map(), fin: m.t0 + fin })
    this.diag.motifs++
    this.sc.events.emit('son', 'balle_motif', m.x, m.y)
  }

  /** une balle a touché un soldat : elle disparaît là où on la voit */
  touche(x: { m: number; i: number }) {
    const mv = this.motifs.find((v) => v.m.id === x.m)
    if (!mv) return
    mv.mortes.add(x.i)
    this.diag.touches++
    const o = mv.spr.get(x.i)
    if (o) { this.sc.vfx.joue('balle-touche', o.s.x, o.s.y, { depth: 4700 }); this.sc.events.emit('son', 'balle_touche', o.s.x, o.s.y); this.rendre(o); mv.spr.delete(x.i) }
  }

  /** l'éclair blanc avant une grosse attaque, avec un bandeau aux changements de phase */
  flash(x: { x: number; y: number; s?: Texte }) {
    for (const v of this.sc.enemies.values()) if (v.kind === E.COUVEUSE) v.flash = 0.45
    if (x.x) this.sc.vfx.joue('flash-couveuse', x.x, x.y - 8, { depth: 4650, scale: 1.3, add: true })
    this.sc.events.emit('son', x.s ? 'couveuse_cri' : 'flash')
    this.voile.setFillStyle(0xffffff, x.s ? 0.55 : 0.28)
    this.sc.tweens.killTweensOf(this.voile)
    this.sc.tweens.add({ targets: this.voile, fillAlpha: 0, duration: x.s ? 500 : 260, ease: 'Quad.easeOut' })
    if (x.s) this.bandeau(tx(x.s))

    // un tremblement court, seulement pour les grands moments (phases, sacs crevés)
    if (x.s) this.sc.secouer(220, 0.004, true)
  }

  /** une annonce courte en haut, sous la barre du boss : elle ne couvre pas la zone de jeu */
  bandeau(s: string) {
    const hc = document.getElementById('hc')
    if (!hc) return
    document.getElementById('arene-bandeau')?.remove()
    const d = document.createElement('div')
    d.id = 'arene-bandeau'
    d.textContent = s
    hc.appendChild(d)
    setTimeout(() => d.remove(), 2400)
  }

  // ------------------------------------------------------------------ les zones de la Couveuse
  /** une zone annoncée par le serveur : true si c'est une des nôtres */
  tele(ev: any) {
    if (ev.sp === 'glane') { this.zones.push({ f: 'glane', ev, t: ev.t, total: ev.t, deco: null }); return true }
    if (ev.sp === 'semis' || ev.sp === 'greffe' || ev.sp === 'desherbage') {
      // pixelfx : le pommier reste planté tant que la zone dure ; la greffe et la bouture éclosent une fois
      const vfx = this.sc.vfx
      const deco = ev.sp === 'desherbage' ? vfx.joue('pommier', ev.x, ev.y + 6, { depth: ev.y + 6, scale: 1.5 })
        : ev.sp === 'greffe' ? vfx.joue('greffe', ev.x, ev.y, { depth: ev.y - 2, scale: (ev.r * 2) / 78, alpha: 0.85 })
        : vfx.joue('bouture', ev.x, ev.y + 4, { depth: ev.y - 2, scale: (ev.r * 2) / 56 })
      this.zones.push({ f: ev.sp, ev, t: ev.t, total: ev.t, deco: ev.sp === 'semis' ? null : deco })
      return true
    }
    if (ev.f !== 'grille' && ev.f !== 'colonnes' && ev.f !== 'anneau') return false
    this.zones.push({ f: ev.f, ev, t: ev.t, total: ev.t })
    return true
  }

  boom(ev: any) {
    // les zones des Hauts ont chacune leur effet (pixelfx) : on le lit à la cause de la zone
    let k = ''
    try { k = String(JSON.parse(ev.src ?? '{}').k ?? '').replace('srv.tueur.', '') } catch { /* une ancienne zone */ }
    const vfx = this.sc.vfx
    if (ev.f === 'colonnes' && (k === 'vitres' || k === 'pages' || k === 'fils')) {
      const nom = 'colonne-' + k
      for (const c of ev.cols ?? []) for (let y = ev.y + 24, i = 0; y < ev.y2; y += 46, i++) this.sc.time.delayedCall(i * 45, () => vfx.joue(nom, c, y, { depth: y + 8, scale: 0.55 }))
      return true
    }
    if (ev.f === 'ligne' && (k === 'epines' || k === 'rature' || k === 'pylone')) {
      const nom = k === 'pylone' ? 'glane' : k
      const l = Math.hypot(ev.x2 - ev.x, ev.y2 - ev.y), n = Math.max(2, Math.min(16, Math.round(l / 30)))
      for (let i = 0; i <= n; i++) { const x = ev.x + (ev.x2 - ev.x) * i / n, y = ev.y + (ev.y2 - ev.y) * i / n; if (this.dedans(x, y)) this.sc.time.delayedCall(i * 30, () => vfx.joue(nom, x, y, { depth: y + 6, scale: Math.max(0.5, (ev.r ?? 14) / 20) })) }
      return true
    }
    if (ev.f === 'cercle' && (k === 'essaim' || k === 'appel')) { vfx.joue(k === 'essaim' ? 'essaim-pep' : 'appel', ev.x, ev.y, { depth: 4600, scale: (ev.r * 2) / (k === 'essaim' ? 106 : 136) }); return true }
    if (ev.f === 'anneau' && k === 'encre') { vfx.joue('encre-anneau', ev.x, ev.y, { depth: 4600, scale: ev.r / 56 }); return true }
    if (ev.sp === 'desherbage') {
      // tout le sol brûle, sauf sous le pommier
      const bo = borneArene(this.phase)
      for (let y = bo.y0 + 20; y < bo.y1; y += 44) for (let x = bo.x0 + 20; x < bo.x1; x += 52) {
        if (Math.hypot(x - ev.x, y - ev.y) < (ev.r2 ?? 54) + 20) continue
        if (((x + y) / 4) % 2 < 1) this.sc.vfx.joue('case-boum', x, y, { depth: y + 10, scale: 1.2 })
      }
      this.sc.vfx.joue('desherbage', ev.x, ev.y, { depth: 4600, scale: (ev.r2 ?? 54) / 50 })
      return true
    }
    if (ev.f === 'grille') {
      let n = 0
      for (let y = ev.y; y < ev.y2 - 1; y += ev.r) for (let x = ev.x; x < ev.x2 - 1; x += ev.r) {
        if ((Math.floor((x - ev.x) / ev.r) + Math.floor((y - ev.y) / ev.r)) % 2 !== (ev.r2 ?? 0)) continue
        if (n++ % 2 === 0) this.sc.vfx.joue('case-boum', x + ev.r / 2, y + ev.r / 2, { depth: y + ev.r, scale: ev.r / 26 })
      }
    } else if (ev.f === 'colonnes') {
      for (const c of ev.cols ?? []) {
        const s = this.sc.vfx.joue('colonne-spores', c, ev.y2, { depth: 4600 })
        s?.setScale((ev.r * 2) / 22, (ev.y2 - ev.y) / 92)
      }
    } else if (ev.f === 'anneau') {
      this.sc.vfx.joue('anneau-boum', ev.x, ev.y, { depth: 4600, scale: ev.r / 48 })
    } else return false
    return true
  }

  /** les soldats debout dans un cercle (le semis) */
  compte(x: number, y: number, r: number) {
    let n = 0
    this.sc.net?.room?.state?.players?.forEach((q: any) => { if (q.etat === 0 && Math.hypot(q.x - x, q.y - y) < r + 6) n++ })
    return n
  }

  dessineZones(dt: number) {
    const g = this.gZones
    g.clear()
    this.zones = this.zones.filter((z) => { if ((z.t -= dt) > 0) return true; if (z.deco?.texture.key === 'vfx_pommier') this.sc.vfx.lacher(z.deco); return false })
    for (const z of this.zones) {
      const k = 1 - z.t / z.total, ev = z.ev
      const clign = 0.5 + 0.5 * Math.sin(this.sc.time.now / (z.t < 0.5 ? 40 : 90))
      if (z.f === 'grille') {
        for (let y = ev.y; y < ev.y2 - 1; y += ev.r) for (let x = ev.x; x < ev.x2 - 1; x += ev.r) {
          if ((Math.floor((x - ev.x) / ev.r) + Math.floor((y - ev.y) / ev.r)) % 2 !== (ev.r2 ?? 0)) continue
          const w = Math.min(ev.r, ev.x2 - x), h = Math.min(ev.r, ev.y2 - y)
          g.fillStyle(0xff3b5c, 0.12 + 0.14 * k); g.fillRect(x + 1, y + 1, w - 2, h - 2)
          // le remplissage part du centre de chaque case
          g.fillStyle(0xff3b5c, 0.35); g.fillRect(x + w / 2 - w / 2 * k, y + h / 2 - h / 2 * k, w * k, h * k)
          g.lineStyle(1, 0xff7a90, 0.6 + 0.4 * clign); g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3)
        }
      } else if (z.f === 'colonnes') {
        for (const c of ev.cols ?? []) {
          g.fillStyle(0xffd040, 0.1 + 0.12 * k); g.fillRect(c - ev.r, ev.y, ev.r * 2, ev.y2 - ev.y)
          // les spores qui descendent dans la colonne avant l'impact
          g.fillStyle(0xffd040, 0.35); g.fillRect(c - ev.r, ev.y, ev.r * 2, (ev.y2 - ev.y) * k)
          g.lineStyle(1, 0xfff09a, 0.5 + 0.5 * clign); g.strokeRect(c - ev.r, ev.y, ev.r * 2, ev.y2 - ev.y)
          for (let i = 0; i < 6; i++) { const yy = ev.y + ((this.sc.time.now / 4 + i * 70 + c * 3) % (ev.y2 - ev.y)); g.fillStyle(0xfff09a, 0.8); g.fillRect(c - ev.r + 3 + ((i * 7) % (ev.r * 2 - 6)), yy, 2, 2) }
        }
      } else if (z.f === 'semis') {
        // une graine à partager : dorée, avec le compte des soldats dedans sur le nombre requis
        const n = this.compte(ev.x, ev.y, ev.r), ok = n >= (ev.partage ?? 2)
        const c = ok ? 0x9fe07a : 0xffd04a
        g.fillStyle(c, 0.12 + 0.18 * k); g.fillCircle(ev.x, ev.y, ev.r)
        g.lineStyle(2, c, 0.6 + 0.4 * clign); g.strokeCircle(ev.x, ev.y, ev.r)
        g.lineStyle(3, c, 0.9); g.beginPath(); g.arc(ev.x, ev.y, ev.r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); g.strokePath()
        for (let i = 0; i < (ev.partage ?? 2); i++) { g.fillStyle(i < n ? c : 0x3a3020, 1); g.fillCircle(ev.x - ((ev.partage ?? 2) - 1) * 5 + i * 10, ev.y, 3.5) }
      } else if (z.f === 'glane') {
        // la glane : le robot visé est tiré vers la Glaneuse par un câble de sève ; vert s'il est veillé, orange sinon
        const st = this.sc.net?.room?.state
        const r = st?.robots?.get(ev.suit)
        if (r) { ev.x = r.x; ev.y = r.y }
        let veille = false
        st?.players?.forEach((q: any) => { if (q.etat === 0 && Math.hypot(q.x - ev.x, q.y - ev.y) < ev.r + 4) veille = true })
        const c = veille ? 0x7fe0a0 : 0xffa04a
        let bx = ev.x, by = ev.y - 90
        st?.enemies?.forEach((e: any) => { if (e.kind === 24) { bx = e.x; by = e.y } })
        g.lineStyle(2, 0x8a4a8a, 0.8); g.beginPath(); g.moveTo(bx, by + 16); g.lineTo(ev.x, ev.y); g.strokePath()
        g.fillStyle(c, 0.1 + 0.16 * k); g.fillCircle(ev.x, ev.y, ev.r)
        g.lineStyle(2, c, 0.6 + 0.4 * clign); g.strokeCircle(ev.x, ev.y, ev.r)
        g.lineStyle(3, c, 0.9); g.beginPath(); g.arc(ev.x, ev.y, ev.r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); g.strokePath()
      } else if (z.f === 'greffe') {
        // la greffe suit son soldat, puis se fige (comme côté serveur)
        if (z.t > 0.9) { const q = this.sc.net?.room?.state?.players?.get(ev.suit); if (q) { ev.x = q.x; ev.y = q.y } }
        // un effet unique rendu à la réserve peut déjà servir ailleurs : on ne le touche que s'il est encore le nôtre
        if (z.deco?.active && z.deco.texture.key === 'vfx_greffe') z.deco.setPosition(ev.x, ev.y).setDepth(ev.y - 2)
        const moi = ev.suit === this.sc.net?.room?.sessionId
        g.fillStyle(0xb06bff, 0.1 + 0.2 * k); g.fillCircle(ev.x, ev.y, ev.r)
        g.lineStyle(moi ? 3 : 1.5, moi ? 0xffffff : 0xd8b0ff, 0.6 + 0.4 * clign); g.strokeCircle(ev.x, ev.y, ev.r)
      } else if (z.f === 'desherbage') {
        // tout brûle sauf sous le pommier : un voile rouge sur l'arène, le cercle vert du pommier par-dessus
        const bo = borneArene(this.phase)
        g.fillStyle(0xff3b2c, 0.06 + 0.16 * k); g.fillRect(bo.x0, bo.y0, bo.x1 - bo.x0, bo.y1 - bo.y0)
        g.fillStyle(0x6be07a, 0.25 + 0.1 * clign); g.fillCircle(ev.x, ev.y, ev.r2 ?? 54)
        g.lineStyle(3, 0xc8ffb0, 0.9); g.strokeCircle(ev.x, ev.y, ev.r2 ?? 54)
        // le pommier lui-même est l'effet pixelfx « pommier », planté à l'annonce (voir tele)
      } else if (z.f === 'anneau') {
        const r = (ev.r + (ev.r2 ?? 0)) / 2, th = ev.r - (ev.r2 ?? 0)
        g.lineStyle(th, 0xff6bd8, 0.14 + 0.16 * k); g.strokeCircle(ev.x, ev.y, r)
        g.lineStyle(th * k, 0xff6bd8, 0.35); g.strokeCircle(ev.x, ev.y, r)
        g.lineStyle(1, 0xffc0f0, 0.6 + 0.4 * clign); g.strokeCircle(ev.x, ev.y, ev.r); g.strokeCircle(ev.x, ev.y, ev.r2 ?? 0)
      }
    }
  }

  // ------------------------------------------------------------------ murs et sol
  majMurs(fermeture: boolean, resserre: boolean) {
    const cles: [number, number][] = []
    if (this.ferme) {
      for (let y = NEST.doorY0; y <= NEST.doorY1; y++) cles.push([NEST.x0, y])
      if (this.phase >= 2) {
        for (let y = NEST.y0 + 1; y < NEST.y1; y++) for (let k = 1; k <= RETRECI; k++) cles.push([NEST.x0 + k, y], [NEST.x1 - k, y])
        for (let y = NEST.y1 - RETRECI_BAS; y < NEST.y1; y++) for (let x = NEST.x0 + 1 + RETRECI; x < NEST.x1 - RETRECI; x++) cles.push([x, y])
      }
    }
    const cle = cles.map((c) => c.join(',')).join(';')
    if (cle === this.mursCles) return
    this.mursCles = cle
    for (const m of this.murs) m.destroy()
    this.murs = []
    // le bord vivant de la chair : une lisière rose qui pulse, pour lire d'un coup d'œil où l'arène s'arrête
    const g = this.gMurs
    g.clear()
    if (this.ferme) {
      const bandes: [number, number, number, number][] = [[NEST.x0 * TILE, NEST.doorY0 * TILE, TILE, (NEST.doorY1 - NEST.doorY0 + 1) * TILE]]
      const hy = (NEST.y1 - NEST.y0 - 1 - RETRECI_BAS) * TILE
      if (this.phase >= 2) bandes.push([(NEST.x0 + 1) * TILE, (NEST.y0 + 1) * TILE, RETRECI * TILE, hy], [(NEST.x1 - RETRECI) * TILE, (NEST.y0 + 1) * TILE, RETRECI * TILE, hy])
      for (const [x, y, w, h] of bandes) {
        g.fillStyle(0x1a0820, 0.55); g.fillRect(x, y, w, h)
        const bord = x < (NEST.x0 + NEST.x1) / 2 * TILE ? x + w : x
        g.fillStyle(0xff6bd8, 0.85); g.fillRect(bord - 1, y, 2, h)
        g.fillStyle(0xff6bd8, 0.25); g.fillRect(bord - 4, y, 8, h)
      }
      // le bas qui remonte : une lisière horizontale
      if (this.phase >= 2) {
        const x = (NEST.x0 + 1 + RETRECI) * TILE, w = (NEST.x1 - NEST.x0 - 1 - 2 * RETRECI) * TILE, y = (NEST.y1 - RETRECI_BAS) * TILE
        g.fillStyle(0x1a0820, 0.55); g.fillRect((NEST.x0 + 1) * TILE, y, (NEST.x1 - NEST.x0 - 1) * TILE, RETRECI_BAS * TILE)
        g.fillStyle(0xff6bd8, 0.85); g.fillRect(x - 1, y - 1, w + 2, 2)
        g.fillStyle(0xff6bd8, 0.25); g.fillRect(x - 4, y - 4, w + 8, 8)
      }
      g.setAlpha(0)
      this.sc.tweens.killTweensOf(g)
      this.sc.tweens.add({ targets: g, alpha: 1, duration: 500, delay: 300 })
      this.sc.tweens.add({ targets: g, alpha: 0.7, duration: 700, yoyo: true, repeat: -1, delay: 800, ease: 'Sine.easeInOut' })
    }
    cles.forEach(([tx, ty], i) => {
      const x = tx * TILE + 8, y = ty * TILE + 8
      const img = this.sc.add.image(x, y + 8, 'murchair').setOrigin(0.5, 1).setDepth(y + 8).setTint(this.profil === 'engloutisseur' ? 0x7a8a5a : this.profil === 'gueule' ? 0xd07a6a : this.profil === 'semeur' ? 0xb8b070 : this.profil === 'pepiniere' ? 0x7ab08a : this.profil === 'greffier' ? 0x9a90b8 : this.profil === 'glaneuse' ? 0xb08a6a : 0xe090c8)
      this.murs.push(img)
      const neuf = (fermeture && tx === NEST.x0) || (resserre && tx !== NEST.x0)
      if (neuf) {
        img.setScale(1, 0)
        this.sc.tweens.add({ targets: img, scaleY: 1, duration: 380, delay: (i % 30) * 22, ease: 'Back.easeOut' })
        if (i % 2 === 0) this.sc.time.delayedCall((i % 30) * 22, () => this.sc.vfx.joue('mur-pousse', x, y + 8, { depth: y + 9 }))
      }
    })
  }

  centreCase(i: number): [number, number] { return [ARENE.x0 + (i % ARENE_COLS) * TILE + 8, ARENE.y0 + Math.floor(i / ARENE_COLS) * TILE + 8] }

  dessineSol() {
    const g = this.gSol
    g.clear()
    const garder = new Set<number>()
    for (let i = 0; i < this.sol.length; i++) {
      const s = this.sol[i]
      if (!s) continue
      const x = ARENE.x0 + (i % ARENE_COLS) * TILE, y = ARENE.y0 + Math.floor(i / ARENE_COLS) * TILE
      if (s === SOL.FISSURE) {
        g.fillStyle(0x3a0a20, 0.55); g.fillRect(x, y, 16, 16)
        g.lineStyle(1, 0xff6bd8, 0.9)
        g.lineBetween(x + 2, y + 8, x + 7, y + 6); g.lineBetween(x + 7, y + 6, x + 10, y + 11); g.lineBetween(x + 10, y + 11, x + 15, y + 8)
      } else if (s === SOL.ACIDE) {
        g.fillStyle(0x25400f, 1); g.fillRect(x, y, 16, 16)
        g.fillStyle(0x6fa81e, 0.9); g.fillRect(x + 1, y + 1, 14, 14)
        g.fillStyle(0xa8e030, 0.8); g.fillRect(x + 3, y + 3, 6, 3)
        garder.add(i)
        if (!this.bulles.has(i)) { const b = this.sc.add.sprite(x + 8, y + 8, 'vfx_sol-bulles').setDepth(-969).play('vfx_sol-bulles'); b.anims.setProgress(Math.random()); this.bulles.set(i, b) }
      } else if (s === SOL.VIDE) {
        g.fillStyle(0x05020a, 1); g.fillRect(x, y, 16, 16)
        g.fillStyle(0x1a0820, 1); g.fillRect(x, y, 16, 3)
        g.lineStyle(1, 0x6e1f6a, 0.9); g.strokeRect(x + 0.5, y + 0.5, 15, 15)
      }
    }
    for (const [i, b] of this.bulles) if (!garder.has(i)) { b.destroy(); this.bulles.delete(i) }
  }

  // ------------------------------------------------------------------ les balles
  prendre(c: number) {
    const o = this.libres.pop() ?? { s: this.sc.add.sprite(0, 0, '__DEFAULT'), h: this.sc.add.image(0, 0, 'halo').setBlendMode(Phaser.BlendModes.ADD) }
    o.s.setVisible(true).setActive(true).setDepth(4500).play(`vfx_${NOM_BALLE[c]}`)
    o.h.setVisible(true).setTint(LUEUR[c]).setScale(0.32).setAlpha(0.55).setDepth(4499)
    return o
  }
  rendre(o: { s: Phaser.GameObjects.Sprite; h: Phaser.GameObjects.Image }) { o.s.stop().setVisible(false).setActive(false); o.h.setVisible(false); this.libres.push(o) }
  rendreMotif(mv: MotifV) { for (const o of mv.spr.values()) this.rendre(o); mv.spr.clear() }

  /** à chaque image : le temps du monde vu par ce téléphone, en avance d'un aller-retour (comme notre soldat prédit) */
  maj(dt: number) {
    const now = performance.now(), ping = (this.sc.net?.ping ?? 0) / 1000
    let dessinees = 0
    this.motifs = this.motifs.filter((mv) => {
      const t = mv.m.t0 - mv.dt + (now - mv.recu) / 1000 + ping
      if (t > mv.fin + 0.1) { this.rendreMotif(mv); return false }
      const bs = balles(mv.m)
      for (let i = 0; i < bs.length; i++) {
        if (mv.mortes.has(i)) continue
        const p = posBalle(mv.m, bs[i], t)
        let o = mv.spr.get(i)
        if (!p) { if (o) { this.rendre(o); mv.spr.delete(i) } continue }
        if (!o) { o = this.prendre(bs[i].c); mv.spr.set(i, o) }
        o.s.setPosition(p.x, p.y); o.h.setPosition(p.x, p.y)
        dessinees++
      }
      this.diag.dernierT = t; this.diag.avance = t - mv.m.t0
      return true
    })
    this.diag.dessinees = dessinees; this.diag.max = Math.max(this.diag.max, dessinees)
    this.dessineZones(dt)
    const cam = this.sc.cameras.main
    const v = cam.worldView
    this.voile.setPosition(v.x, v.y).setSize(v.width, v.height)
  }

  /** Les repères du joueur et de la caméra d'arène : un anneau sous son soldat, un chevron au-dessus, le point de
   *  touche (2 px) au centre, une flèche au bord quand la Couveuse sort du champ, et le noir autour de l'enclos. */
  reperes() {
    const sc = this.sc
    const tex = (cle: string, w: number, h: number, f: (c: CanvasRenderingContext2D) => void) => {
      if (sc.textures.exists(cle)) return
      const t = sc.textures.createCanvas(cle, w, h)!
      f(t.getContext()); t.refresh()
    }
    tex('moi-anneau', 24, 12, (c) => {
      c.strokeStyle = '#2a1600'; c.lineWidth = 3; c.beginPath(); c.ellipse(12, 6, 10, 4.5, 0, 0, Math.PI * 2); c.stroke()
      c.strokeStyle = '#ffd23a'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(12, 6, 10, 4.5, 0, 0, Math.PI * 2); c.stroke()
    })
    tex('moi-chevron', 9, 7, (c) => {
      c.fillStyle = '#2a1600'; c.beginPath(); c.moveTo(0, 0); c.lineTo(9, 0); c.lineTo(4.5, 7); c.fill()
      c.fillStyle = '#ffd23a'; c.beginPath(); c.moveTo(1.6, 1); c.lineTo(7.4, 1); c.lineTo(4.5, 5.4); c.fill()
    })
    tex('moi-point', 7, 7, (c) => {
      c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(3.5, 3.5, 3.4, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(3.5, 3.5, 2, 0, Math.PI * 2); c.fill()
    })
    tex('fleche-boss', 14, 10, (c) => {
      c.fillStyle = '#2a0620'; c.beginPath(); c.moveTo(7, 0); c.lineTo(14, 10); c.lineTo(0, 10); c.fill()
      c.fillStyle = '#ff6bd8'; c.beginPath(); c.moveTo(7, 2); c.lineTo(11.6, 9); c.lineTo(2.4, 9); c.fill()
    })
    this.anneau = sc.add.image(0, 0, 'moi-anneau').setVisible(false)
    this.chevron = sc.add.image(0, 0, 'moi-chevron').setDepth(6600).setScale(1.3).setVisible(false)
    this.point = sc.add.image(0, 0, 'moi-point').setDepth(6600).setScale(0.5).setVisible(false)
    this.fleche = sc.add.image(0, 0, 'fleche-boss').setDepth(6600).setVisible(false)
    // le hors-arène : de la chair sombre, opaque (pas le monde, ni la pluie)
    const L = 4000, x0 = NEST.x0 * TILE, x1 = (NEST.x1 + 1) * TILE, y0 = NEST.y0 * TILE, y1 = (NEST.y1 + 1) * TILE
    this.cache = [
      sc.add.rectangle(x0 - L, y0 - L, L, 2 * L + y1 - y0, 0x0c0410),
      sc.add.rectangle(x1, y0 - L, L, 2 * L + y1 - y0, 0x0c0410),
      sc.add.rectangle(x0, y0 - L, x1 - x0, L, 0x0c0410),
      sc.add.rectangle(x0, y1, x1 - x0, L, 0x0c0410),
    ].map((r) => r.setOrigin(0, 0).setDepth(6500).setVisible(false))
  }

  /** Le zoom de l'arène : en paysage, toute l'arène à l'écran (la Couveuse et le soldat toujours en vue, le soldat à
   *  ~70 % de sa taille dans le monde ouvert) ; tenu droit, le soldat reste lisible et la caméra suit sur les côtés. */
  zoomCible(cam: Phaser.Cameras.Scene2D.Camera) {
    const dpr = cam.width / Math.max(1, innerWidth) // le canevas est en pixels de l'appareil
    const w = (NEST.x1 - NEST.x0 + 1) * TILE - 8, h = (NEST.y1 - NEST.y0 + 1) * TILE - 16
    // au bureau (souris, grand écran), l'arène remplit l'écran jusqu'au zoom du monde ouvert
    return Math.max(1.6 * dpr, Math.min(Math.max(2.6 * dpr, this.sc.zoomLevel), cam.width / w, cam.height / h))
  }

  /** La caméra d'arène : centrée sur l'enclos quand il tient à l'écran, sinon elle suit le soldat en douceur, bornée à
   *  l'enclos, et remonte vers la Couveuse dès que le soldat le permet. Faux si elle n'a pas à tenir l'arène. */
  cadre(cam: Phaser.Cameras.Scene2D.Camera, meX: number, meY: number, dt: number) {
    const actif = this.surCarte() && (this.ferme || this.dedans(meX, meY))
    this.anneau.setVisible(actif); this.chevron.setVisible(actif); this.point.setVisible(actif)
    for (const r of this.cache) r.setVisible(actif && this.ferme)
    if (!actif) {
      this.fleche.setVisible(false)
      if (this.actifCam) { this.actifCam = false; this.zoom = 0; cam.setZoom(this.sc.zoomLevel); cam.useBounds = true; document.body.classList.remove('arene') }
      return false
    }
    const premier = !this.actifCam
    this.actifCam = true
    cam.useBounds = false
    document.body.classList.add('arene')
    const cible = this.zoomCible(cam)
    this.zoom = this.zoom ? this.zoom + (cible - this.zoom) * Math.min(1, dt * 4) : cible
    cam.setZoom(this.zoom)
    const W = cam.width / this.zoom, H = cam.height / this.zoom
    // l'enclos, avec un bout de ses murs
    const B = { x0: NEST.x0 * TILE + 6, x1: (NEST.x1 + 1) * TILE - 6, y0: NEST.y0 * TILE + 10, y1: (NEST.y1 + 1) * TILE - 6 }
    let cx: number, cy: number
    if (W >= B.x1 - B.x0) cx = (B.x0 + B.x1) / 2
    else cx = Math.max(B.x0 + W / 2, Math.min(B.x1 - W / 2, meX))
    if (H >= B.y1 - B.y0) cy = (B.y0 + B.y1) / 2
    else {
      // le haut de l'écran : au plus haut (la Couveuse en vue), tant que le soldat reste au-dessus des trois quarts
      const haut = Math.max(B.y0, Math.min(B.y1 - H, meY - H * 0.74))
      cy = haut + H / 2
    }
    const tx = cx - cam.width / 2, ty = cy - cam.height / 2
    const k = premier ? 1 : Math.min(1, dt * 5)
    cam.scrollX += (tx - cam.scrollX) * k
    cam.scrollY += (ty - cam.scrollY) * k
    // qui je suis
    const t = this.sc.time.now / 1000
    this.anneau.setPosition(meX, meY + 5).setDepth(meY - 0.5).setAlpha(0.85 + 0.15 * Math.sin(t * 5))
    this.chevron.setPosition(meX, meY - 21 + Math.round(Math.sin(t * 4) * 1.5))
    this.point.setPosition(meX, meY)
    // la Couveuse hors champ : une flèche au bord de l'écran
    const boss = [...this.sc.enemies.values()].find((v) => v.kind === E.COUVEUSE)
    const v = cam.worldView, m = 8 / this.zoom
    if (boss && boss.c.visible) {
      const bx = boss.c.x, by = boss.c.y
      const dehors = bx < v.x || bx > v.x + v.width || by < v.y || by > v.y + v.height
      this.fleche.setVisible(dehors)
      if (dehors) {
        const fx = Math.max(v.x + m * 2, Math.min(v.x + v.width - m * 2, bx)), fy = Math.max(v.y + m * 2, Math.min(v.y + v.height - m * 2, by))
        this.fleche.setPosition(fx, fy).setRotation(Math.atan2(by - fy, bx - fx) + Math.PI / 2).setScale(1.4 / this.zoom * 2)
      }
    } else this.fleche.setVisible(false)
    return true
  }

  vider() {
    for (const mv of this.motifs) this.rendreMotif(mv)
    for (const z of this.zones) if (z.deco?.texture.key === 'vfx_pommier') this.sc.vfx.lacher(z.deco)
    this.motifs = []; this.zones = []; this.etat = 0; this.phase = 1; this.sol.fill(0)
    this.majMurs(false, false); this.dessineSol(); this.gZones.clear()
  }
}
