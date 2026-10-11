import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzePorts, complex, abs, polar } from '../dist/index.js';

const fixture = name => JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url)));
const one = (p, q) => [{ p, q }];
const two = (p = 'in', q = 'out') => [{ p, q: '0' }, { p: q, q: '0' }];
const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `${actual} should be within ${tolerance} of ${expected}`);
const near = (actual, expected, tolerance = 1e-9) => {
  close(actual.re, expected.re, tolerance); close(actual.im, expected.im, tolerance);
};
const good = result => { assert.equal(result.status, 'ok', result.message); return result; };
const mul = (a, b) => complex(a.re*b.re-a.im*b.im,a.re*b.im+a.im*b.re);
const add = (a,b) => complex(a.re+b.re,a.im+b.im);
const sub = (a,b) => complex(a.re-b.re,a.im-b.im);
const div = (a,b) => mul(a,complex(b.re/(b.re*b.re+b.im*b.im),-b.im/(b.re*b.re+b.im*b.im)));

test('series RC one-port has independent Z/Y, correct magnitude/phase, and DC Y only', () => {
  const R=1000,C=1e-6,f=1000,w=2*Math.PI*f;
  const document={circuit:{schemaVersion:1,nodes:['0','in','x'],components:[
    {id:'R',type:'R',p:'in',n:'x',value:R},{id:'C',type:'C',p:'x',n:'0',value:C}],
    observations:[]},experiment:{schemaVersion:1,sources:[],initial:{kind:'equilibrium'}}};
  const before=JSON.stringify(document);
  const result=good(analyzePorts(document,{ports:one('in','0'),frequencyHz:f,testCurrent:2,testVoltage:3}));
  const z=good(result.z).values[0][0], y=good(result.y).values[0][0];
  near(z,complex(R,-1/(w*C)));
  const expectedY=div(complex(0,w*C),complex(1,w*R*C));
  near(y,expectedY,1e-12);
  close(abs(z),Math.hypot(R,1/(w*C)));
  close(polar(z).phaseRadians,Math.atan2(-1/(w*C),R));
  assert.equal(JSON.stringify(document),before);
  const dc=good(analyzePorts(document,{ports:one('in','0'),frequencyHz:0}));
  assert.notEqual(dc.z.status,'ok');
  near(good(dc.y).values[0][0],complex(0));
});

test('resistor T matrices and finite/open loading agree with independent mesh equations', () => {
  const document=fixture('port-t');
  const expectedZ=[[4000,3000],[3000,5000]];
  const determinant=4000*5000-3000*3000;
  const expectedY=[[5000,-3000],[-3000,4000]].map(row=>row.map(value=>value/determinant));
  for(const [Rs,load] of [[0,{kind:'open'}],[500,{kind:'resistor',resistance:2000}],[1200,{kind:'resistor',resistance:4700}]]){
    const result=good(analyzePorts(document,{ports:two(),frequencyHz:1000,loading:{sourceResistance:Rs,load}}));
    const z=good(result.z).values, y=good(result.y).values;
    for(let i=0;i<2;i++)for(let j=0;j<2;j++){
      near(z[i][j],complex(expectedZ[i][j])); near(y[i][j],complex(expectedY[i][j]),1e-12);
    }
    const RL=load.kind==='open'?null:load.resistance;
    const denominator=RL===null?4000+Rs:(4000+Rs)*(5000+RL)-3000*3000;
    const I1=RL===null?1/denominator:(5000+RL)/denominator;
    const I2=RL===null?0:-3000/denominator;
    const V1=1-Rs*I1, V2=3000*I1+5000*I2;
    for(const point of [good(result.loading.direct).point,good(result.loading.fromZ).point,good(result.loading.fromY).point]){
      near(point.v1,complex(V1)); near(point.v2,complex(V2));
      near(point.i1,complex(I1)); near(point.i2,complex(I2));
      near(point.sourceToOutputGain,complex(V2));
    }
    assert.ok(result.loading.fromZ.comparison.passed && result.loading.fromY.comparison.passed);
  }
});

test('RC section exposes Y at DC and analytical complex matrices above DC', () => {
  const d=fixture('port-rc-section'),R=1000,C=1e-6,w=2*Math.PI*1000,g=1/R;
  const r=good(analyzePorts(d,{ports:two(),frequencyHz:1000,loading:{sourceResistance:0,load:{kind:'open'}}}));
  const y=good(r.y).values,z=good(r.z).values;
  for(const [i,j,expected] of [[0,0,complex(g)],[0,1,complex(-g)],[1,0,complex(-g)],[1,1,complex(g,w*C)]]) near(y[i][j],expected,1e-12);
  for(const [i,j,expected] of [[0,0,complex(R,-1/(w*C))],[0,1,complex(0,-1/(w*C))],
    [1,0,complex(0,-1/(w*C))],[1,1,complex(0,-1/(w*C))]]) near(z[i][j],expected);
  const dc=good(analyzePorts(d,{ports:two(),frequencyHz:0}));
  assert.notEqual(dc.z.status,'ok');
  const ydc=good(dc.y).values;
  near(ydc[0][0],complex(g));near(ydc[0][1],complex(-g));
  near(ydc[1][0],complex(-g));near(ydc[1][1],complex(g));
});

test('distinct differential port does not require a grounded negative terminal', () => {
  const document = fixture('port-t');
  const ports = [{ p: 'in', q: 'junction' }, { p: 'out', q: '0' }];
  const result = good(analyzePorts(document, { ports, frequencyHz: 1000 }));
  // Port 1 spans Ra directly. With that external port open, port 2 sees
  // Rb+Rc; the two chosen coordinates therefore decouple.
  const expectedZ = [[1000, 0], [0, 5000]];
  const expectedY = [[1/1000, 0], [0, 1/5000]];
  for (let row = 0; row < 2; row++) for (let column = 0; column < 2; column++) {
    near(good(result.z).values[row][column], complex(expectedZ[row][column]));
    near(good(result.y).values[row][column], complex(expectedY[row][column]), 1e-12);
  }
});

test('directly connected RC sections retain loading in open and finite-load cases', () => {
  const d=fixture('port-rc-cascade'),R=1000,C=1e-6,w=1000,alpha=complex(0,w*R*C);
  for(const [Rs,RL] of [[0,null],[500,2000],[1200,4700]]){
    const result=good(analyzePorts(d,{ports:two(),frequencyHz:w/(2*Math.PI),loading:{sourceResistance:Rs,
      load:RL===null?{kind:'open'}:{kind:'resistor',resistance:RL}}}));
    const A=add(complex(1+(RL===null?0:R/RL)),alpha);
    const B=sub(mul(add(complex(2),alpha),A),complex(1));
    const sigma=Rs/R;
    const denominator=sub(mul(complex(1+sigma),B),mul(complex(sigma),A));
    const expected=div(complex(1),denominator);
    near(good(result.loading.direct).point.sourceToOutputGain,expected,1e-10);
    near(good(result.loading.fromZ).point.sourceToOutputGain,expected,1e-10);
    near(good(result.loading.fromY).point.sourceToOutputGain,expected,1e-10);
    assert.ok(result.loading.fromZ.comparison.passed && result.loading.fromY.comparison.passed);
    if(Rs===0&&RL===null){
      const isolated=div(complex(1),mul(add(complex(1),alpha),add(complex(1),alpha)));
      assert.ok(abs(sub(expected,isolated))>0.05);
    }
  }
});

test('VCCS is retained, nonreciprocal, and signs follow port reversal and swapping', () => {
  const d={circuit:{schemaVersion:1,nodes:['0','a','b'],components:[
    {id:'Ra',type:'R',p:'a',n:'0',value:1000},{id:'Rb',type:'R',p:'b',n:'0',value:2000},
    {id:'G',type:'VCCS',p:'b',n:'0',cp:'a',cn:'0',gain:.001}],observations:[]},
    experiment:{schemaVersion:1,sources:[],initial:{kind:'equilibrium'}}};
  const config={ports:[{p:'a',q:'0'},{p:'b',q:'0'}],frequencyHz:123};
  const r=good(analyzePorts(d,config));
  near(good(r.y).values[0][1],complex(0));near(r.y.values[1][0],complex(.001),1e-12);
  near(good(r.z).values[0][1],complex(0));near(r.z.values[1][0],complex(-2000));
  assert.deepEqual(r.retainedControlled,['G']);
  const flipped=good(analyzePorts(d,{...config,ports:[config.ports[0],{p:'0',q:'b'}]}));
  for(const name of ['z','y'])for(let i=0;i<2;i++)for(let j=0;j<2;j++){
    const signs=[1,-1];near(flipped[name].values[i][j],complex(signs[i]*signs[j]*r[name].values[i][j].re));
  }
  const swapped=good(analyzePorts(d,{...config,ports:[config.ports[1],config.ports[0]]}));
  for(const name of ['z','y'])for(let i=0;i<2;i++)for(let j=0;j<2;j++)near(swapped[name].values[i][j],r[name].values[1-i][1-j]);
});

test('explicit drive exclusion, source suppression, control protection, and exact IDs', () => {
  const d=fixture('rc');
  const base=good(analyzePorts(d,{ports:two(),frequencyHz:1000,externalDrive:'Vin'}));
  assert.deepEqual(base.suppressedSources,[]);
  near(good(base.y).values[0][0],complex(.001));
  const reversed=structuredClone(d);
  const drive=reversed.circuit.components.find(c=>c.id==='Vin');[drive.p,drive.n]=[drive.n,drive.p];
  assert.equal(good(analyzePorts(reversed,{ports:two(),frequencyHz:1000,externalDrive:'Vin'})).y.status,'ok');
  const retained=good(analyzePorts(d,{ports:two(),frequencyHz:1000}));
  near(good(retained.z).values[0][0],complex(0));
  assert.notEqual(base.z.values[0][0].re,retained.z.values[0][0].re);
  const controlled=structuredClone(d);controlled.circuit.components.push({id:'sense',type:'CCCS',p:'out',n:'0',control:'Vin',gain:1});
  assert.equal(analyzePorts(controlled,{ports:two(),frequencyHz:1000,externalDrive:'Vin'}).status,'unsupported-exclusion');
  const source=fixture('port-t');
  source.circuit.components.push({id:'I',type:'I',p:'0',n:'out'});
  source.experiment.sources.push({id:'I',dc:2,ac:complex(5,4)});
  const suppressed=good(analyzePorts(source,{ports:two(),frequencyHz:1000}));
  assert.deepEqual(suppressed.suppressedSources,['I']);
  near(good(suppressed.z).values[0][0],complex(4000));
  const ids=fixture('port-t');
  ids.circuit.nodes[1]='a,b: c';
  ids.circuit.components[0].p='a,b: c';
  ids.circuit.components.push({id:'__z_test',type:'R',p:'a,b: c',n:'0',value:1e9});
  ids.circuit.observations.push({id:'__port_voltage',type:'voltage',p:'a,b: c',n:'0'});
  assert.equal(good(analyzePorts(ids,{ports:[{p:'a,b: c',q:'0'},{p:'out',q:'0'}],frequencyHz:1000})).y.status,'ok');
});

test('invalid, dependent, singular, and finite-range outcomes never fabricate matrices', () => {
  const d=fixture('port-t');
  assert.equal(analyzePorts(d,{ports:two('missing','out'),frequencyHz:1}).status,'invalid-selection');
  assert.equal(analyzePorts(d,{ports:[{p:'in',q:'0'},{p:'0',q:'in'}],frequencyHz:1}).status,'invalid-selection');
  assert.equal(analyzePorts(d,{ports:two(),frequencyHz:Infinity}).status,'invalid-selection');
  assert.equal(analyzePorts(d,{ports:two(),frequencyHz:1e308}).status,'numerical-failure');
  assert.equal(analyzePorts(d,{ports:two(),frequencyHz:1,testCurrent:0}).status,'invalid-selection');
  assert.equal(analyzePorts(d,{ports:two(),frequencyHz:1,loading:{sourceResistance:-1,load:{kind:'open'}}}).status,'invalid-selection');
  const floating=fixture('floating');
  const result=good(analyzePorts(floating,{ports:one('a','b'),frequencyHz:1}));
  assert.notEqual(result.z.status,'ok');assert.notEqual(result.y.status,'ok');
});
