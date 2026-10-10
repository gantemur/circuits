# Phase 0: transparent linear circuit kernel

Version 0.1, 10 October 2026. This is the active implementation milestone.

## 1. Outcome

Build a small, browser-compatible TypeScript kernel that assembles and solves linear circuits, evaluates transfer functions, simulates simple transients, and explains its matrix contributions. Deliver a reproducible headless demonstration and tests. A schematic editor is a later milestone.

The central demonstration is an RC filter with its element laws, descriptor matrices, transfer response, restricted algebraic transfer expression, and computed step response. Controlled-source amplifiers and directly loaded RC stages test that the kernel represents electrical interconnection correctly.

## 2. Required scope

| Area | Phase 0 requirement |
| --- | --- |
| Topology | Named nodes, explicit reference node `0`, ordered terminals, stable component IDs |
| Passives | Positive finite resistor, capacitor, and uncoupled inductor values |
| Sources | Independent voltage/current sources; VCVS, VCCS, CCVS, CCCS |
| Sources over time | Constant, scheduled step, and sinusoid; explicit amplitude and phase units |
| Observations | Differential node voltage and directly reconstructible branch current |
| Assembly | Labeled `E`, `K`, `B`, output rows, and per-component contributions |
| Solves | Linear DC and complex-frequency response with diagnostics |
| Transfer | Numerical evaluation at complex `s`; restricted single-storage algebraic extraction |
| Transient | Fixed-step backward Euler with scheduled source breakpoints and initialization checks |
| Reduction | A small resistor-only Kron/Schur-complement helper and star fixture |
| Data | Validated, versioned native JSON and round-trip serialization |
| Demonstration | Node-run examples reporting equations, measurements, and residuals |
| Verification | The independent tests in Section 8 |

No nonlinear elements, op-amp convenience model, graphical editor, general symbolic algebra, unrestricted netlist parser, adaptive integrator, general eigenvalue solver, or synthesis engine is required in Phase 0. Their future support is preserved in the vision. Do not create placeholder implementations for them.

## 3. Circuit and experiment data

Use a documented TypeScript discriminated union and matching JSON schema or runtime validator. Choose a compact concrete schema and document it; do not build a generic ontology.

Required circuit data:

- schema version;
- node IDs including `0`;
- component IDs, types, ordered terminals, and finite numeric SI parameters;
- optional human-readable labels;
- named differential voltage outputs and branch-current observations.

Independent source values belong to experiment data: a source ID, DC value, optional complex AC excitation, and optional time waveform. Assembly creates one input coordinate per independent source. A transfer experiment selects one coordinate as unit excitation and sets the others to zero. Source topology and all controlled sources remain present.

Current-controlled devices refer to the current of a retained voltage-source-type branch by component ID. An explicit zero-volt source can act as a sensor. Do not automatically insert hidden sensors, infer a controller from drawing position, or allow an undefined controlling current.

Reject duplicate IDs, missing nodes, nonfinite parameters, nonpositive passive values, unsupported device types, unresolved control references, and unknown schema versions. Distinguish structural validation from electrical solvability.

Use ordinary SI numbers for Phase 0; engineering-prefix parsing may follow. Serialization must preserve supported semantics and observation definitions without requiring schematic coordinates.

## 4. Assembly contract

Canonical equations:

$$
E\dot x+Kx=Bu,\qquad y=C_o x+D_o u.
$$

For branch terminals `(p,n)`, voltage is $v=V_p-V_n$, and current is positive from `p` through the device toward `n`. The reduced incidence column $a$ has $+1$ at `p`, $-1$ at `n`, and omits the ground entry. KCL counts currents leaving a node into components.

Unknown ordering is deterministic: nonreference node voltages, inductor currents, and voltage-source-type currents, each with labels and units. Rows and input coordinates must also be labeled. The ordering must survive serialization and be independent of the order in which an editor eventually draws wires.

Required contributions:

| Component law | Contribution |
| --- | --- |
| Resistor $i=v/R$ | Add $(1/R)aa^{\mathsf T}$ to nodal `K` |
| Capacitor $i=C\dot v$ | Add $Caa^{\mathsf T}$ to nodal `E` |
| Inductor $v=L\dot i$ | Add $ai$ to KCL; row $L\dot i-a^{\mathsf T}V=0$ |
| Voltage source $v=u$ | Retain its current in KCL and append $a^{\mathsf T}V=u$ |
| Current source $i=u$ | Add input column $-a$ on nodal rows |
| VCCS $i_o=g v_c$ | Add $g a_o a_c^{\mathsf T}$ to nodal `K` |
| VCVS $v_o=\mu v_c$ | Retain output current; append $a_o^{\mathsf T}V-\mu a_c^{\mathsf T}V=0$ |
| CCCS $i_o=\beta i_c$ | Add $\beta a_o$ in the controlling-current column of KCL |
| CCVS $v_o=r i_c$ | Retain output current; append $a_o^{\mathsf T}V-r i_c=0$ |

Store local contributions as entries with component ID, row label, column label, matrix name, value, units or dimensional interpretation, and law/explanation. They must sum to the assembled matrices. This record supplies the eventual teaching interface.

For branch observations, reconstruct currents from the actual law: resistor $v/R$, capacitor $Cs v$ in a zero-state frequency experiment, inductor/source currents from retained unknowns, and controlled-source currents from their control. DC capacitor current is zero. State-dependent transient branch currents must use the same discrete law as the solver, with the time index stated.

The fixed output matrices $C_o,D_o$ describe voltage and algebraically reconstructed current observations. Capacitor current is a derivative observation and requires its frequency- or time-dependent reconstruction; do not silently place it in a frequency-independent $C_o$ row. The restricted algebraic transfer extractor below is required only for outputs expressible by fixed $C_o,D_o$.

## 5. DC and frequency analyses

### DC

Solve $Kx=Bu_{\mathrm{DC}}$. Capacitors contribute no equilibrium current; inductors impose zero voltage while retaining their current unknown. Do not approximate these with extreme finite resistances.

Use real linear solves with pivoting and appropriate scaling. Return labeled unknowns, observations, KCL/constraint residuals, and a status. A failure must be explicit. In Phase 0 a numerical rank/consistency diagnostic is sufficient; comprehensive graph-theoretic classification is deferred.

Classify demonstrable inconsistency separately from demonstrable nonuniqueness. When the numerical evidence is insufficient, return an honest singular/ill-conditioned status with context rather than a fabricated classification. Do not add leakage or regularization silently.

### Complex response and transfer

For finite complex $s$, solve $(sE+K)X=BU$. The general numerical transfer map is evaluated by selected unit-input solves. An AC sweep takes frequencies in hertz and uses $s=i2\pi f$.

Return complex values, magnitude, phase in a declared unit, and residuals. Do not call a frequency sample array an exact rational transfer function. At a genuine singular frequency, report the failure rather than clipping the gain.

### Restricted algebraic transfer expression

Implement a declared subset with one storage unknown, a single nonzero dynamic diagonal entry, and an invertible algebraic `K` block. Grounded single-capacitor networks and selected single-inductor networks supply examples.

Partition $x=(z,w)$ with scalar dynamic coordinate $z$, $E_{zz}=e$, and all other entries of $E$ zero. Eliminate $w$ by solving with $K_{ww}$:

$$
k_r=K_{zz}-K_{zw}K_{ww}^{-1}K_{wz},\qquad
b_r=B_z-K_{zw}K_{ww}^{-1}B_w.
$$

For the selected output,

$$
c_r=C_z-C_wK_{ww}^{-1}K_{wz},\qquad
d_r=D+C_wK_{ww}^{-1}B_w.
$$

Thus the selected transfer is

$$
H(s)=d_r+\frac{c_r b_r}{es+k_r}.
$$

Compute this from assembled matrices; never recognize an example name and return a memorized formula. Report floating-point coefficients as algebraically derived numeric coefficients, not as certified exact rational arithmetic. Include a denominator/root report for this first-order subset. If its reduction hypotheses fail, return `not-supported` while preserving numerical transfer evaluation when available.

General symbolic component parameters, arbitrary-degree rational extraction, and realization-wide pole computation are later work.

## 6. Transient and initialization

Use backward Euler:

$$
(E+hK)x_{n+1}=Ex_n+hBu(t_{n+1}).
$$

Return time samples, labeled measurements, discrete equation residuals, and initialization information. Expose step size and solver tolerances.

Initialization is part of the experiment. At minimum, support an equilibrium before the first source change and explicitly requested initial storage values for the validated RC and RL/RLC examples. Compute compatible algebraic variables; do not set all MNA variables to zero when a nonzero ideal source constraint is present.

For a scheduled step, define left and right source values. Preserve capacitor voltage and inductor current when the supported circuit permits it, and recompute algebraic variables at the event. Land exactly on scheduled breakpoints and restart with the right-side constraints. A topology/source change that would require impulsive storage redistribution is outside the Phase 0 initializer: return an explicit unsupported-initialization error.

Do not claim a general high-index DAE initializer. For unsupported constraints, explain the restriction. The acceptance RC step has a resistor between the source and capacitor, so its storage value remains continuous at the source step.

Adaptive time steps, trapezoidal/BDF methods, state-triggered switching, nonlinear integration, and limit-cycle detection are deferred.

## 7. Diagnostics and tolerances

Validation and solver options must identify voltage/current units. Recommended defaults for small tests are relative tolerance $10^{-8}$, voltage absolute tolerance $10^{-9}$ V, and current absolute tolerance $10^{-12}$ A. Set thresholds according to the residual row or reported physical quantity; document any different values.

For a numeric system $Mz=b$, also report a scale-aware backward residual such as

$$
\eta=\frac{\|b-Mz\|}{\|M\|\|z\|+\|b\|}.
$$

State scaling and norm, handle a zero denominator explicitly, and do not use this dimensionless residual alone as a physical-error bound. Small-system analytic results should meet the stated absolute/relative tolerances. Transient discretization error is tested separately against the known solution and step refinement.

## 8. Acceptance tests

Tests must use independent analytic expectations. All circuits below specify physical connectivity; choose stable component/node IDs and publish them as JSON fixtures.

### A. Divider, current source, and orientation

- Voltage source from node `in` to ground, resistor $R_1$ from `in` to `out`, resistor $R_2$ from `out` to ground: $V_{out}=V_{in}R_2/(R_1+R_2)$ and source branch current $-V_{in}/(R_1+R_2)$.
- Current source from ground into a node with two grounded resistors: voltage is injected current divided by total conductance.
- Reverse a passive branch orientation: node voltages and powers agree; the reported branch voltage/current signs reverse. Reverse a source orientation and its value consistently: the physical result agrees.

### B. RC filter and loading

Use $R=1000\ \Omega$ and $C=10^{-6}$ F. A grounded voltage source feeds $R$, whose output node connects through $C$ to ground; observe output voltage.

$$
\tau=RC=10^{-3}\mathrm{s},\qquad H(s)=\frac{1}{1+s\tau}.
$$

Verify DC gain 1, several complex-frequency values including $f_c=1/(2\pi\tau)$, magnitude $1/\sqrt2$ and phase $-\pi/4$ at $f_c$, first-order coefficients from algebraic elimination, and pole $-1000\ \mathrm{s}^{-1}$.

A load $R_L$ from output to ground changes the transfer to

$$
H(s)=\frac{1}{1+R/R_L+sRC}.
$$

The same input followed by two identical directly connected RC sections has

$$
H(s)=\frac{1}{1+3sRC+(sRC)^2}.
$$

Verify this at several frequencies through assembly. It must differ from $(1+sRC)^{-2}$; a direct connection loads the first section. Rational extraction for this second-order fixture is not required in Phase 0.

### C. Controlled sources

- VCVS sets grounded output voltage to $\mu V_{in}$; verify output and current through a grounded load resistor.
- VCCS draws $gV_{in}$ from output to ground with grounded output resistor $R_L$: $V_{out}=-gR_LV_{in}$.
- A source drives resistor $R_s$ into a zero-volt sensor to ground, so $i_c=V_{in}/R_s$. CCVS gives $V_{out}=r i_c$; CCCS drawing $\beta i_c$ from output to ground with load $R_L$ gives $V_{out}=-\beta R_Li_c$.

Test unresolved controls and orientation signs, not only gain magnitudes.

### D. Inductor and RLC

For source–resistor–inductor in series to ground, verify DC current $V/R$ and zero inductor voltage. Verify $I(s)/V(s)=1/(R+sL)$ at selected frequencies.

For a series $RLC$ loop with output across the grounded capacitor,

$$
H(s)=\frac{1}{LCs^2+RCs+1}.
$$

Check this using positive finite values and include the resonance region. No polynomial-root algorithm is required for this second-order example.

### E. RC transient and refinement

For the unloaded RC fixture, start with zero capacitor voltage and apply a one-volt step through the resistor:

$$
V_{out}(t)=1-e^{-t/\tau}.
$$

Compare backward Euler with its independent recurrence

$$
V_{out,n}=1-(1+h/\tau)^{-n}.
$$

The discrete recurrence should meet algebraic tolerances. Compare separately with the continuous formula using $h=\tau/20,\tau/40,\tau/80$ at common sample times through $5\tau$. Error must decrease consistently with first-order convergence; do not require every coarse step to meet the DC tolerance.

Also check discharge from a nonzero capacitor initial value through a resistor, and an RL decay with $i(t)=i_0 e^{-Rt/L}$. Verify storage continuity and source constraints for a nonzero-time RC source step.

### F. Resistor Kron reduction

A hidden star node connects three retained terminals with conductances $1,2,3$ siemens. Eliminate it from the full ungrounded conductance Laplacian:

$$
\Lambda=\begin{pmatrix}
5/6&-1/3&-1/2\\
-1/3&4/3&-1\\
-1/2&-1&3/2
\end{pmatrix}.
$$

Compare with independent full-network boundary-current calculations for a spanning set of imposed boundary voltages. Check symmetry, zero row sums, and the matching terminal currents. Use a solve with the internal block, not a full Laplacian inverse. This is an independent resistor-reduction helper; a reduction editor is not required.

### G. Bad and degenerate models

- Floating unreferenced subnetwork: report missing reference or underconstraint.
- Unequal ideal voltage sources in parallel: report inconsistent constraints.
- Equal ideal voltage sources in parallel: report nonunique separate source currents; do not falsely invent them.
- Singular `E` from an ordinary voltage-source RC circuit: still solve correctly.
- A source change directly forcing a conflicting ideal capacitor state: report unsupported impulsive initialization rather than silently jumping the state.
- Invalid values, duplicate IDs, missing nodes, unknown model types, or undefined control references: validation errors.

### H. Provenance and serialization

Per-device entries sum to `E`, `K`, and `B`; row and column labels map correctly to quantities. JSON round-trip preserves all supported fields and computed outputs. The package imports in Node without accessing browser globals.

## 9. Deliverables

- TypeScript source, supported runtime validator, and documented JSON fixtures;
- test/typecheck/build scripts and lockfile;
- a small headless demonstration command;
- documented matrix/output labels and solver result/error types;
- a fixture/expected-result manifest identifying independent formulas;
- updated README with actual run commands and implemented limitations;
- short implementation notes and updated decisions/status.

Choose a currently supported Node/TypeScript/test setup and pin dependencies during implementation. A small maintained dependency is acceptable when justified; keep the mathematical core inspectable.

## 10. Completion gate

Phase 0 is complete only when its acceptance cases pass, documented commands run, the package is browser-compatible, and unsupported cases fail explicitly. A matrix demo, untested formula, or UI screenshot is not sufficient.

After completion, report measured validation results and propose the next bounded milestone. The long-term vision alone does not authorize implementing all later phases.
