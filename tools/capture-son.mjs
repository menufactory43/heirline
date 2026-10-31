// Capture avec le son : un soldat à Port-Ancre, le monorail jusqu'au Col, puis la Couveuse en arène (pilote
// automatique). L'image vient du screencast de Chrome, le son de la sortie WebAudio du jeu (MediaRecorder) ;
// ffmpeg assemble les deux. Banc : un serveur à part (HEIRLINE_DB, HEIRLINE_DEBUG, HEIRLINE_BOSS_PV), jamais le 2700.
//   node tools/capture-son.mjs http://127.0.0.1:2796 code-de-banc /tmp/sortie
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
const [URL = 'http://127.0.0.1:2796', CODE = 'banc-son', OUT = '/tmp/hson/cap'] = process.argv.slice(2)
mkdirSync(OUT + '/f', { recursive: true })
const { token } = await (await fetch(URL + '/api/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ famille: 'Sonore' }) })).json()
const W = 932, H = 430
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', `--window-size=${W},${H}`] })
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)) })
await page.addInitScript((t) => { localStorage.setItem('heirline.token', t); localStorage.setItem('heirline.langue', 'fr') }, token)
await page.goto(URL + '/', { waitUntil: 'networkidle' })
await page.click('[data-a="classe"][data-cls="fantassin"]')
await page.click('[data-a="go"]')
await page.waitForFunction(() => window.heirline?.net?.room?.state?.players?.size > 0, null, { timeout: 30000 })
await page.waitForTimeout(1500)
// le son : le premier geste ouvre le contexte, puis on branche l'enregistreur sur la sortie
await page.touchscreen.tap(W / 2, H / 2)
await page.waitForFunction(() => window.heirline.son.pret(), null, { timeout: 10000 })
// les images : le screencast de Chrome, horodaté
const images = []
const cdp = await ctx.newCDPSession(page)
cdp.on('Page.screencastFrame', async (f) => {
  writeFileSync(`${OUT}/f/${String(images.length).padStart(5, '0')}.jpg`, Buffer.from(f.data, 'base64'))
  images.push(f.metadata.timestamp)
  cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
})
const debutSon = await page.evaluate(() => {
  const st = window.heirline.son.flux()
  const rec = new MediaRecorder(st, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 160000 })
  window.__morceaux = []
  rec.ondataavailable = (e) => window.__morceaux.push(e.data)
  rec.start(500)
  window.__rec = rec
  return Date.now() / 1000
})
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: W * 2, maxHeight: H * 2, everyNthFrame: 1 })
const etat = () => page.evaluate(() => ({ ...window.heirline.son.etat(), carte: window.heirline.scene().map?.carte }))
const tp = (x, y) => page.evaluate(([x, y, c]) => window.heirline.net.room.send('tp', { code: c, x, y }), [x, y, CODE])
// 1. Port-Ancre : la ville, le port
console.log('port', JSON.stringify(await etat()))
await page.waitForTimeout(6000)
// 2. la gare de Port-Ancre, puis le monorail jusqu'au Col
await tp(227 * 16 + 8, 318 * 16 + 8)
await page.waitForTimeout(1500)
await page.evaluate(() => window.heirline.net.room.send('station', { id: 'st_port', vers: 'st_col' }))
for (let i = 0; i < 7; i++) { await page.waitForTimeout(2000); console.log('rail', JSON.stringify(await etat())) }
await page.waitForTimeout(2000)
// 3. la Couveuse, en pilote automatique
await page.evaluate((c) => window.heirline.net.room.send('voyage', { code: c, dest: 'couveuse' }), CODE)
await page.waitForFunction(() => window.heirline?.scene()?.map?.carte === 'nid' && window.heirline.net.room?.state?.players?.size > 0, null, { timeout: 30000 })
await page.waitForTimeout(800)
await page.evaluate((c) => window.heirline.net.room.send('autopilote', { code: c, on: true }), CODE)
const fin = Date.now() + 48000
while (Date.now() < fin) {
  await page.waitForTimeout(3000)
  const e = await page.evaluate(() => { const a = window.heirline.scene().arene; return { etat: a.etat, phase: a.phase, pv: window.heirline.net.room.state.bossPv } })
  console.log('arene', JSON.stringify({ ...e, ...(await etat()) }))
  if (e.etat === 0 && e.pv === 0) { await page.waitForTimeout(5000); break }
}
await cdp.send('Page.stopScreencast')
const audio = await page.evaluate(() => new Promise((ok) => {
  window.__rec.onstop = async () => {
    const b = new Blob(window.__morceaux, { type: 'audio/webm' })
    const a = new Uint8Array(await b.arrayBuffer())
    let s = ''
    for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000))
    ok(btoa(s))
  }
  window.__rec.stop()
}))
writeFileSync(`${OUT}/son.webm`, Buffer.from(audio, 'base64'))
let l = ''
for (let i = 0; i < images.length; i++) l += `file 'f/${String(i).padStart(5, '0')}.jpg'\nduration ${((images[i + 1] ?? images[i] + 0.033) - images[i]).toFixed(4)}\n`
writeFileSync(`${OUT}/liste.txt`, l)
// le décalage du son par rapport à la première image
writeFileSync(`${OUT}/decalage.txt`, String((images[0] - debutSon).toFixed(3)))
console.log('IMAGES', images.length, 'sur', (images.at(-1) - images[0]).toFixed(1), 's ; son en avance de', (images[0] - debutSon).toFixed(2), 's')
await ctx.close()
await browser.close()
