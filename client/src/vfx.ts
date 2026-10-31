// Les effets en pixels (vfx/recettes → client/public/vfx) : des sprites animés tirés d'une réserve, jamais recréés.
// Un effet à usage unique rend son sprite à la réserve à la fin de son animation ; un effet en boucle (projectile,
// bulle, aura) reste au code qui l'a demandé, qui le rend avec lacher(). À l'image d'impact de l'atlas : une
// secousse et un court arrêt sur image pour les gros coups.
import Phaser from 'phaser'
import { VFX } from './vfx-manifest.ts'

export type Classe = 'fan' | 'med' | 'ing' | 'ecl' | 'dem' | 'bro'
const CLASSE: Record<string, Classe> = { fantassin: 'fan', medic: 'med', ingenieur: 'ing', eclaireur: 'ecl', demolisseur: 'dem', brouilleur: 'bro' }
export const classeVfx = (id: string): Classe => CLASSE[id] ?? 'fan'
/** palier des tirs : 1 (niv 1–4), 2 (5–9), 3 (10–14), 4 (15 et plus) */
export const palier = (niveau: number) => (niveau < 5 ? 1 : niveau < 10 ? 2 : niveau < 15 ? 3 : 4)

export interface Joue {
  angle?: number; depth?: number; scale?: number; tint?: number; alpha?: number; add?: boolean
  /** à l'image d'impact : secousse (durée ms, force) et arrêt sur image (ms) */
  secousse?: [number, number]; arret?: number
  /** un grand moment (sac crevé, boss tombé) : le seul tremblement gardé en mode « réduit » */
  grand?: boolean
  suivre?: () => { x: number; y: number } | null
}

const MAX = 260

export class Vfx {
  libres: Phaser.GameObjects.Sprite[] = []
  actifs = new Set<Phaser.GameObjects.Sprite>()
  suivis = new Map<Phaser.GameObjects.Sprite, () => { x: number; y: number } | null>()
  arretJusqua = 0
  scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    for (const [nom, d] of Object.entries(VFX)) {
      const key = `vfx_${nom}`
      if (this.scene.anims.exists(key)) continue
      this.scene.anims.create({ key, frames: this.scene.anims.generateFrameNumbers(key, { start: 0, end: d.n - 1 }), frameRate: d.fps, repeat: d.loop ? -1 : 0 })
    }
  }

  static charger(scene: Phaser.Scene) {
    for (const [nom, d] of Object.entries(VFX)) scene.load.spritesheet(`vfx_${nom}`, `vfx/${nom}.png`, { frameWidth: d.w, frameHeight: d.h })
  }

  existe(nom: string) { return !!VFX[nom] && this.scene.textures.exists(`vfx_${nom}`) }

  prendre(): Phaser.GameObjects.Sprite | null {
    if (this.actifs.size >= MAX) return null
    const s = this.libres.pop() ?? this.scene.add.sprite(0, 0, '__DEFAULT')
    s.setActive(true).setVisible(true)
    this.actifs.add(s)
    return s
  }

  /** joue un effet ; en boucle, le sprite est rendu par lacher() */
  joue(nom: string, x: number, y: number, o: Joue = {}): Phaser.GameObjects.Sprite | null {
    const d = VFX[nom]
    if (!d || !this.scene.textures.exists(`vfx_${nom}`)) return null
    const s = this.prendre()
    if (!s) return null
    s.setTexture(`vfx_${nom}`, 0).setOrigin(d.pivot[0], d.pivot[1]).setPosition(x, y).setScrollFactor(1)
      .setRotation(o.angle ?? 0).setScale((o.scale ?? 1) * (d.echelle ?? 1)).setDepth(o.depth ?? 4600).setAlpha(o.alpha ?? 1)
      .setBlendMode(o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
    if (o.tint !== undefined) s.setTint(o.tint); else s.clearTint()
    s.off(Phaser.Animations.Events.ANIMATION_COMPLETE).off(Phaser.Animations.Events.ANIMATION_UPDATE)
    if (o.suivre) this.suivis.set(s, o.suivre); else this.suivis.delete(s)
    if (!d.loop) s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.lacher(s))
    if (o.secousse || o.arret) {
      s.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_a: unknown, f: Phaser.Animations.AnimationFrame) => {
        if (f.index - 1 !== d.impact) return
        if (o.secousse) (this.scene as any).secouer(o.secousse[0], o.secousse[1], o.grand)
        if (o.arret) this.arret(o.arret)
      })
    }
    s.play(`vfx_${nom}`)
    if (d.loop) s.anims.setProgress(Math.random())
    if ((o.secousse || o.arret) && d.impact === 0) {
      if (o.secousse) (this.scene as any).secouer(o.secousse[0], o.secousse[1], o.grand)
      if (o.arret) this.arret(o.arret)
    }
    return s
  }

  lacher(s: Phaser.GameObjects.Sprite | null | undefined) {
    if (!s || !this.actifs.has(s)) return
    this.actifs.delete(s)
    this.suivis.delete(s)
    s.off(Phaser.Animations.Events.ANIMATION_COMPLETE).off(Phaser.Animations.Events.ANIMATION_UPDATE)
    s.stop().setVisible(false).setActive(false)
    this.libres.push(s)
  }

  /** un arrêt sur image léger : les effets en cours se figent quelques millisecondes (pas plus d'un toutes les 0,3 s) */
  arret(ms: number) {
    const now = this.scene.time.now
    if (now < this.arretJusqua + 300) return
    this.arretJusqua = now + ms
    for (const s of this.actifs) s.anims.pause()
    this.scene.time.delayedCall(ms, () => { for (const s of this.actifs) s.anims.resume() })
  }

  /** à chaque image : les effets attachés suivent leur porteur */
  maj() {
    for (const [s, f] of this.suivis) {
      const p = f()
      if (!p) { this.lacher(s); continue }
      s.setPosition(p.x, p.y)
    }
  }

  vider() { for (const s of [...this.actifs]) this.lacher(s) }
}
