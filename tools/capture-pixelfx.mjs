// Avant/après pixelfx en jeu (932 × 430) : sur un banc (sa propre base, HEIRLINE_TEST=banc), le soldat à Port-Ancre,
// puis la même suite d'événements d'effets injectée dans la scène (butin par rareté, grenade, compétences, équipement,
// sac de la Couveuse, tirs et impacts, états, pommier du désherbage). Même suite sur les deux builds : la comparaison
// est juste. Usage : node tools/capture-pixelfx.mjs <url> <dossier>
import { chromium } from 'playwright-core'
import { mkdirSync, readdirSync, renameSync } from 'node:fs'
const URL = process.argv[2] ?? 'http://127.0.0.1:2798/'
const OUT = process.argv[3] ?? '/tmp/hl-pixelfx'
mkdirSync(OUT, { recursive: true })
const attendre = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: 932, height: 430 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, recordVideo: { dir: OUT, size: { width: 932, height: 430 } } })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
const photo = (n) => page.screenshot({ path: `${OUT}/${n}.png` })
const { token } = await (await fetch(URL + 'api/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ famille: 'Vitrine' }) })).json()
await page.addInitScript((t) => { localStorage.setItem('heirline.token', t); localStorage.setItem('heirline.langue', 'fr'); localStorage.setItem('heirline.tremble', '0') }, token)
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-cls]', { timeout: 30000 })
await page.click('[data-cls="ingenieur"]'); await page.click('[data-a="go"]')
await page.waitForFunction(() => window.heirline?.net?.room?.state?.players?.size > 0, null, { timeout: 30000 })
await attendre(2500)
// une suite d'effets autour du soldat, en trois vagues
const vague = (n) => page.evaluate((n) => {
  const sc = window.heirline.scene(), me = sc.net.room.state.players.get(sc.net.room.sessionId)
  const x = me.x, y = me.y
  const j = (nom, dx, dy, o = {}) => sc.vfx.joue(nom, x + dx, y + dy, { depth: 4600, ...o })
  if (n === 0) {
    sc.fx([0, 1, 2, 3, 4].map((r, i) => ({ k: 'butin', x: x - 90 + i * 45, y: y - 40, r, c: ['#c9d1d9', '#7dff9a', '#7fb8ff', '#c48bff', '#ffd040'][r], s: 'Objet' })))
    j('impact-fan-1', -60, 40); j('impact-acide', -20, 40); j('impact-ecl-4', 20, 40); j('impact-bro-4', 60, 40)
  } else if (n === 1) {
    sc.fx([{ k: 'boom', x: x - 70, y: y + 10, r: 40, ami: 1 }, { k: 'sk', s: 'injection', x: x + 70, y: y, r: 40 }, { k: 'sk', s: 'champ', x: x, y: y - 50, r: 34 }])
    for (const [i, nom] of ['tir-ing-4', 'tir-ecl-4', 'tir-bro-4'].entries()) { const s = j(nom, -40 + i * 40, 60); if (s) setTimeout(() => sc.vfx.lacher(s), 1800) }
  } else {
    sc.fx([{ k: 'sk', s: 'mortier', x: x - 70, y: y, r: 30 }, { k: 'sk', s: 'devore', x: x + 70, y: y - 30, x2: x + 70, y2: y - 30 }, { k: 'sk', s: 'recycle', x: x + 70, y: y + 30, x2: x + 70, y2: y + 30 }])
    sc.fx([{ k: 'mort', kind: 14, x: x, y: y + 50 }])
    for (const [i, nom] of ['etat-etourdi', 'etat-ralenti', 'etat-marque', 'etat-feu'].entries()) { const s = j(nom, -60 + i * 40, -40); if (s) setTimeout(() => sc.vfx.lacher(s), 2500) }
    j('biomasse', 0, 90)
  }
}, n)
for (let n = 0; n < 3; n++) {
  await vague(n)
  await attendre(350); await photo(`v${n}-a`)
  await attendre(450); await photo(`v${n}-b`)
  await attendre(2400)
}
await ctx.close(); await browser.close()
const vid = readdirSync(OUT).find((f) => f.endsWith('.webm'))
if (vid) renameSync(`${OUT}/${vid}`, `${OUT}/video.webm`)
console.log('ok', OUT)
