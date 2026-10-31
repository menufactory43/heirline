// Un port libre pour un serveur de test : deux sessions qui lancent les tests en même temps ne se marchent plus dessus.
import { createServer } from 'node:net'
export function portLibre(): Promise<number> {
  return new Promise((res, rej) => {
    const s = createServer().once('error', rej).listen(0, () => { const p = (s.address() as { port: number }).port; s.close(() => res(p)) })
  })
}
