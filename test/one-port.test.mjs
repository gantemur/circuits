import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dcOnePort } from '../dist/index.js';

const fixture = name => JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url)));
const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `${actual} should be within ${tolerance} of ${expected}`);
const good = result => { assert.equal(result.status, 'ok', result.message); return result; };

test('divider: independent terminal identities and three solved load circuits', () => {
  const source = fixture('divider'), before = JSON.stringify(source);
  const r = good(dcOnePort(source, 'out', '0', 2000));
  assert.equal(JSON.stringify(source), before);
  close(r.vth, 8); close(r.rth, 2000 / 3); close(r.inorton, 0.012);
  close(r.shortCurrent, 0.012); assert.ok(r.shortPassed);
  for (const result of [r.original, r.thevenin, r.norton]) {
    close(result.voltage, 6); close(result.current, 0.003);
    assert.ok(result.solution.residuals.every(row => row.passed));
    assert.ok(result.solution.groundKcl.passed);
  }
  assert.ok(r.theveninComparison.passed && r.nortonComparison.passed);
  assert.deepEqual(r.suppressed, ['Vin']);
});

test('differential non-ground port and reversal retain local equivalent reference', () => {
  const d = fixture('one-port-bridge');
  const r = good(dcOnePort(d, 'a', 'b', 1000));
  close(r.vth, 2); close(r.rth, 6500 / 3); close(r.original.voltage, 12 / 19);
  close(r.original.current, 12 / 19000); assert.ok(r.theveninComparison.passed && r.nortonComparison.passed);
  assert.equal(r.equivalentPortLabels.localNegative, '0');
  const reverse = good(dcOnePort(d, 'b', 'a', 1000));
  close(reverse.vth, -2); close(reverse.inorton, -r.inorton); close(reverse.rth, r.rth);
  close(reverse.original.voltage, -12 / 19); close(reverse.original.current, -12 / 19000);
  assert.ok(reverse.shortPassed && reverse.theveninComparison.passed && reverse.nortonComparison.passed);
});

test('controlled source remains active during test and zero original excitation avoids 0/0', () => {
  const r = good(dcOnePort(fixture('one-port-vccs'), 'out', '0', 1000));
  close(r.vth, 1); close(r.rth, 500); close(r.inorton, 0.002); close(r.original.voltage, 2 / 3);
  assert.deepEqual(r.retainedControlled, ['D']);
  const d = fixture('divider'); d.experiment.sources[0].dc = 0;
  const zero = good(dcOnePort(d, 'out', '0', 2000));
  close(zero.vth, 0); close(zero.inorton, 0); close(zero.rth, 2000 / 3);
});

test('a small finite resistance remains positive rather than being rounded to zero', () => {
  const d = fixture('one-port-vccs');
  d.circuit.components.find(c => c.id === 'R').value = 1e-6;
  d.circuit.components.find(c => c.id === 'D').gain = 0;
  d.experiment.sources[0].dc = 1;
  const r = good(dcOnePort(d, 'out', '0', 1e-6));
  close(r.vth, 1e-6, 1e-15); close(r.rth, 1e-6, 1e-15);
  close(r.inorton, 1); close(r.original.voltage, 5e-7, 1e-15);
});

test('current-controlled sensing branch and colliding temporary IDs are retained', () => {
  const d = fixture('cccs');
  d.circuit.components.push({ id: '__port_test', type: 'R', p: 'out', n: '0', value: 4000 });
  d.circuit.components.push({ id: '__port_load', type: 'R', p: 'out', n: '0', value: 5000 });
  d.circuit.components.push({ id: '__port_short', type: 'R', p: 'out', n: '0', value: 6000 });
  d.circuit.observations.push({ id: '__port_voltage', type: 'voltage', p: 'out', n: '0' });
  d.circuit.observations.push({ id: '__port_load_current', type: 'current', component: '__port_load' });
  d.circuit.observations.push({ id: '__port_short_current', type: 'current', component: '__port_short' });
  const before = JSON.stringify(d);
  const result = good(dcOnePort(d, 'out', '0', 2000));
  assert.deepEqual(result.suppressed, ['Vin', 'Vsense']);
  assert.deepEqual(result.retainedControlled, ['D']);
  assert.equal(JSON.stringify(d), before);
  assert.ok(result.theveninComparison.passed && result.nortonComparison.passed);
});

test('invalid, storage, zero, negative, and unsolved ports remain explicit', () => {
  const divider = fixture('divider');
  assert.equal(dcOnePort(divider, 'out', 'out', 1000).status, 'invalid-port');
  assert.equal(dcOnePort(divider, 'missing', '0', 1000).status, 'invalid-port');
  assert.equal(dcOnePort(divider, 'out', '0', 0).status, 'invalid-load');
  assert.equal(dcOnePort(fixture('rc'), 'out', '0', 1000).status, 'unsupported-device');
  assert.equal(dcOnePort(divider, 'in', '0', 1000).status, 'zero-resistance');
  const negative = fixture('one-port-vccs'); negative.circuit.components[2].gain = -0.002;
  const neg = dcOnePort(negative, 'out', '0', 1000);
  assert.equal(neg.status, 'negative-resistance'); close(neg.rth, -1000);
  const failed = dcOnePort(fixture('one-port-current-source'), 'out', '0', 1000);
  assert.equal(failed.status, 'solver-failure'); assert.equal(failed.stage, 'open');
  assert.equal(failed.solves[0].result.status, 'inconsistent');
  const nonunique = dcOnePort(fixture('floating'), 'a', 'b', 1000);
  assert.equal(nonunique.status, 'solver-failure'); assert.equal(nonunique.stage, 'open');
  assert.equal(nonunique.solves[0].result.status, 'nonunique');
});
