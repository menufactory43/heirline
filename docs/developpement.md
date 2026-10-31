# Heirline — guide de développement

MMO de tir en 2D (pixel art fait par le code), en monde ouvert : Ossara, un continent de 400 × 400 tuiles, Port-Ancre sur la côte sud et ses
habitants, ÉDEN qui pousse en ruches (le front est la bordure de leurs taches), l'épave de la Constance, le nid en instance de groupe,
un monorail à réparer, des quêtes avec un vrai choix, une lignée et un robot qui sert aussi de monture.
TypeScript · Phaser 4 (client) · Colyseus 0.18 (serveur autoritaire, WebSocket) · SQLite (`node:sqlite`) · MCP (Streamable HTTP).

## Lancer

```sh
npm install
npm start                # construit le client (dist/) puis lance le serveur sur 0.0.0.0:2700
npm run dev              # développement : serveur (tsx watch, 2700) + Vite (5190, proxy vers 2700)
```

Le serveur sert le jeu, l'API et le MCP sur le même port. Sur le réseau local : `http://<adresse-du-mac>:2700`. En public : https://heirline.praxeongames.com (tunnel Cloudflare nommé, voir plus bas).
Variables : `PORT` (2700), `HEIRLINE_DB` (data/heirline.db), `FRONT_RATE` (tuiles/s, 0.02), `OUTPOST_MS` (durée d'un avant-poste),
`BOTS` (n soldats IA de charge dans le secteur), `DAY_S` (durée d'une journée d'Ossara en secondes, 1440), `HEIRLINE_DEBUG=<code>` (active le message `tp`, pour les captures et bancs ; jamais en vrai),
`HEIRLINE_COPIE_MAX` (joueurs par copie d'une carte avant d'en ouvrir une autre, 200), `HEIRLINE_TEST=<code>` (bouton « Test : aller voir un boss »).
Au premier lancement sur une ancienne base, `server/migration.ts` passe le monde en version 2 (lignées, morts et niveaux gardés ; robots
plantés en avant-poste rendus à l'atelier ; l'ancien front effacé).

Accès public : un tunnel Cloudflare nommé (`~/.cloudflared/heirline.yml`) envoie https://heirline.praxeongames.com vers 127.0.0.1:2700. Le serveur et le tunnel tournent en LaunchAgents (`com.praxeon.heirline.serveur`, lancé par `tools/serveur.sh`, et `com.praxeon.heirline.tunnel`). Par le tunnel, personne n’est « local » : les outils de test demandent le code.

## Jouer

Sur iPhone : ouvrir l'URL dans Safari, **en paysage** (Partager → Sur l'écran d'accueil pour le plein écran).
Pouce gauche n'importe où sur la moitié gauche = bouger ; pouce droit sur la droite = viser, et tirer en poussant au-delà d'un tiers.
Boutons : 2 compétences, Esquive (la ruée, prédite côté client), Robot (suis / tiens la position), Monture (après la quête « La selle »
de Joss, niveau 3 : ×1,6 en vitesse, on descend dès qu'on est touché, qu'on tire ou qu'on lance une compétence). Un bouton d'action apparaît près d'un
habitant (parler), d'une ressource (cueillir, fouiller une épave), d'une lampe ou d'une balise en panne (réparer), de l'Atelier, de la Porte des
concessions, du Tableau des morts, des gares du monorail, des passages (sas de la Constance, Gueule du nid) et de l'avant-poste de son ancêtre. En haut à droite : Sac, Journal, Carte, ☰ (clé d'API, lignée, morts,
visée assistée).

Clavier : ZQSD/WASD, souris pour viser et tirer, A/Q et E compétences, Espace ruée, R robot, F parler/action, I sac, J journal, M carte, Échap.

Le monde : un continent entouré de mer et de falaises, des régions décrites en données (`shared/monde.ts`, `shared/map.ts`) — Plaines de la
côte (niv. 1–4, Port-Ancre, la ferme des Aldo), Forêt des Fougères à l'ouest, Marais de la Sève à l'est (la Casse, l'Engloutisseur),
Plateaux de Basalte au centre (le Relais du Col, le Bastion), Cimetière des Machines au nord-ouest (l'épave de la Constance, une carte à
part avec sa passerelle et une salle scellée), Terres d'ÉDEN au nord-est (la Grande Ruche, le Jardin, la Gueule du nid). Cinq ruches
répandent la biomasse ; le nid est une instance de 4 joueurs. Chaque carte s'ouvre en copies au-delà du seuil ; l'heure, la météo, les
ruches et les avant-postes sont communs à toutes (`server/central.ts`). Six gares de monorail : seule celle de Port-Ancre marche, les
autres se réparent (pièces + ferraille) puis restent ouvertes pour tous. Trente-quatre habitants vivent leur journée (travail, cantine le soir, lit la nuit), les gardes patrouillent et tirent ;
jour, nuit, pluie et brume. « ! » jaune : une quête à prendre ; « ? » gris : une quête en cours ; « ? » jaune : une quête à rendre. 34 quêtes, dont la campagne 1, « La côte de Port-Ancre »
(`docs/histoire.md` § 6), en trois actes : la colonie (jusqu'au choix : livrer Haute-Sève au Corps colonial ou la taire, puis le code
dans les spores), la Première Vague (le Tertre, Cantor, les cœurs de données, l'épave de la Constance ouverte par Maëlle Sève ou par Cantor
selon le choix, le journal de Varga) et le Semeur (sa voix, les ruches, le modèle, le nid, son offensive, dont la fin dépend du front de tout
le serveur et du choix de la lignée). Les habitants s'en souviennent, et le journal montre ce qu'ont choisi les autres lignées. Les journaux,
cœurs de données, stèles et plaques se lisent sur place (bouton d'action) et restent au journal (`shared/journaux.ts`, `docs/journaux.md`).
Les PNJ parlent des ancêtres morts du joueur, Cantor chante les noms des vrais morts du serveur, Odile raconte les exploits.
Quelques clins d'œil, à trouver (`docs/histoire.md` § 8). Butin à raretés (commun → épique), marchands qui achètent et vendent contre de la ferraille.

Règles de mort : derrière le front, à terre puis évacuation (le sac de ferraille est perdu) ; au-delà du front et au nid, à terre 8 s puis
**mort définitive** : le robot se plante en avant-poste (il retient le front), l'héritier de la famille prend la relève à la moitié du niveau
et doit aller chercher le robot. Déconnexion : jamais de mort définitive, et le sac est gardé. Concessions : jamais de mort définitive.
Le sac d'objets (équipement, matériaux) n'est jamais perdu à l'évacuation ; seule la ferraille transportée l'est.

## Brancher un agent IA

En jeu : ☰ → Clé d'API → Créer une clé. Le jeu affiche la commande, par exemple :

```sh
claude mcp add --transport http heirline https://heirline.praxeongames.com/mcp --header "Authorization: Bearer hl_..."
```

Outils : `heirline_front` (les ruches et la bordure), `heirline_cartes` (le graphe des cartes et leurs copies), `heirline_moi`, `heirline_briques` (catalogue + limites + schéma JSON), `heirline_concessions_lister`,
`heirline_concession_lire`, `heirline_concession_publier` (création ou nouvelle version, en direct), `heirline_concession_revenir`,
`heirline_monde` (heure, météo, régions, lieux, front, boss), `heirline_quetes` (les quêtes du joueur : en cours, faites, disponibles et où ; l'acte et le prochain pas de la campagne ; les textes déjà lus),
`heirline_pnj` (les habitants, où ils sont et ce qu'ils font, filtrables par lieu).
Le serveur valide (schéma fermé zod, briques fermées, budget de puissance, budget technique, filtre de texte, 12 publications/heure,
60 requêtes/minute), fait jouer deux soldats IA pour mesurer la difficulté et fixe lui-même la récompense (plafond de 300 ferraille/jour/joueur).
Même chose en REST avec la même clé : `GET /api/agent/front|moi|briques|monde|quetes|pnj|concessions[/:id]`, `POST /api/agent/concessions`,
`POST /api/agent/concessions/:id/retour`.

Exemple de concession : `tests/exemple.ts`. Essai de bout en bout d'un vrai client MCP : `npx tsx tests/mcp-essai.ts <URL>`.

## Vérifier

```sh
npm run typecheck
npm test                                              # règles, concessions, mort et ruches, relève ; monde ouvert : quêtes, choix,
                                                      # sac et marchands, habitants, gardes, ruée prédite ; monde v2 (tests/monde.test.ts :
                                                      # graphe, copies, service central, migration, monture) ; l'histoire (tests/histoire.test.ts :
                                                      # la campagne jouée par un soldat de test sur les deux voies, migration de la trame,
                                                      # lectures et clins d'œil, rien dans les maisons) et réseau de bout en bout
                                                      # (tests/reseau.test.ts : lance son propre serveur sur 2791)
HEIRLINE_DEBUG=<code> npx tsx tests/charge.ts http://127.0.0.1:2792 60 60 <pid-serveur>   # N clients WebSocket, sur un serveur
                                                      # de banc lancé avec HEIRLINE_DEBUG=<code> et sa propre base, jamais celui du jeu
npx tsx tools/carte-png.ts /tmp/carte.png             # la carte en PNG (2 px par tuile), et vérifie que chaque habitant peut aller à ses postes
```

## Organisation

- `shared/` : constantes, le monde (`map.ts` : régions, bâtiments, camps, ressources, généré par graine ; `monde.ts` : cartes, passages,
  gares, monture ; `front.ts` : les ruches), règles et créatures, front,
  objets (`items.ts`), habitants (`npcs.ts`), quêtes (`quests.ts`), textes à lire (`journaux.ts`), chemins (`path.ts`), briques des concessions — mêmes nombres côté client et serveur.
- `server/` : `main.ts` (Colyseus + Express + MCP), `central.ts` (service commun aux copies), `migration.ts`, `rooms/` (GameRoom, Secteur, ConcessionRoom), `world/` (simulation pure, bots, `Vie.ts` : heure, météo, habitants), `ossara.ts` (quêtes, dialogues, lectures, butin, sac, marchands), `db.ts`, `agents.ts`, `measure.ts`.
- `client/` : `pixel.ts` et `pixel2.ts` (toutes les images, dessinées par le code), `scene.ts` (monde en morceaux de 32 × 32 tuiles, toits
  qui s'effacent, habitants, bulles, nuit, pluie, brume et lumières), `net.ts` (prédiction et
  réconciliation), `controls.ts`, `ui.ts` (thème : cadres 9-slice dessinés par le code, minicarte CRT), `icones.ts` (icônes 16 × 16),
  `main.ts`. La police pixel Pochoir (`client/public/pochoir.woff2`) sort de `tools/police-pixel.py`.
- `captures/` : captures en taille iPhone paysage (`captures/v2/` pour le monde v2 et la nouvelle interface, `captures/carte-continent.png`).
