import { DEFAULT_PROFILE, OUTFITS, HAIR_STYLES } from './game-data.js';

const KEY = 'killamani-maze-profile-v1';

function copy(value) { return JSON.parse(JSON.stringify(value)); }

export function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!saved || typeof saved !== 'object') return copy(DEFAULT_PROFILE);
    return {
      ...copy(DEFAULT_PROFILE), ...saved,
      story: { ...DEFAULT_PROFILE.story, ...(saved.story || {}) },
      completed: saved.completed || {}, unlocks: saved.unlocks || [],
      furniture: saved.furniture || [], badges: saved.badges || [], friends: saved.friends || [],
      cosmetics: saved.cosmetics || [], jewelry: saved.jewelry || [], cars: saved.cars || [], areas: saved.areas || [], nameplates: saved.nameplates || [],
      gameProgress: saved.gameProgress || {}
    };
  } catch { return copy(DEFAULT_PROFILE); }
}

export function saveProfile(profile) {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* storage can be disabled in private browsing */ }
}

export function setName(profile, name) {
  const clean = String(name || '').trim().slice(0, 18);
  if (clean) profile.name = clean;
  saveProfile(profile);
}

export function setOutfit(profile, id) {
  const outfit = OUTFITS.find(o => o.id === id);
  if (outfit && (!outfit.unlock || profile.unlocks.includes(outfit.unlock))) profile.outfit = id;
  saveProfile(profile);
}

export function setHair(profile, id) {
  if (HAIR_STYLES.some(s => s.id === id)) profile.hair = id;
  saveProfile(profile);
}

export function setHairStyle(profile, id) {
  if (['long-waves', 'sleek', 'bob', 'updo'].includes(id)) profile.hairStyle = id;
  saveProfile(profile);
}

export function setAccessory(profile, id) {
  const options = { 'gold-hoops': null, 'ruby-halo': 'Ruby Halo Earrings', 'crystal-drops': 'Sunset Prism Cuff' };
  if (Object.hasOwn(options, id) && (!options[id] || profile.unlocks.includes(options[id]))) profile.accessory = id;
  saveProfile(profile);
}

export function earnReward(profile, game, seconds) {
  const prior = profile.completed[game.id];
  const firstClear = !prior?.claimed;
  profile.completed[game.id] = { claimed: true, bestSeconds: prior?.bestSeconds ? Math.min(prior.bestSeconds, seconds) : seconds, clearedAt: Date.now() };
  if (firstClear) {
    profile.coins += game.reward.coins;
    profile.reputation += game.reward.reputation;
    profile.xp += game.reward.reputation * 2;
    profile.badges = Array.from(new Set([...profile.badges, game.reward.badge]));
    profile.cosmetics = Array.from(new Set([...profile.cosmetics, game.reward.cosmetic]));
    if (game.reward.jewelry) profile.jewelry = Array.from(new Set([...profile.jewelry, game.reward.jewelry]));
    if (game.reward.car) profile.cars = Array.from(new Set([...profile.cars, game.reward.car]));
    if (game.reward.area) profile.areas = Array.from(new Set([...profile.areas, game.reward.area]));
    if (game.reward.nameplate) profile.nameplates = Array.from(new Set([...profile.nameplates, game.reward.nameplate]));
    profile.unlocks = Array.from(new Set([...profile.unlocks, game.reward.badge, game.reward.cosmetic, game.reward.jewelry, game.reward.car, game.reward.area, game.reward.nameplate].filter(Boolean)));
    profile.furniture = Array.from(new Set([...profile.furniture, game.reward.furniture]));
    profile.level = 1 + Math.floor(profile.xp / 250);
  }
  saveProfile(profile);
  return { firstClear };
}

export function updateStory(profile, patch) {
  profile.story = { ...profile.story, ...patch };
  saveProfile(profile);
}
