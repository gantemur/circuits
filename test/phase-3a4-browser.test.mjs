import test from 'node:test';
import assert from 'node:assert/strict';
import { createLab, exportNative, importNative, updateDocument } from '../dist/lab-test.js';
import { presets, matchingPreset } from '../dist/presets-test.js';
import { createWorkspace, reconcilePanels, handlePanelFieldChange, changePanelType } from '../dist/workspace-test.js';
import { TransientRunLifecycle, transientIntervalBound, augmentedTransientUnknowns } from '../dist/transient-run-test.js';
import { transientResultHtml, transientSampleDetails, transientCsv,
  releaseOtherTransientRunControls, setLanguage } from '../dist/transient-presentation-test.js';
import { schematic } from '../dist/schematic-test.js';
import { guideFor } from '../dist/study-guide-test.js';
import { nonlinearTransient } from '../dist/index.js';

const near = (a,b,t=1e-9) => assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const copy = value => structuredClone(value);
function harness(state = createLab('diode-rc-step')) {
  const workspace = createWorkspace(state);
  const workers = [];
  let notifications = 0;
  const lifecycle = new TransientRunLifecycle(() => {
    const worker = { request:null, stopped:false, onmessage:null, onerror:null, onmessageerror:null,
      postMessage(request){this.request=request;}, terminate(){this.stopped=true;} };
    const resource = {worker, released:false, release(){this.released=true;} };
    workers.push(resource); return resource;
  },()=>{notifications++;});
  return { state, workspace, panel:workspace.panels[0], lifecycle, workers,
    notifyCount:()=>notifications };
}

test('four strict browser copies are distinct, suggested and match their own native round trips', () => {
  assert.equal(presets.length,35);
  assert.equal(createLab().presetId,'divider');
  const cases = [
    ['diode-rc-step',.0005,.00001,'dc'],
    ['diode-rc-biased-sine',.003,.000005,'frequency'],
    ['half-wave-rectifier',.04,.0001,'diode-characteristic'],
    ['half-wave-rectifier-rc',.06,.0001,'dc'],
  ];
  const signatures = new Set();
  for (const [id,duration,step,second] of cases) {
    const state=createLab(id), workspace=createWorkspace(state);
    assert.equal(state.settings.duration,duration);
    assert.equal(state.settings.step,step);
    assert.deepEqual(workspace.panels.map(panel=>panel.type),['transient',second]);
    const signature=JSON.stringify(state.document.circuit.components.map(c=>c.id));
    assert.ok(!signatures.has(signature),id); signatures.add(signature);
    assert.equal(matchingPreset(state.document.circuit).id,id);
    assert.equal(importNative(state,exportNative(state)).ok,true);
    assert.equal(state.presetId,id);
    const drawing=schematic(state);
    assert.equal(drawing.schematic,true);
    for (const device of state.document.circuit.components)
      assert.ok(drawing.html.includes(`data-schematic-component="${device.id}"`),device.id);
    assert.match(drawing.html,/schematic-topology/);
  }
  const edited=createLab('diode-rc-step');
  assert.equal(updateDocument(edited,d=>{d.circuit.components.find(c=>c.type==='R').value=1500;}).ok,true);
  assert.equal(importNative(edited,exportNative(edited)).ok,true);
  assert.equal(edited.presetId,'diode-rc-step');
  assert.equal(matchingPreset(createLab('diode-rc').document.circuit).id,'diode-rc');
});

test('browser worker entry calls owned kernel once with the actual request', async () => {
  const messages=[];
  const prior=globalThis.self;
  globalThis.self={postMessage:message=>messages.push(message)};
  try {
    await import('../dist/nonlinear-worker-test.js');
    const document=createLab('diode-rc-step').document;
    const request={kind:'run',token:77,document:copy(document),options:{start:0,stop:20e-6,step:10e-6,
      maxIntervals:3000,maxUnknowns:64,maxIterations:60,maxBacktracks:30}};
    globalThis.self.onmessage({data:request});
    assert.equal(messages.length,1);
    assert.equal(messages[0].kind,'result');
    assert.equal(messages[0].token,77);
    const direct=nonlinearTransient(document,request.options);
    assert.deepEqual(messages[0].result.samples,direct.samples);
    near(direct.samples[2].observations.vout.value,.20792076128606163,2e-12);
    near(direct.samples[3].observations.vout.value,.21576308827661184,2e-12);
    assert.deepEqual(direct.samples.slice(0,2).map(s=>[s.time,s.side,s.storage[0].value]),
      [[0,'left',.2],[0,'right',.2]]);
    near(direct.samples[0].storage[0].rate,-200.0022890877495,1e-6);
    near(direct.samples[1].storage[0].rate,799.9977109122506,1e-6);
  } finally { globalThis.self=prior; }
});

test('worker path retains prescribed storage without a DC root and reviewed small-step cases', async () => {
  const messages=[];
  const prior=globalThis.self;
  globalThis.self={postMessage:message=>messages.push(message)};
  try {
    await import('../dist/nonlinear-worker-test.js?prescribed-cases');
    const run=(document,stop,step,token)=>{
      globalThis.self.onmessage({data:{kind:'run',token,document,options:{start:0,stop,step,
        maxIntervals:3000,maxUnknowns:64,maxIterations:60,maxBacktracks:30}}});
      const reply=messages.at(-1);
      assert.equal(reply.kind,'result');
      assert.equal(reply.token,token);
      assert.equal(reply.result.status,'ok',reply.result.code);
      return reply.result;
    };
    const noRoot=copy(createLab('diode-rc-step').document);
    noRoot.circuit.components=noRoot.circuit.components.filter(c=>c.id!=='V1Step'&&c.id!=='R1Step');
    noRoot.circuit.components.push({id:'sink',type:'I',p:'out',n:'0'});
    noRoot.circuit.nodes=['0','out'];
    noRoot.experiment.sources=[{id:'sink',dc:1e-6}];
    noRoot.experiment.initial.values[0].value=0;
    const prescribed=run(noRoot,1e-6,1e-6,81);
    near(prescribed.samples[0].storage[0].rate,-1,1e-5);
    assert.ok(prescribed.samples[1].observations.vout.value<0);

    const lowR=copy(createLab('diode-rc-step').document);
    lowR.circuit.components.find(c=>c.type==='R').value=1;
    const low=run(lowR,20e-6,10e-6,82);
    near(low.samples[1].observations.vout.value,.2,1e-14);
    near(low.samples[2].observations.vout.value,.680596607959,2e-10);

    const rounded=run(copy(createLab('diode-rc-biased-sine').document),3e-5,1e-6,83);
    assert.equal(rounded.samples.at(-1).time,3e-5);
    assert.equal(rounded.samples.length,31);
  } finally { globalThis.self=prior; }
});

test('one worker owns a run; cancellation terminates and late messages cannot revive it', () => {
  const h=harness();
  const first=h.lifecycle.start(h.panel,h.state,h.workspace,true);
  assert.equal(first.status,'running');
  assert.equal(h.workers.length,1);
  const request=h.workers[0].worker.request;
  assert.notEqual(request.document,h.state.document);
  assert.equal(h.lifecycle.start(h.workspace.panels[1],h.state,h.workspace,true),null);
  const oldCallback=h.workers[0].worker.onmessage;
  h.lifecycle.cancel(h.panel.id);
  assert.equal(first.status,'cancelled');
  assert.equal(h.workers[0].worker.stopped,true);
  assert.equal(h.workers[0].released,true);
  const second=h.lifecycle.start(h.panel,h.state,h.workspace,true);
  assert.equal(second.status,'running');
  assert.notEqual(second.token,first.token);
  oldCallback({data:{kind:'result',token:first.token,result:nonlinearTransient(request.document,request.options)}});
  assert.equal(second.status,'running');
  h.workers[1].worker.onmessage({data:{kind:'result',token:second.token,
    result:nonlinearTransient(h.workers[1].worker.request.document,{stop:20e-6,step:10e-6})}});
  assert.equal(second.status,'complete');
  assert.equal(h.lifecycle.canExport(h.panel,h.state,h.workspace,true),true);
});

test('scientific edits, pending text and panel transitions permanently invalidate completed or active results', () => {
  const h=harness();
  const run=()=>h.lifecycle.start(h.panel,h.state,h.workspace,true);
  let view=run();
  const result=nonlinearTransient(h.state.document,{stop:20e-6,step:10e-6});
  h.workers.at(-1).worker.onmessage({data:{kind:'result',token:view.token,result}});
  h.workspace.panels.reverse(); h.lifecycle.reconcile(h.state,h.workspace,true);
  assert.equal(view.status,'complete');
  h.panel.pending.step='bad'; h.lifecycle.reconcile(h.state,h.workspace,true);
  assert.equal(view.status,'invalidated');
  delete h.panel.pending.step; h.lifecycle.reconcile(h.state,h.workspace,true);
  assert.equal(h.lifecycle.canExport(h.panel,h.state,h.workspace,true),false);
  view=run();
  handlePanelFieldChange(h.workspace,h.state,h.panel.id,'step','0.00002');
  h.lifecycle.reconcile(h.state,h.workspace,true);
  assert.equal(view.status,'invalidated');
  assert.equal(h.workers.at(-1).worker.stopped,true);
  handlePanelFieldChange(h.workspace,h.state,h.panel.id,'step','0.00001');
  assert.equal(h.lifecycle.canExport(h.panel,h.state,h.workspace,true),false);
  view=run(); h.panel.collapsed=true; h.lifecycle.reconcile(h.state,h.workspace,true);
  assert.equal(view.status,'invalidated'); h.panel.collapsed=false;
  view=run(); h.workspace.view='editor'; h.lifecycle.reconcile(h.state,h.workspace,true);
  assert.equal(view.status,'invalidated'); h.workspace.view='analyze';
  view=run(); h.lifecycle.reconcile(h.state,h.workspace,false);
  assert.equal(view.status,'invalidated');
  view=run();
  assert.equal(updateDocument(h.state,d=>{d.circuit.components.find(c=>c.type==='R').value=2000;}).ok,true);
  h.lifecycle.reconcile(h.state,h.workspace,true);
  assert.equal(view.status,'invalidated');
  reconcilePanels(h.workspace,h.state);
});

test('preflight counts augmented size and distinct event grid restarts', () => {
  const state=createLab('diode-rc-step');
  assert.equal(augmentedTransientUnknowns(state.document),5);
  assert.equal(transientIntervalBound(state.document,.0005,.00001),50);
  state.document.experiment.sources[0].waveform.at=.00027;
  assert.equal(transientIntervalBound(state.document,.0005,.00001),51);
  assert.equal(transientIntervalBound(state.document,10,0.000001)>3000,true);
  const h=harness(state); h.panel.step=0.0000001;
  assert.equal(h.lifecycle.start(h.panel,h.state,h.workspace,true),null);
  for(let i=0;i<61;i++)state.document.circuit.components.push({id:`extra${i}`,type:'C',p:'out',n:'0',value:1e-9});
  assert.ok(augmentedTransientUnknowns(state.document)>64);
  h.panel.step=.00001;
  assert.equal(h.lifecycle.start(h.panel,h.state,h.workspace,true),null);
});

test('missing transient output blocks Run but changing to DC removes that requirement', () => {
  const h=harness();
  assert.equal(updateDocument(h.state,document=>{
    document.circuit.observations=document.circuit.observations.filter(o=>o.id!=='vout');
  }).ok,true);
  reconcilePanels(h.workspace,h.state);
  assert.equal(h.panel.selectionNeeded,'output');
  assert.equal(h.lifecycle.start(h.panel,h.state,h.workspace,true),null);
  changePanelType(h.workspace,h.panel,'dc',h.state);
  assert.equal(h.panel.selectionNeeded,null);
  changePanelType(h.workspace,h.panel,'transient',h.state);
  assert.equal(h.panel.selectionNeeded,'output');
});

test('worker failures, duplicate panels, language and visibility have explicit one-way outcomes', () => {
  const h=harness();
  const duplicate={...h.panel,id:'duplicate',pending:{},errors:{}};
  h.workspace.panels.push(duplicate);
  const first=h.lifecycle.start(h.panel,h.state,h.workspace,true);
  assert.equal(h.lifecycle.start(duplicate,h.state,h.workspace,true),null);
  setLanguage('mn');
  h.lifecycle.reconcile(h.state,h.workspace,true);
  assert.equal(first.status,'running');
  h.workers[0].worker.onmessageerror();
  assert.equal(first.status,'execution-error');
  assert.equal(h.workers[0].released,true);
  const second=h.lifecycle.start(duplicate,h.state,h.workspace,true);
  assert.equal(second.status,'running');
  h.workers[1].worker.onerror();
  assert.equal(second.status,'execution-error');
  const third=h.lifecycle.start(duplicate,h.state,h.workspace,true);
  h.workers[2].worker.onmessage({data:{kind:'bogus',token:third.token}});
  assert.equal(third.status,'execution-error');
  const fourth=h.lifecycle.start(duplicate,h.state,h.workspace,true);
  h.workspace.panels=h.workspace.panels.filter(panel=>panel.id!==duplicate.id);
  h.lifecycle.reconcile(h.state,h.workspace,true);
  assert.equal(fourth.status,'invalidated');
  assert.equal(h.lifecycle.get(duplicate.id),undefined);
  assert.equal(h.workers[3].worker.stopped,true);
  const unavailable=new TransientRunLifecycle(()=>{throw new Error('blocked');},()=>{});
  const view=unavailable.start(h.panel,h.state,h.workspace,true);
  assert.equal(view.status,'execution-unavailable');
  assert.equal(view.error,'blocked');
  setLanguage('en');
});

test('browser v2 path keeps step, rectifier and smoothing equations and failure prefixes', () => {
  const plain=createLab('half-wave-rectifier').document;
  const peak=nonlinearTransient(plain,{stop:.005,step:.0001});
  assert.equal(peak.status,'ok');
  near(peak.samples.at(-1).observations.vout.value,1.49835139608393,2e-10);
  const smooth=createLab('half-wave-rectifier-rc').document;
  const short=nonlinearTransient(smooth,{stop:.0003,step:.0001});
  assert.equal(short.status,'ok');
  const eta=1.380649e-23*300/1.602176634e-19;
  const diode=v=>1e-12*Math.expm1(v/eta);
  const root=(f,lo,hi)=>{for(let i=0;i<100;i++){const mid=(lo+hi)/2;if(f(mid)>0)hi=mid;else lo=mid;}return (lo+hi)/2;};
  let prior=0;
  for(const sample of short.samples.slice(1)){
    const drive=2*Math.sin(2*Math.PI*50*sample.time),cOverH=1e-5/.0001,
      gain=cOverH+1/10000;
    const junction=root(v=>v+110*diode(v)+(cOverH*prior+diode(v))/gain-drive,-2,2);
    prior=(cOverH*prior+diode(junction))/gain;
    near(sample.observations.vout.value,prior,5e-10);
  }
  const endpoint=nonlinearTransient(createLab('diode-rc-biased-sine').document,
    {stop:3e-5,step:1e-6,maxIntervals:30});
  assert.equal(endpoint.status,'ok');
  assert.equal(endpoint.samples.at(-1).time,3e-5);
  const failed=copy(createLab('diode-rc-step').document);
  const model=failed.circuit.components.find(c=>c.type==='D').model;
  model.saturationCurrentA=1e-6;
  failed.circuit.nodes=['0','out'];
  failed.circuit.components=[{id:'D1Step',type:'D',p:'out',n:'0',model},
    {id:'I1',type:'I',p:'out',n:'0'}];
  failed.experiment.sources=[{id:'I1',dc:0,waveform:{type:'step',at:0,before:0,after:2e-6}}];
  failed.experiment.initial={kind:'storage',values:[]};
  const result=nonlinearTransient(failed,{stop:20e-6,step:10e-6});
  assert.equal(result.status,'failed');
  assert.equal(result.stage,'event');
  assert.deepEqual(result.samples.map(s=>[s.time,s.side]),[[0,'left']]);
});

test('rectifier lesson includes the diode voltage between the source resistor and load', () => {
  const state=createLab('half-wave-rectifier');
  const sample=nonlinearTransient(state.document,{stop:.005,step:.0001}).samples.at(-1);
  const vin=sample.sources.V1Rect.value;
  const va=sample.unknowns['V(a)'].value;
  const vout=sample.observations.vout.value;
  const id=sample.observations.id.value;
  near((vin-va)/100,id,1e-10);
  near(vout/10000,id,1e-10);
  near(va-vout,sample.diodes.D1Rect.terminalVoltageV,1e-10);
  assert.ok(Math.abs(vin-vout)>Math.abs(vin-va));
  for (const locale of ['en','mn']) {
    setLanguage(locale);
    const equation=guideFor('half-wave-rectifier').equation;
    assert.match(equation,/\(Vin−Va\)\/Rsource=Id=Vout\/Rload/);
    assert.match(equation,/Va−Vout=Vd/);
  }
  setLanguage('en');
});

test('accepted event samples, failure rows and exact IDs survive bilingual presentation and CSV', () => {
  const state=createLab('diode-rc-step');
  const component=state.document.circuit.components.find(c=>c.type==='D');
  component.id='<b>D</b>, "Q"';
  state.document.circuit.observations.find(o=>o.type==='current').component=component.id;
  const result=nonlinearTransient(state.document,{stop:20e-6,step:10e-6});
  assert.equal(result.status,'ok');
  const view={panelId:'panel-1',status:'complete',result};
  for(const locale of ['en','mn']){
    setLanguage(locale);
    const html=transientResultHtml('panel-1',state.document,'vout',20e-6,10e-6,view,0,true,false,null);
    assert.match(html,/transient-sample/);
    assert.match(html,/transientEventTable|Source-event|Үүсгүүрийн үйл явдлын/);
    assert.ok(!html.includes('<b>D</b>, "Q"'));
    assert.ok(html.includes('&lt;b&gt;D&lt;/b&gt;, &quot;Q&quot;'));
    assert.match(html,/M[^" ]+ [^" ]+ L[^" ]+ [^" ]+/);
    const details=transientSampleDetails(result.samples[0]);
    assert.ok(details.includes('&lt;b&gt;D&lt;/b&gt;, &quot;Q&quot;'));
    const selected=transientResultHtml('panel-1',state.document,'vout',20e-6,10e-6,
      view,1,false,false,null,true,true);
    assert.match(selected,/data-transient-details="events" open/);
    assert.match(selected,/data-transient-details="diagnostics" open/);
    assert.match(selected,/value="1" selected>0 s/);
  }
  const csv=transientCsv(result,'vout');
  assert.deepEqual(csv.trim().split('\n').slice(1,3).map(row=>row.split(',')[3]),['"left"','"right"']);
  const failed={...result,status:'failed',stage:'event',time:20e-6,code:'iteration-limit',message:'failed',
    samples:result.samples.slice(0,2),trace:[]};
  const failureCsv=transientCsv(failed,'vout');
  assert.match(failureCsv,/"failed","event","iteration-limit"/);
  assert.match(failureCsv,/"vout","V","0.00002","",/);
  const failureHtml=transientResultHtml('panel-1',state.document,'vout',20e-6,10e-6,
    {panelId:'panel-1',status:'numerical-failure',result:failed},0,true,false,null);
  assert.match(failureHtml,/transientSingleTime|one timestamp|нэг цагийн/);
  assert.match(failureHtml,/iteration-limit/);
  const exact=copy(result);
  exact.document.circuit.observations.find(o=>o.id==='vout').id='v,"out"\nline';
  for(const sample of exact.samples){
    sample.observations['v,"out"\nline']=sample.observations.vout;
    delete sample.observations.vout;
  }
  const exactCsv=transientCsv(exact,'v,"out"\nline');
  assert.match(exactCsv,/"v,""out""\nline","V"/);
});

test('a shortened rerun selects the same accepted sample in the dropdown and diagnostics', () => {
  const state=createLab('diode-rc-step');
  const long=nonlinearTransient(state.document,{stop:50e-6,step:10e-6});
  assert.equal(long.status,'ok');
  const lateIndex=long.samples.length-1;
  const short=nonlinearTransient(state.document,{stop:10e-6,step:10e-6});
  assert.equal(short.status,'ok');
  assert.ok(lateIndex>=short.samples.length);
  for(const locale of ['en','mn']){
    setLanguage(locale);
    const html=transientResultHtml('panel-1',state.document,'vout',10e-6,10e-6,
      {panelId:'panel-1',status:'complete',result:short},lateIndex,false,false,null,false,true);
    const selected=[...html.matchAll(/<option value="(\d+)" selected>/g)].map(match=>Number(match[1]));
    assert.deepEqual(selected,[short.samples.length-1]);
    assert.ok(html.includes(transientSampleDetails(short.samples.at(-1))));
    assert.match(html,/data-transient-details="diagnostics" open/);
  }
  setLanguage('en');
});

test('retiring a worker on focused input releases only other panels blocked by that worker', () => {
  const state=createLab('diode-rc-step');
  const h=harness(state);
  const second={...h.panel,id:'second',pending:{},errors:{}};
  h.workspace.panels.push(second);
  const active=h.lifecycle.start(h.panel,h.state,h.workspace,true);
  assert.equal(active.status,'running');
  assert.equal(h.lifecycle.activePanelId,h.panel.id);
  const otherHtml=transientResultHtml(second.id,state.document,second.output,second.duration,
    second.step,undefined,second.transientSampleIndex,false,true,null);
  assert.match(otherHtml,/data-transient-other-running="true" disabled/);
  assert.match(otherHtml,/data-transient-other-running-note/);

  // The focused duration input is deliberately outside the only DOM subtree
  // this production helper edits. An intrinsically blocked third Run stays off.
  const focusedInput={value:'0.00002'};
  const available={dataset:{transientBlocked:'false',transientOtherRunning:'true'},disabled:true};
  const blocked={dataset:{transientBlocked:'true',transientOtherRunning:'true'},disabled:true};
  const notes=[{removed:false,remove(){this.removed=true;}},
    {removed:false,remove(){this.removed=true;}}];
  const root={querySelectorAll(selector){
    return selector.includes('button[')?[available,blocked]:notes;
  }};
  h.panel.pending.duration=focusedInput.value;
  h.lifecycle.reconcile(h.state,h.workspace,true);
  assert.equal(active.status,'invalidated');
  assert.equal(h.lifecycle.activePanelId,null);
  assert.equal(h.workers[0].worker.stopped,true);
  releaseOtherTransientRunControls(root);
  assert.equal(focusedInput.value,'0.00002');
  assert.equal(available.disabled,false);
  assert.equal(blocked.disabled,true);
  assert.deepEqual(notes.map(note=>note.removed),[true,true]);
  assert.equal(h.lifecycle.start(second,h.state,h.workspace,true)?.status,'running');
});
