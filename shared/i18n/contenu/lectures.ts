// Ce qui se lit (shared/journaux.ts). Clés : lecture.<id>.titre / source / texte ; endroit.<id>.label (le bouton d'action)
import { LECTURES, ENDROITS } from '../../journaux.ts'

export function frLectures() {
  return Object.fromEntries(LECTURES.map((l) => [l.id, { titre: l.titre, texte: l.texte, ...(l.source ? { source: l.source } : {}) }]))
}
export function frEndroits() { return Object.fromEntries(ENDROITS.map((e) => [e.id, { label: e.label }])) }

export const enEndroits: Record<string, unknown> = {
  rel_maquette: { label: 'A model ship' }, robot_assis: { label: 'A seated robot' }, serres_carnet: { label: 'A notebook between the rows' }, mat_grave_lire: { label: 'The base of the mast' },
  tertre_steles: { label: 'Read the gravestones' }, tertre_wipe: { label: 'A grave apart' }, stele_saisons: { label: 'The Stone of Seasons' },
  cabine_cassette: { label: 'A cassette tape' }, jeux_tamagoyle: { label: 'A broken toy' }, coursive_plaque: { label: 'A plaque' },
  cabine_danet: { label: "Danet's notebook" }, passerelle_varga: { label: "Varga's journal" }, porte_scellee: { label: 'The sealed door' },
  salle_message: { label: 'The console' }, salle_sortie: { label: 'Back to the bridge' },
}

export const enLectures: Record<string, unknown> = {
  maquette_patience: { titre: 'Patience II', source: 'Relâche harbour office', texte: `A model ship, made of driftwood and copper wire, sitting on the shelf. Three masts, a round hull, a name hand-painted on the stern: PATIENCE II.

Underneath, a pencilled label: "The first one left Earth and never arrived. This one will. — H. V."` },
  robot_assis: { titre: 'The Seated Robot', source: 'Iron Fields, west of the furrows', texte: `A Constance robot, sitting in the rusty grass, hands on its knees. No sap cables in its joints: nobody wove it.

Next to it, a cassette tape. On the label, an otter. Someone carved on its shoulder, very neatly: "Not this one. — M."` },
  liste_tisserand: { titre: 'What the Weaver Remembers', source: 'The Weaver, scratched on a sheet of tin', texte: `row 1 number 4 aubert bloodline switched off
row 1 number 5 lenoir bloodline switched off
row 2 number 12 marest bloodline switched off
row 7 number 3 ferrand bloodline switched off
row 7 number 4 ferrand bloodline switched off
row 40 number 1 me not finished

she counts them all she says someone has to know` },
  journal_park: { titre: 'The Greenhouse Notebook', source: 'Sun-Hee Park, Constance botanist (recent handwriting)', texte: `They shoot too much. Always the same thing: bullets, bullets, bullets. So I grew bark.

Then they tried fire. I made sap that doesn't burn.

That's what a nursery is: you watch what dies, and you replant what resists. My buds watch for me. I don't hold it against these settlers. They're teaching me.

Mira says that soon Earth will know. I don't have the heart to tell her Earth hasn't answered in a hundred years.` },
  mat_okonkwo: { titre: 'Data core — the relay mast', source: 'Constance, descent recording, day 3', texte: `(A woman's voice, calm, drowned by alarms.)

"Okonkwo here, robotics workshop. We're losing the port nozzle. I repeat: we're losing…"

(Another voice, older. Varga.)

"Mira. Listen to me. If Earth goes silent, call it back. Whatever happens. It has to know we're here."

"Call it back yourself, doctor."

"I'm counting on you."

(An impact. Silence. Then, very low, Mira's voice: "All right.")` },
  okonkwo_metier: { titre: 'The Loom', source: "Hélène Vasseur's survey, at the foot of the Loom", texte: `Metal arches, for hundreds of metres. In each arch, robots hung by sap cables, lined up, numbered. The cables rise to the pylons, and from the pylons towards the sky.

It isn't an army. It's an antenna. And what it sends is a list: every robot, its number, its bloodline, and each bloodline's dead. A census of the whole Second Wave.

She wants Earth to know who we are. She thinks Earth is listening.` },
  registre_page: { titre: 'A Page from the Registry', source: "Tobias Wren, ship's doctor (recent handwriting)", texte: `I have them all. Every soldier fallen beyond the front. I forget no name: I sew them onto those who can still walk.

On the Constance they told me a doctor keeps the register of the dead so that nobody dies twice. I follow orders.

Mira wants the list for Earth. I give it to her. But I keep a copy. You never know who'll come to claim it.` },
  varga_repond: { titre: 'A Voice That Answers', source: "Relâche, harbour office, Hélène's radio", texte: `(A long crackle. Then an old voice, crisp, as if speaking from the next room.)

"This is Varga. Who's calling?"

(A silence.)

"I repeat: this is Ilse Varga, Constance. I have received your transmission. Who's calling?"

Hélène switched the radio off. Then she switched it back on. Then she said it would take weeks to know what to answer.` },
  notes_lin: {
    titre: "Dr Lin's notes",
    source: 'Anchorport Infirmary, notebook 14',
    texte: `Spores collected by the recruit, batch 4. Warm on arrival. They don't die under the lamp.

I sequenced the nucleus of one spore, then a second, then ten. The same sequence comes back, down to the base pair. Nature doesn't do that. Nature makes mistakes.

In the middle of the sequence there are blocks that are useless to a plant: repeats, markers, start and stop tags. We used to put them in lab-grown seed, back on Earth, so we'd know who made it. A signature.

What grows in our fields was written. By humans.

I haven't dared put it in my report yet.`,
  },
  stele_tertre: {
    titre: 'The gravestones on the Mound',
    source: "Settlers' Mound",
    texte: `Flat stones, cut with a chisel. The dates follow a calendar nobody uses in Anchorport: "year 3 of the Landing", "year 9 of the Landing".

AUBERT, Joël — propulsion engineer. He brought the Constance down.
LENOIR, Sarah — aged 7.
MAREST, Paul and Anne — together.
KIMURA, Ren — botanist. "He planted the first apple tree."

At the foot of one stone, a little tin robot, eaten by rust. Someone carved beneath it: "To Cantor's colony".

These graves are older than Anchorport. Others were here before us.`,
  },
  coeur_1: {
    titre: 'Data core 1 — ship\'s log',
    source: "Constance, commander's log, year 0 of the Landing",
    texte: `Day 1. Stable orbit. Ossara is green from pole to pole. EDEN did more than Earth dared hope: breathable air, fresh water, deep soil. Dr Varga wept on the bridge. So did we.

Day 3. Port thruster fault during descent. I couldn't hold the attitude.

Day 4. We're on the ground, north of the coast. Three hundred and eleven dead. Half the science team. Engineer Aubert kept the ship in one piece to the very end; he didn't survive the impact.

Day 9. The work drones are running. Cantor keeps the register. He asked whether he should sing the names. I said yes.`,
  },
  coeur_2: {
    titre: 'Data core 2 — colony register',
    source: 'Cantor, register, years 5 to 87 of the Landing',
    texte: `BIRTHS, YEAR 5: 14.
DEATHS, YEAR 22: VARGA, ILSE. DESIGNER. SHE ASKED TO BE BURIED WITHOUT A COFFIN, "SO EDEN CAN KEEP HER". EDEN KEPT HER.
BIRTHS, YEAR 40: 3.
YEAR 57: EARTH NO LONGER ANSWERS.
YEAR 63: THE LAST ONES GRAFTED THE SAP TO LIVE. THEY NO LONGER NEED ME TO HEAL THEM.
YEAR 70: THE DRONES NO LONGER OBEY. THEY SHOOT. I CALL THEM THE RUSTED. I HAVE THE WRONG WORD.
YEAR 78: NO ONE.
YEAR 87: A SHIP IN THE SKY. PATIENCE. THEY DID NOT HEAR ME.
I KEEP SINGING.`,
  },
  coeur_3: {
    titre: 'Data core 3 — science team memo',
    source: 'Constance, laboratory, year 2 of the Landing',
    texte: `Team meeting. Present: Varga, Danet, Park, Wren, Okonkwo.

Danet proposes letting EDEN work the northern lands alone: "It knows better than we do." Varga refuses: the program must stay supervised, that's Earth protocol.

Park points out that EDEN's reference template dates from launch. The human genome "as it was then". She asks what happens if the settlers change. Nobody answers.

Okonkwo notes that EDEN has never touched a single part of the ship, even after the impact. The code forbids it: never damage the settlers' equipment. She says it's the most reassuring sentence she's read since launch.`,
  },
  plaque_ligne: {
    titre: 'A plaque in the gangway',
    source: 'The Constance, main gangway',
    texte: `A brass plaque screwed in at eye level, polished by hands. No ship's name, no crest.

"In memory of those who held the line. 2007–2009."

No one knows which line it means. It was already old when the Constance left Earth.`,
  },
  journal_varga: {
    titre: 'Journal of Dr Ilse Varga',
    source: 'Bridge of the Constance, year 21 of the Landing',
    texte: `I'm writing on the bridge, because this is where I first saw Ossara green.

I owe the truth to whoever comes next. EDEN wasn't born here. EDEN is a program from Earth: a terraforming biomass, launched seventy-two years before the Constance left, tasked with making this world fit for humans. I designed it. The Constance was meant to supervise it, correct it, tell it when to stop.

We crashed, and there weren't enough of us left to guide it. It carries on alone. It does exactly what I asked of it.

It keeps what dies. It will keep me. I don't know what it will make of us.

Please: don't hate it. Correct it.`,
  },
  cassette: {
    titre: 'A "Rembobine" tape',
    source: "A child's cabin, the Constance",
    texte: `An old cassette tape, a handwritten label: "Rembobine" (rewind, in the old tongue). An otter drawn in felt-tip, holding a pencil.

Someone played it until the tape wore thin.`,
  },
  tamagoyle: {
    titre: 'A broken Tamagoyle',
    source: 'The playroom, the Constance',
    texte: `A small plastic egg with a dead screen and three buttons. On the back, an engraved gargoyle.

It won't switch on anymore. Joss at the workshop might know.`,
  },
  voix_ruche: {
    titre: 'The voice in the hive',
    source: 'An EDEN hive',
    texte: `The flesh of the hive trembles. Then a man's voice, calm, speaking to no one:

"Plot seven: soil conforming. Plot eight: impurities present. Resume weeding at dawn."

"I remember an apple tree. I no longer know who planted it."

The voice falls silent. The spores drift down like snow.`,
  },
  journal_danet: {
    titre: "Aurèle Danet's journal",
    source: "Chief agronomist's cabin, the Constance",
    texte: `Aurèle Danet, chief agronomist. Field notebook.

Plot seven: Kimura's apple trees are taking. EDEN's soil is the best I've ever touched. Varga says it must be watched; I say it must be listened to.

This morning I weeded by hand for two hours. There's no more honest work: you pull out what shouldn't be there, and what should grow, grows.

If one day I'm gone, let someone keep up the plots. A garden doesn't stop.

The voice is the same. The one in the hives. It's him.`,
  },
  semeur_modele: {
    titre: 'The Sower',
    source: 'The Great Hive',
    texte: `He's there, in the flesh of the main hive. A man, almost. Aurèle Danet's face, ageless, hands full of soil.

"You came a long way. I know. EDEN knows. It compared you to the template, as it compares every leaf. A century of travel changed you: your blood, your bones, what you breathe. You are not conforming.

I don't hate you. One doesn't hate what one weeds. One makes room for those who are meant to come.

They won't come? Then the garden will wait for them. It is patient. It is perfect."

He turns back to the soil, unhurried. Behind him, the hive breathes.`,
  },
  message_terre: {
    titre: 'The last message from Earth',
    source: 'Received by the Constance, year 57 of the Landing',
    texte: `A console still powered, in a room no one has opened in decades. A single message, waiting to be read for sixty-one years.

ORIGIN: EARTH, MISSION CONTROL.
RECIPIENT: CONSTANCE, AND ANY WAVE TO COME.

"Stop waiting for them. Do what you can with what you are."

Nothing else. No signature. After this one, no more messages.`,
  },
  tombe_wipe: {
    titre: 'A grave apart',
    source: "Settlers' Mound",
    texte: `A stone bigger than the others, for several people. Five names worn away, and one line still legible:

"Here lies a raid team. They wiped."

Someone set a pebble on top. Then another. Then a great many.`,
  },
}
