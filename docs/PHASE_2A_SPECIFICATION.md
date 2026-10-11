# Phase 2A: DC one-port equivalence and loading

Status: implemented and locally verified on task branch `codex/phase-2a-one-port`, 10 October 2026. Phase 1B on `main` remains the published release until a separately authorized integration and deployment.

## Scope and conventions

Use the existing strict native v1 document, assembly, DC solve, and diagnostics. This experiment accepts positive resistors, independent voltage/current sources, and VCVS/VCCS/CCVS/CCCS. Reject any capacitor or inductor explicitly; there is no implicit DC replacement. This phase computes finite DC one-port quantities only, not frequency/transient equivalents, synthesis, or a wiring editor. The numerical helper is headless and never mutates its input document.

The user selects distinct existing nodes `p` and `q`. Define `v=V(p)-V(q)` and `i` entering the network at `p` and leaving it at `q`. Thus `v=Vth+Rth*i`. External load current `IL` flows `p→q`, so `i=-IL`. The Norton current-source arrow is `q→p`, with signed `IN=Vth/Rth`. A negative signed quantity means flow opposite the drawn arrow. For positive `RL`, `IL=Vth/(Rth+RL)` and `VL=RL*IL` are explanatory identities; displayed circuit values come from solves.

## Experiments and results

1. Solve the unmodified network without an **additional** port load. Existing components across the port remain. Measure `V(p)-V(q)` for `Vth`.
2. On a temporary copy, zero the DC coordinate of every original independent source while retaining its component and ideal terminal law. Keep every controlled source and its control branch. Add a nonzero test current source with ordered terminals `q,p`, so it injects `J` at `p`; solve `Rth=Vtest/J`. Choose collision-safe component and observation IDs. Preserve each solve's physical residuals and numerical diagnostics.
3. For finite strictly positive `Rth`, form `IN=Vth/Rth`. Independently solve a temporary short formed by a zero-volt source with ordered terminals `p,q`; its positive branch current is delivered `p→q` and should agree with `IN`. A failure or nonfinite derived value is reported, never silently replaced.
4. Add positive `RL` across `p,q` on a copy of the original circuit, solve, and measure `VL` and `IL`. Build separate Thévenin and Norton realizations referenced locally at their negative terminal; solve each with the same load. Preserve the original `p,q` labels in presentation, outside the native schema. Compare terminal voltage and load current, with absolute differences and a declared numerical criterion. Do not compare absolute node potentials across reference choices.

Changing port, load, or the validated document recomputes this experiment. Unapplied form and JSON drafts remain untouched. The original verified preset drawing may be reused; otherwise show the actual topology table, never a guessed custom schematic.

## Explicit outcomes

Distinguish invalid port, unsupported storage device, inconsistent/nonunique/ill-conditioned open, test, short, or loaded solve, zero equivalent resistance, negative equivalent resistance, and nonfinite derived parameters. Zero resistance may be an ideal voltage-source port: no division by zero for Norton. Negative resistance may be a valid controlled-source behavior: do not clip it or call the circuit invalid, but the positive-resistor realization workflow is unsupported here. Do not classify small finite values as zero by a fixed magnitude threshold; rely on exact zero plus solver diagnostics. An ideal current-source port can have no finite open-circuit voltage. Full-state nonuniqueness can be reported even when terminal behavior would be unique; it does not disprove the theorem.

## Browser and localization

Add an accessible Equivalent circuit panel with terminal selectors, positive external-load control, open voltage/resistance/Norton current, original/Thévenin/Norton oriented diagrams, load comparison, source-suppression/test-source explanation, and expandable diagnostics. Show which independent sources were zeroed and that controlled sources stayed active. Add complete English and Mongolian strings to the typed catalog; keep IDs, units, and native JSON language-independent. At 390 px neither language may cause horizontal page overflow.

## Independent acceptance and delivery

The 12 V divider with `R1=1000 Ω`, `R2=2000 Ω`, port out/ground has `Vth=8 V`, `Rth=2000/3 Ω`, `IN=0.012 A`; with `RL=2000 Ω`, `VL=6 V`, `IL=0.003 A`. A differential bridge has branches 1000/2000 Ω and 3000/3000 Ω from 12 V to ground, with midpoints `a,b`: `Vth=2 V`, `Rth=6500/3 Ω`; at `RL=1000 Ω`, `VL=12/19 V`, `IL=12/19000 A`. Reversal changes signed voltage/current but not resistance. A 1000 Ω shunt and 0.001 S VCCS from out to ground, driven by a 0.002 A source from ground to out, gives `Vth=1 V`, `Rth=500 Ω`, `IN=0.002 A`, and `VL=2/3 V` at `RL=1000 Ω`. With the divider source zeroed, `Vth=IN=0` and `Rth` is unchanged.

Also test current-control retention, temporary-ID collisions, invalid ports, zero/negative resistance, unsupported storage, solver failures, and input/draft preservation. Expectations come from independent circuit equations. Run `npm test`, `npm run typecheck`, `npm run build`, `npm run build:site`, and `git diff --check`; exercise the actual browser in both languages at 390 px. Commit and push this task branch only. Do not merge or deploy.

## Verified implementation note

The headless helper uses temporary native documents and the existing assembly/DC solver for all six stages. It returns the underlying solve results and physical diagnostics. The browser panel uses a verified preset schematic or the actual topology table for the original network; the three small port diagrams show connection and sign conventions without pretending to lay out a custom circuit. There is no new native-schema field. Source values, selected port/load, and draft editors remain separate.

The independent fixture equations above passed for the divider, bridge (including reversal), VCCS, zero excitation, and current-control retention. Additional tests cover invalid, unsupported, small finite, zero/negative, inconsistent/nonunique, and collision cases. In the local browser at 390 px, the divider load changed the solved comparison, the bridge imported with `a,b` selected, the VCCS retained its `D` control, and zero/negative resistance and an ideal-current-source open failure were explicit. Both English and Mongolian fitted without horizontal page overflow. An unapplied form value and malformed JSON draft survived port/load changes, a language switch, and a validated source edit; the last action displayed both existing conflict notices while recomputing the one-port values. No browser console error was observed.
