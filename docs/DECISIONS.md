# Decisions and implementation status

Initial entry: 10 October 2026.

## Settled project choices

| ID | Decision | Consequence |
| --- | --- | --- |
| D01 | Existing repository slug is `circuits` | Do not rename it during implementation |
| D02 | Working application name is Circuits Unfolded | Keep the name provisional; no domain or trademark claim |
| D03 | A transparent lab for supported small circuits | Practical completeness is bounded by declared models and analyses |
| D04 | Static browser hosting on GitHub Pages | No runtime backend, account, or AI API dependency |
| D05 | Browser-compatible TypeScript kernel | Headless tests and analyses precede graphical editing |
| D06 | Canonical residual form `E * xdot + K * x = B * u` | Translate book state form using `A = -K` |
| D07 | Explicit experiments and model levels | Input, output, source, load, initialization, and fidelity are visible |
| D08 | Book and research references remain outside public source | Use private reference files and public self-contained fixtures |
| D09 | Public lab planning includes classical device/theorem/synthesis goals | Separate research programs do not expand implementation scope |
| D10 | Original starter documentation and code use MIT | Companion book and third-party materials retain separate rights |
| D11 | Phase 0 was the first implementation milestone | Preserve its `MVP_SPECIFICATION.md` acceptance contract and passing kernel tests |
| D20 | Phase 1A completed and released | Preserve `PHASE_1_SPECIFICATION.md` and its browser/kernel separation |
| D21 | Phase 1B is the active task-branch milestone | Follow `PHASE_1B_SPECIFICATION.md` for the bounded form builder; do not merge or deploy it in this task |

Repository visibility is an owner-controlled setting. The documents are prepared for public release; they do not imply that visibility has been changed. If the repository already has a different license, reconcile it before committing this bundle rather than overwriting it automatically.

## Current status — 10 October 2026

- Phase 0 architecture review: complete; no contradiction in the public specification required a scope change.
- Phase 0 implementation: complete, including R/C/L, V/I and all four controlled sources, labeled/provenance-bearing MNA, DC and complex-frequency solves, numerical transfer, restricted scalar dynamic elimination, backward Euler transients, native JSON, and resistor Kron reduction.
- Phase 0 acceptance tests: **31 tests passing**, covering MVP sections A–H plus validation, numerical diagnostics, waveform units, explicit unsupported cases, and Kron overflow regressions.
- Reproducible headless demo and browser bundle: implemented and verified.
- Browser UI: the eight-example Phase 1A lab and native JSON editor are integrated into `main` and verified on the public Pages site. The earlier six-example release record remains below.
- Active development milestone: Phase 1B form builder, specified in `PHASE_1B_SPECIFICATION.md`, on `codex/phase-1b-circuit-builder`. The public site remains at Phase 1A until a separately authorized release.

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

## Phase 1A browser laboratory — 10 October 2026

Phase 1A is implemented on `codex/phase-1-browser-lab` from Phase 0 fix `02671bf`. Six validated fixture documents provide editable RC, loaded RC, connected RC cascade, RL, RLC, and loaded VCVS examples. Browser-only code in `web/` calls the unchanged headless kernel for assembly and every numerical result. Preset topology metadata and SVG geometry stay outside the strict native document; imports with unfamiliar topology show an honest node/component table. `scripts/build-app.mjs` emits relative static assets suitable for `/circuits/`. The local Node server is a preview aid, not a runtime dependency of the built app.

The UI separates source DC, configured RMS AC, time waveform, unit-input transfer, measured output, and initial storage values. It shows signed DC branch currents, numerical frequency and transient plots, restricted algebraic transfer when available, matrix labels and kernel-recorded component contributions, physical residuals, and CSV/JSON exports. Invalid edits retain the last validated document and hide the prior result. Sweep work is limited to 241 points and transients to 3000 intervals; solver failures and undefined phase remain explicit statuses and plot gaps.

Validation on Node 26.4.0/npm 11.17.0: `npm run typecheck` passed both kernel and browser TypeScript checks; `npm test` passed all **39** tests and built both bundles; `npm run build` and `npm run build:app` passed. Browser exercise at `http://127.0.0.1:4188/circuits/` confirmed all six examples, RC resistor edit changing AC output from `0.5−0.5j` to `0.2−0.4j`, component provenance, invalid resistor feedback with old results hidden, and no horizontal overflow at a 390 px viewport. The browser console had no errors. Port 4173 was occupied by another local service, so the preview used `PORT=4188 npm run preview`. Final diff and commit checks are recorded in the delivery handoff.

The current limits remain small dense linear circuits, restricted one-storage-element algebraic extraction, noncertified conditioning/rank diagnostics, and first-order fixed-step backward Euler. Phase 1A adds no wiring editor, nonlinear devices, broad symbolic algebra, internal stability theorem, reduction/synthesis UI, or deployment. The next milestone requires its own bounded specification.

Local preview follow-up: a user encountered an occupied default port after a successful build. The preview now tries port 4173 first and, only when `PORT` is unset and that port is occupied, binds an available loopback port and prints its actual URL. An explicit `PORT` remains exact and reports conflicts clearly. This changes only the development server; static assets and kernel behavior are unchanged. Verified with occupied 4173: `npm run dev` served `/circuits/` on the printed fallback port with HTTP 200; `PORT=4173 npm run preview` exited with a clear conflict message. `npm test` passed 39/39, `npm run typecheck` passed, and `git diff --check` passed.

## English/Mongolian interface follow-up — 10 October 2026

English (`en`) and Mongolian Cyrillic (`mn`) are continuing interface requirements for Phase 1A and future user-facing features. A typed catalog in `web/i18n.ts` owns application text and interpolation; explicit selection is stored when browser storage permits, with browser-language fallback. Switching rerenders the interface while retaining the native document, analysis, selected example/component, and invalid drafts. The kernel retains its English technical messages for API compatibility; stable validation codes, extraction reasons, and status identifiers drive localized summaries. JSON and CSV remain language-neutral. `docs/LOCALIZATION.md` records the terminology and export convention.

Focused tests cover dictionary/placeholder parity, preference and storage fallback, edited-document/analysis/CSV invariance, and stable import/extraction identifiers. Browser checks at `/circuits/` exercised six examples in both languages, a 390 px Mongolian layout without horizontal overflow, an invalid component draft across a language switch, and translated restricted-extraction explanations. Chrome's file chooser blocked the invalid-JSON upload because its extension lacks local file-URL access; the parser and UI-facing diagnostic code passed automated tests. Final command results and commit are recorded in the delivery handoff.

Mongolian terminology follow-up: Gaussian-elimination `pivotRatio` is labeled **Гол элементүүдийн харьцаа (pivot ratio)** to distinguish it from circuit poles. Backward Euler is **Далд Эйлерийн арга**, frequency sweep is described as **давтамжийн мужийн тооцоо**, and the default underdamped RLC example describes decaying oscillation amplitude. The glossary records these meanings. The in-app browser file picker at `/circuits/` accepted malformed JSON and showed the Mongolian error while the loaded RC circuit and its DC result stayed intact. A valid JSON file downloaded with the browser's Export JSON button imported into a fresh tab, replacing the default RC with loaded RC and clearing the error. At 390 px, longer labels wrapped and document width remained within the viewport. `npm test` passed 44/44, and `npm run typecheck`, `npm run build`, and `git diff --check` passed.

## First GitHub Pages release preparation — 10 October 2026

The completed Phase 1A branch, including the Mongolian wording pass at `cd0a287`, is the source for the first public release. The release target is `https://gantemur.github.io/circuits/`, without a custom domain. `npm run build:site` packages only the three runtime assets into ignored `publish/`; `dist/` remains a development build containing additional kernel and test outputs. Assets use relative URLs under `/circuits/`, and the local preview can serve the exact package with `SITE_DIR=publish npm run preview`.

Validation runs on pushes and pull requests with Node 24 and the committed lockfile. The Pages workflow accepts only `main` for deployment, including manual runs, and requires its validation job to pass before packaging and deploying. The repository Pages source must be **GitHub Actions**. Release preparation checks on Node 26.4.0/npm 11.17.0: `npm ci`, `npm test` (44/44), `npm run typecheck`, `npm run build:site`, and `git diff --check` passed. Local browser verification used the packaged assets at `/circuits/`: English and Mongolian rendered, an RC resistor edit updated the AC response and plots, and Mongolian at 390 px had no horizontal overflow. JSON export produced a native file. The same application code at `cd0a287` had previously passed browser file-picker tests for malformed and exported JSON; this packaging-only release pass could not repeat the picker interaction because the browser automation timed out opening it. To check manually, import an exported native file and confirm the document changes, then import a file containing `{` and confirm a translated error while the current circuit stays intact.

`main` was fast-forwarded from `460771c` to release preparation commit `1277653` without rewriting history. The [first Pages run](https://github.com/gantemur/circuits/actions/runs/38089930120) passed validation and `build:site` but failed at `actions/configure-pages@v5` because the repository has no Pages site. The deploy job was skipped, and `https://gantemur.github.io/circuits/` returned HTTP 404. The connected GitHub integration cannot change repository administration settings, and the available browser was signed out of GitHub. The owner must choose **GitHub Actions** in **Settings → Pages** and rerun the Pages workflow on `main`; only a successful deploy and live browser check will establish publication.

## Maintenance format

For each later substantive decision, record date, context, choice, consequence, and validation. For a completed milestone, record the tested source revision when available and the actual test/build commands. Keep short entries; preserve mathematical rationale in the relevant specification or implementation note.

## Elementary examples, native JSON editor, and publication verification — 10 October 2026

The divider fixture is now the first/default browser preset. Its rectangular-resistor drawing shows Vin, R1, R2, ground, and output. The UI explains the unloaded divider identity but uses kernel DC and transfer solves for displayed values. The example has no storage element, time constant, or dynamic pole; its time samples are described as algebraic. Reset returns the selected fixture to its original parameters, and reset after a nonpreset custom topology returns to the default divider. The RC low-pass inspect-frequency default remains at its cutoff after reset.

The RC high-pass fixture uses C from in to out and R from out to ground, with capacitor voltage oriented `V(in)-V(out)`. Independent checks give `H(s)=sRC/(1+sRC)`, zero DC output, `(1+j)/2` at `omega=1/RC`, a one-volt output jump at the source step with continuous zero capacitor voltage, and subsequent backward Euler output `(1+h/RC)^(-n)`. The current restricted scalar extractor honestly returns `not-supported` for its off-diagonal storage stamp; numerical frequency and time results remain available.

The sidebar now displays the strict native JSON document in an accessible multiline editor. Explicit Apply uses the same parser as file import; invalid text stays in the editor, gives a translated error, and preserves the last valid circuit and analysis. Restore copies the current validated document back into the editor. A valid custom document updates controls and calculations, and a nonpreset topology uses the actual node/component table. Drafts and translated errors survive language switching. Preset drawing metadata is not added to the native schema. Graphical wiring remains future work.

The earlier release blocker was resolved before this update was integrated. The [main-branch Pages run](https://github.com/gantemur/circuits/actions/runs/38090056684) for `3490e69` completed successfully; the public `/circuits/` page, JavaScript, and CSS returned HTTP 200, and the live browser lab loaded, switched languages, and recomputed its RC response after changing R. At the time of this follow-up's validation, its task branch had not yet been merged or deployed.

Validation for this follow-up: `npm test` passed 47/47, `npm run typecheck`, `npm run build:site` (including the kernel and application builds), and `git diff --check` passed. The packaged site contains only `index.html`, `style.css`, and `app.js`. In the actual local browser, both new examples and custom JSON entry were exercised in English and Mongolian at 390 px with no page overflow. Valid custom JSON changed the component list, probe choices, AC result, and topology table; invalid JSON retained the previous circuit and result while the translated draft error and text survived a language switch. Node integration tests cover the independent divider/high-pass physics and parser behavior; the actual editor interaction was checked in the browser.

## Eight-example release preparation — 10 October 2026

The release candidate starts from tested examples/JSON commit `f0eb6c7`. A fresh fetch showed `origin/main` at `3490e69`, an ancestor of the task branch, with no unrelated local changes. Current-status wording now describes the eight-example lab and JSON editor intended for `main`; the earlier six-example deployment record remains historical. Deployment of this revision is not asserted by these documentation changes.

Before integration, `npm ci`, `npm test` (47/47), `npm run typecheck`, `npm run build`, `npm run build:site`, and `git diff --check` passed. The site package again contains only `index.html`, `style.css`, and `app.js`. Public release status must be established by the main-branch validation and Pages workflow results plus direct browser checks of the published URL.

The first eight-example Pages run for `621837c` passed, but live verification found a cache mismatch: the newly served HTML loaded an older cached `app.js` at the same URL and failed during localization startup. The site build now gives the relative JS and CSS URLs deterministic content-version queries; the packaging check and a focused test require the query to match the actual asset bytes. This is a release asset consistency fix, not a circuit feature change. After this fix, `npm ci`, `npm test` (48/48), `npm run typecheck`, `npm run build`, `npm run build:site`, and `git diff --check` passed. A fresh deployment and browser check must establish the final release status.

The corrected `main` revision `7fd6c11` passed [validation](https://github.com/gantemur/circuits/actions/runs/38096759070) and [Pages deployment](https://github.com/gantemur/circuits/actions/runs/38096759088). At the public `/circuits/` URL, a fresh browser session loaded all eight examples with the divider first. At 390 px in English, changing R1 from 1000 to 2000 Ω changed its DC output from 8 to 6 V and its transfer gain to 0.5. RC high-pass showed zero DC output, a 0.5+0.5j V RMS AC output at its inspect frequency, and a plotted immediate step jump followed by decay. Applying a valid custom document updated the component list, probe choices, topology table, and AC result; malformed text retained the last valid circuit and draft. The same presets and translated error worked in Mongolian without page overflow. The actual file picker rejected malformed JSON without changing the high-pass circuit and imported the valid loaded-RC fixture. Browser automation did not capture the JSON export download event on this release; the earlier successful browser export and round-trip import at `cd0a287` remain the last verified export interaction. The source and built assets are unchanged by this status update.

## Phase 1B form builder — 10 October 2026

Starting from released `main` at `812b5d5`, the task branch adds a form-only builder for the existing native v1 model. Its draft stores numeric input as text so incomplete and invalid values can survive language changes and failed Apply. Apply converts the draft, then delegates final authority to the strict native parser. The analyzed document and computed results remain separate. Node renaming updates draft references; deletion checks terminal, control, and observation references before removing anything. Removing a source or storage component removes only its own experiment entry. Existing labels and optional source fields survive document-to-form-to-document conversion. A changed analyzed document produces a visible conflict for an unapplied form or JSON draft, requiring explicit reload before Apply. No builder or drawing metadata enters exported JSON.

The form covers all nine existing component types, their terminal and control fields, independent source DC/complex RMS AC/time waveform definitions, named voltage/current observations, and equilibrium or complete storage initialization. New source defaults are shown and editable. Apply retains valid selected input/output IDs and replaces unavailable selections transparently. A structurally valid contradictory ideal-source document applies but its DC solve reports `inconsistent`. Unknown topologies use the actual node/component table. The kernel and its public API were not changed.

Focused tests verify a 2000 Ω output load changes the default 12 V divider from 8 to 6 V and removing it restores 8 V; a form-built RC high-pass matches independent cutoff and step-recurrence values; controlled-source control and experiment fields survive Apply; draft errors and conflicts preserve results; native documents round-trip; references block deletion; and an empty document shows analysis unavailable. Actual local browser checks at `/circuits/` verified a new 5 V source/resistor circuit built without JSON, valid/invalid Apply and Discard, blocked node/component deletion, a competing JSON-draft conflict and explicit reload, topology fallback, English/Mongolian draft retention at 390 px without horizontal overflow, valid fixture import, and malformed-file preservation. The browser's JSON export download event could not be captured in this pass, so file-export interaction is unverified here. Testing revealed and fixed an existing equation-rendering formatter callback bug for custom circuits. This milestone remains on the task branch; it has not been merged or deployed.

Final branch checks: `npm test` passed 55/55; `npm run typecheck`, `npm run build`, `npm run build:site`, and `git diff --check` passed. The Pages package contains only `index.html`, `style.css`, and `app.js`. These are local checks, not a Phase 1B public deployment.

## Phase 1B builder-state review fix — 10 October 2026

An untouched form now reloads whenever the validated document changes through a preset, import, or ordinary edit. An edited form remains intact and reports its conflict. Apply checks the base document regardless of `dirty`, including when a replacement has identical serialized content, so an obsolete form cannot overwrite a newer validated document. Ground protection now uses node ID `0` rather than array position. Node renames validate blank, duplicate, and reserved ground names before changing any references; the UI keeps rejected text editable and translates its error across language switches. The native schema and kernel are unchanged.

Regression tests cover preset switching, native imports, component edits, obsolete clean Apply, and a ground-in-the-middle document with terminal, control, and voltage-observation references. Browser verification exercised clean synchronization, edited-draft conflict, blocked Apply, rejected ground/duplicate/empty names, correction, and both languages. This fix remains on `codex/phase-1b-circuit-builder`; it is not merged or deployed.

Final local checks: `node --test test/builder.test.mjs` passed 10/10, `npm test` passed 58/58, and `npm run typecheck`, `npm run build:site`, and `git diff --check` passed. The site build includes the kernel and application builds.
