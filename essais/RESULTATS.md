# Essai réseau : Colyseus 0.18 contre SpacetimeDB 2.13

29 octobre 2026, sur le Mac mini (Mac16,10). Jeu de tir 2D vu de dessus, serveur autoritaire à 20 Hz.

## Versions réelles (npm, 29/10/2026)

- **colyseus 0.18.10**, @colyseus/core 0.18.23, @colyseus/schema 5.0.42, client **@colyseus/sdk 0.18.8**. Le paquet
  client n'est plus `colyseus.js` (resté en 0.16). La prédiction est bien intégrée au SDK : `Predict` (`lerp`,
  `extrapolate`, `damped`, `reckon`), `predict.reconciler()` (rollback rejoué), `room.input()`, et côté serveur
  `defineInput()`, `setFixedTimestep()`, `allowRewindState()` (compensation de latence), `simulateLatency()`.
  `@colyseus/h3-transport` (WebTransport) existe en 0.18.5 mais est marqué **expérimental** ; non testé ici.
- **SpacetimeDB 2.13.0** (CLI et paquet `spacetimedb`), modules en TypeScript, client TS généré par
  `spacetime generate`, reducers planifiés (`ScheduleAt.interval`). Aucune prédiction ni interpolation fournie.

## Le prototype (identique pour les deux)

- Client Phaser 4.2.1 (carrés de couleur), deux joysticks tactiles ou clavier et souris, servi par Vite.
- Le joueur bouge (160 px/s) et tire (balles à 520 px/s, 10 dégâts, 100 PV) ; le serveur décide des positions, tirs
  et touches. Mêmes règles dans `commun/sim.ts`.
- Prédiction du joueur local et réconciliation, interpolation des autres à 100 ms.
  - Colyseus : `Predict` + `reconciler` du SDK (52 lignes côté client).
  - SpacetimeDB : tout écrit à la main (94 lignes côté client) : file des entrées non confirmées, rejeu, lissage de
    l'erreur, tampon d'interpolation, extrapolation des balles.
- Deux variantes SpacetimeDB :
  - **immédiat** (`stdb`) : chaque entrée est un reducer qui déplace le joueur tout de suite ;
  - **par tick** (`stdbq`) : les entrées attendent dans une table privée et le tick les applique, pour n'avoir qu'une
    transaction par tick, comme Colyseus. C'est la façon de faire recommandée pour un jeu.
- Bots : `client/bots.ts`, N connexions qui envoient 20 entrées/s (déplacement aléatoire, visée, tir une fois sur
  deux). Banc : `banc.py` (CPU et mémoire du serveur échantillonnés par `ps`, tick mesuré par le serveur lui-même).
- 4G simulée : `lagproxy.ts`, proxy TCP à 120 ms aller-retour, ±10 ms de gigue, 2 % de pertes (chaque perte retient
  le flux ~320 ms, comme une retransmission TCP).

Vérifié dans Chrome sans écran : les deux clients s'affichent à 60 images/s, et 1 s de déplacement donne 160 px
dans les cinq modes (prédiction correcte, avec et sans 4G simulée).

## Mesures (bots sur le Mac, 20 s par mesure)

| Techno | Clients | CPU serveur | Mémoire | Tick moyen / écart / max (ms) | Descendant par client | Montant par client | Confirmation p50 / p95 |
|---|---|---|---|---|---|---|---|
| Colyseus | 1 | 2 % | 113 Mo | 50,0 / 8,7 / 53 | 0,7 Ko/s | 0,1 Ko/s | 74 / 104 ms |
| Colyseus | 50 | 11 % | 130 Mo | 50,0 / 8,9 / 54 | 57 Ko/s | 0,1 Ko/s | 96 / 104 ms |
| Colyseus | 100 | 12 % | 156 Mo | 49,9 / 9,3 / 53 | 106 Ko/s | 0,1 Ko/s | 97 / 105 ms |
| Colyseus | 200 (sondage) | 20 % | 164 Mo | 49,9 / 8,1 / 53 | 201 Ko/s | 0,1 Ko/s | 97 / 106 ms |
| SpacetimeDB par tick | 1 | 6 % | 0,6–1,5 Go* | 50,0 / 0,7 / 52 | 9 Ko/s | 0,8 Ko/s | 39 / 54 ms |
| SpacetimeDB par tick | 50 | 65 % | 741 Mo | 50,0 / 0,7 / 52 | 161 Ko/s | 0,8 Ko/s | 63 / 86 ms |
| SpacetimeDB par tick | 70 (sondage) | — | — | **159** / — / 254 | 163 Ko/s | 0,8 Ko/s | 229 / 289 ms |
| SpacetimeDB par tick | 100 | 109 % | 603 Mo | **972** / 366 / 1 645 | 118 Ko/s | 0,8 Ko/s | **606 / 1 587 ms** |
| SpacetimeDB immédiat | 1 | 6 % | 573 Mo | 50,0 / 0,7 / 52 | 12 Ko/s | 0,7 Ko/s | 5 / 8 ms |
| SpacetimeDB immédiat | 50 | 69 % | 500 Mo | 50,0 / 0,7 / 52 | 193 Ko/s | 0,7 Ko/s | 18 / 40 ms |
| SpacetimeDB immédiat | 100 | 132 % | 618 Mo | **694** / 191 / 1 007 | 222 Ko/s | 0,5 Ko/s | **440 / 1 014 ms** |

\* mémoire de tout le serveur SpacetimeDB (toutes les bases et leurs tampons), elle varie d'un passage à l'autre.

Le même banc avec les bots sur le NUC (`banc-nuc.json`) donne le même effondrement de SpacetimeDB à 100 (tick
879 ms) : c'est bien le serveur, pas les bots. (Sur le NUC, Colyseus à 100 se dégrade côté bots : 4 cœurs ne suffisent
pas à décoder 100 flux ; le tick serveur reste à 50 ms et 31 % de CPU.)

**Avec la 4G simulée (120 ms, 2 %), 5 bots** : confirmation p50 / p95 = Colyseus 215 / 370 ms, SpacetimeDB par
tick 155 / 388 ms, SpacetimeDB immédiat 138 / 425 ms. Le joueur local, lui, bouge sans délai dans les trois cas
(prédiction) ; la confirmation compte pour les corrections et le retour des touches.

### Ce qu'il faut lire dans ces chiffres

- **Charge** : Colyseus tient 200 joueurs à 20 % d'un cœur. SpacetimeDB, avec le même jeu, sature entre 50 et 70
  joueurs : un monde est une base qui tourne sur un seul fil, et chaque tick doit recalculer et envoyer les
  abonnements de tous les clients. Au-delà, le tick passe de 50 ms à près d'une seconde : injouable.
- **Confirmation** : à faible charge, SpacetimeDB confirme plus vite (5 ms en immédiat, 39 ms par tick contre ~100 ms
  pour Colyseus). Chez Colyseus, le pas de simulation et l'envoi des patchs ont chacun leur minuteur à 20 Hz, ce qui
  coûte environ deux ticks. Un essai qui envoie le patch juste après chaque pas fait tomber la confirmation à ~50 ms,
  mais les patchs n'arrivaient plus qu'à ~5 par seconde : abandonné, à creuser (ou monter le tick à 30 Hz).
- **Régularité** : le tick de SpacetimeDB est très régulier (écart 0,7 ms) tant qu'il n'est pas saturé. Celui de
  Colyseus a un écart de ~9 ms (pas fixe rattrapé par un accumulateur) mais les patchs reçus restent réguliers
  (écart 2–3 ms à 100 clients).
- **Bande passante** : sans gestion de la zone d'intérêt, chaque client reçoit tout le monde : 106 Ko/s à 100 joueurs
  chez Colyseus, c'est trop pour la 4G. SpacetimeDB envoie 1,5 à 13 fois plus pour le même état (lignes complètes
  avec identité de 32 octets, plus un message par appel de reducer). **Les deux ont besoin d'un filtrage par zone**
  (StateView chez Colyseus, abonnements filtrés chez SpacetimeDB) avant de parler de 100 joueurs sur téléphone.

## Effort de code

| | Colyseus | SpacetimeDB |
|---|---|---|
| Serveur | 119 lignes | 142 lignes (deux variantes d'entrée comprises) |
| Réseau client | 52 lignes, prédiction et interpolation fournies | 94 lignes, tout à la main |
| Manque | compensation de latence branchée mais pas utilisée (projectiles) ; WebTransport expérimental | prédiction, interpolation, compensation de latence, contrôle du débit d'entrées |
| En plus | — | persistance, requêtes SQL, abonnements, identité : prêts à l'emploi |

## Ressenti

En local, les deux répondent tout de suite grâce à la prédiction ; les autres joueurs glissent proprement avec 100 ms
d'interpolation. Avec la 4G simulée, la différence ne se voit pas sur son propre soldat ; les pertes provoquent de
petits à-coups chez les autres dans les deux cas (TCP). À 100 joueurs, SpacetimeDB devient injouable (une mise à
jour par seconde), Colyseus ne bouge pas. Je n'ai pas joué sur un vrai téléphone : à faire par l'utilisateur.

## Recommandation

**Colyseus 0.18 pour le combat**, avec trois raisons mesurées :

1. **Charge** : 200 joueurs à 20 % d'un cœur contre une saturation vers 50–70 joueurs pour SpacetimeDB. La cible
   d'Heirline est 50 à 100 joueurs par secteur, avec des monstres en plus : SpacetimeDB serait déjà au bord avant
   d'ajouter le moindre monstre.
2. **Prédiction et réconciliation intégrées**, et compensation de latence prête (`allowRewindState`) : ce qu'il
   faudrait écrire, tester et maintenir à la main avec SpacetimeDB.
3. **Bande passante** plus faible pour le même état (schéma binaire en deltas, champs quantifiés).

SpacetimeDB reste intéressant pour ce qui n'est pas du temps réel : lignées, robots, front, concessions, API des
agents (requêtes SQL et abonnements gratuits). À réévaluer plus tard pour cette couche persistante seulement.

À faire ensuite côté Colyseus : filtrage par zone (StateView) pour descendre sous ~20 Ko/s par joueur, régler le
délai de confirmation (tick à 30 Hz ou patch aligné sur le pas), essayer le transport WebTransport quand il sortira
de l'expérimental.

## Non vérifié

- Pas de test sur un vrai iPhone en 4G (seulement le proxy).
- WebTransport (`@colyseus/h3-transport`) non essayé.
- Compensation de latence de Colyseus (`allowRewindState`) non mesurée : le prototype tire des projectiles, pas des
  tirs instantanés.
- SpacetimeDB testé avec un module TypeScript ; un module Rust serait plus rapide pour la logique, mais le coût
  mesuré vient surtout des abonnements, que le langage ne change pas. Non testé.
- Aucun filtrage par zone dans les deux : les chiffres de bande passante sont un pire cas.
- Le délai de confirmation de Colyseus (~2 ticks) n'est pas expliqué jusqu'au bout.

## Relancer

```sh
# serveurs
cd ~/heirline/essais/colyseus && PORT=2567 npx tsx server.ts           # tick sur :3567
~/.local/bin/spacetime start --listen-addr 0.0.0.0:3000                 # puis spacetime publish heirline-essai --server local
cd ~/heirline/essais && npx tsx lagproxy.ts 2667 2567 120 2 & npx tsx lagproxy.ts 3100 3000 120 2 &
cd ~/heirline/essais/client && npx vite --host 0.0.0.0 --port 5180
# banc
cd ~/heirline/essais && python3 banc.py 20 colyseus stdbq stdb          # NUC=1 pour lancer les bots sur le NUC
```
