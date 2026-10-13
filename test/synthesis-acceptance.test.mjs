import test from 'node:test';
import assert from 'node:assert/strict';
import { SynthesisSession,SynthesisUI,synthesisMethods,computeSynthesis,synthesisPreset,
  synthesisAdoptionContext,adoptSynthesis,synthesisCsv,synthesisJson,createLab,createWorkspace,
  exportNative,importNative,setLanguage } from '../dist/synthesis-test.js';
import { ExactBudget,parseExact,reduceFunction,verifyRcRealization } from '../dist/index.js';

function completed(methods=[...synthesisMethods],draft=synthesisPreset()) {
  const workers=[];
  const session=new SynthesisSession(()=>{
    const worker={postMessage(r){this.request=r;},terminate(){this.terminated=true;}};
    workers.push(worker);return {worker,release:()=>{worker.released=true;}};
  },()=>{});
  session.selected=methods;session.draft=draft;session.start();
  const worker=workers[0];
  const reply=method=>worker.onmessage?.({data:{token:worker.request.token,method,result:computeSynthesis(draft,method)}});
  return {session,workers,reply,finish(){methods.forEach(reply);}};
}
// The production event handlers run against a small DOM seam. Real Chrome
// acceptance separately exercises actual input, rendering and file operations.
function uiHarness() {
  class Element {
    constructor(id='',dataset={}){this.id=id;this.dataset=dataset;}
    closest(selector){return selector===`#${this.id}`||(selector==='[data-syn-apply]'&&this.dataset.synApply)?this:null;}
  }
  globalThis.Element=Element;globalThis.HTMLInputElement=class extends Element {};
  globalThis.HTMLTextAreaElement=class extends Element {};globalThis.HTMLSelectElement=class extends Element {};
  const nodes=new Map(['expression','state','results','adoption','run','cancel'].map(k=>[`#synthesis-${k}`,{innerHTML:'',textContent:''}]));
  const root={innerHTML:'',listeners:{},querySelector(s){return nodes.get(s)??null;},addEventListener(k,f){this.listeners[k]=f;}};
  const state=createLab(),h=completed();h.finish();let changes=0,pending=false;
  const ui=new SynthesisUI(root,()=>state,createWorkspace(state),{hasDrafts:()=>true,hasPendingEdits:()=>pending,
    changed:()=>changes++,openAnalyze:()=>{},download:()=>{}});
  Object.defineProperty(ui,'session',{value:h.session});ui.render();
  return {state,ui,session:h.session,nodes,changes:()=>changes,setPending:v=>pending=v,
    click(id='',method){root.listeners.click({target:new Element(id,method?{synApply:method}:{})});}};
}
function csvRecords(text) {
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(!quoted&&(c===','||c==='\n')){row.push(cell);cell='';if(c==='\n'){rows.push(row);row=[];}}
    else cell+=c;
  }
  row.push(cell);rows.push(row);const header=rows.shift();
  return rows.map(values=>Object.fromEntries(header.map((key,i)=>[key,values[i]])));
}
test('old confirmation cannot adopt after a native-document change, even without a render',()=>{
  const h=uiHarness();h.click('','cauer-infinity');
  assert.match(h.nodes.get('#synthesis-adoption').innerHTML,/synthesis-confirm/);
  importNative(h.state,exportNative(createLab('rc')));const current=exportNative(h.state);
  h.click('synthesis-confirm');assert.equal(exportNative(h.state),current);assert.equal(h.changes(),0);
  assert.doesNotMatch(h.nodes.get('#synthesis-adoption').innerHTML,/id="synthesis-confirm"/);
  assert.match(h.nodes.get('#synthesis-adoption').innerHTML,/changed/);
});
test('render retires document-bound confirmation; fresh explicit confirmation can adopt with drafts',()=>{
  const h=uiHarness();h.click('','foster-I');
  importNative(h.state,exportNative(createLab('rc')));h.ui.render();
  assert.doesNotMatch(h.nodes.get('#synthesis-adoption').innerHTML,/id="synthesis-confirm"/);
  h.click('','foster-I');h.click('synthesis-confirm');assert.equal(h.changes(),1);
  assert.equal(h.state.document.experiment.sources.length,0);
});
test('adoption model rejects change-and-restore, changed token and wrong method contexts',()=>{
  const h=completed();h.finish();const state=createLab(),saved=exportNative(state);
  const context=synthesisAdoptionContext(h.session,'foster-I',state);
  importNative(state,exportNative(createLab('rc')));importNative(state,saved);
  assert.equal(adoptSynthesis(h.session,'foster-I',state,true,true,context).status,'stale');
  const fresh=synthesisAdoptionContext(h.session,'foster-I',state);
  assert.equal(adoptSynthesis(h.session,'foster-II',state,true,true,fresh).status,'stale');
  h.session.start();assert.equal(adoptSynthesis(h.session,'foster-I',state,true,true,fresh).status,'stale');
  assert.equal(exportNative(state),saved);
});
test('pending inspector/source edits block both first Apply and a previously opened confirmation',()=>{
  const h=uiHarness(),saved=exportNative(h.state);h.setPending(true);
  for(const lang of ['en','mn']){
    setLanguage(lang);h.click('','foster-II');assert.equal(exportNative(h.state),saved);
    assert.doesNotMatch(h.nodes.get('#synthesis-adoption').innerHTML,/id="synthesis-confirm"/);
    assert.match(h.nodes.get('#synthesis-adoption').innerHTML,lang==='en'?/Pending component or source text/:/Элемент эсвэл үүсгүүр/);
  }
  h.setPending(false);h.click('','foster-II');h.setPending(true);h.click('synthesis-confirm');
  assert.equal(h.changes(),0);assert.equal(exportNative(h.state),saved);
  h.setPending(false);h.click('','foster-II');h.click('synthesis-confirm');assert.equal(h.changes(),1);setLanguage('en');
});
test('completed method remains eligible after batch cancellation; unfinished methods and late replies stay retired',()=>{
  const h=completed();const late=h.workers[0].onmessage;h.reply('cauer-infinity');h.session.cancel();
  assert.ok(synthesisJson(h.session,'cauer-infinity',true));assert.ok(synthesisCsv(h.session,'cauer-infinity'));
  assert.equal(synthesisJson(h.session,'foster-I'),null);
  late({data:{token:h.workers[0].request.token,method:'foster-I',result:computeSynthesis(synthesisPreset(),'foster-I')}});
  assert.equal(h.session.current('foster-I'),undefined);assert.ok(h.workers[0].terminated&&h.workers[0].released);
});
test('CSV carries stable three-layer statuses, physical samples, limits and experiment kinds',()=>{
  const h=completed();h.finish();
  for(const method of synthesisMethods){
    const rows=csvRecords(synthesisCsv(h.session,method));assert.equal(rows.length,7);
    rows.forEach((r,i)=>{
      assert.equal(r.method,method);assert.equal(r.mathematical_status,'certified');assert.equal(r.native_status,'generated');
      assert.equal(r.verification_status,'passed');assert.equal(r.experiment_kind,i<5?'RMS':'right-half-plane');
      assert.equal(r.Z_comparison_passed,'true');assert.equal(r.Y_comparison_passed,'true');
      assert.ok(+r.Z_normalized_difference<=+r.Z_normalized_limit);assert.ok(+r.Y_normalized_difference<=+r.Y_normalized_limit);
    });
    assert.ok(Math.abs(+rows[2].Z_real_ohm-1200)<1e-8);assert.ok(Math.abs(+rows[2].Z_imag_ohm+1600)<1e-8);
  }
});
test('CSV reports a real physical mismatch without concealing failed comparisons',()=>{
  const h=completed(['foster-I']);h.finish();const r=h.session.current('foster-I').result;
  const wrong=structuredClone(r.native.document);wrong.circuit.components.find(c=>c.id==='C1').n='0';
  const b=new ExactBudget(),p=xs=>xs.map(x=>parseExact(x,b));
  const target=reduceFunction(p(['3','4','1']),p(['0','2','1']),b).value;
  r.verification=verifyRcRealization(wrong,target,parseExact('1000',b),parseExact('1000',b),b);
  assert.equal(r.verification.status,'mismatch');
  const rows=csvRecords(synthesisCsv(h.session,'foster-I'));
  assert.ok(rows.every(r=>r.verification_status==='mismatch'));assert.ok(rows.some(r=>r.Z_comparison_passed==='false'));
});
test('CSV preserves actual unresolved accepted samples and explicit zero-sample metadata',()=>{
  const draft={...synthesisPreset(),numerator:'1.000000000001, 1',denominator:'1, 1',rInfinity:'1',kZero:'0',termsI:'1, 1e-12'};
  const h=completed(['foster-I'],draft);h.finish();const r=h.session.current('foster-I').result;
  assert.equal(r.verification.status,'unresolved');
  const rows=csvRecords(synthesisCsv(h.session,'foster-I'));
  assert.equal(rows.length,Math.max(1,r.verification.samples.length));assert.ok(rows.every(v=>v.verification_status==='unresolved'));
  assert.equal(synthesisJson(h.session,'foster-I',true),null);
  // Native range failure is a real certificate with no numerical measurements.
  const range=completed(['cauer-infinity'],{...synthesisPreset('resistor'),resistance:'1e400'});range.finish();
  const zero=csvRecords(synthesisCsv(range.session,'cauer-infinity'));
  assert.equal(zero.length,1);assert.equal(zero[0].record_type,'metadata');assert.equal(zero[0].Z_real_ohm,'');
  assert.equal(zero[0].native_status,'unavailable');assert.equal(zero[0].mathematical_status,'certified');
});
test('CSV partial-evidence serialization escapes explanatory strings and invents no later samples',()=>{
  const h=completed(['cauer-infinity']);h.finish();const r=h.session.current('cauer-infinity').result;
  // Formatter contract for a verifier stopped after two accepted measurements.
  r.verification={status:'unresolved',reason:'Stopped, "budget"\nNo later measurements',samples:r.verification.samples.slice(0,2)};
  const text=synthesisCsv(h.session,'cauer-infinity'),rows=csvRecords(text);
  assert.equal(rows.length,2);assert.equal(rows[0].verification_reason,r.verification.reason);
  assert.equal(rows[1].sample_index,'1');assert.equal(rows[1].verification_status,'unresolved');
  assert.match(text,/"Stopped, ""budget""\nNo later measurements"/);
});
