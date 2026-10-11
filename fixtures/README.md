# Phase 0 fixture and expected-result manifest

All values are SI. Each native JSON file contains a circuit (including its load and named observations) and an experiment (all independent sources, DC/AC/time values, and an explicit initial-condition policy). Transfer tests use the indicated unit input, zero other independent coordinates, and zero initial state. A missing external load means the explicitly shown branches are the entire load. The two test files use these equations independently of the assembly and solver implementation.

| Contract | Fixture | Independent expectation |
| --- | --- | --- |
| A | `divider.json` | Vin=12 V, R1=1000 ohm, R2=2000 ohm: Vout=8 V, I(Vin)=-4 mA, I(R1)=4 mA; total absorbed power zero |
| A | `current-parallel.json` | Iin=3 mA from ground into R1=1000 and R2=2000 ohm: Vout=Iin/(1/R1+1/R2)=2 V |
| B, E | `rc.json` | R=1000 ohm, C=1 uF: H(s)=1/(1+0.001s), fc=1/(2*pi*0.001) Hz; H(j/RC)=(1-j)/2; pole -1000/s |
| B, E | `rc-high-pass.json` | C=1 uF from in to out, R=1000 ohm from out to ground: H(s)=sRC/(1+sRC), H(0)=0, H(j/RC)=(1+j)/2; a 1 V step with vC(0)=0 gives out(0-)=0, out(0+)=1 V and vC continuous at 0, then out,n=(1+h/RC)^-n V by backward Euler |
| B | `rc-loaded.json` | Extra RL=2000 ohm: H(s)=1/(1.5+0.001s); pole -1500/s |
| B | `rc-cascade.json` | Two directly connected identical RC sections: H(s)=1/(1+3sRC+(sRC)^2), different from (1+sRC)^-2 |
| C | `vcvs.json` | Vin=2 V, mu=3, RL=1000 ohm: Vout=6 V, I(load)=6 mA, I(dependent)=-6 mA |
| C | `vccs.json` | Vin=2 V, g=0.002 S, RL=1000 ohm: Vout=-4 V, I(dependent)=4 mA |
| C | `ccvs.json` | Vin=2 V, Rs=1000 ohm, zero-volt sensor: ic=2 mA; r=500 ohm gives Vout=1 V |
| C | `cccs.json` | Same sensor, beta=3 and RL=1000 ohm: Vout=-6 V, I(dependent)=6 mA |
| D | `rl.json` | R=100 ohm, L=0.1 H: IDC=Vin/R=10 mA, VL,DC=0; I(s)/V(s)=1/(100+0.1s) |
| D | `rlc.json` | R=10 ohm, L=0.01 H, C=1 uF: H(s)=1/(1+1e-5s+1e-8s^2); test around omega0=10000 rad/s |
| E | `rc-discharge.json` | C initially 2 V, R=1000 ohm: v(t)=2exp(-t/0.001); vn=2(1+h/0.001)^-n |
| E | `rl-decay.json` | L initially 20 mA, R=100 ohm: i(t)=0.02exp(-t/0.001); in=0.02(1+h/0.001)^-n; initial node voltage -2 V |
| E | `rlc-initial.json` | Same RLC with zero source, vC(0)=1 V, iL(0)=0: in+1=(in-h*vn/L)/(1+hR/L+h^2/(LC)), vn+1=vn+h*in+1/C |
| E | `rc-delayed-step.json` | Step at 0.0012345 s, initially equilibrium at 0 V: left/right capacitor voltage identical, source voltage jumps 0 to 1 V, right capacitor current 1 mA |
| F | `kron-star.json` | Standalone ungrounded network. Star conductances 1,2,3 S. Hidden voltage=(Va+2Vb+3Vc)/6. Terminal currents=(Va-Vh,2(Vb-Vh),3(Vc-Vh)) |
| G | `floating.json` | Differential resistor voltage determined, absolute node voltages nonunique |
| G | `parallel-equal.json` | Vout=1 V but separate source currents are nonunique; return failure, not arbitrary current allocation |
| G | `parallel-unequal.json` | Vout=1 V and Vout=2 V are inconsistent constraints |
| G | `forced-capacitor.json` | A directly clamped capacitor can rest at equilibrium. At 0.001 s its source changes to 1 V while storage continuity requires 0 V: unsupported impulsive initialization |

The Kron matrix is `[[5/6,-1/3,-1/2],[-1/3,4/3,-1],[-1/2,-1,3/2]]` S. Tests compare symmetry, zero row sums, and full-star boundary currents for a spanning set of voltages.

For the RC step, `vn=1-(1+h/tau)^-n` is the independent backward Euler recurrence; `v(t)=1-exp(-t/tau)` is the continuous solution. Tests use h=tau/20, tau/40, tau/80 through 5tau and compare common times every tau/20. Continuous maximum errors must halve within a first-order band (ratios 1.9–2.1). Algebraic recurrence checks use the standard voltage/current tolerances; continuous error has a separate refinement criterion. RC discharge and RL decay also refine at these steps.

Orientation variants are derived in tests by reversing specified terminals and the corresponding signed excitation/state/probe. Controlled-source tests separately reverse the control pair/sensor and output terminals. Invalid model tests mutate these public fixtures to exercise every validation category. Other derived tests add a second independent input, remove R from the series RLC for a singular lossless resonance, and test nonzero complex excitation, explicit waveform units, simultaneous events, and derivative outputs.

H applies to all device families: summed per-component contributions, label dimensions, deterministic ordering under reversed input arrays, native JSON round trips, and equivalent Node/browser-bundle imports. No expected matrix is copied from the implementation as a physics oracle.

## Phase 2A DC one-port cases

These standalone native documents are public acceptance inputs for `dcOnePort`. The test expectations come from KCL and divider equations, not from the helper. The selected port has `v=V(p)-V(q)` and external load current `p→q`.

| Fixture | Independent terminal expectation |
| --- | --- |
| `divider.json` | `p=out,q=0`: `Vth=12·2000/(1000+2000)=8 V`; zeroed source leaves `Rth=1000∥2000=2000/3 Ω`; `IN=0.012 A`. A 2000 Ω added load gives `VL=6 V`, `IL=0.003 A`. The original R2 remains connected during the open solve. |
| `one-port-bridge.json` | Branch midpoints are `Va=12·2000/3000=8 V` and `Vb=12·3000/6000=6 V`. For `p=a,q=b`, `Vth=2 V`. Suppressing Vin gives `Rth=(1000∥2000)+(3000∥3000)=6500/3 Ω`. At 1000 Ω, `VL=12/19 V`, `IL=12/19000 A`. Reverse the port to reverse signed voltage/current while retaining resistance. |
| `one-port-vccs.json` | KCL at out is `0.002=(1/1000+0.001)Vout`, hence `Vth=1 V`. The VCCS remains active under source suppression, giving `Rth=1/(0.001+0.001)=500 Ω`, `IN=0.002 A`. A 1000 Ω external load gives `VL=2/3 V`. |
| `one-port-current-source.json` | A 1 A ideal source injects at out with no return path. The open-circuit DC solve is inconsistent; no finite `Vth` is invented. |

Additional mutations test zero original excitation, retained current-control sensing branches, collision-safe temporary IDs, a zero-resistance ideal-voltage-source port, negative resistance from a controlled source, storage rejection, invalid ports, and invalid loads. The test-current default is 1 A; extreme scales can exceed the numeric range or solver diagnostics and then fail explicitly.

## Phase 2B source-free resistor cases

These native documents have no independent source, use equilibrium initialization, and allow the Phase 2B Transform preview to export valid native JSON. Terminal response always uses the full ungrounded Laplacian, with currents entering retained nodes. Native node `0` remains a retained terminal for export.

| Fixture | Independent expectation |
| --- | --- |
| `res-series.json` | The path `0 — 1000 Ω — x — 2000 Ω — out` has `R(out,0)=3000 Ω` after degree-two `x` is eliminated. |
| `res-star.json` | Center `x` has conductances `1,2,3 S` to `(a,b,0)`. Its ordered response is `[[5/6,-1/3,-1/2],[-1/3,4/3,-1],[-1/2,-1,3/2]] S`; delta sides `(ab,a0,b0)` are `(3,2,1) Ω`. |
| `res-bridge.json` | Five-resistor unbalanced bridge between `(a,0)` has no initial series or parallel pair. Internal KCL in `(x,y)` independently gives the terminal conductance tested in `test/resistor-transform.test.mjs`; bulk Kron removes both nodes. Its degree-three nodes **do** allow star–delta, so “no elementary move of any kind” would be false. |

Tests also cover reversed parallel orientation, delta→star legs, four-terminal fill-in, sequential elimination orders, retained-node ordering, disconnected internal components, ID collisions, extreme values, immutability, and strict export round-trip.
