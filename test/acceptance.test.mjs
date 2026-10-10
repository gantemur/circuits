import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { transform } from 'esbuild';
import { assemble, solveDC, solveFrequency, acSweep, transfer, extractFirstOrder, transient,
  parseDocument, serializeDocument, kronReduce, complex } from '../dist/index.js';

const fixture = async name => parseDocument(await readFile(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'));
const ok = result => { assert.equal(result.status, 'ok', `${result.message ?? ''} at ${result.time ?? ''}`); return result; };
function near(actual, expected, unit = 'V', relative = 1e-8) {
  const absolute = unit === 'V' ? 1e-9 : 1e-12;
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= absolute + relative * Math.abs(expected), `${actual} != ${expected} ${unit}`);
}
const inverse = (re, im) => ({ re: re / (re * re + im * im), im: -im / (re * re + im * im) });
function cnear(actual, expected, unit = 'V') { near(actual.re, expected.re, unit); near(actual.im, expected.im, unit); }
function healthy(result) {
  ok(result);
  for (const r of [...result.residuals, result.groundKcl]) { assert.ok(r.passed, r.label); assert.ok(r.absolute <= r.tolerance); assert.ok(['A', 'V'].includes(r.unit)); }
  assert.ok(result.diagnostics.scaledBackwardResidual < 1e-12);
  return result;
}
const value = (s, id) => s.observations[id].value.re;

test('A: divider, signed source current, power balance, and injected current', async () => {
  const d = await fixture('divider'), s = healthy(solveDC(assemble(d.circuit), d.experiment));
  near(value(s, 'out'), 12 * 2000 / 3000);
  near(value(s, 'source'), -12 / 3000, 'A');
  near(value(s, 'r1i'), 12 / 3000, 'A');
  near(12 * value(s, 'source') + (12 - 8) ** 2 / 1000 + 8 ** 2 / 2000, 0);
  const i = await fixture('current-parallel'), si = healthy(solveDC(assemble(i.circuit), i.experiment));
  near(value(si, 'out'), .003 / (1 / 1000 + 1 / 2000)); near(value(si, 'source'), .003, 'A');
});

test('A: reversing passive and source orientations preserves physical results and power', async () => {
  const d = await fixture('divider'), before = healthy(solveDC(assemble(d.circuit), d.experiment));
  const resistor = d.circuit.components.find(c => c.id === 'R1');
  [resistor.p, resistor.n] = [resistor.n, resistor.p];
  const probe = d.circuit.observations.find(o => o.id === 'r1v'); [probe.p, probe.n] = [probe.n, probe.p];
  const after = healthy(solveDC(assemble(d.circuit), d.experiment));
  near(value(after, 'out'), value(before, 'out'));
  near(value(after, 'r1i'), -value(before, 'r1i'), 'A');
  near(value(after, 'r1v'), -value(before, 'r1v'));
  near(value(after, 'r1v') * value(after, 'r1i'), value(before, 'r1v') * value(before, 'r1i'));
  const source = d.circuit.components.find(c => c.id === 'Vin'); [source.p, source.n] = [source.n, source.p]; d.experiment.sources[0].dc *= -1;
  const reversed = healthy(solveDC(assemble(d.circuit), d.experiment)); near(value(reversed, 'out'), 8); near(value(reversed, 'source'), .004, 'A');
  const i = await fixture('current-parallel'); const is = i.circuit.components[0]; [is.p, is.n] = [is.n, is.p]; i.experiment.sources[0].dc *= -1;
  near(value(healthy(solveDC(assemble(i.circuit), i.experiment)), 'out'), 2);
});

test('B: unloaded and loaded RC, complex s, cutoff, and Schur coefficients', async () => {
  for (const [name, constant] of [['rc', 1], ['rc-loaded', 1.5]]) {
    const d = await fixture(name), a = assemble(d.circuit);
    near(value(healthy(solveDC(a, d.experiment)), 'out'), 1 / constant);
    for (const s of [complex(0), complex(0, 10), complex(0, 1000), complex(0, 10000), complex(500, -2300)]) {
      const result = healthy(transfer(a, 'Vin', 'out', s));
      cnear(result.transfer.value, inverse(constant + .001 * s.re, .001 * s.im));
    }
    const reduced = ok(extractFirstOrder(a, 'Vin', 'out'));
    near(reduced.e, 1e-6, 'A'); near(reduced.kr, constant / 1000, 'A'); near(reduced.br, .001, 'A');
    near(reduced.cr, 1); near(reduced.dr, 0); near(reduced.numerator[0], .001, 'A'); near(reduced.numerator[1], 0, 'A');
    near(reduced.denominatorRoot, -1000 * constant);
    assert.equal(reduced.evidence, 'algebraically-derived-numeric-coefficients');
    assert.equal(extractFirstOrder(a, 'Vin', 'capacitor').status, 'not-supported');
  }
  const d = await fixture('rc'), a = assemble(d.circuit), fc = 1 / (2 * Math.PI * .001);
  const cutoff = healthy(acSweep(a, d.experiment, [fc])[0].result);
  near(cutoff.observations.out.magnitude, 1 / Math.sqrt(2)); near(cutoff.observations.out.phaseRadians, -Math.PI / 4);
  cnear(cutoff.observations.capacitor.value, { re: .0005, im: .0005 }, 'A');
  const dc = healthy(solveDC(a, d.experiment)); near(value(dc, 'capacitor'), 0, 'A');
  // Resistor current includes feedthrough: (1-H)/R; tests dr != 0 in the algebraic extractor.
  const ri = ok(extractFirstOrder(a, 'Vin', 'resistor'));
  near(ri.dr, .001, 'A'); near(ri.numerator[0], 0, 'A'); near(ri.numerator[1], 1e-9, 'A');
});

test('B: directly connected RC sections preserve loading', async () => {
  const d = await fixture('rc-cascade'), a = assemble(d.circuit);
  for (const w of [0, 100, 1000, 4000, 10000]) {
    const q = w * .001, result = healthy(transfer(a, 'Vin', 'out', complex(0, w)));
    cnear(result.transfer.value, inverse(1 - q * q, 3 * q));
  }
  const atTau = ok(transfer(a, 'Vin', 'out', complex(0, 1000))).transfer.value;
  assert.ok(Math.abs(atTau.im - (-.5)) > .1, 'Must differ from unloaded (1+j)^-2');
  assert.equal(extractFirstOrder(a, 'Vin', 'out').status, 'not-supported');
});

test('C: all four dependent source laws, source/load currents, control signs', async () => {
  for (const [name, voltage, dependent] of [['vcvs', 6, -.006], ['vccs', -4, .004], ['ccvs', 1, -.001], ['cccs', -6, .006]]) {
    const d = await fixture(name), a = assemble(d.circuit), s = healthy(solveDC(a, d.experiment));
    near(value(s, 'out'), voltage); near(value(s, 'load'), voltage / 1000, 'A'); near(value(s, 'dependent'), dependent, 'A');
    if (name.startsWith('cc')) near(value(s, 'control'), .002, 'A');
    const h = healthy(transfer(a, 'Vin', 'out', complex(0, 1234)));
    assert.equal(h.transfer.unit,'V/V');
    near(h.transfer.value.re, voltage / 2); near(h.transfer.value.im, 0);
    // Reverse the controlling voltage pair or sensor branch: sign must reverse.
    const dep = d.circuit.components.find(c => c.id === 'D');
    if (name.startsWith('vc')) [dep.cp, dep.cn] = [dep.cn, dep.cp];
    else { const sensor = d.circuit.components.find(c => c.id === 'Vsense'); [sensor.p, sensor.n] = [sensor.n, sensor.p]; }
    const reversed = healthy(solveDC(assemble(d.circuit), d.experiment)); near(value(reversed, 'out'), -voltage);
    if (name.startsWith('cc')) near(value(reversed, 'control'), -.002, 'A');
    // Reverse the output terminals too; the physical node voltage returns to its original value.
    [dep.p, dep.n] = [dep.n, dep.p];
    near(value(healthy(solveDC(assemble(d.circuit), d.experiment)), 'out'), voltage);
  }
});

test('C: selecting a transfer input zeros other coordinates but keeps dependent sources', async () => {
  const d = await fixture('vcvs');
  d.circuit.components.push({id:'Iaux',type:'I',p:'0',n:'out'}); d.experiment.sources.push({id:'Iaux',dc:.1,ac:{re:100,im:50}});
  const a = assemble(d.circuit);
  assert.deepEqual(a.inputs.map(i=>i.id), ['Iaux','Vin']);
  near(ok(transfer(a,'Vin','out',complex(0,100))).transfer.value.re, 3);
  near(ok(transfer(a,'Iaux','out',complex(0,100))).transfer.value.re, 0);
});

test('D: RL DC, current transfer, grounded single-inductor reduction', async () => {
  const d = await fixture('rl'), a = assemble(d.circuit), dc = healthy(solveDC(a, d.experiment));
  near(value(dc, 'out'), 0); near(value(dc, 'inductor'), .01, 'A'); near(value(dc, 'source'), -.01, 'A');
  for (const w of [0, 100, 1000, 10000]) cnear(healthy(transfer(a, 'Vin', 'inductor', complex(0, w))).transfer.value, inverse(100, w * .1), 'A');
  const r = ok(extractFirstOrder(a, 'Vin', 'inductor')); near(r.e,.1); near(r.kr,100); near(r.br,1); near(r.denominatorRoot,-1000);
  assert.equal(ok(transfer(a,'Vin','inductor',complex(0,100))).transfer.unit,'A/V');
  const L = d.circuit.components.find(c=>c.id==='L'); [L.p,L.n]=[L.n,L.p];
  near(value(healthy(solveDC(assemble(d.circuit),d.experiment)),'inductor'),-.01,'A');
});

test('D: series RLC response including resonance region', async () => {
  const d = await fixture('rlc'), a = assemble(d.circuit);
  for (const w of [0, 1000, 9000, 10000, 11000, 1e5])
    cnear(healthy(transfer(a, 'Vin', 'out', complex(0, w))).transfer.value, inverse(1 - 1e-8 * w * w, 1e-5 * w));
  assert.equal(extractFirstOrder(a,'Vin','out').status,'not-supported');
});

test('E: RC step satisfies independent BE recurrence, physical residuals, and first-order refinement', async () => {
  const d = await fixture('rc'), a = assemble(d.circuit), errors = [];
  for (const subdivisions of [20, 40, 80]) {
    const h = .001 / subdivisions, result = ok(transient(a, d.experiment, {stop:.005,step:h}));
    const samples = result.samples.filter(s => s.side !== 'left');
    assert.equal(samples.length, 5 * subdivisions + 1);
    for (const sample of samples) {
      healthy(sample); const n = Math.round(sample.time / h);
      near(value(sample,'out'), 1 - (1 + h/.001) ** -n);
      near(value(sample,'in'),1);
      near(value(sample,'capacitor'),value(sample,'resistor'),'A');
    }
    const common = Array.from({length:100},(_,i)=>(i+1)*.00005);
    const maxError = Math.max(...common.map(t=>{
      const sample = samples.find(s=>Math.abs(s.time-t)<1e-14); assert.ok(sample);
      return Math.abs(value(sample,'out') - (1-Math.exp(-t/.001)));
    }));
    errors.push(maxError);
  }
  assert.ok(errors[0] < .01);
  for (let i=1;i<errors.length;i++) assert.ok(errors[i-1]/errors[i]>1.9 && errors[i-1]/errors[i]<2.1, JSON.stringify(errors));
});

test('E: RC discharge, RL decay, and nonzero compatible initial algebraic variables', async () => {
  for (const [name,output,initial,unit] of [['rc-discharge','out',2,'V'],['rl-decay','inductor',.02,'A']]) {
    const d = await fixture(name), a = assemble(d.circuit), errors=[];
    for (const div of [20,40,80]) {
      const h=.001/div, r=ok(transient(a,d.experiment,{stop:.005,step:h}));
      for (const s of r.samples) { healthy(s); near(value(s,output), initial*(1+h/.001)**(-Math.round(s.time/h)),unit); }
      const atTau=r.samples[div]; errors.push(Math.abs(value(atTau,output)-initial*Math.exp(-1)));
      if (name==='rl-decay') near(value(r.samples[0],'out'),-2);
      else near(value(r.samples[0],'capacitor'),-.002,'A');
    }
    assert.ok(errors[0]/errors[1]>1.9 && errors[1]/errors[2]>1.9);
  }
});

test('E: nonzero initial RLC state follows an independent two-state BE recurrence', async () => {
  const d=await fixture('rlc-initial'), a=assemble(d.circuit), h=1e-6;
  const r=ok(transient(a,d.experiment,{step:h,stop:100*h}));
  let v=1,i=0;
  for(const s of r.samples) {
    if(s.time>0) { i=(i-h/.01*v)/(1+h*10/.01+h*h/(.01*1e-6)); v+=h/1e-6*i; }
    healthy(s); near(value(s,'out'),v); near(value(s,'inductor'),i,'A');
  }
});

test('E: delayed event lands exactly, preserves storage and restarts right source constraints', async () => {
  const d=await fixture('rc-delayed-step'), a=assemble(d.circuit), at=d.experiment.sources[0].waveform.at;
  const r=ok(transient(a,d.experiment,{step:.0001,stop:.003}));
  const event=r.samples.filter(s=>s.time===at); assert.deepEqual(event.map(s=>s.side),['left','right']);
  near(value(event[0],'out'),0); near(value(event[1],'out'),0); near(value(event[0],'in'),0); near(value(event[1],'in'),1);
  near(value(event[1],'capacitor'),.001,'A'); near(value(event[1],'source'),-.001,'A');
  let previous=event[1];
  for(const s of r.samples.filter(s=>s.time>at)) {
    const h=s.time-previous.time; near(value(s,'out'),(value(previous,'out')+h/.001)/(1+h/.001)); healthy(s); previous=s;
  }
  // Opposite capacitor orientation changes the signed state/current, not node voltages.
  const C=d.circuit.components.find(c=>c.id==='C'); [C.p,C.n]=[C.n,C.p];
  const reversed=ok(transient(assemble(d.circuit),d.experiment,{step:.0001,stop:.003}));
  reversed.samples.forEach((s,i)=>{near(value(s,'out'),value(r.samples[i],'out')); near(value(s,'capacitor'),-value(r.samples[i],'capacitor'),'A');});
});

test('F: star Kron matrix and independent terminal currents on a spanning set', async () => {
  const net=JSON.parse(await readFile(new URL('../fixtures/kron-star.json',import.meta.url),'utf8'));
  const r=ok(kronReduce(net,['a','b','c'])), expected=[[5/6,-1/3,-1/2],[-1/3,4/3,-1],[-1/2,-1,3/2]];
  r.reduced.forEach((row,i)=>row.forEach((v,j)=>{near(v,expected[i][j],'A');near(v,r.reduced[j][i],'A');}));
  r.reduced.forEach(row=>near(row.reduce((s,v)=>s+v,0),0,'A'));
  for(const voltages of [[1,0,0],[0,1,0],[0,0,1],[3,-2,7]]) {
    const hidden=(voltages[0]+2*voltages[1]+3*voltages[2])/6;
    const fullCurrents=voltages.map((v,i)=>(i+1)*(v-hidden));
    r.reduced.forEach((row,i)=>near(row.reduce((s,v,j)=>s+v*voltages[j],0),fullCurrents[i],'A'));
  }
});

test('G: floating, contradictory, and redundant ideal constraints classified explicitly', async () => {
  for(const [name,status] of [['floating','nonunique'],['parallel-unequal','inconsistent'],['parallel-equal','nonunique']]) {
    const d=await fixture(name), r=solveDC(assemble(d.circuit),d.experiment);
    assert.equal(r.status,status,JSON.stringify(r)); assert.ok(r.rank<r.size); assert.ok(r.message);
  }
  const rc=await fixture('rc'), a=assemble(rc.circuit);
  assert.ok(a.E.some(row=>row.every(v=>v===0))); healthy(solveDC(a,rc.experiment));
});

test('G: ideal capacitor forcing rejects unsupported or contradictory initialization', async () => {
  const d=await fixture('forced-capacitor'), a=assemble(d.circuit);
  let r=transient(a,d.experiment,{step:.0001,stop:.002}); assert.equal(r.status,'unsupported-initialization'); assert.match(r.message,/impuls|initialization/i);
  assert.equal(r.time,.001);assert.equal(r.cause.status,'inconsistent');
  assert.equal(r.samples.at(-1).side,'left');near(value(r.samples.at(-1),'out'),0);
  d.experiment.initial={kind:'storage',values:[{id:'C',value:2}]};
  r=transient(a,d.experiment,{step:.0001,stop:.002}); assert.equal(r.status,'unsupported-initialization'); assert.equal(r.cause.status,'inconsistent');
});

test('G: singular frequency reports failure rather than clipped gain', async () => {
  const d=await fixture('rlc');
  d.circuit.components=d.circuit.components.filter(c=>c.id!=='R');
  d.circuit.components.find(c=>c.id==='L').p='in'; d.circuit.nodes=d.circuit.nodes.filter(n=>n!=='mid');
  const r=transfer(assemble(d.circuit),'Vin','out',complex(0,10000));
  assert.ok(['inconsistent','ill-conditioned'].includes(r.status),JSON.stringify(r));
});

test('H: every device contribution sums, dimensional labels and deterministic ordering survive serialization', async () => {
  for(const name of ['divider','current-parallel','rc','rc-cascade','vcvs','vccs','ccvs','cccs','rl','rlc']) {
    const d=await fixture(name), a=assemble(d.circuit);
    for(const matrix of ['E','K','B']) {
      const sum=a[matrix].map(row=>row.map(()=>0));
      for(const p of a.contributions.filter(c=>c.matrix===matrix)) {
        assert.equal(p.row,a.rows[p.rowIndex].id);
        assert.equal(p.column,(matrix==='B'?a.inputs:a.unknowns)[p.columnIndex].id);
        assert.ok(p.units && p.law); sum[p.rowIndex][p.columnIndex]+=p.value;
      }
      assert.deepEqual(sum,a[matrix]);
    }
    const round=parseDocument(serializeDocument(d)); assert.deepEqual(round,d);
    assert.deepEqual(solveDC(assemble(round.circuit),round.experiment),solveDC(a,d.experiment));
    round.circuit.nodes.reverse();round.circuit.components.reverse();round.circuit.observations.reverse();
    const reordered=assemble(round.circuit);
    for(const field of ['E','K','B','unknowns','rows','inputs','outputs','contributions']) assert.deepEqual(reordered[field],a[field]);
    for(const label of a.rows) assert.equal(label.unit,label.id.startsWith('KCL')?'A':'V');
  }
});

test('H: assembly owns a snapshot and compiler output imports in a DOM-free process', async () => {
  const d=await fixture('divider'), a=assemble(d.circuit); d.circuit.components[1].value=1;
  near(value(ok(solveDC(a,d.experiment)),'out'),8);
  assert.equal(typeof globalThis.document,'undefined'); assert.equal(typeof globalThis.window,'undefined');
  const browser=await import('../dist/browser.js'); near(value(ok(browser.solveDC(browser.assemble(a.circuit),d.experiment)),'out'),8);
  // Execute the actual browser bundle in an isolated JS realm with no Node or DOM APIs.
  const code=await readFile(new URL('../dist/browser.js',import.meta.url),'utf8');
  const iife=await transform(code,{format:'iife',globalName:'Kernel'});
  const isolated=runInNewContext(`${iife.code}\nKernel;`,Object.create(null));
  near(value(ok(isolated.solveDC(isolated.assemble(a.circuit),d.experiment)),'out'),8);
});
