# Circuits Unfolded

**A transparent laboratory for small-circuit analysis, reduction, and synthesis.**

Circuits Unfolded is a browser laboratory for learning and working with small electrical circuits. It aims to make ordinary calculations convenient while showing the element laws, assembled equations, modeling assumptions, and transformations that produce the answer.

The maintained mathematical core is teaching material too: substantive methods favor explicit stages, documented equations and numerical choices, and independently checked results so students can understand, validate, fork, and modify them. See the binding [readability policy](AGENTS.md) and [code guide](docs/CODE_GUIDE.md). Generated browser bundles may remain optimized.

The repository is named `circuits`. **Circuits Unfolded** is the working application name.

## Status

**Phase 6A2 is published:** [Graphical](docs/PHASE_6A2_SPECIFICATION.md) joins Form and JSON within Edit circuit. It constructs strict v1 R/C/L/V/I circuits with explicit wiring, junctions, source/storage/observation properties, undo/redo, and guarded Apply. Three independent drafts retain pending text and conflicts. Geometry is session-only, imported layouts are provisional, and ambiguous drawings show a warning plus the exact topology. Limits are 40 components, 240 vertices and 320 wires; controlled-source v1 and all v2/v3 remain unsupported in Graphical. Accepted implementation `2d1a725` passed main validation and Pages deployment; public graphical construction, history, file round trips and legacy checks passed. See the release evidence in [DECISIONS](docs/DECISIONS.md).

**Phase 6A1 is published:** the [headless wiring model](docs/PHASE_6A1_SPECIFICATION.md) provides explicit connectivity, atomic editing, native v1 R/C/L/V/I conversion, history and ownership guards. Its headless model underpins the published Phase 6A2 editor. See the [editor API](docs/WIRING_API.md).

**Phases 5A1–5A3 are published on `main`:** the bilingual [Synthesize workspace](docs/PHASE_5A3_SPECIFICATION.md) runs accepted exact RC Cauer and Foster I/II methods in a dedicated cancellable worker. It keeps exact target drafts separate from the applied circuit, compares three realizations with independent Z/Y samples, shows construction steps and bounded connected drawings, and explicitly adopts verified native circuits into one-port frequency analysis. Start with the prefilled three-realization target or four supplementary targets. Foster requires an exact supplied decomposition; unavailable decomposition does not mean nonrealizability. Numerically unresolved certificates remain inspectable but cannot Apply. The [public lab](https://gantemur.github.io/circuits/) retains all **35 examples**. Exact certificates, strict native generation and finite numerical evidence remain separate; JSON and status-bearing CSV downloads and protocol file reimports were verified on the public site. Accepted `55ba7cb` passed [main validation](https://github.com/gantemur/circuits/actions/runs/38478009065) and [Pages publication](https://github.com/gantemur/circuits/actions/runs/38478009066), with a byte-identical clean three-file package. A manual OS-picker interaction remains unverified.

**Phase 5A2 is published:** exact rational [RC Foster I and Foster II synthesis](docs/PHASE_5A2_SPECIFICATION.md) accepts supplied pole decompositions, checks constructive polynomial identities, builds distinct source-free native circuits and reuses independent MNA Z/Y/power verification. Run `npm run demo:foster` for a three-realization comparison with Cauer. General pole factorization remains excluded.

**Phase 5A1 is published:** the headless [exact RC Cauer synthesis kernel](docs/PHASE_5A1_SPECIFICATION.md) accepts rational impedance/admittance coefficients, returns an exact constructive certificate, generates source-free native v1 ladders, and independently checks Z, Y and RMS power through the existing MNA solver. Run `npm run demo:rc-synthesis`; see the [API](docs/KERNEL_API.md#phase-5a1-exact-rc-cauer-synthesis-headless-task-branch) and [reading path](docs/CODE_GUIDE.md#reading-the-phase-5a1-exact-rc-synthesis-kernel). Foster I/II and the browser workspace are supplied by the published Phases 5A2/5A3.

**Phase 3B1 and Phase 3B2 are published on `main`:** the [public lab](https://gantemur.github.io/circuits/) now has **35 examples**, including five bilingual NPN/PNP Ebers–Moll teaching circuits. Strict v3 documents support transistor DC operating points and terminal diagnostics, local RMS AC and unit-input frequency response, and model/source/load editing. See the [browser specification](docs/PHASE_3B2_SPECIFICATION.md), [kernel specification](docs/PHASE_3B1_SPECIFICATION.md), and [reading path](docs/CODE_GUIDE.md#reading-the-phase-3b2-browser-bjt-path). Custom v3 circuits use JSON; v3 Form construction, BJT transients, nonlinear ports/transforms, and source sweeps remain deferred. Retained v1/v2 Form drafts stay accessible with conflict protection. Mixed Q/D inspection uses the full coupled bias. Accepted implementation `32f7ae7` passed [validation](https://github.com/gantemur/circuits/actions/runs/38449302014) and [Pages publication](https://github.com/gantemur/circuits/actions/runs/38449302027); its public three-file package matched a clean build byte for byte. Actual public JSON/CSV downloads and protocol file reimports were checked; a manual OS-picker gesture remains unverified. Run `npm run demo:bjt` for the headless model.

**Phase 3A3 and Phase 3A4 are published on `main`:** the reviewed headless fixed-step nonlinear transient API for memoryless diodes and linear C/L storage now has an explicit Run/Cancel path in the existing Transient panel. A bundled Web Worker keeps its synchronous solve off the main thread. Four guided browser copies of the reviewed native fixtures brought that release to 30 presets, while exact source events, accepted-prefix failures, sample diagnostics, and CSV remain distinct from DC Q and RMS frequency analysis. Accepted implementation `015765af30d4c3ee07e02281d767d7f934020ddd` passed [main validation](https://github.com/gantemur/circuits/actions/runs/38427650973) and [Pages deployment](https://github.com/gantemur/circuits/actions/runs/38427650950); the public three-file package matched a clean build byte for byte. See the [Phase 3A3 kernel specification](docs/PHASE_3A3_SPECIFICATION.md), [Phase 3A4 browser specification](docs/PHASE_3A4_SPECIFICATION.md), and [reading path](docs/CODE_GUIDE.md#reading-the-phase-3a4-browser-transient-path).

**Phase 3A1 and Phase 3A2 are published on `main`:** the [browser lab](https://gantemur.github.io/circuits/) accepts strict v1 linear and v2 memoryless-diode documents and introduced the 26-example release, including four guided diode circuits. It added diode form/inspector editing, checked nonlinear DC bias, local tangent frequency analysis, terminal I–V curves, and a bounded cancellable DC source sweep. Reviewed implementation `941a2ee` passed [validation](https://github.com/gantemur/circuits/actions/runs/38277848745) and [Pages deployment](https://github.com/gantemur/circuits/actions/runs/38277848809); the public HTML and versioned assets matched the clean three-file package byte for byte. See the [Phase 3A2 specification](docs/PHASE_3A2_SPECIFICATION.md), [Phase 3A1 kernel contract](docs/PHASE_3A_SPECIFICATION.md), and [diode reading path](docs/CODE_GUIDE.md#reading-the-phase-3a1-diode-kernel).

**Phase 1A and Phase 1B are published on `main`:** they introduced eight editable examples, including the default voltage divider and an RC high-pass, plus native JSON editing and a form-based **Build / edit circuit** panel. The form constructs supported linear circuits without writing JSON. The Phase 0 TypeScript kernel computes DC and frequency responses, backward Euler transients where storage is present, and matrix provenance; the browser also provides verified preset schematics and JSON/CSV exports.

**Phase 1B is published on `main`:** the form builder includes draft validation, conflict protection, node-reference renaming, and English/Mongolian errors. The published Phase 6A2 Graphical mode complements Form and JSON editing.

**Phase 2A is published on `main`:** a DC Thévenin/Norton teaching panel lets users select two terminals and an external load, then compares the original circuit with independently solved equivalent realizations. The [main validation](https://github.com/gantemur/circuits/actions/runs/38106999862) and [Pages deployment](https://github.com/gantemur/circuits/actions/runs/38106999948) succeeded for release preparation commit `4243793`. The live [browser lab](https://gantemur.github.io/circuits/) was checked in English and Mongolian at 390 px, with no horizontal overflow or console errors. The published HTML, JS, and CSS matched the three-file publishing package byte for byte.

**UX workspaces redesign is published on `main`:** the lab now has a shared circuit bar, compact inspector, configurable Analyze panels, a dedicated Form/JSON editor, and a Transform workspace for the existing DC Thévenin/Norton comparison. The reviewed implementation `01bd698` passed [validation](https://github.com/gantemur/circuits/actions/runs/38116427472) and [Pages deployment](https://github.com/gantemur/circuits/actions/runs/38116427451). The live HTML, versioned JS, and CSS matched the three-file publishing package byte for byte. The [UX specification](docs/UX_SPECIFICATION.md) records the bounded behavior.

**Phase 2B is published on `main`:** the reviewed code `054522c` passed [validation](https://github.com/gantemur/circuits/actions/runs/38147925520) and [Pages deployment](https://github.com/gantemur/circuits/actions/runs/38147925593). The live three-file publishing package matched the build byte for byte. It added source-free passive resistor series/parallel, star–delta, delta–star, one-node star–mesh, and bulk Kron previews beside the existing DC one-port method. It compares full ordered terminal response matrices and offers strictly validated transformed native JSON. Its three source-free resistor examples began with honest topology tables and gained verified drawings in Phase 2D1. The [Phase 2B specification](docs/PHASE_2B_SPECIFICATION.md) states the supported boundary and acceptance cases.

**Phase 2C is published on `main`:** [the Phase 2C specification](docs/PHASE_2C_SPECIFICATION.md) adds one- and two-port frequency-domain Z/Y experiments, physical two-port loading comparisons, three source-free teaching examples, and an Analyze panel in both languages. It uses temporary tests of the existing linear device model and leaves native JSON and the DC Transform method unchanged.

**Phase 2D1 is published on `main`:** the resistor Transform method now requires an explicit preview, explains supported candidates and blockers, draws verified before/after networks, shows a declared terminal-voltage experiment, and can apply a current verified result or return to the session original with editor-draft protection. All 14 built-in examples have topology-matched SVG drawings and a shared English/Mongolian study guide. Four independently authored baseline response records are app metadata, not new kernel computations. Unreliable compact resistor layouts show exact topology tables; the five-resistor collision fixture reduces to `5000/3 Ω` without a misleading drawing. See the [Phase 2D1 specification](docs/PHASE_2D1_SPECIFICATION.md) and [release evidence](docs/DECISIONS.md#phase-2c-and-phase-2d1-public-release--11-october-2026).

**Phase 2D2 is published on `main`:** eight native examples bring the [browser lab](https://gantemur.github.io/circuits/) to 22 presets: connected three-section RC low/high-pass filters, ideal-follower Butterworth low/high-pass filters, two measurements of a series RLC resonator, and source-free RC/RL driving-point ladders. Each has a verified drawing, bilingual lesson, and fixed authored baseline reference. Numerical curves and port matrices still come from the unchanged kernel. The reviewed implementation `210e455` passed [validation](https://github.com/gantemur/circuits/actions/runs/38204191230) and [Pages deployment](https://github.com/gantemur/circuits/actions/runs/38204191229); the deployed three-file package matched the clean build byte for byte. The [Phase 2D2 specification](docs/PHASE_2D2_SPECIFICATION.md) gives the exact circuits, equations, and acceptance criteria.

**Earlier release record:** Phase 1B first deployed from `eacb35a` after successful [validation](https://github.com/gantemur/circuits/actions/runs/38104326176) and [Pages deployment](https://github.com/gantemur/circuits/actions/runs/38104326149). A public browser check verified the default divider and RC high-pass analyses, form-built custom circuit, invalid-draft preservation, builder synchronization and conflict behavior, node-name correction, and both languages at 390 px. Valid and malformed file imports worked. The browser did not capture the JSON export download event in that release check; an earlier browser pass verified export and round-trip import.

The earlier Phase 1A eight-example release from `7fd6c11` remains recorded in [DECISIONS.md](docs/DECISIONS.md) with its validation and deployment links.

The interface supports English and Mongolian Cyrillic. Use the **English / Монгол** buttons in the header to switch immediately; the selected language persists in browser storage when available. The language choice changes presentation only: native JSON field names and values, CSV headers and decimal format, SI symbols, circuit IDs, and computed results stay the same. See the [terminology glossary and export convention](docs/LOCALIZATION.md).

The analytic acceptance suite covers source signs, physical loading, initialization and breakpoints, refinement, singular/contradictory models, matrix provenance, and serialization. Phase 1A adds browser-model acceptance cases and browser checks. The published Phase 6A2 Graphical mode complements Form and JSON editing. The longer-term vision below describes planned capabilities.

## Run the browser lab

Use Node.js 22 or newer and npm. After `npm ci`, run:

```sh
npm run dev
```

Open the `Circuits Unfolded:` URL printed by the server, normally `http://127.0.0.1:4173/circuits/`. If port 4173 is occupied, the server selects a free local port and prints that URL instead. Set `PORT=4188 npm run dev` when you need an exact port; an occupied explicit port reports an error. `npm run dev` builds the kernel and app once, then serves the static files. After edits to source files, restart it to rebuild. `npm run preview` serves the current `dist/` build.

## Publish on GitHub Pages

The release target is [https://gantemur.github.io/circuits/](https://gantemur.github.io/circuits/). Run `npm run build:site` to create `publish/` with only `index.html`, `style.css`, and `app.js`. The HTML uses relative URLs under `/circuits/` with content-version queries so a newly deployed page loads its matching JS and CSS even when earlier assets remain in a browser cache. To preview that exact bundle locally, run `SITE_DIR=publish npm run preview` and open the printed URL. `publish/` is generated and ignored; `dist/` also contains kernel modules, declarations, test bundles, and source maps, so it is not the Pages artifact.

The [validation workflow](.github/workflows/validate.yml) runs on pushes and pull requests with Node 24, `npm ci`, tests, typecheck, and the application build. The [Pages workflow](.github/workflows/pages.yml) runs on `main` after its validation job succeeds, packages the static bundle, and deploys it using GitHub Pages actions. A manual run selected on any branch other than `main` skips deployment. Repository **Settings → Pages** uses **GitHub Actions** as the build and deployment source. To redeploy, use **Actions → Publish browser lab → Run workflow**, selecting `main`. No custom domain is configured. Confirm the deployment job succeeds and check the public URL in a browser before treating a release as live.

In the published lab, select an example from the shared circuit bar. The divider opens with **DC solution** and **DC port characteristics**; choose R1 in the schematic or inspector to change its resistance without entering the editor. RC/RL/RLC examples open with **Frequency response** and **Transient response** panels. Each panel has its own settings, input/output choices, reorder/collapse/full-width actions, and CSV export where supported. Use **Add analysis** for a third panel, including a second frequency panel with an independent output or sweep. Invalid panel text remains for correction; linear panels retain their last valid calculation, while the v2 transient panel retires an obsolete run. **Restore suggested layout** explicitly resets panel settings and pending panel text; ordinary example changes adopt a suggestion only when the current suggested layout is untouched and has no pending panel text.

Use **Edit circuit** to open the dedicated Form or JSON view. Leaving it keeps each unapplied draft; **New** starts an empty form draft without changing the validated circuit. Shared source and initialization controls are behind **Sources & initial conditions** beside the inspector. **Transform** hosts the DC Thévenin/Norton comparison and the passive resistor methods. Choose ordered retained terminals, an operation, and its operands, then press **Preview transformation** to inspect terminal matrices and validated transformed JSON without changing the analyzed circuit; **Use transformed circuit** is a separate explicit action. **Open comparison** from a port panel selects DC and carries its ordered port and load; returning to resistor transformations restores their settings. Analyze/Transform navigation preserves the validated circuit, panel layout, editor drafts, and Transform settings. Panel layout is browser-only state, absent from native v1 JSON and not persisted across sessions. There is no Synthesize tab until an implemented method exists. Invalid JSON or form input preserves the validated circuit and keeps the draft correctable; an edited draft from an older document cannot be applied until explicitly reloaded. Exported JSON contains only the strict native circuit/experiment document, without drawing or panel metadata. The DC comparison rejects capacitors and inductors and reports zero/negative resistance and solve failures explicitly.

The resistor method adds **Preview transformation** before any result, leading physical interpretation and before/after drawings, expandable diagnostics, **Use transformed circuit**, and **Return to original circuit**. Unapplied Form or JSON drafts require explicit confirmation and remain intact as conflicts. The DC Thévenin/Norton method remains a comparison without an apply action. The bottom study guide is available in Analyze and Transform and identifies baseline targets separately from current kernel results.

**Port analysis — frequency** is another Analyze panel type. Select ordered one- or two-port terminals and, when appropriate, explicitly exclude an existing independent voltage drive across port 1. Single-frequency Z/Y matrices, a logarithmic entry sweep, and two-port loading are separate views. The loading table distinguishes source-to-output gain `V₂/Vs` from terminal gain `V₂/V₁`; it compares predictions from each available matrix with a physically connected 1 V RMS source and load. The T, RC-section, and connected-RC presets start with this panel; each has a verified drawing and an expandable exact topology table. A zero-frequency RC section has a valid Y matrix even when the open-port Z test cannot be solved.

The source-free impedance ladders start with a one-port Z sweep at `(in,0)`; the RC ladder explicitly shows valid DC Y and unavailable finite DC Z. The six new transfer filters start with numerical frequency and transient panels. A panel's selected RLC voltage observation moves the polarity marks on the drawing; other panels keep independent choices. Editing components changes live kernel results while the lesson's authored coefficients remain labeled as the unedited baseline.

## Run the kernel

Use Node.js 22 or newer and npm. This implementation was verified with Node 26.4.0 and npm 11.17.0. TypeScript 5.9.3 and esbuild 0.25.12 are pinned development dependencies; the kernel has no runtime dependencies.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run demo
```

`npm test` builds the kernel and app first and runs the Node test runner. `npm run build` emits ESM modules and declarations in `dist/`, plus the standalone `dist/browser.js` kernel bundle. `npm run build:app` also emits `dist/app.js`, `dist/index.html`, and `dist/style.css`. `npm run demo` prints the linear RC and reduction analyses. `npm run demo:diode` prints headless nonlinear DC bias, signed currents, residuals, Newton trace, differential resistance, and a local RC tangent response. The browser imports v2 through a strict version router; it does not change the v1 parser or kernel API.

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

The published site has 30 examples with topology-matched drawings, including eight diode circuits. Both native versions keep exact topology tables and conservative fallback for unmatched circuits. There is no draggable wiring canvas or general custom schematic autorouter. Ordinary numerical sweeps are capped at 241 points, port and diode DC sweeps at 121 points, and transient work at 3000 intervals. A nonlinear browser solve is bounded to 64 unknowns. Zero magnitude has undefined logarithmic magnitude and phase; failed samples are gaps with statuses. Browser plots are numerical, and algebraic extraction remains restricted to the kernel's one-storage-element cases. The app does not infer internal stability from an input-output denominator.

Phase 3A4 is the current public release. Transform includes positive-resistor-only methods and DC one-port comparison; neither accepts a v2 diode circuit. Phase 2C added bounded one/two-port Z/Y sampling and loading; Phase 2D1 added the visual transformation workflow; Phase 2D2 added eight examples. Phase 3A2 makes the Phase 3A1 **memoryless** diode available in the browser for DC and local incremental frequency experiments. Its source sweep is a sampled branch, not a uniqueness or hysteresis certificate. Temperature changes thermal voltage while supplied saturation current stays fixed; no breakdown, charge, self-heating, calibrated device data, general nonlinear port reduction, synthesis, or graphical wiring is claimed. Phase 3A3/3A4 add bounded nonlinear time analysis without claiming adaptive error control, unique roots, stability, or periodic steady state. The full-state solver may reject a network with undetermined internal currents even if terminal behavior is unique. The Phase 3A4 public-browser check completed native JSON and transient CSV downloads, reimported the exported JSON, and rejected malformed input without replacing the circuit. File selection used the Chrome protocol; a manual OS file-picker gesture remains unverified. CSV checks included event sides, exact-ID quoting, and accepted-prefix failure rows.

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
| [docs/PHASE_2D2_SPECIFICATION.md](docs/PHASE_2D2_SPECIFICATION.md) | Eight additional linear examples, filters, and impedance ladders |
| [docs/PHASE_3A_SPECIFICATION.md](docs/PHASE_3A_SPECIFICATION.md) | Headless diode bias and local tangent contract; later browser boundary |
| [docs/PHASE_3A2_SPECIFICATION.md](docs/PHASE_3A2_SPECIFICATION.md) | Published browser diode lab scope |
| [docs/PHASE_3A3_SPECIFICATION.md](docs/PHASE_3A3_SPECIFICATION.md) | Reviewed headless nonlinear transient contract |
| [docs/PHASE_3A4_SPECIFICATION.md](docs/PHASE_3A4_SPECIFICATION.md) | Task-branch browser nonlinear transient lab scope and acceptance |
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

**Phase 6A3a is a headless task-branch implementation:** the
[portable project core](docs/PROJECT_FORMAT.md) pairs unchanged native scientific
JSON with a strictly checked drawing. It supplies pure validation, reconstruction,
export and saved-content comparison; browser Save/Open and persistent geometry
controls are not yet implemented. The published application is unchanged.
