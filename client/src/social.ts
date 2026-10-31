// Le social côté client : la discussion (canaux), les invitations, l'écran Social (soldats proches, groupe, guilde),
// la fenêtre d'échange (double validation), les cadres du groupe, les marques, le duel. Tout passe par le serveur
// (server/social.ts) : le client ne fait qu'afficher et envoyer des demandes.
import * as ui from './ui.ts'
import { esc } from './ui.ts'
import { ico } from './icones.ts'
import { t } from '../../shared/i18n/index.ts'
import { itemKey, type Item } from '../../shared/items.ts'
import { CLASS_IDS } from '../../shared/rules.ts'

type Canal = 'local' | 'groupe' | 'guilde' | 'monde' | 'prive'
const CANAUX: Canal[] = ['local', 'groupe', 'guilde', 'monde']
const COUL: Record<Canal, string> = { local: '#e9ecef', groupe: '#7fd6ff', guilde: '#9be37a', monde: '#ffd36b', prive: '#e0a8ff' }
/** les cinq marques du groupe : un glyphe et une couleur chacune */
export const MARQUES = [{ g: '★', c: '#ffd36b' }, { g: '●', c: '#ff8a7a' }, { g: '▲', c: '#9be37a' }, { g: '◆', c: '#e0a8ff' }, { g: '✖', c: '#7fd6ff' }]

export interface Ctx {
  net: any
  me: () => any
  sac: () => { inv: Item[] } | null
  scene: () => any
  carte: () => string
  nomObjet: (it: Item) => string
  /** l'écran ouvert, pour que le main sache qui est à l'écran */
  ecran: (e: string) => void
  ecranOuvert: () => string
}

export const etat = {
  groupe: null as null | { id: string; chef: string; moi: string; membres: { a: string; nom: string; en_ligne: boolean; carte?: string; sid?: string; cls?: string; level?: number }[] },
  guilde: null as null | { nom: string; tag: string; rang: number; moi: string; membres: { a: string; nom: string; rang: number; en_ligne: boolean }[] },
  echange: null as null | { moi: any; lui: any },
  marques: [] as (null | { carte: string; x: number; y: number; cible?: string })[],
  duel: null as null | { contre: string; sid: string; dans: number; duree: number; t0: number },
  messages: [] as { c: Canal; de: string; t: string; g?: string; a?: string }[],
  canal: 'local' as Canal,
  onglet: 'proches' as 'proches' | 'groupe' | 'guilde',
  choix: new Set<string>(),
}

let C: Ctx
const send = (m: any) => C.net.room?.send('social', m)

export function initSocial(ctx: Ctx) {
  C = ctx
  const n = C.net
  n.on('chat', (m: any) => {
    etat.messages.push(m)
    if (etat.messages.length > 40) etat.messages.shift()
    const qui = m.g ? `[${m.g}] ${m.de}` : m.de
    ui.log(`${prefixe(m.c)}${m.a ? `→ ${m.a}` : qui} : ${m.t}`, COUL[m.c as Canal] ?? '#e9ecef')
    majChat()
  })
  n.on('invitation', (m: any) => invitation(m))
  n.on('groupe', (m: any) => { etat.groupe = m; if (C.ecranOuvert() === 'social') ecranSocial() })
  n.on('guilde', (m: any) => { etat.guilde = m; if (C.ecranOuvert() === 'social') ecranSocial() })
  n.on('marques', (m: any) => { etat.marques = m ?? [] })
  n.on('echange', (m: any) => {
    const avant = etat.echange
    etat.echange = m
    if (m) { if (!avant) etat.choix = new Set(m.moi.objets.map((o: Item) => o.u)); ecranEchange() } else if (C.ecranOuvert() === 'echange') ui.hideScreen()
  })
  n.on('duel', (m: any) => {
    etat.duel = m ? { ...m, t0: performance.now() } : null
    if (m) ui.banner(`<b>${esc(t('ui.social.duel_contre', { qui: m.contre }))}</b><br>${t('ui.social.duel_regles', { n: m.duree })}`, 3000)
  })
  construireChat()
  setInterval(majCadres, 250)
}

const prefixe = (c: string) => c === 'local' ? '' : `[${t(`ui.social.canal_${c}`)}] `

// ------------------------------------------------------------------ la discussion
function construireChat() {
  const hud = document.getElementById('hud')!
  const b = document.createElement('button')
  b.id = 'btn-chat'; b.className = 'cadre btn ico-btn'; b.title = t('ui.social.chat_t')
  b.innerHTML = ico('parler')
  b.addEventListener('pointerdown', (e) => { e.stopPropagation(); basculerChat() })
  document.getElementById('menu-icones')!.prepend(b)
  const s = document.createElement('button')
  s.id = 'btn-social'; s.className = 'cadre btn ico-btn'; s.title = t('ui.social.titre')
  s.innerHTML = ico('social')
  s.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (C.net.room) ecranSocial() })
  document.getElementById('menu-icones')!.prepend(s)
  const p = document.createElement('div')
  p.id = 'chat'; p.className = 'cadre plaque cache'
  p.innerHTML = `<div class="chat-canaux">${CANAUX.map((c) => `<button data-c="${c}">${t(`ui.social.canal_${c}`)}</button>`).join('')}</div>
    <div class="chat-fil"></div>
    <form class="chat-saisie"><input maxlength="140" autocomplete="off" enterkeyhint="send" placeholder="${esc(t('ui.social.ecrire'))}"><button class="btn">${t('ui.social.envoyer')}</button></form>`
  hud.appendChild(p)
  p.addEventListener('pointerdown', (e) => e.stopPropagation())
  p.addEventListener('keydown', (e) => e.stopPropagation())
  p.querySelectorAll<HTMLButtonElement>('[data-c]').forEach((x) => x.addEventListener('click', () => { etat.canal = x.dataset.c as Canal; majChat() }))
  p.querySelector('form')!.addEventListener('submit', (e) => {
    e.preventDefault()
    const inp = p.querySelector('input')!
    let txt = inp.value.trim()
    if (!txt) return
    let canal: Canal = etat.canal, a: string | undefined
    // « /m Nom message » : un message privé ; « Nom » peut être « Prénom Famille » entre guillemets
    const pv = txt.match(/^\/(?:m|w|msg)\s+(?:"([^"]+)"|(\S+))\s+(.+)$/i)
    if (pv) { canal = 'prive'; a = pv[1] ?? pv[2]; txt = pv[3] }
    C.net.room?.send('chat', { c: canal, t: txt, a })
    inp.value = ''
  })
  majChat()
}
function basculerChat() {
  const p = document.getElementById('chat')!
  p.classList.toggle('cache')
  if (!p.classList.contains('cache')) p.querySelector('input')!.focus()
}
function majChat() {
  const p = document.getElementById('chat')
  if (!p) return
  p.querySelectorAll<HTMLButtonElement>('[data-c]').forEach((x) => x.classList.toggle('actif', x.dataset.c === etat.canal))
  const f = p.querySelector('.chat-fil')!
  f.innerHTML = etat.messages.slice(-14).map((m) => `<div style="color:${COUL[m.c] ?? '#e9ecef'}">${esc(prefixe(m.c))}<b>${esc(m.a ? `→ ${m.a}` : (m.g ? `[${m.g}] ` : '') + m.de)}</b> ${esc(m.t)}</div>`).join('')
  f.scrollTop = f.scrollHeight
}

// ------------------------------------------------------------------ invitations
function invitation(m: { type: string; de: string; guilde?: string }) {
  const id = 'invit-' + m.type
  document.getElementById(id)?.remove()
  const d = document.createElement('div')
  d.id = id; d.className = 'invitation cadre plaque'
  d.innerHTML = `<span>${esc(t(`ui.social.invit_${m.type}`, { qui: m.de, guilde: m.guilde ?? '' }))}</span><button class="btn chaud" data-o="1">${t('ui.social.accepter')}</button><button class="btn" data-o="0">${t('ui.social.refuser')}</button>`
  d.addEventListener('pointerdown', (e) => e.stopPropagation())
  d.querySelectorAll<HTMLButtonElement>('[data-o]').forEach((b) => b.addEventListener('click', () => { send({ a: 'repondre', type: m.type, oui: b.dataset.o === '1' }); d.remove() }))
  document.getElementById('hud')!.appendChild(d)
  setTimeout(() => d.remove(), 30000)
}

// ------------------------------------------------------------------ l'écran Social
function proches() {
  const st = C.net.room?.state, moi = C.net.room?.sessionId
  const me = st?.players?.get(moi)
  const l: { sid: string; nom: string; d: number; cls: string; level: number }[] = []
  st?.players?.forEach((q: any, sid: string) => {
    if (sid === moi || q.bot || !me) return
    const d = Math.hypot(q.x - me.x, q.y - me.y)
    if (d < 400) l.push({ sid, nom: `${q.name} ${q.family}`.trim(), d, cls: CLASS_IDS[q.cls] ?? 'fantassin', level: q.level })
  })
  return l.sort((a, b) => a.d - b.d).slice(0, 12)
}

export function ecranSocial() {
  C.ecran('social')
  const o = etat.onglet
  const onglet = (id: typeof o, label: string) => `<button class="${o === id ? 'actif' : ''}" data-a="o:${id}">${label}</button>`
  let corps = ''
  if (o === 'proches') {
    const l = proches()
    corps = l.length ? `<div class="liste-social">${l.map((q) => `<div class="ligne-social"><span><b>${esc(q.nom)}</b> <small>${esc(t(`classe.${q.cls}.nom`))} · ${t('ui.social.niv', { n: q.level })} · ${Math.round(q.d / 16)} m</small></span>
      <span class="actions"><button class="petit" data-a="inv:groupe:${q.sid}">${t('ui.social.inviter_groupe')}</button><button class="petit" data-a="inv:echange:${q.sid}">${t('ui.social.echanger')}</button><button class="petit" data-a="inv:duel:${q.sid}">${t('ui.social.duel')}</button>${etat.guilde && etat.guilde.rang >= 1 ? `<button class="petit" data-a="inv:guilde:${q.sid}">${t('ui.social.inviter_guilde')}</button>` : ''}</span></div>`).join('')}</div>`
      : `<p class="doux">${t('ui.social.personne')}</p>`
    corps += `<p class="doux">${t('ui.social.prive_aide')}</p>`
    if (etat.duel) corps += `<p><button class="danger" data-a="abandon">${t('ui.social.abandon')}</button></p>`
  } else if (o === 'groupe') {
    const g = etat.groupe
    if (!g) corps = `<p class="doux">${t('ui.social.sans_groupe')}</p>`
    else {
      const chef = g.chef === g.moi
      corps = `<div class="liste-social">${g.membres.map((m) => `<div class="ligne-social"><span>${m.a === g.chef ? '♛ ' : ''}<b>${esc(m.nom)}</b> <small>${m.en_ligne ? `${m.cls ? esc(t(`classe.${m.cls}.nom`)) : ''} · ${t('ui.social.niv', { n: m.level ?? '?' })} · ${esc(t(`carte.${m.carte}.nom`))}` : t('ui.social.absent')}</small></span>
        <span class="actions">${chef && m.a !== g.moi ? `<button class="petit" data-a="chef:${m.a}">${t('ui.social.nommer_chef')}</button><button class="petit danger" data-a="exclure:${m.a}">${t('ui.social.exclure')}</button>` : ''}</span></div>`).join('')}</div>
        <p class="doux">${t('ui.social.groupe_aide')}</p>
        <div class="marques">${MARQUES.map((m, i) => `<button class="marque" data-a="marque:${i}" style="color:${m.c}">${m.g}</button>`).join('')}<small>${t('ui.social.marques_aide')}</small></div>
        <p><button class="danger" data-a="quitter">${t('ui.social.quitter_groupe')}</button></p>`
    }
  } else {
    const g = etat.guilde
    if (!g) corps = `<p class="doux">${t('ui.social.sans_guilde')}</p>
      <form class="form-guilde" onsubmit="return false"><input id="g-nom" maxlength="24" placeholder="${esc(t('ui.social.guilde_nom'))}"><input id="g-tag" maxlength="4" placeholder="${esc(t('ui.social.guilde_tag'))}"><button class="chaud" data-a="fonder">${t('ui.social.fonder')}</button></form>`
    else {
      const rangs = [t('ui.social.rang_0'), t('ui.social.rang_1'), t('ui.social.rang_2')]
      corps = `<p><b>${esc(g.nom)}</b> [${esc(g.tag)}] · ${esc(rangs[g.rang])}</p><div class="liste-social">${g.membres.map((m) => `<div class="ligne-social"><span><b>${esc(m.nom)}</b> <small>${esc(rangs[m.rang])}${m.en_ligne ? ` · ${t('ui.social.en_ligne')}` : ''}</small></span>
        <span class="actions">${g.rang === 2 && m.a !== g.moi && m.rang < 2 ? `<button class="petit" data-a="grang:1:${m.a}">${m.rang === 1 ? t('ui.social.passer_chef') : t('ui.social.promouvoir')}</button>` : ''}${g.rang === 2 && m.rang === 1 ? `<button class="petit" data-a="grang:-1:${m.a}">${t('ui.social.retrograder')}</button>` : ''}${g.rang >= 1 && g.rang > m.rang && m.a !== g.moi ? `<button class="petit danger" data-a="gexclure:${m.a}">${t('ui.social.exclure')}</button>` : ''}</span></div>`).join('')}</div>
        <p class="doux">${t('ui.social.guilde_aide')}</p><p><button class="danger" data-a="gquitter">${t('ui.social.quitter_guilde')}</button></p>`
    }
  }
  ui.showScreen(`${ui.entete(t('ui.social.titre'), 'social')}<div class="onglets">${onglet('proches', t('ui.social.proches'))}${onglet('groupe', t('ui.social.groupe'))}${onglet('guilde', t('ui.social.guilde'))}</div>${corps}`, (a) => {
    const [k, x, y] = a.split(':')
    if (k === 'o') { etat.onglet = x as typeof o; return ecranSocial() }
    if (k === 'inv') send({ a: 'inviter', type: x, sid: y })
    if (k === 'chef') send({ a: 'chef', qui: x })
    if (k === 'exclure') send({ a: 'exclure', qui: x })
    if (k === 'quitter') send({ a: 'quitter' })
    if (k === 'abandon') send({ a: 'abandon' })
    if (k === 'marque') marquer(Number(x))
    if (k === 'fonder') send({ a: 'guilde_creer', nom: (document.getElementById('g-nom') as HTMLInputElement).value, tag: (document.getElementById('g-tag') as HTMLInputElement).value.toUpperCase() })
    if (k === 'grang') send({ a: 'guilde_rang', sens: Number(x), qui: y })
    if (k === 'gexclure') send({ a: 'guilde_exclure', qui: x })
    if (k === 'gquitter') send({ a: 'guilde_quitter' })
  })
}

/** une marque : sur l'ennemi le plus proche de moi (à 300 px), sinon à mes pieds */
function marquer(i: number) {
  const st = C.net.room?.state, me = st?.players?.get(C.net.room?.sessionId)
  if (!me) return
  let cible: string | undefined, bx = me.x, by = me.y, bd = 300
  st.enemies?.forEach((e: any, id: string) => { const d = Math.hypot(e.x - me.x, e.y - me.y); if (d < bd) { bd = d; cible = id; bx = e.x; by = e.y } })
  send({ a: 'marquer', i, x: bx, y: by, cible })
}

// ------------------------------------------------------------------ l'échange
export function ecranEchange() {
  const e = etat.echange
  if (!e) return
  C.ecran('echange')
  const inv = C.sac()?.inv ?? []
  const ligne = (it: Item) => `<span class="obj">${esc(C.nomObjet(it))}${it.n > 1 ? ` ×${it.n}` : ''}</span>`
  const cote = (v: any, titre: string) => `<div class="cote-echange"><h3>${esc(titre)}</h3>${v.objets.map(ligne).join('') || `<p class="doux">${t('ui.social.rien')}</p>`}
    <p>${ico('ferraille')} <b>${v.f}</b></p><p>${v.ok ? `<b class="ok">${t('ui.social.confirme')}</b>` : v.verrou ? `<b class="ok">${t('ui.social.verrouille')}</b>` : `<span class="doux">${t('ui.social.prepare')}</span>`}</p></div>`
  const deux = e.moi.verrou && e.lui.verrou
  ui.showScreen(`${ui.entete(t('ui.social.echange_avec', { qui: e.lui.nom }), 'social', false)}
    <div class="echange">${cote(e.moi, t('ui.social.ton_offre'))}${cote(e.lui, t('ui.social.son_offre'))}</div>
    <p class="doux">${t('ui.social.echange_aide')}</p>
    <div class="grille-choix">${inv.map((it) => `<button class="petit ${etat.choix.has(it.u) ? 'actif' : ''}" data-a="c:${it.u}">${esc(C.nomObjet(it))}${it.n > 1 ? ` ×${it.n}` : ''}</button>`).join('')}</div>
    <p><label>${ico('ferraille')} <input id="ech-f" type="number" min="0" step="10" value="${e.moi.f}" style="width:90px"></label> <button data-a="offre">${t('ui.social.mettre_offre')}</button></p>
    <p><button class="${e.moi.verrou ? '' : 'chaud'}" data-a="verrou" ${e.moi.verrou ? 'disabled' : ''}>${t('ui.social.verrouiller')}</button>
      <button class="${deux && !e.moi.ok ? 'chaud' : ''}" data-a="confirmer" ${deux && !e.moi.ok ? '' : 'disabled'}>${t('ui.social.confirmer')}</button>
      <button class="danger" data-a="annuler">${t('ui.social.annuler')}</button></p>`, (a) => {
    const [k, u] = a.split(':')
    if (k === 'c') { etat.choix.has(u) ? etat.choix.delete(u) : etat.choix.add(u); return ecranEchange() }
    if (k === 'offre') send({ a: 'offre', u: [...etat.choix], f: Number((document.getElementById('ech-f') as HTMLInputElement).value) || 0 })
    if (k === 'verrou') send({ a: 'verrou' })
    if (k === 'confirmer') send({ a: 'confirmer' })
    if (k === 'annuler') send({ a: 'annuler' })
  })
}

// ------------------------------------------------------------------ cadres du groupe et marques
const vuesMarques: any[] = []
function majCadres() {
  const st = C.net.room?.state
  let box = document.getElementById('cadres-groupe')
  const g = etat.groupe
  if (!g || !st) { box?.remove(); return }
  if (!box) { box = document.createElement('div'); box.id = 'cadres-groupe'; document.getElementById('hg')!.appendChild(box) }
  box.innerHTML = g.membres.filter((m) => m.a !== g.moi).map((m) => {
    const q = m.sid && m.carte === C.carte() ? st.players?.get(m.sid) : null
    const pct = q ? Math.round(q.hp / q.maxHp * 100) : 0
    return `<div class="cadre-membre ${m.en_ligne ? '' : 'absent'}"><span>${m.a === g.chef ? '♛' : ''}${esc(m.nom.split(' ')[0])}</span><div class="barre pv"><div class="rempli" style="width:${pct}%"></div></div></div>`
  }).join('')
  // les marques : un glyphe au-dessus de l'ennemi marqué, ou au sol
  const sc = C.scene()
  if (!sc?.add) return
  etat.marques.forEach((m, i) => {
    let v = vuesMarques[i]
    if (!m || m.carte !== C.carte()) { v?.setVisible(false); return }
    if (!v) { v = vuesMarques[i] = sc.add.text(0, 0, MARQUES[i].g, { fontFamily: 'pochoir, monospace', fontSize: '18px', color: MARQUES[i].c, stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(9000) }
    const e = m.cible ? st.enemies?.get(m.cible) : null
    v.setVisible(true).setPosition(e ? e.x : m.x, (e ? e.y : m.y) - 26)
  })
}
void itemKey
