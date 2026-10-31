// Les icônes de l'interface, dessinées par le code en pixel art (16 × 16), détourées, mises en cache en data-URL.
// Même lumière que les sprites du jeu : dessus éclairé, détour sombre. Pas d'image externe.

type Ctx = CanvasRenderingContext2D

const C = {
  k: '#0c0e0b', acier0: '#2e343b', acier1: '#4a525c', acier2: '#7a838e', acier3: '#b4bcc6', blanc: '#eef0e4',
  orange: '#ff9b3d', orange2: '#ffd36b', rouille: '#9a5a2a', rouge: '#d8484a', rouge2: '#ff8a7a',
  vert: '#9be37a', vert2: '#4f9a3c', kaki: '#5d6b3c', kaki2: '#7d8a5a', cuir: '#7a5432', cuir2: '#a87a4a', cuir0: '#4a321c',
  violet: '#b06ad8', violet2: '#e0a8ff', cyan: '#7fd6ff', cyan2: '#d8f4ff', jaune: '#ffe36b', papier: '#e0d4b0', papier2: '#b8aa84',
}

function px(c: Ctx, x: number, y: number, col: string) { c.fillStyle = col; c.fillRect(x, y, 1, 1) }
function rect(c: Ctx, x: number, y: number, w: number, h: number, col: string) { c.fillStyle = col; c.fillRect(x, y, w, h) }
function ell(c: Ctx, cx: number, cy: number, rx: number, ry: number, col: string) {
  c.fillStyle = col
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) c.fillRect(x, y, 1, 1)
  }
}
function line(c: Ctx, x0: number, y0: number, x1: number, y1: number, col: string) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= n; i++) px(c, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), col)
}
function poly(c: Ctx, pts: [number, number][], col: string) {
  c.fillStyle = col; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); c.closePath(); c.fill()
}

/** Détour sombre d'un pixel autour de tout ce qui est dessiné, et un reflet en haut à gauche. */
function finir(c: Ctx, w: number, h: number) {
  const img = c.getImageData(0, 0, w, h), d = img.data
  const a = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h ? d[(y * w + x) * 4 + 3] > 40 : false
  const out = new Uint8ClampedArray(d)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4
    if (d[i + 3] > 40) { d[i + 3] = 255; out[i + 3] = 255; continue }
    out[i + 3] = 0
    if (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1)) { out[i] = 12; out[i + 1] = 14; out[i + 2] = 11; out[i + 3] = 255 }
  }
  c.putImageData(new ImageData(out, w, h), 0, 0)
}

const DESSINS: Record<string, (c: Ctx) => void> = {
  bouclier: (c) => {
    poly(c, [[2, 2], [14, 2], [14, 8], [8, 14.5], [2, 8]], C.acier2)
    poly(c, [[3, 3], [8, 3], [8, 13], [3, 8]], C.acier3)
    poly(c, [[4, 6], [8, 9], [12, 6], [12, 8], [8, 11], [4, 8]], C.orange)
    rect(c, 2, 2, 12, 1, C.blanc)
  },
  grenade: (c) => {
    ell(c, 8, 9.5, 4.5, 5, C.kaki); ell(c, 7, 8.5, 2.5, 3, C.kaki2)
    for (const y of [7, 10, 13]) rect(c, 4, y, 9, 1, '#3e4826')
    rect(c, 6, 3, 4, 2, C.acier2); rect(c, 10, 2, 3, 1, C.acier3); rect(c, 12, 3, 1, 4, C.acier3)
    ell(c, 4.5, 3.5, 1.6, 1.6, C.orange2); px(c, 4, 3, C.k)
  },
  injection: (c) => {
    for (let i = 0; i < 8; i++) { rect(c, 3 + i, 10 - i, 3, 3, i < 5 ? C.vert : C.cyan2) }
    line(c, 3, 13, 5, 11, C.acier3); line(c, 12, 4, 14, 2, C.acier3); line(c, 14, 1, 15, 0, C.blanc)
    line(c, 1, 11, 4, 14, C.acier2); line(c, 10, 2, 13, 5, C.acier2)
    px(c, 6, 9, C.blanc); px(c, 8, 7, C.blanc)
  },
  adrenaline: (c) => {
    ell(c, 5.5, 6, 3.5, 3.5, C.rouge); ell(c, 10.5, 6, 3.5, 3.5, C.rouge); poly(c, [[2.2, 7.5], [13.8, 7.5], [8, 14]], C.rouge)
    ell(c, 5, 5, 1.5, 1.2, C.rouge2)
    poly(c, [[9, 2], [6, 8.5], [8.5, 8.5], [7, 14], [11, 6.5], [8.6, 6.5], [10.5, 2]], C.orange2)
  },
  surcharge: (c) => {
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; rect(c, Math.round(8 + Math.cos(a) * 5.6) - 1, Math.round(8 + Math.sin(a) * 5.6) - 1, 2, 2, C.acier2) }
    ell(c, 8, 8, 5, 5, C.acier1); ell(c, 8, 8, 3.8, 3.8, C.acier0)
    poly(c, [[9, 3], [5.5, 9], [8, 9], [7, 13.5], [11, 7], [8.5, 7], [10, 3]], C.orange2)
    px(c, 8, 4, C.blanc)
  },
  tourelle: (c) => {
    line(c, 8, 10, 3, 15, C.acier2); line(c, 8, 10, 13, 15, C.acier2); line(c, 8, 10, 8, 15, C.acier1)
    rect(c, 4, 4, 8, 6, C.acier2); rect(c, 4, 4, 8, 1, C.acier3); rect(c, 12, 6, 4, 2, C.acier3)
    rect(c, 6, 6, 3, 2, C.orange); px(c, 6, 6, C.orange2)
  },
  esquive: (c) => {
    poly(c, [[2, 3], [7, 8], [2, 13], [5, 13], [10, 8], [5, 3]], C.acier3)
    poly(c, [[8, 3], [13, 8], [8, 13], [11, 13], [16, 8], [11, 3]], C.orange)
    rect(c, 0, 7, 2, 1, C.acier2)
  },
  ordre: (c) => {
    rect(c, 3, 6, 8, 7, C.acier2); rect(c, 3, 6, 8, 1, C.acier3); rect(c, 4, 8, 6, 3, C.acier0)
    rect(c, 5, 9, 1, 1, C.cyan); rect(c, 8, 9, 1, 1, C.cyan); rect(c, 6, 4, 1, 2, C.acier2); px(c, 6, 3, C.orange)
    for (const r of [3, 5]) { line(c, 11 + r - 2, 3, 11 + r, 5, C.vert); line(c, 11 + r, 5, 11 + r - 2, 7, C.vert) }
    rect(c, 4, 13, 2, 2, C.acier1); rect(c, 8, 13, 2, 2, C.acier1)
  },
  monture: (c) => {
    rect(c, 2, 7, 11, 5, C.acier2); rect(c, 2, 7, 11, 1, C.acier3); rect(c, 12, 4, 3, 4, C.acier2); px(c, 13, 5, C.cyan)
    rect(c, 5, 5, 5, 3, C.cuir); rect(c, 5, 5, 5, 1, C.cuir2); rect(c, 7, 8, 1, 3, C.cuir0)
    for (const x of [3, 6, 9, 12]) rect(c, x - 1, 12, 2, 3, C.acier1)
    rect(c, 1, 9, 1, 2, C.orange)
  },
  descendre: (c) => {
    rect(c, 2, 9, 11, 4, C.acier2); rect(c, 2, 9, 11, 1, C.acier3); rect(c, 12, 7, 3, 3, C.acier2)
    rect(c, 5, 8, 5, 2, C.cuir); for (const x of [3, 6, 9, 12]) rect(c, x - 1, 13, 2, 2, C.acier1)
    poly(c, [[5, 0], [10, 0], [10, 3], [12, 3], [7.5, 7], [3, 3], [5, 3]], C.orange)
  },
  sac: (c) => {
    rect(c, 3, 5, 10, 10, C.cuir); rect(c, 3, 5, 10, 1, C.cuir2); rect(c, 2, 7, 1, 6, C.cuir0); rect(c, 13, 7, 1, 6, C.cuir0)
    rect(c, 3, 5, 10, 5, C.cuir2); rect(c, 3, 9, 10, 1, C.cuir0); rect(c, 7, 9, 2, 2, C.orange2)
    rect(c, 5, 2, 6, 1, C.cuir0); rect(c, 5, 2, 1, 3, C.cuir0); rect(c, 10, 2, 1, 3, C.cuir0)
    rect(c, 5, 12, 6, 2, C.kaki)
  },
  journal: (c) => {
    rect(c, 3, 2, 10, 13, C.rouille); rect(c, 4, 3, 9, 11, C.papier); rect(c, 3, 2, 2, 13, '#6a3a1a')
    for (const y of [5, 7, 9, 11]) rect(c, 6, y, 6, 1, C.papier2)
    rect(c, 10, 1, 2, 6, C.rouge); px(c, 10, 7, C.rouge); px(c, 11, 6, C.rouge)
  },
  carte: (c) => {
    poly(c, [[1, 3], [5, 2], [10, 4], [15, 3], [15, 13], [10, 14], [5, 12], [1, 13]], C.papier)
    poly(c, [[5, 2], [10, 4], [10, 14], [5, 12]], C.papier2)
    line(c, 3, 10, 6, 7, C.rouille); line(c, 6, 7, 9, 9, C.rouille); line(c, 9, 9, 11, 6, C.rouille)
    line(c, 11, 5, 13, 7, C.rouge); line(c, 13, 5, 11, 7, C.rouge)
    ell(c, 3.5, 5, 1.2, 1, C.vert2)
  },
  menu: (c) => {
    rect(c, 1, 1, 14, 14, C.acier1); rect(c, 1, 1, 14, 1, C.acier2)
    for (const y of [4, 7, 10]) rect(c, 4, y, 8, 2, C.vert)
    for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) px(c, x, y, C.acier3)
  },
  action: (c) => {
    rect(c, 5, 6, 7, 7, C.orange2); rect(c, 5, 2, 2, 6, C.orange2); px(c, 5, 2, C.blanc)
    rect(c, 7, 5, 2, 3, C.orange2); rect(c, 9, 5, 2, 3, C.orange2); rect(c, 11, 6, 2, 3, C.orange2)
    rect(c, 3, 8, 2, 3, C.orange2); rect(c, 6, 13, 6, 2, C.orange)
    rect(c, 7, 9, 4, 1, '#d89a3a')
  },
  parler: (c) => {
    rect(c, 2, 3, 12, 8, C.papier); rect(c, 3, 2, 10, 1, C.papier); rect(c, 3, 11, 10, 1, C.papier)
    poly(c, [[4, 11], [7, 11], [3, 15]], C.papier)
    for (const x of [5, 8, 11]) rect(c, x - 1, 6, 2, 2, C.cuir0)
  },
  ferraille: (c) => {
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + 0.39; rect(c, Math.round(8 + Math.cos(a) * 5.5) - 1, Math.round(8 + Math.sin(a) * 5.5) - 1, 3, 3, C.orange) }
    ell(c, 8, 8, 5, 5, C.orange); ell(c, 7, 7, 3, 3, C.orange2); ell(c, 8, 8, 2, 2, C.k); px(c, 6, 5, C.blanc)
  },
  robot: (c) => {
    rect(c, 3, 4, 10, 9, C.acier2); rect(c, 3, 4, 10, 1, C.acier3); rect(c, 4, 6, 8, 4, C.acier0)
    rect(c, 5, 7, 2, 2, C.cyan); rect(c, 9, 7, 2, 2, C.cyan); px(c, 5, 7, C.cyan2); px(c, 9, 7, C.cyan2)
    rect(c, 7, 1, 2, 3, C.acier1); px(c, 7, 0, C.orange); rect(c, 5, 11, 6, 1, C.acier1)
    rect(c, 1, 6, 2, 4, C.acier1); rect(c, 13, 6, 2, 4, C.acier1)
  },
  gare: (c) => {
    rect(c, 0, 1, 16, 2, C.acier1)
    rect(c, 2, 4, 12, 9, C.acier2); rect(c, 2, 4, 12, 1, C.acier3); rect(c, 3, 6, 10, 3, C.cyan); rect(c, 3, 6, 10, 1, C.cyan2)
    rect(c, 3, 10, 2, 1, C.orange2); rect(c, 11, 10, 2, 1, C.orange2); rect(c, 7, 3, 2, 1, C.acier1)
    rect(c, 3, 13, 10, 1, C.acier0); rect(c, 7, 14, 2, 2, C.acier1)
  },
  soleil: (c) => {
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; line(c, Math.round(8 + Math.cos(a) * 5), Math.round(8 + Math.sin(a) * 5), Math.round(8 + Math.cos(a) * 7), Math.round(8 + Math.sin(a) * 7), C.orange) }
    ell(c, 8, 8, 4, 4, C.orange2); ell(c, 7, 7, 1.5, 1.5, C.blanc)
  },
  lune: (c) => { ell(c, 8, 8, 6, 6, C.papier); c.globalCompositeOperation = 'destination-out'; ell(c, 11, 6, 5, 5, '#000'); c.globalCompositeOperation = 'source-over'; px(c, 5, 9, C.papier2); px(c, 6, 11, C.papier2) },
  pluie: (c) => {
    ell(c, 6, 6, 4, 3, C.acier3); ell(c, 10, 5, 4, 3.5, C.acier3); rect(c, 3, 6, 11, 3, C.acier3); rect(c, 3, 8, 11, 1, C.acier2)
    for (const [x, y] of [[4, 11], [8, 12], [12, 11], [6, 14], [10, 14]]) { px(c, x, y, C.cyan); px(c, x, y + 1, C.cyan) }
  },
  brume: (c) => { for (const [y, x0, x1] of [[4, 2, 12], [7, 4, 15], [10, 1, 11], [13, 5, 14]]) rect(c, x0, y, x1 - x0, 2, y % 2 ? C.acier3 : C.acier2) },
  crane: (c) => {
    ell(c, 8, 7, 5.5, 5, C.papier); rect(c, 5, 11, 6, 3, C.papier)
    rect(c, 5, 7, 2, 2, C.k); rect(c, 9, 7, 2, 2, C.k); px(c, 8, 10, C.k)
    for (const x of [6, 8, 10]) px(c, x, 13, C.papier2)
  },
  fermer: (c) => { for (let i = 0; i < 10; i++) { rect(c, 3 + i, 3 + i, 2, 2, C.rouge); rect(c, 12 - i, 3 + i, 2, 2, C.rouge) } },
  pieces: (c) => {
    poly(c, [[8, 2], [13, 5], [13, 11], [8, 14], [3, 11], [3, 5]], C.acier2)
    poly(c, [[8, 2], [13, 5], [8, 8], [3, 5]], C.acier3)
    ell(c, 8, 8.5, 2.2, 2.2, C.acier0)
  },
  quete: (c) => { rect(c, 6, 1, 4, 9, C.orange2); rect(c, 6, 1, 4, 1, C.blanc); rect(c, 6, 12, 4, 3, C.orange2) },
  front: (c) => {
    ell(c, 10, 9, 5.5, 5.5, C.violet); ell(c, 11, 8, 3, 3, C.violet2)
    rect(c, 2, 2, 1, 13, C.acier3); poly(c, [[3, 2], [8, 4], [3, 6]], C.orange)
  },
  avantposte: (c) => {
    rect(c, 7, 2, 2, 12, C.acier2); poly(c, [[9, 2], [15, 4.5], [9, 7]], C.cyan)
    rect(c, 3, 12, 10, 3, C.acier1); rect(c, 3, 12, 10, 1, C.acier3)
  },
  // le réticule de la visée assistée : un cercle, quatre traits, un point rouge au centre
  visee: (c) => {
    ell(c, 8, 8, 6, 6, C.acier3)
    c.globalCompositeOperation = 'destination-out'; ell(c, 8, 8, 4.6, 4.6, '#000'); c.globalCompositeOperation = 'source-over'
    rect(c, 7, 0, 2, 5, C.blanc); rect(c, 7, 11, 2, 5, C.blanc); rect(c, 0, 7, 5, 2, C.blanc); rect(c, 11, 7, 5, 2, C.blanc)
    rect(c, 7, 7, 2, 2, C.rouge)
  },
  // les tremblements d'écran : un écran penché, des traits de secousse de part et d'autre
  tremblement: (c) => {
    poly(c, [[4, 3], [13, 2], [14, 11], [5, 12]], C.acier1)
    poly(c, [[5, 4], [12, 3.5], [13, 10], [6, 10.5]], C.vert2)
    line(c, 6, 6, 11, 5, C.vert); line(c, 7, 8, 10, 8, C.vert)
    for (const y of [4, 7, 10]) { rect(c, 0, y, 2, 1, C.orange); rect(c, 14 + (y === 7 ? 0 : 1), y + 1, 2, 1, C.orange) }
    rect(c, 6, 13, 6, 2, C.acier2)
  },
  // le son : un haut-parleur et deux ondes
  son: (c) => {
    rect(c, 1, 6, 4, 5, C.acier2); poly(c, [[5, 6], [10, 2], [10, 15], [5, 11]], C.acier3); rect(c, 1, 6, 4, 1, C.blanc)
    line(c, 12, 6, 12, 10, C.orange); px(c, 11, 5, C.orange); px(c, 11, 11, C.orange)
    line(c, 14, 4, 14, 12, C.orange2); px(c, 13, 3, C.orange2); px(c, 13, 13, C.orange2)
  },
  xp: (c) => {
    poly(c, [[8, 1], [10, 6], [15, 6], [11, 9.5], [12.5, 15], [8, 11.5], [3.5, 15], [5, 9.5], [1, 6], [6, 6]], C.jaune)
    poly(c, [[8, 3], [9, 6.5], [7, 6.5]], C.blanc)
  },
  // ---- les compétences des trois nouvelles classes et des spécialités
  marquage: (c) => {
    ell(c, 8, 8, 6.5, 6.5, C.rouge); c.globalCompositeOperation = 'destination-out'; ell(c, 8, 8, 5, 5, '#000'); c.globalCompositeOperation = 'source-over'
    poly(c, [[8, 3], [10, 8], [8, 13], [6, 8]], C.rouge2); rect(c, 7, 7, 2, 2, C.blanc)
  },
  piege: (c) => {
    ell(c, 8, 10, 6, 3.5, C.acier1); ell(c, 8, 9, 5, 2.6, C.acier2); rect(c, 7, 5, 2, 4, C.acier3); ell(c, 8, 4.5, 1.6, 1.6, C.rouge2)
    for (const x of [3, 13]) rect(c, x, 9, 1, 2, C.acier3)
  },
  mortier: (c) => {
    poly(c, [[3, 14], [6, 14], [13, 4], [10, 2]], C.acier2); poly(c, [[3, 14], [4, 14], [11, 3], [10, 2]], C.acier3)
    rect(c, 1, 13, 8, 2, C.acier1); ell(c, 12.5, 3, 2, 2, C.orange); px(c, 12, 2, C.orange2)
  },
  onde: (c) => {
    ell(c, 8, 8, 7, 7, C.orange2); c.globalCompositeOperation = 'destination-out'; ell(c, 8, 8, 5.5, 5.5, '#000'); c.globalCompositeOperation = 'source-over'
    ell(c, 8, 8, 4, 4, C.orange); c.globalCompositeOperation = 'destination-out'; ell(c, 8, 8, 2.6, 2.6, '#000'); c.globalCompositeOperation = 'source-over'
    rect(c, 7, 7, 2, 2, C.blanc)
  },
  champ: (c) => {
    ell(c, 8, 8, 7, 7, C.violet); c.globalCompositeOperation = 'destination-out'; ell(c, 8, 8, 5.6, 5.6, '#000'); c.globalCompositeOperation = 'source-over'
    line(c, 4, 8, 6, 5, C.violet2); line(c, 6, 5, 8, 10, C.violet2); line(c, 8, 10, 10, 5, C.violet2); line(c, 10, 5, 12, 8, C.violet2)
  },
  leurre: (c) => {
    ell(c, 6, 5, 2.5, 2.5, C.violet); rect(c, 4, 7, 5, 6, C.violet); ell(c, 10, 5, 2.5, 2.5, C.cyan2); rect(c, 8, 7, 5, 6, C.cyan)
    for (let y = 7; y < 13; y += 2) rect(c, 8, y, 5, 1, C.cyan2)
  },
  bastion: (c) => {
    rect(c, 3, 2, 1, 13, C.acier3); poly(c, [[4, 2], [13, 4], [4, 8]], C.orange); poly(c, [[4, 3], [10, 4], [4, 6]], C.orange2)
    rect(c, 1, 14, 6, 2, C.acier1)
  },
  percee: (c) => {
    poly(c, [[1, 6], [9, 6], [9, 3], [15, 8], [9, 13], [9, 10], [1, 10]], C.orange); poly(c, [[1, 7], [10, 7], [10, 5], [13, 8], [1, 8]], C.orange2)
  },
  tir_lourd: (c) => {
    rect(c, 0, 7, 16, 2, C.cyan); rect(c, 0, 7, 16, 1, C.cyan2); ell(c, 12, 8, 3, 3, C.blanc)
    for (const x of [3, 7]) { rect(c, x, 5, 1, 1, C.cyan2); rect(c, x + 1, 10, 1, 1, C.cyan2) }
  },
  filet: (c) => {
    for (let i = 2; i <= 14; i += 4) { line(c, i, 2, i, 14, C.papier2); line(c, 2, i, 14, i, C.papier2) }
    line(c, 2, 2, 14, 14, C.papier); line(c, 14, 2, 2, 14, C.papier)
  },
  perfusion: (c) => {
    rect(c, 5, 1, 6, 9, C.acier3); rect(c, 6, 3, 4, 6, C.vert); rect(c, 6, 3, 4, 1, C.cyan2); rect(c, 7, 10, 2, 3, C.acier2)
    line(c, 8, 13, 12, 15, C.acier2); rect(c, 7, 4, 2, 4, C.blanc)
  },
  toxine: (c) => {
    ell(c, 5, 10, 4, 3.5, C.vert2); ell(c, 10, 8, 4.5, 4, C.vert2); ell(c, 9, 11, 4, 3, C.vert); ell(c, 6, 7, 3, 2.5, C.vert)
    px(c, 5, 6, C.blanc); px(c, 11, 6, C.jaune); px(c, 8, 10, C.jaune)
  },
  blindage: (c) => {
    poly(c, [[8, 1], [14, 4], [14, 9], [8, 15], [2, 9], [2, 4]], C.acier2); poly(c, [[8, 3], [12, 5], [12, 9], [8, 13], [4, 9], [4, 5]], C.cyan)
    poly(c, [[8, 3], [12, 5], [8, 7], [4, 5]], C.cyan2)
  },
  essaim: (c) => {
    for (const [x, y] of [[4, 4], [12, 5], [8, 11]]) { ell(c, x, y, 2.2, 2.2, C.acier2); px(c, x, y, C.cyan2); rect(c, x - 3, y - 2, 2, 1, C.acier3); rect(c, x + 2, y - 2, 2, 1, C.acier3) }
  },
  tapis: (c) => {
    for (const [x, y] of [[3, 12], [7, 9], [11, 6], [14, 3]]) { ell(c, x, y, 2, 2, C.orange); px(c, x, y - 1, C.orange2) }
    line(c, 1, 14, 15, 1, C.acier1)
  },
  brasier: (c) => {
    ell(c, 8, 9, 7, 6, C.orange); c.globalCompositeOperation = 'destination-out'; ell(c, 8, 9, 5, 4, '#000'); c.globalCompositeOperation = 'source-over'
    for (const [x, y] of [[3, 6], [8, 2], [13, 6], [5, 13], [11, 13]]) poly(c, [[x - 1.5, y + 2], [x, y - 2], [x + 1.5, y + 2]], C.orange2)
  },
  court_circuit: (c) => {
    poly(c, [[9, 1], [3, 9], [7, 9], [5, 15], [13, 6], [9, 6], [11, 1]], C.violet2); poly(c, [[9, 2], [5, 8.5], [7.5, 8.5], [8, 7]], C.blanc)
  },
  voile: (c) => {
    ell(c, 8, 7, 5, 5, C.acier1); poly(c, [[3, 7], [13, 7], [14, 15], [11, 13], [8, 15], [5, 13], [2, 15]], C.acier1)
    rect(c, 5, 6, 2, 2, C.violet2); rect(c, 9, 6, 2, 2, C.violet2)
  },
  // les talents : un arbre à trois branches
  talents: (c) => {
    rect(c, 7, 8, 2, 7, C.cuir2); line(c, 8, 9, 3, 4, C.cuir2); line(c, 8, 9, 13, 4, C.cuir2); line(c, 8, 8, 8, 2, C.cuir2)
    for (const [x, y] of [[3, 3], [13, 3], [8, 1]]) { ell(c, x, y + 0.5, 2, 2, C.orange); px(c, x, y, C.orange2) }
  },
  social: (c) => {
    // deux soldats côte à côte
    for (const [x, col] of [[5, C.cuir2], [11, C.orange]] as const) { ell(c, x, 5, 2.5, 2.5, col); rect(c, x - 3, 9, 6, 6, col); rect(c, x - 2, 8, 4, 1, col) }
  },
  cadenas: (c) => {
    ell(c, 8, 5, 4, 4, C.acier2); c.globalCompositeOperation = 'destination-out'; ell(c, 8, 5, 2.4, 2.4, '#000'); c.globalCompositeOperation = 'source-over'
    rect(c, 3, 7, 10, 8, C.acier3); rect(c, 3, 7, 10, 1, C.blanc); rect(c, 7, 10, 2, 3, C.acier0)
  },
}

const cache = new Map<string, string>()
const toiles = new Map<string, HTMLCanvasElement>()
/** L'icône `nom` (16 × 16) sur une toile, pour la dessiner dans une autre (cartes). */
export function iconeToile(nom: string): HTMLCanvasElement {
  const hit = toiles.get(nom)
  if (hit) return hit
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16
  const c = cv.getContext('2d')!
  ;(DESSINS[nom] ?? DESSINS.action)(c)
  finir(c, 16, 16)
  toiles.set(nom, cv)
  return cv
}
/** L'icône `nom` (16 × 16) en data-URL, à afficher en `image-rendering: pixelated`. */
export function icone(nom: string): string {
  const hit = cache.get(nom)
  if (hit) return hit
  const url = iconeToile(nom).toDataURL()
  cache.set(nom, url)
  return url
}
export const ICONES = Object.keys(DESSINS)
/** `<img>` d'icône prêt à insérer. */
export function ico(nom: string, cls = 'ico') { return `<img class="${cls}" src="${icone(nom)}" alt="">` }

/** L'icône d'une compétence de classe. */
export const ICONE_COMP: Record<string, string> = Object.fromEntries(['bouclier', 'grenade', 'injection', 'adrenaline', 'tourelle', 'surcharge', 'marquage', 'piege', 'mortier', 'onde', 'champ', 'leurre', 'bastion', 'percee', 'tir_lourd', 'filet', 'perfusion', 'toxine', 'blindage', 'essaim', 'tapis', 'brasier', 'court_circuit', 'voile'].map((k) => [k, k]))
