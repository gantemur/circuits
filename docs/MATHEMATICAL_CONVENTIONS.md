# Mathematical and engineering conventions

Version 0.1, 10 October 2026. These public conventions capture the choices needed for the lab and agree with the supplied companion-book baseline. They are not a copy of the book.

## Terminal signs and topology

A two-terminal device has ordered terminals `(p,n)`. Its voltage is $v=V_p-V_n$ and current $i$ flows from `p` through the device to `n`. Thus positive absorbed power is $p=vi$. An independent voltage source delivering power commonly has negative branch current under this convention; do not redefine it silently.

For a graph branch, the incidence column has $+1$ at `p` and $-1$ at `n`; node voltages yield $v=a^{\mathsf T}V$. KCL sums currents from nodes into device branches. A prescribed independent current source therefore contributes $-a i_s$ to the nodal right-hand side.

Ground is a reference, not a physical current sink omitted from balance. Diagnostics may omit its equation when assembling a reduced system but should reconstruct its balance when reporting the full circuit.

Both multiport currents enter their positive-voltage terminals. For chain/ABCD matrices use the current leaving port 2:

Phase 2C selects each frequency-domain port as an ordered exact node pair `(p,q)`: `V=V(p)−V(q)` and positive `I` enters the characterized network at `p`. For two ports, `V=ZI` and `I=YV`, with both currents entering. The current source that tests a Z column points `q→p`; the network current measured under an ideal voltage clamp is the *negative* of that clamp's p→q branch current. A physical resistor attached to port 2 draws `V2/RL` externally, so its network current is `I2=−V2/RL`; an open external load imposes `I2=0`. The 1 V RMS loading source satisfies `V1=Vs−Rs I1`. These choices allow shared returns or differential terminals and do not imply that either negative terminal is ground.

$$
\begin{pmatrix}V_1\\I_1\end{pmatrix}
=\begin{pmatrix}A&B\\C&D\end{pmatrix}
\begin{pmatrix}V_2\\-I_2\end{pmatrix}.
$$

When ideal transformers are introduced, the default ratio is $n=N_2/N_1$ with consistent winding dots: $v_2=n v_1$, $i_1=-n i_2$, both currents entering the ports.

## Matrices and descriptor signs

Use $M^{\mathsf T}$ for transpose, $M^*$ for complex adjoint, and $M^\dagger$ for Moore–Penrose pseudoinverse. These operations are not interchangeable.

The lab's canonical assembly is

$$
E\dot x+Kx=Bu,\qquad y=C_o x+D_o u.
$$

The book also uses $E\dot x=Ax+Bu$, so **$A=-K$**. Consequently

$$
H(s)=C_o(sE+K)^{-1}B+D_o=C_o(sE-A)^{-1}B+D_o.
$$

Inverse notation describes the mathematics. Implement it by solves. Singular `E` is expected in MNA; distinguish it from an irregular pencil, inconsistent constraints, and nonunique equilibrium.

For a smooth nonlinear residual $F(x,\dot x,u)=0$ at a DC equilibrium, the tangent form has $E=F_{\dot x}$, $K=F_x$, $B=-F_u$. If presenting the book state form, $A=-F_x$.

For the Phase 3A1 memoryless diode, `p` is the anode, `n` the cathode, $v=V(p)-V(n)$, and positive $i$ flows p→n. With supplied $I_s$ at temperature $T$, $V_T=k_B T/q$, $\eta=n V_T$, and series resistance $R_s$, its junction voltage is $v_j=v-R_s i$ and its DC law is $i=I_s\operatorname{expm1}(v_j/\eta)$. Temperature changes $V_T$ only; there is no inferred $I_s(T)$ or self-heating. The auxiliary diode-current row $i-I_s\operatorname{expm1}(v_j/\eta)=0$ has amperes as units. Its analytical junction conductance is $g_j=I_s\exp(v_j/\eta)/\eta$, and its local terminal resistance is $R_s+1/g_j$ when finite and positive. The native v1 tangent circuit describes increments about the recorded bias, not an absolute nonlinear equivalent or finite-amplitude 1 V response. See [the Phase 3A specification](PHASE_3A_SPECIFICATION.md).

## Frequency, phase, and amplitude

Frequency $f$ is in hertz; angular frequency $\omega=2\pi f$ is in radians per second. Complex sweeps use $s=i\omega$. Returned phase values state radians or degrees.

Sinusoidal physical phasors are RMS by default:

$$
v(t)=\sqrt2\operatorname{Re}(V e^{i\omega t}),\qquad S=V\overline I.
$$

A time-source `amplitudePeak` describes peak amplitude explicitly. A DC offset is separate. Do not use one unqualified amplitude field for both RMS phasors and peak time waveforms. Unit-input transfer ratios are mathematical normalizations and do not imply that the physical circuit has been driven at one volt peak.

Voltage gain in dB is $20\log_{10}|V_o/V_i|$; power ratios use $10\log_{10}$. Absolute dB measurements require their stated reference. Frequency response carries the actual source and load definition.

## Transients and initial conditions

A transfer function describes zero-state input–output behavior. Arbitrary initial-state response is a separate experiment. Initialization must satisfy the actual algebraic constraints; voltage-source currents cannot generally be assigned arbitrarily.

For the canonical form, backward Euler is

$$
(E+hK)x_{n+1}=Ex_n+hBu_{n+1}.
$$

Capacitor voltages and inductor currents are continuous across ordinary source changes only when the model does not impose an ideal impulse. Unsupported impulsive cases must be identified.

## Equivalence, stability, and evidence

Specify the preserved ports, inputs, outputs, loading, frequency/time class, and initialization assumptions. Terminal equivalence does not imply equality of internal quantities or hidden dynamics.

Separate zero-state BIBO stability, internal realization stability, feedback well-posedness, and orbital attraction of an autonomous oscillator. A canceled transfer pole cannot establish internal stability.

Label evidence as exact algebra, algebraically derived numeric coefficients, floating-point evaluation, time-step convergence, certified enclosure, measured data, or assumed model parameters. A small solver residual verifies equations to a stated arithmetic accuracy; it does not certify missing device physics or every frequency in an interval.

## Units and figures

Use SI units in stored numerical data. Normalized circuits must state physical scaling. Voltage and current tolerances remain separate.

European rectangular resistor symbols are the default for future schematics. Junctions, crossings, polarities, current arrows, transformer dots, and reference nodes must be unambiguous. Color supports readable annotations but is never the only carrier of polarity or connectivity.

## Reference baseline

These conventions were checked against the author's supplied 508-page book assembly, especially Appendix C, Sections C.1–C.4, and the current master plan's notation conventions. Reference access and version tracking are described in `REFERENCE_WORKFLOW.md`.
