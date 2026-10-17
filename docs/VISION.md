# Circuits Unfolded: project vision

Version 0.3, 11 October 2026. This public lab document supersedes the August 2026 founding specification for implementation planning. The active UX scope is defined separately in `UX_SPECIFICATION.md`; earlier milestones retain their own specifications.

## 1. Purpose

Circuits Unfolded is a transparent teaching and working laboratory for small circuits. Within its supported model class, it should replace the need to open an industrial simulator or synthesizer for a modest calculation. Its distinctive contribution is to connect numerical answers to physical laws, terminal experiments, mathematical structure, and constructive transformations.

The organizing progression is:

> Interconnection and element laws → terminal response → realization and synthesis.

The primary users are students, teachers, mathematicians, physicists, and engineers exploring modest amplifiers, filters, rectifiers, oscillators, and measurement blocks. Small means principally tens of components: enough for useful electronics and mathematical examples, while keeping equations and transformations interpretable.

The lab accompanies the author's circuit-theory book. The book can supply examples and conventions, but its publication and required computations must not depend on completion of a public application.

The implementation is part of the teaching material. Readability is preferred across the project and required in substantive mathematical, physical, and numerical core methods, so students can trace assumptions and equations, validate results, fork the code, and modify it. Explicit stages and documented numerical safeguards matter as much as a readable interface; generated browser bundles may remain optimized. The public source policy is in [CONTRIBUTING.md](CONTRIBUTING.md), with a reading map in [CODE_GUIDE.md](CODE_GUIDE.md).

## 2. What the user can do

| Activity | Intended behavior |
| --- | --- |
| Build | Draw or enter a circuit, choose device models, designate ports and probes |
| Solve | Calculate DC bias, sweeps, and transient behavior |
| Analyze | Obtain response functions, transfer functions, frequency plots, poles, and zeros |
| Transform | Apply and explain exact equivalences and reductions |
| Synthesize | Construct a supported network from a prescribed terminal function |
| Learn | Explore guided examples using the same engine as the free laboratory |

Every substantive result should connect three views: physical schematic and measurements; equations and responses; structural equivalents and construction steps. For example, an RC filter should show its circuit, differential equation, assembled matrix, transfer function, Bode curve, pole, and step response.

## 3. The mathematical kernel

The ordinary circuit kernel assembles terminal laws and interconnection constraints. Linear time-invariant circuits use

$$
E\dot x+Kx=Bu,\qquad y=C_o x+D_o u.
$$

Frequency responses are evaluated by solving

$$
(sE+K)X=BU,\qquad Y=C_oX+D_oU.
$$

This supports numerical transfer matrices without forcing the derivative matrix to be invertible. The equivalent book convention is $E\dot x=Ax+Bu$ with $A=-K$.

Nonlinear elements contribute current, charge, flux, and internal-state laws to an assembled differential-algebraic residual. A DC operating point and its Jacobian produce a local small-signal circuit. Time integration acts on the same model rather than on a separate approximate schematic engine.

Ports define the experiment. Equivalent networks preserve a declared terminal relation; they can differ in hidden modes, initialization, component count, noise, tolerances, and physical range. Those distinctions must remain visible.

## 4. Analyses

The stable laboratory should progressively include:

- topology and constraint diagnostics;
- DC operating points and source/parameter sweeps;
- linear and small-signal complex frequency response;
- transfer functions in numerical, restricted algebraic, and later symbolic forms;
- driving-point impedance/admittance and multiport response;
- finite poles and zeros, with realization and input–output poles distinguished;
- step, impulse, and general transient responses;
- startup and amplitude stabilization for selected nonlinear oscillators;
- local parameter sensitivity and basic tolerance explorations.

Exact arithmetic, algebraic identities, floating-point evaluations, and certified enclosures are different evidence types. A finite frequency sweep does not certify a global frequency bound. Impulses and source discontinuities require explicit treatment; an arbitrarily narrow pulse is an approximation whose area and duration must be stated.

## 5. Elements and model fidelity

The initial linear primitives are resistors, capacitors, inductors, independent sources, and the four controlled-source types. Ideal op-amps, transformers, mutual inductance, gyrators, and other terminal relations follow as useful examples require them.

Device fidelity should be a visible choice:

| Tier | Meaning |
| --- | --- |
| Ideal | A limiting terminal relation useful for elementary reasoning |
| Pedagogical | Explicit simplified nonlinear or dynamic law |
| Compact | A documented subset of a standard semiconductor model |
| Named device | A provenance-controlled parameterization of a physical part |
| Imported | User-supplied model in a supported format |

Realistic diode support should include series resistance, leakage/breakdown, depletion and diffusion charge, and temperature parameters as implemented. BJT support should progress from Ebers–Moll to a documented Gummel–Poon subset with Early effect, charge storage, gain roll-off, and parasitic resistances. JFET and MOSFET models should progress from explanatory laws to useful compact models for ordinary small circuits.

SPICE `.model` and limited `.subckt` import may be supported after these implementations stabilize. Unsupported keywords must produce an explicit report. Named models need provenance, license, nominal temperature, parameter mapping, and validation examples. “Realistic” never means that omitted physics or the accuracy of all physical specimens has been certified.

Finite-gain/bandwidth op-amps, saturation, comparators, Schmitt triggers, and switches support active filters, feedback, and oscillator lessons. Model behavior should remain distinguishable from numerical convergence aids.

## 6. Theorem laboratory

A theorem is executable educational content: statement, hypotheses, selected circuit and experiment, derivation, predicted identity or transformation, and verification.

The core collection includes Kirchhoff's laws, power balance, superposition, source transformation, Thévenin/Norton, maximum-power transfer, reciprocity, Tellegen, Millman, substitution, and selected two-port identities. Each demonstration must identify its hypotheses and offer a counterexample or changed hypothesis when useful.

For a Thévenin demonstration, the user chooses a terminal pair, obtains the open-circuit voltage and equivalent impedance through an appropriate test source, and compares the original and equivalent circuits across several loads. Dependent sources remain active. A nonlinear network may have a local incremental equivalent or a nonlinear terminal characteristic, rather than a global linear equivalent.

## 7. Reduction laboratory

Planned exact transformations include series/parallel, source conversion, star–delta, general star–mesh, symmetry and balanced-bridge reduction, transformer reflection, and Kron elimination.

Kron reduction uses a Schur complement computed through linear solves. The application should show which internal node is eliminated, which new couplings appear, and which terminal map is preserved. Dynamic reduction distinguishes an exact rational relation, values of that relation at sampled frequencies, and approximate model-order reduction.

Transformations are reversible document operations with recorded hypotheses, parameters, preserved ports, derivation, and verification method. Automatic suggestions should be conservative; the user decides when removing an internal variable would obscure a useful physical quantity.

## 8. Synthesis laboratory

Synthesis constructs a circuit from a desired terminal function. The first scope is rational passive one-port impedance/admittance, with an explicit allowed primitive class.

Foster and Cauer constructions come first. More general Brune and Bott–Duffin constructions follow only after their domain restrictions and verification are implemented. Bott–Duffin is transformerless passive impedance synthesis, not a local star–delta-like reduction. Darlington and multiport constructions are later extensions where justified.

Each successful construction must show extraction steps, remaining function, generated components, and an independent re-analysis of the completed circuit. Positive-realness testing must state whether it is a rigorous algebraic test or numerical evidence. A desired active transfer function is not automatically a passive one-port synthesis problem.

## 9. Interface and persistence

The browser has one shared circuit and experiment context, a dedicated circuit editor, configurable Analyze panels, and a Transform workspace for implemented equivalence methods. A component inspector connects the SVG schematic or honest topology table to parameters, terminal laws, and equation contributions. Form and JSON are separate editable views of the same native circuit, with explicit validation and Apply. Synthesize is a future workspace and should appear only when a working method exists. New theorem/reduction interfaces should use the shared editor and Transform workspace rather than creating a second independent circuit-design interface.

Panel layout and temporary UI drafts are browser state, not scientific circuit data. A native v1 document continues to hold circuit topology, sources, observations, and initialization. A chosen port or analysis configuration specifies an experiment; it does not reclassify the circuit permanently. Future two-port and retained-terminal tools should build on that common model, with implemented support distinguished from mathematical validity.

Editor essentials include placement, rotation, wires with unambiguous junctions, probes, named nodes, undo/redo, and dimensional parameter entry. European rectangular resistor symbols are the default. Plots need readable labels, units, cursors, logarithmic axes where appropriate, and data/SVG export.

Circuit semantics must be independent of drawing geometry. The current versioned JSON document stores topology, models, parameters, sources, observations, and initial conditions. Analysis-panel layout stays outside native v1; a future version may add appropriate scientific experiment definitions, geometry, and transformation history after their contracts are specified. Native files, local saving, and modest URL sharing should work without accounts.

Lessons use the same circuit format and kernel as ordinary user circuits. Accessibility includes keyboard editing, high contrast, labels beyond color, readable plots, and reduced-motion transformations.

English and Mongolian Cyrillic are continuing interface languages. Every new user-facing feature, lesson, diagnostic summary, and accessibility label should be available in both, using a shared terminology glossary and language-independent scientific documents and exports.

## 10. Implementation and validation

The browser-compatible TypeScript kernel stays independent of UI frameworks, DOM, storage, and rendering. Separate circuit semantics, assembly, numerical routines, analyses, transformation rules, synthesis, and lessons. The initial small matrices can use dense solves while preserving local assembly contributions for explanation.

Validation combines independently derived circuit answers, device-law checks, orientation invariance, conservation residuals, loading counterexamples, transient refinement, and selected comparisons against a mature simulator. Book examples are candidates for fixtures, not automatically verified code targets.

No backend, runtime AI dependency, paid API, or account system is needed for the lab. GitHub Pages is the intended eventual static host.

## 11. Stages and gates

| Stage | Result | Completion gate |
| --- | --- | --- |
| Phase 0 | Headless linear kernel | All MVP analytic tests, matrix provenance, and diagnostics pass |
| Phase 1 | Transparent browser linear lab | Useful small filters/amplifiers, plots, equation view, and saved circuits |
| Phase 2 | Theorems and reductions | Hypotheses checked and declared terminal equivalence verified |
| Phase 3 | Nonlinear bias and device models | Documented diode/BJT/FET subset, operating points, derivatives, reference comparisons |
| Phase 4 | Nonlinear transients and oscillators | Refinement-tested amplifiers/rectifiers and startup/amplitude stabilization examples |
| Phase 5 | Passive synthesis | Supported target generates a circuit and independent analysis verifies it |
| Version 1.0 | Integrated educational release | Stable formats, examples, documentation, and an honest feature matrix |

The order may be adjusted by the owner when a concrete example warrants it. Later features should not be simulated by placeholders or broad claims in an early release.

## 12. Boundary

Industrial circuit scale, unrestricted SPICE compatibility, layout/parasitic extraction, fabrication-level physics, process libraries, and certification are outside the initial product. Separate generalized-circuit and hardware research does not belong in this public implementation plan. Future extensions should be proposed when they have a clear educational use and mathematical formulation.
