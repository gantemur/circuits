# Circuits Unfolded

**A transparent laboratory for small-circuit analysis, reduction, and synthesis.**

Circuits Unfolded is a browser laboratory for learning and working with small electrical circuits. It aims to make ordinary calculations convenient while showing the element laws, assembled equations, modeling assumptions, and transformations that produce the answer.

The maintained mathematical core is teaching material too: substantive methods favor explicit stages, documented equations and numerical choices, and independently checked results so students can understand, validate, fork, and modify them. See the binding [readability policy](AGENTS.md) and [code guide](docs/CODE_GUIDE.md). Generated browser bundles may remain optimized.

The repository is named `circuits`. **Circuits Unfolded** is the working application name.

## Status

**Phase 1A and Phase 1B are published on `main`:** the browser lab has eight editable examples, including the default voltage divider and an RC high-pass, plus native JSON editing and a form-based **Build / edit circuit** panel. The form constructs supported linear circuits without writing JSON. The Phase 0 TypeScript kernel computes DC and frequency responses, backward Euler transients where storage is present, and matrix provenance; the browser also provides verified preset schematics and JSON/CSV exports.

**Phase 1B is published on `main`:** the form builder includes draft validation, conflict protection, node-reference renaming, and English/Mongolian errors. A graphical wiring editor remains future work.

**Phase 2A is published on `main`:** a DC Thévenin/Norton teaching panel lets users select two terminals and an external load, then compares the original circuit with independently solved equivalent realizations. The [main validation](https://github.com/gantemur/circuits/actions/runs/38106999862) and [Pages deployment](https://github.com/gantemur/circuits/actions/runs/38106999948) succeeded for release preparation commit `4243793`. The live [browser lab](https://gantemur.github.io/circuits/) was checked in English and Mongolian at 390 px, with no horizontal overflow or console errors. The published HTML, JS, and CSS matched the three-file publishing package byte for byte.

**UX workspaces redesign is published on `main`:** the lab now has a shared circuit bar, compact inspector, configurable Analyze panels, a dedicated Form/JSON editor, and a Transform workspace for the existing DC Thévenin/Norton comparison. The reviewed implementation `01bd698` passed [validation](https://github.com/gantemur/circuits/actions/runs/38116427472) and [Pages deployment](https://github.com/gantemur/circuits/actions/runs/38116427451). The live HTML, versioned JS, and CSS matched the three-file publishing package byte for byte. The [UX specification](docs/UX_SPECIFICATION.md) records the bounded behavior.

**Phase 2B is published on `main`:** the reviewed code `054522c` passed [validation](https://github.com/gantemur/circuits/actions/runs/38147925520) and [Pages deployment](https://github.com/gantemur/circuits/actions/runs/38147925593). The live three-file publishing package matched the build byte for byte. It adds source-free passive resistor series/parallel, star–delta, delta–star, one-node star–mesh, and bulk Kron previews beside the existing DC one-port method. It compares full ordered terminal response matrices and offers strictly validated transformed native JSON without replacing the analyzed circuit. Three source-free resistor examples use honest topology tables. The [Phase 2B specification](docs/PHASE_2B_SPECIFICATION.md) states the supported boundary and acceptance cases.

**Phase 2C is implemented on the task branch, not yet published:** [the Phase 2C specification](docs/PHASE_2C_SPECIFICATION.md) adds one- and two-port frequency-domain Z/Y experiments, physical two-port loading comparisons, three source-free teaching examples, and an Analyze panel in both languages. It uses temporary tests of the existing linear device model and leaves native JSON and the DC Transform method unchanged. The public Pages site still reflects the last released `main` until this branch is separately reviewed and integrated.

**Phase 2D1 is implemented on `codex/phase-2d-visual-learning`, not published:** it builds on the unmerged Phase 2C branch. The resistor Transform method now requires an explicit preview, explains supported candidates and blockers, draws the verified before/after networks, shows a declared terminal-voltage experiment, and can apply a current verified result or return to the session original with editor-draft protection. All 14 built-in examples have topology-matched SVG drawings and a shared English/Mongolian study guide. Four independently authored baseline response records are app metadata, not new kernel computations. See the [Phase 2D1 specification](docs/PHASE_2D1_SPECIFICATION.md). The public Pages site still serves the last released `main`; this branch is neither merged nor deployed.

**Earlier release record:** Phase 1B first deployed from `eacb35a` after successful [validation](https://github.com/gantemur/circuits/actions/runs/38104326176) and [Pages deployment](https://github.com/gantemur/circuits/actions/runs/38104326149). A public browser check verified the default divider and RC high-pass analyses, form-built custom circuit, invalid-draft preservation, builder synchronization and conflict behavior, node-name correction, and both languages at 390 px. Valid and malformed file imports worked. The browser did not capture the JSON export download event in that release check; an earlier browser pass verified export and round-trip import.

The earlier Phase 1A eight-example release from `7fd6c11` remains recorded in [DECISIONS.md](docs/DECISIONS.md) with its validation and deployment links.

The interface supports English and Mongolian Cyrillic. Use the **English / Монгол** buttons in the header to switch immediately; the selected language persists in browser storage when available. The language choice changes presentation only: native JSON field names and values, CSV headers and decimal format, SI symbols, circuit IDs, and computed results stay the same. See the [terminology glossary and export convention](docs/LOCALIZATION.md).

The analytic acceptance suite covers source signs, physical loading, initialization and breakpoints, refinement, singular/contradictory models, matrix provenance, and serialization. Phase 1A adds browser-model acceptance cases and browser checks. A graphical wiring editor remains future work. The longer-term vision below describes planned capabilities.

## Run the browser lab

Use Node.js 22 or newer and npm. After `npm ci`, run:

```sh
npm run dev
```

Open the `Circuits Unfolded:` URL printed by the server, normally `http://127.0.0.1:4173/circuits/`. If port 4173 is occupied, the server selects a free local port and prints that URL instead. Set `PORT=4188 npm run dev` when you need an exact port; an occupied explicit port reports an error. `npm run dev` builds the kernel and app once, then serves the static files. After edits to source files, restart it to rebuild. `npm run preview` serves the current `dist/` build.

## Publish on GitHub Pages

The release target is [https://gantemur.github.io/circuits/](https://gantemur.github.io/circuits/). Run `npm run build:site` to create `publish/` with only `index.html`, `style.css`, and `app.js`. The HTML uses relative URLs under `/circuits/` with content-version queries so a newly deployed page loads its matching JS and CSS even when earlier assets remain in a browser cache. To preview that exact bundle locally, run `SITE_DIR=publish npm run preview` and open the printed URL. `publish/` is generated and ignored; `dist/` also contains kernel modules, declarations, test bundles, and source maps, so it is not the Pages artifact.

The [validation workflow](.github/workflows/validate.yml) runs on pushes and pull requests with Node 24, `npm ci`, tests, typecheck, and the application build. The [Pages workflow](.github/workflows/pages.yml) runs on `main` after its validation job succeeds, packages the static bundle, and deploys it using GitHub Pages actions. A manual run selected on any branch other than `main` skips deployment. Repository **Settings → Pages** uses **GitHub Actions** as the build and deployment source. To redeploy, use **Actions → Publish browser lab → Run workflow**, selecting `main`. No custom domain is configured. Confirm the deployment job succeeds and check the public URL in a browser before treating a release as live.

In the published lab, select an example from the shared circuit bar. The divider opens with **DC solution** and **DC port characteristics**; choose R1 in the schematic or inspector to change its resistance without entering the editor. RC/RL/RLC examples open with **Frequency response** and **Transient response** panels. Each panel has its own settings, input/output choices, reorder/collapse/full-width actions, and CSV export where supported. Use **Add analysis** for a third panel, including a second frequency panel with an independent output or sweep. Invalid panel text remains for correction while its last valid result stays visible. **Restore suggested layout** explicitly resets panel settings and pending panel text; ordinary example changes adopt a suggestion only when the current suggested layout is untouched and has no pending panel text.

Use **Edit circuit** to open the dedicated Form or JSON view. Leaving it keeps each unapplied draft; **New** starts an empty form draft without changing the validated circuit. Shared source and initialization controls are behind **Sources & initial conditions** beside the inspector. **Transform** hosts the DC Thévenin/Norton comparison and the passive resistor methods. Choose ordered retained terminals, an operation, and its operands to inspect terminal matrices and validated transformed JSON without changing the analyzed circuit. **Open comparison** from a port panel selects DC and carries its ordered port and load; returning to resistor transformations restores their settings. Analyze/Transform navigation preserves the validated circuit, panel layout, editor drafts, and Transform settings. Panel layout is browser-only state, absent from native v1 JSON and not persisted across sessions. There is no Synthesize tab until an implemented method exists. Invalid JSON or form input preserves the validated circuit and keeps the draft correctable; an edited draft from an older document cannot be applied until explicitly reloaded. Exported JSON contains only the strict native circuit/experiment document, without drawing or panel metadata. The DC comparison rejects capacitors and inductors and reports zero/negative resistance and solve failures explicitly.

On this Phase 2D1 task branch, the resistor method adds **Preview transformation** before any result, leading physical interpretation and before/after drawings, expandable diagnostics, **Use transformed circuit**, and **Return to original circuit**. Unapplied Form or JSON drafts require explicit confirmation and remain intact as conflicts. The DC Thévenin/Norton method remains a comparison without an apply action. The bottom study guide is available in Analyze and Transform and identifies baseline targets separately from current kernel results.

On this Phase 2D1 branch, inherited from Phase 2C, **Port analysis — frequency** is another Analyze panel type. Select ordered one- or two-port terminals and, when appropriate, explicitly exclude an existing independent voltage drive across port 1. Single-frequency Z/Y matrices, a logarithmic entry sweep, and two-port loading are separate views. The loading table distinguishes source-to-output gain `V₂/Vs` from terminal gain `V₂/V₁`; it compares predictions from each available matrix with a physically connected 1 V RMS source and load. The T, RC-section, and connected-RC presets start with this panel. On the Phase 2D1 branch, each has a verified drawing and an expandable exact topology table. A zero-frequency RC section has a valid Y matrix even when the open-port Z test cannot be solved.

## Run the kernel

Use Node.js 22 or newer and npm. This implementation was verified with Node 26.4.0 and npm 11.17.0. TypeScript 5.9.3 and esbuild 0.25.12 are pinned development dependencies; the kernel has no runtime dependencies.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run demo
```

`npm test` builds the kernel and app first and runs the Node test runner. `npm run build` emits ESM modules and declarations in `dist/`, plus the standalone `dist/browser.js` kernel bundle. `npm run build:app` also emits `dist/app.js`, `dist/index.html`, and `dist/style.css`. `npm run demo` prints the RC element laws, labeled matrices and contributions, DC/frequency/transfer results, step refinement, controlled-source examples, Kron reduction, and explicit failure diagnostics. It needs no private book files.

```js
import { assemble, parseDocument, transfer, complex } from './dist/index.js';

const document = parseDocument(jsonText); // e.g. fixtures/rc.json
const model = assemble(document.circuit);
const result = transfer(model, 'Vin', 'out', complex(0, 1000));
// status: 'ok', H(j1000) = 0.5 - 0.5j, magnitude = 1/sqrt(2)
```

See [the API and native format](docs/KERNEL_API.md), [fixture formulas](fixtures/README.md), and [implementation decisions](docs/DECISIONS.md). Every fixture specifies its sources, connected loads, observations, and initialization.

## Current limits and next milestone

The solver uses dense floating-point systems for small linear circuits. It reports numerical rank/consistency and physical residuals, not certified conditioning or device accuracy. Initializers reject unsupported impulsive/high-index cases. Algebraic transfer extraction is limited to one storage element with a single dynamic diagonal and an invertible algebraic block; other supported circuits still have numerical frequency evaluation. Fixed-step backward Euler is first order and has no adaptive error control.

On this Phase 2D1 branch, all 14 built-in examples have topology-matched drawings with current values and an expandable exact topology table. Custom or imported topologies without a matching layout use the named node/component table; generated small resistor networks use a labeled deterministic node-edge diagram, with a table fallback for large networks. The form builder and JSON editor both create strict native v1 documents, alongside file import/export. There is no draggable wiring canvas or automatic custom schematic layout. Ordinary numerical sweeps are capped at 241 points, port sweeps at 121 points, and transient work at 3000 intervals. Zero magnitude has undefined logarithmic magnitude and phase; failed samples are gaps with statuses. Browser plots are numerical, and algebraic extraction remains restricted to the kernel's one-storage-element cases. The app does not infer internal stability from an input-output denominator.

Phase 2B is the current public release. Transform includes the positive-resistor-only methods specified in [PHASE_2B_SPECIFICATION.md](docs/PHASE_2B_SPECIFICATION.md) and the DC one-port method in [PHASE_2A_SPECIFICATION.md](docs/PHASE_2A_SPECIFICATION.md). No sources or storage devices are reduced, and no internal voltages or branch currents are claimed preserved. Phase 2C adds bounded one/two-port Z/Y sampling and loading; Phase 2D1 adds visual transformation workflow, drawings, and guides on the task branch. Neither is published. The next planned job is richer linear examples and filter experiments, including passive ladders, buffered cascades, Butterworth low-/high-pass, band-pass, and notch examples. Dynamic reduction, nonlinear models, synthesis, and graphical wiring remain later work. The current full-state solver can reject a network with undetermined internal currents even if terminal behavior is unique.

## Intended laboratory

The completed lab will support, within a documented small-circuit model class:

- DC bias, parameter sweeps, linearization, and time-domain simulation;
- transfer functions, frequency responses, step and impulse responses, and poles and zeros;
- small amplifiers, filters, rectifiers, and sinusoidal or relaxation oscillators;
- ideal teaching elements alongside useful diode and transistor compact models;
- interactive Thévenin, Norton, superposition, reciprocity, and power demonstrations;
- series/parallel, source, star–delta, star–mesh, and Kron transformations;
- selected passive synthesis, progressing from Foster and Cauer to more general constructions.

The defining feature is the connection between three views: schematic and physical measurements; equations and responses; equivalent circuits and construction steps.

## Start here

| Document | Purpose |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Instructions for coding agents and contributors |
| [docs/VISION.md](docs/VISION.md) | Full product direction and staged development |
| [docs/MVP_SPECIFICATION.md](docs/MVP_SPECIFICATION.md) | Exact scope and acceptance criteria for Phase 0 |
| [docs/PHASE_1_SPECIFICATION.md](docs/PHASE_1_SPECIFICATION.md) | Scope and acceptance criteria for the Phase 1A browser lab |
| [docs/PHASE_1B_SPECIFICATION.md](docs/PHASE_1B_SPECIFICATION.md) | Scope and acceptance criteria for the Phase 1B form builder |
| [docs/PHASE_2A_SPECIFICATION.md](docs/PHASE_2A_SPECIFICATION.md) | DC one-port scope, conventions, and acceptance cases |
| [docs/PHASE_2D1_SPECIFICATION.md](docs/PHASE_2D1_SPECIFICATION.md) | Task-branch visual transformation and guided-example scope |
| [docs/LOCALIZATION.md](docs/LOCALIZATION.md) | English/Mongolian terminology and language-neutral export convention |
| [docs/MATHEMATICAL_CONVENTIONS.md](docs/MATHEMATICAL_CONVENTIONS.md) | Terminal signs, matrix signs, phasors, units, and evidence conventions |
| [docs/REFERENCE_WORKFLOW.md](docs/REFERENCE_WORKFLOW.md) | How the companion book is supplied and used without publishing it |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Settled choices and current milestone |
| [docs/CODEX_START.md](docs/CODEX_START.md) | Ready-to-use first Codex prompts |
| [docs/KERNEL_API.md](docs/KERNEL_API.md) | Implemented APIs, native schema, diagnostics, and limitations |
| [docs/CODE_GUIDE.md](docs/CODE_GUIDE.md) | Reading paths from device laws through solutions and transformations |
| [fixtures/README.md](fixtures/README.md) | Acceptance fixtures and independent expected equations |

## Companion book

The lab accompanies *Circuit Theory: Structure, Response, and Synthesis — A Mathematical Treatment of Lumped Electrical Networks*, by Tsogtgerel Gantumur. The book is a mathematical and educational reference; the application has its own bounded implementation specification.

The book manuscript and its source tree are not distributed in this repository. Contributors can work from the public conventions and acceptance fixtures. Author-supplied private reference material is handled according to [the reference workflow](docs/REFERENCE_WORKFLOW.md).

## Technical direction

The application runs entirely in the browser and produces static assets for GitHub Pages hosting. The mathematical kernel, including the DC one-port and resistor-transform helpers, is independent of the interface and also runs under Node for tests and reproducible calculations. It uses TypeScript, modified nodal analysis, small real and complex linear solves, and a descriptor-system formulation.

No account, runtime server, or external AI API is required to use the built app. During development, coding assistants can help implement and check the software.

## Licensing

Original repository code and documentation are released under the [MIT license](LICENSE). The companion book, privately supplied references, and third-party device models are outside that grant. Future imported models must carry their own provenance and license information.
