import test from 'node:test';
import assert from 'node:assert/strict';
import {generateTopologyLayout,recognizeLayout,constructLayout,verifyLayout,nativeCandidate,wirePoints,vertexPoint,
  renderWiringSvg,fitWiring,exportProject,parseProject,projectContentKey} from '../dist/layout-test.js';
import {assemble,solveDC,transfer,analyzePorts,validateDocument} from '../dist/index.js';
import {fixture,examples,parallel,synthesis} from './support/layout-fixtures.mjs';
const good=result=>{assert.equal(result.status,'generated',result.reason);return result;};
const ok=result=>{assert.equal(result.status,'ok',result.message);return result;};
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const geometry=g=>({placements:g.placements,points:g.points,routes:g.routes,edges:g.edges});

// Independently walk ideal wires, never device interiors or geometric proximity.
function checkPartition(document,g) {
  const adjacent=new Map(g.vertices.map(v=>[v.key,[]]));
  for(const e of g.edges){adjacent.get(e.a).push(e.b);adjacent.get(e.b).push(e.a);}
  for(const c of document.circuit.components){
    const d=g.devices.find(d=>d.id===c.id);
    for(const t of d.terminals){
      const reached=new Set([t.vertex]),queue=[t.vertex];
      for(let i=0;i<queue.length;i++)for(const v of adjacent.get(queue[i]))if(!reached.has(v)){reached.add(v);queue.push(v);}
      const names=g.names.filter(n=>reached.has(n.vertex));assert.equal(names.length,1);assert.equal(names[0].name,c[t.role]);
      for(const other of g.devices)for(const terminal of other.terminals){
        const native=document.circuit.components.find(c=>c.id===other.id);
        assert.equal(reached.has(terminal.vertex),native[terminal.role]===c[t.role]);
      }
    }
  }
}
for(const example of examples())test(`${example.name}: complete witness, native partition and drift-free project`,()=>{
  const {document,options,family}=example,before=structuredClone(document),r=good(generateTopologyLayout(document,options));
  assert.equal(r.witness.family,family);assert.deepEqual(document,before);
  assert.deepEqual(nativeCandidate(r.graph).document,document);checkPartition(document,r.graph);
  assert.equal(r.evidence.segmentPairs,r.evidence.segmentCount*(r.evidence.segmentCount-1)/2);
  assert.equal(r.evidence.geometryComplete,true);assert.deepEqual(r.evidence.issues,[]);
  assert.deepEqual(generateTopologyLayout(document,options),r);
  let project=r.project;const key=ok(projectContentKey(project)).key;
  for(let i=0;i<3;i++){
    const reopened=ok(parseProject(JSON.stringify(project)));project=ok(exportProject(reopened.graph)).project;
    assert.equal(ok(projectContentKey(project)).key,key);
    assert.deepEqual(project.document,document);
  }
  const svg=renderWiringSvg(r.graph,null,fitWiring(r.graph),null);
  assert.ok(!svg.includes('NaN'));assert.ok(!svg.includes('Infinity'));
});
for(const example of examples())test(`${example.name}: values, exact ID renames and reversed device roles preserve geometry`,()=>{
  const {document,options}=example,original=good(generateTopologyLayout(document,options));
  const changed=structuredClone(document);
  for(const c of changed.circuit.components)if('value'in c)c.value*=2;
  assert.deepEqual(geometry(good(generateTopologyLayout(changed,options)).graph),geometry(original.graph));
  const nodes=new Map(changed.circuit.nodes.map((n,i)=>[n,n==='0'?'0':['__proto__','a,b','<em>x</em>','  space  ','Ө'][i]??`n${i}`]));
  const ids=new Map(changed.circuit.components.map((c,i)=>[c.id,i===0?'__proto__':i===1?'<b>R</b>':`D,${i}`]));
  changed.circuit.nodes=changed.circuit.nodes.map(n=>nodes.get(n));
  for(const c of changed.circuit.components){c.id=ids.get(c.id);c.p=nodes.get(c.p);c.n=nodes.get(c.n);}
  for(const o of changed.circuit.observations)if(o.type==='voltage'){o.p=nodes.get(o.p);o.n=nodes.get(o.n);}else o.component=ids.get(o.component);
  for(const s of changed.experiment.sources)s.id=ids.get(s.id);
  if(changed.experiment.initial.kind==='storage')for(const s of changed.experiment.initial.values)s.id=ids.get(s.id);
  const renamed=good(generateTopologyLayout(changed,options.port?{port:options.port.map(n=>nodes.get(n))}:{}));
  assert.equal(renamed.witness.family,original.witness.family);assert.deepEqual(geometry(renamed.graph),geometry(original.graph));
  assert.ok(renderWiringSvg(renamed.graph,null,fitWiring(renamed.graph),null).includes('&lt;b&gt;R&lt;/b&gt;'));
  // Explicit port fixes orientation even when the independent source reverses.
  for(const c of changed.circuit.components)[c.p,c.n]=[c.n,c.p];
  const reversed=good(generateTopologyLayout(changed,{port:[nodes.get(original.witness.p),nodes.get(original.witness.q)]}));
  checkPartition(changed,reversed.graph);
  reversed.graph.placements.forEach((p,i)=>assert.equal(p.turns,(renamed.graph.placements[i].turns+2)%4));
});
test('template geometry independently expresses source/return, shunt, bridge midpoints and distinct Foster structures',()=>{
  const results=new Map(examples().map(e=>[e.name,good(generateTopologyLayout(e.document,e.options))]));
  const rc=results.get('rc-low');const position=id=>rc.graph.placements[rc.graph.devices.findIndex(d=>d.id===id)];
  assert.ok(position('Vin').x<position('R').x);assert.equal(position('R').y,0);assert.equal(position('C').turns,1);assert.ok(position('C').y>position('R').y);
  const bridge=results.get('bridge-balanced'),w=bridge.witness,g=bridge.graph;
  const left=g.points.find(p=>p.key===g.names.find(n=>n.name===w.midpoints[0]).vertex);
  const right=g.points.find(p=>p.key===g.names.find(n=>n.name===w.midpoints[1]).vertex);
  assert.equal(left.y,right.y);assert.ok(left.x<right.x);assert.equal(g.placements[w.cross].y,left.y);
  assert.deepEqual(geometry(g),geometry(results.get('bridge-unbalanced').graph));
  assert.deepEqual(results.get('cauer').witness.stages.map(s=>[s.series,s.shunt]),[[0,undefined],[2,1],[undefined,3]]);
  assert.deepEqual(results.get('foster-I').witness.sections.map(s=>s.edges.length),[1,1,2]);
  assert.deepEqual(results.get('foster-II').witness.paths.map(p=>p.edges.length),[2,2]);
});
test('unused exact names, source waveforms, labels and storage remain native-owned',()=>{
  const d=fixture('rc');d.circuit.nodes.unshift('unused, <x>');d.circuit.label='exact';d.experiment.label='wave';
  d.experiment.sources[0].waveform={type:'sinusoid',offset:2,amplitudePeak:3,frequencyHz:19,phaseRadians:-.2};
  const r=good(generateTopologyLayout(d));assert.deepEqual(nativeCandidate(r.graph).document,d);
  const v=r.graph.names.find(n=>n.name==='unused, <x>').vertex;
  assert.equal(r.graph.edges.filter(e=>e.a===v||e.b===v).length,0);
});
test('independent divider DC, current orientation and signed power',()=>{
  const d=good(generateTopologyLayout(fixture('divider'))).project.document;
  const result=ok(solveDC(assemble(d.circuit),d.experiment));
  near(result.observations.out.value.re,8);near(result.observations.r1i.value.re,.004);near(result.observations.source.value.re,-.004);
  near(12*result.observations.source.value.re,-.048);near(1000*.004**2+2000*.004**2,.048);
});
test('independent RC low/high, RL and RLC frequency laws',()=>{
  for(const [name,omega,expected]of[['rc-low',1000,[.5,-.5]],['rc-high',1000,[.5,.5]],['rl',1000,[.5,.5]],['rlc',10000,[0,-10]]]){
    const e=examples().find(e=>e.name===name),d=good(generateTopologyLayout(e.document,e.options)).project.document;
    const value=ok(transfer(assemble(d.circuit),'Vin','out',{re:0,im:omega})).transfer.value;
    near(value.re,expected[0]);near(value.im,expected[1]);
  }
});
test('independent bridge loading equations survive drawing construction',()=>{
  for(const [name,l,r,i]of[['bridge-balanced',5,5,0],['bridge-unbalanced',70/13,80/13,-1/1300]]){
    const e=examples().find(e=>e.name===name),d=good(generateTopologyLayout(e.document)).document;
    const result=ok(solveDC(assemble(d.circuit),d.experiment));near(result.observations.left.value.re,l);near(result.observations.right.value.re,r);near(result.observations.cross.value.re,i);
  }
});
test('independent terminal impedance for three physically distinct synthesis layouts',()=>{
  for(const d of synthesis()){
    const r=good(generateTopologyLayout(d,{port:['port','0']}));
    const result=ok(analyzePorts(r.project.document,{ports:[{p:'port',q:'0'}],frequencyHz:1000/(2*Math.PI)}));
    const z=ok(result.z).values[0][0];near(z.re,1200);near(z.im,-1600);
  }
});
test('source-free parallel resistor and series-RC branch impedance',()=>{
  for(const [d,expected]of[[parallel(),[2000/3,0]],[parallel(true),[700,-100]]]){
    const r=good(generateTopologyLayout(d,{port:['port','0']}));
    const z=ok(analyzePorts(r.document,{ports:[{p:'port',q:'0'}],frequencyHz:1000/(2*Math.PI)})).z.values[0][0];
    near(z.re,expected[0]);near(z.im,expected[1]);
  }
});
test('native-only API never rearranges saved geometry or mutates failure inputs',()=>{
  const project=good(generateTopologyLayout(fixture('divider'))).project,before=structuredClone(project);
  assert.equal(generateTopologyLayout(project).status,'invalid');assert.deepEqual(project,before);
  for(const input of [null,{}, {circuit:{schemaVersion:100}}])assert.equal(generateTopologyLayout(input).status,'invalid');
  assert.equal(generateTopologyLayout(fixture('cccs')).status,'unsupported');
});
test('explicit ports, ambiguous forks, self-loops, disconnected edges and size have honest fallbacks',()=>{
  assert.match(generateTopologyLayout(parallel()).reason,/port-required/);
  assert.match(generateTopologyLayout(parallel(),{port:['port','port']}).reason,/invalid-port/);
  for(const edit of [d=>d.circuit.components.push({id:'extra',type:'R',p:'in',n:'out',value:1}),
    d=>d.circuit.components.push({id:'loop',type:'R',p:'out',n:'out',value:1}),
    d=>{d.circuit.nodes.push('a','b');d.circuit.components.push({id:'island',type:'R',p:'a',n:'b',value:1});},
    d=>{for(let i=0;i<17;i++)d.circuit.components.push({id:`large${i}`,type:'R',p:'in',n:'out',value:1});}]){
    const d=fixture('divider');edit(d);validateDocument(d);const before=structuredClone(d),r=generateTopologyLayout(d);
    assert.equal(r.status,'unrecognized');assert.deepEqual(d,before);assert.deepEqual(r.document,d);
  }
});
test('independent verifier rejects scientifically changed graph and geometric corruption',()=>{
  const d=fixture('divider'),r=good(generateTopologyLayout(d));
  for(const [edit,code]of[
    [g=>g.devices[1].value='2000','native-content-changed'],
    [g=>Object.assign(g.placements[2],{x:g.placements[1].x,y:g.placements[1].y}),'symbol-overlap'],
    [g=>g.routes[0].bends=[vertexPoint(g,g.edges[0].a)],'zero-segment'],
    [g=>g.routes[0].bends=[{x:200,y:77}],'non-orthogonal'],
    [g=>g.routes[0].bends=[{x:g.placements[1].x,y:g.placements[1].y}],'wire-through-symbol'],
  ]){const g=structuredClone(r.graph);edit(g);assert.ok(verifyLayout(d,g).evidence.issues.includes(code),code);}
});
test('geometry checks cannot pass through an exhausted optional project warning budget',()=>{
  const d=fixture('divider'),r=good(generateTopologyLayout(d));
  const g=structuredClone(r.graph);g.routes[0].bends=Array.from({length:17},(_,i)=>({x:i,y:0}));
  const evidence=verifyLayout(d,g).evidence;assert.equal(evidence.geometryComplete,false);assert.ok(evidence.issues.includes('geometry-domain'));
});
test('wire-only crossings, hidden dots and label collisions fail quality without changing science',()=>{
  const d=fixture('divider');d.circuit.nodes.push('unused');
  const r=good(generateTopologyLayout(d));
  const g=structuredClone(r.graph),unused=g.points.find(p=>p.key===g.names.find(n=>n.name==='unused').vertex);
  const edge=g.edges.find(e=>{const p=wirePoints(g,e.key);return p.length===2 && p[0].y===0 && p[1].y===0;});
  const [a,b]=wirePoints(g,edge.key);Object.assign(unused,{x:(a.x+b.x)/2,y:0});
  const checked=verifyLayout(d,g);assert.equal(checked.evidence.nativeEqual,true);assert.equal(checked.evidence.projectValid,true);
  assert.ok(checked.evidence.issues.includes('unjoined-or-hidden-vertex'));
  const h=structuredClone(r.graph),line=h.edges[0],endpoints=wirePoints(h,line.key),p=h.placements[1];
  h.routes.find(route=>route.key===line.key).bends=[{x:endpoints[0].x,y:p.y+44},{x:p.x,y:p.y+44},{x:endpoints.at(-1).x,y:p.y+44}];
  const label=verifyLayout(d,h).evidence;assert.equal(label.nativeEqual,true);assert.ok(label.issues.includes('wire-through-value-label'));
});
test('ground at an internal node remains the same reference, not the caller return',()=>{
  const d=fixture('divider');
  const rename=n=>n==='out'?'0':n==='0'?'return':n;
  d.circuit.nodes=d.circuit.nodes.map(rename);
  for(const c of d.circuit.components){c.p=rename(c.p);c.n=rename(c.n);}
  for(const o of d.circuit.observations)if(o.type==='voltage'){o.p=rename(o.p);o.n=rename(o.n);}
  const r=good(generateTopologyLayout(d));assert.equal(r.witness.q,'return');
  assert.equal(r.graph.names.find(n=>n.vertex===r.graph.reference).name,'0');
  assert.deepEqual(nativeCandidate(r.graph).document,d);
});
test('a structurally recognized overlong layout is rejected explicitly without partial geometry',()=>{
  const d=fixture('divider');
  d.circuit.components=d.circuit.components.filter(c=>c.id!=='R1');
  let previous='in';
  for(let i=0;i<12;i++){
    const next=i===11?'out':`chain${i}`;if(i!==11)d.circuit.nodes.push(next);
    d.circuit.components.push({id:i===0?'R1':`long${i}`,type:'R',p:previous,n:next,value:1000});previous=next;
  }
  const before=structuredClone(d);validateDocument(d);
  assert.equal(recognizeLayout(d).status,'recognized');
  const r=generateTopologyLayout(d);assert.equal(r.status,'quality-rejected');assert.match(r.reason,/aspect-ratio/);
  assert.equal('graph'in r,false);assert.deepEqual(d,before);
});
test('prototype-property node IDs and reversed ordered ports are exact data',()=>{
  const d=parallel();d.circuit.nodes=['__proto__','0'];
  for(const c of d.circuit.components){if(c.p==='port')c.p='__proto__';if(c.n==='port')c.n='__proto__';}
  d.circuit.observations[0].p='__proto__';
  const r=good(generateTopologyLayout(d,{port:['0','__proto__']}));
  assert.equal(r.witness.p,'0');assert.equal(r.witness.q,'__proto__');checkPartition(d,r.graph);
  assert.deepEqual(nativeCandidate(r.graph).document,d);
  assert.ok(renderWiringSvg(r.graph,null,fitWiring(r.graph),null).includes('__proto__'));
});
test('consumed dangling path is not a ladder to an unused return node',()=>{
  for(const powered of [false,true]){
    const d={circuit:{schemaVersion:1,nodes:['0','port','dangling'],components:[
      ...(powered?[{id:'V',type:'V',p:'port',n:'0'}]:[]),
      {id:'R',type:'R',p:'port',n:'dangling',value:1000}],observations:[]},
      experiment:{schemaVersion:1,sources:powered?[{id:'V',dc:1}]:[],initial:{kind:'equilibrium'}}};
    validateDocument(d);
    assert.equal(generateTopologyLayout(d,{port:['port','0']}).status,'unrecognized');
  }
});
