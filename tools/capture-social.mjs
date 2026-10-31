// Captures du social (932 × 430) sur le banc à part (port 2797, sa propre base) : deux soldats côte à côte (deux
// navigateurs), la discussion, l'écran Social, le groupe et ses cadres, une marque, l'échange à double validation, le
// duel. Usage : node tools/capture-social.mjs <dossier>
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
const OUT = process.argv[2] ?? '/tmp/hl-social'
const URL = 'http://127.0.0.1:2797/'
mkdirSync(OUT, { recursive: true })
const attendre = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] })
async function soldat(fam, cls) {
  const ctx = await browser.newContext({ viewport: { width: 932, height: 430 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('PAGEERROR', fam, e.message))
  const { token } = await (await fetch(URL + 'api/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ famille: fam }) })).json()
  await page.addInitScript((t) => { localStorage.setItem('heirline.token', t); localStorage.setItem('heirline.langue', 'fr') }, token)
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-cls]', { timeout: 30000 })
  await page.click(`[data-cls="${cls}"]`); await page.click('[data-a="go"]')
  await page.waitForFunction(() => window.heirline?.net?.room?.state?.players?.size > 0, null, { timeout: 30000 })
  await attendre(1500)
  return page
}
const A = await soldat('Corvel', 'fantassin')
const B = await soldat('Sève', 'medic')
const sidB = await B.evaluate(() => window.heirline.net.room.sessionId)
const sidA = await A.evaluate(() => window.heirline.net.room.sessionId)
// la discussion
await A.click('#btn-chat'); await attendre(200)
await A.fill('#chat input', 'Quelqu\'un pour le Gosier ce soir ?'); await A.press('#chat input', 'Enter')
await B.evaluate(() => window.heirline.net.room.send('chat', { c: 'local', t: 'Moi ! Je soigne.' }))
await attendre(300)
await A.evaluate(() => window.heirline.net.room.send('chat', { c: 'monde', t: 'Recrute pour le raid du Semeur, il faut deux tanks.' }))
await attendre(600); await A.screenshot({ path: `${OUT}/chat.png` })
await A.click('#btn-chat')
// le groupe
await A.evaluate(() => { window.heirline.ecrans.social() }); await attendre(400); await A.screenshot({ path: `${OUT}/proches.png` })
await A.click(`[data-a="inv:groupe:${sidB}"]`); await attendre(500)
await B.screenshot({ path: `${OUT}/invitation.png` })
await B.click('#invit-groupe [data-o="1"]'); await attendre(600)
await A.click('[data-a="o:groupe"]'); await attendre(300)
await A.click('[data-a="marque:0"]'); await attendre(400)
await A.screenshot({ path: `${OUT}/groupe.png` })
await A.click('[data-a="fermer"]'); await attendre(500); await A.screenshot({ path: `${OUT}/cadres.png` })
// la guilde
await A.evaluate(() => window.heirline.ecrans.social()); await attendre(200)
await A.click('[data-a="o:guilde"]'); await attendre(200)
await A.fill('#g-nom', 'Les Veilleurs du Port'); await A.fill('#g-tag', 'VPA'); await A.click('[data-a="fonder"]'); await attendre(600)
await A.click('[data-a="o:proches"]'); await attendre(200); await A.click(`[data-a="inv:guilde:${sidB}"]`); await attendre(400)
await B.click('#invit-guilde [data-o="1"]'); await attendre(500)
await A.click('[data-a="o:guilde"]'); await attendre(400); await A.screenshot({ path: `${OUT}/guilde.png` })
// l'échange
await A.click('[data-a="o:proches"]'); await attendre(200); await A.click(`[data-a="inv:echange:${sidB}"]`); await attendre(400)
await B.click('#invit-echange [data-o="1"]'); await attendre(600)
const u = await A.evaluate(() => window.heirline.ecrans && document.querySelector('.grille-choix button')?.dataset.a)
if (u) { await A.click(`[data-a="${u}"]`); await attendre(200) }
await A.click('[data-a="offre"]'); await attendre(400)
await A.click('[data-a="verrou"]'); await B.click('[data-a="verrou"]'); await attendre(500)
await A.screenshot({ path: `${OUT}/echange.png` })
await A.click('[data-a="annuler"]'); await attendre(400)
// le duel
await A.evaluate(() => window.heirline.ecrans.social()); await attendre(200)
await A.click(`[data-a="inv:duel:${sidB}"]`); await attendre(400)
await B.click('#invit-duel [data-o="1"]'); await attendre(700)
await A.screenshot({ path: `${OUT}/duel.png` })
await browser.close()
console.log('ok', sidA, sidB)
