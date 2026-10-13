# Independent BJT references

All fixtures use transport IS=1e−12 A, βF=100, βR=4 and T=.025 q/kB=290.11295303875204 K, so VT=.025 V. This is intentionally not a 300 K fixture. All currents enter c,b,e. Clamps have p=node, n=0, hence their currents are the negative of the device terminal current at that node.

The five clamped-law files construct uBE=VT log1p(F/IS), uBC=VT log1p(R/IS), VE=0, VB=uBE, VC=uBE−uBC:

| File | F (A) | R (A) |
| --- | --- | --- |
| forward-active | .001 | −IS/2 |
| reverse-active | −IS/2 | .001 |
| cutoff | −IS/2 | −IS/2 |
| saturation | .001 | .0001 |
| zero-bias | 0 | 0 |

Substituting in the terminal laws gives saturation (.875,.035,−.910) mA and cutoff (.125,−.130,.005) pA. The tests inspect cutoff at an evaluator-level scale rather than relying on a 1 pA circuit absolute tolerance. PNP mirrors negate source values and switch polarity; emitter/collector exchange also swaps βF/βR. Tests derive these variants explicitly.

`common-emitter.json` constructs VE=0, VC=2, VB=.025 log1p(1e9)≈.5180816459486602 V, RC=2 kΩ, RL=10 kΩ, RS=1 kΩ. With currents computed from the written equations, VCC=VC+RC(iC+VC/RL)≈4.400000002499992 V and VS=VB+RS iB≈.5280816456986602 V. For Gs=1/RS, Gc=1/RC+1/RL, exact gain is −Gs Jcb/[(Gs+Jbb)(Gc+Jcc)−Jbc Jcb]≈−47.6190476530611 V/V. An external collector capacitor adds sC to Gc. Its measured current is sC δVc. Changed RS/RL variants reconstruct source values by independent KCL; no production evaluator creates expected values.

`emitter-follower.json` constructs VE=1 V, VC=5 V, VB=1+.025 log1p(1e9) V and RE=1/(−iE)≈990.099008920698 Ω. With collector increment zero and ideal base drive the exact gain is [(1+1/βF)gF−gR]/[1/RE+(1+1/βF)gF]≈.9756097560977965. Tests independently bracket its scalar emitter KCL root and add finite base-source resistance using two-node equations.

Every fixture contains all independent sources and an explicit equilibrium policy. DC uses declared DC values; AC is RMS. These fixtures have no intrinsic transistor storage. The test-generated external capacitor does not imply BJT transient support. Values and equations are self-contained and require no private reference or external simulator.
