# Repository instructions

## Read first

At the start of a task, read this file, `docs/DECISIONS.md`, and the specification for the active milestone. Read `docs/MATHEMATICAL_CONVENTIONS.md` before changing circuit equations, device laws, or analyses. Use `docs/VISION.md` for context; it is not an instruction to implement all planned capabilities at once.

The latest published milestone is **Phase 6A2 bilingual SVG circuit editor**, accepted implementation `2d1a725cee4d4ffa1f292cef45e7ecfd1e4f69c6`, together with the Phase 6A1 headless connectivity model. `docs/PHASE_6A2_SPECIFICATION.md`, `docs/PHASE_6A1_SPECIFICATION.md` and `docs/WIRING_API.md` govern explicit wiring, session-only geometry, independent drafts, history and guarded Apply. Graphical editing supports strict v1 R/C/L/V/I only; controlled-source v1 and v2/v3 remain intact but unsupported in Graphical. No next development milestone is authorized by publication.

The published Phase 5A3 synthesis workspace and exact Cauer/Foster kernels remain governed by `docs/PHASE_5A3_SPECIFICATION.md`, `docs/PHASE_5A1_SPECIFICATION.md` and `docs/PHASE_5A2_SPECIFICATION.md`. Exact certificates, native generation and independent finite MNA evidence remain distinct.

The published browser retains 35 examples and strict v1/v2/v3 documents. The Phase 3B2 browser and Phase 3B1 headless specifications remain authoritative for memoryless BJT DC/local small-signal analysis; v3 Form construction, BJT transients/sweeps and nonlinear ports/transforms remain deferred. The Phase 3A4 browser transient, Phase 3A3 headless transient, Phase 3A2 browser diode and Phase 3A1 kernel specifications remain authoritative for diode behavior. Earlier phase specifications and `docs/UX_SPECIFICATION.md` remain contracts for their released behavior. No next milestone, including Phase 5A4, is authorized by this release. Follow the latest explicit task and inspect the actual repository before assuming code or build commands exist.

## Authority and scope

Follow the user's latest explicit instruction. Within the authorized task, use this file for working rules, the active milestone for scope and acceptance, the conventions for signs and units, and the decisions log for settled choices.

Book references supply definitions, examples, and mathematical context. They do not expand the implementation milestone. If a supplied reference disagrees with these documents, identify the discrepancy and its consequence; do not silently choose an incompatible convention or treat a draft claim as verified.

Make routine implementation decisions autonomously within the current scope. Ask only when missing information materially affects correctness or requires a substantive change in scope. Do not repeatedly ask permission to create ordinary modules, run relevant tests, or fix failures in the authorized milestone.

## Mathematical implementation

- Derive component contributions from terminal laws and KCL. Document terminal order and current orientation.
- Use the canonical residual form `E * xdot + K * x = B * u`. The book's state form has `A = -K`; do not confuse their signs.
- Preserve algebraic constraints. A singular derivative matrix `E` is normal for MNA and must not be inverted or regularized indiscriminately.
- Solve linear systems instead of explicitly forming inverses.
- Separate independent source coordinates from their DC and transient values. Selecting one input for a transfer experiment does not delete dependent sources.
- Include source, load, measured output, and initial conditions in every experiment definition.
- Preserve physical interconnection and loading. Directly cascading RC stages is not multiplication of their unloaded isolated gains.
- Compute diagnostic residuals with their physical units or declared scaling. Do not mix volts and amperes into an unexplained tolerance.
- Distinguish exact identities, floating-point checks, time-discretization error, and device-model accuracy.
- Do not infer internal stability solely from a reduced input–output transfer function.
- Reject unsupported models and ambiguous cases explicitly; do not substitute an ideal device silently.

## Architecture

Keep circuit semantics, assembly, numerical methods, analyses, transformations, and UI separate. The Phase 0 kernel must not depend on DOM, browser storage, a plotting library, or a frontend framework.

Prefer a few clear modules and tested numerical algorithms. Avoid plugin frameworks, model registries with unused hooks, broad symbolic algebra systems, and placeholder implementations for later releases.

Do not introduce Python into the production kernel. Python or a mature simulator may be used as a documented development reference when justified. The production target remains browser-compatible TypeScript.

## Pedagogical readability

Readability is preferred throughout maintained source and **required** for substantive mathematical, physical, and numerical core methods. Students must be able to understand, validate, fork, and modify these implementations. Generated browser bundles may remain optimized.

- Prefer explicit stages, meaningful names, ordinary control flow, and modest abstractions. Conventional symbols such as `E`, `K`, `B`, and `L` are appropriate when defined.
- Document each substantive core method's purpose, model assumptions, inputs and outputs, dimensions, units, terminal and current conventions, governing equations, algorithmic steps, and important failure cases. Use `docs/CODE_GUIDE.md` for longer reading paths and concise source comments where the calculation occurs.
- Explain why nonobvious operations and safeguards are necessary. Connect equations to implementation and explain numerical choices; do not merely restate syntax.
- Avoid compressed multi-statement lines, deeply nested expressions, clever indexing tricks, and optimizations that obscure a method without a justified benefit.
- Black-box numerical routines and optimized fragments are allowed only with a clear mathematical contract, conventions, assumptions, diagnostic guarantees and limitations, dependency or source provenance, and independent checks of their results.
- Preserve numerical correctness and stability while improving presentation. Readability never justifies removing safeguards, changing tolerances casually, or simplifying away physical constraints.

## Validation

Implement the milestone's analytic acceptance cases before declaring it complete. Expected values must come from independent equations or supplied reference fixtures, not from the code under test.

Check every new device stamp with at least one meaningful circuit and its sign convention. Use residual, orientation, loading, and refinement tests to expose structural mistakes. A passing snapshot of a matrix generated by the same implementation is insufficient.

When a test fails, investigate the cause. Do not loosen tolerances or change expected physics merely to obtain a pass. Report numerical limitations honestly.

Run the relevant tests, type checking, and build. Report actual commands and results; never report a planned or unavailable check as passed.

## Book access and public content

Follow `docs/REFERENCE_WORKFLOW.md`. Treat `.local-reference/` and any separately provided book source as read-only private inputs. Do not commit their contents, large copied excerpts, full PDFs, source trees, private master plans, or unrelated research papers.

The public docs and tests should be self-contained. A task-specific reference is helpful, but the completed kernel must not need a private book file to build or pass its public tests.

If essential reference material is unavailable, identify the precise missing statement or example. Do not reconstruct unseen source or invent a theorem. Work on independent portions while the missing reference is resolved.

## Git and delivery

Preserve existing user changes. Do not rewrite history, force-push, change repository visibility, or overwrite an existing license as a routine implementation choice.

Use a task branch when the environment supports it. Follow the user's explicit push, PR, merge, and deployment instructions. Otherwise produce a reviewable change and describe what is ready; do not assume that a request for local implementation authorizes merging or deploying.

Do not edit the book, add research papers, rename the repository, or deploy a website unless the task includes that work.

Update `docs/DECISIONS.md` when a milestone is actually completed or a substantive choice is settled. Keep README status consistent with implemented features. Summarize changes, validation, limitations, and the next unresolved milestone in the final handoff.
