import Phaser from 'phaser'
import { W, H, RADIUS } from '../../commun/sim'
import type { Net, Inp } from './net'

const q = new URLSearchParams(location.search)
const backend = q.get('b')
const lag = q.get('lag') === '1'
const host = location.hostname

if (!backend) {
  const m = document.createElement('div'); m.id = 'menu'
  m.innerHTML = `<div>Essai réseau Heirline : choisis</div>
  <a href="?b=colyseus">Colyseus (direct)</a><a href="?b=colyseus&lag=1">Colyseus + 4G simulée (120 ms, 2 %)</a>
  <a href="?b=stdbq">SpacetimeDB par tick (direct)</a><a href="?b=stdbq&lag=1">SpacetimeDB par tick + 4G simulée</a>
  <a href="?b=stdb">SpacetimeDB immédiat (direct)</a><a href="?b=stdb&lag=1">SpacetimeDB immédiat + 4G simulée</a>`
  document.body.appendChild(m)
} else start()

// ---- entrées : deux joysticks tactiles + clavier/souris
const inp: Inp = { mx: 0, my: 0, aim: 0, fire: false }
function stick(el: HTMLElement, cb: (x: number, y: number, on: boolean) => void) {
  const knob = el.querySelector('b') as HTMLElement
  let id: number | null = null
  const upd = (e: PointerEvent) => {
    const r = el.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2)
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l }
    knob.style.transform = `translate(${x * 40}px,${y * 40}px)`; cb(x, y, true)
  }
  el.addEventListener('pointerdown', e => { id = e.pointerId; el.setPointerCapture(id); upd(e) })
  el.addEventListener('pointermove', e => { if (e.pointerId === id) upd(e) })
  const end = (e: PointerEvent) => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; cb(0, 0, false) }
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end)
}
let touchMove = false, touchAim = false
stick(document.getElementById('sl')!, (x, y, on) => { touchMove = on; inp.mx = x; inp.my = y })
stick(document.getElementById('sr')!, (x, y, on) => { touchAim = on; if (Math.hypot(x, y) > 0.2) inp.aim = Math.atan2(y, x); inp.fire = on && Math.hypot(x, y) > 0.5 })

async function start() {
  const { connectColyseus } = await import('./net-colyseus')
  const { connectStdb } = await import('./net-stdb')
  const net: Net = backend?.startsWith('stdb')
    ? await connectStdb(`ws://${host}:${lag ? 3100 : 3000}`, backend === 'stdbq')
    : await connectColyseus(`ws://${host}:${lag ? 2667 : 2567}`)

  class Arena extends Phaser.Scene {
    g!: Phaser.GameObjects.Graphics
    keys!: Record<string, Phaser.Input.Keyboard.Key>
    hud = document.getElementById('hud')!
    fps = 0
    create() {
      this.g = this.add.graphics()
      this.keys = this.input.keyboard!.addKeys('W,A,S,D,Z,Q') as any
      this.cameras.main.setBounds(0, 0, W, H)
      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { if (!p.wasTouch) inp.fire = true })
      this.input.on('pointerup', (p: Phaser.Input.Pointer) => { if (!p.wasTouch) inp.fire = false })
    }
    update(time: number, delta: number) {
      const now = performance.now()
      this.fps = this.fps * 0.95 + (1000 / delta) * 0.05
      if (!touchMove) {
        const k = this.keys
        inp.mx = (k.D.isDown ? 1 : 0) - (k.A.isDown || k.Q.isDown ? 1 : 0)
        inp.my = (k.S.isDown ? 1 : 0) - (k.W.isDown || k.Z.isDown ? 1 : 0)
      }
      const players = net.players(now)
      const me = players.find(p => p.me)
      if (me && !touchAim) {
        const p = this.input.activePointer
        if (!p.wasTouch) inp.aim = Math.atan2(p.worldY - me.y, p.worldX - me.x)
      }
      net.frame(now, inp)
      const g = this.g; g.clear()
      g.lineStyle(1, 0x223040); for (let x = 0; x <= W; x += 50) g.lineBetween(x, 0, x, H); for (let y = 0; y <= H; y += 50) g.lineBetween(0, y, W, y)
      g.lineStyle(3, 0x5a7090); g.strokeRect(0, 0, W, H)
      for (const p of players) {
        g.fillStyle(p.me ? 0x7fffd4 : 0xff7a59); g.fillRect(p.x - RADIUS, p.y - RADIUS, RADIUS * 2, RADIUS * 2)
        g.fillStyle(0xffffff); g.fillRect(p.x + Math.cos(p.angle) * 14 - 2, p.y + Math.sin(p.angle) * 14 - 2, 4, 4)
        g.fillStyle(0x30ff60); g.fillRect(p.x - RADIUS, p.y - RADIUS - 6, (RADIUS * 2) * p.hp / 100, 3)
      }
      g.fillStyle(0xffe066)
      for (const b of net.bullets(now)) g.fillRect(b.x - 2, b.y - 2, 4, 4)
      if (me) { this.cameras.main.centerOn(me.x, me.y); (window as any).__me = { x: me.x, y: me.y } }
      this.hud.textContent = `${net.name}${lag ? ' + 4G simulée' : ''}\njoueurs ${players.length}  fps ${this.fps.toFixed(0)}\nconfirmation serveur ${net.ackMs().toFixed(0)} ms\nscore ${me?.score ?? 0}`
    }
  }

  new Phaser.Game({
    type: Phaser.WEBGL, parent: document.body, backgroundColor: '#0b0d12', pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE, width: innerWidth, height: innerHeight },
    scene: Arena,
  })
}
