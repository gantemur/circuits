# Phase 3B1: headless reciprocal Ebers–Moll BJT kernel

This task starts from released `26d4717` and adds headless DC and incremental frequency/transfer analysis only. The published v1/v2 browser, diode APIs, and nonlinear transients retain their contracts; native v3 is not accepted by the browser. No BJT transient, graphical editing, Early effect, intrinsic resistance/charge, breakdown, Gummel–Poon, MOSFET, or SPICE import is included.

## Model and signs

Q has exact named terminals c,b,e. All three currents enter the device. Set σ=+1 for NPN, −1 for PNP; uBE=σ(VB−VE), uBC=σ(VB−VC), VT=kB T/q using the existing exact constants. Explicit positive finite parameters are transport saturation current IS (A), βF, βR, and T (K). Temperature changes VT only. F=IS expm1(uBE/VT), R=IS expm1(uBC/VT):

- iC=σ[F−(1+1/βR)R]
- iB=σ[F/βF+R/βR]
- iE=σ[R−(1+1/βF)F]

αF=βF/(1+βF), αR=βR/(1+βR); αF IES=αR ICS=IS. These derived quantities do not create independently adjustable parameters. Region names describe junction bias signs, never select different constitutive equations. Tiny derivative underflow is reported as floating-point underflow, not mathematical cutoff. No clipping or artificial conductance is allowed.

For gF=IS exp(uBE/VT)/VT and gR=IS exp(uBC/VT)/VT, the terminal Jacobian in c,b,e order (S) is:

```
[(1+1/βR)gR,  gF−(1+1/βR)gR,          −gF]
[−gR/βR,      gF/βF+gR/βR,            −gF/βF]
[−gR,         gR−(1+1/βF)gF,          (1+1/βF)gF]
```

Its row and column sums vanish. Polarity factors cancel in the derivatives. Check iC+iB+iE=0 and the independent watt identity P=(VC−VE)iC+(VB−VE)iB=(uBE−uBC)(F−R)+uBE F/βF+uBC R/βR. Preserve noncancelled transport magnitudes in arithmetic diagnostics; reference offsets must not inflate physical tolerances.

## Native v3 and assembly

A strict circuit schemaVersion 3 includes unchanged linear/D devices and Q with `model.kind: ebers-moll`, `polarity: npn|pnp`, `transportSaturationCurrentA`, `betaForward`, `betaReverse`, `temperatureK`. Experiment version remains 1. A `terminal-current` observation names a Q component and terminal c|b|e. Existing `current` cannot name Q. Unknown fields, duplicate IDs, missing references and unsupported controls fail; exact IDs and coincident terminal nodes are preserved. Validate Q explicitly, not through a fictitious two-terminal proxy. Reuse existing validation of the remaining subcircuit and experiment.

Q injects its terminal currents/Jacobian additively into nodal KCL. N linear unknowns plus d diode currents remain N+d, independent of Q count. Share the existing bounded DC Newton iteration, fixed pre-search A/V merit scales, physical row checks and equilibrated solves without changing v2 arithmetic or transient iteration. DC uses declared DC sources; C is open and L a short. Results own their document, report three-terminal diagnostics separately from two-terminal powers, reconstruct ground KCL, and require finite regular final Jacobians and signed whole-network power balance.

## Tangent

A bias-owned headless descriptor solves (JQ+sE)δx=Bδu. All external storage, sources, controlled sources and loading remain; Q adds no E stamp. Outputs have rows (C0+s C1)δx+D0δu, including capacitor-current derivatives, diode auxiliary currents and Q terminal derivatives. AC is RMS. Unit-input transfer is a local derivative, not a finite-amplitude response. Current topology/model/DC must match the accepted bias; AC-only changes are allowed. No native-v1 transistor equivalent, general pole extraction, or stability claim is required.

## Acceptance and evidence

Independent law fixtures at VT=.025 V (T=.025q/kB) cover active/reverse/cutoff/saturation/zero bias and PNP mirrors. F=1 mA,R=.1 mA gives (iC,iB,iE)=(.875,.035,−.910) mA. F=R=−IS/2 with IS=1e−12 A, βF=100, βR=4 gives (.125,−.130,.005) pA. Check all nine analytic derivatives over scaled finite differences, reciprocity, voltage shifts, terminal exchange, common-node additive stamps, power and mixed D/Q circuits.

Constructed CE bias uses VE=0, VC=2 V, VB=.025 log(1+1e9), RC=2 kΩ, RL=10 kΩ, RS=1 kΩ with independent KCL source values; gain ≈−47.6190476531. Constructed follower at VE=1 V, VC=5 V and the same VBE, RE=1/(−iE), gives ideal-base gain ≈.9756097561. Independently recompute loading and collector-capacitor complex response, including capacitor and Q current outputs. Include scalar root bracketing, finite-difference DC sensitivity, every supported linear current observation, stale ownership, invalid documents, extreme range, contradictory/floating systems and budget failures.

All 195 baseline scientific expectations remain unchanged. Completion requires clean install, focused/full tests, typecheck, kernel/app/site builds, BJT and both diode demos, DOM-free bundle execution, browser-v3 rejection checks, and diff check. The implementation passed all 23 focused regressions and all 218 tests (the unchanged 195-test baseline plus 23 new tests), typecheck, kernel/application/site builds, all three nonlinear demos, DOM-free bundle execution, production browser-import rejection of v3, and `git diff --check`. Clean installation succeeded. This is task-branch validation, not publication.


### Numerical limits and review evidence

A cutoff solve can satisfy the ordinary ampere absolute floor before its tiny ideal-source currents satisfy signed network power balance. The BJT caller therefore asks the shared static iterator for further corrections when final ground/current/power diagnostics fail; it does not enlarge a tolerance. The diode caller has no such callback and retains its released stopping behavior. A differential check against a clean build of `26d4717` found exactly equal DC results/traces, diode tangents, and short nonlinear-transient results/traces for all eight released nonlinear fixtures.

Arithmetic allowances are dimensioned first-order binary64 estimates, not interval enclosures or certificates. Convergence does not prove root uniqueness, stability, global Newton convergence, or physical model accuracy. Exponentially underflowed derivatives are reported explicitly; nonfinite or unresolved calculations fail. Bias provenance is conservative, and tangent construction rechecks the default physical row tolerances: a point accepted with deliberately looser custom DC tolerances can be unavailable for tangent use. Returned descriptor arrays are inspectable data, not a tamper-proof object. No browser interaction or file-picker/download check was performed for this headless milestone; those paths are unchanged.
