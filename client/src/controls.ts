// Les contrôles : deux joysticks tactiles (déplacement à gauche, visée et tir à droite) et des boutons ;
// clavier et souris sur ordinateur.

export interface ControlState {
  mx: number; my: number
  ax: number; ay: number; aiming: boolean; fire: boolean
  mouse: { x: number; y: number } | null
  touch: boolean
}

type Btn = 'sk0' | 'sk1' | 'sk2' | 'dash' | 'ordre' | 'action' | 'monture' | 'talents'

export class Controls {
  st: ControlState = { mx: 0, my: 0, ax: 1, ay: 0, aiming: false, fire: false, mouse: null, touch: false }
  keys = new Set<string>()
  onButton: (b: Btn) => void = () => {}
  sticks = new Map<number, { side: 'L' | 'R'; ox: number; oy: number; el: HTMLElement; knob: HTMLElement }>()
  mouseDown = false
  enabled = true

  constructor(root: HTMLElement) {
    const zone = document.getElementById('touchzone')!
    zone.addEventListener('pointerdown', (e) => this.down(e))
    window.addEventListener('pointermove', (e) => this.move(e))
    window.addEventListener('pointerup', (e) => this.up(e))
    window.addEventListener('pointercancel', (e) => this.up(e))
    for (const b of root.querySelectorAll<HTMLElement>('[data-btn]')) {
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (this.enabled) this.onButton(b.dataset.btn as Btn) })
    }
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      this.keys.add(e.code)
      if (!this.enabled) return
      if (e.code === 'KeyQ' || e.code === 'Digit1') this.onButton('sk0')
      if (e.code === 'KeyE' || e.code === 'Digit2') this.onButton('sk1')
      if (e.code === 'KeyG' || e.code === 'Digit3') this.onButton('sk2')
      if (e.code === 'KeyN') this.onButton('talents')
      if (e.code === 'Space' || e.code === 'ShiftLeft') this.onButton('dash')
      if (e.code === 'KeyR') this.onButton('ordre')
      if (e.code === 'KeyF') this.onButton('action')
      if (e.code === 'KeyT') this.onButton('monture')
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false })
    const canvasHost = document.getElementById('game')!
    canvasHost.addEventListener('mousemove', (e) => { this.st.mouse = { x: e.clientX, y: e.clientY } })
    zone.addEventListener('mousemove', (e) => { this.st.mouse = { x: e.clientX, y: e.clientY } })
    window.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  down(e: PointerEvent) {
    if (!this.enabled) return
    if (e.pointerType === 'mouse') { this.mouseDown = e.button === 0; this.st.mouse = { x: e.clientX, y: e.clientY }; return }
    e.preventDefault()
    this.st.touch = true
    document.body.classList.add('tactile')
    const side = e.clientX < window.innerWidth * 0.45 ? 'L' : 'R'
    for (const s of this.sticks.values()) if (s.side === side) return
    const el = document.createElement('div'); el.className = 'stick ' + side
    const knob = document.createElement('div'); knob.className = 'knob'; el.appendChild(knob)
    el.style.left = e.clientX + 'px'; el.style.top = e.clientY + 'px'
    document.getElementById('sticks')!.appendChild(el)
    this.sticks.set(e.pointerId, { side, ox: e.clientX, oy: e.clientY, el, knob })
  }

  move(e: PointerEvent) {
    if (e.pointerType === 'mouse') { this.st.mouse = { x: e.clientX, y: e.clientY }; return }
    const s = this.sticks.get(e.pointerId)
    if (!s) return
    const R = 46
    let dx = e.clientX - s.ox, dy = e.clientY - s.oy
    const d = Math.hypot(dx, dy)
    if (d > R) { s.ox = e.clientX - dx / d * R; s.oy = e.clientY - dy / d * R; s.el.style.left = s.ox + 'px'; s.el.style.top = s.oy + 'px'; dx = e.clientX - s.ox; dy = e.clientY - s.oy }
    s.knob.style.transform = `translate(${dx}px, ${dy}px)`
    const k = Math.min(1, Math.hypot(dx, dy) / R)
    const l = Math.hypot(dx, dy) || 1
    if (s.side === 'L') { this.st.mx = dx / l * (k < 0.15 ? 0 : k); this.st.my = dy / l * (k < 0.15 ? 0 : k) }
    else { if (k > 0.2) { this.st.ax = dx / l; this.st.ay = dy / l } this.st.aiming = k > 0.2; this.st.fire = k > 0.38 }
  }

  up(e: PointerEvent) {
    if (e.pointerType === 'mouse') { if (e.button === 0) this.mouseDown = false; return }
    const s = this.sticks.get(e.pointerId)
    if (!s) return
    s.el.remove()
    this.sticks.delete(e.pointerId)
    if (s.side === 'L') { this.st.mx = 0; this.st.my = 0 } else { this.st.aiming = false; this.st.fire = false }
  }

  /** Lecture à chaque image. `selfScreen` = position de notre soldat à l'écran (pour viser à la souris). */
  read(selfScreen: { x: number; y: number }) {
    if (!this.enabled) return { mx: 0, my: 0, ax: this.st.ax, ay: this.st.ay, fire: false, aiming: false }
    let mx = this.st.mx, my = this.st.my
    const k = this.keys
    const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0)
    const ky = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0)
    if (kx || ky) { const l = Math.hypot(kx, ky); mx = kx / l; my = ky / l }
    let ax = this.st.ax, ay = this.st.ay, fire = this.st.fire, aiming = this.st.aiming
    if (!this.st.touch && this.st.mouse) {
      const dx = this.st.mouse.x - selfScreen.x, dy = this.st.mouse.y - selfScreen.y
      const l = Math.hypot(dx, dy) || 1
      ax = dx / l; ay = dy / l; aiming = true
      fire = this.mouseDown
    } else if (!aiming && (mx || my)) { ax = mx; ay = my }
    return { mx, my, ax, ay, fire, aiming }
  }
}
