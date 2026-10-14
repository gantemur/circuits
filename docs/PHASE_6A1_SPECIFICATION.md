# Phase 6A1 — headless graphical connectivity

Status: published with accepted implementation
`2d1a725cee4d4ffa1f292cef45e7ecfd1e4f69c6`. See DECISIONS.md for release
validation, public browser evidence and limitations. No further milestone is authorized.

## Authoritative state

The editor owns an explicit ideal-wire graph. Connected components traverse only
wire edges, never device interiors or geometric crossings. Stable handles identify
devices, vertices, edges and observations independently of exact native IDs.
R/C/L/V/I devices have ordered `p,n` terminal roles. Terminal assignment is explicit:
`pending`, `open` (accepted isolated terminal), or `connected`. Removing the last
incident edge makes a previously connected terminal pending. Import connects every
terminal to its native node's hub, including singleton and unused native nodes.

Names and voltage observations attach to physical graph vertices. A merge of
non-ground names requires an explicit surviving name. The reference component
always keeps `0`. After splits the original anchor retains its name; other
components receive deterministic fresh names. Set reference swaps the two net
names, changes no wire, and preserves ordered device terminals and observations.

## Transactions and geometry

Atomic operations add/copy/delete devices, edit parameters, add vertices, connect,
split wires, atomically attach a vertex to a segment, join crossing segments,
separate selected junction edges, disconnect,
mark open, rename, set reference, move/rotate symbols and edit bends. Failed
operations leave all state unchanged. Merge evidence includes partitions, names
and resolved voltage-observation references before and after. Dependencies block
device deletion unless dependent current observations are explicitly removed.

Coordinates are finite and bounded to ±1e6 drawing units; routes have at most 64
bends. Rotations are integer quarter turns. Endpoints derive from current vertex
positions; device terminal positions derive from placement and role. Crossing join
requires two explicitly selected, properly intersecting straight route segments.
No proximity inference, hit testing, autorouting or rendering is included.

History is bounded, records changed model collections only, and has one step per
committed transaction. Undo/redo restores handles and content, while revision
counters advance monotonically. Geometry revisions are separate from scientific
revisions. Apply establishes ownership by document identity, revision and serialized
snapshot. Dirty conflicting drafts survive; clean drafts can synchronize. Identical
scientific candidates do not replace the applied document. Undo never modifies an
already applied document.

## Native boundary

Strict v1 R/C/L/V/I documents round-trip with array ordering, labels, exact names,
source fields and storage policy preserved. Valid unsupported v1/v2/v3 documents
produce explicit read-only outcomes retaining their original document. Geometry
is provisional session state and never enters native JSON. Every graph component
(including unused hubs/free construction vertices) becomes a native node; no node
or branch is silently dropped. Pending terminals prevent candidate construction.

Candidate construction checks graph structure, assignment, names/reference,
dependencies and finite numeric text, then invokes the existing strict validator.
Scientific validity does not imply MNA solvability. Floating networks, shorted
components and inconsistent ideal-source constraints remain analysis concerns.
Layout diagnostics are separate from native validation diagnostics.

## Acceptance

Keep the 327 released tests unchanged. Cover all transactions, true/false splits,
explicit versus geometric junctions, dependencies, exact IDs, lossless import,
unsupported documents, synthesis outputs, history and ownership. Construct divider,
RC and bridge examples through transactions and compare existing-kernel results
with independent equations. Divider: 8 V, 4 mA, source −4 mA; changing its datum to
out gives in=4 V and former ground=−8 V. RC: H(i1000)=(1−i)/2 and BE recurrence
v[k+1]=(v[k]+0.1)/1.1. Balanced bridge midpoints are 5 V; with the right lower arm
2 kΩ they are 70/13 and 80/13 V, bridge current −1/1300 A.

Validate clean install, focused/full tests, typecheck, kernel/app/site builds,
six demos, DOM-free import and diff hygiene. Build the site in an isolated copy to
preserve ignored local files, and compare its three files with released main.
No browser integration, schemas, numerical methods, merge or deployment changes.


## Recorded validation

The branch adds 37 headless tests to the unchanged 327-test release baseline:
364 tests pass. Supported fixture round-trips, optional fields and unusual IDs,
controlled/v2/v3 read-only preservation, and Cauer/Foster I/Foster II generated
circuits are covered. Independent divider, reference, RC and bridge equations
pass through the existing kernel. Native-valid floating/conflicting-source cases
remain numerical failures; a resistor shorted to ground remains native-valid and
solvable. No scientific safeguard or existing acceptance expectation changed.

Clean installation, focused/full tests, typecheck, kernel/app/site builds, six
numerical demos, a DOM-free wiring/kernel VM smoke and diff hygiene passed. The
isolated candidate package matches a fresh build of released main
`3c52eff2c7cc7f8c827d7eb13a13975d0f82542c` byte for byte. See the dated decision
record for hashes and limits. These are headless checks, not graphical-editor
browser interaction evidence. Phase 6A2 remains separately reviewable future work.
