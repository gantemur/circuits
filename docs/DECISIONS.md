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

## Current status — 10 October 2026

- Phase 0 architecture review: complete; no contradiction in the public specification required a scope change.
- Phase 0 implementation: complete, including R/C/L, V/I and all four controlled sources, labeled/provenance-bearing MNA, DC and complex-frequency solves, numerical transfer, restricted scalar dynamic elimination, backward Euler transients, native JSON, and resistor Kron reduction.
- Phase 0 acceptance tests: **31 tests passing**, covering MVP sections A–H plus validation, numerical diagnostics, waveform units, explicit unsupported cases, and Kron overflow regressions.
- Reproducible headless demo and browser bundle: implemented and verified.
- Browser UI and deployment: not implemented.
- Next bounded milestone: Phase 1 browser linear lab; requires its own acceptance contract before implementation. Phase 0 remains the repository's bounded scope until then.

Implementation is on task branch `codex/phase-0-kernel`, based on documentation commit `460771c`. Validation below applies to the Phase 0 checkpoint containing this entry, committed with the subject `feat: implement Phase 0 linear circuit kernel`. The checkpoint preserves `main` and does not merge or deploy the implementation. No private book was available or needed; public conventions and fixture equations supplied the acceptance contract.

## Phase 0 decisions — 10 October 2026

| ID | Context and choice | Consequence and validation |
| --- | --- | --- |
| D12 | ESM TypeScript, ES2022 target, Node >=22 development baseline; pinned TypeScript 5.9.3 and esbuild 0.25.12; built-in Node test runner | No runtime dependencies. Verified here on Node 26.4.0/npm 11.17.0; other supported Node versions are not claimed as tested. Lockfile supplied. Browser platform bundle builds and imports without DOM/Node globals. |
| D13 | Version-1 native `{circuit,experiment}` document with explicit discriminated unions and strict runtime validation | Unknown fields/models/versions fail instead of being dropped. Source values and complete storage initialization are separate from topology. Native round-trip and invalid input tests pass. |
| D14 | Dense rectangular complex scalars and an inspectable Gaussian elimination implementation with row/column equilibration and complete pivoting | No matrix inverse or regularization. Real solves reuse the complex algorithm with zero imaginary parts. Independent real/complex systems, extreme scales, rank-deficient systems, and circuit fixtures validate it. |
| D15 | Physical row residuals in V/A, reconstructed ground KCL, plus an infinity-norm backward residual on the equilibrated system | Default relative 1e-8, voltage 1e-9 V, current 1e-12 A; pivot threshold 1e-12. Pivot ratio is not a condition estimate. Tiny nonzero pivots or ambiguous constraint residuals are reported as ill-conditioned. |
| D16 | Modules: model/validation, complex arithmetic, numeric systems, assembly, analyses, transient, and independent Kron helper | Kernel compiles without DOM libraries and contains no Node imports. Demo and filesystem-based fixtures remain outside production source. No plugin/model registry or future placeholder modules. |
| D17 | Restricted transfer extraction checks one storage element, one nonzero diagonal E entry, invertible algebraic K block, and fixed output | Schur coefficients come from assembled matrices and solves; grounded RC, loaded RC, feedthrough current, and RL tests pass. Derivative outputs, floating capacitor stamps, singular algebraic blocks, and multiple storage elements explicitly return not-supported. |
| D18 | Initialize via storage factorization E=F*S and augmented solve `[K F; S 0]`; allow a unique constant-source DC equilibrium at rest as a special case | RC/RL/RLC initial storage and compatible source currents are verified. Event restarts enforce continuity; ideal capacitor source forcing fails at the event. General high-index/impulsive initialization remains unsupported. |
| D19 | Backward Euler uses integer-indexed uniform time grids restarted at each scheduled source event, with shortened boundary intervals and separate left/right samples | Initial repeated-addition grid testing exposed an extra roundoff-sized final step; the implementation was corrected without changing tolerances. Independent recurrence, storage orientation, exact breakpoint, and first-order refinement tests pass. |

Implementation and format details are in [KERNEL_API.md](KERNEL_API.md); independent formulas are in [the fixture manifest](../fixtures/README.md). Transfer coefficients are floating-point algebraic derivations, frequency values are numerical samples, and time-step error is measured separately from algebraic residuals. No result is claimed as an exact symbolic identity or physical device-model certification.

## Executed validation

- `npm ci --offline --cache /private/tmp/circuits-npm-cache`: clean lockfile installation passed using the populated dependency cache.
- `npm run typecheck`: passed.
- `npm test`: passed all 26 tests, including the build invoked by that script.
- `npm run build`: passed TypeScript declarations/ESM generation and browser-platform bundling.
- `npm run demo`: passed; reports equations, matrices, signed measurements, physical residuals, reduction, refinement, and deliberate failure cases.
- `git diff --check`: passed.

The browser bundle was also executed in an isolated JavaScript realm with neither Node nor DOM APIs; the divider result agreed with the native ESM entry.

RC step maximum continuous-solution errors on common times through 5tau were approximately **0.00901004, 0.00455118, 0.00228735 V** for h=tau/20, tau/40, tau/80. Ratios are about 1.980 and 1.990. Maximum discrete recurrence error was below 7.4e-15 V, and maximum reconstructed ground-current residual below 2.4e-17 A in that demo. These measurements establish the tested first-order behavior; they do not promise this accuracy for arbitrary circuit scales.

Remaining limits include dense small-system numerics, noncertified conditioning/rank diagnostics, the declared restricted transfer subset, and unsupported impulsive/high-index initialization. Phase 1 should expose the validated kernel and diagnostics through a bounded browser workspace before adding new device physics or synthesis.

## Kron validation hardening — 10 October 2026

Follow-up to checkpoint `65bda78`: require nonempty string edge IDs and check numeric range at conductance calculation, full Laplacian assembly, and Schur-complement output. Preserve the existing function signatures: invalid inputs and unrepresentable assembly throw `RangeError`; nonfinite reduction results return the existing `ill-conditioned` failure shape. Successful reductions contain only finite matrices. No tolerances were loosened and no clipping or regularization was introduced.

Five regression tests cover invalid ID types, reciprocal overflow, retained-block accumulation overflow with an invertible internal block, Schur overflow from a finite full matrix while eliminating two internal nodes, and finite large-conductance success cases. The first four tests failed against the checkpoint and pass with the fix. `npm run typecheck`, `npm test` (all 31 tests, including `npm run build`), and `git diff --check` passed. The original checkpoint's validation record above remains historical; these checks cover the follow-up fix.

## Maintenance format

For each later substantive decision, record date, context, choice, consequence, and validation. For a completed milestone, record the tested source revision when available and the actual test/build commands. Keep short entries; preserve mathematical rationale in the relevant specification or implementation note.
