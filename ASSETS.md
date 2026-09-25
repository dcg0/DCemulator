# Assets

**Art direction:** Original neon Latin American arcade-fighter look: deep navy night, electric cyan, hot magenta, purple, and warm yellow accents; crisp illustrated silhouettes, angular arcade panels, reflective rooftop, energetic comic impact shapes. The supplied images and ROM archive are reference material only; no ROM data, sprites, or proprietary code are used.

## Generated art

| Name | Description | Size | Local source |
|------|-------------|------|-------------|
| visual-target | In-game Toto vs Crater composition reference | 2560x1440 | `/home/ubuntu/webdev-static-assets/dc-king-m2000/visual-target.png` |
| stage-neon-rooftop | Neon city rooftop background | 2560x1440 | `/home/ubuntu/webdev-static-assets/dc-king-m2000/stage-neon-rooftop.png` |
| fighter-lineup | Toto, Wero, Crater, Miguel character anchor | 2176x1632 | `/home/ubuntu/webdev-static-assets/dc-king-m2000/fighter-lineup.png` |
| impact-vfx | Original cyan, magenta, yellow and purple hit effects | 1920x1920 | `/home/ubuntu/webdev-static-assets/dc-king-m2000/impact-vfx.png` |
| character-select-upgrade | Original character-select composition with four portrait cards | 2560x1440 | `/home/ubuntu/webdev-static-assets/dc-king-m2000/character-select-upgrade.png` |
| arcade-hud-upgrade | Original layered HUD reference with meters and portrait slots | 2560x1440 | `/home/ubuntu/webdev-static-assets/dc-king-m2000/arcade-hud-upgrade.png` |
| toto-cutout | Transparent playable fighter illustration | 1536x2304 | `/manus-storage/toto-cutout_6d530982.png` |
| crater-cutout | Transparent playable fighter illustration | 1536x2304 | `/manus-storage/crater-cutout_83ceb255.png` |
| wero-cutout | Transparent assist fighter illustration | 1536x2304 | `/manus-storage/wero-cutout_58024d1f.png` |
| miguel-cutout | Transparent assist fighter illustration | 1536x2304 | `/manus-storage/miguel-cutout_a09f0c7a.png` |

## Runtime assignments

The rooftop art is rendered as a Babylon background plane behind the fighters and also anchors the page frame. Toto and Crater now render with their transparent illustrated cutouts over procedural hitboxes. Wero and Miguel are represented in the assist-ready UI and are ready for a later tag-slot expansion. The fighter lineup and character-select art guide the portrait cards. The HUD reference guides the React overlay.

| dc-animation-frames | Ten 192x192 transparent frames extracted from the supplied DC sheet | Managed storage `dc-00` through `dc-09` |
| wizz-cutout | Original transparent Wizz BMX-fighter cutout for the CPU side | `/manus-storage/wizz-cutout_8367d3ff.png` |
