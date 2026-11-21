# Killamani Maze Club

A Three.js browser prototype with three connected third-person maze adventures. Ruby Run opens first in the world select; Vault Run and Penthouse Escape use the same profile, Killa Coin balance, outfits, story reputation, and rewards.

## Run it

```bash
npm install
npm run dev
```

Open the Vite address it prints. `npm run dev` starts both the browser dev server and the small party WebSocket server. For a production build, run `npm run build` and then `npm start`. The Node server serves the built files and party connections from the same origin.

## Controls

- **WASD / arrows:** move
- **E:** interact with clues, relays, mirrors, people, and exits
- **Shift:** sprint
- **Click or tap a corridor:** move toward it
- **Drag:** rotate the third-person camera
- **Mobile:** on-screen joystick, run, and action buttons
- **Sound:** each maze has its own soft procedural ambient score; use the music button to mute it

## The three runs

- **Ruby Run:** collect three ruby clues, unlock two gates, and reach the casino exit.
- **Vault Run:** collect six Killa Coins, disable two laser relays, and reach the Main Vault within four minutes.
- **Penthouse Escape:** find four clues, align three mirrors, reunite with Zuri, choose what to reveal, then take the hidden elevator to the rooftop.

## Shared features

- A persistent local player profile with editable name, hair, outfits, personality traits, friends, Killa Coins, reputation, badges, and furniture unlocks.
- Quest progress and the current maze position save in the browser. All three worlds use one profile on that device.
- Party links carry a room code and maze seed. Parties support up to four players; the host and guests share movement, clue collection, relays, mirrors, story choices, and exit progress while connected.
- Party state is relayed by the included Node WebSocket server. Deploy the built site and server together on a Node host for friends to join over the internet. Telegram WebApp viewport helpers are included; host it over HTTPS before attaching it to a Telegram bot.
- The avatar is an articulated, animated procedural rig so the prototype works without a large model download. `GLTFLoader` support is wired to the optional `/assets/avatars/player.glb` override. Export GLB/glTF 2.0 models in meters, Y-up, facing +Z; optional Idle, Walk, Run, and Emote clips are recognized.
- `public/concept/` keeps the three supplied visual boards alongside the game selector.

## Deploy

The included `render.yaml` describes a Node web service that serves the built game and its party WebSocket endpoint together. Connect this project to a Git repository and deploy it as a Render Blueprint. For Telegram, use the deployed HTTPS address as the Mini App URL in your bot configuration.

## Scope

This is a playable foundation rather than a production art build. The environments and characters are assembled from optimized Three.js geometry, with a shared GLB path for replacing the procedural avatar. Profiles are local to each browser; the party server synchronizes a live run but does not provide account login or cross-device profile storage. Party room state lives in the running Node process, so parties should join the same deployed service instance.
