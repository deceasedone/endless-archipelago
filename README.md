# The Endless Archipelago

A cozy 3D sailing game for the browser. Sail a sea that has no edge, wake glowing shrines, read messages in bottles, chase treasure, race regattas and fish under strange stars.

Built with [three.js](https://threejs.org) and [Vite](https://vite.dev). Everything is generated in code: islands, boats, fish, sky, water and sound. There are no image, model or audio files.

## Run it

```bash
npm install
npm run dev
```

Then open the address Vite prints (usually http://localhost:5173).

To make a static build in `dist/`:

```bash
npm run build
```

## Controls

| Key | Action |
| --- | --- |
| `W A S D` / arrows | Sail and steer |
| Drag / scroll | Look around / zoom |
| `F` (when slow) | Fish: cast, hook, strike |
| `R` | Start or abandon a regatta |
| `L` | Captain's logbook |
| `U` | Shipwright (upgrades and sails) |
| `Tab` | Scorecard |
| `P` | Photo mode |
| `T` | Let time pass |
| `G` | Graphics quality |
| `M` | Mute |

Gamepads and touch screens work too.

## What's in it

- **Three modes:**
  - **Voyage:** a persistent world; you can change the sea number to sail a different one.
  - **Daily Voyage:** everyone gets the same sea today; wake 7 shrines as fast as you can.
  - **Lantern Run:** an endless night where shrines refuel your fading lantern.
- **Shrines:** some ask for a trial before they wake (circle the island, drift still beside it, or come back at night). Each one also lights a star in the Seven Stars constellation.
- **Bottles:** musings, riddles, shanties, recipes, letters, golden bottles, a 12-chapter story and treasure maps that lead to chests rising from the deep.
- **Fishing:** 17 catches you can see as 3D models. Shadows swim up to your bobber, fishing spots bubble with leaping fish, and every catch gets a reveal card.
- **Wind and weather:** points of sail change your speed; clear skies, fog banks and storms with lightning come and go.
- **Sea life:** dolphins, flying fish, turtles, glowing jellies, breaching whales and a ghost ship at midnight.
- **Progression:** a live score with chain combos, pearls, boat upgrades, sail colours, daily bounties, milestones, a logbook and local high scores.

Progress is saved in your browser (`localStorage`).

## Project layout

```
src/
  main.js         scene, game loop, modes, scoring, input
  ocean.js        water, sky and wake shaders
  boat.js         sailboat model and sailing physics
  archipelago.js  procedural islands, shrines and bottles
  weather.js      wind, clouds, rain and lightning
  wildlife.js     dolphins, whales, turtles, jellies, ghost ship
  fishmodels.js   procedural 3D fish and the catch-card renderer
  fishing.js      fishing spots, shadows and the reel minigame
  splash.js       pooled water droplets
  quests.js       treasure maps and regattas
  progress.js     save data, bounties and unlocks
  ui.js           HUD, panels and cards
  data.js         all the writing: notes, story, fish, upgrades
  audio.js        synthesised sound and music
```
