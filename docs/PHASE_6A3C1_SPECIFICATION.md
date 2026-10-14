# Phase 6A3c1 — deterministic native-only initial layout

Status: published together with Phase 6A3c2 from accepted `dcde3d2c10ce06e34672cef40a611c18372f9c54`.
The reviewed headless commit `f9b800a` and browser commit `dcde3d2` are preserved.
See [publication evidence](evidence/phase-6a3c-release/README.md). The original
headless-only contract and its historical acceptance results are retained below;
current browser behavior is governed by PHASE_6A3C2_SPECIFICATION.md.

## Contract established before implementation

Three pure layers recognize a typed two-terminal multigraph, construct an editable
wire graph from a structural witness, and independently verify exact science and
complete bounded geometry. Values and exact ID spelling never select templates.
Native array order breaks symmetries. Explicit ordered ports are required for
source-free networks; a single voltage source supplies the port for driven ones.
Ground is still the exact native `0`, not necessarily the negative port.

Recognize driven series/shunt paths, common-port parallel paths, five-resistor
bridges, RC Cauer ladders and series-of-parallel (Foster I) versus
parallel-of-series (Foster II) networks. Overlapping elementary descriptions use
fixed documented precedence, not impedance equivalence. Every witness covers
all devices exactly once. Unknown, ambiguous, unsupported, oversized and rejected
geometry receive explicit fallback results, never a misleading partial drawing.

Only native documents enter this API. Saved project envelopes are rejected; no
geometry, history or scientific revision is replaced. Keep source definitions,
storage, labels, exact IDs, ordered terminals, node/observation order and unused
nodes. Export through the existing strict project API; independently reconstruct
and compare native content. Reopening must preserve coordinates and routes.

Use bounded orthogonal templates, not a general router. Generated wire intersections
must be explicit shared graph vertices. Independently inspect every segment pair,
every symbol/segment and vertex, and ordinary label clearance; incomplete legacy
warning scans are not certification. Geometric bounds and exact topology checks
remain separate. Long text retains exact renderer metadata; typography beyond the
stated ordinary-label envelope remains a disclosed limitation.

## Acceptance

Preserve all 473 existing tests. Add independently authored divider, RC low/high
pass, RL/RLC, parallel, balanced/unbalanced bridge, Cauer and Foster examples;
assert structure, exact science, orientation and rename/value invariance, unused
nodes, pure fallback, geometry corruption rejection and stable project round trips.
Use existing numerical analyses against independent values, not drawing-generated
expectations. Inspect representative SVGs made with the unchanged renderer beside
provisional imports. Record actual visual findings separately from tests.

Run clean install, focused/full tests, typecheck, kernel/app/site builds, six demos,
DOM-free smoke and diff check. Build publishing packages in isolated snapshots to
preserve ignored files. Require exactly three unchanged production files against
released main. Commit/push task branch only; later browser Arrange requires its
own preview/history/ownership design and authorization.

## Implemented scope and acceptance evidence

The native-only boundary is `generateTopologyLayout` in `web/topology-layout.ts`.
Recognition, construction and verification live in separate `layout-*.ts` modules.
See WIRING_API.md for witness shapes, deterministic precedence and fallback reasons.
The implementation does not claim to recognize synthesis provenance from topology.
A series/shunt witness must terminate at its designated return, not merely consume
all edges of a dangling path. Native-only unused nodes remain separate visible dots.

Limits: 1–16 devices, at most 32 native nodes; supported single voltage source or
explicit source-free port; no self-loops, multiple sources or current-source
patterns. Ladders have at most one shunt and one forward edge at each stage.
Parallel paths have disjoint degree-two interiors. Foster I uses R/C singleton
sections and parallel RC pairs; Foster II uses R/C singleton branches and series
RC pairs. A terminal parallel-RC ladder may have a different supported structural
label or fall back. Bridges require exactly five resistors, with optional source.
Unknown/forked/disconnected/oversized topology is not repaired.

Generated candidates are independently checked through nativeCandidate and the
strict project exporter. Geometry permits at most 240 vertices, 320 edges,
16 bends per edge and 512 total segments; exceeding that domain is a failed
quality check, not an incomplete pass. Every segment pair is inspected (at most
130816 pairs); crossings/overlaps require real shared endpoints or consecutive
bends of the same wire. Symbol boxes inflated to ±24 drawing units cover every
existing quarter-turn symbol; nonincident vertices have 6-unit clearance, separate
wires 4 units. Value-label envelopes use a conservative 9-unit glyph advance and
20-unit vertical band. Aspect ratio including margins is at most 6. These checks
are a bounded orthogonal drawing contract, not arbitrary-font pixel certification.

All **40 new focused tests** pass with **473 existing tests unchanged**, **513 total**.
Independent science checks establish divider 8 V / 4 mA / source −4 mA and −48 mW;
RC low/high and RL responses at ω=1000, RLC −10j at ω=10000; bridge midpoint and
cross-current equations; and all three accepted synthesis networks' impedance
1200−1600j Ω at ω=1000. Direct wire traversal, exact field comparisons, changed
values, exact-ID renaming, reversed roles/ports, internal ground, unused nodes,
waveforms/storage and repeated project exports test preservation separately.
Corrupt geometry and a dangling path exercise failures without changing science.

Clean install, focused/full tests, typecheck, kernel/application/site builds, all
six demos, DOM-free layout/kernel smoke and diff check passed. Clean candidate and
released-main publishing packages contain only index.html, app.js and style.css
and are byte-identical. See DECISIONS.md for hashes and smoke environment details.

Six generated/provisional SVG pairs and six Chrome screenshots were visually
inspected; see [evidence](evidence/phase-6a3c1/README.md). Visible lower-lead detours
avoid the unchanged renderer's below-symbol value text. They are less conventional
than side-mounted vertical labels. Raw numeric labels, hollow junction markers,
fit-to-view small bridge text and arbitrary Unicode font metrics remain limits.
No published renderer, browser wiring workflow or file operation changed. Future
integration should first review these templates, then separately specify preview,
explicit adoption, history/ownership and accessibility. Saved geometry must never
be automatically replaced; a general router remains out of scope.
