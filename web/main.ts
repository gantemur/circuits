import { analyze, createLab, csvFor, dcBranchCurrents, dimensionless, exportNative, importNative,
  resetExample, settingsProblems, updateDocument, type LabAnalysis, type Settings } from './lab.js';
import { presets } from './presets.js';
import { escapeHtml, schematic } from './schematic.js';
import { plot } from './plot.js';
import { algebraicSummary, statusSummary, validationSummary } from './diagnostics.js';
import { language, persistLanguage, readLanguage, setLanguage, t, translate,
  type Language, type TranslationKey } from './i18n.js';
import { BuilderUI } from './builder-ui.js';
import type { Component, SourceValue, Waveform } from '../src/model.js';

let storage: Storage | undefined;
try { storage = window.localStorage; } catch { /* Private browsing may disable storage. */ }
setLanguage(readLanguage(navigator.languages?.length ? navigator.languages : [navigator.language], storage));
let state = createLab();
let analysis: LabAnalysis | null = null;
interface Issue { kind: 'input' | 'setting' | 'document'; code: string; params: Readonly<Record<string,string|number>>; raw?: string | undefined }
let validationIssue: (Issue & { id: string }) | null = null;
let importIssue: (Issue & { kind: 'document' }) | null = null;
let importReadFailed = false;
let jsonDirty = false;
let jsonBase = exportNative(state);
let jsonIssue: (Issue & { kind: 'document' }) | null = null;
let notice: Issue | null = null;
const byId = (id: string): HTMLElement => {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing interface element ${id}`);
  return value;
};
const builderUI = new BuilderUI(byId('builder-editor'), () => state, () => recompute());
const fmt = (value: number, digits = 5): string => {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return '0';
  return (Math.abs(value) < .001 || Math.abs(value) >= 1e5) ? value.toExponential(3) : Number(value.toPrecision(digits)).toString();
};
const sourceUnit = (id: string): 'V' | 'A' => state.document.circuit.components.find(c => c.id === id)?.type === 'I' ? 'A' : 'V';
const componentUnit = (c: Component) => c.type === 'R' ? 'Ω' : c.type === 'C' ? 'F' : c.type === 'L' ? 'H' : c.type === 'VCCS' ? 'S' : c.type === 'CCVS' ? 'Ω' : '';
function technical(raw?: string): string {
  return raw ? `<details class="technical-details"><summary>${t('technicalDetails')}</summary><pre>${escapeHtml(raw)}</pre></details>` : '';
}
function issueText(issue: Issue, target?: HTMLInputElement | HTMLSelectElement): string {
  if (issue.kind === 'document') return validationSummary(issue.code, issue.params);
  const params = issue.kind === 'input' ? { ...issue.params, field: target?.labels?.[0]?.textContent?.trim() ?? '' } : issue.params;
  return translate(issue.code as TranslationKey, params);
}
function renderStatic(): void {
  document.documentElement.lang = language();
  document.title = t('pageTitle');
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', t('pageDescription'));
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(element => {
    element.textContent = translate(element.dataset.i18n as TranslationKey);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach(element => {
    element.setAttribute('aria-label', translate(element.dataset.i18nAria as TranslationKey));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-language]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.language === language()));
  });
}
function renderImportIssue(): void {
  byId('import-error').innerHTML = importIssue
    ? `${escapeHtml(t(importReadFailed?'importFailed':'importRejected',{reason:issueText(importIssue)}))}${technical(importIssue.raw)}` : '';
}
function jsonEditor(): HTMLTextAreaElement { return byId('json-editor') as HTMLTextAreaElement; }
function renderJsonIssue(): void {
  const editor=jsonEditor();
  const conflict=jsonDirty && jsonBase!==exportNative(state);
  editor.setAttribute('aria-invalid',String(!!jsonIssue||conflict));
  byId('json-error').innerHTML=conflict ? escapeHtml(t('jsonConflict')) : jsonIssue
    ? `${escapeHtml(t('jsonRejected',{reason:issueText(jsonIssue)}))}${technical(jsonIssue.raw)}` : '';
}
function syncJsonEditor(force=false): void {
  if(force || !jsonDirty) { jsonEditor().value=exportNative(state); jsonBase=exportNative(state); jsonDirty=false; }
  renderJsonIssue();
}
function switchLanguage(next: Language): void {
  const drafts = Array.from(document.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-kind]'))
    .map(element => ({ id: element.id, value: element.value, invalid: element.getAttribute('aria-invalid') }));
  const focused = (document.activeElement as HTMLElement | null)?.id;
  setLanguage(next); persistLanguage(next, storage);
  renderStatic(); renderAll(); renderImportIssue(); renderJsonIssue();
  for (const draft of drafts) {
    const element = document.getElementById(draft.id) as HTMLInputElement | HTMLSelectElement | null;
    if (!element) continue;
    element.value = draft.value;
    if (draft.invalid) element.setAttribute('aria-invalid', draft.invalid);
  }
  if (validationIssue) {
    const target = document.getElementById(validationIssue.id) as HTMLInputElement | HTMLSelectElement | null;
    if (target) {
      target.setAttribute('aria-invalid','true');
      const slot=target.closest('.field')?.querySelector('.field-error');
      if (slot) slot.innerHTML=`${escapeHtml(issueText(validationIssue,target))}${technical(validationIssue.raw)}`;
    }
  }
  if (focused) document.getElementById(focused)?.focus({ preventScroll: true });
}
function field(label:string,kind:string,id:string,value:string|number,unit='',positive=false):string {
  const key=`${kind}:${id}`;
  return `<div class="field"><label for="${escapeHtml(key)}">${escapeHtml(label)}${unit?` <span class="unit-note">(${escapeHtml(unit)})</span>`:''}</label><input id="${escapeHtml(key)}" data-kind="${escapeHtml(kind)}" data-id="${escapeHtml(id)}" data-positive="${positive?'1':'0'}" type="number" step="any" value="${escapeHtml(value)}"><small class="field-error" aria-live="polite"></small></div>`;
}
function selectField(label:string,kind:string,id:string,options:{value:string;label:string}[],selected:string):string {
  const key=`${kind}:${id}`;
  return `<div class="field"><label for="${escapeHtml(key)}">${escapeHtml(label)}</label><select id="${escapeHtml(key)}" data-kind="${escapeHtml(kind)}" data-id="${escapeHtml(id)}">${options.map(o=>`<option value="${escapeHtml(o.value)}"${o.value===selected?' selected':''}>${escapeHtml(o.label)}</option>`).join('')}</select><small class="field-error" aria-live="polite"></small></div>`;
}
function renderExamples():void {
  byId('example-list').innerHTML=`<div class="example-list">${presets.map(p=>`<button type="button" class="example-item${state.presetId===p.id?' active':''}" data-example="${p.id}" aria-current="${state.presetId===p.id?'true':'false'}"><span><span class="name">${translate(p.titleKey)}</span><span class="detail">${translate(p.subtitleKey)}</span></span><span class="arrow" aria-hidden="true">↗</span></button>`).join('')}</div>`;
  byId('reset-example').textContent=state.presetId?t('resetExample'):t('loadDivider');
}
function renderComponents():void {
  const c=state.document.circuit.components;
  byId('component-list').innerHTML=`<div class="component-list">${c.map(d=>`<button type="button" class="component-pill${state.selectedComponent===d.id?' active':''}" data-component="${escapeHtml(d.id)}" aria-pressed="${state.selectedComponent===d.id?'true':'false'}">${escapeHtml(d.id)} <span class="muted">${escapeHtml(d.type)}</span></button>`).join('')}</div>`;
  const selected=c.find(d=>d.id===state.selectedComponent);
  if(!selected){byId('component-editor').innerHTML=`<div class="editor-card"><p class="muted small">${t('selectComponentHint')}</p></div>`;return;}
  const p=analysis?.assembly.contributions.filter(x=>x.component===selected.id) ?? [];
  let param='';
  if('value' in selected)param=field(t('value'),`component`,selected.id,selected.value,componentUnit(selected),true);
  else if('gain' in selected)param=field(t('gain'),`component`,selected.id,selected.gain,componentUnit(selected));
  else param=`<p class="muted small">${t('sourceEditorHint')}</p>`;
  byId('component-editor').innerHTML=`<div class="editor-card"><p class="editor-title">${escapeHtml(selected.id)} · ${escapeHtml(selected.type)}</p><p class="terminal-note">${escapeHtml(t('orderedTerminals',{p:selected.p,n:selected.n}))}</p>${param}<div class="subheading">${t('kernelTerminalLaw')}</div><div class="law-box">${p.length?escapeHtml([...new Set(p.map(x=>x.law))].join(' · ')):t('noContribution')}</div><p class="muted small">${t('contributionCount',{count:p.length})}</p></div>`;
}
function waveformFields(s:SourceValue):string {
  const w=s.waveform;
  if(w?.type==='step')return `<div class="field-row three">${field(t('at'),'waveform.at',s.id,w.at,'s')}${field(t('before'),'waveform.before',s.id,w.before,sourceUnit(s.id))}${field(t('after'),'waveform.after',s.id,w.after,sourceUnit(s.id))}</div>`;
  if(w?.type==='sinusoid')return `<div class="field-row">${field(t('offset'),'waveform.offset',s.id,w.offset,sourceUnit(s.id))}${field(t('peakAmplitude'),'waveform.amplitudePeak',s.id,w.amplitudePeak,sourceUnit(s.id))}${field(t('frequency'),'waveform.frequencyHz',s.id,w.frequencyHz,'Hz')}${field(t('phase'),'waveform.phaseRadians',s.id,w.phaseRadians,'rad')}</div><p class="muted small">${t('peakVsRms')}</p>`;
  return `${field(t('timeValue'),'waveform.value',s.id,w?.type==='constant'?w.value:s.dc,sourceUnit(s.id))}<p class="muted small">${t('timeSeparate')}</p>`;
}
function renderSources():void {
  const blocks=state.document.experiment.sources.map(s=>`<div class="source-block"><h3>${escapeHtml(t('sourceHeading',{id:s.id,unit:sourceUnit(s.id)}))}</h3><div class="field-row three">${field(t('dcValue'),'source.dc',s.id,s.dc,sourceUnit(s.id))}${field(t('acReal'),'source.ac.re',s.id,s.ac?.re??0,`${sourceUnit(s.id)} RMS`)}${field(t('acImaginary'),'source.ac.im',s.id,s.ac?.im??0,`${sourceUnit(s.id)} RMS`)}</div>${selectField(t('transientWaveform'),'waveform.type',s.id,[{value:'constant',label:t('constant')},{value:'step',label:t('scheduledStep')},{value:'sinusoid',label:t('sinusoid')}],s.waveform?.type??'constant')}${waveformFields(s)}</div>`).join('');
  const initial=state.document.experiment.initial;
  const stored=state.document.circuit.components.filter(c=>c.type==='C'||c.type==='L');
  const initialFields=initial.kind==='storage'?stored.map(c=>field(t(c.type==='C'?'storageVoltage':'storageCurrent',{id:c.id}),'initial.value',c.id,initial.values.find(v=>v.id===c.id)?.value??0,c.type==='C'?'V':'A')).join(''):'';
  byId('source-editor').innerHTML=`${blocks||`<p class="muted small">${t('noSource')}</p>`}<div class="subheading">${t('initialization')}</div>${selectField(t('policy'),'initial.kind','policy',[{value:'equilibrium',label:t('equilibriumBefore')},{value:'storage',label:t('specifiedStorage')}],initial.kind)}${initialFields}<p class="muted small">${t('storageHint')}</p>`;
}
function renderControls():void {
  const stateless=!state.document.circuit.components.some(c=>c.type==='C'||c.type==='L');
  const outputs=state.document.circuit.observations.map(o=>({value:o.id,label:`${o.id} · ${o.type==='voltage'?`V(${o.p})−V(${o.n})`:`I(${o.component})`}`}));
  const inputs=state.document.experiment.sources.map(s=>({value:s.id,label:t('inputOption',{id:s.id,unit:sourceUnit(s.id)})}));
  const s=state.settings;
  byId('analysis-controls').innerHTML=`<div class="controls-group"><h3>${t('unitInputTransfer')}</h3><div class="controls-grid">${selectField(t('independentInput'),'selected.input','input',inputs,state.input)}${selectField(t('measuredOutput'),'selected.output','output',outputs,state.output)}${field(t('acInspectFrequency'),'setting','inspectHz',s.inspectHz,'Hz',true)}</div></div>
  <div class="controls-group"><h3>${t('logarithmicSweep')}</h3><div class="controls-grid">${field(t('minimum'),'setting','minHz',s.minHz,'Hz',true)}${field(t('maximum'),'setting','maxHz',s.maxHz,'Hz',true)}${field(t('samples'),'setting','points',s.points,'2–241',true)}</div></div>
  <div class="controls-group"><h3>${t(stateless?'statelessSamples':'backwardEulerTransient')}</h3><div class="controls-grid">${field(t('duration'),'setting','duration',s.duration,'s',true)}${field(t(stateless?'sampleSpacing':'timeStep'),'setting','step',s.step,'s',true)}</div></div>
  <div class="controls-summary"><span class="summary-tag">${t('sweepLimit')}</span><span class="summary-tag">${t(stateless?'algebraicLimit':'transientLimit')}</span><span class="summary-tag">${t(stateless?'sampleSpacing':'fixedStep')}</span></div>`;
}
function renderSchematic():void {
  const view=schematic(state);
  byId('schematic').innerHTML=view.html;
  byId('schematic-note').textContent=view.note;
  byId('schematic-badge').textContent=view.schematic?t('layout',{id:state.presetId??''}):t('topologyTable');
}
function statusMarkup(message:string,raw?:string):string { return `<div class="error-card" role="alert">${escapeHtml(message)}${technical(raw)}</div>`; }
function valueTable(items:{label:string;value:number;unit:string}[]):string {
  return `<div class="table-wrap"><table class="result-table"><thead><tr><th>${t('quantity')}</th><th>${t('selectedValue')}</th></tr></thead><tbody>${items.map(item=>`<tr><td>${escapeHtml(item.label)}</td><td>${fmt(item.value)} ${escapeHtml(item.unit)}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderDC(a:LabAnalysis):void {
  const dc=a.dc;
  if(dc.status!=='ok'){byId('dc-results').innerHTML=statusMarkup(statusSummary(dc.status),dc.message);return;}
  const nodes=a.assembly.unknowns.filter(x=>x.id.startsWith('V(')).map(x=>({label:x.id,value:dc.unknowns[x.id]!.value.re,unit:'V'}));
  const branches=dcBranchCurrents(a,state).map(x=>({label:`I(${x.id})`,value:x.value,unit:'A'}));
  const max=Math.max(0,...dc.residuals.map(r=>r.absolute),dc.groundKcl.absolute);
  byId('dc-results').innerHTML=`<div class="two-col"><div><div class="subheading">${t('nodeVoltages')}</div>${valueTable(nodes)}</div><div><div class="subheading">${t('signedBranchCurrents')}</div>${valueTable(branches)}</div></div><p class="analysis-note">${t('residualSummary',{value:fmt(max),scaled:fmt(dc.diagnostics.scaledBackwardResidual)})}</p>`;
}
function renderFrequency(a:LabAnalysis):void {
  const dim=dimensionless(a.transferUnit), magLabel=t('magnitudeWithUnit',{unit:dim?'dB':a.transferUnit});
  const mag=a.sweep.map(p=>({x:p.frequencyHz,y:dim?p.magnitudeDb:p.magnitude,status:!dim&&p.status==='zero-magnitude'?'ok':p.status}));
  const phase=a.sweep.map(p=>({x:p.frequencyHz,y:p.phaseDegrees,status:p.status}));
  const failed=a.sweep.filter(p=>p.status!=='ok'&&p.status!=='zero-magnitude');
  const zero=a.sweep.filter(p=>p.status==='zero-magnitude');
  const ac=a.ac, acInputs=state.document.experiment.sources.map(s=>`${s.id}=${fmt(s.ac?.re??0)}${(s.ac?.im??0)<0?'':'+'}${fmt(s.ac?.im??0)}j ${sourceUnit(s.id)} RMS`).join('; ');
  const acText=ac.status==='ok'?`${fmt(ac.observations[state.output]!.value.re)}${ac.observations[state.output]!.value.im<0?'':'+'}${fmt(ac.observations[state.output]!.value.im)}j ${ac.observations[state.output]!.unit} RMS`:statusSummary(ac.status);
  const algebraic=state.presetId==='divider' && state.input==='Vin' && state.output==='out'
    ? `<div class="soft-note">${escapeHtml(t('dividerFormula'))}</div>`
    : a.algebraic.status==='ok'?`<div class="soft-note"><strong>${t('algebraicTitle')}</strong> · ${escapeHtml(t('algebraicFormula',{n0:fmt(a.algebraic.numerator[0]),n1:fmt(a.algebraic.numerator[1]),d0:fmt(a.algebraic.denominator[0]),d1:fmt(a.algebraic.denominator[1]),unit:a.transferUnit,root:fmt(a.algebraic.denominatorRoot)}))} <span class="muted">${t('algebraicRootNote')}</span></div>`:
    `<div class="soft-note">${escapeHtml(t('algebraicUnavailable',{reason:algebraicSummary(a.algebraic.reason)}))}${technical(a.algebraic.message)}</div>`;
  byId('frequency-results').innerHTML=`<p class="analysis-note">${escapeHtml(t('transferIntro',{input:state.input,output:state.output,unit:a.transferUnit}))} ${dim?t('gainDbNote'):t('gainPhysicalNote')}</p>
    <div class="plot-grid">${plot(mag,{title:t('magnitude'),xLabel:t('frequencyAxis'),yLabel:magLabel,xLog:true})}${plot(phase,{title:t('phase'),xLabel:t('frequencyAxis'),yLabel:t('phaseWithUnit'),xLog:true,color:'orange'})}</div>
    ${failed.length?`<p class="warning">${escapeHtml(t('failedFrequency',{count:failed.length,reason:statusSummary(failed[0]!.status)}))}${technical(failed[0]!.message)}</p>`:''}${zero.length?`<p class="warning">${t('zeroFrequency',{count:zero.length})}</p>`:''}
    <div class="subheading">${t('configuredAc')}</div><p class="analysis-note">${escapeHtml(t('acSummary',{frequency:fmt(a.settings.inspectHz),sources:acInputs||t('noSourcesShort'),output:acText}))}${ac.status==='ok'?'':technical(ac.message)}</p>${algebraic}`;
}
function renderTime(a:LabAnalysis):void {
  const time=a.transient, unit=a.assembly.outputs.find(o=>o.id===state.output)!.unit;
  const stateless=a.assembly.storage.length===0;
  const samples=time.samples.map(s=>({x:s.time,y:s.observations[state.output]?.value.re??null,status:'ok'}));
  if(time.status!=='ok')samples.push({x:time.time,y:null,status:time.status});
  const policy=time.status==='ok'?(time.initialization.kind==='storage'?t('specifiedStorage'):t('equilibriumBefore')):'';
  const details=time.status==='ok'?`<p class="analysis-note">${escapeHtml(stateless?t('statelessDetails',{count:time.samples.length}):t('transientDetails',{count:time.samples.length,policy}))}</p>`:
    statusMarkup(t('transientFailure',{status:statusSummary(time.status),time:fmt(time.time)}),time.message);
  byId('transient-results').innerHTML=`<p class="analysis-note">${escapeHtml(t(stateless?'statelessSummary':'transientSummary',{step:fmt(a.settings.step),duration:fmt(a.settings.duration),output:state.output,unit}))}</p>${stateless?`<p class="soft-note">${t('statelessNote')}</p>`:''}${plot(samples,{title:t('transientPlot',{output:state.output}),xLabel:t('timeAxis'),yLabel:t('outputAxis',{output:state.output,unit})})}${details}`;
}
function matrix(name:'E'|'K'|'B',a:LabAnalysis):string {
  const assembly=a.assembly, cols=name==='B'?assembly.inputs:assembly.unknowns;
  const marked=new Set(assembly.contributions.filter(c=>c.component===state.selectedComponent&&c.matrix===name).map(c=>`${c.rowIndex}:${c.columnIndex}`));
  return `<div><h4>${name} <span class="muted">${name==='E'?t('eStorage'):name==='K'?t('kStatic'):t('bInput')}</span></h4><div class="table-wrap"><table class="matrix-table"><thead><tr><th>${t('rowColumn')}</th>${cols.map(c=>`<th>${escapeHtml(c.id)} (${c.unit})</th>`).join('')}</tr></thead><tbody>${assembly[name].map((row,i)=>`<tr><th>${escapeHtml(assembly.rows[i]!.id)} (${assembly.rows[i]!.unit})</th>${row.map((v,j)=>`<td class="${marked.has(`${i}:${j}`)?'highlight':''}">${fmt(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}
function renderEquations(a:LabAnalysis):void {
  const output=a.assembly.outputs.find(o=>o.id===state.output)!;
  const relation=output.kind==='fixed'?`${state.output} = Cₒ·x + Dₒ·u; Cₒ=[${output.C.map(v=>fmt(v)).join(', ')}], Dₒ=[${output.D.map(v=>fmt(v)).join(', ')}]`:
    `${state.output} = Q·ẋ; Q=[${output.Q.map(v=>fmt(v)).join(', ')}] (${t('derivativeObservation')})`;
  const c=a.assembly.contributions.filter(p=>p.component===state.selectedComponent);
  const provenance=c.length?`<div class="table-wrap"><table class="result-table provenance-table"><thead><tr><th>${t('matrix')}</th><th>${t('row')}</th><th>${t('column')}</th><th>${t('selectedValue')}</th><th>${t('units')}</th><th>${t('terminalLaw')}</th></tr></thead><tbody>${c.map(p=>`<tr><td>${p.matrix}</td><td>${escapeHtml(p.row)}</td><td>${escapeHtml(p.column)}</td><td>${fmt(p.value)}</td><td>${escapeHtml(p.units)}</td><td>${escapeHtml(p.law)}</td></tr>`).join('')}</tbody></table></div>`:`<p class="muted small">${t('provenanceHint')}</p>`;
  const dc=a.dc;
  const diagnostic=dc.status==='ok'?`<div class="table-wrap"><table class="result-table"><thead><tr><th>${t('residualRow')}</th><th>${t('absolute')}</th><th>${t('limit')}</th><th>${t('unit')}</th></tr></thead><tbody>${[...dc.residuals,dc.groundKcl].map(r=>`<tr><td>${escapeHtml(r.label)}</td><td>${fmt(r.absolute)}</td><td>${fmt(r.tolerance)}</td><td>${r.unit}</td></tr>`).join('')}</tbody></table></div><p class="analysis-note">${t('diagnosticSummary',{residual:fmt(dc.diagnostics.scaledBackwardResidual),pivot:fmt(dc.diagnostics.pivotRatio)})}${technical(dc.diagnostics.scaling)}</p>`:statusMarkup(t('noDcResiduals',{reason:statusSummary(dc.status)}),dc.message);
  byId('equations-results').innerHTML=`<p class="equation-line">E · ẋ + K · x = B · u</p><p class="analysis-note">${escapeHtml(t('unknownsInputs',{unknowns:a.assembly.unknowns.map(x=>`${x.id} [${x.unit}]`).join(', ')||t('noSourcesShort'),inputs:a.assembly.inputs.map(x=>`${x.id} [${x.unit}]`).join(', ')||t('noSourcesShort')}))}</p><p class="soft-note">${escapeHtml(t('outputRelation',{relation}))}</p><div class="matrix-grid">${matrix('E',a)}${matrix('K',a)}${matrix('B',a)}</div><div class="subheading">${t('selectedProvenance')}</div>${provenance}<div class="subheading">${t('numericalDiagnostics')}</div>${diagnostic}`;
}
function renderResults():void {
  const ids=['dc-results','frequency-results','transient-results','equations-results'];
  if(!analysis){for(const id of ids)byId(id).innerHTML=`<p class="warning">${t('resultNeedsValid')}</p>`;}
  else {renderDC(analysis);renderFrequency(analysis);renderTime(analysis);renderEquations(analysis);}
  (byId('export-frequency') as HTMLButtonElement).disabled=!analysis;
  (byId('export-transient') as HTMLButtonElement).disabled=!analysis;
}
function renderStatus():void {
  byId('global-status').innerHTML=notice?`<div class="error-card">${escapeHtml(issueText(notice))}${technical(notice.raw)}</div>`:'';
}
function renderAll():void { renderExamples();renderComponents();renderSources();renderControls();renderSchematic();renderStatus();renderResults();syncJsonEditor();builderUI.render(); }
function recompute():void {
  validationIssue=null;
  try { analysis=analyze(state);notice=null; }
  catch(error){analysis=null;notice={kind:'setting',code:'chooseInputOutput',params:{},raw:error instanceof Error?error.message:String(error)};}
  renderAll();
}
function invalid(target:HTMLInputElement|HTMLSelectElement, issue: Issue):void {
  target.setAttribute('aria-invalid','true');
  validationIssue={...issue,id:target.id};
  const slot=target.closest('.field')?.querySelector('.field-error');if(slot)slot.innerHTML=`${escapeHtml(issueText(issue,target))}${technical(issue.raw)}`;
  analysis=null;notice={kind:'setting',code:'correctionNeeded',params:{}};
  renderStatus();renderResults();
}
class UiError extends Error {
  constructor(readonly key: TranslationKey) { super(key); }
}
function parseInput(target: HTMLInputElement | HTMLSelectElement): number {
  if (!target.value.trim()) throw new UiError('requiredField');
  const value=Number(target.value);
  if (!Number.isFinite(value)) throw new UiError('finiteField');
  if (target.dataset.positive==='1' && value<=0) throw new UiError('positiveField');
  return value;
}
const settingsKeys: Record<keyof Settings, TranslationKey> = {
  minHz:'settingMinHz',maxHz:'settingMaxHz',points:'settingPoints',inspectHz:'settingInspectHz',duration:'settingDuration',step:'settingStep',
};
function edited(target:HTMLInputElement|HTMLSelectElement):void {
  const kind=target.dataset.kind,id=target.dataset.id??'';
  if(!kind)return;
  try {
    if(kind==='selected.input'||kind==='selected.output'){
      if(kind==='selected.input')state.input=target.value;else state.output=target.value;
      state.revision++;recompute();return;
    }
    if(kind==='waveform.type'){
      const result=updateDocument(state,d=>{
        const source=d.experiment.sources.find(s=>s.id===id)!;
        if(target.value==='constant')source.waveform={type:'constant',value:source.dc};
        else if(target.value==='step')source.waveform={type:'step',at:0,before:0,after:source.dc};
        else if(target.value==='sinusoid')source.waveform={type:'sinusoid',offset:0,amplitudePeak:Math.abs(source.dc),frequencyHz:100,phaseRadians:0};
        else throw new UiError('unsupportedWaveform');
      });
      if(!result.ok){invalid(target,{kind:'document',code:result.errorCode??'invalid-document',params:result.errorParams??{},raw:result.error});return;}
      recompute();return;
    }
    if(kind==='initial.kind'){
      const result=updateDocument(state,d=>{
        if(target.value==='equilibrium')d.experiment.initial={kind:'equilibrium'};
        else if(target.value==='storage'){
          const prior=d.experiment.initial;
          d.experiment.initial={kind:'storage',values:d.circuit.components.filter(c=>c.type==='C'||c.type==='L').map(c=>({id:c.id,value:prior.kind==='storage'?prior.values.find(v=>v.id===c.id)?.value??0:0}))};
        } else throw new UiError('unsupportedInitial');
      });
      if(!result.ok){invalid(target,{kind:'document',code:result.errorCode??'invalid-document',params:result.errorParams??{},raw:result.error});return;}
      recompute();return;
    }
    const value=parseInput(target);
    if(kind==='setting'){
      const key=id as keyof Settings;
      if(!(key in state.settings))throw new UiError('unsupportedField');
      const next={...state.settings,[key]:value};
      const events=state.document.experiment.sources.filter(s=>s.waveform?.type==='step'&&s.waveform.at>=0&&s.waveform.at<=next.duration).length;
      const errors=settingsProblems(next,events);
      if(errors.length){invalid(target,{kind:'setting',code:settingsKeys[errors[0]!],params:{}});return;}
      state.settings=next;state.revision++;recompute();return;
    }
    const result=updateDocument(state,d=>{
      if(kind==='component'){
        const c=d.circuit.components.find(c=>c.id===id);
        if(!c)throw new UiError('unknownComponent');
        if('value' in c)c.value=value;else if('gain' in c)c.gain=value;
        else throw new UiError('noEditableParameter');
      }else if(kind==='source.dc'||kind==='source.ac.re'||kind==='source.ac.im'){
        const s=d.experiment.sources.find(s=>s.id===id)!;
        if(kind==='source.dc')s.dc=value;
        else {s.ac??={re:0,im:0};if(kind.endsWith('.re'))s.ac.re=value;else s.ac.im=value;}
      }else if(kind.startsWith('waveform.')){
        const s=d.experiment.sources.find(s=>s.id===id)!;
        if(kind==='waveform.value'&&!s.waveform)s.waveform={type:'constant',value};
        if(!s.waveform)throw new UiError('chooseWaveform');
        const key=kind.slice('waveform.'.length) as keyof Waveform;
        if(!(key in s.waveform))throw new UiError('waveformFieldMismatch');
        Object.assign(s.waveform,{[key]:value});
      }else if(kind==='initial.value'){
        const initial=d.experiment.initial;
        if(initial.kind!=='storage')throw new UiError('chooseStorage');
        initial.values.find(v=>v.id===id)!.value=value;
      }else throw new UiError('unsupportedField');
    });
    if(!result.ok){invalid(target,{kind:'document',code:result.errorCode??'invalid-document',params:result.errorParams??{},raw:result.error});return;}
    recompute();
  }catch(error){invalid(target,{kind:'input',code:error instanceof UiError?error.key:'documentRejected',params:{},raw:error instanceof UiError?undefined:error instanceof Error?error.message:String(error)});}
}
function download(name:string,text:string,type:string):void {
  const url=URL.createObjectURL(new Blob([text],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.addEventListener('click',event=>{
  const target=event.target as Element;
  const languageButton=target.closest<HTMLButtonElement>('[data-language]');
  if(languageButton){switchLanguage(languageButton.dataset.language as Language);return;}
  const example=target.closest<HTMLElement>('[data-example]');if(example){state=createLab(example.dataset.example);recompute();return;}
  const comp=target.closest<HTMLElement>('[data-component], [data-schematic-component]');
  if(comp){state.selectedComponent=comp.dataset.component??comp.dataset.schematicComponent??null;if(analysis)renderAll();else recompute();return;}
  const button=target.closest<HTMLButtonElement>('button');
  if(button?.id==='reset-example'){state=resetExample(state);recompute();}
  if(button?.id==='apply-json'){
    if(jsonDirty&&jsonBase!==exportNative(state)){renderJsonIssue();return;}
    const result=importNative(state,jsonEditor().value);
    if(!result.ok){jsonDirty=true;jsonIssue={kind:'document',code:result.errorCode??'invalid-document',params:result.errorParams??{},raw:result.error};renderJsonIssue();return;}
    jsonIssue=null;jsonDirty=false;recompute();return;
  }
  if(button?.id==='restore-json'){jsonIssue=null;syncJsonEditor(true);return;}
  if(button?.id==='export-json')download('circuits-unfolded.json',exportNative(state),'application/json');
  if(button?.id==='export-frequency'&&analysis)download('circuits-frequency.csv',csvFor(analysis,state,'frequency'),'text/csv');
  if(button?.id==='export-transient'&&analysis)download('circuits-transient.csv',csvFor(analysis,state,'transient'),'text/csv');
});
document.addEventListener('keydown',event=>{
  if(event.key!=='Enter'&&event.key!==' ')return;
  const node=(event.target as Element).closest<HTMLElement>('[data-schematic-component]');
  if(node){event.preventDefault();state.selectedComponent=node.dataset.schematicComponent??null;if(analysis)renderAll();else recompute();}
});
jsonEditor().addEventListener('input',()=>{jsonDirty=true;jsonIssue=null;renderJsonIssue();});
document.addEventListener('change',async event=>{
  const target=event.target;
  if(target instanceof HTMLInputElement&&target.id==='import-file'){
    const file=target.files?.[0];if(!file)return;
    try{
      const result=importNative(state,await file.text());
      if(!result.ok){importReadFailed=false;importIssue={kind:'document',code:result.errorCode??'invalid-document',params:result.errorParams??{},raw:result.error};renderImportIssue();return;}
      importIssue=null;renderImportIssue();recompute();
    }catch(error){importReadFailed=true;importIssue={kind:'document',code:'invalid-document',params:{},raw:error instanceof Error?error.message:String(error)};renderImportIssue();}
    finally { target.value=''; }
    return;
  }
  if(target instanceof HTMLInputElement||target instanceof HTMLSelectElement)edited(target);
});
renderStatic();
recompute();
