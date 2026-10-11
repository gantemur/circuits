import test from 'node:test';
import assert from 'node:assert/strict';
import { createLab, updateDocument } from '../dist/lab-test.js';
import { OnePortUI } from '../dist/one-port-ui-test.js';
import { documentIssueText, setLanguage } from '../dist/diagnostics-test.js';

class FakeInput { constructor(id,value){this.id=id;this.value=value;} }
class FakeSelect extends FakeInput {}
globalThis.HTMLInputElement=FakeInput;
globalThis.HTMLSelectElement=FakeSelect;

function onePort(state) {
  const events=new Map();
  const root={innerHTML:'',addEventListener(type,handler){events.set(type,handler);}};
  return {ui:new OnePortUI(root,()=>state.current),root,
    change(id,value){events.get('change')({target:id==='one-port-load'?new FakeInput(id,value):new FakeSelect(id,value)});},
    input(id,value){events.get('input')({target:new FakeInput(id,value)});}};
}
const selected=(html,id,value)=>assert.match(html,new RegExp(`<select id="${id}"[^>]*>[\\s\\S]*?<option value="${value}" selected>`));

test('first Analyze handoff preserves reversed terminals and load, including after topology edit',()=>{
  const holder={current:createLab('divider')},view=onePort(holder);
  view.ui.useSelection('0','out',1234);
  selected(view.root.innerHTML,'one-port-p','0');
  selected(view.root.innerHTML,'one-port-q','out');
  assert.match(view.root.innerHTML,/id="one-port-load"[^>]*value="1234"/);
  assert.match(view.root.innerHTML,/Vth<\/div><div class="metric-value">-8 V/);
  assert.equal(updateDocument(holder.current,d=>{d.circuit.components.push({id:'Rextra',type:'R',p:'in',n:'out',value:4000});}).ok,true);
  view.ui.render();
  selected(view.root.innerHTML,'one-port-p','0');selected(view.root.innerHTML,'one-port-q','out');
  view.ui.useSelection('out','0',3000);
  selected(view.root.innerHTML,'one-port-p','out');selected(view.root.innerHTML,'one-port-q','0');
});

test('ordinary navigation retains Transform terminals and pending load; removed terminals require reselection',()=>{
  const holder={current:createLab('divider')},view=onePort(holder);
  view.ui.render();
  view.change('one-port-p','0');view.change('one-port-q','out');
  view.input('one-port-load','pending');
  view.ui.render();
  selected(view.root.innerHTML,'one-port-p','0');selected(view.root.innerHTML,'one-port-q','out');
  assert.match(view.root.innerHTML,/id="one-port-load"[^>]*value="pending"/);
  holder.current=createLab('rc');
  view.ui.render();
  selected(view.root.innerHTML,'one-port-p','0');selected(view.root.innerHTML,'one-port-q','out');
  assert.match(view.root.innerHTML,/id="one-port-load"[^>]*value="pending"/);
  assert.equal(updateDocument(holder.current,d=>{
    d.circuit.nodes=d.circuit.nodes.map(n=>n==='out'?'sense':n);
    for(const c of d.circuit.components){if(c.p==='out')c.p='sense';if(c.n==='out')c.n='sense';}
    for(const o of d.circuit.observations){if(o.type==='voltage'){if(o.p==='out')o.p='sense';if(o.n==='out')o.n='sense';}}
  }).ok,true);
  view.ui.render();
  assert.match(view.root.innerHTML,/id="one-port-q" aria-invalid="true"><option value="" selected>/);
  assert.match(view.root.innerHTML,/A selected port node is no longer in this circuit/);
  assert.doesNotMatch(view.root.innerHTML,/<option value="sense" selected>/);
  view.change('one-port-q','sense');
  selected(view.root.innerHTML,'one-port-q','sense');
});

test('diagnostic identifiers translate in both directions without replacing rejected content',()=>{
  const malformed={kind:'validation',code:'invalid-json',params:{}};
  const fileRead={kind:'read'};
  setLanguage('en');
  assert.match(documentIssueText(malformed,'json'),/The content is not valid JSON/);
  assert.match(documentIssueText(malformed,'import'),/Import rejected/);
  assert.match(documentIssueText(fileRead,'import'),/selected file could not be read/);
  setLanguage('mn');
  assert.match(documentIssueText(malformed,'json'),/JSON бичвэр хүчинтэй биш/);
  assert.match(documentIssueText(malformed,'import'),/Импорт татгалзагдлаа/);
  assert.match(documentIssueText(fileRead,'import'),/Сонгосон файлыг уншиж чадсангүй/);
  setLanguage('en');
  assert.match(documentIssueText(malformed,'json'),/The content is not valid JSON/);
});
