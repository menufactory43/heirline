// Captures des Hauts de Glane (932 × 430) sur le banc à part (port 2798, sa propre base) : Relâche, le quai et la
// barge, le Gué de Glane, les Champs de Fer, les Serres, le Mât de relais, et la carte du monde.
// Avec « creatures » : les familles des Hauts dans leurs camps, et la lecture de la Pépinière affichée.
// Usage : node tools/capture-hauts.mjs <dossier> [creatures]
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
const OUT = process.argv[2] ?? '/tmp/hl-hauts'
const URL = 'http://127.0.0.1:2798/'
mkdirSync(OUT, { recursive: true })
const attendre = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] })
async function entrer() {
  const ctx = await browser.newContext({ viewport: { width: 932, height: 430 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
  const { token } = await (await fetch(URL + 'api/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ famille: 'Corvel' }) })).json()
  await page.addInitScript((t) => { localStorage.setItem('heirline.token', t); localStorage.setItem('heirline.langue', 'fr') }, token)
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-cls]', { timeout: 30000 })
  await page.click('[data-cls="fantassin"]'); await page.click('[data-a="go"]')
  await page.waitForFunction(() => window.heirline?.net?.room?.state?.players?.size > 0, null, { timeout: 30000 })
  await attendre(1500)
  return { ctx, page }
}
if (process.argv[3] === 'creatures') {
  // la planche des créatures des Hauts, à ×6 (les deux images de chaque animation)
  {
    const { ctx, page } = await entrer()
    const url = await page.evaluate(() => {
      const tx = window.heirline.scene().textures
      const cles = ['glaneur', 'retourne', 'bourgeon', 'bouture', 'fileuse', 'pot', 'balise', 'portenom', 'pylone', 'barge']
      const K = 6, cv = document.createElement('canvas'); cv.width = 1840; cv.height = 470
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#2a2e26'; g.fillRect(0, 0, cv.width, cv.height)
      let x = 16, y = 16, hl = 0
      for (const k of cles) {
        const src = tx.get(k).getSourceImage(), w = src.width * K, h = src.height * K
        if (x + w > cv.width - 16) { x = 16; y += hl + 24; hl = 0 }
        g.drawImage(src, x, y, w, h); g.fillStyle = '#e8e0c8'; g.font = '16px monospace'; g.fillText(k, x, y + h + 16)
        x += w + 28; hl = Math.max(hl, h + 8)
      }
      return cv.toDataURL('image/png')
    })
    const { writeFileSync } = await import('node:fs')
    writeFileSync(`${OUT}/planche.png`, Buffer.from(url.split(',')[1], 'base64'))
    await ctx.close()
  }
  // camp, point où se tenir (tuiles), la lecture imposée (balles, explosions, robots, compétences)
  const vues = [['glaneurs', 533, 174, [30, 4, 2, 3]], ['bourgeons', 528, 266, [6, 22, 3, 2]], ['boutures', 532, 282, [6, 22, 3, 2]], ['fileuses', 522, 95, [4, 3, 18, 2]], ['retournes', 507, 138, [30, 4, 2, 3]]]
  for (const [nom, x, y, lect] of vues) {
    const { ctx, page } = await entrer()
    await page.evaluate((c) => window.heirline.net.room.send('lecture', { code: 'banc', c }), lect)
    await page.evaluate(([x, y]) => window.heirline.net.room.send('tp', { code: 'banc', x: x * 16 + 8, y: y * 16 + 8 }), [x, y])
    await attendre(2600)
    await page.screenshot({ path: `${OUT}/${nom}.png` })
    await ctx.close()
  }
  await browser.close()
  console.log('ok', OUT)
  process.exit(0)
}
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
await attendre(1500)
const tp = async (x, y, ms = 2200) => { await page.evaluate(([x, y]) => window.heirline.net.room.send('tp', { code: 'banc', x: x * 16 + 8, y: y * 16 + 8 }), [x, y]); await attendre(ms) }
for (const [nom, x, y] of [['relache', 476, 278], ['quai', 452, 282], ['gue', 448, 103], ['champs', 548, 160], ['serres', 596, 262], ['mat', 548, 90], ['metier', 566, 46]]) { await tp(x, y); await photo(nom) }
// la barge : depuis le quai de Relâche vers Anse-Grise
await tp(454, 281, 1200)
await page.evaluate(() => window.heirline.net.room.send('station', { id: 'st_relache', vers: 'st_anse' }))
await attendre(7000); await photo('barge')
await attendre(4000)
await page.evaluate(() => window.heirline.ecrans.carte()); await attendre(800); await photo('carte')
await browser.close()
console.log('ok', OUT)
