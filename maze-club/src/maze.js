const DIRECTIONS = [
  { key: 'n', dx: 0, dz: -1, opposite: 's' },
  { key: 'e', dx: 1, dz: 0, opposite: 'w' },
  { key: 's', dx: 0, dz: 1, opposite: 'n' },
  { key: 'w', dx: -1, dz: 0, opposite: 'e' }
];

function seedNumber(seed) {
  if (Number.isFinite(seed)) return (seed >>> 0) || 1;
  const text = String(seed ?? 'maze'); let hash = 2166136261;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) || 1;
}
function seededRandom(seed) {
  let state = seedNumber(seed);
  return () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const keyOf = (x, z) => `${x},${z}`;
const clampIndex = (value, max) => Math.max(1, Math.min(max - 2, Math.round(value)));

export function createMaze(size = 11, seed = Math.floor(Math.random() * 0xffffffff)) {
  const random = seededRandom(seed);
  const cells = Array.from({ length: size }, (_, x) => Array.from({ length: size }, (_, z) => ({
    x, z, walls: { n: true, e: true, s: true, w: true }, visited: false
  })));
  const start = { x: 0, z: 0 };
  const exit = { x: size - 1, z: size - 1 };
  const stack = [cells[start.x][start.z]];
  cells[start.x][start.z].visited = true;

  while (stack.length) {
    const current = stack[stack.length - 1];
    const choices = DIRECTIONS
      .map(d => ({ d, x: current.x + d.dx, z: current.z + d.dz }))
      .filter(p => p.x >= 0 && p.z >= 0 && p.x < size && p.z < size && !cells[p.x][p.z].visited);
    if (!choices.length) { stack.pop(); continue; }
    const { d, x, z } = choices[Math.floor(random() * choices.length)];
    const next = cells[x][z];
    current.walls[d.key] = false;
    next.walls[d.opposite] = false;
    next.visited = true;
    stack.push(next);
  }
  cells.forEach(row => row.forEach(cell => delete cell.visited));
  const path = findPath(cells, size, start, exit);
  const at = fraction => path[clampIndex((path.length - 1) * fraction, path.length)] || exit;
  const special = {};

  return {
    size, cells, start, exit, path, seed, random,
    items: [], gates: [], switches: [], mirrors: [],
    friend: null,
    movingWalls: [],
    at,
    directionBetween(a, b) {
      return DIRECTIONS.find(d => a.x + d.dx === b.x && a.z + d.dz === b.z);
    },
    isBlocked(a, b, progress = {}) {
      if (b.x < 0 || b.z < 0 || b.x >= size || b.z >= size) return true;
      const d = DIRECTIONS.find(v => a.x + v.dx === b.x && a.z + v.dz === b.z);
      if (!d) return true;
      const edgeMatch = item => (item.from.x === a.x && item.from.z === a.z && item.to.x === b.x && item.to.z === b.z) || (item.from.x === b.x && item.from.z === b.z && item.to.x === a.x && item.to.z === a.z);
      const gate = this.gates.find(edgeMatch);
      if (gate) return !((progress.clues || 0) >= gate.requires);
      const mover = this.movingWalls.find(edgeMatch);
      if (mover) return !mover.open;
      return !!cells[a.x][a.z].walls[d.key];
    },
    findRoute(from, to, progress = {}) {
      const queue = [from], previous = new Map([[keyOf(from.x, from.z), null]]);
      while (queue.length) {
        const p = queue.shift();
        if (p.x === to.x && p.z === to.z) break;
        for (const d of DIRECTIONS) {
          const next = { x: p.x + d.dx, z: p.z + d.dz };
          const k = keyOf(next.x, next.z);
          if (!previous.has(k) && !this.isBlocked(p, next, progress)) {
            previous.set(k, keyOf(p.x, p.z)); queue.push(next);
          }
        }
      }
      const target = keyOf(to.x, to.z);
      if (!previous.has(target)) return [];
      const route = [];
      let current = target;
      while (current) {
        const [x, z] = current.split(',').map(Number);
        route.unshift({ x, z }); current = previous.get(current);
      }
      return route;
    }
  };
}

function findPath(cells, size, start, end) {
  const queue = [start], previous = new Map([[keyOf(start.x, start.z), null]]);
  while (queue.length) {
    const p = queue.shift();
    if (p.x === end.x && p.z === end.z) break;
    for (const d of DIRECTIONS) {
      const next = { x: p.x + d.dx, z: p.z + d.dz };
      const k = keyOf(next.x, next.z);
      if (next.x >= 0 && next.z >= 0 && next.x < size && next.z < size && !cells[p.x][p.z].walls[d.key] && !previous.has(k)) {
        previous.set(k, keyOf(p.x, p.z)); queue.push(next);
      }
    }
  }
  const path = [];
  let current = keyOf(end.x, end.z);
  while (current) {
    const [x, z] = current.split(',').map(Number);
    path.unshift({ x, z }); current = previous.get(current);
  }
  return path;
}

export function buildObjectives(maze, gameId) {
  const { path, at, cells } = maze;
  const edgeForStep = index => {
    const from = path[Math.max(0, index - 1)], to = path[index];
    const d = maze.directionBetween(from, to);
    return { from, to, dir: d.key, opposite: d.opposite, edge: `${from.x},${from.z}:${d.key}` };
  };
  const itemAt = (fraction, type, i = 0) => {
    const cell = at(fraction);
    return { id: `${type}-${i}`, type, cell: { ...cell }, active: true };
  };
  if (gameId === 'ruby') {
    [0.13, 0.39, 0.7].forEach((f, i) => maze.items.push(itemAt(f, 'clue', i)));
    [0.29, 0.61].forEach((f, i) => {
      const index = Math.max(2, Math.round((path.length - 1) * f));
      maze.gates.push({ id: `gate-${i}`, ...edgeForStep(index), requires: i + 1, open: false });
    });
  } else if (gameId === 'vault') {
    [0.09, 0.19, 0.29, 0.4, 0.5, 0.61].forEach((f, i) => maze.items.push(itemAt(f, 'coin', i)));
    [0.34, 0.67].forEach((f, i) => maze.switches.push(itemAt(f, 'relay', i)));
    maze.lift = { ...itemAt(0.82, 'lift'), destination: { ...at(0.9) }, active: true };
  } else {
    const clueHints = [
      'The east hall mirror turns once.',
      'The lounge mirror answers with two turns.',
      'The last mirror needs three turns.',
      'When all three reflections meet, the hidden elevator appears.'
    ];
    [0.09, 0.21, 0.34, 0.48].forEach((f, i) => maze.items.push({ ...itemAt(f, 'clue', i), clueText: clueHints[i] }));
    [0.62, 0.7, 0.78].forEach((f, i) => maze.mirrors.push({ ...itemAt(f, 'mirror', i), turns: 0, target: i + 1 }));
    maze.friend = itemAt(0.91, 'friend');
    maze.rival = itemAt(0.56, 'rival');
  }

  const protectedCells = new Set([
    keyOf(maze.start.x, maze.start.z), keyOf(maze.exit.x, maze.exit.z),
    ...maze.items.map(i => keyOf(i.cell.x, i.cell.z)),
    ...maze.mirrors.map(i => keyOf(i.cell.x, i.cell.z)),
    ...(maze.friend ? [keyOf(maze.friend.cell.x, maze.friend.cell.z)] : [])
  ]);
  const candidates = [];
  for (let x = 1; x < maze.size - 1; x++) for (let z = 1; z < maze.size - 1; z++) {
    const cell = cells[x][z];
    for (const d of DIRECTIONS.slice(0, 2)) {
      const nx = x + d.dx, nz = z + d.dz;
      if (nx < maze.size && nz < maze.size && cell.walls[d.key] && !protectedCells.has(keyOf(x, z)) && !protectedCells.has(keyOf(nx, nz))) {
        candidates.push({ from: { x, z }, to: { x: nx, z: nz }, dir: d.key, opposite: d.opposite, edge: `${x},${z}:${d.key}` });
      }
    }
  }
  if (candidates.length && gameId !== 'vault') {
    const selected = candidates[Math.floor(maze.random() * candidates.length)];
    maze.movingWalls.push({ id: 'moving-secret-wall', ...selected, open: false, phase: maze.random() * 10 });
    if (gameId === 'penthouse') {
      maze.items.push({ id: 'secret-jewel', type: 'secret', cell: { ...selected.to }, active: true });
    }
  }
}

export const DIRECTIONS_BY_KEY = Object.fromEntries(DIRECTIONS.map(d => [d.key, d]));
export const cellKey = keyOf;

