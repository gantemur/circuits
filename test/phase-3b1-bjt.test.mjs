import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateBjt, parseBjtDocument, serializeBjtDocument, validateBjtDocument,
  assembleBjtSystem, evaluateBjtSystem, solveBjtOperatingPoint, createBjtTangent,
  solveBjtFrequency, bjtTransfer, boltzmannJPerK, elementaryChargeC,
  parseDocument, parseNonlinearDocument, nonlinearTransient, complex } from '../dist/index.js';
const clone = value => JSON.parse(JSON.stringify(value));
const load = name => parseBjtDocument(readFileSync(new URL(`../fixtures/bjt/${name}.json`,import.meta.url),'utf8'));
const near = (a,b,abs=1e-12,rel=1e-9) => assert.ok(Math.abs(a-b)<=abs+rel*Math.abs(b),`${a} != ${b}`);
const ok = result => { assert.equal(result.status,'ok',JSON.stringify(result)); return result; };
const IS=1e-12, vt=.025, bf=100, br=4;
// Independent reference: explicit closed-form equations, never the evaluator.
const law = (c,b,e) => {
  const F=IS*Math.expm1((b-e)/vt), R=IS*Math.expm1((b-c)/vt);
  return {c:F-(1+1/br)*R,b:F/bf+R/br,e:R-(1+1/bf)*F};
};
function pointAndTangent(document) {
  const point=ok(solveBjtOperatingPoint(document));
  return {point,tangent:ok(createBjtTangent(point,document))};
}

for(const [name,F,R] of [['forward-active',.001,-IS/2],['reverse-active',-IS/2,.001],
  ['cutoff',-IS/2,-IS/2],['saturation',.001,.0001],['zero-bias',0,0]]) {
  test(`independent ${name} law and clamped DC`,()=>{
    const d=load(name),q=d.circuit.components[0];
    const volts={c:d.experiment.sources[0].dc,b:d.experiment.sources[1].dc,e:0};
    const ref={c:F-(1+1/br)*R,b:F/bf+R/br,e:R-(1+1/bf)*F};
    const evaluated=evaluateBjt(q,volts);
    assert.ok(evaluated);
    for(const t of ['c','b','e']) near(evaluated.currentsA[t],ref[t],1e-27,5e-13);
    near(evaluated.currentsA.c+evaluated.currentsA.b+evaluated.currentsA.e,0,1e-18);
    near(evaluated.absorbedW,evaluated.identityPowerW,1e-25,1e-12);
    const result=ok(solveBjtOperatingPoint(d));
    for(const t of ['c','b','e']) near(result.observations['i'+t].value,ref[t]);
    assert.ok(result.groundKcl.passed && result.residuals.every(r=>r.passed));
    assert.ok(Math.abs(result.powerBalanceW)<=result.powerPhysicalAllowanceW+result.powerArithmeticAllowanceW);
    assert.equal(result.x.length,6); // three nodes + three clamps, no Q unknown.
  });
}
test('explicit saturation and sub-picoampere cutoff targets',()=>{
  for(const [name,expected] of [['saturation',[.875e-3,.035e-3,-.910e-3]],['cutoff',[.125e-12,-.130e-12,.005e-12]]]) {
    const d=load(name),q=d.circuit.components[0];
    const value=evaluateBjt(q,{c:d.experiment.sources[0].dc,b:d.experiment.sources[1].dc,e:0});
    ['c','b','e'].forEach((t,i)=>near(value.currentsA[t],expected[i],1e-27,1e-12));
  }
});
test('reciprocity, both current gains, and exact thermal-voltage convention',()=>{
  const q=load('forward-active').circuit.components[0];
  near(q.model.temperatureK,290.11295303875204,1e-12);
  near(boltzmannJPerK*q.model.temperatureK/elementaryChargeC,vt,1e-17);
  const aF=bf/(1+bf),aR=br/(1+br),IES=IS/aF,ICS=IS/aR;
  near(aF*IES,aR*ICS,1e-28);
  const b=vt*Math.log1p(1e9);
  const f=evaluateBjt(q,{b,c:b,e:0}),r=evaluateBjt(q,{b,c:0,e:b});
  near(f.currentsA.c/f.currentsA.b,bf); near(r.currentsA.e/r.currentsA.b,br);
  q.model.temperatureK*=2;
  const hot=evaluateBjt(q,{b,c:b,e:0});
  near(hot.forwardTransportA,IS*Math.expm1(b/(2*vt)),1e-20);
});
test('all nine analytic derivatives, conservation and common-voltage invariance',()=>{
  const q=load('saturation').circuit.components[0];
  for(const volts of [{c:.06,b:.52,e:0},{c:2,b:.52,e:0},{c:0,b:.52,e:2},{c:0,b:-.02,e:0}]) {
    const value=evaluateBjt(q,volts),names=['c','b','e'];
    for(const h of [1e-5,2e-6,4e-7]) for(let j=0;j<3;j++) {
      const plus=evaluateBjt(q,{...volts,[names[j]]:volts[names[j]]+h});
      const minus=evaluateBjt(q,{...volts,[names[j]]:volts[names[j]]-h});
      for(let i=0;i<3;i++) near((plus.currentsA[names[i]]-minus.currentsA[names[i]])/(2*h),value.jacobianS[i][j],1e-12,5e-7);
    }
    for(let i=0;i<3;i++) {
      near(value.jacobianS[i].reduce((a,b)=>a+b,0),0,1e-16);
      near(value.jacobianS.reduce((sum,row)=>sum+row[i],0),0,1e-16);
    }
    const shifted=evaluateBjt(q,Object.fromEntries(names.map(t=>[t,volts[t]+1000])));
    names.forEach(t=>near(shifted.currentsA[t],value.currentsA[t],1e-20,1e-10));
  }
});
test('PNP mirrors and emitter/collector exchange preserve full laws',()=>{
  const d=load('saturation'),q=d.circuit.components[0],v={c:.06,b:.52,e:0};
  const npn=evaluateBjt(q,v);
  const pnp=evaluateBjt({...q,model:{...q.model,polarity:'pnp'}},{c:-v.c,b:-v.b,e:0});
  for(const t of ['c','b','e']) near(pnp.currentsA[t],-npn.currentsA[t],1e-18);
  assert.deepEqual(pnp.jacobianS,npn.jacobianS); near(pnp.absorbedW,npn.absorbedW);
  const swapped=evaluateBjt({...q,model:{...q.model,betaForward:br,betaReverse:bf}},{c:v.e,b:v.b,e:v.c});
  near(swapped.currentsA.c,npn.currentsA.e); near(swapped.currentsA.e,npn.currentsA.c); near(swapped.currentsA.b,npn.currentsA.b);
  const mirror=load('common-emitter');
  mirror.circuit.components.find(d=>d.type==='Q').model.polarity='pnp';
  mirror.experiment.sources.forEach(s=>{s.dc=-s.dc;if(s.ac)s.ac.re=-s.ac.re;});
  const a=pointAndTangent(load('common-emitter')),b=pointAndTangent(mirror);
  for(const key of Object.keys(a.point.unknowns)) near(b.point.unknowns[key],-a.point.unknowns[key],2e-10);
  near(bjtTransfer(b.tangent,'Vs','out',complex(0)).transfer.value.re,bjtTransfer(a.tangent,'Vs','out',complex(0)).transfer.value.re,1e-8);
});
test('common-node additive stamps and exact punctuation/prototype IDs',()=>{
  const d=load('zero-bias');
  d.circuit.components[0].c='b';d.circuit.components[0].e='b';
  const system=assembleBjtSystem(d),x=system.core.unknowns.map(()=>0);
  x[system.core.linear.nodeIndex.get('b')]=.5;
  const evaluated=evaluateBjtSystem(system,x);
  near(evaluated.residual[system.core.linear.nodeIndex.get('b')],0,1e-25);
  const same=ok(solveBjtOperatingPoint(d)); near(same.bjts.Q1.absorbedW,0,0);
  const exact=load('common-emitter'),id='<b>Q</b>:,"\n__proto__';
  exact.circuit.components.find(c=>c.type==='Q').id=id;
  exact.circuit.observations.filter(o=>o.type==='terminal-current').forEach(o=>{o.component=id;});
  exact.circuit.nodes=exact.circuit.nodes.map(n=>n==='b'?'__proto__':n);
  for(const c of exact.circuit.components) for(const t of ['p','n','c','b','e']) if(c[t]==='b')c[t]='__proto__';
  exact.circuit.observations[0].id='__proto__';
  assert.deepEqual(parseBjtDocument(serializeBjtDocument(exact)),exact);
  const result=pointAndTangent(exact); assert.ok(result.point.bjts[id]);
  assert.ok(ok(bjtTransfer(result.tangent,'Vs','__proto__',complex(0))).transfer.value.re<0);
});

// Independent two-node CE tangent equations, with physical source/load conductances.
function ceReference(document,omega=0) {
  const q=document.circuit.components.find(d=>d.type==='Q');
  const b=vt*Math.log1p(1e9),c=2;
  const gf=IS*Math.exp(b/vt)/vt,gr=IS*Math.exp((b-c)/vt)/vt;
  const rs=document.circuit.components.find(d=>d.id==='Rs').value;
  const rc=document.circuit.components.find(d=>d.id==='Rc').value;
  const rl=document.circuit.components.find(d=>d.id==='Rl').value;
  const cap=document.circuit.components.find(d=>d.id==='Co')?.value??0;
  const Gs=1/rs, Gc=1/rc+1/rl, Jbb=gf/q.model.betaForward+gr/q.model.betaReverse;
  const Jbc=-gr/q.model.betaReverse,Jcb=gf-(1+1/q.model.betaReverse)*gr,Jcc=(1+1/q.model.betaReverse)*gr;
  const real=(Gs+Jbb)*(Gc+Jcc)-Jbc*Jcb,imag=(Gs+Jbb)*omega*cap;
  const numerator=-Gs*Jcb,den=real*real+imag*imag;
  return {re:numerator*real/den,im:-numerator*imag/den};
}
function constructCeBias(d) {
  const b=vt*Math.log1p(1e9),c=2, i=law(c,b,0);
  const value=id=>d.circuit.components.find(c=>c.id===id).value;
  d.experiment.sources.find(s=>s.id==='Vs').dc=b+value('Rs')*i.b;
  d.experiment.sources.find(s=>s.id==='Vcc').dc=c+value('Rc')*(i.c+c/value('Rl'));
}
test('CE gain, independent loaded equations and collector-capacitor/current outputs',()=>{
  for(const [rs,rl,cap] of [[1000,10000,0],[3000,4000,0],[1000,10000,1e-6]]) {
    const d=load('common-emitter');
    d.circuit.components.find(c=>c.id==='Rs').value=rs;d.circuit.components.find(c=>c.id==='Rl').value=rl;
    if(cap){d.circuit.components.push({id:'Co',type:'C',p:'c',n:'0',value:cap});d.circuit.observations.push({id:'icap',type:'current',component:'Co'});}
    constructCeBias(d);
    const {point,tangent}=pointAndTangent(d);
    near(point.unknowns['V(c)'],2,1e-8);near(point.unknowns['V(b)'],.5180816459486602,1e-9);
    if(rs===1000&&rl===10000&&!cap) near(ok(bjtTransfer(tangent,'Vs','out',complex(0))).transfer.value.re,-47.6190476531,1e-7);
    for(const omega of [0,2*Math.PI*1000]) {
      const result=ok(bjtTransfer(tangent,'Vs','out',complex(0,omega))),ref=ceReference(d,omega);
      near(result.transfer.value.re,ref.re,1e-8);near(result.transfer.value.im,ref.im,1e-8);
      if(cap) {const ic=result.observations.icap.value;near(ic.re,-omega*cap*ref.im,1e-10);near(ic.im,omega*cap*ref.re,1e-10);}
      const vb=result.unknowns['V(b)'].value,vc=result.unknowns['V(c)'].value;
      const gf=IS*Math.exp(.5180816459486602/vt)/vt,gr=IS*Math.exp((.5180816459486602-2)/vt)/vt;
      near(result.observations.ic.value.re,(gf-(1+1/br)*gr)*vb.re+(1+1/br)*gr*vc.re,1e-10);
      near(result.observations.ib.value.re,(gf/bf+gr/br)*vb.re-gr/br*vc.re,1e-10);
      near(result.observations.ie.value.re,-result.observations.ic.value.re-result.observations.ib.value.re,1e-12);
      const ac=ok(solveBjtFrequency(tangent,complex(0,omega)));near(ac.observations.out.value.re,.001*ref.re,1e-10);
    }
  }
});
test('emitter follower gain and finite source loading',()=>{
  const d=load('emitter-follower');
  const {point,tangent}=pointAndTangent(d);
  near(point.unknowns['V(e)'],1,1e-9);
  near(ok(bjtTransfer(tangent,'Vb','out',complex(0))).transfer.value.re,.9756097560978,1e-8);
  const rs=1000;
  d.circuit.nodes.push('drive');d.circuit.components.find(c=>c.id==='Vb').p='drive';
  d.circuit.components.push({id:'Rs',type:'R',p:'drive',n:'b',value:rs});
  const b=1+vt*Math.log1p(1e9), i=law(5,b,1);
  d.experiment.sources.find(s=>s.id==='Vb').dc=b+rs*i.b;
  const loaded=pointAndTangent(d);
  const gf=IS*Math.exp((b-1)/vt)/vt,gr=IS*Math.exp((b-5)/vt)/vt,Ge=1/d.circuit.components.find(c=>c.id==='Re').value;
  const a=1/rs+gf/bf+gr/br, bb=-gf/bf, cc=gr-(1+1/bf)*gf,dd=Ge+(1+1/bf)*gf;
  near(ok(bjtTransfer(loaded.tangent,'Vb','out',complex(0))).transfer.value.re,(-cc/rs)/(a*dd-bb*cc),1e-8);
});
test('independent scalar root and neighboring-bias DC sensitivity',()=>{
  const d=load('emitter-follower');
  const R=d.circuit.components.find(c=>c.id==='Re').value,b=d.experiment.sources[0].dc,c=5;
  let low=0,high=b;
  for(let k=0;k<100;k++){const m=(low+high)/2;if(m/R+law(c,b,m).e>0)high=m;else low=m;}
  const {point,tangent}=pointAndTangent(d);near(point.unknowns['V(e)'],(low+high)/2,1e-9);
  const gain=ok(bjtTransfer(tangent,'Vb','out',complex(0))).transfer.value.re;
  for(const h of [1e-4,2e-5]) {
    const plus=clone(d),minus=clone(d);plus.experiment.sources[0].dc+=h;minus.experiment.sources[0].dc-=h;
    near((ok(solveBjtOperatingPoint(plus)).unknowns['V(e)']-ok(solveBjtOperatingPoint(minus)).unknowns['V(e)'])/(2*h),gain,1e-7);
  }
});

test('mixed diode/BJT bias and tangent retain diode auxiliary current and series law',()=>{
  const d=load('common-emitter');
  d.circuit.nodes.push('d');
  d.circuit.components.push({id:'Vd',type:'V',p:'d',n:'0'},
    {id:'D',type:'D',p:'d',n:'0',model:{kind:'shockley-series',saturationCurrentA:IS,idealityFactor:1,seriesResistanceOhm:10,temperatureK:vt*elementaryChargeC/boltzmannJPerK}});
  d.experiment.sources.push({id:'Vd',dc:.4,ac:{re:.002,im:0}});
  d.circuit.observations.push({id:'diode',type:'current',component:'D'});
  const {point,tangent}=pointAndTangent(d);
  let lo=0,hi=.4;for(let k=0;k<100;k++){const v=(lo+hi)/2;if(v+10*IS*Math.expm1(v/vt)>.4)hi=v;else lo=v;}
  const vj=(lo+hi)/2,gj=IS*Math.exp(vj/vt)/vt;
  near(point.diodes.D.currentA,IS*Math.expm1(vj/vt),1e-12);
  assert.equal(point.x.length,assembleBjtSystem(d).core.linear.unknowns.length+1);
  near(ok(solveBjtFrequency(tangent,complex(0,500))).observations.diode.value.re,.002*gj/(1+10*gj),1e-12);
});
test('all linear branch-current output kinds retain C0, sC1, and D0 semantics',()=>{
  const components=[{id:'Vx',type:'V',p:'x',n:'0'},{id:'Sense',type:'V',p:'x',n:'z'},
    {id:'Rz',type:'R',p:'z',n:'0',value:1000},{id:'C',type:'C',p:'x',n:'0',value:1e-6},
    {id:'Rseries',type:'R',p:'x',n:'l',value:100},{id:'L',type:'L',p:'l',n:'0',value:.1},
    {id:'E',type:'VCVS',p:'e',n:'0',cp:'x',cn:'0',gain:2},{id:'Re',type:'R',p:'e',n:'0',value:1000},
    {id:'G',type:'VCCS',p:'g',n:'0',cp:'x',cn:'0',gain:.001},{id:'Rg',type:'R',p:'g',n:'0',value:1000},
    {id:'H',type:'CCVS',p:'h',n:'0',control:'Sense',gain:100},{id:'Rh',type:'R',p:'h',n:'0',value:1000},
    {id:'F',type:'CCCS',p:'f',n:'0',control:'Sense',gain:3},{id:'Rf',type:'R',p:'f',n:'0',value:1000},
    {id:'I',type:'I',p:'x',n:'0'}];
  const d={circuit:{schemaVersion:3,nodes:['0','x','z','l','e','g','h','f'],components,
    observations:components.map(c=>({id:c.id,type:'current',component:c.id}))},experiment:{schemaVersion:1,
    sources:[{id:'Vx',dc:1,ac:{re:.002,im:0}},{id:'Sense',dc:0},{id:'I',dc:0,ac:{re:.0003,im:0}}],initial:{kind:'equilibrium'}}};
  const {tangent}=pointAndTangent(d),w=1000,out=ok(solveBjtFrequency(tangent,complex(0,w))).observations;
  // The clamped drive isolates analytical branches. RL current=.002/(100+j100).
  const expected={Sense:[2e-6,0],Rz:[2e-6,0],C:[0,2e-6],L:[1e-5,-1e-5],Rseries:[1e-5,-1e-5],
    E:[-4e-6,0],Re:[4e-6,0],G:[2e-6,0],Rg:[-2e-6,0],H:[-2e-7,0],Rh:[2e-7,0],F:[6e-6,0],Rf:[-6e-6,0],I:[.0003,0],Vx:[-.000312,8e-6]};
  for(const [id,[re,im]] of Object.entries(expected)){near(out[id].value.re,re,1e-15);near(out[id].value.im,im,1e-15);}
  const capacitor=tangent.outputs.find(o=>o.id==='C');assert.ok(capacitor.C1.some(v=>v!==0));assert.ok(capacitor.C0.every(v=>v===0));
});
test('bias ownership rejects topology/model/DC changes, allows only AC changes without rebias',()=>{
  const d=load('common-emitter'),point=ok(solveBjtOperatingPoint(d));
  for(const change of [x=>x.experiment.sources[0].dc+=.01,x=>x.circuit.components[0].model.betaForward=80,
    x=>x.circuit.components[0].c='0',x=>x.circuit.components.push({id:'Rx',type:'R',p:'c',n:'0',value:1000})]) {
    const edited=clone(d);change(edited);assert.equal(createBjtTangent(point,edited).code,'stale-bias');
  }
  const ac=clone(d);ac.experiment.sources[0].ac.re=.004;
  const tangent=ok(createBjtTangent(point,ac));
  near(ok(solveBjtFrequency(tangent,complex(0))).observations.out.value.re,-47.6190476531*.004,1e-9);
  ac.experiment.sources[0].ac.re=9;near(tangent.document.experiment.sources[0].ac.re,.004);
  tangent.document.experiment.sources[0].dc+=.1;
  assert.equal(solveBjtFrequency(tangent,complex(0)).code,'stale-bias');
  const tampered=clone(point);tampered.x[0]+=1;assert.equal(createBjtTangent(tampered,d).status,'unavailable');
  d.circuit.components[0].model.betaForward=1;assert.equal(point.document.circuit.components[0].model.betaForward,100);
});
test('strict v3 validation rejects malformed data and ambiguous references',()=>{
  const original=load('common-emitter');
  const edits=[d=>d.circuit.schemaVersion=2,d=>d.experiment.schemaVersion=3,d=>d.extra=1,
    d=>d.circuit.components[0].p='c',d=>d.circuit.components[0].c='missing',d=>d.circuit.components[0].id='',
    d=>d.circuit.components[0].model.earlyVoltageV=100,d=>d.circuit.components[0].model.polarity='other',d=>d.circuit.components[0].model.polarity=new String('npn'),
    d=>d.circuit.components[0].model.betaForward=0,d=>d.circuit.components[0].model.betaReverse=Infinity,
    d=>d.circuit.components[0].model.temperatureK=NaN,d=>d.circuit.components[0].model.transportSaturationCurrentA=-1,
    d=>d.circuit.components.push(clone(d.circuit.components[0])),d=>d.circuit.observations.push(clone(d.circuit.observations[0])),
    d=>d.circuit.observations[1].terminal='x',d=>d.circuit.observations[1].component='Rs',
    d=>d.circuit.observations[1]={id:'ic',type:'current',component:'Q1'},
    d=>d.circuit.components.push({id:'F',type:'CCCS',p:'c',n:'0',control:'Q1',gain:1}),
    d=>d.experiment.sources.push({id:'Q1',dc:1})];
  for(const edit of edits){const d=clone(original);edit(d);assert.throws(()=>validateBjtDocument(d));}
  assert.throws(()=>parseBjtDocument('{bad'));
  assert.throws(()=>parseDocument(serializeBjtDocument(original)));
  assert.throws(()=>parseNonlinearDocument(serializeBjtDocument(original)));
  assert.throws(()=>nonlinearTransient(original,{stop:.01,step:.001}));
});
test('finite range, harmless derivative underflow, and high-gain base-current accuracy',()=>{
  const q=load('zero-bias').circuit.components[0];
  const tiny=evaluateBjt(q,{c:0,b:-100,e:0});
  assert.ok(tiny);assert.deepEqual(tiny.derivativeUnderflow,{forward:true,reverse:true});
  assert.notEqual(tiny.currentsA.b,0);near(tiny.currentsA.b,-IS/bf-IS/br,1e-27);
  assert.equal(evaluateBjt(q,{c:0,b:1e308,e:0}),null);
  const high=clone(q);high.model.betaForward=1e18;
  const b=vt*Math.log1p(1e9),value=evaluateBjt(high,{c:b,b,e:0});near(value.currentsA.b,1e-21,1e-34);
  const ranged=clone(q);ranged.model.transportSaturationCurrentA=1e-300;
  const finite=evaluateBjt(ranged,{b:18,c:18,e:0}); // exp(720) itself overflows, Is*exp(720) does not.
  assert.ok(finite);assert.ok(Number.isFinite(finite.forwardConductanceS));
});
test('contradictory, floating, extreme-range and exhausted Newton outcomes are explicit',()=>{
  const d=load('common-emitter');
  const contradictory=clone(d);contradictory.circuit.components.push({id:'Vbad',type:'V',p:'drive',n:'0'});
  contradictory.experiment.sources.push({id:'Vbad',dc:9});
  assert.equal(solveBjtOperatingPoint(contradictory).status,'failed');
  const floating=clone(d);floating.circuit.nodes.push('floating');
  assert.equal(solveBjtOperatingPoint(floating).status,'failed');
  const extreme=clone(d);extreme.circuit.components.find(c=>c.id==='Rs').value=1e-320;
  assert.equal(solveBjtOperatingPoint(extreme).code,'numeric-range');
  assert.equal(solveBjtOperatingPoint(d,{maxIterations:1}).code,'iteration-limit');
  assert.equal(solveBjtOperatingPoint(load('forward-active'),{maxBacktracks:1}).code,'line-search');
  assert.throws(()=>solveBjtOperatingPoint(d,{initialGuess:[0]}));
  assert.throws(()=>solveBjtOperatingPoint(d,{currentScaleA:0}));
});
test('node ordering and shifted reference preserve the solved physical bias',()=>{
  const d=load('common-emitter'),original=ok(solveBjtOperatingPoint(d));
  d.circuit.nodes.reverse();const reordered=ok(solveBjtOperatingPoint(d));assert.deepEqual(reordered.unknowns,original.unknowns);
  // Shift the physical return, leaving the true reference node 0 for a clamp.
  const shifted=load('common-emitter');shifted.circuit.nodes.push('return');
  for(const c of shifted.circuit.components) for(const t of ['p','n','c','b','e'])if(c[t]==='0')c[t]='return';
  for(const o of shifted.circuit.observations)if(o.type==='voltage'&&o.n==='0')o.n='return';
  shifted.circuit.components.push({id:'Vreturn',type:'V',p:'return',n:'0'});shifted.experiment.sources.push({id:'Vreturn',dc:12});
  const result=ok(solveBjtOperatingPoint(shifted));near(result.observations.out.value,2,2e-8);
  for(const t of ['c','b','e'])near(result.bjts.Q1.currentsA[t],original.bjts.Q1.currentsA[t],1e-10);
});
test('production browser importer still rejects v3 and preserves the released document',async()=>{
  const {createLab,importNative}=await import('../dist/lab-test.js');
  const lab=createLab(),before=clone(lab.document);
  const result=importNative(lab,serializeBjtDocument(load('common-emitter')));
  assert.equal(result.ok,false);assert.deepEqual(lab.document,before);
});

test('full tangent terminal derivatives remain active in saturation and reverse operation',()=>{
  for(const name of ['saturation','reverse-active','cutoff']) {
    const d=load(name);
    const increments={c:.001,b:.002,e:-.001};
    d.experiment.sources.forEach(s=>{s.ac={re:increments[s.id.slice(1)],im:0};});
    const {tangent}=pointAndTangent(d),result=ok(solveBjtFrequency(tangent,complex(0,1000)));
    const b=d.experiment.sources.find(s=>s.id==='Vb').dc,c=d.experiment.sources.find(s=>s.id==='Vc').dc;
    const dF=IS*Math.exp(b/vt)/vt*(increments.b-increments.e);
    const dR=IS*Math.exp((b-c)/vt)/vt*(increments.b-increments.c);
    const expected={c:dF-(1+1/br)*dR,b:dF/bf+dR/br,e:dR-(1+1/bf)*dF};
    for(const t of ['c','b','e']) near(result.observations['i'+t].value.re,expected[t],1e-26,1e-8);
  }
});
test('each pair of coincident terminals adds its current to the shared node',()=>{
  for(const [from,to] of [['c','b'],['b','e'],['e','c']]) {
    const d=load('saturation');d.circuit.components[0][from]=to;
    const point=ok(solveBjtOperatingPoint(d));
    const volts=Object.fromEntries(d.experiment.sources.map(s=>[s.id.slice(1),s.dc]));
    const nodes=d.circuit.components[0];
    const expected=law(volts[nodes.c],volts[nodes.b],volts[nodes.e]);
    for(const n of ['c','b','e']) {
      const net=['c','b','e'].filter(t=>nodes[t]===n).reduce((sum,t)=>sum+expected[t],0);
      near(point.unknowns['I(V'+n+')'],-net,1e-12,1e-8);
    }
  }
});
