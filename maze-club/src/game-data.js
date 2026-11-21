export const GAME_ORDER = ['ruby', 'vault', 'penthouse'];

export const PARTY_ROLES = {
  ruby: ['Scout', 'Clue Tracker', 'Gate Unlocker', 'Guide'],
  vault: ['Scout', 'Security Specialist', 'Coin Collector', 'Vault Operator'],
  penthouse: ['Clue Finder', 'Mirror Solver', 'Diplomat', 'Explorer']
};

export const GAMES = {
  ruby: {
    id: 'ruby', title: 'Ruby Run', eyebrow: 'The Emerald Maze', mood: 'Night blooms after dark',
    objective: 'Find 3 ruby clues, open both crystal gates, and reach the casino exit.',
    collectible: 'Ruby clue', collectiblePlural: 'ruby clues', needed: 3, gates: 2, timer: 0,
    theme: { sky: 0x081824, fog: 0x13251f, floor: 0x16312c, floorAlt: 0x244339, wall: 0x123a2a, trim: 0xd4a65b, glow: 0xff315f, light: 0x76b89a, accent: 0xf5d596 },
    reward: { coins: 450, reputation: 50, badge: 'Ruby Pathfinder', cosmetic: 'Emerald Night Suit', jewelry: 'Ruby Halo Earrings', furniture: 'Rose Lantern', nameplate: 'Emerald Scout', area: 'Rose Garden Passage' },
    board: '/concept/ruby-run.png', subtitle: 'Read the clues. Trust your instincts. Find your way out.'
  },
  vault: {
    id: 'vault', title: 'Vault Run', eyebrow: 'Below Killamani Casino', mood: 'Every second counts',
    objective: 'Collect 6 Killa Coins, disarm the two laser relays, and reach the Main Vault before time runs out.',
    collectible: 'Killa Coin', collectiblePlural: 'Killa Coins', needed: 6, gates: 0, timer: 240,
    theme: { sky: 0x110b11, fog: 0x211218, floor: 0x17141a, floorAlt: 0x242027, wall: 0x4c3926, trim: 0xe0b65f, glow: 0xff3354, light: 0xffb55c, accent: 0xffe7b1 },
    reward: { coins: 700, reputation: 85, badge: 'Main Vault Crew', cosmetic: 'Midnight Vault Fit', jewelry: 'Gold Vault Cuff', furniture: 'Killa Coin Display', car: 'Aurum Royale Coupe', area: 'Lower Baccarat Lounge', nameplate: 'Vault Operator' },
    board: '/concept/vault-run.png', subtitle: 'Split roles, watch the beams, and get the crew to the vault.'
  },
  penthouse: {
    id: 'penthouse', title: 'Penthouse Escape', eyebrow: 'Episode 3 · The Hidden Elevator', mood: 'Some secrets change everything',
    objective: 'Solve 4 ruby clues, align the mirrors, reunite with your friend, and choose what happens next.',
    collectible: 'Ruby clue', collectiblePlural: 'ruby clues', needed: 4, gates: 0, timer: 0,
    theme: { sky: 0x282038, fog: 0x3b2839, floor: 0xc2b39e, floorAlt: 0xe0d5c5, wall: 0xe4dacd, trim: 0xd9ae66, glow: 0xc42362, light: 0xf3bc86, accent: 0xffe6bd },
    reward: { coins: 850, reputation: 110, badge: 'Penthouse Confidante', cosmetic: 'Gala Afterglow', jewelry: 'Sunset Prism Cuff', furniture: 'Ruby Velvet Chaise', area: 'Penthouse Rooftop Club', nameplate: 'Afterglow Confidante' },
    board: '/concept/penthouse-escape.png', subtitle: 'Four clues. One friend. A choice you cannot take back.'
  }
};

export const DEFAULT_PROFILE = {
  id: crypto.randomUUID?.() ?? `player-${Math.random().toString(36).slice(2)}`,
  name: 'Kimia', coins: 2740, reputation: 0, level: 1, xp: 0,
  outfit: 'ruby-noir', hair: 'split-ruby', hairStyle: 'long-waves', accessory: 'gold-hoops', traits: ['Bold', 'Social'],
  unlocks: [], furniture: [], badges: [], friends: [], cosmetics: [], jewelry: [], cars: [], areas: [], nameplates: [], completed: {}, gameProgress: {},
  story: { trust: 0, reputation: 0, secret: null, ending: null },
  prefs: { reducedMotion: false }
};

export const OUTFITS = [
  { id: 'ruby-noir', label: 'Ruby Power Suit', swatch: '#9f2547', unlock: null },
  { id: 'gold-operator', label: 'Champagne Operator', swatch: '#d8bd8d', unlock: 'Main Vault Crew' },
  { id: 'gala-afterglow', label: 'Gala Afterglow', swatch: '#e8c6b0', unlock: 'Penthouse Confidante' },
  { id: 'emerald-night', label: 'Emerald Night Suit', swatch: '#28614c', unlock: 'Ruby Pathfinder' },
  { id: 'midnight-vault', label: 'Midnight Vault Fit', swatch: '#23242a', unlock: 'Main Vault Crew' }
];

export const HAIR_STYLES = [
  { id: 'split-ruby', label: 'Ruby / blonde', colors: ['#cb263f', '#e9c6a0'] },
  { id: 'dark-gold', label: 'Espresso / gold', colors: ['#211913', '#b68845'] },
  { id: 'plum', label: 'Deep plum', colors: ['#522444', '#522444'] },
  { id: 'honey', label: 'Honey blonde', colors: ['#d8ae69', '#d8ae69'] }
];

export const HAIR_CUTS = [
  { id: 'long-waves', label: 'Long waves' },
  { id: 'sleek', label: 'Sleek' },
  { id: 'bob', label: 'Soft bob' },
  { id: 'updo', label: 'Evening updo' }
];

export const ACCESSORIES = [
  { id: 'gold-hoops', label: 'Gold hoops', swatch: '#ddbb72', unlock: null },
  { id: 'ruby-halo', label: 'Ruby halo', swatch: '#f0446e', unlock: 'Ruby Halo Earrings' },
  { id: 'crystal-drops', label: 'Crystal drops', swatch: '#cde8ea', unlock: 'Penthouse Confidante' }
];

export function outfitFor(profile) {
  return OUTFITS.find(o => o.id === profile.outfit) || OUTFITS[0];
}

export function hairFor(profile) {
  return HAIR_STYLES.find(h => h.id === profile.hair) || HAIR_STYLES[0];
}
