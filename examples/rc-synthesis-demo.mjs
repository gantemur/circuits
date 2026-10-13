import { synthesizeRc } from '../dist/index.js';

const input = {
  quantity: 'impedance', method: 'cauer-infinity',
  numerator: ['3', '4', '1'], denominator: ['0', '2', '1'],
  referenceResistanceOhm: '1000', referenceAngularFrequencyPerSecond: '1000',
};
const result = synthesizeRc(input);
console.log('Exact target (ascending coefficients):', input);
console.log('Mathematical result:', result.mathematical.status);
if (result.mathematical.status !== 'certified') throw new Error('Expected exact certificate');
for (const stage of result.mathematical.trace) {
  console.log(`${stage.domain}:`, stage.before, 'extract', stage.element,
    'remaining', stage.remaining, 'identity', stage.identity, 'component', stage.componentId);
}
console.log('Limits:', result.mathematical.dc, result.mathematical.highFrequency);
console.log('Native result:', result.native.status);
if (result.native.status !== 'generated') throw new Error(result.native.reason);
console.table(result.native.elements);
console.log('Source-free native document:', JSON.stringify(result.native.document, null, 2));
console.log('Independent physical verification:', result.verification.status);
if (result.verification.status !== 'passed') throw new Error(result.verification.reason);
for (const sample of result.verification.samples) {
  console.log('s [1/s]:', sample.sPerSecond, 'Z [ohm]:', sample.impedanceOhm,
    'Y [S]:', sample.admittanceSiemens, 'power checks:', sample.power.map(check => check.passed));
}
