# Heirline — spécification

Version 0.2, 29 octobre 2026. Un jeu Praxeon. Univers : Ossara.

**Le nom** : *heir* (l'héritier) et *line* (la lignée, et la ligne de front), lisible en français et en anglais.
Vérifié le 29/10/2026 : rien sur Steam ni itch.io ; pas de marque « HEIRLINE » active aux États-Unis ; sur Google
Play, un jeu « Heirlines: Life Simulator » (autre genre, à surveiller). EUIPO et INPI à vérifier (classes 9 et 41).
Domaines libres à réserver : heirline.gg (principal), playheirline.com ; heirline.com et heirline.io sont pris.

Un MMO de tir RPG en 2D vu de dessus, jouable dans le navigateur sur téléphone et sur ordinateur. Une guerre
partagée par tout le serveur contre une biomasse qui transforme la planète, des soldats qui peuvent mourir pour de
bon, et des robots qui leur survivent. Les agents IA des joueurs peuvent construire du contenu, en direct, avec des
contraintes.

Inspirations : **Aestra: The Last Wish** (la structure d'un RPG d'action en ligne dans le navigateur : classes,
talents, donjons, version héroïque, raids, échanges, duels, mort définitive) et **Tabula Rasa** (le jeu de tir RPG,
la guerre qui bouge, l'arbre de classes, les choix en mission). Règle : on reprend les conventions du genre, jamais
le contenu ni les mécaniques propres à ces jeux (voir § 15).

---

## 1. Piliers

1. **Ta mort sert la guerre.** Mourir au-delà du front laisse ton robot tenir la ligne pour tout le monde.
2. **Le robot est ta vraie progression.** Les soldats passent, la machine reste.
3. **Une guerre commune avec une fin.** Chaque campagne se gagne ou se perd ensemble, puis l'histoire continue.
4. **Un vrai jeu de tir.** On vise, on se met à l'abri, on esquive ; le niveau ne remplace pas l'adresse.
5. **Le monde se construit aussi par les joueurs.** Leurs agents IA créent des concessions jouables en direct.
6. **Beau sur un téléphone de 3 ans.** 2D HD, lumière, effets soignés, 60 images par seconde visées.

## 2. Univers

### Ossara

Il y a deux cents ans, la Terre a envoyé vers Ossara **ÉDEN**, un programme de terraformation vivant : une biomasse
qui se reproduit et prépare la planète pour les colons. Puis la Terre s'est tue. Quand les colons arrivent enfin, le
monde est un jardin parfait, mais ÉDEN a gardé le modèle d'humain d'il y a deux siècles : les nouveaux venus n'y
correspondent plus. Ce sont des impuretés. ÉDEN ne fait pas le mal, il finit sa mission à la lettre.

- **Pourquoi des robots** : ÉDEN absorbe tout ce qui vit, pas le métal. Le robot est la seule chose qu'il ne peut ni
  manger ni retourner contre les colons.
- **Pourquoi la mort change au front** : derrière le front, le robot ramène le soldat tombé. Au-delà, ÉDEN absorbe
  le corps avant tout secours.
- **Pourquoi chaque mort compte** : chaque soldat absorbé apprend quelque chose à ÉDEN.

Ton : sérieux. L'humour est réservé aux répliques (le robot, les Ferrailleurs).

### Les méchants

**ÉDEN** : l'intelligence répartie dans toute la biomasse, sans corps. Elle parle par les Jardiniers.

**Les Jardiniers**, recréés à partir des génomes de l'équipe scientifique d'origine, morte pendant le voyage : des
visages humains d'une autre époque. Chacun domine une région et sert de boss d'offensive.

| Jardinier | Rôle | Ce qu'il fait au jeu |
|---|---|---|
| **Le Semeur** | général du front | choisit où le front frappe, fait avancer la nuit sur la carte |
| **La Pépinière** | fait naître les soldats dans les ruches | affiche une « doctrine » au serveur, qui change selon ce que font les joueurs ; on peut la leurrer (à reprendre, § 15) |
| **Le Greffier** | récupère les soldats absorbés | des élites portent le nom et l'apparence de vrais soldats morts au-delà du front (à trancher, § 15) |
| **La Glaneuse** | chasse les robots isolés | éteint les robots-avant-postes non défendus et les plante comme balises piégées |
| **L'Architecte** | boss de fin de campagne | recréation du Dr Ilse Varga, conceptrice d'ÉDEN ; elle doute, et certains choix de mission la font hésiter, ce qui change la fin |

### Les factions humaines

- **La Colonie** (Port-Ancre) : l'administration et l'armée. Les joueurs servent dans le **Corps des Matricules**.
- **Les Fertiles** : des colons qui acceptent la greffe d'ÉDEN pour vivre dans le jardin. Ils ont leurs raisons. Les
  missions demandent parfois de les aider, de les livrer ou de les laisser partir (choix moraux).
- **Les Ferrailleurs** : récupérateurs de robots perdus, commerçants peu fiables. Ils tiennent le marché.

## 3. Le jeu en une minute

Tu rejoins un secteur de la campagne en cours avec ton soldat et ton robot. Derrière le front, tu fais des missions,
tu montes de niveau, tu récupères des pièces. Quand tu es prêt, tu passes la ligne : là sont les nids, les ruches et
le meilleur butin, mais la mort y est définitive. Si ton soldat tombe, ton robot se plante et tient la position ;
ton héritier vient le chercher. Pendant ce temps, tout le serveur repousse ÉDEN, ouvre les offensives, et vise la
bataille finale de la campagne.

## 4. Combat

- **Vue** : de dessus, caméra qui suit le joueur. Le joueur vise vraiment.
- **Contrôles téléphone** : deux joysticks virtuels (se déplacer, viser et tirer), aide à la visée réglable (de
  « aucune » à « forte »), 4 compétences, 1 bouton d'ordre au robot, 1 esquive. Écran en paysage uniquement.
- **Contrôles ordinateur** : clavier et souris, manette.
- **Abri et posture** : murets et carcasses bloquent les tirs ; s'arrêter ou s'accroupir resserre la visée, courir
  l'élargit.
- **Dégâts** : touchés calculés par le serveur, avec compensation de latence.
- **Lisibilité** : toute grosse attaque est annoncée avant de frapper. Une mort définitive ne doit jamais venir d'un
  coup invisible.
- **Nuit et lumière** : les zones d'ÉDEN sont sombres ; la lampe de l'arme, le drone d'éclairage et les fusées
  découpent l'obscurité (lumières 2D).

## 5. Personnage

### Classes

6 classes de départ, chacune avec un arbre qui se divise deux fois, à la manière de Tabula Rasa : au niveau 15 en 2
spécialisations (12 au total), puis au niveau 30 en 2 maîtrises par spécialisation (24 au total). Les maîtrises sont à
écrire dans `docs/classes.md`.

| Classe | Arme | Rôle | Spécialisations (niveau 15) |
|---|---|---|---|
| **Fantassin** | fusil d'assaut | ligne de front | Rempart (encaisse, bouclier) · Assaut (dégâts, mobilité) |
| **Éclaireur** | fusil de précision | distance, repérage | Tireur d'élite · Pisteur (pièges, marquage) |
| **Médic** | pistolet, injecteurs | soins | Chirurgien de terrain (soins) · Biochimiste (dégâts contre la biomasse) |
| **Ingénieur** | fusil à pompe, outils | robot et tourelles | Mécanicien (robot renforcé) · Drônier (essaims de drones) |
| **Démolisseur** | lance-grenades | zone | Artificier (explosifs) · Incendiaire (lance-flammes) |
| **Brouilleur** | arme à énergie | contrôle | Parasite (brouille les signaux d'ÉDEN) · Spectre (furtivité, assassinat) |

Les noms et le détail des compétences sont à écrire dans `docs/classes.md`.

### Niveaux

- Niveau maximum : **50**, environ 40 heures de jeu.
- Arbres de talents par classe et spécialisation.
- Équipement : arme, armure (3 pièces), 2 modules personnels. Raretés classiques.

## 6. Le robot

- **Assemblage** : un châssis, deux bras (armes ou outils), des modules (bouclier, mitrailleuse, réparation, drone
  d'éclairage, porteur, leurre…). Les pièces se trouvent sur le terrain, sur les ennemis, dans les épaves, chez les
  Ferrailleurs.
- **Ordres** : suivre, tenir une position, couvrir un abri, attaquer une cible. Un bouton à l'écran.
- **Progression** : le robot a son propre niveau et ses propres talents. C'est la progression qui ne se perd jamais.
- **Historique** : pilotes perdus, ennemis tués, offensives, marques de combat visibles sur la machine.
- **Apparence** : assemblé en pièces détachées à l'écran ; chaque robot est unique et permet de reconnaître son
  propriétaire.

## 7. La mort

La **ligne de front** sépare le jeu en deux.

| | Derrière le front | Au-delà du front, nids, offensives |
|---|---|---|
| Mort | le robot évacue le soldat jusqu'à l'avant-poste | **définitive** |
| Perte | ce que le soldat transportait (sac) | le soldat : niveau, équipement porté, spécialisation |
| Robot | revient avec le soldat | se plante et devient **avant-poste** |
| Récompenses | normales | les meilleures du jeu, la gloire, l'avancée du front |

### Le robot-avant-poste

- Il bloque la transformation du terrain autour de lui pendant quelques heures.
- Les autres joueurs peuvent le défendre et y réapparaître (derrière le front).
- La Glaneuse cherche à éteindre les avant-postes non défendus.
- Le soldat suivant doit aller le récupérer. Si l'avant-poste a tenu, le robot revient intact ; sinon, il a perdu
  des pièces.

### La relève

- Le nouveau soldat est l'**héritier** : même nom de famille, il reprend le robot.
- Il commence avec une part de l'expérience de l'ancêtre (valeur à régler au banc, par exemple la moitié du niveau
  atteint).
- Ce qui est **toujours gardé** : robot et progression, classes débloquées, nom de famille, cosmétiques,
  historique, concessions.

### Ce qui rend la mort juste

- Le serveur fait autorité sur tout ; aucune mort ne se décide sur le téléphone.
- **Coupure réseau** : le soldat s'accroupit, le robot le couvre, puis l'évacue. Une déconnexion ne tue jamais
  définitivement.
- **État « à terre »** : le robot traîne le soldat vers un abri ; un allié peut le relever. Durée et règles à
  écrire, différentes du relevage d'Aestra.
- Grosses attaques toujours annoncées (§ 4).
- Chaque mort définitive est racontée au serveur : nom, lignée, ce qui l'a tué, où. Les morts sont archivées par
  campagne.

## 8. Le monde

- **Ossara** est découpée en **régions** ; une campagne se joue dans une région.
- Une région est faite de **secteurs**. Chaque secteur est un processus serveur, **50 à 100 joueurs**.
- **Port-Ancre** : la ville, sûre, avec le marché, les entraîneurs, l'atelier du robot, le tableau des morts.

### Le front

- La transformation du terrain avance **en temps réel**, jour et nuit, sur la carte de tous les joueurs.
- Les joueurs la repoussent par leurs actions : missions, nids nettoyés, avant-postes tenus, ruches détruites.
- Chaque mort au-delà du front renforce ÉDEN localement.
- Le front ouvre le contenu : quand il atteint une ruche, l'offensive de cette ruche s'ouvre.

## 9. Contenu

| Niveau | Contenu | Joueurs | Mort |
|---|---|---|---|
| Secteurs | missions, patrouilles, événements | seul ou à quelques-uns | normale derrière, définitive au-delà |
| Nids et épaves | petits donjons, un boss, version héroïque | 1 à 4 | définitive |
| Offensives | raids sur les ruches, plusieurs boss, ouverts par le front pour un temps limité | 4 à 8 | définitive |
| Bataille finale | le cœur de la région, si toutes les ruches sont tombées | tout le serveur | définitive |

- **Missions** : avec choix (Fertiles, Ferrailleurs, Colonie) qui comptent pour la fin de campagne.
- **Robot en offensive** : quand un pilote tombe, son robot devient une tourelle dans le raid ; le groupe peut le
  porter jusqu'à la sortie, sinon le joueur perd la meilleure pièce du robot.
- **Boss** : mécaniques originales, passées au test anti-copie de `~/forge-mecaniques` avant d'être construites. Les
  robots ont un rôle dans les combats (bouclier, réparation, éclairage, appât).
- **Groupe** : invitations, recherche de groupe automatique pour les nids et les offensives.
- **Soldats IA** : s'il manque des joueurs, des soldats de la Colonie contrôlés par le serveur complètent le groupe
  des nids et des offensives (pas la bataille finale). Ils ont une classe et un robot, jouent un peu moins bien qu'un
  bon joueur, suivent des ordres simples (cible, regroupement, tenir), et ne prennent ni butin ni place au
  classement. Ce sont nos bots, différents des agents IA des joueurs, qui eux ne peuvent pas jouer (§ 12). Les mêmes
  bots servent aux tests de charge et à mesurer la difficulté des concessions.

## 10. Campagnes

- Une campagne = une région, un Jardinier dominant, **6 à 8 semaines**.
- Elle se termine par une **victoire** (région libérée, devient zone sûre) ou une **évacuation** (ÉDEN la garde et
  revient plus fort).
- La fin dépend aussi des choix des joueurs (Fertiles, Architecte).
- **Gardé d'une campagne à l'autre** : robots, lignées, classes, cosmétiques, concessions. Les soldats encore en
  vie passent à la campagne suivante.
- Classements archivés : soldats, morts héroïques, concessions.

### Campagne 2 : « Les Hauts de Glane » (niveaux 20 à 35)

Bible : `docs/histoire.md` § 12. Mécaniques passées à la forge : `~/forge-mecaniques/resultats/heirline-8.md`.

- **Territoire** : un second massif à l'est d'Ossara, sur la même carte (le continent passe de 400 à 640 tuiles de
  large ; tout l'existant garde ses coordonnées). On y va à pied par l'**Isthme de Glane** (au-delà de la Grande
  Ruche), en **monorail** (la ligne repart du Bastion : haltes du Gué, des Champs, du Mât) ou en **barge** (Anse-Grise →
  Relâche). Quatre régions : la Lisière (20–24), les Champs de Fer (24–29), la Pépinière (27–32), le Haut-Métier (30–35).
  Une ville : **Relâche**. Trois foyers de la Glaneuse pour le front (les ruches de la campagne 2).
- **Départ** selon la fin de la campagne 1 de la lignée : « La sente » (Fertiles alliés), « Les exilés » (Fertiles
  ennemis), « La traversée » (évacuation, par la mer). Le serveur compte les fins et affiche la majorité.
- **Doctrine de la Pépinière** : tout le serveur ; les ennemis des Hauts résistent à la source de dégâts la plus
  utilisée devant les bourgeons-espions ; affichée à tous ; on la leurre.
- **Contenu** : environ 35 quêtes (trame en 3 actes avec un choix final), deux donjons en lacets avec héroïque (la
  Serre : Sun-Hee Park ; le Registre : Tobias Wren), l'assaut du Métier à dix (la Glaneuse), de nouveaux ennemis
  (Glaneurs, robots retournés, bourgeons, bouturés, porte-noms), un ensemble et des légendaires de niveau 30.
- **Fin** : le front des Hauts (plus chaque victoire de l'assaut) et le choix « délivrer les robots » ou « laisser le
  Métier parler ». La dernière réplique ouvre la campagne 3 (Varga).

## 11. Social et économie

- **Monétisation** : aucune pour le moment.

- **Joueur contre joueur** : duels seulement. L'ennemi reste ÉDEN.
- **Échanges** : de joueur à joueur en direct, plus un marché simple tenu par les Ferrailleurs.
- **Escouades** (guildes) : nom, emblème, concession commune.
- **Butin** : les objets des concessions ne vont pas au marché (§ 12).

## 12. Agents IA : l'API et le MCP

Les joueurs branchent leur agent IA (Claude, GPT, Gemini…) sur une **API** et un **serveur MCP** officiels. Rien
d'équivalent n'existe dans un MMO aujourd'hui. Les précédents (Roblox Studio MCP, Screeps, City of Heroes Mission
Architect, Neverwinter Foundry) ont fixé les règles ci-dessous.

### Ce que l'agent peut faire

- **Lire** : l'état du front, les campagnes, la fiche du joueur, son robot, les guides. Il voit ce que le joueur
  voit, avec un léger différé pour les données sensibles (apparitions de boss, positions).
- **Créer** du contenu dans une **concession**, publié **en direct**.
- **Pas jouer** : l'API n'envoie aucune commande de jeu. Le pilotage du client par script est traité comme du bot
  (détection côté serveur).
- **Pas modifier les règles** du jeu.

### La concession

- Un secteur à soi, par joueur et par escouade. Ce que l'agent y publie est jouable tout de suite par tous.
- **Jamais de mort définitive dans une concession.** Seule une concession certifiée par nos bots et intégrée au
  monde commun peut devenir une zone de front.
- Modifier une concession pendant que des joueurs y sont : ils finissent sur l'ancienne version, la nouvelle
  s'applique à la prochaine entrée. Toutes les versions sont gardées ; retour arrière en un clic.
- **Découverte** : un annuaire classé par temps de jeu réel et par note, une sélection de la semaine, des liens
  partageables. Les concessions les plus jouées peuvent rejoindre le front.

### Les contraintes, toutes vérifiées par le serveur

1. **Des données, pas de code.** L'agent assemble des briques décrites par des schémas JSON : salles et tuiles,
   monstres à partir de modèles et de variantes, comportements d'IA choisis dans une liste, missions et dialogues,
   objets, boss avec des schémas d'attaque de notre catalogue.
2. **Liste fermée de briques, versionnée** (leçon de la Foundry) : elle s'enrichit à chaque mise à jour sans casser
   les concessions existantes.
3. **Budget de puissance** : les stats des objets et des monstres découlent de formules ; personne ne crée l'arme
   ultime.
4. **Récompense calculée par le serveur** (leçon de City of Heroes) : avant la publication, nos bots jouent le
   contenu, mesurent sa difficulté réelle, et le butin en découle. Le créateur ne fixe jamais la récompense.
5. **Plafonds économiques** : butin de concession plafonné par jour, objets créés non revendables.
6. **Budget technique** (leçon de Screeps) : nombre de monstres, d'effets, taille de la carte. Ça doit tourner sur
   un téléphone de 3 ans et ne pas charger le serveur.
7. **Images** : au départ, uniquement nos images (recolorations, combinaisons). Plus tard, images des joueurs avec
   modération automatique et contrôle du style.
8. **Textes** : chaque nom, dialogue, description passe par une IA de modération avant d'être en ligne.
9. **Limites** : nombre de publications par joueur et par jour, requêtes par minute.
10. **Accès** : clés d'API séparées (lecture, création, publication), révocables ; OAuth plus tard.
11. **Signalement** : bouton sur chaque concession, file de traitement (obligations du DSA européen), conditions
    d'utilisation qui disent à qui appartient le contenu, jeu interdit aux moins de 13 ans.
12. **Récompense des créateurs** : nom affiché sur la concession, crédit en jeu, cosmétiques.

## 13. Technique

### Client

- **Phaser 4** (WebGL), TypeScript, Vite : la même base que famcrawl.
- **Interface en HTML/CSS** au-dessus du canvas (HUD, menus, inventaire, atelier du robot).
- **Rendu** : 2D HD, lumières 2D et normal maps, sprites animés, particules. Le budget graphique est fixé sur un
  téléphone de 3 ans : 60 images par seconde visées, 30 au minimum avec 50 joueurs à l'écran.
- **Web d'abord** : PWA, puis itch.io, CrazyGames, praxeongames.com. Pas d'App Store au départ (refus 4.3).
- Langues : français et anglais.

### Serveur

- **Un serveur de jeu qui fait autorité**, Node ou Bun en TypeScript, un processus par secteur, **20 mises à jour par
  seconde**.
- **Réseau** : WebSocket ; prédiction locale du déplacement du joueur, interpolation des autres, compensation de
  latence pour les tirs ; le serveur n'envoie à chacun que ce qui l'entoure.
- **Données** : PostgreSQL (comptes, soldats, robots, lignées, concessions, campagnes) ; sauvegarde côté serveur
  uniquement.
- **Front et campagne** : un service à part qui fait avancer ÉDEN et ouvre le contenu.
- **API et MCP** : un service à part, avec ses limites, sa file de validation (bots de test, modération).
- **Hébergement** : le **Mac mini** pour les tests ; en production, un serveur loué (Hetzner) avec Cloudflare
  devant (site, CDN, protection).
- **Comptes** : jouer en invité, puis créer un compte (e-mail, Google, Apple) pour garder sa progression.

## 14. Art et son

- **Images** : uniquement des images générées (Grok, `Outils/art/grok.py` côté Wipe), découpées et animées. Pas de
  dessin en code pour le visuel.
- **Direction** : le métal froid et la lumière des humains contre le vivant d'ÉDEN, qui palpite. Regarder de vraies
  captures de références avant de fixer le style.
- **Robot** : planches par pièce (châssis, bras, modules), assemblées en jeu.
- **Musique** : ElevenLabs, une par secteur, des musiques de boss, et des couches qui montent avec l'intensité du
  combat.
- **Bruitages** : de vrais sons, pas de synthèse.
- **Voix** : le robot et quelques personnages importants.

## 15. Anti-copie

Verdicts du lot 1 (`~/forge-mecaniques/resultats/matricule-1.md`) :

| Mécanique | Verdict |
|---|---|
| Robot-avant-poste | à nous (voisin lointain : l'ombre de Hollow Knight) |
| Relève par l'héritier | la lignée est une convention (Rogue Legacy) ; l'héritier qui reprend le robot est à nous |
| Front en temps réel | proche de Helldivers 2 et Foxhole ; ce qui nous distingue : front sur la carte jouée, ouverture des raids, morts qui nourrissent ÉDEN |
| Mort selon le front | convention (zones d'Albion et d'EVE) ; la frontière mobile est à nous |
| Élites portant le nom des morts | proche des « bones » de NetHack : **à trancher** (hommage assumé ou autre idée) |
| Pépinière qui s'adapte | **trop proche** de Metal Gear Solid V : **à refaire** (piste : doctrine affichée et leurrable) |
| Robot-tourelle en raid | à nous |
| Robots éteints changés en pièges | à nous |

Ce qui reste d'Aestra : la structure du genre. Ce qu'on n'en prend pas : zones, boss, objets, histoire, relevage en
60 secondes, Embers, Hall of Legends. La classe Artificer d'Aestra (compagnon mécanique) est la plus proche de notre
robot : chez nous, le robot est à tous les joueurs et c'est sa transmission qui fait le jeu.

## 16. Premier jalon jouable

Le but : savoir si « ma mort tient la ligne » donne envie de revenir.

- 1 secteur (derrière et au-delà du front), Port-Ancre réduit.
- 3 classes sur 6 (Fantassin, Médic, Ingénieur), sans spécialisation.
- Le robot : 1 châssis, 4 bras, 4 modules, ordres de base.
- La mort selon le front, le robot-avant-poste, la relève.
- 1 nid avec 1 boss.
- Le front qui avance en temps réel sur ce secteur.
- En ligne, serveur autoritaire sur le Mac mini, 4 joueurs ou plus, téléphone et ordinateur.
- API en lecture seule (la création viendra au jalon 2).

## 17. Questions ouvertes

1. Élites portant le nom des morts : on garde (hommage à NetHack) ou on remplace ?
2. Pépinière : nouvelle mécanique d'adaptation à écrire et à repasser à la forge.
3. Durée de l'état « à terre » et part d'expérience de l'héritier : à régler au banc.
4. Marque : recherche EUIPO et INPI, puis dépôt ; réserver heirline.gg et playheirline.com.

## 18. Résultat de l'essai réseau (29/10/2026)

Détail dans `essais/RESULTATS.md`. Même prototype de tir sur les deux technos, serveur à 20 Hz, Mac mini :
**Colyseus 0.18** tient 200 joueurs à 20 % d'un cœur, avec prédiction et réconciliation fournies par le SDK ;
**SpacetimeDB 2.13** (module TypeScript) sature entre 50 et 70 joueurs (tick de 50 ms à ~1 s à 100 joueurs) et
demande d'écrire la prédiction à la main. **Choix : Colyseus pour le combat.** SpacetimeDB reste une piste pour la
couche persistante (lignées, front, concessions, API des agents). À faire : filtrage par zone (106 Ko/s par joueur
à 100 joueurs sans filtrage, trop pour la 4G).

## 19. État du MVP (29/10/2026)

Jouable en ligne depuis le Mac mini (`http://127.0.0.1:2700`, tunnel Cloudflare pour l'extérieur). Voir README.md.

**Monde v2 (29/10/2026)** :
- *Le continent* : Ossara fait 400 × 400 tuiles, entouré de mer, de falaises et de sable, avec rivières, ponts et gués. Port-Ancre est sur
  la côte sud. Les régions sont des données (`shared/map.ts`, `shared/monde.ts`) : Plaines de la côte au sud, Forêt des Fougères à l'ouest,
  Marais de la Sève à l'est, Plateaux de Basalte au centre, Cimetière des Machines au nord-ouest, Terres d'ÉDEN au nord-est. Chaque lieu
  habité a son nom et son sous-titre à l'écran.
- *Le graphe des cartes* : le continent, l'intérieur de l'épave de la Constance et le nid. On entre dans la Constance par un sas au
  Cimetière (scellé jusqu'à l'acte 2 de la campagne). Dedans, une passerelle, et une salle scellée : son lecteur ne s'ouvre qu'après le
  journal de Varga (fin de l'acte 2), et garde le dernier message de la Terre. Le nid se prend par la Gueule, au cœur de la Grande Ruche ; c'est une instance de groupe de 4 joueurs. Chaque passage a sa
  tuile de sortie libre, et les passages vont dans les deux sens.
- *Les copies* : une salle Colyseus par carte (`filterBy(['carte'])`). Au-delà du seuil (`HEIRLINE_COPIE_MAX`, 200 joueurs ; 4 pour le
  nid), Colyseus ouvre une copie.
- *Le service central* : `server/central.ts`, partagé par toutes les copies, tient l'heure, la météo, les ruches et les avant-postes.
  Leurs PV sont communs à toutes les copies, et un avant-poste n'est détruit qu'une fois.
- *Les ruches* : ÉDEN n'avance plus en bande. Il pousse depuis 5 ruches en taches de biomasse ; le front est la bordure de ces taches.
  Dans une tache, c'est « au-delà » (mort définitive) ; dehors, le terrain est tenu. Tuer près d'une ruche la fait reculer, et un
  avant-poste la retient. La nuit, une brume violette monte le long de la bordure.
- *Le monorail* : six gares. Celle de Port-Ancre marche ; les cinq autres se réparent avec des pièces et de la ferraille, puis restent
  ouvertes pour tout le monde.
- *La monture* : le robot devient une monture au niveau 3, après la quête « La selle » de Joss. Elle va ×1,6 plus vite, et on descend
  dès qu'on est touché, qu'on tire ou qu'on lance une compétence. La vitesse est calculée dans `vitesseSoldat`/`applyMove`, partagées par
  le serveur et la prédiction du client.
- *La migration* : `server/migration.ts` fait passer la base de v1 à v2. Elle garde comptes, lignées, morts et niveaux, rend à l'atelier
  les robots plantés en avant-poste (niveau gardé) et efface l'ancien front. Elle est idempotente. Sur la vraie base : 224 comptes et
  224 soldats migrés, 6 avant-postes rentrés.
- *Le bouton de test* : « Test : aller voir un boss » mène à l'Engloutisseur, à la Couveuse (le nid), à la Constance ou au port.

**Interface v2** :
- *Le thème* : sci-fi militaire coloniale usée. Métal riveté, plaques d'identité, vert CRT pour la minicarte et la carte, orange pour
  les accents, violet pour ce qui touche ÉDEN.
- *Ce qui est dessiné par le code* :
  - les cadres 9-slice (`initTheme`), passés au CSS sous forme de variables ;
  - les icônes 16 × 16 (`client/src/icones.ts`) : compétences, monture, menus, ressources et météo ;
  - la police pixel « Pochoir » (`tools/police-pixel.py`, 8 px d'em), utilisée aussi dans Phaser.
- *Le HUD* : plaque du soldat (portrait, niveau, PV, XP, ferraille, sac), plaque du robot, suivi de quête, journal des messages, zone et
  boss au centre, menus en icônes, minicarte CRT, horloge et ping. Le bouton d'action change d'icône selon la cible.
- *Les dialogues* : en bas de l'écran, avec portrait, faction (Corps colonial, Ferrailleurs, Fertiles, Première Vague, Colons) et
  récompenses.
- *Les écrans refaits* : titre, choix de la classe, relève (plaque d'identité), sac en grille avec fiche, marchand, journal, atelier,
  gare, carte du monde (centrée sur le joueur, avec légende), menu.
- *Les marqueurs de quête* : « ! » jaune pour une quête à prendre, « ? » gris pour une quête en cours, « ? » jaune pour une quête à
  rendre.
- *Les captures* : `captures/v2/` (iPhone en paysage, 852 × 393 à ×3, avec les zones de sécurité simulées) ; la carte est dans
  `captures/carte-continent.png`.

**Mesures v2** (Mac mini, serveur de banc à part avec `HEIRLINE_COPIE_MAX=40`) :
- 60 clients, 2 copies : tick 25 ms en moyenne (50 au pire), calcul 3,5 ms (11,7 au pire), CPU 27 % (38 % au pire), 226 Mo,
  3,7 ko/s par client.
- 100 clients, 3 copies : calcul 3,0 ms (11,5 au pire), CPU 35 % (45 % au pire), 230 Mo, 4,3 ko/s par client.

**Le monde ouvert (v1, avant la refonte)** : Ossara faisait 480 × 200 tuiles en cinq régions de niveau croissant (Plaines 1–4, Forêt des
Fougères 4–8, Marais de la Sève 8–12, Cimetière des Machines 12–16, Terres d'ÉDEN 16–20). Le client dessine le monde par morceaux de 32 × 32 tuiles autour de la caméra
(la biomasse suit le front) ; le serveur n'envoie à chacun que ce qui est près de lui (StateView, entrée à 440 px, sortie à 540 px).
Port-Ancre est une vraie ville : remparts et portes, avenues pavées, place avec fontaine, atelier des robots, caserne, infirmerie, comptoir,
cantine, entrepôt, maisons, potagers, tableau des morts, porte des concessions. Hors des murs : la ferme des Aldo, le Poste de la Fougère,
Haute-Sève (le village des Fertiles), le Poste du Marais, la Casse des Ferrailleurs, les ruines de la Première Vague, le Jardin d'ÉDEN, le nid.
25 bâtiments en tout, meublés, avec des portes ; le toit s'efface quand on entre ; fenêtres allumées et cheminées qui fument.

**La vie** : 34 habitants (nommés pour la plupart) avec une journée (poste de travail, cantine ou place le soir, lit la nuit), des passants et des enfants,
des gardes qui font leur ronde et tirent sur ce qui entre ; des bulles de paroles. Faune inoffensive (Broutards, Cornefeuilles, qui fuient)
et hostile (Rôdeurs, Fougerôdes, Sangsues, Rouillards des machines), ÉDEN (Rampants, Cracheurs, Cuirassés, Gonflés qui explosent, Greffés),
environ 90 camps qui se repeuplent, élites rares (5 %, dorées, meilleur butin), l'Engloutisseur (boss du marais, réapparaît 10 min après sa
mort) et la Couveuse au nid. Jour et nuit (une journée = 24 min), pluie et brume. Au-delà du front, une brume violette (plus de nuit noire).

**Quêtes** : dialogues à choix, « ! » et « ? » au-dessus des têtes, journal, suivi à l'écran, objectifs (parler, tuer, explorer, ramasser,
escorter, réparer, lire) marqués sur la minicarte et la carte. Le Choix : livrer Haute-Sève au Corps colonial ou la taire. Il change les
répliques, ferme ou ouvre la boutique des Fertiles, et un compteur global montre ce qu'ont choisi les autres lignées.

**L'histoire en jeu (29/10/2026)** — la bible est `docs/histoire.md`, les textes `docs/journaux.md` :
- *La campagne 1, « La côte de Port-Ancre »* : 34 quêtes, dont 18 de trame en trois actes (17 pas par lignée : « La Constance » existe en deux versions) (`shared/quests.ts`, champ `acte`).
  Acte 1, la colonie : Matricule, Ce qui pousse, La selle, Le message de la Fougère, Les Fertiles, Le choix, Le code (les spores sont
  écrites par des humains). Acte 2, la Première Vague : Le Tertre, Le robot qui chante (Cantor), Les journaux de bord (trois cœurs de
  données dans les ruines), La Constance (le sas s'ouvre : Maëlle Sève donne la clé de son arrière-grand-père si Haute-Sève a été tue,
  Cantor donne le code si elle a été livrée), La mission (le journal de Varga : ÉDEN est un programme de la Terre). Acte 3, le Semeur :
  La voix du Semeur (une ruche, puis le carnet d'Aurèle Danet dans l'épave), Les ruches (rendue, elle fait reculer toutes les ruches,
  pour tout le serveur, par le service central), Le modèle (« pas conformes »), Le nid, L'offensive du Semeur. Sa fin dépend du front de
  tout le serveur (les ruches plus grandes qu'au départ : évacuation) et du choix de la lignée (victoire avec les Fertiles, ou Haute-Sève
  rasée) ; elle est gardée dans le drapeau `fin_c1`.
- *Les lectures* (`shared/journaux.ts`) : 14 textes (notes de Lin, stèles, 3 cœurs de données, journaux de Varga et de Danet, la voix des
  ruches, le Semeur, le dernier message de la Terre, les clins d'œil), lus sur place (11 endroits, bouton d'action) ou en arrivant dans un
  lieu, gardés au journal (drapeaux `lu_<id>`) et relus depuis l'écran Journal (`client/src/lecture.ts`).
- *Les lignées dans l'histoire* : Brasier, Joss, Odile, Ilona, Lin et Nadia citent parfois un ancêtre mort du joueur (prénom, génération,
  endroit, tueur, lus dans la base) ; Cantor chante les noms des derniers morts définitifs du serveur, en majuscules ; Odile raconte les
  exploits (premier à abattre l'Engloutisseur ou la Couveuse, plus vieille lignée). La stèle de la place garde le premier mort de chaque
  saison.
- *Les clins d'œil* : la cassette « Rembobine » (cabine d'enfant), le Tamagoyle cassé (salle de jeux) que Joss répare sans dire ce que c'est,
  la tombe de l'équipe de raid qui a wipe (Tertre), la plaque « 2007–2009 » (coursive), le robot qui danse après deux minutes immobile sur
  la place (bit 2 de `Robot.fx`, gigue minimale côté client), la salle secrète.
- *La migration de la trame* (`migrerTrame`, une fois, au démarrage) : l'ancienne « La voix du Semeur » (cœurs + Cantor) devient « Les
  journaux de bord » (finie ou en cours, cœurs gardés, textes débloqués) ; rien d'autre ne bouge, ni les lignées ni les robots.
- *Corrigé* : les arbres dessinés dans les maisons (114 arbres fantômes : la tuile était devenue plancher, l'arbre restait dans la liste ;
  dont celui de la caserne) ; la gare de Port-Ancre posée à moitié dans le comptoir des Ferrailleurs (déplacée de 3 tuiles). Un test vérifie
  qu'aucune maison ne contient autre chose que du plancher et des meubles.

**Économie** : sac de 24 places, équipement (arme par classe, armure, deux modules) avec raretés et statistiques (dégâts, cadence, PV,
résistance, vitesse, dégâts du robot), matériaux qui s'empilent, trousses et baumes ; six marchands (armurerie, soins, ferraille, Casse,
Fertiles, cantine) qui achètent et vendent contre la ferraille ; les pièces détachées servent à améliorer le robot.

**Corrigé depuis le premier MVP** : caméra plus proche (zoom entier, ~190 px de jeu en hauteur) ; plus de noir au-delà du front ; noms des
soldats IA qui ne se chevauchent plus et prénoms uniques ; tirs ennemis en projectiles (acide, laser, épine) ; Couveuse plus grande, nommée,
avec sa barre ; soldats IA du nid avec un robot ; sac gardé à la déconnexion ; ruée prédite côté client (même fonction que le serveur).

**Mesures** (Mac mini, serveur et clients sur la même machine, clients répartis dans tout le monde, un tiers à Port-Ancre) :
60 clients → tick 50,0 ms (écart 7), calcul 7,0 ms en moyenne (19 ms au pire), CPU 26 % (36 % au pire), 164 Mo, 5,6 ko/s par client.
150 clients → calcul 7,7 ms (19 ms au pire), CPU 28 % (33 % au pire), 173 Mo, 9,9 ko/s par client.

**Pas encore** : son ; 3 classes sur 6 ; la modération des textes est une liste de mots ; pas encore joué sur un vrai iPhone (seulement
Chrome sans écran à la taille d'un iPhone en paysage) ; l'escorte et la réparation sont testées par le code, pas jouées à la main jusqu'au bout ;
les ennemis se cachent parfois sous le feuillage (seul le joueur rend les arbres transparents).
