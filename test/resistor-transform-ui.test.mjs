import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDocument, resistorCandidates } from '../dist/index.js';
import { ResistorTransformUI } from '../dist/resistor-transform-ui-test.js';
import { openPortComparison } from '../dist/transform-navigation-test.js';
import { setLanguage } from '../dist/i18n-test.js';

class FakeInput { constructor(id,value,dataset={}){Object.assign(this,{id,value,dataset});} }
class FakeSelect extends FakeInput {}
class FakeElement { constructor(selector,dataset={}){this.selector=selector;this.dataset=dataset;} closest(query){return query===this.selector?this:null;} }
globalThis.HTMLInputElement=FakeInput;
globalThis.HTMLSelectElement=FakeSelect;
globalThis.Element=FakeElement;

const document=(nodes,edges,observations=[])=>parseDocument(JSON.stringify({circuit:{schemaVersion:1,nodes,
  components:edges.map(([id,p,n,value])=>({id,type:'R',p,n,value})),observations},
  experiment:{schemaVersion:1,sources:[],initial:{kind:'equilibrium'}}}));
function view(document){
  const events=new Map(),holder={document};
  const root={innerHTML:'',addEventListener(type,handler){events.set(type,handler);}};
  const ui=new ResistorTransformUI(root,()=>holder);ui.render();
  return {ui,root,holder,
    change(id,value,dataset={}){events.get('change')({target:new FakeSelect(id,value,dataset)});},
    click(selector,dataset={}){events.get('click')({target:new FakeElement(selector,dataset)});}};
}

test('Analyze Open comparison selects DC with ordered port and load, preserving resistor state',()=>{
  const method={method:'resistor'},selection=[],views=[];
  openPortComparison(method,{p:'0',q:'out',load:2000},(...args)=>selection.push(args),()=>views.push('transform'));
  assert.equal(method.method,'dc');assert.deepEqual(selection,[['0','out',2000]]);assert.deepEqual(views,['transform']);
  method.method='resistor';
  openPortComparison(method,{p:'out',q:'0',load:375},(...args)=>selection.push(args),()=>views.push('transform'));
  assert.equal(method.method,'dc');assert.deepEqual(selection[1],['out','0',375]);
});

test('UI candidate selection transforms the intended colon-containing edge pair',()=>{
  setLanguage('en');
  const d=document(['a','0'],[['a:b','a','0',1000],['c','a','0',2000],['a','a','0',3000],['b:c','a','0',4000]],
    [{id:'Vout',type:'voltage',p:'a',n:'0'}]);
  const v=view(d);
  v.change('res-operation','parallel');
  const choices=resistorCandidates({nodes:d.circuit.nodes,edges:d.circuit.components.map(c=>({id:c.id,p:c.p,n:c.n,resistance:c.value}))},['a','0']);
  const selected=choices.find(c=>JSON.stringify(c.selection.edges)===JSON.stringify(['a','b:c']));
  v.change('res-choice',selected.key);
  assert.match(v.root.innerHTML,/Removed branches: a, b:c/);
  const exported=parseDocument(v.ui.latestJson);
  assert.deepEqual(exported.circuit.components.filter(c=>!c.id.startsWith('R_parallel')).map(c=>c.id),['a:b','c']);
  assert.ok(Math.abs(exported.circuit.components.find(c=>c.id.startsWith('R_parallel')).value-12000/7)<1e-9);
});

test('ordered terminal selectors preserve comma and whitespace IDs through preview and strict export',()=>{
  for(const id of ['a,b',' a,b ']){
    const d=document(['0',id],[['R',id,'0',1000]],[{id:'V',type:'voltage',p:id,n:'0'}]);
    const v=view(d);
    assert.match(v.root.innerHTML,/Strict native JSON preview/);
    assert.deepEqual(parseDocument(v.ui.latestJson).circuit.nodes,[id,'0']);
    v.click('[data-res-terminal-action]',{resTerminalAction:'add'});
    assert.equal(v.ui.latestJson,null);
    assert.match(v.root.innerHTML,/Choose distinct existing retained terminals/);
    v.change('res-terminal-2',id,{resTerminal:'2'});
    assert.equal(v.ui.latestJson,null);
    v.change('res-terminal-2','0',{resTerminal:'2'});
    assert.equal(v.ui.latestJson,null);
    v.click('[data-res-terminal-action]',{resTerminalAction:'remove',resTerminalIndex:'2'});
    assert.deepEqual(parseDocument(v.ui.latestJson).circuit.nodes,[id,'0']);
    v.click('[data-res-terminal-action]',{resTerminalAction:'down',resTerminalIndex:'0'});
    assert.deepEqual(parseDocument(v.ui.latestJson).circuit.nodes,['0',id]);
    assert.match(v.root.innerHTML,new RegExp(`Original terminal response[\\s\\S]*?i ↓ / u →[\\s\\S]*?<th>0</th>`));
    v.click('[data-res-terminal-action]',{resTerminalAction:'up',resTerminalIndex:'1'});
    setLanguage('mn');v.ui.render();
    assert.deepEqual(parseDocument(v.ui.latestJson).circuit.nodes,[id,'0']);
    setLanguage('en');
  }
});

test('missing native IDs stay selected and escaped until explicit reselection',()=>{
  const id='<node,a>';
  const v=view(document(['0',id],[['R',id,'0',1000]],[{id:'V',type:'voltage',p:id,n:'0'}]));
  v.holder.document=document(['0','other'],[['R','other','0',1000]],[{id:'V',type:'voltage',p:'other',n:'0'}]);
  v.ui.render();
  assert.equal(v.ui.latestJson,null);
  assert.match(v.root.innerHTML,/Missing: &quot;&lt;node,a&gt;&quot;/);
  assert.doesNotMatch(v.root.innerHTML,/<node,a>/);
  v.change('res-terminal-0','other',{resTerminal:'0'});
  assert.deepEqual(parseDocument(v.ui.latestJson).circuit.nodes,['other','0']);
});
