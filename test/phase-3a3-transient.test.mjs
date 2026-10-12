import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nonlinearTransient, parseNonlinearDocument } from '../dist/index.js';

const load = name => parseNonlinearDocument(readFileSync(new URL(`../fixtures/nonlinear/${name}.json`, import.meta.url), 'utf8'));
const copy = value => JSON.parse(JSON.stringify(value));
const eta = 1.380649e-23 * 300 / 1.602176634e-19;
const diode = v => 1e-12 * Math.expm1(v / eta);
function root(f, low, high) {
  for (let i = 0; i < 150; i++) {
    const mid = (low + high) / 2;
    if (f(mid) > 0) high = mid; else low = mid;
  }
  return (low + high) / 2;
}
function near(actual, expected, limit, label = '') {
  assert.ok(Math.abs(actual - expected) <= limit, `${label}: ${actual} versus ${expected}`);
}

test('diode-RC prescribed storage, left/right event rates, and independent BE recurrence', () => {
  const document = load('diode-rc-step');
  const result = nonlinearTransient(document, { stop: 20e-6, step: 10e-6 });
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.samples.map(s => [s.time, s.side]),
    [[0, 'left'], [0, 'right'], [10e-6, 'regular'], [20e-6, 'regular']]);
  const [left, right, first, second] = result.samples;
  near(left.storage[0].value, 0.2, 1e-15);
  near(right.storage[0].value, 0.2, 1e-15);
  near(left.storage[0].rate, -200.0022890877495, 1e-7);
  near(right.storage[0].rate, 799.9977109122506, 1e-7);
  let v = 0.2;
  for (const sample of [first, second]) {
    const previous = v;
    v = root(value => 1e-6 * (value - previous) / 10e-6 + (value - 1) / 1000 + diode(value), previous, 1);
    near(sample.observations.vout.value, v, 2e-12);
    near(sample.powers.find(power => power.id === 'C1').currentA, 1e-6 * (v - previous) / 10e-6, 2e-12);
    assert.ok(sample.residuals.every(row => row.passed));
    assert.ok(sample.groundKcl.passed);
    assert.ok(Math.abs(sample.powerBalanceW) <= sample.powerToleranceW);
    assert.ok(Math.abs(sample.energyBalanceJ) <= sample.energyToleranceJ);
  }
  near(first.observations.vout.value, 0.20792076128606163, 2e-12);
  near(second.observations.vout.value, 0.21576308827661184, 2e-12);
  near(first.powers.find(power => power.id === 'C1').currentA, 0.0007920761286061616, 2e-12);
  assert.equal(document.experiment.sources[0].dc, 1);
});

test('rectifier scalar law without storage and smoothing scalar recurrence', () => {
  const plain = nonlinearTransient(load('half-wave-rectifier'), { stop: 0.005, step: 0.0001 });
  assert.equal(plain.status, 'ok');
  const peak = plain.samples.at(-1);
  const junction = root(v => v + 10100 * diode(v) - 2, 0, 2);
  near(peak.observations.vout.value, 10000 * diode(junction), 2e-10);
  near(peak.observations.vout.value, 1.49835139608393, 2e-10);
  const smooth = nonlinearTransient(load('half-wave-rectifier-rc'), { stop: 0.0003, step: 0.0001 });
  assert.equal(smooth.status, 'ok');
  let previous = 0;
  for (const sample of smooth.samples.slice(1)) {
    const E = 2 * Math.sin(2 * Math.PI * 50 * sample.time);
    const A = 1e-5 / 0.0001 + 1 / 10000;
    const junction = root(v => v + 110 * diode(v) + (1e-5 / 0.0001 * previous + diode(v)) / A - E, -2, 2);
    previous = (1e-5 / 0.0001 * previous + diode(junction)) / A;
    near(sample.observations.vout.value, previous, 5e-10);
  }
});

test('prescribed storage does not require a DC equilibrium', () => {
  const document = load('diode-rc-step');
  document.circuit.components = document.circuit.components.filter(c => c.id !== 'V1' && c.id !== 'R1');
  document.circuit.components.push({ id: 'sink', type: 'I', p: 'out', n: '0' });
  document.circuit.nodes = ['0', 'out'];
  document.experiment.sources = [{ id: 'sink', dc: 1e-6 }];
  document.experiment.initial.values[0].value = 0;
  const result = nonlinearTransient(document, { stop: 1e-6, step: 1e-6 });
  assert.equal(result.status, 'ok');
  near(result.samples[0].storage[0].rate, -(1e-6) / 1e-6, 1e-5);
  assert.ok(result.samples[1].observations.vout.value < 0);
});

test('exact IDs and owned samples; failed event retains prefix', () => {
  const document = load('diode-rc-step');
  document.circuit.components.find(c => c.id === 'D1').id = '__proto__';
  document.circuit.observations.find(o => o.id === 'id').component = '__proto__';
  const result = nonlinearTransient(document, { stop: 20e-6, step: 10e-6 });
  assert.equal(result.status, 'ok');
  assert.equal(result.samples[0].diodes['__proto__'].terminalVoltageV, 0.2);
  result.samples[0].x[0] = 999;
  assert.notEqual(result.samples[1].x[0], 999);
  assert.equal(document.circuit.components.find(c => c.type === 'D').id, '__proto__');
  const invalid = copy(load('diode-rc-step'));
  const model = invalid.circuit.components.find(c => c.type === 'D').model;
  model.saturationCurrentA = 1e-6;
  invalid.circuit.nodes = ['0', 'out'];
  invalid.circuit.components = [
    { id: 'D1', type: 'D', p: 'out', n: '0', model },
    { id: 'I1', type: 'I', p: 'out', n: '0' },
  ];
  invalid.circuit.observations = [];
  invalid.experiment.sources = [{ id: 'I1', dc: 0,
    waveform: { type: 'step', at: 0, before: 0, after: 2e-6 } }];
  invalid.experiment.initial = { kind: 'storage', values: [] };
  const failure = nonlinearTransient(invalid, { stop: 10e-6, step: 10e-6 });
  assert.equal(failure.status, 'failed');
  assert.equal(failure.stage, 'event');
  assert.equal(failure.samples.length, 1);
});

test('bounded workload and unavailable incompatible initialization', () => {
  const document = load('diode-rc-step');
  const limited = nonlinearTransient(document, { stop: 100e-6, step: 10e-6, maxIntervals: 1 });
  assert.equal(limited.status, 'failed');
  assert.equal(limited.code, 'step-limit');
  assert.equal(limited.samples.length, 3);
  const incompatible = copy(document);
  incompatible.circuit.components.push({ id: 'Clamp', type: 'V', p: 'out', n: '0' });
  incompatible.experiment.sources.push({ id: 'Clamp', dc: 1 });
  const failure = nonlinearTransient(incompatible, { stop: 10e-6, step: 10e-6 });
  assert.equal(failure.status, 'failed');
  assert.equal(failure.stage, 'initialization');
});

function rk4Step(v, h) {
  const derivative = value => ((1 - value) / 1000 - diode(value)) / 1e-6;
  const a = derivative(v);
  const b = derivative(v + h * a / 2);
  const c = derivative(v + h * b / 2);
  const d = derivative(v + h * c);
  return v + h * (a + 2 * b + 2 * c + d) / 6;
}
test('time refinement against independently refined RK4 and tangent amplitude scaling', () => {
  let reference = 0.2;
  let finer = 0.2;
  const referenceSamples = [finer];
  for (let i = 0; i < 20000; i++) reference = rk4Step(reference, 0.5e-3 / 20000);
  for (let i = 0; i < 40000; i++) {
    finer = rk4Step(finer, 0.5e-3 / 40000);
    referenceSamples.push(finer);
  }
  near(reference, finer, 2e-13, 'RK4 self-refinement');
  const errors = [];
  for (const h of [10e-6, 5e-6, 2.5e-6]) {
    const result = nonlinearTransient(load('diode-rc-step'), { stop: 0.5e-3, step: h });
    assert.equal(result.status, 'ok');
    errors.push(Math.max(...result.samples.slice(2).map(sample => {
      const index = Math.round(sample.time / (0.5e-3 / 40000));
      return Math.abs(sample.observations.vout.value - referenceSamples[index]);
    })));
  }
  near(errors[0], 1.4480e-3, 5e-6);
  near(errors[1], 0.72955e-3, 5e-6);
  near(errors[2], 0.36620e-3, 5e-6);
  assert.ok(errors[0] / errors[1] > 1.9 && errors[1] / errors[2] > 1.9);
  const bias = root(v => (v - 1) / 1000 + diode(v), 0, 1);
  const rd = eta / (1e-12 * Math.exp(bias / eta));
  near(bias, 0.5169282075763274, 1e-12);
  near(rd, 53.51585445139481, 1e-8);
  const nonlinearErrors = [];
  for (const amplitude of [0.01, 0.005, 0.0025]) {
    const document = load('diode-rc-biased-sine');
    document.experiment.sources[0].waveform.amplitudePeak = amplitude;
    const result = nonlinearTransient(document, { stop: 0.001, step: 5e-6 });
    assert.equal(result.status, 'ok');
    let tangent = 0;
    let maximum = 0;
    for (const sample of result.samples.slice(1)) {
      const h = sample.intervalSeconds;
      tangent = ((1e-6 / h) * tangent + amplitude / 1000 * Math.sin(2 * Math.PI * 1000 * sample.time)) /
        (1e-6 / h + 1 / 1000 + 1 / rd);
      maximum = Math.max(maximum, Math.abs(sample.observations.vout.value - bias - tangent));
    }
    nonlinearErrors.push(maximum);
  }
  assert.ok(nonlinearErrors[0] / nonlinearErrors[1] > 3.5);
  assert.ok(nonlinearErrors[1] / nonlinearErrors[2] > 3.5);
});

test('mixed R-L-C-D recurrence and differential capacitor orientation', () => {
  const document = load('diode-rc-step');
  document.circuit.nodes.push('a');
  const resistor = document.circuit.components.find(c => c.id === 'R1');
  resistor.n = 'a';
  document.circuit.components.push({ id: 'L1', type: 'L', p: 'a', n: 'out', value: 0.01 });
  document.experiment.initial.values.push({ id: 'L1', value: 0 });
  const result = nonlinearTransient(document, { stop: 20e-6, step: 10e-6 });
  assert.equal(result.status, 'ok');
  let v = 0.2;
  let i = 0;
  for (const sample of result.samples.slice(2)) {
    const previousV = v;
    const previousI = i;
    v = root(value => {
      const current = (1 - value + 0.01 / 10e-6 * previousI) / (1000 + 0.01 / 10e-6);
      return 1e-6 * (value - previousV) / 10e-6 - current + diode(value);
    }, previousV, 1);
    i = (1 - v + 0.01 / 10e-6 * previousI) / (1000 + 0.01 / 10e-6);
    near(sample.observations.vout.value, v, 5e-11);
    near(sample.powers.find(power => power.id === 'L1').currentA, i, 5e-11);
  }
  const shifted = load('diode-rc-step');
  shifted.circuit.nodes.push('return');
  shifted.circuit.components.push({ id: 'Vshift', type: 'V', p: 'return', n: '0' });
  shifted.experiment.sources.push({ id: 'Vshift', dc: 3, waveform: { type: 'constant', value: 3 } });
  for (const component of shifted.circuit.components) {
    if (component.id !== 'Vshift' && component.n === '0') component.n = 'return';
  }
  shifted.circuit.observations[0].n = 'return';
  const normal = nonlinearTransient(shifted, { stop: 20e-6, step: 10e-6 });
  assert.equal(normal.status, 'ok');
  const reversed = copy(shifted);
  const capacitor = reversed.circuit.components.find(c => c.type === 'C');
  [capacitor.p, capacitor.n] = [capacitor.n, capacitor.p];
  reversed.experiment.initial.values[0].value = -0.2;
  const flipped = nonlinearTransient(reversed, { stop: 20e-6, step: 10e-6 });
  assert.equal(flipped.status, 'ok');
  for (let j = 0; j < normal.samples.length; j++) {
    near(normal.samples[j].observations.vout.value, flipped.samples[j].observations.vout.value, 1e-11);
    near(normal.samples[j].storage[0].value, -flipped.samples[j].storage[0].value, 1e-11);
    near(normal.samples[j].powers.find(p => p.id === 'C1').currentA,
      -flipped.samples[j].powers.find(p => p.id === 'C1').currentA, 1e-11);
  }
});

test('antiparallel diode currents and reversed-drive symmetry', () => {
  const original = load('diode-rc-step');
  original.circuit.components.push({ id: 'Dminus', type: 'D', p: '0', n: 'out',
    model: copy(original.circuit.components.find(c => c.type === 'D').model) });
  original.experiment.initial.values[0].value = 0;
  const opposite = copy(original);
  const source = opposite.experiment.sources[0].waveform;
  source.before = -source.before; source.after = -source.after;
  for (const [document, sign] of [[original, 1], [opposite, -1]]) {
    const result = nonlinearTransient(document, { stop: 20e-6, step: 10e-6 });
    assert.equal(result.status, 'ok');
    let previous = 0;
    for (const sample of result.samples.slice(2)) {
      const E = sign;
      const v = root(value => 1e-6 * (value - previous) / 10e-6 + (value - E) / 1000 +
        diode(value) - diode(-value), -1, 1);
      near(sample.observations.vout.value, v, 2e-11);
      near(sample.diodes.D1.currentA, diode(v), 2e-12);
      near(sample.diodes.Dminus.currentA, diode(-v), 2e-12);
      previous = v;
    }
  }
  const plus = nonlinearTransient(original, { stop: 20e-6, step: 10e-6 });
  const minus = nonlinearTransient(opposite, { stop: 20e-6, step: 10e-6 });
  for (let i = 0; i < plus.samples.length; i++)
    near(plus.samples[i].observations.vout.value, -minus.samples[i].observations.vout.value, 2e-11);
});

test('time values override stored DC/AC, simultaneous and close events remain distinct', () => {
  const document = load('diode-rc-step');
  document.experiment.sources[0].dc = 999;
  document.experiment.sources[0].ac = { re: 888, im: 777 };
  document.circuit.components.push({ id: 'I2', type: 'I', p: 'out', n: '0' });
  document.experiment.sources.push({ id: 'I2', dc: 321, waveform: { type: 'step', at: 0,
    before: 0, after: 0 } });
  const result = nonlinearTransient(document, { stop: 10e-6, step: 10e-6 });
  assert.equal(result.status, 'ok');
  assert.equal(result.samples[0].sources.V1.value, 0);
  assert.equal(result.samples[1].sources.V1.value, 1);
  assert.equal(result.samples.filter(s => s.time === 0).length, 2);
  near(result.samples.at(-1).observations.vout.value, 0.20792076128606163, 2e-12);
  const nearby = copy(document);
  nearby.experiment.sources[1].waveform.at = 1e-12;
  nearby.experiment.sources[1].waveform.after = 1e-5;
  const closeResult = nonlinearTransient(nearby, { stop: 2e-12, step: 1e-12 });
  assert.equal(closeResult.status, 'ok');
  assert.equal(closeResult.samples.filter(s => s.time === 1e-12).length, 2);
  assert.equal(closeResult.samples.at(-1).time, 2e-12);
});

test('dynamic controlled-source law and no hidden accepted failed candidates', () => {
  const document = load('diode-rc-step');
  document.circuit.components.push({ id: 'G1', type: 'VCCS', p: 'out', n: '0',
    cp: 'out', cn: '0', gain: 1e-3 });
  const result = nonlinearTransient(document, { stop: 10e-6, step: 10e-6 });
  assert.equal(result.status, 'ok');
  const sample = result.samples.at(-1);
  const v = sample.observations.vout.value;
  near(1e-6 * (v - 0.2) / 10e-6 + (v - 1) / 1000 + diode(v) + 1e-3 * v, 0, 3e-12);
  near(sample.powers.find(p => p.id === 'G1').currentA, 1e-3 * v, 1e-15);
  const exhausted = nonlinearTransient(load('diode-rc-step'),
    { stop: 10e-6, step: 10e-6, maxIterations: 1 });
  assert.equal(exhausted.status, 'failed');
  assert.ok(exhausted.samples.length === 0 || exhausted.samples.every(s => s.side !== 'regular'));
});

test('event at stop and unrepresentable time advancement', () => {
  const document = load('diode-rc-step');
  document.experiment.sources[0].waveform.at = 10e-6;
  const atStop = nonlinearTransient(document, { stop: 10e-6, step: 10e-6 });
  assert.equal(atStop.status, 'ok');
  assert.deepEqual(atStop.samples.slice(-2).map(s => s.side), ['left', 'right']);
  const impossible = nonlinearTransient(load('diode-rc-biased-sine'),
    { start: 1e16, stop: 1e16 + 2, step: 0.1 });
  assert.equal(impossible.status, 'failed');
  assert.equal(impossible.code, 'time-resolution');
});

test('series-resistance diode step uses junction, not terminal, voltage', () => {
  const document = load('diode-rc-step');
  document.circuit.components.find(c => c.type === 'D').model.seriesResistanceOhm = 10;
  const result = nonlinearTransient(document, { stop: 20e-6, step: 10e-6 });
  assert.equal(result.status, 'ok');
  let previous = 0.2;
  for (const sample of result.samples.slice(2)) {
    const junction = root(j => {
      const current = diode(j);
      const terminal = j + 10 * current;
      return 1e-6 * (terminal - previous) / 10e-6 + (terminal - 1) / 1000 + current;
    }, previous, 1);
    const expected = junction + 10 * diode(junction);
    near(sample.observations.vout.value, expected, 2e-11);
    near(sample.diodes.D1.junctionVoltageV, junction, 2e-11);
    previous = expected;
  }
});

test('diode-free v2 RC/RL/RLC agrees with independent BE and existing linear transient', async () => {
  const { assemble, transient } = await import('../dist/index.js');
  const rc = load('diode-rc-step');
  rc.circuit.components = rc.circuit.components.filter(c => c.type !== 'D');
  rc.circuit.observations = rc.circuit.observations.filter(o => o.type === 'voltage');
  const v2 = nonlinearTransient(rc, { stop: 20e-6, step: 10e-6 });
  assert.equal(v2.status, 'ok');
  const v1 = copy(rc); v1.circuit.schemaVersion = 1;
  const linear = transient(assemble(v1.circuit), v1.experiment, { stop: 20e-6, step: 10e-6 });
  assert.equal(linear.status, 'ok');
  let previous = 0.2;
  for (let i = 2; i < v2.samples.length; i++) {
    previous = ((1e-6 / 10e-6) * previous + 1 / 1000) / (1e-6 / 10e-6 + 1 / 1000);
    near(v2.samples[i].observations.vout.value, previous, 2e-12);
    near(v2.samples[i].observations.vout.value, linear.samples[i].observations.vout.value.re, 2e-12);
  }
  const rl = copy(rc);
  rl.circuit.nodes = ['0', 'in', 'out'];
  rl.circuit.components = [
    { id: 'V1', type: 'V', p: 'in', n: '0' },
    { id: 'R1', type: 'R', p: 'in', n: 'out', value: 1000 },
    { id: 'L1', type: 'L', p: 'out', n: '0', value: 0.01 },
  ];
  rl.circuit.observations = [{ id: 'iL', type: 'current', component: 'L1' }];
  rl.experiment.initial.values = [{ id: 'L1', value: 0 }];
  const result = nonlinearTransient(rl, { stop: 20e-6, step: 10e-6 });
  assert.equal(result.status, 'ok');
  let current = 0;
  for (const sample of result.samples.slice(2)) {
    current = (1 + 0.01 / 10e-6 * current) / (1000 + 0.01 / 10e-6);
    near(sample.observations.iL.value, current, 2e-12);
  }
  const rlc = load('diode-rc-step');
  rlc.circuit.components = rlc.circuit.components.filter(c => c.type !== 'D');
  rlc.circuit.nodes.push('a');
  rlc.circuit.components.find(c => c.id === 'R1').n = 'a';
  rlc.circuit.components.push({ id: 'L1', type: 'L', p: 'a', n: 'out', value: 0.01 });
  rlc.circuit.observations = [{ id: 'vout', type: 'voltage', p: 'out', n: '0' }];
  rlc.experiment.initial.values.push({ id: 'L1', value: 0 });
  const nonlinear = nonlinearTransient(rlc, { stop: 20e-6, step: 10e-6 });
  const linearRlc = copy(rlc); linearRlc.circuit.schemaVersion = 1;
  const conventional = transient(assemble(linearRlc.circuit), linearRlc.experiment,
    { stop: 20e-6, step: 10e-6 });
  assert.equal(nonlinear.status, 'ok');
  assert.equal(conventional.status, 'ok');
  for (let i = 0; i < nonlinear.samples.length; i++)
    near(nonlinear.samples[i].observations.vout.value,
      conventional.samples[i].observations.vout.value.re, 2e-12);
});

test('rectifier smoothing follows scalar recurrence through both polarities over three cycles', () => {
  const document = load('half-wave-rectifier-rc');
  const h = 0.0002;
  const result = nonlinearTransient(document, { stop: 0.06, step: h });
  assert.equal(result.status, 'ok');
  let previous = 0;
  let positive = 0;
  let negative = 0;
  for (const sample of result.samples.slice(1)) {
    const E = 2 * Math.sin(2 * Math.PI * 50 * sample.time);
    const A = 1e-5 / h + 1 / 10000;
    const junction = root(v => v + 110 * diode(v) + ((1e-5 / h) * previous + diode(v)) / A - E,
      -2, 2);
    previous = ((1e-5 / h) * previous + diode(junction)) / A;
    near(sample.observations.vout.value, previous, 2e-9);
    if (E > 1.5) positive++;
    if (E < -1.5) negative++;
  }
  assert.ok(positive > 0 && negative > 0);
  assert.ok(result.samples.at(-1).energyJ >= 0);
});

test('overflow, Newton budget, and preallocation dimension limit fail explicitly', () => {
  const document = load('diode-rc-biased-sine');
  document.experiment.sources[0].waveform.offset = 1e308;
  document.experiment.sources[0].waveform.amplitudePeak = 1e308;
  document.experiment.sources[0].waveform.phaseRadians = Math.PI / 2;
  const overflow = nonlinearTransient(document, { stop: 1e-6, step: 1e-6 });
  assert.equal(overflow.status, 'failed');
  assert.equal(overflow.code, 'numeric-range');
  assert.throws(() => nonlinearTransient(load('diode-rc-step'),
    { stop: 1e-6, step: 1e-6, maxUnknowns: 1 }), RangeError);
  assert.throws(() => nonlinearTransient(load('diode-rc-step'),
    { stop: 1e-6, step: 1e-6, maxUnknowns: 65 }), RangeError);
});

test('rectifier reverse leakage remains signed under an explicitly tighter current floor', () => {
  const result = nonlinearTransient(load('half-wave-rectifier'),
    { stop: 0.015, step: 0.0005, tolerance: { currentAbsolute: 1e-16 } });
  assert.equal(result.status, 'ok');
  const reverse = result.samples.at(-1);
  near(reverse.sources.V1.value, -2, 2e-15);
  near(reverse.observations.vout.value, -1e-8, 2e-12);
  assert.ok(reverse.diodes.D1.currentA < 0);
});
