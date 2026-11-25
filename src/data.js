// All authored content lives here: bottle notes, the serial story, fish,
// creatures, upgrades, cosmetics and daily bounties.

export const ASPECTS = [
  { name: 'Tide', color: '#3fd6ff' },
  { name: 'Dawn', color: '#ffb347' },
  { name: 'Ember', color: '#ff5a4d' },
  { name: 'Moss', color: '#7dff8a' },
  { name: 'Stars', color: '#b79bff' },
  { name: 'Coral', color: '#ff7fc2' },
  { name: 'Gale', color: '#5effd9' },
];

export const RANKS = [
  [0, 'Drifter'], [1, 'Deckhand'], [3, 'Wayfinder'], [6, 'Navigator'], [10, 'Star-Reader'],
  [15, 'Tide-Caller'], [22, 'Keeper of Lights'], [32, 'Legend of the Archipelago'], [50, 'The Sea Remembers You'],
];

// ---------------------------------------------------------------------------
// Bottles. Each kind has its own glass colour, reward and presentation.
// ---------------------------------------------------------------------------
export const BOTTLE_KINDS = {
  musing: { label: 'Message in a bottle', glass: '#49c79a', glow: '#1f7a58', pearls: 2, score: 50 },
  story: { label: 'A page from Wren’s log', glass: '#4f8dff', glow: '#2a4fb0', pearls: 6, score: 120 },
  riddle: { label: 'A riddle', glass: '#c58bff', glow: '#6b3cb0', pearls: 4, score: 80 },
  shanty: { label: 'A verse of a shanty', glass: '#ffb36b', glow: '#a05a1c', pearls: 3, score: 60 },
  recipe: { label: 'An island recipe', glass: '#ffe07a', glow: '#9a7a1a', pearls: 3, score: 60 },
  letter: { label: 'A letter from another sailor', glass: '#8fe3ff', glow: '#2a7a9a', pearls: 3, score: 70 },
  map: { label: 'A treasure map', glass: '#a8754a', glow: '#6b3f1a', pearls: 4, score: 90 },
  golden: { label: 'A golden bottle', glass: '#ffd34d', glow: '#ffb000', pearls: 25, score: 400 },
};

export const MUSINGS = [
  'If you are reading this, the wind still works. Good.',
  'The shrines hum louder when it rains. I never found out why.',
  'Day 40. I have named every gull. They do not answer to any of them.',
  'Sail toward the light you cannot explain.',
  'There is no edge. I checked. Twice.',
  'Dear finder: the treasure was the knots we learned along the way.',
  'Trade offer: one message in a bottle for one bottle without a message.',
  'The stars here are in the wrong places, and I like them better.',
  'Somebody keeps lighting these beacons. Thank you, whoever you are.',
  'I buried something on an island with three palms. Or four. Many palms.',
  'The sea is just a very slow sky.',
  'Note to self: bring more paper next time.',
  'Each island remembers who visited. Be polite.',
  'At night the crystals sing in a key my fiddle cannot reach.',
  'Keep the shore on your left until you no longer want to.',
  'To whoever finds this: you are further out than I ever got.',
  'I asked a dolphin for directions. It laughed. Fair.',
  'Fog is just the sea thinking very hard.',
  'Counted 212 islands before I lost count. Started again. 3.',
  'If the water turns turquoise, slow down. Sand is patient but firm.',
  'A whale looked at me today like I owed it money.',
  'The wind changed its mind four times this morning. Relatable.',
  'I have stopped asking where I am going. It is going very well.',
  'Rain on a calm sea sounds like applause for nothing in particular.',
  'Please return this bottle. It was my favourite bottle.',
  'Every shrine I wake feels like it was waiting for exactly me. Probably says that to everyone.',
  'Sunsets out here are rude. They make every other sunset look lazy.',
  'Rule one of the open sea: never trust a calm gull.',
  'There is a rock shaped like my uncle somewhere east of here. Say hello.',
  'Low tide reveals the truth. High tide hides it again. The tide is a gossip.',
  'I sailed all night to see what the dawn looked like from further away. Same. Better.',
  'The fish here are cleverer than the fish at home. I respect them.',
  'If you hear singing at night, it is either the crystals or me. Both are off key.',
  'I made a friend. It is a coconut. Its name is Captain.',
  'Somewhere a lighthouse misses its keeper. Not this one. I am fine.',
  'Storms out here end the way arguments should: suddenly, with a rainbow.',
  'The radar says nothing is there. The radar has never been there.',
  'Spent a whole day following a cloud shaped like a ship. It won.',
  'A good wind is a promise. A great wind is a dare.',
  'Whoever invented the sail deserves a very long nap.',
  'I keep finding bottles. I keep writing back. This is my 31st reply.',
  'Hello from the middle of everything.',
];

export const STORY = [
  { title: 'I. The Departure', text: 'My name is Ines Wren, and I am writing this because the harbour master bet me I would not. I am leaving Port Calloway on the Marigold with three crates of lemons, one compass and no particular plan. If you find this, I won.' },
  { title: 'II. The First Light', text: 'Third night out I saw a pale beam rising from an island. Not a lighthouse; nothing so tidy. It hummed. When I sailed close it burst into colour, and the wind turned to push me onward like a friendly hand between the shoulders.' },
  { title: 'III. The Map With No Edges', text: 'I tried to chart the islands. Every time I reached the edge of my paper, there were more. I glued on another sheet. Then another. The map is now a scarf. I wear it at night.' },
  { title: 'IV. The Keeper', text: 'On a peak island I met an old woman tending a dormant shrine with a broom. She said the lights were not built; they were remembered. "The sea forgets everything," she said, "except what someone keeps lit."' },
  { title: 'V. Seven Colours', text: 'Tide, Dawn, Ember, Moss, Stars, Coral, Gale. The keeper said that when one sailor wakes all seven, the constellation in the night sky fills in. I asked what happens then. She swept the step and did not answer.' },
  { title: 'VI. The Storm', text: 'The storm came sideways. Lightning showed me islands I had never seen, then hid them again. The Marigold groaned but held. When it passed, the sea was glass, and a whale surfaced beside me as if to check I was still here.' },
  { title: 'VII. The Ghost Ship', text: 'At midnight a ship sailed past with no one at the helm and a lantern burning blue. I followed it until dawn. When the sun came up there was nothing but a bottle bobbing in its wake. I am writing this inside that bottle.' },
  { title: 'VIII. Lemons', text: 'Down to the last crate of lemons. Traded half to a fisherman for a song and the other half for a fish. The song was better. I hum it while I sail. It has no ending; you just stop when you get there.' },
  { title: 'IX. The Others', text: 'I am not alone out here. I keep finding notes from other sailors, all saying some version of: keep going, it gets more beautiful. I have started leaving notes too. Hello. Keep going. It gets more beautiful.' },
  { title: 'X. The Question', text: 'The keeper\'s words keep returning: the sea forgets everything except what someone keeps lit. I think the shrines are not lights. I think they are memories of everyone who sailed past. Each one I wake remembers me back.' },
  { title: 'XI. Far Enough', text: 'I have sailed far enough that the stars are new. The constellation is almost full. One colour left. I could go home. I keep not going home. I think this means I already am.' },
  { title: 'XII. To You', text: 'If you have found every page, then you have sailed as far as I did, and probably further. The last light is yours to wake, not mine. Look up tonight. If the seven stars are joined, we were here together. — I. W.' },
];

export const RIDDLES = [
  { q: 'I have a bed but never sleep, a mouth but never speak, and I run without legs. What am I?', a: 'A river' },
  { q: 'The more of me you take, the more you leave behind. What am I?', a: 'Footsteps (or a wake)' },
  { q: 'I can fill a room but take up no space. Sailors fear me when I go out. What am I?', a: 'Light' },
  { q: 'What has a head and a tail, travels the world, but never leaves its corner?', a: 'A stamp (on this letter!)' },
  { q: 'I am always in front of you on the sea and never behind. What am I?', a: 'The horizon (or the future)' },
  { q: 'What runs around the whole island without moving?', a: 'The shoreline' },
  { q: 'I am light as a feather, yet the strongest sailor cannot hold me for long. What am I?', a: 'Breath' },
  { q: 'What gets wetter the more it dries?', a: 'A towel' },
  { q: 'What can travel the world while staying in one corner of a map?', a: 'A compass rose' },
  { q: 'I have keys but open no locks, and every islander dances when I play. What am I?', a: 'A piano (or an accordion)' },
  { q: 'Forward I am heavy, backward I am not. What am I?', a: 'A ton' },
  { q: 'I have cities but no houses, forests but no trees, and seas but no fish. What am I?', a: 'A map' },
];

export const SHANTIES = [
  'Oh, the wind blows west and the lemons blow east,\nand the captain is sure she has eaten the least.\nHaul away, haul away, under seven bright stars,\nwe will sing till the shrines hear the sound of guitars.',
  'Wake the light on the windward shore,\nwake the light and sail on more.\nNo port to reach, no bell to ring,\njust open sea and the songs we sing.',
  'A gull stole my biscuit, a crab stole my shoe,\nthe fog stole the compass, I don’t know what to do.\nSo I sing to the tide and the tide sings it back,\nand it points me to islands I left off the track.',
  'Pull on the sheet and lean on the rail,\nthe wind is a horse and the boat is its tail.\nGallop and splash till the moon comes to stay,\nthen drift with the stars till the dawn finds the way.',
  'Seven colours, seven stars,\nseven shrines and seven scars.\nSail them all and look up high:\nthe sea will write you in the sky.',
  'Hey ho, the whale says no,\nshe’s heard my singing long ago.\nShe dives so deep, she dives so far,\nand surfaces where the quiet ones are.',
  'Row, row, the wind has quit,\nthe sail hangs down like a sulking kit.\nRow, row, a song will do,\nthe breeze comes back when it’s missing you.',
  'Pass the rum that isn’t rum, it’s coconut and lime,\nwe toast the shrines, we toast the moon, we toast the passing time.',
];

export const RECIPES = [
  'Castaway Toast: one coconut, split. One fish, grilled on a flat stone. Place fish on coconut. Call it toast. No one can stop you.',
  'Storm Soup: whatever is left, plus rain. Stir with conviction.',
  'Lemon Surprise (from the Marigold): a lemon. The surprise is that it is a lemon again.',
  'Shrine-side Tea: boil seawater, regret it, use rainwater instead, add a leaf that smells nice. Sip while watching a beam glow.',
  'Sailor’s Pancake: flour, water, a pinch of salt, and enough optimism to flip it on a rolling deck.',
  'Grilled Mango: mango, fire, patience. Patience is the hard part.',
  'Coconut Fizz: shake a coconut very hard for one minute. Do not open near your face.',
  'Midnight Stew: anything caught after sunset. Tastes better because you were brave.',
];

export const LETTERS = [
  { text: 'Found your bottle near the twin peaks. Your handwriting is terrible but your advice was perfect. Keep sailing.', from: 'Odile, on the Wanderlark' },
  { text: 'My daughter woke her first shrine today. She screamed so loud the gulls left. Best day.', from: 'Tomas, somewhere north' },
  { text: 'I am eighty-one and I bought a boat last spring. Everyone said I was too old. The sea did not say that.', from: 'Margarethe' },
  { text: 'If you see a red sail, wave. That is me. I am lonely but in a good way.', from: 'Kofi' },
  { text: 'I collect sunsets. I have 340. This one is my favourite. It is the one I am looking at.', from: 'Priya, on the Little Comet' },
  { text: 'Lost my compass. Navigating by vibes. Vibes are good.', from: 'Jun' },
  { text: 'We are a crew of four and a cat. The cat is in charge. Send help or tuna.', from: 'The crew of the Saltmarsh' },
  { text: 'Tried to race a dolphin. Lost by a lot. Would do it again.', from: 'Aroha' },
  { text: 'Wrote this during a storm. If it is soggy, that is authenticity.', from: 'Sven' },
  { text: 'I came out here to forget something. I forgot what. It worked.', from: 'Anonymous' },
  { text: 'Grandpa said the seven stars mean someone made it. I hope it was you.', from: 'Lucía, age 9' },
  { text: 'Write back! Leave a bottle near any shrine. I check them all eventually.', from: 'Benedikt the Patient' },
];

export const GOLDEN = [
  'You found a golden bottle. Inside is a single pearl, and a note: "for luck. pass it on."',
  'The golden bottle is warm to the touch, as if someone just let go of it. Inside: pearls, and the words "well sailed."',
  'A golden bottle! Its note reads: "The sea does not give gifts. It gives chances. This is one."',
  'Gold glass, a cork sealed with wax, and pearls clinking inside. The note just says: "Yes. You."',
  'Inside the golden bottle is a drawing of your boat. You never told anyone what it looks like.',
  'The keeper\'s handwriting: "Every light you wake makes the dark a little friendlier. Thank you."',
];

// ---------------------------------------------------------------------------
// Fishing
// ---------------------------------------------------------------------------
export const RARITY = {
  common: { label: 'Common', color: '#cfe6ef', zone: 0.26, speed: 0.9 },
  uncommon: { label: 'Uncommon', color: '#7dff8a', zone: 0.2, speed: 1.15 },
  rare: { label: 'Rare', color: '#5fb8ff', zone: 0.14, speed: 1.45 },
  legendary: { label: 'Legendary', color: '#ffcf4d', zone: 0.09, speed: 1.85 },
};

// where: any | shallows | deep | night | storm
export const FISH = [
  { id: 'sardine', name: 'Silver Sardine', rarity: 'common', where: 'any', min: 12, max: 22, pearls: 1, color: '#c9d6de' },
  { id: 'mackerel', name: 'Stripe Mackerel', rarity: 'common', where: 'deep', min: 25, max: 45, pearls: 2, color: '#5c8fa8' },
  { id: 'snapper', name: 'Coral Snapper', rarity: 'common', where: 'shallows', min: 30, max: 60, pearls: 2, color: '#ff7b6b' },
  { id: 'puffer', name: 'Grumpy Puffer', rarity: 'common', where: 'shallows', min: 10, max: 30, pearls: 2, color: '#e6d07a' },
  { id: 'flounder', name: 'Sand Flounder', rarity: 'uncommon', where: 'shallows', min: 20, max: 50, pearls: 4, color: '#c9ab7a' },
  { id: 'tuna', name: 'Bluefin Tuna', rarity: 'uncommon', where: 'deep', min: 80, max: 200, pearls: 5, color: '#2f5f9a' },
  { id: 'parrot', name: 'Rainbow Parrotfish', rarity: 'uncommon', where: 'shallows', min: 30, max: 70, pearls: 5, color: '#4fe0b0' },
  { id: 'squid', name: 'Moon Squid', rarity: 'uncommon', where: 'night', min: 30, max: 90, pearls: 5, color: '#d8c8ff' },
  { id: 'swordfish', name: 'Swordfish', rarity: 'rare', where: 'deep', min: 150, max: 300, pearls: 10, color: '#3a6c8f' },
  { id: 'lantern', name: 'Lanternfish', rarity: 'rare', where: 'night', min: 8, max: 20, pearls: 10, color: '#9ff0ff' },
  { id: 'eel', name: 'Thunder Eel', rarity: 'rare', where: 'storm', min: 90, max: 220, pearls: 12, color: '#f5ff7a' },
  { id: 'manta', name: 'Velvet Manta', rarity: 'rare', where: 'any', min: 200, max: 500, pearls: 12, color: '#3b3f6b' },
  { id: 'koi', name: 'Shrine Koi', rarity: 'legendary', where: 'shallows', min: 40, max: 90, pearls: 30, color: '#ff9a3c' },
  { id: 'oarfish', name: 'Abyssal Oarfish', rarity: 'legendary', where: 'deep', min: 400, max: 900, pearls: 35, color: '#e05050' },
  { id: 'starfish', name: 'Starfall Fish', rarity: 'legendary', where: 'night', min: 20, max: 40, pearls: 40, color: '#b79bff' },
  { id: 'boot', name: 'Somebody’s Boot', rarity: 'common', where: 'any', min: 26, max: 30, pearls: 0, color: '#6b4a2f', junk: true },
  { id: 'tin', name: 'Rusty Tin', rarity: 'common', where: 'any', min: 8, max: 12, pearls: 0, color: '#8a7a6a', junk: true },
];

export const FISH_DESC = {
  sardine: 'Travels in glittering schools of thousands. Alone, it looks a little lost.',
  mackerel: 'Wavy tiger stripes on its back, a silver mirror underneath. Never stops swimming.',
  snapper: 'A coral-red reef fish with a spiny crest and a famously bad attitude.',
  puffer: 'Inflates when worried, which is always. Please do not poke it.',
  flounder: 'Born with an eye on each side, then one eye moves over. Sand is its whole personality.',
  tuna: 'A torpedo of pure muscle with golden finlets. Can cross an ocean in a season.',
  parrot: 'Crunches coral with its beak and turns it into white sand. Many beaches are its fault.',
  squid: 'Shimmers pale violet under the moon. Has three hearts and uses all of them.',
  swordfish: 'Slashes through schools with its long bill, then cruises off as if nothing happened.',
  lantern: 'Carries its own light on a little fishing rod. Fishing for fish that fish.',
  eel: 'Long, yellow and humming with static. Only rises when the sky is full of thunder.',
  manta: 'Glides like a slow kite under the waves. Gentle, curious, and enormous.',
  koi: 'Said to swim up from the shrines themselves. Its scales catch light that is not there.',
  oarfish: 'A silver ribbon from the abyss with a crimson crest. Sailors call it the sea serpent.',
  starfish: 'Speckled with tiny stars that fell into the sea. Only seen under a clear night sky.',
  boot: 'Size 11. Left foot. Somewhere a sailor is hopping.',
  tin: 'Contents: mystery. Label: gone. Vibes: rusty.',
};

// ---------------------------------------------------------------------------
// Wildlife sightings for the logbook
// ---------------------------------------------------------------------------
export const CREATURES = [
  { id: 'gull', name: 'Seagulls', hint: 'Circle above the nearest island.' },
  { id: 'flyingfish', name: 'Flying Fish', hint: 'Leap beside fast boats.' },
  { id: 'dolphin', name: 'Dolphin Pod', hint: 'Race boats that are really moving.' },
  { id: 'turtle', name: 'Sea Turtle', hint: 'Drifts in turquoise shallows.' },
  { id: 'jelly', name: 'Glow Jellies', hint: 'Only rise after dark.' },
  { id: 'whale', name: 'Humpback Whale', hint: 'Breaches far from shore, rarely.' },
  { id: 'ghost', name: 'The Ghost Ship', hint: 'Sails at midnight. Follow it.' },
];

// ---------------------------------------------------------------------------
// Shipwright: upgrades and cosmetics
// ---------------------------------------------------------------------------
export const UPGRADES = [
  { id: 'hull', name: 'Copper Hull', desc: 'Top speed +8% per level', costs: [25, 60, 120] },
  { id: 'rudder', name: 'Oak Rudder', desc: 'Sharper turning +12% per level', costs: [20, 50, 100] },
  { id: 'rigging', name: 'Racing Rigging', desc: 'Sail closer to the wind', costs: [30, 70, 140] },
  { id: 'spyglass', name: 'Spyglass', desc: 'Radar range +25% per level', costs: [20, 45, 90] },
  { id: 'net', name: 'Bottle Net', desc: 'Scoop bottles from further away', costs: [15, 40, 80] },
  { id: 'lantern', name: 'Brass Lantern', desc: 'Brighter nights, slower fuel burn', costs: [20, 50, 100] },
  { id: 'rod', name: 'Fishing Rod', desc: 'Wider catch zone, rarer bites', costs: [25, 60, 130] },
];

// unlock: { aspect: 'Ember', count: 3 } | { pearls: n } | { story: true } | null
export const SAILS = [
  { id: 'classic', name: 'Classic Canvas', main: '#fff6e2', jib: '#f0733c', hull: '#1d4f7c', flag: '#e2413a', unlock: null },
  { id: 'tide', name: 'Tidewater', main: '#dff6ff', jib: '#3fd6ff', hull: '#14597a', flag: '#3fd6ff', unlock: { aspect: 'Tide', count: 3 } },
  { id: 'dawn', name: 'First Light', main: '#fff1d6', jib: '#ffb347', hull: '#8a4b1f', flag: '#ffb347', unlock: { aspect: 'Dawn', count: 3 } },
  { id: 'ember', name: 'Ember Sails', main: '#ffe2d6', jib: '#ff5a4d', hull: '#5a1a17', flag: '#ffcf4d', unlock: { aspect: 'Ember', count: 3 } },
  { id: 'moss', name: 'Mossback', main: '#eaf7e0', jib: '#55c46a', hull: '#24502c', flag: '#7dff8a', unlock: { aspect: 'Moss', count: 3 } },
  { id: 'stars', name: 'Night Weaver', main: '#2b2a55', jib: '#b79bff', hull: '#151436', flag: '#ffe89a', unlock: { aspect: 'Stars', count: 3 } },
  { id: 'coral', name: 'Coral Bloom', main: '#ffe8f2', jib: '#ff7fc2', hull: '#7a2d55', flag: '#ff7fc2', unlock: { aspect: 'Coral', count: 3 } },
  { id: 'gale', name: 'Gale Runner', main: '#e6fffa', jib: '#5effd9', hull: '#1e6b62', flag: '#ffffff', unlock: { aspect: 'Gale', count: 3 } },
  { id: 'royal', name: 'Royal Regalia', main: '#3a2a7a', jib: '#ffcf4d', hull: '#1a1240', flag: '#ffcf4d', unlock: { pearls: 150 } },
  { id: 'pirate', name: 'Jolly Roger', main: '#1b1b1f', jib: '#2b2b30', hull: '#2a1a10', flag: '#f0f0f0', unlock: { pearls: 200 } },
  { id: 'wren', name: 'The Marigold', main: '#fff4b8', jib: '#ffd34d', hull: '#7a5a14', flag: '#ffd34d', unlock: { story: true } },
  { id: 'seven', name: 'Seven Stars', main: '#ffffff', jib: '#b79bff', hull: '#0e2a4a', flag: '#ff7fc2', unlock: { constellation: true } },
];

// ---------------------------------------------------------------------------
// Daily bounties (three picked per day from the date)
// ---------------------------------------------------------------------------
export const BOUNTIES = [
  { id: 'shrines', text: (n) => `Wake ${n} shrines`, n: [3, 4, 5], stat: 'shrines', pearls: 20 },
  { id: 'bottles', text: (n) => `Find ${n} bottles`, n: [2, 3, 4], stat: 'bottles', pearls: 15 },
  { id: 'leagues', text: (n) => `Sail ${n} leagues`, n: [4, 6, 8], stat: 'leagues', pearls: 15 },
  { id: 'fish', text: (n) => `Catch ${n} fish`, n: [3, 5, 6], stat: 'fish', pearls: 20 },
  { id: 'night', text: (n) => `Wake ${n} shrine${n > 1 ? 's' : ''} at night`, n: [1, 2], stat: 'nightShrines', pearls: 25 },
  { id: 'gates', text: (n) => `Pass ${n} regatta gates`, n: [5, 10], stat: 'gates', pearls: 20 },
  { id: 'speed', text: (n) => `Reach ${n} knots`, n: [20, 22], stat: 'topKnots', pearls: 15 },
  { id: 'storm', text: (n) => `Sail ${n} league${n > 1 ? 's' : ''} through a storm`, n: [1, 2], stat: 'stormLeagues', pearls: 25 },
  { id: 'trial', text: (n) => `Complete ${n} shrine trial${n > 1 ? 's' : ''}`, n: [1, 2], stat: 'trials', pearls: 25 },
];

export const MILESTONES = [
  { stat: 'shrines', at: [10, 25, 50, 100], text: (n) => `${n} shrines awakened` },
  { stat: 'leagues', at: [10, 50, 100, 250], text: (n) => `${n} leagues sailed` },
  { stat: 'bottles', at: [10, 25, 50], text: (n) => `${n} bottles read` },
  { stat: 'fish', at: [10, 50, 100], text: (n) => `${n} fish caught` },
];
