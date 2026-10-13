import test from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeRcFoster, synthesizeRc, serializeDocument, parseDocument,
  ExactBudget, parseExact, reduceFunction, verifyRcRealization } from '../dist/index.js';
const scales={referenceResistanceOhm:'1',referenceAngularFrequencyPerSecond:'1'};
const F={numerator:['3','4','1'],denominator:['0','2','1']};
const G={numerator:['0','2','1'],denominator:['3','4','1']};
const I=(decomposition={rInfinity:'1',kZero:'3/2',terms:[{pole:'2',residue:'1/2'}]},extra={})=>
  ({...scales,method:'foster-I',quantity:'impedance',decomposition,...extra});
const II=(decomposition={gZero:'0',cInfinity:'0',terms:[{pole:'1',coefficient:'1/2'},{pole:'3',coefficient:'1/2'}]},extra={})=>
  ({...scales,method:'foster-II',quantity:'admittance',decomposition,...extra});
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-9+1e-8*Math.max(Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const elements=r=>r.mathematical.sections.map(s=>s.elements.map(e=>`${e.kind}:${e.value}`));
function checked(input) {
  const result=synthesizeRcFoster(input);
  assert.equal(result.mathematical.status,'certified',JSON.stringify(result.mathematical));
  assert.equal(result.native.status,'generated',result.native.reason);
  assert.equal(result.verification.status,'passed',result.verification.reason);
  assert.equal(result.verification.samples.length,7);
  for(const sample of result.verification.samples){
    assert.ok(sample.normalizedImpedance.passed && sample.normalizedAdmittance.passed);
    assert.ok(sample.currentTest.residuals.every(r=>r.passed));
    assert.ok(sample.voltageTest.residuals.every(r=>r.passed));
    assert.ok(sample.currentTest.groundKcl.passed && sample.voltageTest.groundKcl.passed);
    assert.equal(sample.power.length,sample.kind==='RMS'?2:0);
    assert.ok(sample.power.every(p=>p.passed && p.branchesVA.re>=0 && p.branchesVA.im<=0));
  }
  const doc=result.native.document;
  assert.deepEqual(parseDocument(serializeDocument(doc)),doc);
  assert.deepEqual(doc.experiment.sources,[]);
  assert.deepEqual(doc.experiment.initial.values,doc.circuit.components.filter(c=>c.type==='C').map(c=>({id:c.id,value:0})));
  return result;
}
test('principal Foster I exact identity and actual series-connected parallel section',()=>{
  const r=checked(I(undefined,{target:F}));
  assert.deepEqual(elements(r),[['R:1'],['C:2/3'],['R:1/4','C:2']]);
  assert.deepEqual(r.mathematical.reconstructed,F);
  assert.deepEqual(r.mathematical.sections.map(s=>s.connection),['resistor','capacitor','parallel-RC']);
  assert.deepEqual(r.native.document.circuit.components.map(c=>[c.type,c.p,c.n]),
    [['R','port','n1'],['C','n1','n2'],['R','n2','0'],['C','n2','0']]);
  assert.deepEqual(r.mathematical.impedanceLimits,{dc:{kind:'pole',order:1,coefficient:'3/2'},infinity:{kind:'finite',value:'1'}});
  assert.ok(r.mathematical.targetEvidence.identity);
  assert.ok(r.mathematical.sections.every(s=>s.identity && s.componentIds.length===s.elements.length));
});
test('principal Foster II identity and actual parallel-connected series branches',()=>{
  const r=checked(II(undefined,{target:G}));
  assert.deepEqual(elements(r),[['R:2','C:1/2'],['R:2','C:1/6']]);
  assert.deepEqual(r.mathematical.reconstructed,G);
  assert.deepEqual(r.mathematical.impedanceTarget,F);
  assert.deepEqual(r.native.document.circuit.components.map(c=>[c.type,c.p,c.n]),
    [['R','port','n1'],['C','n1','0'],['R','port','n2'],['C','n2','0']]);
  assert.ok(r.mathematical.sections.every(s=>s.connection==='series-RC'));
  assert.deepEqual(r.mathematical.limits,{dc:{kind:'finite',value:'0'},infinity:{kind:'finite',value:'1'}});
});
test('three physical realizations independently match prescribed Z and Y under multiple SI scales',()=>{
  for(const [referenceResistanceOhm,referenceAngularFrequencyPerSecond] of [['1','1'],['1000','1000'],['47','13'],['.1','1000000']]){
    const scaling={referenceResistanceOhm,referenceAngularFrequencyPerSecond};
    const a=checked(I(undefined,{...scaling,target:F}));
    const b=checked(II(undefined,{...scaling,target:G}));
    const c=synthesizeRc({method:'cauer-infinity',quantity:'impedance',...scaling,...F});
    assert.equal(c.verification.status,'passed',c.verification.reason);
    const ref=Number(referenceResistanceOhm);
    for(const result of [a,b,c]){
      assert.equal(result.native.document.circuit.components.length,4);
      const sample=result.verification.samples[2];
      near(sample.impedanceOhm.re,6/5*ref); near(sample.impedanceOhm.im,-8/5*ref);
      near(sample.admittanceSiemens.re,3/10/ref); near(sample.admittanceSiemens.im,4/10/ref);
      // Public port API round-trips rad/s through Hz; verify that actual coordinate.
      assert.equal(sample.sPerSecond.im,2*Math.PI*(Number(referenceAngularFrequencyPerSecond)/(2*Math.PI)));
    }
    const topology=r=>r.native.document.circuit.components.map(d=>[d.type,d.p,d.n]);
    assert.notDeepEqual(topology(a),topology(b)); assert.notDeepEqual(topology(a),topology(c)); assert.notDeepEqual(topology(b),topology(c));
  }
});
for(const [name,request,expected,z] of [
 ['constant impedance',I({rInfinity:'2',kZero:'0',terms:[]}),[['R:2']],[2,0]],
 ['constant admittance',II({gZero:'2',cInfinity:'0',terms:[]}),[['R:1/2']],[.5,0]],
 ['capacitive impedance',I({rInfinity:'0',kZero:'3',terms:[]}),[['C:1/3']],[0,-3]],
 ['capacitive admittance',II({gZero:'0',cInfinity:'3',terms:[]}),[['C:3']],[0,-1/3]],
 ['single impedance pole',I({rInfinity:'0',kZero:'0',terms:[{pole:'2',residue:'3'}]}),[['R:3/2','C:1/3']],[6/5,-3/5]],
 ['single admittance term',II({gZero:'0',cInfinity:'0',terms:[{pole:'2',coefficient:'3'}]}),[['R:1/3','C:3/2']],[1/3,-2/3]],
])test(`elementary ${name} omits absent endpoints`,()=>{
 const r=checked(request); assert.deepEqual(elements(r),expected);
 near(r.verification.samples[2].impedanceOhm.re,z[0]); near(r.verification.samples[2].impedanceOhm.im,z[1]);
 assert.ok(r.native.elements.every(e=>e.value>0 && Number.isFinite(e.value)));
});
test('nonzero Foster II endpoints and negative ordinary residues have positive physical branches',()=>{
  // G=2+3z+4z/(z+5)=(10+21z+3z²)/(z+5). Residue at -5 is -20.
  const r=checked(II({gZero:'2',cInfinity:'3',terms:[{pole:'5',coefficient:'4'}]},
    {target:{numerator:['10','21','3'],denominator:['5','1']}}));
  assert.deepEqual(elements(r),[['R:1/2'],['C:3'],['R:1/4','C:4/5']]);
  assert.deepEqual(r.mathematical.limits,{dc:{kind:'finite',value:'2'},infinity:{kind:'pole',order:1,coefficient:'3'}});
  near(r.verification.samples[2].admittanceSiemens.re,28/13);
  near(r.verification.samples[2].admittanceSiemens.im,49/13);
});
for(const method of ['I','II'])test(`Foster ${method} combines exact duplicates and sorts rational rates`,()=>{
 const entries=[{pole:'3',value:'1/2'},{pole:'1.0',value:'1/3'},{pole:'2/2',value:'1/6'}];
 const request=method==='I'?I({rInfinity:'1',kZero:'1',terms:entries.map(t=>({pole:t.pole,residue:t.value}))}):
  II({gZero:'1',cInfinity:'1',terms:entries.map(t=>({pole:t.pole,coefficient:t.value}))});
 const r=checked(request);
 assert.deepEqual(r.mathematical.poleGroups,[{pole:'1',coefficient:'1/2',sourceIndices:[1,2]},{pole:'3',coefficient:'1/2',sourceIndices:[0]}]);
 assert.equal(r.mathematical.sections.length,4);
});
for(const method of ['I','II'])test(`Foster ${method} keeps poles separated by 1e-12`,()=>{
 const terms=[{pole:'1.000000000001',value:'1'},{pole:'1',value:'1'}];
 const request=method==='I'?I({rInfinity:'0',kZero:'0',terms:terms.map(t=>({pole:t.pole,residue:t.value}))},
  {target:{numerator:['2.000000000001','2'],denominator:['1.000000000001','2.000000000001','1']}}):
  II({gZero:'0',cInfinity:'0',terms:terms.map(t=>({pole:t.pole,coefficient:t.value}))},
  {target:{numerator:['0','2.000000000001','2'],denominator:['1.000000000001','2.000000000001','1']}});
 const r=checked(request);
 assert.deepEqual(r.mathematical.poleGroups.map(t=>t.pole),['1','1000000000001/1000000000000']);
 assert.equal(r.mathematical.sections.length,2);
 assert.equal(r.native.document.circuit.components.length,4);
});
test('invalid signs never obtain a certificate, including duplicates that could cancel',()=>{
 for(const request of [I({rInfinity:'-1',kZero:'0',terms:[]}),I({rInfinity:'0',kZero:'-1',terms:[]}),
  II({gZero:'-1',cInfinity:'0',terms:[]}),II({gZero:'0',cInfinity:'-1',terms:[]}),
  I({rInfinity:'0',kZero:'0',terms:[{pole:'1',residue:'-1'},{pole:'1',residue:'2'}]}),
  II({gZero:'0',cInfinity:'0',terms:[{pole:'1',coefficient:'-1'}]}),
  I({rInfinity:'0',kZero:'0',terms:[{pole:'0',residue:'1'}]}),
  II({gZero:'0',cInfinity:'0',terms:[{pole:'-1',coefficient:'1'}]}),
  I({rInfinity:'0',kZero:'0',terms:[{pole:'1',residue:'0'}]})]){
   const r=synthesizeRcFoster(request); assert.equal(r.mathematical.status,'invalid-decomposition');assert.equal(r.native.status,'unavailable');
 }
});
test('strict malformed inputs and representation distinctions',()=>{
 for(const request of [null,{...I(),quantity:'admittance'},{...I(),method:'foster'}, {...I(),extra:true},
  {...I(),referenceResistanceOhm:'0'},{...I(),referenceAngularFrequencyPerSecond:'NaN'},
  I({rInfinity:'1/0',kZero:'0',terms:[]}),I({rInfinity:1,kZero:'0',terms:[]}),
  I({rInfinity:'0',kZero:'0',terms:[{pole:'sqrt(2)',residue:'1'}]}),
  I({rInfinity:'0',kZero:'0',terms:[{pole:'1',coefficient:'1'}]}),
  {...I(),target:{numerator:['1'],denominator:['0']}},
  {...I(),decomposition:null},I({rInfinity:'0',kZero:'0',terms:Array(2)})])assert.equal(synthesizeRcFoster(request).mathematical.status,'invalid-input');
 const request={...I(),target:{numerator:['3','4','1'],denominator:['1','3','1']}};
 delete request.decomposition;
 assert.equal(synthesizeRcFoster(request).mathematical.status,'decomposition-unavailable');
 assert.equal(synthesizeRc({method:'cauer-infinity',quantity:'impedance',...scales,...request.target}).mathematical.status,'certified');
});
test('exact supplied-target mismatch cannot pass even with apparently passive decomposition',()=>{
 for(const request of [I(undefined,{target:{numerator:['3.000000000001','4','1'],denominator:['0','2','1']}}),II(undefined,{target:F})]){
 const r=synthesizeRcFoster(request);assert.equal(r.mathematical.status,'invalid-decomposition');assert.match(r.mathematical.reason,/target/);
 }
});
test('target common factors are reduced exactly and reported',()=>{
 const r=checked(I({rInfinity:'1',kZero:'0',terms:[{pole:'1',residue:'1'}]},
  {target:{numerator:['2','3','1'],denominator:['1','2','1']}}));
 assert.deepEqual(r.mathematical.targetEvidence.canceledFactor,['1','1']);
 assert.deepEqual(r.mathematical.reconstructed,{numerator:['2','1'],denominator:['1','1']});
});
test('zero F and G report short/open without native stand-ins; target is still checked',()=>{
 for(const [request,boundary] of [[I({rInfinity:'0',kZero:'0',terms:[]}), 'short'],[II({gZero:'0',cInfinity:'0',terms:[]}), 'open']]){
  const r=synthesizeRcFoster({...request,target:{numerator:['0'],denominator:['1']}});
  assert.equal(r.mathematical.status,'boundary'); assert.equal(r.mathematical.boundary,boundary);
  assert.equal(r.native.status,'unavailable');assert.equal(r.verification.status,'unresolved');
  assert.equal(synthesizeRcFoster({...request,target:{numerator:['1'],denominator:['1']}}).mathematical.status,'invalid-decomposition');
 }
});
test('native IDs are unique across namespaces; verifier safely allocates colliding test-source names',()=>{
 for(const request of [I(),II()]){
  const r=checked(request), doc=r.native.document;
  const ids=[...doc.circuit.nodes,...doc.circuit.components.map(c=>c.id),...doc.circuit.observations.map(o=>o.id)];
  assert.equal(new Set(ids).size,ids.length);
  // Change exact IDs to names the temporary tests want and prototype/markup names.
  const names=['__z_test','__y_clamp','__synthesis_test','__proto__'];
  for(let index=0;index<doc.circuit.components.length;index++){
   const old=doc.circuit.components[index].id;
   doc.circuit.components[index].id=names[index];
   const storage=doc.experiment.initial.values.find(v=>v.id===old);if(storage)storage.id=names[index];
  }
  doc.circuit.observations[0].id='a,<b>x</b> "q"';
  const b=new ExactBudget(), p=xs=>xs.map(x=>parseExact(x,b));
  const target=reduceFunction(p(F.numerator),p(F.denominator),b).value;
  const verification=verifyRcRealization(parseDocument(serializeDocument(doc)),target,parseExact('1',b),parseExact('1',b),b);
  assert.equal(verification.status,'passed',verification.reason);
 }
});
test('native range failure retains exact Foster certificate',()=>{
 for(const value of ['1e400','1e-400','1e-310']){
  const r=synthesizeRcFoster(I({rInfinity:value,kZero:'0',terms:[]}));
  assert.equal(r.mathematical.status,'certified');assert.equal(r.native.status,'unavailable');assert.equal(r.verification.status,'unresolved');
 }
 const r=synthesizeRcFoster(II({gZero:'0',cInfinity:'1e400',terms:[]}));
 assert.equal(r.mathematical.status,'certified');assert.equal(r.native.status,'unavailable');
});
test('physical range failure preserves certificate and generated document',()=>{
 const r=synthesizeRcFoster(I({rInfinity:'2',kZero:'0',terms:[]},{referenceAngularFrequencyPerSecond:'1e400'}));
 assert.equal(r.mathematical.status,'certified');assert.equal(r.native.status,'generated');assert.equal(r.verification.status,'unresolved');
});
test('resource ceilings bound raw terms, degree, parser and reconstruction without invalid-realizability claims',()=>{
 for(const [request,limits] of [[I(),{operations:10}],[I(),{bits:2}],[I(),{degree:1}],
  [I({rInfinity:'1e2049',kZero:'0',terms:[]}),{}],
  [I({rInfinity:'1'.repeat(1025),kZero:'0',terms:[]}),{}],
  [I({rInfinity:'0',kZero:'0',terms:Array.from({length:17},()=>({pole:'1',residue:'1'}))}),{}],
  [II({gZero:'0',cInfinity:'1',terms:Array.from({length:8},(_,i)=>({pole:String(i+1),coefficient:'1'}))}),{}]]){
  const r=synthesizeRcFoster(request,limits);assert.equal(r.mathematical.status,'resource-limit',JSON.stringify(r.mathematical));assert.ok(r.mathematical.stage);
 }
 assert.equal(synthesizeRcFoster(I(),{operations:1000001}).mathematical.status,'invalid-input');
});
test('budget failures retain their stage and preserve completed mathematical certificates',()=>{
 for(const [operations,stage] of [[10,'input'],[1000,'section reconstruction'],[3500,'target identity']]){
  const r=synthesizeRcFoster(I(),{operations});assert.equal(r.mathematical.status,'resource-limit');assert.match(r.mathematical.stage,new RegExp(stage));
 }
 const native=synthesizeRcFoster(I(),{operations:4000});
 assert.equal(native.mathematical.status,'certified');assert.equal(native.native.status,'unavailable');assert.match(native.native.reason,/operations budget/);
 const numerical=synthesizeRcFoster(I(),{operations:4500});
 assert.equal(numerical.mathematical.status,'certified');assert.equal(numerical.native.status,'generated');
 assert.equal(numerical.verification.status,'unresolved');assert.match(numerical.verification.reason,/operations budget/);
});
test('near-cancellation physical KCL failure remains unresolved without revoking the certificate',()=>{
 const r=synthesizeRcFoster(I({rInfinity:'1',kZero:'0',terms:[{pole:'1',residue:'1e-12'}]}));
 assert.equal(r.mathematical.status,'certified');assert.equal(r.native.status,'generated');
 assert.equal(r.verification.status,'unresolved');assert.match(r.verification.reason,/ill-conditioned.*KCL/);
});
for(const method of ['I','II'])test(`degree-eight Foster ${method} verifies within unchanged ceilings`,()=>{
 const terms=Array.from({length:8},(_,i)=>({pole:String(i+1),value:'1'}));
 const request=method==='I'?I({rInfinity:'0',kZero:'0',terms:terms.map(t=>({pole:t.pole,residue:t.value}))}):
  II({gZero:'0',cInfinity:'0',terms:terms.map(t=>({pole:t.pole,coefficient:t.value}))});
 const r=checked(request);
 assert.equal(r.mathematical.sections.length,8);assert.equal(r.native.document.circuit.components.length,16);
 // Independently sum k/(p+i) or a*i/(p+i), rather than evaluate a generated ladder.
 let real=0,imaginary=0;
 for(let p=1;p<=8;p++){
  real+=(method==='I'?p:1)/(p*p+1);
  imaginary+=(method==='I'?-1:p)/(p*p+1);
 }
 const value=method==='I'?r.verification.samples[2].impedanceOhm:r.verification.samples[2].admittanceSiemens;
 near(value.re,real);near(value.im,imaginary);
});
test('wrong Foster physical connection fails independent polynomial-response verification',()=>{
 const r=checked(I());
 const doc=r.native.document;
 // Ground the series capacitor: a tempting but incorrect Cauer-like connection.
 doc.circuit.components.find(c=>c.id==='C1').n='0';
 const b=new ExactBudget(), p=xs=>xs.map(x=>parseExact(x,b));
 const target=reduceFunction(p(F.numerator),p(F.denominator),b).value;
 const wrong=verifyRcRealization(doc,target,parseExact('1',b),parseExact('1',b),b);
 assert.equal(wrong.status,'mismatch');
});
test('canonicalization owns its data and records SI conversion discrepancies',()=>{
 const request=II({gZero:'0',cInfinity:'0',terms:[{pole:'3',coefficient:'1/2'},{pole:'1',coefficient:'1/2'}]},
  {referenceResistanceOhm:'1000',referenceAngularFrequencyPerSecond:'1000',target:G});
 const before=JSON.stringify(request), r=checked(request);
 assert.equal(JSON.stringify(request),before);
 assert.deepEqual(r.native.elements.map(e=>e.exactSI),['2000','1/2000000','2000','1/6000000']);
 assert.ok(r.native.elements.some(e=>e.discrepancy!=='0'));
 assert.ok(r.native.elements.every(e=>e.relativeError<=8*Number.EPSILON));
});
