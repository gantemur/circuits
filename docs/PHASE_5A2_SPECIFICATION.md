# Phase 5A2 — exact rational RC Foster synthesis

**Release status:** Published with Phases 5A1–5A3 from accepted `55ba7cb77a88153fff706f18a62d3625848ca73b`. See the controlled publication record in [DECISIONS.md](DECISIONS.md). Task-stage instructions and verification records below are historical.

This headless task starts from accepted Phase 5A1 `ac6b6d2`. No existing arithmetic, solver tolerance, native schema or browser behavior is changed. No merge, publication, root finding, algebraic-number approximation or Synthesize UI is authorized.

## Strict request

`synthesizeRcFoster` accepts `method: 'foster-I', quantity: 'impedance'` with `decomposition: {rInfinity, kZero, terms: [{pole, residue}]}`, or `method: 'foster-II', quantity: 'admittance'` with `decomposition: {gZero, cInfinity, terms: [{pole, coefficient}]}`. All numbers are exact rational strings. Both require positive `referenceResistanceOhm` and `referenceAngularFrequencyPerSecond`. Optional `target: {numerator, denominator}` uses ascending exact polynomial coefficients in the request's quantity. Unknown fields and malformed values fail. A target-only request (decomposition omitted) returns `decomposition-unavailable`, not a realizability rejection; no root finder is attempted.

With z=s/omegaRef, Z=Rref F and Y=G/Rref. Foster I has F=rInfinity+kZero/z+sum k/(z+p). Foster II has G=gZero+cInfinity*z+sum a*z/(z+p). Endpoints are nonnegative; each supplied finite coefficient and pole is strictly positive. Negative finite entries are invalid even if another entry could cancel them. Sort poles by exact comparison, combine equal rates exactly and record original indices; never merge nearly equal rates. Zero endpoints are omitted. A zero F/G is a short/open boundary, without a fictional native element. A supplied target must match even in boundary cases.

## Constructive certificate

Build the rational decomposition with existing bounded exact polynomial arithmetic. Foster I sections are a series R=rInfinity, series C=1/kZero, and parallel RC pairs R=k/p, C=1/k. Foster II branches are parallel R=1/gZero, C=cInfinity, and series RC pairs R=1/a, C=a/p. All values here are normalized. Each section's element law independently reconstructs its exact contribution: parallel RC impedance R/(1+zRC), or series RC admittance zC/(1+zRC). Summing the actual sections in the proper domain and exact cross-multiplied equality with the decomposition (and optional independent target) establishes the certificate. Ordinary residues of Foster II terms are -a*p; do not apply Foster I residue signs to these admittance coefficients.

Return canonical decomposition, exact pole combinations, sections with normalized elements and identity evidence, reconstructed polynomial function, normalized impedance target, supplied-target identity/canceled factor when present, exact limits in the request domain and impedance domain, and exact reference scales. An exact certificate remains valid if native conversion or MNA later fails.

## Physical circuits and evidence

Foster I chains sections from `port` to `0`; both devices of every parallel section share its two terminals. Foster II connects branches across `port`/`0`; each finite series RC branch has its own intermediate node. Endpoint omission changes section count, not values. IDs are allocated without collisions. Check graph connectivity/orientation, finite stamps and strict native v1 round-trip, with source-free experiments and all capacitor initial values zero. Reuse Phase 5A1 conversion/document checks: R=Rref*r and C=c/(Rref*omegaRef), with exact rounding discrepancy and unchanged range/error guards.

Reuse `verifyRcRealization` unchanged for both physical Z/Y tests at j*[.01,.1,1,10,100], .1+j and 1+j. Targets come from independent supplied polynomials when present, otherwise exact reconstruction. Keep original residual tolerances, normalized comparison threshold and RMS-only signed-power checks. Exact certificate, native availability and physical passed/unresolved/mismatch are separate results. Budget failure is never invalid realizability.

## Bounds and acceptance

Reuse all Phase 5A1 ceilings unchanged: raw polynomial degree/maximum raw term count 16, reduced numerator/denominator degree 8, 1024 characters/string, 32768 aggregate input characters, exponent magnitude 2048, intermediate integers 8192 bits, 1000000 charged operations. Callers may lower ceilings. Canonicalization, reconstruction, target identity, conversion and verification share the budget. More than eight distinct rates or extra endpoint degree may exceed the reduced degree cap even if the representation is valid mathematically.

Principal target F=(z²+4z+3)/(z²+2z): Foster I is 1+3/(2z)+1/[2(z+2)], with R1, C2/3, parallel(R1/4,C2). Foster II is G=(1/2)z/(z+1)+(1/2)z/(z+3), with parallel branches series(R2,C1/2) and series(R2,C1/6). Cauer remains R1,C1/2,R4,C1/6. Test distinct connections and counts (all three happen to have four components), exact identities, F(i)=6/5−8i/5 and multiple SI scales using independently assembled MNA.

Also test constant/pure-C and single/multiple finite terms, nonzero/omitted endpoints, duplicate/near rates, signs, malformed requests, target mismatch, exact GCD cancellation, boundaries, ID safety, extreme native values, certificate retention, resource stages and target-only irrational-pole requests. Preserve all 262 existing tests including degree-eight Cauer and its recorded near-cancellation limitation. Run clean install, focused/full tests, typecheck, all builds, nonlinear/Cauer/Foster demos, DOM-free checks and diff check. Compare the browser's three publishing assets with the accepted baseline. Record actual results at completion.

## Element-law derivation and principal identity

A normalized parallel RC section has impedance `r/(1+z*r*c)`. Substituting `r=k/p`, `c=1/k` gives exactly `k/(z+p)`. Its physical devices therefore have R=Rref*k/p and C=1/(Rref*omegaRef*k). Since impedances add in series, Foster I's endpoints and sections sum to the prescribed F. The series capacitor for kZero/z has normalized c=1/kZero, not kZero.

A normalized series RC branch has admittance `z*c/(1+z*r*c)`. Substituting `r=1/a`, `c=a/p` gives exactly `a*z/(z+p)`. Its devices have R=Rref/a and C=a/(Rref*omegaRef*p). Parallel admittances add, so Foster II's branches sum to G. Rewriting a term as `a-a*p/(z+p)` explains the negative ordinary residue without any negative physical element. Nonzero positive branch sums yield a passive RC realization; their reciprocal impedance is rational Stieltjes. These constructive identities, not a sampled nonnegative real part, establish realizability within the supplied-decomposition class.

For the principal example, `F-1=(2z+3)/(z(z+2))=3/(2z)+1/[2(z+2)]`. Independently, `1/F=z(z+2)/((z+1)(z+3))=(1/2)z/(z+1)+(1/2)z/(z+3)`. Both reproduce F(i)=6/5−8i/5. With Rref=1000 ohms and omegaRef=1000 rad/s, Foster I contains series R=1000 ohms, series C=2/3 microfarad, then parallel R=250 ohms/C=2 microfarads. Foster II contains two parallel series branches: R=2000 ohms/C=1/2 microfarad, and R=2000 ohms/C=1/6 microfarad. They and the accepted Cauer circuit all contain four components, with different edges and values.

## Failure and certificate semantics

Malformed strings/fields/scales or inconsistent method/quantity are `invalid-input`. Incorrect signs and supplied-target disagreement are `invalid-decomposition`; this rejects the submitted representation, not every possible target class. `decomposition-unavailable` applies to a well-formed polynomial-only request, including irrational-pole RC targets accepted by Cauer. General exact factorization is deliberately absent. `resource-limit` names the stage and leaves realizability undecided.

A certified result records the exact reconstructed function in the request domain, the impedance target for physical checks, per-section contribution/cumulative sum/identity, normalized element values, canonical endpoints/terms and duplicate source indices. A supplied target's reduced coefficients and canceled factor are retained with exact identity evidence. Limits are labeled separately for the request quantity and impedance. Omitted endpoints produce no section/device. Native conversion adds component IDs to the sections and records exact SI values and rounding discrepancies in separate native evidence. Any later failure preserves the completed mathematical certificate.

The small refactor of `synthesis-netlist.ts` exposes the accepted SI conversion and graph/document checks as shared helpers. Their arithmetic order, tolerances and resource charging remain unchanged. The Cauer algorithm, exact arithmetic modules, physical verifier and numerical solvers are unchanged. Foster topology has its own generator; it is not passed through the Cauer ladder builder. Low-level generation helpers require the positive sections produced by the checked high-level entry.

## Actual validation

Completed locally: clean npm ci; 29 focused Foster regressions; all 291 tests (262 unchanged plus 29); typecheck; kernel/application/site builds; diode, diode-transient, BJT, Cauer and Foster demos; empty-context DOM-free bundle checks for both methods; and diff check. The degree-eight cases (eight finite rates, 16 devices) pass all seven Z/Y sample pairs and ten RMS power comparisons under the unchanged budgets. Main-target MNA results are approximately 1200−1600i ohms and 0.0003+0.0004i siemens at s=i1000.

The exact Foster I target `1+10^-12/(z+1)` keeps its certificate and generated native circuit but is numerically unresolved when the unchanged MNA physical KCL check fails. Range, conversion and operation-budget failures likewise remain distinct. No universal accuracy claim is made. Local ignored publishing sync duplicates were left untouched; isolated baseline/candidate builds each contain only index.html, app.js and style.css, and all three files match byte for byte. This is build evidence, not a new public browser check or deployment. See DECISIONS for hashes and evidence. No Foster root finder or browser workspace is included.
