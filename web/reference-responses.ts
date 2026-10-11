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
};
