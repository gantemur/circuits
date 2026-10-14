# Phase 6A3c2 — actual browser layout evidence

Local task-branch verification, 2026-10-14; **not publication**. Isolated headless
Chrome loaded the clean built three-file application over local HTTP. These PNGs
capture the real Graphical editor, not standalone renderer fixtures. The accepted
[6A3c1 evidence](../phase-6a3c1/README.md) remains unchanged.

## Visual inspection

| Circuit | Actual editor | Comparison with accepted geometry |
| --- | --- | --- |
| Divider | [PNG](divider.png) | Supply left, series R1, shunt R2 and lower return unchanged |
| RC low/high pass | [low](rc-low.png), [high](rc-high.png) | Correct series/shunt R/C interchange, no lost leads |
| RL/RLC | [RL](rl.png), [RLC](rlc.png) | Series R/L and shunt termination visible |
| Parallel | [R](parallel-r.png), [RC](parallel-rc.png) | Shared end nodes, separate branches |
| Bridge | [balanced](bridge-balanced.png), [unbalanced](bridge-unbalanced.png) | Four arms and cross resistor; same accepted bridge layout |
| Cauer | [PNG](cauer.png) | Series/shunt order matches accepted Cauer SVG |
| Foster I | [PNG](foster-I.png) | Series sections ending in parallel RC block, as in accepted SVG |
| Foster II | [PNG](foster-II.png) | Parallel series-RC paths match accepted SVG |

The twelve fixture documents come from `test/support/layout-fixtures.mjs`. They
were selected through actual native file inputs. Source-free files used explicit
ordered selectors; synthesis workflow handoffs separately generated initial layouts
automatically from their current-document-owned port pair. All exported project
scientific documents matched the input exactly. An [unrecognized star](fallback.png) retained the
provisional importer and displayed the explicit no-template outcome.

[English desktop preview](preview-en-1280.png), [English 390](preview-en-390.png),
[English 320](preview-en-320.png), [Mongolian desktop](preview-mn-1280.png),
[Mongolian 390](preview-mn-390.png), [Mongolian 320](preview-mn-320.png).
Both before/after drawings stay present; mobile stacks them and scrolls locally.
[Exact-ID port controls at 320 px](ports-mn-320.png) retain punctuation/markup-looking
IDs literally. The six `ports-*.png` images cover EN/MN × desktop/390/320.
Page scroll widths were 1265/375/305 at 1280/390/320 CSS px (15 px scrollbar), with
580 px drawing scroll content. Focus returned to Suggest after Use/Cancel; language
switches preserved preview authorization. No application exceptions in completed runs.

## Interaction and file evidence

Actual production controls exercised: selection, pointer movement, properties,
wire split/delete/join/separate, history, preview cancellation/adoption/exact undo
and redo, stale edit-and-restore rejection, independent Form/JSON/Graphical drafts,
source-free selection and strict exact-ID project export.

[adopted-divider.cuf.json](adopted-divider.cuf.json) is a completed Chrome download.
After reload, `DOM.setFileInputFiles` selected that file through the actual project
input; Open confirmation and another completed download reproduced the entire
project exactly, including saved geometry and viewport. Opening did not rearrange
it. A prior moved drawing was exactly recovered by Undo, and Redo recovered the
proposal. Native JSON downloads also completed; valid native file import succeeded
and malformed JSON preserved the analyzed document. A human OS file-dialog gesture
was not performed; these are protocol file selections and completed browser downloads.

Legacy smoke opened all 35 examples, checked linear RC plots, DC equivalence,
resistor Preview/Use/Return, diode and BJT panels, all three synthesis methods and
port handoffs, and active diode/synthesis worker cancellation. Deterministic tests
cover delayed project-read/confirmation races; a human race is not claimed.
See [browser results](browser-results.json), [legacy results](legacy.json),
[extra checks](extra.json), [editing/worker checks](interactions.json),
[explicit fallback and active cancellation](final-browser.json) and
[port/mobile results](ports-mobile.json). The final broad worker run completed before
its Cancel click; a separate same-package run cancelled during startup before any
result, with an observed worker target lifecycle. Both outcomes are retained.

## Limits and reproducibility

Fit-to-view labels are small on bridges and long Foster networks. Zoom/inspector
and the exact topology table are still needed for detailed reading. Raw SI values,
hollow junction circles, lower-lead detours around vertical labels and arbitrary
font metrics remain accepted provisional limitations. At mobile widths the whole
drawing requires horizontal local scrolling. No renderer redesign, bend dragging,
general autorouter, screen-reader audit or physical touch-device test was performed.

Build in a clean checkout (`npm ci`, `npm run build:site`), serve `publish/`, open
Edit circuit → Graphical, then reproduce the file/example and preview actions above.
Use `test/support/layout-fixtures.mjs` for the exact fixtures and
`test/layout-browser.test.mjs` for deterministic production-event-path checks.
The final clean-source package was byte-compared to the browser-tested package;
[SHA-256 hashes](package-hashes.json) identify its three assets and matching relative
content-version references. Assets intentionally differ from released main.
