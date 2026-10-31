// Capture du combat de la Couveuse : iPhone tenu droit (393 × 852), pilote automatique de test, vidéo + images.
import { chromium } from 'playwright-core'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
const OUT = '/tmp/heirline-boss/run'
mkdirSync(OUT, { recursive: true })
const DUREE = Number(process.argv[2] ?? 70)
const VIDEO = process.argv[3] !== 'sans-video'
const { token } = JSON.parse(readFileSync('/tmp/heirline-boss/compte.json', 'utf8'))
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist', '--window-size=393,852', '--force-device-scale-factor=2'] })
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const page = await ctx.newPage()
// la vidéo : les images du screencast de Chrome (CDP), avec leur horodatage, assemblées ensuite par ffmpeg
const images = []
let cdp = null
const filmer = async () => {
  cdp = await ctx.newCDPSession(page)
  mkdirSync(OUT + '/f', { recursive: true })
  cdp.on('Page.screencastFrame', async (f) => {
    const n = images.length
    writeFileSync(`${OUT}/f/${String(n).padStart(5, '0')}.jpg`, Buffer.from(f.data, 'base64'))
    images.push(f.metadata.timestamp)
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 786, maxHeight: 1704, everyNthFrame: 1 })
}
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)) })
await page.addInitScript((t) => { localStorage.setItem('heirline.token', t) }, token)
const t0 = Date.now()
await page.goto('http://127.0.0.1:2795/', { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.heirline?.net?.room?.state?.players?.size > 0, null, { timeout: 30000 })
await page.waitForTimeout(1500)
await page.evaluate(() => window.heirline.net.room.send('voyage', { dest: 'couveuse' }))
await page.waitForFunction(() => window.heirline?.scene()?.map?.carte === 'nid' && window.heirline.net.room?.state?.players?.size > 0, null, { timeout: 30000 })
console.log('au nid après', ((Date.now() - t0) / 1000).toFixed(1), 's')
await page.waitForTimeout(800)
await page.evaluate(() => window.heirline.net.room.send('autopilote', { on: true }))
if (VIDEO) await filmer()
const debut = (Date.now() - t0) / 1000
let n = 0
const fin = Date.now() + DUREE * 1000
while (Date.now() < fin) {
  await page.waitForTimeout(2500)
  const e = await page.evaluate(() => { const a = window.heirline.scene().arene, st = window.heirline.net.room.state; return { etat: a.etat, phase: a.phase, motifs: a.motifs.length, pv: st.bossPv, moi: st.players.get(window.heirline.net.room.sessionId)?.hp } })
  console.log(((Date.now() - t0) / 1000).toFixed(1), JSON.stringify(e))
  if (!VIDEO) await page.screenshot({ path: `${OUT}/img-${String(n).padStart(2, '0')}.png` })
  n++
  if (e.etat === 0 && e.pv === 0 && n > 4) { await page.waitForTimeout(3000); break }
}
if (cdp) {
  await cdp.send('Page.stopScreencast')
  // la liste pour ffmpeg (concat) : chaque image dure jusqu'à la suivante
  let l = ''
  for (let i = 0; i < images.length; i++) l += `file 'f/${String(i).padStart(5, '0')}.jpg'\nduration ${((images[i + 1] ?? images[i] + 0.033) - images[i]).toFixed(4)}\n`
  writeFileSync(`${OUT}/liste.txt`, l)
  console.log('IMAGES', images.length, 'sur', (images.at(-1) - images[0]).toFixed(1), 's')
}
await ctx.close()
await browser.close()
