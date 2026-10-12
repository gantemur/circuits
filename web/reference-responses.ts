/** Authored baseline targets, not results computed from the current document. */
export interface ReferenceResponse {
  fixture: string;
  quantity: 'H' | 'Z' | 'Y';
  unit: string;
  input: string;
  output: string;
  sourceAndLoad: string;
  zeroState: string;
  variable: 's';
  frequencyScaling: string;
  formula: string;
  coefficientOrder?: 'constant-first';
  numerator?: readonly number[];
  denominator?: readonly number[];
}
// These are authored SI-s polynomial coefficients for the unedited fixtures.
// They are not extracted from a student's current circuit.
const x3 = 0.1942860004595122;
const rc3LowTau = x3 / (2 * Math.PI * 1000);
const rc3HighTau = 1 / (x3 * 2 * Math.PI * 1000);
const butterLinear = Math.SQRT2 / (2 * Math.PI * 1000);
const butterQuadratic = 1 / ((2 * Math.PI * 1000) ** 2);
export const referenceResponses: Readonly<Record<string, ReferenceResponse>> = {
  divider: {fixture:'fixtures/divider.json',quantity:'H',unit:'V/V',input:'Vin (ideal voltage source)',output:'V(out)-V(0)',
    sourceAndLoad:'No external output load; R1=1000 Ω, R2=2000 Ω.',zeroState:'Stateless DC/AC linear experiment.',
    variable:'s',frequencyScaling:'s in s⁻¹; ω=2πf rad/s.',formula:'R2/(R1+R2) = 2/3',
    coefficientOrder:'constant-first',numerator:[2],denominator:[3]},
  rc: {fixture:'fixtures/rc.json',quantity:'H',unit:'V/V',input:'Vin (ideal voltage source)',output:'V(out)-V(0)',
    sourceAndLoad:'Open output, R=1000 Ω, C=1 μF.',zeroState:'Capacitor voltage initially zero for transfer.',
    variable:'s',frequencyScaling:'s in s⁻¹; ω=2πf rad/s.',formula:'1/(1+sRC) = 1/(1+0.001s)',
    coefficientOrder:'constant-first',numerator:[1],denominator:[1,0.001]},
  'rc-high-pass': {fixture:'fixtures/rc-high-pass.json',quantity:'H',unit:'V/V',input:'Vin (ideal voltage source)',output:'V(out)-V(0)',
    sourceAndLoad:'Open output, R=1000 Ω, C=1 μF.',zeroState:'Capacitor voltage initially zero for transfer.',
    variable:'s',frequencyScaling:'s in s⁻¹; ω=2πf rad/s.',formula:'sRC/(1+sRC) = 0.001s/(1+0.001s)',
    coefficientOrder:'constant-first',numerator:[0,0.001],denominator:[1,0.001]},
  'res-series': {fixture:'fixtures/res-series.json',quantity:'Z',unit:'Ω',input:'I entering at out, returning at 0',output:'V(out)-V(0)',
    sourceAndLoad:'Source-free two-terminal path, R1=1000 Ω, R2=2000 Ω; no external shunt.',zeroState:'Stateless resistor network.',
    variable:'s',frequencyScaling:'Constant for any finite s in s⁻¹.',formula:'R1+R2 = 3000 Ω',
    coefficientOrder:'constant-first',numerator:[3000],denominator:[1]},
  'rc3-low-pass': {fixture:'fixtures/rc3-low-pass.json',quantity:'H',unit:'V/V',input:'Vin: +in, −0; DC 1 V; AC 1 V RMS at zero phase',output:'V(out)-V(0)',
    sourceAndLoad:'R1=R2=R3=1000 Ω; C1=C2=C3=x3/(2π·10⁶) F; output unloaded; x3=0.1942860004595122.',
    zeroState:'All three capacitor voltages start at zero for the 1 V step.',variable:'s',frequencyScaling:'z=sRC, s in s⁻¹; ω=2πf rad/s.',
    formula:'H(z)=1/(1+6z+5z²+z³)',coefficientOrder:'constant-first',numerator:[1],
    denominator:[1,6*rc3LowTau,5*rc3LowTau**2,rc3LowTau**3]},
  'rc3-high-pass': {fixture:'fixtures/rc3-high-pass.json',quantity:'H',unit:'V/V',input:'Vin: +in, −0; DC 1 V; AC 1 V RMS at zero phase',output:'V(out)-V(0)',
    sourceAndLoad:'R1=R2=R3=1000 Ω; C1=C2=C3=1/(x3·2π·10⁶) F; output unloaded; x3=0.1942860004595122.',
    zeroState:'All three capacitor voltages start at zero; output jumps on the 1 V step.',variable:'s',frequencyScaling:'z=sRC, s in s⁻¹; ω=2πf rad/s.',
    formula:'H(z)=z³/(1+5z+6z²+z³)',coefficientOrder:'constant-first',numerator:[0,0,0,rc3HighTau**3],
    denominator:[1,5*rc3HighTau,6*rc3HighTau**2,rc3HighTau**3]},
  'butterworth2-low-pass': {fixture:'fixtures/butterworth2-low-pass.json',quantity:'H',unit:'V/V',input:'Vin: +in, −0; DC 1 V; AC 1 V RMS at zero phase',output:'V(out)-V(0)',
    sourceAndLoad:'Ideal unity VCVS follower; R1=R2=11253.953951963826 Ω, Cg=10 nF, Cf=20 nF, RL=10 kΩ.',
    zeroState:'Capacitor voltages start at zero for the 1 V step; ideal follower has no supply/current limits.',variable:'s',
    frequencyScaling:'z=s/(2π·1000), s in s⁻¹.',formula:'H(z)=1/(1+√2z+z²)',coefficientOrder:'constant-first',
    numerator:[1],denominator:[1,butterLinear,butterQuadratic]},
  'butterworth2-high-pass': {fixture:'fixtures/butterworth2-high-pass.json',quantity:'H',unit:'V/V',input:'Vin: +in, −0; DC 1 V; AC 1 V RMS at zero phase',output:'V(out)-V(0)',
    sourceAndLoad:'Ideal unity VCVS follower; C1=C2=10 nF, Rf=11253.953951963826 Ω, Rg=22507.907903927652 Ω, RL=10 kΩ.',
    zeroState:'Capacitor voltages start at zero; output jumps on the 1 V step; ideal follower has no supply/current limits.',variable:'s',
    frequencyScaling:'z=s/(2π·1000), s in s⁻¹.',formula:'H(z)=z²/(1+√2z+z²)',coefficientOrder:'constant-first',
    numerator:[0,0,butterQuadratic],denominator:[1,butterLinear,butterQuadratic]},
  'rlc-band-pass': {fixture:'fixtures/rlc-band-pass.json',quantity:'H',unit:'V/V',input:'Vin: +in, −0; DC 1 V; AC 1 V RMS at zero phase',output:'V(in)-V(a), across Rbp',
    sourceAndLoad:'Series Rbp=100 Ω, Lbp=0.01 H, Cbp=1 µF; no external load.',zeroState:'L current and C voltage start at zero for the 1 V step.',
    variable:'s',frequencyScaling:'s in s⁻¹; ω0=10000 rad/s.',formula:'H(s)=sRC/(1+sRC+s²LC)',
    coefficientOrder:'constant-first',numerator:[0,.0001],denominator:[1,.0001,1e-8]},
  'rlc-notch': {fixture:'fixtures/rlc-notch.json',quantity:'H',unit:'V/V',input:'Vin: +in, −0; DC 1 V; AC 1 V RMS at zero phase',output:'V(a)-V(0), across Ln+Cn',
    sourceAndLoad:'Series Rn=100 Ω, Ln=0.01 H, Cn=1 µF; no external load.',zeroState:'L current and C voltage start at zero for the 1 V step.',
    variable:'s',frequencyScaling:'s in s⁻¹; ω0=10000 rad/s.',formula:'H(s)=(1+s²LC)/(1+sRC+s²LC)',
    coefficientOrder:'constant-first',numerator:[1,0,1e-8],denominator:[1,.0001,1e-8]},
  'rc-impedance-ladder': {fixture:'fixtures/rc-impedance-ladder.json',quantity:'Z',unit:'Ω',input:'I entering at in, returning at 0',output:'V(in)-V(0)',
    sourceAndLoad:'Source-free, no external load; R=[1,2,3] kΩ; C=[1,0.5,0.25] µF.',zeroState:'Zero-state positive-frequency port test.',
    variable:'s',frequencyScaling:'s in s⁻¹; evaluate at s=i2πf.',formula:'Z3=R3+1/(sC3); Z2=R2+1/(sC2+1/Z3); Z=R1+1/(sC1+1/Z2)',
    coefficientOrder:'constant-first',numerator:[4000000/7,16000/7,27/14,3/7000],denominator:[0,1,3/2000,3/7000000]},
  'rl-impedance-ladder': {fixture:'fixtures/rl-impedance-ladder.json',quantity:'Z',unit:'Ω',input:'I entering at in, returning at 0',output:'V(in)-V(0)',
    sourceAndLoad:'Source-free, no external load; L=[1,2,3] H; R=[1,2,3] kΩ.',zeroState:'Zero-state positive-frequency port test.',
    variable:'s',frequencyScaling:'s in s⁻¹; evaluate at s=i2πf.',formula:'Z3=sL3+R3; Z2=sL2+1/(1/R2+1/Z3); Z=sL1+1/(1/R1+1/Z2)',
    coefficientOrder:'constant-first',numerator:[6000/11,27/11,1/440,3/5500000],denominator:[1,19/11000,3/5500000]},
};
