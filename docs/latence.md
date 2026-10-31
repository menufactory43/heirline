# La latence (mesurée le 31 octobre 2026)

Un vrai navigateur (Chrome, 932 × 430) joue sur un banc (son port, sa base), derrière un relais TCP qui ajoute un
aller-retour et de la gigue dans les deux sens (`tools/proxy-latence.mjs`). Le script `tools/mesure-latence.mjs`
mesure :

- le délai entre l'appui et le soldat qui bouge à l'écran (prédiction), puis dans l'état du serveur ;
- les sauts de position du soldat à l'écran (corrections de la réconciliation) pendant 12 s de marche en zigzag, avec
  des ruées ;
- dans l'arène de la Couveuse (40 s de zigzag), chaque balle qui touche le soldat : sa plus petite distance au soldat
  **tel qu'il était affiché**, au moment où elle était affichée. Une distance positive au-delà de 6 px voudrait dire
  « touché par une balle qu'on avait esquivée à l'écran ».

```
node tools/proxy-latence.mjs 2799 127.0.0.1:2798 150 20 &
API=http://127.0.0.1:2798/ node tools/mesure-latence.mjs http://127.0.0.1:2799/ "rtt+150 gigue 20" 40
```

| Réseau | Ping mesuré | Appui → écran | Appui → serveur | Sauts / images | Touches sur moi | Touches injustes (> 6 px) | Limites (0 à 6 px) | Frôlements sans touche |
|---|---|---|---|---|---|---|---|---|
| Wi-Fi local | 1 ms | 24 ms | 80 ms | 1 / 1155 | 12 | 0 | 1 | 5 |
| + 50 ms | 52 ms | 29 ms | 179 ms | 0 / 1143 | 16 | 0 | 2 | 1 |
| + 100 ms, gigue 10 | 116 ms | 33 ms | 221 ms | 4 / 1101 | 9 | 0 | 0 | 2 |
| + 150 ms, gigue 20 | 172 ms | 30 ms | 281 ms | 6 / 1092 | 23 | 0 | 1 | 3 |
| + 200 ms, gigue 30 | 234 ms | 22 ms | 344 ms | 2 / 1148 | 22 | 0 | 3 | 0 |

Lecture :

- **Le soldat répond tout de suite**, quelle que soit la latence : 22 à 33 ms entre l'appui et l'image (une à deux
  images à 60 i/s, plus l'envoi des entrées à rythme fixe). C'est la prédiction.
- **Le serveur confirme un aller-retour plus tard**, plus un tick (50 ms) et un envoi d'état : 80 ms en local, 344 ms
  à 200 ms de ping. Ça ne se voit pas, sauf en cas de désaccord.
- **Les corrections sont rares et petites** : au plus 6 sauts sur environ 1 100 images, aucun de plus de 12 px. Les
  sauts viennent des ruées et des murs, quand la prédiction et le serveur divergent d'un tick.
- **Aucune touche injuste dans l'arène**, de 0 à 200 ms : chaque balle qui a touché était sur le soldat à l'écran (au
  plus 1,4 px d'écart, dans l'arrondi). Raison : le client dessine les balles en avance d'un aller-retour, exactement
  là où elles seront quand son entrée arrivera au serveur. Le contraire existe un peu (« frôlements sans touche ») :
  une balle passée sur le soldat à l'écran que le serveur, qui ne regarde que tous les 50 ms, n'a pas vue. C'est en
  faveur du joueur.
- Avec beaucoup de gigue, l'avance est estimée sur un ping lissé : au-delà de 30 ms de gigue, des touches « limites »
  peuvent devenir injustes. Pas mesuré au-delà.

## Le tunnel Cloudflare (accès hors de la maison)

Le tunnel rapide (`trycloudflare.com`) vers le 2700 : 17 à 40 ms pour la connexion TCP, 90 à 260 ms jusqu'au premier
octet d'une requête HTTPS neuve (poignée TLS comprise), contre 2 ms en Wi-Fi local. Le WebSocket n'a pas été mesuré
par le tunnel : il faudrait entrer dans le jeu du 2700, donc créer un compte dans la vraie base. Estimation : un ping de
40 à 80 ms depuis la France, la ligne « + 50 ms » ci-dessus.

## Le tick du serveur

`/api/stats` donne maintenant la durée d'un pas de salle (moyenne, p95, p99, max) et le retard de la boucle
d'événements (p50, p99, max ; résolution 10 ms, donc 10 ms au repos). À vide, sur le banc (le continent, Port-Ancre,
quelques créatures) : pas moyen 0,21 ms, p95 0,77 ms, p99 1,15 ms ; boucle p99 14 ms (4 ms au-delà de la résolution).
Les chiffres en charge sont dans [charge.md](charge.md).

## L'indicateur de ping

Sous la minicarte (« 12 ms »), affiché par défaut, à masquer dans le menu (« Ping : affiché / masqué »).
