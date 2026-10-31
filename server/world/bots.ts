// Les soldats IA de la Colonie : ils complètent les groupes au nid, et servent aux tests de charge et à la passe
// qui mesure la difficulté des concessions. Ils jouent avec les mêmes entrées qu'un joueur.
import { lineOfSight } from '../../shared/map.ts'
import { CLASSES, ENEMIES, E } from '../../shared/rules.ts'
import type { World, PSim, InputCmd, ESim, Tele } from './World.ts'
import { ARENE, ARENE_COLS, ARENE_ROWS, balles, posBalle, caseSol } from '../../shared/motifs.ts'
import { TILE } from '../../shared/consts.ts'

export class BotBrain {
  leader: PSim | null = null
  /** en raid : tank (prend la taille, se tient devant le boss), soin, dps */
  role: 'tank' | 'soin' | 'dps' = 'dps'
  /** l'assaut du Métier : le veilleur va se tenir près du robot que la Glaneuse veut glaner */
  veille = false
  thinkT = 0
  cmd: InputCmd = { mx: 0, my: 0, aim: 0, fire: false }
  aimErr = (Math.random() - 0.5) * 0.12
  stuckT = 0
  lastX = 0; lastY = 0
  side = Math.random() < 0.5 ? 1 : -1
  /** errance (test de charge) : un point à atteindre quand il n'y a ni chef ni ennemi */
  roam: { x: number; y: number } | null = null
  roaming = false
  /** chasse (passe de mesure des concessions) : aller vers l'ennemi le plus proche, même invisible */
  hunt = false
  skill = 0.85 // un peu moins bien qu'un bon joueur

  think(w: World, p: PSim, dt: number): InputCmd {
    this.thinkT -= dt
    if (p.s.etat !== 0) return { mx: 0, my: 0, aim: p.s.angle, fire: false }
    if (this.thinkT > 0) return this.cmd
    this.thinkT = 0.15
    const s = p.s
    if (w.arene?.ferme && w.arene.dedans(s.x, s.y)) { this.thinkT = 0.07; return (this.cmd = this.arene(w, p)) }
    let mx = 0, my = 0, fire = false, aim = s.angle

    // 1. sortir des zones annoncées
    for (const t of w.teles) {
      if (t.dmg < 0 || !w.inTele(t, s.x, s.y, 10)) continue
      if (t.kind === 'cercle') { const d = Math.hypot(s.x - t.x, s.y - t.y) || 1; mx += (s.x - t.x) / d * 2; my += (s.y - t.y) / d * 2 }
      else { const dx = t.x2 - t.x, dy = t.y2 - t.y, l = Math.hypot(dx, dy) || 1; mx += -dy / l * 2 * this.side; my += dx / l * 2 * this.side }
    }
    // 2. relever un soldat à terre
    let aider: PSim | null = null
    if (!mx && !my) for (const q of w.players.values()) if (q !== p && q.s.etat === 1 && Math.hypot(q.s.x - s.x, q.s.y - s.y) < 160) { aider = q; break }
    if (aider) { const d = Math.hypot(aider.s.x - s.x, aider.s.y - s.y); if (d > 14) { mx = (aider.s.x - s.x) / d; my = (aider.s.y - s.y) / d } }
    // 3. tirer sur l'ennemi visible le plus proche
    let cible: ESim | null = null, bd = 230
    for (const es of w.enemies.values()) {
      const d = Math.hypot(es.e.x - s.x, es.e.y - s.y)
      if (d < bd && lineOfSight(w.map, s.x, s.y, es.e.x, es.e.y)) { bd = d; cible = es }
    }
    if (cible) {
      aim = Math.atan2(cible.e.y - s.y, cible.e.x - s.x) + this.aimErr * (1 + Math.random())
      fire = Math.random() < this.skill
      if (!mx && !my && !aider) {
        if (bd < 55 && cible.kind !== E.COUVEUSE) { mx = -(cible.e.x - s.x) / bd; my = -(cible.e.y - s.y) / bd }
        else if (cible.kind === E.COUVEUSE && bd < 70) { mx = -(cible.e.x - s.x) / bd; my = -(cible.e.y - s.y) / bd }
        else if (bd > CLASSES[p.cls].arme.portee * CLASSES[p.cls].arme.vitesse * 0.8) { mx = (cible.e.x - s.x) / bd; my = (cible.e.y - s.y) / bd }
      }
      this.useSkills(w, p, cible, bd)
    }
    // 4. suivre le chef, ou errer
    if (!mx && !my && !aider) {
      const l = this.leader && this.leader.s.etat !== 2 && w.players.has(this.leader.sid) ? this.leader : null
      if (l) {
        const ox = l.s.x + Math.cos(l.s.angle + Math.PI * 0.8 * this.side) * 34, oy = l.s.y + Math.sin(l.s.angle + Math.PI * 0.8 * this.side) * 34
        const d = Math.hypot(ox - s.x, oy - s.y)
        if (d > 18) { mx = (ox - s.x) / d; my = (oy - s.y) / d }
      } else if (this.hunt && w.enemies.size) {
        let best: ESim | null = null, bdd = 1e9
        for (const es of w.enemies.values()) { const d = Math.hypot(es.e.x - s.x, es.e.y - s.y); if (d < bdd) { bdd = d; best = es } }
        if (best && bdd > 40) { mx = (best.e.x - s.x) / bdd; my = (best.e.y - s.y) / bdd }
      } else if (this.roaming) {
        if (!this.roam || Math.hypot(this.roam.x - s.x, this.roam.y - s.y) < 20) this.roam = { x: s.x + (Math.random() - 0.4) * 300, y: s.y + (Math.random() - 0.5) * 300 }
        const d = Math.hypot(this.roam.x - s.x, this.roam.y - s.y)
        mx = (this.roam.x - s.x) / d; my = (this.roam.y - s.y) / d
      }
      if (!cible) aim = Math.atan2(my || Math.sin(s.angle), mx || Math.cos(s.angle))
    }
    // 5. coincé contre un mur : on glisse de côté
    const moved = Math.hypot(s.x - this.lastX, s.y - this.lastY)
    this.lastX = s.x; this.lastY = s.y
    if ((mx || my) && moved < 1) { this.stuckT += 0.15; if (this.stuckT > 0.45) { const t = mx; mx = -my * this.side; my = t * this.side; if (this.stuckT > 1.5) { this.stuckT = 0; this.side *= -1; this.roam = null } } }
    else this.stuckT = 0
    this.cmd = { mx, my, aim, fire }
    return this.cmd
  }

  /** Dans l'arène de la Couveuse : esquiver les balles, sortir des zones et du sol arraché, tirer sur les sacs d'abord. */
  arene(w: World, p: PSim): InputCmd {
    const s = p.s, a = w.arene!, now = w.time
    let mx = 0, my = 0
    // 1. les balles : regarder où chacune sera dans un instant, et s'écarter de sa route
    let urgence = false
    for (const mv of a.motifs) {
      if (now < mv.m.t0 - 0.3) continue
      const bs = balles(mv.m)
      for (let i = 0; i < bs.length; i++) {
        if (mv.mortes.has(i)) continue
        const b = bs[i]
        for (const h of [0, 0.15, 0.3, 0.45]) {
          const q = posBalle(mv.m, b, now + h)
          if (!q) continue
          const dx = s.x - q.x, dy = s.y - q.y, d = Math.hypot(dx, dy)
          if (d > 16) continue
          // perpendiculaire à la route de la balle, du côté où l'on est déjà
          const vx = Math.cos(b.a), vy = Math.sin(b.a)
          const cote = dx * -vy + dy * vx >= 0 ? 1 : -1
          const poids = (1 - h) * (16 - d) / 16 * 3
          mx += -vy * cote * poids; my += vx * cote * poids
          if (h === 0 && d < 7) urgence = true
          break
        }
      }
    }
    // 2. les zones annoncées : vers la case sûre la plus proche
    let raid = false
    for (const t of w.teles) {
      if (t.dmg < 0) continue
      // le raid : aller partager une graine, s'écarter des autres quand on est greffé, le tank prend la taille
      if (t.sp === 'semis') {
        const proches = [...w.players.values()].filter((q) => q.s.etat === 0).sort((q, r) => Math.hypot(q.s.x - t.x, q.s.y - t.y) - Math.hypot(r.s.x - t.x, r.s.y - t.y)).slice(0, (t.partage ?? 2) + 1)
        if (proches.includes(p) && this.role !== 'tank') { const d = Math.hypot(t.x - s.x, t.y - s.y); if (d > t.r * 0.5) { mx += (t.x - s.x) / d * 2.5; my += (t.y - s.y) / d * 2.5 } raid = true }
        continue
      }
      if (t.sp === 'glane') {
        const rs = t.suit ? w.robots.get(t.suit) : undefined
        if (this.veille && rs) { const d = Math.hypot(rs.r.x - s.x, rs.r.y - s.y); if (d > 12) { mx += (rs.r.x - s.x) / d * 2.5; my += (rs.r.y - s.y) / d * 2.5 } raid = true }
        continue
      }
      if (t.suit === p.sid) {
        let q0: PSim | null = null, qd = 1e9
        for (const q of w.players.values()) if (q !== p && q.s.etat === 0) { const d = Math.hypot(q.s.x - s.x, q.s.y - s.y); if (d < qd) { qd = d; q0 = q } }
        if (q0 && qd < t.r * 2 + 16) { mx += (s.x - q0.s.x) / (qd || 1) * 2.5; my += (s.y - q0.s.y) / (qd || 1) * 2.5 }
        raid = true
        continue
      }
      if (t.sp === 'taille' && this.role === 'tank') continue
      if (!w.inTele(t, s.x, s.y, 6)) continue
      const [ex, ey] = sortie(t, s.x, s.y)
      const d = Math.hypot(ex - s.x, ey - s.y) || 1
      mx += (ex - s.x) / d * 2.5; my += (ey - s.y) / d * 2.5
    }
    // 3. le sol arraché : vers la case intacte la plus proche
    const ici = caseSol(s.x, s.y)
    const mauvais = (c: number) => c >= 0 && a.sol[c] !== 0
    if (mauvais(ici) || mauvais(caseSol(s.x + mx * 6, s.y + my * 6))) {
      let best = -1, bd = 1e9
      const cx = Math.floor((s.x - ARENE.x0) / TILE), cy = Math.floor((s.y - ARENE.y0) / TILE)
      for (let y = Math.max(0, cy - 4); y < Math.min(ARENE_ROWS, cy + 5); y++) for (let x = Math.max(0, cx - 4); x < Math.min(ARENE_COLS, cx + 5); x++) {
        const id = y * ARENE_COLS + x
        if (a.sol[id]) continue
        const px = ARENE.x0 + x * TILE + 8, py = ARENE.y0 + y * TILE + 8
        if (px < a.borne.x0 || px > a.borne.x1) continue
        const d = Math.hypot(px - s.x, py - s.y)
        if (d < bd) { bd = d; best = id }
      }
      if (best >= 0) { const px = ARENE.x0 + (best % ARENE_COLS) * TILE + 8, py = ARENE.y0 + Math.floor(best / ARENE_COLS) * TILE + 8; mx += (px - s.x) / (bd || 1) * 3; my += (py - s.y) / (bd || 1) * 3 }
    }
    // 4. la cible : un sac d'abord, sinon la Couveuse ; les rampants trop près passent avant
    let cible: ESim | null = null, bd = 1e9
    for (const es of w.enemies.values()) {
      const d = Math.hypot(es.e.x - s.x, es.e.y - s.y)
      const prio = es.kind === E.RAMPANT && d < 70 ? 0 : es.kind === E.SAC ? 1 : es.kind === E.OEUF && d < 110 ? 1.5 : es.kind === E.COUVEUSE || es.kind === E.SEMEUR || es.kind === E.PEPINIERE || es.kind === E.GREFFIER || es.kind === E.GLANEUSE ? 2 : (es.kind === E.GREFFE || es.kind === E.POT || es.kind === E.BALISE) && this.dedansArene(w, es) ? 1.2 : es.kind === E.PYLONE && this.dedansArene(w, es) ? 1.1 : es.kind === E.PORTENOM ? 9 : 3
      const score = prio * 1000 + d
      if (score < bd) { bd = score; cible = es }
    }
    // 5. se tenir dans le bas de l'arène, sous sa cible, et bouger sans cesse (une cible qui bouge est dure à viser)
    const bo = a.borne
    this.roamT = (this.roamT ?? 0) - 0.07
    if (this.roamT <= 0 || !this.roam) {
      // à portée de tir de la Couveuse et de ses sacs (le fusil à pompe s'approche), sans coller au corps
      const w = CLASSES[p.cls].arme, portee = w.portee * w.vitesse
      const yMax = Math.min(bo.y1 - 16, ARENE.y0 + 50 + portee * 0.8)
      this.roamT = 1.2 + Math.random() * 1.4
      this.roam = { x: bo.x0 + 20 + Math.random() * (bo.x1 - bo.x0 - 40), y: Math.max(ARENE.y0 + 90, yMax - Math.random() * 60) }
    }
    // le tank se tient devant le boss, entre lui et le groupe ; les autres restent à distance
    const boss = a.boss?.e
    if (boss && (a.profil === 'semeur' || a.profil === 'glaneuse')) {
      if (this.role === 'tank') this.roam = { x: boss.x + this.side * 14, y: boss.y + 46 }
      else if (this.roam.y < boss.y + 110) this.roam.y = Math.min(bo.y1 - 16, boss.y + 110 + Math.random() * 40)
    }
    // le Registre : le soldat le plus proche d'un porte-nom va le toucher (les balles ne lui font rien)
    if (a.profil === 'greffier') for (const es of w.enemies.values()) {
      if (es.kind !== E.PORTENOM) continue
      let q0: PSim | null = null, qd = 1e9
      for (const q of w.players.values()) if (q.s.etat === 0) { const d = Math.hypot(q.s.x - es.e.x, q.s.y - es.e.y); if (d < qd) { qd = d; q0 = q } }
      if (q0 === p) { this.roam = { x: es.e.x, y: es.e.y }; this.roamT = 0.3; break }
    }
    if (Math.hypot(mx, my) < 0.6 && !raid) {
      const d = Math.hypot(this.roam.x - s.x, this.roam.y - s.y)
      if (d > 6) { mx += (this.roam.x - s.x) / d * 0.8; my += (this.roam.y - s.y) / d * 0.8 }
    }
    const l = Math.hypot(mx, my)
    if (l > 1) { mx /= l; my /= l }
    let aim = s.angle
    if (cible) aim = Math.atan2(cible.e.y - s.y, cible.e.x - s.x) + this.aimErr * 0.5
    if (urgence && s.dashCd <= 0 && (mx || my)) p.wantDash = true
    if (cible) this.useSkills(w, p, cible, Math.hypot(cible.e.x - s.x, cible.e.y - s.y))
    return { mx, my, aim, fire: !!cible }
  }
  roamT = 0
  dedansArene(w: World, es: ESim) { return !!w.arene?.dedans(es.e.x, es.e.y) }

  /** Les compétences des soldats IA, quelle que soit la classe ou la spécialité : une règle simple par compétence. */
  useSkills(w: World, p: PSim, cible: ESim, d: number) {
    const allies = [...w.players.values()].filter((q) => q !== p && Math.hypot(q.s.x - p.s.x, q.s.y - p.s.y) < 90)
    const blesses = [p, ...allies].some((q) => q.s.etat === 0 && q.s.hp < q.s.maxHp * 0.6)
    const aTerre = allies.some((q) => q.s.etat === 1)
    const gros = ENEMIES[cible.kind].pv > 60 || !!ENEMIES[cible.kind].boss
    const vie = p.s.hp / p.s.maxHp
    for (let i = 0; i < p.comps.length; i++) {
      const id = p.comps[i]
      if (!id || p.cd[i] > 0) continue
      let go = false, vise = false
      switch (id) {
        case 'bouclier': go = vie < 0.6; break
        case 'injection': go = blesses; break
        case 'adrenaline': go = aTerre; break
        case 'tourelle': go = d < 180; break
        case 'surcharge': case 'blindage': go = !!p.robot && p.robot.kind === 'robot' && d < 170; break
        case 'grenade': go = d < 140 && d > 50 && (gros || Math.random() < 0.3); vise = true; break
        case 'marquage': case 'filet': case 'champ': case 'toxine': case 'court_circuit': go = d < 190 && (gros || Math.random() < 0.4); vise = true; break
        case 'mortier': case 'tapis': go = d < 200 && d > 60; vise = true; break
        case 'piege': go = d < 120; break
        case 'onde': case 'brasier': go = d < 65; break
        case 'leurre': go = vie < 0.6 && d < 160; vise = true; break
        case 'bastion': go = d < 120 && (vie < 0.8 || allies.length > 0); break
        case 'percee': go = d < 110 && vie > 0.4; break
        case 'tir_lourd': go = d < 380 && gros; break
        case 'perfusion': go = blesses || aTerre; break
        case 'essaim': go = d < 170; break
        case 'voile': go = vie < 0.45; break
      }
      if (!go) continue
      if (vise) w.skill(p, i, cible.e.x, cible.e.y); else w.skill(p, i)
      break
    }
  }
}

/** le point sûr le plus proche hors d'une zone annoncée */
function sortie(t: Tele, x: number, y: number): [number, number] {
  if (t.kind === 'cercle') { const d = Math.hypot(x - t.x, y - t.y) || 1; return [t.x + (x - t.x) / d * (t.r + 12), t.y + (y - t.y) / d * (t.r + 12)] }
  if (t.kind === 'anneau') {
    const d = Math.hypot(x - t.x, y - t.y) || 1
    // plus près du centre que du bord : au centre ; sinon dehors
    return d < ((t.r2 ?? 0) + t.r) / 2 ? [t.x, t.y] : [t.x + (x - t.x) / d * (t.r + 10), t.y + (y - t.y) / d * (t.r + 10)]
  }
  if (t.kind === 'colonnes') {
    let best: [number, number] = [x, y], bd = 1e9
    for (const c of t.cols ?? []) for (const s of [-1, 1]) {
      const ex = c + s * (t.r + 9)
      if ((t.cols ?? []).some((o) => Math.abs(ex - o) < t.r + 4)) continue
      if (Math.abs(ex - x) < bd) { bd = Math.abs(ex - x); best = [ex, y] }
    }
    return best
  }
  if (t.kind === 'grille') {
    // la case voisine sûre la plus proche (celles du damier opposé)
    const cx = Math.floor((x - t.x) / t.r), cy = Math.floor((y - t.y) / t.r)
    let best: [number, number] = [x, y], bd = 1e9
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const px = t.x + (cx + dx + 0.5) * t.r, py = t.y + (cy + dy + 0.5) * t.r
      if (px < t.x || px > t.x2 || py < t.y) continue
      const d = Math.hypot(px - x, py - y)
      if (d < bd) { bd = d; best = [px, py] }
    }
    return best
  }
  const dx = t.x2 - t.x, dy = t.y2 - t.y, l = Math.hypot(dx, dy) || 1
  return [x - dy / l * (t.r + 10), y + dx / l * (t.r + 10)]
}
