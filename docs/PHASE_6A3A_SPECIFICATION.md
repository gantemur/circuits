# Phase 6A3a — portable circuit-and-drawing project core

Status: implementation task on `codex/phase-6a3a-portable-project-core`, based on
released `64e04525a98839f61a5587b24b1ba6c0fc61f45e`. No browser UI, merge or deployment.

## Contract fixed before implementation

A project has exactly `format: "circuits-unfolded-project"`, `projectVersion: 1`,
`document` (unchanged strict native document) and `drawing`. Drawing version 1 has
`drawingVersion`, `placements`, `vertices`, `edges`, `bindings`, `reference`,
`observations` and optional `viewport`. Supported drawings are v1 R/C/L/V/I only.
Native v2/v3 and controlled-source v1 return unsupported with their validated data.

Placements bind exact component IDs to x/y and turns 0..3. Terminal vertices bind
file-local IDs to component/role; free/junction vertices carry x/y. Edges carry
file-local IDs, two vertex IDs and ordered bends. Bindings map each exact native
node to one anchor. Voltage observation records map exact observation IDs to
ordered vertex anchors. No scientific value, editor counter/history, pending text,
DOM state, certificate or ownership token is duplicated in drawing data.

Validation is pure: strict envelope/version/native checks; bounded strict drawing
records; unique IDs/references; one terminal per component role; wire-only connected
components in bijection with all native nodes, including unused nodes; exact ordered
terminal memberships, ground and voltage-observation anchors; reconstruction using
native scientific data; nativeCandidate plus order-sensitive scientific comparison;
separate geometry checks. No coordinate proximity implies connection. Fatal invalid
drawing with valid native data is distinguishable from an invalid native envelope.

Limits: 2 MiB UTF-8 JSON, depth 32, 100000 JSON values, 40 components, 240 vertices,
320 edges, 240 native nodes/observations, 64 bends per edge, coordinates ±1e6;
viewport positive width/height at most 2e6 and bounded corners. Exact IDs are never
trimmed or delimiter-encoded. Internal handles are deterministically remapped and
allocation starts after all allocated handles. Unknown fields/versions are errors.

Exports validate completed graph candidates without Apply. A session-aware export
also rejects pending text/gestures. File-local IDs are canonically assigned for
stable export/import cycles. Project-content comparison ignores object key order
but retains native/drawing array order and geometry; it is not a graph-isomorphism
or scientific-equivalence test. Saved-content ownership is separate from Apply.

Future Open prepares a complete candidate before replacing any draft; consent and
rechecks of applied identity/revision/content AND graphical edits (including pending
text) are required after file reading and confirmation. Form/JSON survive. History
starts fresh; explicit Apply uses the existing shared scientific path once. No
browser workflow is implemented here.

## Acceptance

Preserve 393 tests. Add independently authored drawings/documents, structural
corruptions, strict fields/versions, exact IDs, limits, pure failure behavior,
free/open/unused nodes, distinct crossing/join cases, source/storage fidelity,
repeated round trips, generated Cauer/Foster circuits, and independent divider/RC/
bridge science. Run clean install, focused/full tests, typecheck, all builds, six
demos, DOM-free smoke and diff checks. Candidate production HTML/JS/CSS must match
a clean released-baseline package byte for byte. See PROJECT_FORMAT.md for final
API details and DECISIONS.md for actual results.
