// Captures des donjons (932 × 430) sur le banc à part (port 2797, sa propre base) : le menu de test, puis l'arène de
// l'Engloutisseur (Antre) et celle de la Gueule (Gosier), pilote automatique, une image par phase.
// Usage : node tools/capture-donjons.mjs <dossier>
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
const OUT = process.argv[2] ?? '/tmp/hl-donj'
const URL = 'http://127.0.0.1:2797/'
mkdirSync(OUT, { recursive: true })
const attendre = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] })
for (const dest of ['engloutisseur', 'gueule']) {
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
  if (dest === 'engloutisseur') { await page.evaluate(() => window.heirline.ecrans.boss()); await attendre(500); await photo('menu-test'); await page.keyboard.press('Escape'); await attendre(300) }
  await page.evaluate((d) => window.heirline.net.room.send('voyage', { dest: d, code: 'banc' }), dest)
  await page.waitForFunction(() => window.heirline?.scene()?.arene?.surCarte && window.heirline.net.room?.state?.players?.size > 0, null, { timeout: 30000 }).catch(() => {})
  await attendre(1500)
  await page.evaluate(() => window.heirline.net.room.send('autopilote', { on: true, code: 'banc' }))
  const vues = new Set()
  const fin = Date.now() + 150000
  let n = 0
  while (Date.now() < fin) {
    await attendre(1500)
    const e = await page.evaluate(() => { const a = window.heirline.scene().arene, st = window.heirline.net.room.state; return { etat: a?.etat, phase: a?.phase, motifs: a?.motifs?.length, pv: st.bossPv, teles: window.heirline.scene().teles?.size ?? 0 } })
    if (n++ % 4 === 0) console.log(dest, JSON.stringify(e))
    const k = `${e.phase}`
    if (e.etat && !vues.has(k) && (e.motifs >= 2 || e.teles > 0)) { vues.add(k); await photo(`${dest}-p${e.phase}`) }
    if (vues.size >= 3 || (e.etat === 0 && e.pv === 0 && n > 6)) break
  }
  await ctx.close()
}
await browser.close()
console.log('ok', OUT)
