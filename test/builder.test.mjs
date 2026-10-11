import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createLab, analyze, exportNative, importNative } from '../dist/lab-test.js';
import { addComponent, addNode, addObservation, applyBuilder, builderConflict, changeInitial,
  changeWaveform, componentReferences, createBuilder, documentFromDraft, newBuilder, nodeReferences,
  reloadBuilder, removeComponent, removeNode, renameNode, touchBuilder } from '../dist/builder-test.js';
import { parseDocument } from '../dist/index.js';
import { schematic } from '../dist/schematic-test.js';

const near = (actual, expected, tolerance=1e-8) => assert.ok(Math.abs(actual-expected) <= tolerance, `${actual} != ${expected}`);
const ok = result => { assert.equal(result.status, 'ok', result.message); return result; };

test('builder load preserves every native field, including optional source and storage data', async () => {
  const text = await readFile(new URL('../fixtures/rc-high-pass.json', import.meta.url), 'utf8');
  const state = createLab(); assert.equal(importNative(state, text).ok, true);
  const builder = createBuilder(state);
  assert.deepEqual(documentFromDraft(builder.draft), parseDocument(text));
  assert.equal(applyBuilder(builder, state).ok, true);
  assert.deepEqual(state.document, parseDocument(text));
  assert.deepEqual(parseDocument(exportNative(state)), parseDocument(text));
  const noOptional = parseDocument(text);
  delete noOptional.experiment.sources[0].ac;
  delete noOptional.experiment.sources[0].waveform;
  assert.equal(importNative(state, JSON.stringify(noOptional)).ok, true);
  reloadBuilder(builder, state);
  assert.deepEqual(documentFromDraft(builder.draft), noOptional);
});

test('builder Apply retains valid measurement choices and replaces removed choices', () => {
  const state = createLab(); state.output = 'r1i';
  const builder = createBuilder(state);
  builder.draft.circuit.components.find(c => c.id === 'R2').value = '3000'; touchBuilder(builder);
  assert.equal(applyBuilder(builder, state).ok, true);
  assert.equal(state.input, 'Vin'); assert.equal(state.output, 'r1i');
  builder.draft.circuit.observations = builder.draft.circuit.observations.filter(o => o.id !== 'r1i'); touchBuilder(builder);
  assert.equal(applyBuilder(builder, state).ok, true);
  assert.equal(state.output, 'out');
});

test('builder adds a 2000 ohm divider load and removes it without cascading references', () => {
  const state = createLab(), builder = createBuilder(state);
  near(ok(analyze(state).dc).observations.out.value.re, 8);
  const load = addComponent(builder, 'R');
  load.p = 'out'; load.n = '0'; load.value = '2000';
  assert.equal(applyBuilder(builder, state).ok, true);
  near(ok(analyze(state).dc).observations.out.value.re, 6);
  assert.equal(schematic(state).schematic, false);
  const current = addObservation(builder, 'current'); current.component = load.id;
  assert.deepEqual(componentReferences(builder, load.id), [current.id]);
  assert.deepEqual(removeComponent(builder, load.id), [current.id]);
  builder.draft.circuit.observations = builder.draft.circuit.observations.filter(o => o.id !== current.id);
  assert.deepEqual(removeComponent(builder, load.id), []);
  assert.equal(applyBuilder(builder, state).ok, true);
  near(ok(analyze(state).dc).observations.out.value.re, 8);
  assert.equal(schematic(state).schematic, true);
  assert.deepEqual(nodeReferences(builder, 'out').sort(), ['R1', 'R2', 'out', 'r1v'].sort());
  assert.deepEqual(removeNode(builder, 'out').sort(), ['R1', 'R2', 'out', 'r1v'].sort());
  assert.deepEqual(removeNode(builder, '0'), ['0']);
});

test('form-built RC high-pass follows independent transfer and step recurrence', () => {
  const state = createLab(), builder = createBuilder(state); newBuilder(builder, state);
  addNode(builder); renameNode(builder, 1, 'in');
  addNode(builder); renameNode(builder, 2, 'out');
  const v = addComponent(builder, 'V'); v.p = 'in'; v.n = '0';
  const c = addComponent(builder, 'C'); c.p = 'in'; c.n = 'out'; c.value = '0.000001';
  const r = addComponent(builder, 'R'); r.p = 'out'; r.n = '0'; r.value = '1000';
  const out = addObservation(builder, 'voltage'); out.p = 'out'; out.n = '0';
  const source = builder.draft.experiment.sources[0]; source.dc = '1'; source.ac = { re: '1', im: '0' };
  changeWaveform(builder, v.id, 'step'); source.waveform.at = '0'; source.waveform.before = '0'; source.waveform.after = '1';
  changeInitial(builder, 'storage');
  assert.equal(applyBuilder(builder, state).ok, true);
  const fc = 1/(2*Math.PI*.001); state.settings = { ...state.settings, minHz: fc, maxHz: fc*100, inspectHz: fc, points: 3 };
  const a = analyze(state), p = a.sweep[0];
  near(ok(a.dc).observations[out.id].value.re, 0);
  near(p.magnitude, 1/Math.sqrt(2)); near(p.phaseDegrees, 45);
  const samples = ok(a.transient).samples;
  near(samples[0].observations[out.id].value.re, 0);
  near(samples[1].observations[out.id].value.re, 1);
  for (const n of [1, 5, 20]) near(samples[n+1].observations[out.id].value.re, (1+state.settings.step/.001)**-n);
});

test('invalid builder draft and changed-document conflict keep validated results', () => {
  const state = createLab(), builder = createBuilder(state), saved = exportNative(state);
  builder.draft.circuit.components.find(c => c.id === 'R1').value = 'oops'; touchBuilder(builder);
  assert.equal(applyBuilder(builder, state).ok, false);
  assert.equal(builder.draft.circuit.components.find(c => c.id === 'R1').value, 'oops');
  assert.equal(exportNative(state), saved); near(ok(analyze(state).dc).observations.out.value.re, 8);
  builder.draft.circuit.components.find(c => c.id === 'R1').value = '2000'; touchBuilder(builder);
  assert.equal(importNative(state, exportNative(createLab('rc'))).ok, true);
  assert.equal(builderConflict(builder, state), true);
  assert.equal(applyBuilder(builder, state).ok, false);
  assert.equal(state.presetId, 'rc');
  reloadBuilder(builder, state); assert.equal(builderConflict(builder, state), false);
});

test('controlled-source controls and inconsistent ideal-source documents survive builder Apply', async () => {
  const state = createLab('vcvs'), builder = createBuilder(state);
  const retained = addComponent(builder, 'CCCS'); retained.control = 'Vin'; retained.p = 'out'; retained.n = '0'; retained.gain = '0.25';
  const vcvs = builder.draft.circuit.components.find(c => c.id === 'D');
  assert.equal(vcvs.cp, 'in'); assert.equal(vcvs.cn, '0');
  builder.draft.experiment.sources[0].ac = { re: '2', im: '-1' }; touchBuilder(builder);
  assert.equal(applyBuilder(builder, state).ok, true);
  assert.equal(state.document.circuit.components.find(c => c.id === retained.id).control, 'Vin');
  assert.deepEqual(state.document.experiment.sources[0].ac, { re: 2, im: -1 });
  const inconsistent = await readFile(new URL('../fixtures/parallel-unequal.json', import.meta.url), 'utf8');
  assert.equal(importNative(state, inconsistent).ok, true); reloadBuilder(builder, state);
  assert.equal(applyBuilder(builder, state).ok, true);
  assert.equal(analyze(state).dc.status, 'inconsistent');
});

test('source and storage removal clean only their own experiment entries; empty draft is valid but analysis unavailable', () => {
  const state = createLab('rc-high-pass'), builder = createBuilder(state);
  const capacitor = builder.draft.circuit.components.find(c => c.type === 'C');
  const source = builder.draft.circuit.components.find(c => c.type === 'V');
  assert.deepEqual(componentReferences(builder, capacitor.id), ['capacitor']);
  builder.draft.circuit.observations = builder.draft.circuit.observations.filter(o => o.type !== 'current');
  assert.deepEqual(removeComponent(builder, capacitor.id), []);
  assert.deepEqual(builder.draft.experiment.initial.values, []);
  assert.deepEqual(removeComponent(builder, source.id), []);
  assert.deepEqual(builder.draft.experiment.sources, []);
  const empty = createBuilder(state); newBuilder(empty, state);
  assert.equal(applyBuilder(empty, state).ok, true);
  assert.equal(state.input, ''); assert.equal(state.output, '');
  assert.throws(() => analyze(state), /Choose an independent source/);
});
