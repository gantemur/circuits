import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeSynthesis, synthesisPreset, synthesisMethods, SynthesisSession,
  synthesisJson, synthesisCsv, adoptSynthesis, synthesisPortHandoff, synthesisResultHtml,
  synthesisDiagram, createLab, exportNative, createWorkspace, PanelCalculator,
  createBuilder, addNode, applyBuilder, setLanguage } from '../dist/synthesis-test.js';
import { parseDocument } from '../dist/model.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
function harness() {
  const workers=[];
  const session=new SynthesisSession(()=>{
    const worker={terminated:0,released:0,postMessage(request){this.request=request;},terminate(){this.terminated++;}};
    workers.push(worker);
    return {worker,release:()=>worker.released++};
  },()=>{});
  const finish=()=>{
    const worker=workers.at(-1),{token,methods,draft}=worker.request;
    for(const method of methods)worker.onmessage?.({data:{token,method,result:computeSynthesis(draft,method)}});
  };
  return {session,workers,finish};
}
for(const method of synthesisMethods)test(`browser adapter ${method}: independent principal identity, SI topology and Z/Y`,()=>{
  const r=computeSynthesis(synthesisPreset(),method);
  assert.equal(r.mathematical.status,'certified');assert.equal(r.native.status,'generated');assert.equal(r.verification.status,'passed');
  const expected=method==='cauer-infinity'?[['R',1,1000],['C',.5,5e-7],['R',4,4000],['C',1/6,1/6e6]]:
    method==='foster-I'?[['R',1,1000],['C',2/3,2/3e6],['R',.25,250],['C',2,2e-6]]:
    [['R',2,2000],['C',.5,5e-7],['R',2,2000],['C',1/6,1/6e6]];
  r.native.elements.forEach((element,i)=>{assert.equal(element.kind,expected[i][0]);near(element.value,expected[i][2],1e-12);});
  const sample=r.verification.samples.find(s=>s.sPerSecond.re===0&&s.sPerSecond.im===1000);
  // F(j)=6/5-8j/5, G(j)=3/10+4j/10, independently evaluated.
  near(sample.impedanceOhm.re,1200);near(sample.impedanceOhm.im,-1600);
  near(sample.admittanceSiemens.re,.0003,1e-15);near(sample.admittanceSiemens.im,.0004,1e-15);
  assert.deepEqual(r.native.document.circuit.components.map(c=>[c.p,c.n]),method==='foster-I'?
    [['port','n1'],['n1','n2'],['n2','0'],['n2','0']]:[['port','n1'],['n1','0'],[method==='foster-II'?'port':'n1','n2'],['n2','0']]);
  assert.equal(r.native.document.circuit.components.filter(c=>c.type==='V'||c.type==='I').length,0);
});
test('primary admittance uses exact exchanged targets for Cauer and Foster I',()=>{
  const d={...synthesisPreset(),quantity:'admittance',numerator:'0, 2, 1',denominator:'3, 4, 1'};
  for(const method of synthesisMethods){const r=computeSynthesis(d,method);assert.equal(r.mathematical.status,'certified');near(r.verification.samples[2].impedanceOhm.im,-1600);}
});
test('exact zero boundaries and invalid original denominator cannot be confused by reciprocal exchange',()=>{
  for(const quantity of ['impedance','admittance'])for(const method of synthesisMethods){
    const r=computeSynthesis({...synthesisPreset(),quantity,numerator:'0'},method);
    assert.equal(r.mathematical.boundary,quantity==='impedance'?'short':'open');assert.equal(r.native.status,'unavailable');
    assert.equal(computeSynthesis({...synthesisPreset(),quantity,denominator:'0, 0'},method).mathematical.status,'invalid-input');
  }
});
test('missing decomposition differs from exact mismatch and malformed rational input',()=>{
  for(const method of ['foster-I','foster-II']){
    const d={...synthesisPreset(),fosterI:false,fosterII:false,termsI:'bad text',termsII:'bad text'};
    assert.equal(computeSynthesis(d,method).mathematical.status,'decomposition-unavailable');
    const wrong={...synthesisPreset(),rInfinity:'2',gZero:'2'};
    assert.equal(computeSynthesis(wrong,method).mathematical.status,'invalid-decomposition');
  }
  for(const method of synthesisMethods)assert.equal(computeSynthesis({...synthesisPreset(),numerator:'3, 4/'},method).mathematical.status,'invalid-input');
});
for(const id of ['resistor','capacitor','finite','irrational'])test(`worked target ${id} retains independent limits and method availability`,()=>{
  const d=synthesisPreset(id);
  for(const method of synthesisMethods){
    const r=computeSynthesis(d,method);
    if(id==='irrational'&&method!=='cauer-infinity'){assert.equal(r.mathematical.status,'decomposition-unavailable');continue;}
    assert.equal(r.mathematical.status,'certified');assert.equal(r.verification.status,'passed');
    const z=r.verification.samples[2].impedanceOhm;
    if(id==='resistor'){near(z.re,2000);near(z.im,0);}
    if(id==='capacitor'){near(z.re,0);near(z.im,-3000);}
    if(id==='finite'){near(z.re,1500);near(z.im,-500);}
    if(id==='irrational'){near(z.re,4000/3);near(z.im,-2000/3);}
  }
});
test('positive real non-RC and genuine repeated poles remain rejected; exact common factors cancel',()=>{
  for(const [numerator,denominator] of [['1, 1','2, 1'],['1','1, 2, 1']])
    assert.equal(computeSynthesis({...synthesisPreset(),numerator,denominator},'cauer-infinity').mathematical.status,'not-rc');
  // Principal target multiplied by (z+1) without changing its rational identity.
  const d={...synthesisPreset(),numerator:'3, 7, 5, 1',denominator:'0, 2, 3, 1'};
  for(const method of synthesisMethods)assert.equal(computeSynthesis(d,method).verification.status,'passed');
});
test('near distinct poles and finite exact decimal strings are not rounded by the browser adapter',()=>{
  const d={...synthesisPreset(),numerator:'2.000000000001, 2',denominator:'1.000000000001, 2.000000000001, 1',
    rInfinity:'0',kZero:'0',termsI:'1.000000000001, 1\n1, 1'};
  const r=computeSynthesis(d,'foster-I');assert.equal(r.mathematical.status,'certified');
  assert.deepEqual(r.mathematical.poleGroups.map(g=>g.pole),['1','1000000000001/1000000000000']);
});
test('resource and native conversion failures retain distinct evidence layers',()=>{
  for(const method of synthesisMethods){
    assert.equal(computeSynthesis({...synthesisPreset(),numerator:'1'.repeat(1025)},method).mathematical.status,'resource-limit');
    for(const resistance of ['1e400','1e-400']){
      const r=computeSynthesis({...synthesisPreset('resistor'),resistance},method);
      assert.equal(r.mathematical.status,'certified');assert.equal(r.native.status,'unavailable');assert.equal(r.verification.status,'unresolved');
    }
  }
});
test('one worker owns a complete exact snapshot; completion releases once and never alters the applied circuit',()=>{
  const {session,workers,finish}=harness(),state=createLab(),before=exportNative(state);
  session.draft.numerator='3.0, 4e0, 1/1';session.start();
  assert.equal(workers.length,1);assert.equal(workers[0].request.draft.numerator,'3.0, 4e0, 1/1');
  finish();assert.equal(session.status,'complete');assert.equal(workers[0].terminated,1);assert.equal(workers[0].released,1);
  assert.equal(exportNative(state),before);assert.equal(session.lastAccepted.numerator,'3.0, 4e0, 1/1');
});
test('Cancel permanently retires late replies; a new run can finish',()=>{
  const {session,workers,finish}=harness();session.start();
  const old=workers[0],late=old.onmessage,request=old.request;
  session.cancel();assert.equal(session.status,'cancelled');assert.equal(old.terminated,1);
  session.start();late({data:{token:request.token,method:'cauer-infinity',result:computeSynthesis(request.draft,'cauer-infinity')}});
  assert.equal(session.views.get('cauer-infinity').result,null);finish();assert.equal(session.status,'complete');
});
test('editing while running retires the request even if identical text is restored',()=>{
  const {session,workers}=harness();session.start();const late=workers[0].onmessage,request=workers[0].request;
  session.edit('numerator','3,');session.edit('numerator',request.draft.numerator);
  late({data:{token:request.token,method:'cauer-infinity',result:computeSynthesis(request.draft,'cauer-infinity')}});
  assert.equal(session.status,'invalidated');assert.equal(session.current('cauer-infinity'),undefined);assert.equal(synthesisJson(session,'cauer-infinity'),null);
});
test('decomposition edits invalidate only their completed method; scales invalidate every method',()=>{
  const {session,finish}=harness();session.start();finish();
  assert.equal(session.presetId,'principal');session.edit('rInfinity','1/');assert.equal(session.presetId,'');assert.equal(session.current('foster-I'),undefined);assert.ok(session.current('cauer-infinity'));assert.ok(session.current('foster-II'));
  assert.equal(session.lastAccepted.rInfinity,'1');assert.equal(session.draft.rInfinity,'1/');
  session.edit('frequency','2000');for(const method of synthesisMethods)assert.equal(session.current(method),undefined);
});
test('worker unavailable and execution failure have no synchronous fallback',()=>{
  const session=new SynthesisSession(()=>{throw Error('no Worker');},()=>{});session.start();assert.equal(session.status,'execution-unavailable');assert.equal(session.lastAccepted,null);
  const h=harness();h.session.start();h.workers[0].onerror({message:'test crash'});
  assert.equal(h.session.status,'execution-error');assert.equal(h.workers[0].released,1);assert.equal(h.session.current('foster-I'),undefined);
});
test('unresolved physical KCL cannot be applied, but current certified JSON is available with a warning',()=>{
  const {session,finish}=harness();session.selected=['foster-I'];
  Object.assign(session.draft,{numerator:'1.000000000001, 1',denominator:'1, 1',rInfinity:'1',kZero:'0',termsI:'1, 1e-12'});
  session.start();finish();const view=session.current('foster-I');
  assert.equal(view.result.mathematical.status,'certified');assert.equal(view.result.verification.status,'unresolved');
  assert.ok(synthesisJson(session,'foster-I'));assert.equal(synthesisJson(session,'foster-I',true),null);
  setLanguage('en');const html=synthesisResultHtml(view,true);assert.match(html,/Unverified numerical realization/);assert.match(html,/data-syn-apply="foster-I" disabled/);
});
test('Apply requires draft confirmation, strict native import, and preserves independent panel settings',()=>{
  const {session,finish}=harness(),state=createLab(),ws=createWorkspace(state),builder=createBuilder(state);
  addNode(builder);const draft=JSON.stringify(builder.draft),before=exportNative(state),panels=JSON.stringify(ws.panels);
  session.start();finish();assert.equal(adoptSynthesis(session,'foster-II',state,true).status,'confirmation-required');assert.equal(exportNative(state),before);
  const applied=adoptSynthesis(session,'foster-II',state,true,true);assert.equal(applied.status,'applied');
  assert.equal(JSON.stringify(builder.draft),draft);assert.equal(JSON.stringify(ws.panels),panels);assert.equal(applyBuilder(builder,state).ok,false);
  assert.deepEqual(parseDocument(synthesisJson(session,'foster-II')),state.document);
  const id=synthesisPortHandoff(ws,state,applied.snapshot);assert.ok(id);assert.equal(JSON.stringify(ws.panels.slice(0,-1)),panels);
  const p=ws.panels.at(-1);assert.equal(p.type,'port-frequency');assert.equal(p.p,'port');assert.equal(p.q,'0');assert.equal(p.externalDrive,null);
  const result=new PanelCalculator().calculate(p,state);assert.equal(result.type,'port-frequency');
  assert.equal(synthesisPortHandoff(ws,state,applied.snapshot),null);
  const keep=ws.panels[1],replace=ws.panels[0].id;assert.equal(synthesisPortHandoff(ws,state,applied.snapshot,replace),replace);assert.equal(ws.panels[1],keep);
  assert.equal(synthesisPortHandoff(ws,state,before),null);
});
test('JSON and CSV exports preserve measured data and become unavailable after invalidation',()=>{
  const {session,finish}=harness();session.start();finish();
  const json=synthesisJson(session,'cauer-infinity');assert.equal(parseDocument(json).circuit.schemaVersion,1);
  assert.ok(!json.includes('fosterI'));assert.ok(!json.includes('numerator'));
  const lines=synthesisCsv(session,'cauer-infinity').split('\n');assert.equal(lines.length,8);near(Number(lines[3].split(',')[2]),1200);
  session.edit('numerator','no');assert.equal(synthesisCsv(session,'cauer-infinity'),null);assert.equal(synthesisJson(session,'cauer-infinity'),null);
});
test('rendering in either language keeps exact pending text, scientific ownership and escaped content',()=>{
  const {session,finish}=harness();session.start();finish();const token=session.current('foster-II').token;
  for(const language of ['mn','en']){setLanguage(language);const html=synthesisResultHtml(session.current('foster-II'),true);assert.match(html,/= G\(z\)/);assert.match(html,/1200 − 1600i/);assert.equal(session.current('foster-II').token,token);}
  const view={...session.current('foster-II'),snapshot:{...session.draft,numerator:'<img src=x>'}};
  assert.match(synthesisResultHtml(view,false),/&lt;img src=x&gt;/);assert.doesNotMatch(synthesisResultHtml(view,false),/<img src=x>/);
});
test('principal diagrams connect every actual endpoint with aligned symbols and section leads',()=>{
  const diagrams={};
  for(const method of synthesisMethods){
    const r=computeSynthesis(synthesisPreset(),method),svg=synthesisDiagram(r,method);diagrams[method]=svg;
    assert.equal((svg.match(/data-syn-edge=/g)||[]).length,4);assert.doesNotMatch(svg,/NaN|Infinity/);
    for(const c of r.native.document.circuit.components)assert.ok(svg.includes(`data-syn-edge="${c.id}" data-p="${c.p}" data-n="${c.n}"`));
    // Each local horizontal lead meets the resistor box or capacitor plate exactly.
    for(const match of svg.matchAll(/<g transform="translate\([^\"]+\) rotate\([^\"]+\)">([\s\S]*?)<\/g>/g)){
      const body=match[1],lead=Number(body.match(/M0 0L([\d.]+) 0/)[1]);
      if(body.includes('<rect'))assert.equal(lead,Number(body.match(/<rect x="([\d.]+)"/)[1]));
      else assert.equal(lead,Number(body.match(/<path d="M([\d.]+) -17v34/)[1]));
    }
  }
  assert.match(diagrams['cauer-infinity'],/<text x="216" y="104">n1<\/text>/); // off the x=240 capacitor lead
  assert.match(diagrams['foster-II'],/<text x="66" y="219">n1<\/text>/); // off the x=90 series lead
  assert.match(diagrams['cauer-infinity'],/M60 250L420 250/); // common return bus spans both shunts
  assert.match(diagrams['foster-I'],/<text x="704" y="179">0<\/text>/); // label clear of the return wire
  assert.match(diagrams['foster-I'],/M470 95L470 215/);assert.match(diagrams['foster-I'],/M680 95L680 215/); // both parallel-section endpoints
  assert.match(diagrams['foster-II'],/M50 60L370 60/);assert.match(diagrams['foster-II'],/M50 335L370 335/); // both buses
  const r=computeSynthesis(synthesisPreset('finite'),'cauer-infinity');assert.equal(synthesisDiagram(r,'cauer-infinity'),null);assert.equal(r.native.document.circuit.components.length,3);
});
test('main-thread UI never imports the computation adapter and packaging embeds a separate worker',()=>{
  const ui=readFileSync('web/synthesis-ui.ts','utf8');assert.doesNotMatch(ui,/computeSynthesis|synthesizeRc\(/);assert.match(ui,/new Worker\(url\)/);
  const main=readFileSync('web/main.ts','utf8');assert.match(main,/synthesisUI.leave\(\)/);
  const build=readFileSync('scripts/build-app.mjs','utf8');assert.match(build,/synthesis-worker\.ts/);assert.match(build,/synthesis-worker-source/);
});

test('production UI input path preserves the control tree, drafts and last accepted target',async()=>{
  const {SynthesisUI}=await import('../dist/synthesis-test.js');
  class Element {constructor(dataset={},value='',id=''){this.dataset=dataset;this.value=value;this.id=id;}closest(s){return s===`#${this.id}`?this:null;}}
  globalThis.Element=Element;globalThis.HTMLInputElement=class extends Element {};
  globalThis.HTMLTextAreaElement=class extends Element {};globalThis.HTMLSelectElement=class extends Element {};
  const nodes=new Map(['#synthesis-expression','#synthesis-state','#synthesis-results','#synthesis-adoption','#synthesis-run','#synthesis-cancel'].map(k=>[k,{innerHTML:'',textContent:'',disabled:false}]));
  const root={listeners:{},writes:0,set innerHTML(value){this.html=value;this.writes++;},addEventListener(type,fn){this.listeners[type]=fn;},querySelector(selector){return nodes.get(selector)??null;}};
  const state=createLab(),before=exportNative(state),ui=new SynthesisUI(root,()=>state,createWorkspace(state),{hasDrafts:()=>false,changed:()=>{},openAnalyze:()=>{},download:()=>{}});
  const h=harness();h.session.start();h.finish();Object.defineProperty(ui,'session',{value:h.session});ui.render();
  const controls=root.writes,input=new HTMLInputElement({synField:'numerator'},'3, 4/');
  root.listeners.input({target:input});
  assert.equal(root.writes,controls);assert.equal(input.value,'3, 4/');assert.equal(ui.session.draft.numerator,'3, 4/');
  assert.equal(ui.session.lastAccepted.numerator,'3, 4, 1');assert.equal(exportNative(state),before);
  for(const language of ['mn','en']){setLanguage(language);ui.render();assert.match(root.html,/value="3, 4\/"/);assert.equal(ui.session.draft.numerator,'3, 4/');}
  ui.session.start();const worker=h.workers.at(-1);ui.leave();assert.equal(worker.terminated,1);assert.equal(ui.session.status,'cancelled');
});

test('packaged synthesis worker executes the accepted adapter away from the caller',async()=>{
  const {Worker}=await import('node:worker_threads');
  // Use the exact embedded source that the production Blob worker receives.
  const app=readFileSync('dist/app.js','utf8');
  const declaration=app.split('\n').find(line=>line.startsWith('var synthesisWorkerSource = '));
  assert.ok(declaration,'Production embedded worker source is present');
  const {runInNewContext}=await import('node:vm');
  const source=runInNewContext(`${declaration}; synthesisWorkerSource`,{});
  const worker=new Worker(`const {parentPort}=require('node:worker_threads');global.self={postMessage:x=>parentPort.postMessage(x)};${source}\nparentPort.on('message',data=>self.onmessage({data}));`,{eval:true});
  try{
    const replies=[];
    const done=new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('message',reply=>{replies.push(reply);if(replies.length===3)resolve();});});
    worker.postMessage({token:77,methods:[...synthesisMethods],draft:synthesisPreset()});
    await done;
    assert.deepEqual(replies.map(r=>r.token),[77,77,77]);assert.deepEqual(replies.map(r=>r.method),synthesisMethods);
    for(const reply of replies)assert.equal(reply.result.verification.status,'passed');
  }finally{await worker.terminate();}
});

test('adoption handoff uses the certified reference frequency, including exact fraction input',()=>{
  const {session,finish}=harness();session.edit('frequency','2600/2');session.start();finish();
  const state=createLab(),ws=createWorkspace(state),applied=adoptSynthesis(session,'foster-I',state,false);
  near(applied.frequencyHz,1300/(2*Math.PI),1e-12);
  const id=synthesisPortHandoff(ws,state,applied.snapshot,undefined,applied.frequencyHz);
  near(ws.panels.find(p=>p.id===id).portFrequencyHz,1300/(2*Math.PI),1e-12);
});
