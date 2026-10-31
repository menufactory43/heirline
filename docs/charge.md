# La capacité de charge (mesurée le 31 octobre 2026)

Banc à part : port 2794, base jetable (`/tmp/hl-audit/charge.db`), `HEIRLINE_COPIE_MAX=100`. Ni le 2700 ni la vraie base
n'ont été touchés. Les clients sont de vrais clients Colyseus (le SDK du jeu), répartis dans des processus ouvriers de
75 clients sur le Mac (10 cœurs ; charge moyenne du Mac autour de 4,6 : les clients ne sont pas le facteur limitant).

```
npx tsx tools/charge-complete.ts http://127.0.0.1:2794 <pid du serveur> 50,100,200,400 60
FUITE_MIN=15 npx tsx tools/charge-complete.ts http://127.0.0.1:2794 <pid> 400 60   # + suivi mémoire 15 min
```

Ce que font les clients :

- **raid** : les 10 premiers forment un groupe et entrent dans l'offensive du Semeur (raid à 10) ;
- **continent** (60 %) : marche, tir et ruées sur Ossara et ses copies ;
- **monorail** (10 %) : des trajets entre gares ;
- **arène** (10 %) : le nid, l'Antre et le Gosier ;
- **social** (10 %) : discussion locale, de groupe et monde, invitations de groupe, échanges ;
- **marche** (10 %) : la marche seule.

## Paliers

Pour lire le tableau :

- **CPU** : % d'un cœur, moyenne sur le palier. Node exécute la simulation sur un seul fil.
- **Pas p99** : la durée d'un pas de salle, 99e centile.
- **Boucle p99** : le retard de la boucle d'événements. Au-delà de 50 ms, les ticks de 50 ms prennent du retard.
- **ko/client/s** : les octets reçus par client et par seconde.

Avant l'optimisation :

| Clients | CPU | Mémoire | Pas p99 | Boucle p99 | ko/client/s | Erreurs | Déconnexions |
|---|---|---|---|---|---|---|---|
| 50 | 28 % | 327 Mo | 7,9 ms | 17 ms | 4,3 | 0 | 0 |
| 100 | 34 % | 328 Mo | 12,5 ms | 21 ms | 7,5 | 0 | 0 |
| 200 | 36 % | 329 Mo | 7,5 ms | 18 ms | 8,4 | 1 | 0 |
| 400 | 62 % | 395 Mo | 6,8 ms | 19 ms | 8,4 | 0 | 0 |
| 600 | 94 % | 484 Mo | 7,2 ms | 26 ms | 6,3 | 0 | 0 |
| 800 | 109 % | 520 Mo | 7,6 ms | **81 ms** | 5,7 | 1 | 0 |
| 1000 | 107 % | 473 Mo | 7,4 ms | 240 ms | 4,5 | 1 | 0 |
| 1200 | 107 % | 513 Mo | 6,7 ms | 353 ms | 4,0 | 1 | 0 |

Après l'optimisation (le tri grossier des balles, plus bas) :

| Clients | CPU | Mémoire | Pas p99 | Boucle p99 | ko/client/s | Erreurs | Déconnexions |
|---|---|---|---|---|---|---|---|
| 800 | 106 % | 505 Mo | 6,2 ms | **43 ms** | 5,8 | 0 | 0 |
| 1000 | 108 % | 547 Mo | 6,3 ms | 116 ms | 5,1 | 0 | 0 |

Salles ouvertes à 400 clients : 4 copies d'Ossara, 3 nids, 4 Antres, 3 Gosiers et 1 raid. À 1 000 clients : 10, 7, 8, 8
et 1. La connexion de 1 000 clients prend 7 s, contre 63 s pour 1 200 avant l'optimisation.

## Le point de rupture

- **Avant :** autour de **700 clients** par processus Node. À 800 clients, la boucle dépasse 50 ms au p99 : le fil
  unique est plein (CPU au-dessus de 100 %, en comptant le GC et les entrées-sorties). Personne n'est déconnecté, mais
  les ticks arrivent en retard et le jeu saccade.
- **Après l'optimisation :** autour de **850 à 900 clients**. 800 clients passent sous les 50 ms, 1 000 ne passent pas.

Le pas d'une salle reste court (p99 de 6 à 8 ms) : la limite ne vient pas d'une salle trop chargée. Elle vient du nombre
total de salles et de clients sur un seul fil.

## Ce qui coûte (profil CPU à 800 clients, avant)

| Part du temps | Où |
|---|---|
| 42,6 % | `World.ts`, dont `step` 16,6 %, `stepBullets` 11 %, `distToSeg` 5,1 %, `targetsNear` 3,4 % |
| 12,5 % | `@colyseus/schema` (encodage de l'état) |
| 10,4 % | `GameRoom` |
| 9,5 % | `writev` (envoi réseau) |
| 4,3 % | GC |

Optimisation faite : pour chaque balle, `stepBullets` calculait la position passée de **toutes** les créatures (retour en
arrière de 400 ms), puis leur distance au trajet. Il fait maintenant un tri grossier d'abord : il saute les créatures
trop loin du trajet pour l'atteindre, même avec le retour en arrière. La liste des créatures n'est plus recopiée pour
chaque balle. Effet : `World.ts` passe de 42,6 % à 28,5 % du temps, le fil est inactif 10 % du temps au lieu de 2,6 %,
et le p99 de la boucle à 800 clients tombe de 81 à 43 ms.

Pistes suivantes, non faites :

1. Plusieurs processus. Colyseus sait répartir les salles avec un « presence » Redis. C'est la seule voie au-delà de
   1 000 joueurs.
2. Moins de champs synchronisés pour les créatures loin de tous les joueurs (`@colyseus/schema` et `writev` font 22 %).
3. `targetsNear` : une grille spatiale au lieu d'un parcours complet.

## Fuite de mémoire

400 clients pendant 15 minutes, après une minute de palier (CPU 56 %, boucle p99 21 ms) : la mémoire du serveur passe de
434 à 437 Mo, relevée toutes les 30 s. Elle reste plate, donc pas de fuite visible. Aucune déconnexion. 13 erreurs
côté clients en 16 minutes, toutes des connexions refusées (code 4002, « choisir une classe ») : un bot dont le soldat
est mort pour de bon change de salle sans choisir d'héritier. Le serveur refuse comme prévu : ce n'est pas une panne.
