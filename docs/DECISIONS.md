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
| D21 | Phase 1B form builder completed and released | Preserve its bounded scope and release verification below |
| D22 | Phase 2A DC one-port equivalence completed and released | Keep its DC-only, finite-positive-resistance boundary and explicit solver limitations |
| D23 | UX workspaces supersede the earlier Phase 2B interface organization | Use one validated circuit/editor across Analyze and Transform; Phase 2B reductions now use that workspace |
| D24 | Phase 2B passive resistor transformations completed and released | Restrict previews to source-free finite positive resistors and preserve the full ordered terminal response |
| D25 | Maintained core methods are pedagogical source | Require traceable equations, dimensions, units, signs, numerical safeguards, and independent checks; optimized generated bundles are exempt |
| D26 | Phase 2D1 makes existing mathematics visually actionable in the published lab | Explicit verified resistor previews, session use/return, exact graphical examples, bilingual guides, and authored baseline metadata; native schema and kernel mathematics stay unchanged |
| D27 | Phase 2D2 extends the published example library | Eight strict native fixtures add connected passive filters, ideal-follower Butterworth filters, RLC measurement choices, and source-free impedance ladders; live results still use the unchanged kernel and authored references remain fixed baselines |
| D28 | Phase 3A1 established a separate headless nonlinear contract before browser integration | Strict circuit v2 adds only the explicit Shockley-series diode; the v1 parser and linear algorithms stay unchanged. Analytical residual/Jacobian, bounded damped Newton, physical checks, and a bias-bound native v1 tangent underpin the published Phase 3A2 browser. |
| D29 | Phase 3A1 and Phase 3A2 are published together | The 26-example browser routes strict v1/v2 documents and limits v2 to DC bias, local incremental frequency/equations, characteristic, and bounded source sweep; unsupported nonlinear operations remain explicit. |
| D30 | Phase 3A3 is a headless task-branch transient kernel | Use the reviewed static diode residual/Jacobian and linear storage factorization for compatible initialization and fixed-step backward Euler; keep browser v2 transient unavailable until a separate integration review. |

Repository visibility is an owner-controlled setting; this release does not change it. The companion book and third-party material retain the separate rights described above.

## Current status — 12 October 2026

- Phase 0 architecture review: complete; no contradiction in the public specification required a scope change.
- Phase 0 implementation: complete, including R/C/L, V/I and all four controlled sources, labeled/provenance-bearing MNA, DC and complex-frequency solves, numerical transfer, restricted scalar dynamic elimination, backward Euler transients, native JSON, and resistor Kron reduction.
- Phase 0 acceptance tests: **31 tests passing**, covering MVP sections A–H plus validation, numerical diagnostics, waveform units, explicit unsupported cases, and Kron overflow regressions.
- Reproducible headless demo and browser bundle: implemented and verified.
- Browser UI: the eight-example Phase 1A lab, native JSON editor, and Phase 1B form builder are integrated into `main` and verified on the public Pages site. Historical release records remain below.
- Phase 2A DC one-port teaching lab: integrated into `main`, published at [https://gantemur.github.io/circuits/](https://gantemur.github.io/circuits/), and verified in a public browser. Its DC-only, finite-positive-resistance scope and full-state nonuniqueness limitation remain explicit.
- UX workspaces redesign: reviewed implementation `01bd698` is integrated into `main` and published. The bounded contract is [UX_SPECIFICATION.md](UX_SPECIFICATION.md).
- Phase 2B passive resistor transformations: reviewed implementation `054522c` is integrated into `main` and published. Its six methods, numerical evidence, source-free positive-resistance boundary, and remaining limits are specified in [PHASE_2B_SPECIFICATION.md](PHASE_2B_SPECIFICATION.md). The public verification record is below.
- Phase 2C and Phase 2D1: reviewed implementation `edffe839` was fast-forwarded to `main` and published after successful validation and Pages deployment. The Phase 2D1 release includes Phase 2C; their bounded scopes are in [PHASE_2C_SPECIFICATION.md](PHASE_2C_SPECIFICATION.md) and [PHASE_2D1_SPECIFICATION.md](PHASE_2D1_SPECIFICATION.md). The release evidence is below.
- Phase 2D2 example library: reviewed implementation `210e455` is integrated into `main` and published with eight additional presets, bringing the live lab to 22. Its [scope and acceptance](PHASE_2D2_SPECIFICATION.md) and the live release evidence are below. Kernel mathematics, native JSON, and authored baseline references remain unchanged.
- Phase 3A1 diode kernel and Phase 3A2 browser lab: reviewed implementation `941a2ee` is integrated into `main`, published with 26 examples, and verified on the public Pages site. The bounded [kernel](PHASE_3A_SPECIFICATION.md) and [browser](PHASE_3A2_SPECIFICATION.md) contracts, historical task-branch checks, and current release evidence are below.
- Phase 3A3 headless transient: implemented on `codex/phase-3a3-diode-transient-kernel` for review only; main and the 26-example public browser remain at Phase 3A2. The [bounded contract](PHASE_3A3_SPECIFICATION.md) and task-branch evidence are below.

## Phase 3A1 task-branch verification — 12 October 2026

The strict v2 model requires every diode parameter and leaves v1 unchanged. The DC assembler reuses all linear device stamps and appends a signed diode-current unknown and ampere-valued constitutive row. The evaluator uses `expm1` near zero, a direct exponential/log-domain derivative rather than `i+Is`, and explicit numeric-range failure. Newton uses fixed A/V merit scales during bounded halving, the existing equilibrated solver for corrections, and acceptance against original unclipped physical equations. Ground KCL, signed powers, diode junction/series power decomposition, and a watts-valued balance are checked independently. A regular bias yields a circuit/DC-source-fingerprint-bound v1 incremental resistor circuit; changing AC phasors or absolute waveform/storage values alone retains that bias and supplies current AC increments. Differential resistance outside finite positive range is an explicit tangent limitation. No gmin, source stepping, charge law, or nonlinear browser controls were introduced.

Local validation on Node 26.4.0: `npm ci` succeeded; `npm test` passed **139/139** tests (130 prior plus nine new Phase 3A1 tests); `npm run typecheck`, `npm run build`, `npm run build:site`, and `npm run demo:diode` succeeded. The standalone `dist/browser.js` imported without Node or DOM globals and exposed the v2 parser, solver, and tangent APIs. The new independent tests cover two distinct thermal-voltage benchmarks, scalar load-line bisection and constructed series resistance, antiparallel signs, all four controlled-source laws, capacitor/inductor DC behavior, analytical Jacobian differences, local sensitivity refinement, RC frequency response, exact IDs, strict validation, owned snapshots, damping, and explicit failure cases. This is numerical validation of the declared model, not a physical-diode accuracy or root-uniqueness certification.

In the locally built browser, entering a valid v2 diode document into the existing JSON editor and pressing **Apply JSON** displayed the unsupported-schema error. Returning to Analyze still showed the original divider selected with `V(out)=8 V`. This directly checks the JSON-editor interaction, not the file picker or download completion. No new published-site verification is claimed for this task branch. `git diff --check` and final branch/commit status are recorded in the delivery handoff.

### Phase 3A1 numerical and fingerprint follow-up — 12 October 2026

The reviewed kernel had three reproduced problems. Its fixed 1 mA Newton merit scale exhausted the 60-step budget for the regular 10 Ω diode circuit; using 0.1 A converged. Expanded `Kx−Bu` operands made a source constraint's relative tolerance grow with a 12 V common return, allowing a 1e-7 V source edit to pass a zero-correction warm start. An optional `undefined` diode label appeared in the pre-snapshot fingerprint but disappeared from the owned JSON snapshot, so an unchanged circuit was reported stale.

The default *search* current scale now derives once from declared DC source magnitudes, resistor conductances, VCCS transconductances, and a 1 mA floor. Explicit scale options still prevail, and no trial changes its denominator. Physical row allowances now use branch currents for KCL and terminal/control voltage differences for constraint rows; the original expanded operands supply a separate binary64 arithmetic allowance of `8(N+1)εΣ|term|` in the row unit. The report exposes both parts. This is a conservative floating-point diagnostic, not a certified bound or a remedy for branch voltages lost below node-potential spacing. The existing physical floors, relative tolerance, Jacobian, ground KCL, diode-law, finite-range, and signed-power checks remain in place. Bias fingerprints validate first, then normalize through the same native serialization as owned snapshots. No v1 algorithm, diode law, browser UI, or native schema changed.

On Node 26.4.0, clean `npm ci`, focused Phase 3A1 tests (**13/13**), full `npm test` (**143/143**), `npm run typecheck`, `npm run build`, `npm run build:site`, `npm run demo:diode`, and `git diff --check` passed. A DOM-free execution of `dist/browser.js` parsed v2, solved the 10 Ω case, and created its v1 tangent. Independent scalar bracketing checks R=1, 10, 100, and 1000 Ω including positive series resistance; the 10 Ω and 1 Ω zero-start cases converged in six and eight accepted steps. At return potentials 0, 12, and 1000 V, changed-source warm starts each required a correction and matched the independent load line. A separate shifted-coordinate check covers KCL, independent/controlled voltage laws, and inductor constraints. Optional-undefined label/round-trip, genuine stale topology/model/DC edits, and unchanged AC/waveform/storage bias behavior have regressions. The task branch remains unmerged and undeployed; the earlier public-browser/file-picker limits above are unchanged.

Historical Phase 0 checkpoint: implementation was on task branch `codex/phase-0-kernel`, based on documentation commit `460771c`. Validation below applies to that checkpoint, committed with the subject `feat: implement Phase 0 linear circuit kernel`. At that time the checkpoint preserved `main` and did not merge or deploy the implementation. No private book was available or needed; public conventions and fixture equations supplied the acceptance contract.

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

## Phase 1B pending node-name preservation — 10 October 2026

The UI now keys pending node names and validation errors by the original node ID instead of the displayed row index. Adding a node leaves all pending names untouched; removing an unused node discards only that node's pending edit, and other edits follow their nodes when row numbers shift. Apply still rejects any remaining invalid name. Explicit Discard and clean synchronization clear pending edits as before.

Two UI event-level regressions first failed against `65f2130` and now pass. They cover Add, shifted removal, English/Mongolian errors, blocked Apply, correction, Discard, and clean synchronization. The actual local browser preserved a rejected `0` and its error after Add, then preserved the Mongolian error when another unused node was removed; Apply remained blocked until correction. `npm test` passed 60/60, and `npm run typecheck`, `npm run build:site`, and `git diff --check` passed. This follow-up remains on the task branch, without merge or deployment.

## Phase 1B release preparation — 10 October 2026

The release candidate starts from `7550d964` on `codex/phase-1b-circuit-builder`. A fresh fetch found `origin/main` at `812b5d59`, an ancestor of the task branch, with no unrelated working-tree changes. README current-source wording now covers the form builder while retaining the Phase 1A publication record as historical evidence. No Phase 1B publication is asserted by this preparation change. The tested revision will be fast-forwarded to `main` only after the required clean-install, test, typecheck, build, and diff checks pass; successful Pages deployment and a public browser check must establish live release status.

Release-candidate checks on the task branch: `npm ci`, `npm test` (60/60), `npm run typecheck`, `npm run build`, and `npm run build:site` passed. The site package contains only the three static runtime assets. These checks establish the source candidate, not its public deployment.

## Phase 1B public release verification — 10 October 2026

`main` fast-forwarded from `812b5d59` to preparation commit `eacb35ad`, preserving the task branch's builder commits without rewriting history. The [main validation run](https://github.com/gantemur/circuits/actions/runs/38104326176) and [Pages run](https://github.com/gantemur/circuits/actions/runs/38104326149) both succeeded. Public `/circuits/` HTML referenced `app.js?v=2bc928d55409` and `style.css?v=187d0fce5016`; fetched assets had those SHA-256 prefixes and matched the local three-file package byte for byte.

At 390 px, the live English and Mongolian app had no horizontal page overflow. The divider opened first and changing R1 to 2000 Ω gave 6 V at the output. The RC high-pass showed zero DC output, `0.5+0.5j` V RMS at its inspect frequency, and a backward Euler step response. A voltage source, resistor, and output probe built entirely in the form produced 5 V and the topology-table fallback. Invalid form input preserved that circuit and its result; an edited form retained a conflict when the example changed, while a clean form followed the new example. A rejected `0` node name and its translated error survived Add and removal of another node, blocked Apply, and remained correctable. The live file picker accepted `rc-loaded.json`; malformed JSON produced a Mongolian error without replacing that circuit. The browser did not capture a JSON export download event, so export interaction remains unverified in this release pass. The browser console showed no errors. This verified publication is the basis for the documentation-only status update that follows.

## Phase 2A DC one-port implementation — 10 October 2026

The task branch starts from released `main` at `d654e754`. The written [Phase 2A specification](PHASE_2A_SPECIFICATION.md) precedes its implementation. A headless `dcOnePort` helper constructs temporary strict native documents and reuses MNA assembly and DC solves for open, suppressed-source test, short, original loaded, Thévenin loaded, and Norton loaded experiments. The zeroed independent-source branches and all controlled-source controls remain. Equivalent realizations use local ground at the original negative port, so the differential bridge is not made floating accidentally. A sign-aware browser panel shows the original verified schematic or actual topology table, simple connection diagrams, solved comparisons, source-suppression explanation, and expandable physical diagnostics. The builder and JSON editors are unchanged.

The numerical comparison criterion uses separate V/A absolute floors with a relative term, as documented in the API. Zero resistance, negative resistance, unsupported storage, invalid selections, solver failures, and nonfinite derived values do not become a claimed positive-resistance equivalent. A tiny finite resistance is not reclassified as zero by an arbitrary fixed cutoff. The full-state solver's inability to resolve some terminal-unique systems with undetermined internal currents remains a limitation. Frequency-dependent and transient equivalents are outside this milestone.

Local validation: `npm test` passed 66/66 (the previous 60 plus six independent one-port tests); `npm run typecheck`, `npm run build`, `npm run build:site`, and `git diff --check` passed. The local browser at 390 px verified divider load edits, differential bridge and reversed signs, VCCS retention, explicit unsupported and degenerate outcomes, and preservation of separate unapplied form/JSON drafts through port/load edits, language switching, and a validated source edit. English and Mongolian showed no page overflow; console errors were absent. These are task-branch checks, not a public deployment. `main` remains at Phase 1B.

## Phase 2A release preparation — 10 October 2026

The reviewed implementation is `3646cafa` on `codex/phase-2a-one-port`. A fresh fetch found `origin/main` at the expected `d654e754`, an ancestor of that branch, and a clean task-branch working tree. The current-status wording describes the release candidate without asserting publication. The DC-only, finite strictly positive equivalent-resistance boundary and the full-state solver’s nonuniqueness limitation remain explicit. Integration requires clean-install validation and a fast-forward; public release status requires successful main-branch validation, Pages deployment, and direct live verification. Historical implementation and prior-release records above remain unchanged.

## Phase 2A public release verification — 10 October 2026

Release preparation commit `4243793` was fast-forwarded from `codex/phase-2a-one-port` into `main` and pushed without rewriting history. `npm ci`, `npm test` (66/66), `npm run typecheck`, `npm run build`, `npm run build:site`, and `git diff --check` passed before integration. The [main validation run](https://github.com/gantemur/circuits/actions/runs/38106999862) and [Pages deployment](https://github.com/gantemur/circuits/actions/runs/38106999948) succeeded. Public HTML under `/circuits/` referenced `app.js?v=3b808af501cb` and `style.css?v=3bbc649dab29`; the fetched HTML, JS, and CSS each matched the local `publish/` file byte for byte.

The live browser opened with the divider and showed Vth = 8 V, Rth = 666.6667 Ω (2000/3 Ω), and IN = 0.012 A. At RL = 2000 Ω, original, Thévenin, and Norton circuits each gave 6 V and 0.003 A; changing RL to 1000 Ω gave 4.8 V and 0.0048 A in all three. The imported differential bridge gave Vth = 2 V and Rth = 2166.667 Ω; reversing the selected port changed Vth, IN, loaded voltage, and current signs while keeping Rth positive. The controlled-source fixture retained its VCCS during the resistance test and gave 1 V, 500 Ω, and 0.002 A. A capacitor example reported unsupported storage; an ideal-voltage-source port reported zero resistance without inventing a finite Norton current; an ideal-current-source open circuit reported a nonunique or contradictory full-state solve.

Unapplied builder and JSON drafts survived port and load changes, language switching, and a validated source edit; the edited builder showed its conflict status afterward. English and Mongolian at 390 px had no horizontal page overflow, and the browser console had no errors. The release pass imported valid native fixtures through the browser file picker; it did not repeat malformed-file import or JSON export, which were covered by earlier release checks recorded above. The full-state solver can still reject a terminal-unique network when internal currents are undetermined. The final status-only documentation commit changes no application assets; its workflow outcome is reported in the release handoff.

## UX workspaces redesign — 11 October 2026

The task branch `codex/ux-workspaces` starts from released `main` at `f3097bbb`, with a clean working tree and fetched remote state. The active [UX specification](UX_SPECIFICATION.md) supersedes the older Phase 2B interface plan while retaining future mathematical reduction goals. The implementation keeps native v1 JSON, the Phase 0 kernel, and Phase 2A `dcOnePort` mathematics unchanged. A compact circuit bar and inspector now serve Analyze and Transform; the existing form and JSON editors have a dedicated screen. The panel model lives only in browser memory, with stable IDs, independent settings and pending text, a maximum of three instances, explicit selection reconciliation, and per-panel CSV. Examples start with two suggested panels, and restoring a suggestion is explicit after customization. The Transform view retains the solved original/Thévenin/Norton comparison with one original network view and a selectable equivalent representation. Synthesize is documented for later work without a placeholder tab.

The initial browser pass exposed a stale assembly cache when a new preset state reused revision zero; the cache now checks native document identity as well as revision. A 320 px check exposed analysis-toolbar overflow; wrapping it removed horizontal page overflow. The inspector's contribution action now shows recorded entries directly even when all three panel slots are occupied. Plot axis, grid, and failed-sample paths specify `fill="none"`; visual inspection showed visible frequency and transient curves without the reported black fills. No computed circuit values or native fields were changed to address presentation.

Clean-install verification on this branch: `npm ci` passed with npm's existing esbuild allow-scripts advisory; `npm test` passed 70/70; `npm run typecheck`, `npm run build`, `npm run build:site`, and `git diff --check` passed. The site package contained only `index.html`, `style.css`, and `app.js`. New focused tests cover independent duplicate frequency panels and CSV, stable panel IDs and pending errors through reorder/removal, invalid-setting isolation, missing-reference reconciliation, and nonfilled/gapped plot paths. Existing numerical acceptance cases, including one-port failure states, stayed green.

In the actual local browser, the divider opened with DC and port panels; Open comparison reached Transform with the same load and displayed the three solved circuits. RC selected frequency and transient panels; two frequency panels retained different outputs and sample counts. An invalid numeric panel draft stayed visible across Mongolian switching, left the other frequency panel intact, and was corrected. Add limit, reordering, collapse, full width, component-resistance updates, RMS AC source editing, and direct inspector contributions were exercised. The dedicated editor preserved an invalid node-name draft and separate malformed JSON draft across views; malformed JSON did not change the analyzed circuit, valid JSON applied, and the older form showed its conflict. A new form draft did not replace the validated divider. The browser file picker rejected malformed JSON and imported a valid bridge fixture with topology fallback. English and Mongolian at 320 and 390 CSS px had one-column panels and no ordinary page overflow; desktop curves were visible with no black triangles or console errors. The browser did not deliver a completed JSON-export download event, so that interaction remains unverified in this pass despite serialization and packaging tests. This branch is not merged or deployed; the last verified public site remains Phase 2A. The next scientific milestone should specify a supported Transform operation within the shared circuit/editor model.

### UX correctness review — 11 October 2026

The review fixed four interface paths without changing the circuit kernel. An Analyze port handoff now takes precedence over Transform's initial default, retaining terminal order and load; later topology edits keep valid choices, and missing terminals display a reselection state. Panel type changes use the same transition in production and regression tests, recalculating reference requirements for DC, frequency, transient, and port. JSON-editor and file-import errors now retain diagnostic codes and parameters for translation at render time, including a separate file-read failure. The mobile Original/Equivalent control switches only the drawings; metrics, comparison, diagnostics, and failure messages stay outside the switched region, with comparison tables locally scrollable.

Focused tests cover first and repeated handoffs, topology changes, pending load navigation, missing terminals, panel type changes, and English/Mongolian diagnostic rendering. In the local Chrome browser, a reversed divider port handoff showed p=0, q=out and Vth=-8 V. Applying valid JSON that removed a frequency panel's selected observation displayed a missing-output warning; switching to DC produced the DC result, and switching to transient restored the appropriate missing-output warning. Malformed JSON remained in the editor while its rejection changed English → Mongolian → English. At both 320 and 390 CSS px, in both languages, the divider metrics and table remained visible under the mobile diagram switch; the RC storage-device unsupported message remained visible under both diagram choices. Neither width produced page overflow, and the console had no errors. The browser file chooser did not emit a selection event during this review, so file-import UI and download completion were not reverified here; the prior import result above is historical evidence only. At the time of this review, the branch was unmerged and undeployed.

## UX workspaces release — 11 October 2026

Fetched `origin/main` remained at the expected `f3097bbb` and `origin/codex/ux-workspaces` at reviewed `01bd698`; the task branch contained only the redesign and focused UX fix beyond main. With a clean working tree, `npm ci`, `npm test` (74/74), `npm run typecheck`, `npm run build`, `npm run build:site`, and `git diff --check` passed. Main was fast-forwarded and pushed to `01bd698` without rewriting history. [Validation](https://github.com/gantemur/circuits/actions/runs/38116427472) and [Pages deployment](https://github.com/gantemur/circuits/actions/runs/38116427451) both completed successfully. The public `/circuits/` HTML, `app.js?v=5801e567de9d`, and `style.css?v=d33d2d5bd418` matched `publish/` byte for byte.

On the public site, the default divider showed V(out)=8 V; changing R1 from 1000 Ω to 2000 Ω changed V(out) to 6 V. Duplicate RC frequency panels kept distinct outputs and sample counts. Unapplied Form and JSON drafts survived navigation, and both reported conflicts after the validated circuit changed. A first reversed Analyze → Transform handoff preserved p=0, q=out, RL=2000 Ω, and Vth=-8 V. Removing a frequency panel's selected output through valid JSON showed a missing-output warning; changing to DC produced a result, and changing to transient restored the missing-output warning. A malformed JSON draft remained visible and its error translated English → Mongolian → English. At 320 and 390 CSS px, in both languages and both diagram choices, divider results and comparison tables remained visible, as did the RC storage-device unsupported message; there was no horizontal page overflow or browser console error.

The Chrome automation did not return a file chooser for either valid-fixture or malformed-file import attempts, and did not return a completed JSON-export download event. Those three browser interactions remain unverified in this release pass; earlier import/export records and automated serialization tests are separate evidence. The published release remains limited to the existing Phase 2A mathematics.

## Phase 2B passive resistor transformations — 11 October 2026

The task branch `codex/phase-2b-resistor-transforms` starts from released main `7926c7e9`. The public [Phase 2B specification](PHASE_2B_SPECIFICATION.md) and active-milestone pointer were written before implementation. The private book copy was absent, so Chapter 1 §§1.3–1.4 and Appendix C.3 were not inspected; the public conventions and independent fixture equations are sufficient for this implementation.

A headless helper now validates explicitly selected parallel, series, star→delta, delta→star, one-center star–mesh, and bulk Kron moves on source-free positive-resistor native documents. The full ungrounded Laplacian includes node `0` as an ordinary node. Ordered retained-terminal currents enter the network. The preview preserves the original document and editor drafts, compares both full response matrices, solves internal KCL under independent and common-shift boundary voltages, and checks boundary currents and physical power separately. Generated IDs avoid collisions; overflow, destructive underflow, disconnected internal components, nonfinite values, failed solves, and unrepresentable native resistors have explicit non-success outcomes. Strict native JSON is offered only after validation; applying it remains an explicit editor/import action. Three new source-free examples use topology tables and DC/equation Analyze suggestions. The existing Thévenin/Norton method is retained.

The requested description of an unbalanced five-resistor bridge as having “no elementary first move” needed a narrower interpretation: there is no first series or parallel move, but a degree-three internal bridge node does admit star→delta under this milestone's rules. Tests and documentation state that mathematical distinction and independently derive the bridge's terminal conductance from two internal KCL equations.

Local validation after clean install: `npm test` passed 81/81, and `npm run typecheck`, `npm run build`, `npm run build:site`, and `git diff --check` passed. In the actual local Chrome browser, all six method controls produced previews on applicable circuits: series gave 3000 Ω, reversed parallel gave 666.6667 Ω, star→delta and one-node star–mesh gave three couplings, delta→star recovered legs 1, 0.5, and 1/3 Ω after applying a generated preview through the JSON editor, and bulk Kron reduced the bridge. Each preview showed original/transformed topology and both ordered response matrices; non-Kron operands required an explicit choice. Invalid retained text removed the export preview, missing nodes remained explicit across language changes, and a changed circuit invalidated an obsolete selected move. Malformed JSON preserved the previous circuit and draft. An unapplied form value survived Transform navigation and did not alter the analyzed resistor. Source-free series suggested DC/equations rather than an unusable frequency panel. Switching back to divider showed the existing Vth=8 V, Rth=666.6667 Ω, IN=0.012 A after explicit terminal reselection. The desktop, 390 px, and 320 px layouts were checked in English and Mongolian with no page overflow or console errors; mobile Original/Equivalent switched only topology tables while response matrices stayed visible. Browser automation did not deliver a file-chooser or completed export-download event, so file import and download completion remain unverified in this pass; strict serialization and editor application are distinct verified paths.

At this task-branch checkpoint, the work had not been merged or deployed; the public site still carried the UX redesign with Phase 2A mathematics. Dynamic reduction, active circuits, arbitrary two-port parameters, synthesis, nonlinear models, and a wiring canvas remain outside Phase 2B.

## Phase 2B review corrections — 11 October 2026

The terminal-current check now solves internal potentials relative to one retained terminal and accumulates physical branch currents from voltage differences. This removes common-mode Laplacian cancellation while retaining separate matrix, internal-KCL, boundary-current, and power checks with their existing absolute/relative units. Uniformly scaled star/delta tests include the reported `10⁻⁴` false failure, both directions, and reordered terminals. Candidate keys are structured JSON tuples, so valid edge IDs containing colons cannot collide. The Transform retained-terminal control is an ordered list of exact-ID selectors rather than comma-delimited text; missing and duplicate choices remain explicit, node `0` remains required for native export, and incomplete selections cannot export stale JSON. Analyze's Open comparison action explicitly selects DC and retains the resistor method's settings for later navigation.

Focused and full tests passed (87/87), as did typecheck, build, site build, and `git diff --check`. Local Chrome checks covered exact `a,b` node-ID preview and parsed JSON, the intended `a`/`b:c` operand pair and `12000/7 Ω` generated resistance, reversed divider handoff with Vth `−8 V`, and unchanged series/star/bridge previews. English and Mongolian terminal layouts had no page overflow at 320 or 390 CSS px, and the console had no errors. File-picker interaction and completed download events were not retested in this review. At that review checkpoint, this fix was still on `codex/phase-2b-resistor-transforms`; main and the published site still carried the UX redesign.

## Phase 2B cancellation-sensitive current check — 11 October 2026

The relative-voltage gauge removed false common-mode currents, but a second false failure remained when nonzero incident currents nearly canceled at a retained terminal. The four-terminal `[5,7,3,1]/s` star–mesh at `s=10⁻⁴ Ω` returned `not-equivalent/current` even though its independent response is `(diag(w)−wwᵀ/16)/s`; at `[1,2,3,4] V`, the exact center is `2 V` and currents are `[-50000,0,30000,20000] A`. The generated mesh has about `43750 A` of absolute incident current at `b` but only a floating-point residue near zero there. A `[3,7,3]/s` three-terminal star at `s=10⁻⁶ Ω` exposed the same comparison error.

The terminal comparison now retains its `1e-12 A` floor and `1e-8` net-current term, adding a first-order binary64 evaluation allowance proportional to each terminal's **noncancelled** incident-current magnitude. It also includes measured hidden-node KCL residuals and their evaluation allowance: for a connected positive-resistor network, correcting an internal residual can redistribute at most its absolute injected current to any one boundary terminal. The added quantities all have amperes as their unit. This is a numerical diagnostic budget, not a certified enclosure; it does not clip computed currents or replace matrix, internal-KCL, power, finite, overflow, or destructive-underflow checks. [KERNEL_API.md](KERNEL_API.md) states the exact formula.

New regressions independently derive the four-terminal response and currents at multiple scales and terminal orders, and the three-terminal response and currents with delta→star inverse. The previously existing extreme-value tests remain green. Focused tests passed 11/11; the complete suite passed 89/89. Typecheck, build, site build, and `git diff --check` passed. At that numerical-fix checkpoint, the change was still on the Phase 2B task branch; main and the public site had not changed.

## Phase 2B public release — 11 October 2026

The reviewed implementation `054522c` and fetched task branch matched exactly; fetched `main` was the expected ancestor `7926c7e9`, and the working tree was clean. `npm ci`, `npm test` (89/89), `npm run typecheck`, `npm run build` twice, `npm run build:site`, and `git diff --check` passed. Main fast-forwarded to `054522c` without rewriting history. Its [validation](https://github.com/gantemur/circuits/actions/runs/38147925520) and [Publish browser lab](https://github.com/gantemur/circuits/actions/runs/38147925593) runs succeeded. The public `/circuits/` HTML, versioned JS (`2478137360a0`), and CSS (`2bb050bd83e3`) matched the three-file publishing package byte for byte.

On the public site, the divider loaded first at 8 V and an R1 edit to 2000 Ω gave 6 V; RC frequency and transient curves rendered. All six resistor-transform methods previewed on applicable circuits, including delta→star after applying a generated JSON preview through the editor. The two ordered terminal response matrices agreed. Incomplete terminal selection displayed a blocking message; reordered terminals reordered both matrices. The collision pair `a`/`b:c` removed those two branches, retained `a:b` and `c`, and generated `12000/7 Ω`. A node ID `a,b` retained its exact bytes through selectors and strict transformed JSON preview. The reversed Analyze → Open comparison handoff selected DC with p=`0`, q=`out`, Vth=`−8 V`; returning to resistor transformations retained their settings. Source and storage circuits reported unsupported outcomes. Unapplied Form and JSON text survived navigation and previews; an edited Form draft showed a conflict after a circuit change. English and Mongolian at 320 and 390 px showed no horizontal overflow or console errors. Both mobile drawing choices kept divider results and storage-device warnings visible.

The live JSON editor accepted a valid transformed native document. The Chrome file chooser did not return for valid or malformed file-import attempts, and no completed native/transformed JSON download event was captured. These interactions remain unverified in this release pass; parser tests and editor application do not establish file-picker or download completion. The remaining mathematical limits are those in the Phase 2B specification: passive positive resistors only, terminal equivalence only, and floating-point rather than certified agreement.

## Core readability policy — 11 October 2026

The project now treats maintained mathematical, physical, and numerical source as teaching material. [AGENTS.md](../AGENTS.md) makes explicit stages, documented contracts and safeguards, and independently checkable calculations binding; generated browser bundles can remain optimized. [CODE_GUIDE.md](CODE_GUIDE.md) maps native documents through device laws, MNA, solves, residuals, transient integration, one-port analysis, and resistor reductions, with divider, RC, and star/bridge reading paths. This branch changes presentation and documentation only: public APIs, native JSON, algorithms, arithmetic order, tolerances, and failure classifications remain the released ones. A clean `npm ci`, the complete suite (89/89), typecheck, build, site build, and `git diff --check` passed. Manual source review separately traced incidence and sign rules, unknown and boundary indices, scaled-solve diagnostics, storage continuity, local port references, and S/A/W comparison budgets. At this task-branch checkpoint, it had not been merged or deployed.

## Core readability public release — 11 October 2026

The reviewed `b1ae118` branch was based on fetched `main` at `64c3c53`. Comment-only clarification commit `c3b63c7` distinguishes the local branch-incidence vector from scalar branch voltage in assembly and defines the initializer's N MNA unknowns and m storage states. No algorithm, API, arithmetic, tolerance, or UI change was made. `npm ci`, `npm test` (89/89), `npm run typecheck`, `npm run build`, `npm run build:site`, and `git diff --check` passed. `main` fast-forwarded to `c3b63c7` without rewriting history; its [validation](https://github.com/gantemur/circuits/actions/runs/38154632294) and [Publish browser lab](https://github.com/gantemur/circuits/actions/runs/38154632316) runs succeeded, including Pages deployment.

The public HTML, versioned JS (`02f585469940`), and CSS (`2bb050bd83e3`) matched a freshly built, three-file publishing package byte for byte. The live browser showed the divider changing from 8 V to 6 V when R1 was edited to 2000 Ω, RC magnitude/phase and backward Euler transient plots, a 3000 Ω series-resistor preview with matching terminal matrices, and 6 V / 0.003 A agreement among the original, Thévenin, and Norton divider circuits. The README's code-guide link opened the guide on GitHub. This release did not repeat file-picker or completed-download checks; their Phase 2B verification limits above remain.

## Phase 2C linear port analysis task branch — 11 October 2026

The task branch `codex/phase-2c-port-analysis` starts from released `main` at `b2a09cd8`. Its [specification](PHASE_2C_SPECIFICATION.md) was written before the implementation. The private book was unavailable in `.local-reference/`; the public port definitions and independent equations in the specification supplied a complete acceptance contract. The native schema, existing device laws, and DC Transform method are unchanged.

`analyzePorts` now measures one- or two-port Z and Y independently using temporary current injections and voltage clamps. Each port is an ordered exact-ID node pair; both currents enter the characterized network. An explicitly selected independent voltage drive across port 1 can be excluded, except when a retained current-controlled law senses its branch. All remaining independent source values, including AC phasors, are suppressed while their branches and all controlled laws remain. Every matrix column retains the full MNA solution and diagnostics. Z and Y have separate outcomes: a failed full-state solve does not erase a successful other representation or assert that the mathematical terminal relation is absent. No pseudoinverse, artificial leakage, or substituted impedance is used.

Two-port loading solves the boundary equations from each available matrix and independently solves a connected temporary circuit with a 1 V RMS Thévenin source, finite nonnegative source resistance, and either a finite positive load or tagged open load. It reports complex terminal voltages/currents, source-to-output and terminal voltage gains separately, input impedance only when defined, and differences/limits separately in V and A. A parameter prediction remains visible if the direct full-state solve fails, with no invented comparison. This is sampled floating-point evidence, not all-frequency equivalence, passivity, or internal-stability proof. The new Analyze panel offers exact-ID terminals, source exclusion, zero-inclusive single frequency, a positive logarithmic sweep, matrix entry plots, loading, language-neutral CSV, and explicit stale/invalid states. Three source-free native examples use topology tables. The existing three-panel cap, editor drafts, and navigation rules remain.

Independent regression equations cover series RC Z/Y and undefined DC Z, resistor-T matrices and several loads, the RC-section Y/Z formulas, connected-RC loading versus isolated-gain multiplication, differential terminals, nonreciprocal VCCS, orientation and port swap, source suppression/exclusion, ID collisions, invalid/dependent selections, singular/finite-range failures, and input immutability. Production panel-transition tests cover duplicates, pending invalid values, stale references, and CSV failed/undefined states. A clean `npm ci` passed with npm's existing esbuild allow-scripts advisory; focused port tests passed 13/13; the full suite passed 102/102; typecheck, build, site build, and `git diff --check` passed. The publishing package contains only `index.html`, `app.js`, and `style.css` with relative content-version references.

In the actual local Chrome browser, the resistor T showed agreeing direct, Z, and Y loaded results; changing `Rs` to 500 Ω and `RL` to 4700 Ω updated all three. The RC section showed valid Y and unavailable Z at DC with a teaching explanation; its one-port Z at 1000 Hz was `1000−159.15j Ω`. The connected RC example showed magnitude/phase curves and its loaded-stage explanation. Selecting and explicitly excluding `Vin` from the RC low-pass displayed the excluded branch and retained network; reversing output-port order changed the cross-coupling signs. Duplicate port panels were created, an invalid frequency draft retained its last valid result and translated into Mongolian, and malformed JSON plus an unapplied Form value survived navigation. Applying a valid JSON topology change left a missing port selector explicit and preserved the older Form draft as a conflict. At desktop, 390 px, and 320 px, English and Mongolian had no horizontal page overflow; the equations matrix discovered to overflow at 320 px now scrolls within its panel. Browser console errors were absent. File-picker selection and completed download events were not retested for this milestone; earlier verification limits remain. This branch has not been merged or deployed, so the public site remains the Phase 2B/core-readability release.

## Phase 2D1 visual transformations and guided examples — 11 October 2026

The task branch `codex/phase-2d-visual-learning` starts at the verified Phase 2C tip `d182c048` while `origin/main` remains the released `b2a09cd8`. The [specification](PHASE_2D1_SPECIFICATION.md) and AGENTS active-milestone pointer were written before substantive implementation. No private book was available in `.local-reference/`; the public conventions, prior validated helper, and independent fixtures supplied the acceptance contract. This branch has not been merged or deployed.

The existing resistor helper and all numerical algorithms, tolerances, sign conventions, native v1 fields, and failure classifications remain unchanged. Transform now requires an explicit Preview, invalidates old results on selection/document changes, and rechecks the exact helper result at Use. A session snapshot supports Return only while the transformed document is still current. Both actions preserve unapplied Form/JSON drafts through the validated-document path and request an explicit choice before changing the applied circuit. Unsupported sources/storage name their blocking devices and link to existing suitable examples; opening such an example deliberately starts it with observed terminals while ordinary preset navigation retains missing old terminal IDs for correction. Drawings distinguish full networks from local rewrites; a large arbitrary resistor graph falls back to exact tables. A single 1 V boundary illustration uses `I_B=ΛV_B` with currents entering the network, other terminals clamped rather than open, and finite-display guards. It is not an independent equivalence test; the helper's matrix, internal-KCL, current, and power checks remain authoritative.

All 14 presets now have topology-matched, value-aware SVG layouts with exact component IDs, expandable topology tables, and keyboard-operable component selection. A shared English/Mongolian study guide follows the selected lesson across Analyze and Transform; navigation preserves panel settings and demands an explicit choice at the three-panel limit. Four authored scalar baseline records cover the divider, RC low-/high-pass, and series resistor impedance. Their fixed coefficients are marked as baseline targets after edits and are never substituted for current kernel results. Foster/Cauer synthesis applies to admissible driving-point functions; transfer-function realization is a separate later problem.

A clean `npm ci`, full `npm test` (109/109), `npm run typecheck`, `npm run build`, `npm run build:site`, and `git diff --check` passed. The local publishing package had only `index.html`, `app.js`, and `style.css` with matching relative content-version references. In the actual local browser, the divider source blocker led to the series example; series Preview showed 3000 Ω and about 0.333333 mA under 1 V, then Use and Return changed/restored the validated circuit. Star→delta and bridge/Kron previews displayed ordered terminal currents and full/local drawings. Each preset displayed an SVG with the actual component count; resistor edits changed drawing values, and keyboard selection retained focus. Unapplied JSON/Form drafts survived the corresponding circuit changes and reported conflicts. The guide retained its open state and panel settings across language/workspace switches; its full-layout path required explicit replacement. English and Mongolian at desktop, 390 px, and 320 px had no horizontal page overflow or console errors; wide drawings and tables scrolled locally. File-picker selection and completed-download capture were not repeated, so their earlier verification limits remain. The next planned task is richer linear filter examples, not a synthesis or nonlinear expansion in this branch.

## Phase 2D1 presentation correction — 11 October 2026

Review found that offset parallel symbols had no leads back to their terminal centers, a two-terminal preview could place an unrelated T-network node on a resistor, SVG position lookup lost `__proto__`, a markup-like node ID was interpolated unescaped into the boundary sentence, and an otherwise finite current could overflow when converted from A to mA. The RC drawing also had a 10 px gap above its capacitor plate, and circular source leads ended at the diamond coordinates. These were presentation errors; no kernel method, public API, native field, arithmetic order, tolerance, or physical check changed.

The compact node-edge renderer now connects every parallel path to both real node centers and rejects a drawing when a branch or symbol approaches an unrelated node or two non-junction branches cross. It then shows exact topology tables; it does not attempt general routing. Two-terminal internal nodes alternate away from the direct terminal path. Null-prototype position maps retain exact native IDs through before/after layout merging. The boundary sentence escapes IDs, and the series note remains in A if conversion to mA is nonfinite. Source/capacitor wires meet their drawn symbols. Regression tests assert actual lead coordinates, unsafe-layout fallback, literal IDs and finite geometry, and the overflowing unit conversion; merely finding an SVG is not the evidence.

The corrected branch passed focused rendering regressions, the full suite (114/114), typecheck, build, site build, and `git diff --check`. In the actual local browser, parallel, resistor T, series, star→delta, and bridge/Kron previews showed connected before/after networks. Use and Return restored a parallel circuit; the RC capacitor and source symbols met their leads, and selecting the capacitor opened its inspector. English and Mongolian were inspected at desktop, 390 px, and 320 px, with no page overflow; wide drawings and tables scrolled locally. Browser file selection and completed downloads were not retested. This remains an unmerged task branch, not a public release.

### Compact resistor-drawing collision guard — 11 October 2026

The earlier compact-layout check caught branch crossings and branches near unrelated nodes, but missed two forms of overlapping ink: rotated resistor rectangles from distinct branches, and a wire from one branch passing through another branch's symbol. Shared terminal IDs permit wire endpoints to meet at the terminal; they do not excuse collisions farther along either branch. The renderer now checks the actual rotated 62 × 20 px symbol rectangles using their local axes and a visible-stroke margin, and clips each other branch's wire segments against a padded symbol box. Parallel branches use 30 px offsets so their ordinary two-symbol drawing remains clear. Ambiguous compact layouts return the existing exact-table fallback; topology, helper verification, and strict transformed JSON remain available. This is a bounded display safeguard, not a routing algorithm or a change to circuit mathematics.

A strict five-resistor native fixture with retained order `[0,out]` exposed the omission. Its automatic positions put `a=(285,75)`, `b=(285,245)`, and `c=(395,75)`; R1 and R2's rotated symbols overlap. The new regression requires the table fallback while independently deriving the reduced resistance as `1000 + (1000 || 2000) = 5000/3 Ω`. Separate regressions isolate wire–symbol and symbol–symbol collisions and verify clear control layouts still draw. Existing coverage confirms that all 14 preset schematics and all six standard resistor-transform previews remain drawable. The numerical helper, native schema, and preview/use workflow are unchanged.

On this correction, the focused visual-learning file passed 15/15 tests and the full suite passed 117/117; `npm ci`, typecheck, build, site build, and `git diff --check` passed. In the actual local browser, the five-resistor preview showed the verified `1666.66667 Ω` result, complete topology tables, and explicit drawing fallback. Parallel, series, star→delta, bridge/Kron, and resistor-T previews retained full drawings. English and Mongolian checks at desktop, 390 px, and 320 px found no horizontal page overflow or console errors. Browser file selection and completed downloads were outside this drawing correction and were not retested.

## Phase 2C and Phase 2D1 public release — 11 October 2026

Fetched `origin/main` was the expected `b2a09cd8`, and `origin/codex/phase-2d-visual-learning` matched reviewed `edffe839`. Main was its ancestor. The original checkout was clean; a separate managed checkout provided a clean `npm ci`, `npm test` (117/117), `npm run typecheck`, `npm run build`, `npm run build:site`, and `git diff --check`. Its `publish/` contained only `index.html`, `app.js`, and `style.css`. Main fast-forwarded and pushed to `edffe839` without rewriting history. [Validation](https://github.com/gantemur/circuits/actions/runs/38182928106) succeeded; [Publish browser lab](https://github.com/gantemur/circuits/actions/runs/38182928373) succeeded in its validate, package, and deploy jobs for that exact SHA. The public HTML and its referenced `app.js?v=5373a2ac1f6d` and `style.css?v=ada89e9584d8` matched the isolated three-file package byte for byte.

On the live `/circuits/` site, the default divider showed 8 V and changing R1 to 2000 Ω gave 6 V. RC low-pass frequency magnitude/phase and backward Euler transient curves rendered. The resistor-T two-port loading table gave matching direct, Z, and Y results (`V₂=0.31579 V` at its default load). At DC, the RC section explicitly reported Z unavailable because the current-driven test constraints conflict, while explaining that Y remains valid. From the divider guide, the source blocker opened the series example; Preview showed 1000 Ω + 2000 Ω → 3000 Ω and approximately 0.333333 mA under 1 V. Use and Return both requested confirmation when Form/JSON drafts were pending; the unapplied 1500 Ω Form value and malformed JSON text survived the circuit changes and workspace navigation with conflicts shown. Star→delta and bridge/Kron showed verified full before/after drawings. The strict five-resistor JSON case previewed with retained `[0,out]`: all R1–R5 appeared in the original topology table, the transformed table gave `R_kron=1666.66667 Ω` (`5000/3 Ω` independently), and the ambiguous full drawing was replaced by an explicit fallback. English and Mongolian at desktop, 390 px, and 320 px had no horizontal page overflow or browser console errors.

This release did not repeat browser file-picker selection or completed JSON-download capture. Earlier browser import/export records and automated parser/serialization tests remain separate evidence; neither establishes completion of those live interactions in this release. The mathematical limits remain the documented full-state nonuniqueness possibility, finite sampled port analysis, passive positive-resistor-only transformations, and floating-point rather than certified equivalence. This status update changes documentation only; application assets remain those of `edffe839`.

## Phase 2D2 example library task branch — 11 October 2026

The task branch `codex/phase-2d2-example-library` starts from released `origin/main` at `7d10fef7`. [PHASE_2D2_SPECIFICATION.md](PHASE_2D2_SPECIFICATION.md) and the AGENTS active-milestone pointer were written before substantive implementation. No private book was present in `.local-reference/`; the public equations and acceptance cases supplied the contract. This work has **not** been merged or deployed.

Eight strict native v1 fixtures add three-section connected RC low/high-pass filters, two ideal-unity-follower Butterworth RC filters, resistor and L+C measurements of a series RLC resonator, and source-free RC/RL driving-point ladders. The selector now has 22 examples in bilingual groups; the divider stays first. Six transfer examples use separate 1 V DC, 1 V RMS AC, and 0→1 V step source fields with zero pre-step storage. The ladders instead start with an ordered `(in,0)` one-port Z sweep and no permanent source. The VCVS remains an ideal powered model, with no real amplifier supply or headroom claim. Numerical analyses, native schema, tolerances, failure classifications, and restricted algebraic extraction remain unchanged.

Each new topology has a value-aware, keyboard-selectable SVG, measurement marks, and an expandable exact-value topology table. Curated drawings require an exact endpoint/ID match; incompatible circuits fall back to the table. Bilingual guides state assumptions, governing equations, experiment actions, and interpretation. Authored scalar H or Z coefficients are constant-first in SI powers of `s` and fixed to unedited fixtures; after edits they are labeled as baseline targets while the kernel computes live results. The RC ladder reports valid DC Y and unavailable finite DC Z; the ideal notch zero is distinguished from finite numerical cancellation. Long guide equations scroll within the guide at narrow widths rather than widening the page.

Independent acceptance tests evaluate connected-node RC equations and loading, the Butterworth rational responses and load-current signs, continuous step solutions against two backward Euler steps, the RLC measurement identity and reversal, and both ladder continued fractions and endpoint behavior. A clean `npm ci` passed with npm's existing esbuild allow-scripts advisory. Focused Phase 2D2/visual tests passed **26/26**; the complete `npm test` suite passed **128/128**. `npm run typecheck`, `npm run build`, `npm run build:site`, and `git diff --check` passed. The local publishing package contains only `index.html`, `app.js`, and `style.css` with relative versioned references; it was built for verification, not deployed.

In the actual local browser, all eight examples were visited and their component drawings and numerical panels inspected in English and Mongolian at desktop, 390 px, and 320 px. Passive and Butterworth frequency/transient curves rendered; changing an active-filter resistor changed its curve, while changing its RL from 10 kΩ to 1 kΩ left ideal transfer unchanged. The RLC observation selector moved the drawn differential marks; the notch sweep marked one exact-zero sample with undefined logarithmic magnitude and phase rather than fabricating a finite plot value. Both source-free ladders displayed one-port curves, and the RC DC case explained unavailable Z. Mouse and keyboard component selection, guide navigation and the three-panel replacement prompt, Form/JSON draft conflicts, valid native JSON application, and rejected JSON preservation across language switching were exercised. An expanded high-pass guide initially widened the 320 px page; local equation scrolling corrected it. All eight expanded guides then fit at both mobile widths in both languages, with their equations scrollable locally. No browser console errors were observed. File-picker selection and completed download capture were not retested; parser and editor checks do not establish those interactions.

## Phase 2D2 teaching-presentation correction — 12 October 2026

The active-filter drawings previously claimed unity output regardless of edits to the ideal Follower VCVS. They now show the actual terminal law `V(p)−V(n)=K[V(cp)−V(cn)]` and the current Follower gain, including zero and negative values. The authored Butterworth coefficients remain fixed, explicitly marked as the `K=1` baseline. The high-pass load-current lesson now opens the existing Frequency panel and directs inspection at 1000 Hz of `load`, `follower`, and then `out`; DC could not demonstrate this effect because all three outputs there are zero. At the 1 V RMS unity baseline, independent KCL gives unchanged `Vout=+j/√2 V`, load-current magnitudes `70.7107` and `707.107 µA` for `10 kΩ` and `1 kΩ`, and a signed follower-current change that balances the load-current change while feedback current remains. Guide navigation preserves the frequency panel's ID, settings, and invalid pending text. The RLC ground-side minus mark now sits visibly above the output badge, and the active Follower label, RL value, and gain annotation have distinct positions. The RC3 isolated-stage comparison now uses each fixture's actual `z=sRC` (`i/x3` for the high-pass at 1000 Hz); connected-circuit expectations and fixtures are unchanged.

Focused Phase 2D2 regressions passed **13/13**, including edited gains in both presets, analytical AC currents, panel-setting preservation, and geometry checks for all four voltage observations in each RLC preset and their current arrows. The full suite passed **130/130**; typecheck, build, site build, and `git diff --check` passed. In the actual local browser, both active drawings updated after gain edits (including `1.2`, `1.3`, `0`, and `−1`), the high-pass lesson focused the existing frequency panel, and changing RL to `1 kΩ` changed the configured AC currents while `out` stayed `+0.70711j V`. Both RLC presets were inspected with every voltage observation and the inductor-current arrow. English and Mongolian at desktop, 390 px, and 320 px showed separated labels, visible polarity marks, local diagram scrolling, and no page overflow or console errors. File-picker selection and completed downloads were outside this correction and were not retested. This remains a task-branch change; main and the public release are unchanged.

## Phase 2D2 public release — 12 October 2026

Fetched `origin/main` was the expected `7d10fef7`, and the reviewed `210e455` task tip was its direct descendant; both tracked checkouts were clean. A new isolated worktree at the reviewed commit had no inherited ignored build files. There, `npm ci` completed with npm's existing esbuild allow-scripts advisory, `npm test` passed **130/130**, and typecheck, build, site build, and `git diff --check` passed. The publishing package held exactly `index.html`, `app.js`, and `style.css`, with relative versioned references. Main fast-forwarded and pushed to `210e455` without rewriting history. Its [validation](https://github.com/gantemur/circuits/actions/runs/38204191230) and [Publish browser lab](https://github.com/gantemur/circuits/actions/runs/38204191229) workflows succeeded, including Pages' validate, package, and deploy jobs. The public HTML and its referenced `app.js?v=17ce3998bc34` and `style.css?v=d945e9e6c1f6` matched the isolated package byte for byte.

On the [live `/circuits/` site](https://gantemur.github.io/circuits/), the divider remained first and changing R1 from 1000 to 2000 Ω changed V(out) from 8 to 6 V. The selector contained all 22 presets. Restoring each new example's suggested layout confirmed `out` frequency/transient panels for four RC filters, resistor-voltage and L+C-voltage frequency/transient panels for the two RLC views, and one-port-frequency/equations panels for the RC/RL ladders; their numerical plots rendered. Editing the low-pass Follower gain to 1.2 updated the displayed VCVS law and changed its 1000 Hz configured output from about `−0.70711j` to `−1.0607j V RMS`, while the authored `K=1` reference remained labeled as a baseline target. The high-pass guide focused the existing Frequency panel without resetting its `1234 Hz` inspection or selected `load` observation; following the lesson at 1000 Hz and changing RL from 10 kΩ to 1 kΩ changed `load` from about `+7.0711e−5j` to `+7.0711e−4j A` and `follower` from `4.4429e−5−7.0711e−5j` to `4.4429e−5−7.0711e−4j A`, while `out` stayed about `+0.70711j V`. All four voltage selections in each RLC preset showed distinct visible +/− marks clear of the output badge; inductor-current selection retained its arrow. The resistor-T loading comparison gave matching direct, Z, and Y results (`V₂=0.31579 V`). Series-resistor Preview showed 3000 Ω and about 0.333333 mA under 1 V; Use and Return applied and restored the analyzed circuit. Unapplied 1500 Ω Form text and malformed JSON survived Analyze/Transform navigation and an example change, with an explicit JSON conflict. English and Mongolian at 320 and 390 px had no page overflow or console errors; diagrams scrolled within their containers.

File-picker selection and completed-download events were not repeated for this release. Earlier browser evidence and serialization/parser tests remain distinct; they do not establish completion of those interactions now. Phase 2D2 adds examples and teaching presentation, not new devices, native fields, algorithms, general extraction, or synthesis. This release-status entry is documentation-only and does not change the application package.

## Phase 3A2 browser diode lab task branch — 12 October 2026

The `codex/phase-3a-browser-diode-lab` branch starts from reviewed Phase 3A1 kernel commit `14174ca`; `main` and the public browser remain at the released Phase 2D2 baseline. The browser now routes strict v1 and v2 native documents before analysis. Four validated diode-fixture copies bring the task branch to 26 presets. The form and component inspector edit ordered diode terminals and explicit Shockley-series parameters without UI metadata in JSON. DC panels use the reviewed nonlinear operating-point solver; Frequency and Equations use a bias-fingerprinted v1 tangent, with declared RMS AC increments distinct from DC source values. Unsupported v2 transient, port, and Transform operations give explicit outcomes and retain settings. The diode characteristic uses a monotone terminal-law inversion, a topology-proved external load line where applicable, and an explicit fit-to-bias action; initial signed-axis ranges keep the baseline Q point visible. The antiparallel guide writes KCL with the reversed diode current subtracted at `out`, matching its p→n terminal orientation. The DC source sweep copies the applied document per sample, yields, warm-starts only from a successful point, records failures as gaps, and invalidates stale completions. Finite endpoint interpolation avoids overflow when extreme source bounds have opposite signs. Progress text updates in place so its Cancel control remains operable. A cancelled or obsolete sweep cannot export CSV.

Independent browser-path tests cover strict routing and last-valid preservation, form promotion, the constructed `Rs=10 Ω` 1 mA point, signed reverse current, load-line topology/polarity, the scalar diode–RC tangent response and configured 1 mV RMS AC value, failed and cancelled sweeps, a valid but unsolved v2 document, and explicit v1/v2 analysis boundaries. The clean `npm ci` completed with npm's existing esbuild allow-scripts advisory. Focused Phase 3A2 tests passed **10/10** and the complete suite **153/153**; typecheck, kernel build, site build, `demo:diode`, DOM-free kernel execution, and `git diff --check` passed. The local publishing package contains only `index.html`, `app.js`, and `style.css`; no deployment occurred.

In the actual local browser, all four diode drawings and their suggested panels were inspected, including the baseline `0.51693 V` single-diode bias and `0.54574 V`, `1 mA`, `35.852 Ω` series-resistance result. The single-diode curve visibly showed Q, the external load line, and local tangent after fitting. A model edit changed Q; invalid model text stayed correctable and translated after switching to Mongolian. The Form builder promoted a divider draft to strict v2 by adding D, and its JSON view showed one diode. Malformed JSON in the editor preserved the applied circuit, retranslated with the language switch, and became an explicit conflict after an example change. Actual file-picker selection of malformed JSON produced a translated error without replacing the circuit; selecting a valid v2 file restored its expected bias. A separate valid v2 file with `E=1e20 V` remained applied while its DC panel explicitly reported `line-search`; sweeping `0–1e20 V` showed two failed sample gaps. The antiparallel DC sweep completed with a plotted result, and a new run was cancelled mid-sample with no CSV export. V2 Transform and transient panels showed explicit unavailability. The divider still changed from 8 to 6 V after an R1 edit, RC frequency/transient plots rendered, the resistor-T direct/Z/Y loading values agreed at `0.31579 V`, and series-resistor Preview → Use → Return restored the original. English and Mongolian were checked at desktop, 390 px, and 320 px; the page had no horizontal overflow or console errors. A browser JSON export was attempted, but no completed download event was captured, so download completion remains unverified. Parser/serialization tests and editor round trips do not establish that interaction. Phase 3A2 remains a task-branch implementation pending review, not a public release.

## Phase 3A2 review correction — 12 October 2026

The sweep's asynchronous identity now lives in `web/sweep-lifecycle.ts`. Its one-way active latch retires a run on the same production panel, workspace, document, and visibility transitions used by the UI: type changes, accepted setting edits, collapse, removal, navigation, page hiding, and applied-document replacement. Returning to earlier controls cannot revive a result or its CSV; duplicate panels and language changes keep independent scientific state. Tests reproduce the prior 81-point type-change failure and exercise each transition, replacement by a newer run, and restoration attempts.

The incremental drawing now labels the tangent's `DC=0` source, configured RMS AC increment, `δV`/`δI` observation, and computed `rd`; adjacent provenance states original DC source values and numerical diode Q voltage/current separately. This shared presentation appears in Frequency and Equations, including the table fallback for unmatched topology. DC metrics remain bound to the selected diode ID: removal produces a translated reselection notice without suppressing the valid network result, and v2 documents with no diode remain analyzable. The inspector shows the current diode's signed residual terms and `−gj`, `+gj`, and `1+Rs·gj` Jacobian terms with row/column units, formal ground-reference terms, and coincident-terminal cancellation; selected nonzero entries are highlighted in Equations. A failed/obsolete bias shows no numerical derivative or `rd`. These are browser presentation changes; the reviewed Phase 3A1 kernel and native validators are untouched.

The series characteristic now brackets junction voltage between zero and the signed terminal voltage, then checks reconstructed terminal voltage at the scale of its arithmetic terms. Unresolvable samples remain explicit gaps instead of returning a sign-flipped current. Plot axes normalize finite ranges before subtraction; an unrepresentable geometry gets a translated range outcome rather than nonfinite SVG coordinates. Independent regressions cover the reported `−1e−50 V` sign failure, ordinary forward/reverse reconstruction, extreme `±1e308` plotting, and the original failed-sample gap behavior.

Focused Phase 3A2 tests passed **16/16** and the full suite **159/159**. `npm run typecheck`, `npm run build:site`, `npm run demo:diode`, DOM-free kernel execution, and `git diff --check` passed. In the actual local browser, changing an in-flight antiparallel sweep panel to DC, then restoring Sweep, left no completed result or CSV; collapse/expand and Transform/Analyze navigation likewise retired a run. A valid file import removing selected `Dminus` left its missing selection explicit, showed no substitute `Dplus` metrics, and retained the full DC result. The Dplus inspector displayed signed `F` terms and Jacobian coefficients. The diode–RC Frequency and Equations previews showed original `V1 DC=1 V`, tangent `DC=0 V`, `AC=0.001+0j V RMS`, `Q≈0.516928 V`, and `rd≈53.515854 Ω` separately. English and Mongolian at desktop, 390 px, and 320 px had no page overflow or console errors; wide drawings and tables scrolled locally. This correction did not repeat completed JSON-download capture; the previous unverified limit remains. Main and the public release were not changed or redeployed.

### Phase 3A2 exact-ID rendering follow-up — 12 October 2026

The Equations highlight notice now escapes the complete translated sentence before inserting it into HTML. The selected-diode metric and missing-selection notices use the same order, so native component IDs remain exact data rather than markup in either language. The Equations renderer was moved without changing its calculations so a headless regression calls the production rendering function with a strictly imported diode ID `<b>D</b> & "Q"` and checks the literal text plus the same selected Jacobian coordinates. The focused regression passed **1/1**, the full suite **160/160**, and `npm run typecheck`, `npm run build`, and `git diff --check` passed. In the local browser, the English and Mongolian notices displayed that ID literally, created no `<b>` child element, and retained four highlighted Jacobian cells; the console showed no errors. This is a task-branch presentation correction only, with no kernel, schema, main, or deployed-site change.

## Phase 3A1 and Phase 3A2 public release — 12 October 2026

Fetched `origin/main` was the expected `d743023`, and reviewed `941a2ee` was its descendant with only the five reviewed Phase 3A1/3A2 commits. Both tracked checkouts were clean. In an isolated checkout at `941a2ee`, `npm ci` succeeded with npm's existing esbuild allow-scripts advisory; `npm test` passed **160/160**; `npm run typecheck`, `npm run build`, `npm run build:site`, `npm run demo:diode`, a DOM-free parse/solve/tangent smoke check of `dist/browser.js`, and `git diff --check` passed. `publish/` contained exactly `index.html`, `app.js`, and `style.css`, with relative content-version references. Main fast-forwarded and pushed to `941a2ee` without rewriting history. Its [validation](https://github.com/gantemur/circuits/actions/runs/38277848745) and [Publish browser lab](https://github.com/gantemur/circuits/actions/runs/38277848809) workflows succeeded for that SHA, including the Pages validate, package, and deploy jobs. The public HTML matched the clean package byte for byte, as did its referenced `app.js?v=e8813efdc46f` and `style.css?v=47b77e5097c2`.

On the [live `/circuits/` site](https://gantemur.github.io/circuits/), the divider remained default, all 26 examples were listed, and changing R1 from 1000 to 2000 Ω changed its output from 8 to 6 V. The single-diode operating point showed `0.516928 V` and `0.000483072 A`; the internal-series-resistance example showed `0.545738 V`, `0.001 A`, and `rd=35.852 Ω`. The single-diode characteristic rendered Q and the external load line. The diode–RC frequency magnitude/phase plots and expanded tangent preview separated original `V1 DC=1 V` and Q from incremental `DC=0 V`, `AC=0.001+0j V RMS`, and `δV(out)−δV(0)`. Selecting a diode highlighted four augmented Jacobian entries; a valid exact ID `<b>D</b> & "Q"` applied through the JSON editor appeared literally in both languages without creating a `<b>` element. An antiparallel sweep completed with a plot; a new run could be cancelled with no CSV, and changing type or leaving Analyze permanently retired another active run. Removing selected `Dminus` through valid JSON requested reselection, kept the full circuit result available, and allowed explicit `Dplus` reselection. V2 transient, port, and Transform displayed explicit unavailability.

RC frequency/transient plots still rendered, the resistor-T direct/Z/Y loading values agreed at about `0.31579 V`, and series-resistor Preview → Use → Return restored the original. Malformed JSON remained in the editor across navigation; after an example change it showed a conflict, while an unapplied 1500 Ω Form draft survived the same navigation. Actual file-picker selection of a valid v2 JSON file succeeded, and malformed JSON produced an import error without replacing the analyzed diode circuit. English and Mongolian worked at desktop, 390 px, and 320 px; the document widths were at most 375 px and 305 px at the two narrow viewports, and expanded diode previews stayed within the page. No browser console errors were observed. JSON and CSV export buttons were exercised, but the browser yielded no completed download event for either. Their completion remains unverified; parser/serialization tests and editor round trips do not establish it. This release retains the declared memoryless-diode and numerical-model limits rather than claiming nonlinear transients, a unique sampled branch, or certified physical device accuracy.

## Phase 3A3 headless nonlinear transient task branch — 12 October 2026

The task branch starts at released `326e97e`. It adds a strict v2/experiment-v1 `nonlinearTransient` API for the existing memoryless Shockley-series diode with the linear R/C/L, independent and controlled sources. The existing diode residual/Jacobian and linear storage S/F factors are reused; no v1 API, native schema, numerical tolerance default, diode model, or browser capability routing changes. Prescribed storage uses a joint `[J Φ; S 0]` compatible initialization; an equilibrium request uses the actual frozen left time-source values before the same check. Ordinary intervals use fixed nominal-step backward Euler, shortened at exact source events and final time. Left/right event samples retain external C voltages and L currents; unsupported impulses and numerically unresolved restarts fail with the accepted prefix. No hidden retry or regularization is used. Diode currents and all original branch currents feed A/V residual, ground KCL, signed power, diode decomposition, and J-valued backward-Euler energy diagnostics. The new fixtures remain headless and outside the 26-example browser selector.

Sixteen focused Phase 3A3 tests derive step, series-resistance, rectifier, mixed R–L–C–D and antiparallel responses from independent scalar equations. A separately refined RK4 reference changed by less than 2e−13 V; maximum backward-Euler errors over 0.5 ms were 1.44801, 0.73008 and 0.36644 mV at 10, 5 and 2.5 µs, with halving ratios 1.983 and 1.992. At 10, 5 and 2.5 mV sinusoidal peak amplitudes on the same 5 µs grid, maximum nonlinear-minus-tangent differences were 3.9354, 0.97943 and 0.24430 µV, with ratios 4.018 and 4.009. The zero-Rs series rectifier gave 1.498351396 V at a 2 V peak; a tighter explicit current floor retained −1e−8 V reverse leakage. Three-cycle smoothing followed an independently solved scalar recurrence through both input polarities. Tests also cover no-DC-equilibrium prescribed storage, diode-free RC/RL/RLC parity, differential/reversed capacitor orientation, controlled-source law, exact IDs, ownership, simultaneous/nearby/start/stop events, failed restart, numerical overflow, budgets, and time resolution.

Clean `npm ci` succeeded with the existing esbuild allow-scripts advisory. Focused Phase 3A3 tests passed **16/16** and the full suite **176/176**; `npm run typecheck`, `npm run build`, `npm run build:site`, `npm run demo:diode`, `npm run demo:diode-transient`, DOM-free new-API bundle execution, and `git diff --check` passed. These checks validate the declared model and grid, not global root uniqueness, dynamical stability, device accuracy, adaptive time error, or periodic steady state. Browser file-picker/download interactions are unchanged; the public release's completed-download verification limit remains. Main was not merged or deployed by this task.

### Phase 3A3 numerical review correction — 12 October 2026

The reviewed task-branch implementation `422212a` exposed four independent numerical issues. A binary64 nominal grid could stop a few ulps below an event/final boundary and attempt a spurious interval; the solver now snaps only a representably advanced grid endpoint within a tightly capped multiplication/addition roundoff distance **before** the boundary solve. Fourteen 30–200 µs endpoint/step combinations completed at the exact requested stop with precisely their nominal interval budgets, while two nearby source events retained distinct left/right pairs and the unrepresentable-time failure remained. Per-row merit weights at a zero guess understated coupled diode-law current relative to low-resistance KCL. Fixed per-solve A/V weights now include actual source-implied `Vnom/R`, controlled-source and storage-companion scales. Without storage, the 10 Ω and 1 Ω step cases reached about `0.629146854326 V` in six corrections and `0.684494799161 V` in eight; independent scalar roots are `0.629146854020 V` and `0.684494799161 V`. With a 1 Ω resistor and 1 µF capacitor, the first 10 µs step gave `0.680596607971 V` against an independent `0.680596607959 V` scalar result; a 3 V shifted-return version agreed.

A source-free 1 MΩ/1 µF/diode discharge at 1 ns steps previously failed reconstructed power balance even though its scalar BE root lies between adjacent binary64 voltages. The first accepted corrected sample is `0.19999999979771094 V`; its signed power residual is `+2.6298e−15 W`, above the unchanged physical allowance `8.0916e−16 W` but below a separately reported `1.0658e−13 W` first-order reconstruction-arithmetic allowance. Per-branch voltage/current/power arithmetic parts now flow into ground KCL, global power, and interval energy checks. The allowance includes capacitor history subtraction and branch terminal-voltage subtraction; it is a conservative floating-point diagnostic, not a certified enclosure or a relaxation of physical tolerance defaults. Stricter explicit row tolerances still pass the independent discharge recurrence; an unrepresentable resistor conductance still returns `numeric-range`, and incompatible/failure-budget cases remain failures. A frozen equilibrium failure now retains its original Newton correction trace, with empty storage-rate corrections, original code/cause, and no accepted samples.

Clean `npm ci` completed with the existing esbuild allow-scripts advisory. Focused Phase 3A3 tests passed **22/22** and the complete suite **182/182**; `npm run typecheck`, `npm run build:site`, both diode demos, DOM-free execution of the browser kernel bundle, and `git diff --check` passed. This remains a headless task-branch correction. Main and the public browser were not changed; v2 transient controls remain unavailable there. The existing file-picker/download verification limits are unaffected.

## Phase 3A4 browser nonlinear transient task branch — 12 October 2026

This branch starts from reviewed Phase 3A3 `0e3f010` while `origin/main` remains the released Phase 3A2 `326e97e`. No private book source was available in `.local-reference/`; the public fixtures, conventions, and independent equations supplied the teaching and validation contract. The existing Transient panel now gives strict v2 documents an explicit Run/Cancel path through one dedicated, embedded Web Worker. It owns a document/options snapshot, retires active or completed results permanently on scientific or panel changes, terminates a cancelled worker, and never executes a blocking fallback on the main thread. The maintained worker calls `nonlinearTransient` once; its equations, arithmetic order, tolerances, event handling, and failure classifications are unchanged. A conservative event-aware 3000-interval preflight and the N+m augmented 64-unknown count complement identical kernel budgets. Language and panel ordering are presentation changes and do not restart a valid job.

Four browser copies of the reviewed diode-RC step, biased sine, half-wave rectifier, and smoothed rectifier fixtures bring the task branch to 30 examples. Distinct browser-only component IDs keep their lessons and reset behavior unambiguous without changing native fixture files or schema. Topology-checked SVGs show connected source, resistor, diode orientation, load, and optional capacitor with edited values. Bilingual guides state baseline equations and source/initial conventions. Result plots retain all accepted left/right event samples, display only accepted prefixes after numerical failure, and keep V source overlays off current axes. The collapsed sample tables expose signed physical quantities, separate A/V and W/J allowances, and Newton corrections without replacing DC Q. CSV is enabled only for current completed runs or returned failures with an accepted prefix. Native JSON contains no worker or UI result state.

The ten focused Phase 3A4 regressions passed, including the production worker entry versus direct kernel, independent step/rectifier/smoothing references, no-DC-root prescribed storage, low-resistance and rounded-endpoint worker cases, failure-prefix rendering, resource cleanup, permanent invalidation, missing-reference transitions, exact IDs, and CSV quoting. After clean `npm ci` (with the existing esbuild allow-scripts advisory), the complete suite passed **192/192**. `npm run typecheck`, `npm run build`, `npm run build:site`, `npm run demo:diode`, `npm run demo:diode-transient`, a DOM-free v2 execution of `dist/browser.js`, and `git diff --check` passed. The local `publish/` package was checked to contain only `index.html`, `app.js`, and `style.css`, with matching relative content-version references; byte-identical local sync duplicates of those generated files were removed before this inspection.

In the actual packaged local `/circuits/` browser, all four presets displayed connected finite SVGs and completed Web Worker transient plots. The step event exposed two distinct t=0 sides, continuous 0.2 V capacitor voltage, and about 799.99771 V/s right compatible rate; changing the sample kept its diagnostics open. The smoothed rectifier switched between voltage and diode-current axes, showed the optional voltage-only source reference, and reran after source-amplitude and resistor edits. A 2500-interval run remained visibly running through a Mongolian→English switch, was cancelled without CSV, and then completed with a fresh CSV control. A strict custom document produced an event-stage numerical failure at t=0 with only its accepted left sample and no invented finite-duration plot. Applying a valid JSON document with a removed output required explicit transient reselection; switching that panel to DC removed the obsolete output requirement, and switching back restored it. Malformed JSON remained editable and its error translated on language change. Unapplied Form and JSON drafts survived navigation and reported a conflict after an example change. All four drawings fit desktop, 390 px, and 320 px in both languages; the checked document widths were 375 px and 305 px at the narrow viewports, wide tables scrolled locally, and no console errors were observed. The default divider, linear RC frequency/transient plots, and diode DC/characteristic panels received a brief regression smoke check.

The local in-app browser did not emit a file-chooser event for valid or malformed v2 file selection, nor a completed-download event for native JSON or transient CSV, despite exercising those controls. Those exact file-picker/download interactions remain unverified in this task; parser, editor, and serialization checks do not prove them. The public Phase 3A2 site remains unchanged, and this Phase 3A4 branch is not merged or deployed.

### Phase 3A4 independent acceptance review — 13 October 2026

The reviewed branch remained at `0ab0fce` with a clean tracked tree and `main` at the released Phase 3A2 `326e97e` before corrections. Two reported presentation defects were confirmed: after a shorter rerun, the diagnostic details clamped to the last accepted sample while the dropdown implicitly selected its first option; and typing into a running panel's duration/step field terminated the sole worker but left a second transient panel's Run button disabled. The sample option now uses the same clamped index as its details. Focused input updates only the first panel's result and releases other panels' stale worker-availability controls without replacing that input, so native change/blur still commits it. A further fixture review found the unsmoothed rectifier lesson omitted its diode voltage in the source-resistor equation. English and Mongolian guides now distinguish the intermediate node `a` from `out`; an independent positive-peak check covers resistor current, load current, and diode terminal voltage. The kernel, native schema, tolerances, and numerical ordering were not changed.

After a clean `npm ci`, focused Phase 3A4 tests passed **13/13** and the full suite **195/195**; typecheck, build, site build, both diode demos, DOM-free bundle import, and `git diff --check` passed. Actual packaged-browser checks aligned a selected late sample with its shorter rerun's final option and diagnostics. A separate isolated Chrome DevTools Protocol run proved focused-input worker retirement and immediate availability of a second panel while the input retained focus, plus cancellation without CSV. It completed native JSON and CSV downloads and read their files: exported strict v2 JSON reimported with its source step and observation intact; malformed imported JSON showed a rejection while the circuit remained; success CSV preserved duplicate-time left/right samples, actual times, V units, and interval conventions; an exact observation ID containing a quote and newline was correctly quoted; and a numerical failure exported only its accepted left sample plus a valueless event-failure row. Protocol file selection was real browser input handling through `DOM.setFileInputFiles`; a manual OS file-picker gesture remains unverified. This supersedes the narrower download-verification limit recorded in the initial Phase 3A4 task entry, without changing that historical record.

At desktop, 390 px, and 320 px, the local packaged app retained the four new lessons, their drawings, and completed transient plots in English and Mongolian. The measured 390/320 px document widths were 375/305 px, and the browser console reported no errors. The corrected rectifier equation appeared in both languages. The released v1 RC frequency/transient plots and v2 DC result still rendered; v2 port and Transform retained explicit unsupported messages. No merge or deployment occurred. The public site remains Phase 3A2 pending a separate release decision.

## Phase 3A3/3A4 public release — 13 October 2026

Fetched preflight confirmed clean tracked state, accepted task branch `codex/phase-3a4-diode-transient-lab` at `015765af30d4c3ee07e02281d767d7f934020ddd`, and unchanged `origin/main` at `326e97ee2e63e6ce682a1691d9aac058fa9c1ad6`. The accepted branch's [validation](https://github.com/gantemur/circuits/actions/runs/38422949401) had passed. Main was fast-forwarded normally to the accepted implementation, preserving the reviewed Phase 3A3 and Phase 3A4 history. Its [main validation](https://github.com/gantemur/circuits/actions/runs/38427650973) and [Publish browser lab](https://github.com/gantemur/circuits/actions/runs/38427650950), including validate, package, and deploy jobs, succeeded.

A clean Git-archive snapshot outside the synced checkout passed `npm ci`, all **195/195** tests, typecheck, and the site build (including the kernel and application builds); `git diff --check` passed in the checkout. The only install notice was the existing esbuild allow-scripts advisory; builds completed. The isolated publishing package contained exactly `index.html`, `app.js`, and `style.css`. Public HTML and both referenced relative versioned assets matched byte for byte: JS `44a19810e02c`, CSS `47b77e5097c2`. No ignored or unrelated local files entered the package.

Actual public Chrome checks confirmed 30 examples, the default divider at 8 V and at 6 V after changing R1 from 1000 to 2000 Ω, existing linear RC frequency/transient plots, and single-diode DC at 0.516928 V and 0.000483072 A. All four new nonlinear transient examples completed. The step showed both t=0 event sides at 0.2 V and sample #4 at 20 µs at 0.21576309 V, with physical residual, power, storage, and Newton diagnostics. The smoothed rectifier rendered voltage and diode-current plots with distinct units. Actual worker targets were observed through Chrome's protocol; focused-input retirement released a second panel's Run control, and explicit cancellation exposed no CSV. An imported event-failure case retained only its accepted left sample and reported the event/inconsistent failure rather than inventing a trajectory.

English and Mongolian public layouts were inspected at desktop and 390/320 px. All four new presets completed at both mobile widths in both languages; document client/scroll widths agreed at 375/375 and 305/305 px (desktop 1481/1481). No browser console errors were observed. Native keyboard resistor editing was verified separately from automation's fill operation, which did not commit that inspector change.

Production JSON and CSV downloads completed in isolated Chrome and their actual files were read. Exported strict v2 JSON reimported through the browser file input with its step waveform intact. Malformed JSON was rejected while preserving the selected circuit. CSV retained duplicate-time left/right rows, units and interval conventions, correct quote/newline escaping for an exact observation ID, and a valueless failed-event row after the accepted prefix. Protocol file selection used `DOM.setFileInputFiles`; a human-operated OS file-picker gesture remains unverified. These are public-browser checks, superseding earlier narrower download limits without rewriting those historical records. Numerical convergence still does not certify unique roots, stability, adaptive time error, periodic steady state, or physical diode-model accuracy.

The release follow-up changes only README, AGENTS, and this log to identify Phase 3A4 as published. Its final SHA's validation, deployment, and public asset comparison are required before final handoff; no Phase 3A5 work is started.


## Phase 3B1 headless Ebers–Moll task implementation — 13 October 2026

Starting from released `26d4717d9d0560f30c9f16e41065f149a3521e1e`, branch `codex/phase-3b1-ebers-moll-kernel` implements strict native v3 reciprocal memoryless NPN/PNP DC and local tangent analysis. This entry records task-branch completion pending independent controller audit, not a public release. Main and the published Phase 3A4 browser remain unchanged. The specification is `PHASE_3B1_SPECIFICATION.md`; model, document validation, nodal assembly, DC diagnostics, and tangent calculation have separate readable modules. Q has no auxiliary current unknown or storage stamp. All three terminal currents enter c,b,e; base current is evaluated directly. Temperature changes thermal voltage only, and beta parameterization enforces reciprocity.

The bounded static Newton iteration and physical row checking were extracted into `nonlinear-dc.ts`; the released diode evaluator, stamps, result description, and transient solver retain their algorithms. In cutoff, passing an absolute KCL floor alone can leave tiny source currents insufficiently accurate for signed network power. The BJT caller's final diagnostic callback requests another Newton correction instead of relaxing power/current tolerances. The diode caller does not use that callback. Exact differential comparisons with an isolated clean build of the released baseline matched DC results and traces, diode tangent documents, and short nonlinear-transient results and traces for all eight existing nonlinear fixtures.

The tangent is a headless descriptor `(J+sE) dx=B du`, with output `(C0+s C1) dx+D0 du` so capacitor current keeps its derivative term. All linear devices, controlled sources, external storage, and loading remain. Strict DC/model/topology ownership permits AC-only changes and rejects stale bias; the public v1/v2 browser importer rejects v3 and preserves its current document. Existing two-terminal observations cannot silently name a Q collector current. Exact IDs and coincident terminals are covered without a fictitious two-terminal Q proxy.

After clean `npm ci`, the focused suite passed **23/23** and the full suite **218/218**, including the unchanged **195** released tests. `npm run typecheck`, `npm run build`, `npm run build:app`, `npm run build:site`, `npm run demo:bjt`, both existing diode demos, DOM-free execution of `dist/browser.js`, and `git diff --check` passed. Installation reported zero vulnerabilities and the existing esbuild allow-scripts advisory; builds completed. The production application bundle builds without enabling the BJT API, and the production import-path regression explicitly rejects v3. No application/UI source or previous scientific test expectation changed.

Independent fixtures cover forward/reverse active, zero bias, saturation, cutoff, polarity and terminal exchange, all nine finite-difference derivatives, tied terminals, reference shifts, mixed D/Q circuits, source/load changes, a collector capacitor, every supported linear current observation, strict validation, stale ownership, and numerical failures. At VT=0.025 V, independently prescribed transport currents give saturation `(0.875,0.035,-0.910)` mA and cutoff `(0.125,-0.130,0.005)` pA. The common-emitter reference is approximately `-47.6190476531` V/V (default numerical demo `-47.6190477013`); the ideal-base follower reference is approximately `0.9756097561`. Scalar bracketing and neighboring-DC sensitivity provide checks independent of production Newton and the analytic Jacobian.

Limits remain explicit: no BJT transient, browser support, Early effect, charge storage, intrinsic resistances, or model import. Arithmetic allowances are first-order estimates, not certified error bounds; convergence does not prove uniqueness, stability, or model accuracy. Tangents recheck default physical row tolerances and can reject biases accepted under deliberately looser custom tolerances. Descriptor arrays remain inspectable caller-owned data. Actual browser/file-picker/download interactions were not reverified in this headless task; historical release evidence remains above. No merge or deployment is authorized here. Independent controller review precedes any Phase 3B2 browser work.

## Phase 3B2 browser transistor laboratory — 13 October 2026

Fetched state matched accepted Phase 3B1 `eeb4beeec23208c8e33b06a3fb5e2c7cbb0cbc78` and released main `26d4717d9d0560f30c9f16e41065f149a3521e1e`; the tracked tree was clean. Work is on descending branch `codex/phase-3b2-bjt-browser-lab`. This records implementation pending controller review, not publication. No `src/` kernel file, numerical tolerance, native schema, or worker implementation changed.

Strict browser routing now accepts and exports v3 through the reviewed validator. `web/bjt-analysis.ts` uses the accepted DC/tangent APIs with a document/revision-owned bias, the existing 64-unknown and 241-frequency-sample limits, and a 128-component bound for the new synchronous path. Configured RMS AC and unit-input transfer stay separate; external capacitor-current observations retain their derivative term and failed frequencies remain gaps. Nonlinear tools outside this milestone stop explicitly even when old panel references are missing. V2 diode transient workers remain available.

Five guided presets bring the task branch to 35 examples: NPN common emitter, emitter follower, saturation, cutoff leakage, and the PNP common-emitter mirror. Three exact-topology layouts show connected three-terminal symbols with opposite emitter arrows but the same entering-current convention. Value edits keep a matched drawing; custom topologies and exact-ID changes use the three-terminal topology table. DC and inspector content show voltages, entering currents, transport data, region descriptions, signed power, residual budgets and all nine labeled local derivatives. Equations explains the continuous terminal law, nodal assembly and tangent stages rather than introducing an ideal-switch approximation or a synthetic v1 equivalent.

Q model parameters and shared sources/loads use strict validated edits. Invalid pending text is retained across language switches and other scalar edits. The shared inspector now commits recorded input on focusout as well as change, matching the existing panel-input accessibility behavior; a successful scalar edit removes only its own pending entry. Form construction of v3 is explicitly deferred. Its existing draft is retained, and model-level Apply cannot silently overwrite the v3 circuit. Strict JSON remains available for arbitrary supported v3 circuits. Explicit New can still start and apply a fresh v1 Form draft; the read-only v3 placeholder itself cannot Apply. English/Mongolian lessons distinguish authored baseline references from current numerical answers and explain leakage, nonzero saturation voltage, external frequency dependence and positive-entering terminal currents.

Clean `npm ci`, **13/13** focused browser/model integration tests and **230/230** full tests passed, as did typecheck, kernel/application/site builds, `demo:bjt`, `demo:diode`, `demo:diode-transient`, DOM-free BJT and diode execution of the browser kernel bundle, and `git diff --check`. Existing scientific expectations are unchanged. The two old preset-count assertions now expect 35, and the Phase 3B1 browser-v3-rejection regression was migrated to the Phase 3B2 strict-routing/invalid-import-preservation test. The accepted 22 BJT numerical tests remain. Independent browser-path references cover CE gain −47.6190476531 (computed −47.6190477013 within the existing tolerance), follower .9756097561, saturation (.875,.035,−.910) mA, cutoff (.125,−.130,.005) pA, PNP symmetry, and complex collector-capacitor loading. Additional tests cover observations, ownership, missing-reference transitions, failures, bounded solves, exact-ID escaping and actual symbol/lead endpoint contracts. Installation retained the known esbuild allow-scripts advisory; builds succeeded.

Actual packaged Chrome checks exercised all five examples in English/Mongolian at 1400, 390 and 320 CSS px. All displayed their DC data and frequency plots. Document client/scroll widths agreed at 1385/1385, 375/375 and 305/305; schematic overflow was local, retaining readable labels. Desktop saturation wiring and mobile drawings were visually inspected. Keyboard Enter on Q selected its inspector. Invalid βF text `-` preserved the last valid bias, survived βR=5 and a Mongolian switch, and corrected to βF=120, producing Vc≈1.9150978 V. A CE load edit to 5000 Ω produced Vc≈1.7142857 V. Selecting `ic` displayed A/V transfer and configured 1000 Hz current ≈2.8571e−5 A RMS. A strict contradictory-source document applied successfully and then displayed a translated operating-point failure, not an import rejection.

The actual JSON editor rejected malformed text without replacing the circuit, retranslated the retained error, and applied a valid v3 document whose Q ID was `<em>Q</em> & "B"`; the ID appeared literally with no injected elements and used the table fallback. Unapplied Form/JSON drafts survived BJT/Transform navigation; the JSON conflict and returning Form conflict remained visible, with the original Form label retained. The default divider changed from 8 V to 6 V after R1=2000 Ω; linear RC frequency/transient plots rendered. The existing v2 diode–RC step completed its worker-backed transient with 52 accepted samples including both t=0 sides.

Verification limits: this browser session did not provide a file-chooser event for the import control or a completed-download event for native JSON. Actual file selection, malformed-file import and completed JSON/CSV downloads were not established here; editor, parser and serialization tests do not substitute for those interactions. Three Chrome message-channel errors were captured during tool startup, with no application stack; their origin was not established, and no additional application errors were observed during the exercised interactions. No claim of a completely clean browser console is made. No BJT transient, source sweep, nonlinear port/Transform, Early effect, charge storage or SPICE import was added. Main and the public application remain unchanged; independent controller acceptance precedes publication.

## Phase 3B2 focused acceptance corrections — 13 October 2026

Preflight matched reviewed task tip `5b108a25046cb2ccbbbead231df2520617ce987a`, with a clean tracked tree. Fetched main remained `26d4717d9d0560f30c9f16e41065f149a3521e1e`, an ancestor of this branch. No kernel source, native schema, numerical tolerance, scientific expectation, main history or deployment changed.

Confirmed defects and corrections:

- The Form render guard hid retained edited v1/v2 drafts when their base differed from a v3 document. Clean synchronization now precedes the guard; only the actual unsupported placeholder is hidden. Edited drafts remain visible with the existing conflict and blocked Apply. Explicit New and Discard retain their meanings.
- The selected D inspector requested a v2-only bias even in mixed Q/D documents. It now uses the current full v3 bias for diode voltage, junction voltage, current and local resistance. It does not remove Q or perform a separate physical solve. Mixed diode Jacobian tables are deliberately not presented and the inspector says so; v2 tables remain unchanged.
- Failed Q inspection displayed a diode-specific rd message. It now uses a BJT-specific translated message. The BJT DC table heading identifies both voltage and current unknowns.

After clean `npm ci`, **17/17** focused tests (14 Phase 3B2 and 3 BuilderUI interaction tests) and **232/232** full tests passed. Typecheck, kernel/application/site builds, BJT/diode/diode-transient demos, DOM-free execution of both DC APIs from the browser bundle and `git diff --check` passed. The known esbuild install-script advisory remained; builds succeeded. Added regressions exercise visible exact Form contents/conflicts in both languages and explicit New, plus mixed-device series-law/current/resistance checks with independent scalar bisection, parameter invalidation, rejected edits and failure labels.

Actual packaged-browser evidence, using isolated Chrome with a fresh profile and extensions disabled:

- An edited Form node `kept <draft>` remained visible after applying v3 and navigating Analyze/Transform/Form in English and Mongolian. Its translated conflict blocked Apply. Explicit New exposed a v1 editor; Discard returned to the v3 unsupported state.
- A mixed PNP/base-diode document with exact D ID `<em>D</em> & "Q"` displayed that ID literally without injected elements. The full coupled bias showed terminal voltage `0.45362426 V`, junction voltage `0.45288728 V`, current `0.000073698354 A` and rd `349.22060 Ω`. Series-resistance editing changed the data; invalid Is text survived a Mongolian switch and remained correctable. Automated checks additionally varied Q beta and diode parameters. Failed mixed bias removed the old diode values in both languages; failed Q bias displayed the BJT-specific notice. The v2 single-diode inspector still showed rd approximately `53.516 Ω`.
- All five BJT examples had their suggested DC results and two frequency plot SVGs in both languages at 1400, 390 and 320 px. Client/scroll widths matched; drawings scrolled locally. Desktop source/load wiring and opposite NPN/PNP arrows, and narrow translated tables/labels, were visually inspected. Existing exact-topology/lead/arrow regressions passed. Missing `out` remained explicitly missing; an old `Vin` input required explicit reselection after import. Transient, sweep, characteristic, port/frequency-port and Transform all showed v3 unavailability.
- The v2 step run cancelled, then completed 52 accepted samples. Chrome emitted a worker-target creation event during Run; the worker was retired on completion. Its completed CSV contained t=0 left/right rows and backward-Euler interval conventions. No application runtime exception or console message was captured during these audited interactions.

Completed file operations are now distinct from the earlier serialization-only evidence. Chrome downloads wrote actual files, which were read and parsed. Divider v1 (1178 bytes), single-diode v2 (1235 bytes), and PNP v3 (1895 bytes) JSON reimported through `DOM.setFileInputFiles` with deep equality, preserving Q polarity, c/b/e terminals, model values, observations and source AC/DC data. The edited mixed exact-ID document also downloaded and reimported exactly. Malformed JSON and a v3 document with beta=0 were rejected without altering the applied document. BJT frequency CSV files contained the frequency axis, real/imaginary values, A/V or V/V units and status/message fields. A collector-capacitor case included `-47.61382626099119 + j0.49861082263610224` at 1 Hz. An extreme external capacitor produced valueless `ill-conditioned` rows with the numeric-range message rather than invented values. The existing frequency CSV does not contain ID columns; exact-ID quoting was checked in native JSON, not claimed for absent CSV fields. Human-operated OS-picker interaction remains unverified despite completed protocol file selection.

Startup-error investigation: at approximately 18:19 UTC, fresh Chrome comparisons of `about:blank` and a simple data page emitted no console/error events. Packaged and current published Phase 3A4 pages each emitted a network-category favicon 404, respectively at `/favicon.ico` and the GitHub Pages root favicon path; these are not failures of the three application assets. Neither emitted the previous message-channel errors. Native headless Chrome stderr separately reported macOS display-link/allocator diagnostics, not application JavaScript stacks. The three historical message-channel errors remain unattributed: this investigation does not prove extension or protocol origin, and no code was added to suppress them. Subsequent audited application interactions produced no runtime/console errors. This is narrower than claiming every browser environment is error-free.

Phase 3B2 is ready for the controller's separate publication decision with these recorded limits. No merge, deployment, BJT transient, new model or Phase 3B3 work is included.

## Controlled Phase 3B1/3B2 publication — 13 October 2026

The controller authorized publication of accepted `32f7ae799099090eef6ff55cee13afc02d4bd648`. Preflight fetched that exact task tip and expected main `26d4717d9d0560f30c9f16e41065f149a3521e1e`; the tracked tree was clean and main was its ancestor exactly three commits behind. Those commits are Phase 3B1 `eeb4beeec23208c8e33b06a3fb5e2c7cbb0cbc78`, Phase 3B2 `5b108a25046cb2ccbbbead231df2520617ce987a`, and acceptance fixes `32f7ae799099090eef6ff55cee13afc02d4bd648`. Accepted-branch [validation](https://github.com/gantemur/circuits/actions/runs/38446758404) succeeded before integration. Main fast-forwarded and pushed without rewriting history.

For that exact main SHA, [Validate](https://github.com/gantemur/circuits/actions/runs/38449302014) and [Publish browser lab](https://github.com/gantemur/circuits/actions/runs/38449302027) succeeded; the latter's validation, package and deployment jobs all succeeded. A fresh managed release checkout passed clean `npm ci`, **232/232 tests**, typecheck, kernel/application/site builds and diff check. Its publishing directory contained exactly `index.html`, `app.js`, and `style.css`. The known esbuild script advisory did not prevent builds. No kernel, browser, test or schema code changed during release integration.

The public application at <https://gantemur.github.io/circuits/> matched that clean package byte for byte: HTML 6193 bytes (SHA-256 `cc5e9f461af6716fb3ddab99b7487dae33c23bce7d1b42069a864ad9ba37c0ae`), JS 876297 bytes (`cbe1f47b1024f5338cab80f8d0a879eb0ca0a9030a7526070461017129ccd650`), and CSS 27715 bytes (`748aca54a375e079f03d9bd30389427a611e344e8f51bc8df8478f37ae4090fe`). HTML references the relative `./app.js?v=cbe1f47b1024` and `./style.css?v=748aca54a375` URLs. No favicon or extra asset was added.

Fresh isolated Chrome public-site verification confirmed all **35 examples**, including all five BJT presets in English/Mongolian at desktop, 390 and 320 px. Suggested DC results and frequency plots rendered; page widths stayed within their viewports, with local schematic scrolling. NPN/PNP arrows, terminal wiring, signed c/b/e currents, voltage differences, absorbed power and expanded residual diagnostics were inspected. Downloaded CE transfer was `−47.61904770131583 V/V`, within the reviewed `1e-7` tolerance of independent `−47.6190476531`; follower transfer was `0.9756097560977965`, agreeing with `0.9756097561`. CE bias showed Vc=2 V, Vb≈0.51808165 V, currents approximately (1,0.01,−1.01) mA and absorbed power 0.0020051808 W. Saturation, cutoff and PNP signs remained consistent with the accepted references. Current-output CSV used A/V. An invalid beta draft survived a Mongolian switch without changing exported native bytes; correcting betaF to 120 changed Vc to approximately 1.9150978 V.

The accepted corrections were exercised on production: an unapplied Form node `kept <draft>` remained visible with a translated stale-base conflict on v3 after Analyze/Transform navigation; Apply remained blocked and explicit New worked. A mixed PNP/diode document showed full-network diode data (0.45362426 V terminal, 0.45288728 V junction, 73.698354 µA and 349.22060 Ω), literal markup-looking IDs, valid model updates and correctable invalid diode text. Failed mixed bias removed old values in both languages; Q failure used the BJT-specific diagnostic. Missing output references stayed explicit. V3 transient, characteristic/source sweep, port/frequency-port and Transform reported unavailability.

Representative previous behavior remained operational: divider R1 editing produced 6 V, linear RC and diode-RC frequency plots rendered, single-diode DC/inspection remained available, and a v2 step worker run cancelled then completed 52 samples on rerun. Chrome emitted a worker creation event. The completed transient CSV retained left/right event rows and interval conventions.

Public-browser file checks completed, and the downloaded bytes were read: v1 divider, v2 diode and v3 PNP JSON round-tripped via protocol file selection with deep equality. V3 data preserved polarity, exact c/b/e terminals, model parameters, observations and source AC/DC values; a mixed exact-ID document also round-tripped. Malformed JSON and invalid v3 beta were rejected without changing the applied document. Completed BJT CSV downloads contained frequency, complex real/imaginary values, units and statuses. The collector-capacitor case yielded approximately `−47.61382626+j0.498610823` V/V at 1 Hz; an extreme capacitor yielded valueless `ill-conditioned` rows with a numeric-range explanation. Native JSON preserved quote/newline-containing IDs; the existing frequency CSV has no ID columns.

Limits: protocol `DOM.setFileInputFiles` establishes actual file import, not a human-operated OS-picker gesture. No application runtime exceptions or message-channel errors occurred in the public checks; Chrome logged the existing GitHub-root favicon 404. Native headless display-link/allocator stderr is separate from application JavaScript. The historical message-channel origin remains unproven. BJT transient, charge/parasitics, general v3 Form construction and nonlinear transformations remain outside the released scope.

This record's follow-up changes only README, AGENTS and this log to identify the verified release. Its final main SHA must pass validation and Pages publication and have its clean-build public assets rechecked before final handoff. Earlier task-branch evidence remains historical; no Phase 3B3 work is authorized.

## Phase 5A1 — headless exact RC Cauer kernel (13 October 2026)

Authorized scope: implement the accepted Cauer-at-infinity design on `codex/phase-5a1-exact-rc-cauer-kernel`, starting from released main `30c2857a2862039797730eb1c6bbeb2421a1e02e`. The Phase 5A1 specification was written before substantive implementation. This is task-branch work, not a publication. Existing solvers, native schemas, nonlinear models, browser sources and the 232 baseline tests are unchanged. No Foster synthesis, interface, merge or deployment is included.

Five small modules separate bounded BigInt fractions, exact rational polynomials, constructive extraction, native ladder generation and independent physical experiments. Strict synthesis requests use rational strings and positive resistance/angular-frequency scales. Exact GCD cancellation precedes extraction; no roots or numerical pole merging are used. The finite RC Stieltjes/Cauer sign and degree conditions reject non-RC targets, while explicit resource failures remain inconclusive. Reverse reconstruction verifies an exact polynomial identity. Trace entries retain the domain, before/remainder, coefficient, positivity, degree change and eventual component ID. Zero impedance/admittance are explicit short/open outcomes without fictitious elements.

Exact, native and numerical results remain separate. Native construction follows the actual series path and ground shunts, checks the graph and finite stamps, stores zero capacitor initial values, and round-trips strict source-free v1 JSON. Rational-to-binary64 rounding uses quotient/remainder at a binary quantum, avoiding separate conversion of huge numerator/denominator integers; exact discrepancies are recorded. Default bounds are raw degree 16, reduced degree 8, 1024 characters per input string, 32768 aggregate characters, exponent magnitude 2048, integer 8192 bits and 1000000 charged operations, including Euclid/GCD. The initially considered 200000-operation bound allowed degree-eight certification but exhausted during exact complex reference evaluation; the final bounded one-million default passes a 17-element unity ladder through every check. Callers can lower bounds. Intermediate bit guards are conservative and may decline a reducible oversized product.

The independent checker injects q→p current and clamps p→q voltage through existing MNA, comparing both Z/Rref and Y*Rref at five imaginary and two right-half-plane normalized frequencies. It evaluates the original polynomial target rationally at the actual numerical s, rather than reusing the continued fraction. RMS-only signed power uses resistor dissipation and negative capacitive reactive power; off-axis checks have no RMS interpretation. The response threshold remains `1e-9+1e-8*max(magnitudes)`; power uses the declared `(1 V)^2/Rref` scale. Existing solver A/V residual tolerances are unchanged.

Actual acceptance: `(z²+4z+3)/(z²+2z)` yields R=1,C=1/2,R=4,C=1/6, DC pole coefficient 3/2 and high-frequency limit 1. At Rref=1000 Ω and omegaRef=1000 rad/s, MNA gives `1200−1600i Ω` and approximately `0.0003+0.0004i S` at s=i1000. The independent positive-real-s experiment gives F(1)=8/3. The irrational-pole target `(z²+4z+3)/(z²+3z+1)` yields five unity elements. All seven physical sample pairs and ten RMS power comparisons pass for the ordinary acceptance fixtures and the degree-eight unity ladder.

Thirty new regressions cover exact parsing/arithmetic/rounding, elementary terminations and omitted initial R, native topology/orientation/initial values, multiple SI scales, reciprocal admittance input, irrational poles, genuine repeated/RHP/complex poles and other non-RC targets, short/open boundaries, exact and near factors, poles 1e-12 apart, strict input and staged resource failures, extreme native conversion and verification limits, and an intentionally wrong physical realization. The near-cancellation target `1+10^-12/(z+1)` remains exactly certified with a generated ladder but reports numerical verification unresolved: the unchanged full-state solver fails a physical KCL residual. This is a recorded numerical limitation, not a mathematical rejection. Algebraic DC/infinity limits do not claim a full-state DC solve or a general topology contraction.

Completed local validation: clean `npm ci`; focused `node --test test/rc-synthesis.test.mjs` (30/30); `npm test` (262/262, including all 232 baseline tests); `npm run typecheck`; kernel build, application build and `npm run build:site`; `npm run demo:diode`, `npm run demo:diode-transient`, `npm run demo:bjt`, and `npm run demo:rc-synthesis`; DOM-free ESM bundle smoke in an empty VM context (new synthesis plus existing divider DC, no imports/window/document/process); and `git diff --check`. Clean installation printed npm's existing esbuild script-approval warning; the installed tool built all bundles successfully.

An isolated archive of the released baseline was built with the same committed dependency versions. Its three publishing files compare byte-for-byte equal with this task's application package: app.js SHA256 `cbe1f47b1024f5338cab80f8d0a879eb0ca0a9030a7526070461017129ccd650`, index.html `cc5e9f461af6716fb3ddab99b7487dae33c23bce7d1b42069a864ad9ba37c0ae`, style.css `748aca54a375e079f03d9bd30389427a611e344e8f51bc8df8478f37ae4090fe`. A pure-initialization annotation permits the unused headless limits table to be tree-shaken. This is build evidence, not a new browser or public-deployment check. No browser/file-picker/download interactions were changed or reverified. The published Phase 3B2 release and its historical evidence remain unchanged; Foster is deferred pending independent review of this kernel.

## Phase 5A2 — exact RC Foster I and II (13 October 2026)

The controller accepted Phase 5A1 `ac6b6d29f40dd23d208565b09e49627f67cf8a50`; this task branches from it as `codex/phase-5a2-exact-rc-foster-kernel`. The working tree was clean, fetched origin confirmed the accepted branch, and main remains `30c2857a2862039797730eb1c6bbeb2421a1e02e`. The Phase 5A2 specification was written before substantive coding. This is a headless task-branch implementation, not a release or browser milestone.

`synthesizeRcFoster` distinguishes impedance Foster I residues from admittance Foster II branch coefficients through separate strict request forms. Exact rational endpoints, rates and coefficients use the accepted parser. Positive duplicate-rate terms combine exactly with source-index evidence; ordering uses exact subtraction and nearly equal rates remain distinct. Unknown/malformed input, invalid signs or target mismatch, unavailable polynomial-only decomposition, and resource exhaustion have distinct outcomes. Negative individual finite terms are rejected even when duplicates could cancel them; only zero endpoint terms may be omitted. General factorization and algebraic-number poles remain unsupported, without implying that a polynomial-only target is nonrealizable.

The certificate independently reconstructs each physical section law: parallel RC impedance `r/(1+zrc)` for Foster I, series RC admittance `zc/(1+zrc)` for Foster II. It checks equality against the supplied decomposition and, when present, an independent polynomial target, then records canonical terms, combinations, normalized elements, per-section contributions/cumulative identities, exact request-domain and impedance limits. Foster II's ordinary partial-fraction residue `-a*p` can be negative while its physical branch coefficient a is positive; no impedance-residue rule is imposed on G.

The new Foster generator has two explicit graphs: a series chain of sections with shared-terminal parallel pairs, or parallel branches with separate internal nodes for series pairs. Component IDs are allocated across node/component/observation namespaces. The accepted SI conversion and graph/strict-native-document checks were extracted into shared helpers without changing their arithmetic order, tolerance or resource charging. Exact arithmetic, Cauer extraction, physical verification, numerical solvers, schemas and all 262 existing test expectations are unchanged. Generated documents are source-free v1 with zero capacitor storage values; traces stay outside the native schema.

For F=(z²+4z+3)/(z²+2z), exact Foster I is `1+3/(2z)+1/[2(z+2)]`: series R=1, C=2/3, then parallel R=1/4 and C=2. Foster II is `G=(1/2)z/(z+1)+(1/2)z/(z+3)`: two parallel series branches R=2/C=1/2 and R=2/C=1/6. The accepted Cauer realization remains R=1,C=1/2,R=4,C=1/6. All three have four components but distinct topology/value records. Independently assembled circuits reproduce F(i)=6/5−8i/5 under four reference-scale choices. At 1000 ohms and 1000 rad/s, Foster I measures approximately `1200.0000000000005−1599.9999999999998i Ω`; Foster II measures `1200−1599.9999999999998i Ω`, both with approximately `0.0003+0.0004i S`. Seven independent Z/Y sample pairs and ten RMS-only signed-power comparisons pass per ordinary fixture. Degree-eight, eight-rate/16-device Foster I and II examples also pass under unchanged ceilings.

Twenty-nine new regressions cover section topology and sign conventions, elementary and endpoint cases, duplicate/near rates, strict requests and polynomial-only irrational-pole unavailability, exact target mismatch and GCD cancellation, boundaries, collision-safe IDs and exact unusual IDs through temporary-source verification, native range failures, operation-budget failures at reconstruction/identity/conversion/verification stages, input ownership and conversion discrepancy, an intentionally miswired circuit, and MNA failure with retained certification. The first scale test exposed the expected binary64 rad/s→Hz→rad/s round trip (13 becomes 12.999999999999998); the assertion now checks the actual public API coordinate rather than demanding an impossible bitwise identity. No response or residual tolerance changed.

Actual validation passed: clean `npm ci`; focused Foster tests 29/29 and unchanged Cauer tests 30/30; full `npm test` 291/291; typecheck; kernel/app/site builds; diode, diode-transient, BJT, Cauer and Foster demos; DOM-free bundle evaluation for both new methods with no imports or window/document/process globals; and `git diff --check`. npm repeated its existing esbuild install-script approval warning; all builds succeeded. Resource ceilings remain raw degree/term count 16, reduced degree 8, input 1024 characters/string and 32768 aggregate, exponent magnitude 2048, integers 8192 bits and 1000000 charged operations; overrides only lower them. Exact certification survives later range or budget failures. As before, `1+10^-12/(z+1)` has an exact positive realization but fails the unchanged full-state MNA KCL tolerance at a prescribed sample; it is reported numerically unresolved.

The ignored local publish directory contained duplicate sync files (`app 2.js`, `index 2.html`, `style 2.css`); these were left untouched after discovery and were not used as the publishing-package evidence. Isolated accepted-baseline and candidate builds contain only app.js, index.html and style.css and match byte for byte. SHA256: app.js `cbe1f47b1024f5338cab80f8d0a879eb0ca0a9030a7526070461017129ccd650`; index.html `cc5e9f461af6716fb3ddab99b7487dae33c23bce7d1b42069a864ad9ba37c0ae`; style.css `748aca54a375e079f03d9bd30389427a611e344e8f51bc8df8478f37ae4090fe`. Browser/file-picker/download interactions were not changed or reverified. No merge, deployment, root finder, synthesis optimizer or browser workspace is included. Independent controller review is the next step.

## 2026-10-13 — Phase 5A3 browser RC synthesis laboratory (task branch, not published)

Started from controller-accepted Phase 5A2 `59b4df7bdfee6f0331ba05823286e719f3314b38` on `codex/phase-5a3-rc-synthesis-browser`. Main remains the published Phase 3B2 `30c2857a2862039797730eb1c6bbeb2421a1e02e`. The Phase 5A3 specification was written before substantial implementation. No source under `src/`, native schema, scientific tolerance, fixture, or existing scientific test expectation changed.

The third workspace keeps exact target/decomposition text, selected methods, snapshots and results separate from the applied document. Its worker-only adapter invokes accepted Cauer/Foster kernels; the main-thread renderer does not import it. A single embedded Blob worker computes selected methods sequentially. Owned tokens, permanent retirement and method-scoped signatures prevent stale replies or restored text from reviving old exports. Cancel, scientific edits, workspace departure and page hiding terminate the worker and release its URL. Language/layout changes only render stored evidence. The existing nonlinear worker uses a separately anchored build-module filter so the two embedded sources cannot shadow one another.

The adapter exchanges exact coefficient arrays for the appropriate Foster domain, validates the original denominator before reciprocal construction, and sends zero primary functions through accepted boundary validation. It always includes the independent exact target when invoking Foster. Unavailable decomposition remains distinct from invalid identity, non-RC rejection, resource exhaustion, native conversion failure, physical verification failure and worker failure. No root finder or additional synthesis mathematics was introduced.

Each result displays three evidence layers, exact reconstruction, normalized impedance endpoint limits, normalized/SI values, rounding disclosures, construction steps, actual native topology, measured Z/Y differences/limits, and signed RMS-power checks. Six-component bounded generator layouts use actual edges; larger or unsupported Cauer arrangements fall back to the full topology table. Node labels were offset from vertical leads after browser inspection. Drawings and wide tables scroll locally while cards stack on narrow screens. Exact kernel field names/technical diagnostics remain in explicitly labeled English disclosures; all controls, summaries and teaching explanations are bilingual.

Apply requires a current certified/generated/numerically passed result. Certified but numerically unresolved circuits retain warned JSON inspection but cannot Apply. Stale results cannot export. Adoption uses the existing strict document-change path, requires confirmation for unapplied Form/JSON drafts, and preserves those drafts with conflicts. An explicit subsequent action adds a `(port,0)` port-frequency panel at the verified reference frequency, or explicitly replaces the user's chosen panel at the three-panel limit. Other panel settings stay intact. No guarded Return operation is added in this phase.

### Automated evidence

All **318 tests pass**, including the unchanged 291-test baseline and **27 new browser-path regressions**. These exercise the production adapter, exact primary-admittance reciprocals, zero/invalid denominators, missing/incorrect decompositions, supplementary targets, common factors, non-RC and repeated poles, near distinct poles, resource/range failures, owned snapshots, cancellation/late replies/restart, method-scoped invalidation, worker failure, strict Apply/conflicts/handoff, source-free native JSON/CSV, bilingual escaping, symbol/lead and bus connectivity, off-wire labels, focused-control preservation through the production input handler, and the exact packaged worker source executed in a separate test thread.

Independent principal references are F(j)=6/5−8j/5 and G(j)=3/10+4j/10. At Rref=1000 Ω and omegaRef=1000 rad/s all three native topologies give Z=1200−1600j Ω and Y=0.0003+0.0004j S. Each has seven Z/Y sample pairs and ten RMS signed-power checks. Elementary references include pure R: Z=2000 Ω, pure C: Z=−3000j Ω, finite-DC RC: Z=1500−500j Ω, and irrational-pole Cauer: Z=4000/3−(2000/3)j Ω at the reference frequency. The accepted near-cancellation `1+10^-12/(z+1)` remains mathematically certified but numerically unresolved under the unchanged MNA KCL check; Apply is blocked.

Actual commands passed: clean `npm ci`, focused `node --test test/synthesis-browser.test.mjs`, full `npm test`, `npm run typecheck`, kernel/app/site builds, all six numerical demos (`demo`, `demo:diode`, `demo:diode-transient`, `demo:bjt`, `demo:rc-synthesis`, `demo:foster`), DOM-free ES-module Cauer/Foster smoke in a context without window/document/process or imports, and `git diff --check`. npm repeated the existing esbuild allow-scripts warning; installation and builds succeeded.

An isolated candidate source copy was freshly installed and built for publishing-package validation. The ignored local publish directory, including old duplicate sync files, was preserved and not used as package evidence. The isolated package has exactly `index.html`, `app.js`, `style.css`, and relative URLs whose 12-hex versions match asset content. SHA256:

- `app.js`: `7d8ebd0850569477112c999ec33b4e71b6a6ed71eae7621d7c29ac2901611c56`
- `index.html`: `03064a3c745b50842fb09856322ff953199a8325a45b48d64bcddcd8cb7c64c1`
- `style.css`: `7e837db231cfd897d065d2380462d1cb6be21783cd8086500c7c598b1e016615`

### Actual browser evidence and limits

Chrome loaded the built app and then the isolated three-file package on local `/circuits/` URLs. Verified the principal three methods, distinct circuits and normalized/SI values, matching Z/Y rows, readable extraction steps, finite geometry and local horizontal drawing scroll to the return sections. EN/MN render on desktop and 390/320 px; measured document widths were no greater than the viewport (375 at 390 px, 305 at 320 px, with scrollbar space). The normal checks and a final fresh-tab run had no captured console warnings/errors. One automated reload in the earlier tab logged the browser message-channel error “A listener indicated an asynchronous response … but the message channel closed”; a navigation retry and fresh-tab synthesis both succeeded. No application stack or scientific failure accompanied it. Input `3, 4/` retained focus and exact text, disabled stale Apply actions, produced invalid-input evidence, and survived language switching. A degree-16 bounded request allowed actual Cancel before completion; a second run was invalidated by a scale edit, followed by a fresh successful principal run. Tiny examples finished too quickly for the initial Cancel attempt, so they were not misreported as cancellation tests.

Adopted Cauer and measured 1200−1600j Ω through the added source-free one-port frequency panel. Created an unapplied Form node edit and malformed JSON draft, adopted Foster I after explicit confirmation, and observed both drafts intact with their existing stale-base warnings. Existing panels were preserved, and the three-panel replacement selector appeared only after explicit adoption. Existing v1 RC magnitude/phase/transient plots remained functional; v3 common-emitter DC showed V(c)=2 V and iC=1 mA with its frequency plots; v2 diode–RC step retained its 0.516928 V DC bias and completed its existing nonlinear-transient worker run with plot, event and diagnostics disclosures.

Native JSON and sample CSV export buttons were clicked, but the browser tool did not capture a completed download event, so download completion is unverified. The malformed-file chooser opened, but `setFiles` was blocked because the Chrome extension lacks “Allow access to file URLs.” That permission was not changed. Consequently actual valid/malformed file selection, File.text parsing, and downloaded-file reimport were not verified here; strict parser/serialization tests do not stand in for those interactions. Manual check: download JSON/CSV and inspect the saved files; import malformed JSON and confirm a translated error preserves the applied circuit; import a saved generated v1 document and confirm its source-free topology and port response.

Scientific scope remains exactly the accepted RC methods and resource ceilings. Foster needs supplied exact decomposition; no irrational pole inference, LC/RL/general RLC work, optimizer, native synthesis metadata, merge or deployment. Independent controller review is next.


## 2026-10-13 — Phase 5A3 focused acceptance corrections (task branch only)

Preflight: clean tracked tree on `codex/phase-5a3-rc-synthesis-browser` at reviewed `956b8a6c387873612d32cd7f47b6ee0f4d51d578`; fetched branch matched, and local/remote main remained `30c2857a2862039797730eb1c6bbeb2421a1e02e`, an ancestor. Reviewed [Validate run 38472552565](https://github.com/gantemur/circuits/actions/runs/38472552565) succeeded. No merge or publication is part of this pass.

### Reproduced defects and bounded corrections

An isolated clean build of the reviewed revision reproduced both issues in Chrome. With a malformed unapplied JSON draft, obtaining Cauer adoption confirmation and then selecting RC left the old confirmation usable; accepting it replaced RC. Separately, invalid resistor inspector text was silently lost on adoption. The corrected production UI binds confirmation to the applied document reference/revision/native snapshot, synthesis token and method, retires it on render, and rechecks it at the adoption model boundary. Change-and-restore cannot revive authorization. Pending inspector/source text blocks both initial Apply and confirmation with a translated explanation; correcting the field permits adoption. No general editor redesign or numerical changes were made.

Form and JSON drafts retain their existing independent ownership/conflicts. In the browser an unapplied `pending-node` Form edit and `{keep-json` JSON draft survived adoption. An explicit replacement at the three-panel limit retained all panel IDs and the two untouched panels, while the selected panel became a source-free `(port,0)` frequency experiment showing 1200−1600j Ω. Explicit New still opens the builder. The original automatic guard behavior, strict parser and native formats remain intact.

CSV exports now include all three evidence statuses, overall reason, method, RMS/right-half-plane kind, physical complex Z/Y, normalized discrepancy/limit and comparison flags. Each sample carries the overall outcome, including unresolved or mismatch. Zero accepted samples produce a metadata-only row with blank measurement fields; no synthetic measurements are introduced. English headers and quoted comma/quote/newline fields are language independent. Tests include a real wrong-topology physical mismatch and the actual near-cancellation unresolved result; a separately identified formatter fixture represents two accepted samples followed by an unresolved stop.

Cancellation policy is per method: a completed current result remains eligible after cancelling later methods; unfinished results and their late replies are permanently retired. EN/MN cancellation copy and the specification now state this explicitly. Scientific edits still invalidate applicable completed results and terminate the active batch. Restoring identical text does not revive them.

### Automated validation

Clean source snapshots were created with `git archive` and the focused source/test overlay, excluding all ignored workspace contents. Candidate commands passed: `npm ci`; focused `node --test test/synthesis-acceptance.test.mjs test/synthesis-browser.test.mjs` (**36/36**); full `npm test` (**327/327**, unchanged original 318 plus nine new tests); `npm run typecheck`; kernel/application/site builds; all six numerical demos (`demo`, `demo:diode`, `demo:diode-transient`, `demo:bjt`, `demo:rc-synthesis`, `demo:foster`); and `git diff --check`. The esbuild allow-scripts notice remained nonblocking. A separate ES-module VM loaded the browser kernel with no imports, window, document or process and passed Cauer/Foster I/Foster II certification and physical verification. No `src/`, fixture, dependency, lockfile or existing test expectation changed.

The clean package contains exactly `index.html`, `app.js`, `style.css`. Both referenced URLs are relative and their 12-hex versions match content. SHA256:

- `app.js`: `497ab6c54bf4ddf40395d786bfca0b01e243fd11b439c71ec62ca01fbe34d4b8`
- `index.html`: `48df09939558408f8d5d39d6921864c34ed23f55b3f87cbe0c737ab450717802`
- `style.css`: `7e837db231cfd897d065d2380462d1cb6be21783cd8086500c7c598b1e016615`

The ignored repository publish directory and unrelated files were preserved; no duplicate sync files were used as evidence.

### Actual isolated Chrome protocol evidence

A fresh headless Chrome profile with extensions disabled loaded the clean package under local `/circuits/`. CDP recorded dedicated Blob worker targets for synthesis and the existing nonlinear transient. Protocol-driven DOM interactions exercised production handlers; no application computation or Worker implementation was replaced.

- All three principal methods completed with distinct drawings and exact native topology tables. Their completed JSON/CSV downloads were observed through `Browser.downloadProgress` and read from disk. Strictly parsed downloaded circuits matched the independent constructions: Cauer series 1 kΩ, shunt 0.5 µF, series 4 kΩ, shunt 1/6 µF; Foster I series 1 kΩ and 2/3 µF followed by parallel 250 Ω and 2 µF; Foster II parallel branches of 2 kΩ + 0.5 µF and 2 kΩ + 1/6 µF. Every element was positive, sources were empty, and capacitor initial values were zero.
- `DOM.setFileInputFiles` selected those actual downloaded files. Re-exported applied JSON matched each downloaded document exactly. Independent physical port analysis of those bytes gave Z=1200−1600j Ω (absolute discrepancy below 1e-7 Ω) and Y=0.0003+0.0004j S (below 1e-12 S) at s=j1000. Each downloaded CSV contained seven actual samples, both experiment kinds, passed status and comparison flags/limits.
- Malformed JSON and invalid native JSON passed through the real file input and asynchronous read path, produced rejection notices and preserved the applied circuit byte-for-byte on re-export. The certified `1+10^-12/(z+1)` Foster I inspection JSON also downloaded and reimported. Its synthesis Apply remained disabled; its CSV correctly contained only unresolved metadata, with the existing KCL failure reason and no invented measurement.
- Actual cancellation immediately after the first method rendered retained that Cauer result and its enabled Apply/export while retiring the unfinished batch. The test observed the first rendered reply and clicked the production Cancel control. An expensive degree-16 request was cancelled; a separate request was scientifically edited and restored before reply, with no results revived. Principal reruns succeeded. Irrational-pole Cauer certified; missing Foster decomposition and incorrect supplied decomposition displayed different outcomes.
- Pending exact text `3, 4/` survived EN→MN switching and invalidated previous actions. Tab navigation moved focus from numerator to denominator. Desktop 1280 px and narrow 390/320 px checks in both languages showed no page overflow or nonfinite SVG geometry; wide diagrams/tables scrolled inside their containers. Diagrams and topology tables were visually inspected, including Foster return branches via local scrolling.
- Existing v1 RC magnitude/phase/transient plots rendered; v3 common-emitter DC retained V(c)=2 V and iC=1 mA with frequency plots. The v2 diode–RC step completed its nonlinear transient Worker, rendered its time plot and retained the 0.516928 V DC bias. Pending invalid resistor text was guarded in both languages; invalid source text was guarded and remained correctable.

The earlier file-operation limitation is superseded for the synthesis JSON/CSV downloads and protocol imports just listed. This does **not** establish manual use of a native OS picker, every browser/profile, or unrelated export formats. Rapid initial scripted downloads encountered Chrome throttling; pacing explicit download clicks completed all recorded downloads. No browser extension permission was changed.

### Reload diagnostics and disposition

The isolated profile performed three reloads each of a plain comparison page, the reviewed packaged app and the corrected packaged app. Captured `Runtime.exceptionThrown` and warning/error `Log.entryAdded` events were empty for all nine reloads. Completed acceptance runs likewise captured no application warnings/errors or missing assets. The earlier asynchronous message-channel error was not reproduced, so there is no current category/source/stack to attribute and no basis for claiming an application or extension cause. No messages were suppressed and no application error workaround was added. Harness selector mistakes during setup were corrected and rerun; they are not application exceptions.

Phase 5A3 is ready for a **separate publication decision**, subject to controller acceptance. The accepted mathematical resource ceilings and unresolved near-cancellation outcome remain limitations, not silently altered tolerances. No LC/RL synthesis, root finding, optimization, new phase, merge or deployment was performed.


## 2026-10-13 — Controlled publication of Phases 5A1–5A3

The controller approved `55ba7cb77a88153fff706f18a62d3625848ca73b` on `codex/phase-5a3-rc-synthesis-browser`. Fetched main was exactly `30c2857a2862039797730eb1c6bbeb2421a1e02e`, with a clean tracked tree and **0 left / 4 right** divergence. The four preserved implementation commits are `ac6b6d2` (Cauer), `59b4df7` (Foster), `956b8a6` (browser workspace), and `55ba7cb` (focused acceptance corrections). Main fast-forwarded to the accepted SHA and was pushed normally. Ignored local files, including synchronization duplicates, were preserved. No implementation, mathematical tolerance, native schema, resource ceiling or browser behavior changed during release.

Initial main [Validate 38478009065](https://github.com/gantemur/circuits/actions/runs/38478009065) and [Publish browser lab 38478009066](https://github.com/gantemur/circuits/actions/runs/38478009066) succeeded for the exact accepted SHA. Pages `validate / check`, `package` and `deploy` jobs all succeeded. The public site is https://gantemur.github.io/circuits/.

### Clean source validation and package

A fresh `git archive` source snapshot was installed with `npm ci`. All **327 tests**, typecheck, kernel/application/site builds and all six numerical demos passed. The separate DOM-free ES-module kernel smoke passed Cauer and both Foster certificates/physical checks without window, document, process or imports. `git diff --check` passed. The existing esbuild allow-scripts notice was nonblocking. No ignored publish directory was used.

The clean publishing package contains exactly `index.html`, `app.js`, `style.css`; relative HTML asset references contain matching 12-hex content hashes. Public HTML and both referenced assets compared byte for byte with this package:

- `index.html`: `48df09939558408f8d5d39d6921864c34ed23f55b3f87cbe0c737ab450717802`
- `app.js`: `497ab6c54bf4ddf40395d786bfca0b01e243fd11b439c71ec62ca01fbe34d4b8`
- `style.css`: `7e837db231cfd897d065d2380462d1cb6be21783cd8086500c7c598b1e016615`

### Actual public Chrome acceptance

A fresh isolated headless Chrome profile, with extensions disabled, exercised the production HTTPS site through CDP. These checks were against the deployed app, not the local package:

- Cauer and Foster I/II produced the independently prescribed, distinct topologies and positive SI elements. Exact certificates, normalized/SI values, endpoint limits, expanded extraction steps, connected drawings, topology tables and separate physical evidence rendered. All three gave Z=1200−1600j Ω and Y=0.0003+0.0004j S at s=j1000. After actual downloaded-file import, each was measured again in the public Analyze panel with ordered `(port,0)` terminals and 1000/(2π) Hz. Independent downloaded-document checks used absolute comparison bounds 1e-7 Ω and 1e-12 S, not bitwise floating-point equality.
- Irrational-pole Cauer succeeded. Missing decomposition, invalid supplied decomposition, non-RC target `(1+z)/(2+z)`, a 1025-digit exact-input resource failure, and certified but numerically unresolved `1+10^-12/(z+1)` remained distinct. Unresolved inspection JSON exported, but synthesis Apply stayed disabled.
- Dedicated Blob Worker creation/completion was observed. Cancelling immediately after the first rendered method kept that completed current result usable and retired unfinished methods. An expensive degree-16 request was cancelled; editing and restoring inputs before reply did not revive stale results. Fresh runs succeeded. The existing diode transient used its separate worker successfully from the same three-file publication.
- Preview alone left the shared native document unchanged. Changing the applied document and then restoring its contents did not revive the old confirmation. Invalid inspector text was preserved and blocked adoption in EN/MN; invalid source text likewise remained correctable. Independent unapplied Form/JSON drafts survived confirmation and retained conflicts. Explicit adoption/handoff used `(port,0)` and the verified reference frequency. At three panels, only the selected panel was replaced; the other panel IDs/settings stayed intact.
- Actual completed JSON and CSV downloads for all three methods were observed and their bytes read. CDP file-input selection reimported those saved native documents; re-export matched exact topology/parameters, empty sources and zero capacitor initial values. Each successful CSV carried seven samples, RMS/right-half-plane kinds, three evidence statuses, complex Z/Y, normalized differences/limits and pass flags. Unresolved CSV carried its real KCL reason and no invented measurements. Malformed and invalid-native files produced translated rejection messages and preserved the applied document.
- All **35 examples** remained available. Default divider editing gave V(out)=6 V after R1 became 2 kΩ. RC frequency/transient plots worked; DC original/Thévenin/Norton load comparisons agreed; the T-network two-port direct/Z/Y loading predictions agreed. Resistor series Preview → Use → Return worked. BJT common-emitter DC retained V(c)=2 V and iC=1 mA with frequency plots. Diode–RC step completed its transient worker and retained its 0.516928 V DC bias.
- EN/MN desktop 1280 px, 390 px and 320 px checks passed navigation, pending-text preservation, keyboard Tab focus, finite SVG geometry and page-width bounds. Wide diagrams/tables scrolled locally, including their return branches. Three public reloads produced no runtime or message-channel exception.

### Limits and documentation follow-up

One initial asset comparison request returned HTTP 503; retry succeeded and all three required assets subsequently matched. Chrome's first page load also requested the site-root `/favicon.ico`, which returned HTTP 404 and a network-category console entry. It is outside the three-file application package; no required app asset was missing. No application runtime exception or asynchronous message-channel error was captured in completed public acceptance. Neither response was suppressed or treated as a reason for an unrelated code repair.

Completed protocol file selection/downloads do not establish manual operation of a native OS picker or every browser/profile. Exact arithmetic resource bounds, supplied Foster decomposition and the accepted numerically unresolved construction remain explicit scientific limits. No LC/RL synthesis, factorization, optimization or subsequent development milestone was begun.

After these successful public checks, this separate documentation-only commit updates README, AGENTS and specification status while preserving historical evidence. The final release revision is the commit containing this entry, a direct documentation-only child of accepted main `55ba7cb77a88153fff706f18a62d3625848ca73b`; its exact SHA and final validation/Pages run links are supplied in the release handoff after deployment. A commit cannot include its own eventual SHA without changing that SHA. Final publication is contingent on that child commit's successful workflows and repeated public-package comparison; the implementation package hashes above remain the expected values.

## 2026-10-14 — Phase 6A1 headless graphical connectivity and editing

Started from fetched released main `3c52eff2c7cc7f8c827d7eb13a13975d0f82542c`
on `codex/phase-6a1-graphical-connectivity`, with a clean tracked tree. The
Phase 6A1 specification was written before implementation. This is an unmerged
headless editor milestone; the released application and scientific kernel remain
unchanged. Main and ignored local files, including publish synchronization copies,
were preserved.

### Implemented contracts

Four DOM-free TypeScript modules separate explicit wire connectivity/geometry,
atomic transactions, strict native conversion, and ownership/history. BFS follows
only ideal wires; device interiors and coincident coordinates never connect nets.
Pending/open/connected terminals are distinct. Last-wire removal becomes pending;
intentional opens remain real singleton nodes without leakage. Import uses one hub
per native node, including unused and singleton nodes. Exact IDs, labels, ordering,
source optional fields and storage data round-trip. Unsupported controlled-source
v1 and nonlinear v2/v3 return intact read-only documents.

Merging non-ground names requires an explicit survivor. Ground wins automatically.
Splits keep names with physical anchors, propose fresh names elsewhere, and keep
voltage probes on their own vertices. Set reference swaps native names with `0`
without adding wires or reversing devices. Device deletion blocks dependent current
probes unless explicitly included; own source/storage data is removed atomically.
External wires and voltage anchors remain as free endpoints. Copies receive new
identities and pending terminals, without inherited external wiring.

Wire splitting, endpoint-to-segment attachment and explicit crossing joins retain
routes and endpoints. Attachment is one atomic undo step. Selected junction-edge
separation affects only those edges. Geometry has finite coordinate and route-count
bounds, integer quarter turns and a drawing-unit determinant roundoff guard for
unresolved near-parallel crossings. None of these are circuit tolerances. Geometry
alone does not alter scientific revisions or replace an applied document.

History holds changed model collections/metadata, bounded to 100 steps by default
(configurable 1–1000); no DOM snapshots. Undo/redo restores exact handles, values,
connections and geometry. Apply checks document identity, revision and serialized
snapshot, including in-place mutation; equal scientific candidates preserve applied
identity/revision. Dirty scientific or geometric drafts survive external changes
as conflicts. Undo after Apply changes only the draft. The existing Form/JSON and
synthesis interfaces are untouched.

### Actual automated evidence

New `test/wiring.test.mjs`: **37/37**. Full suite: **364/364**, comprising the
unchanged 327 released tests plus those 37. Physical circuits were constructed
through graph transactions rather than imported as expected converter outputs:

- Divider: V(out)=8 V, both resistor currents 0.004 A, source current −0.004 A.
  Set output as reference: V(in)=4 V, former ground=−8 V; physical probe differences
  and currents are unchanged. Resistor powers are 0.016/0.032 W and source power
  −0.048 W.
- RC low-pass: R=1000 Ω, C=1 µF, H(j1000)=0.5−0.5j. Ten backward-Euler steps at
  0.1 ms follow the independently computed recurrence `(v+0.1)/1.1`.
- Four-arm 1 kΩ bridge with a 1 kΩ cross branch: 5 V midpoints and zero bridge
  current. Changing only the right lower arm to 2 kΩ gives 70/13 and 80/13 V,
  with left-to-right bridge current −1/1300 A.
- Explicit opens and floating subnetworks remain native-valid but nonunique in
  MNA; incompatible voltage sources remain native-valid but fail analysis. A
  ground-shorted resistor is native-valid and has a successful zero-state solve.

Round-trips cover divider/RC/high-pass/RLC/bridge/current-source fixtures, unused
nodes, singleton assignments, arbitrary node order, labels, optional AC/waveforms,
storage values and exact punctuation/whitespace/markup/prototype-like names.
Accepted Cauer and Foster I/II source-free generated documents also round-trip
structurally. Atomic rejection, cycle versus true split, crossing versus junction,
name/reference dependencies, geometry, bounded history, stale clean Apply,
dirty conflicts, explicit discard and mutation-aware ownership are tested.

A clean archived source copy with the tracked/new task files overlaid passed
`npm ci`, focused tests, `npm test`, `npm run typecheck`, `npm run build`, application
and site builds, all six existing numerical demos, and `git diff --check` in the
working repository. A separate ES-module VM loaded the neutral wiring bundle and
browser kernel without window, document, process or runtime imports; a divider
round-trip/8 V solve and geometry-only source rotation passed. The existing esbuild
allow-scripts notice was nonblocking.

A second clean archive of released main independently built its publishing package.
The candidate and baseline both contain exactly `index.html`, `app.js`, `style.css`;
all three compare byte for byte. Relative asset URLs carry matching content versions:

- `index.html`: `48df09939558408f8d5d39d6921864c34ed23f55b3f87cbe0c737ab450717802`
- `app.js`: `497ab6c54bf4ddf40395d786bfca0b01e243fd11b439c71ec62ca01fbe34d4b8`
- `style.css`: `7e837db231cfd897d065d2380462d1cb6be21783cd8086500c7c598b1e016615`

### Boundaries and review gate

No production renderer, pointer/keyboard interaction, localization surface, layout
sidecar, autorouter, mirroring, multi-terminal editing or cleanup UI is introduced.
Provisional geometry does not certify drawing readability. Graphical browser
interactions and file-picker/download interactions were not retested here; prior
release evidence and limits remain historical, not newly claimed checks. Every
explicit graph component, including leftover free anchors, remains a native node;
future cleanup must be an explicit operation rather than silent topology loss.

The API documents read-only unsupported conversion, first-blocking diagnostics,
collection-scoped history costs and the requirement that a future browser adapter
Apply against the actual shared authority. No numerical correctness defect was
found or repaired. Independent controller review of this contract precedes any
Phase 6A2 browser integration. No merge or deployment was performed.

## Phase 6A2 — bilingual graphical browser editor (task branch; not published)

Implemented from accepted Phase 6A1 `0a9ac3ee0654d72bbfbca97b1b56e4ea40d436b5`
on `codex/phase-6a2-svg-circuit-editor`. Released main remains
`3c52eff2c7cc7f8c827d7eb13a13975d0f82542c`. This record does not supersede
historical release/browser evidence above and does not claim deployment.

### Contract and implementation choices

Graphical is the third Edit circuit mode. It owns separate geometry/history,
pending property text and unfinished wiring; Form/JSON remain independent.
R/C/L/V/I properties include IDs/labels, DC/optional RMS AC/waveforms, storage and
voltage/current observations. Endpoint controls offer keyboard wiring, explicit
merge-name selection, reference/name changes, split/attach/join/separate,
open/disconnect and copy/delete. SVG selection/movement uses the actual screen
CTM. Provisional wires are outside the committed graph until finished; navigation
preserves them and Cancel/Escape discards them without creating a native node.

The authorized Phase 6A1 classification correction compares native scientific
meaning, not graphical vertex counts. Wire subdivision, redundant connections,
cycle-edge removal and movement/rotation/bends can remain electrically neutral;
real net merges/splits, values and source changes are scientific. Geometry is still
unapplied work. `WiringSession.apply` checks the live document identity, revision
and serialized snapshot, validates strictly, invokes the existing shared import
once for changed meaning and checkpoints the actual result. An unchanged document
retains identity/revision and does not notify analysis consumers. There is no
copied-authority Apply or second scientific commit. Panel references reconcile via
the existing path; pending inspector/source text blocks replacement.

Pending net/route text follows stable handles; explicit Restore uncommitted text
recovers it without replacing the committed draft. Compound property commits are
atomic. Dirty graphical work participates in Transform/Synthesize adoption guards.
Conservative drawing warnings cover crossings, overlaps beyond a shared endpoint,
obscured vertices and wire-through-symbol geometry. The exact topology table is
always available. No geometric overlap creates connectivity. Native schemas,
scientific kernel, tolerances and the 364 baseline test expectations are unchanged.

### Automated evidence

An isolated archive plus task-file overlay (without ignored local files) passed
clean `npm ci`, full `npm test` (**382/382**), focused graphical tests (**55/55**),
`npm run typecheck`, kernel/application/site builds and all six numerical demos
(`demo`, `demo:diode`, `demo:diode-transient`, `demo:bjt`, `demo:rc-synthesis`,
`demo:foster`). `git diff --check` passed. The pre-existing esbuild allow-scripts
notice is informational; installation/build succeeded.

The 18 new tests include a minimal DOM adapter invoking the production
input/change/click handlers. Blank-draft divider, RC and bridge construction is
checked independently through the existing kernel: 8 V and −4 mA source current;
reference-shift 4 V/−8 V; H(j1000)=0.5−0.5j; backward-Euler recurrence;
balanced 5 V/5 V and zero cross current; unbalanced 70/13 V, 80/13 V and −1/1300 A.
Other tests cover neutral revisions, live ownership, invalid/retained text,
compound rollback/history, exact escaped IDs, unsupported types, synthesized
native documents, drawing warnings and atomic size limits. These tests are not
claimed as actual browser interactions.

A separate ES-module VM loads the neutral kernel, wiring and interaction bundles
without window/document/process or runtime imports, solves the 8 V divider and
checks identity-preserving geometry-only Apply. The isolated publishing package
contains exactly `index.html`, `app.js`, `style.css` with matching SHA-256-derived
relative version references (`app.js` version `8b47fb771869`, CSS version
`861e237d0589`), also observed in the final Chrome DOM. The ignored working-directory publish files are
preserved, not used as release evidence.

### Actual Chrome evidence

The locally bundled application was exercised at `/circuits/`, followed by the
isolated three-file package. Through Graphical controls (no native JSON or hidden
fixture substitution), constructed:

- 12 V divider with 1 kΩ/2 kΩ: displayed 8 V and ±4 mA; after reference reassignment,
  displayed 4 V and −8 V with unchanged current.
- 1 kΩ/1 µF RC low-pass with step source, zero storage and RMS AC: displayed
  0.5−0.5j at 1000/(2π) Hz and rendered frequency/transient plots. The exact
  backward-Euler sequence is an automated check, not inferred from the plot.
- Five-resistor bridge and 10 V source: 5 V/5 V, cross current approximately
  −8.67e−19 A; after lower-right resistance 2 kΩ, 5.3846 V/6.1538 V and
  −7.6923e−4 A.

Also checked SVG pointer placement, keyboard terminal selection/Enter/Escape,
rotation, copy with pending external terminals, intentional opens, deletion,
source/probe edits, incomplete-property correction, and history. Two constructed
crossing wires remained two named nets until explicit Join; Separate selected
incident wires split them again, and Undo/Redo replayed the operation. Graphical
`bad-graph`, Form `form-pending`, and JSON `{pending-json` remained independently
visible after a preset change; obsolete Graphical Apply preserved the applied RC.
Synthesis adoption displayed the pending-draft confirmation.

The clean publishing package rendered an exact `__proto__ <b> & "Q"` component ID
literally (zero inserted `b` elements). Its Graphical Validate explicitly warned
that a native-valid open circuit is not solver-certified. JSON-editor malformed
input remained correctable, translated on language change, and preserved the
current document; Restore returned identical native text and valid reapply worked.
This is distinct from file import.

English/Mongolian were inspected at desktop and 390/320 CSS pixels. Measured page
scroll widths were 375/305 respectively (no horizontal page overflow); canvas
scrolling is local. Invalid text and selection survived translation, controls
stacked and keyboard focus remained visible. Warning/error capture was empty during the construction and initial package
checks. The final package reload recorded three Chrome asynchronous message-channel
closure errors, without an application stack; these are recorded separately from
application failures (the application has no Chrome extension message listener).
No failed app asset or application exception was observed. Existing diode transient completed
and a 3000-interval run was cancelled before its result. Synthesis completed all
three methods with independent sample evidence; the attempted Cancel occurred
after completion, so active synthesis cancellation was not established in Chrome
(the existing automated worker tests remain passing).

### Limits and review gate

The Chrome filechooser event timed out after clicking Import JSON, so neither
valid nor malformed OS-file selection was completed. Export JSON was clicked,
but download completion/path capture also timed out; downloaded bytes were not
verified here. Existing strict parser/serializer tests and the JSON-editor checks
do not establish these interactions. Manual follow-up: select valid exported JSON,
then malformed JSON, confirm preserved circuit and translated error; download
native JSON and inspect/reimport the actual file. Browser extension file-URL access
may need enabling for the automation facility. No permission settings were changed.

Geometry is session-only; no sidecar, autorouter, multi-terminal editing or new
physics is included. Limits are 40 components, 240 vertices, 320 wires and 64 bends.
Unsupported controlled-source v1 and v2/v3 remain intact. Provisional layouts may
warn even for safe diagonal arrangements. Deleting a component preserves its
anchors per Phase 6A1; leftover isolated nodes can therefore be native-valid but
unsolvable. Undo, explicit connection or JSON editing is available; no automatic
node cleanup is introduced. Native export does not preserve layout or transfer a
synthesis certificate to later edits. Independent controller review remains the
next gate. No merge or deployment was performed.

## Phase 6A2 focused acceptance correction — 2026-10-14

### Baseline and bounded changes

Started from the clean reviewed branch at
`6506ca0d8368bf7accc8a6333677d052844352a7`. Its [GitHub validation](https://github.com/gantemur/circuits/actions/runs/38519581914)
succeeded. Main/origin main remained
`3c52eff2c7cc7f8c827d7eb13a13975d0f82542c`, an ancestor of the task branch.
A clean build of that released source matched the public HTML, JS and CSS bytes.
No numerical solver, source model, native schema, physical tolerance or deployment
was changed in this correction.

Actual isolated Chrome reproduced the stale split-wire selection (displayed new
wire but action addressed the removed handle) and the checkbox Escape
`InvalidStateError` from `setSelectionRange`. Correction commit
`66cd302a6b945072d1f9d4c5cc8e37c386a2e773` reconciles all selector options before
deriving dependent UI, reads actual displayed selections, and requests explicit
reselection for removed references. Component selection and destructive actions
share the same selected handle. Pending text is separately owned. Valid wire
gestures survive unrelated Undo/Redo; removed endpoints and terminals converted to
anchors retire the gesture. Focus restoration uses text-selection APIs only for
supported input types. Stable incident-checkbox IDs and retained checkbox choices
preserve usable focus across renders; deletion consent follows its selected device.

### Automated and clean-package evidence

From an isolated archive of the committed correction: clean `npm ci`, `npm test`
(**389/389**, all 382 existing expectations retained), focused
`node --test test/wiring.test.mjs test/wiring-browser.test.mjs` (**62/62**),
`npm run typecheck`, kernel/application/site builds and `git diff --check` passed.
All six demos passed: linear, diode, diode transient, BJT, Cauer and Foster.
The DOM-free VM smoke loaded the kernel, graph and session without window,
document or process; it checked the 8 V divider and geometry-only Apply retaining
scientific document identity/revision. Production tests also cover native import
notification ownership and independent draft guards.

The publishing package contains exactly `index.html`, `app.js`, `style.css`, with
relative asset URLs and matching SHA-256 content-version references. Tested JS
SHA-256 is `4c99959df63a39f3cd75c06e3572eda0b9da2cf0f79485e3de4b89401f89b201`;
CSS is `861e237d05890d3c5665097a163ecc9ab6c3ad30d724e081cfe1d1a57b1d535a`.
The delivery check rebuilds the final documentation commit from a separate clean
archive and compares all three bytes against this browser-tested package.

### Actual Chrome acceptance

Used a fresh isolated Chrome profile with extensions disabled and CDP against the
clean package under `/circuits/`. Browser constructions started with blank
Graphical drafts, rather than imported fixture topology:

- Divider: 12 V, 1 kΩ/2 kΩ, correct terminal connectivity, 8 V output, +4 mA
  resistor currents and −4 mA source current. Changing reference gave 4 V/−8 V.
- RC: 1 kΩ/1 µF, configured DC/AC/step source and zero capacitor initial state.
  Frequency inspection at 1000 rad/s displayed 0.5−0.5j V RMS; transient rendered
  the step plot and 102 samples. Downloaded experiment fields were checked.
- Bridge: five resistor branches, balanced 5 V midpoints and numerical cross
  current −8.67e−19 A; unbalanced values agreed with 70/13 V, 80/13 V and
  −1/1300 A. Independent kernel evaluation of downloaded circuits also checked
  these equations and the actual topology.

Actual completed Chrome downloads were captured, their saved bytes strictly
parsed, and the divider/RC files selected through the real browser file-input
path. Reanalysis and repeat export preserved native documents, including AC,
waveform, observations and initial storage. Exact source ID `<b>Vs</b> & "Q"`
remained literal and survived the round trip. Malformed JSON and negative-resistor
invalid-native files were rejected while current analysis and pending `1e-`
Graphical text remained; correction and Apply then succeeded. These are completed
protocol file selections/downloads, not merely export clicks or serializer tests.
The human-operated OS picker was not exercised.

Browser interactions covered split/delete/reselect, copy, Undo/Redo, disappearing
net names, explicit crossing versus junction, selected junction separation,
pending-wire Escape, real pointer wire completion, checkbox focus on Escape and
language switches, text cursor preservation, and invalid-property recovery.
Clean drafts followed example changes; dirty change-and-restore drafts stayed
conflicted. Graphical/Form/JSON pending text survived navigation and translation.
Inspector pending text blocked replacement. Both Transform and Synthesize asked
confirmation with a Graphical-only draft. Unsupported controlled-source v1,
diode v2 and BJT v3 remained intact and exported valid native documents.

English/Mongolian were inspected at 1280, 390 and 320 CSS pixels. Page scroll
widths were 1265/375/305 (the vertical scrollbar accounts for 15 pixels), with no
horizontal page overflow. Local SVG scrolling, Fit/Zoom/Pan and focused controls
worked; narrow screenshots were visually inspected. Existing diode worker
completed and a 3000-interval run cancelled before results. Synthesis completed
all three default methods; an independently specified degree-eight Stieltjes
function `1 + Σ(k/(z+k)), k=1..8` kept Cauer active long enough to observe the live
worker and enabled Cancel, then its termination and cancelled status.

The successful fresh-profile comparison of a simple page, published application
and corrected package recorded no runtime/application console errors. An earlier
comparison navigation recorded only the public site's unrelated `/favicon.ico`
404. Previously recorded asynchronous message-channel errors did not recur; no
source/stack evidence proves their cause, and no messages were suppressed or
unrelated application code changed. Test-harness locator errors during script
development were corrected and are not reported as application defects.

### Remaining limits and gate

This pass supersedes the earlier file-protocol and active-synthesis-cancellation
verification limits for these checked cases. It does not establish a human OS
picker, persistent geometry, automatic layout quality, or devices outside the
existing R/C/L/V/I graphical scope. Geometry remains session-only; existing size,
collision-warning and leftover-anchor behavior remains unchanged. Ready for a
separate controller publication decision; main is unchanged and this branch has
not been merged or deployed.

## Phase 6A2 final Undo/Redo identity correction — 2026-10-14

At reviewed `1531c2cb9134c226558666b250587dbcfdb78cfa`, two new tests first
failed: Redo of device deletion retained a wire gesture from its former terminal,
and Undo of deletion retained a gesture from the free anchor becoming a terminal.
`travel()` restores graph fields in place, so retaining the graph object itself
could not preserve its old vertex identities. The bounded correction snapshots the
graph before history traversal. Existing reconciliation then detects removed
vertices, kind changes and terminal owner/role changes without altering history,
connectivity or Apply. No accepted operation reassigns an existing terminal's
owner/role directly; those comparisons remain intact.

Four added regressions cover terminal-to-anchor Redo through production UI
handlers, connected-anchor-to-terminal Undo, unchanged gestures through unrelated
rotation Undo/Redo with successful completion, and removal by undoing creation.
They also check unchanged applied document identity/revision, native candidate,
history entries, scientific revision for geometry history, pending text and
independent workspace/state. All 389 earlier expectations remain unchanged.

Clean committed-source validation passed: `npm ci`, focused graph/browser tests
**66/66**, full suite **393/393**, typecheck, kernel/application/site builds, all
six numerical demos, DOM-free VM smoke and `git diff --check`. The isolated
package contains only index.html, app.js and style.css with matching relative
content-version references. JS SHA-256:
`d758c971523ad9a4e71deb1c8aec0d725a635c5c275b23ec98af9437bbdbd467`.

Actual isolated Chrome against that package exercised all four history sequences
through production controls. Both kind transitions retired the pending wire;
clicking another endpoint after retirement created no connection. Unrelated
rotation history preserved the gesture and normal completion added one wire.
Undoing creation retired the vanished terminal's gesture. The successful run had
no application runtime exceptions. Harness-only selector/SVG-click errors were
corrected before this successful run. The previous extensive file round-trip,
bilingual layout and active worker-cancellation evidence is carried forward for
unchanged paths, not claimed as repeated. Human OS-picker and session-only geometry
limits remain. Main/publication are unchanged; ready for the controller's separate
final publication decision.

## Phases 6A1–6A2 publication — 2026-10-14

Fast-forwarded main from `3c52eff2c7cc7f8c827d7eb13a13975d0f82542c` to accepted
`2d1a725cee4d4ffa1f292cef45e7ecfd1e4f69c6`, preserving all six reviewed commits:
0a9ac3e, 6506ca0, 66cd302, 1531c2c, 08fb65d, 2d1a725. No implementation changes
were made during release. Accepted branch validation 38530224131 was successful.
Initial main [validation](https://github.com/gantemur/circuits/actions/runs/38581379437)
and [Pages publication](https://github.com/gantemur/circuits/actions/runs/38581379409)
completed successfully, including validate, package and deploy jobs.

Fresh isolated accepted-source checks passed: clean npm ci; full suite **393/393**;
focused graph/browser suite **66/66**; typecheck; kernel/application/site builds;
all six numerical demos; DOM-free kernel/graph/session smoke; git diff --check.
The three-file package has relative SHA-256-derived asset versions and embedded
worker code. Public HTTPS bytes matched the clean package exactly:

- index.html: `6b9eacb72a72f44dd2665c2b2a0bf4833df78864a09a712aad5ecf5a34805bfa`
- app.js: `d758c971523ad9a4e71deb1c8aec0d725a635c5c275b23ec98af9437bbdbd467`
- style.css: `861e237d05890d3c5665097a163ecc9ab6c3ad30d724e081cfe1d1a57b1d535a`

Actual public Chrome checks used a new isolated profile with extensions disabled,
CDP and https://gantemur.github.io/circuits/ (not a local server). Blank Graphical
construction and downloaded native connectivity established: divider 8 V, 4 mA
resistor currents and −4 mA source current; changed reference 4 V/−8 V with
identical branch currents/powers; RC 0.5−0.5j at 1000 rad/s with configured DC,
RMS AC, step and zero capacitor initialization, frequency/transient plots; bridge
5 V/5 V with roundoff-zero cross current, then 70/13 V, 80/13 V and −1/1300 A.
Independent evaluation of downloaded native documents checked connectivity and
physical values; fresh tests retain the backward-Euler recurrence expectations.

Public interactions passed crossing without connection, explicit join and
selected separation, split/replacement/delete, device copy/history, intentional
open versus incomplete terminals, Cancel/Escape, rotation and all four final
history cases. Obsolete gestures retired; unrelated rotation history preserved
valid completion. Geometry-only Apply exported identical scientific content;
object identity/revision and exactly-once import are established by fresh
production-path tests, not by hidden-state inspection in Chrome.

Public Graphical/Form/JSON drafts survived navigation, translation and external
changes. Change-and-restore stale Apply and pending inspector replacement were
blocked. Invalid property text remained correctable. Transform/Synthesize guarded
a Graphical-only draft. Unsupported controlled-source v1, diode v2 and BJT v3
remained intact and exported native documents. Cauer/Foster I/Foster II adoption,
source-free port-frequency handoff and the supported Graphical path worked; no
certificate transfer to edited circuits is implied.

Actual Chrome downloads completed, saved bytes were strictly parsed, and divider
and RC files were selected through the browser file-input path, reanalyzed and
exported unchanged. Sources/AC/waveforms/observations/storage and exact ID
`<b>Vs</b> & "Q"` survived. Malformed JSON and negative-resistor native files were
rejected while analysis and pending Graphical text remained intact. This is
protocol file selection, not a human-operated OS picker.

All 35 examples opened with their suggested panels. Representative linear DC,
frequency/transient, DC equivalent (8 V, 666.6667 Ω, 0.012 A), resistor
Preview/Use/Return, diode and BJT DC/frequency, and synthesis paths passed. Diode
transient completed; its 3000-interval run and a bounded degree-eight Cauer run
were cancelled while live workers were observed. English/Mongolian desktop,
390 px and 320 px had no horizontal page overflow (scroll widths 1265/375/305).
Checkbox focus, text selection, real pointer wiring, Fit/Zoom/Pan and local SVG
scrolling worked; narrow screenshots were visually inspected.

Successful browser runs recorded no application exceptions. Console comparison
was clean; browser process GPU diagnostics are distinct from application errors.
No application console messages were suppressed. The earlier unattributed
message-channel error is not assigned a cause. Human OS-picker, persistent layout,
autorouting quality and unsupported-device editing remain outside verification or
scope. Layout remains provisional/session-only, with explicit topology and
warnings; leftover anchors are not silently removed.

This documentation-only status update follows successful initial publication and
public acceptance. Its final SHA must also pass validation/Pages and public-byte
comparison before the release is reported complete. No next phase is begun.

## Phase 6A3a — portable project core (task branch, not published)

Implemented on `codex/phase-6a3a-portable-project-core` from released
`64e04525a98839f61a5587b24b1ba6c0fc61f45e`. The specification was written before
substantive source changes. No existing scientific/editor test expectations or
production entry points were changed. Main remains at the released baseline.

Version 1 uses a separate `circuits-unfolded-project` envelope with strict native
`document` and drawing version 1. Scientific values occur only in the native
payload. Drawing records contain placements, semantic terminal identities, explicit
vertices/edges/bends, exact native-node bindings, ground/voltage-probe anchors and
optional viewport. No editor counters, history, source duplicates or certificates
are serialized. The actual fields and API are in [PROJECT_FORMAT.md](PROJECT_FORMAT.md).

Connectivity validation follows wires only. A complete bijection between wire
components and declared native nodes catches hidden shorts, splits, extra islands
and omitted unused nodes. Ordered component roles and voltage anchors must agree
with native terminals; reference must lie on node 0. Coincidence/crossing is never
connection. Reconstruction obtains scientific values from the accepted adapter,
allocates fresh deterministic handles, and runs nativeCandidate plus exact ordered
scientific-content comparison. Free/open endpoints and alternate physical probe
anchors survive. Fatal geometry errors are separate from conservative nonfatal
quality warnings; no layout is repaired automatically.

All entry points are pure. Unsupported valid scientific schemas retain their
validated document; drawing-stage failures retain it for a future explicit
native-only Open choice. Export does not Apply. Draft-aware export requires no
pending text/gesture; raw-graph export cannot inspect state outside that graph.
Saved-content comparison ignores object key/file-ID spelling but preserves the
scientific arrays, ordered vertices/edges, anchors, coordinates and viewport.
Future Open must guard both applied ownership and Graphical edits, preserve Form/
JSON, begin fresh history and remain unapplied. Browser integration is deferred.

Inputs have documented byte/tree/record/geometry limits; native array budgets are
checked before native cross-reference work. File data uses arrays/Maps with exact
strings and no dynamic prototype assignments. No general migration framework or
third-party runtime dependency was introduced. Reconstruction is exposed only
through the checked validate/import result, not an unchecked builder.

### Actual validation

Clean archives of implementation `73bc906` and released main were built separately.
Fresh clean npm ci, full npm test **446/446** (393 preserved + **53 new project
cases**), focused project tests **53/53**, typecheck, explicit kernel/app/site
builds, all six numerical demos and git diff --check passed. Positive cases use
independently authored native documents and declared drawing terminal groups,
not merely exporter output. They assert coordinates, rotations, routes, graph
endpoints, ground and each physical observation anchor directly, and repeatedly
serialize/parse/export without drift. Corruption tests cover strict fields,
versions, missing/duplicate records, references, shorts/splits, native failures,
bounds and unsafe names, with nonmutation assertions.

Independent post-round-trip science: divider 8 V, +4 mA resistor/−4 mA source;
RC H(i1000)=0.5−0.5i; RLC H(i10000)=−10i; bridge 5 V/5 V/zero cross current then
70/13 V, 80/13 V and −1/1300 A. Cauer/Foster I/Foster II native generation and
distinct graphical layouts round-trip successfully. Source optional AC and
constant/step/sinusoid data, storage, exact Unicode/whitespace/markup/prototype-like
IDs, unused nodes and intentionally open terminals are retained.

A neutral VM bundle exercised project parse/export/serialization/reconstruction
and the 8 V kernel without window, document or process. The VM supplied TextEncoder
and a realm-local JSON-record clone shim because Node VM contexts do not supply
structuredClone; normal tests use the real runtime clone. No SVG renderer or
browser file API is imported by the project core.

The isolated publishing package contains exactly index.html, app.js, style.css,
with relative matching content versions. All three bytes equal the fresh released
baseline build:

- HTML: `6b9eacb72a72f44dd2665c2b2a0bf4833df78864a09a712aad5ecf5a34805bfa`
- JS: `d758c971523ad9a4e71deb1c8aec0d725a635c5c275b23ec98af9437bbdbd467`
- CSS: `861e237d05890d3c5665097a163ecc9ab6c3ad30d724e081cfe1d1a57b1d535a`

No new browser Save/Open/file-operation evidence is claimed: this milestone has
no such controls, and the production assets are unchanged. Phase 6A3b still needs
consent UX, asynchronous ownership rechecks, saved-state UI and completed project
download/file-input tests. Persistent recovery, autosave, layout recognition,
autorouting and multi-terminal editing remain deferred. Independent controller
review is the next gate; no merge or deployment was performed.

## Phase 6A3a correction — deterministic drawing-warning work budget

Preflight confirmed reviewed branch `8deaefff97c9ff2a3fa73414dc11b23232763942`,
clean tracked worktree, ancestry from unchanged main `64e04525a98839f61a5587b24b1ba6c0fc61f45e`,
and [successful validation](https://github.com/gantemur/circuits/actions/runs/38588755204).

A valid single-ground project with two vertices, 320 parallel wires and 64 bends
per wire occupied 351,060 JSON bytes. The original validator accepted it with no
warnings. Instrumenting its segment suffix slices counted 20,800 segments,
20,800 suffix allocations and **216,309,600 pair visits/copied suffix entries**;
one local run took about 1.01 seconds. Timing is illustrative, not acceptance.

The optional warning path now examines at most **10,000 segment pairs**, counting
same-edge and shared-endpoint pairs before skipping them. Indexed loops avoid
suffix allocations. Exhaustion returns nonfatal `drawing-inspection-incomplete`,
explicitly covering remaining wire and symbol checks. Small drawings retain their
existing overlap/proximity heuristics. The internal inspection result exposes
pair counts for deterministic regression evidence; the existing warning-array
interface remains intact. No native/schema, topology, reconstruction, allocation,
solver, Apply or ownership behavior changed. Full structural and geometry bounds
still precede the heuristic. This is not exhaustive collision certification.

An isolated clean source tree passed npm ci, **58/58 focused project tests** and
**451/451 full tests** (all 446 previous expectations retained), typecheck, explicit
kernel/application/site builds, all six demos and git diff --check. New tests cover
the maximum valid drawing, budget thresholds including skipped pairs, ordinary
crossing and clear drawings, complete native/placement/terminal/route/ground/probe
preservation and stable repeated exports/content keys. A real divider still solves
to 8 V after the bounded path. Late-edge geometry/reference corruption, extra wire
components and missing native bindings remain fatal and nonmutating.

The neutral VM smoke passed parse/export/serialize/reconstruction and the 8 V
kernel without DOM or process; it retains the previously documented realm-local
JSON-clone shim limitation. Clean publish contains exactly index.html, app.js and
style.css with matching relative content versions. All three match the clean
released-baseline package byte for byte, with the same hashes recorded above.
No browser interaction evidence is claimed or needed for this headless-only change.
No merge or deployment occurred. Phase 6A3a is ready for controller review and
possible authorization of Phase 6A3b; Save/Open, autosave and routing remain deferred.

## Phase 6A3b — portable project Save/Open browser integration

Implemented on `codex/phase-6a3b-browser-project-save-open`, descending directly
from accepted core `97aefa40d37aee9e3c34f9cbabb7af788bad2546`. Main remains released
`64e04525a98839f61a5587b24b1ba6c0fc61f45e`; this is not a publication record.

Graphical Save project exports the completed independent draft as `.cuf.json`
using guarded export, strict serialization and saved-content keys. All property,
source/storage, initialization, coordinate, name, bend and observation text plus
wire/move gestures guard Save. Native JSON remains a separate scientific format.
Save/Open never Apply. Saved-content and scientific Apply checkpoints are separate;
geometry/viewport changes do not invalidate scientific analysis. The UI reports
only download initiation, not proven disk durability.

Open checks size before reading, then prepares a strict candidate and previews
counts, exact escaped IDs and nonfatal warnings. Explicit replacement names only
Graphical; Form/JSON are retained. Attempt IDs, applied identity/revision/exact
serialization, draft identity/scientific/geometry revisions, pending/gesture/control/
viewport snapshots and monotone edit generation guard both read completion and
acceptance. Edit-and-restore cannot revive an old authorization. Older read callbacks
cannot move focus to newer candidates. Language-only rendering retains intent.
Opened supported v1 projects work independently over applied v2/v3 documents and
retain geometry against later external changes. Fresh history contains no imported
ownership data. Apply uses the existing shared native path; pending inspector
text still blocks replacement. A supported valid-native/invalid-drawing fallback
is explicit, provisional, unapplied and unexported until Save.

The accepted schema, topology/native validation and scientific kernels are unchanged.
Opened project drawings use the accepted bounded quality-warning scan, avoiding a
second quadratic legacy-renderer scan. Incomplete inspection remains nonfatal and
visible in both languages. It never certifies collision-free geometry.

### Automated evidence

Clean-source npm ci, npm test **473/473** (451 retained + 22 new controller/UI cases),
focused project tests **80/80**, typecheck, explicit kernel/app/site builds, all six
numerical demos and git diff --check passed. Controlled deferred promises verify
stale reads, overlapping selections and stale confirmation deterministically.
Production handlers verify pending guards, save-initiation failure, exact IDs,
independent nonlinear owners, geometry/anchors, content keys and strict failures.
The headless project round-trip and 8 V divider smoke passes in a DOM/process-free
VM; the previously documented realm-local JSON clone shim remains a test limitation.

### Actual browser evidence

An isolated headless Chrome profile served the actual three-file package under
`/circuits/`. CDP observed completed download events, read completed files from disk,
and selected those files using DOM.setFileInputFiles (not a simulated JSON paste).

- Constructed an RC from a blank Graphical draft, including 1 V step/RMS source,
  R=1000 ohms, C=1e-6 F, zero capacitor storage, moved R to (370,230), rotated it,
  added bends (200,300)/(250,300), and chose the capacitor's p terminal and ground
  vertex as output anchors. Saved, reloaded, opened and re-exported exactly the
  same 1,570-byte project. Analyze remained unchanged until Apply. The exported
  applied circuit independently gives H(j1000)=0.5−0.5j and backward-Euler recurrence
  v[k]=(v[k−1]+0.1)/1.1 for h=0.0001 s; actual Frequency/Transient plots rendered.
- Unbalanced bridge and source-free Foster projects were opened, rotated, saved,
  reloaded and reimported through actual file input, with exact drawing/native
  round trips. Native JSON downloads and reimports remained separate and successful.
- Invalid JSON and valid-native/invalid-drawing files preserved work; explicit
  provisional fallback succeeded. Pending coordinate consent cancellation retained
  text, edit-and-restore invalidated confirmation, and real Form/JSON drafts survived
  replacement. Keyboard Enter cancellation restored focus to Open project.
- RC projects opened over both diode and BJT documents without changing their
  exported scientific bytes until Apply. Markup-looking Unicode/punctuation IDs
  displayed literally, created no markup elements and round-tripped exactly.
- All 35 examples opened; divider/RC, DC equivalent comparison, resistor Preview →
  Use → Return, all Cauer/Foster analysis handoffs, diode/BJT panels and diode
  transient completion worked. Actual synthesis and diode worker runs were cancelled
  through their controls. Native invalid-file preservation and independent draft
  guards were exercised by the legacy interaction checks.
- EN/MN at 1280, 390 and 320 CSS pixels had no page overflow. Screenshots were
  inspected; controls/text remained readable. Existing drawing scrolling and focus
  checks passed. Application runtime exception/error checks were empty; browser
  startup/allocator diagnostics are not application failures.

Clean publishing output contains only index.html, app.js and style.css. Matching
relative SHA-256 versions and byte equality with the browser acceptance package
were checked. Final package hashes:

- HTML: `cd0a83961654a0311a2ce5a570075ba3f40a7873c33ff640ec68783640dd0922`
- JS: `707b3b386b76afcfd2e1babdeff84700e3744bae4f91543530f15cdc5762d50a`
- CSS: `861e237d05890d3c5665097a163ecc9ab6c3ad30d724e081cfe1d1a57b1d535a`

Human operation of the OS picker and durability across OS failure were not tested.
The UI deliberately does not claim either. Browser asynchronous races are tested
with controlled promises at the production-controller boundary, not timing claims
about OS reads. No autosave, persistent history, autorouting, layout recognition,
new devices, merge or deployment is included. Independent controller review is
required before publication or another milestone.

## Publication — Phases 6A3a–6A3b portable circuit projects

Published accepted implementation `0a881fdcf97a0cdb15b4be81b1c9450819f33380`
through a normal fast-forward from `64e04525a98839f61a5587b24b1ba6c0fc61f45e`.
Preflight confirmed exact remote tips, clean tracked worktree, five commits ahead
and no divergence. All reviewed commits are retained: `4334e52`, `73bc906`,
`8deaeff`, `97aefa4`, `0a881fd`. No implementation changes, squash, rebase or force
push were made during publication.

- [Accepted branch validation](https://github.com/gantemur/circuits/actions/runs/38599580790): success.
- [Integrated main validation](https://github.com/gantemur/circuits/actions/runs/38602660563): success for `0a881fd`.
- [Publish browser lab](https://github.com/gantemur/circuits/actions/runs/38602660535): success for `0a881fd`, including validate, package and deploy jobs.
- Public application: https://gantemur.github.io/circuits/

Fresh isolated tracked-source installation passed npm ci, full npm test **473/473**,
focused project/core/browser tests **80/80**, typecheck, explicit kernel/application/
site builds, all six demos, DOM-free project/core smoke and git diff --check. The
VM smoke retains its documented realm-local JSON clone shim. Source-level tests
with controlled deferred promises independently verify stale reads, overlapping
file attempts, native change-and-restore and pending edit-and-restore; public
browser timing is not substituted for these deterministic race tests.

### Public HTTPS acceptance after deployment

Used a fresh isolated headless Chrome profile with extensions disabled. Completed
Browser.downloadProgress events and subsequent disk reads established actual file
completion. DOM.setFileInputFiles exercised the real project/native inputs; this
is not a claim of human OS-picker operation.

- Built the RC from blank, with 1 kΩ/1 µF, 1 V DC/RMS, step at zero, zero capacitor
  storage, ordered output anchors, R at (370,230), quarter-turn rotation and two
  bends (200,300)/(250,300). Saved, reloaded, reopened and re-exported identical
  complete 1,570-byte project content. Native Analyze bytes stayed unchanged until
  explicit Apply. The exported circuit independently produced H(j1000)=0.5−0.5j
  and v[k]=(v[k−1]+0.1)/1.1 for 0.0001 s steps; actual frequency/transient plots rendered.
- Balanced and unbalanced five-resistor bridges completed project download/reimport
  with exact topology and geometry. Balanced voltages were 5 and 5 V (cross current
  below 1e-18 A roundoff); unbalanced values were 70/13 and 80/13 V, with cross current
  −1/1300 A. Editing BR from 1000 to 2000 in the public Graphical inspector preserved
  the complete drawing; the saved unapplied edit did not change Analyze until Apply.
- Source-free Cauer and Foster drawings were rotated, exported, reopened and
  re-exported exactly. Native scientific bytes remained equal. Portable data does
  not contain a synthesis certificate; editing never recertifies a generated circuit.
- Complete unapplied exports left Analyze unchanged. Applied geometry-only edits
  changed the saved-content indicator while native exports stayed identical. Zoom
  changed saved content. Pending numeric text, unfinished wires and active moves
  blocked export without losing work. Automated production tests additionally
  assert scientific identity/revision preservation.
- Actual malformed, unsupported envelope/drawing versions, negative scientific
  component values, hidden shorts, incorrect ground/probe anchors, missing vertices
  and excessive bends were rejected. The old SVG, pending coordinate text, Form/
  JSON drafts and exported Analyze document remained intact. Controlled-source v1,
  diode v2 and BJT v3 project drawings returned explicit unsupported outcomes.
- Explicit valid-native/invalid-drawing fallback produced an unapplied provisional
  draft with no saved-project checkpoint. A large valid drawing visibly reported
  nonfatal incomplete quality inspection before and after Open. Native/project
  transport interchange was rejected rather than silently converted.
- Dirty consent cancellation and stale pending-text confirmation preserved work.
  Form/JSON survived replacement. Opening supported v1 projects over applied v2/v3
  left their native exports identical until Apply. Exact markup-looking Unicode/
  punctuation IDs stayed literal and round-tripped without creating elements.
- All 35 examples opened. Divider resistor editing, linear plots, DC Thévenin/Norton,
  resistor Preview/Use/Return, diode/BJT DC/frequency, all synthesis-method handoffs,
  diode transient completion and active diode/synthesis cancellation passed.
- EN/MN desktop, 390 and 320 CSS-pixel layouts had no page overflow. Public screenshots
  were inspected. Keyboard cancellation returned focus to Open; drawing scrolling
  remained local. The wheel check initially lacked foreground focus; bringing the
  Chrome target to front and waiting for the scroll event resolved the harness
  failure without changing the application. A temporary evaluation-string quoting
  error in the state-check script was corrected; fresh checks had no application
  runtime exceptions. Browser startup/allocator diagnostics were kept separate.

### Publishing package and closure

The clean package contains exactly index.html, app.js and style.css. Public HTML
and its matching relative versioned assets were compared byte for byte with the
isolated release build, matching the accepted implementation hashes:

- HTML: `cd0a83961654a0311a2ce5a570075ba3f40a7873c33ff640ec68783640dd0922`
- JS: `707b3b386b76afcfd2e1babdeff84700e3744bae4f91543530f15cdc5762d50a`
- CSS: `861e237d05890d3c5665097a163ecc9ab6c3ad30d724e081cfe1d1a57b1d535a`

This release-status closure is documentation-only. Its final SHA, validation and
Pages run links are reported in the delivery after those runs and final public
asset verification complete. Earlier task-branch evidence above is preserved.
Human OS-picker operation, OS crash durability and exhaustive drawing collision
certification remain outside the evidence. No autosave, crash recovery, routing,
new models or next milestone is authorized by this publication.

## Phase 6A3c1 — bounded headless topology layouts (not published)

Released main and fetched origin/main were both
`632a1e34db25ef3ad95b43790d28212afeac5663`; tracked state was clean. The task branch
`codex/phase-6a3c1-topology-layout` was created from that baseline. Its specification
was written before implementation. No kernel, schema, existing test, renderer,
production entry point, dependency or lockfile changed. No merge or deployment.

### Design and preservation

Three pure layers operate on typed multigraph structure, explicit witnesses and
independently checked drawings. Native input order breaks symmetries; exact names
and values do not select a family. Source-free networks require ordered caller
ports. A single V source can supply the default pair without redefining ground.
The native-only API rejects project envelopes and owns no application revisions.

Implemented templates cover driven R/RL/RLC paths with shunts (including divider
and RC low/high pass), parallel paths, five-R bridges independent of balance,
Cauer RC ladders, Foster I series-of-parallel sections and Foster II parallel
series-RC branches. Classification denotes actual topology, not a synthesis
certificate. Fixed precedence handles overlapping simple descriptions. Explicit
limits/fallbacks are documented in WIRING_API and the milestone specification.

Construction retains importWiring's scientific fields, creates prescribed-net
rails, splits only same-native-net rails at explicit junctions, and suppresses
non-anchor degree-two construction dots into bends. Ordered native p/n roles
control quarter-turn rotations. Every native node, including unused ones, retains
its name/order; observations and reference retain exact anchored membership.
The independent verifier compares reconstructed native data and runs strict
portable validation, then completely inspects its bounded orthogonal geometry.
It does not rely on the older optional warning scan's absence of warnings.

Review of the recognizer exposed a consumed-but-dangling path that did not actually
reach the designated return. The new recognizer now requires a terminating shunt;
a dedicated regression covers both driven and source-free forms. This was a new
layout implementation issue, not a discovered scientific-kernel defect.

### Actual automated validation

Clean candidate and baseline snapshots were built under `/tmp/6a3c1`, excluding
ignored workspace content. `npm ci` passed (the existing esbuild allow-scripts
notice was nonblocking). Focused `node --test test/topology-layout.test.mjs` passed
**40/40**; complete `npm test` passed **513/513**, retaining all **473** existing
tests unchanged. Typecheck, kernel/application/site builds, all six demos
(`demo`, `demo:diode`, `demo:diode-transient`, `demo:bjt`, `demo:rc-synthesis`,
`demo:foster`) and `git diff --check` passed.

Independent checks include exact wire-component partitions and native fields,
project validation and three export/reopen cycles, values/ID renaming invariance,
reversed roles and ordered ports, prototype-like/markup IDs, unused nodes and an
internal ground reference. Divider is 8 V, 4 mA, source −4 mA / −48 mW; RC low/high
and RL transfer values are checked against elementary laws, RLC against −10j at
ω=10000. Balanced bridge gives 5 V/5 V/0 A; unbalanced gives 70/13 V, 80/13 V and
−1/1300 A. Cauer and Foster I/II each give 1200−1600j Ω at ω=1000 with their distinct
physical topology. Parallel resistance and RC loading have independent equations.
Geometry corruption, unsupported/unknown/oversized patterns, saved project input
and quality-rejected long layouts preserve input and never return partial success.

A separate ES-module VM imported the neutral layout bundle and browser kernel with
no DOM, window, document, process, storage or module imports, generated the divider
and solved it to 8 V. The VM supplied TextEncoder/TextDecoder and a realm-local
JSON-only structuredClone shim for these plain model graphs. An initial host-realm
clone was correctly rejected by strict project prototype validation; fixing the
smoke harness required no application change. This smoke is not a general-purpose
structuredClone conformance test.

### Actual visual evidence and limits

Six generated/provisional SVG pairs were rendered with the unchanged production
renderer/CSS and inspected in isolated Chrome at 1400×620. Committed
[evidence](evidence/phase-6a3c1/README.md) includes SVG pairs, generated screenshots,
regeneration instructions and complete pair counts. Generated divider/RC drawings
have supply left, series path and return; bridge midpoints/cross branch are clear;
Cauer section order and Foster series-versus-parallel forms remain distinct.
The provisional views show crossing/obscured regions avoided by these templates.

The unchanged renderer puts value text below vertical symbols. Deliberate lower-lead
rectangular detours preserve label visibility but are less conventional than side
labels. Raw SI numbers, hollow junction circles, small fit-to-view bridge labels
and arbitrary Unicode/font metrics remain presentation limitations. No mobile
editor interactions, browser Save/Open or human file-picker/download checks were
performed for this headless change; historical evidence remains unchanged.

### Publishing isolation and next review gate

The clean publishing directory contains exactly index.html, app.js and style.css,
with existing relative content-version references. All three match a fresh build
of released main byte for byte:

- HTML `cd0a83961654a0311a2ce5a570075ba3f40a7873c33ff640ec68783640dd0922`
- JS `707b3b386b76afcfd2e1babdeff84700e3744bae4f91543530f15cdc5762d50a`
- CSS `861e237d05890d3c5665097a163ecc9ab6c3ad30d724e081cfe1d1a57b1d535a`

The layout engine is reachable only through its headless API/test bundle. The
published editor, main and ignored files remain unchanged. Controller review of
witnesses, quality limits and visuals precedes any Phase 6A3c2 authorization.
A later integration should explicitly preview/adopt native-only initial drawings
and design undo/conflict ownership separately; it must preserve saved geometry.
No Arrange button, rerouting UI, autosave, new models or synthesis extension added.

## Phase 6A3c2 — browser layout integration, local acceptance (2026-10-14)

Task branch `codex/phase-6a3c2-browser-layout` starts from accepted headless
`f9b800a797433c1c9f03e686428922afb0df0f46`. Preflight fetched origin, confirmed
clean tracked state and released main `632a1e34db25ef3ad95b43790d28212afeac5663`,
and verified accepted c1 [validation](https://github.com/gantemur/circuits/actions/runs/38609474528).
The c2 specification was written before implementation. This entry records local
acceptance only: main remains unchanged; no merge or deployment occurred.

### Representation and ownership

The browser reuses `generateTopologyLayout` for a clean native-only initial drawing,
without changing applied science, manufacturing a disk-save checkpoint or requiring
Apply. The existing provisional importer/unsupported path remains authoritative
when recognition, size or quality fails. Saved projects, dirty drafts, pending text
and gestures are never automatically rearranged. User-authored history/redo also
excludes automatic generation immediately after Apply; the two existing regressions
that exposed that boundary were fixed without changing their expectations.

Source-free drawings use explicit ordered selectors or a valid explicit
analysis/synthesis pair owned by the exact current document/revision/serialization.
Names and ground are not used to guess a port. Suggest operates on the current
strict draft candidate and renders read-only before/after drawings. Use rechecks
ownership, exact ordered native equality and complete geometry verification, then
records one geometry-only bounded history operation. Stored graphs (including
handles, allocator and anchors) and entry-keyed viewports provide exact Undo/Redo;
no second recognition call reconstructs history. Even an identical-graph adoption
records a separate entry, so its viewport Fit cannot overwrite an older Undo record.
A regression covers repeated adoption and saved-state restoration. Scientific revision and analyzed
identity remain unchanged. Saved-content comparisons correctly recover the earlier
checkpoint, including a project with no explicit viewport.

Preview ownership includes document/draft identity, revisions, exact science and
graph, pending controls, unfinished gestures, viewport, ordered ports and monotone
interaction generation. Edit-and-restore retires consent; language changes do not.
Project read/confirmation guards and layout authorization remain independent.
Generation is synchronous/bounded, so no asynchronous proposal race is introduced.
No numerical kernel, native/project schema, renderer, tolerance or physical law changed.

### Automated and mathematical evidence

Clean `npm ci`, full `npm test` **542/542**, focused topology/browser tests **69/69**,
`npm run typecheck`, kernel/app/site builds, all six demos (`demo`, `demo:diode`,
`demo:diode-transient`, `demo:bjt`, `demo:rc-synthesis`, `demo:foster`), DOM-free
kernel/layout smoke and `git diff --check` passed. All original **513 tests and
expectations are unchanged**; 29 new integration tests exercise production event
handlers/controller paths, initial families, unsupported/unrecognized/oversized/
quality-rejected cases, exact unusual IDs, port ownership, pending work, history,
portable project checkpoints and conflicts.

Independent science checks across generated/adopted/history/project-parser states:
divider 8 V, 4 mA, source −4 mA; RC `0.5−0.5i` at 1000 rad/s; RLC `−10i` at
10000 rad/s; balanced bridge 5 V/5 V; unbalanced 70/13 V, 80/13 V and −1/1300 A;
Cauer/Foster impedance `1200−1600i` Ω at 1000 rad/s. Exact native equality is
checked separately from these floating-point physical experiments.

### Actual Chrome checks

Isolated Chrome loaded the clean locally served publishing package. Actual native
file inputs opened divider, RC low/high pass, RL/RLC, parallel R/RC, balanced and
unbalanced bridges, Cauer and Foster I/II. Their ordinary editable drawings match
the accepted c1 structural evidence. Source-free synthesis handoffs produced initial
layouts without manual port guessing. Unrecognized star kept the provisional graph.
Preview/Cancel/Use, exact Undo/Redo, pointer selection/movement, wire operations,
independent Form/JSON/Graphical drafts and stale edit-and-restore were exercised.

A completed `.cuf.json` download after adoption was reopened via the real file input
after page reload; another completed download matched the entire project exactly.
Saved geometry was not rearranged. Native JSON download and valid/malformed file
imports were also completed: malformed text preserved science. These were Chrome
protocol file selections, **not a human OS file-dialog gesture**. Deterministic tests
cover delayed read/confirmation races separately. All 35 examples opened; linear
RC plots, DC equivalence, resistor Preview/Use/Return, diode/BJT panels, all three
synthesis methods, handoffs, and active diode/synthesis worker cancellation passed.

EN/MN at 1280, 390 and 320 CSS px had no page overflow or application exceptions;
before/after drawings stack and scroll locally. Exact punctuation/markup-like port
IDs remain literal. Screenshots, completed project artifact and result records are
in [actual browser evidence](evidence/phase-6a3c2/README.md). Browser harness mistakes
(invalid example option, locale-dependent assertion and unsettled pointer scrolling)
were corrected and the completed runs repeated; they were not product fixes.

Fit-to-view bridge/Foster labels remain small. Raw SI values, hollow junctions,
vertical lower-lead detours and arbitrary font metrics remain the accepted visual
limitations. Zoom, inspector and topology table remain important. No physical touch
or screen-reader audit is claimed. Earlier c1 SVGs/screenshots are preserved.

### Clean publishing package and review gate

A second isolated clean-source package matches the browser-tested package byte for
byte and contains exactly `index.html`, `app.js`, `style.css`, with relative
SHA-256-derived version references:

- HTML `ae83f379cc1df5a35597c3a44a9e983a66eeef2a6d187fb14cb23301097170b1`
- JS `02e423cb7237429872a496c43f7b7d42f0d4df4e8f3929c78f71f422ee8ee571`
- CSS `ffe3882992cd48e9d85da7faf64c712bcfb1898a9ff620a68b7cb48b545469d2`

These intentionally differ from released main. Independent controller review of the
browser integration precedes any publication authorization. General autorouting,
interactive bend dragging, autosave/recovery, nonlinear graphical devices and
additional synthesis methods remain outside this task.
