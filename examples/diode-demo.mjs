import { readFileSync } from 'node:fs';
import { assemble, complex, createDiodeTangent, parseNonlinearDocument,
  solveDiodeOperatingPoint, transfer } from '../dist/index.js';

const document = parseNonlinearDocument(readFileSync(
  new URL('../fixtures/nonlinear/diode-rc-tangent.json', import.meta.url), 'utf8'));
const diode = document.circuit.components.find(component => component.type === 'D');
console.log('Phase 3A1 headless diode experiment');
console.log(`Model: ${diode.id}, ${diode.model.kind}, Is=${diode.model.saturationCurrentA} A, ` +
  `n=${diode.model.idealityFactor}, Rs=${diode.model.seriesResistanceOhm} Ω, T=${diode.model.temperatureK} K`);
console.log(`DC source V1=${document.experiment.sources.find(source => source.id === 'V1').dc} V`);
const point = solveDiodeOperatingPoint(document);
if (point.status !== 'ok') throw new Error(`${point.code}: ${point.message}`);
console.log('Newton: iteration, damping, fixed-scale merit, largest ΔV and ΔI');
for (const step of point.trace) console.log(
  `${step.iteration}: α=${step.damping}, merit=${step.merit.toExponential(4)}, ` +
  `ΔV=${step.voltageCorrectionV.toExponential(4)} V, ΔI=${step.currentCorrectionA.toExponential(4)} A`);
console.log(`Bias V(out)=${point.observations.vout.value} V; ` +
  `I(D1)=${point.diodes.D1.currentA} A (out→0); ` +
  `I(V1)=${point.unknowns['I(V1)']} A (in→0)`);
console.log(`Junction voltage=${point.diodes.D1.junctionVoltageV} V; ` +
  `gj=${point.diodes.D1.junctionConductanceS} S; rd=${point.diodes.D1.differentialResistanceOhm} Ω`);
console.log('Physical residuals:');
for (const row of [...point.residuals, point.groundKcl]) console.log(
  `${row.label}: ${row.value.re.toExponential(4)} ${row.unit}, allowance ${row.tolerance.toExponential(4)} ${row.unit}`);
console.log(`Signed power sum=${point.powerBalanceW.toExponential(4)} W; ` +
  `allowance=${point.powerToleranceW.toExponential(4)} W`);
const tangent = createDiodeTangent(point, document);
if (tangent.status !== 'ok') throw new Error(`${tangent.code}: ${tangent.message}`);
console.log(`Tangent: D1 → ${tangent.document.circuit.components.find(c => c.id === 'D1').value} Ω, ` +
  'zero DC increments, retained 1 V RMS AC source coordinate');
const linear = assemble(tangent.document.circuit);
for (const frequencyHz of [0, 1000]) {
  const result = transfer(linear, 'V1', 'vout', complex(0, 2 * Math.PI * frequencyHz));
  if (result.status !== 'ok') throw new Error(`${frequencyHz} Hz tangent transfer: ${result.message}`);
  console.log(`Local H(j2π·${frequencyHz} Hz)=${result.transfer.value.re} + ` +
    `${result.transfer.value.im}j V/V`);
}
