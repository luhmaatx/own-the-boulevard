import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT || 8787);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary' };
const rooms = new Map();
const roomEvents = new Map();

const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, service: 'killamani-maze-party' })); }
  if (!fs.existsSync(dist)) { res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Build the game first with npm run build.'); }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); return res.end('Bad request'); }
  let file = path.join(dist, pathname === '/' ? 'index.html' : pathname);
  const relative = path.relative(dist, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403); return res.end('Forbidden'); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ server, path: '/party', maxPayload: 20_000 });
const clean = socket => { try { if (socket.room) { const room = socket.room; rooms.get(room)?.delete(socket); broadcastMembers(room); if (!rooms.get(room)?.size) { rooms.delete(room); roomEvents.delete(room); } } } catch {} };
function send(socket, packet) { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(packet)); }
function broadcastMembers(room) {
  const players = Array.from(rooms.get(room) || []).map(s => s.player).filter(Boolean);
  for (const client of rooms.get(room) || []) send(client, { type: 'members', players });
}
function broadcast(room, packet, except = null) {
  for (const client of rooms.get(room) || []) if (client !== except) send(client, packet);
}

wss.on('connection', socket => {
  socket.on('message', raw => {
    let packet; try { packet = JSON.parse(raw.toString()); } catch { return; }
    if (packet.type === 'join') {
      const room = String(packet.room || '').toUpperCase().slice(0, 8);
      if (!room || !packet.player?.id) return send(socket, { type: 'error', message: 'That invite link is missing its party code.' });
      const previous = rooms.get(room) || new Set();
      if (previous.size >= 4) return send(socket, { type: 'error', message: 'This party is full. Parties hold up to four players.' });
      socket.room = room;
      socket.player = cleanProfile(packet.player);
      previous.add(socket); rooms.set(room, previous); broadcastMembers(room);
      for (const event of roomEvents.get(room) || []) send(socket, { type: 'event', event });
    } else if (packet.type === 'profile' && socket.room && packet.player) {
      socket.player = { ...socket.player, ...cleanProfile(packet.player) };
      broadcastMembers(socket.room);
    } else if (packet.type === 'pose' && socket.room && socket.player) {
      const p = packet.player || {};
      socket.player = { ...socket.player, x: Number(p.x) || 0, y: Number(p.y) || 0, z: Number(p.z) || 0, rotation: Number(p.rotation) || 0, gameId: String(p.gameId || ''), moving: !!p.moving };
      broadcast(socket.room, { type: 'pose', player: socket.player }, socket);
    } else if (packet.type === 'event' && socket.room && packet.event) {
      const e = packet.event;
      const allowed = ['collect', 'relay', 'mirror-turn', 'friend-choice', 'exit', 'emote', 'lift'];
      if (allowed.includes(e.kind)) {
        const shared = { eventId: String(e.eventId || ''), gameId: String(e.gameId || ''), kind: e.kind, id: String(e.id || ''), choice: String(e.choice || ''), from: socket.player?.id || '' };
        const events = roomEvents.get(socket.room) || [];
        if (e.kind === 'mirror-turn') {
          const key = `${shared.gameId}:${shared.kind}:${shared.id}`;
          const index = events.findIndex(v => `${v.gameId}:${v.kind}:${v.id}` === key);
          if (index >= 0) events[index] = shared; else events.push(shared);
        } else if (e.kind !== 'emote' && e.kind !== 'friend-choice') { const key = `${shared.gameId}:${shared.kind}:${shared.id}`; if (!events.some(v => `${v.gameId}:${v.kind}:${v.id}` === key)) events.push(shared); }
        else if (e.kind === 'friend-choice' && !events.some(v => v.gameId === shared.gameId && v.kind === shared.kind)) events.push(shared);
        if (events.length > 500) events.splice(0, events.length - 500);
        roomEvents.set(socket.room, events);
        broadcast(socket.room, { type: 'event', event: shared }, socket);
      }
    } else if (packet.type === 'leave') clean(socket);
  });
  socket.on('close', () => clean(socket));
});

server.listen(port, '0.0.0.0', () => console.log(`Killamani Maze server listening on ${port}`));

function cleanProfile(player) {
  return {
    id: String(player.id || '').slice(0, 80), name: String(player.name || 'Player').slice(0, 18),
    outfit: String(player.outfit || 'ruby-noir').slice(0, 40), hair: String(player.hair || 'split-ruby').slice(0, 40),
    hairStyle: String(player.hairStyle || 'long-waves').slice(0, 40), accessory: String(player.accessory || 'gold-hoops').slice(0, 40),
    traits: Array.isArray(player.traits) ? player.traits.slice(0, 3).map(value => String(value).slice(0, 24)) : []
  };
}
