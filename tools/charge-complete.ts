// La charge avec tous les systèmes : de vrais clients Colyseus répartis entre le continent (qui marchent et tirent,
// sur plusieurs copies), le monorail, les arènes de boss (instances), un raid à dix, la discussion, les groupes et
// les échanges. Paliers successifs ; à chaque palier : CPU et mémoire du serveur, pas de salle (p50, p99), retard de
// la boucle d'événements, octets reçus par client et par seconde, erreurs. Jamais sur le 2700 ni sur la vraie base.
//   npx tsx tools/charge-complete.ts <url du banc> <pid du serveur> <paliers, ex. 50,100,200,400> [secondes par palier]
//   (le banc : HEIRLINE_DEBUG=banc HEIRLINE_TEST=banc, sa propre base)
// Les clients tournent dans plusieurs processus (CLIENTS_PAR_PROC, 50 par défaut) pour ne pas mesurer la machine
// qui envoie au lieu du serveur.
import { execSync, fork, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROLE = process.env.CHARGE_ROLE
if (ROLE === 'ouvrier') await ouvrier()
else await chef()

// ------------------------------------------------------------------ le chef : paliers et mesures
async function chef() {
  const base = process.argv[2] ?? 'http://127.0.0.1:2798'
  const PID = process.argv[3]
  const paliers = (process.argv[4] ?? '50,100,200,400').split(',').map(Number)
  const DUREE = Number(process.argv[5] ?? 60)
  const PAR = Number(process.env.CLIENTS_PAR_PROC ?? 50)
  const fichier = fileURLToPath(import.meta.url)
  const ouvriers: { p: ChildProcess; n: number; recu: number; msgs: number; err: number; deco: number; prets: number; roles: Record<string, number> }[] = []
  let total = 0
  const resultats: any[] = []
  for (const cible of paliers) {
    // ajouter des ouvriers jusqu'au palier
    while (total < cible) {
      const n = Math.min(PAR, cible - total)
      const p = fork(fichier, [], { env: { ...process.env, CHARGE_ROLE: 'ouvrier', CHARGE_BASE: base, CHARGE_DEBUT: String(total), CHARGE_N: String(n) }, execArgv: ['--import', 'tsx'] })
      const o = { p, n, recu: 0, msgs: 0, err: 0, deco: 0, prets: 0, roles: {} as Record<string, number> }
      p.on('message', (m: any) => { Object.assign(o, m) })
      ouvriers.push(o)
      total += n
    }
    // attendre que tous soient connectés (ou 120 s)
    const t0 = Date.now()
    while (ouvriers.reduce((s, o) => s + o.prets, 0) < total && Date.now() - t0 < 120000) await attendre(1000)
    const connexionS = (Date.now() - t0) / 1000
    await attendre(10000) // les instances se remplissent, les arènes démarrent
    await fetch(`${base}/api/stats`) // remise à zéro
    const recu0 = ouvriers.reduce((s, o) => s + o.recu, 0), err0 = ouvriers.reduce((s, o) => s + o.err, 0), deco0 = ouvriers.reduce((s, o) => s + o.deco, 0)
    const cpu: number[] = [], rss: number[] = []
    const debut = Date.now()
    while (Date.now() - debut < DUREE * 1000) {
      await attendre(2000)
      if (PID) try { cpu.push(Number(execSync(`ps -o %cpu= -p ${PID}`).toString().trim())); rss.push(Number(execSync(`ps -o rss= -p ${PID}`).toString().trim()) / 1024) } catch { /* fini */ }
    }
    const s = (Date.now() - debut) / 1000
    const st = await (await fetch(`${base}/api/stats`)).json()
    const etat = await (await fetch(`${base}/api/etat`)).json().catch(() => ({}))
    const salles = await (await fetch(`${base}/api/cartes`)).json().catch(() => null)
    const recu = ouvriers.reduce((x, o) => x + o.recu, 0) - recu0
    const roles: Record<string, number> = {}
    for (const o of ouvriers) for (const [k, v] of Object.entries(o.roles)) roles[k] = (roles[k] ?? 0) + v
    const r = {
      clients: total, connectes: ouvriers.reduce((x, o) => x + o.prets, 0), connexionS: +connexionS.toFixed(1), roles,
      soldatsIA: etat.soldatsIA, salles: salles ? Object.fromEntries(salles.cartes.filter((c: any) => c.copies.length).map((c: any) => [c.id, c.copies.length])) : null,
      cpuMoyen: moy(cpu), cpuMax: cpu.length ? Math.max(...cpu) : null, memMo: rss.length ? Math.round(rss[rss.length - 1]) : Math.round(st.mem / 1048576),
      pasMoyenMs: +st.calculMoyenMs.toFixed(2), pasP99Ms: +st.calculP99Ms.toFixed(2), pasMaxMs: +st.calculMaxMs.toFixed(1),
      boucleP99Ms: +st.boucleP99Ms.toFixed(1), boucleMaxMs: +st.boucleMaxMs.toFixed(1),
      koParClientS: +(recu / s / Math.max(1, total) / 1024).toFixed(2),
      erreurs: ouvriers.reduce((x, o) => x + o.err, 0) - err0, deconnexions: ouvriers.reduce((x, o) => x + o.deco, 0) - deco0,
    }
    resultats.push(r)
    console.log(JSON.stringify(r))
  }
  // la fuite de mémoire : rester au dernier palier et suivre la mémoire (FUITE_MIN minutes, 0 pour sauter)
  const fuiteMin = Number(process.env.FUITE_MIN ?? 0)
  if (fuiteMin > 0 && PID) {
    const suivi: [number, number][] = []
    const debut = Date.now()
    while (Date.now() - debut < fuiteMin * 60000) {
      await attendre(30000)
      try { suivi.push([Math.round((Date.now() - debut) / 1000), Math.round(Number(execSync(`ps -o rss= -p ${PID}`).toString().trim()) / 1024)]) } catch { break }
    }
    console.log(JSON.stringify({ fuite: suivi, deconnexions: ouvriers.reduce((x, o) => x + o.deco, 0), erreurs: ouvriers.reduce((x, o) => x + o.err, 0) }))
  }
  for (const o of ouvriers) o.p.send('fin')
  await attendre(3000)
  for (const o of ouvriers) o.p.kill()
  process.exit(0)
}

// ------------------------------------------------------------------ un ouvrier : N clients
async function ouvrier() {
  const base = process.env.CHARGE_BASE!, debut = Number(process.env.CHARGE_DEBUT), N = Number(process.env.CHARGE_N)
  const DEBUG = process.env.HEIRLINE_DEBUG ?? 'banc'
  let recu = 0, msgs = 0, err = 0, deco = 0, prets = 0
  const roles: Record<string, number> = {}
  const WS = globalThis.WebSocket
  ;(globalThis as any).WebSocket = class extends WS {
    constructor(url: any, p?: any) { super(url, p); this.addEventListener('message', (e: any) => { msgs++; recu += e.data?.byteLength ?? e.data?.size ?? String(e.data).length }) }
  }
  const { Client } = await import('@colyseus/sdk')
  const { carteMap } = await import('../shared/cartes/index.ts')
  const { isSolidTile, T } = await import('../shared/map.ts')
  const { STATIONS } = await import('../shared/monde.ts')
  const carte = carteMap('ossara')
  const sol = (x: number, y: number) => { const t = carte.tiles[y * carte.w + x]; return !isSolidTile(t) && t !== T.MER }
  const place = (i: number): [number, number] => {
    let k = i * 7919 + 17
    for (let n = 0; n < 5000; n++) { k = (k * 1103515245 + 12345) >>> 0; const x = 20 + (k % 360), y = 20 + ((k >>> 8) % 360); if (sol(x, y)) return [x * 16 + 8, y * 16 + 8] }
    return [carte.points.spawn.x, carte.points.spawn.y]
  }
  const classes = ['fantassin', 'medic', 'ingenieur', 'eclaireur', 'demolisseur', 'brouilleur']
  type J = { i: number; role: string; token: string; client: any; room: any; input: any; a: number; t: number; prochain: number; etape: number; groupe?: string }
  const joueurs: J[] = []
  // les rôles : 60 % continent, 10 % monorail, 10 % arènes (instances), 10 % social (discussion, groupes, échanges),
  // 10 % continent qui ne fait que marcher ; les dix premiers clients forment un raid à dix
  const role = (i: number) => i < 10 ? 'raid' : (['continent', 'continent', 'continent', 'continent', 'continent', 'continent', 'monorail', 'arene', 'social', 'marche'][i % 10])
  async function rejoindre(j: J, salon: string, carteId: string) {
    try { await j.room?.leave(true) } catch { /* déjà parti */ }
    // comme le vrai client : le groupe entre dans la même instance
    j.room = await j.client.joinOrCreate(salon, { token: j.token, carte: carteId, ...(j.groupe && carteId !== 'ossara' ? { groupe: j.groupe } : {}) })
    brancher(j)
  }
  function brancher(j: J) {
    j.room.onMessage('*', () => {})
    j.room.onMessage('groupe', (m: any) => { j.groupe = m?.id ?? undefined })
    j.room.onMessage('passage', (p: any) => { rejoindre(j, p.salon, p.carte).catch(() => { err++ }) })
    j.room.onLeave((code: number) => { if (code !== 1000 && code !== 4000) deco++ })
    j.room.onError(() => { err++ })
    j.input = j.room.input({ mode: 'reliable' })
  }
  for (let k = 0; k < N; k++) {
    const i = debut + k
    try {
      const inv = await (await fetch(`${base}/api/invite`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ famille: `Charge${i}` }) })).json()
      const j: J = { i, role: role(i), token: inv.token, client: new Client(base), room: null, input: null, a: Math.random() * 6.28, t: 0, prochain: Date.now() + 3000 + Math.random() * 5000, etape: 0 }
      j.room = await j.client.joinOrCreate('secteur', { token: inv.token, cls: classes[i % 6], carte: 'ossara' })
      brancher(j)
      roles[j.role] = (roles[j.role] ?? 0) + 1
      const [x, y] = j.role === 'monorail' ? [STATIONS[0].x * 16 + 8, (STATIONS[0].y + 2) * 16 + 8] : j.role === 'raid' ? [carte.points.spawn.x + (i % 5) * 10, carte.points.spawn.y] : place(i)
      j.room.send('tp', { code: DEBUG, x, y })
      joueurs.push(j); prets++
    } catch { err++ }
    process.send!({ recu, msgs, err, deco, prets, roles })
  }
  // le raid : le premier forme un groupe avec les neuf autres, puis tous partent au Semeur
  setTimeout(() => {
    const raid = joueurs.filter((j) => j.role === 'raid')
    const chef = raid[0]
    if (!chef) return
    for (const j of raid.slice(1)) chef.room.send('social', { a: 'inviter', type: 'groupe', sid: j.room.sessionId })
    setTimeout(() => { for (const j of raid.slice(1)) j.room.send('social', { a: 'repondre', type: 'groupe', oui: true }) }, 1500)
    setTimeout(() => { for (const j of raid) j.room.send('voyage', { code: 'banc', dest: 'semeur' }) }, 4000)
  }, 3000)
  const arenes = ['couveuse', 'engloutisseur', 'gueule', 'pepiniere', 'greffier']
  const boucle = setInterval(() => {
    const now = Date.now()
    for (const j of joueurs) {
      if (!j.room || !j.input) continue
      // tout le monde marche et vise ; on tire dans 70 % des cas (sauf « marche »)
      j.t -= 0.05
      if (j.t <= 0) { j.a += (Math.random() - 0.5) * 2.5; j.t = 0.5 + Math.random() * 1.5 }
      const bouge = j.role !== 'monorail' || j.etape % 2 === 0
      j.input.data.mx = bouge ? Math.cos(j.a) : 0; j.input.data.my = bouge ? Math.sin(j.a) : 0; j.input.data.aim = j.a
      j.input.data.fire = j.role !== 'marche' && Math.random() < 0.7
      try { j.input.send() } catch { err++ }
      if (now < j.prochain) continue
      try {
        if (j.role === 'monorail') {
          // aller-retour Port-Ancre ↔ Col, un trajet toutes les 20 s
          const de = j.etape % 2 === 0 ? 'st_port' : 'st_col', vers = j.etape % 2 === 0 ? 'st_col' : 'st_port'
          const st = STATIONS.find((s) => s.id === de)!
          j.room.send('tp', { code: DEBUG, x: st.x * 16 + 8, y: (st.y + 2) * 16 + 8 })
          setTimeout(() => j.room?.send('station', { id: de, vers }), 300)
          j.etape++; j.prochain = now + 20000
        } else if (j.role === 'arene') {
          // une arène de boss (instance), on y reste 60 s, puis une autre
          j.room.send('voyage', { code: 'banc', dest: arenes[(j.i + j.etape) % 3] })
          j.etape++; j.prochain = now + 60000
        } else if (j.role === 'social') {
          // la discussion du monde et d'ici, un groupe avec le voisin, un échange de ferraille avec lui
          j.room.send('chat', { c: j.etape % 2 ? 'monde' : 'local', t: `essai de charge ${j.i} · ${j.etape}` })
          const voisin = joueurs.find((q) => q.role === 'social' && q.i !== j.i && q.room?.roomId === j.room.roomId)
          if (voisin && j.etape % 3 === 0) {
            j.room.send('tp', { code: DEBUG, x: carte.points.spawn.x, y: carte.points.spawn.y })
            voisin.room.send('tp', { code: DEBUG, x: carte.points.spawn.x + 12, y: carte.points.spawn.y })
            setTimeout(() => j.room?.send('social', { a: 'inviter', type: 'echange', sid: voisin.room.sessionId }), 400)
            setTimeout(() => voisin.room?.send('social', { a: 'repondre', type: 'echange', oui: true }), 900)
            setTimeout(() => { j.room?.send('social', { a: 'verrou' }); voisin.room?.send('social', { a: 'verrou' }) }, 1400)
            setTimeout(() => { j.room?.send('social', { a: 'confirmer' }); voisin.room?.send('social', { a: 'confirmer' }) }, 1900)
          } else if (voisin && j.etape % 3 === 1) {
            j.room.send('social', { a: 'inviter', type: 'groupe', sid: voisin.room.sessionId })
            setTimeout(() => voisin.room?.send('social', { a: 'repondre', type: 'groupe', oui: true }), 600)
          }
          j.etape++; j.prochain = now + 5000
        } else j.prochain = now + 1e9
      } catch { err++ }
    }
  }, 50)
  const compte = setInterval(() => process.send!({ recu, msgs, err, deco, prets, roles }), 2000)
  process.on('message', async (m) => {
    if (m !== 'fin') return
    clearInterval(boucle); clearInterval(compte)
    for (const j of joueurs) try { await j.room?.leave(true) } catch { /* déjà parti */ }
    process.exit(0)
  })
}

function attendre(ms: number) { return new Promise((r) => setTimeout(r, ms)) }
function moy(a: number[]) { return a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : null }
