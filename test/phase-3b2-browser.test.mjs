import test from 'node:test';
import assert from 'node:assert/strict';
import {createLab,importNative,exportNative,updateDocument} from '../dist/lab-test.js';
import {createPanel,createWorkspace,PanelCalculator,reconcilePanels,handlePanelFieldChange,panelCsv} from '../dist/workspace-test.js';
import {createBuilder,touchBuilder,applyBuilder,newBuilder} from '../dist/builder-test.js';
import {presets,matchingPreset} from '../dist/presets-test.js';
import {bjtDcHtml,bjtSchematic,setLanguage} from '../dist/bjt-presentation-test.js';
import {runDcSweep} from '../dist/dc-sweep-test.js';
const near=(a,b,eps=1e-7)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=eps,`${a} != ${b}`);
const analyze=(name,type='dc')=>{const state=createLab(name),panel=createPanel(state,'p',type),calculator=new PanelCalculator();return {state,panel,calculator,result:calculator.calculate(panel,state)}};

test('v3 routing replaces the Phase 3B1 browser rejection boundary; strict rejection preserves circuit',()=>{
  const state=createLab(),baseline=exportNative(state);
  assert.equal(importNative(state,'{').ok,false);assert.equal(exportNative(state),baseline);
  assert.equal(importNative(state,JSON.stringify(presets.find(p=>p.id==='bjt-ce').document)).ok,true);
  const valid=exportNative(state);assert.equal(JSON.parse(valid).circuit.schemaVersion,3);
  const bad=JSON.parse(valid);bad.circuit.components[0].model.betaForward=0;
  assert.equal(importNative(state,JSON.stringify(bad)).ok,false);assert.equal(exportNative(state),valid);
  assert.equal(importNative(state,valid).ok,true);assert.equal(exportNative(state),valid);
});
test('five transistor examples preserve 30 existing examples and exact topology matching',()=>{
  assert.equal(presets.length,35);
  for(const id of ['bjt-ce','bjt-follower','bjt-saturation','bjt-cutoff','bjt-pnp']){
    const s=createLab(id);assert.equal(matchingPreset(s.document.circuit).id,id);
    assert.equal(bjtSchematic(s).schematic,true);
    const q=s.document.circuit.components.find(c=>c.type==='Q');q.b=q.e;
    assert.equal(bjtSchematic(s).schematic,false);
    assert.match(bjtSchematic(s).html,/c=c; b=/);
  }
});
test('browser CE and follower use independent gain references, configured RMS and conservation',()=>{
  for(const [id,reference] of [['bjt-ce',-47.6190476531],['bjt-follower',.9756097561]]){
    const {state,panel,calculator,result}=analyze(id,'frequency');assert.equal(result.type,'frequency');
    near(result.sweep[0].value.re,reference);near(result.ac.observations.out.value.re,.001*reference,1e-10);
    const q=calculator.currentBjtBias(state).bjts.Q1;near(q.currentsA.c+q.currentsA.b+q.currentsA.e,0,1e-18);
    panel.output='ic';const current=calculator.calculate(panel,state);assert.equal(current.unit,'A/V');assert.equal(current.ac.status,'ok');
    assert.match(panelCsv(panel,current),/ratio_unit/);
  }
});
test('source, load and model changes invalidate browser bias without touching independent panel settings',()=>{
  const {state,panel,calculator,result}=analyze('bjt-ce','frequency');
  const before=calculator.currentBjtBias(state);panel.points=17;
  assert.equal(updateDocument(state,d=>{d.circuit.components.find(c=>c.id==='Rl').value=5000;}).ok,true);
  const loaded=calculator.calculate(panel,state);assert.notEqual(loaded.sweep[0].value.re,result.sweep[0].value.re);
  assert.notEqual(calculator.currentBjtBias(state),before);assert.equal(panel.points,17);
  const accepted=exportNative(state),revision=state.revision;
  assert.equal(updateDocument(state,d=>{d.circuit.components[0].model.betaForward=-1;}).ok,false);
  assert.equal(exportNative(state),accepted);assert.equal(state.revision,revision);
  updateDocument(state,d=>{d.experiment.sources[0].dc+=.01;});
  assert.notEqual(calculator.currentBjtBias(state).unknowns['V(b)'],before.unknowns['V(b)']);
});
test('external collector capacitor produces independently computed complex voltage and terminal currents',()=>{
  const {state,panel,calculator}=analyze('bjt-ce','frequency');
  const C=1e-6,omega=2*Math.PI*panel.inspectHz;
  updateDocument(state,d=>{d.circuit.components.push({id:'Cc',type:'C',p:'c',n:'0',value:C});d.circuit.observations.push({id:'cc',type:'current',component:'Cc'});});
  const result=calculator.calculate(panel,state);const G=1/2000+1/10000,gm=.001/.025,gb=gm/100;
  const numerator=-gm/(1+1000*gb),den=G*G+(omega*C)**2;
  const h={re:numerator*G/den,im:-numerator*omega*C/den};
  near(result.ac.observations.out.value.re,.001*h.re,1e-10);near(result.ac.observations.out.value.im,.001*h.im,1e-10);
  panel.output='cc';const current=calculator.calculate(panel,state);near(current.ac.observations.cc.value.re,-omega*C*.001*h.im,1e-10);
  assert.equal(bjtSchematic(state).schematic,false);
});
test('PNP mirror, saturation and cutoff preserve independent signed terminal currents',()=>{
  const npn=analyze('bjt-ce').result.bias,pnp=analyze('bjt-pnp').result.bias;
  for(const t of ['c','b','e'])near(pnp.bjts.Q1.currentsA[t],-npn.bjts.Q1.currentsA[t],1e-12);
  for(const [id,key,expected] of [['bjt-saturation','Q1',[.000875,.000035,-.000910]],['bjt-cutoff','Q1Off',[.125e-12,-.130e-12,.005e-12]]]){
    const q=analyze(id).result.bias.bjts[key];['c','b','e'].forEach((t,i)=>near(q.currentsA[t],expected[i],id==='bjt-cutoff'?1e-26:1e-12));
  }
});
test('missing observation requires explicit reselection; DC clears requirements; unsupported v3 tools do not run',()=>{
  const state=createLab('bjt-ce'),workspace=createWorkspace(state),calculator=new PanelCalculator();
  const p=workspace.panels.find(p=>p.type==='frequency');
  updateDocument(state,d=>{d.circuit.observations=d.circuit.observations.filter(o=>o.id!=='out');});reconcilePanels(workspace,state);
  assert.equal(p.selectionNeeded,'output');assert.equal(calculator.calculate(p,state),null);
  handlePanelFieldChange(workspace,state,p.id,'type','dc');assert.equal(calculator.calculate(p,state).type,'bjt-dc');
  for(const type of ['transient','port','port-frequency','dc-sweep','diode-characteristic']) {
    const p=createPanel(createLab('bjt-ce'),type,type);p.selectionNeeded='diode';
    assert.equal(calculator.calculate(p,createLab('bjt-ce')).type,'bjt-unavailable');
  }
});
test('failed BJT calculation remains an applied valid v3 document; source sweeps reject before solving',async()=>{
  const {state,panel,calculator}=analyze('bjt-ce');
  assert.equal(updateDocument(state,d=>{d.circuit.components.push({id:'bad',type:'V',p:'drive',n:'0'});d.experiment.sources.push({id:'bad',dc:99});}).ok,true);
  assert.equal(calculator.calculate(panel,state).bias.status,'failed');assert.equal(state.document.circuit.schemaVersion,3);
  await assert.rejects(runDcSweep(state.document,{sourceId:'Vs',observationId:'out',minimum:0,maximum:1,count:3},()=>true),/unavailable/);
});
test('edited v1 Form draft survives v3 application and cannot silently overwrite it',()=>{
  const state=createLab(),builder=createBuilder(state);builder.draft.circuit.label='draft';touchBuilder(builder);
  importNative(state,JSON.stringify(presets.find(p=>p.id==='bjt-ce').document));
  assert.equal(applyBuilder(builder,state).ok,false);assert.equal(builder.draft.circuit.label,'draft');assert.equal(state.document.circuit.schemaVersion,3);
});
test('production bilingual results escape exact transistor IDs and expose all nine labeled derivatives',()=>{
  const {state,calculator}=analyze('bjt-ce');const id='<em>Q</em> & "B"';
  updateDocument(state,d=>{d.circuit.components[0].id=id;d.circuit.observations.forEach(o=>{if(o.type==='terminal-current')o.component=id;});});
  for(const language of ['en','mn']){
    setLanguage(language);const html=bjtDcHtml(calculator.currentBjtBias(state),true);
    assert.ok(html.includes('&lt;em&gt;Q&lt;/em&gt; &amp; &quot;B&quot;'));assert.ok(!html.includes('<em>'));
    assert.match(html,/∂i\/∂V \(S\)/);assert.match(html,/iC=σ/);assert.match(html,/0.040000000/);
  }
  setLanguage('en');
});

test('curated BJT leads end on resistor/source boundaries and arrows reverse without changing terminals',()=>{
  const ce=bjtSchematic(createLab('bjt-ce')).html;
  // Rs spans x=120..180 on the base branch. Rc spans y=75..115;
  // circle leads end at center ±22, not at diamond endpoints.
  for(const path of ['M65 250L120 250','M180 250L240 250','M360 45L360 75','M360 115L360 150',
    'M65 250L65 274','M65 318L65 400','M360 350L360 400'])assert.ok(ce.includes(path),path);
  assert.match(ce,/cx="65" cy="296" r="22"/);
  assert.match(ce,/M334 288l-12 -2 5 -10Z/);
  const pnp=bjtSchematic(createLab('bjt-pnp')).html;assert.match(pnp,/M315 275l12 2 -5 10Z/);
  const sat=bjtSchematic(createLab('bjt-saturation')).html;
  // The emitter is clamped through Ve, never directly wired to ground.
  assert.ok(!sat.includes('M360 350L360 400'));
  for(const path of ['M360 350L420 350','M420 350L420 270','M420 270L450 270','M450 270L450 294','M450 338L450 400'])assert.ok(sat.includes(path),path);
});

test('bounded browser BJT calculation rejects oversize circuits before dense Newton',()=>{
  const {state,panel,calculator}=analyze('bjt-ce');
  updateDocument(state,d=>{for(let i=0;i<129;i++)d.circuit.components.push({id:'extra'+i,type:'R',p:'b',n:'0',value:1e6});});
  const result=calculator.calculate(panel,state);assert.equal(result.bias.status,'failed');assert.match(result.bias.message,/128 components/);
});


test('explicit New creates a usable v1 draft from a v3 circuit; implicit empty placeholder cannot Apply',()=>{
  const state=createLab('bjt-ce'),builder=createBuilder(state);
  assert.equal(applyBuilder(builder,state).ok,false);
  newBuilder(builder,state);
  builder.draft.circuit.nodes.push('a');
  builder.draft.circuit.components.push({id:'R',type:'R',p:'a',n:'0',value:'1000'});
  assert.equal(applyBuilder(builder,state).ok,true);assert.equal(state.document.circuit.schemaVersion,1);
});

test('mixed diode inspector uses full accepted v3 bias and preserves failed-state labeling', async()=>{
  const {mixedDiodeMetrics,bjtMetrics}=await import('../dist/bjt-presentation-test.js');
  const state=createLab('bjt-ce'), calculator=new PanelCalculator();
  const id='<em>D</em> & "exact"';
  assert.equal(updateDocument(state,d=>{
    d.circuit.components.push({id,type:'D',p:'b',n:'0',model:{kind:'shockley-series',saturationCurrentA:1e-12,idealityFactor:1,seriesResistanceOhm:10,temperatureK:290.11295303875204}});
    d.circuit.observations.push({id:'diode',type:'current',component:id});
  }).ok,true);
  let bias=calculator.currentBjtBias(state);assert.equal(bias.status,'ok');
  // Independent monotone series-law root at the coupled network's terminal V.
  const diode=bias.diodes[id];let lo=0,hi=diode.terminalVoltageV;
  for(let k=0;k<100;k++){const v=(lo+hi)/2;if(v+10e-12*Math.expm1(v/.025)>diode.terminalVoltageV)hi=v;else lo=v;}
  near(diode.currentA,1e-12*Math.expm1((lo+hi)/2/.025),1e-12);
  near(diode.differentialResistanceOhm,10+.025/(diode.currentA+1e-12),1e-5);
  for(const lang of ['en','mn']){setLanguage(lang);const html=mixedDiodeMetrics(id,bias);assert.ok(html.includes(diode.currentA.toPrecision(8)));assert.ok(html.includes(diode.junctionVoltageV.toPrecision(8)));assert.doesNotMatch(html,/<em>/);}
  const before=bias;
  updateDocument(state,d=>{d.circuit.components.find(c=>c.type==='Q').model.betaForward=200;});
  bias=calculator.currentBjtBias(state);assert.notEqual(bias.diodes[id].currentA,before.diodes[id].currentA);
  updateDocument(state,d=>{d.circuit.components.find(c=>c.id===id).model.seriesResistanceOhm=100;});
  assert.notEqual(calculator.currentBjtBias(state).diodes[id].currentA,bias.diodes[id].currentA);
  const valid=exportNative(state);assert.equal(updateDocument(state,d=>{d.circuit.components.find(c=>c.id===id).model.saturationCurrentA=-1;}).ok,false);assert.equal(exportNative(state),valid);
  for(const lang of ['en','mn']){setLanguage(lang);assert.doesNotMatch(bjtMetrics('Q1',null),/rd/);assert.ok(mixedDiodeMetrics(id,null).length);}
  setLanguage('en');
});
