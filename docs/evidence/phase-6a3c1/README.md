# Phase 6A3c1 visual inspection

These are development evidence, not new production assets or a browser Arrange
feature. `scripts/layout-evidence.mjs` uses the existing `renderWiringSvg`,
`fitWiring` and existing stylesheet without renderer changes. Regenerate after
`npm run build:app` with `node scripts/layout-evidence.mjs /tmp/layout-evidence`.
The six PNGs were captured from these HTML renderings in isolated headless Chrome
at 1400 × 620 CSS pixels. Both versions of all six examples were visually inspected.
SVGs retain exact native IDs in escaped title/accessible metadata.

| Example | Generated SVG | Provisional importer SVG | Chrome screenshot |
| --- | --- | --- | --- |
| Divider | [generated](divider-generated.svg) | [provisional](divider-provisional.svg) | [PNG](divider-generated.png) |
| RC low-pass | [generated](rc-low-generated.svg) | [provisional](rc-low-provisional.svg) | [PNG](rc-low-generated.png) |
| Unbalanced bridge | [generated](bridge-unbalanced-generated.svg) | [provisional](bridge-unbalanced-provisional.svg) | [PNG](bridge-unbalanced-generated.png) |
| Cauer | [generated](cauer-generated.svg) | [provisional](cauer-provisional.svg) | [PNG](cauer-generated.png) |
| Foster I | [generated](foster-I-generated.svg) | [provisional](foster-I-provisional.svg) | [PNG](foster-I-generated.png) |
| Foster II | [generated](foster-II-generated.svg) | [provisional](foster-II-provisional.svg) | [PNG](foster-II-generated.png) |

Observed: supply at left and continuous lower return; horizontal series R and
vertical shunt C; two bridge midpoints connected by the cross resistor with four
visible arms; Cauer's series/shunt sequence; Foster I's series sections ending in
a parallel RC block; Foster II's separate parallel series-RC branches. The older
hub-and-spoke images visibly cross wires and device/annotation regions. Generated
images have no such crossing; exact partition checks are separate evidence.

Limitations: the unchanged renderer prints values below vertical symbols. The
constructor uses rectangular lower-lead detours to avoid drawing through those
labels. These detours are electrically clear but less conventional than a renderer
with side-mounted vertical labels. The renderer also displays raw SI numbers
rather than engineering-unit abbreviations, and all junctions as hollow circles.
Bridge labels are small when fitted to a desktop viewport. Long ladders/branches
can require local scrolling in a future UI; no mobile editor interaction has been
implemented or tested here. Arbitrary font metrics, long Unicode labels, screen
readers, manual file pickers and browser Save/Open interactions are not certified
by these images. Exact text remains in title/accessible metadata and project data.

`evidence.json` records complete geometry pair counts for these generated cases.
Tests separately verify scientific reconstruction, project export/reopen and
independent electrical responses. PNGs are visual evidence, not golden test inputs.
