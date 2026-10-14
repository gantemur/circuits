import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { WiringSession, WiringUI, renderWiringSvg, fitWiring, ambiguousWiring, setLanguage } from '../dist/wiring-ui-test.js';
import { importWiring,nativeCandidate,transact,wirePoints } from '../dist/wiring-test.js';
import { createLab,importNative,exportNative } from '../dist/lab-test.js';
import { createWorkspace,reconcilePanels } from '../dist/workspace-test.js';
import { assemble,solveDC,transfer,transient,analyzePorts,synthesizeRc, synthesizeRcFoster } from '../dist/index.js';
const ok=r=>{assert.equal(r.status,'ok',JSON.stringify(r));return r;};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const fixture=async name=>JSON.parse(await readFile(new URL(`../fixtures/${name}.json`,import.meta.url),'utf8'));

class Element {
  constructor(dataset={},value=''){this.dataset=dataset;this.value=value;}
  closest(selector){if(selector==='svg')return null;const map={'[data-w-add]':'wAdd','[data-w-action]':'wAction','[data-project-action]':'projectAction','[data-layout-action]':'layoutAction'};return this.dataset[map[selector]]?this:null;}
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
function uiHarness(document,port){
  setLanguage('en');const state=createLab(),root=new Root(),workspace=createWorkspace(state);let changes=0;const downloads=[];
  if(document)assert.equal(importNative(state,JSON.stringify(document)).ok,true);
  if(port)rememberLayoutPort(state,...port);
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
  const layout=name=>root.dispatch('click',new Element({layoutAction:name}));
  const portChoice=(role,value)=>root.dispatch('change',new HTMLSelectElement({layoutPort:role},value));
  return {state,root,workspace,ui,layout,portChoice,action,control,text,property,add,pin,wire,rename,probe,downloads,get changes(){return changes;}};
}

import {rememberLayoutPort,acceptedLayoutPort} from '../dist/wiring-ui-test.js';
import {generateTopologyLayout,documentMeaning} from '../dist/layout-test.js';
import {parseProject,exportProject,projectContentKey} from '../dist/project-test.js';
import {examples,parallel} from './support/layout-fixtures.mjs';
const content=g=>ok(projectContentKey(ok(exportProject(g)).project)).key;
for(const e of examples())test(`browser initialization: ${e.name}`,()=>{
 const h=uiHarness(e.document,e.options.port),s=h.ui.session;
 assert.equal(h.ui.layout.initialStatus,'verified');assert.equal(h.ui.layout.family,e.family);
 assert.deepEqual(s.draft.graph,generateTopologyLayout(e.document,e.options).graph);
 assert.equal(s.draft.scientificRevision,0);assert.equal(s.draft.geometryRevision,0);assert.equal(s.draft.history.length,0);
 assert.equal(h.ui.project.savedState(),'never');assert.equal(s.hasDrafts(),false);assert.equal(h.changes,0);
 assert.deepEqual(nativeCandidate(s.draft.graph).document,e.document);
});
test('source-free explicit port controls never guess names, reject duplicates and obsolete choices',()=>{
 const h=uiHarness(parallel());assert.equal(h.ui.layout.initialStatus,'port-required');
 const original=JSON.stringify(h.ui.session.draft.graph);h.layout('suggest');assert.equal(h.ui.layout.status,'port-required');
 h.portChoice('p','port');h.portChoice('q','port');h.layout('suggest');assert.equal(h.ui.layout.status,'invalid-port');
 h.portChoice('q','0');h.layout('suggest');assert.ok(h.ui.layout.proposal);assert.equal(JSON.stringify(h.ui.session.draft.graph),original);
 h.portChoice('q','missing');assert.equal(h.ui.layout.status,'stale');h.layout('use');assert.equal(JSON.stringify(h.ui.session.draft.graph),original);
});
test('explicit accepted port is scoped to document identity, revision and exact data',()=>{
 const h=uiHarness(parallel(),['port','0']);assert.deepEqual(acceptedLayoutPort(h.state),['port','0']);
 h.state.revision++;assert.equal(acceptedLayoutPort(h.state),undefined);
});
test('layout preview/cancel/adopt and exact undo/redo preserve applied ownership and normal edits',()=>{
 const h=uiHarness(),s=h.ui.session,d=s.draft,state=h.state,document=state.document,revision=state.revision;
 const key=d.graph.devices[1].key;assert.ok(s.execute({type:'move-device',device:key,point:{x:222,y:123}}));
 h.ui.render();const before=structuredClone(d.graph),scientific=d.scientificRevision,count=d.history.length;
 h.layout('suggest');assert.ok(h.ui.layout.proposal);h.layout('cancel');assert.deepEqual(d.graph,before);
 h.layout('suggest');const proposed=structuredClone(h.ui.layout.proposal.graph);h.layout('use');assert.deepEqual(d.graph,proposed);
 assert.equal(d.history.length,count+1);assert.equal(d.scientificRevision,scientific);assert.equal(state.document,document);assert.equal(state.revision,revision);assert.equal(h.changes,0);
 h.action('undo');assert.deepEqual(d.graph,before);h.action('redo');assert.deepEqual(d.graph,proposed);
 const device=d.graph.devices[1].key;s.execute({type:'rotate-device',device,quarterTurns:1});h.action('undo');assert.deepEqual(d.graph,proposed);
 h.action('undo');assert.deepEqual(d.graph,before);s.execute({type:'add-device',deviceType:'R',id:'new',value:'1'});assert.equal(d.redo.length,0);
 assert.equal(new Set([...d.graph.devices,...d.graph.vertices,...d.graph.edges].map(x=>x.key)).size,d.graph.devices.length+d.graph.vertices.length+d.graph.edges.length);
});
test('saved project geometry stays exact; adoption and history restore saved content including viewport absence',async()=>{
 const h=uiHarness(),g=importWiring(await fixture('rc')).graph;
 for(const viewport of [undefined,{x:-33,y:-77,width:999,height:444}]){
  const p=ok(exportProject(g,viewport));await h.ui.project.read({size:1000,text:async()=>JSON.stringify(p.project)});assert.ok(h.ui.project.accept());h.ui.render();
  assert.equal(content(h.ui.session.draft.graph),content(g));assert.equal(h.ui.project.savedState(),'unchanged');
  h.layout('suggest');h.layout('use');assert.equal(h.ui.project.savedState(),'changed');
  h.action('undo');assert.equal(h.ui.project.savedState(),'unchanged');h.action('redo');assert.equal(h.ui.project.savedState(),'changed');
  assert.equal(h.ui.project.save((name,text)=>{const reopened=ok(parseProject(text));assert.equal(content(reopened.graph),content(h.ui.session.draft.graph));}),true);
 }
});
test('pending edits and unfinished gestures block suggestion without discarding correction text',()=>{
 for(const kind of ['property','coordinate','wire','move']){
  const h=uiHarness(),s=h.ui.session,before=structuredClone(s.draft.graph);
  if(kind==='property'){h.control('device',s.draft.graph.devices[1].key);h.action('select-device');h.property('value','invalid');}
  if(kind==='coordinate')h.text('x','not a number');if(kind==='wire')s.begin(s.draft.graph.vertices[0].key);if(kind==='move')s.moving=true;
  h.layout('suggest');assert.equal(h.ui.layout.status,'incomplete');h.layout('cancel');assert.deepEqual(s.draft.graph,before);
  assert.ok(s.pending.size||s.gesture||s.moving||h.ui.pendingTools.size);
 }
});
test('edit-and-restore and applied change-and-restore cannot revive layout authorization',()=>{
 for(const kind of ['text','science','geometry','port']){
  const h=uiHarness(),s=h.ui.session;h.layout('suggest');assert.ok(h.ui.layout.proposal);const graph=structuredClone(s.draft.graph);
  if(kind==='text'){h.text('x','123');h.text('x','');h.action('restore-text');}
  if(kind==='science'){const value=h.state.document.circuit.components[1].value;h.state.document.circuit.components[1].value=value*2;h.state.revision++;h.state.document.circuit.components[1].value=value;h.state.revision++;}
  if(kind==='geometry'){const p=s.draft.graph.placements[1];s.execute({type:'move-device',device:p.key,point:{x:11,y:22}});s.history(false);}
  if(kind==='port'){h.ui.layout.setPort(0,'0');h.ui.layout.setPort(0,'');}
  h.layout('use');assert.equal(h.ui.layout.status,'stale');assert.deepEqual(s.draft.graph,graph);
 }
});
test('harmless rerender and both language directions retain proposal ownership',()=>{
 const h=uiHarness();h.layout('suggest');const proposal=h.ui.layout.proposal;
 for(const lang of ['mn','en']){setLanguage(lang);h.ui.render();assert.equal(h.ui.layout.proposal,proposal);}
 h.layout('use');assert.equal(h.ui.layout.status,'adopted');
});
test('clean external native updates generate layouts; dirty drafts retain conflict and geometry',async()=>{
 const h=uiHarness();assert.equal(importNative(h.state,JSON.stringify(await fixture('rc'))).ok,true);h.ui.render();assert.equal(h.ui.layout.initialStatus,'verified');
 const g=h.ui.session.draft.graph;h.ui.session.execute({type:'move-device',device:g.devices[0].key,point:{x:77,y:88}});
 const before=structuredClone(h.ui.session.draft.graph);assert.equal(importNative(h.state,JSON.stringify(await fixture('divider'))).ok,true);h.ui.render();
 assert.deepEqual(h.ui.session.draft.graph,before);assert.equal(h.ui.session.apply(),false);
});
test('a custom graphical Apply never regenerates or clears its completed drawing',()=>{
 const h=uiHarness(),s=h.ui.session;const key=s.draft.graph.devices[1].key;
 s.execute({type:'move-device',device:key,point:{x:33,y:44}});s.execute({type:'edit-value',device:key,value:'2000'});
 const before=structuredClone(s.draft.graph);h.action('apply');assert.deepEqual(s.draft.graph,before);h.ui.render();assert.deepEqual(s.draft.graph,before);
});
test('layout adoption retires project consent; project install retires layout consent',async()=>{
 const h=uiHarness(),p=ok(exportProject(importWiring(await fixture('rc')).graph));
 h.layout('suggest');await h.ui.project.read({size:1000,text:async()=>JSON.stringify(p.project)});h.layout('use');assert.equal(h.ui.project.accept(),false);assert.equal(h.ui.project.status,'stale');
 h.layout('suggest');await h.ui.project.read({size:1000,text:async()=>JSON.stringify(p.project)});assert.equal(h.ui.project.accept(),true);h.layout('use');assert.equal(h.ui.layout.status,'stale');
});
test('tampered proposal cannot bypass native or geometric equality',()=>{
 for(const corrupt of [g=>g.devices[1].value='1',g=>Object.assign(g.placements[1],g.placements[2])]){
  const h=uiHarness();h.layout('suggest');const before=structuredClone(h.ui.session.draft.graph);corrupt(h.ui.layout.proposal.graph);h.layout('use');
  assert.ok(['invalid','quality-rejected'].includes(h.ui.layout.status));assert.deepEqual(h.ui.session.draft.graph,before);
 }
});
test('production fallback states preserve native data and unsupported documents',async()=>{
 for(const name of ['cccs','nonlinear/resistor-diode','bjt/common-emitter']){
  const d=await fixture(name),h=uiHarness(d);assert.equal(h.ui.session.status,'unsupported');assert.equal(h.ui.session.draft,null);assert.deepEqual(h.state.document,d);
 }
 for(const edit of [d=>d.circuit.components.push({id:'extra',type:'V',p:'in',n:'0'}),
   d=>{d.circuit.components[0].type='I';},
   d=>d.circuit.components.push({id:'loop',type:'R',p:'out',n:'out',value:1}),
   d=>{for(let i=0;i<17;i++)d.circuit.components.push({id:`big${i}`,type:'R',p:'in',n:'out',value:1});}]){
  const d=await fixture('divider');edit(d);if(d.circuit.components.at(-1).id==='extra')d.experiment.sources.push({id:'extra',dc:12});
  const h=uiHarness(d);assert.equal(h.ui.layout.initialStatus,'unrecognized');assert.deepEqual(nativeCandidate(h.ui.session.draft.graph).document,d);assert.deepEqual(h.state.document,d);
 }
 const d=await fixture('divider');d.circuit.nodes.push('unused');assert.equal(uiHarness(d).ui.layout.initialStatus,'verified');
});
test('source-free handoff late arrival can be explicitly selected without changing science',()=>{
 const h=uiHarness(parallel());const before=exportNative(h.state);h.portChoice('p','port');h.portChoice('q','0');h.layout('suggest');h.layout('use');
 assert.equal(exportNative(h.state),before);assert.equal(h.changes,0);assert.equal(h.ui.project.savedState(),'never');
});
test('independent scientific values survive adoption, history and actual project parser',()=>{
 for(const e of examples()){
  const h=uiHarness(e.document,e.options.port),g=h.ui.session.draft.graph;
  h.ui.session.execute({type:'move-device',device:g.devices[0].key,point:{x:72,y:99}});h.ui.render();h.layout('suggest');h.layout('use');
  for(const action of [null,'undo','redo']){
   if(action)h.action(action);
   const d=ok(parseProject(JSON.stringify(ok(exportProject(h.ui.session.draft.graph)).project))).project.document;
   assert.deepEqual(d,e.document);
   if(e.name==='divider'){const r=ok(solveDC(assemble(d.circuit),d.experiment));near(r.observations.out.value.re,8);near(r.observations.r1i.value.re,.004);near(r.observations.source.value.re,-.004);}
   if(e.name==='rc-low'||e.name==='rlc'){const z=ok(transfer(assemble(d.circuit),'Vin','out',{re:0,im:e.name==='rlc'?10000:1000})).transfer.value;near(z.re,e.name==='rlc'?0:.5);near(z.im,e.name==='rlc'?-10:-.5);}
   if(e.name.startsWith('bridge')){const r=ok(solveDC(assemble(d.circuit),d.experiment)),balanced=e.name==='bridge-balanced';near(r.observations.left.value.re,balanced?5:70/13);near(r.observations.right.value.re,balanced?5:80/13);near(r.observations.cross.value.re,balanced?0:-1/1300);}
   if(['cauer','foster-I','foster-II'].includes(e.name)){const r=ok(analyzePorts(d,{ports:[{p:'port',q:'0'}],frequencyHz:1000/(2*Math.PI)}));near(ok(r.z).values[0][0].re,1200);near(ok(r.z).values[0][0].im,-1600);}
  }
 }
});
test('browser quality rejection keeps the complete provisional draft and scientific document',async()=>{
 const document=await fixture('divider');
 document.circuit.components=document.circuit.components.filter(c=>c.id!=='R1');
 let previous='in';
 for(let index=0;index<12;index++){
  const next=index===11?'out':`chain${index}`;
  if(index!==11)document.circuit.nodes.push(next);
  document.circuit.components.push({id:index===0?'R1':`long${index}`,type:'R',p:previous,n:next,value:1000});
  previous=next;
 }
 const h=uiHarness(document),draft=h.ui.session.draft;
 assert.equal(h.ui.layout.initialStatus,'quality-rejected');
 assert.deepEqual(draft.graph,importWiring(document).graph);
 const before=structuredClone(draft.graph),applied=h.state.document;
 h.layout('suggest');assert.equal(h.ui.layout.status,'quality-rejected');assert.equal(h.ui.layout.proposal,null);
 h.layout('use');assert.deepEqual(draft.graph,before);assert.equal(h.state.document,applied);
 assert.deepEqual(nativeCandidate(draft.graph).document,document);
});
test('layout selectors preserve exact punctuation and markup-like native IDs',()=>{
 const document=parallel(),id='__proto__, <em>p</em> & "Q"';
 document.circuit.nodes=document.circuit.nodes.map(n=>n==='port'?id:n);
 for(const component of document.circuit.components){
  if(component.p==='port')component.p=id;
  if(component.n==='port')component.n=id;
 }
 document.circuit.observations[0].p=id;
 const h=uiHarness(document);
 assert.ok(h.root.innerHTML.includes('__proto__, &lt;em&gt;p&lt;/em&gt; &amp; &quot;Q&quot;'));
 assert.ok(!h.root.innerHTML.includes('<em>p</em>'));
 h.portChoice('p',id);h.portChoice('q','0');h.layout('suggest');
 assert.ok(h.ui.layout.proposal);h.layout('use');
 assert.deepEqual(nativeCandidate(h.ui.session.draft.graph).document,document);
});
test('identical repeated layout adoption owns a separate viewport history step',()=>{
 const h=uiHarness(),draft=h.ui.session.draft;
 const graph=structuredClone(draft.graph);
 h.layout('suggest');h.layout('use');assert.equal(draft.history.length,1);
 const firstView={...h.ui.view};
 h.action('right');const shifted={...h.ui.view};assert.notDeepEqual(shifted,firstView);
 h.ui.project.save(()=>{});assert.equal(h.ui.project.savedState(),'unchanged');
 h.layout('suggest');h.layout('use');assert.equal(draft.history.length,2);
 assert.deepEqual(draft.graph,graph);assert.deepEqual(h.ui.view,firstView);
 h.action('undo');assert.deepEqual(h.ui.view,shifted);assert.equal(h.ui.project.savedState(),'unchanged');
 h.action('undo');assert.deepEqual(h.ui.view,firstView);
 h.action('redo');h.action('redo');assert.deepEqual(h.ui.view,firstView);
 assert.deepEqual(draft.graph,graph);assert.equal(draft.scientificRevision,0);
});
