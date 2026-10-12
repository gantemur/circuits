import { readFileSync } from 'node:fs';
import { nonlinearTransient, parseNonlinearDocument } from '../dist/index.js';

const fixture = name => parseNonlinearDocument(readFileSync(
  new URL(`../fixtures/nonlinear/${name}.json`, import.meta.url), 'utf8'));
const step = fixture('diode-rc-step');
console.log('Phase 3A3 headless nonlinear transient demo');
console.log('Model: Shockley-series diode, Is=1 pA, n=1, Rs=0 Ω, T=300 K; external R=1 kΩ, C=1 µF.');
console.log('Source V1 steps 0→1 V at t=0; prescribed capacitor voltage 0.2 V. AC phasors do not drive time analysis.');
const result = nonlinearTransient(step, { stop: 20e-6, step: 10e-6 });
if (result.status !== 'ok') throw new Error(`${result.stage}: ${result.code}: ${result.message}`);
console.log(`Initialization: ${result.initialization.method}`);
for (const sample of result.samples) {
  const capacitor = sample.powers.find(power => power.id === 'C1');
  console.log(`t=${sample.time} s ${sample.side}; V(out)=${sample.observations.vout.value} V; ` +
    `I(C1)=${capacitor.currentA} A (${sample.currentConvention}); ` +
    `qdot=${sample.storage[0].rate} V/s; Newton=${sample.trace.length} corrections`);
  console.log(`  max physical row residual=${Math.max(...sample.residuals.map(row => row.absolute))} A/V by labeled row; ` +
    `Σp=${sample.powerBalanceW} W; ΔW+hΣp+D_BE=${sample.energyBalanceJ ?? 'event/start'} J`);
}
const eta = 1.380649e-23 * 300 / 1.602176634e-19;
const diodeCurrent = junctionV => 1e-12 * Math.expm1(junctionV / eta);
function bisect(residual, low, high) {
  for (let iteration = 0; iteration < 120; iteration++) {
    const middle = (low + high) / 2;
    if (residual(middle) > 0) high = middle; else low = middle;
  }
  return (low + high) / 2;
}
let scalarPrevious = 0.2;
for (const sample of result.samples.filter(item => item.intervalSeconds > 0)) {
  const scalar = bisect(v => 1e-6 * (v - scalarPrevious) / sample.intervalSeconds +
    (v - 1) / 1000 + diodeCurrent(v), scalarPrevious, 1);
  console.log(`  Independent scalar BE at ${sample.time} s: ${scalar} V; ` +
    `kernel difference=${sample.observations.vout.value - scalar} V`);
  scalarPrevious = scalar;
}
const rectifier = nonlinearTransient(fixture('half-wave-rectifier-rc'),
  { stop: 0.005, step: 0.0001 });
if (rectifier.status !== 'ok') throw new Error(`${rectifier.stage}: ${rectifier.code}: ${rectifier.message}`);
console.log('Half-wave series rectifier: 2 V peak 50 Hz, Rsource=100 Ω, RL=10 kΩ, Rs=10 Ω, C=10 µF.');
console.log(`At 5 ms: V(out)=${rectifier.samples.at(-1).observations.vout.value} V; ` +
  `accepted samples=${rectifier.samples.length}. This short run is not a periodic steady-state claim.`);
