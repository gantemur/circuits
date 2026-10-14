import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as W from '../dist/wiring-test.js';
import { parseDocument, assemble, solveDC, transfer, transient, synthesizeRc, synthesizeRcFoster } from '../dist/index.js';
const fixture = async name => JSON.parse(await readFile(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'));
const near = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a-b) <= tolerance*Math.max(1,Math.abs(b)), `${a} != ${b}`);
const candidate = graph => { const result = W.nativeCandidate(graph); assert.equal(result.status, 'ok', JSON.stringify(result)); return result.document; };
const imported = document => { const result = W.importWiring(document); assert.equal(result.status, 'editable'); return result.graph; };
const ok = result => { assert.equal(result.status, 'ok', JSON.stringify(result)); return result; };
function editor(initial = 'equilibrium') {
  let graph = W.emptyWiring(initial);
  return {
    get graph() { return graph; },
    run(operation) { const result = ok(W.transact(graph, operation)); graph = result.graph; return result; },
    node(name, x = 0, y = 0) { return this.run({ type: 'add-vertex', kind: 'junction', point: { x,y }, name }).created[0]; },
    add(type, id, value) { return this.run({ type: 'add-device', deviceType: type, id, ...(value === undefined ? {} : { value: String(value) }) }).created[0]; },
    pin(device, role) { return W.required(graph.devices, device).terminals.find(t => t.role === role).vertex; },
    wire(a,b, name = W.netNames(graph).get(b)) { return this.run({ type: 'connect', a,b,survivingName:name }).created[0]; },
    branch(type,id,value,p,n) { const key = this.add(type,id,value); this.wire(this.pin(key,'p'),p); this.wire(this.pin(key,'n'),n); return key; },
    voltage(id,p,n) { return this.run({ type:'add-observation',observation:{id,type:'voltage',p,n} }).created[0]; },
    current(id,device) { return this.run({ type:'add-observation',observation:{id,type:'current',device} }).created[0]; },
  };
}
function divider() {
  const e=editor(), ground=e.graph.reference, input=e.node('in'), out=e.node('out');
  const v=e.branch('V','Vin',undefined,input,ground);
  e.run({type:'edit-source',device:v,source:{dc:'12'}});
  const r1=e.branch('R','R1',1000,input,out), r2=e.branch('R','R2',2000,out,ground);
  e.voltage('out',out,ground); e.voltage('in',input,ground); e.voltage('r1v',input,out);
  e.current('r1i',r1); e.current('r2i',r2); e.current('vi',v);
  return {e,input,out,ground,r1,r2,v};
}

test('wire components include loops and islands but never device interiors',()=>{
  const e=editor(), a=e.node('a'), b=e.node('b'), c=e.node('c');
  const ab=e.wire(a,b,'a'), bc=e.wire(b,c,'a'), ca=e.wire(c,a,'a');
  const r=e.add('R','R',1000);
  e.wire(e.pin(r,'p'),a,'a');
  e.run({type:'mark-open',vertex:e.pin(r,'n')});
  assert.equal(W.partitions(e.graph).length,3);
  e.run({type:'delete-wire',edge:ab});
  assert.equal(W.netNames(e.graph).get(b),'a');
  e.run({type:'delete-wire',edge:bc});
  assert.notEqual(W.netNames(e.graph).get(b),'a');
  assert.equal(W.netNames(e.graph).get(a),'a');
  assert.ok(e.graph.edges.some(edge=>edge.key===ca));
});
test('pending/open/connected are explicit and last-wire deletion becomes pending',()=>{
  const e=editor(), r=e.add('R','R',1000), p=e.pin(r,'p'), n=e.pin(r,'n');
  assert.equal(W.nativeCandidate(e.graph).diagnostics[0].category,'completion');
  e.run({type:'mark-open',vertex:p}); e.run({type:'mark-open',vertex:n});
  assert.equal(candidate(e.graph).circuit.components.length,1);
  const edge=e.wire(p,e.graph.reference);
  assert.equal(W.required(e.graph.vertices,p).completion,'connected');
  const before=structuredClone(e.graph);
  assert.equal(W.transact(e.graph,{type:'mark-open',vertex:p}).status,'rejected');
  assert.deepEqual(e.graph,before);
  e.run({type:'delete-wire',edge});
  assert.equal(W.required(e.graph.vertices,p).completion,'pending');
  assert.equal(W.nativeCandidate(e.graph).status,'invalid');
  e.run({type:'mark-open',vertex:p}); candidate(e.graph);
});
test('merge requires an explicit name, reports partitions and anchored references',()=>{
  const e=editor(), a=e.node('a'), b=e.node('b'); e.voltage('ab',a,b);
  const before=structuredClone(e.graph);
  const failure=W.transact(e.graph,{type:'connect',a,b});
  assert.equal(failure.diagnostics[0].code,'merge-choice'); assert.deepEqual(e.graph,before);
  const result=e.run({type:'connect',a,b,survivingName:'b'});
  assert.equal(result.before.partitions.length-result.after.partitions.length,1);
  assert.deepEqual(result.before.voltageObservations.map(o=>[o.p,o.n]),[['a','b']]);
  assert.deepEqual(result.after.voltageObservations.map(o=>[o.p,o.n]),[['b','b']]);
});
test('ground wins merges, ordinary rename cannot move reference, reference may follow a terminal split',()=>{
  const {e,out,r2}=divider();
  const p=e.pin(r2,'p');
  e.run({type:'set-reference',vertex:p});
  e.run({type:'disconnect',vertex:p});
  assert.equal(W.netNames(e.graph).get(p),'0');
  assert.notEqual(W.netNames(e.graph).get(out),'0');
  assert.equal(W.transact(e.graph,{type:'rename-node',vertex:p,name:'ground'}).status,'rejected');
  e.run({type:'mark-open',vertex:p});
  e.wire(p,out,'out');
  assert.equal(W.netNames(e.graph).get(out),'0');
});
test('crossing coordinates do not connect; explicit join creates one shared junction',()=>{
  const e=editor(), a=e.node('a',-100,0), b=e.node('b',100,0), c=e.node('c',0,-100), d=e.node('d',0,100);
  const horizontal=e.wire(a,b,'a'), vertical=e.wire(c,d,'c');
  assert.notEqual(W.netNames(e.graph).get(a),W.netNames(e.graph).get(c));
  const join={type:'join-crossing',first:horizontal,firstSegment:0,second:vertical,secondSegment:0};
  assert.equal(W.transact(e.graph,join).status,'rejected');
  const junction=e.run({...join,survivingName:'a'}).created[0];
  assert.equal(e.graph.edges.filter(edge=>edge.a===junction||edge.b===junction).length,4);
  assert.deepEqual(W.vertexPoint(e.graph,junction),{x:0,y:0});
  assert.equal(W.netNames(e.graph).get(d),'a');
});
test('split selected polyline segment and attach an endpoint explicitly',()=>{
  const e=editor(), a=e.node('a',0,0), b=e.node('b',100,100), c=e.node('c',50,50);
  const edge=e.run({type:'connect',a,b,survivingName:'a',bends:[{x:100,y:0}]}).created[0];
  const j=e.run({type:'split-wire',edge,segment:1,fraction:.5}).created[0];
  assert.deepEqual(W.vertexPoint(e.graph,j),{x:100,y:50});
  assert.equal(e.graph.edges.length,2);
  assert.deepEqual(W.wirePoints(e.graph,e.graph.edges[0].key).map(p=>[p.x,p.y]),[[0,0],[100,0],[100,50]]);
  e.wire(c,j,'a');
  assert.equal(W.netNames(e.graph).get(c),'a');
});
test('separating selected junction edges changes exactly those endpoints and keeps observation anchor',()=>{
  const e=editor(), j=e.node('j'), a=e.node('a'), b=e.node('b'), c=e.node('c');
  const aj=e.wire(a,j,'j'), bj=e.wire(b,j,'j'), cj=e.wire(c,j,'j'); e.voltage('probe',j,a);
  const other=e.run({type:'separate',vertex:j,edges:[aj,bj]}).created[0];
  assert.equal(W.required(e.graph.edges,aj).b,other); assert.equal(W.required(e.graph.edges,bj).b,other);
  assert.equal(W.required(e.graph.edges,cj).b,j); assert.equal(e.graph.observations[0].p,j);
  assert.notEqual(W.netNames(e.graph).get(other),'j');
  assert.equal(W.transact(e.graph,{type:'separate',vertex:j,edges:[cj]}).status,'rejected');
});
test('coincident symbols and free endpoints never imply electrical equality',()=>{
  const e=editor(), a=e.add('R','R1',1), b=e.add('R','R2',2);
  assert.deepEqual(W.vertexPoint(e.graph,e.pin(a,'p')),W.vertexPoint(e.graph,e.pin(b,'p')));
  assert.notEqual(W.netNames(e.graph).get(e.pin(a,'p')),W.netNames(e.graph).get(e.pin(b,'p')));
  const free=e.run({type:'add-vertex',kind:'free',point:{x:-30,y:0}}).created[0];
  assert.notEqual(W.netNames(e.graph).get(free),W.netNames(e.graph).get(e.pin(a,'p')));
});
test('geometry moves, rotations and bends follow endpoints without scientific change',()=>{
  const {e,r1}=divider(), native=candidate(e.graph), pins=structuredClone(W.required(e.graph.devices,r1).terminals);
  const move=e.run({type:'move-device',device:r1,point:{x:200,y:100}}); assert.equal(move.scientific,false);
  e.run({type:'rotate-device',device:r1,quarterTurns:1});
  assert.deepEqual(W.vertexPoint(e.graph,e.pin(r1,'p')),{x:200,y:70});
  assert.deepEqual(W.vertexPoint(e.graph,e.pin(r1,'n')),{x:200,y:130});
  const edge=e.graph.edges.find(edge=>edge.a===e.pin(r1,'p'));
  e.run({type:'move-bends',edge:edge.key,bends:[{x:80,y:20}]});
  assert.deepEqual(W.wirePoints(e.graph,edge.key)[0],{x:200,y:70});
  assert.deepEqual(candidate(e.graph),native); assert.deepEqual(W.required(e.graph.devices,r1).terminals,pins);
  const before=structuredClone(e.graph);
  for(const operation of [{type:'move-device',device:r1,point:{x:Infinity,y:0}},
    {type:'rotate-device',device:r1,quarterTurns:.5},{type:'move-bends',edge:edge.key,bends:Array(65).fill({x:0,y:0})},
    {type:'move-device',device:r1,point:{x:0,y:1e6}}]) assert.equal(W.transact(e.graph,operation).status,'rejected');
  assert.deepEqual(e.graph,before);
});
test('sources and storage defaults, copies, native renames and dependent deletions are atomic',()=>{
  const e=editor('storage'), v=e.add('V','V'), i=e.add('I','I'), c=e.add('C','C',1e-6), l=e.add('L','L',.01);
  assert.equal(e.graph.sources.length,2); assert.equal(e.graph.storage.length,2);
  e.run({type:'edit-source',device:v,source:{dc:'5',waveform:{type:'step',at:'1',before:'0',after:'5'}}});
  const obs=e.current('source',v);
  e.run({type:'rename-device',device:v,id:'<V> & "q"'});
  assert.equal(e.graph.observations[0].device,v);
  const copy=e.run({type:'copy-device',device:v}).created[0];
  assert.equal(e.graph.sources.find(s=>s.device===copy).dc,'5');
  assert.ok(W.required(e.graph.devices,copy).terminals.every(t=>W.required(e.graph.vertices,t.vertex).completion==='pending'));
  assert.equal(W.transact(e.graph,{type:'delete-device',device:v}).diagnostics[0].category,'dependency');
  e.run({type:'delete-device',device:v,deleteObservations:[obs]});
  assert.ok(!e.graph.sources.some(s=>s.device===v));
  e.run({type:'edit-initial',device:c,value:'2'});
  const copyC=e.run({type:'copy-device',device:c}).created[0]; assert.equal(e.graph.storage.find(s=>s.device===copyC).value,'2');
  e.run({type:'delete-device',device:l}); assert.ok(!e.graph.storage.some(s=>s.device===l));
  e.run({type:'set-initial',kind:'equilibrium'}); assert.equal(e.graph.storage.length,0);
  e.run({type:'set-initial',kind:'storage'}); assert.equal(e.graph.storage.length,2);
  assert.ok(e.graph.sources.some(s=>s.device===i));
});
test('deleting a component preserves wires and voltage observation anchors',()=>{
  const {e,r1}=divider(), p=e.pin(r1,'p'), n=e.pin(r1,'n');
  e.voltage('physical',p,n);
  const edges=structuredClone(e.graph.edges), current=e.graph.observations.find(o=>o.id==='r1i');
  e.run({type:'delete-device',device:r1,deleteObservations:[current.key]});
  assert.deepEqual(e.graph.edges,edges); assert.equal(W.required(e.graph.vertices,p).kind,'free');
  assert.equal(candidate(e.graph).circuit.observations.find(o=>o.id==='physical').p,'in');
});
for (const name of ['divider','rc','rc-high-pass','rlc','rlc-initial','res-bridge','one-port-current-source']) {
  test(`lossless supported native round-trip: ${name}`,async()=>{
    const document=await fixture(name); assert.deepEqual(candidate(imported(document)),document);
  });
}
test('lossless optional fields, arbitrary node order, unused/singleton nodes, labels and exact unusual IDs',async()=>{
  const doc=await fixture('rlc');
  const ids=['__proto__',' a,b ','<em>x</em> & "q"'];
  const rename=new Map(doc.circuit.nodes.filter(n=>n!=='0').map((n,i)=>[n,ids[i]??`node ${i}`]));
  doc.circuit.nodes=doc.circuit.nodes.map(n=>rename.get(n)??n).reverse(); doc.circuit.nodes.push('unused');
  for(const component of doc.circuit.components){component.p=rename.get(component.p)??component.p;component.n=rename.get(component.n)??component.n;component.label=`label ${component.id}`;}
  for(const o of doc.circuit.observations){if(o.type==='voltage'){o.p=rename.get(o.p)??o.p;o.n=rename.get(o.n)??o.n;}o.label='probe';}
  doc.circuit.label='circuit'; doc.experiment.label='experiment';
  doc.experiment.sources[0].waveform={type:'sinusoid',offset:1,amplitudePeak:2,frequencyHz:3,phaseRadians:-.5};
  doc.experiment.initial={kind:'storage',values:doc.circuit.components.filter(c=>['C','L'].includes(c.type)).map(c=>({id:c.id,value:.2}))};
  assert.deepEqual(candidate(imported(doc)),doc);
  delete doc.experiment.sources[0].ac; delete doc.experiment.sources[0].waveform;
  assert.deepEqual(candidate(imported(doc)),doc);
  const singleton={circuit:{schemaVersion:1,nodes:[' lonely ','0'],components:[{type:'R',id:'__proto__',p:' lonely ',n:'0',value:1}],observations:[]},experiment:{schemaVersion:1,sources:[],initial:{kind:'equilibrium'}}};
  assert.deepEqual(candidate(imported(singleton)),singleton);
});
for(const name of ['vccs','cccs','nonlinear/resistor-diode','bjt/common-emitter']) {
  test(`unsupported import retains exact validated document: ${name}`,async()=>{
    const doc=await fixture(name), before=structuredClone(doc), result=W.importWiring(doc);
    assert.equal(result.status,'unsupported'); assert.deepEqual(result.document,doc); assert.deepEqual(doc,before);
  });
}
test('Cauer and both Foster constructions round-trip without scientific metadata loss',()=>{
  const scales={referenceResistanceOhm:'1000',referenceAngularFrequencyPerSecond:'1000'};
  const results=[synthesizeRc({...scales,quantity:'impedance',method:'cauer-infinity',numerator:['3','4','1'],denominator:['0','2','1']}),
    synthesizeRcFoster({...scales,method:'foster-I',quantity:'impedance',decomposition:{rInfinity:'1',kZero:'3/2',terms:[{pole:'2',residue:'1/2'}]}}),
    synthesizeRcFoster({...scales,method:'foster-II',quantity:'admittance',decomposition:{gZero:'0',cInfinity:'0',terms:[{pole:'1',coefficient:'1/2'},{pole:'3',coefficient:'1/2'}]}})];
  for(const result of results){assert.equal(result.native.status,'generated');assert.deepEqual(candidate(imported(result.native.document)),result.native.document);}
});
test('native candidate rejects malformed ownership, missing dependencies and invalid numeric drafts without mutating them',()=>{
  const {e,r1}=divider();
  e.run({type:'edit-value',device:r1,value:'not yet a number'});
  const before=structuredClone(e.graph); assert.equal(W.nativeCandidate(e.graph).diagnostics[0].code,'numeric-text'); assert.deepEqual(e.graph,before);
  e.run({type:'edit-value',device:r1,value:'-1'}); assert.equal(W.nativeCandidate(e.graph).status,'invalid');
  e.run({type:'edit-value',device:r1,value:'1000'});
  for(const corrupt of [g=>g.devices[0].terminals.reverse(),g=>g.sources=[],g=>g.vertices[0].key='missing',g=>g.names.push({...g.names[0]}),g=>g.observations[0].p='missing']) {
    const graph=structuredClone(e.graph);corrupt(graph);assert.equal(W.nativeCandidate(graph).status,'invalid');
  }
  const geometry=structuredClone(e.graph);geometry.placements[0].x=Infinity;
  assert.equal(W.nativeCandidate(geometry).status,'ok'); assert.equal(W.geometryDiagnostics(geometry)[0].category,'geometry');
});
test('divider and reference change agree with independent voltages, currents and powers',()=>{
  const {e,input,out,ground}=divider();
  const doc=candidate(e.graph), solution=ok(solveDC(assemble(doc.circuit),doc.experiment));
  const value=id=>solution.observations[id].value.re;
  near(value('out'),8);near(value('r1i'),.004);near(value('r2i'),.004);near(value('vi'),-.004);
  const edges=structuredClone(e.graph.edges);
  e.run({type:'set-reference',vertex:out});
  e.voltage('newIn',input,out);e.voltage('oldGround',ground,out);
  const changed=candidate(e.graph), result=ok(solveDC(assemble(changed.circuit),changed.experiment));
  near(result.observations.newIn.value.re,4);near(result.observations.oldGround.value.re,-8);
  for(const id of ['out','in','r1v','r1i','r2i','vi']) near(result.observations[id].value.re,value(id));
  near(result.observations.r1v.value.re*result.observations.r1i.value.re,.016);
  near(result.observations.out.value.re*result.observations.r2i.value.re,.032);
  near(result.observations.in.value.re*result.observations.vi.value.re,-.048);
  assert.deepEqual(e.graph.edges,edges);
});
test('transaction-built RC low-pass follows independent frequency and backward-Euler equations',()=>{
  const e=editor('storage'), ground=e.graph.reference, input=e.node('in'), out=e.node('out');
  const v=e.branch('V','Vin',undefined,input,ground);
  e.run({type:'edit-source',device:v,source:{dc:'1',ac:{re:'1',im:'0'},waveform:{type:'step',at:'0',before:'0',after:'1'}}});
  e.branch('R','R',1000,input,out); e.branch('C','C',1e-6,out,ground); e.voltage('out',out,ground);
  const document=candidate(e.graph), assembly=assemble(document.circuit);
  const h=ok(transfer(assembly,'Vin','out',{re:0,im:1000})); near(h.transfer.value.re,.5);near(h.transfer.value.im,-.5);
  const run=ok(transient(assembly,document.experiment,{stop:.001,step:.0001}));
  const samples=run.samples.filter(sample=>sample.side==='regular'); let previous=0;
  for(const sample of samples){const expected=(previous+.1)/1.1;near(sample.observations.out.value.re,expected);previous=expected;}
  assert.equal(samples.length,10);
});
test('transaction-built balanced and unbalanced bridges match independent nodal equations',()=>{
  const e=editor(), ground=e.graph.reference, top=e.node('top'), left=e.node('left'), right=e.node('right');
  const v=e.branch('V','V',undefined,top,ground);e.run({type:'edit-source',device:v,source:{dc:'10'}});
  e.branch('R','TL',1000,top,left);e.branch('R','L0',1000,left,ground);e.branch('R','TR',1000,top,right);
  const bottom=e.branch('R','R0',1000,right,ground), bridge=e.branch('R','bridge',1000,left,right);
  e.voltage('left',left,ground);e.voltage('right',right,ground);e.current('bridge',bridge);
  let doc=candidate(e.graph), result=ok(solveDC(assemble(doc.circuit),doc.experiment));
  near(result.observations.left.value.re,5);near(result.observations.right.value.re,5);near(result.observations.bridge.value.re,0);
  e.run({type:'edit-value',device:bottom,value:'2000'}); doc=candidate(e.graph); result=ok(solveDC(assemble(doc.circuit),doc.experiment));
  near(result.observations.left.value.re,70/13);near(result.observations.right.value.re,80/13);near(result.observations.bridge.value.re,-1/1300);
});
test('native-valid intentional opens, shorted elements, floating islands and conflicting sources remain solver concerns',()=>{
  const open=editor(), resistor=open.add('R','R',1); for(const role of ['p','n'])open.run({type:'mark-open',vertex:open.pin(resistor,role)});
  const openDoc=candidate(open.graph);assert.notEqual(solveDC(assemble(openDoc.circuit),openDoc.experiment).status,'ok');
  const short=editor();short.branch('R','R',1,short.graph.reference,short.graph.reference);
  const shortDoc=candidate(short.graph);assert.equal(shortDoc.circuit.components[0].p,shortDoc.circuit.components[0].n);
  assert.equal(solveDC(assemble(shortDoc.circuit),shortDoc.experiment).status,'ok');
  const floating=editor(), a=floating.node('a'),b=floating.node('b');floating.branch('R','R',1,a,b);
  const floatingDoc=candidate(floating.graph);assert.notEqual(solveDC(assemble(floatingDoc.circuit),floatingDoc.experiment).status,'ok');
  const incompatible=editor(), p=incompatible.node('p');
  for(const [id,dc] of [['V1','1'],['V2','2']]){const v=incompatible.branch('V',id,undefined,p,incompatible.graph.reference);incompatible.run({type:'edit-source',device:v,source:{dc}});}
  const doc=candidate(incompatible.graph);assert.notEqual(solveDC(assemble(doc.circuit),doc.experiment).status,'ok');
});
test('semantic history restores exact graph identities and geometry, bounds steps and clears abandoned redo',async()=>{
  const applied={document:await fixture('divider'),revision:0}, draft=W.createWiringDraft(applied,2), start=structuredClone(draft.graph);
  const device=draft.graph.devices[0].key;
  ok(W.commitWiring(draft,{type:'move-device',device,point:{x:200,y:300}}));
  const moved=structuredClone(draft.graph); assert.equal(draft.scientificRevision,0);assert.equal(draft.geometryRevision,1);
  ok(W.commitWiring(draft,{type:'rename-device',device,id:'new V'}));const renamed=structuredClone(draft.graph);
  assert.equal(W.undoWiring(draft),true);assert.deepEqual(draft.graph,moved);
  assert.equal(W.undoWiring(draft),true);assert.deepEqual(draft.graph,start);
  assert.equal(W.redoWiring(draft),true);assert.equal(W.redoWiring(draft),true);assert.deepEqual(draft.graph,renamed);
  ok(W.commitWiring(draft,{type:'rotate-device',device,quarterTurns:1}));assert.equal(draft.history.length,2);
  W.undoWiring(draft);ok(W.commitWiring(draft,{type:'rotate-device',device,quarterTurns:2}));assert.equal(draft.redo.length,0);
});
test('Apply unchanged keeps identity/revision; undo after Apply affects only draft; actual ownership detects preset reuse and mutations',async()=>{
  const applied={document:await fixture('divider'),revision:0}, original=applied.document, draft=W.createWiringDraft(applied);
  assert.equal(W.applyWiring(draft,applied).status,'unchanged');assert.equal(applied.document,original);assert.equal(applied.revision,0);
  const r=draft.graph.devices.find(d=>d.type==='R').key;
  ok(W.commitWiring(draft,{type:'move-device',device:r,point:{x:10,y:20}}));
  assert.equal(W.applyWiring(draft,applied).status,'unchanged');assert.equal(applied.document,original);
  ok(W.commitWiring(draft,{type:'edit-value',device:r,value:'2000'}));assert.equal(W.applyWiring(draft,applied).status,'applied');
  const checkpoint=applied.document;W.undoWiring(draft);assert.equal(applied.document,checkpoint);assert.equal(W.wiringDirty(draft),true);
  applied.document=await fixture('rc');applied.revision=0;
  const preserved=structuredClone(draft.graph);assert.equal(W.synchronizeWiring(draft,applied),'conflict');assert.deepEqual(draft.graph,preserved);
  assert.equal(W.applyWiring(draft,applied).diagnostics[0].code,'obsolete-base');
  assert.equal(W.synchronizeWiring(draft,applied,true),'synchronized');assert.deepEqual(candidate(draft.graph),applied.document);
  applied.document.experiment.sources[0].dc=99;assert.equal(W.wiringConflict(draft,applied),true);
  applied.document.experiment.sources[0].dc=NaN;assert.equal(W.applyWiring(draft,applied).diagnostics[0].code,'obsolete-base');
});
test('clean synchronization guards stale Apply even with equal numeric revision',async()=>{
  const applied={document:await fixture('divider'),revision:0}, draft=W.createWiringDraft(applied);
  applied.document=await fixture('rc');assert.equal(W.applyWiring(draft,applied).status,'invalid');
  assert.equal(W.synchronizeWiring(draft,applied),'synchronized');assert.equal(W.applyWiring(draft,applied).status,'unchanged');
});
test('endpoint-to-segment wire is one atomic history step, including rejected naming choices',async()=>{
  const applied={document:await fixture('divider'),revision:0},draft=W.createWiringDraft(applied);
  const first=draft.graph.edges[0];
  const vertex=draft.graph.devices.find(device=>device.id==='R2').terminals[0].vertex;
  const operation={type:'attach-to-segment',vertex,edge:first.key,segment:0,fraction:.5};
  const before=structuredClone(draft.graph);
  assert.equal(W.commitWiring(draft,operation).status,'rejected');assert.equal(draft.history.length,0);assert.deepEqual(draft.graph,before);
  ok(W.commitWiring(draft,{...operation,survivingName:'out'}));assert.equal(draft.history.length,1);
  const joined=structuredClone(draft.graph);W.undoWiring(draft);assert.deepEqual(draft.graph,before);W.redoWiring(draft);assert.deepEqual(draft.graph,joined);
});
test('explicit disconnect and rename preserve probe anchors, exact IDs and correction paths',()=>{
  const {e,r1,input}=divider(), pin=e.pin(r1,'p');
  e.voltage('physical',pin,input);
  e.run({type:'rename-node',vertex:input,name:'__proto__ <x> , "a"'});
  e.run({type:'rename-device',device:r1,id:' R, <b> & "q" '});
  let doc=candidate(e.graph);assert.equal(doc.circuit.observations.find(o=>o.id==='r1i').component,' R, <b> & "q" ');
  assert.equal(doc.circuit.components.find(c=>c.type==='R').p,'__proto__ <x> , "a"');
  const before=structuredClone(e.graph);
  for(const name of ['', '0','out']) assert.equal(W.transact(e.graph,{type:'rename-node',vertex:input,name}).status,'rejected');
  assert.deepEqual(e.graph,before);
  e.run({type:'disconnect',vertex:pin});assert.equal(W.nativeCandidate(e.graph).status,'invalid');
  e.run({type:'mark-open',vertex:pin});doc=candidate(e.graph);
  const observation=doc.circuit.observations.find(o=>o.id==='physical');
  assert.notEqual(observation.p,observation.n);assert.equal(observation.n,'__proto__ <x> , "a"');
});
test('compound topology and dependency edits restore exact state through semantic history',async()=>{
  const applied={document:await fixture('rc'),revision:0},draft=W.createWiringDraft(applied);
  const perform=operation=>{
    const before=structuredClone(draft.graph),result=ok(W.commitWiring(draft,operation)),after=structuredClone(draft.graph);
    assert.equal(W.undoWiring(draft),true);assert.deepEqual(draft.graph,before);
    assert.equal(W.redoWiring(draft),true);assert.deepEqual(draft.graph,after);return result;
  };
  const capacitor=draft.graph.devices.find(d=>d.type==='C').key;
  perform({type:'edit-initial',device:capacitor,value:'0.25'});
  const copy=perform({type:'copy-device',device:capacitor}).created[0];
  perform({type:'mark-open',vertex:W.required(draft.graph.devices,copy).terminals[0].vertex});
  perform({type:'delete-device',device:copy});
  const edge=draft.graph.edges[0].key;
  const junction=perform({type:'split-wire',edge,segment:0,fraction:.5}).created[0];
  perform({type:'move-vertex',vertex:junction,point:{x:12,y:34}});
  const observation=perform({type:'add-observation',observation:{id:'extra',type:'voltage',p:junction,n:draft.graph.reference}}).created[0];
  perform({type:'delete-observation',observation});
  perform({type:'set-reference',vertex:junction});
  perform({type:'set-initial',kind:'equilibrium'});
});
test('geometry-only dirty work conflicts rather than disappearing, unsupported synchronization is non-destructive',async()=>{
  const applied={document:await fixture('divider'),revision:0},draft=W.createWiringDraft(applied);
  ok(W.commitWiring(draft,{type:'move-vertex',vertex:draft.graph.reference,point:{x:50,y:50}}));
  applied.document=await fixture('rc');const before=structuredClone(draft.graph);
  assert.equal(W.synchronizeWiring(draft,applied),'conflict');assert.deepEqual(draft.graph,before);
  assert.equal(W.synchronizeWiring(draft,applied,true),'synchronized');
  applied.document=await fixture('nonlinear/resistor-diode');const clean=structuredClone(draft.graph);
  assert.equal(W.synchronizeWiring(draft,applied),'unsupported');assert.deepEqual(draft.graph,clean);
  assert.equal(W.createWiringDraft(applied).status,'unsupported');
});
test('noncrossing, collinear and invalid split requests fail atomically',()=>{
  const e=editor(), a=e.node('a',0,0),b=e.node('b',100,0),c=e.node('c',20,0),d=e.node('d',80,0);
  const first=e.wire(a,b,'a'),second=e.wire(c,d,'c'),before=structuredClone(e.graph);
  for(const operation of [{type:'join-crossing',first,second,firstSegment:0,secondSegment:0,survivingName:'a'},
    {type:'split-wire',edge:first,segment:0,fraction:0},{type:'split-wire',edge:first,segment:9,fraction:.5},
    {type:'connect',a,b:'missing',survivingName:'a'},{type:'unknown-operation'}]) {
    assert.equal(W.transact(e.graph,operation).status,'rejected');assert.deepEqual(e.graph,before);
  }
});
