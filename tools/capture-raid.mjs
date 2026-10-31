// Captures du raid du Semeur (932 × 430) sur le banc à part (port 2797, sa propre base) : soldat de test au niveau du
// raid, neuf soldats IA avec leurs rôles, pilote automatique ; une image par mécanique (taille, boutures, greffes,
// désherbage). Usage : node tools/capture-raid.mjs <dossier>
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
const OUT = process.argv[2] ?? '/tmp/hl-raid'
const URL = 'http://127.0.0.1:2797/'
mkdirSync(OUT, { recursive: true })
const attendre = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: 932, height: 430 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
const photo = (n) => page.screenshot({ path: `${OUT}/${n}.png` })
const { token } = await (await fetch(URL + 'api/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ famille: 'Corvel' }) })).json()
await page.addInitScript((t) => { localStorage.setItem('heirline.token', t); localStorage.setItem('heirline.langue', 'fr') }, token)
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-cls]', { timeout: 30000 })
await page.click('[data-cls="fantassin"]'); await page.click('[data-a="go"]')
await page.waitForFunction(() => window.heirline?.net?.room?.state?.players?.size > 0, null, { timeout: 30000 })
await attendre(1200)
await page.evaluate(() => window.heirline.net.room.send('voyage', { dest: 'semeur', code: 'banc' }))
await page.waitForFunction(() => window.heirline?.scene()?.map?.carte === 'semeur' && window.heirline.net.room?.state?.players?.size > 0, null, { timeout: 30000 })
await attendre(4000)
await page.evaluate(() => window.heirline.net.room.send('autopilote', { on: true, code: 'banc' }))
const vues = new Set()
const fin = Date.now() + 330000
let n = 0
while (Date.now() < fin && vues.size < 5) {
  await attendre(400)
  const e = await page.evaluate(() => { const a = window.heirline.scene().arene, st = window.heirline.net.room.state; return { etat: a?.etat, phase: a?.phase, pv: st.bossPv, joueurs: st.players.size, zones: (a?.zones ?? []).map((z) => z.f + ':' + (1 - z.t / z.total).toFixed(2)), teles: (window.heirline.scene().teles ?? []).map((t) => t.f + ':' + t.r) } })
  if (n++ % 25 === 0) console.log(JSON.stringify(e))
  for (const z of e.zones) { const [f, k] = z.split(':'); if (!vues.has(f) && Number(k) > 0.55) { vues.add(f); await photo(`raid-${f}`) } }
  if (!vues.has('taille') && e.etat && e.teles.some((t) => t.startsWith('ligne:14'))) { vues.add('taille'); await attendre(500); await photo('raid-taille') }
  if (!vues.has('combat') && e.etat && e.pv < 92) { vues.add('combat'); await photo('raid-combat') }
}
await browser.close()
console.log('ok', [...vues])
