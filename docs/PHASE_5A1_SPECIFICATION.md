# Phase 5A1 — exact rational RC Cauer synthesis

This headless task starts from released `30c2857`. It changes no existing solver, native schema, nonlinear model or browser behavior. Foster synthesis and a Synthesize workspace are excluded.

## Input and theorem

Strict input contains `quantity: impedance|admittance`, `method: cauer-infinity`, ascending `numerator`/`denominator` arrays of exact rational strings, and positive exact `referenceResistanceOhm` and `referenceAngularFrequencyPerSecond`. With z=s/omegaRef, Z=Rref F and Y=G/Rref; admittance input is reciprocated before synthesis. Integers, fractions, decimals and bounded scientific notation are parsed without binary64 coefficients. Cancel polynomial GCD exactly and report it. Zero impedance/admittance are short/open boundary outcomes without native stand-ins.

A nonzero RC impedance is precisely a rational Stieltjes function rInfinity+kZero/z+sum(kj/(z+pj)), with nonnegative endpoint coefficients and positive residues/rates. Cauer synthesis needs neither roots nor factorization: extract r=Z(infinity), subtract, invert; extract c=lim(Y/z), subtract and invert again. Only the initial r may be zero. Every capacitor is positive and reduces the denominator degree. Zero remainder terminates at the current element. Positive extracted elements plus exact continued-fraction reconstruction certify realizability. Invalid exact degree/sign transitions reject the class; resource exhaustion does not.

## Arithmetic and trace

Use reduced BigInt fractions and ascending polynomials, Euclidean division/GCD, reciprocal and cross-multiplied identity checks. Bound raw degree (16), reduced degree (8), individual input string length (1024), aggregate input characters (32768), decimal exponents (2048), intermediate integers (8192 bits), and charged arithmetic/GCD operations (1000000). Callers may lower budgets, never raise these hard limits. Every exact stage, including normalization/GCD, conversion and target evaluation, is bounded. Resource outcomes name their stage.

Trace records before/remainder functions, impedance/admittance domain, exact coefficient, positivity, degree change, omission of initial zero R, stage identity and generated component ID. Exact mathematical quantities are serialized as canonical rational strings; traces never enter native JSON.

## Circuit and numerical evidence

Generate the series-R/shunt-C ladder with correct resistive or capacitive termination, explicit `port`/`0` terminals, positive finite R/C, collision-free IDs, voltage observation and source-free v1 experiment with zero capacitor storage values. SI conversion is R=Rref*r and C=c/(Rref*omegaRef). Round rational values directly to binary64 by integer quotient/remainder; report exact rounding discrepancy. Reject unusable values without losing the certificate. Validate and serialize/parse the document.

Verify both Z and Y via existing physical `analyzePorts` experiments on positive imaginary frequencies; use temporary sources with existing assemble/solveFrequency for right-half-plane s. I enters p; current test is q→p and clamp current is negated. Default normalized points are j*[.01,.1,1,10,100] and .1+j, 1+j. Compare each normalized immittance with 1e-9+1e-8*max magnitudes; retain existing physical residual checks. Imaginary-axis experiments independently compare V*conj(I) with resistor real power and capacitor negative reactive power. Off-axis solves do not claim RMS power. Compute DC/infinity limits exactly; no topology contraction engine or enormous-frequency substitute is added.

Exact certificate, native conversion and numerical verification are distinct typed results. Native numerical failure never changes exact certification. No unverified native circuit is called verified. Mathematical certification does not prove physical model accuracy or global numerical accuracy.

## Acceptance

Preserve all 232 released tests. Independently check elementary R/C, initial zero-R omission, (z²+4z+3)/(z²+2z) → R1,C1/2,R4,C1/6, F(1)=8/3, F(j)=6/5−8j/5, DC residue 3/2 and infinity 1; SI scales 1000/1000 give 1200−1600j ohms. The denominator z²+3z+1 gives an all-one ladder without resolving its irrational poles. Cover negative residues, repeated/RHP/complex poles, improper targets, boundaries, exact/near factors, poles 1e-12 apart, strict input and all budgets, native range failure with retained certificate, topology/current signs, multiple scales and independent power/MNA checks. Run clean install, focused/full tests, typecheck, all builds, nonlinear and synthesis demos, DOM-free smoke and diff check. Record actual evidence at completion; no merge or deployment.

## Constructive argument and worked reading example

All coefficients are real rationals. First cancel the exact polynomial GCD; the theorem applies to the reduced meromorphic function, not an uncanceled denominator. A rational Stieltjes impedance has simple negative real finite poles with positive residues, possibly a simple pole at zero and a nonnegative constant at infinity. Complex, positive-real-axis, and genuinely repeated reduced poles are outside this class. Rational coefficients need not imply rational pole locations.

For a nonconstant stage, write `A=Z-rInfinity`. Its expansion is `A=M0/z-M1/z²+…`, where `M0=kZero+sum kj>0` and `M1=sum kj*pj≥0`. Consequently `1/A=z/M0+M1/M0²+…`; the extracted shunt capacitance is `c=1/M0>0`. The reciprocal of a nonzero Stieltjes function is a complete Bernstein rational function. Removing its nonnegative linear term leaves another such admittance; its reciprocal is a Stieltjes impedance. If `M1=0`, only the zero-frequency atom remains and the capacitor terminates the ladder. Otherwise the next resistance is strictly positive. This is the finite RC Cauer theorem behind the sign tests, not a sampled positive-realness test.

Algebraically, if the current denominator degree is d, `A=P/Q` has degrees d−1 and d. After extracting `cz` from `Q/P`, the new impedance denominator is `Q-czP`, of degree at most d−1 before further exact cancellation. A nonterminal pair therefore strictly reduces degree. At most eight capacitor stages and nine resistor stages are needed at the default cap. A rejected exact sign or degree transition violates this theorem; an exhausted computation says nothing about realizability.

For the principal target:

```
Z0 = (z²+4z+3)/(z²+2z)
r0 = 1; A0 = (2z+3)/(z²+2z)
Y1 = (z²+2z)/(2z+3)
c1 = 1/2; B1 = z/(4z+6)
Z1 = 4+6/z
r1 = 4; A1 = 6/z
Y2 = z/6
c2 = 1/6; B2 = 0
```

Thus `Z0=1+1/(z/2+1/(4+6/z))`. Reconstruction starts at the termination and reverses series addition and parallel admittance addition. Cross-multiplied polynomial equality with the input proves the exact identity. Together with positive elements this is a constructive certificate, independent of the floating-point MNA experiments. The second target `(z²+4z+3)/(z²+3z+1)` similarly reconstructs `1+1/(z+1/(1+1/(z+1)))`, five unity elements, although its poles are irrational.

## Numerical and resource limitations

All exact operations share one budget, including integer normalization, polynomial GCD, reconstruction, SI conversion and rational complex reference evaluation. Products have conservative preallocation bit guards; an intermediate may exceed the budget even if its reduced result would fit. Degree-eight unity ladders are covered by the default one-million-operation budget. Callers can lower it for stricter execution bounds. The count measures charged arithmetic/Euclid steps, not elapsed time. This bounded exact implementation is deliberately not a general symbolic system.

Binary64 conversion rounds an integer quotient at the appropriate binary quantum, ties to even, including subnormals. It records `rounded-exact` as a rational discrepancy and a numerical relative-error estimate. Native generation declines zero/nonfinite conversion, relative conversion error greater than `8*Number.EPSILON`, nonfinite resistor conductance, or nonfinite assembled entries. Reference scales and experiment frequencies must also be representable to obtain numerical verification. A conversion budget/range limit preserves the completed mathematical certificate.

Physical tests use a current amplitude `1/Rref` A and voltage amplitude 1 V; their numerical scale conversion is separate from exact input parsing. The reference polynomial is evaluated rationally at the actual binary64 complex s used by MNA, divided by the exact omegaRef. Z and Y comparisons use the specified dimensionless tolerance. Power comparisons use the same normalized threshold with power reference `(1 V)²/Rref`, and report their differences and limits in VA. They are floating-point diagnostics, not rigorous interval error bounds. Off-axis points have no RMS power checks. Nonrepresentable reference evaluation, power or physical residuals produce `unresolved`; finite disagreements produce `mismatch`.

A concrete retained-certificate limitation is `1+10^-12/(z+1)`: exact extraction gives R=1, C=10^12, R=10^-12, but the existing solver fails its physical KCL residual at one of the prescribed points. No tolerance is relaxed. DC and infinity outcomes remain exact function limits, not claims that a singular full-state DC problem was solved.

## Completed task-branch evidence

The implementation passes 30 focused synthesis tests and all 262 total tests (232 unchanged baseline). Clean installation, typecheck, kernel/application/site builds, diode/diode-transient/BJT/synthesis demos, DOM-free bundle smoke and diff check passed. The generated three-file application package is byte-identical to an isolated build of released baseline `30c2857`; no browser or public deployment was performed. See the Phase 5A1 decision entry for sample values, budgets and actual numerical limitations. Independent controller review remains the next gate; Foster and browser integration are excluded.
