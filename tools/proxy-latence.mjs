// Un relais TCP qui ajoute de la latence et de la gigue, dans les deux sens, sans changer l'ordre des paquets.
// node tools/proxy-latence.mjs <port d'écoute> <hôte:port cible> <aller-retour en ms> <gigue en ms>
// Chaque sens reçoit la moitié de l'aller-retour, plus une gigue tirée dans [0, gigue].
import net from 'node:net'
const [ecoute, cible, rttS, gigueS] = process.argv.slice(2)
const [hote, port] = cible.split(':')
const demi = Number(rttS) / 2, gigue = Number(gigueS ?? 0)
function retarder(src, dst) {
  // une file par sens, vidée dans l'ordre par une seule minuterie : deux minuteries de durées différentes qui tombent
  // à la même milliseconde ne partent pas forcément dans l'ordre (le paquet suivant doublerait le précédent)
  const file = []; let dernier = 0, minuterie = null, fin = false
  const vider = () => {
    minuterie = null
    while (file.length && file[0].t <= Date.now()) { const { buf } = file.shift(); if (!dst.destroyed) dst.write(buf) }
    if (file.length) minuterie = setTimeout(vider, Math.max(1, file[0].t - Date.now()))
    else if (fin) dst.end()
  }
  src.on('data', (buf) => {
    dernier = Math.max(dernier, Date.now() + demi + Math.random() * gigue)
    file.push({ t: dernier, buf })
    if (!minuterie) minuterie = setTimeout(vider, Math.max(1, dernier - Date.now()))
  })
  src.on('end', () => { fin = true; if (!minuterie) vider() })
  src.on('error', () => dst.destroy())
}
net.createServer((c) => {
  const s = net.connect(Number(port), hote)
  retarder(c, s); retarder(s, c)
  s.on('error', () => c.destroy())
}).listen(Number(ecoute), '0.0.0.0', () => console.log(`relais ${ecoute} → ${cible}, aller-retour +${rttS} ms, gigue ${gigue} ms`))
