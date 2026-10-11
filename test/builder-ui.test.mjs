import test from 'node:test';
import assert from 'node:assert/strict';
import { BuilderUI, setLanguage } from '../dist/builder-ui-test.js';
import { createLab, exportNative } from '../dist/lab-test.js';

class FakeElement {
  constructor(dataset = {}, value = '') { this.dataset = dataset; this.value = value; }
  closest(selector) { return selector === '[data-builder-action]' ? this : null; }
}
globalThis.Element = FakeElement;
globalThis.HTMLInputElement = class extends FakeElement {};
globalThis.HTMLSelectElement = class extends FakeElement {};

class FakeRoot {
  listeners = new Map();
  innerHTML = '';
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  querySelector(selector) { return selector === '.builder-status' ? { textContent: '' } : null; }
  dispatch(name, target) { this.listeners.get(name)({ target }); }
}

const click = (root, action, index = '') => root.dispatch('click', new FakeElement({ builderAction: action, index }));
const editNode = (root, index, value) => {
  const input = new HTMLInputElement({ builderField: `node:${index}:id` }, value);
  root.dispatch('input', input);
  root.dispatch('change', input);
};
const nodeField = (root, index) => {
  const input = root.innerHTML.match(new RegExp(`<input id="builder-node-${index}"[^>]*>`))?.[0];
  assert.ok(input, `Missing node field ${index}`);
  return input;
};

test('UI keeps rejected node text and translated error through add, shifted removal, and Apply', () => {
  setLanguage('en');
  const state = createLab(), root = new FakeRoot();
  let applied = 0;
  const ui = new BuilderUI(root, () => state, () => { applied++; });
  ui.render();
  click(root, 'add-node'); // n1, index 3
  click(root, 'add-node'); // n2, index 4
  editNode(root, 4, '0');
  assert.match(nodeField(root, 4), /value="0"[^>]*aria-invalid="true"/);
  assert.match(root.innerHTML, /Only the ground node can be named 0/);

  click(root, 'add-node'); // n3: the n2 edit must remain
  assert.match(nodeField(root, 4), /value="0"[^>]*aria-invalid="true"/);
  click(root, 'remove-node', '3'); // remove n1; n2 shifts to index 3
  assert.equal(ui.builder.draft.circuit.nodes[3], 'n2');
  assert.match(nodeField(root, 3), /value="0"[^>]*aria-invalid="true"/);
  const validated = exportNative(state);
  click(root, 'apply');
  assert.equal(applied, 0);
  assert.equal(exportNative(state), validated);
  assert.match(nodeField(root, 3), /value="0"[^>]*aria-invalid="true"/);

  setLanguage('mn'); ui.render();
  assert.match(nodeField(root, 3), /value="0"[^>]*aria-invalid="true"/);
  assert.match(root.innerHTML, /Зөвхөн газардалтын зангилаа 0 нэртэй байж болно/);
  editNode(root, 3, 'entry');
  click(root, 'apply');
  assert.equal(applied, 1);
  assert.ok(state.document.circuit.nodes.includes('entry'));
  setLanguage('en');
});

test('UI removes only the deleted node edit, and Discard restores clean synchronization', () => {
  setLanguage('en');
  const state = createLab(), root = new FakeRoot();
  const ui = new BuilderUI(root, () => state, () => {});
  ui.render();
  click(root, 'add-node');
  click(root, 'add-node');
  editNode(root, 3, '0');
  editNode(root, 4, 'out');
  click(root, 'remove-node', '3');
  assert.equal(ui.builder.draft.circuit.nodes[3], 'n2');
  assert.match(nodeField(root, 3), /value="out"[^>]*aria-invalid="true"/);
  assert.doesNotMatch(root.innerHTML, /Only the ground node can be named 0/);
  assert.match(root.innerHTML, /That node name is already in use/);
  click(root, 'discard');
  assert.deepEqual(ui.builder.draft.circuit.nodes, state.document.circuit.nodes);
  assert.doesNotMatch(root.innerHTML, /That node name is already in use/);
  Object.assign(state, createLab('rc'));
  ui.render();
  assert.deepEqual(ui.builder.draft.circuit.nodes, state.document.circuit.nodes);
  assert.match(root.innerHTML, /Builder matches the analyzed circuit/);
});
