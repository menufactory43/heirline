// La scène de jeu : le monde en morceaux de 32 × 32 tuiles (dessinés à la demande, la biomasse suit le front),
// les arbres et les toits qui s'effacent quand on passe dessous, les habitants, la faune et ÉDEN, les tirs,
// les annonces d'attaques, les effets, le jour et la nuit, la pluie et la brume, les lumières.
import Phaser from 'phaser'
import { TILE, nightOf } from '../../shared/consts.ts'
import { RUCHES, ecartBordure, sousBiomasse, zoneAt, type OutpostLike } from '../../shared/front.ts'
import { T, D, isSolidTile, zoneIdAt, lieuAt, type GameMap, type Building } from '../../shared/map.ts'
import { lieuAt as lieuDefAt } from '../../shared/regions/index.ts'
import { CLASSES, CLASS_IDS, ENEMIES, E } from '../../shared/rules.ts'
import { NPC_BY_ID } from '../../shared/npcs.ts'
import { t, tx, type Texte } from '../../shared/i18n/index.ts'
import { makeTextures, TILESET, PAL } from './pixel.ts'
import { npcSheet, roofTexture } from './pixel2.ts'
import { Vfx, palier, classeVfx } from './vfx.ts'
import { AreneVue } from './arene.ts'
import { RailVue } from './monorail.ts'
import type { Net } from './net.ts'
import type { Controls } from './controls.ts'

/** les boss : grande barre de vie, nom en capitales, halo */
const BOSS_KINDS = new Set<number>([E.COUVEUSE, E.ENGLOUTISSEUR, E.GUEULE, E.SEMEUR, E.PEPINIERE, E.GREFFIER, E.GLANEUSE])
const KIND_TEX: Record<number, string> = {
  [E.RAMPANT]: 'rampant', [E.CRACHEUR]: 'cracheur', [E.CUIRASSE]: 'cuirasse', [E.OEUF]: 'oeuf', [E.COUVEUSE]: 'couveuse',
  [E.BROUTARD]: 'broutard', [E.RODEUR]: 'rodeur', [E.FOUGERODE]: 'fougerode', [E.SANGSUE]: 'sangsue', [E.GONFLE]: 'gonfle',
  [E.ROUILLARD]: 'rouillard', [E.GREFFE]: 'greffe', [E.ENGLOUTISSEUR]: 'engloutisseur', [E.CORNEFEUILLE]: 'cornefeuille', [E.SAC]: 'sac',
  // la Gueule : le corps de la Couveuse, retaillé et teint (voir enemyView)
  [E.GUEULE]: 'couveuse',
  // le Semeur : un greffé (un Jardinier), bien plus grand, teint de sève dorée
  [E.SEMEUR]: 'greffe',
  [E.PEPINIERE]: 'pepiniere', [E.GREFFIER]: 'greffier', [E.GLANEUSE]: 'glaneuse',
  // les Hauts de Glane (campagne 2)
  [E.GLANEUR]: 'glaneur', [E.RETOURNE]: 'retourne', [E.BOURGEON]: 'bourgeon', [E.BOUTURE]: 'bouture', [E.FILEUSE]: 'fileuse',
  [E.POT]: 'pot', [E.BALISE]: 'balise', [E.PORTENOM]: 'portenom', [E.PYLONE]: 'pylone',
}
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) }
const hash2 = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0 }
const CH = 32 // tuiles par morceau
// la police pixel du jeu (public/pochoir.woff2) : 16 px réduits au quart, un pixel de lettre = un demi-pixel du monde
const TXT = { fontFamily: 'Pochoir, monospace', fontSize: '16px', stroke: '#000', strokeThickness: 4 }

interface PView { dash?: boolean; c: Phaser.GameObjects.Container; body: Phaser.GameObjects.Sprite; gun: Phaser.GameObjects.Image; bar: Phaser.GameObjects.Rectangle; barBg: Phaser.GameObjects.Rectangle; label?: Phaser.GameObjects.Text; bubble: Phaser.GameObjects.Image; lx: number; ly: number; walk: number; flash: number; cls: number }
interface RView { c: Phaser.GameObjects.Container; body: Phaser.GameObjects.Sprite; mode: number; label?: Phaser.GameObjects.Text; bar: Phaser.GameObjects.Rectangle; barBg: Phaser.GameObjects.Rectangle }
interface EView { c: Phaser.GameObjects.Container; body: Phaser.GameObjects.Sprite; bar: Phaser.GameObjects.Rectangle; barBg: Phaser.GameObjects.Rectangle; lx: number; seed: number; flash: number; shield?: Phaser.GameObjects.Image; tag?: Phaser.GameObjects.Text; tagY: number; kind: number; frames: number; aura?: Phaser.GameObjects.Image; tagNom?: string }
interface NView { c: Phaser.GameObjects.Container; body: Phaser.GameObjects.Sprite; gun?: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; mark: Phaser.GameObjects.Image; walk: number; lx: number; ly: number; small: boolean }
interface BView { s: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite; t0: number; x0: number; y0: number; vx: number; vy: number; trail: number; imp?: string; life?: number; col?: number; rare?: number }
interface Local { s: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite; x: number; y: number; vx: number; vy: number; life: number; imp: string; col: number; rare: number; trail: number }
/** le style des tirs d'un soldat : sa classe, son palier de niveau, la rareté de son arme */
interface Style { tir: string; imp: string; bouche: string; col: number; rare: number; life: number }
const TRAINE: Record<string, number> = { fan: 0xffc04a, med: 0x8dff8a, ing: 0x6fe0ff, ecl: 0xd8f4ff, dem: 0xff8a3a, bro: 0xc48bff, rob: 0x7fd6ff }
interface TeleV { deco?: Phaser.GameObjects.Sprite | null; g: Phaser.GameObjects.Graphics; f: string; x: number; y: number; x2: number; y2: number; r: number; t: number; total: number; ami: boolean }
interface Light { x: number; y: number; r: number; a?: number }
interface Chunk { cx: number; cy: number; img: Phaser.GameObjects.Image; tex: Phaser.Textures.CanvasTexture; objs: Phaser.GameObjects.GameObject[]; trees: { img: Phaser.GameObjects.Image; x: number; y: number }[]; bio: string; nodes: { id: string; img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image }[] }
interface RoofV { b: Building; img: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; top: number; alpha: number }
interface BubbleV { c: Phaser.GameObjects.Container; id: string; t: number; w: number; h: number }

export class GameScene extends Phaser.Scene {
  net!: Net
  controls!: Controls
  map!: GameMap
  kind: 'secteur' | 'concession' = 'secteur'
  chunks = new Map<string, Chunk>()
  tileset!: HTMLCanvasElement
  players = new Map<string, PView>()
  robots = new Map<string, RView>()
  enemies = new Map<string, EView>()
  npcs = new Map<string, NView>()
  bullets = new Map<string, BView>()
  locals: Local[] = []
  teles: TeleV[] = []
  flashes: Light[] = []
  roofs: RoofV[] = []
  bubbles: BubbleV[] = []
  pannes: { id: string; type: string; x: number; y: number; img: Phaser.GameObjects.Image }[] = []
  dark!: Phaser.Textures.CanvasTexture
  darkImg!: Phaser.GameObjects.Image
  glows: Phaser.GameObjects.Image[] = []
  glowN = 0
  parts!: Phaser.GameObjects.Particles.ParticleEmitter
  vfx!: Vfx
  /** l'arène de la Couveuse (carte du nid) */
  arene!: AreneVue
  rail!: RailVue
  /** les effets qui durent (bouclier, surcharge, veille d'un avant-poste), par porteur ; rendus quand il disparaît */
  auras = new Map<string, Phaser.GameObjects.Sprite>()
  aurasVues = new Set<string>()
  /** les chiffres de dégâts d'une même créature se cumulent au lieu de s'empiler */
  degats = new Map<EView, { t: Phaser.GameObjects.Text; n: number; fin: number }>()
  sporesT = 0
  bioT = 2
  gareT = 0
  dernierNom = ''
  smoke!: Phaser.GameObjects.Particles.ParticleEmitter
  rain: { img: Phaser.GameObjects.Image; x: number; y: number; v: number }[] = []
  mist: Phaser.GameObjects.Image[] = []
  flies: { img: Phaser.GameObjects.Image; x: number; y: number; a: number; t: number }[] = []
  zoomLevel = 3
  autoX = 0
  autoY = 0
  localCd = 0
  assist = 1 // 0 aucune, 1 légère, 2 forte
  myNum = 0
  hurt = 0
  onFrame: (info: { x: number; y: number; zone: string }) => void = () => {}
  markerFor: (npc: string) => 'dispo' | 'encours' | 'rendre' | null = () => null
  ready = false
  lastAim = 0
  markers: Phaser.GameObjects.GameObject[] = []
  /** l'état du robot de la lignée (message « moi ») : réparé, il attend visiblement à l'atelier */
  etatRobot = ''
  robotAtelier: Phaser.GameObjects.Image | null = null
  lamps: { x: number; y: number }[] = []
  smokeT = 0
  forceHeure: number | null = null
  gares: { id: string; img: Phaser.GameObjects.Image; ouverte: boolean }[] = []
  /** les gares remises en service par la lignée (message « moi ») */
  garesOuvertes: string[] = []

  constructor() { super('jeu') }

  preload() { Vfx.charger(this) }

  create() {
    makeTextures(this)
    this.tileset = this.textures.get('tuiles').getSourceImage() as HTMLCanvasElement
    this.parts = this.add.particles(0, 0, 'px', { lifespan: { min: 180, max: 420 }, speed: { min: 30, max: 120 }, scale: { start: 1, end: 0 }, emitting: false })
    this.parts.setDepth(5000)
    this.vfx = new Vfx(this)
    this.arene = new AreneVue(this)
    this.rail = new RailVue(this)
    this.smoke = this.add.particles(0, 0, 'fumee', { lifespan: { min: 2200, max: 3400 }, speedY: { min: -14, max: -8 }, speedX: { min: 2, max: 7 }, scale: { start: 0.8, end: 2.4 }, alpha: { start: 0.55, end: 0 }, emitting: false })
    this.smoke.setDepth(5600)
    this.dark = this.textures.createCanvas('nuit', 320, 180)!
    this.darkImg = this.add.image(0, 0, 'nuit').setOrigin(0, 0).setDepth(6000)
    for (let i = 0; i < 90; i++) this.rain.push({ img: this.add.image(0, 0, 'goutte').setDepth(6200).setVisible(false).setScale(1, 1.6), x: Math.random(), y: Math.random(), v: 0.9 + Math.random() * 0.4 })
    for (let i = 0; i < 7; i++) this.mist.push(this.add.image(0, 0, 'brume').setDepth(6150).setVisible(false).setScale(3, 2.2))
    for (let i = 0; i < 16; i++) this.flies.push({ img: this.add.image(0, 0, 'luciole').setDepth(6300).setBlendMode(Phaser.BlendModes.ADD).setVisible(false), x: 0, y: 0, a: Math.random() * 6, t: Math.random() * 6 })
    this.cameras.main.setBackgroundColor('#0b0d12')
    this.scale.on('resize', () => this.fitZoom())
    this.fitZoom()
    this.ready = true
    this.events.emit('pret')
  }

  /** Tremblements d'écran (réglage, localStorage heirline.tremblements) : 0 aucun, 1 réduits (par défaut : seulement
   *  les grands moments), 2 normaux. Jamais sur les tirs ni les coups reçus (un liseré rouge à la place) ; dans l'arène,
   *  seulement les grands moments ; intensité plafonnée et au moins 0,8 s entre deux tremblements. */
  tremblements = Number(localStorage.getItem('heirline.tremblements') ?? 1)
  derniereSecousse = -1e9
  secouer(ms: number, force: number, grand = false) {
    if (this.tremblements === 0) return
    if (!grand && (this.tremblements === 1 || this.arene?.actifCam)) return
    const now = this.time.now
    if (now - this.derniereSecousse < 800) return
    this.derniereSecousse = now
    const k = this.tremblements === 1 ? 0.6 : 1
    this.cameras.main.shake(Math.min(ms, 350), Math.min(force, 0.006) * k)
  }

  fitZoom() {
    const h = this.scale.height
    // un zoom entier : ~190 px de jeu en hauteur, les soldats se voient bien sur un téléphone en paysage
    this.zoomLevel = Math.max(2, Math.round(h / 190))
    if (!this.arene?.actifCam) this.cameras.main.setZoom(this.zoomLevel * (this.rail?.zoomK ?? 1))
    this.cameras.main.setRoundPixels(true)
  }

  // --------------------------------------------------------------- la carte
  buildMap(map: GameMap, kind: 'secteur' | 'concession') {
    for (const ch of this.chunks.values()) this.dropChunk(ch)
    this.chunks.clear()
    for (const v of [...this.players.values(), ...this.robots.values(), ...this.enemies.values(), ...this.npcs.values()]) v.c.destroy()
    for (const b of this.bullets.values()) this.rendre(b.s)
    for (const l of this.locals) this.rendre(l.s)
    this.locals = []
    for (const t of this.teles) { t.g.destroy(); this.vfx.lacher(t.deco) }
    this.teles = []
    for (const s of this.auras.values()) this.vfx.lacher(s)
    this.auras.clear()
    for (const r of this.roofs) { r.img.destroy(); r.label.destroy() }
    for (const p of this.pannes) p.img.destroy()
    this.players.clear(); this.robots.clear(); this.enemies.clear(); this.bullets.clear(); this.npcs.clear()
    this.arene?.vider()
    this.rail?.vider()
    this.roofs = []; this.pannes = []
    this.map = map; this.kind = kind
    this.lamps = []
    for (let i = 0; i < map.w * map.h; i++) if (map.deco[i] === D.LAMPE && !map.monde) this.lamps.push({ x: (i % map.w) * TILE + 8, y: Math.floor(i / map.w) * TILE + 3 })
    if (map.monde) {
      this.lamps.push(...map.monde.lampes)
      for (const b of map.monde.batiments) {
        const key = `toit_${b.id}`
        roofTexture(this, key, b)
        const southDoor = b.porte.y === b.y + b.h - 1
        const top = southDoor ? b.y - 1 : b.y
        const img = this.add.image(b.x * TILE - 2, top * TILE - 2, key).setOrigin(0, 0).setDepth((b.y + b.h - 1) * TILE)
        const label = this.add.text((b.x + b.w / 2) * TILE, top * TILE + 4, t(`batiment.${b.id}.nom`).toUpperCase(), { ...TXT, fontSize: '16px', color: '#ffe9b0' }).setOrigin(0.5, 0).setScale(0.25).setDepth(5550).setAlpha(0)
        this.roofs.push({ b, img, label, top, alpha: 1 })
      }
      for (const p of map.monde.pannes) {
        const img = p.type === 'lampe' ? this.add.image(p.x, p.y + 6, 'tuiles').setCrop((TILESET.DECO + D.LAMPE) * 16, 0, 16, 16).setOrigin((TILESET.DECO + D.LAMPE) * 16 / this.tileset.width + 0.5 / (this.tileset.width / 16), 1) : this.add.image(p.x, p.y + 8, 'balise').setOrigin(0.5, 1)
        if (p.type === 'lampe') { img.destroy(); const l = this.lampImage(p.x, p.y + 8); this.pannes.push({ id: p.id, type: p.type, x: p.x, y: p.y, img: l }); continue }
        img.setDepth(p.y + 8)
        this.pannes.push({ id: p.id, type: p.type, x: p.x, y: p.y, img })
      }
    }
    this.cameras.main.setBounds(0, 0, map.w * TILE, map.h * TILE)
    for (const m of this.markers) m.destroy()
    this.markers = []
    this.gares = []
    const mark = (q: { x: number; y: number }, txt: string, color: number, css: string) => {
      const halo = this.add.image(q.x, q.y, 'halo').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45).setScale(0.9).setDepth(-900)
      this.tweens.add({ targets: halo, alpha: 0.2, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      const lb = this.add.text(q.x, q.y - 14, txt, { ...TXT, color: css }).setOrigin(0.5, 1).setScale(0.25).setDepth(5500)
      this.markers.push(halo, lb)
    }
    if (map.carte === 'ossara') {
      const p = map.points
      mark(p.atelier, t('ui.scene.atelier'), 0x7fd6ff, '#7fd6ff')
      mark(p.porte, t('ui.scene.porte'), 0xc48bff, '#d6a8ff')
      mark(p.tableau, t('ui.scene.tableau'), 0xff6b6b, '#ff9fae')
      // les gares du monorail
      for (const g of map.stations) {
        const x = g.x * TILE + 8, y = g.y * TILE + 14
        const img = this.add.image(x, y, g.ouverte ? 'gare_on' : 'gare_off').setOrigin(0.5, 1).setDepth(y)
        const lb = this.add.text(x, y - 36, t(`station.${g.id}.nom`).toUpperCase(), { ...TXT, color: '#7fd6ff' }).setOrigin(0.5, 1).setScale(0.25).setDepth(5500)
        this.markers.push(img, lb)
        this.gares.push({ id: g.id, img, ouverte: !!g.ouverte })
      }
    }
    // les sas vers les cartes reliées
    for (const pa of map.passages) mark({ x: pa.x * TILE + 8, y: pa.y * TILE + 8 }, t(`passage.${pa.id}.nom`).toUpperCase(), 0xff9b3d, '#ffd36b')
  }

  /** Une lampe sur pied, image découpée dans l'atlas des tuiles. */
  lampImage(x: number, y: number) {
    const key = 'lampe_pied'
    if (!this.textures.exists(key)) {
      const t = this.textures.createCanvas(key, 16, 16)!
      t.getContext().drawImage(this.tileset, (TILESET.DECO + D.LAMPE) * 16, 0, 16, 16, 0, 0, 16, 16)
      t.refresh()
    }
    return this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y)
  }

  /** L'image d'une tuile (sol + ombre + décor) pour le rendu d'un morceau. */
  tileIndex(x: number, y: number): number {
    const m = this.map, w = m.w
    const t = m.tiles[y * w + x]
    const solid = (xx: number, yy: number) => xx < 0 || yy < 0 || xx >= w || yy >= m.h || isSolidTile(m.tiles[yy * w + xx])
    const h = hash2(x, y), v = h % 4, v2 = h % 2
    const face = !solid(x, y + 1)
    switch (t) {
      case T.ROC: return face ? TILESET.ROC_FACE + v2 : TILESET.ROC_HAUT + v2
      case T.METAL: return face ? TILESET.METAL_FACE + v2 : TILESET.METAL_HAUT + v2
      case T.CAISSE: return TILESET.CAISSE
      case T.EPAVE: return TILESET.EPAVE + (solid(x, y + 1) ? 1 : 0)
      case T.DALLE: return TILESET.DALLE + v2
      case T.ROUTE: return (x + y) % 3 === 0 && m.tiles[y * w + x - 1] === T.ROUTE ? TILESET.ROUTE_LIGNE : TILESET.ROUTE
      case T.CHAIR: return face ? TILESET.CHAIR_FACE + v2 : TILESET.CHAIR_HAUT + v2
      case T.NIDSOL: return TILESET.NIDSOL + v2
      case T.HERBE: return TILESET.HERBE + v
      case T.MOUSSE: return TILESET.MOUSSE + v
      case T.BOUE: return TILESET.BOUE + v
      case T.EAU: return y > 0 && !isSolidTile(m.tiles[(y - 1) * w + x]) && m.tiles[(y - 1) * w + x] !== T.EAU ? TILESET.EAU_BORD : TILESET.EAU + v
      case T.FERRAILLE: return TILESET.FERRAILLE + v
      case T.PAVE: return TILESET.PAVE + v2
      case T.PLANCHER: {
        // une porte : l'ouverture dans un mur de façade
        if (m.tiles[y * w + x - 1] === T.MURB && m.tiles[y * w + x + 1] === T.MURB) return face ? TILESET.PORTE : TILESET.PLANCHER + v2
        return TILESET.PLANCHER + v2
      }
      case T.MURP: return face ? TILESET.MURP_FACE + v2 : TILESET.MURP_HAUT + v2
      case T.MURB: {
        if (!face) return TILESET.MURB_HAUT + v2
        const b = this.map.monde?.batiments.find((bb) => x >= bb.x && x < bb.x + bb.w && y === bb.y + bb.h - 1)
        if (b && b.fenetres.some((f) => f.x === x)) return TILESET.MURB_FENETRE
        return TILESET.MURB_FACE + v2
      }
      case T.CHAMP: return TILESET.CHAMP + (hash2(x >> 2, y >> 2) % 2)
      case T.CLOTURE: return m.tiles[y * w + x - 1] === T.CLOTURE || m.tiles[y * w + x + 1] === T.CLOTURE ? TILESET.CLOTURE_H : TILESET.CLOTURE_V
      case T.PALISSADE: return face ? TILESET.PALISSADE_FACE : TILESET.PALISSADE_HAUT
      case T.RACINE: return face ? TILESET.RACINE_FACE : TILESET.RACINE_HAUT
      case T.CHAIRSOL: return TILESET.CHAIRSOL + v
      case T.MARE: return TILESET.MARE + v2
      case T.FALAISE: return face ? TILESET.FALAISE_FACE + v2 : TILESET.FALAISE_HAUT + v2
      case T.MER: return y > 0 && m.tiles[(y - 1) * w + x] !== T.MER && !isSolidTile(m.tiles[(y - 1) * w + x]) ? TILESET.MER_BORD : TILESET.MER + v
      case T.SABLE: return TILESET.SABLE + v
      case T.PONT: return m.tiles[y * w + x - 1] === T.PONT || m.tiles[y * w + x + 1] === T.PONT ? TILESET.PONT_H : TILESET.PONT_V
      case T.GUE: return TILESET.GUE + v2
      case T.SAS: return TILESET.SAS
      case T.SCELLE: return TILESET.SCELLE
      case T.ARBRE: case T.MEUBLE: return this.tileIndex(...this.groundNear(x, y))
      default: return TILESET.SOL + v
    }
  }

  /** Sous un arbre ou un meuble : le sol voisin le plus courant. */
  groundNear(x: number, y: number): [number, number] {
    const m = this.map
    for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1], [1, 1], [-1, 1]]) {
      const t = m.tiles[(y + dy) * m.w + x + dx]
      if (t !== undefined && !isSolidTile(t) && t !== T.ROUTE) {
        if (t === T.PLANCHER && m.tiles[(y + dy) * m.w + x + dx - 1] === T.MURB) continue
        return [x + dx, y + dy]
      }
    }
    return [x, y + 1 < m.h ? y + 1 : y]
  }

  chunkKey(cx: number, cy: number) { return cx + ',' + cy }

  updateChunks() {
    const v = this.cameras.main.worldView
    const x0 = Math.floor((v.x - 64) / (CH * TILE)), x1 = Math.floor((v.right + 64) / (CH * TILE))
    const y0 = Math.floor((v.y - 64) / (CH * TILE)), y1 = Math.floor((v.bottom + 64) / (CH * TILE))
    const maxX = Math.ceil(this.map.w / CH) - 1, maxY = Math.ceil(this.map.h / CH) - 1
    for (let cy = Math.max(0, y0); cy <= Math.min(maxY, y1); cy++) for (let cx = Math.max(0, x0); cx <= Math.min(maxX, x1); cx++) {
      const k = this.chunkKey(cx, cy)
      const ch = this.chunks.get(k)
      if (!ch) this.chunks.set(k, this.makeChunk(cx, cy))
      else if (this.kind === 'secteur' && this.bioChanged(ch)) this.paintChunk(ch)
    }
    for (const [k, ch] of this.chunks) if (ch.cx < x0 - 1 || ch.cx > x1 + 1 || ch.cy < y0 - 1 || ch.cy > y1 + 1) { this.dropChunk(ch); this.chunks.delete(k) }
  }

  /** Les ruches qui touchent ce morceau ont-elles bougé d'au moins une demi-tuile ? (on repeint alors) */
  bioChanged(ch: Chunk) {
    const r = this.rayons()
    if (!r) return false
    const sig = this.bioSig(ch, r)
    if (sig === ch.bio) return false
    ch.bio = sig
    return true
  }

  /** Les rayons des ruches (état partagé par toutes les copies), sur le continent seulement. */
  rayons(): ArrayLike<number> | null {
    if (this.map?.zoneCarte !== 'continent') return null
    const r = this.net?.room?.state?.ruches
    return r?.length ? r : null
  }

  bioSig(ch: Chunk, r: ArrayLike<number>) {
    const cx = (ch.cx + 0.5) * CH, cy = (ch.cy + 0.5) * CH
    let s = ''
    for (let i = 0; i < RUCHES.length; i++) {
      const h = RUCHES[i], rr = r[i] ?? h.r0
      if (Math.hypot(cx - h.x, cy - h.y) > rr * 1.3 + CH) continue
      s += i + ':' + Math.round(rr * 2) + ';'
    }
    return s
  }

  makeChunk(cx: number, cy: number): Chunk {
    const key = `morceau_${cx}_${cy}_${Math.random().toString(36).slice(2, 6)}`
    const tex = this.textures.createCanvas(key, CH * TILE, CH * TILE)!
    const img = this.add.image(cx * CH * TILE, cy * CH * TILE, key).setOrigin(0, 0).setDepth(-1000)
    const ch: Chunk = { cx, cy, img, tex, objs: [], trees: [], bio: '', nodes: [] }
    this.paintChunk(ch)
    // les arbres et les ressources de ce morceau
    const m = this.map.monde
    if (m) {
      for (const a of m.arbres) {
        if (Math.floor(a.x / CH) !== cx || Math.floor(a.y / CH) !== cy) continue
        const bx = a.x * TILE + 8, by = (a.y + 1) * TILE - 1
        const img = this.add.image(bx, by + 1, 'arbres', a.v).setOrigin(0.5, 1).setDepth(by).setFlipX(hash2(a.x, a.y) % 2 === 0)
        ch.objs.push(img); ch.trees.push({ img, x: bx, y: by })
      }
      for (const n of m.noeuds) {
        if (Math.floor(n.x / TILE / CH) !== cx || Math.floor(n.y / TILE / CH) !== cy) continue
        const glow = this.add.image(n.x, n.y, 'halo').setScale(0.42).setTint(n.type === 'noyau' ? 0x7fd6ff : n.type === 'echantillon' ? 0xff8ae0 : 0xfff0a0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setDepth(-950)
        const img = this.add.image(n.x, n.y + 5, `noeud_${n.type}`).setOrigin(0.5, 1).setDepth(n.y + 5)
        ch.objs.push(img, glow); ch.nodes.push({ id: n.id, img, glow })
      }
    }
    return ch
  }

  paintChunk(ch: Chunk) {
    const ctx = ch.tex.getContext()
    const m = this.map, ts = this.tileset
    const r = this.rayons()
    const x0 = ch.cx * CH, y0 = ch.cy * CH
    ctx.clearRect(0, 0, CH * TILE, CH * TILE)
    for (let ty = y0; ty < Math.min(m.h, y0 + CH); ty++) for (let tx = x0; tx < Math.min(m.w, x0 + CH); tx++) {
      const dx = (tx - x0) * TILE, dy = (ty - y0) * TILE
      const t = m.tiles[ty * m.w + tx]
      ctx.drawImage(ts, this.tileIndex(tx, ty) * 16, 0, 16, 16, dx, dy, 16, 16)
      // l'ombre portée d'un mur sur le sol
      if (!isSolidTile(t) && ty > 0 && isSolidTile(m.tiles[(ty - 1) * m.w + tx]) && m.tiles[(ty - 1) * m.w + tx] !== T.ARBRE && m.tiles[(ty - 1) * m.w + tx] !== T.CLOTURE && m.tiles[(ty - 1) * m.w + tx] !== T.MEUBLE) ctx.drawImage(ts, TILESET.OMBRE * 16, 0, 16, 16, dx, dy, 16, 16)
      const d = m.deco[ty * m.w + tx]
      if (d) {
        if (d === D.M_FONTAINE) {
          const left = m.deco[ty * m.w + tx - 1] === D.M_FONTAINE, up = m.deco[(ty - 1) * m.w + tx] === D.M_FONTAINE
          ctx.drawImage(ts, (TILESET.FONTAINE + (left ? 1 : 0) + (up ? 2 : 0)) * 16, 0, 16, 16, dx, dy, 16, 16)
        } else if (d === D.M_TABLEAU) {
          const left = m.deco[ty * m.w + tx - 1] === D.M_TABLEAU
          ctx.drawImage(ts, (TILESET.TABLEAU + (left ? 1 : 0)) * 16, 0, 16, 16, dx, dy, 16, 16)
        } else if (d !== D.LAMPE || !this.pannes.some((p) => Math.floor(p.x / TILE) === tx && Math.floor(p.y / TILE) === ty)) {
          ctx.drawImage(ts, (TILESET.DECO + d) * 16, 0, 16, 16, dx, dy, 16, 16)
        }
      }
    }
    // la biomasse d'ÉDEN : les taches des ruches (la bordure est le front), sauf les lieux habités et Port-Ancre
    if (r) {
      ch.bio = this.bioSig(ch, r)
      const proches = RUCHES.map((h, i) => ({ h, i, rr: r[i] ?? h.r0 })).filter(({ h, rr }) => Math.hypot((ch.cx + 0.5) * CH - h.x, (ch.cy + 0.5) * CH - h.y) <= rr * 1.3 + CH)
      if (proches.length) for (let ty = y0; ty < Math.min(m.h, y0 + CH); ty++) for (let tx = x0; tx < Math.min(m.w, x0 + CH); tx++) {
        let e = Infinity
        for (const p of proches) e = Math.min(e, ecartBordure(p.h, p.rr, tx + 0.5, ty + 0.5))
        if (e >= 0) continue
        const t = m.tiles[ty * m.w + tx]
        if (t === T.CHAIR || t === T.NIDSOL || t === T.CHAIRSOL || t === T.MER) continue
        if (lieuDefAt(tx, ty)?.habite || zoneAt(r, (tx + 0.5) * TILE, (ty + 0.5) * TILE) === 'port') continue
        // la biomasse recouvre le sol par plaques : on devine encore le terrain dessous, les murs restent lisibles
        const border = e > -1.2
        const solid = isSolidTile(t)
        if (solid && !border) { ctx.globalAlpha = 0.28; ctx.fillStyle = '#5a1a52'; ctx.fillRect((tx - x0) * TILE, (ty - y0) * TILE, 16, 16); ctx.globalAlpha = 1; continue }
        const patch = hash2(Math.floor(tx / 3), Math.floor(ty / 3)) % 3 === 0
        ctx.globalAlpha = border ? 0.95 : e > -4 ? 0.7 : patch ? 0.85 : 0.5
        const idx = border ? TILESET.BIO_BORD + hash2(tx, ty) % 4 : TILESET.BIO + hash2(ty, tx) % 4
        ctx.drawImage(ts, idx * 16, 0, 16, 16, (tx - x0) * TILE, (ty - y0) * TILE, 16, 16)
        ctx.globalAlpha = 1
      }
    }
    ch.tex.refresh()
  }

  dropChunk(ch: Chunk) {
    for (const o of ch.objs) o.destroy()
    ch.img.destroy()
    this.textures.remove(ch.tex)
  }

  // --------------------------------------------------------------- une image
  majRobotAtelier(time: number) {
    const voir = this.map?.carte === 'ossara' && this.etatRobot === 'atelier'
    if (!voir) { this.robotAtelier?.setVisible(false); return }
    const at = this.map!.points.atelier
    if (!this.robotAtelier) this.robotAtelier = this.add.image(at.x, at.y + 6, 'robot').setDepth(at.y + 6)
    this.robotAtelier.setVisible(true).setPosition(at.x, at.y + 6 + Math.sin(time / 500) * 1.5)
  }

  update(time: number, delta: number) {
    if (!this.map || !this.net?.room) return
    const dt = Math.min(0.05, delta / 1000)
    const st = this.net.room.state
    const me = this.net.self()
    const cam = this.cameras.main
    if (me) this.myNum = me.num
    // la relève : un nouvel héritier prend la place du soldat tombé
    if (me) this.myNum = me.num
    if (me && me.name && this.dernierNom && me.name !== this.dernierNom) this.vfx.joue('releve', me.x, me.y + 7, { depth: me.y + 1, secousse: [200, 0.004] })
    if (me?.name) this.dernierNom = me.name
    // entrées
    let meX = me ? this.net.value(me, 'x') : 0, meY = me ? this.net.value(me, 'y') : 0
    // pilote automatique de test : pas de prédiction, on lisse la position du serveur
    if (me?.bot) { this.autoX = this.autoX ? this.autoX + (me.x - this.autoX) * Math.min(1, dt * 14) : me.x; this.autoY = this.autoY ? this.autoY + (me.y - this.autoY) * Math.min(1, dt * 14) : me.y; meX = this.autoX; meY = this.autoY }
    else this.autoX = this.autoY = 0
    const scr = { x: (meX - cam.worldView.x) * cam.zoom / devicePixelRatioCap(), y: (meY - cam.worldView.y) * cam.zoom / devicePixelRatioCap() }
    const c = this.controls.read(scr)
    let aim = Math.atan2(c.ay, c.ax)
    if (me && this.assist && this.controls.st.touch) aim = this.assistAim(meX, meY, aim)
    const alive = me && me.etat === 0
    this.lastAim = aim
    const cmd = { mx: alive ? c.mx : 0, my: alive ? c.my : 0, aim, fire: !!(alive && c.fire) }
    this.net.frame(time, cmd)
    this.majRobotAtelier(time)
    // tirs locaux (visuels) : notre arme répond sans attendre le serveur
    this.localCd -= dt
    if (cmd.fire && me && this.localCd <= 0) {
      const w = CLASSES[CLASS_IDS[me.cls]].arme
      this.localCd = w.cadence
      const sty = this.style(me)
      for (let i = 0; i < w.balles; i++) {
        const a = aim + (Math.random() - 0.5) * 2 * w.dispersion
        const x0 = meX + Math.cos(aim) * 9, y0 = meY + Math.sin(aim) * 9
        const s = this.projectile(sty.tir, x0, y0, a)
        this.locals.push({ s, x: x0, y: y0, vx: Math.cos(a) * w.vitesse, vy: Math.sin(a) * w.vitesse, life: w.portee, imp: sty.imp, col: sty.col, rare: sty.rare, trail: 0 })
      }
      this.events.emit('tir', me)
      // l'éclair de bouche, au bout du canon
      this.vfx.joue(sty.bouche, meX + Math.cos(aim) * 11, meY + Math.sin(aim) * 11, { angle: aim, depth: 4001 })
      this.flashes.push({ x: meX + Math.cos(aim) * 10, y: meY + Math.sin(aim) * 10, r: 34, a: 1 })
    }
    this.syncPlayers(st, me, aim)
    this.syncRobots(st)
    this.syncEnemies(st, meX, meY)
    this.syncNpcs(st, meX, meY)
    this.syncBullets(st, dt)
    this.stepLocals(dt)
    this.stepTeles(dt)
    this.arene.maj(dt)
    this.stepBubbles(dt)
    this.majAuras()
    this.ambiance(st, dt)
    this.vfx.maj()
    // en monorail : la caméra suit la rame (et recule un peu)
    const rame = this.rail.maj(dt)
    if (rame) { meX = rame.x; meY = rame.y }
    for (const [sid, v] of this.players) if (this.rail.aBord(sid)) v.c.setVisible(false)
    st.robots?.forEach((r: any, id: string) => { const v = this.robots.get(id); if (v && this.rail.aBord(r.owner)) v.c.setVisible(false) })
    if (me && !this.arene.cadre(cam, meX, meY, dt)) {
      const tx = meX - cam.width / 2, ty = meY - cam.height / 2
      cam.scrollX += (tx - cam.scrollX) * Math.min(1, dt * 12)
      cam.scrollY += (ty - cam.scrollY) * Math.min(1, dt * 12)
    }
    this.updateChunks()
    this.updateWorldObjects(st, meX, meY, dt)
    this.declutterLabels()
    this.drawNight(st, me, meX, meY, time)
    this.drawWeather(st, meX, meY, dt)
    this.hurt = Math.max(0, this.hurt - dt * 2)
    if (me) {
      const zone = this.kind === 'concession' ? 'concession' : zoneOfClient(st, this.map, meX, meY)
      this.onFrame({ x: meX, y: meY, zone })
    }
  }

  /** Toits qui s'effacent, feuillages traversés, ressources ramassées, fumées. */
  updateWorldObjects(st: any, meX: number, meY: number, dt: number) {
    for (const g of this.gares) {
      const on = this.garesOuvertes.includes(g.id) || g.ouverte
      const key = on ? 'gare_on' : 'gare_off'
      if (g.img.texture.key !== key) g.img.setTexture(key)
    }
    const ptx = Math.floor(meX / TILE), pty = Math.floor(meY / TILE)
    for (const r of this.roofs) {
      const b = r.b
      // (en monorail, on passe au-dessus des toits : ils restent en place)
      const inside = !this.rail.aBord(this.net.room.sessionId) && ptx >= b.x && ptx < b.x + b.w && pty >= b.y && pty < b.y + b.h
      const want = inside ? 0 : 1
      r.alpha += (want - r.alpha) * Math.min(1, dt * 8)
      r.img.setAlpha(r.alpha)
      const d = Math.hypot((b.x + b.w / 2) * TILE - meX, (b.y + b.h / 2) * TILE - meY)
      r.label.setAlpha(inside ? 0 : Math.max(0, Math.min(1, (190 - d) / 60)) * r.alpha)
    }
    for (const ch of this.chunks.values()) {
      for (const t of ch.trees) {
        const under = Math.abs(t.x - meX) < 16 && meY < t.y - 2 && meY > t.y - 44
        const a = t.img.alpha + ((under ? 0.4 : 1) - t.img.alpha) * Math.min(1, dt * 8)
        t.img.setAlpha(a)
      }
      for (const n of ch.nodes) {
        const pris = !!st.pris?.has?.(n.id)
        n.img.setVisible(!pris); n.glow.setVisible(!pris).setAlpha(0.22 + 0.14 * Math.sin(this.time.now / 400 + hash(n.id)))
      }
    }
    for (const p of this.pannes) {
      const ok = st.pannes?.get?.(p.id) === 1
      if (!ok && Math.random() < 0.03 && Math.abs(p.x - meX) < 300) this.spark(p.x, p.y - (p.type === 'lampe' ? 12 : 16), 0xffd36b, 2, 0.5)
    }
    // les cheminées fument
    this.smokeT -= dt
    if (this.smokeT <= 0 && this.map.monde) {
      this.smokeT = 0.35
      const v = this.cameras.main.worldView
      for (const b of this.map.monde.batiments) {
        if (!b.cheminee) continue
        const x = b.cheminee.x * TILE + 8 - 2, y = (b.cheminee.y + (b.porte.y === b.y + b.h - 1 ? 0 : 1)) * TILE - 22
        if (x < v.x - 40 || x > v.right + 40 || y < v.y - 60 || y > v.bottom + 40) continue
        this.smoke.emitParticleAt(x + Math.random() * 3, y)
      }
    }
  }

  assistAim(x: number, y: number, aim: number) {
    const cone = this.assist === 2 ? 0.45 : 0.22
    let best = aim, bd = cone
    for (const [, v] of this.enemies) {
      if (ENEMIES[v.kind]?.passif) continue
      const ex = v.c.x, ey = v.c.y, d = Math.hypot(ex - x, ey - y)
      if (d > 230) continue
      let da = Math.atan2(ey - y, ex - x) - aim
      da = Math.atan2(Math.sin(da), Math.cos(da))
      if (Math.abs(da) < bd) { bd = Math.abs(da); best = aim + da }
    }
    return best
  }

  // --------------------------------------------------------------- soldats
  syncPlayers(st: any, me: any, myAim: number) {
    const seen = new Set<string>()
    st.players?.forEach((p: any, sid: string) => {
      seen.add(sid)
      let v = this.players.get(sid)
      if (!v) v = this.makePlayer(sid, p)
      const isMe = sid === this.net.room.sessionId
      const x = this.net.value(p, 'x'), y = this.net.value(p, 'y')
      v.c.setPosition(Math.round(x), Math.round(y)).setDepth(y)
      v.c.setVisible(p.etat !== 2)
      const ang = isMe ? myAim : p.angle
      const left = Math.cos(ang) < 0
      v.body.setFlipX(left)
      v.gun.setRotation(ang).setFlipY(left).setPosition(left ? -2 : 2, 1)
      v.gun.setDepth(Math.sin(ang) < -0.3 ? -1 : 1)
      v.c.sort('depth')
      const moved = Math.hypot(x - v.lx, y - v.ly)
      v.walk = moved > 0.15 ? v.walk + moved * 0.18 : 0
      v.lx = x; v.ly = y
      const fr = v.walk ? [1, 2, 3, 2][Math.floor(v.walk) % 4] : 0
      v.body.setFrame(fr)
      // monté : assis sur le robot, plus haut, sans marcher
      const hy = p.monte ? -6 : 0
      v.body.setY(-1 + hy); v.gun.setY(1 + hy)
      if (p.monte) v.body.setFrame(0)
      if (p.etat === 1) { v.body.setRotation(Math.PI / 2).setTint(0x8888aa); v.gun.setVisible(false) }
      else { v.body.setRotation(0); v.gun.setVisible(true); if (v.flash > 0) { v.body.setTint(0xff6060); v.flash -= 0.016 } else if (p.dashT > 0) v.body.setTint(0xc8e8ff); else v.body.clearTint() }
      // le bouclier : une bulle hexagonale qui suit le soldat
      v.bubble.setVisible(false)
      if (p.fx & 1 && p.etat !== 2) this.aura(`b:${sid}`, 'bouclier', v.c.x, v.c.y - 2, v.c.depth + 2, { add: true, alpha: 0.9 })
      // l'esquive : une traînée de vent au départ de la ruée
      if (p.dashT > 0 && !v.dash) this.vfx.joue('esquive', v.c.x, v.c.y, { angle: Math.atan2(p.dvy || 0, p.dvx || 1), depth: v.c.depth - 1, alpha: 0.85 })
      v.dash = p.dashT > 0
      const k = p.maxHp ? p.hp / p.maxHp : 1
      v.bar.width = 14 * k; v.bar.fillColor = k > 0.5 ? 0x7dff9a : k > 0.25 ? 0xffd36b : 0xff5050
      v.bar.setVisible(p.etat === 0 && (k < 1 || !isMe)); v.barBg.setVisible(v.bar.visible)
      // dans l'arène, les soldats IA s'effacent un peu : on se repère d'un coup d'œil
      const ia = p.bot && this.arene.actifCam
      // le Voile : presque invisible (un peu plus visible pour soi)
      v.c.setAlpha(p.fx & 8 ? (isMe ? 0.4 : 0.12) : ia && p.etat === 0 ? 0.55 : 1)
      if (p.fx & 16 && p.etat === 0 && Math.random() < 0.3) this.spark(v.c.x, v.c.y - 4, 0xffd36b, 1, 0.5)
      if (v.label) v.label.setText(p.etat === 1 ? t('ui.scene.a_terre', { n: Math.ceil(p.downT) }) : ia ? t('ui.scene.ia') : p.bot ? `${p.name} · ${t('ui.scene.ia')}` : `${p.name} ${p.family}`).setColor(p.etat === 1 ? '#ff6b6b' : p.bot ? '#9fc3d9' : '#e9ecef')
    })
    for (const [sid, v] of this.players) if (!seen.has(sid)) { v.c.destroy(); this.players.delete(sid) }
  }

  makePlayer(sid: string, p: any): PView {
    const isMe = sid === this.net.room.sessionId
    const c = this.add.container(p.x, p.y)
    const shadow = this.add.image(0, 7, 'ombre')
    const body = this.add.sprite(0, -1, `soldat${p.cls}`, 0)
    const gun = this.add.image(2, 1, `arme${p.cls}`).setOrigin(0.15, 0.5)
    const bubble = this.add.image(0, 0, 'halo').setScale(0.5).setTint(0x7fd6ff).setBlendMode(Phaser.BlendModes.ADD).setVisible(false)
    const barBg = this.add.rectangle(-7, -13, 14, 2, 0x000000, 0.7).setOrigin(0, 0.5)
    const bar = this.add.rectangle(-7, -13, 14, 2, 0x7dff9a).setOrigin(0, 0.5)
    c.add([shadow, body, gun, bubble, barBg, bar])
    let label: Phaser.GameObjects.Text | undefined
    if (!isMe) {
      label = this.add.text(0, -16, '', { ...TXT, fontSize: '16px', color: '#e9ecef' }).setOrigin(0.5, 1).setScale(0.25)
      c.add(label)
    }
    const v: PView = { c, body, gun, bar, barBg, label, bubble, lx: p.x, ly: p.y, walk: 0, flash: 0, cls: p.cls }
    this.players.set(sid, v)
    return v
  }

  /** Les noms ne se chevauchent pas : on décale vers le haut ceux qui se recouvrent. */
  declutterLabels() {
    const items: { t: Phaser.GameObjects.Text; x: number; y: number; w: number; h: number; base: number }[] = []
    const add = (t: Phaser.GameObjects.Text | undefined, c: Phaser.GameObjects.Container, base: number) => {
      if (!t || !c.visible || !t.visible || !t.text) return
      t.y = base
      items.push({ t, x: c.x, y: c.y + base, w: t.width * t.scaleX, h: t.height * t.scaleY, base })
    }
    for (const v of this.players.values()) add(v.label, v.c, -16)
    for (const v of this.robots.values()) add(v.label, v.c, -22)
    for (const v of this.npcs.values()) if (v.label.alpha > 0.05) add(v.label, v.c, v.small ? -14 : -18)
    for (const v of this.enemies.values()) add(v.tag, v.c, v.tagY)
    items.sort((a, b) => b.y - a.y)
    for (let i = 0; i < items.length; i++) {
      const a = items[i]
      for (let guard = 0; guard < 6; guard++) {
        let hit = false
        for (let j = 0; j < i; j++) {
          const b = items[j]
          if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 - 0.5) { a.y = b.y - (a.h + b.h) / 2; hit = true }
        }
        if (!hit) break
      }
      a.t.y = a.base + (a.y - (a.t.parentContainer!.y + a.base))
    }
  }

  // --------------------------------------------------------------- robots, tourelles, avant-postes
  syncRobots(st: any) {
    const seen = new Set<string>()
    st.robots?.forEach((r: any, id: string) => {
      seen.add(id)
      let v = this.robots.get(id)
      // l'avant-poste qui se déploie : une colonne et un cercle cyan
      if (v && v.mode !== 2 && r.mode === 2) this.vfx.joue('avantposte', r.x, r.y + 4, { depth: r.y + 1, secousse: [160, 0.003] })
      if (v && v.mode !== r.mode && (v.mode === 2 || r.mode === 2 || r.mode === 4 || v.mode === 4)) { v.c.destroy(); this.robots.delete(id); v = undefined }
      // les petites machines des soldats : leurre, mine, drone
      if (r.mode >= 7) { this.machine(id, r); return }
      if (!v) v = this.makeRobot(id, r)
      v.mode = r.mode
      let x = this.net.value(r, 'x'), y = this.net.value(r, 'y')
      // la monture suit le soldat prédit, juste dessous (sinon elle traîne derrière lui)
      const cav = r.mode === 6 ? this.players.get(r.owner) : undefined
      if (cav) { x = cav.c.x; y = cav.c.y + 2 }
      const bob = r.mode === 0 || r.mode === 1 ? Math.round(Math.sin(this.time.now / 220 + hash(id)) * 1) : 0
      v.c.setPosition(Math.round(x), Math.round(y)).setDepth(cav ? cav.c.depth - 0.5 : y)
      if (cav) v.body.setFlipX(cav.body.flipX)
      v.body.setY((r.mode === 2 || r.mode === 5 ? -8 : -4) + bob)
      if (r.mode === 0 || r.mode === 1 || r.mode === 6) v.body.setFrame(Math.floor(this.time.now / 120) % 2)
      if (r.mode === 3 || r.mode === 5) v.body.setTint(0x555566); else if (r.fx & 1) v.body.setTint(0xb0f0ff); else v.body.clearTint()
      const k = r.maxHp ? r.hp / r.maxHp : 1
      v.bar.width = 12 * k; v.bar.setVisible(k < 1 && r.mode !== 5); v.barBg.setVisible(v.bar.visible)
      if (r.mode === 3 && Math.random() < 0.1) this.spark(x, y - 4, 0x9aa7b5, 1)
      // la surcharge : une aura électrique ; l'avant-poste : son cercle de veille au sol
      if (r.fx & 1 && r.mode !== 3 && r.mode !== 5) this.aura(`s:${id}`, 'surcharge', v.c.x, v.c.y + 2, v.c.depth + 1)
      if (r.mode === 2) this.aura(`a:${id}`, 'avantposte-veille', v.c.x, v.c.y + 3, v.c.y - 40)
      // il danse (laissé immobile sur la place) : un sol qui s'allume et des étincelles de couleur ; la gigue est dans main.ts
      if (r.fx & 2) this.aura(`d:${id}`, 'danse', v.c.x, v.c.y + 4, v.c.depth - 1)
      // Blindage : une bulle d'acier
      if (r.fx & 4 && r.mode !== 3) this.aura(`bl:${id}`, 'zone-blindage', v.c.x, v.c.y - 4, v.c.depth + 2, { alpha: 0.9 })
      // la monture soulève la poussière quand elle court
      if (cav && cav.walk && Math.random() < 0.18) this.vfx.joue('monture', v.c.x - (cav.body.flipX ? -6 : 6), v.c.y + 4, { depth: v.c.depth - 1, alpha: 0.8 })
    })
    for (const [id, v] of this.robots) if (!seen.has(id)) { v.c.destroy(); this.robots.delete(id) }
    for (const [id, m] of this.machines) if (!seen.has(id)) { m.destroy(); this.machines.delete(id) }
  }

  machines = new Map<string, Phaser.GameObjects.Container>()
  /** une petite machine : le leurre est un double du soldat qui scintille, la mine clignote au sol, le drone tourne */
  machine(id: string, r: any) {
    let c = this.machines.get(id)
    const x = this.net.value(r, 'x'), y = this.net.value(r, 'y')
    if (!c) {
      c = this.add.container(x, y)
      if (r.mode === 7) {
        let cls = 0
        this.net.room.state.players?.forEach((q: any, k: string) => { if (k === r.owner) cls = q.cls })
        const b = this.add.sprite(0, -1, `soldat${cls}`, 0).setTint(0xb48cff).setAlpha(0.7)
        const g = this.add.image(2, 1, `arme${cls}`).setOrigin(0.15, 0.5).setTint(0xb48cff).setAlpha(0.7)
        c.add([this.add.image(0, 7, 'ombre').setAlpha(0.4), b, g])
      } else {
        const s = this.vfx.joue(r.mode === 8 ? 'mine' : 'drone', 0, 0, {})
        if (s) { this.vfx.actifs.delete(s); c.add(s) }
      }
      this.machines.set(id, c)
    }
    c.setPosition(Math.round(x), Math.round(y)).setDepth(r.mode === 8 ? y - 6 : y + (r.mode === 9 ? 20 : 0))
    if (r.mode === 7) c.setAlpha(0.6 + 0.3 * Math.sin(this.time.now / 60))
  }

  makeRobot(id: string, r: any): RView {
    const c = this.add.container(r.x, r.y)
    const shadow = this.add.image(0, 4, 'ombre').setScale(r.mode === 2 || r.mode === 5 ? 1.1 : 0.8)
    const tex = r.mode === 2 || r.mode === 5 ? 'avantposte' : r.mode === 4 ? 'tourelle' : 'robot'
    const body = this.add.sprite(0, -4, tex, 0)
    const barBg = this.add.rectangle(-6, -14, 12, 2, 0x000000, 0.7).setOrigin(0, 0.5)
    const bar = this.add.rectangle(-6, -14, 12, 2, 0x7fd6ff).setOrigin(0, 0.5)
    c.add([shadow, body, barBg, bar])
    let label: Phaser.GameObjects.Text | undefined
    if (r.mode === 2 || r.mode === 5) {
      label = this.add.text(0, -22, `Avant-poste ${r.family}`, { ...TXT, fontSize: '16px', color: '#7fd6ff' }).setOrigin(0.5, 1).setScale(0.25)
      c.add(label)
    }
    const v: RView = { c, body, mode: r.mode, label, bar, barBg }
    this.robots.set(id, v)
    return v
  }

  // --------------------------------------------------------------- créatures
  syncEnemies(st: any, meX: number, meY: number) {
    const seen = new Set<string>()
    st.enemies?.forEach((e: any, id: string) => {
      seen.add(id)
      let v = this.enemies.get(id)
      if (!v) v = this.makeEnemy(id, e)
      const x = this.net.value(e, 'x'), y = this.net.value(e, 'y')
      const dx = x - v.lx
      const left = Math.abs(dx) > 0.05 ? dx < 0 : v.body.flipX
      // les sprites dessinés de profil regardent à droite ; ceux d'ÉDEN d'origine, de face
      v.body.setFlipX(left)
      const moving = Math.abs(dx) > 0.05 || Math.abs(y - (v.c.y)) > 0.05
      v.lx = x
      const bob = e.kind === E.ROUILLARD ? Math.round(Math.sin(this.time.now / 180 + v.seed) * 1.5) - 3 : 0
      v.c.setPosition(Math.round(x), Math.round(y)).setDepth(y)
      const speed = BOSS_KINDS.has(e.kind) ? 380 : e.kind === E.OEUF || e.kind === E.GONFLE ? 300 : 150
      const fr = v.frames > 2 ? (moving ? [1, 2, 3, 2][Math.floor((this.time.now + v.seed) / 140) % 4] : 0) : Math.floor((this.time.now + v.seed) / speed) % 2
      v.body.setFrame(fr)
      v.body.y = (e.kind === E.COUVEUSE ? -8 : e.kind === E.ENGLOUTISSEUR ? -18 : -2) + bob
      if (v.flash > 0) { v.body.setTint(0xffffff); v.flash -= 0.02 } else if (e.tint) v.body.setTint(e.tint); else if (e.elite) v.body.setTint(0xffe6a0); else v.body.clearTint()
      const k = e.maxHp ? e.hp / e.maxHp : 1
      const big = BOSS_KINDS.has(e.kind)
      const bw = big ? 44 : 14
      v.bar.width = bw * k
      const near = Math.hypot(x - meX, y - meY) < 150
      v.bar.setVisible(k < 1 || big); v.barBg.setVisible(v.bar.visible)
      // dans l'arène, le nom de la Couveuse est dans la barre du haut, pas sur elle
      if (v.tag) v.tag.setVisible(!(BOSS_KINDS.has(e.kind) && this.arene.actifCam) && (big || e.elite || ((k < 1 || near) && !ENEMIES[e.kind]?.passif)))
      // dans l'arène, la Couveuse prend toute la largeur du haut de l'écran
      if (e.kind === E.GUEULE) v.body.setScale(this.arene.actifCam ? 2.4 : 1.8)
      if (e.kind === E.SEMEUR) v.body.setScale(this.arene.actifCam ? 3.4 : 2.6)
      if (e.kind === E.PEPINIERE || e.kind === E.GREFFIER) v.body.setScale(this.arene.actifCam ? 2 : 1.5)
      if (e.kind === E.GLANEUSE) v.body.setScale(this.arene.actifCam ? 2.4 : 1.8)
      // un porte-nom du Greffier : le nom du soldat tombé au-dessus de lui
      if (v.tag && e.nom && v.tagNom !== e.nom) { v.tagNom = e.nom; v.tag.setText(e.nom) }
      if (e.kind === E.ENGLOUTISSEUR && this.arene.actifCam) v.body.setScale(1.5)
      if (e.kind === E.COUVEUSE) { const k2 = this.arene.actifCam ? 1.8 : 1.3; v.body.setScale(k2); v.shield?.setScale(1.9 * k2 / 1.3); v.aura?.setScale(2.4 * k2 / 1.3) }
      if (v.shield) v.shield.setVisible(!!e.armure).setAlpha(0.25 + 0.15 * Math.sin(this.time.now / 70))
      if (v.aura) v.aura.setAlpha(0.35 + 0.15 * Math.sin(this.time.now / 160))
      if (e.kind === E.CRACHEUR || e.kind === E.GONFLE) { /* lueur dans drawNight */ }
      // les états posés par les soldats : marque, étourdi, en feu, ralenti
      if (e.st) {
        const hy = v.c.y + (big ? -40 : -14)
        if (e.st & 4) this.aura(`m:${id}`, 'etat-marque', v.c.x, v.c.y, v.c.depth + 3, { alpha: 0.9 })
        if (e.st & 2) this.aura(`e:${id}`, 'etat-etourdi', v.c.x, v.c.y, v.c.depth + 3)
        if (e.st & 8) this.aura(`f:${id}`, 'etat-feu', v.c.x, v.c.y, v.c.depth + 1, { alpha: 0.9 })
        if (e.st & 1 && !(e.st & 2)) this.aura(`r:${id}`, 'etat-ralenti', v.c.x, v.c.y, v.c.depth + 3, { alpha: 0.8 })
      }
    })
    for (const [id, v] of this.enemies) if (!seen.has(id)) { v.c.destroy(); this.enemies.delete(id) }
  }

  makeEnemy(id: string, e: any): EView {
    const c = this.add.container(e.x, e.y)
    const def = ENEMIES[e.kind] ?? ENEMIES[0]
    const boss = BOSS_KINDS.has(e.kind)
    const tex = KIND_TEX[e.kind] ?? 'rampant'
    const frames = tex === 'greffe' ? 4 : 2
    const shadow = this.add.image(0, def.rayon * 0.7, 'ombre').setScale(boss ? 4 : def.rayon / 6)
    const parts: Phaser.GameObjects.GameObject[] = []
    let aura: Phaser.GameObjects.Image | undefined
    if (e.elite || boss) {
      aura = this.add.image(0, -2, 'halo').setScale(boss ? 2.4 : 0.6).setTint(e.kind === E.COUVEUSE ? 0xff5bd0 : e.kind === E.ENGLOUTISSEUR ? 0x9fd08a : e.kind === E.GUEULE ? 0xff6b4a : e.kind === E.SEMEUR ? 0xd8e06a : e.kind === E.PEPINIERE ? 0x8fe0a0 : e.kind === E.GREFFIER ? 0xc8b8ff : e.kind === E.GLANEUSE ? 0xffb86b : 0xffd36b).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.4)
      parts.push(aura)
    }
    const body = this.add.sprite(0, boss ? -8 : -2, tex, 0)
    if (e.elite) body.setScale(1.15)
    if (e.kind === E.GUEULE) body.setTint(0xd0604a)
    if (e.kind === E.SEMEUR) body.setTint(0xe8e090)
    if (e.kind === E.COUVEUSE) body.setScale(1.3)
    const bw = boss ? 44 : 14
    const by = boss ? (e.kind === E.ENGLOUTISSEUR ? -48 : -40) : e.kind === E.GREFFE ? -15 : e.kind === E.PYLONE ? -22 : e.kind === E.BOUTURE ? -17 : -13
    const barBg = this.add.rectangle(-bw / 2, by, bw, boss ? 3 : 2, 0x000000, 0.7).setOrigin(0, 0.5)
    const bar = this.add.rectangle(-bw / 2, by, bw, boss ? 3 : 2, def.famille === 'eden' ? 0xc45bb0 : def.famille === 'machine' ? 0xff6b4a : 0xd8b060).setOrigin(0, 0.5)
    c.add([shadow, ...parts, body, barBg, bar])
    let shield: Phaser.GameObjects.Image | undefined
    if (e.kind === E.COUVEUSE) { shield = this.add.image(0, -8, 'halo').setScale(1.9).setTint(0x9aa7b5).setBlendMode(Phaser.BlendModes.ADD); c.add(shield) }
    let tag: Phaser.GameObjects.Text | undefined
    if (!def.passif || boss) {
      const nom = t(`ennemi.${e.kind}.nom`)
      const name = boss ? nom.toUpperCase() : e.elite ? t('ui.scene.elite', { nom, n: e.level }) : `${nom} · ${e.level}`
      tag = this.add.text(0, by - 2, name, { ...TXT, fontSize: boss ? '24px' : '16px', color: boss ? '#ff9ae6' : e.elite ? '#ffd36b' : '#d8c8e0' }).setOrigin(0.5, 1).setScale(0.25)
      c.add(tag)
    }
    const v: EView = { c, body, bar, barBg, lx: e.x, seed: hash(id) % 1000, flash: 0, shield, tag, tagY: by - 2, kind: e.kind, frames, aura }
    this.enemies.set(id, v)
    return v
  }

  // --------------------------------------------------------------- habitants
  syncNpcs(st: any, meX: number, meY: number) {
    const seen = new Set<string>()
    st.npcs?.forEach((n: any, id: string) => {
      const def = NPC_BY_ID[id]
      if (!def) return
      seen.add(id)
      let v = this.npcs.get(id)
      if (!v) v = this.makeNpc(id)
      const x = this.net.value(n, 'x'), y = this.net.value(n, 'y')
      v.c.setPosition(Math.round(x), Math.round(y)).setDepth(y)
      v.c.setVisible(n.act !== 4)
      const moved = Math.hypot(x - v.lx, y - v.ly)
      v.walk = moved > 0.1 ? v.walk + moved * 0.2 : 0
      v.lx = x; v.ly = y
      v.body.setFrame(v.walk ? [1, 2, 3, 2][Math.floor(v.walk) % 4] : 0)
      v.body.setFlipX(n.dir < 0)
      if (v.gun) v.gun.setFlipX(n.dir < 0).setPosition(n.dir < 0 ? -4 : 4, n.act === 6 ? -1 : 2).setRotation(n.act === 6 ? 0 : (n.dir < 0 ? -0.9 : 0.9))
      if (n.act === 6 && Math.random() < 0.3) this.flashes.push({ x: x + n.dir * 10, y: y - 2, r: 22, a: 0.8 })
      const d = Math.hypot(x - meX, y - meY)
      const mk = this.markerFor(id)
      v.mark.setVisible(!!mk && n.act !== 4)
      // posé au-dessus du nom (même quand le nom a été poussé pour ne pas en chevaucher un autre), avec un vide de 2 px
      if (mk) v.mark.setTexture(mk === 'dispo' ? 'marq_ex' : mk === 'rendre' ? 'marq_q' : 'marq_qg').setY(v.label.y - v.label.displayHeight - 2 + Math.round(Math.sin(this.time.now / 260) * 1.5))
      v.label.setAlpha(Math.max(0, Math.min(1, (110 - d) / 40)))
    })
    for (const [id, v] of this.npcs) if (!seen.has(id)) { v.c.destroy(); this.npcs.delete(id) }
  }

  makeNpc(id: string): NView {
    const def = NPC_BY_ID[id]
    const key = 'pnj_' + id
    npcSheet(this, key, def.look)
    const small = !!def.look.petit
    const c = this.add.container(0, 0)
    const shadow = this.add.image(0, 7, 'ombre').setScale(small ? 0.7 : 1)
    const body = this.add.sprite(0, def.look.robot ? -3 : -1, key, 0).setScale(small ? 0.75 : 1)
    if (small) body.setY(1)
    const parts: Phaser.GameObjects.GameObject[] = [shadow, body]
    let gun: Phaser.GameObjects.Image | undefined
    if (def.arme) { gun = this.add.image(4, 2, 'arme0').setOrigin(0.15, 0.5).setScale(0.9); parts.push(gun) }
    const label = this.add.text(0, small ? -14 : -18, t(`pnj.${id}.nom`), { ...TXT, fontSize: '16px', color: def.boutique ? '#ffe9a0' : '#f0e6d0' }).setOrigin(0.5, 1).setScale(0.25)
    const mark = this.add.image(0, -27, 'marq_ex').setOrigin(0.5, 1).setVisible(false)
    parts.push(label, mark)
    c.add(parts)
    const v: NView = { c, body, gun, label, mark, walk: 0, lx: 0, ly: 0, small }
    this.npcs.set(id, v)
    return v
  }

  /** Une bulle de paroles au-dessus d'un habitant. */
  say(id: string, s: string, ms = 4500) {
    for (const b of this.bubbles) if (b.id === id) { b.c.destroy(); b.t = 0 }
    this.bubbles = this.bubbles.filter((b) => b.t > 0)
    // deux bulles à la fois au plus : la ville parle, mais l'écran reste lisible
    const v = this.npcs.get(id), me = this.net.self()
    if (v && me && Math.hypot(v.c.x - me.x, v.c.y - me.y) > 170) return
    if (this.bubbles.length >= 2) { this.bubbles[0].c.destroy(); this.bubbles.shift() }
    s = s.replace(/ ([!?:;»])/g, '\u00a0$1').replace(/« /g, '«\u00a0')
    const t = this.add.text(0, 0, s, { fontFamily: 'Pochoir, monospace', fontSize: '16px', color: '#2a1e10', wordWrap: { width: 380 }, align: 'center', lineSpacing: 0 }).setOrigin(0.5, 1).setScale(0.25)
    const w = t.width * 0.25 + 6, h = t.height * 0.25 + 4
    const g = this.add.graphics()
    g.fillStyle(0x1a1206, 1); g.fillRoundedRect(-w / 2 - 0.5, -h - 0.5, w + 1, h + 1, 2.5)
    g.fillStyle(0xf4ecd8, 1); g.fillRoundedRect(-w / 2, -h, w, h, 2)
    g.fillStyle(0xf4ecd8, 1); g.fillTriangle(-2, 0, 2, 0, 0, 3)
    t.setY(-2)
    const c = this.add.container(0, 0, [g, t]).setDepth(6500)
    this.bubbles.push({ c, id, t: ms / 1000, w, h: h + 3 })
  }

  stepBubbles(dt: number) {
    this.bubbles = this.bubbles.filter((b) => {
      b.t -= dt
      const v = this.npcs.get(b.id) ?? this.players.get(b.id)
      if (b.t <= 0 || !v) { b.c.destroy(); return false }
      // au-dessus du « ! » ou du « ? » quand l'habitant en porte un
      const mk = 'mark' in v && v.mark.visible ? v.mark.displayHeight + 2 : 0
      b.c.setPosition(v.c.x, v.c.y - ('small' in v && v.small ? 26 : 32) - mk).setAlpha(Math.min(1, b.t * 2))
      return true
    })
    // deux bulles qui se recouvrent (deux voisins qui parlent en même temps) : la plus haute monte au-dessus de l'autre
    const tri = [...this.bubbles].sort((a, b) => b.c.y - a.c.y)
    for (let i = 1; i < tri.length; i++) {
      const a = tri[i]
      for (let j = 0; j < i; j++) {
        const o = tri[j]
        if (Math.abs(a.c.x - o.c.x) < (a.w + o.w) / 2 + 1 && a.c.y > o.c.y - o.h - 1) a.c.y = o.c.y - o.h - 1
      }
    }    if (this.bubbles.length) this.bullesHorsHud()
  }

  /** Les bulles ne passent pas sous le HUD (colonne d'icônes, carte, fiche du soldat, nom de la zone) : poussées vers le
   *  centre de l'écran. */
  bullesHorsHud() {
    const v = this.cameras.main.worldView, k = v.width / Math.max(1, innerWidth), W = innerWidth
    const blocs: { x0: number; y0: number; x1: number; y1: number; cote: number }[] = []
    for (const id of ['menu-icones', 'bloc-carte', 'plaque-soldat', 'plaque-robot', 'zone']) {
      const el = document.getElementById(id)
      if (!el || el.closest('.cache')) continue
      const r = el.getBoundingClientRect()
      if (r.width <= 0) continue
      const cx = (r.left + r.right) / 2
      blocs.push({ x0: v.x + r.left * k - 2, y0: v.y + r.top * k - 2, x1: v.x + r.right * k + 2, y1: v.y + r.bottom * k + 2, cote: cx > W * 0.6 ? 1 : cx < W * 0.4 ? -1 : 0 })
    }
    for (const b of this.bubbles) {
      // dans l'écran d'abord
      b.c.x = Math.max(v.x + b.w / 2 + 2, Math.min(v.right - b.w / 2 - 2, b.c.x))
      if (b.c.y - b.h < v.y + 2) b.c.y = v.y + 2 + b.h
      for (const o of blocs) {
        const x0 = b.c.x - b.w / 2, x1 = b.c.x + b.w / 2, y0 = b.c.y - b.h, y1 = b.c.y
        if (x1 <= o.x0 || x0 >= o.x1 || y1 <= o.y0 || y0 >= o.y1) continue
        if (o.cote > 0) b.c.x = o.x0 - b.w / 2
        else if (o.cote < 0) b.c.x = o.x1 + b.w / 2
        else b.c.y = o.y1 + b.h
      }
    }
  }

  // --------------------------------------------------------------- tirs
  syncBullets(st: any, dt: number) {
    const now = this.time.now
    const seen = new Set<string>()
    st.bullets?.forEach((b: any, id: string) => {
      seen.add(id)
      let v = this.bullets.get(id)
      if (!v) {
        if (b.team === 0 && b.o === this.myNum) { this.bullets.set(id, { s: null as any, t0: now, x0: b.x, y0: b.y, vx: b.vx, vy: b.vy, trail: 0 }); return }
        const a = Math.atan2(b.vy, b.vx)
        // les tirs des autres soldats et des robots : le style de leur classe et de leur palier
        const sty = b.team === 0 ? this.styleNum(b.o, false) : b.team === 2 && b.k !== 3 ? this.styleNum(b.o, true, b.x, b.y) : null
        if (sty) {
          v = { s: this.projectile(sty.tir, b.x, b.y, a), t0: now, x0: b.x, y0: b.y, vx: b.vx, vy: b.vy, trail: 0, imp: sty.imp, life: sty.life, col: sty.col, rare: sty.rare }
        } else {
          const nom = b.team === 1 ? (['pj-acide', 'pj-laser', 'pj-epine'][b.k ?? 0] ?? '') : b.team === 2 ? 'tir-garde' : 'tir-fan-1'
          const s = this.vfx.joue(nom, b.x, b.y, { angle: a, depth: 4000 }) ?? this.add.image(b.x, b.y, b.team === 1 ? `pj${b.k ?? 0}` : 'balle2').setRotation(a).setDepth(4000)
          v = { s, t0: now, x0: b.x, y0: b.y, vx: b.vx, vy: b.vy, trail: 0, imp: b.team === 1 ? (b.k === 0 ? 'impact-acide' : 'impact-joueur') : 'impact-rob-1', life: b.team === 1 ? 1.3 : 0.7, col: b.team === 1 ? (b.k === 0 ? 0xa8e030 : b.k === 1 ? 0xff5040 : 0xc45bb0) : 0xffd36b, rare: 0 }
        }
        this.bullets.set(id, v)
      }
      if (!v.s) return
      const k = (now - v.t0) / 1000
      v.s.setPosition(v.x0 + v.vx * k, v.y0 + v.vy * k)
      // une traînée de la couleur du tir (l'acide goutte, l'épine s'effrite, l'arme rare scintille)
      v.trail -= dt
      if (v.trail <= 0 && v.col !== undefined) { v.trail = 0.06; this.traine(v.s.x, v.s.y, v.col, v.rare ?? 0) }
    })
    for (const [id, v] of this.bullets) if (!seen.has(id)) {
      // disparu avant la fin de sa course : il a touché quelque chose
      if (v.s && v.imp && v.life !== undefined && (now - v.t0) / 1000 < v.life - 0.06) this.vfx.joue(v.imp, v.s.x, v.s.y, { depth: 4600 })
      this.rendre(v.s); this.bullets.delete(id)
    }
  }

  stepLocals(dt: number) {
    this.locals = this.locals.filter((l) => {
      l.life -= dt
      const nx = l.x + l.vx * dt, ny = l.y + l.vy * dt
      const t = this.map.tiles[Math.floor(ny / TILE) * this.map.w + Math.floor(nx / TILE)] ?? T.ROC
      let stop = l.life <= 0 || (isSolidTile(t) && t !== T.EAU && t !== T.CLOTURE && t !== T.MEUBLE)
      if (!stop) for (const v of this.enemies.values()) if (Math.abs(v.c.x - nx) < 8 && Math.abs(v.c.y - 2 - ny) < 8) { stop = true; v.flash = 0.1; break }
      if (stop) { if (l.life > 0) this.vfx.joue(l.imp, nx, ny, { depth: 4600 }); this.rendre(l.s); return false }
      l.x = nx; l.y = ny; l.s.setPosition(nx, ny)
      l.trail -= dt
      if (l.trail <= 0) { l.trail = 0.035; this.traine(nx, ny, l.col, l.rare) }
      return true
    })
  }

  // --------------------------------------------------------------- annonces d'attaques
  stepTeles(dt: number) {
    this.teles = this.teles.filter((t) => {
      t.t -= dt
      if (t.t <= 0) { t.g.destroy(); this.vfx.lacher(t.deco); return false }
      const k = 1 - t.t / t.total
      const g = t.g
      g.clear()
      const col = t.ami ? 0xffb347 : 0xff3b5c
      if (t.f === 'cercle') {
        g.fillStyle(col, 0.12 + 0.18 * k); g.fillCircle(t.x, t.y, t.r)
        g.fillStyle(col, 0.35); g.fillCircle(t.x, t.y, t.r * k)
        g.lineStyle(1, col, 0.9); g.strokeCircle(t.x, t.y, t.r)
      } else {
        const a = Math.atan2(t.y2 - t.y, t.x2 - t.x), l = Math.hypot(t.x2 - t.x, t.y2 - t.y)
        const nx = -Math.sin(a) * t.r, ny = Math.cos(a) * t.r
        g.fillStyle(col, 0.14 + 0.2 * k)
        g.fillPoints([{ x: t.x + nx, y: t.y + ny }, { x: t.x2 + nx, y: t.y2 + ny }, { x: t.x2 - nx, y: t.y2 - ny }, { x: t.x - nx, y: t.y - ny }] as any, true)
        g.fillStyle(col, 0.4)
        const lx = t.x + Math.cos(a) * l * k, ly = t.y + Math.sin(a) * l * k
        g.fillPoints([{ x: t.x + nx, y: t.y + ny }, { x: lx + nx, y: ly + ny }, { x: lx - nx, y: ly - ny }, { x: t.x - nx, y: t.y - ny }] as any, true)
        g.lineStyle(1, col, 0.9); g.strokePoints([{ x: t.x + nx, y: t.y + ny }, { x: t.x2 + nx, y: t.y2 + ny }, { x: t.x2 - nx, y: t.y2 - ny }, { x: t.x - nx, y: t.y - ny }] as any, true)
      }
      return true
    })
  }

  // --------------------------------------------------------------- effets venus du serveur
  fx(list: any[]) {
    const mine = this.net.room.sessionId
    for (const ev of list) {
      switch (ev.k) {
        case 'touche': {
          this.spark(ev.x, ev.y - 3, ev.m ? 0x7fd6ff : ev.a ? 0x9aa7b5 : 0xc45bb0, ev.a ? 1 : 2)
          let cible: EView | undefined
          for (const v of this.enemies.values()) if (Math.abs(v.c.x - ev.x) < 2 && Math.abs(v.c.y - ev.y) < 2) { v.flash = 0.08; cible = v }
          this.chiffre(cible, ev.x, ev.y, ev.n, ev.a ? '#9aa7b5' : '#f0e6d0')
          break
        }
        case 'aie': {
          const v = this.players.get(ev.sid); if (v) v.flash = 0.12
          this.vfx.joue('impact-joueur', ev.x, ev.y - 3, { depth: 4700 })
          if (ev.sid === mine) { this.hurt = 1; this.floatText(ev.x, ev.y - 14, `-${ev.n}`, '#ff6b6b', 0.25) }
          break
        }
        case 'mort': {
          const boss = BOSS_KINDS.has(ev.kind)
          const def = ENEMIES[ev.kind]
          const col = def?.famille === 'eden' ? 0xc45bb0 : def?.famille === 'machine' ? 0xff8a4a : 0xb08a5a
          // ÉDEN éclate en sève, les machines partent en débris, les bêtes tombent dans la poussière
          const nom = def?.famille === 'eden' ? (boss ? 'mort-eden-boss' : 'mort-eden') : def?.famille === 'machine' ? 'mort-machine' : 'mort-bete'
          this.vfx.joue(nom, ev.x, ev.y - 2, { depth: ev.y + 2, scale: boss && def?.famille !== 'eden' ? 3 : boss && this.arene.actifCam ? 2 : 1, arret: boss ? 90 : undefined })
          if (ev.kind === E.SAC) { this.vfx.joue('sac-creve', ev.x, ev.y, { depth: ev.y + 3, secousse: [220, 0.005], arret: 70, grand: true }); this.flashes.push({ x: ev.x, y: ev.y, r: 90, a: 1 }) }
          this.spark(ev.x, ev.y, col, boss ? 24 : 4, boss ? 1.6 : 1)
          if (def?.famille === 'eden') {
            const t = this.add.image(ev.x, ev.y + 2, 'tache').setDepth(-990).setScale(boss ? 4 : 1).setRotation(Math.random() * 6)
            this.tweens.add({ targets: t, alpha: 0, delay: 12000, duration: 4000, onComplete: () => t.destroy() })
          }
          if (ev.el) this.ring(ev.x, ev.y, 30, 0xffd36b)
          if (boss) { this.secouer(350, 0.006, true); this.flashes.push({ x: ev.x, y: ev.y, r: 160, a: 1 }) }
          break
        }
        case 'mur': this.spark(ev.x, ev.y, 0x8a7d68, 2, 0.6); break
        case 'crache': this.spark(ev.x, ev.y - 4, ev.t === 1 ? 0xff3030 : ev.t === 2 ? 0xc45bb0 : 0xb6ff5a, 3, 0.6); break
        case 'morsure': this.spark(ev.x, ev.y, 0xff3b5c, 4, 0.8); break
        case 'eclosion': this.vfx.joue('eclosion', ev.x, ev.y, { depth: ev.y + 1 }); break
        // un effet nommé posé par le serveur (la pince de la Glaneuse, un robot glané)
        case 'vfx': this.vfx.joue(String(ev.nom), ev.x, ev.y, { depth: ev.y + 4 }); break
        case 'panne': this.spark(ev.x, ev.y, 0x9aa7b5, 10); this.floatText(ev.x, ev.y - 14, t('ui.scene.hors_service'), '#9aa7b5', 0.25); break
        case 'repare': this.vfx.joue('repare', ev.x, ev.y - 8, { depth: 4700 }); break
        case 'bulle': this.say(ev.id, tx(ev.s)); break
        case 'butin': {
          if (ev.sid && ev.sid !== mine) break
          const col = Number.parseInt(String(ev.c ?? '#ffffff').slice(1), 16)
          // le rayon de butin pixelfx, à la couleur de la rareté (en boucle : on le rend au bout d'un moment)
          const rayon = this.vfx.joue(`butin-${Math.max(0, Math.min(5, ev.r ?? 0))}`, ev.x, ev.y + 4, { depth: ev.y + 2 })
          if (rayon) { const cle = rayon.texture.key; this.time.delayedCall(900 + (ev.r ?? 0) * 250, () => { if (rayon.texture.key === cle) this.vfx.lacher(rayon) }) }
          else this.spark(ev.x, ev.y - 4, col, 6 + ev.r * 4, 0.7)
          if (ev.r >= 3) this.flashes.push({ x: ev.x, y: ev.y, r: 30 + ev.r * 10, a: 1 })
          this.floatText(ev.x, ev.y - 22, `+ ${tx(ev.s)}`, ev.c ?? '#ffffff', 0.25, 1600)
          break
        }
        case 'tele': {
          if (this.arene.tele(ev)) break
          const g = this.add.graphics().setDepth(-900)
          // le cercle d'une attaque de zone porte un glyphe qui tourne : on lit d'un coup d'œil où ne pas être
          const deco = ev.f === 'cercle' ? this.vfx.joue('tele-glyphe', ev.x, ev.y, { depth: -899, scale: (ev.r * 2) / 60, alpha: 0.85, tint: ev.ami ? 0xffc890 : undefined }) : null
          this.teles.push({ deco, g, f: ev.f, x: ev.x, y: ev.y, x2: ev.x2, y2: ev.y2, r: ev.r, t: ev.t, total: ev.t, ami: !!ev.ami })
          break
        }
        case 'boom': {
          if (this.arene.boom(ev)) break
          const col = ev.ami ? 0xffb347 : 0xc45bb0
          // la grenade explose en feu, ÉDEN en sève ; une charge en ligne éclate tout le long
          const nom = ev.ami ? 'grenade' : 'boum-eden'
          if (ev.f === 'ligne') {
            const l = Math.hypot(ev.x2 - ev.x, ev.y2 - ev.y), n = Math.max(2, Math.min(7, Math.round(l / 28)))
            for (let k = 0; k <= n; k++) this.time.delayedCall(k * 35, () => this.vfx.joue(nom, ev.x + (ev.x2 - ev.x) * k / n, ev.y + (ev.y2 - ev.y) * k / n, { depth: 4600, scale: Math.max(0.5, (ev.r ?? 14) * 2.4 / 64) }))
          } else {
            this.vfx.joue(nom, ev.x, ev.y, { depth: 4600, scale: Math.max(0.5, Math.min(2.4, (ev.r * 1.6) / 64)), arret: ev.r >= 40 ? 60 : undefined })
            this.spark(ev.x, ev.y, col, Math.min(14, 4 + ev.r / 6), Math.max(0.8, ev.r / 40)); this.flashes.push({ x: ev.x, y: ev.y, r: ev.r * 2.2, a: 1 })
          }
          const me = this.net.self()
          if (me && Math.hypot(me.x - ev.x, me.y - ev.y) < 160) this.secouer(140, 0.004)
          break
        }
        case 'grenade': {
          const s = this.add.image(ev.x, ev.y, 'grenade').setDepth(4500)
          this.tweens.add({ targets: s, x: ev.x2, y: ev.y2, duration: ev.t * 1000 * 0.8, ease: 'Quad.easeOut', onComplete: () => this.time.delayedCall(ev.t * 200, () => s.destroy()) })
          break
        }
        case 'sk': {
          if (this.competence(ev)) break
          // chaque compétence a son effet : bulle posée, anneau de soin, aura électrique, tourelle qui s'ancre
          const nom = ({ injection: 'injection', adrenaline: 'adrenaline', bouclier: 'bouclier-pose', tourelle: 'tourelle', surcharge: 'surcharge-pose', onde: 'onde', marquage: 'marquage', court_circuit: 'court-circuit', filet: 'filet', voile: 'voile', ange: 'ange', essaim: 'essaim', leurre_fin: 'leurre-fin', piege: 'mine', tapis: 'tapis', leurre: 'leurre-fin', mortier: 'mortier', champ: 'champ' } as Record<string, string>)[ev.s]
          const larg = ({ injection: 128, adrenaline: 96, onde: 96, marquage: 64, court_circuit: 64, filet: 48, mortier: 124, champ: 76 } as Record<string, number>)[ev.s]
          const sc = larg && ev.r ? (ev.r * 2) / larg : 1
          if (!nom || !this.vfx.joue(nom, ev.x, ev.y, { depth: ev.y + 3, scale: sc })) this.ring(ev.x, ev.y, ev.r ?? 24, 0x7fd6ff)
          if (ev.s === 'onde') { this.flashes.push({ x: ev.x, y: ev.y, r: ev.r * 1.5, a: 1 }) }
          if (ev.s === 'injection' && ev.r) for (const [, v] of this.players) if (Math.hypot(v.c.x - ev.x, v.c.y - ev.y) <= ev.r) this.vfx.joue('soin-perso', v.c.x, v.c.y, { depth: v.c.depth + 2, suivre: () => (v.c.active ? { x: v.c.x, y: v.c.y } : null) })
          break
        }
        case 'zone': this.zoneFx(ev); break
        case 'txt': this.floatText(ev.x, ev.y, tx(ev.s as Texte), ev.c ?? '#ffffff', 0.25); break

        case 'niveau': {
          // la montée de niveau : un pilier doré et NIVEAU qui monte, puis le chiffre
          this.vfx.joue('niveau', ev.x, ev.y + 7, { depth: ev.y + 4, secousse: ev.sid === mine || !ev.sid ? [120, 0.003] : undefined })
          this.time.delayedCall(500, () => this.floatText(ev.x, ev.y - 58, `${ev.n}`, '#ffd36b', 0.3, 1200))
          break
        }
      }
      this.events.emit('fx', ev)
    }
  }

  /** les compétences qui dessinent un trait (tir perforant, Percée, visée, arc électrique) */
  competence(ev: any): boolean {
    const a = Math.atan2((ev.y2 ?? ev.y) - ev.y, (ev.x2 ?? ev.x) - ev.x), l = Math.hypot((ev.x2 ?? ev.x) - ev.x, (ev.y2 ?? ev.y) - ev.y)
    if (ev.s === 'tir_lourd') {
      const s = this.vfx.joue('rayon-perforant', ev.x, ev.y, { angle: a, depth: 4600 })
      s?.setScale(l / 64, 1)
      this.flashes.push({ x: ev.x2, y: ev.y2, r: 40, a: 1 }); this.spark(ev.x2, ev.y2, 0xd8f4ff, 8)
      return true
    }
    // l'équipement : rebond de la Dernière Cartouche, tir dévorant, spore de la Couveuse, recyclage
    if (ev.s === 'ricochet') { const s = this.vfx.joue('trait-percee', ev.x, ev.y, { angle: a, depth: 4600 }); s?.setScale(Math.max(0.3, l / 64), 0.5).setTint(0xffa640); this.vfx.joue('eqp-ricochet', ev.x2 ?? ev.x, ev.y2 ?? ev.y, { angle: a, depth: 4600 }); return true }
    if (ev.s === 'devore') { this.vfx.joue('eqp-devore', ev.x, ev.y, { depth: ev.y + 3 }); return true }
    if (ev.s === 'spore_soin') { this.vfx.joue('eqp-spore-soin', ev.x, ev.y, { depth: ev.y + 3 }); return true }
    if (ev.s === 'recycle') { this.vfx.joue('eqp-recycle', ev.x, ev.y, { depth: ev.y + 3 }); return true }
    if (ev.s === 'percee') { const s = this.vfx.joue('trait-percee', ev.x, ev.y, { angle: a, depth: ev.y + 2 }); s?.setScale(Math.max(0.5, l / 64), 1); return true }
    if (ev.s === 'arc') {
      const g = this.add.graphics().setDepth(4600)
      g.lineStyle(1, 0xd8b0ff, 1)
      const pts: { x: number; y: number }[] = []
      for (let i = 0; i <= 6; i++) pts.push({ x: ev.x + (ev.x2 - ev.x) * i / 6 + (i % 6 ? (Math.random() - 0.5) * 8 : 0), y: ev.y + (ev.y2 - ev.y) * i / 6 + (i % 6 ? (Math.random() - 0.5) * 8 : 0) })
      g.strokePoints(pts as any)
      this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() })
      return true
    }
    if (ev.s === 'visee') {
      // la demi-seconde de visée du tir perforant : un fil rouge
      const g = this.add.graphics().setDepth(4500)
      g.lineStyle(1, 0xff6b6b, 0.8).lineBetween(ev.x, ev.y, ev.x + Math.cos(ev.a) * ev.len, ev.y + Math.sin(ev.a) * ev.len)
      this.tweens.add({ targets: g, alpha: 0.2, duration: ev.t * 1000, onComplete: () => g.destroy() })
      return true
    }
    return false
  }

  /** une zone de compétence qui dure (champ, nuage, brasier, aura de soins, Bastion), à la taille de son rayon */
  zoneFx(ev: any) {
    const nom = `zone-${ev.z}`
    const s = this.vfx.joue(nom, ev.x, ev.y, { depth: ev.z === 'blindage' ? ev.y + 4 : -880, scale: ev.z === 'blindage' ? 1 : (ev.r * 2) / 64, alpha: ev.z === 'toxine' ? 0.9 : 0.85 })
    if (!s) return
    const fin = this.time.now + ev.t * 1000
    const suivre = () => {
      if (!s.active || this.time.now >= fin) { this.vfx.lacher(s); return }
      if (ev.sid) { const v = this.players.get(ev.sid); if (v) s.setPosition(v.c.x, v.c.y) }
      if (ev.rid) { const v = this.robots.get(ev.rid); if (v) s.setPosition(v.c.x, v.c.y - 4) }
      if (fin - this.time.now < 400) s.setAlpha(Math.max(0, (fin - this.time.now) / 400))
      this.time.delayedCall(30, suivre)
    }
    suivre()
  }

  /** le style des tirs du joueur à ce numéro (ou de son robot) */
  styleNum(num: number, robot: boolean, x = 0, y = 0): Style | null {
    let p: any = null, sid = ''
    this.net.room.state.players?.forEach((q: any, k: string) => { if (q.num === num) { p = q; sid = k } })
    if (!p) return robot ? { tir: 'tir-rob-1', imp: 'impact-rob-1', bouche: '', col: TRAINE.rob, rare: 0, life: 0.65 } : null
    if (!robot) return this.style(p)
    // le robot (ou la tourelle) de ce joueur le plus proche du départ du tir
    let lv = 1, best = Infinity
    this.net.room.state.robots?.forEach((r: any) => { if (r.owner === sid) { const d = Math.hypot(r.x - x, r.y - y); if (d < best) { best = d; lv = r.level } } })
    const t = palier(lv)
    return { tir: `tir-rob-${t}`, imp: `impact-rob-${t}`, bouche: '', col: TRAINE.rob, rare: 0, life: 0.65 }
  }

  style(p: any): Style {
    const id = CLASS_IDS[p.cls], c = classeVfx(id), t = palier(p.level ?? 1)
    return { tir: `tir-${c}-${t}`, imp: `impact-${c}-${t}`, bouche: `bouche-${c}-${t}`, col: TRAINE[c], rare: p.arme ?? 0, life: CLASSES[id]?.arme.portee ?? 0.7 }
  }

  /** un projectile animé de la réserve, ou à défaut l'ancienne balle */
  projectile(nom: string, x: number, y: number, a: number) {
    return this.vfx.joue(nom, x, y, { angle: a, depth: 4000 }) ?? this.add.image(x, y, 'balle0').setRotation(a).setDepth(4000).setBlendMode(Phaser.BlendModes.ADD)
  }

  rendre(s: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | null | undefined) {
    if (!s) return
    if (s instanceof Phaser.GameObjects.Sprite && this.vfx.actifs.has(s)) this.vfx.lacher(s); else s.destroy()
  }

  /** la traînée : une poussière de la couleur du tir ; une arme rare (2) ou épique (3) ajoute son scintillement */
  traine(x: number, y: number, col: number, rare: number) {
    this.parts.setParticleTint(col); this.parts.setParticleSpeed(4, 14); this.parts.emitParticleAt(x, y, 1)
    if (rare >= 2 && Math.random() < 0.5) { this.parts.setParticleTint(rare >= 3 ? 0xd8a8ff : 0xa8d0ff); this.parts.emitParticleAt(x, y, 1) }
  }

  /** un effet qui dure tant que son porteur l'a (bulle, aura) ; ceux qui ne sont plus vus à cette image sont rendus */
  aura(cle: string, nom: string, x: number, y: number, depth: number, o: { add?: boolean; alpha?: number } = {}) {
    this.aurasVues.add(cle)
    let s = this.auras.get(cle)
    if (!s || !s.active) { s = this.vfx.joue(nom, x, y, { depth, ...o }) ?? undefined; if (!s) return; this.auras.set(cle, s) }
    s.setPosition(x, y).setDepth(depth)
  }

  majAuras() {
    for (const [k, s] of this.auras) if (!this.aurasVues.has(k)) { this.vfx.lacher(s); this.auras.delete(k) }
    this.aurasVues.clear()
  }

  /** le passage vers une autre carte : l'iris pixelfx couvre l'écran, collé à la caméra */
  transition() {
    const cam = this.cameras.main
    const s = this.vfx.joue('transition', 0, 0, { depth: 9000 })
    if (!s) return
    s.setScrollFactor(0).setOrigin(0.5, 0.5).setPosition(cam.width / 2, cam.height / 2).setScale(Math.max(cam.width / 320, cam.height / 180) / cam.zoom)
  }

  /** les spores d'ÉDEN dans la biomasse autour de la caméra, les étincelles des gares en panne */
  ambiance(st: any, dt: number) {
    const v = this.cameras.main.worldView
    this.sporesT -= dt
    if (this.sporesT <= 0) {
      this.sporesT = 0.35
      const rr = this.rayons()
      const x = v.x + Math.random() * v.width, y = v.y + Math.random() * v.height
      const dedans = rr ? sousBiomasse(rr, x / TILE, y / TILE) >= 0 : this.map?.zoneCarte === 'nid'
      if (dedans) this.vfx.joue('spores', x, y, { depth: 5500, alpha: 0.7 })
    }
    this.bioT -= dt
    if (this.bioT <= 0) {
      this.bioT = 1.1
      const rr = this.rayons()
      if (rr) for (let i = 0; i < 6; i++) {
        const x = v.x + Math.random() * v.width, y = v.y + Math.random() * v.height
        if (sousBiomasse(rr, x / TILE, y / TILE) < 0) continue
        // au bord : une case à deux tuiles de là n'est pas encore prise
        const a = Math.random() * Math.PI * 2
        if (sousBiomasse(rr, x / TILE + Math.cos(a) * 2, y / TILE + Math.sin(a) * 2) >= 0) continue
        this.vfx.joue('biomasse', x, y, { depth: -980 })
        break
      }
    }
    this.gareT -= dt
    if (this.gareT <= 0) {
      this.gareT = 0.5
      for (const g of this.gares) {
        if (this.garesOuvertes.includes(g.id) || g.ouverte || !v.contains(g.img.x, g.img.y - 10)) continue
        if (Math.random() < 0.5) this.vfx.joue('gare', g.img.x + (Math.random() - 0.5) * 20, g.img.y - 14 - Math.random() * 16, { depth: g.img.depth + 1 })
      }
    }
    void st
  }

  /** les dégâts d'une même créature se cumulent dans un seul petit chiffre, au lieu d'en empiler dix */
  chiffre(cible: EView | undefined, x: number, y: number, n: number, color: string) {
    const now = this.time.now
    const d = cible ? this.degats.get(cible) : undefined
    if (d && d.fin > now && d.t.active) {
      d.n += n; d.fin = now + 380
      this.tweens.killTweensOf(d.t)
      d.t.setText(String(Math.round(d.n))).setPosition(cible!.c.x, cible!.c.y - 14).setAlpha(1)
      this.tweens.add({ targets: d.t, y: d.t.y - 8, alpha: 0, delay: 250, duration: 450, ease: 'Quad.easeIn', onComplete: () => { d.t.destroy(); if (this.degats.get(cible!) === d) this.degats.delete(cible!) } })
      return
    }
    const t = this.add.text(x, y - 14, String(Math.round(n)), { ...TXT, fontSize: '16px', strokeThickness: 3, color }).setOrigin(0.5).setScale(0.2).setDepth(7000).setAlpha(0.95)
    this.tweens.add({ targets: t, y: t.y - 8, alpha: 0, delay: 250, duration: 450, ease: 'Quad.easeIn', onComplete: () => { t.destroy(); if (cible && this.degats.get(cible)?.t === t) this.degats.delete(cible) } })
    if (cible) this.degats.set(cible, { t, n, fin: now + 380 })
  }

  /** une quête rendue : une étoile dorée au-dessus du soldat */
  effetQuete() {
    const me = this.net?.self()
    if (me) this.vfx.joue('quete', me.x, me.y - 22, { depth: 7000 })
  }

  spark(x: number, y: number, color: number, n: number, speed = 1) {
    this.parts.setParticleTint(color)
    this.parts.setParticleSpeed(30 * speed, 120 * speed)
    this.parts.emitParticleAt(x, y, n)
  }

  ring(x: number, y: number, r: number, color: number) {
    const g = this.add.graphics().setDepth(4800)
    const o = { k: 0 }
    this.tweens.add({ targets: o, k: 1, duration: 450, ease: 'Quad.easeOut', onUpdate: () => { g.clear(); g.lineStyle(2, color, 1 - o.k); g.strokeCircle(x, y, r * (0.3 + 0.7 * o.k)) }, onComplete: () => g.destroy() })
  }

  floatText(x: number, y: number, s: string, color: string, scale: number, ms = 800) {
    // les chiffres de dégâts restent petits : la police pixel à 16 px, au quart (un peu plus pour les annonces)
    const t = this.add.text(x, y, s, { ...TXT, fontSize: scale >= 0.3 ? '24px' : '16px', color }).setOrigin(0.5).setScale(0.25).setDepth(7000)
    this.tweens.add({ targets: t, y: y - 14, alpha: 0, duration: ms, ease: 'Quad.easeOut', onComplete: () => t.destroy() })
  }

  // --------------------------------------------------------------- le jour, la nuit, et ÉDEN au-delà du front
  heure(st: any) { return this.forceHeure ?? st.heure ?? 12 }

  drawNight(st: any, _me: any, meX: number, meY: number, now: number) {
    const cam = this.cameras.main
    const v = cam.worldView
    const S = 2 // un pixel du calque = 2 pixels de jeu
    const W = Math.ceil(v.width / S) + 2, H = Math.ceil(v.height / S) + 2
    const c = this.dark
    if (c.width !== W || c.height !== H) c.setSize(W, H)
    const ctx = c.getContext()
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, W, H)
    const ox = Math.floor(v.x / S) * S, oy = Math.floor(v.y / S) * S
    const sx = (x: number) => (x - ox) / S, sy = (y: number) => (y - oy) / S
    // dans l'épave, il fait toujours sombre ; au nid aussi
    const night = this.kind === 'secteur' ? (this.map.zoneCarte === 'continent' ? nightOf(this.heure(st)) : Math.max(0.5, nightOf(this.heure(st)))) : 0.3
    // la nuit d'Ossara : un bleu profond, pas un noir
    if (night > 0) { ctx.fillStyle = `rgba(8,12,34,${0.6 * night})`; ctx.fillRect(0, 0, W, H) }
    // le soir et l'aube : une teinte chaude
    const h = this.heure(st)
    const dusk = this.kind === 'secteur' ? Math.max(0, 1 - Math.abs(h - 19) / 1.5) + Math.max(0, 1 - Math.abs(h - 6) / 1.2) : 0
    if (dusk > 0) { ctx.fillStyle = `rgba(120,50,20,${0.16 * Math.min(1, dusk)})`; ctx.fillRect(0, 0, W, H) }
    if (st.meteo === 1 && this.map?.carte !== 'nid') { ctx.fillStyle = 'rgba(20,30,48,0.16)'; ctx.fillRect(0, 0, W, H) }
    // au-delà du front : la brume violette d'ÉDEN, plus épaisse la nuit, jamais opaque
    const edenA = 0.2 + 0.18 * night
    const rr = this.rayons()
    if (rr) {
      // tuile par tuile autour de la caméra : la brume s'épaissit en entrant dans une tache
      const tx0 = Math.floor(v.x / TILE) - 1, ty0 = Math.floor(v.y / TILE) - 1
      const tx1 = Math.ceil(v.right / TILE) + 1, ty1 = Math.ceil(v.bottom / TILE) + 1
      const cx = (tx0 + tx1) / 2, cy = (ty0 + ty1) / 2, demi = Math.hypot(tx1 - tx0, ty1 - ty0) / 2
      const proches = RUCHES.map((hh, i) => ({ hh, rr: rr[i] ?? hh.r0 })).filter(({ hh, rr: r }) => Math.hypot(cx - hh.x, cy - hh.y) < r * 1.3 + demi + 3)
      if (proches.length) for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        let e = Infinity
        for (const p of proches) e = Math.min(e, ecartBordure(p.hh, p.rr, tx + 0.5, ty + 0.5))
        if (e > 1.5) continue
        const k = Math.min(1, (1.5 - e) / 4)
        ctx.fillStyle = `rgba(48,10,52,${edenA * k})`
        ctx.fillRect(Math.floor(sx(tx * TILE)), Math.floor(sy(ty * TILE)), TILE / S + 1, TILE / S + 1)
      }
    } else if (this.map?.zoneCarte === 'nid') {
      // les donjons des Hauts ont leur pénombre : verte sous le verre de la Serre, d'encre au Registre
      const c = this.map.carte ?? ''
      ctx.fillStyle = c.startsWith('serre') ? `rgba(8,34,22,${edenA})` : c.startsWith('registre') ? `rgba(14,12,40,${edenA})` : c === 'metier_raid' ? `rgba(36,18,10,${edenA})` : `rgba(48,10,52,${edenA})`; ctx.fillRect(0, 0, W, H)
    } else if (this.kind === 'concession') {
      ctx.fillStyle = 'rgba(10,4,18,0.45)'; ctx.fillRect(0, 0, W, H)
    }
    // les lumières percent la nuit
    const lights: Light[] = []
    this.glowN = 0
    const lit = Math.max(night, this.kind === 'secteur' && zoneOfClient(st, this.map, meX, meY) === 'dela' ? 0.5 : 0)
    for (const [sid, pv] of this.players) if (pv.c.visible) {
      const r = sid === this.net.room.sessionId ? 96 : 66
      lights.push({ x: pv.c.x, y: pv.c.y, r })
      if (lit > 0.2) this.glow(pv.c.x + Math.cos(pv.gun.rotation) * 18, pv.c.y + Math.sin(pv.gun.rotation) * 18, 0xffd36b, 0.9, 0.14 * lit)
    }
    for (const rv of this.robots.values()) {
      const big = rv.mode === 2
      const pulse = big ? 0.75 + 0.25 * Math.sin(now / 300) : 1
      lights.push({ x: rv.c.x, y: rv.c.y, r: (big ? 90 : rv.mode === 5 ? 0 : 44) * pulse })
      if (rv.mode !== 3 && rv.mode !== 5) this.glow(rv.c.x, rv.c.y + (big ? -20 : -4), 0x7fd6ff, big ? 1.4 * pulse : 0.6, big ? 0.35 : 0.2)
    }
    for (const b of this.bullets.values()) if (b.s) { lights.push({ x: b.s.x, y: b.s.y, r: 14 }); const k = b.s.texture.key; this.glow(b.s.x, b.s.y, k === 'pj0' ? 0xb6ff5a : k === 'pj1' ? 0xff3030 : k === 'pj2' ? 0xff8ae0 : k === 'balle2' ? 0x7fd6ff : 0xffd36b, 0.3, 0.45) }
    for (const l of this.locals) lights.push({ x: l.x, y: l.y, r: 12 })
    for (const e of this.enemies.values()) {
      const k = e.body.texture.key
      if (k === 'couveuse') { this.glow(e.c.x, e.c.y - 8, 0xff8ae0, 2.2 + 0.3 * Math.sin(now / 200), 0.4); lights.push({ x: e.c.x, y: e.c.y, r: 120 }) }
      else if (k === 'engloutisseur') { this.glow(e.c.x, e.c.y - 18, 0x9fd08a, 2 + 0.3 * Math.sin(now / 240), 0.3); lights.push({ x: e.c.x, y: e.c.y, r: 110 }) }
      else if (k === 'cracheur' || k === 'oeuf' || k === 'gonfle') this.glow(e.c.x, e.c.y - 3, 0xb6ff5a, 0.35, 0.3)
      else if (k === 'rouillard') { this.glow(e.c.x, e.c.y - 5, 0xff3030, 0.3, 0.45); lights.push({ x: e.c.x, y: e.c.y, r: 22 }) }
      else if (k === 'fougerode' && night > 0.3) this.glow(e.c.x, e.c.y - 2, 0xb6ff5a, 0.2, 0.4)
    }
    // lampes, fenêtres, champignons : la vie qui s'allume le soir
    const onLamp = (x: number, y: number, r: number, col: number, s: number) => { lights.push({ x, y, r }); this.glow(x, y, col, s, 0.25 * Math.max(0.3, night)) }
    const near = (x: number, y: number) => x > v.x - 80 && x < v.right + 80 && y > v.y - 80 && y < v.bottom + 80
    for (const lp of this.lamps) if (near(lp.x, lp.y)) onLamp(lp.x, lp.y + 8, 64, 0xffd36b, 1.1)
    for (const p of this.pannes) if (near(p.x, p.y) && this.net.room.state.pannes?.get?.(p.id) === 1) {
      if (p.type === 'lampe') onLamp(p.x, p.y - 4, 64, 0xffd36b, 1.1)
      else { const blink = Math.sin(now / 250) > 0; if (blink) onLamp(p.x, p.y - 14, 40, 0xff4040, 0.6) }
    }
    if (night > 0.15 && this.map.monde) {
      for (const b of this.map.monde.batiments) for (const f of b.fenetres) {
        const x = f.x * TILE + 8, y = f.y * TILE + 7
        if (!near(x, y)) continue
        const fl = 0.85 + 0.15 * Math.sin(now / 400 + f.x)
        lights.push({ x, y: y + 8, r: 34 * fl })
        this.glow(x, y, 0xffc070, 0.45, 0.55 * night)
      }
    }
    for (const ch of this.chunks.values()) for (const n of ch.nodes) if (n.img.visible && (n.img.texture.key === 'noeud_champignon' || n.img.texture.key === 'noeud_noyau')) lights.push({ x: n.img.x, y: n.img.y - 4, r: 30 })
    this.flashes = this.flashes.filter((f) => { f.a! -= 0.08; if (f.a! > 0) { lights.push({ x: f.x, y: f.y, r: f.r * f.a! }); this.glow(f.x, f.y, 0xffc070, f.r / 40 * f.a!, 0.4 * f.a!) } return f.a! > 0 })
    ctx.globalCompositeOperation = 'destination-out'
    for (const l of lights) {
      if (l.r <= 0 || l.x < v.x - l.r || l.x > v.right + l.r || l.y < v.y - l.r || l.y > v.bottom + l.r) continue
      const x = sx(l.x), y = sy(l.y), r = l.r / S
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(0.55, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
    ctx.globalCompositeOperation = 'source-over'
    if (this.hurt > 0) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7); g.addColorStop(0, 'rgba(160,0,20,0)'); g.addColorStop(1, `rgba(160,0,20,${0.45 * this.hurt})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H) }
    c.refresh()
    this.darkImg.setPosition(ox, oy).setDisplaySize(W * S, H * S)
    for (let i = this.glowN; i < this.glows.length; i++) this.glows[i].setVisible(false)
  }

  /** Pluie, brume, lucioles : sur l'écran, autour du joueur. */
  drawWeather(st: any, meX: number, meY: number, dt: number) {
    const v = this.cameras.main.worldView
    const raining = this.kind === 'secteur' && st.meteo === 1 && this.map?.carte !== 'nid' // le nid est sous terre
    for (const r of this.rain) {
      r.img.setVisible(raining)
      if (!raining) continue
      r.y += dt * r.v * 1.6; r.x += dt * 0.25
      if (r.y > 1) { r.y -= 1; r.x = Math.random() }
      if (r.x > 1) r.x -= 1
      r.img.setPosition(v.x + r.x * v.width, v.y + r.y * v.height).setRotation(0.25).setAlpha(0.55)
    }
    const misty = this.map?.carte === 'ossara' && (st.meteo === 2 || zoneIdAt(Math.floor(meX / TILE), Math.floor(meY / TILE)) === 'marais')
    this.mist.forEach((m, i) => {
      m.setVisible(misty)
      if (!misty) return
      const t = this.time.now / 1000
      m.setPosition(v.x + ((i * 97 + t * (6 + i)) % (v.width + 300)) - 150, v.y + (i / this.mist.length) * v.height + Math.sin(t / 3 + i) * 10).setAlpha(st.meteo === 2 ? 0.75 : 0.35)
    })
    const night = this.kind === 'secteur' ? nightOf(this.heure(st)) : 0
    const zone = this.map?.carte === 'ossara' ? zoneIdAt(Math.floor(meX / TILE), Math.floor(meY / TILE)) : ''
    const flies = night > 0.4 && (zone === 'foret' || zone === 'marais' || zone === 'plaines')
    for (const f of this.flies) {
      f.img.setVisible(flies)
      if (!flies) continue
      if (Math.abs(f.x - meX) > v.width * 0.6 || Math.abs(f.y - meY) > v.height * 0.6) { f.x = meX + (Math.random() - 0.5) * v.width; f.y = meY + (Math.random() - 0.5) * v.height }
      f.a += (Math.random() - 0.5) * 2 * dt; f.t += dt
      f.x += Math.cos(f.a) * 8 * dt; f.y += Math.sin(f.a) * 6 * dt
      f.img.setPosition(f.x, f.y).setAlpha(0.4 + 0.6 * Math.abs(Math.sin(f.t * 1.7)))
    }
  }

  glow(x: number, y: number, color: number, scale: number, alpha: number) {
    let g = this.glows[this.glowN]
    if (!g) { g = this.add.image(0, 0, 'halo').setBlendMode(Phaser.BlendModes.ADD).setDepth(6100); this.glows.push(g) }
    this.glowN++
    g.setVisible(true).setPosition(x, y).setTint(color).setScale(scale).setAlpha(alpha)
  }
}

export function devicePixelRatioCap() { return Math.min(2, window.devicePixelRatio || 1) }

/** La zone d'un point vue du client : les mêmes règles que le serveur (ruches partagées, poches, carte). */
export function zoneOfClient(st: any, map: GameMap | undefined, x: number, y: number) {
  if (!map || map.carte === 'concession') return 'concession'
  const poches: OutpostLike[] = []
  st?.outposts?.forEach?.((o: any) => poches.push({ x: o.x, y: o.y, actif: !!o.actif }))
  return zoneAt(st?.ruches ?? [], x, y, poches, map.zoneCarte)
}
export { PAL, lieuAt }
