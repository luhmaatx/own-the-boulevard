# LUHMAATX Game Prototypes

This repository contains two browser game projects.

## Own the Boulevard

The standalone 3D prototype is in [index.html](index.html). It runs in a modern browser with WebGL enabled.

## Killamani Maze Club

Ruby Run, Vault Run, and Penthouse Escape are in [maze-club/](maze-club/). The source uses Node 20 and Three.js.

To run locally:

```bash
cd maze-club
npm ci
npm run dev
```

The Maze Club project includes its own Render blueprint and a small WebSocket server for live parties. GitHub Pages alone cannot host that server.
