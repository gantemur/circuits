# Phase 2C — linear port analysis and loading

Status: implemented on `codex/phase-2c-port-analysis`, integrated through reviewed Phase 2D1 commit `edffe839`, and published on `main` after successful [validation](https://github.com/gantemur/circuits/actions/runs/38182928106) and [Pages deployment](https://github.com/gantemur/circuits/actions/runs/38182928373). This specification was written before implementation. The milestone adds frequency-domain terminal experiments for existing linear R, C, L, independent, and controlled sources. It does not change native v1 JSON, the DC Thévenin/Norton Transform method, or the meaning of any existing analysis.

## Model boundary and signs

A selected port is an ordered pair of exact existing node IDs `(p,q)`, with `V=V(p)−V(q)` and positive current entering the characterized network at `p` and leaving at `q`. Ground is only the voltage reference. A two-port has `V=ZI` and `I=YV`, with both currents entering their ports. Thus an output load obeys `I2=−V2/RL`. Each pair needs distinct nodes; two-port pairs cannot be identical or reverse-identical. Shared returns and distinct differential ports are supported. IDs may contain commas, colons, and spaces and are never parsed from a delimiter string.

The student explicitly chooses whether to exclude one independent voltage-source branch across port 1 as an external drive; neither orientation is inferred. All other independent sources remain in the temporary network with source coordinates suppressed, including configured AC phasors. Controlled sources and their control references remain. Exclusion is rejected if a retained current-controlled source measures the removed branch. Temporary circuit, source, and observation IDs avoid collisions; the applied document and editor drafts remain unchanged. No leakage, extra ground, pseudoinverse, substitute impedance, or regularization repairs a failed solve.

## Physical parameter experiments

At finite `f≥0` with finite `ω=2πf`, Z columns are measured by injecting a nonzero known current from `q` to `p` at one port while leaving the other externally open, then dividing every measured port voltage by the actual current amplitude. Y columns use a known clamping voltage on the driven port and a zero-volt clamp on the other; the current entering the network is the negative of the clamping source's branch current. Divide by the actual voltage amplitude. Build and solve Z and Y independently using the existing complex MNA solver and physical residual diagnostics, never by inversion. A representation may fail while the other succeeds. Return typed port order, frequency, Ω/S units, matrix values, per-stage diagnostics, and an explicit outcome for invalid selections, incompatible constraints, nonunique solves, numerical/nonfinite failure, or unsupported exclusion. A full-state nonunique solve does not prove a unique terminal representation is mathematically absent. A success has only finite entries.

## Loading experiment

For two ports, attach a 1 V RMS Thévenin source with finite `Rs≥0` to port 1, and either a finite positive `RL` across port 2 or an explicitly tagged open load. Predictions from each available representation solve `V1=Vs−Rs I1` and either `V2=−RL I2` or `I2=0`. Separately attach physical source, series resistance, and load to the same temporary characterized network and solve it directly. Compare complex `V1,V2,I1,I2` with voltage and current limits in their own units. Report source-to-output `V2/Vs`, terminal gain `V2/V1` where defined, and `V1/I1` only for nonzero input current. Direct success remains visible if one parameter prediction is unavailable. These are floating-point frequency samples, not all-frequency, passivity, or stability proofs.

## Browser workspace

Add one configurable Analyze panel type, “Port analysis — frequency”, without a new global workspace. It offers one/two-port mode, ordered exact-ID selectors, optional external-drive exclusion, a single frequency including DC, a strictly positive logarithmic sweep, Z/Y and matrix-entry selection, and a two-port loading view. Matrices identify port order and Ω/S units; complex values are readable. Magnitude and phase curves use existing plot conventions, with no unreferenced impedance/admittance dB scaling. Undefined phase and failed samples remain explicit gaps. Settings start collapsed; matrices scroll locally on narrow screens. The existing three-panel cap, independent duplicate settings, stable IDs, pending-invalid text, last-valid result, navigation, editor drafts/conflicts, language switching, and source/load isolation remain. Missing nodes or excluded-source references require explicit correction; type changes recompute reference requirements. CSV has stable English headers, units, metadata, and explicit failed/undefined values. Panel configuration stays browser-only.

Add source-free native examples for a passive resistor T, one RC section, and two directly connected equal RC sections, with port suggestions. They may use the honest topology-table fallback. Provide complete English/Mongolian labels, explanations, and error text.

## Independent acceptance

- One-port series RC: `Z=R+1/(sC)`, `Y=sC/(1+sRC)` at positive frequency, including real/imaginary, magnitude, and phase; at DC, Y is zero while the current-driven Z experiment is unavailable.
- Resistor T: `Z11=Ra+Rc`, `Z22=Rb+Rc`, `Z12=Z21=Rc`; derive Y and loaded results independently for multiple `Rs,RL`.
- RC section: with `g=1/R`, `Y=[[g,−g],[−g,g+sC]]`; at nonzero `s`, `Z=[[R+1/(sC),1/(sC)],[1/(sC),1/(sC)]]`. At DC, Y is valid and Z unavailable.
- Two equal directly connected RC sections, ideal source and open output: `Vout/Vs=1/(1+3sRC+(sRC)^2)`, distinct from the product `1/(1+sRC)^2`. Check finite output load and nonzero source resistance against independently written nodal equations.
- A VCCS example establishes nonreciprocal cross-coupling signs and controlled-law retention after independent-source suppression. Check port reversal (`M′=DMD`), port swaps, differential ports, nonunit normalization amplitudes, exact punctuation-containing IDs, generated-ID collisions, explicit source exclusion and blocked controls, invalid/dependent/stale selections, finite-range and singular outcomes, and input immutability.
- Browser interaction tests cover independent duplicate panels, invalid drafts, and reference changes. Actual browser checks cover the new examples, DC-unavailable explanation, source/load edits, external exclusion, orientation, panel duplicates, Form/JSON preservation, desktop/390/320 px, both languages, local scrolling, visible curves, and console errors. File-picker/download completion is not a new acceptance gate; preserve existing paths and report any regression.

Run focused and full tests, typecheck, build, site build, and `git diff --check`. Document assumptions, equations, dimensions, units, normalization, numerical diagnostics, and limits in source and `docs/CODE_GUIDE.md`; update conventions, UX specification, localization glossary, README, and decision log as appropriate. Commit and push only `codex/phase-2c-port-analysis`. Do not merge or deploy.

## Excluded work

No new devices, nonlinear operating points, general rational extraction, pole/zero methods, scattering, ABCD/hybrid parameters, synthesis, dynamic Kron reduction, wiring UI, or general n-port framework.
