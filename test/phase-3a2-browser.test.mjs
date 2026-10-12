import test from 'node:test';
import assert from 'node:assert/strict';
import { createLab, exportNative, importNative, updateDocument } from '../dist/lab-test.js';
import { addComponent, applyBuilder, createBuilder, documentFromDraft, touchBuilder } from '../dist/builder-test.js';
import { createPanel, createWorkspace, PanelCalculator, reconcilePanels, handlePanelFieldChange } from '../dist/workspace-test.js';
import { diodeCharacteristic, eligibleLoadLine } from '../dist/diode-math-test.js';
import { runDcSweep, dcSweepCsv } from '../dist/dc-sweep-test.js';
import { SweepLifecycle } from '../dist/sweep-lifecycle-test.js';
import { schematic, diodeTangentSchematic } from '../dist/schematic-test.js';
import { selectedDiodeMetric, selectedDiodeMetricHtml, diodeContributions, diodeResidualTerms,
  diodeJacobianCoordinates, tangentProvenance, tangentProvenanceHtml,
  setLanguage as setPresentationLanguage } from '../dist/diode-presentation-test.js';
import { assembleDiodeSystem, evaluateDiodeSystem } from '../dist/index.js';
import { guideFor } from '../dist/study-guide-test.js';
import { presets } from '../dist/presets-test.js';
import { diodeFailureReason, setLanguage } from '../dist/diagnostics-test.js';
import { plot } from '../dist/plot-test.js';

const close = (actual, expected, tolerance = 1e-9) =>
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${actual} differs from ${expected} by more than ${tolerance}`);
const kB = 1.380649e-23, q = 1.602176634e-19;
const eta = kB * 300 / q;

test('four diode browser copies route strict v2, retain IDs and drawings, and preserve v1', () => {
  const ids = ['diode-single', 'diode-series', 'diode-pair', 'diode-rc'];
  assert.equal(presets.length,26);
  assert.equal(new Set(presets.map(p=>p.id)).size,26);
  const state = createLab();
  assert.equal(state.presetId, 'divider');
  assert.equal(state.document.circuit.schemaVersion, 1);
  for (const id of ids) {
    const next = createLab(id);
    assert.equal(next.document.circuit.schemaVersion, 2);
    assert.equal(next.document.experiment.sources[0].ac.re, .001);
    assert.equal(schematic(next).schematic, true);
    assert.equal(importNative(state, exportNative(next)).ok, true);
    assert.deepEqual(state.document, next.document);
    assert.equal(guideFor(id)?.steps.length >= 3, true);
  }
  assert.match(guideFor('diode-pair').equation,/ID\+ − ID−/);
  const old = exportNative(state);
  assert.equal(importNative(state, '{bad').ok, false);
  assert.equal(exportNative(state), old);
  const edited = structuredClone(state.document);
  edited.circuit.components.find(c => c.type === 'D').model.idealityFactor = 1.2;
  assert.equal(importNative(state, JSON.stringify(edited)).ok, true);
  assert.deepEqual(state.document, edited);
});

test('form diode promotion, strict rejection, and last-valid-document preservation', () => {
  const state = createLab('divider'), builder = createBuilder(state);
  const diode = addComponent(builder, 'D');
  assert.equal(builder.draft.circuit.schemaVersion, 2);
  diode.p = 'out'; diode.n = '0';
  diode.model.saturationCurrentA = 'bad'; touchBuilder(builder);
  const valid = exportNative(state);
  assert.equal(applyBuilder(builder, state).ok, false);
  assert.equal(exportNative(state), valid);
  assert.equal(diode.model.saturationCurrentA, 'bad');
  diode.model.saturationCurrentA = '1e-12'; touchBuilder(builder);
  assert.equal(applyBuilder(builder, state).ok, true);
  assert.equal(state.document.circuit.schemaVersion, 2);
  assert.equal(state.document.circuit.components.find(c => c.id === diode.id).model.temperatureK, 300);
  assert.equal(documentFromDraft(builder.draft).circuit.schemaVersion, 2);
});

test('terminal characteristic obeys junction equation and exact signed reverse behavior', () => {
  const state = createLab('diode-series');
  const diode = state.document.circuit.components.find(c => c.type === 'D');
  const point = diodeCharacteristic(diode, .5457378640168374);
  close(point.currentA, .001, 1e-12);
  close(point.junctionVoltageV, .5357378640168374, 1e-10);
  close(point.terminalVoltageV - point.junctionVoltageV, 10 * point.currentA, 1e-14);
  const reverse = diodeCharacteristic(diode, -1);
  assert.ok(reverse.currentA < 0);
  close(reverse.currentA, -1e-12, 1e-16);
  const ideal = createLab('diode-single').document.circuit.components.find(c => c.type === 'D');
  const v = eta * Math.log(2);
  close(diodeCharacteristic(ideal, v).currentA, 1e-12, 1e-22);
  close(diodeCharacteristic(ideal, -v).currentA, -.5e-12, 1e-22);
});

test('series characteristic retains tiny voltage signs or reports unresolved samples', () => {
  const diode = createLab('diode-series').document.circuit.components.find(c => c.type === 'D');
  for (const voltage of [-1, -1e-50, -1e-30, 1e-30, 1e-50, .5457378640168374]) {
    const point = diodeCharacteristic(diode, voltage);
    if (point === null) continue;
    assert.equal(Math.sign(point.currentA), Math.sign(voltage));
    assert.equal(Math.sign(point.junctionVoltageV), Math.sign(voltage));
    const reconstructed = point.junctionVoltageV + diode.model.seriesResistanceOhm * point.currentA;
    assert.ok(Math.abs(reconstructed - voltage) <= 1e-12 * Math.abs(voltage),
      `${voltage}: reconstructed ${reconstructed}`);
  }
});

test('finite extreme plot samples never emit nonfinite SVG coordinates', () => {
  const svg = plot([-1e308, 0, 1e308].map(x => ({ x, y: x / 1e308, status: 'ok' })),
    { title: 'Extreme sweep', xLabel: 'V', yLabel: 'A' });
  assert.match(svg, /<svg/);
  assert.doesNotMatch(svg, /(?:NaN|Infinity)/);
  const nearLimit = plot([Number.MAX_VALUE,1.7e308].map((y,index)=>({x:index,y,status:'ok'})),
    {title:'Large current',xLabel:'V',yLabel:'A'});
  assert.doesNotMatch(nearLimit,/(?:NaN|Infinity)/);
  assert.match(nearLimit,/cannot be drawn reliably/);
});

test('load line is topology- and polarity-checked, with no coupled-network shortcut', () => {
  const single = createLab('diode-single').document;
  assert.deepEqual(eligibleLoadLine(single, 'D1'), {
    sourceId: 'V1', resistorId: 'R1', diodeId: 'D1', sourceVoltageV: 1, resistanceOhm: 1000 });
  const reversed = structuredClone(single);
  const source = reversed.circuit.components.find(c => c.id === 'V1');
  [source.p, source.n] = [source.n, source.p];
  assert.equal(eligibleLoadLine(reversed, 'D1').sourceVoltageV, -1);
  assert.equal(eligibleLoadLine(createLab('diode-pair').document, 'Dplus'), null);
  const rc = createLab('diode-rc').document;
  assert.ok(eligibleLoadLine(rc, 'D1'));
  rc.circuit.components.find(c => c.type === 'C').p = 'in';
  assert.equal(eligibleLoadLine(rc, 'D1'), null);
});

test('panel DC, characteristic, tangent frequency, and unsupported dispatch use current bias', () => {
  const state = createLab('diode-single'), workspace = createWorkspace(state), calculator = new PanelCalculator();
  const dc = calculator.calculate(workspace.panels[0], state);
  assert.equal(dc.type, 'nonlinear-dc'); assert.equal(dc.bias.status, 'ok');
  close(dc.bias.diodes.D1.terminalVoltageV, .5169282075763274, 1e-10);
  close(dc.bias.diodes.D1.currentA, .0004830717924236726, 1e-12);
  close(dc.bias.diodes.D1.differentialResistanceOhm, 53.51585445139481, 1e-8);
  const characteristic = calculator.calculate(workspace.panels[1], state);
  assert.equal(characteristic.type, 'diode-characteristic');
  assert.equal(characteristic.curve.length, 121);
  assert.ok(characteristic.loadLine);
  const frequency = createPanel(state, 'third', 'frequency');
  const first = calculator.calculate(frequency, state);
  assert.equal(first.type, 'frequency'); assert.ok(first.incremental);
  assert.equal(first.incremental.tangent.document.circuit.schemaVersion, 1);
  assert.equal(first.incremental.tangent.document.experiment.sources[0].ac.re, .001);
  const transient = createPanel(state, 'later', 'transient');
  assert.equal(calculator.calculate(transient, state).reason, 'unsupported-panel');
  const before = first.incremental.bias.diodes.D1.currentA;
  assert.equal(updateDocument(state, document => { document.experiment.sources[0].dc = 2; }).ok, true);
  const changed = calculator.calculate(frequency, state);
  assert.notEqual(changed.incremental.bias.diodes.D1.currentA, before);
  assert.notEqual(changed.incremental.tangent.document.circuit.components.find(c => c.type === 'R' && c.id === 'D1').value,
    first.incremental.tangent.document.circuit.components.find(c => c.type === 'R' && c.id === 'D1').value);
  const missing = createPanel(state, 'missing', 'diode-characteristic'); missing.diodeId = 'gone';
  reconcilePanels({panels:[missing]}, state);
  assert.equal(missing.selectionNeeded, 'diode');
  assert.equal(calculator.calculate(missing,state), null);
  assert.equal(handlePanelFieldChange({panels:[missing],layoutIsSuggested:false},state,'missing','type','dc'),true);
  assert.equal(missing.selectionNeeded,null);
});

test('diode RC local transfer follows independent shunt equation and configured AC increment', () => {
  const state = createLab('diode-rc');
  const calc = new PanelCalculator();
  const panel = createPanel(state, 'f', 'frequency');
  const conductance = 1 / 53.51585445139481;
  const R = 1000, C = 1e-6, corner = (1/R + conductance)/(2*Math.PI*C);
  close(corner, 3133.132369472074, 1e-6);
  panel.minHz = corner; panel.maxHz = corner*10; panel.inspectHz = corner;
  const result = calc.calculate(panel,state);
  assert.equal(result.type,'frequency');
  const gain = (1/R)/(1/R+conductance);
  close(gain, .05079738878658121, 1e-10);
  close(result.sweep[0].value.re, gain/2, 1e-9);
  close(result.sweep[0].value.im, -gain/2, 1e-9);
  close(result.ac.observations.vout.value.re, gain*.001/2, 1e-10);
  close(result.ac.observations.vout.value.im, -gain*.001/2, 1e-10);
});

test('incremental drawing and provenance separate zero DC increments from changing Q and RMS AC', () => {
  const state=createLab('diode-rc'), calc=new PanelCalculator();
  const panel=createPanel(state,'f','frequency');
  const initial=calc.calculate(panel,state).incremental;
  const svg=diodeTangentSchematic(state,initial.tangent.document).html;
  assert.match(svg,/DC=0 V/);
  assert.match(svg,/AC=1\.000e-3\+0j V RMS/);
  assert.match(svg,/δV\(out\) − δV\(0\)/);
  assert.doesNotMatch(svg,/V1: DC=1 V/);
  const provenance=tangentProvenanceHtml(state.document,initial.tangent.document,initial.bias);
  assert.match(provenance,/DC=1 V/);
  assert.match(provenance,/Q V=0\.516928/);
  assert.match(provenance,/rd=53\.515/);
  updateDocument(state,document=>{
    document.experiment.sources[0].dc=2;
    document.experiment.sources[0].ac.re=.002;
    document.circuit.components.find(c=>c.type==='D').model.saturationCurrentA=1e-11;
  });
  const changed=calc.calculate(panel,state).incremental;
  const changedSvg=diodeTangentSchematic(state,changed.tangent.document).html;
  const changedData=tangentProvenance(state.document,changed.tangent.document,changed.bias);
  assert.match(changedSvg,/DC=0 V/);
  assert.match(changedSvg,/AC=2\.000e-3\+0j V RMS/);
  assert.equal(changedData.sources[0].biasDC,2);
  assert.notEqual(changedData.diodes[0].terminalVoltageV,
    tangentProvenance(state.document,initial.tangent.document,initial.bias).diodes[0].terminalVoltageV);
  setPresentationLanguage('mn');
  assert.match(tangentProvenanceHtml(state.document,changed.tangent.document,changed.bias),/Өсөлтийн үүсгүүр/);
  setPresentationLanguage('en');
});

test('DC metrics keep selected diode identity after removal and across duplicate panels', () => {
  const state=createLab('diode-pair'),workspace=createWorkspace(state),calc=new PanelCalculator();
  const first=workspace.panels[0];
  const second=createPanel(state,'other','dc');workspace.panels.push(second);
  handlePanelFieldChange(workspace,state,first.id,'diodeId','Dminus');
  assert.equal(second.diodeId,'Dplus');
  const original=calc.calculate(first,state).bias;
  assert.equal(selectedDiodeMetric(original,first.diodeId).id,'Dminus');
  const edited=structuredClone(state.document);
  edited.circuit.components=edited.circuit.components.filter(c=>c.id!=='Dminus');
  edited.circuit.observations=edited.circuit.observations.filter(o=>o.id!=='iminus');
  assert.equal(importNative(state,JSON.stringify(edited)).ok,true);
  reconcilePanels(workspace,state);
  const result=calc.calculate(first,state);
  assert.equal(result.type,'nonlinear-dc');
  assert.equal(result.bias.status,'ok');
  assert.equal(selectedDiodeMetric(result.bias,first.diodeId).kind,'missing');
  const html=selectedDiodeMetricHtml(result.bias,first.diodeId);
  assert.match(html,/Dminus/);
  assert.doesNotMatch(html,/metric-grid/);
  assert.match(selectedDiodeMetricHtml(result.bias,second.diodeId),/Dplus/);
  setPresentationLanguage('mn');
  assert.match(selectedDiodeMetricHtml(result.bias,first.diodeId),/дахин сонгоно/);
  setPresentationLanguage('en');
  handlePanelFieldChange(workspace,state,first.id,'diodeId','Dplus');
  assert.match(selectedDiodeMetricHtml(result.bias,first.diodeId),/metric-grid/);
  const linearV2=structuredClone(edited);
  linearV2.circuit.components=linearV2.circuit.components.filter(c=>c.type!=='D');
  linearV2.circuit.observations=linearV2.circuit.observations.filter(o=>o.type!=='current'||o.component!=='Dplus');
  assert.equal(importNative(state,JSON.stringify(linearV2)).ok,true);
  const noDiodes=calc.calculate(first,state).bias;
  assert.equal(noDiodes.status,'ok');
  assert.equal(selectedDiodeMetric(noDiodes,first.diodeId).kind,'none');
});

test('inspector diode signs and Jacobian coordinates follow the augmented law', () => {
  const state=createLab('diode-series'),calc=new PanelCalculator();
  const bias=calc.currentBias(state);
  assert.equal(bias.status,'ok');
  const system=assembleDiodeSystem(state.document);
  const evaluation=evaluateDiodeSystem(system,bias.x);
  const rows=diodeContributions(system,evaluation,'Dseries');
  assert.deepEqual(rows.map(row=>[row.row,row.column,row.meaning]),[
    ['KCL(out)','I(Dseries)','kcl-p'],['law(Dseries)','V(out)','law-p'],
    ['KCL(0)','I(Dseries)','kcl-n'],['law(Dseries)','V(0)','law-n'],
    ['law(Dseries)','I(Dseries)','law-current']]);
  close(rows[0].coefficient,1);
  close(rows[1].coefficient,-bias.diodes.Dseries.junctionConductanceS,1e-12);
  close(rows[2].coefficient,-1);
  close(rows[3].coefficient,bias.diodes.Dseries.junctionConductanceS,1e-12);
  assert.equal(rows[3].assembled,false);
  close(rows[4].coefficient,1+10*bias.diodes.Dseries.junctionConductanceS,1e-12);
  const residual=diodeResidualTerms(system,evaluation,'Dseries');
  close(residual[0].valueA,bias.diodes.Dseries.currentA,1e-15);
  close(residual[1].valueA,-bias.diodes.Dseries.currentA,1e-15);
  close(residual[2].valueA,0,1e-12);
  assert.equal(diodeJacobianCoordinates(system,evaluation,'Dseries').size,3);
  const coincident=structuredClone(state.document);
  coincident.circuit.components.find(c=>c.type==='D').n='out';
  // This valid topology can have a nonunique DC state; construct an
  // evaluation directly at a finite coordinate to inspect stamp cancellation.
  const same=assembleDiodeSystem(coincident);
  const atZero=evaluateDiodeSystem(same,Array(same.unknowns.length).fill(0));
  const terms=diodeContributions(same,atZero,'Dseries');
  assert.equal(terms.filter(term=>term.column==='I(Dseries)'&&term.row==='KCL(out)').reduce((sum,term)=>sum+term.coefficient,0),0);
  assert.equal(diodeJacobianCoordinates(same,atZero,'Dseries').size,1);
});

test('source sweep samples independently, preserves document, and cancels without stale CSV', async () => {
  const state = createLab('diode-single');
  const original = exportNative(state);
  let live = true;
  const config = {sourceId:'V1',observationId:'vout',minimum:0,maximum:2,count:5};
  const run = await runDcSweep(state.document, config, () => live);
  assert.equal(run.status,'complete'); assert.equal(run.points.length,5);
  close(run.points[0].output,0,1e-9);
  close(run.points[2].output,.5169282075763274,1e-8);
  assert.ok(run.points.every(point=>point.status==='ok'));
  assert.match(dcSweepCsv(run),/source_id,|"source_id"/);
  assert.equal(exportNative(state),original);
  let seen=0;
  const cancelled = await runDcSweep(state.document,config,()=>live,()=>{if(++seen===2)live=false;});
  assert.equal(cancelled.status,'cancelled'); assert.equal(cancelled.points.length,2);
  assert.throws(()=>dcSweepCsv(cancelled),/incomplete/);
});

test('source sweep reports genuine failed points as null gaps and never mutates DC settings', async () => {
  const state = createLab('diode-single');
  const original = exportNative(state);
  const run = await runDcSweep(state.document,
    {sourceId:'V1',observationId:'vout',minimum:0,maximum:1e20,count:3},()=>true);
  assert.equal(run.status,'complete');
  assert.equal(run.points[0].status,'ok');
  assert.ok(run.points.slice(1).some(point=>point.status!=='ok' && point.output===null));
  assert.equal(exportNative(state),original);
  assert.match(dcSweepCsv(run),/line-search/);
  const extreme = await runDcSweep(state.document,
    {sourceId:'V1',observationId:'vout',minimum:-1e308,maximum:1e308,count:3},()=>true);
  assert.ok(extreme.points.every(point=>Number.isFinite(point.sourceValue)));
  assert.equal(extreme.points[1].sourceValue,0);
});

test('production sweep lifecycle permanently retires changed, hidden, and replaced panels', async () => {
  const scenarios = ['type', 'settings', 'collapse', 'remove', 'navigation', 'hidden', 'document'];
  for (const scenario of scenarios) {
    const state = createLab('diode-pair');
    const workspace = createWorkspace(state);
    const panel = workspace.panels.find(p => p.type === 'dc-sweep');
    const lifecycle = new SweepLifecycle();
    let visible = true;
    let progress = 0;
    const originalDocument = state.document;
    const run = lifecycle.start(panel,state,workspace,()=>visible,()=>{
      progress++;
      if (progress !== 1) return;
      if (scenario === 'type') handlePanelFieldChange(workspace,state,panel.id,'type','dc');
      if (scenario === 'settings') handlePanelFieldChange(workspace,state,panel.id,'sweepMax','3');
      if (scenario === 'collapse') panel.collapsed = true;
      if (scenario === 'remove') workspace.panels = workspace.panels.filter(p=>p!==panel);
      if (scenario === 'navigation') workspace.view = 'editor';
      if (scenario === 'hidden') visible = false;
      if (scenario === 'document') updateDocument(state,d=>{d.experiment.sources[0].dc=.8;});
      lifecycle.reconcile(state,workspace,visible);
    },()=>{});
    const retired = await run;
    assert.equal(progress,1,scenario);
    assert.equal(retired.status,'cancelled',scenario);
    assert.equal(retired.result,undefined,scenario);
    assert.equal(retired.points.length,1,scenario);
    assert.equal(originalDocument===state.document,scenario!=='document',scenario);
    // Even if the student restores the old visible controls, the old run is
    // not current and cannot export. A new explicit Run has its own identity.
    panel.type='dc-sweep';panel.sweepMax=2;panel.collapsed=false;
    if (!workspace.panels.includes(panel)) workspace.panels.push(panel);
    workspace.view='analyze';visible=true;
    lifecycle.reconcile(state,workspace,visible);
    assert.equal(lifecycle.canExport(panel,state,workspace,visible),false,scenario);
  }
  const state=createLab('diode-pair'),workspace=createWorkspace(state);
  const panel=workspace.panels.find(p=>p.type==='dc-sweep');
  const lifecycle=new SweepLifecycle();
  const older=lifecycle.start(panel,state,workspace,()=>true,()=>{},()=>{});
  const newer=lifecycle.start(panel,state,workspace,()=>true,()=>{},()=>{});
  await Promise.all([older,newer]);
  assert.equal(lifecycle.canExport(panel,state,workspace,true),true);
  assert.equal((await older).status,'cancelled');

  const independent=createLab('diode-pair'), panels=createWorkspace(independent);
  const first=panels.panels.find(p=>p.type==='dc-sweep');
  const duplicate=createPanel(independent,'duplicate','dc-sweep');
  first.sweepCount=5;duplicate.sweepCount=5;
  panels.panels=[first,duplicate];
  const separate=new SweepLifecycle();
  const firstRun=separate.start(first,independent,panels,()=>true,()=>{
    handlePanelFieldChange(panels,independent,first.id,'type','dc');
    separate.reconcile(independent,panels,true);
  },()=>{});
  const duplicateRun=separate.start(duplicate,independent,panels,()=>true,()=>{
    setLanguage('mn'); // Locale is display state, not scientific identity.
    separate.reconcile(independent,panels,true);
  },()=>{});
  assert.equal((await firstRun).status,'cancelled');
  assert.equal((await duplicateRun).status,'complete');
  assert.equal(separate.canExport(duplicate,independent,panels,true),true);
  setLanguage('en');
});

test('v2 disabled analyses keep settings and v1 remains free of a synthetic diode', () => {
  const state = createLab('diode-rc'), calculator = new PanelCalculator();
  const panel = createPanel(state,'old','port-frequency');
  panel.portFrequencyHz = 1234;
  assert.equal(calculator.calculate(panel,state).reason,'unsupported-panel');
  assert.equal(panel.portFrequencyHz,1234);
  const diodePanel = createPanel(state,'curve','diode-characteristic');
  const result = calculator.calculate(diodePanel,state);
  assert.equal(result.type,'diode-characteristic');
  assert.ok(result.loadLine);
  const linear = createLab('divider');
  reconcilePanels({panels:[diodePanel]},linear);
  assert.equal(diodePanel.selectionNeeded,'diode');
  assert.equal(calculator.calculate(diodePanel,linear),null);
  assert.equal(linear.document.circuit.schemaVersion,1);
});

test('a strict valid v2 document applies even when the DC operating point fails', () => {
  const state = createLab('divider');
  const hard = createLab('diode-single').document;
  hard.experiment.sources[0].dc = 1e20;
  assert.equal(importNative(state,JSON.stringify(hard)).ok,true);
  assert.equal(state.document.circuit.schemaVersion,2);
  const panel = createPanel(state,'dc','dc');
  const result = new PanelCalculator().calculate(panel,state);
  assert.equal(result.type,'nonlinear-dc');
  assert.equal(result.bias.status,'failed');
  assert.deepEqual(state.document,hard);
  setLanguage('en'); const english=diodeFailureReason(result.bias.code);
  setLanguage('mn'); const mongolian=diodeFailureReason(result.bias.code);
  assert.notEqual(english,mongolian);
  assert.doesNotMatch(mongolian,/line-search/);
  setLanguage('en');
});
