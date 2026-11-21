function makeRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

export function inviteUrl(room, seed, gameId) {
  const url = new URL(window.location.href);
  url.searchParams.set('party', room);
  url.searchParams.set('seed', String(seed));
  url.searchParams.set('game', gameId);
  return url.toString();
}

export class PartyClient {
  constructor(profile, callbacks = {}) {
    this.profile = profile;
    this.callbacks = callbacks;
    this.room = null;
    this.socket = null;
    this.members = [];
    this.connected = false;
    this.lastPoseAt = 0;
  }

  createRoom() {
    const room = makeRoomCode();
    this.join(room);
    return room;
  }

  join(room) {
    this.leave(false);
    this.room = String(room || '').toUpperCase().slice(0, 8);
    if (!this.room) return;
    this.callbacks.onStatus?.('connecting');
    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${scheme}//${location.host}/party`;
    try {
      this.socket = new WebSocket(url);
      this.socket.addEventListener('open', () => {
        this.connected = true;
        this.send({ type: 'join', room: this.room, player: this.publicProfile() });
        this.callbacks.onStatus?.('connected');
      });
      this.socket.addEventListener('message', event => {
        let packet;
        try { packet = JSON.parse(event.data); } catch { return; }
        if (packet.type === 'members') {
          this.members = packet.players || [];
          this.callbacks.onMembers?.(this.members);
        } else if (packet.type === 'pose') {
          this.callbacks.onPose?.(packet.player);
        } else if (packet.type === 'event') {
          this.callbacks.onEvent?.(packet.event);
        } else if (packet.type === 'error') {
          this.callbacks.onStatus?.('error', packet.message);
        }
      });
      this.socket.addEventListener('close', () => {
        this.connected = false;
        this.callbacks.onStatus?.('offline');
        this.callbacks.onMembers?.([]);
      });
      this.socket.addEventListener('error', () => this.callbacks.onStatus?.('offline'));
    } catch { this.callbacks.onStatus?.('offline'); }
  }

  send(packet) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(packet));
  }

  pose(data, now = performance.now()) {
    if (now - this.lastPoseAt < 90) return;
    this.lastPoseAt = now;
    this.send({ type: 'pose', player: { ...this.publicProfile(), ...data } });
  }

  updateProfile() {
    this.send({ type: 'profile', player: this.publicProfile() });
  }

  publicProfile() {
    return {
      id: this.profile.id, name: this.profile.name, outfit: this.profile.outfit, hair: this.profile.hair,
      hairStyle: this.profile.hairStyle, accessory: this.profile.accessory,
      traits: Array.isArray(this.profile.traits) ? this.profile.traits.slice(0, 3) : []
    };
  }

  event(event) {
    this.send({ type: 'event', event: { ...event, eventId: `${this.profile.id}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}` } });
  }

  leave(updateUrl = true) {
    if (this.socket) {
      try { this.send({ type: 'leave' }); this.socket.close(); } catch { /* already disconnected */ }
    }
    this.socket = null; this.room = null; this.connected = false; this.members = [];
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.delete('party'); url.searchParams.delete('seed'); url.searchParams.delete('game');
      history.replaceState({}, '', url);
    }
  }
}
