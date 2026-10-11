import test from 'node:test';
import assert from 'node:assert/strict';
import { createLab, exportNative, importNative, updateDocument } from '../dist/lab-test.js';
import { schematic } from '../dist/schematic-test.js';
import { guideFor, lessons, referenceResponses, referenceStatus } from '../dist/study-guide-test.js';
import { guideNavigation } from '../dist/guide-navigation-test.js';
import { createWorkspace } from '../dist/workspace-test.js';
import { resistorCandidates, transformResistors } from '../dist/index.js';
import { ResistorTransformUI, terminalExperiment } from '../dist/resistor-transform-ui-test.js';

class Input { constructor(id,value,dataset={}) { Object.assign(this,{id,value,dataset}); } }
class Select extends Input {}
class Element { constructor(selector,dataset={}) { this.selector=selector;this.dataset=dataset; } closest(query) { return query===this.selector?this:null; } }
globalThis.HTMLInputElement=Input;
globalThis.HTMLSelectElement=Select;
globalThis.Element=Element;
function uiFor(state,hasDrafts=()=>false) {
  const events=new Map(),root={innerHTML:'',addEventListener(type,handler){events.set(type,handler);}};
  let applied=0;
  const ui=new ResistorTransformUI(root,()=>state,{hasDrafts,apply(json){applied++;return importNative(state,json).ok;},
    loadExample(){},openAnalyze(){}});
  ui.render();
  return {ui,root,applied:()=>applied,change(id,value,dataset={}){events.get('change')({target:new Select(id,value,dataset)});},
    click(selector,dataset={}){events.get('click')({target:new Element(selector,dataset)});}};
}
function candidate(state,operation) {
  const network={nodes:state.document.circuit.nodes,edges:state.document.circuit.components.filter(c=>c.type==='R').map(c=>({id:c.id,p:c.p,n:c.n,resistance:c.value}))};
  const retained=[...new Set([...state.document.circuit.observations.filter(o=>o.type==='voltage').flatMap(o=>[o.p,o.n]),'0'])];
  return resistorCandidates(network,retained).find(c=>c.selection.operation===operation);
}

test('explicit series preview illustrates independent 3000 ohm and 1 V/3 mA facts',()=>{
  const state=createLab('res-series'),view=uiFor(state);
  view.change('res-operation','series');view.change('res-choice',candidate(state,'series').key);
  assert.equal(view.ui.latestJson,null);
  assert.match(view.root.innerHTML,/Preview transformation/);
  view.click('#res-preview');
  assert.match(view.root.innerHTML,/1000 Ω \+ 2000 Ω → 3000 Ω/);
  assert.match(view.root.innerHTML,/0\.333333333 mA/);
  assert.match(view.root.innerHTML,/Terminal equations/);
  assert.match(view.root.innerHTML,/Local rewrite illustration/);
  assert.equal(view.ui.latestJson.includes('R_series'),true);
  view.change('res-terminal-0','0',{resTerminal:'0'});
  assert.equal(view.ui.latestJson,null);
  assert.doesNotMatch(view.root.innerHTML,/Use transformed circuit/);
});

test('use/return recheck exact revision and require explicit draft-conflict choice',()=>{
  const state=createLab('res-series');let draft=true;
  const view=uiFor(state,()=>draft),original=exportNative(state);
  view.change('res-operation','series');view.change('res-choice',candidate(state,'series').key);view.click('#res-preview');
  view.click('#res-use');assert.equal(view.applied(),0);assert.match(view.root.innerHTML,/unapplied draft/);
  view.click('#res-confirm');assert.equal(view.applied(),1);assert.equal(draft,true);
  assert.equal(state.document.circuit.components.length,1);assert.equal(state.document.circuit.components[0].value,3000);
  assert.equal(view.ui.guideOrigin(),'res-series');
  view.click('#res-return');assert.equal(view.applied(),1);
  view.click('#res-confirm');assert.equal(view.applied(),2);assert.equal(exportNative(state),original);
  assert.equal(view.ui.guideOrigin(),null);
  draft=false;
  view.change('res-choice',candidate(state,'series').key);view.click('#res-preview');
  updateDocument(state,d=>{d.circuit.components[0].value=1500;});
  view.click('#res-use');assert.equal(view.applied(),2);assert.match(view.root.innerHTML,/no longer matches/);
});

test('three-terminal and bridge previews preserve ordered clamped interpretation and checks',()=>{
  for(const [id,operation] of [['res-star','star-delta'],['res-star','star-mesh'],['res-bridge','kron']]) {
    const state=createLab(id),view=uiFor(state);
    view.change('res-operation',operation);
    view.change('res-choice',candidate(state,operation).key);
    view.click('#res-preview');
    assert.match(view.root.innerHTML,/Verified terminal-equivalent preview/);
    assert.match(view.root.innerHTML,/Other terminals are clamped to 0 V/);
    assert.match(view.root.innerHTML,/Verification details/);
    const result=transformResistors(state.document,id==='res-bridge'?['a','0']:['a','b','0'],candidate(state,operation).selection);
    assert.equal(result.status,'ok');
    const experiment=terminalExperiment(result.originalResponse,result.retained);
    assert.equal(experiment.voltages[result.retained.indexOf('0')],0);
    assert.equal(experiment.voltages.filter(v=>v===1).length,1);
    assert.equal(experiment.currents.length,result.retained.length);
    assert.deepEqual(result.retained,id==='res-bridge'?['a','0']:['a','b','0']);
  }
});

test('all six resistor methods have a selectable explicit preview and unavailable methods explain why',()=>{
  const parallel=createLab('res-series');
  importNative(parallel,JSON.stringify({circuit:{schemaVersion:1,nodes:['0','a'],components:[
    {id:'R1',type:'R',p:'a',n:'0',value:1000},{id:'R2',type:'R',p:'a',n:'0',value:2000}],
    observations:[{id:'Va',type:'voltage',p:'a',n:'0'}]},
    experiment:{schemaVersion:1,sources:[],initial:{kind:'equilibrium'}}}));
  const star=createLab('res-star');
  const delta=transformResistors(star.document,['a','b','0'],candidate(star,'star-delta').selection);
  assert.equal(delta.status,'ok');
  const inverse=createLab('res-star');importNative(inverse,delta.json);
  const cases=[['parallel',parallel],['series',createLab('res-series')],['star-delta',star],
    ['delta-star',inverse],['star-mesh',createLab('res-star')],['kron',createLab('res-bridge')]];
  for(const [operation,state] of cases){
    const view=uiFor(state),choice=candidate(state,operation);
    assert.ok(choice,operation);
    view.change('res-operation',operation);view.change('res-choice',choice.key);
    assert.equal(view.ui.latestJson,null,operation);
    view.click('#res-preview');
    assert.match(view.root.innerHTML,/Verified terminal-equivalent preview/,operation);
    assert.ok(view.ui.latestJson,operation);
  }
  const series=uiFor(createLab('res-series'));
  series.change('res-operation','delta-star');
  assert.match(series.root.innerHTML,/No three resistors form a triangle/);
  series.change('res-operation','series');
  series.click('[data-res-terminal-action]',{resTerminalAction:'add'});
  series.change('res-terminal-2','x',{resTerminal:'2'});
  assert.match(series.root.innerHTML,/retained as a terminal/);
});

test('every preset draws selectable current values; custom topology stays a table',()=>{
  const ids=['divider','rc','rc-high-pass','rc-loaded','rc-cascade','rl','rlc','vcvs','res-series','res-star','res-bridge','port-t','port-rc-section','port-rc-cascade'];
  for(const id of ids){
    const state=createLab(id),view=schematic(state);
    assert.equal(view.schematic,true,id);assert.doesNotMatch(view.html,/unknown-layout/,id);
    assert.match(view.html,/Topology table/,id);
    for(const component of state.document.circuit.components) assert.match(view.html,new RegExp(`data-schematic-component="${component.id}"`),`${id}:${component.id}`);
  }
  const state=createLab('res-star');
  updateDocument(state,d=>{d.circuit.components.find(c=>c.id==='Ra').value=7.25;});
  assert.match(schematic(state).html,/Ra · 7\.25 Ω/);
  updateDocument(state,d=>{d.circuit.components.push({id:'extra',type:'R',p:'a',n:'0',value:123});});
  assert.equal(schematic(state).schematic,false);
  assert.match(schematic(state).html,/unknown-layout/);
});

test('all fourteen guides have bilingual conditions and workspace-specific actions; four references are authored baselines',()=>{
  const ids=['divider','rc','rc-high-pass','rc-loaded','rc-cascade','rl','rlc','vcvs','res-series','res-star','res-bridge','port-t','port-rc-section','port-rc-cascade'];
  for(const id of ids){
    for(const lang of ['en','mn']){
      const guide=lessons[id][lang];
      assert.ok(guide.question&&guide.conditions&&guide.equation&&guide.compare);
      assert.ok(guide.steps.length>=2&&guide.steps.length<=3);
      assert.ok(guide.steps.every(s=>s.action&&s.text));
    }
  }
  assert.deepEqual(Object.keys(referenceResponses).sort(),['divider','rc','rc-high-pass','res-series'].sort());
  assert.deepEqual(referenceResponses.rc.numerator,[1]);
  assert.deepEqual(referenceResponses['rc-high-pass'].numerator,[0,.001]);
  assert.deepEqual(referenceResponses['res-series'].numerator,[3000]);
  assert.ok(Object.values(referenceResponses).every(r=>r.coefficientOrder==='constant-first'&&r.variable==='s'));
  const byId=(id,component)=>createLab(id).document.circuit.components.find(c=>c.id===component).value;
  assert.equal(byId('divider','R1'),1000);assert.equal(byId('divider','R2'),2000);
  assert.equal(byId('divider','R2')/(byId('divider','R1')+byId('divider','R2')),2/3);
  for(const id of ['rc','rc-high-pass']){
    assert.equal(byId(id,'R'),1000);assert.equal(byId(id,'C'),1e-6);
    assert.equal(byId(id,'R')*byId(id,'C'),.001);
  }
  assert.equal(byId('res-series','R1')+byId('res-series','R2'),3000);
  const divider=createLab('divider');
  assert.equal(referenceStatus(divider,'divider'),'baseline');
  updateDocument(divider,d=>{d.circuit.components.find(c=>c.id==='R1').value=1500;});
  assert.equal(referenceStatus(divider,'divider'),'edited');
  assert.equal(referenceStatus(divider,'res-star'),null);
  assert.equal(guideFor('unmatched-custom'),null);
});

test('guide transition focuses an existing panel, adds within limit, and replaces only an explicit slot',()=>{
  const state=createLab('divider'),workspace=createWorkspace(state);
  const native=exportNative(state);
  workspace.panels[0].collapsed=true;
  workspace.panels[1].load=375;
  assert.deepEqual(guideNavigation(workspace,state,'dc'),{kind:'focus',panelId:workspace.panels[0].id});
  assert.equal(workspace.panels[0].collapsed,false);
  assert.deepEqual(guideNavigation(workspace,state,'transform'),{kind:'transform'});
  assert.equal(workspace.panels[1].load,375);
  const added=guideNavigation(workspace,state,'frequency');
  assert.equal(added.kind,'focus');assert.equal(workspace.panels.length,3);
  const ids=workspace.panels.map(p=>p.id);
  assert.deepEqual(guideNavigation(workspace,state,'transient'),{kind:'replacement-required'});
  assert.deepEqual(workspace.panels.map(p=>p.id),ids);
  assert.deepEqual(guideNavigation(workspace,state,'transient','missing'),{kind:'invalid-replacement'});
  assert.deepEqual(guideNavigation(workspace,state,'transient',ids[2]),{kind:'focus',panelId:ids[2]});
  assert.deepEqual(workspace.panels.map(p=>p.type),['dc','port','transient']);
  assert.equal(workspace.panels[1].load,375);
  assert.equal(exportNative(state),native);
});
