// Règles communes aux deux essais (mêmes nombres partout, côté serveur et prédiction client).
export const W = 1600, H = 1000
export const TICK_HZ = 20
export const SPEED = 160          // px/s
export const RADIUS = 10
export const BULLET_SPEED = 520   // px/s
export const BULLET_LIFE = 1.0    // s
export const FIRE_COOLDOWN = 0.15 // s
export const DAMAGE = 10
export const MAX_HP = 100

export interface Body { x: number; y: number }

/** Déplacement d'un pas : le même calcul côté serveur et dans la prédiction. */
export function moveStep(b: Body, mx: number, my: number, dt: number) {
  const l = Math.hypot(mx, my)
  if (l > 1) { mx /= l; my /= l }
  b.x = Math.max(RADIUS, Math.min(W - RADIUS, b.x + mx * SPEED * dt))
  b.y = Math.max(RADIUS, Math.min(H - RADIUS, b.y + my * SPEED * dt))
}
