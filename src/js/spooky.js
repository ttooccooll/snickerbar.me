// Cursed names for the printed treats, so every card is a little different.

const ADJECTIVES = [
  "Haunted",
  "Cursed",
  "Ghostly",
  "Wicked",
  "Creepy",
  "Bewitched",
  "Moonlit",
  "Screaming",
  "Sticky",
  "Undead",
  "Enchanted",
  "Petrified",
  "Howling",
  "Frightful",
];

const CANDY = [
  "Nougat",
  "Caramel",
  "Gumdrop",
  "Lollipop",
  "Candy Corn",
  "Toffee",
  "Jellybean",
  "Fudge",
  "Bonbon",
  "Marshmallow",
  "Licorice",
  "Taffy",
  "Truffle",
];

const DOOM = [
  "of Doom",
  "of Eternal Screaming",
  "from Beyond the Grave",
  "of the Crypt",
  "of Midnight",
  "of the Blood Moon",
  "of Unspeakable Sweetness",
  "from the Haunted Mint",
  "of the Cackling Witch",
  "of a Thousand Bats",
  "of Certain Cavities",
  "of the Headless Satoshi",
];

/**
 * Small deterministic string hash (FNV-1a), so a treat keeps its name.
 */
export function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * "The Haunted Nougat of Eternal Screaming", always the same for a seed.
 */
export function treatName(seed) {
  const h = hashString(String(seed));
  const adjective = ADJECTIVES[h % ADJECTIVES.length];
  const candy = CANDY[Math.floor(h / ADJECTIVES.length) % CANDY.length];
  const doom =
    DOOM[Math.floor(h / (ADJECTIVES.length * CANDY.length)) % DOOM.length];
  return `The ${adjective} ${candy} ${doom}`;
}
