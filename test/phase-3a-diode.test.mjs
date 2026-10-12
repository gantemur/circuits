import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assemble, assembleDiodeSystem, complex, createDiodeTangent, evaluateDiodeSystem,
  parseDocument, parseNonlinearDocument, serializeNonlinearDocument, solveDiodeOperatingPoint,
  solveOperatingPoint, transfer } from '../dist/index.js';
import { createLab, exportNative, importNative } from '../dist/lab-test.js';

const fixture = name => parseNonlinearDocument(readFileSync(new URL(`../fixtures/nonlinear/${name}.json`, import.meta.url), 'utf8'));
const copy = value => structuredClone(value);
const close = (actual, expected, tolerance, context = '') =>
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${context}: ${actual} differs from ${expected} by more than ${tolerance}`);
const success = result => { assert.equal(result.status, 'ok', result.message); return result; };
const kB = 1.380649e-23, q = 1.602176634e-19;

// Independent scalar load-line equation, bisected rather than Newton solved.
function scalarSeriesBias(E, R, Is, eta, Rs) {
  let lo = 0, hi = E / R;
  for (let iteration = 0; iteration < 120; iteration++) {
    const current = (lo + hi) / 2;
    const sourceMinusDrops = E - (R + Rs) * current - eta * Math.log1p(current / Is);
    if (sourceMinusDrops > 0) lo = current; else hi = current;
  }
  const current = (lo + hi) / 2;
  return { current, junctionVoltage: eta * Math.log1p(current / Is),
    terminalVoltage: E - R * current };
}
function scalarAntiparallel(E, R, Is, eta) {
  let lo = Math.min(E, 0), hi = Math.max(E, 0);
  for (let iteration = 0; iteration < 120; iteration++) {
    const voltage = (lo + hi) / 2;
    const difference = (E - voltage) / R - 2 * Is * Math.sinh(voltage / eta);
    if (difference > 0) lo = voltage; else hi = voltage;
  }
  return (lo + hi) / 2;
}

test('strict separate v2 contract, exact IDs, ownership, and unchanged v1/browser rejection', () => {
  for (const name of ['resistor-diode', 'resistor-diode-series', 'antiparallel', 'diode-rc-tangent']) {
    const document = fixture(name);
    assert.deepEqual(parseNonlinearDocument(serializeNonlinearDocument(document)), document);
    assert.throws(() => parseDocument(JSON.stringify(document)), /schemaVersion/);
  }
  const document = fixture('resistor-diode');
  document.circuit.nodes[2] = 'a<em>b</em>,__proto__';
  document.circuit.components.find(c => c.id === 'R1').n = document.circuit.nodes[2];
  document.circuit.components.find(c => c.id === 'D1').p = document.circuit.nodes[2];
  document.circuit.observations[0].p = document.circuit.nodes[2];
  assert.deepEqual(parseNonlinearDocument(serializeNonlinearDocument(document)), document);
  const point = success(solveDiodeOperatingPoint(document));
  const saved = point.document.circuit.nodes[2];
  document.experiment.sources[0].dc = 1.1;
  assert.equal(point.document.circuit.nodes[2], saved);
  assert.equal(createDiodeTangent(point, document).code, 'stale-bias');
  const editedPoint = copy(point);
  editedPoint.document.experiment.sources[0].dc = 1.2;
  assert.equal(createDiodeTangent(editedPoint, point.document).code, 'stale-bias');
  const special = fixture('resistor-diode');
  special.circuit.nodes[2] = '__proto__';
  special.circuit.components.find(c => c.id === 'R1').n = '__proto__';
  special.circuit.components.find(c => c.id === 'D1').p = '__proto__';
  special.circuit.components.find(c => c.id === 'D1').id = 'constructor';
  special.circuit.observations[0].p = '__proto__';
  special.circuit.observations.find(o => o.id === 'id').component = 'constructor';
  const specialPoint = success(solveDiodeOperatingPoint(special));
  assert.ok(Number.isFinite(specialPoint.unknowns['V(__proto__)']));
  assert.ok(Number.isFinite(specialPoint.diodes.constructor.currentA));
  const bad = copy(fixture('resistor-diode'));
  bad.circuit.components.find(c => c.id === 'D1').model.unexpected = 2;
  assert.throws(() => parseNonlinearDocument(JSON.stringify(bad)), /unsupported field/);
  delete bad.circuit.components.find(c => c.id === 'D1').model.unexpected;
  bad.circuit.components.find(c => c.id === 'D1').model.kind = 'unknown';
  assert.throws(() => parseNonlinearDocument(JSON.stringify(bad)), /Unsupported diode model/);
  for (const [field, value] of [['saturationCurrentA', 0], ['idealityFactor', -1],
    ['seriesResistanceOhm', -1], ['temperatureK', 0]]) {
    const invalid = fixture('resistor-diode');
    invalid.circuit.components.find(c => c.id === 'D1').model[field] = value;
    assert.throws(() => parseNonlinearDocument(JSON.stringify(invalid)), /expected.*finite number/);
  }
  const duplicate = fixture('resistor-diode');
  duplicate.circuit.components.find(c => c.id === 'D1').id = 'R1';
  assert.throws(() => parseNonlinearDocument(JSON.stringify(duplicate)), /duplicate IDs/);
  const lab = createLab('divider'), before = exportNative(lab);
  const linear = parseDocument(before);
  assert.deepEqual(solveOperatingPoint(linear), solveOperatingPoint(linear));
  assert.equal(solveOperatingPoint(linear).status, 'ok');
  assert.equal(importNative(lab, serializeNonlinearDocument(fixture('resistor-diode'))).ok, true);
  assert.equal(JSON.parse(exportNative(lab)).circuit.schemaVersion, 2);
  assert.throws(() => parseDocument(exportNative(lab)), /schemaVersion/);
});

test('two distinct thermal-voltage benchmarks retain their independently supplied answers', () => {
  const references = [
    { VT: .025, voltage: .5007170864042658, current: .0004992829135957342,
      resistance: 50.07181153042724, sensitivity: .04768417833962238 },
    { VT: .02585, voltage: .5168902515094442, current: .0004831097484905558,
      resistance: 53.507510513416655 },
  ];
  for (const reference of references) {
    const document = fixture('resistor-diode');
    document.circuit.components.find(c => c.id === 'D1').model.temperatureK = reference.VT * q / kB;
    const point = success(solveDiodeOperatingPoint(document));
    const scalar = scalarSeriesBias(1, 1000, 1e-12, reference.VT, 0);
    close(point.observations.vout.value, reference.voltage, 2e-9, 'book voltage');
    close(point.diodes.D1.currentA, reference.current, 2e-12, 'book current');
    close(point.observations.vout.value, scalar.terminalVoltage, 2e-9, 'scalar voltage');
    close(point.diodes.D1.differentialResistanceOhm, reference.resistance, 2e-4, 'rd');
    close(point.observations.isource.value, -reference.current, 2e-12, 'source direction');
    const tangent = success(createDiodeTangent(point, document));
    const slope = success(transfer(assemble(tangent.document.circuit), 'V1', 'vout', complex(0))).transfer.value.re;
    close(slope, reference.sensitivity ?? reference.resistance / (1000 + reference.resistance), 2e-7, 'local sensitivity');
  }
  close(kB * 300 / q, .025851999786435535, 2e-17, '300 K thermal voltage');
});

test('constructed series-resistance bias, source sign, and diode power decomposition', () => {
  const document = fixture('resistor-diode-series');
  const point = success(solveDiodeOperatingPoint(document));
  const eta = kB * 300 / q;
  const junction = eta * Math.log1p(1e-3 / 1e-12);
  const scalar = scalarSeriesBias(document.experiment.sources[0].dc, 1000, 1e-12, eta, 10);
  close(point.diodes.D1.currentA, 1e-3, 2e-12);
  close(point.diodes.D1.currentA, scalar.current, 2e-12);
  close(point.diodes.D1.junctionVoltageV, junction, 2e-9);
  close(point.diodes.D1.terminalVoltageV, junction + .01, 2e-9);
  close(point.diodes.D1.differentialResistanceOhm, 10 + eta / (.001 + 1e-12), 2e-6);
  close(point.observations.isource.value, -.001, 2e-12);
  const diodePower = point.powers.find(p => p.id === 'D1').absorbedW;
  close(diodePower, junction * .001 + 10 * .001 ** 2, 2e-12);
  close(point.powerBalanceW, 0, point.powerToleranceW);
  assert.ok(point.residuals.every(r => r.passed) && point.groundKcl.passed);
  const tangent = success(createDiodeTangent(point, document));
  const rd = tangent.document.circuit.components.find(c => c.id === 'D1').value;
  close(1 / rd, point.diodes.D1.terminalConductanceS, 1e-12);
  const system = assembleDiodeSystem(document);
  const J = evaluateDiodeSystem(system, point.x).jacobian;
  const out = system.unknowns.findIndex(label => label.id === 'V(out)');
  const branch = system.unknowns.findIndex(label => label.id === 'I(D1)');
  close(J[out][out] - J[out][branch] * J[branch][out] / J[branch][branch],
    .001 + 1 / rd, 1e-12);
});

test('antiparallel signs, reversed voltage, and both drive polarities', () => {
  for (const E of [1, -1]) {
    const document = fixture('antiparallel');
    document.experiment.sources[0].dc = E;
    const point = success(solveDiodeOperatingPoint(document));
    const voltage = scalarAntiparallel(E, 1000, 1e-12, kB * 300 / q);
    close(point.observations.vout.value, voltage, 2e-9);
    close(point.observations.vreverse.value, -voltage, 2e-9);
    close(point.observations.iplus.value - point.observations.iminus.value, (E - voltage) / 1000, 2e-12);
    assert.equal(Math.sign(point.observations.iplus.value), Math.sign(voltage));
    assert.equal(Math.sign(point.observations.iminus.value), -Math.sign(voltage));
  }
});

test('analytical diode Jacobian matches independently differenced residual at forward, zero, reverse and Rs values', () => {
  for (const Rs of [0, 10]) for (const voltage of [.4, 0, -.2]) {
    const document = fixture('resistor-diode');
    document.circuit.components.find(c => c.id === 'D1').model.seriesResistanceOhm = Rs;
    const system = assembleDiodeSystem(document);
    const index = system.unknowns.findIndex(l => l.id === 'I(D1)');
    const x = system.unknowns.map(l => l.id === 'V(in)' ? 1 : l.id === 'V(out)' ? voltage : 0);
    const base = evaluateDiodeSystem(system, x);
    assert.ok(base);
    for (const coordinate of [system.unknowns.findIndex(l => l.id === 'V(out)'), index]) {
      const h = coordinate === index ? 1e-7 : 1e-6;
      const plus = [...x], minus = [...x]; plus[coordinate] += h; minus[coordinate] -= h;
      const forward = evaluateDiodeSystem(system, plus).residual[index];
      const backward = evaluateDiodeSystem(system, minus).residual[index];
      const numeric = (forward - backward) / (2 * h);
      const analytic = base.jacobian[index][coordinate];
      close(numeric, analytic, 2e-5 * Math.max(1, Math.abs(analytic)), `${Rs}, ${voltage}, ${coordinate}`);
    }
  }
});

test('voltage- and current-controlled laws remain in biased DC equations with all declared sources', () => {
  for (const mode of ['voltage', 'current']) {
    const document = fixture('resistor-diode');
    document.circuit.nodes = ['0', 'sense', 'in', 'out'];
    document.circuit.components = document.circuit.components.filter(c => c.id !== 'V1');
    document.circuit.observations = document.circuit.observations.filter(o => o.id !== 'isource');
    document.circuit.components.unshift({ id: 'Vdrive', type: 'V', p: 'sense', n: '0' });
    document.circuit.components.push({ id: 'I2', type: 'I', p: 'out', n: '0' });
    document.experiment.sources = [{ id: 'Vdrive', dc: 1 }, { id: 'I2', dc: .0002 }];
    let drivingVoltage, controlledOutCurrent;
    if (mode === 'voltage') {
      document.circuit.components.push({ id: 'E1', type: 'VCVS', p: 'in', n: '0', cp: 'sense', cn: '0', gain: 2 });
      document.circuit.components.push({ id: 'G1', type: 'VCCS', p: 'out', n: '0', cp: 'sense', cn: '0', gain: .00005 });
      drivingVoltage = 2;
      controlledOutCurrent = .00005;
    } else {
      document.circuit.components.push({ id: 'Rsen', type: 'R', p: 'sense', n: '0', value: 1000 });
      document.circuit.components.push({ id: 'H1', type: 'CCVS', p: 'in', n: '0', control: 'Vdrive', gain: -1000 });
      document.circuit.components.push({ id: 'F1', type: 'CCCS', p: 'out', n: '0', control: 'Vdrive', gain: .1 });
      drivingVoltage = 1;
      controlledOutCurrent = -.0001;
    }
    const point = success(solveDiodeOperatingPoint(document));
    close(point.unknowns['V(sense)'], 1, 1e-12);
    close(point.unknowns['V(in)'], drivingVoltage, 1e-12);
    close((drivingVoltage - point.unknowns['V(out)']) / 1000,
      point.diodes.D1.currentA + .0002 + controlledOutCurrent, 2e-12);
    if (mode === 'current') {
      close(point.unknowns['I(Vdrive)'], -.001, 1e-12);
      close(point.unknowns['V(in)'], -1000 * point.unknowns['I(Vdrive)'], 1e-12);
    }
    const tangent = success(createDiodeTangent(point, document));
    assert.ok(tangent.document.circuit.components.some(c => c.type === (mode === 'voltage' ? 'VCVS' : 'CCVS')));
  }
  const invalid = fixture('resistor-diode');
  invalid.circuit.components.push({ id: 'Fbad', type: 'CCCS', p: 'out', n: '0', control: 'D1', gain: 1 });
  assert.throws(() => parseNonlinearDocument(JSON.stringify(invalid)), /retained voltage-source-type branch/);
});

test('DC capacitor current vanishes, inductor voltage is zero, and coincident diode incidence cancels', () => {
  const document = fixture('resistor-diode');
  document.circuit.components.push({ id: 'C1', type: 'C', p: 'out', n: '0', value: 1e-6 });
  document.circuit.components.push({ id: 'L1', type: 'L', p: 'out', n: '0', value: 1e-3 });
  document.circuit.components.push({ id: 'Dself', type: 'D', p: 'out', n: 'out',
    model: copy(document.circuit.components.find(c => c.id === 'D1').model) });
  document.circuit.observations.push({ id: 'ic', type: 'current', component: 'C1' });
  document.circuit.observations.push({ id: 'il', type: 'current', component: 'L1' });
  document.experiment.initial = { kind: 'storage', values: [{ id: 'C1', value: .8 }, { id: 'L1', value: .2 }] };
  const point = success(solveDiodeOperatingPoint(document));
  close(point.observations.vout.value, 0, 1e-12);
  close(point.observations.ic.value, 0, 1e-15);
  close(point.observations.il.value, .001, 1e-12);
  close(point.diodes.Dself.currentA, 0, 1e-12);
  const system = assembleDiodeSystem(document);
  const J = evaluateDiodeSystem(system, point.x).jacobian;
  const selfRow = system.rows.findIndex(row => row.id === 'law(Dself)');
  const out = system.unknowns.findIndex(label => label.id === 'V(out)');
  close(J[selfRow][out], 0, 0);
});

test('tangent eliminates diode current and agrees with local DC and RC frequency equations', () => {
  const document = fixture('diode-rc-tangent');
  const point = success(solveDiodeOperatingPoint(document));
  const alternateExperiment = copy(document);
  alternateExperiment.experiment.sources[0].ac = { re: 4, im: -2 };
  alternateExperiment.experiment.sources[0].waveform.after = 9;
  alternateExperiment.experiment.initial.values[0].value = 10;
  close(success(solveDiodeOperatingPoint(alternateExperiment)).observations.vout.value,
    point.observations.vout.value, 1e-12, 'DC uses only source.dc');
  const alternateTangent = success(createDiodeTangent(point, alternateExperiment));
  assert.deepEqual(alternateTangent.document.experiment.sources[0].ac, { re: 4, im: -2 });
  assert.equal(alternateTangent.document.experiment.sources[0].waveform, undefined);
  assert.deepEqual(alternateTangent.document.experiment.initial.values, [{ id: 'C1', value: 0 }]);
  const tangent = success(createDiodeTangent(point, document));
  assert.equal(tangent.document.circuit.components.find(c => c.id === 'D1').type, 'R');
  const tangentResistance = tangent.document.circuit.components.find(c => c.id === 'D1').value;
  point.document.circuit.components.find(c => c.id === 'R1').value = 2000;
  assert.equal(tangent.document.circuit.components.find(c => c.id === 'R1').value, 1000);
  assert.equal(tangent.document.circuit.components.find(c => c.id === 'D1').value, tangentResistance);
  assert.equal(tangent.document.experiment.sources[0].dc, 0);
  assert.deepEqual(tangent.document.experiment.sources[0].ac, { re: 1, im: 0 });
  assert.equal(tangent.document.experiment.sources[0].waveform, undefined);
  assert.deepEqual(tangent.document.experiment.initial.values, [{ id: 'C1', value: 0 }]);
  const conductance = point.diodes.D1.terminalConductanceS;
  const dcSlope = (1 / 1000) / (1 / 1000 + conductance);
  const a = assemble(tangent.document.circuit);
  close(success(transfer(a, 'V1', 'vout', complex(0))).transfer.value.re, dcSlope, 1e-9);
  for (const frequency of [0, 10, 1000, 1e5]) {
    const omega = 2 * Math.PI * frequency;
    const denominatorReal = 1 / 1000 + conductance;
    const denominatorImag = omega * 1e-6;
    const scale = .001 / (denominatorReal ** 2 + denominatorImag ** 2);
    const expected = { re: denominatorReal * scale, im: -denominatorImag * scale };
    const actual = success(transfer(a, 'V1', 'vout', complex(0, omega))).transfer.value;
    close(actual.re, expected.re, 1e-9); close(actual.im, expected.im, 1e-9);
  }
  close(-(1 / 1000 + conductance) / 1e-6,
    -(1 / 1000 + 1 / point.diodes.D1.differentialResistanceOhm) / 1e-6, 1e-8);
  const perturbations = [1e-2, 1e-3, 1e-4];
  const errors = perturbations.map(h => {
    const plus = copy(document), minus = copy(document);
    plus.experiment.sources[0].dc += h; minus.experiment.sources[0].dc -= h;
    const slope = (success(solveDiodeOperatingPoint(plus)).observations.vout.value -
      success(solveDiodeOperatingPoint(minus)).observations.vout.value) / (2 * h);
    return Math.abs(slope - dcSlope);
  });
  assert.ok(errors[1] < errors[0] && errors[2] < errors[1], `${errors}`);
  const system = assembleDiodeSystem(document);
  const J = evaluateDiodeSystem(system, point.x).jacobian;
  const out = system.unknowns.findIndex(l => l.id === 'V(out)');
  const branch = system.unknowns.findIndex(l => l.id === 'I(D1)');
  const eliminated = J[out][out] - J[out][branch] * J[branch][out] / J[branch][branch];
  close(eliminated, .001 + conductance, 1e-12);
  const stale = copy(document); stale.experiment.sources[0].dc += .01;
  assert.equal(createDiodeTangent(point, stale).code, 'stale-bias');
});

test('damping, invalid data/options, unresolved circuits, and nonfinite range fail explicitly', () => {
  const document = fixture('resistor-diode-series');
  const point = success(solveDiodeOperatingPoint(document));
  assert.ok(point.trace.some(step => step.damping < 1));
  assert.ok(point.trace.every(step => Number.isFinite(step.merit) && step.damping > 0));
  assert.equal(solveDiodeOperatingPoint(document, { maxIterations: 1 }).status, 'failed');
  assert.equal(solveDiodeOperatingPoint(document, { maxBacktracks: 1 }).status, 'failed');
  assert.throws(() => solveDiodeOperatingPoint(document, { maxIterations: 0 }), RangeError);
  assert.throws(() => solveDiodeOperatingPoint(document, { initialGuess: [0] }), RangeError);
  assert.throws(() => solveDiodeOperatingPoint(document, { currentScaleA: 0 }), RangeError);
  assert.throws(() => solveDiodeOperatingPoint(document, { tolerance: { currentAbsolute: NaN } }), RangeError);
  const nearby = solveDiodeOperatingPoint(document, {
    initialGuess: [document.experiment.sources[0].dc, .54, -.001, .001],
  });
  close(success(nearby).observations.vout.value, point.observations.vout.value, 2e-9);
  const huge = copy(document); huge.experiment.sources[0].dc = 1e300;
  assert.notEqual(solveDiodeOperatingPoint(huge).status, 'ok');
  assert.equal(solveDiodeOperatingPoint(document, {
    initialGuess: [document.experiment.sources[0].dc, 1000, 0, 0],
  }).code, 'numeric-range');
  const reverseBias = fixture('resistor-diode');
  reverseBias.experiment.sources[0].dc = -100;
  const reversePoint = success(solveDiodeOperatingPoint(reverseBias));
  assert.equal(reversePoint.diodes.D1.differentialResistanceOhm, null);
  assert.equal(createDiodeTangent(reversePoint, reverseBias).code, 'unrepresentable-resistance');
  const forced = fixture('resistor-diode');
  forced.circuit.components = [
    { id: 'I1', type: 'I', p: 'out', n: '0' },
    forced.circuit.components.find(c => c.id === 'D1'),
  ];
  forced.circuit.nodes = ['0', 'out'];
  forced.circuit.observations = [{ id: 'id', type: 'current', component: 'D1' }];
  forced.experiment.sources = [{ id: 'I1', dc: .001 }];
  const reverse = solveDiodeOperatingPoint(forced, { currentScaleA: .001 });
  assert.equal(reverse.status, 'failed');
  const contradictory = copy(forced);
  contradictory.circuit.components = [
    { id: 'V1', type: 'V', p: 'out', n: '0' },
    { id: 'V2', type: 'V', p: 'out', n: '0' },
    forced.circuit.components.find(c => c.id === 'D1'),
  ];
  contradictory.experiment.sources = [{ id: 'V1', dc: 1 }, { id: 'V2', dc: 2 }];
  assert.equal(solveDiodeOperatingPoint(contradictory).status, 'failed');
  const floating = copy(forced);
  floating.circuit.components = [floating.circuit.components.find(c => c.id === 'D1')];
  floating.circuit.nodes = ['0', 'out', 'other'];
  floating.circuit.components[0].n = 'other';
  floating.experiment.sources = [];
  assert.equal(solveDiodeOperatingPoint(floating).status, 'failed');
});

test('default fixed current scale converges at ampere and milliampere levels', () => {
  for (const [resistance, seriesResistance] of [[1000, 0], [100, 0], [10, 0], [1, 0], [10, 10], [1, 10]]) {
    const document = fixture('resistor-diode');
    document.circuit.components.find(c => c.id === 'R1').value = resistance;
    document.circuit.components.find(c => c.id === 'D1').model.seriesResistanceOhm = seriesResistance;
    const expected = scalarSeriesBias(1, resistance, 1e-12, kB * 300 / q, seriesResistance);
    const point = success(solveDiodeOperatingPoint(document));
    assert.ok(point.trace.length > 0 && point.trace.length < 60);
    close(point.observations.vout.value, expected.terminalVoltage, 2e-9, `${resistance} Ω, Rs=${seriesResistance}`);
    close(point.diodes.D1.currentA, expected.current, 2e-10, `${resistance} Ω, Rs=${seriesResistance}`);
    assert.ok(point.residuals.every(row => row.passed));
  }
  const explicit = fixture('resistor-diode');
  explicit.circuit.components.find(c => c.id === 'R1').value = 10;
  const point = success(solveDiodeOperatingPoint(explicit, { currentScaleA: 0.1 }));
  close(point.diodes.D1.currentA, scalarSeriesBias(1, 10, 1e-12, kB * 300 / q, 0).current, 2e-10);
});

test('branch-based residual allowances reject stale shifted-return warm starts', () => {
  const rowAllowances = [];
  for (const returnVoltage of [0, 12, 1000]) {
    const document = fixture('resistor-diode');
    document.circuit.nodes.push('return');
    document.circuit.components.push({ id: 'Vref', type: 'V', p: 'return', n: '0' });
    document.circuit.components.find(c => c.id === 'V1').n = 'return';
    document.circuit.components.find(c => c.id === 'D1').n = 'return';
    document.circuit.observations.find(o => o.id === 'vout').n = 'return';
    document.experiment.sources.push({ id: 'Vref', dc: returnVoltage });
    const old = success(solveDiodeOperatingPoint(document));
    document.experiment.sources.find(s => s.id === 'V1').dc = 1.0000001;
    const result = success(solveDiodeOperatingPoint(document, { initialGuess: old.x }));
    assert.ok(result.trace.length > 0, `stale source constraint accepted at return=${returnVoltage} V`);
    const expected = scalarSeriesBias(1.0000001, 1000, 1e-12, kB * 300 / q, 0);
    close(result.observations.vout.value, expected.terminalVoltage, 2e-9);
    close(result.diodes.D1.currentA, expected.current, 2e-12);
    const sourceRow = result.residuals.find(row => row.label === 'law(V1)');
    assert.ok(sourceRow.passed && sourceRow.physicalAllowance < 3e-8);
    assert.ok(sourceRow.arithmeticAllowance < 1e-10);
    rowAllowances.push([sourceRow.physicalAllowance,
      result.residuals.find(row => row.label === 'KCL(out)').physicalAllowance]);
    close(result.unknowns['V(in)'] - result.unknowns['V(return)'], 1.0000001, sourceRow.tolerance);
  }
  for (const allowances of rowAllowances.slice(1)) {
    close(allowances[0], rowAllowances[0][0], 1e-13, 'source physical allowance');
    close(allowances[1], rowAllowances[0][1], 1e-13, 'KCL physical allowance');
  }
});

test('physical contributions use relative branch/control voltages for every DC row kind', () => {
  const document = fixture('resistor-diode');
  document.circuit.nodes.push('return', 'controlled', 'currentControlled');
  document.circuit.components.find(c => c.id === 'V1').n = 'return';
  document.circuit.components.find(c => c.id === 'D1').n = 'return';
  document.circuit.components.push(
    { id: 'Vref', type: 'V', p: 'return', n: '0' },
    { id: 'E1', type: 'VCVS', p: 'controlled', n: 'return', cp: 'in', cn: 'return', gain: 2 },
    { id: 'H1', type: 'CCVS', p: 'currentControlled', n: 'return', control: 'V1', gain: 10 },
    { id: 'L1', type: 'L', p: 'controlled', n: 'out', value: 1e-3 },
  );
  document.circuit.observations.find(o => o.id === 'vout').n = 'return';
  document.experiment.sources.push({ id: 'Vref', dc: 0 });
  const termsAt = offset => {
    document.experiment.sources.find(s => s.id === 'Vref').dc = offset;
    const system = assembleDiodeSystem(document);
    const coordinates = { 'V(return)': offset, 'V(in)': offset + 1,
      'V(out)': offset + .5, 'V(controlled)': offset + 2,
      'V(currentControlled)': offset + 3, 'I(V1)': .2, 'I(D1)': .001 };
    const x = system.unknowns.map(label => coordinates[label.id] ?? 0);
    const evaluation = evaluateDiodeSystem(system, x);
    assert.ok(evaluation);
    return Object.fromEntries(system.rows.map((row, i) => [row.id, evaluation.physicalTerms[i]]));
  };
  const base = termsAt(0), shifted = termsAt(1000);
  for (const row of ['law(V1)', 'law(E1)', 'law(H1)', 'law(L1)', 'KCL(out)']) {
    assert.equal(base[row].length, shifted[row].length);
    base[row].forEach((term, i) => close(shifted[row][i], term, 1e-12, row));
  }
});

test('bias fingerprint normalizes optional undefined labels only after strict validation', () => {
  const document = fixture('resistor-diode');
  document.circuit.label = undefined;
  document.circuit.components.find(c => c.id === 'D1').label = undefined;
  document.circuit.components.find(c => c.id === 'R1').label = undefined;
  document.circuit.observations.find(o => o.id === 'vout').label = undefined;
  const point = success(solveDiodeOperatingPoint(document));
  assert.equal(createDiodeTangent(point, document).status, 'ok');
  assert.equal(createDiodeTangent(point, parseNonlinearDocument(serializeNonlinearDocument(document))).status, 'ok');
  const changedModel = copy(document);
  changedModel.circuit.components.find(c => c.id === 'D1').model.temperatureK = 301;
  assert.equal(createDiodeTangent(point, changedModel).code, 'stale-bias');
  const changedTopology = copy(document);
  changedTopology.circuit.components.find(c => c.id === 'R1').p = 'out';
  assert.equal(createDiodeTangent(point, changedTopology).code, 'stale-bias');
  const changedDC = copy(document);
  changedDC.experiment.sources[0].dc += .01;
  assert.equal(createDiodeTangent(point, changedDC).code, 'stale-bias');
  const changedAC = copy(document);
  changedAC.experiment.sources[0].ac = { re: 2, im: 0 };
  assert.equal(createDiodeTangent(point, changedAC).status, 'ok');
  const storageDocument = fixture('diode-rc-tangent');
  const storagePoint = success(solveDiodeOperatingPoint(storageDocument));
  storageDocument.experiment.sources[0].waveform.after = 2;
  storageDocument.experiment.initial.values[0].value = 0.7;
  assert.equal(createDiodeTangent(storagePoint, storageDocument).status, 'ok');
  const unsupported = copy(document);
  unsupported.circuit.components.find(c => c.id === 'D1').unexpected = undefined;
  assert.equal(createDiodeTangent(point, unsupported).code, 'stale-bias');
  const invalid = copy(document);
  invalid.circuit.components.find(c => c.id === 'D1').model.temperatureK = NaN;
  assert.equal(createDiodeTangent(point, invalid).code, 'stale-bias');
});
