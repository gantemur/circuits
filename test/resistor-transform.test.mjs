import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDocument, resistorCandidates, transformResistors } from '../dist/index.js';

const fixture=name=>JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`,import.meta.url),'utf8'));
const document=(nodes,edges)=>({circuit:{schemaVersion:1,nodes,components:edges.map(([id,p,n,value])=>({id,type:'R',p,n,value})),observations:[]},experiment:{schemaVersion:1,sources:[],initial:{kind:'equilibrium'}}});
const near=(actual,expected,relative=1e-9)=>assert.ok(Math.abs(actual-expected)<=relative*Math.max(1,Math.abs(expected)),`${actual} ≠ ${expected}`);
const matrixNear=(actual,expected)=>actual.forEach((row,i)=>row.forEach((value,j)=>near(value,expected[i][j])));
const success=result=>{assert.equal(result.status,'ok',result.detail);return result;};

test('series and reversed parallel preserve ordered full terminal response',()=>{
  const series=success(transformResistors(fixture('res-series'),['out','0'],{operation:'series',edges:['R1','R2']}));
  near(series.generated[0].resistance,3000);
  matrixNear(series.transformedResponse,[[1/3000,-1/3000],[-1/3000,1/3000]]);
  assert.deepEqual(series.eliminated,['x']);
  const parallel=document(['0','a'],[['R1','a','0',1000],['R2','0','a',2000]]);
  const result=success(transformResistors(parallel,['0','a'],{operation:'parallel',edges:['R1','R2']}));
  near(result.generated[0].resistance,2000/3);
  matrixNear(result.transformedResponse,[[.0015,-.0015],[-.0015,.0015]]);
});

test('three-terminal star, delta inverse, and strict native preview',()=>{
  const star=fixture('res-star');
  const expected=[[5/6,-1/3,-1/2],[-1/3,4/3,-1],[-1/2,-1,3/2]];
  const result=success(transformResistors(star,['a','b','0'],{operation:'star-delta',center:'x'}));
  matrixNear(result.originalResponse,expected);
  matrixNear(result.transformedResponse,expected);
  const side=(a,b)=>result.transformed.edges.find(e=>[e.p,e.n].includes(a)&&[e.p,e.n].includes(b)).resistance;
  near(side('a','b'),3);near(side('a','0'),2);near(side('b','0'),1);
  assert.deepEqual(parseDocument(result.json),result.document);
  const delta=success(transformResistors(result.document,['a','b','0'],{operation:'delta-star',edges:result.generated.map(e=>e.id)}));
  near(delta.generated.find(e=>e.p==='a').resistance,1);
  near(delta.generated.find(e=>e.p==='b').resistance,.5);
  near(delta.generated.find(e=>e.p==='0').resistance,1/3);
  matrixNear(delta.transformedResponse,expected);
});

test('four-terminal star fills every pair, preserving existing parallel connection',()=>{
  const d=document(['0','a','b','c','x'],[['Ra','a','x',1],['Rb','b','x',2],['Rc','c','x',3],['R0','0','x',4],['Rab','a','b',7]]);
  const result=success(transformResistors(d,['a','b','c','0'],{operation:'star-mesh',center:'x'}));
  assert.equal(result.generated.length,6);
  assert.ok(result.transformed.edges.some(e=>e.id==='Rab'));
  assert.equal(result.transformed.edges.length,7);
  assert.deepEqual(result.eliminated,['x']);
});

test('unbalanced bridge has no initial series/parallel move but bulk Kron matches independent KCL',()=>{
  const d=fixture('res-bridge'), retained=['a','0'];
  const candidates=resistorCandidates({nodes:d.circuit.nodes,edges:d.circuit.components.map(c=>({id:c.id,p:c.p,n:c.n,resistance:c.value}))},retained);
  assert.ok(!candidates.some(c=>['series','parallel'].includes(c.selection.operation)));
  // A degree-three internal bridge node does admit star–delta, so the broader
  // assertion that no elementary move exists would be mathematically false.
  assert.ok(candidates.some(c=>c.selection.operation==='star-delta'));
  const result=success(transformResistors(d,retained,{operation:'kron'}));
  const [gax,gx0,gay,gy0,gxy]=[1/1000,1/2000,1/3000,1/4000,1/5000];
  const ax=gax+gx0+gxy,ay=gay+gy0+gxy,det=ax*ay-gxy*gxy;
  const vx=(gax*ay+gay*gxy)/det,vy=(gay*ax+gax*gxy)/det;
  const expected=gax*(1-vx)+gay*(1-vy);
  matrixNear(result.originalResponse,[[expected,-expected],[-expected,expected]]);
  matrixNear(result.transformedResponse,[[expected,-expected],[-expected,expected]]);
  assert.deepEqual(result.eliminated,['x','y']);
});

test('different sequential elimination orders agree with bulk reduction',()=>{
  const d=document(['0','a','b','c','x','y'],[
    ['ax','a','x',2],['bx','b','x',3],['xy','x','y',4],['cy','c','y',5],['0y','0','y',6]]);
  const B=['a','b','c','0'];
  const bulk=success(transformResistors(d,B,{operation:'kron'}));
  for(const order of [['x','y'],['y','x']]){
    const first=success(transformResistors(d,B,{operation:'star-mesh',center:order[0]}));
    const second=success(transformResistors(first.document,B,{operation:'star-mesh',center:order[1]}));
    matrixNear(second.transformedResponse,bulk.transformedResponse);
  }
});

test('all retained, invalid moves, unsupported devices, disconnected islands and immutability',()=>{
  const d=fixture('res-series'),before=JSON.stringify(d);
  success(transformResistors(d,['0','x','out'],{operation:'kron'}));
  assert.equal(transformResistors(d,['0','x','out'],{operation:'series',edges:['R1','R2']}).status,'invalid-selection');
  const branched=document(['0','x','a','b'],[['r1','0','x',1],['r2','x','a',2],['r3','x','b',3]]);
  assert.equal(transformResistors(branched,['0','a','b'],{operation:'series',edges:['r1','r2']}).status,'invalid-selection');
  assert.equal(transformResistors(d,['0','missing'],{operation:'kron'}).status,'invalid-selection');
  assert.equal(transformResistors(d,['0','0'],{operation:'kron'}).status,'invalid-selection');
  assert.equal(transformResistors(fixture('divider'),['0','out'],{operation:'kron'}).status,'unsupported');
  const disconnected=document(['0','a','x','y'],[['r1','0','a',1],['r2','x','y',2]]);
  assert.equal(transformResistors(disconnected,['0','a'],{operation:'kron'}).status,'disconnected');
  assert.equal(JSON.stringify(d),before);
});

test('ID collisions remain safe and extreme values fail without nonfinite export',()=>{
  const d=document(['0','a','star'],[['R_star','0','a',1],['R1','0','star',1],['R2','a','star',1],['R3','0','a',2]]);
  const delta=success(transformResistors(d,['0','a'],{operation:'delta-star',edges:['R1','R2','R3']}));
  assert.ok(new Set(delta.transformed.nodes).size===delta.transformed.nodes.length);
  assert.ok(new Set(delta.transformed.edges.map(e=>e.id)).size===delta.transformed.edges.length);
  const tiny=document(['0','a'],[['r1','a','0',1e-308],['r2','0','a',1e-308]]);
  assert.equal(transformResistors(tiny,['0','a'],{operation:'parallel',edges:['r1','r2']}).status,'numeric-failure');
  const huge=document(['0','x','a'],[['r1','0','x',Number.MAX_VALUE],['r2','x','a',Number.MAX_VALUE]]);
  assert.equal(transformResistors(huge,['0','a'],{operation:'series',edges:['r1','r2']}).status,'numeric-failure');
  const weak=document(['0','a','b','x'],[['strong','0','x',1],['weakA','a','x',1e300],['weakB','b','x',1e300]]);
  assert.equal(transformResistors(weak,['0','a','b'],{operation:'star-mesh',center:'x'}).status,'numeric-failure');
});
