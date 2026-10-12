import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assemble, transfer, transient, solveDC, solveFrequency, analyzePorts,
  parseDocument, serializeDocument, complex } from '../dist/index.js';
import { createLab, exportNative, importNative, updateDocument } from '../dist/lab-test.js';
import { createWorkspace, addPanel, suggestedLayout } from '../dist/workspace-test.js';
import { guideNavigation } from '../dist/guide-navigation-test.js';
import { schematic } from '../dist/schematic-test.js';
import { lessons, referenceResponses, referenceStatus } from '../dist/study-guide-test.js';

const ids = ['rc3-low-pass','rc3-high-pass','butterworth2-low-pass','butterworth2-high-pass',
  'rlc-band-pass','rlc-notch','rc-impedance-ladder','rl-impedance-ladder'];
const fixture = id => parseDocument(readFileSync(new URL(`../fixtures/${id}.json`,import.meta.url),'utf8'));
const good = result => { assert.equal(result.status,'ok',result.message); return result; };
const C = (re,im=0) => ({re,im});
const add = (a,b) => C(a.re+b.re,a.im+b.im);
const sub = (a,b) => C(a.re-b.re,a.im-b.im);
const mul = (a,b) => C(a.re*b.re-a.im*b.im,a.re*b.im+a.im*b.re);
const div = (a,b) => {
  const scale=b.re*b.re+b.im*b.im;
  return C((a.re*b.re+a.im*b.im)/scale,(a.im*b.re-a.re*b.im)/scale);
};
const scale = (a,k) => C(a.re*k,a.im*k);
const mag = a => Math.hypot(a.re,a.im);
const near = (actual,expected,tolerance=1e-8) => assert.ok(Math.abs(actual-expected)<=tolerance,
  `${actual} differs from ${expected} by more than ${tolerance}`);
const cnear = (actual,expected,tolerance=1e-8) => { near(actual.re,expected.re,tolerance); near(actual.im,expected.im,tolerance); };
const h = (d,observation,f) => good(transfer(assemble(d.circuit),'Vin',observation,complex(0,2*Math.PI*f))).transfer.value;
const port = (d,f) => good(analyzePorts(d,{ports:[{p:'in',q:'0'}],frequencyHz:f}));
const component = (d,id) => d.circuit.components.find(c=>c.id===id);
const at = (samples,time,id) => samples.find(s=>s.side!=='left'&&Math.abs(s.time-time)<1e-12).observations[id].value.re;

function rational(reference,s) {
  const polynomial = coefficients => coefficients.reduceRight((sum,coefficient)=>add(C(coefficient),mul(s,sum)),C(0));
  return div(polynomial(reference.numerator),polynomial(reference.denominator));
}
function rc3Expected(z,highPass) {
  const z2=mul(z,z),z3=mul(z2,z);
  const denominator=highPass?add(C(1),add(scale(z,5),add(scale(z2,6),z3))):
    add(C(1),add(scale(z,6),add(scale(z2,5),z3)));
  return div(highPass?z3:C(1),denominator);
}
function butterExpected(z,highPass) {
  const z2=mul(z,z);
  return div(highPass?z2:C(1),add(C(1),add(scale(z,Math.SQRT2),z2)));
}
function rlcExpected(s,notch) {
  const denominator=add(C(1),add(scale(s,1e-4),scale(mul(s,s),1e-8)));
  return div(notch?add(C(1),scale(mul(s,s),1e-8)):scale(s,1e-4),denominator);
}
function rcContinued(s) {
  const shunt = (capacitance,tail) => div(C(1),add(scale(s,capacitance),div(C(1),tail)));
  const z3=add(C(3000),div(C(1),scale(s,.25e-6)));
  const z2=add(C(2000),shunt(.5e-6,z3));
  return add(C(1000),shunt(1e-6,z2));
}
function rlContinued(s) {
  const shunt = (resistance,tail) => div(C(1),add(C(1/resistance),div(C(1),tail)));
  const z3=add(scale(s,3),C(3000));
  const z2=add(scale(s,2),shunt(2000,z3));
  return add(s,shunt(1000,z2));
}

test('eight strict fixtures round-trip and import to distinct presets with intended first outputs',()=>{
  assert.equal(ids.length,8);
  for(const id of ids) {
    const document=fixture(id);
    assert.deepEqual(parseDocument(serializeDocument(document)),document,id);
    const state=createLab();
    assert.equal(importNative(state,JSON.stringify(document)).ok,true,id);
    assert.equal(state.presetId,id);
    assert.equal(state.output,id==='rlc-band-pass'?'resistorVoltage':id==='rlc-notch'?'lcVoltage':
      id.endsWith('-impedance-ladder')?'port':'out');
    assert.equal(exportNative(state),serializeDocument(document));
    if(id==='rc3-low-pass') {
      const edited=structuredClone(document);
      component(edited,'R2').value=1200;
      assert.equal(importNative(state,JSON.stringify(edited)).ok,true);
      assert.equal(state.presetId,id);
      assert.equal(referenceStatus(state,id),'edited');
      assert.deepEqual(referenceResponses[id].denominator,
        [1,6*(1000*component(document,'C1').value),5*(1000*component(document,'C1').value)**2,
          (1000*component(document,'C1').value)**3]);
    }
  }
  assert.notEqual(fixture('rlc-band-pass').circuit.components[1].id,fixture('rlc-notch').circuit.components[1].id);
});

test('RC3 transfer obeys independent connected-node equations and cutoff, not isolated products',()=>{
  const root=.1942860004595122;
  near(root**6+13*root**4+26*root**2,1,3e-15);
  for(const highPass of [false,true]) {
    const id=highPass?'rc3-high-pass':'rc3-low-pass',d=fixture(id),R=1000,cap=component(d,'C1').value;
    const tau=R*cap;
    for(const f of [1,100,1000,10000,100000]) {
      const z=C(0,2*Math.PI*f*tau);
      const expected=rc3Expected(z,highPass);
      cnear(h(d,'out',f),expected,2e-12);
      cnear(rational(referenceResponses[id],C(0,2*Math.PI*f)),expected,2e-12);
    }
    near(mag(h(d,'out',1000)),Math.SQRT1_2,2e-12);
    // Use this fixture's actual z=sRC. The high-pass capacitor gives z=i/x3
    // at 1 kHz, whereas the low-pass capacitor gives z=i*x3.
    const atCorner=h(d,'out',1000);
    const z=C(0,2*Math.PI*1000*tau);
    const isolatedStage=div(highPass?z:C(1),add(C(1),z));
    const isolated=mul(mul(isolatedStage,isolatedStage),isolatedStage);
    assert.ok(mag(sub(atCorner,isolated))>.1);
    const dc=good(solveDC(assemble(d.circuit),d.experiment));
    near(dc.observations.out.value.re,highPass?0:1,1e-12);
    assert.equal(component(d,'C2').value,cap);
  }
});

test('RC3 low-pass temporary load and source resistance preserve connected loading',()=>{
  const d=fixture('rc3-low-pass'),before=JSON.stringify(d);
  for(const [rs,expected] of [[0,1/4],[500,2/9]]) {
    const result=good(analyzePorts(d,{ports:[{p:'in',q:'0'},{p:'out',q:'0'}],externalDrive:'Vin',
      frequencyHz:0,loading:{sourceResistance:rs,load:{kind:'resistor',resistance:1000}}}));
    near(good(result.loading.direct).point.sourceToOutputGain.re,expected,2e-11);
  }
  assert.equal(JSON.stringify(d),before);
});

test('RC3 high-pass step jumps while all series capacitor voltages remain continuous',()=>{
  const d=fixture('rc3-high-pass'),result=good(transient(assemble(d.circuit),d.experiment,{stop:.0001,step:1e-6,maxSteps:3000}));
  const initial=result.samples.filter(s=>s.time===0);
  near(initial[0].observations.out.value.re,0);
  near(initial[1].observations.out.value.re,1,1e-10);
  for(const sample of initial) {
    const input=sample.side==='left'?0:1;
    const nodes={in:input,a:sample.observations.a.value.re,b:sample.observations.b.value.re,
      out:sample.observations.out.value.re};
    for(const [p,n] of [['in','a'],['a','b'],['b','out']]) near(nodes[p]-nodes[n],0,1e-10);
  }
});

test('Butterworth baselines match independent rational responses, load current, and edit behavior',()=>{
  const omega=2*Math.PI*1000;
  for(const highPass of [false,true]) {
    const id=highPass?'butterworth2-high-pass':'butterworth2-low-pass',d=fixture(id);
    for(const f of [100,500,1000,2000,10000]) {
      const expected=butterExpected(C(0,2*Math.PI*f/omega),highPass);
      cnear(h(d,'out',f),expected,2e-12);
      cnear(rational(referenceResponses[id],C(0,2*Math.PI*f)),expected,2e-12);
    }
    cnear(h(d,'out',1000),C(0,highPass?Math.SQRT1_2:-Math.SQRT1_2),2e-12);
    near(mag(h(d,'out',highPass?500:2000)),1/Math.sqrt(17),2e-12);
    const first=h(d,'out',1000);
    const observation=good(solveFrequency(assemble(d.circuit),d.experiment,complex(0,omega)));
    component(d,'RL').value=1000;
    cnear(h(d,'out',1000),first,2e-12);
    const loaded=good(solveFrequency(assemble(d.circuit),d.experiment,complex(0,omega)));
    cnear(loaded.observations.load.value,scale(observation.observations.load.value,10),2e-12);
    cnear(add(loaded.observations.follower.value,loaded.observations.load.value),
      add(observation.observations.follower.value,observation.observations.load.value),2e-12);
    const state=createLab(id);
    updateDocument(state,next=>{component(next,highPass?'Rf':'R1').value*=1.2;});
    assert.equal(referenceStatus(state,id),'edited');
    assert.ok(mag(sub(h(state.document,'out',1000),first))>.01);
    cnear(rational(referenceResponses[id],C(0,omega)),first,2e-12);
  }
});

test('Butterworth continuous step formulas bound BE error and improve on half steps',()=>{
  const omega=2*Math.PI*1000,alpha=omega/Math.SQRT2;
  const t=.0005;
  for(const highPass of [false,true]) {
    const id=highPass?'butterworth2-high-pass':'butterworth2-low-pass',d=fixture(id),assembly=assemble(d.circuit);
    const factor=Math.exp(-alpha*t),angle=alpha*t;
    const exact=highPass?factor*(Math.cos(angle)-Math.sin(angle)):
      1-factor*(Math.cos(angle)+Math.sin(angle));
    const errors=[];
    for(const step of [1e-5,5e-6]) {
      const samples=good(transient(assembly,d.experiment,{stop:t,step,maxSteps:3000})).samples;
      errors.push(Math.abs(at(samples,t,'out')-exact));
    }
    assert.ok(errors[0]<.04 && errors[1]<errors[0]*.55,`${id}: ${errors}`);
  }
});

test('active drawing states the edited VCVS law without changing unity Butterworth references',()=>{
  const omega=2*Math.PI*1000;
  for(const id of ['butterworth2-low-pass','butterworth2-high-pass']) {
    const baseline=referenceResponses[id];
    for(const gain of [1,1.2,0,-1]) {
      const state=createLab(id);
      if(gain!==1) updateDocument(state,d=>{component(d,'Follower').gain=gain;});
      const drawing=schematic(state);
      assert.equal(drawing.schematic,true);
      assert.match(drawing.html,/V\(out\)−V\(0\) = K·\[V\(b\)−V\(0\)\]/);
      assert.match(drawing.html,new RegExp(`K = ${gain} \\(Follower`));
      const analysis=id==='butterworth2-low-pass'
        ? good(solveDC(assemble(state.document.circuit),state.document.experiment))
        : good(solveFrequency(assemble(state.document.circuit),state.document.experiment,complex(0,omega)));
      cnear(analysis.observations.out.value,scale(analysis.observations.b.value,gain),2e-11);
      if(id==='butterworth2-low-pass') {
        near(analysis.observations.b.value.re,1,2e-11);
        near(analysis.observations.out.value.re,gain,2e-11);
      }
      assert.equal(referenceStatus(state,id),gain===1?'baseline':'edited');
      assert.equal(referenceResponses[id],baseline);
      cnear(rational(baseline,C(0,omega)),C(0,id==='butterworth2-high-pass'?Math.SQRT1_2:-Math.SQRT1_2),2e-12);
    }
  }
});

test('active high-pass frequency lesson exposes independently predicted AC load and follower currents',()=>{
  const id='butterworth2-high-pass',state=createLab(id),omega=2*Math.PI*1000;
  const step=lessons[id];
  assert.equal(step.en.steps[2].action,'frequency');
  assert.equal(step.mn.steps[2].action,'frequency');
  for(const language of ['en','mn']) {
    const instructions=step[language].steps[2].text;
    for(const term of ['1000 Hz','load','follower','out']) assert.ok(instructions.includes(term),`${language}: ${term}`);
  }
  const workspace=createWorkspace(state),frequency=workspace.panels.find(p=>p.type==='frequency');
  const previousId=frequency.id;
  frequency.inspectHz=1234;
  frequency.output='load';
  frequency.pending.inspectHz='not-a-frequency';
  frequency.errors.inspectHz='finiteField';
  assert.deepEqual(guideNavigation(workspace,state,'frequency'),{kind:'focus',panelId:previousId});
  assert.equal(frequency.inspectHz,1234);
  assert.equal(frequency.output,'load');
  assert.equal(frequency.pending.inspectHz,'not-a-frequency');
  assert.equal(frequency.errors.inspectHz,'finiteField');
  assert.equal(workspace.panels.length,2);

  const voltage=C(0,Math.SQRT1_2),rf=component(state.document,'Rf').value;
  const rg=component(state.document,'Rg').value,c2=component(state.document,'C2').value;
  // b's KCL gives Va=Vb*[1+1/(s*C2*Rg)]. At the unity baseline Vb=Vout.
  const va=mul(voltage,add(C(1),div(C(1),C(0,omega*c2*rg))));
  const feedbackCurrent=scale(sub(va,voltage),1/rf); // a -> out
  const measured=[];
  for(const loadResistance of [10000,1000]) {
    const d=structuredClone(state.document);
    component(d,'RL').value=loadResistance;
    const ac=good(solveFrequency(assemble(d.circuit),d.experiment,complex(0,omega)));
    const load=ac.observations.load.value;
    const follower=ac.observations.follower.value; // out -> 0
    cnear(ac.observations.out.value,voltage,2e-12);
    cnear(load,scale(voltage,1/loadResistance),2e-12);
    cnear(follower,sub(feedbackCurrent,load),2e-12);
    near(mag(load),Math.SQRT1_2/loadResistance,2e-12);
    measured.push({load,follower});
  }
  near(mag(measured[0].load)*1e6,70.71067811865476,2e-7);
  near(mag(measured[1].load)*1e6,707.1067811865476,2e-6);
  cnear(add(sub(measured[1].follower,measured[0].follower),
    sub(measured[1].load,measured[0].load)),C(0),2e-12);
});

test('RLC measurement determines band-pass versus notch and respects identities',()=>{
  const omega0=10000;
  const band=fixture('rlc-band-pass'),notch=fixture('rlc-notch');
  for(const f of [1,100,omega0/(2*Math.PI),5000,100000]) {
    const s=C(0,2*Math.PI*f);
    const b=h(band,'resistorVoltage',f),n=h(notch,'lcVoltage',f);
    cnear(b,rlcExpected(s,false),2e-12);
    cnear(n,rlcExpected(s,true),2e-12);
    cnear(add(b,n),C(1),2e-12);
    cnear(rational(referenceResponses['rlc-band-pass'],s),b,2e-12);
    cnear(rational(referenceResponses['rlc-notch'],s),n,2e-12);
  }
  cnear(h(band,'resistorVoltage',omega0/(2*Math.PI)),C(1),2e-12);
  cnear(h(notch,'lcVoltage',omega0/(2*Math.PI)),C(0),2e-12);
  const reversed=structuredClone(notch);
  const probe=reversed.circuit.observations.find(o=>o.id==='lcVoltage');
  [probe.p,probe.n]=[probe.n,probe.p];
  cnear(h(reversed,'lcVoltage',1000),scale(h(notch,'lcVoltage',1000),-1),2e-12);
  for(const changed of ['Rn','Ln','Cn']) {
    const edited=structuredClone(notch);component(edited,changed).value*=2;
    const inspect=changed==='Rn'?1000:omega0/(2*Math.PI);
    assert.ok(mag(sub(h(edited,'lcVoltage',inspect),h(notch,'lcVoltage',inspect)))>.01);
  }
});

test('RLC independent step solutions agree with BE and refine at first order',()=>{
  const alpha=100/(2*.01),beta=Math.sqrt(1/(.01*1e-6)-alpha*alpha),t=.0005;
  const bandExact=(2*alpha/beta)*Math.exp(-alpha*t)*Math.sin(beta*t);
  for(const [id,output,exact] of [['rlc-band-pass','resistorVoltage',bandExact],['rlc-notch','lcVoltage',1-bandExact]]) {
    const d=fixture(id),assembly=assemble(d.circuit),errors=[];
    for(const step of [1e-5,5e-6]) {
      const samples=good(transient(assembly,d.experiment,{stop:t,step,maxSteps:3000})).samples;
      errors.push(Math.abs(at(samples,t,output)-exact));
    }
    assert.ok(errors[0]<.04 && errors[1]<errors[0]*.6,`${id}: ${errors}`);
  }
});

test('source-free ladder Z and Y agree with independent continued fractions and SI coefficients',()=>{
  for(const [id,continued] of [['rc-impedance-ladder',rcContinued],['rl-impedance-ladder',rlContinued]]) {
    const d=fixture(id),before=JSON.stringify(d);
    for(const f of [1,100,1000,10000,100000]) {
      const s=C(0,2*Math.PI*f),expected=continued(s),result=port(d,f);
      const z=good(result.z).values[0][0],y=good(result.y).values[0][0];
      cnear(z,expected,1e-6);
      cnear(z,rational(referenceResponses[id],s),1e-6);
      cnear(mul(z,y),C(1),1e-9);
    }
    assert.equal(JSON.stringify(d),before);
  }
  const rc=port(fixture('rc-impedance-ladder'),0);
  assert.notEqual(rc.z.status,'ok');
  cnear(good(rc.y).values[0][0],C(0),1e-12);
  near(good(port(fixture('rl-impedance-ladder'),0).z).values[0][0].re,6000/11,1e-8);
  const s=C(0,1e9);
  cnear(rcContinued(C(0,1e9)),C(1000,-1e-3),1e-2);
  near(rlContinued(s).im/s.im,1,1e-4);
  near(rlContinued(s).re,1000,1e-3);
});

test('fresh suggested layouts are bounded; duplicate panels and baseline targets survive edits',()=>{
  for(const id of ids) {
    const state=createLab(id),workspace=createWorkspace(state),guide=lessons[id];
    assert.ok(guide.en.steps.length>=2 && guide.mn.steps.length>=2);
    assert.equal(referenceStatus(state,id),'baseline');
    assert.equal(workspace.panels.length,2);
    if(id.endsWith('-impedance-ladder')) {
      const panel=workspace.panels[0];
      assert.equal(panel.type,'port-frequency');assert.equal(panel.portMode,1);
      assert.deepEqual([panel.p,panel.q],['in','0']);
      assert.equal(panel.portMatrix,'z');assert.equal(panel.portView,'sweep');
      assert.deepEqual([panel.portMinHz,panel.portMaxHz,panel.portFrequencyHz],[1,100000,1000]);
    } else {
      assert.deepEqual(workspace.panels.map(p=>p.type),['frequency','transient']);
      assert.ok(state.settings.duration/state.settings.step+1<=3000);
      if(id.startsWith('rc3-')||id.startsWith('butterworth2-'))
        assert.deepEqual([workspace.panels[0].minHz,workspace.panels[0].maxHz,workspace.panels[0].inspectHz],[10,100000,1000]);
    }
    const duplicate=addPanel(workspace,state,workspace.panels[0].type);
    assert.ok(duplicate);duplicate.pending.minHz='invalid';duplicate.errors.minHz='finiteField';
    const oldIds=workspace.panels.map(p=>p.id);
    assert.equal(new Set(oldIds).size,3);
    assert.equal(duplicate.pending.minHz,'invalid');
    suggestedLayout(workspace,state);
    assert.equal(workspace.panels.length,2);
  }
});

test('new curated schematics show endpoint paths, feedback, measurement signs, and honest fallback',()=>{
  for(const id of ids) {
    const state=createLab(id),drawing=schematic(state);
    assert.equal(drawing.schematic,true,id);
    assert.match(drawing.html,/class="schematic-topology"/);
    for(const device of state.document.circuit.components)
      assert.match(drawing.html,new RegExp(`data-schematic-component="${device.id}"`),`${id}:${device.id}`);
    assert.doesNotMatch(drawing.html,/NaN|Infinity|unknown-layout/);
    const valueId=id.endsWith('-impedance-ladder')?'R2':id.startsWith('rlc-')?id==='rlc-notch'?'Rn':'Rbp':
      id.startsWith('butterworth')?'RL':'R2';
    updateDocument(state,d=>{component(d,valueId).value=1234;});
    assert.match(schematic(state).html,/1234 Ω/);
    updateDocument(state,d=>{d.circuit.components.push({id:'extra',type:'R',p:'in',n:'0',value:42});});
    assert.equal(schematic(state).schematic,false);
  }
  for(const id of ['rc3-low-pass','rc3-high-pass','rc-impedance-ladder','rl-impedance-ladder']) {
    const html=schematic(createLab(id)).html;
    // The first branch starts at the in center and ends at a; no floating symbol.
    assert.match(html,/M70 120L110 120/);
    assert.match(html,/M185 120L225 120/);
    assert.match(html,/M225 120L265 120/);
    assert.match(html,/M495 120L535 120/);
  }
  const precise=fixture('rc3-low-pass').circuit.components.find(c=>c.id==='C1').value;
  assert.match(schematic(createLab('rc3-low-pass')).html,new RegExp(String(precise).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const id of ['butterworth2-low-pass','butterworth2-high-pass']) {
    const html=schematic(createLab(id)).html;
    assert.match(html,/M225 120L225 55/);
    assert.match(html,/M405 55L535 55/);
    assert.match(html,/M535 55L535 120/);
    assert.match(html,/M380 145H475V184H508/);
    const followerLabel=html.match(/<text x="(\d+)" y="(\d+)" class="component-label">Follower<\/text>/);
    const loadValue=html.match(/<text x="(\d+)" y="(\d+)" text-anchor="middle" class="schematic-small">10000 Ω<\/text>/);
    const law=html.match(/<text data-follower-law="equation" x="(\d+)" y="(\d+)"/);
    const gain=html.match(/<text data-follower-law="gain" x="(\d+)" y="(\d+)"/);
    const badge=html.match(/<rect class="output-badge" x="\d+" y="(\d+)"/);
    assert.ok(followerLabel&&loadValue&&law&&gain&&badge);
    // The old follower label and RL value had overlapping ink on the same row.
    assert.ok(Math.abs(Number(followerLabel[2])-Number(loadValue[2]))>=25);
    assert.ok(Number(law[2])>268+15); // below the lowest ground strokes
    assert.ok(Number(gain[2])-Number(law[2])>=16);
    assert.ok(Number(gain[2])<Number(badge[1])-20);
  }
  for(const id of ['rlc-band-pass','rlc-notch']) {
    const state=createLab(id);
    const marks={in:[90,143],a:[357,143],b:[602,143],'0':[620,246]};
    for(const observation of state.document.circuit.observations.filter(o=>o.type==='voltage')) {
      state.output=observation.id;
      const html=schematic(state).html;
      const positive=html.match(/<text data-measurement-sign="positive" x="(\d+)" y="(\d+)"[^>]*>\+<\/text>/);
      const negative=html.match(/<text data-measurement-sign="negative" x="(\d+)" y="(\d+)"[^>]*>−<\/text>/);
      const badge=html.match(/<rect class="output-badge" x="\d+" y="(\d+)"/);
      assert.ok(positive&&negative&&badge,`${id}:${observation.id}`);
      assert.deepEqual([Number(positive[1]),Number(positive[2])],marks[observation.p]);
      assert.deepEqual([Number(negative[1]),Number(negative[2])],marks[observation.n]);
      for(const mark of [positive,negative]) assert.ok(Number(mark[2])<Number(badge[1])-15);
      if(observation.n==='0') assert.ok(Number(negative[1])>=612); // clear of ground strokes
    }
    state.output='inductorCurrent';
    const currentDrawing=schematic(state).html;
    assert.match(currentDrawing,/I\(a→b\) →/);
    assert.doesNotMatch(currentDrawing,/data-measurement-sign=/);
  }
});
