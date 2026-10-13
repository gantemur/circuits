import test from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeRc, ExactBudget, ExactResourceError, parseExact, exactString, exactToNumber,
  exactFromNumber, exactAdd, exactSubtract, exactMultiply, exactDivide, polynomialDivide,
  polynomialGcd, reduceFunction, functionLimit, verifyRcRealization,
  parseDocument, serializeDocument, assemble, solveFrequency, analyzePorts } from '../dist/index.js';

const input = (numerator, denominator, extra = {}) => ({ quantity: 'impedance', method: 'cauer-infinity',
  numerator, denominator, referenceResistanceOhm: '1', referenceAngularFrequencyPerSecond: '1', ...extra });
const main = (extra = {}) => input(['3','4','1'], ['0','2','1'], extra);
const synth = (n,d,extra) => synthesizeRc(input(n,d,extra));
const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual-expected) <= tolerance*Math.max(1,Math.abs(expected)), `${actual} != ${expected}`);
function successful(result) {
  assert.equal(result.mathematical.status, 'certified', JSON.stringify(result.mathematical));
  assert.equal(result.native.status, 'generated', JSON.stringify(result.native));
  assert.equal(result.verification.status, 'passed', result.verification.reason);
  assert.equal(result.verification.samples.length, 7);
  for (const sample of result.verification.samples) {
    assert.ok(sample.normalizedImpedance.passed && sample.normalizedAdmittance.passed);
    for (const solution of [sample.currentTest, sample.voltageTest]) {
      assert.ok(solution.residuals.every(r => r.passed));
      assert.ok(solution.groundKcl.passed);
      assert.ok(Number.isFinite(solution.diagnostics.scaledBackwardResidual));
    }
    assert.equal(sample.power.length, sample.kind === 'RMS' ? 2 : 0);
    assert.ok(sample.power.every(p => p.passed && p.branchesVA.re >= 0 && p.branchesVA.im <= 0));
  }
  return result;
}
const values = result => result.mathematical.elements.map(e => `${e.kind}:${e.value}`);

test('exact parser: fractions, decimal/scientific notation, signs and round trips', () => {
  for (const [text, expected] of [['-12/-18','2/3'],['.125','1/8'],['1.25e-3','1/800'],['12.e2','1200'],['-0.00','0'],['+2/4','1/2']]) {
    const budget = new ExactBudget();
    const parsed = parseExact(text,budget);
    assert.equal(exactString(parsed),expected);
    assert.deepEqual(parseExact(exactString(parsed),budget),parsed);
  }
  const b = new ExactBudget(), a = parseExact('1/3',b), c = parseExact('2/5',b);
  assert.equal(exactString(exactAdd(a,c,b)),'11/15');
  assert.equal(exactString(exactSubtract(a,c,b)),'-1/15');
  assert.equal(exactString(exactMultiply(a,c,b)),'2/15');
  assert.equal(exactString(exactDivide(a,c,b)),'5/6');
});
test('checked conversion handles huge integers directly, ties, subnormals, and recorded error', () => {
  const b = new ExactBudget(), huge = 10n**400n;
  const q = parseExact(`${huge+1n}/${huge-1n}`,b);
  assert.equal(exactToNumber(q,b).value,1); // Number(n)/Number(d) would be NaN.
  assert.notEqual(exactToNumber(q,b).discrepancy,'0');
  assert.equal(exactToNumber(parseExact('9007199254740993/9007199254740992',b),b).value,1);
  assert.equal(exactToNumber(parseExact('9007199254740995/9007199254740992',b),b).value,1+2**-51);
  for (const value of [Number.MIN_VALUE, -Number.MIN_VALUE, 2**-1022, .1, -1/3, Number.MAX_VALUE])
    assert.equal(exactToNumber(exactFromNumber(value,b),b).value,value);
  assert.throws(() => exactToNumber(parseExact('1e-400',b),b),RangeError);
  assert.throws(() => exactToNumber(parseExact('1e400',b),b),RangeError);
});
test('exact polynomial division and GCD use identities over Q', () => {
  const b = new ExactBudget(), p = xs => xs.map(x=>parseExact(x,b));
  const division = polynomialDivide(p(['2','3','1']),p(['1','1']),b);
  assert.deepEqual(division.quotient.map(exactString),['2','1']);
  assert.deepEqual(division.remainder.map(exactString),['0']);
  assert.deepEqual(polynomialGcd(p(['2','3','1']),p(['1','2','1']),b).map(exactString),['1','1']);
});
for (const [name,n,d,expected,dc,infinity] of [
  ['resistor',['2'],['1'],['R:2'],{kind:'finite',value:'2'},'2'],
  ['capacitor',['3'],['0','1'],['C:1/3'],{kind:'pole',order:1,coefficient:'3'},'0'],
  ['series RC',['3','1'],['0','1'],['R:1','C:1/3'],{kind:'pole',order:1,coefficient:'3'},'1'],
  ['finite DC',['2','1'],['1','1'],['R:1','C:1','R:1'],{kind:'finite',value:'2'},'1'],
  ['omitted initial R',['1'],['1','1'],['C:1','R:1'],{kind:'finite',value:'1'},'0'],
]) test(`elementary Cauer ${name}: values, limits, independent MNA/power`, () => {
  const result=successful(synth(n,d));
  assert.deepEqual(values(result),expected);
  assert.deepEqual(result.mathematical.dc,dc);
  assert.deepEqual(result.mathematical.highFrequency,{kind:'finite',value:infinity});
  assert.equal(result.native.document.circuit.components.length,expected.length);
  assert.ok(result.native.document.circuit.components.every(c=>c.value>0 && c.p!==c.n));
  if (infinity==='0') assert.equal(result.mathematical.trace[0].omitted,true);
});
test('main target: hand-derived fraction, SI topology, initial values and exact identities', () => {
  const result=successful(synthesizeRc(main({referenceResistanceOhm:'1000',referenceAngularFrequencyPerSecond:'1000'})));
  assert.deepEqual(values(result),['R:1','C:1/2','R:4','C:1/6']);
  assert.deepEqual(result.native.elements.map(e=>e.exactSI),['1000','1/2000000','4000','1/6000000']);
  assert.deepEqual(result.native.document.circuit.components.map(c=>[c.id,c.p,c.n]),
    [['R0','port','n1'],['C1','n1','0'],['R1','n1','n2'],['C2','n2','0']]);
  assert.deepEqual(result.native.document.experiment,{schemaVersion:1,sources:[],initial:{kind:'storage',values:[{id:'C1',value:0},{id:'C2',value:0}]}});
  assert.deepEqual(parseDocument(serializeDocument(result.native.document)),result.native.document);
  assert.deepEqual(result.mathematical.dc,{kind:'pole',order:1,coefficient:'3/2'});
  assert.deepEqual(result.mathematical.highFrequency,{kind:'finite',value:'1'});
  assert.deepEqual(result.mathematical.reconstructed,result.mathematical.target);
  const atI=result.verification.samples[2];
  near(atI.impedanceOhm.re,1200); near(atI.impedanceOhm.im,-1600);
  near(atI.admittanceSiemens.re,0.0003); near(atI.admittanceSiemens.im,0.0004);
  // Independent polynomial identity: N=(z²+2z)+(2z+3).
  // Continued fraction denominator expansion gives (z²+4z+3)/(z²+2z).
  const N=z=>z*z+4*z+3, D=z=>z*z+2*z;
  near(N(1)/D(1),8/3);
  const work=JSON.parse(serializeDocument(result.native.document));
  work.circuit.components.push({id:'drive',type:'I',p:'0',n:'port'});
  work.experiment.sources.push({id:'drive',dc:0,ac:{re:.001,im:0}});
  const solved=solveFrequency(assemble(work.circuit),work.experiment,{re:1000,im:0});
  assert.equal(solved.status,'ok'); near(solved.observations.voltage.value.re,8/3);
  assert.deepEqual(result.mathematical.trace.filter(t=>!t.omitted).map(t=>t.componentId),['R0','C1','R1','C2']);
  assert.ok(result.mathematical.trace.every(t=>t.identity));
});
test('irrational poles require no roots: five unity elements and finite DC termination', () => {
  const result=successful(synth(['3','4','1'],['1','3','1']));
  assert.deepEqual(values(result),['R:1','C:1','R:1','C:1','R:1']);
  assert.deepEqual(result.mathematical.dc,{kind:'finite',value:'3'});
  const last=result.native.document.circuit.components.at(-1);
  assert.equal(last.type,'R'); assert.equal(last.n,'0');
  const z=result.verification.samples[2].impedanceOhm;
  near(z.re,4/3); near(z.im,-2/3); // (2+4i)/(3i)
});
test('admittance input uses reciprocal contract with identical physical ladder', () => {
  const result=successful(synth(['0','2','1'],['3','4','1'],{quantity:'admittance'}));
  assert.deepEqual(values(result),['R:1','C:1/2','R:4','C:1/6']);
});
test('normalization independently preserves physical Z and Y at multiple SI scales', () => {
  for (const [r,w] of [['1/10','1000000'],['1000000','1/1000'],['47','13']]) {
    const result=successful(synthesizeRc(main({referenceResistanceOhm:r,referenceAngularFrequencyPerSecond:w})));
    const ref=Number(r.includes('/') ? Number(r.split('/')[0])/Number(r.split('/')[1]) : r);
    near(result.verification.samples[2].impedanceOhm.re,1.2*ref);
    near(result.verification.samples[2].impedanceOhm.im,-1.6*ref);
    near(result.verification.samples[2].admittanceSiemens.re,.3/ref);
    near(result.verification.samples[2].admittanceSiemens.im,.4/ref);
  }
});
for (const [name,n,d] of [
  ['positive real but not RC',['1','1'],['2','1']],
  ['double reduced pole',['1'],['1','2','1']],
  ['negative resistor',['-1'],['1']],
  ['negative residue',['-1'],['1','1']],
  ['right half plane pole',['1'],['-1','1']],
  ['complex poles',['1','1'],['1','1','1']],
  ['improper polynomial',['1','1'],['1']],
]) test(`exact rejection: ${name}`,()=>{
  const result=synth(n,d);
  assert.equal(result.mathematical.status,'not-rc',JSON.stringify(result.mathematical));
  assert.equal(result.native.status,'unavailable');
  assert.equal(result.verification.status,'unresolved');
});
test('exact open and short boundaries never manufacture finite elements',()=>{
  for (const [quantity,boundary] of [['impedance','short'],['admittance','open']]) {
    const result=synth(['0'],['1','1'],{quantity});
    assert.equal(result.mathematical.status,'boundary'); assert.equal(result.mathematical.boundary,boundary);
    assert.equal(result.native.status,'unavailable'); assert.equal(result.verification.status,'unresolved');
  }
});
test('only exact common factors cancel; nearly canceled features survive',()=>{
  const common=successful(synth(['2','3','1'],['1','2','1']));
  assert.deepEqual(common.mathematical.canceledFactor,['1','1']);
  assert.deepEqual(common.mathematical.target,{numerator:['2','1'],denominator:['1','1']});
  // F=1+epsilon/(z+1), near a constant but with a real nonzero residue.
  const close=synth(['1.000000000001','1'],['1','1']);
  assert.equal(close.mathematical.status,'certified');
  assert.deepEqual(close.mathematical.canceledFactor,['1']);
  assert.deepEqual(values(close),['R:1','C:1000000000000','R:1/1000000000000']);
});
test('distinct poles 1e-12 apart remain two states, without merging',()=>{
  // 1/(z+1)+1/(z+1+epsilon), coefficients formed independently.
  const result=synth(['2.000000000001','2'],['1.000000000001','2.000000000001','1']);
  assert.equal(result.mathematical.status,'certified',JSON.stringify(result.mathematical));
  assert.deepEqual(result.mathematical.canceledFactor,['1']);
  assert.equal(result.mathematical.elements.filter(e=>e.kind==='C').length,2);
  assert.deepEqual(result.mathematical.reconstructed,result.mathematical.target);
});
test('strict input rejects malformed coefficients, representations, scales and denominator',()=>{
  for (const text of ['1/0','NaN','Infinity','1.2/3',' 1','0x10','1e','',1,null])
    assert.equal(synth([text],['1']).mathematical.status,'invalid-input',String(text));
  for (const patch of [{referenceResistanceOhm:'0'},{referenceAngularFrequencyPerSecond:'-1'},
    {denominator:['0','0']},{method:'foster'},{quantity:'transfer'}, {numerator:[]}, {extra:true}])
    assert.equal(synthesizeRc({...main(),...patch}).mathematical.status,'invalid-input');
  assert.equal(synthesizeRc(null).mathematical.status,'invalid-input');
  assert.equal(synthesizeRc({...main(),numerator:Array(2)}).mathematical.status,'invalid-input');
});
test('bounded input, integer arithmetic, polynomial GCD and operations classify as unresolved resources',()=>{
  for (const [request,limit] of [[main(),{operations:20}], [main(),{degree:1}],
    [input(['1e2049'],['1']),{}], [input(['1'.repeat(1025)],['1']),{}],
    [input(['1',...Array(17).fill('0')],['1']),{}], [main(),{bits:2}]]) {
    const result=synthesizeRc(request,limit);
    assert.equal(result.mathematical.status,'resource-limit',JSON.stringify(result.mathematical));
    assert.ok(result.mathematical.stage);
  }
  assert.equal(synthesizeRc(main(),{degree:9}).mathematical.status,'invalid-input');
  const b=new ExactBudget({operations:10}); b.stage='GCD regression';
  assert.throws(()=>polynomialGcd([{n:1n,d:1n},{n:1n,d:1n}],[{n:2n,d:1n},{n:1n,d:1n}],b),ExactResourceError);
});
test('positive exact values outside native range retain complete certificates',()=>{
  for (const value of ['1e-400','1e400','1e-310']) {
    const result=synth([value],['1']);
    assert.equal(result.mathematical.status,'certified');
    assert.equal(result.mathematical.elements[0].value,exactString(parseExact(value,new ExactBudget())));
    assert.equal(result.native.status,'unavailable');
    assert.equal(result.verification.status,'unresolved');
  }
  // The circuit value is representable, but chosen experiment frequency is not.
  const result=synth(['2'],['1'],{referenceAngularFrequencyPerSecond:'1e400'});
  assert.equal(result.mathematical.status,'certified'); assert.equal(result.native.status,'generated');
  assert.equal(result.verification.status,'unresolved');
});
test('physical verifier detects an incorrect realization independently of the extraction certificate',()=>{
  const result=successful(synthesizeRc(main()));
  const b=new ExactBudget(), p=xs=>xs.map(x=>parseExact(x,b));
  const target=reduceFunction(p(['3','4','1']),p(['0','2','1']),b).value;
  const altered=JSON.parse(serializeDocument(result.native.document));
  altered.circuit.components[0].value=2;
  const verification=verifyRcRealization(altered,target,parseExact('1',b),parseExact('1',b),b);
  assert.equal(verification.status,'mismatch');
  assert.equal(result.mathematical.status,'certified');
  assert.deepEqual(functionLimit(target,'zero',b),{kind:'pole',order:1,coefficient:'3/2'});
});
test('independent positive-entering port experiment confirms capacitor sign and power',()=>{
  const document={circuit:{schemaVersion:1,nodes:['0','port'],components:[{id:'C',type:'C',p:'port',n:'0',value:.5}],
    observations:[{id:'v',type:'voltage',p:'port',n:'0'}]},experiment:{schemaVersion:1,sources:[],initial:{kind:'storage',values:[{id:'C',value:0}]}}};
  const result=analyzePorts(document,{ports:[{p:'port',q:'0'}],frequencyHz:1/(2*Math.PI)});
  assert.equal(result.z.status,'ok'); assert.equal(result.y.status,'ok');
  near(result.z.values[0][0].im,-2); near(result.y.values[0][0].im,.5);
  assert.equal(document.circuit.components.length,1);
});
test('degree-eight unity ladder certifies and verifies within the declared default budgets',()=>{
  // Independently expanded recurrence: starting N=D=1, attach a shunt C
  // to the tail (D <- z*N+D), then series R (N <- N+D), eight times.
  const result=successful(synth(['9','120','462','792','715','364','105','16','1'],
    ['1','36','210','462','495','286','91','15','1']));
  assert.equal(result.mathematical.elements.length,17);
  assert.ok(result.mathematical.elements.every(e=>e.value==='1'));
  assert.deepEqual(result.mathematical.dc,{kind:'finite',value:'9'});
});
test('near cancellation keeps the exact certificate when unmodified MNA residuals fail',()=>{
  const result=synth(['1.000000000001','1'],['1','1']);
  assert.equal(result.mathematical.status,'certified');
  assert.equal(result.native.status,'generated');
  assert.equal(result.verification.status,'unresolved');
  assert.match(result.verification.reason,/ill-conditioned.*KCL/);
});
test('arithmetic budget exhaustion distinguishes extraction, reconstruction, conversion and verification',()=>{
  for (const [operations,stage] of [[1000,'resistor extraction'],[2000,'capacitor extraction'],[5000,'reconstruction']]) {
    const result=synthesizeRc(main(),{operations});
    assert.equal(result.mathematical.status,'resource-limit'); assert.match(result.mathematical.stage,new RegExp(stage));
  }
  const conversion=synthesizeRc(main(),{operations:7800});
  assert.equal(conversion.mathematical.status,'certified'); assert.equal(conversion.native.status,'unavailable');
  assert.match(conversion.native.reason,/native SI conversion.*operations/);
  const numerical=synthesizeRc(main(),{operations:10000});
  assert.equal(numerical.mathematical.status,'certified'); assert.equal(numerical.native.status,'generated');
  assert.equal(numerical.verification.status,'unresolved'); assert.match(numerical.verification.reason,/operations budget/);
});
