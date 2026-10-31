// Captures du butin (932 × 430) sur le banc à part (port 2797, sa propre base) : le sac à neuf emplacements, la
// comparaison avec l'objet porté, un légendaire, une pièce d'ensemble (deux portées), le recyclage.
// Usage : node tools/capture-butin.mjs <dossier> <base du banc> <fichier JSON { inv, equip }>
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
const [OUT, DB, OBJ] = [process.argv[2] ?? '/tmp/hl-butin', process.argv[3] ?? '/tmp/hl-talents/banc.db', process.argv[4] ?? '/tmp/hl-butin/objets.json']
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
await attendre(1000)
await page.evaluate(() => window.heirline.net.leave()); await attendre(800)
const o = JSON.parse(readFileSync(OBJ, 'utf8'))
const db = new DatabaseSync(DB)
db.prepare('UPDATE soldiers SET level = 22, inv_json = ?, equip_json = ? WHERE alive = 1').run(JSON.stringify(o.inv), JSON.stringify(o.equip))
db.prepare('UPDATE accounts SET scrap = 840').run()
db.close()
await page.reload({ waitUntil: 'networkidle' })
await page.waitForFunction(() => window.heirline?.net?.room?.state?.players?.size > 0, null, { timeout: 30000 })
await attendre(1800)
await page.evaluate(() => window.heirline.ecrans.sac()); await attendre(500); await photo('sac')
for (const [i, n] of [[0, 'compare'], [1, 'legendaire'], [2, 'ensemble']]) {
  await page.click(`.grille-objets .case[data-u="${o.inv[i].u}"]`); await attendre(400); await photo(n)
}
await page.click(`.poupee [data-u="eq:canon"]`); await attendre(400); await photo('robot')
await page.click(`.grille-objets .case[data-u="${o.inv[3].u}"]`); await attendre(300)
await page.click('[data-a="recycler"]'); await attendre(800); await photo('recycle')
await browser.close()
console.log('ok', OUT)
