# Structure

`client/src/components/GameCanvas.tsx` owns the Babylon engine lifecycle plus the visual arcade frame: live portrait HUD, health bars, timer, meters, assist chips, combo badge, and pointer-friendly buttons that dispatch semantic keyboard actions.

`client/src/game/scene.ts` owns the orthographic arena scene, procedural fighters, stage geometry, hit resolution, particles, input manager, and a `battle-hud` CustomEvent stream consumed by React. Gameplay remains in plain TypeScript classes. Generated stage art is used as the frame background; Babylon procedural meshes provide deterministic collision and animation.

State ownership: `Fighter` owns movement, health, attack windows, combo buffer, and render nodes. `BattleWorld` owns both teams, timer, particles, hit resolution, and event emission. `InputManager` maps keyboard and pointer actions to semantic inputs.
