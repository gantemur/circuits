import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createLab, resetExample, analyze, updateDocument, importNative, exportNative, csvFor,
  parseFinite, validateSettings } from '../dist/lab-test.js';
import { parseDocument } from '../dist/index.js';
import { schematic } from '../dist/schematic-test.js';

const near=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const ok=result=>{assert.equal(result.status,'ok',result.message);return result;};
const atCutoff=state=>{const fc=1/(2*Math.PI*.001);state.settings={...state.settings,minHz:fc,maxHz:fc*100,points:3,inspectHz:fc};return fc;};

test('divider is the default, stateless example and edits both resistors and source',()=>{
  const state=createLab();assert.equal(state.presetId,'divider');
  const first=analyze(state);near(ok(first.dc).observations.out.value.re,8);
  for(const p of first.sweep){near(p.value.re,2/3);near(p.value.im,0);}
  assert.equal(first.assembly.storage.length,0);
  assert.ok(first.transient.samples.every(s=>Math.abs(s.observations.out.value.re-8)<1e-10));
  assert.match(csvFor(first,state,'transient'),/algebraic-at-sample/);
  assert.doesNotMatch(csvFor(first,state,'transient'),/backward-Euler/);
  assert.match(schematic(state).html,/<rect class="symbol"[^>]+width="74"/);
  assert.equal(updateDocument(state,d=>{d.circuit.components.find(c=>c.id==='R1').value=2000;d.circuit.components.find(c=>c.id==='R2').value=1000;d.experiment.sources[0].dc=9;}).ok,true);
  const changed=analyze(state);near(ok(changed.dc).observations.out.value.re,3);
  for(const p of changed.sweep)near(p.value.re,1/3);
  near(ok(analyze(resetExample(state)).dc).observations.out.value.re,8);
  const rc=createLab('rc');rc.settings.inspectHz=1000;
  near(resetExample(rc).settings.inspectHz,1/(2*Math.PI*.001));
});

test('RC high-pass transfer and step follow independent capacitor law and backward Euler recurrence',()=>{
  const state=createLab('rc-high-pass'),fc=atCutoff(state),result=analyze(state);
  near(ok(result.dc).observations.out.value.re,0);
  const cutoff=result.sweep.find(p=>Math.abs(p.frequencyHz-fc)<1e-10);
  near(cutoff.magnitude,1/Math.sqrt(2));near(cutoff.phaseDegrees,45);
  near(cutoff.value.re,.5);near(cutoff.value.im,.5);
  assert.equal(result.algebraic.status,'not-supported');
  const samples=ok(result.transient).samples,h=state.settings.step,tau=.001;
  assert.equal(samples[0].side,'left');assert.equal(samples[1].side,'right');
  near(samples[0].observations.out.value.re,0);near(samples[1].observations.out.value.re,1);
  near(samples[0].observations.capacitorVoltage.value.re,0);near(samples[1].observations.capacitorVoltage.value.re,0);
  for(const n of [1,5,20,80]){
    near(samples[n+1].observations.out.value.re,(1+h/tau)**-n);
    near(samples[n+1].observations.capacitorVoltage.value.re,1-(1+h/tau)**-n);
  }
  assert.match(schematic(state).html,/data-schematic-component="C"/);
  assert.equal(updateDocument(state,d=>{d.circuit.components.find(c=>c.id==='R').value=2000;d.circuit.components.find(c=>c.id==='C').value=2e-6;d.experiment.sources[0].waveform.after=2;d.experiment.initial.values[0].value=.2;}).ok,true);
  assert.equal(analyze(state).transient.status,'ok');
});

test('custom JSON applies all native fields; invalid draft keeps document and topology fallback is honest',async()=>{
  const state=createLab(),saved=exportNative(state),revision=state.revision;
  const draft='{';
  assert.equal(importNative(state,draft).ok,false);
  assert.equal(draft,'{');assert.equal(exportNative(state),saved);assert.equal(state.revision,revision);
  const custom=await readFile(new URL('../fixtures/current-parallel.json',import.meta.url),'utf8');
  assert.equal(importNative(state,custom).ok,true);assert.equal(state.presetId,null);
  assert.equal(schematic(state).schematic,false);
  assert.match(schematic(state).html,/unknown-layout/);
  assert.deepEqual(state.document,parseDocument(custom));
  assert.equal(analyze(state).dc.status,'ok');
  assert.notEqual(exportNative(state),saved);
  assert.equal(resetExample(state).presetId,'divider');
});

test('browser model: RC cutoff magnitude and phase from independent 1/(1+sRC)',()=>{
  const state=createLab('rc'),fc=atCutoff(state),result=analyze(state);
  const sample=result.sweep.find(p=>Math.abs(p.frequencyHz-fc)<1e-10);
  assert.ok(sample,'Use a sweep point at cutoff for this fixture');
  near(sample.magnitude,1/Math.sqrt(2));near(sample.phaseDegrees,-45);
  assert.equal(result.transferUnit,'V/V');
  near(result.ac.observations.out.magnitude,1/Math.sqrt(2));
});

test('browser model: component edit changes transfer and step response, and invalid edit preserves the document',()=>{
  const state=createLab('rc');atCutoff(state);const before=analyze(state);
  const original=exportNative(state);
  const changed=updateDocument(state,d=>{d.circuit.components.find(c=>c.id==='R').value=2000;});
  assert.equal(changed.ok,true);
  const after=analyze(state);
  near(before.sweep.find(p=>Math.abs(p.frequencyHz-1/(2*Math.PI*.001))<1e-10).magnitude,1/Math.sqrt(2));
  // The same frequency is now twice the RC time constant: 1/(1+2j).
  near(after.sweep.find(p=>Math.abs(p.frequencyHz-1/(2*Math.PI*.001))<1e-10).magnitude,1/Math.sqrt(5));
  assert.notEqual(after.transient.samples[2].observations.out.value.re,before.transient.samples[2].observations.out.value.re);
  assert.throws(()=>csvFor(before,state,'frequency'),/stale/);
  assert.equal(updateDocument(state,d=>{d.circuit.components.find(c=>c.id==='R').value=-2;}).ok,false);
  assert.equal(state.document.circuit.components.find(c=>c.id==='R').value,2000);
  assert.notEqual(exportNative(state),original);
});

test('browser model: loaded RC and connected cascade retain physical loading',()=>{
  const loadedState=createLab('rc-loaded');atCutoff(loadedState);const loaded=analyze(loadedState);
  near(ok(loaded.dc).observations.out.value.re,2/3);
  const p=loaded.sweep.find(p=>Math.abs(p.frequencyHz-1/(2*Math.PI*.001))<1e-10);
  near(p.value.re,1.5/(1.5**2+1));near(p.value.im,-1/(1.5**2+1));
  const cascadeState=createLab('rc-cascade');atCutoff(cascadeState);const cascade=analyze(cascadeState);
  const q=cascade.sweep.find(p=>Math.abs(p.frequencyHz-1/(2*Math.PI*.001))<1e-10);
  near(q.value.re,0);near(q.value.im,-1/3);
  assert.ok(Math.abs(q.value.im-(-1/2))>.1,'Connected stages differ from isolated product');
  assert.equal(cascade.algebraic.status,'not-supported');
});

test('browser model: RC step matches independent backward Euler recurrence and records method',()=>{
  const state=createLab('rc'),r=analyze(state),h=state.settings.step,tau=.001;
  assert.equal(r.transient.method,'backward-Euler');
  const samples=ok(r.transient).samples.filter(s=>s.side!=='left');
  for(const n of [0,1,5,20,80])near(samples[n].observations.out.value.re,1-(1+h/tau)**-n);
  assert.equal(r.transient.requestedStep,h);
  const csv=csvFor(r,state,'transient');assert.match(csv,/time_s/);assert.match(csv,/backward-Euler-at-end-of-interval/);
});

test('browser model: native JSON round-trip, rejected import, and honest layout fallback',async()=>{
  const state=createLab('rc'),text=exportNative(state);
  assert.deepEqual(parseDocument(text),state.document);
  const result=importNative(state,text);assert.equal(result.ok,true);assert.equal(state.presetId,'rc');
  const saved=exportNative(state),rev=state.revision;
  assert.equal(importNative(state,'{"circuit":{"schemaVersion":99}}').ok,false);
  assert.equal(exportNative(state),saved);assert.equal(state.revision,rev);
  const altered=parseDocument(saved);altered.circuit.components.push({id:'extra',type:'R',p:'out',n:'0',value:3000});
  assert.equal(importNative(state,JSON.stringify(altered)).ok,true);assert.equal(state.presetId,null);
  const original=JSON.parse(await readFile(new URL('../fixtures/rc.json',import.meta.url),'utf8'));
  assert.notDeepEqual(state.document.circuit.components,original.circuit.components);
});

test('browser model: solver failure is status and gap, not a valid plotted point',async()=>{
  const state=createLab('rc');
  const bad=await readFile(new URL('../fixtures/parallel-unequal.json',import.meta.url),'utf8');
  assert.equal(importNative(state,bad).ok,true);
  const result=analyze(state);
  assert.equal(result.dc.status,'inconsistent');
  assert.ok(result.sweep.every(p=>p.status!=='ok'&&p.magnitude===null&&p.phaseDegrees===null));
  const csv=csvFor(result,state,'frequency');
  assert.match(csv,/inconsistent/);assert.match(csv,/"","","",""/);
});

test('browser model: transfer and configured RMS AC phasors stay distinct',()=>{
  const state=createLab('vcvs');
  const before=analyze(state);near(before.sweep[0].magnitude,3);near(ok(before.ac).observations.out.value.re,3);
  assert.equal(updateDocument(state,d=>{d.experiment.sources[0].ac={re:5,im:2};}).ok,true);
  const after=analyze(state);near(after.sweep[0].magnitude,3);
  near(ok(after.ac).observations.out.value.re,15);near(ok(after.ac).observations.out.value.im,6);
});

test('browser model: zero magnitude has undefined phase and bounded workload',()=>{
  const state=createLab('rc');
  assert.equal(updateDocument(state,d=>d.circuit.observations.push({id:'zero',type:'voltage',p:'out',n:'out'})).ok,true);
  state.output='zero';const result=analyze(state);
  assert.ok(result.sweep.every(p=>p.status==='zero-magnitude'&&p.magnitude===0&&p.phaseDegrees===null&&p.magnitudeDb===null));
  assert.match(csvFor(result,state,'frequency'),/zero-magnitude/);
  assert.ok(validateSettings({...state.settings,points:242}).length>0);
  assert.ok(validateSettings({...state.settings,step:1e-9}).length>0);
  assert.throws(()=>parseFinite('', 'resistance',true),/required/);
  assert.throws(()=>parseFinite('-1', 'resistance',true),/positive/);
});
