# Phase 2D2 — richer linear examples and filter experiments

This task-branch milestone extends the released 14-example lab to **22 presets**. It uses the existing R, C, L, independent-source, and VCVS models and existing analysis workspaces. It does not change native v1 JSON, kernel algorithms, tolerances, failure classifications, or the published site. General rational extraction, synthesis, new devices, wiring, and autorouting remain outside scope. The voltage divider remains the initial example.

## Experiment conventions

Each of the six transfer circuits uses `Vin` from `in` (+) to `0` (−): DC 1 V, AC 1 V RMS at zero phase, and a 0→1 V step at t=0. Capacitor voltages and inductor currents start at zero at t=0−. A transfer is the selected zero-state voltage divided by this unit input. Initial node voltages at t=0+ are determined by the circuit; high-pass and notch outputs may jump. Frequency calculations use `s=i2πf`.

The two source-free ladders have no permanent drive or load. Their ordered port is `(in,0)`, with `Vport=V(in)−V(0)` and positive current entering at `in`; `Z=Vport/Iport` in Ω and `Y=Iport/Vport` in S. Analyze them with the existing physical port experiment.

## Eight required native fixtures

| ID | Elements and output | Baseline reference |
| --- | --- | --- |
| `rc3-low-pass` | `0,in,a,b,out`; R1 `in–a`, R2 `a–b`, R3 `b–out`, each 1 kΩ; C1 `a–0`, C2 `b–0`, C3 `out–0`, each `x3/(2π·10⁶)` F; output `out–0`, unloaded | `H(z)=1/(1+6z+5z²+z³)`, `z=sRC`, `x3=0.1942860004595122` |
| `rc3-high-pass` | Same nodes; C1 `in–a`, C2 `a–b`, C3 `b–out`, each `1/(x3·2π·10⁶)` F; R1 `a–0`, R2 `b–0`, R3 `out–0`, each 1 kΩ; output `out–0`, unloaded | `H(z)=z³/(1+5z+6z²+z³)`, `z=sRC` |
| `butterworth2-low-pass` | `0,in,a,b,out`; R1 `in–a`, R2 `a–b`, each 11253.953951963826 Ω; Cg `b–0` 10 nF; Cf `a–out` 20 nF; VCVS `out–0` sensing `b–0`, gain 1; RL `out–0` 10 kΩ; output `out–0` | `H(s)=1/[1+sCg(R1+R2)+s²R1R2CfCg]=1/(1+√2z+z²)`, `z=s/(2π·1000)` |
| `butterworth2-high-pass` | Same nodes, follower, RL, output; C1 `in–a`, C2 `a–b` 10 nF; Rf `a–out` 11253.953951963826 Ω; Rg `b–0` 22507.907903927652 Ω | `H(s)=s²RfRgC1C2/[1+sRf(C1+C2)+s²RfRgC1C2]=z²/(1+√2z+z²)` |
| `rlc-band-pass` | `0,in,a,b`; Rbp `in–a` 100 Ω, Lbp `a–b` 0.01 H, Cbp `b–0` 1 µF; default output `in–a` across R; also observe `a–0`, `a–b`, `b–0`, and L current | `D=1+sRC+s²LC`; `Hband=sRC/D`; `ω0=10000 rad/s`, `Q=1` |
| `rlc-notch` | Same physical series arrangement with distinct IDs Rn/Ln/Cn and same observations; default output `a–0` across L+C | `Hnotch=(1+s²LC)/D`; `Hband+Hnotch=1` |
| `rc-impedance-ladder` | Source-free `0,in,a,b,out`; R1 `in–a` 1 kΩ, R2 `a–b` 2 kΩ, R3 `b–out` 3 kΩ; C1 `a–0` 1 µF, C2 `b–0` 0.5 µF, C3 `out–0` 0.25 µF | `Z3=R3+1/(sC3)`, `Z2=R2+1/(sC2+1/Z3)`, `Z=R1+1/(sC1+1/Z2)` |
| `rl-impedance-ladder` | Source-free same nodes; L1 `in–a` 1 H, L2 `a–b` 2 H, L3 `b–out` 3 H; R1 `a–0` 1 kΩ, R2 `b–0` 2 kΩ, R3 `out–0` 3 kΩ | `Z3=sL3+R3`, `Z2=sL2+1/(1/R2+1/Z3)`, `Z=sL1+1/(1/R1+1/Z2)` |

The root `x3` satisfies `x3⁶+13x3⁴+26x3²=1`; these RC3 values set the complete circuit, rather than an isolated element, to −3 dB at 1000 Hz. The Butterworth baseline has `ωc=2π·1000` rad/s. For equal high-pass capacitors, `ωn=1/[C√(RfRg)]` and `Q=0.5√(Rg/Rf)`. The follower is an ideal powered VCVS with infinite sensing impedance and zero output impedance, without supply, current, or headroom limits. The Butterworth name applies to the baseline ratios, not arbitrary edits. The RLC resonance is `f0≈1591.5494309189535 Hz`; resistor-output gain is one and L+C output is zero there, within floating-point evaluation limits. Its half-power bandwidth is `R/L`. At the ideal notch zero, phase is undefined.

The RC3 low-pass capacitor is approximately `3.0921577346685614e-8 F`; its normalized node equations are `(2+z)Va−Vb=Vin`, `−Va+(2+z)Vb−Vout=0`, `−Vb+(1+z)Vout=0`. The high-pass capacitor is approximately `8.191786475375105e-7 F`; its equations are `(1+2z)Va−zVb=zVin`, `−zVa+(1+2z)Vb−zVout=0`, `−zVb+(1+z)Vout=0`. The low-pass approaches −60 dB/decade far above its corner; the high-pass approaches +60 dB/decade far below it. The high-pass starts at 1 V after the step and ends at zero; multiple zeros can make intermediate samples change sign.

For the active low-pass, KCL at `a` is `(Va−Vin)/R1+(Va−Vb)/R2+sCf(Va−Vout)=0`, and at `b` it is `(Vb−Va)/R2+sCgVb=0`. For the active high-pass, the distinct KCL equations are `sC1(Va−Vin)+sC2(Va−Vb)+(Va−Vout)/Rf=0` and `sC2(Vb−Va)+Vb/Rg=0`. In both, the ideal follower enforces `Vout=Vb`; RL draws output current without altering that ideal transfer. Changing follower gain changes the feedback interconnection rather than applying a simple output multiplier.

The RC ladder has `Z(∞)=1000 Ω`, `sZ→1/(C1+C2+C3)` near DC, DC `Y=0`, and no finite DC `Z`. Its constant-first SI-s coefficients are numerator `[4000000/7,16000/7,27/14,3/7000]`, denominator `[0,1,3/2000,3/7000000]`. The RL ladder has `Z(0)=6000/11 Ω`, `Z/s→L1`, and `Z−sL1→R1` at high frequency. Its coefficients are numerator `[6000/11,27/11,1/440,3/5500000]`, denominator `[1,19/11000,3/5500000]`. References must give units, exact output/port, baseline values, and source/load/zero-state assumptions; they remain fixed, explicitly baseline targets after edits.

## Browser behavior

Group the bilingual selector for passive filters, active filters, impedance ladders, resistor transformations, and two-port lessons. Provide an English/Mongolian guide for every new preset with a question, assumptions, equations, two or three exact experiments, and interpretation. Teach loading, whole-network cutoff versus element break, eventual roll-off versus corner rejection, transient tradeoffs, ideal-buffer loading, measurement-dependent RLC responses, and continued fractions. The RC3 loading lesson must explicitly select two-port input `(in,0)`, output `(out,0)`, exclude `Vin` as external drive, and add a temporary load.

All eight presets need conservative, verified whole-circuit SVGs showing actual connectivity, source polarity, sensing/feedback, differential measurements, current values, keyboard-operable component selection, and an exact expandable topology table. Edits that retain topology keep a curated layout; incompatible documents use the existing explicit fallback. Do not bypass collision checks.

Fresh suggested panels use bounded ranges: RC3 low-pass transient 2 ms/2 µs, RC3 high-pass 20 ms/20 µs, Butterworth and RLC transient 2 ms/2 µs; four low/high-pass frequency 10 Hz–100 kHz inspecting 1000 Hz; RLC frequency `f0/100–100f0` inspecting `f0`; ladders one-port Z sweep 1 Hz–100 kHz inspecting 1000 Hz. Initial defaults never replace user settings after edits. Preserve duplicate panels, invalid drafts, IDs, three-panel limit, form/JSON drafts, and existing navigation semantics.

## Acceptance

Validate and round-trip all eight fixtures, including import identity and default output; retain accurate selectable drawings for all 22 examples. Derive independent complex node-equation, rational, continued-fraction, endpoint, loaded-response, current-sign, and step-response expectations. At 1000 Hz the RC3 and Butterworth magnitudes are `1/√2`; the Butterworth low/high responses are `−i/√2` and `+i/√2`. RC3 low-pass with 1 kΩ temporary output load has DC gains `1/4` at zero source resistance and `2/9` with 500 Ω source resistance. Butterworth magnitude at the stated doubled/halved frequencies is `1/√17`. For step checks, use `α=β=ωc/√2`, low-pass `1−e^(−αt)[cos(βt)+sin(βt)]`, high-pass `e^(−αt)[cos(βt)−sin(βt)]`; RLC uses `α=R/(2L)`, `β=√(1/(LC)−α²)`, band-pass `(2α/β)e^(−αt)sin(βt)`, notch one minus this. Demonstrate first-order backward-Euler improvement on refinement without exceeding workload limits.

Test default layouts, independent panels, invalid settings, baseline labels after edits/imports, draft preservation, bilingual guides, and panel-limit navigation. In the actual local browser inspect all eight circuits, plots and edits, component selection by pointer and keyboard, guide actions, JSON entry, both languages, desktop/390/320 px, page overflow, and console errors. Run `npm ci`, focused and full tests, typecheck, build, site build, and `git diff --check`. Document actual verification and any limits. Commit and push only the task branch; do not merge or deploy.
