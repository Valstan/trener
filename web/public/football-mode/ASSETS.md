# Football arcade assets

All 19 images in this directory were generated specifically for `trener` with the built-in
image generation tool. The enumerated design brief contains 19 distinct deliverables even
though its heading says 18. No external club marks, tournament marks, photos, or stock assets
were used.

## Prompt set

Every prompt required: no text, no watermark, no brands, no real club references, and a
polished arcade-sports presentation suitable for UI overlays.

- `field-day.webp` — exact top-down daylight pitch, complete white markings, alternating vivid
  grass stripes and a calm centre for UI.
- `field-night.webp` — exact top-down night pitch, deep emerald stripes and restrained golden
  floodlights around the edges.
- `stadium.webp` — wide symmetrical night stadium panorama with a dark centre and floodlights in
  the upper corners.
- `grass.webp` — seamless close top-down football grass texture without markings.
- `net.webp` — seamless white diamond goal net generated on flat magenta chroma key.
- `confetti.webp` — sparse red, blue, yellow and white football celebration confetti generated on
  flat green chroma key.
- `ball.png` — classic black-and-white football, stylized 3D game prop on green chroma key.
- `trophy.png` — original geometric golden championship trophy with a ball crown, explicitly
  unlike any real tournament trophy.
- `whistle.png` — silver referee whistle with a yellow lanyard.
- `boot.png` — red-and-gold football boot with molded studs.
- `gloves.png` — blue-and-orange goalkeeper gloves.
- `cones.png` — compact group of three orange training cones.
- `scarf.png` — flowing red, blue and gold supporter scarf without lettering.
- `jersey.png` — blank blue football jersey with amber trim.
- `clipboard.png` — navy tactics clipboard with a simple white pitch diagram and yellow pencil.
- `crest-firebird.png` — fictional red-and-gold firebird shield.
- `crest-lightning.png` — fictional blue-and-silver lightning/mountain shield.
- `crest-lynx.png` — fictional orange-and-black geometric lynx shield.
- `crest-wings.png` — fictional purple-and-gold winged-football shield.

Chroma-key outputs were processed with the installed `remove_chroma_key.py` helper, resized,
compressed, and validated for an alpha channel before the intermediate keyed files were removed.
