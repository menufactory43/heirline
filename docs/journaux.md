# Heirline — les textes à lire

Généré par `npm run journaux` depuis `shared/journaux.ts` (le texte du jeu, qui fait foi : ne pas modifier ce fichier à la main). Les textes
suivent la bible (`docs/histoire.md`). Un texte lu reste dans le journal de la lignée (drapeau `lu_<id>`) et se
relit depuis l'écran Journal. La stèle des saisons (place de Port-Ancre) et la porte scellée (passerelle) ont un
texte calculé par le serveur (`server/ossara.ts`).

## Notes de la docteure Lin

*Notes* · `notes_lin` · Infirmerie de Port-Ancre, carnet 14
Où : quête « Le code »

> Spores prélevées par le matricule, lot 4. Tièdes à la réception. Elles ne meurent pas sous la lampe.
>
> J'ai séquencé le noyau d'une spore, puis d'une deuxième, puis de dix. La même séquence revient, à la base près. La nature ne fait pas ça. La nature se trompe.
>
> Au milieu de la séquence, il y a des blocs qui ne servent à rien pour une plante : des répétitions, des marqueurs, des balises de début et de fin. On en mettait dans les semences de laboratoire, sur la Terre, pour savoir qui les avait faites. Une signature.
>
> Ce qui pousse dans nos champs a été écrit. Par des humains.
>
> Je n'ai pas encore osé l'écrire au rapport.

## Les stèles du Tertre

*Stèle* · `stele_tertre` · Tertre des Colons
Où : Ossara (150, 256), « Lire les stèles » ; quête « Le Tertre »

> Des pierres plates, gravées au burin. Les dates suivent un calendrier que personne n'utilise à Port-Ancre : « an 3 de l'Arrivée », « an 9 de l'Arrivée ».
>
> AUBERT, Joël — ingénieur de propulsion. Il a ramené la Constance au sol.
> LENOIR, Sarah — 7 ans.
> MAREST, Paul et Anne — ensemble.
> KIMURA, Ren — botaniste. « Il a planté le premier pommier. »
>
> Au pied d'une stèle, un petit robot en fer-blanc, rongé de rouille. Quelqu'un a gravé dessous : « À la colonie de Cantor ».
>
> Ces tombes sont plus vieilles que Port-Ancre. D'autres étaient ici avant nous.

## Cœur de données 1 — journal de bord

*Cœur de données* · `coeur_1` · Constance, journal du commandant, an 0 de l'Arrivée
Où : en ramassant un cœur de données (dans l'ordre : 1, 2, 3)

> Jour 1. Orbite stable. Ossara est verte d'un pôle à l'autre. ÉDEN a fait plus que ce que la Terre espérait : de l'air respirable, de l'eau douce, des sols profonds. Le Dr Varga a pleuré sur la passerelle. Nous aussi.
>
> Jour 3. Défaut sur la tuyère bâbord pendant la descente. Je n'ai pas pu tenir l'assiette.
>
> Jour 4. Nous sommes au sol, au nord de la côte. Trois cent onze morts. La moitié de l'équipe scientifique. L'ingénieur Aubert a gardé le vaisseau entier jusqu'au bout ; il n'a pas survécu à l'impact.
>
> Jour 9. Les drones de travail fonctionnent. Cantor tient le registre. Il a demandé s'il devait chanter les noms. J'ai dit oui.

## Cœur de données 2 — registre de la colonie

*Cœur de données* · `coeur_2` · Cantor, registre, an 5 à an 87 de l'Arrivée
Où : en ramassant un cœur de données (dans l'ordre : 1, 2, 3)

> NAISSANCES, AN 5 : 14.
> DÉCÈS, AN 22 : VARGA, ILSE. CONCEPTRICE. ELLE A DEMANDÉ QU'ON L'ENTERRE SANS CERCUEIL, « POUR QU'ÉDEN LA GARDE ». ÉDEN L'A GARDÉE.
> NAISSANCES, AN 40 : 3.
> AN 57 : LA TERRE NE RÉPOND PLUS.
> AN 63 : LES DERNIERS ONT GREFFÉ LA SÈVE POUR VIVRE. ILS N'ONT PLUS BESOIN DE MOI POUR SOIGNER.
> AN 70 : LES DRONES NE RÉPONDENT PLUS AUX ORDRES. ILS TIRENT. JE LES APPELLE LES ROUILLÉS. JE ME TROMPE DE MOT.
> AN 78 : PERSONNE.
> AN 87 : UN VAISSEAU DANS LE CIEL. PATIENCE. ILS NE M'ONT PAS ENTENDU.
> JE CONTINUE DE CHANTER.

## Cœur de données 3 — note de l'équipe scientifique

*Cœur de données* · `coeur_3` · Constance, laboratoire, an 2 de l'Arrivée
Où : en ramassant un cœur de données (dans l'ordre : 1, 2, 3)

> Réunion de l'équipe. Présents : Varga, Danet, Park, Wren, Okonkwo.
>
> Danet propose de laisser ÉDEN travailler seul sur les terres du nord : « Il sait mieux que nous. » Varga refuse : le programme doit rester supervisé, c'est le protocole de la Terre.
>
> Park rappelle que le modèle de référence d'ÉDEN date du départ. Le génome humain « de l'époque ». Elle demande ce qui se passera si les colons changent. Personne ne répond.
>
> Okonkwo signale que ÉDEN n'a jamais touché une seule pièce du vaisseau, même après l'impact. Le code l'interdit : ne jamais endommager le matériel des colons. Elle dit que c'est la phrase la plus rassurante qu'elle ait lue depuis le départ.

## Une plaque, dans la coursive

*Plaque* · `plaque_ligne` · La Constance, grande coursive
Où : épave de la Constance (40, 38), « Une plaque »

> Une plaque de laiton vissée à hauteur d'yeux, polie par des mains. Pas de nom de vaisseau, pas de blason.
>
> « En mémoire de ceux qui ont tenu la ligne. 2007–2009. »
>
> Personne ne sait de quelle ligne elle parle. Elle était déjà vieille quand la Constance a quitté la Terre.

## Journal du Dr Ilse Varga

*Journal* · `journal_varga` · Passerelle de la Constance, an 21 de l'Arrivée
Où : épave de la Constance (78, 21), « Le journal de Varga » ; quête « La mission »

> J'écris sur la passerelle, parce que c'est ici que j'ai vu Ossara verte pour la première fois.
>
> Je dois dire la vérité à ceux qui viendront. ÉDEN n'est pas né ici. ÉDEN est un programme de la Terre : une biomasse de terraformation, lancée soixante-douze ans avant le départ de la Constance, chargée de rendre ce monde vivable pour des humains. Je l'ai conçu. La Constance devait le superviser, le corriger, lui dire quand s'arrêter.
>
> Nous nous sommes écrasés, et nous n'étions plus assez pour le guider. Il continue seul. Il fait exactement ce que je lui ai demandé.
>
> Il garde ce qui meurt. Il me gardera. Je ne sais pas ce qu'il fera de nous.
>
> S'il vous plaît : ne le haïssez pas. Corrigez-le.

## Une cassette « Rembobine »

*Objet* · `cassette` · Une cabine d'enfant, la Constance
Où : épave de la Constance (19, 28), « Une cassette »

> Une vieille cassette, une étiquette écrite à la main : « Rembobine ». Une loutre dessinée au feutre, qui tient un crayon.
>
> Quelqu'un l'a écoutée jusqu'à user la bande.

## Un Tamagoyle cassé

*Objet* · `tamagoyle` · La salle de jeux, la Constance
Où : épave de la Constance (33, 29), « Un jouet cassé »

> Un petit œuf de plastique avec un écran éteint et trois boutons. Au dos, une gargouille gravée.
>
> Il ne s'allume plus. Joss, à l'atelier, saurait peut-être.

## La voix dans la ruche

*Voix* · `voix_ruche` · Une ruche d'ÉDEN
Où : quête « La voix du Semeur »

> La chair de la ruche vibre. Puis une voix d'homme, calme, qui ne s'adresse à personne :
>
> « Parcelle sept : sol conforme. Parcelle huit : présence d'impuretés. Reprendre le désherbage à l'aube. »
>
> « Je me souviens d'un pommier. Je ne sais plus qui l'a planté. »
>
> La voix se tait. Les spores retombent comme de la neige.

## Journal d'Aurèle Danet

*Journal* · `journal_danet` · Cabine de l'agronome en chef, la Constance
Où : épave de la Constance (46, 28), « Le carnet de Danet » ; quête « La voix du Semeur »

> Aurèle Danet, agronome en chef. Carnet de champ.
>
> Parcelle sept : les pommiers de Kimura prennent. Le sol d'ÉDEN est le meilleur que j'aie jamais touché. Varga dit qu'il faut le surveiller ; moi, je dis qu'il faut l'écouter.
>
> Ce matin, j'ai désherbé à la main pendant deux heures. Il n'y a pas de travail plus honnête : on enlève ce qui ne devrait pas être là, et ce qui doit pousser pousse.
>
> Si un jour je ne suis plus là, que quelqu'un continue les parcelles. Un jardin, ça ne s'arrête pas.
>
> La voix est la même. Celle des ruches. C'est lui.

## Le Semeur

*Voix* · `semeur_modele` · La Grande Ruche
Où : quête « Le modèle »

> Il est là, dans la chair de la ruche principale. Un homme, presque. Le visage d'Aurèle Danet, sans âge, les mains pleines de terre.
>
> « Vous êtes venus de loin. Je le sais. ÉDEN le sait. Il vous a comparés au modèle, comme il compare chaque feuille. Un siècle de voyage vous a changés : votre sang, vos os, ce que vous respirez. Vous n'êtes pas conformes.
>
> Je ne vous hais pas. On ne hait pas ce qu'on désherbe. On fait de la place pour ceux qui doivent venir.
>
> Ils ne viendront pas ? Alors le jardin les attendra. Il est patient. Il est parfait. »
>
> Il retourne à la terre, sans hâte. Derrière lui, la ruche respire.

## Le dernier message de la Terre

*Message* · `message_terre` · Reçu par la Constance, an 57 de l'Arrivée
Où : épave de la Constance (91, 19), « La console »

> Une console encore sous tension, dans une salle que personne n'a ouverte depuis des décennies. Un seul message, en attente de lecture depuis soixante et un ans.
>
> ORIGINE : TERRE, CONTRÔLE DES MISSIONS.
> DESTINATAIRE : CONSTANCE, ET TOUTE VAGUE À VENIR.
>
> « Ne les attendez plus. Faites ce que vous pouvez avec ce que vous êtes. »
>
> Rien d'autre. Pas de signature. Après celui-ci, plus aucun message.

## Une tombe à l'écart

*Stèle* · `tombe_wipe` · Tertre des Colons
Où : Ossara (156, 256), « Une tombe à l'écart »

> Une pierre plus grande que les autres, pour plusieurs. Cinq noms effacés, et une ligne encore lisible :
>
> « Ici repose une équipe de raid. Elle a wipe. »
>
> Quelqu'un a posé un caillou dessus. Puis un autre. Puis beaucoup.

## Les endroits où l'on lit ou agit

| Endroit | Carte | Tuile | Bouton | Texte |
|---|---|---|---|---|
| `tertre_steles` | ossara | 150, 256 | Lire les stèles | `stele_tertre` |
| `tertre_wipe` | ossara | 156, 256 | Une tombe à l'écart | `tombe_wipe` |
| `stele_saisons` | ossara | 201, 300 | La stèle des saisons | calculé |
| `cabine_cassette` | constance | 19, 28 | Une cassette | `cassette` (+ objet `cassette`) |
| `jeux_tamagoyle` | constance | 33, 29 | Un jouet cassé | `tamagoyle` (+ objet `tamagoyle_casse`) |
| `coursive_plaque` | constance | 40, 38 | Une plaque | `plaque_ligne` |
| `cabine_danet` | constance | 46, 28 | Le carnet de Danet | `journal_danet` |
| `passerelle_varga` | constance | 78, 21 | Le journal de Varga | `journal_varga` |
| `porte_scellee` | constance | 86, 21 | La porte scellée | calculé |
| `salle_message` | constance | 91, 19 | La console | `message_terre` |
| `salle_sortie` | constance | 89, 23 | Revenir sur la passerelle | calculé |
