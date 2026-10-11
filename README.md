# Circuits Unfolded

**A transparent laboratory for small-circuit analysis, reduction, and synthesis.**

Circuits Unfolded is a browser laboratory for learning and working with small electrical circuits. It aims to make ordinary calculations convenient while showing the element laws, assembled equations, modeling assumptions, and transformations that produce the answer.

The repository is named `circuits`. **Circuits Unfolded** is the working application name.

## Status

**Phase 1A and Phase 1B are published on `main`:** the browser lab has eight editable examples, including the default voltage divider and an RC high-pass, plus native JSON editing and a form-based **Build / edit circuit** panel. The form constructs supported linear circuits without writing JSON. The Phase 0 TypeScript kernel computes DC and frequency responses, backward Euler transients where storage is present, and matrix provenance; the browser also provides verified preset schematics and JSON/CSV exports.

**Phase 1B is published on `main`:** the form builder includes draft validation, conflict protection, node-reference renaming, and English/Mongolian errors. A graphical wiring editor remains future work.

**Phase 2A is prepared for release from `codex/phase-2a-one-port`:** a DC Thévenin/Norton teaching panel lets users select two terminals and an external load, then compares the original circuit with independently solved equivalent realizations. The public Phase 2A deployment is not yet verified; the last verified public release is Phase 1B.

**Release status:** Phase 1B first deployed from `eacb35a` at [https://gantemur.github.io/circuits/](https://gantemur.github.io/circuits/) after successful [validation](https://github.com/gantemur/circuits/actions/runs/38104326176) and [Pages deployment](https://github.com/gantemur/circuits/actions/runs/38104326149). A public browser check verified the default divider and RC high-pass analyses, form-built custom circuit, invalid-draft preservation, builder synchronization and conflict behavior, node-name correction, and both languages at 390 px. Valid and malformed file imports worked. The browser did not capture the JSON export download event in this release check, so that interaction remains unverified here; an earlier browser pass verified export and round-trip import. This status update changes documentation only, not the application assets.

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

Start with the **voltage divider**: change R1, R2, or Vin and inspect the kernel-computed DC value and constant transfer. Choose **RC high-pass** to see zero DC gain and the output jump at a source step. Use **Edit circuit JSON** to enter a supported native document, **Apply JSON** to validate and load it, or **Restore current circuit** to discard the editor draft. Invalid JSON leaves the current circuit intact. For the original low-pass demonstration, select **RC low-pass**, select **R**, and change 1000 Ω to 2000 Ω. The AC result at the inspect frequency changes from `0.5−0.5j` to `0.2−0.4j`, and the transfer and transient plots recompute. Select R again to see its terminal law and highlighted `K` matrix contributions. Source DC, RMS AC phasors, time waveform, and initial storage state have separate controls. Exported JSON is the strict kernel document, without drawing metadata.

Use **Build / edit circuit** to start an empty circuit or copy the current one. Add nodes, components, sources, and named outputs; choose terminals and control branches; then **Apply circuit** to validate and analyze. **Discard draft** reloads the current validated circuit. An incomplete draft does not change results. An untouched form follows example changes and imports; an edited form retains its draft and blocks Apply if the analyzed circuit changes. Rejected node names remain correctable through other node additions and removals. Only the validated circuit is exported. The form supports all existing kernel devices and source waveforms; it does not draw custom wiring.

In the Phase 2A release candidate, use **Equivalent circuit** to choose distinct positive and negative port nodes and a positive external load resistance. The panel reports open-circuit voltage, test-source resistance, and Norton current, then solves the original, Thévenin, and Norton circuits with that load. It shows signs, source suppression, the short-circuit cross-check, physical residuals, and numerical agreement limits. Existing components across the selected port remain part of the original network. This DC experiment explicitly rejects capacitors and inductors; it does not change the saved native document or an unapplied form/JSON draft.

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

The lab supports eight preset drawings; a valid custom or imported topology outside them gets a named node/component table. The form builder and JSON editor both create strict native v1 documents, alongside file import/export. There is no draggable wiring canvas or automatic custom schematic layout. Its numerical sweep is capped at 241 points and transient work at 3000 intervals. Zero magnitude has undefined logarithmic magnitude and phase; failed samples are gaps with statuses. Browser plots are numerical, and algebraic extraction remains restricted to the kernel's one-storage-element cases. The app does not infer internal stability from an input-output denominator.

Phase 2A is the current release candidate. Its DC-only, finite-positive-resistance one-port workflow is specified in [PHASE_2A_SPECIFICATION.md](docs/PHASE_2A_SPECIFICATION.md). Frequency/transient equivalents, general theorem/reduction UI, nonlinear models, synthesis, and graphical wiring remain later work. The current full-state solver can reject a network with undetermined internal currents even if terminal behavior is unique.

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
| [docs/LOCALIZATION.md](docs/LOCALIZATION.md) | English/Mongolian terminology and language-neutral export convention |
| [docs/MATHEMATICAL_CONVENTIONS.md](docs/MATHEMATICAL_CONVENTIONS.md) | Terminal signs, matrix signs, phasors, units, and evidence conventions |
| [docs/REFERENCE_WORKFLOW.md](docs/REFERENCE_WORKFLOW.md) | How the companion book is supplied and used without publishing it |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Settled choices and current milestone |
| [docs/CODEX_START.md](docs/CODEX_START.md) | Ready-to-use first Codex prompts |
| [docs/KERNEL_API.md](docs/KERNEL_API.md) | Implemented APIs, native schema, diagnostics, and limitations |
| [fixtures/README.md](fixtures/README.md) | Acceptance fixtures and independent expected equations |

## Companion book

The lab accompanies *Circuit Theory: Structure, Response, and Synthesis — A Mathematical Treatment of Lumped Electrical Networks*, by Tsogtgerel Gantumur. The book is a mathematical and educational reference; the application has its own bounded implementation specification.

The book manuscript and its source tree are not distributed in this repository. Contributors can work from the public conventions and acceptance fixtures. Author-supplied private reference material is handled according to [the reference workflow](docs/REFERENCE_WORKFLOW.md).

## Technical direction

The Phase 2A application runs entirely in the browser and produces static assets for GitHub Pages hosting. The mathematical kernel, including the DC one-port helper, is independent of the interface and also runs under Node for tests and reproducible calculations. It uses TypeScript, modified nodal analysis, small real and complex linear solves, and a descriptor-system formulation.

No account, runtime server, or external AI API is required to use the built app. During development, coding assistants can help implement and check the software.

## Licensing

Original repository code and documentation are released under the [MIT license](LICENSE). The companion book, privately supplied references, and third-party device models are outside that grant. Future imported models must carry their own provenance and license information.
