# Game Plan: DC King M2000 — Arcade Tag Fighter

## Reference interpretation

The supplied `mvsc.zip` is a 1990s arcade ROM dump. It is treated only as a visual and pacing reference. The build remains an original game: original character designs, generated stage art, original UI copy, procedural gameplay, and no extracted ROM data, sprites, code, or proprietary branding.

## Upgrade goals

The second iteration emphasizes the recognizable high-level language of a 2D arcade tag fighter: two opposing teams, portrait-framed life bars, central round timer, segmented super meters, assist-ready chips, a large combo callout, punchy touch buttons, a loud series mark, and a denser neon stage. The gameplay remains playable with A/D, W, J, K, L, and I, plus visible touch buttons.

## Verification

The live HUD must update while the fight runs; attacks must create sparks and knockback; the combo badge must appear above two hits; the generated rooftop must remain behind the Babylon actors; the desktop and narrow viewport must keep the HUD readable; `?demo` must create deterministic attacks; `pnpm check` and `pnpm build` must pass.


## DC vs Wizz demo update

The demo matchup is now DC versus Wizz. DC uses ten transparent frames extracted from the user-supplied blue-shirt sprite sheet, while Wizz uses an original transparent BMX-fighter cutout. The logo cell in the supplied sheet is excluded during deterministic extraction.
