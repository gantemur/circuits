# Decisions and implementation status

Initial entry: 10 October 2026.

## Settled project choices

| ID | Decision | Consequence |
| --- | --- | --- |
| D01 | Existing repository slug is `circuits` | Do not rename it during implementation |
| D02 | Working application name is Circuits Unfolded | Keep the name provisional; no domain or trademark claim |
| D03 | A transparent lab for supported small circuits | Practical completeness is bounded by declared models and analyses |
| D04 | Eventual static browser hosting on GitHub Pages | No runtime backend, account, or AI API dependency |
| D05 | Browser-compatible TypeScript kernel | Headless tests and analyses precede graphical editing |
| D06 | Canonical residual form `E * xdot + K * x = B * u` | Translate book state form using `A = -K` |
| D07 | Explicit experiments and model levels | Input, output, source, load, initialization, and fidelity are visible |
| D08 | Book and research references remain outside public source | Use private reference files and public self-contained fixtures |
| D09 | Public lab planning includes classical device/theorem/synthesis goals | Separate research programs do not expand implementation scope |
| D10 | Original starter documentation and code use MIT | Companion book and third-party materials retain separate rights |
| D11 | Phase 0 is the active milestone | Follow `MVP_SPECIFICATION.md` before adding later capabilities |

Repository visibility is an owner-controlled setting. The documents are prepared for public release; they do not imply that visibility has been changed. If the repository already has a different license, reconcile it before committing this bundle rather than overwriting it automatically.

## Current status

- Initial public documentation prepared.
- Phase 0 architecture review: pending.
- Phase 0 implementation: pending.
- Phase 0 acceptance tests: pending.
- Browser UI: pending.
- Deployment: pending.

This document must report implemented status, not intentions as accomplishments.

## Decisions to make during Phase 0

The implementing agent can settle these ordinary choices within the specification and record a short rationale:

- currently supported Node/TypeScript versions and test tool;
- precise JSON fields and validation approach;
- real/complex numerical types and solver dependency, if any;
- scaling and singularity-diagnostic implementation;
- module layout and headless demonstration command;
- restricted single-storage reduction eligibility checks;
- consistent initialization procedure for supported fixtures.

Use a small maintained numerical dependency when needed; avoid an elaborate architecture for later unimplemented capabilities. A general symbolic engine, native BSIM, backend, unrestricted netlist parser, and arbitrary high-index DAE support are not Phase 0 decisions.

## Maintenance format

For each later substantive decision, record date, context, choice, consequence, and validation. For a completed milestone, record the tested source revision when available and the actual test/build commands. Keep short entries; preserve mathematical rationale in the relevant specification or implementation note.
