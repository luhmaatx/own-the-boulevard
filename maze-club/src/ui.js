import { GAMES, OUTFITS, HAIR_STYLES, HAIR_CUTS, ACCESSORIES, PARTY_ROLES } from './game-data.js';

const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class GameUI {
  constructor(host) {
    this.host = host;
    this.handlers = {};
    this.touch = { x: 0, y: 0, sprint: false };
    this.currentGame = null;
    this.journalOpen = false;
    this.profileOpen = false;
    this.partyOpen = false;
    this.install();
  }

  install() {
    this.host.innerHTML = `
      <div class="brand-lockup"><span class="brand-monogram">K</span><span class="brand-text"><b>LUHMAATX</b><small>× KILLAMANI CASINO</small></span></div>
      <section class="hub" id="hub">
        <div class="hub-top"><span class="eyebrow">THE MAZE CLUB · SEASON ONE</span><button class="profile-pill" data-action="profile">◉ <span id="hub-player">Kimia</span> <i>LV <b id="hub-level">1</b></i></button></div>
        <div class="hero-copy"><p class="gold-kicker">ONE PROFILE. THREE WORLDS.</p><h1>Find your way.<br><em>Make the story yours.</em></h1><p class="hero-desc">Explore the Killamani universe with your crew. Every clue, choice, outfit, and Killa Coin travels with you.</p></div>
        <div class="world-cards" id="world-cards">
          ${['ruby', 'vault', 'penthouse'].map((id, index) => `<article class="world-card ${index === 0 ? 'featured' : ''}" data-world="${id}"><div class="card-image" style="--card-image:url('${GAMES[id].board}')"></div><div class="card-shade"></div><div class="card-copy"><span class="card-kicker">${GAMES[id].eyebrow}</span><h2>${GAMES[id].title}</h2><p>${GAMES[id].subtitle}</p><button class="play-card" data-action="play" data-game="${id}">${index === 0 ? 'PLAY RUBY RUN' : 'ENTER WORLD'} <span>↗</span></button></div><span class="card-index">0${index + 1}</span></article>`).join('')}
        </div>
        <div class="hub-footer"><div><span class="live-dot"></span> <b>ONE CONNECTED UNIVERSE</b><span class="footer-sep">/</span> shared avatar · quest rewards · Killa Coins</div><div class="profile-summary"><span id="hub-coins">2,740</span> <i>◈</i> Killa Coins <span class="footer-sep">·</span> <span id="hub-rep">0</span> reputation</div></div>
      </section>

      <section class="game-ui hidden" id="game-ui">
        <div class="topline"><div class="world-title"><span id="world-kicker">THE EMERALD MAZE</span><b id="world-title">RUBY RUN</b></div><div class="party-pill" id="party-status"><span class="live-dot"></span><span id="party-status-text">SOLO RUN</span></div><div class="top-actions"><button class="icon-button" title="Quest log" data-action="journal">☷</button><button class="icon-button" title="Invite friends" data-action="party">♧</button><button class="icon-button" id="sound-button" title="Mute ambient music" data-action="sound">♫</button><button class="icon-button" title="Profile and style" data-action="profile">◉</button><button class="icon-button" title="Game hub" data-action="hub">⌂</button></div></div>
        <div class="hud-left"><div class="quest-chip"><div class="quest-chip-head"><span class="mini-diamond">◆</span><span id="hud-objective-title">MAZE QUEST</span><button class="expand-quest" data-action="journal">+</button></div><div id="hud-progress" class="quest-progress"></div></div><div class="timer-chip hidden" id="timer-chip"><span>◷</span><b id="timer-value">04:00</b><small>TO VAULT LOCKDOWN</small></div></div>
        <div class="hud-right"><div class="wallet-chip"><span class="coin-token">K</span><b id="wallet-value">2,740</b><button title="Zoom map" data-action="map">⌖</button></div><div class="minimap-wrap"><div class="map-label"><span>LIVE MAP</span><i id="floor-label">GROUND FLOOR</i></div><canvas id="minimap" width="220" height="220"></canvas><div class="map-legend"><span><i class="dot-player"></i> YOU</span><span><i class="dot-objective"></i> CLUE</span></div></div><div id="alert-meter-wrap" class="alert-chip hidden"><span>SECURITY ALERT</span><div class="meter"><i id="alert-fill"></i></div></div></div>
        <div class="stamina-chip"><span>STAMINA</span><div class="meter"><i id="stamina-fill"></i></div><b id="stamina-value">100</b></div>
        <div id="world-labels" class="world-labels"></div>
        <div id="interaction-prompt" class="interaction-prompt hidden"><span>✦</span><b>INTERACT</b><i id="prompt-label">Inspect clue</i><kbd>E</kbd></div>
        <div class="toast" id="toast"></div>
        <div class="desktop-help" id="desktop-help"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move <i>·</i> drag to look <i>·</i> <kbd>E</kbd> interact <i>·</i> <kbd>SHIFT</kbd> sprint</div>
        <div class="touch-controls" id="touch-controls"><div class="stick" id="stick"><div class="stick-ring"><span>▲</span><span>◀</span><span>▶</span><span>▼</span><div class="stick-knob" id="stick-knob"></div></div></div><div class="touch-actions"><button class="run-button" id="run-button" aria-label="Sprint">➤<small>RUN</small></button><button class="action-button" data-action="interact">✧<small>ACT</small></button></div></div>
        <div class="emote-tray"><button data-action="emote" data-emote="wave">WAVE</button><button data-action="emote" data-emote="heart">HEART</button><button data-action="emote" data-emote="cheer">CHEER</button></div>
      </section>

      <div class="modal-scrim hidden" id="modal-scrim"></div>
      <aside class="panel hidden" id="journal-panel"><div class="panel-head"><div><small>FIELD NOTES</small><h2>Quest journal</h2></div><button class="close-button" data-action="close-panel">×</button></div><div id="journal-content" class="panel-content"></div></aside>
      <aside class="panel profile-panel hidden" id="profile-panel"><div class="panel-head"><div><small>YOUR UNIVERSE PROFILE</small><h2>Player style</h2></div><button class="close-button" data-action="close-panel">×</button></div><div class="panel-content" id="profile-content"></div></aside>
      <aside class="panel party-panel hidden" id="party-panel"><div class="panel-head"><div><small>PLAY TOGETHER</small><h2>Your party</h2></div><button class="close-button" data-action="close-panel">×</button></div><div class="panel-content" id="party-content"></div></aside>
      <div class="dialog-card hidden" id="dialog-card"></div>
      <div class="nameplate-layer" id="nameplate-layer"></div>
    `;
    this.host.addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'profile') this.togglePanel('profile');
      else if (action === 'journal') this.togglePanel('journal');
      else if (action === 'party') this.togglePanel('party');
      else if (action === 'close-panel') this.closePanels();
      else if (action === 'interact') this.handlers.interact?.();
      else this.handlers[action]?.(button.dataset);
    });
    this.host.addEventListener('click', event => {
      const style = event.target.closest('[data-style]');
      if (style) this.handlers.style?.(style.dataset.style, style.dataset.value);
      const trait = event.target.closest('[data-trait]');
      if (trait) this.handlers.trait?.(trait.dataset.trait);
      const choice = event.target.closest('[data-choice]');
      if (choice) this.handlers.choice?.(choice.dataset.choice);
    });
    this.host.addEventListener('input', event => {
      if (event.target.id === 'name-input') this.handlers.name?.(event.target.value);
    });
    this.initJoystick();
  }

  initJoystick() {
    const stick = this.host.querySelector('#stick'); const knob = this.host.querySelector('#stick-knob');
    let activeId = null;
    const update = event => {
      const rect = stick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      let dx = event.clientX - cx, dy = event.clientY - cy;
      const max = rect.width * 0.33, length = Math.hypot(dx, dy);
      if (length > max) { dx *= max / length; dy *= max / length; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.touch.x = dx / max; this.touch.y = dy / max;
    };
    stick.addEventListener('pointerdown', event => { event.preventDefault(); activeId = event.pointerId; stick.setPointerCapture(activeId); update(event); });
    stick.addEventListener('pointermove', event => { if (event.pointerId === activeId) update(event); });
    const release = event => { if (event.pointerId === activeId) { activeId = null; this.touch.x = 0; this.touch.y = 0; knob.style.transform = 'translate(0,0)'; } };
    stick.addEventListener('pointerup', release); stick.addEventListener('pointercancel', release);
    const run = this.host.querySelector('#run-button');
    run.addEventListener('pointerdown', e => { e.preventDefault(); this.touch.sprint = true; });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => run.addEventListener(type, () => { this.touch.sprint = false; }));
  }

  getMoveInput() { return { ...this.touch }; }
  setHandler(name, fn) { this.handlers[name] = fn; }
  showHub(profile) {
    this.host.querySelector('#hub').classList.remove('hidden');
    this.host.querySelector('#game-ui').classList.add('hidden');
    this.host.querySelector('#modal-scrim').classList.add('hidden');
    this.host.querySelector('#dialog-card').classList.add('hidden');
    this.closePanels(); this.updateProfile(profile);
  }
  showGame(gameId, profile) {
    const game = GAMES[gameId]; this.currentGame = gameId;
    this.host.querySelector('#hub').classList.add('hidden');
    this.host.querySelector('#game-ui').classList.remove('hidden');
    this.host.querySelector('#world-title').textContent = game.title.toUpperCase();
    this.host.querySelector('#world-kicker').textContent = game.eyebrow.toUpperCase();
    this.host.querySelector('#hud-objective-title').textContent = game.id === 'penthouse' ? 'ESCAPE THE PENTHOUSE' : game.id === 'vault' ? 'VAULT HEIST' : 'MAZE QUEST';
    this.host.querySelector('#timer-chip').classList.toggle('hidden', !game.timer);
    this.host.querySelector('#alert-meter-wrap').classList.toggle('hidden', game.id !== 'vault');
    this.host.querySelector('#floor-label').textContent = game.id === 'penthouse' ? 'LEVEL 01' : game.id === 'vault' ? 'VAULT LEVEL' : 'EMERALD MAZE';
    this.updateProfile(profile);
  }
  updateProfile(profile) {
    this.lastProfile = profile;
    this.host.querySelector('#hub-player').textContent = profile.name;
    this.host.querySelector('#hub-level').textContent = profile.level;
    this.host.querySelector('#hub-coins').textContent = profile.coins.toLocaleString();
    this.host.querySelector('#hub-rep').textContent = profile.reputation.toLocaleString();
    this.host.querySelector('#wallet-value').textContent = profile.coins.toLocaleString();
  }
  update({ gameId, state, profile, world, timeRemaining = 0 }) {
    this.updateProfile(profile);
    const game = GAMES[gameId];
    const clueCount = state.collectedCount || 0;
    let rows = [];
    if (gameId === 'ruby') {
      rows = [[clueCount >= 3, `Find 3 ruby clues <i>${clueCount}/3</i>`], [state.gatesOpened >= 2, `Unlock ruby gates <i>${state.gatesOpened}/2</i>`], [state.complete, 'Reach the casino exit']];
    } else if (gameId === 'vault') {
      rows = [[clueCount >= 6, `Collect 6 Killa Coins <i>${clueCount}/6</i>`], [state.relaysDisabled >= 2, `Disable laser relays <i>${state.relaysDisabled}/2</i>`], [state.complete, 'Reach the Main Vault']];
    } else {
      rows = [[clueCount >= 4, `Solve ruby clues <i>${clueCount}/4</i>`], [state.mirrorsSolved >= 3, `Align mirrors <i>${state.mirrorsSolved}/3</i>`], [state.friendTalked, state.friendTalked ? 'Reunited with Zuri' : 'Find Zuri near the elevator'], [state.onRooftop, state.onRooftop ? 'Reach the rooftop reunion' : 'Find the hidden elevator']];
    }
    this.host.querySelector('#hud-progress').innerHTML = rows.map(([done, label]) => `<div class="objective-line ${done ? 'done' : ''}"><span class="check-box">${done ? '✓' : ''}</span><span>${label}</span></div>`).join('');
    this.host.querySelector('#timer-value').textContent = `${String(Math.floor(timeRemaining / 60)).padStart(2, '0')}:${String(Math.floor(timeRemaining % 60)).padStart(2, '0')}`;
    this.host.querySelector('#alert-fill').style.width = `${Math.max(0, Math.min(1, state.alert || 0)) * 100}%`;
    this.host.querySelector('#stamina-fill').style.width = `${Math.max(0, Math.min(100, state.stamina ?? 100))}%`;
    this.host.querySelector('#stamina-value').textContent = Math.round(state.stamina ?? 100);
    this.host.querySelector('#floor-label').textContent = gameId === 'penthouse' ? (state.onRooftop ? 'ROOFTOP' : 'LEVEL 01') : gameId === 'vault' ? 'VAULT LEVEL' : 'EMERALD MAZE';
    if (!this.host.querySelector('#journal-panel').classList.contains('hidden')) this.renderJournal(game, state, profile, world);
  }
  renderJournal(game, state, profile, world) {
    const list = this.host.querySelector('#journal-content');
    let rows = [];
    if (game.id === 'ruby') rows = [['Collect three ruby clues', state.collectedCount, game.needed], ['Open two crystal gates', state.gatesOpened, 2], ['Reach the glowing casino portal', state.complete ? 1 : 0, 1]];
    if (game.id === 'vault') rows = [['Collect six Killa Coins', state.collectedCount, 6], ['Disable both laser relays', state.relaysDisabled, 2], ['Reach the Main Vault before lockdown', state.complete ? 1 : 0, 1]];
    if (game.id === 'penthouse') rows = [['Solve four ruby clues', state.collectedCount, 4], ['Align all three mirrors', state.mirrorsSolved, 3], ['Speak to your friend', state.friendTalked ? 1 : 0, 1], ['Find the hidden elevator', state.onRooftop ? 1 : 0, 1]];
    list.innerHTML = `<p class="journal-intro">${game.objective}</p><div class="journal-list">${rows.map(([label, amount, need]) => `<div class="journal-row"><span class="${amount >= need ? 'complete' : ''}">${amount >= need ? '✓' : '◇'}</span><div>${escapeHtml(label)}<small>${amount >= need ? 'COMPLETE' : `${amount}/${need}`}</small></div></div>`).join('')}</div><div class="journal-reward"><small>FIRST CLEAR REWARD</small><b>◈ ${game.reward.coins.toLocaleString()} Killa Coins</b><span>${game.reward.badge} · ${game.reward.cosmetic}</span></div>${game.id === 'penthouse' ? `<div class="relationship-strip"><span>RELATIONSHIP WITH ZURI</span><b>${Math.max(0, Math.min(100, 50 + profile.story.trust))}% trust</b><div class="meter"><i style="width:${Math.max(0, Math.min(100, 50 + profile.story.trust))}%"></i></div></div>` : ''}`;
  }
  drawMap(world, player, state, remotePlayers = []) {
    const canvas = this.host.querySelector('#minimap'); if (!canvas || !world) return;
    const ctx = canvas.getContext('2d'), size = world.maze.size, pad = 8, cell = (canvas.width - pad * 2) / size;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(18,13,17,.93)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) {
      const c = world.maze.cells[x][z], px = pad + x * cell, py = pad + z * cell;
      ctx.fillStyle = world.game.id === 'ruby' ? 'rgba(48,89,68,.42)' : world.game.id === 'vault' ? 'rgba(101,74,47,.34)' : 'rgba(230,211,190,.33)';
      ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
      ctx.strokeStyle = world.game.id === 'penthouse' ? 'rgba(248,219,184,.72)' : 'rgba(234,204,151,.63)'; ctx.lineWidth = 2;
      if (c.walls.n) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + cell, py); ctx.stroke(); }
      if (c.walls.w) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + cell); ctx.stroke(); }
      if (x === size - 1 && c.walls.e) { ctx.beginPath(); ctx.moveTo(px + cell, py); ctx.lineTo(px + cell, py + cell); ctx.stroke(); }
      if (z === size - 1 && c.walls.s) { ctx.beginPath(); ctx.moveTo(px, py + cell); ctx.lineTo(px + cell, py + cell); ctx.stroke(); }
    }
    const point = (cellPos, color, radius = 4) => {
      const px = pad + (cellPos.x + 0.5) * cell, py = pad + (cellPos.z + 0.5) * cell;
      ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    };
    world.maze.items.filter(i => i.active && i.root?.visible && i.type !== 'secret').forEach(i => point(i.cell, i.type === 'coin' ? '#ffd379' : '#ff4d81', 3.4));
    world.maze.mirrors.filter(i => !i.solved).forEach(i => point(i.cell, '#8fd3ec', 2.6));
    point(world.maze.exit, world.game.id === 'penthouse' && state.onRooftop ? '#ffbad2' : '#fae0a5', 4.6);
    const p = { x: Math.floor(player.x / 4.2 + size / 2), z: Math.floor(player.z / 4.2 + size / 2) };
    if (state.onRooftop && world.roof) {
      ctx.fillStyle = 'rgba(244,202,139,.2)'; ctx.fillRect(3, 3, canvas.width - 6, canvas.height - 6);
      ctx.fillStyle = '#f5d698'; ctx.font = '600 17px Georgia'; ctx.textAlign = 'center'; ctx.fillText('ROOFTOP · SUNSET', canvas.width / 2, canvas.height / 2);
    } else point({ x: Math.max(0, Math.min(size - 1, p.x)), z: Math.max(0, Math.min(size - 1, p.z)) }, '#74dbff', 4.2);
    remotePlayers.forEach(r => {
      const rp = { x: Math.floor(r.x / 4.2 + size / 2), z: Math.floor(r.z / 4.2 + size / 2) };
      if (r.gameId === this.currentGame && !state.onRooftop) point({ x: Math.max(0, Math.min(size - 1, rp.x)), z: Math.max(0, Math.min(size - 1, rp.z)) }, '#caa4ff', 3.5);
    });
  }
  renderProfile(profile) {
    const outfits = OUTFITS.map(o => {
      const locked = o.unlock && !profile.unlocks.includes(o.unlock);
      return `<button class="style-swatch ${profile.outfit === o.id ? 'selected' : ''} ${locked ? 'locked' : ''}" data-style="outfit" data-value="${o.id}" ${locked ? 'disabled' : ''}><i style="--swatch:${o.swatch}"></i><span>${o.label}</span>${locked ? `<small>LOCKED · ${o.unlock}</small>` : profile.outfit === o.id ? '<small>WEARING</small>' : ''}</button>`;
    }).join('');
    const hairs = HAIR_STYLES.map(h => `<button class="hair-swatch ${profile.hair === h.id ? 'selected' : ''}" data-style="hair" data-value="${h.id}"><i style="--hair-a:${h.colors[0]};--hair-b:${h.colors[1]}"></i>${h.label}</button>`).join('');
    const cuts = HAIR_CUTS.map(h => `<button class="trait-chip ${profile.hairStyle === h.id ? 'active' : ''}" data-style="hairStyle" data-value="${h.id}">${h.label}</button>`).join('');
    const accessories = ACCESSORIES.map(a => {
      const locked = a.unlock && !profile.unlocks.includes(a.unlock);
      return `<button class="hair-swatch ${profile.accessory === a.id ? 'selected' : ''}" data-style="accessory" data-value="${a.id}" ${locked ? 'disabled' : ''}><i style="--hair-a:${a.swatch};--hair-b:${a.swatch}"></i>${a.label}${locked ? ' · locked' : ''}</button>`;
    }).join('');
    const traits = ['Bold', 'Social', 'Observant', 'Loyal', 'Mysterious'].map(t => `<button class="trait-chip ${profile.traits.includes(t) ? 'active' : ''}" data-trait="${t}">${t}</button>`).join('');
    const friends = profile.friends?.length ? profile.friends.slice(0, 8).map(f => `<span class="friend-chip">${escapeHtml(f.name)}</span>`).join('') : '<small class="empty-friends">Friends you play with will appear here.</small>';
    const collection = [...(profile.badges || []), ...(profile.jewelry || []), ...(profile.furniture || []), ...(profile.cars || []), ...(profile.areas || []), ...(profile.nameplates || [])];
    const collectionMarkup = collection.length ? collection.map(item => `<span class="collection-chip">${escapeHtml(item)}</span>`).join('') : '<small class="empty-friends">Clear a maze to earn outfits, jewelry, décor, and badges.</small>';
    this.host.querySelector('#profile-content').innerHTML = `<label class="field-label">DISPLAY NAME<input id="name-input" value="${escapeHtml(profile.name)}" maxlength="18" autocomplete="off"></label><div class="stat-row"><div><small>VIRTUAL BALANCE</small><b>◈ ${profile.coins.toLocaleString()}</b></div><div><small>REPUTATION</small><b>✦ ${profile.reputation.toLocaleString()}</b></div></div><div class="section-label">SIGNATURE LOOK <small>UNLOCKS FOLLOW YOU</small></div><div class="swatch-list">${outfits}</div><div class="section-label">HAIR COLOR</div><div class="hair-list">${hairs}</div><div class="section-label">HAIRSTYLE</div><div class="trait-list">${cuts}</div><div class="section-label">ACCESSORIES</div><div class="hair-list">${accessories}</div><div class="section-label">PERSONALITY TRAITS <small>CHOOSE UP TO 3</small></div><div class="trait-list">${traits}</div><div class="section-label">YOUR COLLECTION</div><div class="collection-list">${collectionMarkup}</div><div class="section-label">YOUR CREW</div><div class="friend-list">${friends}</div><div class="save-note">Your profile, look, rewards, and progress save on this device and carry across all three games.</div>`;
  }
  renderParty({ status = 'offline', room = null, members = [], link = '' } = {}) {
    const connected = status === 'connected';
    const roles = PARTY_ROLES[this.currentGame] || [];
    const memberList = members.length ? members.map((p, i) => `<div class="party-member"><span class="member-avatar">${escapeHtml((p.name || '?').slice(0, 1).toUpperCase())}</span><div><b>${escapeHtml(p.name || 'Player')}</b><small>${escapeHtml(roles[i] || 'Crew')} · ${p.gameId && p.gameId === this.currentGame ? 'IN YOUR WORLD' : p.id ? 'CONNECTED' : 'INVITE PENDING'}</small></div><i class="member-dot"></i></div>`).join('') : '<div class="party-empty">No friends have joined this run yet.</div>';
    const linkMarkup = link ? `<div class="invite-box"><small>YOUR PARTY INVITE</small><code>${escapeHtml(link)}</code><button data-action="copy-invite">COPY INVITE LINK</button></div>` : '';
    this.host.querySelector('#party-content').innerHTML = `<p class="panel-blurb">Invite 1–3 friends into the same maze. Your party shares clue, coin, and puzzle progress.</p><div class="party-code"><small>${connected ? 'PARTY CODE' : status === 'connecting' ? 'CONNECTING' : 'PARTY STATUS'}</small><b>${room || (status === 'connecting' ? '…' : 'Not in a party')}</b><span class="${connected ? 'online' : 'offline'}">${connected ? '● ONLINE' : status === 'connecting' ? '◌ CONNECTING' : status === 'error' ? '● PARTY FULL' : '● SOLO'}</span></div>${memberList}${linkMarkup}<div class="party-buttons">${connected ? '<button class="secondary-button" data-action="copy-invite">COPY INVITE</button><button class="danger-button" data-action="leave-party">LEAVE PARTY</button>' : '<button class="primary-button" data-action="create-party">CREATE INVITE LINK</button>'}</div><div class="party-note">Parties support up to four players. The host link carries the maze seed, so everyone enters the same layout.</div>`;
  }
  togglePanel(name) {
    const target = this.host.querySelector(`#${name}-panel`);
    if (!target) return;
    const wasOpen = !target.classList.contains('hidden'); this.closePanels();
    if (!wasOpen) {
      target.classList.remove('hidden'); this.host.querySelector('#modal-scrim').classList.remove('hidden');
      if (name === 'profile' && this.lastProfile) this.renderProfile(this.lastProfile);
      if (name === 'party') this.handlers.partyPanelOpen?.();
    }
    if (name === 'profile') this.profileOpen = !wasOpen;
    if (name === 'journal') this.journalOpen = !wasOpen;
    if (name === 'party') this.partyOpen = !wasOpen;
  }
  closePanels() {
    ['journal-panel', 'profile-panel', 'party-panel'].forEach(id => this.host.querySelector(`#${id}`)?.classList.add('hidden'));
    this.host.querySelector('#modal-scrim').classList.add('hidden'); this.profileOpen = false; this.journalOpen = false; this.partyOpen = false;
  }
  showPrompt(label) {
    const el = this.host.querySelector('#interaction-prompt');
    el.classList.toggle('hidden', !label);
    if (label) this.host.querySelector('#prompt-label').textContent = label;
  }
  toast(message) {
    const el = this.host.querySelector('#toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  showDialog(kind, data = {}) {
    const box = this.host.querySelector('#dialog-card');
    this.host.querySelector('#modal-scrim').classList.remove('hidden');
    if (kind === 'friend') {
      box.innerHTML = `<div class="dialog-kicker">PENTHOUSE ESCAPE · RELATIONSHIP MOMENT</div><h2>Zuri finally looks you in the eye.</h2><p>“If we make it out, are you telling me what happened at the gala?”</p><div class="choice-list"><button data-choice="truth"><b>Tell her the truth</b><small>Build trust · Honest ending path</small></button><button data-choice="secret"><b>Keep it to myself for now</b><small>Protect the secret · Private ending path</small></button><button data-choice="rival"><b>Ask what Raven is hiding</b><small>Take control · Rival ending path</small></button></div><button class="dialog-dismiss" data-action="close-dialog">DECIDE LATER</button>`;
    } else if (kind === 'rival') {
      box.innerHTML = `<div class="dialog-kicker">PENTHOUSE ESCAPE · RIVAL ENCOUNTER</div><h2>Raven blocks the mirrored hall.</h2><p>“Funny how everyone remembers the gala differently. Want my version?”</p><div class="choice-list"><button data-choice="rival"><b>Ask Raven what she knows</b><small>Question the story · +reputation</small></button><button data-choice="truth"><b>Stand by Zuri</b><small>Show loyalty · +trust</small></button><button data-choice="secret"><b>Walk away</b><small>Keep your own counsel</small></button></div><button class="dialog-dismiss" data-action="close-dialog">NOT NOW</button>`;
    } else if (kind === 'clear') {
      const reward = data.game.reward;
      const bonus = [reward.jewelry, reward.car, reward.area, reward.nameplate].filter(Boolean).join(' · ');
      box.innerHTML = `<div class="dialog-kicker">${data.firstClear ? 'FIRST CLEAR · REWARD UNLOCKED' : 'MAZE COMPLETE'}</div><h2>${escapeHtml(data.title)}</h2><p>${escapeHtml(data.message || 'You made it through together.')}</p><div class="reward-grid"><div><b>◈ ${data.firstClear ? reward.coins.toLocaleString() : 'Replay'}</b><small>KILLA COINS</small></div><div><b>✦ ${data.firstClear ? reward.reputation : '—'}</b><small>REPUTATION</small></div><div><b>♛ ${escapeHtml(reward.badge)}</b><small>STORY BADGE</small></div></div><div class="reward-unlock">✧ ${escapeHtml(reward.cosmetic)} · ${escapeHtml(reward.furniture)} ${data.firstClear ? 'unlocked' : 'already earned'}${bonus ? `<small>${escapeHtml(bonus)}</small>` : ''}</div><button class="primary-button" data-action="hub">BACK TO THE MAZE CLUB</button>`;
    } else if (kind === 'ending') {
      const endings = { truth: ['The Honest Ending', 'You tell Zuri what happened. Trust wins out, and the two of you leave with the whole story.'], secret: ['The Quiet Exit', 'You keep the secret for now. The elevator opens, but one question follows you into the sunset.'], rival: ['The Power Shift', 'You confront Raven and change who controls the story. The truth is still out there, but you choose the next move.'] };
      const [title, message] = endings[data.choice] || endings.truth;
      const reward = data.reward || GAMES.penthouse.reward;
      const rewardLine = data.firstClear ? `◈ ${reward.coins.toLocaleString()} Killa Coins · ✦ ${reward.reputation} reputation · ${reward.cosmetic} · ${reward.furniture}` : 'Your first-clear story rewards are already in your collection.';
      box.innerHTML = `<div class="dialog-kicker">EPISODE COMPLETE · ${escapeHtml(data.badge || 'PENTHOUSE ESCAPE')}</div><h2>${title}</h2><p>${message}</p><div class="ending-stats"><span>TRUST <b>${data.trust}%</b></span><span>REPUTATION <b>${data.reputation}</b></span><span>FRIENDSHIP <b>${escapeHtml(data.friendMood || 'Closer')}</b></span></div><div class="reward-unlock">${escapeHtml(rewardLine)}</div><button class="primary-button" data-action="complete">CLAIM STORY REWARDS</button><button class="dialog-dismiss" data-action="hub">RETURN TO WORLD SELECT</button>`;
    } else if (kind === 'timeout') {
      box.innerHTML = `<div class="dialog-kicker">VAULT LOCKDOWN</div><h2>Time ran out.</h2><p>The vault seals. Your collected clues stay yours, and you can jump back in for another run.</p><button class="primary-button" data-action="retry">TRY THE HEIST AGAIN</button><button class="dialog-dismiss" data-action="hub">BACK TO WORLD SELECT</button>`;
    } else if (kind === 'pause') {
      box.innerHTML = `<div class="dialog-kicker">PAUSED · ${escapeHtml(data.title || 'MAZE CLUB')}</div><h2>Take a breath.</h2><p>Your current maze progress is saved for this run. Resume when you’re ready.</p><button class="primary-button" data-action="resume">RESUME GAME</button><button class="dialog-dismiss" data-action="hub">RETURN TO WORLD SELECT</button>`;
    }
    box.classList.remove('hidden');
  }
  closeDialog() { this.host.querySelector('#dialog-card').classList.add('hidden'); this.host.querySelector('#modal-scrim').classList.add('hidden'); }
  setPartyStatus(status, count = 1) {
    const text = this.host.querySelector('#party-status-text');
    text.textContent = status === 'connected' ? `PARTY ${count}/4` : status === 'connecting' ? 'CONNECTING…' : 'SOLO RUN';
  }
  setSoundState(muted) {
    const button = this.host.querySelector('#sound-button');
    if (!button) return;
    button.textContent = muted ? '♪' : '♫';
    button.title = muted ? 'Play ambient music' : 'Mute ambient music';
    button.setAttribute('aria-pressed', String(muted));
  }
  setNameplates(entries) {
    const layer = this.host.querySelector('#nameplate-layer');
    layer.innerHTML = entries.map(entry => `<div class="world-nameplate" style="left:${entry.x}px;top:${entry.y}px"><b>${escapeHtml(entry.name)}</b><i>${escapeHtml(entry.note || '')}</i></div>`).join('');
  }
  showQuestLog() { this.togglePanel('journal'); }
  getCanvas() { return this.host.querySelector('#minimap'); }
}
