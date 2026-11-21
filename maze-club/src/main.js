import './style.css';
import { GameUI } from './ui.js';
import { GAMES, PARTY_ROLES } from './game-data.js';
import { loadProfile, saveProfile, setName, setOutfit, setHair, setHairStyle, setAccessory, earnReward, updateStory } from './profile.js';
import { PartyClient, inviteUrl } from './party.js';
import { MazeMusic } from './audio.js';

const canvas = document.querySelector('#game-canvas');
const ui = new GameUI(document.querySelector('#interface'));
const music = new MazeMusic();
let profile = loadProfile();
let THREE = null, scene = null, camera = null, renderer = null;
let createWorld, gridCellFromWorld, worldPositionForCell, createAvatar, loadAvatarOverride, applyAvatarGLB;
let enginePromise = null, engineFailed = false;
let world = null, player = null, gameId = null, state = null;
let elapsed = 0, lastUi = 0, lastMap = 0, lastLabels = 0, lastProgress = 0;
let keys = new Set(), movePath = [], movePathIndex = 0;
let cameraYaw = 0, currentTarget = null, paused = false;
let inviteLink = '', partyStatus = 'offline', partyMembers = [], remotePlayers = new Map();
let previewSeed = null;
const query = new URLSearchParams(location.search);
const invitedRoom = query.get('party');
const invitedSeed = query.get('seed');
const invitedGame = query.get('game');
const seenEvents = new Set();

async function ensureEngine() {
  if (renderer) return true;
  if (engineFailed) return false;
  if (!enginePromise) enginePromise = (async () => {
    try {
      const [threeModule, worldModule, avatarModule] = await Promise.all([import('three'), import('./world.js'), import('./avatar.js')]);
      THREE = threeModule;
      createWorld = worldModule.createWorld;
      gridCellFromWorld = worldModule.gridCellFromWorld;
      worldPositionForCell = worldModule.worldPositionForCell;
      createAvatar = avatarModule.createAvatar;
      loadAvatarOverride = avatarModule.loadAvatarOverride;
      applyAvatarGLB = avatarModule.applyAvatarGLB;
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(53, innerWidth / innerHeight, 0.1, 420);
      const mobile = matchMedia('(max-width: 850px)').matches;
      renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.3 : 1.7));
      renderer.setSize(innerWidth, innerHeight, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      renderer.shadowMap.enabled = !mobile;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      scene.background = new THREE.Color('#140e14');
      camera.position.set(0, 8, 13);
      return true;
    } catch (error) {
      engineFailed = true;
      document.querySelector('#interface').insertAdjacentHTML('beforeend', `<div class="engine-error"><h1>3D needs WebGL</h1><p>Open the game in a browser with hardware acceleration enabled, then try again.</p></div>`);
      return false;
    }
  })();
  return enginePromise;
}

function setUrlParty(room, seed, id) {
  const url = new URL(location.href);
  url.searchParams.set('party', room); url.searchParams.set('seed', String(seed)); url.searchParams.set('game', id);
  history.replaceState({}, '', url);
}

function refreshPartyPanel() {
  ui.renderParty({ status: partyStatus, room: party.room, members: partyMembers, link: inviteLink });
}

const party = new PartyClient(profile, {
  onStatus(status, message) {
    partyStatus = status;
    ui.setPartyStatus(status, partyMembers.length || 1);
    if (status === 'error') ui.toast(message || 'Could not join that party.');
    if (ui.partyOpen) refreshPartyPanel();
  },
  onMembers(members) {
    partyMembers = members;
    for (const member of members) {
      if (!member.id || member.id === profile.id) continue;
      const entry = profile.friends.find(friend => friend.id === member.id);
      if (entry) entry.name = member.name || entry.name;
      else profile.friends.push({ id: member.id, name: member.name || 'Player', metAt: Date.now() });
    }
    saveProfile(profile);
    ui.setPartyStatus(partyStatus, members.length || 1);
    syncRemoteMembers(members);
    if (ui.partyOpen) refreshPartyPanel();
  },
  onPose(data) {
    if (!data || data.id === profile.id) return;
    let remote = remotePlayers.get(data.id);
    if (!remote) { syncRemoteMembers([...partyMembers, data]); remote = remotePlayers.get(data.id); }
    if (!remote) return;
    remote.target.set(data.x || 0, data.y || 0, data.z || 0);
    remote.rotation = data.rotation || 0; remote.moving = !!data.moving;
    remote.name = data.name || remote.name; remote.gameId = data.gameId || '';
    remote.avatar.root.visible = remote.gameId === gameId;
  },
  onEvent(event) { applySharedEvent(event); }
});

function syncRemoteMembers(members) {
  if (!world) return;
  const present = new Set(members.filter(p => p.id !== profile.id).map(p => p.id));
  for (const [id, remote] of remotePlayers) {
    if (!present.has(id)) { world.group.remove(remote.avatar.root); remotePlayers.delete(id); }
  }
  for (const member of members) {
    if (!member.id || member.id === profile.id) continue;
    const remoteProfile = {
      ...profile, id: member.id, name: member.name || 'Player', outfit: member.outfit || 'ruby-noir',
      hair: member.hair || 'split-ruby', hairStyle: member.hairStyle || 'long-waves',
      accessory: member.accessory || 'gold-hoops', traits: Array.isArray(member.traits) ? member.traits.slice(0, 3) : []
    };
    const signature = [remoteProfile.outfit, remoteProfile.hair, remoteProfile.hairStyle, remoteProfile.accessory].join('|');
    const existing = remotePlayers.get(member.id);
    if (existing) {
      existing.name = remoteProfile.name;
      if (existing.signature !== signature) {
        const position = existing.avatar.root.position.clone();
        const visible = existing.avatar.root.visible;
        world.group.remove(existing.avatar.root);
        const avatar = createAvatar(remoteProfile, { name: remoteProfile.name, remote: true });
        avatar.root.position.copy(position); avatar.root.visible = visible; world.group.add(avatar.root);
        existing.avatar = avatar; existing.signature = signature;
        loadAvatarOverride().then(gltf => { if (gltf && remotePlayers.get(member.id)?.avatar === avatar) applyAvatarGLB(avatar, gltf); });
      }
      continue;
    }
    const avatar = createAvatar(remoteProfile, { name: remoteProfile.name, remote: true });
    avatar.root.position.copy(world.startWorld); avatar.root.visible = false; world.group.add(avatar.root);
    remotePlayers.set(member.id, { avatar, target: world.startWorld.clone(), rotation: 0, moving: false, name: remoteProfile.name, gameId: '', signature });
    loadAvatarOverride().then(gltf => { if (gltf && remotePlayers.get(member.id)?.avatar === avatar) applyAvatarGLB(avatar, gltf); });
  }
}

function discardWorld() {
  if (world) world.dispose();
  for (const remote of remotePlayers.values()) remote.avatar.root.parent?.remove(remote.avatar.root);
  remotePlayers.clear(); world = null; player = null; gameId = null; state = null; movePath = [];
}

async function startGame(id, seed = null, forceNew = false) {
  if (!GAMES[id]) return;
  music.start(id);
  if (!(await ensureEngine())) { music.stop(); return; }
  ui.closePanels(); ui.closeDialog();
  saveRunProgress();
  const saved = !forceNew && seed == null && !profile.completed?.[id]?.claimed ? profile.gameProgress?.[id] : null;
  const resume = saved && !saved.completed && (GAMES[id].timer === 0 || saved.timeRemaining > 0) ? saved : null;
  discardWorld();
  gameId = id;
  const seedValue = seed ?? resume?.seed ?? Math.floor(Math.random() * 0xffffffff);
  world = createWorld(scene, id, profile, seedValue);
  player = createAvatar(profile);
  player.root.position.copy(world.startWorld);
  world.group.add(player.root);
  state = {
    collected: new Set(), collectedCount: 0, gatesOpened: 0,
    relays: new Set(), relaysDisabled: 0, mirrors: new Set(), mirrorsSolved: 0,
    friendTalked: false, storyChoice: null, alert: 0, alertCooldown: 0,
    onRooftop: false, complete: false, stamina: 100, emote: null, emoteUntil: 0,
    timeRemaining: resume?.timeRemaining ?? GAMES[id].timer ?? 0, startTime: performance.now(), paused: false
  };
  restoreRunProgress(resume);
  cameraYaw = 0; currentTarget = null; movePath = [];
  camera.position.copy(player.root.position).add(new THREE.Vector3(0, 5.7, 9.4));
  camera.lookAt(player.root.position.x, player.root.position.y + 1.25, player.root.position.z);
  ui.showGame(id, profile); ui.setSoundState(music.muted); ui.showPrompt(null);
  ui.toast(id === 'ruby' ? 'Find the first ruby clue. The gates will open as you go.' : id === 'vault' ? 'Split up to collect coins. Watch the red beams.' : 'Find four clues, align the mirrors, and look for Zuri.');
  loadAvatarOverride().then(gltf => { if (gltf && player && gameId === id) applyAvatarGLB(player, gltf); });
  if (invitedRoom && !party.room && seed !== null) {
    inviteLink = location.href; party.join(invitedRoom); refreshPartyPanel();
    ui.toast(`Joining party ${invitedRoom.toUpperCase()}…`);
    ui.togglePanel('party');
  } else if (party.room) {
    syncRemoteMembers(partyMembers);
  }
}

function restoreRunProgress(saved) {
  if (!saved || !world || !state) return;
  for (const id of saved.collected || []) {
    const item = [...world.maze.items, ...world.maze.switches, ...world.maze.mirrors].find(i => i.id === id);
    if (!item) continue;
    state.collected.add(id);
    if (item.type === 'clue' || item.type === 'coin') state.collectedCount++;
    world.setItemTaken(id);
  }
  for (const id of saved.relays || []) { state.relays.add(id); world.setRelayDisabled(id, true); world.setItemTaken(id); }
  for (const [id, turns] of Object.entries(saved.mirrorTurns || {})) {
    const solved = world.turnMirror(id, turns);
    if (solved) { state.mirrors.add(id); world.setItemTaken(id); }
  }
  for (const id of saved.mirrors || []) { state.mirrors.add(id); world.setItemTaken(id); }
  state.relaysDisabled = state.relays.size; state.mirrorsSolved = state.mirrors.size;
  world.maze.gates.forEach(gate => { if (state.collectedCount >= gate.requires) world.setGateOpen(gate.id, true); });
  state.gatesOpened = world.maze.gates.filter(g => g.open).length;
  state.friendTalked = !!saved.friendTalked; state.storyChoice = saved.storyChoice || null;
  state.stamina = saved.stamina ?? 100;
  if (saved.position && !saved.onRooftop) {
    player.root.position.set(saved.position.x, 0, saved.position.z); player.root.rotation.y = saved.position.rotation || 0;
  }
  if (saved.onRooftop && gameId === 'penthouse' && state.storyChoice) {
    state.onRooftop = true; world.setElevatorRevealed(true); world.beginRooftop(player);
  } else if (gameId === 'penthouse' && state.collectedCount >= 4 && state.mirrorsSolved >= 3) world.setElevatorRevealed(true);
  state.startTime = performance.now() - (saved.elapsedSeconds || 0) * 1000;
}

function saveRunProgress() {
  if (!world || !state || !gameId) return;
  profile.gameProgress ||= {};
  profile.gameProgress[gameId] = {
    seed: world.maze.seed, collected: [...state.collected], relays: [...state.relays], mirrors: [...state.mirrors],
    mirrorTurns: Object.fromEntries(world.maze.mirrors.map(m => [m.id, m.turns || 0])),
    friendTalked: state.friendTalked, storyChoice: state.storyChoice, onRooftop: state.onRooftop,
    timeRemaining: state.timeRemaining, elapsedSeconds: Math.floor((performance.now() - state.startTime) / 1000), stamina: state.stamina,
    position: player && !state.onRooftop ? { x: player.root.position.x, z: player.root.position.z, rotation: player.root.rotation.y } : null,
    completed: !!profile.completed?.[gameId]?.claimed
  };
  saveProfile(profile);
}

function toHub() {
  saveRunProgress();
  music.stop();
  if (party.room) party.leave();
  partyStatus = 'offline'; partyMembers = []; inviteLink = '';
  discardWorld(); ui.showHub(profile);
  if (scene) { scene.background = new THREE.Color('#140e14'); scene.fog = null; }
}

function makeInvite() {
  if (!world) return;
  if (!party.room) {
    const room = party.createRoom();
    inviteLink = inviteUrl(room, world.maze.seed, gameId);
    setUrlParty(room, world.maze.seed, gameId);
  } else inviteLink = inviteUrl(party.room, world.maze.seed, gameId);
  refreshPartyPanel();
  ui.toast('Party link ready. Send it to up to three friends.');
}

async function copyInvite() {
  if (!inviteLink && world && party.room) inviteLink = inviteUrl(party.room, world.maze.seed, gameId);
  if (!inviteLink) { ui.toast('Create a party link first.'); return; }
  try {
    await navigator.clipboard.writeText(inviteLink);
    ui.toast('Invite link copied. Send it to your friends.');
  } catch {
    const input = document.createElement('textarea'); input.value = inviteLink; document.body.appendChild(input); input.select();
    try { document.execCommand('copy'); ui.toast('Invite link copied.'); } catch { ui.toast('Copy the invite link shown in this panel.'); }
    input.remove();
  }
}

function emitEvent(kind, id, choice = '') {
  const event = { gameId, kind, id, choice, eventId: `${profile.id}:${performance.now().toFixed(0)}:${Math.random().toString(36).slice(2, 6)}` };
  applySharedEvent(event, true);
  party.event(event);
}

function applySharedEvent(event, local = false) {
  if (!world || !state || !event || event.gameId !== gameId) return;
  if (event.eventId && seenEvents.has(event.eventId)) return;
  if (event.eventId) { seenEvents.add(event.eventId); if (seenEvents.size > 600) seenEvents.clear(); }
  if (event.kind === 'collect') {
    if (state.collected.has(event.id)) return;
    const item = [...world.maze.items, ...world.maze.switches, ...world.maze.mirrors].find(i => i.id === event.id);
    if (!item) return;
    state.collected.add(event.id);
    if (item.type === 'clue' || item.type === 'coin') state.collectedCount++;
    if (item.type === 'secret') {
      if (!profile.unlocks.includes('Hidden Jewel')) {
        profile.unlocks.push('Hidden Jewel'); profile.coins += 100; saveProfile(profile);
      }
      ui.toast('Hidden room found · 100 Killa Coins and a jewel unlocked.');
    } else if (item.type === 'coin') ui.toast('Killa Coin collected.');
    else if (item.clueText) ui.toast(`Clue ${Number(item.id.split('-')[1]) + 1}: ${item.clueText}`);
    else ui.toast('Ruby clue collected.');
    world.setItemTaken(event.id);
    if (gameId === 'ruby') {
      world.maze.gates.forEach(gate => {
        if (!gate.open && state.collectedCount >= gate.requires) {
          world.setGateOpen(gate.id, true);
          if (local) ui.toast(`Ruby Gate ${Number(gate.id.split('-')[1]) + 1} unlocked.`);
        }
      });
      state.gatesOpened = world.maze.gates.filter(g => g.open).length;
    }
  } else if (event.kind === 'relay') {
    if (state.relays.has(event.id)) return;
    state.relays.add(event.id); state.relaysDisabled = state.relays.size;
    world.setRelayDisabled(event.id, true); world.setItemTaken(event.id);
    if (local) ui.toast('Laser relay disabled. That corridor is clear.');
  } else if (event.kind === 'mirror-turn') {
    const mirror = world.maze.mirrors.find(item => item.id === event.id);
    if (!mirror || mirror.solved) return;
    const turns = Number(event.choice);
    const solved = world.turnMirror(event.id, Number.isFinite(turns) ? turns : (mirror.turns + 1) % 4);
    if (solved) {
      state.mirrors.add(event.id); state.mirrorsSolved = state.mirrors.size; world.setItemTaken(event.id);
      if (local) ui.toast(`Mirror ${Number(event.id.split('-')[1]) + 1} aligned · ${state.mirrorsSolved}/3.`);
    } else if (local) ui.toast(`Mirror ${Number(event.id.split('-')[1]) + 1} turns. Check the clue and adjust again.`);
  } else if (event.kind === 'friend-choice') {
    if (state.storyChoice) return;
    applyStoryChoice(event.choice, local, false);
  } else if (event.kind === 'lift') {
    if (local) world.useLift(player);
    else world.activateLift();
  } else if (event.kind === 'exit') {
    if (gameId === 'penthouse') {
      if (!state.onRooftop && state.collectedCount >= 4 && state.mirrorsSolved >= 3 && state.friendTalked && state.storyChoice) {
        state.onRooftop = true; world.beginRooftop(player);
        if (local) ui.toast('The elevator opens onto a rooftop at sunset.');
      }
    } else if (!state.complete) completeGame(true);
  } else if (event.kind === 'emote') {
    const remote = remotePlayers.get(event.from);
    if (remote) { remote.emote = event.choice; remote.emoteUntil = elapsed + 1.2; }
    const member = partyMembers.find(p => p.id === event.from);
    if (member) ui.toast(`${member.name} sent a ${event.choice}.`);
  }
  saveRunProgress();
}

function applyStoryChoice(choice, local = true, emit = true) {
  if (state.storyChoice) return;
  const delta = (choice === 'truth' ? 22 : choice === 'secret' ? -2 : -12) + (choice === 'truth' && profile.traits.includes('Loyal') ? 8 : 0);
  const reputation = (choice === 'rival' ? 24 : choice === 'truth' ? 12 : 0) + (choice === 'rival' && profile.traits.includes('Bold') ? 6 : 0);
  const nextStory = { trust: (profile.story.trust || 0) + delta, reputation: (profile.story.reputation || 0) + reputation, secret: choice, ending: choice };
  updateStory(profile, nextStory);
  profile.reputation += reputation; profile.xp += reputation * 2; profile.level = 1 + Math.floor(profile.xp / 250); saveProfile(profile);
  state.storyChoice = choice; state.friendTalked = true;
  const friend = world.npcs.find(n => n.id === 'friend'); if (friend) friend.mood = choice === 'truth' ? 'trusting' : choice === 'secret' ? 'uncertain' : 'distant';
  const rival = world.npcs.find(n => n.id === 'rival'); if (rival) rival.mood = choice === 'rival' ? 'impressed' : 'watchful';
  ui.closeDialog(); ui.updateProfile(profile);
  ui.toast(choice === 'truth' ? 'Zuri trusts you with the truth.' : choice === 'secret' ? 'The secret stays between you and the past.' : 'Raven realizes you are not backing down.');
  if (emit) party.event({ gameId, kind: 'friend-choice', id: 'friend', choice });
  saveRunProgress();
}

function completeGame(announce = true) {
  if (state.complete) return;
  state.complete = true;
  const seconds = Math.max(0, Math.floor((performance.now() - state.startTime) / 1000));
  const result = earnReward(profile, GAMES[gameId], seconds);
  saveRunProgress();
  ui.updateProfile(profile);
  if (announce) ui.showDialog('clear', { title: `${GAMES[gameId].title} complete`, message: 'Your crew made it through. The reward is added to your shared profile.', game: GAMES[gameId], firstClear: result.firstClear });
}

function finishPenthouse() {
  if (state.complete) return;
  state.complete = true;
  const seconds = Math.floor((performance.now() - state.startTime) / 1000);
  const result = earnReward(profile, GAMES.penthouse, seconds);
  saveRunProgress();
  const mood = state.storyChoice === 'truth' ? 'Closer' : state.storyChoice === 'secret' ? 'Still wondering' : 'Careful';
  ui.updateProfile(profile);
  ui.showDialog('ending', {
    choice: state.storyChoice, trust: Math.max(0, Math.min(100, 50 + profile.story.trust)),
    reputation: profile.reputation, friendMood: mood, badge: GAMES.penthouse.reward.badge,
    firstClear: result.firstClear, reward: GAMES.penthouse.reward
  });
}

function nearestInteraction() {
  if (!world || !player || state.onRooftop && gameId !== 'penthouse') return null;
  let best = null, bestDistance = 1.95;
  for (const target of world.interactables) {
    const item = target.item;
    if (item && (!item.active || (item.type === 'mirror' && item.solved))) continue;
    if (target.type === 'exit' && !world.exit.visible) continue;
    const p = target.position;
    if (!p) continue;
    const distance = Math.hypot(player.root.position.x - p.x, player.root.position.z - p.z);
    if (distance < bestDistance) { best = target; bestDistance = distance; }
  }
  return best;
}

function promptFor(target) {
  if (!target) return null;
  if (target.type === 'clue') return 'Inspect ruby clue';
  if (target.type === 'coin') return 'Collect Killa Coin';
  if (target.type === 'secret') return 'Take hidden jewel';
  if (target.type === 'relay') return 'Disable laser relay';
  if (target.type === 'lift') return 'Ride vault lift';
  if (target.type === 'mirror') return 'Turn mirror';
  if (target.type === 'friend') return state.onRooftop ? 'Talk with Zuri' : state.storyChoice ? 'Check in with Zuri' : 'Talk to Zuri';
  if (target.type === 'rival') return 'Speak with Raven';
  if (target.type === 'exit') return gameId === 'penthouse' ? (state.onRooftop ? 'Find Zuri' : 'Enter hidden elevator') : gameId === 'vault' ? 'Open Main Vault' : 'Reach casino exit';
  return 'Interact';
}

function interact() {
  if (!world || !state || state.complete || paused || ui.profileOpen || ui.journalOpen || ui.partyOpen || !ui.host.querySelector('#dialog-card').classList.contains('hidden')) return;
  const target = currentTarget || nearestInteraction();
  if (!target) { ui.toast('Move closer to an object first.'); return; }
  if (target.type === 'clue' || target.type === 'coin' || target.type === 'secret') {
    emitEvent('collect', target.id);
  } else if (target.type === 'relay') {
    emitEvent('relay', target.id);
  } else if (target.type === 'lift') {
    emitEvent('lift', target.id);
  } else if (target.type === 'mirror') {
    const mirror = world.maze.mirrors.find(item => item.id === target.id);
    const turns = ((mirror?.turns || 0) + 1) % 4;
    emitEvent('mirror-turn', target.id, String(turns));
  } else if (target.type === 'friend') {
    if (state.onRooftop) { finishPenthouse(); return; }
    if (state.storyChoice) { ui.toast(state.storyChoice === 'truth' ? 'Zuri is ready to get out of here.' : 'Zuri waits for you to decide what comes next.'); return; }
    ui.showDialog('friend');
  } else if (target.type === 'rival') {
    if (state.storyChoice) { ui.toast('Raven watches from the mirrored hall.'); return; }
    ui.showDialog('rival');
  } else if (target.type === 'exit') {
    if (gameId === 'ruby') {
      if (state.collectedCount < 3 || state.gatesOpened < 2) { ui.toast(`Find ${Math.max(0, 3 - state.collectedCount)} more ruby clue${state.collectedCount === 2 ? '' : 's'} first.`); return; }
      emitEvent('exit', 'casino-exit');
    } else if (gameId === 'vault') {
      if (state.collectedCount < 6 || state.relaysDisabled < 2) { ui.toast('The vault needs all 6 coins and both relays disabled.'); return; }
      if (state.timeRemaining <= 0) return;
      emitEvent('exit', 'main-vault');
    } else {
      if (state.collectedCount < 4 || state.mirrorsSolved < 3) { ui.toast('Find all four rubies and align the three mirrors.'); return; }
      if (!state.friendTalked || !state.storyChoice) { ui.toast('Talk with Zuri before you take the elevator.'); return; }
      emitEvent('exit', 'hidden-elevator');
    }
  }
}

function setNameplates(time) {
  if (!world || !player || time - lastLabels < 180) return;
  lastLabels = time;
  const entries = [];
  const add = (name, note, position, visible = true) => {
    if (!visible) return;
    const p = position.clone().add(new THREE.Vector3(0, 2.65, 0)).project(camera);
    if (p.z < -1 || p.z > 1) return;
    const x = (p.x * 0.5 + 0.5) * innerWidth, y = (-p.y * 0.5 + 0.5) * innerHeight;
    if (x < -50 || x > innerWidth + 50 || y < -50 || y > innerHeight + 40) return;
    entries.push({ name, note, x, y });
  };
  for (const [id, r] of remotePlayers.entries()) {
    const d = Math.round(player.root.position.distanceTo(r.avatar.root.position));
    const memberIndex = partyMembers.findIndex(p => p.id === id);
    const role = memberIndex >= 0 ? PARTY_ROLES[gameId]?.[memberIndex] : '';
    add(r.name, `${d} m · ${role || (r.gameId === gameId ? 'WITH YOU' : 'CONNECTING')}`, r.avatar.root.position, r.avatar.root.visible);
  }
  const myIndex = partyMembers.findIndex(p => p.id === profile.id);
  add(profile.name, myIndex >= 0 ? `YOU · ${PARTY_ROLES[gameId]?.[myIndex] || 'PLAYER'}` : 'YOU', player.root.position);
  for (const npc of world.npcs) add(npc.name, String(npc.mood || '').toUpperCase(), npc.avatar.root.position);
  ui.setNameplates(entries);
}

function movePlayer(dx, dz) {
  if (!world || !player || !state || (!dx && !dz)) return;
  const pos = player.root.position, maze = world.maze;
  const radius = 0.38;
  if (state.onRooftop && world.roofBounds) {
    pos.x = THREE.MathUtils.clamp(pos.x + dx, world.roofBounds.minX, world.roofBounds.maxX);
    pos.z = THREE.MathUtils.clamp(pos.z + dz, world.roofBounds.minZ, world.roofBounds.maxZ);
    return;
  }
  const cell = gridCellFromWorld(pos, maze.size);
  const center = worldPositionForCell(cell, maze.size);
  let nx = pos.x + dx, nz = pos.z + dz;
  const progress = { clues: state.collectedCount };
  const nextCellX = gridCellFromWorld(new THREE.Vector3(nx, 0, pos.z), maze.size);
  if (nextCellX.x !== cell.x && maze.isBlocked(cell, { x: nextCellX.x, z: cell.z }, progress)) {
    nx = cell.x > nextCellX.x ? center.x - CELL_SIZE / 2 + radius : center.x + CELL_SIZE / 2 - radius;
  }
  const afterX = gridCellFromWorld(new THREE.Vector3(nx, 0, pos.z), maze.size);
  const nextCellZ = gridCellFromWorld(new THREE.Vector3(nx, 0, nz), maze.size);
  if (nextCellZ.z !== afterX.z && maze.isBlocked(afterX, { x: afterX.x, z: nextCellZ.z }, progress)) {
    const zCenter = worldPositionForCell(afterX, maze.size).z;
    nz = afterX.z > nextCellZ.z ? zCenter - CELL_SIZE / 2 + radius : zCenter + CELL_SIZE / 2 - radius;
  }
  // Stay inside the map perimeter even when a boundary opening was not generated.
  const max = (maze.size - 1) * CELL_SIZE / 2;
  pos.x = THREE.MathUtils.clamp(nx, -max - CELL_SIZE / 2 + radius, max + CELL_SIZE / 2 - radius);
  pos.z = THREE.MathUtils.clamp(nz, -max - CELL_SIZE / 2 + radius, max + CELL_SIZE / 2 - radius);
}

function startTapMove(clientX, clientY) {
  if (!world || !player || state.onRooftop || state.complete || paused) return;
  const point = new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(point, camera);
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(ground, hit)) return;
  const target = gridCellFromWorld(hit, world.maze.size);
  const from = gridCellFromWorld(player.root.position, world.maze.size);
  const route = world.maze.findRoute(from, target, { clues: state.collectedCount });
  if (!route.length) { ui.toast('That route is blocked. Try another corridor.'); return; }
  movePath = route.slice(1); movePathIndex = 0;
}

function processInput(dt, elapsedTime) {
  if (!world || !player || !state || paused || state.complete || ui.profileOpen || ui.journalOpen || ui.partyOpen || !ui.host.querySelector('#dialog-card').classList.contains('hidden')) {
    player?.animate(dt, elapsedTime, false); return;
  }
  const touch = ui.getMoveInput();
  let x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + touch.x;
  let forward = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - touch.y;
  const hasManual = Math.hypot(x, forward) > 0.12;
  if (hasManual) { movePath = []; movePathIndex = 0; }
  let dirX = 0, dirZ = 0;
  if (hasManual) {
    const length = Math.hypot(x, forward); x /= length; forward /= length;
    dirX = x * Math.cos(cameraYaw) - forward * Math.sin(cameraYaw);
    dirZ = x * -Math.sin(cameraYaw) - forward * Math.cos(cameraYaw);
  } else if (movePathIndex < movePath.length && !state.onRooftop) {
    const nextCell = movePath[movePathIndex], target = worldPositionForCell(nextCell, world.maze.size);
    const dx = target.x - player.root.position.x, dz = target.z - player.root.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.22) movePathIndex++;
    else { dirX = dx / distance; dirZ = dz / distance; }
  }
  const moving = Math.hypot(dirX, dirZ) > 0.01;
  const sprint = moving && (touch.sprint || keys.has('shift')) && state.stamina > 1;
  const speed = sprint ? 7.4 : 4.55;
  if (sprint) state.stamina = Math.max(0, state.stamina - dt * 26);
  else state.stamina = Math.min(100, state.stamina + dt * 17);
  if (moving) {
    movePlayer(dirX * speed * dt, dirZ * speed * dt);
    player.root.rotation.y = Math.atan2(dirX, dirZ);
  }
  player.animate(dt, elapsedTime, moving, sprint);
  if (state.emoteUntil > elapsedTime && state.emote === 'wave') {
    player.arms[0].rotation.z = Math.sin(elapsedTime * 10) * 0.7 - 0.45;
  }
  if (movePathIndex >= movePath.length) movePath = [];
}

function updateSecurity(dt) {
  if (gameId !== 'vault' || !world || !state || state.complete) return;
  const p = player.root.position;
  const beam = world.securityBeams.find(b => b.enabled && Math.hypot(p.x - b.position.x, p.z - b.position.z) < 1.65);
  if (beam) {
    state.alert = Math.min(1, state.alert + dt * 0.3);
    if (state.alert >= 0.98 && state.alertCooldown <= 0) {
      state.alert = 0.28; state.alertCooldown = 6;
      const previous = world.maze.start;
      const start = worldPositionForCell(previous, world.maze.size);
      p.x = start.x; p.z = start.z;
      ui.toast('Security caught you. Reset to the entrance; the countdown keeps running.');
    }
  } else state.alert = Math.max(0, state.alert - dt * 0.055);
  state.alertCooldown = Math.max(0, state.alertCooldown - dt);
}

function handleAction(name, data = {}) {
  if (name === 'play') startGame(data.game || 'ruby');
  else if (name === 'hub') toHub();
  else if (name === 'party') refreshPartyPanel();
  else if (name === 'partyPanelOpen') refreshPartyPanel();
  else if (name === 'create-party') makeInvite();
  else if (name === 'copy-invite') copyInvite();
  else if (name === 'leave-party') { party.leave(); partyStatus = 'offline'; partyMembers = []; inviteLink = ''; ui.setPartyStatus('offline'); refreshPartyPanel(); ui.toast('You left the party.'); }
  else if (name === 'interact') interact();
  else if (name === 'close-dialog') ui.closeDialog();
  else if (name === 'resume') { paused = false; state && (state.paused = false); ui.closeDialog(); }
  else if (name === 'pause') { paused = true; ui.showDialog('pause', { title: GAMES[gameId]?.title }); }
  else if (name === 'complete') { ui.closeDialog(); toHub(); }
  else if (name === 'retry') { const current = gameId; const seed = world?.maze.seed; startGame(current, seed, true); }
  else if (name === 'map') ui.showQuestLog();
  else if (name === 'sound') {
    const muted = music.toggle(); ui.setSoundState(muted);
    ui.toast(muted ? 'Ambient music muted.' : 'Ambient music on.');
  }
  else if (name === 'emote') {
    state.emote = data.emote; state.emoteUntil = elapsed + 1.25;
    party.event({ gameId, kind: 'emote', id: profile.id, choice: data.emote });
    ui.toast(data.emote === 'heart' ? 'Heart sent to your party.' : data.emote === 'cheer' ? 'Your party hears the cheer.' : 'You wave to the crew.');
  }
}

for (const action of ['play','hub','create-party','copy-invite','leave-party','interact','close-dialog','resume','pause','complete','retry','map','emote','sound']) ui.setHandler(action, data => handleAction(action, data));
ui.setHandler('partyPanelOpen', () => refreshPartyPanel());
ui.setHandler('choice', choice => {
  if (gameId === 'penthouse') emitEvent('friend-choice', 'friend', choice);
});
ui.setHandler('style', (kind, value) => {
  if (kind === 'outfit') setOutfit(profile, value);
  else if (kind === 'hair') setHair(profile, value);
  else if (kind === 'hairStyle') setHairStyle(profile, value);
  else if (kind === 'accessory') setAccessory(profile, value);
  party.profile = profile; party.updateProfile();
  ui.updateProfile(profile); replacePlayerAvatar();
});
ui.setHandler('trait', trait => {
  if (profile.traits.includes(trait)) profile.traits = profile.traits.filter(t => t !== trait);
  else if (profile.traits.length < 3) profile.traits.push(trait);
  else { ui.toast('Choose up to three personality traits.'); return; }
  saveProfile(profile); ui.renderProfile(profile);
});
ui.setHandler('name', name => {
  setName(profile, name); party.profile = profile; party.updateProfile();
  ui.updateProfile(profile);
  if (player) { player.name = profile.name; player.root.name = `Avatar:${profile.name}`; }
});

function replacePlayerAvatar() {
  if (!world || !player) return;
  const position = player.root.position.clone(), rotation = player.root.rotation.y;
  world.group.remove(player.root);
  player = createAvatar(profile); player.root.position.copy(position); player.root.rotation.y = rotation;
  world.group.add(player.root);
  loadAvatarOverride().then(gltf => { if (gltf && player) applyAvatarGLB(player, gltf); });
}

window.addEventListener('keydown', event => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
  const key = event.key.toLowerCase();
  if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(key)) { keys.add(key); event.preventDefault(); }
  if (key === 'e' || key === ' ') { event.preventDefault(); interact(); }
  if (key === 'escape') {
    if (ui.profileOpen || ui.journalOpen || ui.partyOpen) ui.closePanels();
    else if (gameId && !paused) handleAction('pause');
    else if (paused) handleAction('resume');
  }
});
window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

let pointer = null;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', event => {
  if (event.button === 2) {
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, look: true, dragged: false };
    canvas.setPointerCapture(event.pointerId); return;
  }
  if (event.button !== 0 || !gameId || paused || state?.complete) return;
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, look: false, dragged: false };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (!pointer || pointer.id !== event.pointerId) return;
  const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
  if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 11) pointer.dragged = true;
  if (pointer.look || pointer.dragged) cameraYaw -= dx * 0.005;
  pointer.x = event.clientX; pointer.y = event.clientY;
});
canvas.addEventListener('pointerup', event => {
  if (!pointer || pointer.id !== event.pointerId) return;
  if (!pointer.look && !pointer.dragged) startTapMove(event.clientX, event.clientY);
  pointer = null;
});
canvas.addEventListener('pointercancel', () => { pointer = null; });

function updateCamera(dt) {
  if (!player) return;
  const p = player.root.position;
  const distance = matchMedia('(max-width: 850px)').matches ? 8.8 : 9.5;
  const desired = new THREE.Vector3(p.x + Math.sin(cameraYaw) * distance, p.y + 5.25, p.z + Math.cos(cameraYaw) * distance);
  camera.position.lerp(desired, 1 - Math.exp(-dt * 5.2));
  camera.lookAt(p.x, p.y + 1.05, p.z);
}

function sendPose(time) {
  if (!player || !world || !party.room) return;
  party.pose({ x: player.root.position.x, y: player.root.position.y, z: player.root.position.z, rotation: player.root.rotation.y, gameId, moving: player.moving }, time);
}

let previousFrame = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  if (!renderer) return;
  const dt = Math.min(0.05, Math.max(0.001, (now - previousFrame) / 1000)); previousFrame = now; elapsed += dt;
  if (world && state) {
    const modalOpen = !ui.host.querySelector('#dialog-card').classList.contains('hidden');
    if (!paused && !modalOpen && !state.complete && gameId === 'vault') {
      state.timeRemaining = Math.max(0, state.timeRemaining - dt);
      if (state.timeRemaining <= 0) { state.complete = true; paused = true; ui.showDialog('timeout'); }
    }
    processInput(dt, elapsed);
    world.update(dt, elapsed);
    for (const remote of remotePlayers.values()) {
      if (!remote.avatar.root.visible) continue;
      remote.avatar.root.position.lerp(remote.target, 1 - Math.exp(-dt * 9));
      remote.avatar.root.rotation.y = remote.rotation;
      remote.avatar.animate(dt, elapsed, remote.moving, false);
      if (remote.emoteUntil > elapsed && remote.emote === 'wave') remote.avatar.arms[0].rotation.z = Math.sin(elapsed * 10) * 0.7 - 0.45;
    }
    if (!paused && !modalOpen && !state.complete) updateSecurity(dt);
    if (gameId === 'penthouse' && state.collectedCount >= 4 && state.mirrorsSolved >= 3) world.setElevatorRevealed(true);
    currentTarget = !paused && !modalOpen && !ui.profileOpen && !ui.journalOpen && !ui.partyOpen ? nearestInteraction() : null;
    ui.showPrompt(promptFor(currentTarget));
    updateCamera(dt);
    sendPose(now);
    if (now - lastProgress > 1000) { lastProgress = now; saveRunProgress(); }
    if (now - lastUi > 140) {
      lastUi = now;
      ui.update({ gameId, state: { ...state, collectedCount: state.collectedCount, gatesOpened: state.gatesOpened, relaysDisabled: state.relaysDisabled, mirrorsSolved: state.mirrorsSolved }, profile, world, timeRemaining: state.timeRemaining });
    }
    if (now - lastMap > 250) {
      lastMap = now; ui.drawMap(world, player.root.position, state, [...remotePlayers.values()].map(r => ({ ...r, x: r.avatar.root.position.x, z: r.avatar.root.position.z })));
    }
    setNameplates(now);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

function resize() {
  if (!renderer) return;
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight, false);
  const mobile = matchMedia('(max-width: 850px)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.3 : 1.7));
}
window.addEventListener('resize', resize);

if (window.Telegram?.WebApp) {
  try { window.Telegram.WebApp.ready(); window.Telegram.WebApp.expand(); } catch { /* Telegram injects this only inside its webview */ }
}

ui.showHub(profile);
if (invitedRoom && invitedGame && GAMES[invitedGame]) {
  startGame(invitedGame, Number.isFinite(Number(invitedSeed)) ? Number(invitedSeed) : invitedSeed);
} else if (invitedRoom && !invitedGame) {
  query.delete('party'); query.delete('seed'); history.replaceState({}, '', `${location.pathname}${query.size ? `?${query}` : ''}`);
  ui.toast('Choose a maze, then join a party invite from that game.');
}
