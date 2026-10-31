// La latence vue d'un vrai navigateur, derrière un relais qui ajoute de la latence (tools/proxy-latence.mjs).
// Mesure : ping, délai entre une touche et le soldat qui bouge à l'écran (prédiction) puis dans l'état du serveur,
// sauts de position du soldat (réconciliation), et dans l'arène, chaque balle qui touche : était-elle sur le soldat à
// l'écran, ou l'avait-il esquivée ? Usage : node tools/mesure-latence.mjs <url> <étiquette> [secondes d'arène]
import { chromium } from 'playwright-core'
const URL = process.argv[2], NOM = process.argv[3] ?? 'lan', ARENE_S = Number(process.argv[4] ?? 45)
const API = process.env.API ?? URL // l'API d'invitation sans le relais
const DEBUG = process.env.HEIRLINE_DEBUG ?? 'banc'
const attendre = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] })
const page = await (await b.newContext({ viewport: { width: 932, height: 430 }, deviceScaleFactor: 1 })).newPage()
page.on('pageerror', (e) => console.log('PAGEERROR', e.message)); page.on('requestfailed', (r) => console.log('ECHEC', r.url().slice(-60), r.failure()?.errorText))
const inv = await (await fetch(API + 'api/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ famille: 'Latence' }) })).json()
await page.addInitScript((t) => { localStorage.setItem('heirline.token', t); localStorage.setItem('heirline.langue', 'fr') }, inv.token)
await page.goto(URL, { waitUntil: 'load', timeout: 120000 })
await page.waitForSelector('[data-cls="fantassin"]', { timeout: 60000 }).catch(async (e) => { await page.screenshot({ path: '/tmp/hl-audit/echec-' + NOM.replace(/\W/g, '') + '.png' }); console.log('TEXTE', await page.evaluate(() => document.body.innerText.slice(0, 300))); throw e })
await page.click('[data-cls="fantassin"]'); await page.click('[data-a="go"]')
await page.waitForFunction(() => window.heirline?.net?.room?.state?.players?.size > 0, null, { timeout: 30000 })
await attendre(4000)
// un endroit dégagé de Port-Ancre
await page.evaluate((code) => window.heirline.net.room.send('tp', { code, x: 200 * 16, y: 300 * 16 }), DEBUG)
await attendre(1500)

// l'enregistreur, dans la page : une ligne par image
await page.evaluate(() => {
  const H = window.heirline, R = window.__lat = { images: [], touches: [], appuis: [], hp: [] }
  const sid = () => H.net.room.sessionId
  addEventListener('keydown', (e) => { if (!e.repeat) R.appuis.push({ t: performance.now(), code: e.code }) }, true)
  H.net.on('bh', (m) => R.touches.push({ t: performance.now(), m: m.m, i: m.i, v: m.v, moi: m.v === H.net.room.sessionId }))
  const minD = R.minD = new Map()
  let avant = null
  const boucle = () => {
    const sc = H.scene(), v = sc?.players?.get(sid()), s = H.net.room?.state?.players?.get(sid())
    if (v && s) {
      const t = performance.now()
      const img = { t, x: v.c.x, y: v.c.y, sx: s.x, sy: s.y, hp: s.hp, vit: s.vit, dash: s.dashT > 0 || (H.net.me?.state?.dashT ?? 0) > 0, ping: H.net.ping }
      R.images.push(img)
      // les balles affichées : la plus petite distance de chaque balle au soldat affiché
      const ar = sc.arene
      if (ar && ar.motifs?.length) {
        const ping = H.net.ping / 1000
        for (const mv of ar.motifs) {
          const tt = mv.m.t0 - mv.dt + (t - mv.recu) / 1000 + ping
          const bs = H.motifs.balles(mv.m)
          for (let i = 0; i < bs.length; i++) {
            if (mv.mortes.has(i)) continue
            const p = H.motifs.posBalle(mv.m, bs[i], tt)
            if (!p) continue
            const d = Math.hypot(p.x - v.c.x, p.y - v.c.y) - bs[i].r - H.motifs.TOUCHE_R
            const k = mv.m.id + ':' + i, o = minD.get(k)
            if (!o || d < o.d) minD.set(k, { d, t })
          }
        }
      }
      avant = img
    }
    requestAnimationFrame(boucle)
  }
  requestAnimationFrame(boucle)
})

// 1. du doigt à l'écran : huit appuis courts
for (let k = 0; k < 8; k++) { await page.keyboard.down(k % 2 ? 'KeyA' : 'KeyD'); await attendre(250); await page.keyboard.up(k % 2 ? 'KeyA' : 'KeyD'); await attendre(650) }
// 2. marche libre 12 s : changements de direction fréquents, une ruée de temps en temps
const marche = async (s) => {
  const fin = Date.now() + s * 1000, touches = ['KeyW', 'KeyA', 'KeyS', 'KeyD']
  while (Date.now() < fin) {
    const a = touches[Math.floor(Math.random() * 4)], c = touches[Math.floor(Math.random() * 4)]
    await page.keyboard.down(a); if (Math.random() < 0.5) await page.keyboard.down(c)
    if (Math.random() < 0.12) await page.keyboard.press('Space')
    await attendre(250 + Math.random() * 450)
    await page.keyboard.up(a); await page.keyboard.up(c)
  }
}
await marche(12)
const monde = await page.evaluate(() => {
  const R = window.__lat, im = R.images
  // délais : pour chaque appui, la première image où le soldat affiché bouge, puis où l'état du serveur bouge
  const delais = R.appuis.filter((a) => a.code === 'KeyD' || a.code === 'KeyA').slice(0, 8).map((a) => {
    const i0 = im.findIndex((x) => x.t >= a.t); if (i0 < 1) return null
    const ref = im[i0 - 1]
    const ecran = im.slice(i0).find((x) => Math.abs(x.x - ref.x) > 0.5), serveur = im.slice(i0).find((x) => Math.abs(x.sx - ref.sx) > 0.5)
    return { ecran: ecran ? ecran.t - a.t : null, serveur: serveur ? serveur.t - a.t : null }
  }).filter(Boolean)
  // sauts : un déplacement d'une image à l'autre bien au-delà de la vitesse (hors ruée) = une correction visible
  let sauts = 0, grands = 0, n = 0
  for (let i = 1; i < im.length; i++) {
    const dt = (im[i].t - im[i - 1].t) / 1000, d = Math.hypot(im[i].x - im[i - 1].x, im[i].y - im[i - 1].y)
    if (dt <= 0 || dt > 0.1 || im[i].dash || im[i - 1].dash) continue
    n++
    if (d > (im[i].vit || 110) * dt * 1.6 + 1.5) sauts++
    if (d > 12) grands++
  }
  const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? Math.round(s[Math.floor(s.length / 2)]) : null }
  return { ping: Math.round(im[im.length - 1].ping), delaiEcranMs: med(delais.map((d) => d.ecran)), delaiServeurMs: med(delais.map((d) => d.serveur)), images: n, sauts, grandsSauts: grands, ips: Math.round(n / ((im[im.length - 1].t - im[0].t) / 1000)) }
})

// 3. l'arène de la Couveuse : marche en zigzag sans viser l'esquive, puis on compare les touches à l'écran
await page.evaluate(() => window.heirline.net.room.send('voyage', { code: 'banc', dest: 'couveuse' }))
await page.waitForFunction(() => window.heirline?.scene()?.map?.carte === 'nid' && window.heirline.net.room?.state?.players?.size > 0, null, { timeout: 30000 })
await attendre(3000)
await page.evaluate(() => { const R = window.__lat; R.images = []; R.touches = []; R.minD.clear(); R.debutArene = performance.now() })
await marche(ARENE_S)
const arene = await page.evaluate(() => {
  const R = window.__lat, im = R.images
  // mes touches : une balle « bh » suivie d'une baisse de mes PV dans les 250 ms
  const miennes = []
  for (const h of R.touches) if (h.moi) miennes.push(h)
  let injustes = 0, limites = 0; const ds = []
  for (const h of miennes) {
    const o = R.minD.get(h.m + ':' + h.i)
    const d = o ? o.d : 99
    ds.push(Math.round(d * 10) / 10)
    if (d > 6) injustes++; else if (d > 0) limites++
  }
  // les frôlements : une balle affichée sur le soldat (d < 0) sans touche du serveur
  const touchees = new Set(R.touches.map((h) => h.m + ':' + h.i))
  let gratuites = 0
  for (const [k, o] of R.minD) if (o.d < -1 && !touchees.has(k)) gratuites++
  return { touchesSurMoi: miennes.length, injustes, limites, distancesPx: ds.slice(0, 30), frolementsSansTouche: gratuites, ballesSuivies: R.minD.size }
})
console.log(JSON.stringify({ config: NOM, monde, arene }))
await b.close()
