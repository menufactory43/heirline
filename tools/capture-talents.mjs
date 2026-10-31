// Captures des talents (932 × 430, paysage) sur un banc à part (port 2797, sa propre base) : le choix des six classes,
// l'écran des talents (classe, spécialité, maîtrise), les trois compétences dans le HUD et quelques effets en jeu.
// Usage : node tools/capture-talents.mjs <dossier de sortie> <base du banc>
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
const OUT = process.argv[2] ?? '/tmp/hl-talents/img', DB = process.argv[3] ?? '/tmp/hl-talents/banc.db'
const URL = 'http://127.0.0.1:2797/'
mkdirSync(OUT, { recursive: true })
const attendre = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: 932, height: 430 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
const photo = (n) => page.screenshot({ path: `${OUT}/${n}.png` })
const api = async (path, body) => (await fetch(URL + path.slice(1), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json()

// 1. un compte neuf : le choix de classe (six classes)
const { token } = await api('/api/invite', { famille: 'Varenne' })
await page.addInitScript((t) => { localStorage.setItem('heirline.token', t); localStorage.setItem('heirline.langue', 'fr') }, token)
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-cls]', { timeout: 30000 })
await page.click('[data-cls="eclaireur"]'); await attendre(300)
await photo('classes')
await page.click('[data-a="go"]')
await page.waitForFunction(() => window.heirline?.net?.room?.state?.players?.size > 0, null, { timeout: 30000 })
await attendre(1500)
await photo('niveau1')

// 2. le soldat passe au niveau 32 (dans la base du banc), on recharge
await page.evaluate(() => window.heirline.net.leave())
await attendre(800)
const db = new DatabaseSync(DB)
db.prepare("UPDATE soldiers SET level = 32, talents_json = ? WHERE alive = 1").run(JSON.stringify({ r: { 'eclaireur.oeil_vif': 5, 'eclaireur.jambes': 2, 'eclaireur.souffle': 3 } }))
db.close()
await page.reload({ waitUntil: 'networkidle' })
await page.waitForFunction(() => window.heirline?.net?.room?.state?.players?.size > 0 && window.heirline.net.room, null, { timeout: 30000 })
await attendre(2000)
const ec = () => page.evaluate(() => window.heirline.ecrans.talents())
await ec(); await attendre(400); await photo('talents-classe')
await page.click('[data-a="o:spec"]'); await attendre(300); await photo('talents-spec-choix')
await page.click('[data-a="s:pisteur"]'); await attendre(800)
for (const id of ['collets', 'collets', 'pistes', 'pistes', 'terrain', 'flair', 'flair']) { await page.evaluate((id) => window.heirline.net.room.send('talent', { id: 'pisteur.' + id }), id); await attendre(120) }
await attendre(600); await photo('talents-spec')
await page.click('[data-a="o:maitrise"]'); await attendre(300); await photo('talents-maitrise-choix')
await page.click('[data-a="m:meute"]'); await attendre(800); await photo('talents-maitrise')
await page.click('[data-a="fermer"]'); await attendre(400)
await photo('hud-trois')

// 3. en combat : un voyage de test à la Couveuse (soldat de test au niveau du boss, talents répartis), pilote auto
await page.evaluate(() => window.heirline.net.room.send('voyage', { code: 'banc', dest: 'couveuse' }))
await page.waitForFunction(() => window.heirline?.scene()?.map?.carte === 'nid' && window.heirline.net.room?.state?.players?.size > 0, null, { timeout: 30000 })
await attendre(800)
await page.evaluate(() => window.heirline.net.room.send('autopilote', { on: true }))
for (let i = 0; i < 8; i++) { await attendre(3000); await photo('combat-' + i) }
await browser.close()
console.log('ok', OUT)
