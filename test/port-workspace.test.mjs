import test from 'node:test';
import assert from 'node:assert/strict';
import { createLab, importNative, exportNative, updateDocument } from '../dist/lab-test.js';
import { addPanel, createWorkspace, handlePanelFieldChange, PanelCalculator,
  panelCsv, reconcilePanels } from '../dist/workspace-test.js';

const change = (workspace, state, panel, field, value) =>
  handlePanelFieldChange(workspace, state, panel.id, field, value);

test('suggested port examples and duplicate panels retain independent settings and CSV metadata', () => {
  const state = createLab('port-rc-section');
  const workspace = createWorkspace(state);
  const calculator = new PanelCalculator();
  assert.deepEqual(workspace.panels.map(panel => panel.type), ['port-frequency', 'equations']);
  const first = workspace.panels[0];
  const second = addPanel(workspace, state, 'port-frequency');
  assert.ok(second);
  assert.notEqual(first.id, second.id);
  assert.equal(change(workspace, state, first, 'portFrequencyHz', '0'), true);
  assert.equal(change(workspace, state, second, 'portFrequencyHz', '1000'), true);
  assert.equal(change(workspace, state, second, 'portView', 'sweep'), true);
  assert.equal(change(workspace, state, second, 'portPoints', '5'), true);
  assert.equal(change(workspace, state, second, 'portRow', '1'), true);
  assert.equal(change(workspace, state, second, 'portColumn', '0'), true);
  const firstResult = calculator.calculate(first, state);
  const secondResult = calculator.calculate(second, state);
  assert.equal(firstResult.single.y.status, 'ok');
  assert.notEqual(firstResult.single.z.status, 'ok');
  assert.equal(secondResult.single.z.status, 'ok');
  assert.equal(secondResult.sweep.length, 5);
  assert.equal(firstResult.sweep.length, 0);
  const csv = panelCsv(second, secondResult);
  assert.match(csv, /frequency_Hz.*magnitude_unit.*port1_p.*port2_p.*status/);
  assert.match(csv, /"siemens"/);
  assert.match(csv, /"in".*"0".*"out".*"0"/);
  assert.equal(csv.trim().split('\n').length, 6);
});

test('invalid port number leaves the last valid calculation and draft available across navigation', () => {
  const state = createLab('port-t');
  const workspace = createWorkspace(state);
  const panel = workspace.panels[0];
  const calculator = new PanelCalculator();
  const original = calculator.calculate(panel, state);
  assert.equal(change(workspace, state, panel, 'portSourceResistance', '-1'), true);
  assert.equal(panel.portSourceResistance, 0);
  assert.equal(panel.pending.portSourceResistance, '-1');
  assert.equal(panel.errors.portSourceResistance, 'portInvalidSourceResistance');
  assert.equal(calculator.calculate(panel, state), original);
  workspace.view = 'transform';
  workspace.view = 'editor';
  workspace.editorView = 'json';
  workspace.view = 'analyze';
  assert.equal(panel.pending.portSourceResistance, '-1');
  assert.equal(change(workspace, state, panel, 'portSourceResistance', '500'), true);
  assert.equal(panel.portSourceResistance, 500);
  assert.deepEqual(panel.errors, {});
  assert.equal(calculator.calculate(panel, state).single.loading.fromY.comparison.passed, true);
});

test('missing port nodes and excluded drives require reselection after valid JSON or component changes', () => {
  const state = createLab('port-t');
  const workspace = createWorkspace(state);
  const panel = workspace.panels[0];
  const calculator = new PanelCalculator();
  assert.equal(updateDocument(state, document => {
    document.circuit.nodes.push('new');
    document.circuit.components.push({ id: 'Vtest', type: 'V', p: 'in', n: '0' });
    document.experiment.sources.push({ id: 'Vtest', dc: 0, ac: { re: 1, im: 0 } });
  }).ok, true);
  assert.equal(change(workspace, state, panel, 'externalDrive', 'Vtest'), true);
  assert.equal(panel.selectionNeeded, null);
  assert.equal(updateDocument(state, document => {
    document.circuit.components = document.circuit.components.filter(component => component.id !== 'Vtest');
    document.experiment.sources = [];
  }).ok, true);
  reconcilePanels(workspace, state);
  assert.equal(panel.externalDrive, 'Vtest');
  assert.equal(panel.selectionNeeded, 'externalDrive');
  assert.equal(calculator.calculate(panel, state), null);
  assert.equal(change(workspace, state, panel, 'externalDrive', ''), true);
  assert.equal(panel.selectionNeeded, null);

  const next = JSON.parse(exportNative(state));
  next.circuit.nodes = next.circuit.nodes.map(node => node === 'out' ? 'renamed' : node);
  next.circuit.components = next.circuit.components.map(component => ({ ...component,
    p: component.p === 'out' ? 'renamed' : component.p,
    n: component.n === 'out' ? 'renamed' : component.n }));
  next.circuit.observations = next.circuit.observations.map(observation => observation.type === 'voltage' ?
    { ...observation, p: observation.p === 'out' ? 'renamed' : observation.p,
      n: observation.n === 'out' ? 'renamed' : observation.n } : observation);
  assert.equal(importNative(state, JSON.stringify(next)).ok, true);
  reconcilePanels(workspace, state);
  assert.equal(panel.p2, 'out');
  assert.equal(panel.selectionNeeded, 'port');
  assert.equal(calculator.calculate(panel, state), null);
  assert.equal(change(workspace, state, panel, 'p2', 'renamed'), true);
  assert.equal(panel.selectionNeeded, null);
  assert.equal(calculator.calculate(panel, state).type, 'port-frequency');
});

test('port panel type transitions recalculate requirements without changing its ID or settings', () => {
  const state = createLab('port-rc-section');
  const workspace = createWorkspace(state);
  const panel = workspace.panels[0];
  const id = panel.id;
  assert.equal(change(workspace, state, panel, 'portFrequencyHz', '123'), true);
  panel.p2 = 'missing';
  reconcilePanels(workspace, state);
  assert.equal(panel.selectionNeeded, 'port');
  assert.equal(change(workspace, state, panel, 'type', 'dc'), true);
  assert.equal(panel.selectionNeeded, null);
  assert.equal(change(workspace, state, panel, 'type', 'port-frequency'), true);
  assert.equal(panel.selectionNeeded, 'port');
  assert.equal(panel.id, id);
  assert.equal(panel.portFrequencyHz, 123);
});

test('single-frequency CSV keeps failed Z and zero-magnitude Y distinct at DC', () => {
  const state = createLab('port-rc-section');
  const workspace = createWorkspace(state);
  const panel = workspace.panels[0];
  const calculator = new PanelCalculator();
  change(workspace, state, panel, 'portMode', '1');
  change(workspace, state, panel, 'portFrequencyHz', '0');
  change(workspace, state, panel, 'portMatrix', 'z');
  const z = panelCsv(panel, calculator.calculate(panel, state));
  assert.match(z, /"incompatible-test"|"nonunique"/);
  assert.match(z, /"0","Z","1","1","ohm","","","",""/);
  change(workspace, state, panel, 'portMatrix', 'y');
  const y = panelCsv(panel, calculator.calculate(panel, state));
  assert.match(y, /"zero-magnitude"/);
  assert.match(y, /"Phase undefined at zero magnitude"/);
});
