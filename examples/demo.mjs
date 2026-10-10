import { readFile } from 'node:fs/promises';
import { assemble, parseDocument, solveDC, transfer, extractFirstOrder, transient, kronReduce, complex } from '../dist/index.js';

const load = async name => parseDocument(await readFile(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'));
function success(result) {
  if (result.status !== 'ok') throw new Error(`${result.status}: ${result.message}`);
  return result;
}
function matrix(a, name) {
  const columns = name === 'B' ? a.inputs : a.unknowns;
  console.log(name);
  console.table(a[name].map((row, i) => ({ equation: a.rows[i].id,
    ...Object.fromEntries(columns.map((column, j) => [column.id, row[j]])) })));
}
const rc = await load('rc'), a = assemble(rc.circuit);
console.log('Circuits Unfolded — Phase 0 headless demonstration');
console.log('Ordered terminals (p,n): v=Vp-Vn; i flows p -> n; absorbed power=v*i.');
console.log('RC: Vin(in,0), R(in,out)=1000 ohm, C(out,0)=1e-6 F; no external load.');
console.log('Element laws: vVin=u; iR=(Vin-Vout)/R; iC=C*dVout/dt.');
console.log('Descriptor: E*xdot + K*x = B*u (the book state matrix is A=-K).');
console.table(a.unknowns); for (const name of ['E','K','B']) matrix(a, name);
console.log('Per-device contributions (including dimensions and terminal laws)');
console.table(a.contributions);
console.log('Output rows; capacitor current is a derivative observation');console.table(a.outputs);

const dc = success(solveDC(a, rc.experiment));
console.log('DC observations');console.table(Object.entries(dc.observations).map(([id,o])=>({id,value:o.value.re,unit:o.unit})));
console.log('Physical equation residuals');console.table([...dc.residuals,dc.groundKcl].map(r=>({row:r.label,absolute:r.absolute,unit:r.unit,tolerance:r.tolerance,passed:r.passed})));
console.log('Algebraically derived numeric coefficients (ascending powers of s)');console.log(success(extractFirstOrder(a,'Vin','out')));
console.log('Frequency response: selected Vin=1, all other independent coordinates zero; zero initial state.');
console.table([0,10,1/(2*Math.PI*.001),1000,10000].map(f=>{
  const r=success(transfer(a,'Vin','out',complex(0,2*Math.PI*f)));
  return {frequencyHz:f,re:r.transfer.value.re,im:r.transfer.value.im,magnitude:r.transfer.magnitude,phaseRadians:r.transfer.phaseRadians,scaledBackwardResidual:r.diagnostics.scaledBackwardResidual};
}));

console.log('Step: 0 -> 1 V at t=0; initial capacitor voltage 0 V. BE recurrence vs continuous response.');
const refinement=[];
for(const n of [20,40,80]) {
  const h=.001/n, r=success(transient(a,rc.experiment,{step:h,stop:.005}));
  const samples=r.samples.filter(s=>s.side!=='left');
  const common=Array.from({length:101},(_,i)=>samples[i*n/20]);
  refinement.push({stepSeconds:h,maxContinuousErrorV:Math.max(...common.map(s=>Math.abs(s.observations.out.value.re-(1-Math.exp(-s.time/.001))))),
    maxRecurrenceErrorV:Math.max(...samples.map((s,k)=>Math.abs(s.observations.out.value.re-(1-(1+h/.001)**-k)))),
    maxGroundKclResidualA:Math.max(...samples.map(s=>s.groundKcl.absolute)),finalVoltageV:samples.at(-1).observations.out.value.re});
}
console.table(refinement);
console.log('Controlled-source DC examples (source, load and observations are explicit in each JSON fixture)');
console.table(await Promise.all(['vcvs','vccs','ccvs','cccs'].map(async name=>{
  const d=await load(name),r=success(solveDC(assemble(d.circuit),d.experiment));
  return {fixture:name,outputV:r.observations.out.value.re,loadCurrentA:r.observations.load.value.re,dependentCurrentA:r.observations.dependent.value.re};
})));
const cascade=await load('rc-cascade');
console.log('Loaded RC cascade at omega=1000 rad/s: H=1/(1+3sRC+(sRC)^2), not the isolated-stage product.');
console.log(success(transfer(assemble(cascade.circuit),'Vin','out',complex(0,1000))).transfer);
const star=JSON.parse(await readFile(new URL('../fixtures/kron-star.json',import.meta.url),'utf8'));
console.log('Resistor star Kron response (S)');console.table(success(kronReduce(star,['a','b','c'])).reduced);
console.log('Explicit failure examples');
for(const name of ['floating','parallel-equal','parallel-unequal','forced-capacitor']) {
  const d=await load(name),a=assemble(d.circuit);
  const result=name==='forced-capacitor'?transient(a,d.experiment,{step:.0001,stop:.002}):solveDC(a,d.experiment);
  console.log(name, {status:result.status,message:result.message,...('time' in result?{time:result.time}:{})});
}
