/** La même forme qu'un dictionnaire français, avec des chaînes à la place des littéraux (pour l'anglais). */
export type Forme<T> = { [K in keyof T]: T[K] extends string ? string : T[K] extends readonly unknown[] ? Forme<T[K]> : Forme<T[K]> }

/** aplatit un dictionnaire : { a: { b: 'x', c: ['y', 'z'] } } → { 'a.b': 'x', 'a.c.0': 'y', 'a.c.1': 'z' } */
export function aplatir(o: unknown, pre = '', out: Record<string, string> = {}): Record<string, string> {
  if (typeof o === 'string') { out[pre] = o; return out }
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) aplatir(v, pre ? `${pre}.${k}` : k, out)
  return out
}
