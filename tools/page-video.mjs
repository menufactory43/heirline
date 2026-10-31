// Petit serveur de la page vidéo (réseau local), avec les requêtes partielles (Range) qu'exige Safari sur iPhone.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const DIR = new URL('../captures/boss', import.meta.url).pathname
const TYPES = { '.html': 'text/html; charset=utf-8', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.png': 'image/png' }
http.createServer((req, res) => {
  const nom = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html'
  const f = path.join(DIR, path.normalize(nom))
  if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end() }
  const taille = fs.statSync(f).size, type = TYPES[path.extname(f)] ?? 'application/octet-stream'
  const r = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '')
  if (r) {
    const a = r[1] ? Number(r[1]) : taille - Number(r[2]), b = r[1] && r[2] ? Math.min(Number(r[2]), taille - 1) : taille - 1
    res.writeHead(206, { 'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${a}-${b}/${taille}`, 'content-length': b - a + 1 })
    return fs.createReadStream(f, { start: a, end: b }).pipe(res)
  }
  res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': taille })
  fs.createReadStream(f).pipe(res)
}).listen(5196, '0.0.0.0')
