# Phase 6A2 — bilingual SVG circuit editor

Status: implemented, awaiting independent review on `codex/phase-6a2-svg-circuit-editor`, based
on accepted Phase 6A1 `0a9ac3e`. No merge or publication is authorized.

## Scope and ownership

Graphical is a third mode within Edit circuit. Its draft, history, geometry,
selection, unfinished wire and pending properties are independent of Form/JSON.
Only explicit Apply changes the shared validated LabState. Apply uses the existing
native import semantics exactly once, reconciles panel references, then checkpoints
the actual applied identity/revision/snapshot without losing geometry/history.
Equal native scientific content retains applied identity/revision. External changes
synchronize only clean graphical drafts; dirty work remains conflicted. Transform
and Synthesize guards include graphical work, including incomplete gestures/text.

Supported editing is strict native v1 R/C/L/V/I. Controlled-source v1 and all v2/v3
show intact unsupported outcomes. No scientific schema, device law, solver or
native metadata changes. A blank draft is explicitly created without applying it.
Practical graphical bounds: 40 devices, 240 vertices, 320 wires, 64 bends per wire.
Oversized native imports remain intact and unavailable for graphical editing.

## Interaction and drawing

SVG depicts explicit wire edges, p/n terminals, rectangular R, C plates, L coils,
V/I circles, name anchors, ground, selection and textual completion states.
Provisional imported layout is labeled as such. Conservative geometric warnings
and a complete topology list remain available for overlaps/crossings; no autorouter
or recovered historical routing is claimed.

Click/tap two endpoints to wire; keyboard lists provide equivalent actions.
Unfinished wires store start/bends outside the graph and Cancel/Escape adds nothing.
Selecting a segment and invoking Attach can explicitly attach a wire; explicit crossing join
is separate from geometric intersection. Move uses coordinates or select-then-click,
never drag-dependent wiring. Pointer cancellation cancels provisional gestures.
Quarter turns preserve roles. Route segments, junction separation, copy/delete,
open/disconnect, naming/reference, source/storage/probes and undo/redo use model
transactions. Property commits are atomic and invalid text stays correctable.

An explicit surviving-name selector resolves non-ground merges; ground stays 0.
Source deletion requires explicit inclusion of dependent current observations.
Validation distinguishes pending/invalid/valid-but-not-solver-certified/conflicted
and unsupported states. No leakage or implicit grounding is inserted.

## Scientific meaning and history

Compare native candidates for electrical neutrality of split/redundant/cycle edits.
For incomplete candidates use a graph meaning signature over terminal partitions,
anchored probes, component/source/storage content, names and completion, excluding
routing and graphical subdivision. Scientific revision changes only when meaning
changes; representation changes still advance geometry/history and count as work.
Retain the 364 accepted test expectations. Add targeted neutrality and production
application ownership tests rather than rewriting older history.

## Accessibility and verification

All controls have bilingual accessible labels, keyboard focus and ordinary form
controls. A bounded viewBox supports fit, pan and zoom; pointer coordinates use SVG
screen-CTM inversion. SVG scrolls locally at 320/390 px. Exact IDs are always escaped.

Acceptance constructs divider, RC low-pass and balanced/unbalanced bridge from
blank through production UI actions, with independent values in the task contract.
Test graph gestures, pending/correction, names/reference, compound history, three
draft conflicts, unsupported documents and synthesis-native editing. Actual Chrome
checks include EN/MN desktop/390/320, pointer and keyboard, workers/cancellation and
available native download/import interactions. Report limitations separately.

Run clean install, focused/full tests, typecheck, kernel/app/site builds, six demos,
DOM-free smoke and diff checks. The isolated publishing directory must contain only
index.html/app.js/style.css with relative matching version hashes. Preserve ignored
local files. Update UX/localization/guide/decision records with actual evidence.

## Implemented acceptance and limits

See the current Phase 6A2 entry in [DECISIONS.md](DECISIONS.md) for commands,
independent construction results and actual Chrome evidence. New regressions run
production event handlers with a minimal DOM adapter; they are not claimed as a
browser automation suite. The existing 364 expectations remain unchanged.

Pending net names and route text are associated with stable graph handles, not
row numbers. Restore uncommitted text explicitly resets only Graphical text to
its committed draft; it neither reloads the circuit nor touches Form/JSON. This
also recovers text for a handle removed by Undo. Undo/Redo affects committed graph
transactions, while incomplete text and wire gestures have separate ownership.
Unfinished wires survive ordinary navigation; Escape/Cancel discards the gesture.

Drawing checks conservatively warn about segment boxes, overlaps beyond shared
endpoint dots, obscured vertices, wire-through-body and symbol overlaps. Warnings
are presentation diagnostics, never a claim of electrical connection. Names on
terminal anchors and exact topology supplement the provisional diagram. No
collision-free automatic layout or persistent geometry is promised.
