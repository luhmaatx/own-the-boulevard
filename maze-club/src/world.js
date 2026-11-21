import * as THREE from 'three';
import { createMaze, buildObjectives } from './maze.js';
import { GAMES } from './game-data.js';
import { createAvatar } from './avatar.js';

export const CELL_SIZE = 4.2;
const WALL_HEIGHT = 2.95;
const WALL_THICK = 0.62;
const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const edgeId = (a, b) => [a, b].map(c => `${c.x},${c.z}`).sort().join('|');

function mat(color, roughness = 0.5, metalness = 0.05, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}
function addMesh(parent, geometry, material, x, y, z, scale = null) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  if (scale) m.scale.set(...scale);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m); return m;
}
function worldAt(cell, size, y = 0) {
  return vec((cell.x - (size - 1) / 2) * CELL_SIZE, y, (cell.z - (size - 1) / 2) * CELL_SIZE);
}
function spriteLabel(text, color = '#f4dcad', background = 'rgba(22,13,17,.8)') {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = background; ctx.beginPath(); ctx.roundRect(20, 18, 472, 92, 42); ctx.fill();
  ctx.strokeStyle = 'rgba(229,188,112,.8)'; ctx.lineWidth = 4; ctx.stroke();
  ctx.font = '600 46px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(3.3, 0.82, 1); return sprite;
}
function instancedBoxes(parent, records, dims, material, colorFn = null) {
  if (!records.length) return null;
  const [w, h, d] = dims;
  const geometry = new THREE.BoxGeometry(w, h, d);
  const instances = new THREE.InstancedMesh(geometry, material, records.length);
  const dummy = new THREE.Object3D();
  records.forEach((r, i) => {
    dummy.position.set(r.x, r.y, r.z);
    dummy.rotation.set(r.rx || 0, r.ry || 0, r.rz || 0);
    dummy.scale.set(...(r.scale || [1, 1, 1])); dummy.updateMatrix();
    instances.setMatrixAt(i, dummy.matrix);
    if (colorFn) instances.setColorAt(i, new THREE.Color(colorFn(i)));
  });
  instances.instanceMatrix.needsUpdate = true;
  instances.castShadow = true; instances.receiveShadow = true; parent.add(instances);
  return instances;
}

function buildWallInstances(root, maze, game, specialEdges) {
  const h = WALL_HEIGHT;
  const material = mat(game.theme.wall, game.id === 'vault' ? 0.26 : 0.72, game.id === 'vault' ? 0.8 : 0.12);
  const trim = mat(game.theme.trim, 0.26, 0.76, { emissive: new THREE.Color(game.theme.trim), emissiveIntensity: 0.15 });
  const hedgeMat = mat(game.theme.wall, 0.86, 0.01);
  const horizontal = [], vertical = [], hTrim = [], vTrim = [], topClumps = [];
  const seen = new Set();
  const dirs = [
    ['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0]
  ];
  for (let x = 0; x < maze.size; x++) for (let z = 0; z < maze.size; z++) {
    const cell = maze.cells[x][z];
    for (const [dir, dx, dz] of dirs) {
      const nx = x + dx, nz = z + dz;
      if (nx >= 0 && nz >= 0 && nx < maze.size && nz < maze.size && (dir === 's' || dir === 'w')) continue;
      if (!cell.walls[dir]) continue;
      const from = { x, z }, to = { x: nx, z: nz }, key = edgeId(from, to);
      if (seen.has(key)) continue; seen.add(key);
      if (specialEdges.has(key)) continue;
      const center = worldAt(from, maze.size);
      if (dir === 'n') center.z -= CELL_SIZE / 2;
      if (dir === 's') center.z += CELL_SIZE / 2;
      if (dir === 'e') center.x += CELL_SIZE / 2;
      if (dir === 'w') center.x -= CELL_SIZE / 2;
      const isHorizontal = dir === 'n' || dir === 's';
      const record = { x: center.x, y: h / 2, z: center.z };
      (isHorizontal ? horizontal : vertical).push(record);
      (isHorizontal ? hTrim : vTrim).push({ x: center.x, y: h - 0.18, z: center.z });
      if (game.id === 'ruby') {
        for (let s = -1; s <= 1; s++) topClumps.push({
          x: center.x + (isHorizontal ? s * 1.25 : 0), y: h - 0.07,
          z: center.z + (isHorizontal ? 0 : s * 1.25), scale: [0.76, 0.46, 0.58]
        });
      }
    }
  }
  const mainMat = game.id === 'ruby' ? hedgeMat : material;
  instancedBoxes(root, horizontal, [CELL_SIZE, h, WALL_THICK], mainMat);
  instancedBoxes(root, vertical, [WALL_THICK, h, CELL_SIZE], mainMat);
  if (game.id !== 'ruby') {
    instancedBoxes(root, hTrim, [CELL_SIZE, 0.09, 0.74], trim);
    instancedBoxes(root, vTrim, [0.74, 0.09, CELL_SIZE], trim);
    instancedBoxes(root, horizontal.map((r, i) => ({ x: r.x, y: 0.16, z: r.z })), [CELL_SIZE, 0.08, 0.73], trim);
    instancedBoxes(root, vertical.map((r, i) => ({ x: r.x, y: 0.16, z: r.z })), [0.73, 0.08, CELL_SIZE], trim);
  } else if (topClumps.length) {
    const hedge = new THREE.InstancedMesh(new THREE.SphereGeometry(0.78, 8, 7), hedgeMat, topClumps.length);
    const dummy = new THREE.Object3D();
    topClumps.forEach((p, i) => { dummy.position.set(p.x, p.y, p.z); dummy.scale.set(...p.scale); dummy.updateMatrix(); hedge.setMatrixAt(i, dummy.matrix); });
    hedge.instanceMatrix.needsUpdate = true; hedge.castShadow = true; root.add(hedge);
  }
}

function buildFloor(root, maze, game) {
  const width = maze.size * CELL_SIZE + 30;
  const floor = addMesh(root, new THREE.PlaneGeometry(width, width), mat(game.theme.floor, 0.34, game.id === 'vault' ? 0.72 : 0.16), 0, -0.13, 0);
  floor.rotation.x = -Math.PI / 2;
  const tiles = [];
  for (let x = 0; x < maze.size; x++) for (let z = 0; z < maze.size; z++) {
    const p = worldAt({ x, z }, maze.size, -0.055);
    tiles.push({ x: p.x, y: p.y, z: p.z });
  }
  const tileMat = mat(game.theme.floorAlt, game.id === 'vault' ? 0.28 : 0.52, game.id === 'vault' ? 0.68 : 0.12);
  const tilesMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL_SIZE - 0.06, 0.06, CELL_SIZE - 0.06), tileMat, tiles.length);
  const dummy = new THREE.Object3D();
  tiles.forEach((p, i) => { dummy.position.set(p.x, p.y, p.z); dummy.updateMatrix(); tilesMesh.setMatrixAt(i, dummy.matrix); });
  tilesMesh.castShadow = false; tilesMesh.receiveShadow = true; root.add(tilesMesh);
  if (game.id === 'penthouse') {
    const carpet = mat('#7e1f42', 0.8, 0.02);
    addMesh(root, new THREE.BoxGeometry(2.15, 0.025, width - 5), carpet, -4.4, -0.005, 0);
    for (let z = -width / 2 + 4; z < width / 2; z += 5.8) {
      const brass = mat('#c6a05f', 0.26, 0.78);
      addMesh(root, new THREE.BoxGeometry(2.2, 0.03, 0.05), brass, -4.4, 0.018, z);
    }
  }
}

function createItemVisual(root, item, maze, game) {
  const p = worldAt(item.cell, maze.size, 0);
  const group = new THREE.Group(); group.position.copy(p); group.userData.interaction = item;
  const gold = mat(game.theme.trim, 0.2, 0.8, { emissive: new THREE.Color(game.theme.trim), emissiveIntensity: 0.4 });
  const ruby = new THREE.MeshPhysicalMaterial({ color: game.id === 'penthouse' ? '#ed2868' : '#f12d54', roughness: 0.16, metalness: 0.22, transmission: 0.08, clearcoat: 0.85, emissive: '#8e1035', emissiveIntensity: 0.45 });
  if (item.type === 'clue') {
    const stand = addMesh(group, new THREE.TorusGeometry(0.42, 0.05, 8, 24), gold, 0, 0.23, 0); stand.rotation.x = Math.PI / 2;
    const gem = addMesh(group, new THREE.OctahedronGeometry(0.37, 1), ruby, 0, 0.95, 0);
    gem.rotation.y = 0.35;
    const glow = new THREE.PointLight(0xff2b64, 1.4, 5, 2); glow.position.set(0, 1.15, 0); group.add(glow);
    group.userData.float = gem;
  } else if (item.type === 'coin') {
    const coin = addMesh(group, new THREE.CylinderGeometry(0.38, 0.38, 0.09, 32), gold, 0, 0.62, 0);
    coin.rotation.z = 0.08;
    const ring = addMesh(group, new THREE.TorusGeometry(0.29, 0.026, 7, 24), mat('#fff0ba', 0.2, 0.7), 0, 0.62, 0);
    ring.rotation.x = Math.PI / 2;
    group.add(spriteLabel('K', '#ffe8ad', 'rgba(94,57,15,.78)')).position.set(0, 0.64, 0.015);
    group.userData.float = coin;
  } else if (item.type === 'relay') {
    const base = addMesh(group, new THREE.BoxGeometry(0.88, 1.05, 0.58), mat('#25232a', 0.24, 0.65), 0, 0.56, 0);
    addMesh(group, new THREE.BoxGeometry(0.55, 0.36, 0.07), mat('#492331', 0.28, 0.4), 0, 0.73, 0.31);
    const indicator = addMesh(group, new THREE.SphereGeometry(0.11, 12, 8), mat('#ff3d55', 0.2, 0.3, { emissive: '#ee2748', emissiveIntensity: 0.9 }), 0, 0.72, 0.39);
    group.userData.indicator = indicator; group.userData.base = base;
  } else if (item.type === 'mirror') {
    const frame = addMesh(group, new THREE.BoxGeometry(1.15, 1.9, 0.12), gold, 0, 1.02, 0);
    const mirror = addMesh(group, new THREE.BoxGeometry(0.96, 1.66, 0.06), mat('#c5d5dd', 0.12, 0.88, { metalness: 0.88, emissive: '#536674', emissiveIntensity: 0.22 }), 0, 1.02, 0.09);
    group.userData.float = mirror;
    group.add(spriteLabel(`MIRROR 0${Number(item.id.slice(-1)) + 1}`, '#fff0d1', 'rgba(28,22,27,.84)')).position.set(0, 2.25, 0);
  } else if (item.type === 'secret') {
    addMesh(group, new THREE.TorusGeometry(0.35, 0.04, 8, 22), gold, 0, 0.3, 0).rotation.x = Math.PI / 2;
    const charm = addMesh(group, new THREE.DodecahedronGeometry(0.25), ruby, 0, 0.72, 0);
    group.userData.float = charm;
  } else if (item.type === 'lift') {
    const brass = mat('#d6ad64', 0.24, 0.82, { emissive: '#8a5428', emissiveIntensity: 0.22 });
    const platform = addMesh(group, new THREE.BoxGeometry(1.9, 0.22, 1.9), brass, 0, 0.38, 0);
    const legs = [];
    for (const x of [-0.87, 0.87]) for (const z of [-0.87, 0.87]) legs.push(addMesh(group, new THREE.BoxGeometry(0.1, 2.4, 0.1), brass, x, 1.2, z));
    addMesh(group, new THREE.BoxGeometry(0.6, 0.58, 0.12), mat('#25232a', 0.27, 0.62), 1.25, 0.43, 0.25);
    addMesh(group, new THREE.SphereGeometry(0.09, 10, 8), mat('#51dcaa', 0.18, 0.3, { emissive: '#20a877', emissiveIntensity: 0.75 }), 1.25, 0.59, 0.33);
    group.userData.platform = platform;
  }
  root.add(group);
  item.root = group;
  item.position = p.clone().add(vec(0, item.type === 'mirror' ? 0.7 : 0, 0));
  return group;
}

function createMovingWall(root, mover, maze, game) {
  const from = worldAt(mover.from, maze.size);
  const dir = mover.dir;
  const center = from.clone();
  if (dir === 'n') center.z -= CELL_SIZE / 2;
  if (dir === 's') center.z += CELL_SIZE / 2;
  if (dir === 'e') center.x += CELL_SIZE / 2;
  if (dir === 'w') center.x -= CELL_SIZE / 2;
  const horizontal = dir === 'n' || dir === 's';
  const group = new THREE.Group(); group.position.copy(center); root.add(group);
  const material = mat(game.theme.wall, game.id === 'ruby' ? 0.85 : 0.27, game.id === 'ruby' ? 0.05 : 0.68);
  const panel = addMesh(group,
    new THREE.BoxGeometry(horizontal ? CELL_SIZE : WALL_THICK, WALL_HEIGHT, horizontal ? WALL_THICK : CELL_SIZE),
    material, 0, WALL_HEIGHT / 2, 0);
  const trim = mat(game.theme.trim, 0.24, 0.82, { emissive: new THREE.Color(game.theme.glow), emissiveIntensity: 0.16 });
  addMesh(group, new THREE.BoxGeometry(horizontal ? CELL_SIZE : 0.09, 0.12, horizontal ? 0.09 : CELL_SIZE), trim, 0, WALL_HEIGHT - 0.22, 0);
  mover.root = group; mover.panel = panel; mover.horizontal = horizontal; mover.center = center;
}

function createGate(root, gate, maze, game) {
  const center = worldAt(gate.from, maze.size);
  const dir = gate.dir;
  if (dir === 'n') center.z -= CELL_SIZE / 2;
  if (dir === 's') center.z += CELL_SIZE / 2;
  if (dir === 'e') center.x += CELL_SIZE / 2;
  if (dir === 'w') center.x -= CELL_SIZE / 2;
  const horizontal = dir === 'n' || dir === 's';
  const group = new THREE.Group(); group.position.copy(center); root.add(group);
  const crystal = new THREE.MeshPhysicalMaterial({ color: '#bd1845', roughness: 0.19, metalness: 0.22, transmission: 0.06, emissive: '#b01b46', emissiveIntensity: 0.75 });
  const body = addMesh(group, new THREE.BoxGeometry(horizontal ? CELL_SIZE : 0.52, 2.55, horizontal ? 0.52 : CELL_SIZE), crystal, 0, 1.25, 0);
  const top = addMesh(group, new THREE.BoxGeometry(horizontal ? CELL_SIZE + 0.3 : 0.77, 0.16, horizontal ? 0.77 : CELL_SIZE + 0.3), mat(game.theme.trim, 0.2, 0.8), 0, 2.56, 0);
  gate.root = group; gate.body = body; gate.horizontal = horizontal; gate.center = center;
}

function buildExit(root, maze, game) {
  const p = worldAt(maze.exit, maze.size, 0);
  const portal = new THREE.Group(); portal.position.copy(p); root.add(portal);
  const brass = mat(game.theme.trim, 0.2, 0.8, { emissive: new THREE.Color(game.theme.trim), emissiveIntensity: 0.18 });
  if (game.id === 'vault') {
    const disk = addMesh(portal, new THREE.CylinderGeometry(1.35, 1.35, 0.32, 48), mat('#826038', 0.23, 0.82), 0, 1.8, 0.12);
    disk.rotation.x = Math.PI / 2;
    portal.userData.rings = [];
    for (const r of [1.5, 1.12, 0.75]) {
      const ring = addMesh(portal, new THREE.TorusGeometry(r, 0.065, 8, 40), brass, 0, 1.8, 0.32);
      ring.position.z = 0.26; ring.userData.turn = true; portal.userData.rings.push(ring);
    }
    const hub = addMesh(portal, new THREE.CylinderGeometry(0.22, 0.22, 0.18, 20), brass, 0, 1.8, 0.38);
    hub.rotation.x = Math.PI / 2;
    portal.userData.hub = hub;
    portal.add(spriteLabel('MAIN VAULT', '#ffe6ae', 'rgba(55,31,12,.83)')).position.set(0, 3.5, 0.1);
  } else if (game.id === 'penthouse') {
    const frame = addMesh(portal, new THREE.BoxGeometry(2.7, 3.2, 0.32), brass, 0, 1.58, -0.18);
    const doors = mat('#4f2939', 0.35, 0.4, { emissive: '#59152f', emissiveIntensity: 0.18 });
    portal.userData.doorL = addMesh(portal, new THREE.BoxGeometry(1.16, 2.82, 0.16), doors, -0.58, 1.47, 0.04);
    portal.userData.doorR = addMesh(portal, new THREE.BoxGeometry(1.16, 2.82, 0.16), doors, 0.58, 1.47, 0.04);
    portal.userData.frame = frame;
    portal.add(spriteLabel('PRIVATE ELEVATOR', '#fff0ce', 'rgba(36,18,27,.86)')).position.set(0, 3.5, 0.08);
    portal.visible = false;
  } else {
    const frame = addMesh(portal, new THREE.TorusGeometry(1.26, 0.16, 10, 36), brass, 0, 1.55, 0);
    frame.rotation.x = Math.PI / 2;
    const gem = addMesh(portal, new THREE.OctahedronGeometry(0.56, 1), new THREE.MeshPhysicalMaterial({ color: '#ff225d', roughness: 0.14, metalness: 0.28, emissive: '#a5123b', emissiveIntensity: 0.66 }), 0, 1.58, -0.17);
    portal.userData.gem = gem;
    portal.add(spriteLabel('CASINO EXIT', '#fff1c6', 'rgba(18,30,25,.83)')).position.set(0, 3.3, 0.1);
  }
  const glow = new THREE.PointLight(game.theme.glow, game.id === 'penthouse' ? 0.35 : 1.4, 9, 2);
  glow.position.set(0, 1.7, 1.1); portal.add(glow);
  return portal;
}

function buildBackdrop(root, game, maze) {
  const span = maze.size * CELL_SIZE;
  const dark = mat(game.id === 'penthouse' ? '#393043' : '#1b1820', 0.65, 0.16);
  const gold = mat(game.theme.trim, 0.28, 0.82, { emissive: new THREE.Color(game.theme.trim), emissiveIntensity: 0.28 });
  if (game.id === 'ruby' || game.id === 'vault') {
    const x = 0, z = -span / 2 - 13;
    addMesh(root, new THREE.BoxGeometry(25, 13, 6), dark, x, 6.4, z);
    addMesh(root, new THREE.BoxGeometry(27, 0.35, 6.5), gold, x, 13.05, z);
    for (let row = 0; row < 4; row++) for (let col = -5; col <= 5; col++) {
      const windowMat = mat(game.id === 'ruby' ? '#ae593c' : '#b86b32', 0.22, 0.15, { emissive: '#d9823d', emissiveIntensity: 0.55 });
      addMesh(root, new THREE.BoxGeometry(1.05, 1.6, 0.12), windowMat, col * 2.15, 2 + row * 2.3, z + 3.07);
    }
    if (game.id === 'ruby') {
      const dome = addMesh(root, new THREE.SphereGeometry(6.1, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat('#5b3146', 0.25, 0.36, { emissive: '#711e43', emissiveIntensity: 0.38 }), x, 13, z);
      dome.scale.y = 0.7;
      root.add(spriteLabel('LUHMAATX  ·  KILLAMANI CASINO', '#ffe4b4', 'rgba(43,20,27,.9)')).position.set(0, 9.3, z + 3.2);
    } else {
      const medallion = addMesh(root, new THREE.CylinderGeometry(2.5, 2.5, 0.7, 40), gold, 0, 7.4, z + 3.25);
      medallion.rotation.x = Math.PI / 2;
      root.add(spriteLabel('KILLAMANI · MAIN VAULT', '#ffe4b4', 'rgba(37,23,16,.89)')).position.set(0, 9.8, z + 3.5);
    }
  }
  // City silhouette beyond the playable boundary; individual towers stay cheap boxes.
  for (let i = 0; i < 22; i++) {
    const side = i % 2 ? -1 : 1;
    const x = side * (span / 2 + 10 + Math.random() * 17);
    const z = -span / 2 - 19 + Math.random() * (span + 38);
    const height = 7 + Math.random() * 16;
    const tower = addMesh(root, new THREE.BoxGeometry(4.2 + Math.random() * 4, height, 4), mat(i % 3 ? '#1d1b2a' : '#423040', 0.48, 0.28), x, height / 2 - 0.2, z);
    tower.castShadow = false;
    if (i % 3 === 0) addMesh(root, new THREE.BoxGeometry(3.5, 0.16, 3.4), gold, x, height - 0.17, z);
  }
}

function buildPenthouseRooftop(root, maze, game) {
  const span = maze.size * CELL_SIZE;
  const center = vec(0, 0, -span / 2 - 24);
  const deck = new THREE.Group(); deck.position.copy(center); root.add(deck);
  const marble = mat('#c9b8a7', 0.22, 0.32);
  const brass = mat('#d6af68', 0.22, 0.82, { emissive: '#b68134', emissiveIntensity: 0.16 });
  const pool = mat('#286776', 0.16, 0.5, { emissive: '#144b66', emissiveIntensity: 0.22, transparent: true, opacity: 0.9 });
  addMesh(deck, new THREE.BoxGeometry(30, 0.5, 21), marble, 0, -0.25, 0);
  addMesh(deck, new THREE.BoxGeometry(15, 0.18, 5.7), pool, 2, 0.07, -1.2);
  const poolEdge = addMesh(deck, new THREE.BoxGeometry(15.6, 0.2, 6.3), brass, 2, -0.01, -1.2);
  poolEdge.material = brass;
  for (const [x, z, w, d] of [[-14, 0, 0.2, 21], [14, 0, 0.2, 21], [0, 10, 28, 0.2], [0, -10, 28, 0.2]]) {
    addMesh(deck, new THREE.BoxGeometry(w, 1.2, d), mat('#b9cdd1', 0.14, 0.56, { transparent: true, opacity: 0.3 }), x, 0.68, z);
    addMesh(deck, new THREE.BoxGeometry(w, 0.07, d), brass, x, 1.27, z);
  }
  for (const x of [-10, -7]) {
    const sofa = addMesh(deck, new THREE.BoxGeometry(3.3, 0.6, 1.15), mat('#702d46', 0.83, 0.04), x, 0.31, 4.6);
    sofa.rotation.y = 0.12;
    addMesh(deck, new THREE.BoxGeometry(0.24, 0.68, 0.24), brass, x - 1.2, 0.15, 4.65);
    addMesh(deck, new THREE.BoxGeometry(0.24, 0.68, 0.24), brass, x + 1.2, 0.15, 4.65);
  }
  const spawn = center.clone().add(vec(-5.8, 0, 5.5));
  const reunion = center.clone().add(vec(4.2, 0, 5.5));
  const light = new THREE.PointLight(0xf8b98d, 1.4, 32, 1.8); light.position.set(0, 6, -2); deck.add(light);
  deck.add(spriteLabel('ROOFTOP · SUNSET', '#fff0d1', 'rgba(38,22,32,.82)')).position.set(0, 3.2, -7.7);
  return { deck, spawn, reunion, center, bounds: { minX: center.x - 12.5, maxX: center.x + 12.5, minZ: center.z - 8.5, maxZ: center.z + 8.5 } };
}

function addLantern(root, p, game) {
  const post = mat(game.id === 'ruby' ? '#ae7f49' : '#8b683c', 0.34, 0.68);
  const glow = mat(game.id === 'ruby' ? '#ffc778' : game.theme.trim, 0.2, 0.28, { emissive: '#e79b49', emissiveIntensity: 1.1 });
  addMesh(root, new THREE.CylinderGeometry(0.07, 0.11, 1.2, 8), post, p.x, 0.6, p.z);
  addMesh(root, new THREE.SphereGeometry(0.2, 12, 9), glow, p.x, 1.34, p.z);
  const light = new THREE.PointLight(game.theme.light, 0.7, 5.5, 2); light.position.set(p.x, 1.5, p.z); root.add(light);
}

export function createWorld(scene, gameId, profile, seed) {
  let worldElapsed = 0;
  const game = GAMES[gameId];
  const maze = createMaze(11, seed);
  buildObjectives(maze, gameId);
  const group = new THREE.Group(); group.name = `world:${gameId}`; scene.add(group);
  scene.background = new THREE.Color(game.theme.sky);
  scene.fog = new THREE.FogExp2(game.theme.fog, gameId === 'penthouse' ? 0.006 : 0.009);
  group.add(new THREE.HemisphereLight('#ffe3bd', game.id === 'ruby' ? '#17362e' : '#211820', 1.35));
  const sun = new THREE.DirectionalLight(game.id === 'penthouse' ? '#ffd1a6' : '#ffddb1', 2.25);
  sun.position.set(-18, 28, 14); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -34; sun.shadow.camera.right = 34; sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34;
  group.add(sun);
  const fill = new THREE.PointLight(game.theme.light, 0.9, 50, 1.4); fill.position.set(4, 15, -4); group.add(fill);

  buildFloor(group, maze, game);
  const specialEdges = new Set([...maze.gates, ...maze.movingWalls].map(i => edgeId(i.from, i.to)));
  buildWallInstances(group, maze, game, specialEdges);
  maze.gates.forEach(g => createGate(group, g, maze, game));
  maze.movingWalls.forEach(w => createMovingWall(group, w, maze, game));
  buildBackdrop(group, game, maze);
  const exit = buildExit(group, maze, game);

  const allItems = [...maze.items, ...maze.switches, ...maze.mirrors];
  const items = allItems.map(item => createItemVisual(group, item, maze, game));
  if (maze.lift) createItemVisual(group, maze.lift, maze, game);
  const npcProfile = { ...profile, outfit: game.id === 'penthouse' ? 'gala-afterglow' : 'gold-operator', hair: 'dark-gold' };
  const npcs = [];
  if (maze.friend) {
    const friend = createAvatar(npcProfile, { name: 'Zuri', accent: '#f8a6cc', remote: true });
    friend.root.position.copy(worldAt(maze.friend.cell, maze.size)); friend.root.rotation.y = Math.PI;
    friend.root.userData.interaction = maze.friend; group.add(friend.root);
    const label = spriteLabel('ZURI  ♥', '#ffe1ed', 'rgba(55,21,39,.88)'); label.position.set(0, 2.67, 0); friend.root.add(label);
    maze.friend.position = friend.root.position.clone(); maze.friend.root = friend.root;
    npcs.push({ id: 'friend', avatar: friend, mood: 'hopeful', name: 'Zuri', position: maze.friend.position });
  }
  if (maze.rival) {
    const rivalProfile = { ...profile, outfit: 'midnight-vault', hair: 'plum' };
    const rival = createAvatar(rivalProfile, { name: 'Raven', accent: '#ee6590', remote: true });
    rival.root.position.copy(worldAt(maze.rival.cell, maze.size)); rival.root.rotation.y = -Math.PI / 2;
    rival.root.userData.interaction = maze.rival; group.add(rival.root);
    const label = spriteLabel('RAVEN  ◆', '#ffd4dc', 'rgba(48,19,31,.88)'); label.position.set(0, 2.67, 0); rival.root.add(label);
    maze.rival.position = rival.root.position.clone(); maze.rival.root = rival.root;
    npcs.push({ id: 'rival', avatar: rival, mood: 'guarded', name: 'Raven', position: maze.rival.position });
  }

  const exitPosition = worldAt(maze.exit, maze.size).add(vec(0, 0, 0));
  const lanternCells = maze.path.filter((_, i) => i % 13 === 5).slice(0, 5);
  lanternCells.forEach(c => {
    const p = worldAt(c, maze.size);
    const offset = (c.x + c.z) % 2 ? 1.1 : -1.1;
    addLantern(group, p.add(vec(offset, 0, 0)), game);
  });
  const securityBeams = [];
  const securityCameras = [];
  if (gameId === 'vault') {
    for (let i = 0; i < 2; i++) {
      const c = maze.at(i === 0 ? 0.46 : 0.76);
      const p = worldAt(c, maze.size);
      const relay = maze.switches[i];
      const beamGroup = new THREE.Group(); beamGroup.position.copy(p); group.add(beamGroup);
      const laserMat = new THREE.MeshBasicMaterial({ color: '#ff2b52', transparent: true, opacity: 0.85 });
      const a = addMesh(beamGroup, new THREE.BoxGeometry(3.7, 0.055, 0.055), laserMat, 0, 1.24, 0);
      const b = addMesh(beamGroup, new THREE.BoxGeometry(3.7, 0.055, 0.055), laserMat, 0, 1.76, 0);
      a.rotation.y = Math.PI / 4; b.rotation.y = -Math.PI / 4;
      const beam = new THREE.PointLight(0xff263e, 0.48, 4, 2); beam.position.set(0, 1.5, 0); beamGroup.add(beam);
      securityBeams.push({ id: `beam-${i}`, root: beamGroup, relay, position: p.clone(), enabled: true });
    }
  }
  if (gameId === 'vault') {
    [0.22, 0.53, 0.88].forEach((fraction, i) => {
      const p = worldAt(maze.at(fraction), maze.size);
      const camera = new THREE.Group(); camera.position.copy(p).add(vec(i % 2 ? 1.55 : -1.55, 2.55, 0));
      const shell = mat('#32252a', 0.26, 0.72);
      addMesh(camera, new THREE.BoxGeometry(0.55, 0.32, 0.55), shell, 0, 0, 0);
      const lens = addMesh(camera, new THREE.SphereGeometry(0.15, 12, 10), mat('#ef4655', 0.16, 0.3, { emissive: '#bf1c2e', emissiveIntensity: 0.8 }), 0, -0.03, 0.27);
      lens.scale.set(1, 0.68, 0.75); group.add(camera); securityCameras.push(camera);
    });
  }

  const roof = gameId === 'penthouse' ? buildPenthouseRooftop(group, maze, game) : null;
  if (roof) {
    const cityLights = new THREE.Group(); cityLights.position.set(roof.center.x, 0, roof.center.z - 10); group.add(cityLights);
    for (let i = 0; i < 11; i++) {
      const h = 7 + Math.random() * 13, x = -44 + i * 8.5;
      addMesh(cityLights, new THREE.BoxGeometry(4.6, h, 4), mat(i % 2 ? '#352c42' : '#43334a', 0.48, 0.22), x, h / 2, -7 - Math.random() * 9);
    }
  }

  const interactables = [
    ...maze.items.map(item => ({ type: item.type, id: item.id, item, position: item.position })),
    ...npcs.map(npc => ({ type: npc.id, id: npc.id, npc, position: npc.position })),
    { type: 'exit', id: 'exit', position: exitPosition, root: exit }
  ];
  maze.switches.forEach(item => interactables.push({ type: item.type, id: item.id, item, position: item.position }));
  maze.mirrors.forEach(item => interactables.push({ type: item.type, id: item.id, item, position: item.position }));
  if (maze.lift) interactables.push({ type: 'lift', id: 'vault-lift', item: maze.lift, position: maze.lift.position });

  const world = {
    game, maze, group, exit, items, npcs, interactables, securityBeams, securityCameras, roof,
    startWorld: worldAt(maze.start, maze.size).add(vec(0, 0, 0.28)),
    exitPosition,
    roofSpawn: roof?.spawn,
    roofFriendPosition: roof?.reunion,
    roofBounds: roof?.bounds,
    isOnRoof: false,
    setGateOpen(id, open = true) {
      const gate = maze.gates.find(g => g.id === id); if (!gate) return;
      gate.open = open; gate.target = open ? 1 : 0;
    },
    setElevatorRevealed(value) { if (gameId === 'penthouse') exit.visible = !!value; },
    activateLift() {
      if (!maze.lift || gameId !== 'vault') return false;
      maze.lift.lastUse = worldElapsed;
      return true;
    },
    useLift(avatar) {
      if (!maze.lift || gameId !== 'vault') return false;
      const destination = worldAt(maze.lift.destination, maze.size);
      avatar.root.position.x = destination.x; avatar.root.position.z = destination.z;
      this.activateLift();
      return true;
    },
    setRelayDisabled(id, disabled = true) {
      const beam = securityBeams.find(b => b.relay.id === id); if (!beam) return;
      beam.enabled = !disabled; beam.root.visible = !disabled;
      const indicator = beam.relay.root?.userData.indicator;
      if (indicator) { indicator.material.color.set(disabled ? '#57d79b' : '#ff3d55'); indicator.material.emissive.set(disabled ? '#2ab77c' : '#ee2748'); }
    },
    setItemTaken(id) {
      const item = maze.items.find(i => i.id === id) || maze.switches.find(i => i.id === id) || maze.mirrors.find(i => i.id === id);
      if (!item) return;
      item.active = false;
      if (item.type === 'relay') return;
      if (item.type === 'mirror') {
        item.solved = true; item.active = true;
        const inner = item.root?.children.find(c => c.geometry?.type === 'BoxGeometry' && c.material?.color?.getHex() === new THREE.Color('#c5d5dd').getHex());
        if (inner) { inner.material.color.set('#8bdbca'); inner.material.emissive?.set('#397e70'); }
        return;
      }
      if (item.root) item.root.visible = false;
    },
    turnMirror(id, turns) {
      const item = maze.mirrors.find(m => m.id === id); if (!item || item.solved) return false;
      item.turns = ((Number(turns) % 4) + 4) % 4;
      if (item.root) {
        item.root.rotation.y = item.turns * Math.PI / 2;
        if (item.root.userData.float?.material) item.root.userData.float.material.emissiveIntensity = 0.22 + item.turns * 0.04;
      }
      return item.turns === item.target;
    },
    beginRooftop(avatar) {
      if (!roof || this.isOnRoof) return;
      this.isOnRoof = true;
      avatar.root.position.copy(roof.spawn);
      avatar.root.rotation.y = 0;
      const friend = npcs.find(n => n.id === 'friend');
      if (friend) {
        friend.avatar.root.position.copy(roof.reunion);
        friend.position.copy(roof.reunion);
        if (maze.friend?.position) maze.friend.position.copy(roof.reunion);
      }
      scene.fog = new THREE.FogExp2(game.theme.fog, 0.0038);
    },
    update(dt, elapsed) {
      worldElapsed = elapsed;
      maze.items.forEach((item, i) => {
        if (!item.active || !item.root?.visible) return;
        item.root.rotation.y += dt * (item.type === 'coin' ? 1.5 : 0.55);
        if (item.root.userData.float) item.root.userData.float.position.y = (item.type === 'coin' ? 0.62 : item.type === 'mirror' ? 1.02 : 0.95) + Math.sin(elapsed * 1.6 + i) * 0.09;
      });
      if (maze.lift?.root?.userData.platform) {
        const t = elapsed - (maze.lift.lastUse || 0);
        maze.lift.root.userData.platform.position.y = 0.38 + Math.sin(elapsed * 1.25) * 0.18 + (t > 0 && t < 1.8 ? Math.sin(t * Math.PI) * 0.8 : 0);
      }
      maze.gates.forEach(gate => {
        const amount = THREE.MathUtils.damp(gate.amount || 0, gate.open ? 1 : 0, 2.5, dt); gate.amount = amount;
        if (gate.body) gate.body.position.y = 1.25 + amount * 3.1;
        if (gate.root) gate.root.visible = amount < 0.985;
      });
      maze.movingWalls.forEach((wall, i) => {
        const phase = (elapsed + wall.phase) % 13;
        wall.open = phase >= 9 && phase < 11.1;
        const amount = phase < 8.3 ? 0 : phase < 9 ? THREE.MathUtils.smoothstep(phase, 8.3, 9) : phase < 10.8 ? 1 : 1 - THREE.MathUtils.smoothstep(phase, 10.8, 12.1);
        if (wall.root) {
          const offset = amount * CELL_SIZE * 0.8;
          wall.root.position.x = wall.center.x + (wall.horizontal ? offset : 0);
          wall.root.position.z = wall.center.z + (wall.horizontal ? 0 : offset);
        }
      });
      if (exit.userData.gem) exit.userData.gem.rotation.y += dt * 0.55;
      if (exit.userData.hub) exit.userData.hub.rotation.z += dt * 0.28;
      if (exit.userData.rings) exit.userData.rings.forEach((ring, i) => { ring.rotation.z += dt * (i % 2 ? -1 : 1) * (0.12 + i * 0.06); });
      if (exit.userData.doorL) {
        const amount = THREE.MathUtils.damp(exit.userData.openAmount || 0, exit.userData.open ? 1 : 0, 1.8, dt);
        exit.userData.openAmount = amount;
        exit.userData.doorL.position.x = -0.58 - amount * 0.62;
        exit.userData.doorR.position.x = 0.58 + amount * 0.62;
      }
      if (gameId === 'vault') {
        securityBeams.forEach((b, i) => { if (b.enabled) b.root.children[0].material.opacity = 0.7 + Math.sin(elapsed * 7 + i) * 0.16; });
        securityCameras.forEach((camera, i) => { camera.rotation.y = Math.sin(elapsed * 0.38 + i) * 0.42; });
      }
    },
    dispose() {
      scene.remove(group);
      group.traverse(node => {
        if (node.geometry) node.geometry.dispose();
        if (node.material) (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => m.dispose());
      });
    }
  };

  return world;
}

export function worldPositionForCell(cell, size) { return worldAt(cell, size); }
export function gridCellFromWorld(position, size) {
  return {
    x: Math.max(0, Math.min(size - 1, Math.floor(position.x / CELL_SIZE + size / 2))),
    z: Math.max(0, Math.min(size - 1, Math.floor(position.z / CELL_SIZE + size / 2)))
  };
}

