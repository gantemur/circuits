# Circuits Unfolded

**A transparent laboratory for small-circuit analysis, reduction, and synthesis.**

Circuits Unfolded is a browser laboratory for learning and working with small electrical circuits. It aims to make ordinary calculations convenient while showing the element laws, assembled equations, modeling assumptions, and transformations that produce the answer.

The repository is named `circuits`. **Circuits Unfolded** is the working application name.

## Status

**Phase 0 is implemented:** a browser-compatible, headless TypeScript linear circuit kernel with validated native JSON, R/C/L and all four controlled sources, inspectable MNA assembly, DC and complex-frequency analysis, restricted first-order transfer extraction, backward Euler transients, and resistor Kron reduction.

The analytic acceptance suite covers source signs, physical loading, initialization and breakpoints, refinement, singular/contradictory models, matrix provenance, and serialization. A graphical interface and schematic editor remain future work. The longer-term vision below describes planned capabilities.

## Run the kernel

Use Node.js 22 or newer and npm. This implementation was verified with Node 26.4.0 and npm 11.17.0. TypeScript 5.9.3 and esbuild 0.25.12 are pinned development dependencies; the kernel has no runtime dependencies.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run demo
```

`npm test` builds first and runs the Node test runner. `npm run build` emits ESM modules and declarations in `dist/`, plus the standalone `dist/browser.js` bundle. `npm run demo` prints the RC element laws, labeled matrices and contributions, DC/frequency/transfer results, step refinement, controlled-source examples, Kron reduction, and explicit failure diagnostics. It needs no private book files.

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

The next bounded milestone is Phase 1: a browser linear lab for the validated filters and controlled-source amplifiers, with response plots, matrix/contribution inspection, and native JSON load/save. Nonlinear models, general symbolic analysis, synthesis, graphical editing, and deployment were not added in Phase 0.

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

The eventual application will run entirely in the browser and is intended for GitHub Pages. The implemented mathematical kernel is independent of the interface and also runs under Node for tests and reproducible calculations. It uses TypeScript, modified nodal analysis, small real and complex linear solves, and a descriptor-system formulation.

No account, server, or external AI API is required to use the eventual lab. During development, coding assistants can help implement and check the software.

## Licensing

Original repository code and documentation are released under the [MIT license](LICENSE). The companion book, privately supplied references, and third-party device models are outside that grant. Future imported models must carry their own provenance and license information.
