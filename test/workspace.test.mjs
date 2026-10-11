import test from 'node:test';
import assert from 'node:assert/strict';
import { createLab, updateDocument } from '../dist/lab-test.js';
import { addPanel, createWorkspace, editPanelNumber, editPanelSelection, movePanel,
  PanelCalculator, panelCsv, reconcilePanels, removePanel, suggestedLayout } from '../dist/workspace-test.js';
import { plot } from '../dist/plot-test.js';

const near=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);

test('suggested layouts and duplicate frequency panels keep stable independent settings and CSV',()=>{
  const state=createLab('rc-high-pass'),ws=createWorkspace(state),calc=new PanelCalculator();
  assert.deepEqual(ws.panels.map(p=>p.type),['frequency','transient']);
  const first=ws.panels[0];
  const second=addPanel(ws,state,'frequency');
  assert.ok(second);assert.notEqual(first.id,second.id);
  editPanelSelection(second,'output','capacitorVoltage',state);
  assert.equal(editPanelNumber(second,state,'points','3'),true);
  assert.equal(editPanelNumber(second,state,'minHz','10'),true);
  const a=calc.calculate(first,state),b=calc.calculate(second,state);
  assert.equal(a.type,'frequency');assert.equal(b.type,'frequency');
  assert.equal(a.sweep.length,81);assert.equal(b.sweep.length,3);
  near(a.sweep[0].magnitude,2*Math.PI*.001/(Math.sqrt(1+(2*Math.PI*.001)**2)),1e-8);
  assert.notEqual(a.sweep[0].magnitude,b.sweep[0].magnitude);
  const csvA=panelCsv(first,a),csvB=panelCsv(second,b);
  assert.equal(csvA.trim().split('\n').length,82);assert.equal(csvB.trim().split('\n').length,4);
  assert.match(csvA,/"1"/);assert.match(csvB,/"10"/);
  second.pending.maxHz='bad';second.errors.maxHz='finiteField';
  movePanel(ws,second.id,-1);movePanel(ws,second.id,-1);
  assert.equal(ws.panels[0].id,second.id);assert.equal(ws.panels[0].pending.maxHz,'bad');
  assert.equal(addPanel(ws,state,'dc'),null);
  removePanel(ws,first.id);assert.equal(ws.panels.length,2);assert.equal(ws.panels[0].errors.maxHz,'finiteField');
  assert.equal(addPanel(ws,state,'dc')?.id,'panel-4');
});

test('invalid panel text retains last valid result and does not poison unrelated analysis',()=>{
  const state=createLab('rc'),ws=createWorkspace(state),calc=new PanelCalculator();
  const frequency=ws.panels[0],time=ws.panels[1];
  const before=calc.calculate(frequency,state);
  const dc=addPanel(ws,state,'dc');
  assert.equal(editPanelNumber(time,state,'step','0'),false);
  assert.equal(time.pending.step,'0');assert.equal(time.errors.step,'settingStep');
  assert.equal(calc.calculate(time,state).type,'transient');
  assert.equal(calc.calculate(frequency,state),before);
  assert.equal(calc.calculate(dc,state).dc.status,'ok');
  ws.view='transform';ws.view='editor';ws.editorView='json';ws.view='analyze';
  assert.equal(time.pending.step,'0');
  assert.equal(editPanelNumber(time,state,'step','0.0001'),true);
  assert.deepEqual(time.errors,{});
});

test('missing references are explicit after topology change; DC remains independent of transfer input',()=>{
  const state=createLab('rc'),ws=createWorkspace(state),calc=new PanelCalculator();
  const frequency=ws.panels[0],time=ws.panels[1];
  assert.equal(updateDocument(state,d=>{d.circuit.observations=d.circuit.observations.filter(o=>o.id!=='out');}).ok,true);
  reconcilePanels(ws,state);
  assert.equal(frequency.selectionNeeded,'output');assert.equal(time.selectionNeeded,'output');
  assert.equal(calc.calculate(frequency,state),null);
  const dc=addPanel(ws,state,'dc');
  state.input='nonexistent';
  assert.equal(calc.calculate(dc,state).dc.status,'ok');
  editPanelSelection(frequency,'output','capacitor',state);
  assert.equal(frequency.selectionNeeded,null);
  assert.equal(calc.calculate(frequency,state).type,'frequency');
  suggestedLayout(ws,state);assert.deepEqual(ws.panels.map(p=>p.type),['frequency','transient']);
});

test('plot paths cannot fill triangles; failed samples break lines and constants remain drawable',()=>{
  const html=plot([{x:1,y:2,status:'ok'},{x:2,y:null,status:'inconsistent'},
    {x:3,y:2,status:'ok'}],{title:'Constant',xLabel:'Hz',yLabel:'V'});
  assert.match(html,/class="plot-axis" fill="none"/);
  assert.match(html,/class="plot-gridline" fill="none"/);
  assert.match(html,/class="plot-break" fill="none"/);
  assert.match(html,/class="plot-line "/);
  const line=html.match(/class="plot-line " d="([^"]+)"/)?.[1];
  assert.ok(line);assert.equal((line.match(/M/g)??[]).length,2);
  assert.doesNotMatch(html,/NaN/);
});
