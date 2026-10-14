# Headless wiring model API — Phase 6A1

This API is editor infrastructure, not part of the numerical `src/index.ts` entry.
Import from `web/wiring-*.ts` in TypeScript. The test entry bundles the same modules
as `dist/wiring-test.js`; it is not a public application asset. No UI is connected.

## State and conversion

`emptyWiring(initial?)` creates the reference hub named `0`, with equilibrium
initialization by default. `importWiring(document)` first validates strict v1/v2/v3.
Supported v1 R/C/L/V/I imports return `{status:'editable',graph}`; other valid
documents return `{status:'unsupported',document,reason}` with an intact validated
copy. Invalid native input throws its existing strict validation error.

`WiringGraph` contains devices, terminal/junction/free vertices, ideal wires, name
anchors, reference vertex, sources, observations, storage entries, placements,
vertex positions and edge routes. Internal `h…` handles are session identities;
they are never native names. Exact IDs are neither trimmed nor used as object
prototype properties. Terminal arrays are ordered `p,n` and extensible to later
roles without inferring connectivity through a device. This phase accepts only
the two-terminal types listed above.

All numeric scientific edits are text. Source drafts carry DC, optional RMS AC and
optional constant/step/sinusoid fields. Adding V/I defaults DC=0, AC=(0,0), constant
waveform=0. Editing DC alone does not implicitly rewrite a waveform. C/L starts
with specified storage value 0 when the draft uses storage initialization. SI units
and positive p-to-n voltage/current conventions remain those of native v1.

`nativeCandidate(graph)` returns `{status:'ok',document}` or
`{status:'invalid',diagnostics}` without applying anything. Diagnostics carry
category, stable code, handles, technical English message and, for strict native
errors, original parameters. A future UI must translate codes rather than retain
rendered error strings. Completion, names/reference and dependencies precede strict
native validation. The first blocking diagnostic is returned; further issues can
be checked after correction. Invalid numeric text remains in the draft.

Every graph component becomes a named native node, including unused hubs or free
construction vertices. A pending terminal blocks conversion; an intentional open
is a real singleton node. No leakage or implicit connection is added. A shorted
component or inconsistent source constraint can be native-valid and still fail
analysis. `geometryDiagnostics` is separate: candidate validity says nothing about
a readable drawing. Imported placement is provisional, not recovered routing.

## Pure transactions

`transact(graph, operation)` returns a new graph on success and never mutates its
input. Success includes created handles, scientific/geometry change flags and
before/after net partitions, anchors and resolved voltage observations. Rejection
returns diagnostics and no partially modified graph.

| Operation | Contract |
| --- | --- |
| `add-device` | Type, exact fresh ID, optional value/label/position; two pending terminals and required experiment defaults |
| `add-vertex` | Explicit junction or free endpoint, finite position, optional unique name |
| `connect` | Two existing distinct vertices, optional bends; explicit `survivingName` for non-ground name conflicts |
| `split-wire` | Edge, zero-based route segment, fraction strictly between 0 and 1; returns junction |
| `attach-to-segment` | Existing vertex to selected edge interior, split and connection in one atomic history step |
| `join-crossing` | Two explicitly selected route segments; creates a shared vertex only at a resolved proper crossing |
| `separate` | Nonempty proper subset of a junction's incident edges moves to a new coincident junction; remaining edges and original probe anchors stay |
| `delete-wire`, `disconnect` | Remove one edge or all edges at a terminal; a terminal losing its last wire becomes pending |
| `mark-open` | Accept only an isolated terminal; never detaches an existing wire |
| `copy-device` | Fresh native/internal identities, copied scientific data, offset placement, pending terminals with no copied external wires |
| `delete-device` | Remove own source/storage; dependent current probes require explicit `deleteObservations` list |
| `rename-device`, `rename-node` | Preserve stable references; reject empty/duplicate names and ordinary ground renaming |
| `set-reference` | Swap selected net's name with `0`, anchor reference at the selected vertex; no wire or terminal reversal |
| `move-device`, `rotate-device` | Placement or integer quarter turns; endpoint coordinates follow p/n without swapping roles |
| `move-vertex`, `move-bends` | Junction/free point or route bends only; terminal positions belong to their symbol |
| `edit-value`, `edit-source`, `edit-initial` | Commit correctable numeric text, validated at candidate time |
| `set-initial` | Equilibrium removes storage entries; storage supplies missing C/L values as zero |
| `add-observation`, `delete-observation` | Explicit voltage anchors or stable current-device reference |

Deleting a device converts its terminal vertices into free endpoints, preserving
external wires, net anchors and voltage probes. It does not silently delete an
external network. Nodes may consequently remain unused until future explicit
cleanup. Split fragments retain the original name where its anchor remains;
other fragments receive the first available `n1`, `n2`, … in vertex traversal
order. Native node order follows surviving name-anchor order. Ground merges always
retain `0`; any non-ground survivor request cannot override that rule.

Coordinates must stay within ±1e6 drawing units, including derived symbol terminals;
each route has at most 64 bends. Polylines derive their first/last points from edge
vertices. Parallel, collinear, endpoint-only and numerically unresolved near-parallel
segment intersections do not qualify for `join-crossing`; endpoint attachment has
its own explicit operation. The determinant roundoff guard is in drawing-unit² and
has no relationship to circuit-analysis tolerances. No hit testing or autorouting.

## Ownership and history

`createWiringDraft({document,revision}, historyLimit=100)` returns an editable draft
or unsupported outcome. Limit is 1–1000. `commitWiring` commits a successful pure
transaction, retaining before/after values only for changed model collections and
metadata. One operation is one step; rejection/no-op adds none. `undoWiring` and
`redoWiring` restore exact identities/content. Revisions advance monotonically;
new commits discard the abandoned redo branch. This bounded in-memory history is
not a persistence or collaboration protocol.

`wiringConflict` checks applied document identity, revision and serialized snapshot.
`wiringDirty` compares the entire graph, including geometry, with its checkpoint.
`synchronizeWiring` reloads only clean drafts; dirty drafts remain conflicted.
An explicit `discard=true` requests replacement. Unsupported replacements do not
destroy the existing draft. Existing Form and JSON ownership is untouched.

`applyWiring(draft, applied)` guards ownership even for clean drafts, then builds the
strict candidate. It mutates the supplied authority object only for a scientific
change, replacing its document and incrementing its revision once. Unchanged native
content retains document identity/revision (object-key order is ignored; array
order is preserved). Both outcomes checkpoint the draft; history remains, so undo
after Apply affects only the draft. Geometry changes have their own revision and
do not invalidate scientific results. A future browser adapter must invoke this
contract against the shared authoritative state, never an obsolete copied wrapper.

Deferred: DOM integration, rendering/collision certification, localization of UI,
sidecar persistence, mirroring, multi-terminal device support and graphical cleanup
of obsolete free anchors. Native formats and production browser behavior are unchanged.

## Phase 6A2 integration additions

The browser uses `WiringSession` against a live `LabState` getter, rather than
passing a copied authority to `applyWiring`. `checkpointWiring` records the actual
applied identity, revision and snapshot after the shared validated transition.
The existing headless Apply API remains available.

`batch` groups non-nested operations into one atomic history entry (used for
properties); `edit-label` edits optional device labels. Scientific classification
now compares `wiringMeaning` before and after, correcting Phase 6A1's conservative
classification of wire subdivision. Representation-only edits remain dirty and
undoable, even when the native meaning is unchanged. Public kernel/native schemas
and numerical behavior are unchanged.

## Phase 6A3a portable project core

The headless APIs in `web/project-format.ts` validate, reconstruct, export and
compare version-1 circuit-and-drawing envelopes. See [PROJECT_FORMAT.md](PROJECT_FORMAT.md)
for exact fields, limits, diagnostics, topology bijection and future Open ownership.
Native v1/v2/v3 formats and browser controls are unchanged. Export does not Apply;
use the draft-aware export with all pending-text and gesture state. Invalid drawing
results retain a successfully validated native document for a future explicit
native-only recovery choice, never automatic repair.

## Phase 6A3c1 headless initial layouts (not browser-integrated)

`web/topology-layout.ts` exports `generateTopologyLayout(unknown, {port?: [p,q]})`.
It accepts strict **native documents only**, never a portable project or editor
session. It does not mutate input or own Apply, history, drafts or revisions.
A valid unsupported document is retained; an invalid native input returns `invalid`.

- `generated`: native copy, structural `witness`, editable `graph`, validated
  `project`, and independent `evidence`.
- `unrecognized`: reason and intact validated document (including absent/invalid
  ports, unsupported topology or recognition limits).
- `unsupported`: intact valid scientific document outside v1 R/C/L/V/I.
- `quality-rejected`: intact document and reason, with verification evidence when
  available. No partial graph is offered as a successful drawing.

Source-free inputs require explicit, distinct, existing ordered port nodes. With
one voltage source the default port is its native p,n; an explicit reversed pair
is allowed. Neither port is implicitly ground. Multiple sources/current-source
patterns, self-loops, disconnected branches and unconsumed devices are outside
these templates. Unused native nodes are preserved separately. Recognition limits
are 16 devices and 32 nodes; geometric aspect/label limits can reject smaller
recognized networks. These limits never change native validity.

Recognition uses native array indices as stable handles in a witness. Precedence:
five-R bridge; driven unique series/shunt path or source-free RC ladder;
source-free series-of-R/C bundles with at least one parallel RC pair (Foster I);
parallel internally disjoint paths (Foster II when each path is a single R/C or
series RC pair and at least one pair exists). This labels **structure**, not the
synthesis provenance or a mathematical certificate. A simple network can admit
more than one description; precedence resolves that overlap deterministically.
The path recognizer permits at most one shunt and one forward edge per stage.
Consequently some terminal parallel-RC Cauer endings and more complex ladders
receive another supported structural label or an explicit fallback.

Lower-level exports are `recognizeLayout`, `constructLayout` and `verifyLayout`.
The constructor is for a matching trusted witness, not an unchecked import API.
The verifier reconstructs native science, exports through the strict project API,
and separately examines the entire bounded orthogonal geometry. Evidence reports
native/project validity, whether geometry inspection completed, segment/pair counts,
and issue codes. Zero issues from the older optional warning scan is never used
as certification. Exact arbitrary-font typography is not certified.

See [PHASE_6A3C1_SPECIFICATION.md](PHASE_6A3C1_SPECIFICATION.md) and the
[visual evidence](evidence/phase-6a3c1/README.md). A later browser integration must
keep saved drawings untouched and separately design explicit preview/undo ownership.

## Phase 6A3c2 browser layout integration

The headless `WiringSession` native importer remains the safe provisional adapter.
The browser's `LayoutController.initialize()` may replace only the initial clean
representation with `generateTopologyLayout`; it checkpoints that representation
without mutating the applied document or declaring a saved project. Existing
history/redo entries, independent project ownership and unfinished work exclude
automatic initialization. A clean external sync creates a new eligible draft.

`rememberLayoutPort(state,p,q)` records explicit valid pairs for that document,
revision and serialization only. Source-free proposals otherwise require ordered
native-node selectors. Reference-node identity is untouched.

`LayoutController.suggest()/adopt()/cancel()` manage synchronous bounded proposals.
Authorization includes applied identity/revision/serialization, draft identity and
revisions, exact graph and native meaning, pending text/tools/gestures, ports, view
and monotone interaction generation. Before adoption, strict native equality and
complete geometric verification run again. There is no force-adoption path.

`replaceWiringGeometry(draft,graph)` validates exact ordered native equality and
project export validity, then records one `replace-layout` history entry using the
existing bounded changed-field storage (including allocator, anchors and graph
collections). The controller supplies the additional geometry certificate check.
Undo/Redo use stored fields, not recognition. An explicit adoption keeps its own
history entry even for identical graph fields, because it also owns viewport Fit. The UI stores before/after viewport
state keyed by that history entry, including absence of a portable viewport.
Generated graphs remain ordinary editable WiringGraphs. No project/native format,
public transaction union, numerical law, tolerance or renderer changed.
