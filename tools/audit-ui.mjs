// Audit de l'interface : chaque écran, sur téléphones (paysage, portrait), tablette et bureau, en français et en anglais.
// Pour chaque capture, un contrôle automatique dans la page : texte coupé, éléments hors de l'écran, blocs du HUD qui se
// chevauchent, boutons trop petits au doigt (< 44 px). Banc à part (son port, sa base, HEIRLINE_DEBUG pour se placer).
// Usage : node tools/audit-ui.mjs <url du banc> <dossier> [webkit]
import { chromium, webkit } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
const URL = process.argv[2] ?? 'http://127.0.0.1:2798/'
const OUT = process.argv[3] ?? '/tmp/hl-audit/ui'
const MOTEUR = process.argv[4] === 'webkit' ? 'webkit' : 'chromium'
const DEBUG = process.env.HEIRLINE_DEBUG ?? 'banc'
const SEUL = process.env.SEUL // un seul format, pour reprendre
mkdirSync(OUT, { recursive: true })
const attendre = (ms) => new Promise((r) => setTimeout(r, ms))

const FORMATS = [
  { id: 'iphone-paysage', w: 932, h: 430, tactile: true, langues: ['fr', 'en'], arenes: true },
  { id: 'iphone13-paysage', w: 844, h: 390, tactile: true, langues: ['fr'] },
  { id: 'iphone-portrait', w: 430, h: 932, tactile: true, langues: ['fr'], arenes: true },
  { id: 'android-petit', w: 800, h: 360, tactile: true, langues: ['fr'] },
  { id: 'ipad', w: 1180, h: 820, tactile: true, langues: ['fr'] },
  { id: 'bureau-720', w: 1280, h: 720, tactile: false, langues: ['fr'] },
  { id: 'bureau-1080', w: 1920, h: 1080, tactile: false, langues: ['fr', 'en'], arenes: true },
  { id: 'bureau-1440', w: 2560, h: 1440, tactile: false, langues: ['fr'] },
]

// le contrôle, exécuté dans la page
function controler(tactile) {
  const W = innerWidth, H = innerHeight, pb = []
  const visible = (el) => { const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.closest('.cache') }
  const nom = (el) => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '')) + (el.dataset?.a ? `[${el.dataset.a}]` : '') + ' « ' + (el.textContent ?? '').trim().slice(0, 30) + ' »'
  // en portrait hors de l'arène, « tourne ton téléphone » couvre tout : rien de ce qui est dessous ne se voit
  const tourne = document.getElementById('tourne')
  if (tourne && getComputedStyle(tourne).display !== 'none') return pb
  const ecran = document.getElementById('ecran'), ouvert = ecran && !ecran.classList.contains('cache')
  const racines = ouvert ? [document.getElementById('ecran-boite')] : [document.getElementById('hud')]
  for (const racine of racines) {
    if (!racine) continue
    for (const el of racine.querySelectorAll('*')) {
      if (!visible(el)) continue
      const r = el.getBoundingClientRect(), s = getComputedStyle(el)
      // hors de l'écran (au-delà d'un pixel)
      if (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1) {
        // dans une boîte qui défile, c'est normal
        let p = el.parentElement, defile = false
        while (p && p !== document.body) { const ps = getComputedStyle(p); if (/(auto|scroll)/.test(ps.overflowY + ps.overflowX)) { defile = true; break } p = p.parentElement }
        if (!defile) pb.push({ type: 'hors-ecran', el: nom(el), r: [r.left, r.top, r.right, r.bottom].map(Math.round) })
      }
      // texte coupé : contenu plus large que la boîte, sans points de suspension voulus
      const feuille = el.children.length === 0 && (el.textContent ?? '').trim().length > 1
      if (feuille && el.scrollWidth > el.clientWidth + 2 && s.overflow !== 'visible' && s.textOverflow !== 'ellipsis') pb.push({ type: 'texte-coupe', el: nom(el), w: el.clientWidth, sw: el.scrollWidth })
      if (feuille && el.scrollHeight > el.clientHeight + 2 && s.overflowY === 'hidden' && s.webkitLineClamp === 'none' && s.textOverflow !== 'ellipsis') pb.push({ type: 'texte-coupe-h', el: nom(el), h: el.clientHeight, sh: el.scrollHeight })
      // cible tactile
      if (tactile && (el.tagName === 'BUTTON' || el.dataset?.a || el.dataset?.ui) && (r.width < 44 || r.height < 44)) {
        // tolérance : une cible un peu petite mais isolée (la zone de toucher effective inclut le rembourrage du parent)
        pb.push({ type: 'cible-petite', el: nom(el), wh: [Math.round(r.width), Math.round(r.height)] })
      }
    }
  }
  // chevauchements entre blocs du HUD (sans écran ouvert)
  if (!ouvert) {
    const blocs = ['plaque-soldat', 'plaque-robot', 'suivi', 'zone', 'boss', 'menu-icones', 'bloc-carte', 'lieu-titre', 'bandeau', 'action-ctx', 'boutons', 'aide-clavier']
      .map((id) => document.getElementById(id)).filter((el) => el && visible(el))
    for (let i = 0; i < blocs.length; i++) for (let j = i + 1; j < blocs.length; j++) {
      const a = blocs[i].getBoundingClientRect(), b = blocs[j].getBoundingClientRect()
      const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      if (ix > 2 && iy > 2) pb.push({ type: 'chevauchement', el: '#' + blocs[i].id + ' × #' + blocs[j].id, aire: Math.round(ix * iy) })
    }
  }
  return pb
}

const rapport = {}
const lancer = MOTEUR === 'webkit' ? () => webkit.launch() : () => chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] })
const browser = await lancer()
for (const f of FORMATS) {
  if (SEUL && f.id !== SEUL) continue
  for (const langue of f.langues) {
    const cle = `${f.id}-${langue}`
    rapport[cle] = {}
    const ctx = await browser.newContext({ viewport: { width: f.w, height: f.h }, deviceScaleFactor: f.w > 1900 ? 1 : 2, hasTouch: f.tactile, isMobile: f.tactile && MOTEUR === 'chromium' })
    const page = await ctx.newPage()
    const erreurs = []
    page.on('pageerror', (e) => erreurs.push(e.message))
    const photo = async (n) => {
      await attendre(350)
      await page.screenshot({ path: `${OUT}/${cle}-${n}.png` })
      rapport[cle][n] = await page.evaluate(controler, f.tactile)
    }
    const ecran = async (n, js, arg) => { try { await page.evaluate(js, arg); await photo(n); await page.evaluate(() => { const b = document.querySelector('#ecran [data-a="fermer"]'); if (b) b.click(); else document.getElementById('ecran').classList.add('cache') }) } catch (e) { rapport[cle][n] = [{ type: 'erreur', el: String(e).slice(0, 200) }] } }
    try {
      const inv = await (await fetch(URL + 'api/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ famille: 'Audit' }) })).json()
      await page.addInitScript(([t, l]) => { localStorage.setItem('heirline.token', t); localStorage.setItem('heirline.langue', l) }, [inv.token, langue])
      await page.goto(URL, { waitUntil: 'networkidle' })
      await page.waitForSelector('[data-cls]', { timeout: 30000 })
      // en portrait, hors de l'arène, le jeu demande de tourner le téléphone (#tourne) : on le photographie, puis on
      // clique par le code pour aller voir les arènes, qui se jouent aussi en portrait
      const portrait = f.h > f.w && f.tactile
      if (portrait) await photo('tourne')
      const clic = (sel) => portrait ? page.evaluate((s) => document.querySelector(s).click(), sel) : page.click(sel)
      await clic('[data-cls="fantassin"]')
      await photo('creation')
      await clic('[data-a="go"]')
      await page.waitForFunction(() => window.heirline?.net?.room?.state?.players?.size > 0, null, { timeout: 30000 })
      await attendre(2500)
      await photo('monde')
      for (const n of ['menu', 'sac', 'journal', 'carte', 'talents', 'son', 'social', 'boss', 'lignee', 'morts', 'cle', 'atelier']) {
        await ecran(n, (n) => window.heirline.ecrans[n]?.(), n)
        await attendre(150)
      }
      await ecran('gare', () => window.heirline.ecrans.gare('st_port'))
      await ecran('echange', () => window.heirline.ecrans.echange())
      await ecran('releve', () => window.heirline.ecrans.releve({ given: 'Ugo', family: 'Audit', generation: 3, level: 12, killer: null, robot: true, heritierNiveau: 6, lignee: [] }))
      // un dialogue : le plus proche des habitants de Port-Ancre
      const pnj = await page.evaluate((code) => {
        const sc = window.heirline.scene(), me = sc.players.get(window.heirline.net.room.sessionId)
        let best = null, bd = 1e9
        for (const [id, v] of sc.npcs) { const d = Math.hypot(v.c.x - me.c.x, v.c.y - me.c.y); if (d < bd) { bd = d; best = { id, x: v.c.x, y: v.c.y } } }
        if (best) window.heirline.net.room.send('tp', { code, x: best.x + 12, y: best.y + 10 })
        return best
      }, DEBUG)
      if (pnj) { await attendre(900); await page.evaluate((id) => window.heirline.net.room.send('parler', { id }), pnj.id); await attendre(700); await photo('dialogue'); await page.evaluate(() => (document.querySelector('#ecran [data-o="bye"]') ?? document.querySelector('#ecran [data-a="fermer"]'))?.click()) }
      // la discussion ouverte (si le bouton existe)
      await page.evaluate(() => document.querySelector('[data-ui="chat"], #chat-bouton, .chat-bascule')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
      await attendre(300); await photo('discussion')
      // le monorail : le quai de Port-Ancre, puis un trajet vers le Col
      await page.evaluate((code) => { const g = { x: 227 * 16 + 8, y: 318 * 16 + 8 }; window.heirline.net.room.send('tp', { code, x: g.x, y: g.y }) }, DEBUG)
      await attendre(800)
      await page.evaluate(() => window.heirline.net.room.send('station', { id: 'st_port', vers: 'st_col' }))
      await attendre(5500); await photo('monorail')
      await attendre(9000)
      // les arènes (trois formats seulement : elles demandent chacune un passage)
      if (f.arenes && langue === f.langues[0]) {
        for (const boss of ['couveuse', 'engloutisseur', 'gueule', 'semeur', 'pepiniere', 'greffier', 'glaneuse']) {
          await page.evaluate((b) => window.heirline.net.room.send('voyage', { code: 'banc', dest: b }), boss)
          await page.waitForFunction((b) => { const c = window.heirline?.scene()?.map?.carte; return c && c !== 'ossara' && window.heirline.net.room?.state?.players?.size > 0 }, boss, { timeout: 30000 }).catch(() => {})
          await attendre(6000)
          await photo('arene-' + boss)
        }
        await page.evaluate(() => window.heirline.net.room.send('voyage', { code: 'banc', dest: 'port' }))
        await attendre(4000)
      }
    } catch (e) { rapport[cle].erreur = [{ type: 'erreur', el: String(e).slice(0, 300) }] }
    rapport[cle].pageerror = erreurs.map((e) => ({ type: 'pageerror', el: e.slice(0, 200) }))
    await ctx.close()
    writeFileSync(`${OUT}/rapport-${MOTEUR}${SEUL ? '-' + SEUL : ''}.json`, JSON.stringify(rapport, null, 1))
    console.log(cle, Object.values(rapport[cle]).flat().length, 'remarques')
  }
}
await browser.close()
