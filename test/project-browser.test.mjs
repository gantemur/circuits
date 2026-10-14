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
  closest(selector){if(selector==='svg')return null;const map={'[data-w-add]':'wAdd','[data-w-action]':'wAction','[data-project-action]':'projectAction'};return this.dataset[map[selector]]?this:null;}
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
  setLanguage('en');const state=createLab(),root=new Root(),workspace=createWorkspace(state);let changes=0;const downloads=[];
  const ui=new WiringUI(root,()=>state,()=>{changes++;reconcilePanels(workspace,state);},()=>false,(name,text,type)=>downloads.push({name,text,type}));ui.render();
  const action=name=>root.dispatch('click',new Element({wAction:name}));
  const control=(name,value)=>root.dispatch('change',new HTMLSelectElement({wControl:name},value));
  const text=(name,value)=>root.dispatch('input',new HTMLInputElement({wControl:name},value));
  const property=(name,value)=>root.dispatch('input',new HTMLInputElement({wProp:`${ui.session.selection.key}:${name}`},value));
  const add=(type,id,value)=>{root.dispatch('click',new Element({wAdd:type}));property('id',id);if(value!==undefined)property(type==='V'||type==='I'?'dc':'value',String(value));action('save');return ui.session.selection.key;};
  const pin=(device,role)=>ui.session.draft.graph.devices.find(d=>d.key===device).terminals.find(t=>t.role===role).vertex;
  const wire=(a,b,name)=>{control('endpoint',a);control('target',b);control('survivor',name);action('connect');assert.equal(ui.session.gesture,null,JSON.stringify(ui.session.issue));};
  const rename=(vertex,name)=>{control('endpoint',vertex);text(`node-name-${vertex}`,name);action('rename');};
  const probe=(id,p,n)=>{text('probe-id',id);control('probe-type','voltage');control('probe-p',p);control('probe-n',n);action('add-probe');};
  return {state,root,workspace,ui,action,control,text,property,add,pin,wire,rename,probe,downloads,get changes(){return changes;}};
}
function dividerUI(){
  const h=uiHarness();h.action('new');const v=h.add('V','Vs',12),a=h.add('R','R1',1000),b=h.add('R','R2',2000),ground=h.ui.session.draft.graph.reference;
  h.rename(h.pin(v,'p'),'in');h.rename(h.pin(a,'n'),'out');
  h.wire(h.pin(v,'p'),h.pin(a,'p'),'in');h.wire(h.pin(v,'n'),ground,'0');h.wire(h.pin(a,'n'),h.pin(b,'p'),'out');h.wire(h.pin(b,'n'),ground,'0');
  h.probe('out',h.pin(a,'n'),ground);return {...h,v,a,b,ground};
}
import {envelope,dividerDrawing,rcDrawing,rlcDrawing,bridge} from './support/project-fixtures.mjs';
import {projectContentKey,serializeProject,exportProject} from '../dist/project-test.js';
const prepared=async name=>envelope(await fixture(name),({divider:dividerDrawing,rc:rcDrawing,rlc:rlcDrawing})[name]());
const file=p=>{const text=JSON.stringify(p);return {size:Buffer.byteLength(text),text:async()=>text};};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const projectAction=(h,name)=>h.root.dispatch('click',new Element({projectAction:name}));
async function open(h,p){await h.ui.project.read(file(p));h.ui.render();assert.ok(h.ui.project.candidate,h.ui.project.status);projectAction(h,'accept');assert.equal(h.ui.project.status,'opened');}

test('production Save exports unapplied science and actual geometry without touching Analyze',()=>{
  const h=dividerUI(),before=structuredClone(h.state),identity=h.state.document;
  h.action('rotate');h.property('x','430');h.action('save');
  projectAction(h,'save');assert.equal(h.downloads.length,1);assert.equal(h.downloads[0].name,'circuits-unfolded.cuf.json');
  const p=JSON.parse(h.downloads[0].text);assert.equal(p.drawing.placements.find(p=>p.component==='R2').x,430);
  assert.equal(p.drawing.placements.find(p=>p.component==='R2').turns,1);
  assert.deepEqual(h.state,before);assert.equal(h.state.document,identity);
  assert.equal(h.ui.project.savedState(),'unchanged');assert.equal(h.ui.project.scientificApplied(),false);
  h.action('apply');assert.equal(h.ui.project.scientificApplied(),true);assert.equal(h.ui.project.savedState(),'unchanged');
  const revision=h.state.revision;h.action('rotate');assert.equal(h.state.revision,revision);assert.equal(h.ui.project.savedState(),'changed');
});
test('all UI text and live gestures block save without deleting correction text',()=>{
  const h=uiHarness();h.control('device',h.ui.session.draft.graph.devices[0].key);h.action('select-device');
  for(const key of ['value','dc','initial','x','waveform']){
    h.property(key,'1e-');projectAction(h,'save');assert.equal(h.ui.project.status,'incomplete');assert.equal(h.downloads.length,0);h.action('restore-text');
  }
  for(const key of ['x','y','probe-id','probe-label','node-name-test','bends-test']){
    h.text(key,'bad');projectAction(h,'save');assert.equal(h.ui.project.status,'incomplete');assert.equal(h.downloads.length,0);h.action('restore-text');
  }
  h.control('initial','storage');projectAction(h,'save');assert.equal(h.ui.project.status,'incomplete');h.action('initial');
  h.action('move');projectAction(h,'save');assert.equal(h.ui.project.status,'incomplete');h.action('cancel');
  h.ui.session.begin(h.ui.session.draft.graph.reference);projectAction(h,'save');assert.equal(h.ui.project.status,'incomplete');h.action('cancel');
  projectAction(h,'save');assert.equal(h.downloads.length,1);
  h.text('x','1e-');assert.equal(h.ui.project.savedState(),'incomplete');h.action('restore-text');
  h.add('R','openR',1000);projectAction(h,'save');assert.match(h.root.innerHTML,/Complete each pending terminal/);assert.equal(h.downloads.length,1);
});
test('download initiation failure cannot advance the saved checkpoint',()=>{
  const h=uiHarness();assert.equal(h.ui.project.save(()=>{throw Error('blocked');}),false);
  assert.equal(h.ui.project.savedKey,null);assert.equal(h.ui.project.status,'download-failed');
});
for(const name of ['divider','rc','rlc'])test(`production open preserves authored ${name} geometry and applies only explicitly`,async()=>{
  const h=uiHarness(),p=await prepared(name),before=structuredClone(h.state),identity=h.state.document;
  await open(h,p);assert.deepEqual(h.state,before);assert.equal(h.state.document,identity);assert.equal(h.ui.session.draft.history.length,0);
  projectAction(h,'save');const saved=JSON.parse(h.downloads[0].text);
  assert.equal(ok(projectContentKey(saved)).key,ok(projectContentKey(p)).key);
  h.action('apply');assert.equal(h.ui.session.status,'applied');
  if(name==='divider')near(ok(solveDC(assemble(h.state.document.circuit),h.state.document.experiment)).observations.out.value.re,8);
  if(name==='rc'){const r=ok(transfer(assemble(h.state.document.circuit),'Vin','out',{re:0,im:1000}));near(r.transfer.value.re,.5);near(r.transfer.value.im,-.5);}
});
test('bridge and generated synthesis projects preserve exact content through controller',async()=>{
  const results=[synthesizeRc({quantity:'impedance',method:'cauer-infinity',referenceResistanceOhm:'1000',referenceAngularFrequencyPerSecond:'1000',numerator:['3','4','1'],denominator:['0','2','1']}),
    synthesizeRcFoster({quantity:'impedance',method:'foster-I',referenceResistanceOhm:'1000',referenceAngularFrequencyPerSecond:'1000',decomposition:{rInfinity:'1',kZero:'3/2',terms:[{pole:'2',residue:'1/2'}]}})];
  const projects=[bridge(),bridge(2000),...results.map(r=>{const g=importWiring(r.native.document).graph;g.placements.forEach((p,i)=>{p.x=100+i*130;p.turns=1;});return ok(exportProject(g)).project;})];
  for(const p of projects){const h=uiHarness();await open(h,p);projectAction(h,'save');assert.equal(ok(projectContentKey(JSON.parse(h.downloads[0].text))).key,ok(projectContentKey(p)).key);h.action('apply');
    if(p.document.circuit.components.some(c=>c.id==='Cross')){const r=ok(solveDC(assemble(h.state.document.circuit),h.state.document.experiment));near(r.observations.left.value.re,p.document.circuit.components.find(c=>c.id==='BR').value===2000?70/13:5);}}
});
for(const name of ['nonlinear/resistor-diode','bjt/common-emitter'])test(`open v1 independently while ${name} stays applied`,async()=>{
  const h=uiHarness();importNative(h.state,JSON.stringify(await fixture(name)));h.ui.render();assert.equal(h.ui.session.draft,null);
  const old=h.state.document;await open(h,await prepared('rc'));assert.equal(h.state.document,old);h.ui.render();assert.ok(h.ui.session.draft);
  h.action('apply');assert.equal(h.state.document.circuit.schemaVersion,1);
});
test('dirty consent cancellation and subsequent open preserve unrelated state',async()=>{
  const h=uiHarness();h.text('x','bad');h.state.extraFormDraft='retained';h.state.extraJsonDraft='{';const before=structuredClone(h.state),draft=h.ui.session.draft;
  await h.ui.project.read(file(await prepared('rc')));assert.equal(h.ui.project.replacementNeedsConsent,true);
  projectAction(h,'cancel');assert.equal(h.ui.session.draft,draft);assert.equal(h.ui.project.savedState(),'incomplete');assert.deepEqual(h.state,before);
  await open(h,await prepared('rc'));assert.deepEqual(h.state,before);assert.equal(h.ui.project.savedState(),'unchanged');
});
for(const mutation of ['science','graph','text'])test(`delayed read rejects intervening ${mutation}`,async()=>{
  const h=uiHarness(),d=deferred(),p=await prepared('rc');const reading=h.ui.project.read({size:100,text:()=>d.promise});
  if(mutation==='science')importNative(h.state,JSON.stringify(p.document));
  if(mutation==='graph')h.ui.session.execute({type:'rotate-device',device:h.ui.session.draft.graph.devices[0].key,quarterTurns:1});
  if(mutation==='text'){h.text('x','bad');h.text('x','');}
  const before=structuredClone(h.ui.session.draft);d.resolve(JSON.stringify(p));await reading;
  assert.equal(h.ui.project.status,'stale');assert.equal(h.ui.project.accept(),false);assert.deepEqual(h.ui.session.draft,before);
});
test('later selection owns the candidate even when an older read finishes last',async()=>{
  const h=uiHarness(),a=deferred(),p=await prepared('rc');const first=h.ui.project.read({size:10,text:()=>a.promise});
  await h.ui.project.read(file(await prepared('divider')));const candidate=h.ui.project.candidate;
  a.resolve(JSON.stringify(p));await first;assert.equal(h.ui.project.candidate,candidate);assert.equal(h.ui.project.accept(),true);
});
test('confirmation cannot survive text edit-and-restore or applied change-and-restore',async()=>{
  for(const kind of ['text','science','discard','new']){
    const h=uiHarness();await h.ui.project.read(file(await prepared('rc')));
    if(kind==='text'){h.text('x','bad');h.action('restore-text');}
    if(kind==='science'){const original=JSON.stringify(h.state.document);importNative(h.state,JSON.stringify((await prepared('rc')).document));importNative(h.state,original);}
    if(kind==='discard'||kind==='new')h.action(kind);
    assert.equal(h.ui.project.accept(),false);
  }
});
test('language rendering preserves a current candidate and translates retained errors',async()=>{
  const h=uiHarness();await h.ui.project.read(file(await prepared('rc')));
  setLanguage('mn');h.ui.render();assert.equal(h.ui.project.accept(),true);
  await h.ui.project.read({size:1,text:async()=>'{'});h.ui.render();assert.match(h.root.innerHTML,/Төсөл буруу/);
  setLanguage('en');h.ui.render();assert.match(h.root.innerHTML,/Invalid project/);
});
test('opened clean geometry is retained with a conflict after external scientific change',async()=>{
  const h=uiHarness();await open(h,await prepared('divider'));h.action('apply');const graph=structuredClone(h.ui.session.draft.graph);
  importNative(h.state,JSON.stringify((await prepared('rc')).document));h.ui.render();assert.deepEqual(h.ui.session.draft.graph,graph);
  h.action('apply');assert.equal(h.ui.session.issue.category,'conflict');
});
test('strict corruption and native-only fallback are pure until explicit replacement',async()=>{
  const changes=[p=>p.projectVersion=9,p=>p.document.circuit.components[1].value=-1,p=>p.drawing.edges[0].b='absent',p=>p.drawing.reference='hub1',p=>p.drawing.observations[0].p='hub0',p=>p.extra=true,p=>p.drawing.edges[0].bends=Array.from({length:65},()=>({x:0,y:0}))];
  for(const change of changes){const h=uiHarness(),p=await prepared('divider'),before=structuredClone(h.ui.session.draft);change(p);await h.ui.project.read(file(p));assert.equal(h.ui.project.candidate,null);assert.deepEqual(h.ui.session.draft,before);}
  const h=uiHarness(),p=await prepared('rc');p.drawing.edges[0].b='absent';const before=h.state.document;
  await h.ui.project.read(file(p));assert.equal(h.ui.project.status,'drawing-invalid');projectAction(h,'fallback');assert.ok(h.ui.project.candidate);projectAction(h,'accept');assert.equal(h.state.document,before);assert.equal(h.ui.project.status,'fallback-opened');assert.equal(h.ui.project.savedKey,null);
  let read=false;await h.ui.project.read({size:2097153,text:async()=>{read=true;return '{}';}});assert.equal(read,false);assert.equal(h.ui.project.status,'resource');
});
test('viewport changes update export content separately from scientific revision',()=>{
  const h=uiHarness();projectAction(h,'save');const rev=h.state.revision;h.action('zoom-in');assert.equal(h.ui.project.savedState(),'changed');assert.equal(h.state.revision,rev);
});
test('exact unusual IDs remain literal through production preview and saved project',async()=>{
  const h=uiHarness(),p=await prepared('divider'),id='<b>R</b> & "Q", Ө __proto__';
  const old=p.document.circuit.components[1].id;p.document.circuit.components[1].id=id;
  p.document.circuit.observations.filter(o=>o.component===old).forEach(o=>o.component=id);
  p.drawing.placements.filter(x=>x.component===old).forEach(x=>x.component=id);
  p.drawing.vertices.filter(x=>x.component===old).forEach(x=>x.component=id);
  await h.ui.project.read(file(p));h.ui.render();assert.ok(!h.root.innerHTML.includes('<b>R</b>'));assert.ok(h.root.innerHTML.includes('&lt;b&gt;R&lt;/b&gt;'));
  projectAction(h,'accept');projectAction(h,'save');assert.equal(JSON.parse(h.downloads[0].text).document.circuit.components[1].id,id);
});
test('bounded incomplete drawing inspection is nonfatal and translated in production preview',async()=>{
  const h=uiHarness(),p=await prepared('divider'),edge=p.drawing.edges[0];
  p.drawing.edges.unshift(...Array.from({length:160},(_,i)=>({id:`extra${i}`,a:edge.a,b:edge.b,bends:Array.from({length:64},(_,j)=>({x:j,y:i}))})));
  await h.ui.project.read(file(p));h.ui.render();assert.equal(h.ui.project.candidate.status,'ok');assert.match(h.root.innerHTML,/Visual-quality inspection was incomplete/);
  setLanguage('mn');h.ui.render();assert.match(h.root.innerHTML,/зургийн чанарын шалгалт дутуу/);projectAction(h,'accept');assert.equal(h.ui.project.status,'opened');
});
test('read failure, unsupported data and native/project format separation preserve drafts',async()=>{
  const h=uiHarness(),before=structuredClone(h.ui.session.draft);
  await h.ui.project.read({size:1,text:async()=>{throw Error('read failure');}});assert.equal(h.ui.project.status,'read-failed');
  await h.ui.project.read(file((await prepared('divider')).document));assert.equal(h.ui.project.status,'invalid');
  const p=await prepared('divider');p.document=await fixture('bjt/common-emitter');await h.ui.project.read(file(p));assert.equal(h.ui.project.status,'unsupported');assert.ok(h.ui.project.retainedNative.includes('schemaVersion'));
  assert.deepEqual(h.ui.session.draft,before);
});
