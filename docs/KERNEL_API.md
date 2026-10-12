# Phase 0 kernel API and native format

Import the ESM entry `dist/index.js` after `npm run build`, or the self-contained `dist/browser.js` in a browser. Declarations accompany the ESM modules. Production code has no runtime dependencies or Node/DOM imports. The TypeScript build uses only the ES2022 library, so browser globals are not available to the kernel at compile time.

## Native document

`parseDocument(json)` returns a validated `{ circuit, experiment }`; `serializeDocument(document)` validates and serializes it. Both inner objects have `schemaVersion: 1`. Unknown fields are rejected rather than discarded. Optional `label` fields are supported on circuits, components, observations, and experiments. IDs are nonempty, case-sensitive strings, unique within their category. Assembly uses lexical ID order, independently of JSON array ordering.

```json
{
  "circuit": {
    "schemaVersion": 1,
    "nodes": ["0", "in", "out"],
    "components": [
      {"id":"Vin","type":"V","p":"in","n":"0"},
      {"id":"R","type":"R","p":"in","n":"out","value":1000},
      {"id":"C","type":"C","p":"out","n":"0","value":0.000001}
    ],
    "observations": [
      {"id":"out","type":"voltage","p":"out","n":"0"},
      {"id":"capacitor","type":"current","component":"C"}
    ]
  },
  "experiment": {
    "schemaVersion": 1,
    "sources": [
      {"id":"Vin","dc":1,"ac":{"re":1,"im":0},
       "waveform":{"type":"step","at":0,"before":0,"after":1}}
    ],
    "initial":{"kind":"storage","values":[{"id":"C","value":0}]}
  }
}
```

Components always have ordered `(p,n)` terminals. `v=Vp-Vn`, `i` flows p through the device to n, and absorbed power is `v*i`.

| Type | Additional fields | Terminal law |
| --- | --- | --- |
| `R` | `value` in ohms | i=v/R |
| `C` | `value` in farads | i=C dv/dt |
| `L` | `value` in henries | v=L di/dt |
| `V` | None | v=u |
| `I` | None | i=u |
| `VCVS` | `cp`, `cn`, dimensionless `gain` | vo=gain*(Vcp-Vcn) |
| `VCCS` | `cp`, `cn`, `gain` in siemens | io=gain*(Vcp-Vcn) |
| `CCVS` | `control`, `gain` in ohms | vo=gain*ic |
| `CCCS` | `control`, dimensionless `gain` | io=gain*ic |

Passive values must be finite and strictly positive. Gains may be zero or negative. Current controllers name a retained `V`, `VCVS`, or `CCVS` branch by ID, with that branch's signed current. An explicit zero-volt `V` is the supported sensor. No hidden sensor is inserted. Inductor currents are retained but are not voltage-source-type controls in this schema.

Observations are either `{id,type:"voltage",p,n}` or `{id,type:"current",component}`. Every supported component current can be observed. Unsupported devices and observations throw `ValidationError` with `status: "validation-error"`; electrical solvability is checked separately.

Experiments must list every independent source exactly once. Each has `id`, finite `dc`, optional complex `ac: {re,im}` (RMS phasor, absent means zero AC), and optional waveform (absent means constant `dc` in time). Sources have the units of their voltage/current coordinate.

| Waveform | Fields and interpretation |
| --- | --- |
| `constant` | `value` |
| `step` | `at` seconds, `before`, `after`; exact event time has distinct left/right values |
| `sinusoid` | `offset`, `amplitudePeak`, nonnegative `frequencyHz`, `phaseRadians`; offset + amplitudePeak*sin(2*pi*f*t+phase) |

One scheduled step per independent source is supported. The source DC, AC and time values are independent; a transient waveform never changes its DC coordinate. Numerical transfer unit excitation is a mathematical normalization, not an RMS/peak conversion.

Initialization is mandatory: `{kind:"equilibrium"}` or `{kind:"storage",values:[{id,value},...]}`. Explicit storage values include every capacitor's signed voltage and every inductor's signed current. General MNA variables/source currents cannot be assigned as initial values. All loading is represented by actual circuit components. Analysis settings are explicit call arguments, rather than extra fields in the version-1 document.

## Assembly and results

`assemble(circuit)` validates and snapshots circuit semantics. Its result is intended to be treated as read-only. Unknowns are sorted nonreference node voltages, then sorted inductor currents, then sorted voltage-source-type currents. Rows have the same node/branch ordering. Inputs and output rows are sorted by ID.

- `unknowns`: `V(node)` in V and `I(component)` in A.
- `rows`: `KCL(node)` in A and `law(component)` in V.
- `inputs`: source IDs, with V/A units. Source values live only in experiments.
- `E`, `K`, `B`: dense real arrays for `E*xdot + K*x = B*u`.
- `outputs`: fixed rows with `C`, `D` and `kind:"fixed"`, or capacitor-current derivative rows with `Q` and `kind:"derivative"`. Fixed rows implement `y=C*x+D*u`; a derivative row is `y=Q*xdot`. It is never presented as a fixed `C` row.
- `contributions`: component ID, matrix, row/column indices and labels, value, dimensional units, and law. Units are row-unit/column-unit for K/B and row-unit*seconds/column-unit for E. Contributions sum exactly in recorded order.
- `storage`: signed storage observation `q=S*x` and derivative injection `F`, so `E=sum(F*S)`; used by the initializer.

```js
const a = assemble(document.circuit);
const dc = solveDC(a, document.experiment);
const ac = solveFrequency(a, document.experiment, complex(0, 1000));
const sweep = acSweep(a, document.experiment, [10, 100, 1000]); // Hz
const h = transfer(a, 'Vin', 'out', complex(0, 1000));
const rational = extractFirstOrder(a, 'Vin', 'out');
const step = transient(a, document.experiment, {step: 0.00005, stop: 0.005});
```

DC solves Kx=Bu. Frequency solves (K+sE)X=BU for finite complex s. `transfer` uses one unit input and zero other independent inputs; all dependent sources remain. Each successful solve has `status:"ok"`, ordered complex `x`, labeled `unknowns` and `observations`, physical `residuals`, reconstructed `groundKcl`, and numeric `diagnostics`. Measurements contain `value:{re,im}`, physical output `unit`, `magnitude`, and `phaseRadians`. DC and time results use the same complex container with zero imaginary part. For transfers, the observations keep their physical output units, while the selected `transfer` measurement declares the ratio unit (`V/V`, `A/V`, `V/A`, or `A/A`).

Failures have `status:"inconsistent"`, `"nonunique"`, or `"ill-conditioned"`, plus `message`, numerical `rank`, and `size`. They contain no invented solution. Structural errors throw `ValidationError`; invalid analysis options/unknown selected IDs throw `RangeError`. A frequency sweep retains a separate success/failure for each sample.

`extractFirstOrder` returns `not-supported` with a reason unless there is one storage element, exactly one nonzero E entry on its diagonal, an invertible algebraic K block, and a fixed output row. It computes Schur coefficients `e,kr,br,cr,dr` by solves, then H(s)=dr+cr*br/(e*s+kr). `numerator` and `denominator` are **ascending-power** coefficient pairs. `denominatorRoot=-kr/e` is a root of the scalar denominator before cancellations, not a general realization pole computation. The `cancellation` flag identifies exactly zero computed residue; near cancellations are not certified. Coefficients are labeled algebraically derived numeric values, not exact rational arithmetic. Numerical transfer remains available for other circuits.

## Transients and diagnostics

`transient` takes seconds: optional `start` (default 0), `stop`, positive `step`, optional `maxSteps` (default 100000), and optional tolerances. It returns samples, initialization information, requested step, and actual tolerance settings. A failure also returns the failure time and completed samples. Resource/time-grid exhaustion is `step-limit`.

Storage initialization solves `[K F; S 0][x; qdot]=[Bu; q]`. This handles the validated RC/RL/RLC networks while preserving algebraic source constraints. Equilibrium first solves Kx=Bu at the left starting source values. A uniquely solved constant-source equilibrium can also initialize voltage-clamped storage at rest. Other singular initialization blocks are explicitly unsupported, even if some more general DAE algorithm might support them.

At a scheduled source step, the solver lands exactly at its time using left source values, emits a `side:"left"` sample, preserves every storage voltage/current, recomputes compatible variables at right source values, and emits `side:"right"`. The uniform grid then restarts from that event. Simultaneous source steps share one event. Unsupported redistribution/impulses return `unsupported-initialization` with the underlying cause. No silent state jump or constraint relaxation occurs.

The integer-indexed grid avoids repeated-addition drift. A final interval or a breakpoint interval may be shorter than the requested step. Backward Euler solves `(K+E/h)xNext=BuNext+(E/h)xPrevious`. Reporting this divided form keeps residuals in A and V. Capacitor currents on these samples are `C*(vNext-vPrevious)/h`, labeled `backward-Euler-at-end-of-interval`; initial/event samples use the compatible instantaneous storage rates and are labeled `instantaneous-compatible`. The scheme is first order, dissipative, and has no adaptive local-error control.

Defaults: relative tolerance `1e-8`, `voltageAbsolute:1e-9` V, `currentAbsolute:1e-12` A, dimensionless equilibrated `pivot:1e-12`. Each physical residual uses its row unit and the threshold `absolute + relative*max(|b_i|,sum_j |M_ij*x_j|)`. Ground KCL is reconstructed from actual signed device currents. Initial storage constraints carry V/A units too. A failed physical residual cannot be rescued solely by a small dimensionless residual.

The dense solver row-equilibrates by each row's maximum coefficient magnitude, then column-equilibrates similarly, and performs Gaussian elimination with complete row/column pivoting. With `Aeq=Dr*M*Dc`, `beq=Dr*b`, and `x=Dc*z`, the reported infinity-norm backward residual is `||beq-Aeq*z||inf/(||Aeq||inf*||z||inf+||beq||inf)`. Zero/zero is reported as zero. `pivotRatio` is the smallest/largest accepted pivot magnitude, **not** a condition number. Nonzero tiny pivots and ambiguous tiny constraint residuals return `ill-conditioned`. Exact zero trailing rows distinguish numerical inconsistency from nonuniqueness. No leakage or regularization is added; E is never inverted.

## Resistor Kron helper

`resistorLaplacian({nodes,edges})` builds a full ungrounded conductance Laplacian. Edges have `{id,p,n,resistance}`. `kronReduce(network, retained)` returns the ordered retained terminals, eliminated nodes, full and reduced matrices in S, or a linear-solver failure. It solves with the internal block to compute the Schur complement. A node named `0` is an ordinary terminal here; this helper is intentionally independent of grounded MNA. Disconnected singular internal blocks are rejected.

Edge IDs must be nonempty strings and unique. Both entry points throw `RangeError` for invalid network data, conductance overflow (`1/resistance`), or nonfinite assembled Laplacian entries. If a finite Laplacian produces a nonfinite Schur-complement result, `kronReduce` returns `ill-conditioned`; `rank` and `size` then describe the solved internal block. An `ok` result always contains finite `full` and `reduced` matrices, including when every node is retained. Extreme finite inputs may therefore be rejected rather than returning an infinite matrix.

## Phase 2A DC one-port helper

`dcOnePort(document, p, q, loadResistance, testCurrent = 1)` runs a headless DC terminal experiment on copies of a validated native document. The chosen nodes must be distinct and exist. The supported device set is R, V, I, VCVS, VCCS, CCVS, and CCCS; any C or L returns `unsupported-device` rather than an implicit DC replacement. The external load is a finite positive resistance. This helper does not change the native schema or mutate the input.

Port voltage is `V(p)-V(q)`. Positive injected port current enters the network at `p`; an added test source has ordered terminals `(q,p)` and injects `J`, giving `Rth=Vtest/J`. All original independent-source DC coordinates are zero in that test, but their ideal branches remain. Controlled sources and sensing branches stay active. The open solve adds no load; existing port-connected components remain. For finite positive `Rth`, a zero-volt `(p,q)` short independently checks the signed Norton current. A positive external load has current `(p,q)`, so `IL=Vth/(Rth+RL)` and `VL=RL*IL` are independent explanatory identities.

An `ok` result includes `vth`, `rth`, `inorton`, `shortCurrent`, `suppressed`, `retainedControlled`, six individual DC solves, physical residuals and diagnostics, and voltage/current comparisons. The original loaded circuit retains its nodes. The two equivalent realizations use local ground at their negative terminal; `equivalentPortLabels` maps that local reference to the selected original `q`. Compare terminal voltage and load current, not absolute node potentials. Absolute comparison limits are `1e-9 V + 1e-8*max(|Voriginal|,|Vequivalent|)` and `1e-12 A + 1e-8*max(|Ioriginal|,|Iequivalent|)`. The independent short-current check uses the current limit. They are declared floating-point agreement tests, not exact-equivalence proofs.

Failures explicitly report `invalid-port`, `unsupported-device`, `invalid-load`, `solver-failure` (including the stage and underlying inconsistent/nonunique/ill-conditioned result), `zero-resistance`, `negative-resistance`, or `nonfinite`. Zero and negative resistance are not declared invalid original circuits; this phase simply cannot form the finite-positive-resistor Thévenin/Norton load comparison. No fixed small-resistance cutoff is applied. A full-state nonunique result can occur even where terminal behavior would be unique, and is a current solver limitation.

## Phase 2B passive resistor transforms

`resistorCandidates(network, retained)` lists conservative topology choices; `transformResistors(document, retained, selection)` validates the selected move and returns a preview without modifying the native document. A selection has `operation` (`parallel`, `series`, `star-delta`, `delta-star`, `star-mesh`, or `kron`) and, where applicable, `edges: string[]` or `center: string`. Candidate keys use structured JSON tuple encoding, so punctuation in valid native edge IDs cannot make two choices collide. The input must be a validated source-free native document containing only finite positive `R` components. Any other device gives `unsupported`; an invalid move, disconnected internal component, numerical failure, or failed equivalence check has its own non-success status and diagnostic code. The native node `0` is ordinary in the full Laplacian, but retaining it is required where an operation would otherwise remove it from a native preview.

An `ok` result includes an unchanged copy of the original network, a transformed network, ordered retained nodes, introduced/eliminated nodes, removed/generated branches, original and transformed response matrices in S, and a numerical check. Boundary currents enter the resistor network: `i_B = Λu_B`, `Λ=L_BB−L_BI solve(L_II,L_IB)`. The check compares matrices, independently reconstructs internal voltages for several boundary vectors (including a common shift) in a gauge relative to the first retained voltage, and accumulates physical branch currents `(V(p)−V(n))/R` for internal KCL and terminal currents. This avoids cancellation of common-mode Laplacian products; a constant terminal potential produces zero branch currents. Physical power `uᵀΛu` is evaluated with relative boundary voltages in W. It verifies symmetry, zero row sums, nonpositive off-diagonals, and finite values. Matrix limits are `1e-12 S + 1e-8·scale`; power limits are `1e-12 W + 1e-8·scale`. The internal-KCL limit is `1e-12 A + 1e-8` times the sum of incident branch-current magnitudes. These are floating-point checks of exact circuit identities, not certified error bounds.

For the separate terminal-current comparison, let `S_i=Σ|I_edge|` over branches incident on terminal `i`, let `d_i` be their count, and use `γ_k=kε/(1−kε)` with binary64 `ε=Number.EPSILON`. Each network receives an evaluation allowance `δ_i=γ_(3d_i+4) S_i` amperes. The `3d_i` counts branch subtraction, division, and accumulation; four more operations leave a small coefficient/gauge margin. Its internal-solve allowance is `R=Σ_h (|KCL_h|+δ_h)` amperes over hidden nodes. The pairwise terminal limit is `1e-12 A + 1e-8 max(|I_i,original|,|I_i,transformed|) + δ_i,original + δ_i,transformed + R_original + R_transformed`. The added terms account for cancellation of large incident currents and for the effect of measured internal KCL error; passive current redistribution bounds the contribution of each hidden residual to a single terminal by its absolute magnitude. This is a first-order diagnostic budget, not a certified interval enclosure. Nonfinite allowances fail explicitly. The matrix, KCL, power, finite-value, overflow, and destructive-underflow checks remain separate.

Successful output includes `document` and strictly serialized `json` for a source-free equilibrium experiment, retaining node `0` and voltage observations of retained nonreference nodes. Original internal-voltage and branch-current observations are not transferred. Generated IDs avoid collisions, and generated resistances must be finite, positive, and representable. The helper does not apply the preview to the analyzed document; import or the native JSON editor does that explicitly. Extreme scales may return `numeric-failure` rather than an incomplete or nonfinite realization.

## Phase 2C frequency-domain port helper

`analyzePorts(document, config)` selects one or two exact ordered `{p,q}` node pairs, `frequencyHz≥0`, and optional `externalDrive`, `testCurrent`, `testVoltage`, and two-port `loading`. The strict native document is validated, then copied; the applied document is not changed. The returned `PortAnalysisResult` includes port order, `ω=2πf`, excluded/suppressed independent sources, retained controlled-source IDs, and independent `z` and `y` outcomes. A successful Z matrix has Ω entries; a successful Y matrix has S entries. Each column records its complete temporary MNA solution and diagnostics. An unsuccessful representation carries `invalid-selection`, `unsupported-exclusion`, `incompatible-test`, `nonunique`, or `numerical-failure` rather than a fabricated matrix.

The normalized Z test injects current `q→p` into one port with the other externally open. The Y test clamps all port voltages and negates each p→q clamp branch current to get current entering the network. Actual test amplitudes are used for normalization; neither matrix is obtained by inverting the other. A selected independent voltage drive across port 1 can be removed only when no current-controlled source measures that branch. All remaining independent source values, including AC phasors, are zeroed while their branches remain.

Two-port `loading` uses `{sourceResistance: Rs, load: {kind:'open'}}` or `{kind:'resistor', resistance: RL}`. `Rs` is finite and nonnegative; `RL` is finite and positive. The source is 1 V RMS. `fromZ` and `fromY` each solve their boundary equations, while `direct` solves a separately connected source, series resistor, and load on the same characterized network. Results report complex `V1,V2,I1,I2`, `V2/Vs`, `V2/V1` when defined, and `V1/I1` when input current is nonzero. Available predictions remain available if the direct full-state solve fails, with `comparison:null`. When direct solve succeeds, differences and limits are separate arrays in V and A: `1e-9 V + 1e-8·max(|Vdirect|,|Vpredicted|)` and `1e-12 A + 1e-8·max(|Idirect|,|Ipredicted|)` per port. These floating-point diagnostics are not certified equivalence or stability proofs. A full-state nonunique result can occur despite mathematically unique terminal behavior.

## Phase 3A1 headless diode operating point

`parseNonlinearDocument(json)`, `validateNonlinearDocument(value)`, and `serializeNonlinearDocument(document)` define a separate strict v2 circuit contract. They do not change v1 `parseDocument` or browser import. A `D` has ordered anode `p` and cathode `n`, and an explicit `shockley-series` model with positive finite `saturationCurrentA`, `idealityFactor`, `temperatureK`, and finite nonnegative `seriesResistanceOhm`. The experiment remains version 1. Every independent DC source is applied; waveform, AC, and absolute storage fields do not select bias. All linear primitives and control-reference rules remain available.

`assembleDiodeSystem(document)` returns an owned, labeled real DC system. Non-ground node voltages and retained linear branch currents follow v1 ordering, then diode currents follow sorted IDs. Existing rows remain A-valued KCL or V-valued branch constraints; each diode adds an A-valued constitutive row. `evaluateDiodeSystem(system, x)` returns the unclipped residual, analytical Jacobian, per-diode evaluation, expanded arithmetic `terms` and branch-based `physicalTerms`, or `null` for unusable numeric range. The matrix is square with one coordinate and one row per diode. `solveDiodeOperatingPoint(document, options?)` uses a bounded, backtracked Newton correction with fixed dimensionless merit scales (default `currentScaleA` is the maximum of 1 mA, prescribed DC current magnitudes, `Vnom/R` for resistors, and `|gain|·Vnom` for VCCS branches, with `Vnom=max(1 V, |DC voltage sources|)`; default `voltageScaleV` is 1 V). Defaults are 60 corrections and 30 halving trials per correction. Optional `initialGuess` follows the returned unknown labels; omitted coordinates are all zero. Invalid options throw `RangeError`. `solveOperatingPoint` also accepts v1 documents and delegates them to unchanged `assemble` and `solveDC`.

Success returns `status:'ok', kind:'nonlinear'`, real labeled unknowns, observations, diode terminal/junction/current/differential values, V/A physical residuals with separate `physicalAllowance` (branch-based relative plus row-unit floor) and `arithmeticAllowance` (expanded-evaluation roundoff), whose sum is `tolerance`, ground KCL, signed device powers, W-valued power balance and allowance, an iteration trace, an owned document snapshot, and a circuit/DC-source bias fingerprint. `differentialResistanceOhm:null` means no finite positive diagnostic can be represented; it is never Infinity. Failure returns `status:'failed'` with a language-independent code (`numeric-range`, `linearized-system`, `line-search`, `iteration-limit`, `physical-residual`, `degenerate-jacobian`, or `power-balance`) and a message; it never fabricates a bias. A singular Newton Jacobian identifies only the local correction system. The floating-point residual checks and power balance do not certify uniqueness, stability, or physical diode-model fidelity.

`createDiodeTangent(point, currentDocument)` checks circuit and independent-source DC values against the stored bias fingerprint. Strict validation precedes normalization to the owned JSON representation, so absent optional properties match optional `undefined` properties but invalid fields remain errors. Changing only AC increments, waveforms, or absolute storage values does not stale a memoryless DC bias; the current document's declared AC increments are retained. The operation returns `status:'ok'`, a strict native v1 incremental document, and separate bias metadata, or `status:'unavailable'` for stale bias or unrepresentable positive finite differential resistance. Diodes become R branches with the same IDs and `rd = Rs+1/gj`; independent DC and storage increments are zero and large-signal waveforms are removed. `assemble`, `solveDC`, `solveFrequency`, and `transfer` operate on that v1 tangent. Its unit-input transfer describes a derivative around the recorded bias, not a finite 1 V nonlinear excursion. See [the bounded specification](PHASE_3A_SPECIFICATION.md), [the reading path](CODE_GUIDE.md#reading-the-phase-3a1-diode-kernel), and `npm run demo:diode`.

## Phase 3A3 headless nonlinear transient

`nonlinearTransient(document, { start?, stop, step, maxIntervals?, maxIterations?, maxBacktracks?, maxUnknowns?, tolerance? })` accepts a strict v2 circuit with the existing v1 experiment. It returns `status:'ok'` with an owned document/options snapshot, initialization method, and ordered samples, or `status:'failed'` with stage, attempted time, stable code, cause, trace and accepted prefix. Bad documents/options retain validation exceptions. `start` defaults to 0 s. Defaults are 10,000 intervals, 60 Newton iterations, 30 backtracks and 64 augmented unknowns; no override may exceed the 64-unknown dense-system cap. Sources are evaluated at their actual time values without mutating source `.dc`; `.ac` is ignored for transient driving.

Each sample labels SI coordinates, source values, observations, all original device powers/currents, diode junction/terminal quantities, storage q and qdot, physical A/V residuals, ground KCL, W-valued power balance and J-valued backward-Euler energy balance. `side` distinguishes left/right event samples; `intervalSeconds` gives actual shortened intervals. Initial/right-event currents are `instantaneous-compatible`, while regular samples use `backward-Euler-at-end-of-interval`. Newton traces distinguish V, A, and storage-rate corrections; iterations are algorithmic, not physical time. Transient samples have no bias fingerprint and cannot be passed as operating-point tangent provenance. See [the Phase 3A3 specification](PHASE_3A3_SPECIFICATION.md), [guide](CODE_GUIDE.md#reading-the-phase-3a3-transient-kernel), and `npm run demo:diode-transient`.

## Limits

The kernel targets small dense networks. Numerical rank diagnostics are not a comprehensive topology classifier or certified condition estimator. Extreme scales can exceed floating-point range or the declared tolerances and are rejected. A small residual checks the declared equations, not physical device accuracy. There is no general high-index initialization, ideal impulse handling, adaptive integration, symbolic component algebra, arbitrary-order rational extraction, eigenvalue solver, browser nonlinear transient, or synthesis. Phase 3A1 supports only its stated memoryless diode DC and local tangent model. See the fixture manifest for exactly what has been validated.
