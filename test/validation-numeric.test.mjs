import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {validateCircuit, validateExperiment, parseDocument, serializeDocument, ValidationError,
  assemble, solveDC, solveFrequency, transfer, extractFirstOrder, transient, initialize,
  sourceAt, complex, solveReal, solveLinear, div, abs, kronReduce, resistorLaplacian} from '../dist/index.js';
const fixture=async name=>parseDocument(await readFile(new URL(`../fixtures/${name}.json`,import.meta.url),'utf8'));
const near=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
const ok=r=>{assert.equal(r.status,'ok',r.message);return r;};

test('G: structural validation rejects invalid topology, values, observations, and model types',async()=>{
  const base=await fixture('divider');
  const mutations=[
    c=>c.schemaVersion=2, c=>c.nodes.push('in'), c=>c.nodes=c.nodes.filter(n=>n!=='0'),
    c=>c.components.push({...c.components[0]}),c=>c.components[1].p='missing',
    c=>c.components[1].value=0,c=>c.components[1].value=-1,c=>c.components[1].value=Infinity,c=>c.components[1].value=NaN,
    c=>c.components[1].value='1k',c=>c.components[1].type='diode',c=>c.components[0].dc=1,
    c=>c.observations.push({...c.observations[0]}),c=>c.observations[0].p='missing',
    c=>c.observations[0]={id:'out',type:'current',component:'missing'},c=>c.observations[0].type='power',
    c=>c.components[0].label=2,c=>c.nodes[0]='',c=>c.components[0]=null,c=>c.geometry={},
  ];
  for(const mutate of mutations) { const c=structuredClone(base.circuit);mutate(c);assert.throws(()=>validateCircuit(c),ValidationError); }
  assert.throws(()=>parseDocument('{broken'),ValidationError);
  assert.throws(()=>parseDocument('null'),ValidationError);
  for(const name of ['ccvs','cccs']) for(const control of ['missing','Rs']) {
    const d=await fixture(name);d.circuit.components.find(c=>c.id==='D').control=control;
    assert.throws(()=>assemble(d.circuit),/retained voltage-source/);
  }
  const d=await fixture('vccs');d.circuit.components.find(c=>c.id==='D').cp='missing';assert.throws(()=>assemble(d.circuit),ValidationError);
});

test('G: experiments explicitly validate sources, initialization, AC values, and waveform units',async()=>{
  const d=await fixture('rc');
  const mutations=[
    e=>e.schemaVersion=0,e=>e.sources=[],e=>e.sources.push({...e.sources[0]}),e=>e.sources[0].id='R',
    e=>e.sources[0].dc=NaN,e=>e.sources[0].ac.im=Infinity,e=>e.sources[0].ac.phase=2,
    e=>e.sources[0].waveform={type:'pulse'},e=>e.sources[0].waveform.at=Infinity,
    e=>e.initial={kind:'storage',values:[]},e=>e.initial.values.push({...e.initial.values[0]}),
    e=>e.initial.values[0].id='Vin',e=>e.initial.values[0].value=NaN,e=>e.initial={kind:'arbitrary'},
    e=>e.sources[0].waveform={type:'sinusoid',offset:0,amplitudePeak:1,frequencyHz:-1,phaseRadians:0},
    e=>e.sources[0].waveform={type:'sinusoid',offset:0,amplitude:1,frequencyHz:10,phaseRadians:0},
  ];
  for(const mutate of mutations) {const e=structuredClone(d.experiment);mutate(e);assert.throws(()=>validateExperiment(e,d.circuit),ValidationError);}
});

test('waveform conventions, physical RMS complex AC superposition, and JSON preserve all fields',async()=>{
  near(sourceAt({id:'V',dc:3},10),3);
  near(sourceAt({id:'V',dc:99,waveform:{type:'constant',value:4}},10),4);
  const step={id:'V',dc:99,waveform:{type:'step',at:2,before:-1,after:3}};
  near(sourceAt(step,2,'left'),-1);near(sourceAt(step,2,'right'),3);near(sourceAt(step,1),-1);
  const sine={id:'V',dc:10,waveform:{type:'sinusoid',offset:2,amplitudePeak:3,frequencyHz:50,phaseRadians:Math.PI/2}};
  near(sourceAt(sine,0),5);near(sourceAt(sine,.005),2);near(sourceAt(sine,.01),-1);
  const d=await fixture('divider');
  d.circuit.label='Labels survive';d.circuit.components[0].label='Input';d.circuit.observations[0].label='Measured output';
  d.experiment.sources[0].ac={re:3,im:4};d.experiment.sources[0].waveform=sine.waveform;
  const round=parseDocument(serializeDocument(d));assert.deepEqual(round,d);
  const r=ok(solveFrequency(assemble(d.circuit),d.experiment,complex(0,200)));
  near(r.observations.out.value.re,2);near(r.observations.out.value.im,8/3);
  const tr=ok(transient(assemble(d.circuit),d.experiment,{stop:.01,step:.0025}));
  for(const sample of tr.samples) near(sample.observations.out.value.re,sourceAt(d.experiment.sources[0],sample.time)*2/3);
  // A waveform overrides only transient values; dc and ac retain independent meanings.
  near(ok(solveDC(assemble(d.circuit),d.experiment)).observations.out.value.re,8);
});

test('numerics: complete pivoting, real/complex analytic solutions, equilibration, zero RHS',()=>{
  const real=ok(solveReal([[0,2],[3,4]],[4,11]));near(real.x[0].re,1);near(real.x[1].re,2);
  const scaled=ok(solveReal([[1e-20,2e-20],[3e20,4e20]],[5e-20,11e20]));near(scaled.x[0].re,1);near(scaled.x[1].re,2);
  const c=ok(solveLinear([[complex(1,1),complex(2)],[complex(0,1),complex(3,-1)]],[complex(9,1),complex(12,1)]));
  near(c.x[0].re,1);near(c.x[0].im,-2);near(c.x[1].re,3);near(c.x[1].im,1);
  const zero=ok(solveReal([[2,1],[1,3]],[0,0]));assert.equal(zero.scaledBackwardResidual,0);
  assert.equal(solveReal([[1,1],[1,1+1e-14]],[2,2]).status,'ill-conditioned');
  assert.equal(solveReal([[1,1],[1,1]],[2,2]).status,'nonunique');
  assert.equal(solveReal([[1,1],[1,1]],[2,3]).status,'inconsistent');
  assert.equal(solveReal([[1,1],[1,1]],[2,2+1e-14]).status,'ill-conditioned');
  assert.equal(solveReal([[Infinity]],[1]).status,'ill-conditioned');
  assert.equal(solveReal([[Number.MIN_VALUE]],[1]).status,'ill-conditioned');
  near(ok(solveReal([[Number.MIN_VALUE]],[Number.MIN_VALUE])).x[0].re,1);
  near(abs(div(complex(1e300,1e300),complex(1e300,-1e300))),1);
  assert.throws(()=>solveReal([[1]],[1],{currentAbsolute:0}),RangeError);
  assert.throws(()=>solveReal([[1,2]],[1]),RangeError);
});

test('restricted extractor rejects off-diagonal storage, singular algebraic block, and static circuits',async()=>{
  const d=await fixture('rc');d.circuit.components.find(c=>c.id==='C').n='in';
  assert.equal(extractFirstOrder(assemble(d.circuit),'Vin','out').status,'not-supported');
  const parallel=await fixture('forced-capacitor');assert.equal(extractFirstOrder(assemble(parallel.circuit),'Vin','out').status,'not-supported');
  const divider=await fixture('divider');assert.equal(extractFirstOrder(assemble(divider.circuit),'Vin','out').status,'not-supported');
  // An output can cancel a stable scalar mode; report the underlying denominator, not a stability claim.
  const rc=await fixture('rc');const result=ok(extractFirstOrder(assemble(rc.circuit),'Vin','in'));
  assert.equal(result.cancellation,true);near(result.denominatorRoot,-1000);assert.match(result.note,/does not establish internal stability/);
});

test('transients validate controls, limit work, handle simultaneous events and nonzero starting time',async()=>{
  const d=await fixture('rc'),a=assemble(d.circuit);
  for(const config of [{stop:1,step:0},{stop:0,step:1},{stop:NaN,step:1},{stop:1,step:1,maxSteps:0}]) assert.throws(()=>transient(a,d.experiment,config),RangeError);
  assert.equal(transient(a,d.experiment,{stop:1,step:.001,maxSteps:2}).status,'step-limit');
  assert.throws(()=>transfer(a,'missing','out',complex(0)),RangeError);
  assert.throws(()=>transfer(a,'Vin','out',complex(Infinity)),RangeError);
  assert.throws(()=>initialize(a,[complex(1,1)],[0]),RangeError);
  // Grounded current injection at exactly the same time as the voltage step, with continuous C state.
  const delayed=await fixture('rc-delayed-step'),at=.0012345;
  delayed.circuit.components.push({id:'Iaux',type:'I',p:'0',n:'out'});
  delayed.experiment.sources.push({id:'Iaux',dc:0,waveform:{type:'step',at,before:0,after:.001}});
  const result=ok(transient(assemble(delayed.circuit),delayed.experiment,{start:.001,stop:.002,step:.0001}));
  const event=result.samples.filter(s=>s.time===at);assert.equal(event.length,2);
  near(event[1].observations.out.value.re,0);near(event[1].observations.capacitor.value.re,.002);
  assert.equal(result.samples.at(-1).time,.002);
});

test('Kron rejects disconnected internal blocks and invalid resistor networks',()=>{
  const net={nodes:['a','b','x','y'],edges:[{id:'R1',p:'a',n:'b',resistance:1},{id:'R2',p:'x',n:'y',resistance:1}]};
  assert.equal(kronReduce(net,['a','b']).status,'nonunique');
  assert.throws(()=>kronReduce(net,[]),RangeError);assert.throws(()=>kronReduce(net,['a','a']),RangeError);
  assert.throws(()=>resistorLaplacian({nodes:['a'],edges:[{id:'R',p:'a',n:'missing',resistance:1}]}),RangeError);
  assert.throws(()=>resistorLaplacian({nodes:['a'],edges:[{id:'R',p:'a',n:'a',resistance:0}]}),RangeError);
});

test('all published native JSON fixtures validate and round-trip',async()=>{
  for(const name of await readdir(new URL('../fixtures',import.meta.url))) if(name.endsWith('.json')&&name!=='kron-star.json') {
    const d=await fixture(name.slice(0,-5));assert.deepEqual(parseDocument(serializeDocument(d)),d);
  }
});
