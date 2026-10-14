import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateProject,parseProject,exportProject,exportProjectDraft,serializeProject,projectContentKey,PROJECT_LIMITS} from '../dist/project-test.js';
import {nativeCandidate,importWiring,transact} from '../dist/wiring-test.js';
import {createLab} from '../dist/lab-test.js';
import {WiringSession} from '../dist/wiring-ui-test.js';
import {assemble,solveDC,transfer,synthesizeRc,synthesizeRcFoster} from '../dist/index.js';
import {envelope,dividerDrawing,rcDrawing,rlcDrawing,bridge} from './support/project-fixtures.mjs';
const fixture=async name=>JSON.parse(await readFile(new URL(`../fixtures/${name}.json`,import.meta.url),'utf8'));
const ok=r=>{assert.equal(r.status,'ok',JSON.stringify(r));return r;};
const near=(x,y)=>assert.ok(Math.abs(x-y)<=1e-10*Math.max(1,Math.abs(y)),`${x} != ${y}`);
const divider=()=>fixture('divider').then(doc=>envelope(doc,dividerDrawing()));
function cycle(project){
  const input=structuredClone(project),result=ok(validateProject(project));assert.deepEqual(project,input);
  assert.deepEqual(ok(nativeCandidate(result.graph)).document,project.document);
  const g=result.graph,d=project.drawing;
  const handles=new Map(d.vertices.map((v,i)=>[v.id,g.vertices[i].key]));
  for(const placement of d.placements){const device=g.devices.find(x=>x.id===placement.component);const actual=g.placements.find(x=>x.key===device.key);assert.deepEqual([actual.x,actual.y,actual.turns],[placement.x,placement.y,placement.turns]);}
  d.vertices.forEach((v,i)=>{const actual=g.vertices[i];assert.equal(actual.kind,v.kind);if(v.kind==='terminal'){assert.equal(g.devices.find(x=>x.key===actual.device).id,v.component);assert.equal(actual.role,v.role);}else{const point=g.points.find(x=>x.key===actual.key);assert.deepEqual([point.x,point.y],[v.x,v.y]);}});
  d.edges.forEach((edge,i)=>{const actual=g.edges[i];assert.deepEqual([actual.a,actual.b],[handles.get(edge.a),handles.get(edge.b)]);assert.deepEqual(g.routes.find(x=>x.key===actual.key).bends,edge.bends);});
  for(const binding of d.bindings)assert.equal(g.names.find(n=>n.name===binding.node).vertex,handles.get(binding.vertex));
  assert.equal(g.reference,handles.get(d.reference));
  for(const observation of d.observations){const actual=g.observations.find(o=>o.id===observation.observation);assert.deepEqual([actual.p,actual.n],[handles.get(observation.p),handles.get(observation.n)]);}

  const first=ok(exportProject(result.graph,project.drawing.viewport));
  assert.deepEqual(first.project.document,project.document);
  const key=ok(projectContentKey(project)).key;assert.equal(ok(projectContentKey(first.project)).key,key);
  let json=ok(serializeProject(first.project)).json;
  for(let i=0;i<4;i++){
    const parsed=ok(parseProject(json)),next=ok(exportProject(parsed.graph,parsed.project.drawing.viewport));
    assert.equal(ok(projectContentKey(next.project)).key,key);
    assert.equal(ok(serializeProject(next.project)).json,json);
  }
  // Canonical exports include all placements, bends, anchors and viewport, not
  // merely native values; equality catches topology/geometry drift as well.
  return result;
}
test('hand-authored divider with bends round trips and solves to 8 V',async()=>{
  const p=await divider(),r=cycle(p),dc=ok(solveDC(assemble(r.project.document.circuit),r.project.document.experiment));
  near(dc.observations.out.value.re,8);near(dc.observations.r1i.value.re,.004);near(dc.observations.source.value.re,-.004);
});
test('hand-authored RC and RLC preserve rotations, source coordinates, storage and independent response',async()=>{
  const rc=cycle(envelope(await fixture('rc'),rcDrawing())).project.document;
  const response=ok(transfer(assemble(rc.circuit),'Vin','out',{re:0,im:1000}));near(response.transfer.value.re,.5);near(response.transfer.value.im,-.5);
  const rlc=cycle(envelope(await fixture('rlc'),rlcDrawing())).project.document;
  // At omega=1/sqrt(LC)=10000, H=1/(1-LCw²+jRCw)=-j10.
  const resonance=ok(transfer(assemble(rlc.circuit),'Vin','out',{re:0,im:10000}));near(resonance.transfer.value.re,0);near(resonance.transfer.value.im,-10);
});
test('balanced/unbalanced hand-authored bridge uses identical geometry and independent KCL values',()=>{
  const a=bridge(),b=bridge(2000);assert.deepEqual(a.drawing,b.drawing);
  for(const [p,left,right,current] of [[a,5,5,0],[b,70/13,80/13,-1/1300]]){
    const d=cycle(p).project.document,r=ok(solveDC(assemble(d.circuit),d.experiment));near(r.observations.left.value.re,left);near(r.observations.right.value.re,right);near(r.observations.cross.value.re,current);
  }
});
test('source optional AC and constant/step/sinusoid data are native-only and unchanged',async()=>{
  for(const waveform of [undefined,{type:'constant',value:2},{type:'step',at:1,before:-2,after:3},{type:'sinusoid',offset:1,amplitudePeak:2,frequencyHz:50,phaseRadians:-.3}]){
    const p=await divider();p.document.experiment.sources[0]={id:'Vin',dc:12,...waveform?{ac:{re:2,im:-3},waveform}:{}};
    cycle(p);assert.ok(!JSON.stringify(p.drawing).includes('waveform'));
  }
});
test('exact native and file-local IDs, separate anchors and unused nodes survive safely',async()=>{
  const p=await divider(),rename=new Map([['0','0'],['in',' __proto__ '],['out','a<em>b</em>, "Ө"']]);
  for(const d of p.document.circuit.components){d.p=rename.get(d.p);d.n=rename.get(d.n);}
  p.document.circuit.nodes=p.document.circuit.nodes.map(n=>rename.get(n));
  for(const o of p.document.circuit.observations)if(o.type==='voltage'){o.p=rename.get(o.p);o.n=rename.get(o.n);}
  for(const b of p.drawing.bindings)b.node=rename.get(b.node);
  p.document.circuit.components[1].id='__proto__';p.document.circuit.observations.find(o=>o.id==='r1i').component='__proto__';
  p.drawing.placements.find(p=>p.component==='R1').component='__proto__';for(const v of p.drawing.vertices)if(v.component==='R1')v.component='__proto__';
  p.document.circuit.nodes.push('unused');p.drawing.vertices.push({id:'constructor',kind:'free',x:700,y:0});p.drawing.bindings.push({node:'unused',vertex:'constructor'});
  p.document.circuit.observations.push({id:'second',type:'voltage',p:rename.get('out'),n:'0'});
  p.drawing.observations.push({observation:'second',p:p.drawing.vertices.find(v=>v.component==='R2'&&v.role==='p').id,n:p.drawing.reference});
  const old=p.drawing.vertices[0].id;p.drawing.vertices[0].id='__proto__';p.drawing.reference='__proto__';
  for(const b of p.drawing.bindings)if(b.vertex===old)b.vertex='__proto__';for(const e of p.drawing.edges){if(e.a===old)e.a='__proto__';if(e.b===old)e.b='__proto__';}
  for(const o of p.drawing.observations){if(o.p===old)o.p='__proto__';if(o.n===old)o.n='__proto__';}
  cycle(p);assert.equal({}.polluted,undefined);
});
test('crossings/coincident vertices never join; explicit shared junction does',()=>{
  const native={circuit:{schemaVersion:1,nodes:['0','a'],components:[],observations:[]},experiment:{schemaVersion:1,sources:[],initial:{kind:'equilibrium'}}};
  const d={drawingVersion:1,placements:[],vertices:[{id:'a',kind:'free',x:-50,y:0},{id:'b',kind:'free',x:50,y:0},{id:'c',kind:'junction',x:0,y:-50},{id:'d',kind:'junction',x:0,y:50}],edges:[{id:'x',a:'a',b:'b',bends:[]},{id:'y',a:'c',b:'d',bends:[]}],bindings:[{node:'0',vertex:'a'},{node:'a',vertex:'c'}],reference:'a',observations:[]};
  const p=envelope(native,d);assert.ok(cycle(p).warnings.length);
  d.vertices[2].x=-50;d.vertices[2].y=0;cycle(p); // coincidence is not adjacency
  d.vertices.push({id:'join',kind:'junction',x:0,y:0});d.edges=[{id:'1',a:'a',b:'join',bends:[]},{id:'2',a:'b',b:'join',bends:[]},{id:'3',a:'c',b:'join',bends:[]},{id:'4',a:'d',b:'join',bends:[]}];
  assert.equal(validateProject(p).status,'invalid');native.circuit.nodes=['0'];d.bindings=[d.bindings[0]];cycle(p);
});
test('intentional open terminal, dangling free branch and unused node are preserved',()=>{
  const p=envelope({circuit:{schemaVersion:1,nodes:['0','open','unused'],components:[{id:'R',type:'R',p:'open',n:'0',value:1}],observations:[]},experiment:{schemaVersion:1,sources:[],initial:{kind:'equilibrium'}}},
  {drawingVersion:1,placements:[{component:'R',x:100,y:0,turns:0}],vertices:[{id:'p',kind:'terminal',component:'R',role:'p'},{id:'n',kind:'terminal',component:'R',role:'n'},{id:'free',kind:'free',x:200,y:100},{id:'unused',kind:'junction',x:300,y:0}],edges:[{id:'tail',a:'n',b:'free',bends:[]}],bindings:[{node:'0',vertex:'n'},{node:'open',vertex:'p'},{node:'unused',vertex:'unused'}],reference:'n',observations:[]});
  const r=cycle(p);assert.equal(r.graph.vertices.find(v=>v.kind==='terminal'&&v.role==='p').completion,'open');
});
test('generated Cauer/Foster I/II have distinct portable drawings and unchanged scientific data',()=>{
  const scales={referenceResistanceOhm:'1000',referenceAngularFrequencyPerSecond:'1000'};
  const results=[synthesizeRc({...scales,quantity:'impedance',method:'cauer-infinity',numerator:['3','4','1'],denominator:['0','2','1']}),
    synthesizeRcFoster({...scales,quantity:'impedance',method:'foster-I',decomposition:{rInfinity:'1',kZero:'3/2',terms:[{pole:'2',residue:'1/2'}]}}),
    synthesizeRcFoster({...scales,quantity:'admittance',method:'foster-II',decomposition:{gZero:'0',cInfinity:'0',terms:[{pole:'1',coefficient:'1/2'},{pole:'3',coefficient:'1/2'}]}})];
  const keys=[];
  results.forEach((r,i)=>{assert.equal(r.native.status,'generated');const g=importWiring(r.native.document).graph;g.placements.forEach((p,j)=>{p.x=100+j*120;p.y=100+i*130;p.turns=i;});const p=ok(exportProject(g)).project;cycle(p);keys.push(ok(projectContentKey(p)).key);});
  assert.equal(new Set(keys).size,3);
});

const corruptions=[
 ['duplicate vertex',p=>p.drawing.vertices.push(structuredClone(p.drawing.vertices[0])),'duplicate-id'],
 ['missing vertex id',p=>delete p.drawing.vertices[0].id,'invalid-id'],
 ['duplicate edge',p=>p.drawing.edges.push(structuredClone(p.drawing.edges[0])),'duplicate-id'],
 ['missing edge id',p=>delete p.drawing.edges[0].id,'invalid-id'],
 ['broken endpoint',p=>p.drawing.edges[0].a='absent','missing-vertex'],
 ['duplicate terminal role',p=>p.drawing.vertices.push({...p.drawing.vertices.find(v=>v.kind==='terminal'),id:'extra'}),'duplicate-terminal'],
 ['missing role',p=>p.drawing.vertices.find(v=>v.kind==='terminal').role='c','terminal-role'],
 ['unknown owner',p=>p.drawing.vertices.find(v=>v.kind==='terminal').component='ghost','component-reference'],
 ['wrong p/n assignment',p=>{const v=p.drawing.vertices.filter(v=>v.component==='Vin');v[0].role='p';v[1].role='n';},'terminal-node'],
 ['hidden short',p=>p.drawing.edges.push({id:'short',a:'hub0',b:'hub1',bends:[]}),'merged-nodes'],
 ['split native net',p=>p.drawing.edges.pop(),'unbound-component'],
 ['duplicate native binding',p=>p.drawing.bindings.push({node:'in',vertex:'hub2'}),'duplicate-id'],
 ['extra isolated component',p=>p.drawing.vertices.push({id:'extra',kind:'free',x:0,y:0}),'unbound-component'],
 ['missing unused node',p=>p.document.circuit.nodes.push('unused'),'node-coverage'],
 ['wrong ground',p=>p.drawing.reference='hub1','reference-node'],
 ['wrong probe polarity',p=>p.drawing.observations[0].p='hub0','observation-node'],
 ['missing voltage probe',p=>p.drawing.observations.pop(),'observation-coverage'],
 ['extra current anchor',p=>p.drawing.observations.push({observation:'source',p:'hub0',n:'hub1'}),'observation-coverage'],
 ['stale rename',p=>p.drawing.placements[0].component='oldVin','component-reference'],
 ['stale deletion',p=>{p.document.circuit.components.pop();p.document.circuit.observations=p.document.circuit.observations.filter(o=>o.type==='voltage');},'placement-coverage'],
 ['format',p=>p.format='native','project-format'],
 ['version',p=>p.projectVersion=2,'project-version'],
 ['drawing version',p=>p.drawing.drawingVersion=2,'drawing-version'],
 ['extra envelope field',p=>p.history=[],'unknown-field'],
 ['extra drawing field',p=>p.drawing.sources=[],'unknown-field'],
 ['duplicate physical value',p=>p.drawing.placements[0].value=3,'unknown-field'],
 ['terminal coordinate',p=>p.drawing.vertices.find(v=>v.kind==='terminal').x=0,'unknown-field'],
 ['nonfinite geometry',p=>p.drawing.placements[0].x=Infinity,'nonfinite'],
 ['oversized geometry',p=>p.drawing.placements[0].x=1e6+1,'coordinate'],
 ['derived terminal out of bounds',p=>{p.drawing.placements[0].x=1e6;p.drawing.placements[0].turns=0;},'geometry'],
 ['invalid rotation',p=>p.drawing.placements[0].turns=.5,'rotation'],
 ['missing route',p=>delete p.drawing.edges[0].bends,'expected-array'],
 ['excess bends',p=>p.drawing.edges[0].bends=Array.from({length:65},()=>({x:0,y:0})),'record-limit'],
 ['zero viewport',p=>p.drawing.viewport.width=0,'viewport'],
 ['viewport far corner',p=>p.drawing.viewport.width=2e6,'coordinate'],
 ['unknown vertex field',p=>p.drawing.vertices[0].node='other','unknown-field'],
 ['unsafe dynamic field',p=>Object.defineProperty(p.drawing,'__proto__',{value:{polluted:true},enumerable:true}),'unknown-field'],
];
for(const [name,change,code] of corruptions)test('rejects '+name+' without mutating input',async()=>{
  const p=await divider();change(p);const before=structuredClone(p),r=validateProject(p);
  assert.equal(r.status,'invalid');assert.equal(r.diagnostics[0].code,code,JSON.stringify(r));assert.deepEqual(p,before);assert.equal({}.polluted,undefined);
  if(r.stage==='drawing')assert.deepEqual(r.document,p.document);
});
test('missing terminal coverage fails even with all components still bound',async()=>{
  const p=await divider(),pin=p.drawing.vertices.find(v=>v.kind==='terminal');
  const i=p.drawing.vertices.indexOf(pin);p.drawing.vertices[i]={id:pin.id,kind:'free',x:1,y:2};
  assert.equal(validateProject(p).diagnostics[0].code,'missing-terminal');
});
test('invalid native and unsupported valid documents have distinct lossless outcomes',async()=>{
  const p=await divider();p.document.circuit.components[1].value=-1;
  const invalid=validateProject(p);assert.equal(invalid.status,'invalid');assert.equal(invalid.stage,'native');assert.equal(invalid.document,undefined);
  for(const name of ['vcvs','nonlinear/resistor-diode','bjt/common-emitter']){
    const doc=await fixture(name),input=envelope(doc,dividerDrawing()),before=structuredClone(input),r=validateProject(input);
    assert.equal(r.status,'unsupported',JSON.stringify(r));assert.deepEqual(r.document,doc);assert.deepEqual(input,before);
  }
});
test('parser bounds, malformed JSON, object cycles, accessors and unknown native fields fail without execution',async()=>{
  assert.equal(parseProject('{').status,'invalid');assert.equal(parseProject(' '.repeat(PROJECT_LIMITS.bytes+1)).diagnostics[0].code,'file-limit');
  const p=await divider();p.extra=p;assert.equal(validateProject(p).status,'invalid');
  const accessor={};Object.defineProperty(accessor,'format',{enumerable:true,get(){assert.fail('must not invoke getter');}});assert.equal(validateProject(accessor).status,'invalid');
  const native=await divider();native.document.drawing={};assert.equal(validateProject(native).stage,'native');
  const deep={};let next=deep;for(let i=0;i<40;i++){next.child={};next=next.child;}assert.equal(validateProject(deep).diagnostics[0].code,'resource-limit');
  assert.equal(validateProject(Array(100001).fill(null)).diagnostics[0].code,'resource-limit');
});
test('export rejects incomplete/invalid graph and independent pending text/gestures',async()=>{
  const state=createLab(),session=new WiringSession(()=>state),before=structuredClone(state),doc=state.document;
  const draft=structuredClone(session.draft);session.pending.set('R:value','1e-');
  assert.equal(exportProjectDraft({graph:session.draft.graph,pendingTextCount:session.pending.size,unfinishedWire:false}).diagnostics[0].code,'incomplete-draft');
  assert.equal(exportProjectDraft({graph:session.draft.graph,pendingTextCount:0,unfinishedWire:true}).status,'invalid');
  const pending=structuredClone(session.draft.graph);pending.vertices.find(v=>v.kind==='terminal').completion='pending';assert.equal(exportProject(pending).status,'invalid');
  const bad=structuredClone(session.draft.graph);bad.devices.find(d=>d.type==='R').value='1e-';assert.equal(exportProject(bad).status,'invalid');
  const duplicate=structuredClone(session.draft.graph);duplicate.placements.push({...duplicate.placements[0]});assert.equal(exportProject(duplicate).diagnostics[0].code,'geometry-coverage');
  const independent=structuredClone(session.draft.graph);independent.devices.find(d=>d.type==='R').value='2000';ok(exportProjectDraft({graph:independent,pendingTextCount:0,unfinishedWire:false}));
  assert.deepEqual(session.draft,draft);assert.deepEqual(state,before);assert.equal(state.document,doc);assert.equal(session.pending.get('R:value'),'1e-');
});
test('saved-content comparison separates geometry from Apply, ignores key and handle spelling',async()=>{
  const p=await divider(),key=ok(projectContentKey(p)).key;
  const shuffled={drawing:p.drawing,document:p.document,projectVersion:1,format:p.format};assert.equal(ok(projectContentKey(shuffled)).key,key);
  const moved=structuredClone(p);moved.drawing.placements[0].x++;assert.notEqual(ok(projectContentKey(moved)).key,key);assert.deepEqual(moved.document,p.document);
  const reordered=structuredClone(p);reordered.document.circuit.components.reverse();assert.notEqual(ok(projectContentKey(reordered)).key,key);
  const state=createLab(),s=new WiringSession(()=>state),revision=state.revision;
  const result=transact(s.draft.graph,{type:'rotate-device',device:s.draft.graph.devices[0].key,quarterTurns:1});ok(result);ok(exportProject(result.graph));assert.equal(state.revision,revision);assert.deepEqual(s.draft.graph,importWiring(state.document).graph);
});
test('deterministic imported allocation remains collision-free after subsequent editing',async()=>{
  const p=await divider(),a=ok(validateProject(p)),b=ok(validateProject(p));assert.deepEqual(a.graph,b.graph);
  const edited=ok(transact(a.graph,{type:'add-device',deviceType:'R',id:'new',value:'2'}));
  const all=[...edited.graph.devices,...edited.graph.vertices,...edited.graph.edges,...edited.graph.names,...edited.graph.sources,...edited.graph.observations,...edited.graph.storage].map(x=>x.key);
  assert.equal(new Set(all).size,all.length);assert.deepEqual(a.graph,b.graph);
});
test('record limits and compact serialization bound work before graph reconstruction',async()=>{
  for(const [field,limit] of [['vertices',240],['edges',320],['placements',40],['bindings',240],['observations',240]]){
    const p=await divider();p.drawing[field]=Array.from({length:limit+1},()=>structuredClone(p.drawing[field][0]));
    assert.equal(validateProject(p).diagnostics[0].code,'record-limit');
  }
  const wide=await divider();wide.document.circuit.components=Array.from({length:41},()=>({...wide.document.circuit.components[0]}));assert.equal(validateProject(wide).diagnostics[0].code,'record-limit');
  const p=await divider();p.document.circuit.label='a'.repeat(PROJECT_LIMITS.bytes);assert.equal(validateProject(p).diagnostics[0].code,'file-limit');
  const arr=[null];delete arr[0];arr.hidden='a';assert.equal(validateProject(arr).diagnostics[0].code,'non-json');
});
test('file-local handle renaming preserves saved-content comparison without delimiter parsing',async()=>{
  const p=await divider(),key=ok(projectContentKey(p)).key;
  const map=new Map(p.drawing.vertices.map((v,i)=>[v.id,` __proto__, <b>"${i}"</b> `]));
  p.drawing.vertices.forEach(v=>v.id=map.get(v.id));p.drawing.edges.forEach((e,i)=>{e.id=`constructor:${i}`;e.a=map.get(e.a);e.b=map.get(e.b);});
  p.drawing.bindings.forEach(b=>b.vertex=map.get(b.vertex));p.drawing.reference=map.get(p.drawing.reference);
  p.drawing.observations.forEach(o=>{o.p=map.get(o.p);o.n=map.get(o.n);});
  assert.equal(ok(projectContentKey(p)).key,key);cycle(p);
});

// A legal but deliberately redundant drawing; all wires belong to native ground.
function parallelWireProject(edgeCount = 320, bendCount = 64) {
  return envelope({circuit:{schemaVersion:1,nodes:['0'],components:[],observations:[]},
    experiment:{schemaVersion:1,sources:[],initial:{kind:'equilibrium'}}}, {
    drawingVersion:1, placements:[],
    vertices:[{id:'a',kind:'junction',x:0,y:0},{id:'b',kind:'free',x:100,y:0}],
    edges:Array.from({length:edgeCount},(_,i)=>({id:`wire${i}`,a:'a',b:'b',
      bends:Array.from({length:bendCount},(_,j)=>({x:j,y:i}))})),
    bindings:[{node:'0',vertex:'a'}],reference:'a',observations:[],
  });
}
import {inspectProjectWarnings, PROJECT_WARNING_PAIR_LIMIT} from '../dist/project-test.js';
test('maximum legal multi-bend drawing bounds every examined pair, including skipped pairs',()=>{
  const p=parallelWireProject();
  assert.ok(Buffer.byteLength(JSON.stringify(p)) < PROJECT_LIMITS.bytes);
  const r=cycle(p), scan=inspectProjectWarnings(r.graph);
  assert.equal(scan.segmentCount,20800);
  assert.equal(scan.pairsInspected,PROJECT_WARNING_PAIR_LIMIT);
  assert.equal(scan.budgetExhausted,true);
  assert.deepEqual(r.warnings,scan.warnings);
  assert.equal(r.warnings[0].code,'drawing-inspection-incomplete');
});
test('small overlap and clear drawings keep ordinary warning behavior',()=>{
  const p=parallelWireProject(1,0);
  p.document.circuit.nodes.push('other');
  p.drawing.vertices.push({id:'c',kind:'free',x:50,y:-50},{id:'d',kind:'free',x:50,y:50});
  p.drawing.edges.push({id:'crossing',a:'c',b:'d',bends:[]});
  p.drawing.bindings.push({node:'other',vertex:'c'});
  assert.equal(cycle(p).warnings[0].code,'possible-wire-overlap');
  p.drawing.vertices[2].x=200;p.drawing.vertices[3].x=200;
  const scan=inspectProjectWarnings(cycle(p).graph);
  assert.deepEqual(scan.warnings,[]);assert.equal(scan.pairsInspected,1);assert.equal(scan.budgetExhausted,false);
});
test('budget threshold counts shared endpoints and does not falsely truncate a finished scan',()=>{
  for(const [edges,exhausted] of [[141,false],[142,true]]) {
    const r=cycle(parallelWireProject(edges,0)),scan=inspectProjectWarnings(r.graph);
    assert.equal(scan.budgetExhausted,exhausted);
    assert.equal(scan.pairsInspected,Math.min(edges*(edges-1)/2,PROJECT_WARNING_PAIR_LIMIT));
    assert.equal(r.warnings.length,exhausted?1:0);
  }
});
test('bounded warning path preserves real components, terminal assignments, ground and probes',async()=>{
  const p=await divider(),edge=p.drawing.edges[0];
  for(let i=0;i<160;i++)p.drawing.edges.push({id:`parallel${i}`,a:edge.a,b:edge.b,
    bends:Array.from({length:64},(_,j)=>({x:j,y:i}))});
  // Put redundant pairs first so the budget is reached before other heuristic pairs.
  p.drawing.edges.unshift(...p.drawing.edges.splice(-160));
  const r=cycle(p);
  assert.equal(r.warnings[0].code,'drawing-inspection-incomplete');
  const dc=ok(solveDC(assemble(r.project.document.circuit),r.project.document.experiment));
  near(dc.observations.out.value.re,8);
});
test('large drawings still fully reject structural and geometry corruption before warnings',()=>{
  for(const [change,code] of [
    [p=>p.drawing.edges[319].b='missing','missing-vertex'],
    [p=>p.drawing.edges[319].bends[63].x=1e6+1,'coordinate'],
    [p=>p.drawing.vertices.push({id:'island',kind:'free',x:0,y:0}),'unbound-component'],
    [p=>p.document.circuit.nodes.push('unbound'),'node-coverage'],
  ]) {
    const p=parallelWireProject();change(p);const before=structuredClone(p),r=validateProject(p);
    assert.equal(r.status,'invalid');assert.equal(r.diagnostics[0].code,code);
    assert.deepEqual(p,before);
  }
});
