import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { WiringSession, WiringUI, renderWiringSvg, fitWiring, ambiguousWiring, setLanguage } from '../dist/wiring-ui-test.js';
import { importWiring,nativeCandidate,transact,wirePoints } from '../dist/wiring-test.js';
import { createLab,importNative,exportNative } from '../dist/lab-test.js';
import { createWorkspace,reconcilePanels } from '../dist/workspace-test.js';
import { assemble,solveDC,transfer,transient,synthesizeRc, synthesizeRcFoster } from '../dist/index.js';
const ok=r=>{assert.equal(r.status,'ok',JSON.stringify(r));return r;};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const fixture=async name=>JSON.parse(await readFile(new URL(`../fixtures/${name}.json`,import.meta.url),'utf8'));

class Element {
  constructor(dataset={},value=''){this.dataset=dataset;this.value=value;}
  closest(selector){if(selector==='svg')return null;const map={'[data-w-add]':'wAdd','[data-w-action]':'wAction'};return this.dataset[map[selector]]?this:null;}
}
globalThis.Element=Element;
globalThis.HTMLInputElement=class extends Element {};
globalThis.HTMLSelectElement=class extends Element {};
globalThis.HTMLTextAreaElement=class extends Element {};
globalThis.SVGElement=class extends Element {};
globalThis.document={activeElement:null,getElementById:()=>null};
class Root {
  listeners=new Map();innerHTML='';
  addEventListener(name,fn){this.listeners.set(name,fn);}
  contains(){return false;}
  querySelectorAll(){return [];}
  querySelector(selector){
    if(selector==='[data-w-pending]')return {textContent:''};
    if(selector==='#w-delete-probes')return {checked:this.deleteProbes??false};
    const key=selector.match(/data-w-control="([^"]+)"/)?.[1];if(!key)return null;
    const select=this.innerHTML.match(new RegExp(`<select[^>]*data-w-control="${key}"[^>]*>([\\s\\S]*?)</select>`));
    if(select){const o=[...select[1].matchAll(/<option value="([^"]*)"( selected)?/g)];return {value:(o.find(x=>x[2])??o[0])?.[1]??''};}
    const input=this.innerHTML.match(new RegExp(`data-w-control="${key}" value="([^"]*)"`));return {value:input?.[1]??''};
  }
  dispatch(type,target){this.listeners.get(type)({target});}
}
function uiHarness(){
  setLanguage('en');const state=createLab(),root=new Root(),workspace=createWorkspace(state);let changes=0;
  const ui=new WiringUI(root,()=>state,()=>{changes++;reconcilePanels(workspace,state);});ui.render();
  const action=name=>root.dispatch('click',new Element({wAction:name}));
  const control=(name,value)=>root.dispatch('change',new HTMLSelectElement({wControl:name},value));
  const text=(name,value)=>root.dispatch('input',new HTMLInputElement({wControl:name},value));
  const property=(name,value)=>root.dispatch('input',new HTMLInputElement({wProp:`${ui.session.selection.key}:${name}`},value));
  const add=(type,id,value)=>{root.dispatch('click',new Element({wAdd:type}));property('id',id);if(value!==undefined)property(type==='V'||type==='I'?'dc':'value',String(value));action('save');return ui.session.selection.key;};
  const pin=(device,role)=>ui.session.draft.graph.devices.find(d=>d.key===device).terminals.find(t=>t.role===role).vertex;
  const wire=(a,b,name)=>{control('endpoint',a);control('target',b);control('survivor',name);action('connect');assert.equal(ui.session.gesture,null,JSON.stringify(ui.session.issue));};
  const rename=(vertex,name)=>{control('endpoint',vertex);text(`node-name-${vertex}`,name);action('rename');};
  const probe=(id,p,n)=>{text('probe-id',id);control('probe-type','voltage');control('probe-p',p);control('probe-n',n);action('add-probe');};
  return {state,root,workspace,ui,action,control,text,property,add,pin,wire,rename,probe,get changes(){return changes;}};
}
function dividerUI(){
  const h=uiHarness();h.action('new');const v=h.add('V','Vs',12),a=h.add('R','R1',1000),b=h.add('R','R2',2000),ground=h.ui.session.draft.graph.reference;
  h.rename(h.pin(v,'p'),'in');h.rename(h.pin(a,'n'),'out');
  h.wire(h.pin(v,'p'),h.pin(a,'p'),'in');h.wire(h.pin(v,'n'),ground,'0');h.wire(h.pin(a,'n'),h.pin(b,'p'),'out');h.wire(h.pin(b,'n'),ground,'0');
  h.probe('out',h.pin(a,'n'),ground);return {...h,v,a,b,ground};
}
test('production Graphical handlers construct and apply divider, reconcile shared metadata once, and change reference',()=>{
  const h=dividerUI(),before=h.state.revision;h.action('apply');assert.equal(h.ui.session.status,'applied');assert.equal(h.state.revision,before+1);assert.equal(h.state.input,'Vs');assert.equal(h.state.output,'out');
  const d=h.state.document,result=ok(solveDC(assemble(d.circuit),d.experiment));near(result.observations.out.value.re,8);near(result.unknowns['I(Vs)'].value.re,-.004);
  const identity=h.state.document;h.action('apply');assert.equal(h.state.document,identity);assert.equal(h.state.revision,before+1);
  h.control('endpoint',h.pin(h.a,'n'));h.action('reference');h.action('apply');
  const shifted=ok(solveDC(assemble(h.state.document.circuit),h.state.document.experiment));near(shifted.unknowns['V(in)'].value.re,4);near(shifted.unknowns['V(out)'].value.re,-8);near(shifted.unknowns['I(Vs)'].value.re,-.004);
});
test('production handlers build RC, preserve source waveform and verify independent BE recurrence',()=>{
  const h=uiHarness();h.action('new');const v=h.add('V','Vs',1);h.property('re','1');h.property('waveform','step');h.property('at','0');h.property('before','0');h.property('after','1');h.action('save');
  const r=h.add('R','R',1000),c=h.add('C','C',1e-6),ground=h.ui.session.draft.graph.reference;
  h.rename(h.pin(v,'p'),'in');h.rename(h.pin(r,'n'),'out');h.wire(h.pin(v,'p'),h.pin(r,'p'),'in');h.wire(h.pin(v,'n'),ground,'0');h.wire(h.pin(r,'n'),h.pin(c,'p'),'out');h.wire(h.pin(c,'n'),ground,'0');h.probe('out',h.pin(c,'p'),ground);h.action('apply');
  const d=h.state.document,a=assemble(d.circuit),response=ok(transfer(a,'Vs','out',{re:0,im:1000}));near(response.transfer.value.re,.5);near(response.transfer.value.im,-.5);
  const run=ok(transient(a,d.experiment,{stop:.001,step:.0001}));let previous=0;for(const sample of run.samples.filter(s=>s.side==='regular')){previous=(previous+.1)/1.1;near(sample.observations.out.value.re,previous);}
});
test('production handlers construct balanced and unbalanced bridge with actual interconnections',()=>{
  const h=uiHarness();h.action('new');const v=h.add('V','Vs',10),tl=h.add('R','TL',1000),bl=h.add('R','BL',1000),tr=h.add('R','TR',1000),br=h.add('R','BR',1000),cross=h.add('R','Cross',1000),g=h.ui.session.draft.graph.reference;
  h.rename(h.pin(v,'p'),'top');h.rename(h.pin(tl,'n'),'left');h.rename(h.pin(tr,'n'),'right');
  for(const [a,b,n] of [[h.pin(v,'p'),h.pin(tl,'p'),'top'],[h.pin(v,'p'),h.pin(tr,'p'),'top'],[h.pin(v,'n'),g,'0'],[h.pin(tl,'n'),h.pin(bl,'p'),'left'],[h.pin(tl,'n'),h.pin(cross,'p'),'left'],[h.pin(tr,'n'),h.pin(br,'p'),'right'],[h.pin(tr,'n'),h.pin(cross,'n'),'right'],[h.pin(bl,'n'),g,'0'],[h.pin(br,'n'),g,'0']])h.wire(a,b,n);
  h.probe('left',h.pin(tl,'n'),g);h.probe('right',h.pin(tr,'n'),g);h.text('probe-id','cross');h.control('probe-type','current');h.control('probe-device',cross);h.action('add-probe');h.action('apply');
  let d=h.state.document,result=ok(solveDC(assemble(d.circuit),d.experiment));near(result.observations.left.value.re,5);near(result.observations.right.value.re,5);near(result.observations.cross.value.re,0);
  h.control('device',br);h.action('select-device');h.property('value','2000');h.action('save');h.action('apply');d=h.state.document;result=ok(solveDC(assemble(d.circuit),d.experiment));near(result.observations.left.value.re,70/13);near(result.observations.right.value.re,80/13);near(result.observations.cross.value.re,-1/1300);
});
test('subdivision, redundant wires and cycle removal are electrically neutral; merge and true split are scientific',()=>{
  let graph=importWiring(createLab().document).graph;const edge=graph.edges[0];
  let result=ok(transact(graph,{type:'split-wire',edge:edge.key,segment:0,fraction:.5}));assert.equal(result.scientific,false);assert.equal(result.geometry,true);graph=result.graph;
  result=ok(transact(graph,{type:'connect',a:edge.a,b:edge.b}));assert.equal(result.scientific,false);graph=result.graph;const redundant=result.created[0];
  result=ok(transact(graph,{type:'delete-wire',edge:redundant}));assert.equal(result.scientific,false);graph=result.graph;
  result=ok(transact(graph,{type:'delete-wire',edge:graph.edges.at(-1).key}));assert.equal(result.scientific,true);
  result=ok(transact(graph,{type:'connect',a:graph.reference,b:edge.a}));assert.equal(result.scientific,true);
  for(const operation of [{type:'move-device',device:graph.devices[0].key,point:{x:0,y:0}},{type:'rotate-device',device:graph.devices[0].key,quarterTurns:1},{type:'move-bends',edge:graph.edges[0].key,bends:[{x:10,y:20}]}])assert.equal(ok(transact(graph,operation)).scientific,false);
  assert.equal(ok(transact(graph,{type:'edit-value',device:graph.devices.find(d=>d.type==='R').key,value:'2000'})).scientific,true);
  assert.equal(ok(transact(graph,{type:'edit-source',device:graph.devices.find(d=>d.type==='V').key,source:{dc:'13'}})).scientific,true);
});
test('invalid and markup-like property drafts persist in EN/MN and cannot mutate the applied document',()=>{
  const h=uiHarness(),native=exportNative(h.state);h.control('device',h.ui.session.draft.graph.devices.find(d=>d.type==='R').key);h.action('select-device');
  h.property('value','1e-');h.action('apply');assert.equal(exportNative(h.state),native);setLanguage('mn');h.ui.render();assert.match(h.root.innerHTML,/1e-/);assert.match(h.root.innerHTML,/батлагдаагүй/);
  h.action('save');h.action('apply');assert.equal(exportNative(h.state),native);h.property('value','1000');h.property('id','<b>D</b> & "Q"');h.action('save');h.action('apply');assert.equal(h.state.document.circuit.components.find(d=>d.id.includes('<b>')).id,'<b>D</b> & "Q"');
  assert.match(h.root.innerHTML,/&lt;b&gt;D&lt;\/b&gt;/);assert.ok(!h.root.innerHTML.includes('<b>D</b>'));setLanguage('en');
});
test('unfinished wire cancellation creates no graph/history entry and exact endpoint routes follow rotation',()=>{
  const s=new WiringSession(()=>createLab());const before=structuredClone(s.draft.graph),count=s.draft.history.length;
  s.begin(before.vertices[0].key);s.gesture.bends.push({x:100,y:200});s.cancel();assert.deepEqual(s.draft.graph,before);assert.equal(s.draft.history.length,count);
  s.execute({type:'rotate-device',device:before.devices[0].key,quarterTurns:1});assert.equal(s.draft.scientificRevision,0);
  assert.notDeepEqual(wirePoints(s.draft.graph,before.edges[0].key),wirePoints(before,before.edges[0].key));
});
test('dirty geometry and property text conflict on external imports, with explicit discard and stale clean Apply guard',()=>{
  const state=createLab(),s=new WiringSession(()=>state);s.execute({type:'move-device',device:s.draft.graph.devices[0].key,point:{x:333,y:444}});const saved=structuredClone(s.draft.graph);
  importNative(state,exportNative(createLab('rc')));s.sync();assert.deepEqual(s.draft.graph,saved);assert.equal(s.apply(),false);assert.equal(s.issue.category,'conflict');s.reload();assert.deepEqual(ok(nativeCandidate(s.draft.graph)).document,state.document);
  const clean=new WiringSession(()=>state);importNative(state,exportNative(createLab()));assert.equal(clean.apply(),false);clean.sync();assert.equal(clean.apply(),true);
});
test('undo after Apply changes only graphical draft; invalid compound property edit has no partial effect',()=>{
  const h=uiHarness(),device=h.ui.session.draft.graph.devices[0].key;h.control('device',device);h.action('select-device');const before=structuredClone(h.ui.session.draft.graph);
  h.property('id','');h.property('dc','99');h.action('save');assert.deepEqual(h.ui.session.draft.graph,before);
  h.property('id','Vs');h.action('save');h.action('apply');const applied=h.state.document;h.action('undo');assert.equal(h.state.document,applied);assert.equal(h.ui.hasUnappliedDraft(),true);
});
for(const preset of ['vcvs','diode-single','bjt-ce'])test(`Graphical leaves ${preset} intact and unsupported`,()=>{
  const state=createLab(preset),before=exportNative(state),s=new WiringSession(()=>state);assert.equal(s.status,'unsupported');assert.equal(s.draft,null);assert.equal(exportNative(state),before);s.blank();assert.equal(s.status,'idle');assert.equal(exportNative(state),before);
});
test('graphical drawing escapes exact IDs, preserves terminals and warns about ambiguous routing',()=>{
  const doc=createLab().document;doc.circuit.components[0].id='__proto__ <b> & "Q"';doc.experiment.sources[0].id=doc.circuit.components[0].id;for(const o of doc.circuit.observations)if(o.type==='current'&&o.component==='Vin')o.component=doc.circuit.components[0].id;
  const graph=importWiring(doc).graph;for(const lang of ['en','mn']){setLanguage(lang);const svg=renderWiringSvg(graph,null,fitWiring(graph),null);assert.match(svg,/&lt;b&gt;/);assert.ok(!svg.includes('<b>'));assert.ok(!/NaN|Infinity/.test(svg));assert.equal((svg.match(/data-w-vertex=/g)??[]).length,graph.vertices.length);}
  assert.equal(ambiguousWiring(graph),true);setLanguage('en');
});
test('practical size bounds reject an operation without changing history or circuit',()=>{
  const state=createLab(),s=new WiringSession(()=>state);s.blank();for(let i=0;i<40;i++)assert.ok(s.execute({type:'add-device',deviceType:'R',id:`R${i}`,value:'1'}));
  const before=structuredClone(s.draft);assert.equal(s.execute({type:'add-device',deviceType:'R',id:'oversize',value:'1'}),null);assert.deepEqual(s.draft,before);
});
test('accepted Cauer and Foster generated documents open via the same Graphical native path',()=>{
  const scales={referenceResistanceOhm:'1000',referenceAngularFrequencyPerSecond:'1000'};
  for(const result of [synthesizeRc({...scales,quantity:'impedance',method:'cauer-infinity',numerator:['3','4','1'],denominator:['0','2','1']}),synthesizeRcFoster({...scales,quantity:'impedance',method:'foster-I',decomposition:{rInfinity:'1',kZero:'3/2',terms:[{pole:'2',residue:'1/2'}]}})]){
    const state=createLab();importNative(state,JSON.stringify(result.native.document));const s=new WiringSession(()=>state);assert.ok(s.draft);assert.deepEqual(ok(nativeCandidate(s.draft.graph)).document,result.native.document);
  }
});
test('strict optional AC/sinusoid/initial fields survive atomic property commits',async()=>{
  const h=uiHarness();h.action('new');const v=h.add('V','Vs',2);h.property('waveform','sinusoid');h.property('offset','2');h.property('amplitudePeak','3');h.property('frequencyHz','7');h.property('phaseRadians','-1');h.property('re','4');h.property('im','5');h.action('save');
  const source=h.ui.session.draft.graph.sources.find(s=>s.device===v);assert.deepEqual(source.waveform,{type:'sinusoid',offset:'2',amplitudePeak:'3',frequencyHz:'7',phaseRadians:'-1'});assert.deepEqual(source.ac,{re:'4',im:'5'});
  h.property('ac','no');h.property('waveform','none');h.action('save');assert.equal(h.ui.session.draft.graph.sources[0].ac,undefined);assert.equal(h.ui.session.draft.graph.sources[0].waveform,undefined);
  const c=h.add('C','C',1e-6);h.property('initial','0.2');h.action('save');assert.equal(h.ui.session.draft.graph.storage.find(s=>s.device===c).value,'0.2');
  assert.ok(await fixture('rc'));
});
test('pending net names stay with their endpoint, and explicit text restore recovers removed-handle drafts',()=>{
  const h=uiHarness(),vertices=h.ui.session.draft.graph.vertices;
  const a=vertices.find(v=>v.key!==h.ui.session.draft.graph.reference).key,b=vertices.at(-1).key;
  h.control('endpoint',a);h.text(`node-name-${a}`,'');h.action('rename');
  h.control('endpoint',b);h.ui.render();assert.doesNotMatch(h.root.innerHTML,new RegExp(`data-w-control="node-name-${b}" value=""`));
  h.control('endpoint',a);setLanguage('mn');h.ui.render();assert.match(h.root.innerHTML,new RegExp(`data-w-control="node-name-${a}" value=""`));
  h.action('apply');assert.notEqual(h.ui.session.status,'applied');h.action('restore-text');h.action('apply');assert.equal(h.ui.session.status,'applied');setLanguage('en');
});
test('drawing guard detects shared-endpoint overlap and hidden unrelated vertices without changing topology',()=>{
  const s=new WiringSession(()=>createLab());s.blank();
  const add=(x,y)=>s.execute({type:'add-vertex',kind:'junction',point:{x,y}})[0];
  const a=add(100,100),b=add(300,100),c=add(200,100);
  s.execute({type:'connect',a,b,survivingName:'n1'});
  s.execute({type:'connect',a,b:c,survivingName:'n1'});
  const before=structuredClone(s.draft.graph);
  assert.equal(ambiguousWiring(s.draft.graph),true);assert.deepEqual(s.draft.graph,before);
  const isolated=new WiringSession(()=>createLab());isolated.blank();
  isolated.execute({type:'add-device',deviceType:'R',id:'R',value:'1000',point:{x:0,y:100}});
  assert.equal(ambiguousWiring(isolated.draft.graph),true); // reference hidden under the symbol
});
test('geometry-only production Apply retains numerical ownership and does not notify document-change consumers',()=>{
  const h=uiHarness(),doc=h.state.document,revision=h.state.revision;
  h.control('device',h.ui.session.draft.graph.devices[0].key);h.action('select-device');h.action('rotate');h.action('apply');
  assert.equal(h.changes,0);assert.equal(h.state.document,doc);assert.equal(h.state.revision,revision);assert.equal(h.ui.hasUnappliedDraft(),false);
});

test('production selectors invalidate removed wires explicitly, then use the selected replacement',()=>{
  const h=uiHarness(),edge=h.ui.session.draft.graph.edges[0].key;
  h.control('wire',edge);h.action('split');
  assert.equal(h.root.querySelector('[data-w-control="wire"]').value,'');
  const before=structuredClone(h.ui.session.draft.graph);h.action('delete-wire');assert.deepEqual(h.ui.session.draft.graph,before);
  const replacement=before.edges.at(-1).key;h.control('wire',replacement);h.action('delete-wire');
  assert.ok(!h.ui.session.draft.graph.edges.some(e=>e.key===replacement));
  assert.equal(h.root.querySelector('[data-w-control="wire"]').value,'');
});
test('device deletion, copy and undo/redo keep displayed choices and active devices coherent',()=>{
  const h=uiHarness(),devices=h.ui.session.draft.graph.devices,r=devices.at(-1).key;
  h.control('device',r);h.action('delete-device');assert.equal(h.root.querySelector('[data-w-control="device"]').value,'');
  h.control('device',devices[0].key);h.action('select-device');assert.equal(h.ui.session.selection.key,devices[0].key);
  h.action('copy');const copy=h.ui.session.selection.key;
  assert.equal(h.root.querySelector('[data-w-control="device"]').value,copy);
  h.action('undo');assert.equal(h.root.querySelector('[data-w-control="device"]').value,'');h.action('redo');
  assert.equal(h.root.querySelector('[data-w-control="device"]').value,'');h.control('device',copy);h.action('select-device');assert.equal(h.ui.session.selection.key,copy);
});
test('displayed select wins over a still-valid cached choice; unrelated pending text survives reconciliation',()=>{
  const h=uiHarness(),[first,second]=h.ui.session.draft.graph.devices;
  h.control('device',first.key);h.action('select-device');h.property('dc','bad');
  h.text('probe-id','pending observation');h.text(`node-name-${h.ui.session.draft.graph.reference}`,'pending name');
  const query=h.root.querySelector.bind(h.root);
  h.root.querySelector=selector=>selector==='[data-w-control="device"]'?new HTMLSelectElement({},second.key):query(selector);
  h.action('select-device');assert.equal(h.ui.session.selection.key,second.key);
  assert.equal(h.ui.session.pending.get(first.key+':dc'),'bad');
  assert.match(h.root.innerHTML,/pending observation/);assert.match(h.root.innerHTML,/pending name/);
});
test('rename and merge clear obsolete survivor names without choosing another net',()=>{
  const h=uiHarness(),graph=h.ui.session.draft.graph,inVertex=graph.names.find(n=>n.name==='in').vertex;
  h.control('survivor','in');h.rename(inVertex,'renamed');
  assert.equal(h.root.querySelector('[data-w-control="survivor"]').value,'');
  h.control('survivor','renamed');h.control('endpoint',inVertex);h.control('target',graph.reference);h.action('connect');
  assert.equal(h.root.querySelector('[data-w-control="survivor"]').value,'');
});
test('pending gestures survive unrelated rendering/history but cannot finish from removed or deleted terminals',()=>{
  const h=uiHarness(),graph=h.ui.session.draft.graph,start=graph.vertices[0].key;
  h.control('endpoint',start);h.action('start');h.ui.render();assert.equal(h.ui.session.gesture.start,start);
  h.control('device',graph.devices[0].key);h.action('rotate');h.action('undo');assert.equal(h.ui.session.gesture.start,start);
  h.action('cancel');h.action('new');h.add('R','R',1000);h.action('undo'); // undo property batch
  const device=h.ui.session.draft.graph.devices[0];h.control('endpoint',device.terminals[0].vertex);h.action('start');h.action('undo');
  assert.equal(h.ui.session.gesture,null);h.action('redo');h.control('device',device.key);h.action('select-device');
  h.control('endpoint',device.terminals[0].vertex);h.action('start');h.action('delete-device');assert.equal(h.ui.session.gesture,null);
  h.control('endpoint','missing');h.action('start');assert.equal(h.ui.session.gesture,null);
});
test('production focus restoration preserves text ranges and never selects checkbox text',()=>{
  const h=uiHarness();h.control('device',h.ui.session.draft.graph.devices[0].key);h.action('select-device');
  const oldDocument=globalThis.document;
  try {
    for(const type of ['checkbox','text','textarea','select']){
      const input=type==='textarea'?new HTMLTextAreaElement():type==='select'?new HTMLSelectElement():new HTMLInputElement();
      input.type=type;input.id=type==='checkbox'?'w-delete-probes':'focus-test';input.selectionStart=1;input.selectionEnd=3;
      let focus=0,ranges=0;input.focus=()=>focus++;input.setSelectionRange=(a,b)=>{assert.ok(type==='text'||type==='textarea');assert.equal(a,1);assert.equal(b,3);ranges++;};
      h.root.contains=()=>true;globalThis.document={activeElement:input,getElementById:id=>id===input.id?input:null};
      h.root.listeners.get('keydown')({key:'Escape',target:input});setLanguage('mn');h.ui.render();h.action('validate');h.action('undo');h.action('redo');
      assert.equal(focus,5);assert.equal(ranges,type==='text'||type==='textarea'?5:0);setLanguage('en');
    }
  }finally{globalThis.document=oldDocument;setLanguage('en');}
});
test('shared ownership blocks change-and-restore and pending inspector text, clean sync is coherent',()=>{
  const h=uiHarness(),original=exportNative(h.state);h.control('device',h.ui.session.draft.graph.devices[0].key);h.action('rotate');
  importNative(h.state,exportNative(createLab('rc')));importNative(h.state,original);h.action('apply');assert.equal(h.ui.session.issue.category,'conflict');
  h.action('discard');importNative(h.state,exportNative(createLab('rc')));h.ui.render();assert.deepEqual(ok(nativeCandidate(h.ui.session.draft.graph)).document,h.state.document);
  const root=new Root(),ui=new WiringUI(root,()=>h.state,()=>assert.fail('unsafe import'),()=>true);ui.render();
  root.dispatch('click',new Element({wAction:'apply'}));assert.equal(ui.session.issue.code,'inspector-pending');
});

test('history redo retires terminal gesture when deletion restores a free anchor (production handlers)',()=>{
  const h=uiHarness();h.action('new');const device=h.add('R','R',1000),pin=h.pin(device,'p');
  h.action('delete-device');const deleted=structuredClone(h.ui.session.draft.graph);
  h.action('undo');h.control('endpoint',pin);h.action('start');assert.equal(h.ui.session.gesture.start,pin);
  h.text('probe-id','unfinished probe');h.ui.session.pending.set('unrelated:value','1e-');
  const state=structuredClone(h.state),document=h.state.document,workspace=structuredClone(h.workspace);
  const entry=structuredClone(h.ui.session.draft.redo.at(-1));
  h.action('redo');assert.equal(h.ui.session.gesture,null);
  assert.deepEqual(h.ui.session.draft.graph,deleted);assert.deepEqual(h.ui.session.draft.history.at(-1),entry);
  assert.equal(h.ui.session.finish(deleted.reference),false);assert.deepEqual(h.ui.session.draft.graph,deleted);
  assert.equal(h.state.document,document);assert.deepEqual(h.state,state);assert.deepEqual(h.workspace,workspace);
  assert.equal(h.ui.session.pending.get('unrelated:value'),'1e-');assert.match(h.root.innerHTML,/unfinished probe/);
});
test('history undo retires a free-anchor gesture when its resistor terminal is restored',()=>{
  const state=createLab(),s=new WiringSession(()=>state);s.blank();
  const device=s.execute({type:'add-device',deviceType:'R',id:'R',value:'1000'})[0];
  const pin=s.draft.graph.devices[0].terminals[0].vertex;
  assert.ok(s.execute({type:'connect',a:pin,b:s.draft.graph.reference,survivingName:'0'}));
  const connected=structuredClone(s.draft.graph),native=nativeCandidate(connected),applied=state.document,revision=state.revision;
  s.execute({type:'delete-device',device});s.begin(pin);assert.equal(s.gesture.start,pin);
  s.history(false);assert.equal(s.gesture,null);assert.deepEqual(s.draft.graph,connected);
  assert.deepEqual(nativeCandidate(s.draft.graph),native);assert.equal(state.document,applied);assert.equal(state.revision,revision);
});
test('history preserves unchanged terminal gesture through unrelated rotation undo and redo',()=>{
  const s=new WiringSession(()=>createLab());s.blank();
  s.execute({type:'add-device',deviceType:'R',id:'R1',value:'1000'});
  const pin=s.draft.graph.devices[0].terminals[0].vertex;
  const other=s.execute({type:'add-device',deviceType:'R',id:'R2',value:'2000'})[0];
  s.execute({type:'rotate-device',device:other,quarterTurns:1});
  const scientific=s.draft.scientificRevision,history=structuredClone(s.draft.history);
  s.begin(pin);s.history(false);assert.equal(s.gesture.start,pin);
  s.history(true);assert.equal(s.gesture.start,pin);assert.deepEqual(s.draft.history,history);
  assert.equal(s.draft.scientificRevision,scientific);
  assert.equal(s.finish(s.draft.graph.reference,'0'),true);assert.equal(s.draft.graph.edges.length,1);
});
test('undoing device creation retires its removed starting terminal without a connection',()=>{
  const s=new WiringSession(()=>createLab());s.blank();const blank=structuredClone(s.draft.graph);
  s.execute({type:'add-device',deviceType:'R',id:'R',value:'1000'});
  s.begin(s.draft.graph.devices[0].terminals[0].vertex);s.history(false);
  assert.equal(s.gesture,null);assert.equal(s.finish(blank.reference),false);assert.deepEqual(s.draft.graph,blank);
});
