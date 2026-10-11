import { assemble, complex, currentRow, inputValues, outputValue, type Assembly, type AnalysisResult } from '../src/index.js';
import { createLab, exportNative, importNative, updateDocument, } from './lab.js';
import { presets } from './presets.js';
import { escapeHtml, schematic } from './schematic.js';
import { plot } from './plot.js';
import { algebraicSummary, statusSummary, validationSummary } from './diagnostics.js';
import { language, persistLanguage, readLanguage, setLanguage, t, translate, type Language, type TranslationKey } from './i18n.js';
import { BuilderUI } from './builder-ui.js';
import { OnePortUI } from './one-port-ui.js';
import { addPanel, createWorkspace, editPanelNumber, editPanelSelection, movePanel, PanelCalculator,
  panelCsv, reconcilePanels, removePanel, suggestedLayout, type PanelConfig, type PanelResult,
  type PanelType, type WorkspaceView, type NumericPanelField } from './workspace.js';
import type { Component, SourceValue, Waveform } from '../src/model.js';

const byId = (id: string): HTMLElement => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing interface element ${id}`);
  return element;
};
const e = (value: string | number): string => escapeHtml(String(value));
const fmt = (value: number, digits = 5): string => !Number.isFinite(value) ? String(value) : value === 0 ? '0' :
  Math.abs(value) < .001 || Math.abs(value) >= 1e5 ? value.toExponential(4) : Number(value.toPrecision(digits)).toString();
let storage: Storage | undefined;
try { storage = window.localStorage; } catch { /* Storage can be unavailable. */ }
setLanguage(readLanguage(navigator.languages?.length ? navigator.languages : [navigator.language], storage));
let state = createLab();
const workspace = createWorkspace(state);
const calculator = new PanelCalculator();
let previousView: Exclude<WorkspaceView, 'editor'> = 'analyze';
let jsonDirty = false;
let jsonBase = exportNative(state);
let jsonIssue: string | null = null;
let importIssue: string | null = null;
let sourceOpen = false;
let inspectorContribOpen = false;
const inputDrafts = new Map<string, string>();
const inputIssues = new Map<string, TranslationKey>();
const builderUI = new BuilderUI(byId('builder-editor'), () => state, () => validatedChange());
const onePortUI = new OnePortUI(byId('one-port'), () => state);
const panelTypes: PanelType[] = ['dc', 'frequency', 'transient', 'equations', 'port'];
const panelKeys: Record<PanelType, TranslationKey> = { dc: 'panelDc', frequency: 'panelFrequency', transient: 'panelTransient', equations: 'panelEquations', port: 'panelPort' };
const sourceUnit = (id: string): 'V' | 'A' => state.document.circuit.components.find(c => c.id === id)?.type === 'I' ? 'A' : 'V';
const componentUnit = (c: Component): string => c.type === 'R' || c.type === 'CCVS' ? 'Ω' : c.type === 'C' ? 'F' : c.type === 'L' ? 'H' : c.type === 'VCCS' ? 'S' : '';
const nativeJson = (): HTMLTextAreaElement => byId('json-editor') as HTMLTextAreaElement;
function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function renderStatic(): void {
  document.documentElement.lang = language(); document.title = t('pageTitle');
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', t('pageDescription'));
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(node => { node.textContent = translate(node.dataset.i18n as TranslationKey); });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach(node => node.setAttribute('aria-label', translate(node.dataset.i18nAria as TranslationKey)));
  document.querySelectorAll<HTMLButtonElement>('[data-language]').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.language === language())));
}
function renderJson(): void {
  if (!jsonDirty) { nativeJson().value = exportNative(state); jsonBase = exportNative(state); }
  const conflict = jsonDirty && jsonBase !== exportNative(state);
  nativeJson().setAttribute('aria-invalid', String(conflict || !!jsonIssue));
  byId('json-error').textContent = conflict ? t('jsonConflict') : jsonIssue ? t('jsonRejected', { reason: jsonIssue }) : '';
}
function renderView(): void {
  for (const name of ['analyze', 'transform', 'editor'] as const) byId(`${name}-view`).hidden = workspace.view !== name;
  byId('workspace-nav').hidden = workspace.view === 'editor';
  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-view]'))) {
    button.setAttribute('aria-current', String(button.dataset.view === workspace.view));
  }
  byId('form-editor-view').hidden = workspace.editorView !== 'form';
  byId('json-editor-view').hidden = workspace.editorView !== 'json';
  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-editor-view]'))) button.setAttribute('aria-pressed', String(button.dataset.editorView === workspace.editorView));
  if (workspace.view === 'editor') { builderUI.render(); renderJson(); }
  if (workspace.view === 'transform') onePortUI.render();
}
function renderCircuitChoice(): void {
  const select = byId('circuit-select') as HTMLSelectElement;
  const group = (label: TranslationKey, ids: string[]) => `<optgroup label="${translate(label)}">${presets.filter(p=>ids.includes(p.id)).map(p=>`<option value="${e(p.id)}"${state.presetId === p.id ? ' selected' : ''}>${translate(p.titleKey)}</option>`).join('')}</optgroup>`;
  select.innerHTML = `${!state.presetId ? `<option value="custom" selected>${t('circuitCustom')} · ${e(state.document.circuit.label ?? '')}</option>` : ''}${group('presetGroupBasics',['divider'])}${group('presetGroupDynamic',['rc','rc-high-pass','rc-loaded','rc-cascade','rl','rlc'])}${group('presetGroupActive',['vcvs'])}`;
  const preset = presets.find(p => p.id === state.presetId);
  const modified = preset && JSON.stringify(state.document) !== JSON.stringify(preset.document);
  byId('circuit-status').textContent = state.presetId ? t(modified ? 'circuitModified' : 'circuitPreset') : t('circuitCustom');
  byId('circuit-description').textContent = preset ? translate(preset.subtitleKey) : state.document.circuit.label ?? '';
  (byId('reset-example') as HTMLButtonElement).disabled = !state.presetId;
}
function field(label: string, kind: string, id: string, value: string | number, unit = '', positive = false): string {
  const key = `${kind}:${id}`, issue = inputIssues.get(key);
  const shown = inputDrafts.get(key) ?? String(value);
  return `<div class="field"><label for="${e(key)}">${e(label)}${unit ? ` <span class="unit-note">(${e(unit)})</span>` : ''}</label><input id="${e(key)}" data-kind="${e(kind)}" data-id="${e(id)}" data-positive="${positive ? '1' : '0'}" type="text" inputmode="decimal" value="${e(shown)}" aria-invalid="${!!issue}"><small class="field-error" aria-live="polite">${issue ? e(translate(issue, { field: label })) : ''}</small></div>`;
}
function selectField(label: string, kind: string, id: string, options: { value: string; label: string }[], selected: string): string {
  const key = `${kind}:${id}`;
  return `<div class="field"><label for="${e(key)}">${e(label)}</label><select id="${e(key)}" data-kind="${e(kind)}" data-id="${e(id)}">${options.map(o => `<option value="${e(o.value)}"${o.value === selected ? ' selected' : ''}>${e(o.label)}</option>`).join('')}</select></div>`;
}
function waveformFields(s: SourceValue): string {
  const w = s.waveform;
  if (w?.type === 'step') return `<div class="field-row three">${field(t('at'),'waveform.at',s.id,w.at,'s')}${field(t('before'),'waveform.before',s.id,w.before,sourceUnit(s.id))}${field(t('after'),'waveform.after',s.id,w.after,sourceUnit(s.id))}</div>`;
  if (w?.type === 'sinusoid') return `<div class="field-row">${field(t('offset'),'waveform.offset',s.id,w.offset,sourceUnit(s.id))}${field(t('peakAmplitude'),'waveform.amplitudePeak',s.id,w.amplitudePeak,sourceUnit(s.id))}${field(t('frequency'),'waveform.frequencyHz',s.id,w.frequencyHz,'Hz')}${field(t('phase'),'waveform.phaseRadians',s.id,w.phaseRadians,'rad')}</div><p class="muted small">${t('peakVsRms')}</p>`;
  return `${field(t('timeValue'),'waveform.value',s.id,w?.type === 'constant' ? w.value : s.dc,sourceUnit(s.id))}<p class="muted small">${t('timeSeparate')}</p>`;
}
function renderSources(): void {
  const blocks = state.document.experiment.sources.map(s => `<div class="source-block"><h3>${e(t('sourceHeading',{id:s.id,unit:sourceUnit(s.id)}))}</h3><div class="field-row three">${field(t('dcValue'),'source.dc',s.id,s.dc,sourceUnit(s.id))}${field(t('acReal'),'source.ac.re',s.id,s.ac?.re ?? 0,`${sourceUnit(s.id)} RMS`)}${field(t('acImaginary'),'source.ac.im',s.id,s.ac?.im ?? 0,`${sourceUnit(s.id)} RMS`)}</div>${selectField(t('transientWaveform'),'waveform.type',s.id,[{value:'constant',label:t('constant')},{value:'step',label:t('scheduledStep')},{value:'sinusoid',label:t('sinusoid')}],s.waveform?.type ?? 'constant')}${waveformFields(s)}</div>`).join('');
  const initial = state.document.experiment.initial;
  const stored = state.document.circuit.components.filter(c => c.type === 'C' || c.type === 'L');
  const values = initial.kind === 'storage' ? stored.map(c => field(t(c.type === 'C' ? 'storageVoltage' : 'storageCurrent',{id:c.id}),'initial.value',c.id,initial.values.find(v => v.id === c.id)?.value ?? 0,c.type === 'C' ? 'V' : 'A')).join('') : '';
  byId('source-editor').innerHTML = `${blocks || `<p class="muted small">${t('noSource')}</p>`}<div class="subheading">${t('initialization')}</div>${selectField(t('policy'),'initial.kind','policy',[{value:'equilibrium',label:t('equilibriumBefore')},{value:'storage',label:t('specifiedStorage')}],initial.kind)}${values}<p class="muted small">${t('storageHint')}</p>`;
}
function renderInspector(): void {
  const c = state.document.circuit.components;
  byId('component-list').innerHTML = `<div class="component-list">${c.map(d => `<button type="button" class="component-pill${state.selectedComponent === d.id ? ' active' : ''}" data-component="${e(d.id)}" aria-pressed="${state.selectedComponent === d.id}">${e(d.id)} <span class="muted">${e(d.type)}</span></button>`).join('')}</div>`;
  const selected = c.find(d => d.id === state.selectedComponent);
  if (!selected) { byId('component-editor').innerHTML = `<p class="muted small">${t('inspectHint')}</p>`; return; }
  const assembly = assemble(state.document.circuit);
  const contributions = assembly.contributions.filter(x => x.component === selected.id);
  const param = 'value' in selected ? field(t('value'),'component',selected.id,selected.value,componentUnit(selected),true) :
    'gain' in selected ? field(t('gain'),'component',selected.id,selected.gain,componentUnit(selected)) : `<p class="muted small">${t('sourceEditorHint')}</p>`;
  byId('component-editor').innerHTML = `<div class="editor-card"><p class="editor-title">${e(selected.id)} · ${e(selected.type)}</p><p class="terminal-note">${e(t('orderedTerminals',{p:selected.p,n:selected.n}))}</p>${param}<div class="subheading">${t('kernelTerminalLaw')}</div><div class="law-box">${contributions.length ? e([...new Set(contributions.map(x => x.law))].join(' · ')) : t('noContribution')}</div><button type="button" id="view-contributions" class="button quiet" aria-expanded="${inspectorContribOpen}" aria-controls="inspector-contributions">${t('viewContributions')}</button><div id="inspector-contributions" ${inspectorContribOpen?'':'hidden'}>${contributions.length ? `<div class="table-wrap"><table class="result-table"><thead><tr><th>${t('matrix')}</th><th>${t('row')}</th><th>${t('column')}</th><th>${t('value')}</th></tr></thead><tbody>${contributions.map(c=>`<tr><td>${c.matrix}</td><td>${e(c.row)}</td><td>${e(c.column)}</td><td>${fmt(c.value)} ${e(c.units)}</td></tr>`).join('')}</tbody></table></div>`:t('noContribution')}</div></div>`;
}
function renderSchematic(): void {
  const view = schematic(state); byId('schematic').innerHTML = view.html;
  byId('schematic-note').textContent = view.note;
  byId('schematic-badge').textContent = view.schematic ? t('layout',{id:state.presetId ?? ''}) : t('topologyTable');
}
function table(items: { label:string; value:number; unit:string }[]): string {
  return `<div class="table-wrap"><table class="result-table"><thead><tr><th>${t('quantity')}</th><th>${t('selectedValue')}</th></tr></thead><tbody>${items.map(item => `<tr><td>${e(item.label)}</td><td>${fmt(item.value)} ${e(item.unit)}</td></tr>`).join('')}</tbody></table></div>`;
}
function dcContent(assembly: Assembly, dc: AnalysisResult): string {
  if (dc.status !== 'ok') return `<div class="warning" role="status">${statusSummary(dc.status)}</div>`;
  const nodes = assembly.unknowns.filter(x => x.id.startsWith('V(')).map(x => ({label:x.id,value:dc.unknowns[x.id]!.value.re,unit:'V'}));
  const u = inputValues(assembly,state.document.experiment,'dc');
  const caps = new Map(state.document.circuit.components.filter(c => c.type === 'C').map(c => [c.id,complex(0)]));
  const branches = state.document.circuit.components.map(c => ({label:`I(${c.id})`,value:outputValue(currentRow(assembly,c),dc.x,u,caps).re,unit:'A'}));
  const max = Math.max(0,...dc.residuals.map(r => r.absolute),dc.groundKcl.absolute);
  return `<div class="two-col"><div><div class="subheading">${t('nodeVoltages')}</div>${table(nodes)}</div><div><div class="subheading">${t('signedBranchCurrents')}</div>${table(branches)}</div></div><details class="explanation"><summary>${t('panelExplanation')}</summary><p class="analysis-note">${t('residualSummary',{value:fmt(max),scaled:fmt(dc.diagnostics.scaledBackwardResidual)})}</p></details>`;
}
function frequencyContent(panel: PanelConfig, result: Extract<PanelResult,{type:'frequency'}>): string {
  const dim = result.unit === 'V/V' || result.unit === 'A/A';
  const mag = result.sweep.map(p => ({x:p.frequencyHz,y:dim ? p.magnitudeDb : p.magnitude,status:!dim && p.status === 'zero-magnitude' ? 'ok' : p.status}));
  const phase = result.sweep.map(p => ({x:p.frequencyHz,y:p.phaseDegrees,status:p.status}));
  const failed = result.sweep.filter(p => p.status !== 'ok' && p.status !== 'zero-magnitude');
  const zero = result.sweep.filter(p => p.status === 'zero-magnitude');
  const acInputs = state.document.experiment.sources.map(s => `${s.id}=${fmt(s.ac?.re ?? 0)}${(s.ac?.im ?? 0) < 0 ? '' : '+'}${fmt(s.ac?.im ?? 0)}j ${sourceUnit(s.id)} RMS`).join('; ');
  const ac = result.ac, observation = ac.status === 'ok' ? ac.observations[panel.output] : undefined;
  const acText = observation ? `${fmt(observation.value.re)}${observation.value.im < 0 ? '' : '+'}${fmt(observation.value.im)}j ${observation.unit} RMS` : statusSummary(ac.status);
  const alg = result.algebraic.status === 'ok' ? `<strong>${t('algebraicTitle')}</strong> · ${e(t('algebraicFormula',{n0:fmt(result.algebraic.numerator[0]),n1:fmt(result.algebraic.numerator[1]),d0:fmt(result.algebraic.denominator[0]),d1:fmt(result.algebraic.denominator[1]),unit:result.unit,root:fmt(result.algebraic.denominatorRoot)}))}` :
    e(t('algebraicUnavailable',{reason:algebraicSummary(result.algebraic.reason)}));
  return `<p class="analysis-note">${e(t('transferIntro',{input:panel.input,output:panel.output,unit:result.unit}))}</p><div class="plot-grid">${plot(mag,{title:t('magnitude'),xLabel:t('frequencyAxis'),yLabel:t('magnitudeWithUnit',{unit:dim ? 'dB' : result.unit}),xLog:true})}${plot(phase,{title:t('phase'),xLabel:t('frequencyAxis'),yLabel:t('phaseWithUnit'),xLog:true,color:'orange'})}</div>${failed.length ? `<p class="warning">${t('failedFrequency',{count:failed.length,reason:statusSummary(failed[0]!.status)})}</p>` : ''}${zero.length ? `<p class="warning">${t('zeroFrequency',{count:zero.length})}</p>` : ''}<details class="explanation"><summary>${t('panelExplanation')}</summary><p>${e(t('acSummary',{frequency:fmt(panel.inspectHz),sources:acInputs || t('noSourcesShort'),output:acText}))}</p><p class="soft-note">${alg}</p></details>`;
}
function transientContent(panel: PanelConfig, result: Extract<PanelResult,{type:'transient'}>): string {
  const time = result.time, output = result.assembly.outputs.find(o => o.id === panel.output)!;
  const stateless = result.assembly.storage.length === 0;
  const samples = time.samples.map(s => ({x:s.time,y:s.observations[panel.output]?.value.re ?? null,status:'ok'}));
  if (time.status !== 'ok') samples.push({x:time.time,y:null,status:time.status});
  return `<p class="analysis-note">${e(t(stateless ? 'statelessSummary' : 'transientSummary',{step:fmt(panel.step),duration:fmt(panel.duration),output:panel.output,unit:output.unit}))}</p>${plot(samples,{title:t('transientPlot',{output:panel.output}),xLabel:t('timeAxis'),yLabel:t('outputAxis',{output:panel.output,unit:output.unit})})}<details class="explanation"><summary>${t('panelExplanation')}</summary><p>${time.status === 'ok' ? t(stateless ? 'statelessDetails' : 'transientDetails',{count:time.samples.length,policy:time.initialization.kind === 'storage' ? t('specifiedStorage') : t('equilibriumBefore')}) : t('transientFailure',{status:statusSummary(time.status),time:fmt(time.time)})}</p></details>`;
}
function matrix(name:'E'|'K'|'B',a:Assembly):string {
  const cols = name === 'B' ? a.inputs : a.unknowns;
  const marked = new Set(a.contributions.filter(c => c.component === state.selectedComponent && c.matrix === name).map(c => `${c.rowIndex}:${c.columnIndex}`));
  return `<div><h4>${name}</h4><div class="table-wrap"><table class="matrix-table"><thead><tr><th>${t('rowColumn')}</th>${cols.map(c => `<th>${e(c.id)} (${c.unit})</th>`).join('')}</tr></thead><tbody>${a[name].map((row,i) => `<tr><th>${e(a.rows[i]!.id)} (${a.rows[i]!.unit})</th>${row.map((v,j) => `<td class="${marked.has(`${i}:${j}`) ? 'highlight' : ''}">${fmt(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}
function equationContent(panel:PanelConfig,result:Extract<PanelResult,{type:'equations'}>):string {
  const a = result.assembly, output = a.outputs.find(o => o.id === panel.output);
  const relation = !output ? '' : output.kind === 'fixed' ? `${panel.output} = Cₒ·x + Dₒ·u; Cₒ=[${output.C.map(v => fmt(v)).join(', ')}], Dₒ=[${output.D.map(v => fmt(v)).join(', ')}]` : `${panel.output} = Q·ẋ; Q=[${output.Q.map(v => fmt(v)).join(', ')}]`;
  const contributions = a.contributions.filter(c => c.component === state.selectedComponent);
  return `<p class="equation-line">E·ẋ + K·x = B·u</p><p class="soft-note">${e(t('outputRelation',{relation}))}</p><div class="matrix-grid">${matrix('E',a)}${matrix('K',a)}${matrix('B',a)}</div><details class="explanation"><summary>${t('panelExplanation')}</summary><div class="subheading">${t('selectedProvenance')}</div>${contributions.length ? `<div class="table-wrap"><table class="result-table"><thead><tr><th>${t('matrix')}</th><th>${t('row')}</th><th>${t('column')}</th><th>${t('terminalLaw')}</th></tr></thead><tbody>${contributions.map(c => `<tr><td>${c.matrix}</td><td>${e(c.row)}</td><td>${e(c.column)}</td><td>${e(c.law)}</td></tr>`).join('')}</tbody></table></div>` : `<p>${t('provenanceHint')}</p>`}<p>${result.dc.status === 'ok' ? t('diagnosticSummary',{residual:fmt(result.dc.diagnostics.scaledBackwardResidual),pivot:fmt(result.dc.diagnostics.pivotRatio)}) : statusSummary(result.dc.status)}</p></details>`;
}
function portContent(panel: PanelConfig, result: Extract<PanelResult,{type:'port'}>): string {
  const port = result.port;
  const keys: Record<string, TranslationKey> = {'invalid-port':'onePortInvalidPort','invalid-load':'onePortInvalidLoad','unsupported-device':'onePortUnsupported','solver-failure':'onePortSolverFailure','zero-resistance':'onePortZeroResistance','negative-resistance':'onePortNegativeResistance',nonfinite:'onePortNonfinite'};
  if (port.status !== 'ok') return `<div class="warning" role="status">${translate(keys[port.status]!)}</div><button type="button" class="button quiet" data-panel-action="open-comparison" data-panel-id="${panel.id}">${t('openComparison')}</button>`;
  return `<div class="metric-grid"><div class="metric"><div class="metric-label">Vth</div><div class="metric-value">${fmt(port.vth)} V</div></div><div class="metric"><div class="metric-label">Rth</div><div class="metric-value">${fmt(port.rth)} Ω</div></div><div class="metric"><div class="metric-label">IN</div><div class="metric-value">${fmt(port.inorton)} A</div></div></div><p class="analysis-note">VL = ${fmt(port.original.voltage)} V · IL = ${fmt(port.original.current)} A</p><button type="button" class="button quiet" data-panel-action="open-comparison" data-panel-id="${panel.id}">${t('openComparison')}</button><details class="explanation"><summary>${t('panelExplanation')}</summary><p>${t('onePortConvention')}</p><p>${t('onePortSuppression',{sources:state.document.experiment.sources.map(s=>s.id).join(', ')||t('noSourcesShort'),controlled:state.document.circuit.components.filter(c=>['VCVS','VCCS','CCVS','CCCS'].includes(c.type)).map(c=>c.id).join(', ')||t('noSourcesShort')})}</p></details>`;
}
function panelField(panel: PanelConfig, field: NumericPanelField, label: string, unit = ''): string {
  const shown = panel.pending[field] ?? String(panel[field]);
  return `<div class="field"><label for="${panel.id}-${field}">${e(label)}${unit ? ` <span class="unit-note">(${e(unit)})</span>` : ''}</label><input id="${panel.id}-${field}" data-panel-id="${panel.id}" data-panel-field="${field}" type="text" inputmode="decimal" value="${e(shown)}" aria-invalid="${!!panel.errors[field]}"><small class="field-error">${panel.errors[field] ? e(translate(panel.errors[field] as TranslationKey,{field:label})) : ''}</small></div>`;
}
function panelSelect(panel: PanelConfig, field: 'input'|'output'|'p'|'q', label: string, options: {value:string;label:string}[]): string {
  const current = panel[field];
  return `<div class="field"><label for="${panel.id}-${field}">${e(label)}</label><select id="${panel.id}-${field}" data-panel-id="${panel.id}" data-panel-field="${field}">${!options.some(o=>o.value===current) ? `<option value="" selected>${t('panelSelectionNeeded',{field:label})}</option>` : ''}${options.map(o=>`<option value="${e(o.value)}"${o.value===current?' selected':''}>${e(o.label)}</option>`).join('')}</select></div>`;
}
function panelSettings(panel: PanelConfig): string {
  const outputs = state.document.circuit.observations.map(o=>({value:o.id,label:o.id}));
  const inputs = state.document.experiment.sources.map(s=>({value:s.id,label:s.id}));
  const nodes = state.document.circuit.nodes.map(n=>({value:n,label:n}));
  if (panel.type==='frequency') return `${panelSelect(panel,'input',t('independentInput'),inputs)}${panelSelect(panel,'output',t('measuredOutput'),outputs)}<div class="controls-grid">${panelField(panel,'minHz',t('minimum'),'Hz')}${panelField(panel,'maxHz',t('maximum'),'Hz')}${panelField(panel,'points',t('samples'))}${panelField(panel,'inspectHz',t('acInspectFrequency'),'Hz')}</div>`;
  if (panel.type==='transient') return `${panelSelect(panel,'output',t('measuredOutput'),outputs)}<div class="controls-grid">${panelField(panel,'duration',t('duration'),'s')}${panelField(panel,'step',t('timeStep'),'s')}</div>`;
  if (panel.type==='port') return `<div class="controls-grid">${panelSelect(panel,'p',t('onePortPositive'),nodes)}${panelSelect(panel,'q',t('onePortNegative'),nodes)}${panelField(panel,'load',t('onePortLoad'),'Ω')}</div>`;
  if (panel.type==='equations') return panelSelect(panel,'output',t('measuredOutput'),outputs);
  return `<p class="muted small">${t('panelSummaryDc')}</p>`;
}
function panelSummary(panel: PanelConfig): string {
  if(panel.type==='frequency') return t('panelSummaryFrequency',{input:panel.input,output:panel.output,min:fmt(panel.minHz),max:fmt(panel.maxHz),points:panel.points});
  if(panel.type==='transient') return t('panelSummaryTransient',{output:panel.output,duration:fmt(panel.duration),step:fmt(panel.step)});
  if(panel.type==='port') return t('panelSummaryPort',{p:panel.p,q:panel.q,load:fmt(panel.load)});
  if(panel.type==='equations') return t('panelSummaryEquations',{output:panel.output});
  return t('panelSummaryDc');
}
function renderPanel(panel: PanelConfig, index: number): string {
  let content = '';
  if (!panel.collapsed) {
    const result = calculator.calculate(panel,state);
    content = panel.selectionNeeded ? `<p class="warning" role="status">${t('panelSelectionNeeded',{field:t(panel.selectionNeeded==='input'?'independentInput':panel.selectionNeeded==='output'?'measuredOutput':'onePortPositive')})}</p>` : !result ? `<p class="warning">${t('resultNeedsValid')}</p>` :
      result.type==='dc' ? dcContent(result.assembly,result.dc) :
      result.type==='frequency' ? frequencyContent(panel,result) :
      result.type==='transient' ? transientContent(panel,result) :
      result.type==='equations' ? equationContent(panel,result) : portContent(panel,result);
  }
  const error = Object.keys(panel.errors).length ? `<p class="warning" role="status">${t('panelLastValid')}</p>` : '';
  const controls = (action:string,key:TranslationKey,symbol:string,disabled=false) => `<button type="button" class="panel-icon" data-panel-action="${action}" data-panel-id="${panel.id}" aria-label="${translate(key)}" title="${translate(key)}" ${disabled?'disabled':''}>${symbol}</button>`;
  return `<section class="panel analysis-panel ${panel.expanded?'expanded':''}" data-panel="${panel.id}" aria-label="${translate(panelKeys[panel.type])}"><div class="panel-head"><div class="panel-heading"><label for="${panel.id}-type">${t('panelType')}</label><select id="${panel.id}-type" data-panel-id="${panel.id}" data-panel-field="type">${panelTypes.map(type=>`<option value="${type}"${type===panel.type?' selected':''}>${translate(panelKeys[type])}</option>`).join('')}</select></div><div class="panel-tools">${controls('up','panelUp','↑',index===0)}${controls('down','panelDown','↓',index===workspace.panels.length-1)}${controls('wide',panel.expanded?'panelNormal':'panelFull','⤢')}${controls('collapse',panel.collapsed?'panelExpand':'panelCollapse',panel.collapsed?'▾':'▴')}${controls('remove','panelRemove','×')}</div></div><p class="panel-summary">${e(panelSummary(panel))}</p>${panel.collapsed ? '' : `<details class="panel-settings" data-panel-settings="${panel.id}" ${panel.settingsOpen||panel.selectionNeeded?'open':''}><summary>${t('panelSettings')}</summary>${panelSettings(panel)}</details>${error}<div class="panel-result">${content}</div>${['frequency','transient'].includes(panel.type)&&!panel.selectionNeeded ? `<button type="button" class="button quiet panel-export" data-panel-action="export" data-panel-id="${panel.id}">${t('exportCsv')}</button>` : ''}`}</section>`;
}
function renderPanels(): void {
  const grid=byId('analysis-grid');
  grid.innerHTML=workspace.panels.length?workspace.panels.map(renderPanel).join(''):`<div class="panel"><p>${t('panelEmpty')}</p></div>`;
  const add=byId('add-analysis') as HTMLButtonElement;
  add.disabled=workspace.panels.length>=3; add.title=add.disabled?t('addLimit'):'';
  byId('analysis-limit').textContent=add.disabled?t('addLimit'):'';
}
function renderAll(): void {
  renderStatic(); renderCircuitChoice(); renderView(); renderSchematic(); renderInspector(); renderSources();
  (byId('sources-details') as HTMLDetailsElement).open = sourceOpen;
  if (workspace.view==='analyze') renderPanels();
  if (workspace.view!=='editor') renderJson();
  byId('import-error').textContent=importIssue?t('importRejected',{reason:importIssue}):'';
}
function validatedChange(): void {
  const focused = (document.activeElement as HTMLElement | null)?.id;
  inputDrafts.clear(); inputIssues.clear(); reconcilePanels(workspace,state); renderAll();
  if (focused) document.getElementById(focused)?.focus({preventScroll:true});
}
function openView(view: WorkspaceView): void {
  if (workspace.view!=='editor') previousView=workspace.view;
  workspace.view=view; renderAll();
  const target = view==='editor' ? byId('return-workspace') : view==='analyze' ? byId('schematic-title') : byId('transform-method');
  target.setAttribute('tabindex','-1'); target.focus({preventScroll:true});
}
function editField(target: HTMLInputElement | HTMLSelectElement): void {
  const kind=target.dataset.kind,id=target.dataset.id??'',key=`${kind}:${id}`;
  if(!kind)return;
  let value=Number(target.value);
  if(target instanceof HTMLInputElement && (!target.value.trim()||!Number.isFinite(value)||(target.dataset.positive==='1'&&value<=0))){
    inputDrafts.set(key,target.value);inputIssues.set(key,!target.value.trim()?'requiredField':!Number.isFinite(value)?'finiteField':'positiveField');renderAll();return;
  }
  if(kind==='waveform.type'||kind==='initial.kind'){
    const result=updateDocument(state,d=>{
      if(kind==='initial.kind'){
        if(target.value==='equilibrium')d.experiment.initial={kind:'equilibrium'};
        else if(target.value==='storage'){
          const prior=d.experiment.initial;
          d.experiment.initial={kind:'storage',values:d.circuit.components.filter(c=>c.type==='C'||c.type==='L').map(c=>({id:c.id,value:prior.kind==='storage'?prior.values.find(v=>v.id===c.id)?.value??0:0}))};
        }
      } else {
        const s=d.experiment.sources.find(s=>s.id===id)!;
        if(target.value==='constant')s.waveform={type:'constant',value:s.dc};
        else if(target.value==='step')s.waveform={type:'step',at:0,before:0,after:s.dc};
        else if(target.value==='sinusoid')s.waveform={type:'sinusoid',offset:0,amplitudePeak:Math.abs(s.dc),frequencyHz:100,phaseRadians:0};
      }
    });
    if(!result.ok){inputIssues.set(key,'documentRejected');inputDrafts.set(key,target.value);renderAll();return;}
    validatedChange();return;
  }
  const result=updateDocument(state,d=>{
    if(kind==='component'){
      const c=d.circuit.components.find(c=>c.id===id);if(!c)throw new Error('Unknown component');
      if('value' in c)c.value=value;else if('gain' in c)c.gain=value;
    } else if(kind==='source.dc'||kind==='source.ac.re'||kind==='source.ac.im'){
      const s=d.experiment.sources.find(s=>s.id===id)!;
      if(kind==='source.dc')s.dc=value;
      else{s.ac??={re:0,im:0};if(kind.endsWith('.re'))s.ac.re=value;else s.ac.im=value;}
    } else if(kind.startsWith('waveform.')){
      const s=d.experiment.sources.find(s=>s.id===id)!;
      if(kind==='waveform.value'&&!s.waveform)s.waveform={type:'constant',value};
      if(!s.waveform)throw new Error('Choose waveform');
      const field=kind.slice('waveform.'.length) as keyof Waveform;
      if(!(field in s.waveform))throw new Error('Waveform field mismatch');
      Object.assign(s.waveform,{[field]:value});
    } else if(kind==='initial.value'){
      const initial=d.experiment.initial;if(initial.kind!=='storage')throw new Error('Choose storage');
      initial.values.find(v=>v.id===id)!.value=value;
    }
  });
  if(!result.ok){inputIssues.set(key,'documentRejected');inputDrafts.set(key,target.value);renderAll();return;}
  validatedChange();
}
document.addEventListener('input',event=>{
  const target=event.target;
  if(target instanceof HTMLTextAreaElement&&target.id==='json-editor'){jsonDirty=true;jsonIssue=null;renderJson();return;}
  if(target instanceof HTMLInputElement&&target.dataset.panelField){
    const panel=workspace.panels.find(p=>p.id===target.dataset.panelId);
    if(panel)panel.pending[target.dataset.panelField]=target.value;
    return;
  }
  if(target instanceof HTMLInputElement&&target.dataset.kind)inputDrafts.set(`${target.dataset.kind}:${target.dataset.id??''}`,target.value);
});
document.addEventListener('toggle',event=>{
  const target=event.target;
  if(target instanceof HTMLDetailsElement&&target.id==='sources-details')sourceOpen=target.open;
  if(target instanceof HTMLDetailsElement&&target.dataset.panelSettings){
    const panel=workspace.panels.find(p=>p.id===target.dataset.panelSettings);if(panel)panel.settingsOpen=target.open;
  }
},true);
document.addEventListener('change',async event=>{
  const target=event.target;
  if(target instanceof HTMLInputElement&&target.id==='import-file'){
    const file=target.files?.[0];if(!file)return;
    try{const result=importNative(state,await file.text());if(!result.ok){importIssue=validationSummary(result.errorCode??'invalid-document',result.errorParams??{});renderAll();return;}importIssue=null;validatedChange();}
    catch{importIssue=t('importFailed',{reason:t('invalidJson')});renderAll();}
    finally{target.value='';}return;
  }
  if(target instanceof HTMLSelectElement&&target.id==='circuit-select'){
    if(target.value==='custom')return;
    const wasSuggested=workspace.layoutIsSuggested&&workspace.panels.every(p=>!Object.keys(p.pending).length);
    state=createLab(target.value);
    if(wasSuggested)suggestedLayout(workspace,state);
    validatedChange();return;
  }
  if((target instanceof HTMLInputElement||target instanceof HTMLSelectElement)&&target.dataset.panelField){
    const panel=workspace.panels.find(p=>p.id===target.dataset.panelId);if(!panel)return;
    const field=target.dataset.panelField;
    if(field==='type'&&panelTypes.includes(target.value as PanelType)){
      panel.type=target.value as PanelType;panel.collapsed=false;panel.settingsOpen=false;panel.errors={};panel.pending={};
    } else if(field==='input'||field==='output'||field==='p'||field==='q')editPanelSelection(panel,field,target.value,state);
    else editPanelNumber(panel,state,field as NumericPanelField,target.value);
    workspace.layoutIsSuggested=false;renderPanels();return;
  }
  if((target instanceof HTMLInputElement||target instanceof HTMLSelectElement)&&target.dataset.kind)editField(target);
});
document.addEventListener('click',event=>{
  const target=event.target;if(!(target instanceof Element))return;
  const lang=target.closest<HTMLButtonElement>('[data-language]');
  if(lang){const focus=(document.activeElement as HTMLElement|null)?.id;setLanguage(lang.dataset.language as Language);persistLanguage(language(),storage);renderAll();if(focus)document.getElementById(focus)?.focus({preventScroll:true});return;}
  const view=target.closest<HTMLButtonElement>('[data-view]');if(view){openView(view.dataset.view as WorkspaceView);return;}
  const editorView=target.closest<HTMLButtonElement>('[data-editor-view]');if(editorView){workspace.editorView=editorView.dataset.editorView==='json'?'json':'form';renderView();return;}
  const comp=target.closest<HTMLElement>('[data-component],[data-schematic-component]');
  if(comp){state.selectedComponent=comp.dataset.component??comp.dataset.schematicComponent??null;inspectorContribOpen=false;renderInspector();renderSchematic();if(workspace.view==='analyze')renderPanels();return;}
  const panelButton=target.closest<HTMLButtonElement>('[data-panel-action]');
  if(panelButton){const panel=workspace.panels.find(p=>p.id===panelButton.dataset.panelId);if(!panel)return;
    const action=panelButton.dataset.panelAction;
    if(action==='open-comparison'){onePortUI.useSelection(panel.p,panel.q,panel.load);openView('transform');return;}
    if(action==='export'){const result=calculator.calculate(panel,state);if(result&&(result.type==='frequency'||result.type==='transient'))download(`circuits-${panel.type}-${panel.id}.csv`,panelCsv(panel,result),'text/csv');return;}
    if(action==='up')movePanel(workspace,panel.id,-1);
    else if(action==='down')movePanel(workspace,panel.id,1);
    else if(action==='remove')removePanel(workspace,panel.id);
    else if(action==='collapse')panel.collapsed=!panel.collapsed;
    else if(action==='wide')panel.expanded=!panel.expanded;
    workspace.layoutIsSuggested=false;renderPanels();return;
  }
  const button=target.closest<HTMLButtonElement>('button');if(!button)return;
  if(button.id==='about-button'){byId('about').hidden=!byId('about').hidden;return;}
  if(button.id==='edit-circuit'){openView('editor');return;}
  if(button.id==='new-circuit'){workspace.editorView='form';builderUI.startNew();openView('editor');return;}
  if(button.id==='reset-example'&&state.presetId){
    const wasSuggested=workspace.layoutIsSuggested&&workspace.panels.every(p=>!Object.keys(p.pending).length);
    state=createLab(state.presetId);if(wasSuggested)suggestedLayout(workspace,state);validatedChange();return;
  }
  if(button.id==='return-workspace'){openView(previousView);return;}
  if(button.id==='add-analysis'){if(addPanel(workspace,state)){workspace.layoutIsSuggested=false;renderPanels();}return;}
  if(button.id==='restore-layout'){suggestedLayout(workspace,state);renderPanels();return;}
  if(button.id==='view-contributions'){inspectorContribOpen=!inspectorContribOpen;renderInspector();byId('view-contributions').focus({preventScroll:true});return;}
  if(button.id==='apply-json'){
    if(jsonDirty&&jsonBase!==exportNative(state)){renderJson();return;}
    const result=importNative(state,nativeJson().value);
    if(!result.ok){jsonDirty=true;jsonIssue=validationSummary(result.errorCode??'invalid-document',result.errorParams??{});renderJson();return;}
    jsonDirty=false;jsonIssue=null;validatedChange();return;
  }
  if(button.id==='restore-json'){jsonDirty=false;jsonIssue=null;renderJson();return;}
  if(button.id==='export-json')download('circuits-unfolded.json',exportNative(state),'application/json');
});
renderAll();
