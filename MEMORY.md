# Memory

- `/home/ubuntu/upload/mvsc.zip` is a `TORRENTZIPPED` archive containing a Marvel vs. Capcom ROM set and key file. It is not used in the build.
- The safe target is a high-level original homage: 2D arcade tag combat, dense HUD framing, assist chips, super meters, combo callouts, neon stage, and physical-looking attack buttons.
- React owns the visible HUD while Babylon owns the canvas and simulation. HUD state crosses the boundary through a `battle-hud` CustomEvent.
- The generated rooftop art is now a real Babylon plane behind gameplay, not just a reference.
- Toto and Crater now use original transparent generated cutouts layered over procedural hitboxes. Wero and Miguel are represented in the assist-ready UI and can be promoted to full tag slots later.

- The new demo protagonists are DC and Wizz. DC uses the user-supplied ten-pose transparent sheet; Wizz uses the uploaded original transparent cutout.
