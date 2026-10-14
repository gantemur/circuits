# Readable circuit layouts — public release acceptance

Actual HTTPS verification on 2026-10-14, using a new isolated headless Chrome profile
with extensions disabled at https://gantemur.github.io/circuits/ after deployment
of `dcde3d2c10ce06e34672cef40a611c18372f9c54`. Both reviewed implementation commits
are preserved. [Initial workflow jobs](initial-workflows.json) all succeeded.
The separate documentation closure deployment and its exact final SHA/run links
are verified after push and reported in the release handoff.

Fresh archived-source checks: **542 tests, 69 focused expectations**, typecheck,
kernel/app/site builds, six demos and DOM-free smoke passed. Public HTML and its
versioned assets exactly matched the clean three-file package and the accepted
[SHA-256 hashes](public-assets.json). No ignored publishing directory was used.

## Rendered production evidence

| Structure | Public Graphical screenshot |
| --- | --- |
| Divider | [PNG](divider.png) |
| RC | [low-pass](rc-low.png), [high-pass](rc-high.png) |
| RLC | [PNG](rlc.png) |
| Bridge | [balanced](bridge-balanced.png), [unbalanced](bridge-unbalanced.png) |
| Cauer | [PNG](cauer.png) |
| Foster I / II | [series sections](foster-I.png), [parallel branches](foster-II.png) |
| Responsive comparison | [English 390](preview-en-390.png), [Mongolian 320](preview-mn-320.png) |
| Exact source-free IDs | [Mongolian 320](ports-mn-320.png) |

These are real Graphical canvases, not generated standalone SVGs. Supply-left
polarity, series/shunt organization, bridge cross branch, Cauer section order and
Foster series-versus-parallel organization match the accepted
[c1 visual evidence](../phase-6a3c1/README.md). p/n roles remain native data. Twelve
fixture variants were imported, including RL and parallel R/RC. Move/rotate/Undo
worked on every generated variant without Apply, and native exports stayed exact.
No initial save checkpoint was invented. Strict validation of actual downloaded
projects and independent physical results are recorded in [extended checks](extended.json).

## Interaction and persistence

[Browser results](browser-results.json) cover preview/cancel/use, exact geometry and
viewport Undo/Redo, completed downloads, reload and file-input reopening. The
[downloaded project](public-adopted-divider.cuf.json) is the actual public artifact;
reopening and downloading it again reproduced all project content. Saved geometry
survived navigation and Apply without automatic rearrangement. Identical-geometry
Fit had its own undoable step; saved-content comparison returned to its checkpoint.
Native export remained scientific-only. [Ownership checks](ownership.json) retired
previews after edits, text/science change-and-restore, example changes, Discard,
project Open and replacement candidates. Language changes alone retained consent.

[Port/mobile checks](ports-mobile.json) exercised EN/MN at 1280/390/320, exact
punctuation, Unicode, leading/trailing whitespace and markup-like IDs, with changed
resistor values preserving the parallel family. Missing, duplicate, stale and
reversed selectors and current synthesis handoffs were checked. Fallbacks retained
science for unsupported controlled models, unrecognized topology, oversized patterns
and geometry rejection; no partial layout was installed.

[Legacy checks](legacy.json) opened all 35 examples and exercised DC equivalent,
resistor Preview/Use/Return and all synthesis handoffs. [Additional checks](extra.json)
cover completed native downloads, valid/malformed native file input, pointer movement,
linear RC plots and language-preserved previews. Diode/BJT panels and active diode
cancellation were checked; [worker evidence](final-browser.json) separately shows
active synthesis startup cancellation and worker-target retirement.

Independent results from downloaded projects: divider 8 V, ±4 mA and signed
16/32/−48 mW; RC 0.5−0.5i and backward-Euler recurrence; RLC −10i; bridge midpoint
and cross-current references; all three distinct synthesis realizations at
1200−1600i Ω. Exact science comparisons are distinct from numerical evidence.
Private applied identity/revision and async race assertions come from deterministic
production-controller tests, not private-state instrumentation on the deployed page.

## Limits

No page overflow or application exceptions in completed acceptance runs. Before/
after drawings stack on mobile and scroll inside their containers. Small fitted
labels, raw SI numbers, hollow junctions and vertical lead detours remain accepted
limits. Font metrics beyond the bounded contract are not certified.

Actual file inputs were set through Chrome protocol; completed download events and
bytes were observed. Human OS file-dialog gestures, physical touch and screen-reader
behavior were not tested. Horizontal scroll position was exercised programmatically;
a physical wheel/touch gesture is not certified. Browser/GPU diagnostics are separate
from application exceptions. Harness wording/quoting/scroll timing corrections did
not change production code. No next development milestone was started.
