# Portable circuit-and-drawing projects — version 1

Phase 6A3a is headless infrastructure. There are no browser Save/Open controls,
local autosave, layout recognition or new scientific schemas in this milestone.
Native JSON export and strict native v1/v2/v3 parsers remain unchanged.

## Envelope and authority

The JSON object has exactly these required fields:

```
{
  "format": "circuits-unfolded-project",
  "projectVersion": 1,
  "document": { "circuit": { ... }, "experiment": { ... } },
  "drawing": { ... }
}
```

`document` is a complete, strictly validated native scientific document. It alone
owns device types/values/labels, exact IDs, nodes, sources, AC/waveforms, observations,
initialization and metadata. Drawings currently support native v1 R/C/L/V/I only.
A valid controlled-source v1 or v2/v3 document returns `unsupported` with a validated
scientific copy; no model conversion or loss of scientific data occurs.

Drawing version 1 has these required arrays/fields (optional viewport is last):

| Field | Exact record shape |
| --- | --- |
| drawingVersion | literal `1` |
| placements | `{component: string, x: number, y: number, turns: number}[]` |
| vertices | `{id, kind: "terminal", component, role: "p"\|"n"}` OR `{id, kind: "junction"\|"free", x, y}` |
| edges | `{id: string, a: string, b: string, bends: {x: number, y: number}[]}[]` |
| bindings | `{node: string, vertex: string}[]` |
| reference | vertex ID |
| observations | `{observation: string, p: string, n: string}[]` for voltage observations only |
| viewport | optional `{x: number, y: number, width: number, height: number}` |

Every record rejects additional fields. Placements cover native components exactly
once; terminal vertices cover both ordered roles exactly once. Vertex IDs are
unique in the vertex namespace, edge IDs in the edge namespace. References `a`,
`b`, `vertex`, `reference`, `p`, `n` always address vertices. Component, node and
observation strings address exact native IDs. No trimming, Unicode normalization,
delimiter splitting, prototype-key lookup or inference from coordinates occurs.

Empty IDs are invalid; whitespace-only strings retain the native validator's
existing behavior. Markup-looking text is plain data. Arrays/Maps and explicit
field construction prevent native IDs such as `__proto__` from becoming dynamic
object properties. File-local IDs never become internal allocation counters.

Coordinates and derived terminal endpoints must be finite and within ±1e6 drawing
units. `turns` is an integer 0..3, rotating p/n positions without exchanging roles.
Terminal positions derive from device placements; they cannot have separate x/y.
Each edge must have distinct, existing endpoints and an explicit bend array (empty
is valid). Bends are ordered and remain unchanged. Viewport width/height are positive
and at most 2e6; x/y and the opposite corner must remain within ±1e6.

No revision, checkpoint, history, source duplicate, pending string, gesture, DOM
state, worker result, certificate or allocation counter is permitted in a drawing.

## Exact electrical validation

The import pipeline in `project-validation.ts` is deliberately staged:

1. Bound the input and check the envelope/version.
2. Dispatch the embedded document to its existing strict native validator.
3. Return explicit unsupported graphical scope when appropriate.
4. Validate drawing fields, bounds, IDs and references.
5. Reconstruct explicit vertices/wires using fresh internal handles.
6. Find connected components by following ideal-wire edges only.
7. Require a bijection between those components and **all** native nodes.
8. Check every ordered terminal against its exact native node.
9. Check reference belongs to `0`, and each voltage observation's ordered physical
   anchors resolves to its scientific p/n nodes.
10. Reconstruct editable scientific values from the native document, then run
    `nativeCandidate` and compare normalized scientific content.
11. Return separate nonfatal drawing-quality evidence.

Every native node has one binding, every graph component one binding, and each
terminal belongs to the component for its native node. This catches both shorts
and splits. Device interiors are never traversed. Coincident vertices and crossing
segments do not imply adjacency. There is no numerical proximity tolerance in
this test. A second observation can select a different vertex on the same net;
its physical anchor survives round trips.

Current observations retain the native device reference. Ground may be anchored
at any vertex on the `0` component. Unused native nodes still need graph vertices
and bindings. An isolated extra graph component is rejected unless explicitly
represented by a native node. Free endpoints and dangling branches are preserved.
A terminal with no wire reconstructs as intentionally open; incomplete pending
terminals cannot be exported. No connection, cleanup, rerouting or implicit ground
is added to repair a file.

Scientific comparison ignores object-property order, preserves array order and
exact IDs, and uses ordinary JSON numeric semantics (including -0/0 equivalence).
Geometry validation is independent of solvability: a valid native circuit can
still have a singular MNA system. Conservative segment-box and symbol-proximity
warnings are not collision certification, electrical failures or automatic repairs.

## Public headless API

Import from `web/project-format.ts`; types live in `project-types.ts`. The neutral
`dist/project-test.js` bundle is for testing and is not a production site asset.

- `validateProject(value)` / `importProject(value)`: validate unknown JSON-tree
  data and reconstruct the editable graph. Import is the same checked operation;
  there is no public unchecked reconstruction path.
- `parseProject(json)`: parse bounded JSON text and run the same pipeline.
- `exportProject(graph, viewport?)`: build native data through `nativeCandidate`,
  independently validate the drawing, return a completed project and reconstructed
  graph. Input graph geometry must cover its owners exactly once; no orphan or
  duplicate geometry is silently dropped.
- `exportProjectDraft({graph, pendingTextCount, unfinishedWire}, viewport?)`: also
  reject any pending text or wire. Future UI callers must include **all** component,
  route, coordinate, name and observation text in the count. A raw graph cannot
  reveal editor state outside it; use this guarded entry for a live editor.
- `serializeProject(value)`: validate then return `{status:'ok', json}` with compact
  JSON, or the validation failure. Compact encoding stays within the checked byte
  bound; it is not a dump of editor internals.
- `projectContentKey(value)`: validate then return `{status:'ok', key}` for the
  independent saved-content checkpoint. It includes native data, anchors, geometry
  and viewport. File-local ID spelling and object-property order are ignored;
  placements/bindings/observations normalize to native order, while native arrays,
  vertex order and edge order remain significant. It is not graph-isomorphism,
  electrical-equivalence or authentication evidence.

`ProjectResult` is a discriminated union:

- `ok`: validated `project`, reconstructed `graph`, nonfatal `warnings`.
- `unsupported`: intact validated `document` and structured `diagnostics`.
- `invalid`: stage (`envelope`, `native`, `drawing`, `draft`) and diagnostics;
  a successfully validated `document` is retained when later drawing checks fail.

Diagnostics include code, path, message and an offending ID when applicable.
Technical messages are English; future UI summaries should translate codes at
render time. Nothing applies a circuit, changes history, or mutates supplied data.
No result silently falls back to a different drawing. A later explicit native-only
Open can use the retained document from a drawing-stage failure.

Reconstruction uses the native import adapter for scientific fields, replaces its
provisional representation, and deterministically allocates fresh `h` handles.
The next allocation follows all allocated objects, so future transactions cannot
collide with file IDs. Export assigns `v1…` / `e1…` in graph array order. Repeated
export/parse/export cycles are stable without geometric drift.

## Limits and untrusted input

Limits are 2 MiB UTF-8 JSON, nesting depth 32, 100000 values, 40 components,
240 vertices/native nodes/observations, 320 edges and 64 bends per edge. These match
current editor component/vertex/edge/route bounds; node/observation and file/tree
limits additionally bound the portable input. Native collection budgets are checked before scientific cross-reference validation;
source/storage arrays are capped at 40. Oversized input is rejected as a resource
failure even when its scientific schema might otherwise be supported.

The object API accepts plain JSON trees, not class instances, cycles, aliased
objects, accessors, sparse/decorated arrays, hidden fields or non-JSON values. The
text API uses JSON.parse, followed by those checks. Nonfinite parsed numbers are
rejected. Object tree work and text bytes are bounded before native validation and
reconstruction. Unknown versions/fields fail; no migration engine exists in v1.

## Save, Apply and future Open ownership

A completed unapplied graph may be exported. The saved native data describes that
draft, not necessarily the analyzed circuit. Export does not call Apply. The last
saved project key is separate from the Graphical Apply checkpoint and scientific
revision; moving a symbol can change saved content without invalidating analysis.
Incomplete drafts remain correctable in memory but are not portable projects.

Phase 6A3b must prepare and validate before replacement, ask before replacing dirty
Graphical work, preserve Form/JSON, and recheck applied document identity, revision
and serialized content after asynchronous reading and confirmation. Also recheck
Graphical scientific/geometry revisions plus pending-text/gesture changes (those
are not all represented by the current graph revision). An obsolete confirmation
must not overwrite intervening work. New history starts fresh. The opened project
remains unapplied until explicit Apply invokes the existing shared native path once.

No ownership counters are trusted from a file. Stale/deleted/renamed device
references fail structurally; there is no approximate name matching. Valid native
v2/v3 and controlled-source data remain outside graphical scope. Persistent draft
recovery, browser autosave, migration, and file dialogs are deferred.
