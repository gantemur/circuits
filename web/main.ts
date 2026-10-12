import { assemble, assembleDiodeSystem, complex, currentRow, inputValues, outputValue,
  type Assembly, type AnalysisResult } from '../src/index.js';
import { createLab, exportNative, importNative, updateDocument, } from './lab.js';
import { isNonlinearDocument } from './native-document.js';
import { dcSweepCsv, nonlinearUnknownCount } from './dc-sweep.js';
import { SweepLifecycle, sweepSignature } from './sweep-lifecycle.js';
import { currentDiodeContributions, currentDiodeResidualTerms, diodeContributions, diodeJacobianCoordinates,
  selectedDiodeMetricHtml, tangentProvenanceHtml } from './diode-presentation.js';
import { presets } from './presets.js';
import { diodeTangentSchematic, escapeHtml, schematic } from './schematic.js';
import { plot } from './plot.js';
import { algebraicSummary, diodeFailureReason, documentIssueText, statusSummary, type DocumentIssue } from './diagnostics.js';
import { language, persistLanguage, readLanguage, setLanguage, t, translate, type Language, type TranslationKey } from './i18n.js';
import { BuilderUI } from './builder-ui.js';
import { OnePortUI } from './one-port-ui.js';
import { ResistorTransformUI } from './resistor-transform-ui.js';
import { guideFor, referenceFor, referenceStatus, type GuideAction } from './study-guide.js';
import { guideNavigation } from './guide-navigation.js';
import { openPortComparison } from './transform-navigation.js';
import { addPanel, createWorkspace, handlePanelFieldChange, movePanel, PanelCalculator,
  panelCsv, reconcilePanels, removePanel, suggestedLayout, type PanelConfig, type PanelResult,
  type PanelType, type WorkspaceView, type NumericPanelField } from './workspace.js';
import type { Component, SourceValue, Waveform } from '../src/model.js';
import type { Diode } from '../src/nonlinear-model.js';
import { boltzmannJPerK, elementaryChargeC } from '../src/diode-operating-point.js';
import type { PortAnalysisResult, PortFailure, PortLoadResult, PortOperatingPoint, PortRepresentation } from '../src/port-analysis.js';

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
let jsonIssue: DocumentIssue | null = null;
let importIssue: DocumentIssue | null = null;
let sourceOpen = false;
let inspectorContribOpen = false;
let guideOpen = false;
let pendingGuideAction: GuideAction | null = null;
const inputDrafts = new Map<string, string>();
const inputIssues = new Map<string, TranslationKey>();
const builderUI = new BuilderUI(byId('builder-editor'), () => state, () => validatedChange());
const onePortUI = new OnePortUI(byId('one-port'), () => state);
const resistorUI = new ResistorTransformUI(byId('resistor-transform'), () => state, {
  hasDrafts: () => builderUI.hasUnappliedDraft() || jsonDirty,
  apply: json => { const result=importNative(state,json); if(!result.ok)return false; validatedChange();return true; },
  refresh: () => renderAll(),
  loadExample: id => loadPreset(id),
  openAnalyze: () => openView('analyze'),
});
const transformMethod: { method: 'dc' | 'resistor' } = { method: 'dc' };
const panelTypes: PanelType[] = ['dc', 'frequency', 'transient', 'equations', 'port', 'port-frequency', 'diode-characteristic', 'dc-sweep'];
const panelKeys: Record<PanelType, TranslationKey> = { dc: 'panelDc', frequency: 'panelFrequency', transient: 'panelTransient', equations: 'panelEquations', port: 'panelPort', 'port-frequency': 'panelPortFrequency',
  'diode-characteristic': 'panelDiodeCharacteristic', 'dc-sweep': 'panelDcSweep' };
const sweeps = new SweepLifecycle();
const sourceUnit = (id: string): 'V' | 'A' => state.document.circuit.components.find(c => c.id === id)?.type === 'I' ? 'A' : 'V';
const componentUnit = (c: Component | Diode): string => c.type === 'R' || c.type === 'CCVS' ? 'Ω' : c.type === 'C' ? 'F' : c.type === 'L' ? 'H' : c.type === 'VCCS' ? 'S' : '';
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
  byId('json-error').textContent = conflict ? t('jsonConflict') : jsonIssue ? documentIssueText(jsonIssue, 'json') : '';
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
  byId('one-port').hidden = transformMethod.method !== 'dc';
  byId('resistor-transform').hidden = transformMethod.method !== 'resistor';
  byId('transform-scope').textContent = t(transformMethod.method === 'dc' ? 'transformScope' : 'resScope');
  (byId('transform-method') as HTMLSelectElement).value = transformMethod.method;
  if (workspace.view === 'transform') { if (transformMethod.method === 'dc') onePortUI.render(); else resistorUI.render(); }
}
function renderGuide(): void {
  const root=byId('study-guide');
  root.hidden=workspace.view==='editor';
  if(root.hidden)return;
  const origin=resistorUI.guideOrigin();
  const id=origin??state.presetId;
  const guide=guideFor(id);
  const reference=referenceFor(id);
  const preset=presets.find(p=>p.id===id);
  const changed=referenceStatus(state,id)==='edited';
  const actions=guide?.steps.map(step=>`<li><span>${e(step.text)}</span> <button type="button" class="button quiet" data-guide-action="${step.action}">${e(t('guideGo',{workspace:step.action==='transform'?t('workspaceTransform'):t('workspaceAnalyze')}))}</button></li>`).join('')??'';
  const replace=pendingGuideAction?`<div class="warning" role="status"><p>${t('guideReplace')}</p><label for="guide-replace-panel">${t('panelType')}</label><select id="guide-replace-panel">${workspace.panels.map(p=>`<option value="${e(p.id)}">${e(p.id)} · ${e(translate(panelKeys[p.type]))}</option>`).join('')}</select><button type="button" id="guide-replace-confirm" class="button">${t('guideReplaceButton')}</button><button type="button" id="guide-replace-cancel" class="button quiet">${t('guideReplaceCancel')}</button></div>`:'';
  root.innerHTML=`<details id="study-guide-details" ${guideOpen?'open':''}><summary>${t('guideTitle')}</summary>${origin&&preset?`<p class="soft-note">${t('guideOriginal',{name:translate(preset.titleKey)})}</p>`:''}${guide?`<div class="guide-content"><h3>${t('guideQuestion')}</h3><p>${e(guide.question)}</p><h3>${t('guideConditions')}</h3><p>${e(guide.conditions)}</p><h3>${t('guideEquation')}</h3><p class="equation-line">${e(guide.equation)}</p>${reference?`<p class="soft-note">${t(changed?'guideBaseline':'guideBaselineUnchanged')}: ${e(reference.formula)} (${e(reference.unit)}); ${e(reference.fixture)}.</p>`:''}<h3>${t('guideTry')}</h3><ol>${actions}</ol><h3>${t('guideCompare')}</h3><p>${e(guide.compare)}</p>${replace}</div>`:`<p>${t('guideCustom')}</p>`}</details>`;
}
function renderCircuitChoice(): void {
  const select = byId('circuit-select') as HTMLSelectElement;
  const group = (label: TranslationKey, ids: string[]) => `<optgroup label="${translate(label)}">${presets.filter(p=>ids.includes(p.id)).map(p=>`<option value="${e(p.id)}"${state.presetId === p.id ? ' selected' : ''}>${translate(p.titleKey)}</option>`).join('')}</optgroup>`;
  select.innerHTML = `${!state.presetId ? `<option value="custom" selected>${t('circuitCustom')} · ${e(state.document.circuit.label ?? '')}</option>` : ''}${group('presetGroupBasics',['divider'])}${group('presetGroupDynamic',['rc','rc-high-pass','rc-loaded','rc-cascade','rl','rlc'])}${group('presetGroupActive',['vcvs'])}${group('presetGroupPassiveFilters',['rc3-low-pass','rc3-high-pass','rlc-band-pass','rlc-notch'])}${group('presetGroupActiveFilters',['butterworth2-low-pass','butterworth2-high-pass'])}${group('presetGroupImpedance',['rc-impedance-ladder','rl-impedance-ladder'])}${group('presetGroupResistor',['res-series','res-star','res-bridge'])}${group('presetGroupPort',['port-t','port-rc-section','port-rc-cascade'])}${group('presetGroupDiode',['diode-single','diode-series','diode-pair','diode-rc'])}`;
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
  const currentDocument = state.document;
  const assembly = isNonlinearDocument(currentDocument)
    ? nonlinearUnknownCount(currentDocument) <= 64
      ? assembleDiodeSystem(currentDocument).linear : null
    : assemble(currentDocument.circuit);
  const contributions = assembly?.contributions.filter(x => x.component === selected.id) ?? [];
  const bias = selected.type === 'D' ? calculator.currentBias(state) : null;
  const diodeRows = selected.type === 'D' && isNonlinearDocument(currentDocument) && bias?.status === 'ok'
    ? currentDiodeContributions(currentDocument, bias, selected.id) : [];
  const diodeResidualRows = selected.type === 'D' && isNonlinearDocument(currentDocument) && bias?.status === 'ok'
    ? currentDiodeResidualTerms(currentDocument, bias, selected.id) : [];
  const diodeResistance = selected.type === 'D' && bias?.status === 'ok'
    ? bias.diodes[selected.id]?.differentialResistanceOhm : undefined;
  const param = 'value' in selected ? field(t('value'),'component',selected.id,selected.value,componentUnit(selected),true) :
    'gain' in selected ? field(t('gain'),'component',selected.id,selected.gain,componentUnit(selected)) :
    selected.type === 'D' ? `<div class="controls-grid">${field(t('diodeIs'),'diode.saturationCurrentA',selected.id,selected.model.saturationCurrentA,'A',true)}${field(t('diodeIdeality'),'diode.idealityFactor',selected.id,selected.model.idealityFactor,'',true)}${field(t('diodeRs'),'diode.seriesResistanceOhm',selected.id,selected.model.seriesResistanceOhm,'Ω')}${field(t('diodeTemperature'),'diode.temperatureK',selected.id,selected.model.temperatureK,'K',true)}</div><p class="muted small">${t('diodeModelNote')}</p><p class="soft-note">${t('diodeResistance')}: ${diodeResistance === undefined ? t('diodeDerivativeUnavailable') : diodeResistance === null ? t('portUndefined') : `${fmt(diodeResistance)} Ω`} (${t('diodeReadOnly')})</p>`
      : `<p class="muted small">${t('sourceEditorHint')}</p>`;
  const diodeLaw = selected.type === 'D' ? 'i = Is·expm1((V(p)−V(n)−Rs·i)/(n·kB·T/q))' : '';
  const diodeContributionTable = `<p class="soft-note">${t('diodeContributionIntro')}</p>${selected.p===selected.n?`<p>${t('diodeCoincident')}</p>`:''}<div class="table-wrap"><table class="result-table"><thead><tr><th>F ${t('row')}</th><th>${t('terminalLaw')}</th><th>${t('value')}</th></tr></thead><tbody>${diodeResidualRows.map(row=>`<tr><td>${e(row.row)}</td><td>${e(row.term)}</td><td>${fmt(row.valueA)} A</td></tr>`).join('')}</tbody></table></div><div class="table-wrap"><table class="result-table"><thead><tr><th>J ${t('row')}</th><th>${t('column')}</th><th>${t('value')}</th><th>${t('terminalLaw')}</th></tr></thead><tbody>${diodeRows.map(row=>`<tr><td>${e(row.row)}</td><td>${e(row.column)}</td><td>${fmt(row.coefficient)} ${row.units}</td><td>${t(`diodeTerm_${row.meaning}`)}${row.assembled?'':` · ${t('diodeReferenceTerm')}`}</td></tr>`).join('')}</tbody></table></div>`;
  const contributionContent = selected.type === 'D'
    ? bias?.status === 'ok' ? diodeContributionTable : t('diodeDerivativeUnavailable')
    : contributions.length ? `<div class="table-wrap"><table class="result-table"><thead><tr><th>${t('matrix')}</th><th>${t('row')}</th><th>${t('column')}</th><th>${t('value')}</th></tr></thead><tbody>${contributions.map(c=>`<tr><td>${c.matrix}</td><td>${e(c.row)}</td><td>${e(c.column)}</td><td>${fmt(c.value)} ${e(c.units)}</td></tr>`).join('')}</tbody></table></div>` : t('noContribution');
  byId('component-editor').innerHTML = `<div class="editor-card"><p class="editor-title">${e(selected.id)} · ${e(selected.type)}</p><p class="terminal-note">${e(t('orderedTerminals',{p:selected.p,n:selected.n}))}</p>${param}<div class="subheading">${t('kernelTerminalLaw')}</div><div class="law-box">${diodeLaw ? e(diodeLaw) : contributions.length ? e([...new Set(contributions.map(x => x.law))].join(' · ')) : t('noContribution')}</div><button type="button" id="view-contributions" class="button quiet" aria-expanded="${inspectorContribOpen}" aria-controls="inspector-contributions">${t('viewContributions')}</button><div id="inspector-contributions" ${inspectorContribOpen?'':'hidden'}>${contributionContent}</div></div>`;
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
  if (state.document.circuit.schemaVersion === 2) return `<p class="warning">${t('diodeUnavailableTransform')}</p>`;
  if (dc.status !== 'ok') return `<div class="warning" role="status">${statusSummary(dc.status)}</div>`;
  const nodes = assembly.unknowns.filter(x => x.id.startsWith('V(')).map(x => ({label:x.id,value:dc.unknowns[x.id]!.value.re,unit:'V'}));
  const u = inputValues(assembly,state.document.experiment,'dc');
  const caps = new Map(state.document.circuit.components.filter(c => c.type === 'C').map(c => [c.id,complex(0)]));
  const branches = state.document.circuit.components.map(c => ({label:`I(${c.id})`,value:outputValue(currentRow(assembly,c),dc.x,u,caps).re,unit:'A'}));
  const max = Math.max(0,...dc.residuals.map(r => r.absolute),dc.groundKcl.absolute);
  return `<div class="two-col"><div><div class="subheading">${t('nodeVoltages')}</div>${table(nodes)}</div><div><div class="subheading">${t('signedBranchCurrents')}</div>${table(branches)}</div></div><details class="explanation"><summary>${t('panelExplanation')}</summary><p class="analysis-note">${t('residualSummary',{value:fmt(max),scaled:fmt(dc.diagnostics.scaledBackwardResidual)})}</p></details>`;
}
function nonlinearDcContent(panel: PanelConfig, result: Extract<PanelResult,{type:'nonlinear-dc'}>): string {
  const bias = result.bias;
  if (bias.status !== 'ok') {
    const reason=nonlinearUnknownCount(state.document)>64?t('diodeUnknownLimit'):diodeFailureReason(bias.code);
    return `<div class="warning" role="status">${t('diodeBiasFailure',{reason})}</div>`;
  }
  const summary = selectedDiodeMetricHtml(bias,panel.diodeId);
  const residuals = `<div class="table-wrap"><table class="result-table"><thead><tr><th>${t('residualRow')}</th><th>${t('absolute')}</th><th>${t('diodePhysicalAllowance')}</th><th>${t('diodeArithmeticAllowance')}</th><th>${t('unit')}</th></tr></thead><tbody>${bias.residuals.map(row=>`<tr><td>${e(row.label)}</td><td>${fmt(row.absolute)}</td><td>${fmt(row.physicalAllowance)}</td><td>${fmt(row.arithmeticAllowance)}</td><td>${row.unit}</td></tr>`).join('')}</tbody></table></div>`;
  const diodeDetails = Object.entries(bias.diodes).map(([id,d])=>`<p>${e(id)}: vj=${fmt(d.junctionVoltageV)} V, gj=${fmt(d.junctionConductanceS)} S, i=${fmt(d.currentA)} A</p>`).join('');
  const trace = `<div class="table-wrap"><table class="result-table"><thead><tr><th>#</th><th>α</th><th>${t('absolute')}</th><th>ΔV</th><th>ΔI</th></tr></thead><tbody>${bias.trace.map(step=>`<tr><td>${step.iteration}</td><td>${fmt(step.damping)}</td><td>${fmt(step.merit)}</td><td>${fmt(step.voltageCorrectionV)} V</td><td>${fmt(step.currentCorrectionA)} A</td></tr>`).join('')}</tbody></table></div>`;
  return `${summary}<details class="explanation"><summary>${t('diodeDetails')}</summary><p>${t('diodePartialModel')}</p><p>${t('diodeNotCertified')}</p><div class="subheading">${t('diodeJunction')}</div>${diodeDetails}<div class="subheading">${t('nodeVoltages')}</div>${table(Object.entries(bias.unknowns).filter(([id])=>id.startsWith('V(')).map(([label,value])=>({label,value,unit:'V'})))}<div class="subheading">${t('signedBranchCurrents')}</div>${table(bias.powers.map(power=>({label:`I(${power.id})`,value:power.currentA,unit:'A'})))}<div class="subheading">${t('diodeResiduals')}</div>${residuals}<div class="subheading">${t('diodePowers')}</div>${table(bias.powers.map(power=>({label:power.id,value:power.absorbedW,unit:'W'})))}<div class="subheading">${t('diodeTrace')}</div>${trace}</details>`;
}
function nonlinearEquationContent(result: Extract<PanelResult,{type:'nonlinear-equations'}>): string {
  const { system, evaluation, assembly } = result;
  const tangentDrawing=diodeTangentSchematic(state,result.tangent.document);
  const selectedId=state.selectedComponent??'';
  const marked=diodeJacobianCoordinates(system,evaluation,selectedId);
  const selectedRows=diodeContributions(system,evaluation,selectedId);
  const jacobian = `<div class="table-wrap"><table class="matrix-table"><thead><tr><th>${t('rowColumn')}</th>${system.unknowns.map(label=>`<th>${e(label.id)} (${label.unit})</th>`).join('')}</tr></thead><tbody>${evaluation.jacobian.map((row,i)=>`<tr><th>${e(system.rows[i]!.id)} (${system.rows[i]!.unit})</th>${row.map((value,j)=>`<td class="${marked.has(`${i}:${j}`)?'highlight':''}">${fmt(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const selectedNotice=selectedRows.length?`<p class="soft-note">${t('diodeContributionSelected',{id:selectedId})} ${t('diodeContributionIntro')}</p>`:'';
  const provenance=isNonlinearDocument(state.document)
    ? tangentProvenanceHtml(state.document,result.tangent.document,result.bias) : '';
  return `<p class="equation-line">F(x,uDC)=0 · J=∂F/∂x (${system.rows.length}×${system.unknowns.length})</p><p class="soft-note">${t('diodeEquationsIntro')}</p>${selectedNotice}${jacobian}<details class="explanation"><summary>${t('diodeTangentPreview')}</summary>${provenance}${tangentDrawing?`<div class="schematic-svg">${tangentDrawing.html}</div>`:`<pre class="table-wrap">${e(JSON.stringify(result.tangent.document.circuit,null,2))}</pre>`}<p class="equation-line">E·δẋ + KQ·δx = B·δu (${assembly.rows.length}×${assembly.unknowns.length})</p><div class="matrix-grid">${matrix('E',assembly)}${matrix('K',assembly)}${matrix('B',assembly)}</div></details>`;
}
function characteristicContent(panel: PanelConfig, result: Extract<PanelResult,{type:'diode-characteristic'}>): string {
  const { curve, bias, loadLine } = result;
  const diodeBias = bias.status === 'ok' ? bias.diodes[result.diode.id] : undefined;
  const qVisible = diodeBias && diodeBias.terminalVoltageV >= panel.curveMinV && diodeBias.terminalVoltageV <= panel.curveMaxV;
  const overlays: import('./plot.js').PlotOverlay[] = [];
  if (loadLine) overlays.push({ label:t('diodeLoadLine'), style:'dashed', points:[panel.curveMinV,panel.curveMaxV]
    .map(x=>({x,y:(loadLine.sourceVoltageV-x)/loadLine.resistanceOhm,status:'ok'})) });
  if (diodeBias) {
    const halfWidth = Math.min(.05,(panel.curveMaxV-panel.curveMinV)/10);
    const x1=Math.max(panel.curveMinV,diodeBias.terminalVoltageV-halfWidth);
    const x2=Math.min(panel.curveMaxV,diodeBias.terminalVoltageV+halfWidth);
    if(x2>x1) overlays.push({label:t('diodeTangentLocal'),style:'dotted',points:[x1,x2]
      .map(x=>({x,y:diodeBias.currentA+diodeBias.terminalConductanceS*(x-diodeBias.terminalVoltageV),status:'ok'}))});
  }
  const graph = plot(curve.map((point,index)=>{
    const fraction=index/(curve.length-1);
    return {x:(1-fraction)*panel.curveMinV+fraction*panel.curveMaxV,
      y:point?.currentA??null,status:point?'ok':'numeric-range'};
  }),
    {title:t('diodeCurveTitle'),xLabel:`${t('diodeTerminalVoltage')} (V)`,yLabel:`${t('diodeCurrent')} (A)`,
      overlays,markers:qVisible?[{label:'Q',x:diodeBias.terminalVoltageV,y:diodeBias.currentA}]:[]});
  const biasMessage=diodeBias?qVisible?`<p>Q: ${fmt(diodeBias.terminalVoltageV)} V, ${fmt(diodeBias.currentA)} A</p>`:
    `<p class="warning">${t('diodeQOutside')}</p>`:
    `<p class="warning">${t('diodeNoBias')} ${bias.status==='ok'?'':t('diodeBiasFailure',{reason:diodeFailureReason(bias.code)})}</p>`;
  return `${graph}<div class="file-actions"><button type="button" class="button quiet" data-panel-action="fit-bias" data-panel-id="${panel.id}" ${diodeBias?'':'disabled'}>${t('diodeFitBias')}</button></div>${biasMessage}<p class="muted small">${loadLine?`${t('diodeLoadLine')}: E=${fmt(loadLine.sourceVoltageV)} V, R=${fmt(loadLine.resistanceOhm)} Ω` : t('diodeLoadLineUnavailable')}</p><p class="muted small">${t('diodeModelNote')}</p>`;
}
function sweepContent(panel: PanelConfig): string {
  const view=sweeps.get(panel.id);
  const signature=sweepSignature(panel);
  const current=view&&view.document===state.document&&view.revision===state.revision&&view.settings===signature;
  const points=current?view.points:[];
  const graph=points.length>1?plot(points.map(point=>({x:point.sourceValue,y:point.output,status:point.status})),
    {title:t('panelDcSweep'),xLabel:`${panel.input} (${sourceUnit(panel.input)})`,
      yLabel:`${panel.output} (${state.document.circuit.observations.find(o=>o.id===panel.output)?.type==='current'?'A':'V'})`}) : '';
  const failed=points.filter(point=>point.status!=='ok').length;
  return `<p class="soft-note">${t('diodeSweepIntro')}</p><div class="file-actions"><button type="button" class="button" data-panel-action="run-sweep" data-panel-id="${panel.id}">${t('diodeSweepRun')}</button>${current&&view.status==='running'?`<button type="button" class="button quiet" data-panel-action="cancel-sweep" data-panel-id="${panel.id}">${t('diodeSweepCancel')}</button>`:''}</div>${current?`<p role="status" data-sweep-progress>${view.status==='running'?t('diodeSweepProgress',{done:points.length,total:panel.sweepCount}):view.status==='complete'?t('diodeSweepComplete'):t('diodeSweepCancelled')}</p>`:`<p>${t('diodeSweepNoResult')}</p>`}${graph}${failed?`<p class="warning">${t('diodeSweepFailed',{count:failed})}</p>`:''}`;
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
  const incremental=result.incremental;
  const tangentDrawing=incremental?diodeTangentSchematic(state,incremental.tangent.document):null;
  const provenance=incremental&&isNonlinearDocument(state.document)
    ? tangentProvenanceHtml(state.document,incremental.tangent.document,incremental.bias) : '';
  return `<p class="analysis-note">${incremental?t('diodeSmallSignalIntro'):e(t('transferIntro',{input:panel.input,output:panel.output,unit:result.unit}))}</p><div class="plot-grid">${plot(mag,{title:t('magnitude'),xLabel:t('frequencyAxis'),yLabel:t('magnitudeWithUnit',{unit:dim ? 'dB' : result.unit}),xLog:true})}${plot(phase,{title:t('phase'),xLabel:t('frequencyAxis'),yLabel:t('phaseWithUnit'),xLog:true,color:'orange'})}</div>${failed.length ? `<p class="warning">${t('failedFrequency',{count:failed.length,reason:statusSummary(failed[0]!.status)})}</p>` : ''}${zero.length ? `<p class="warning">${t('zeroFrequency',{count:zero.length})}</p>` : ''}<details class="explanation"><summary>${t('panelExplanation')}</summary>${incremental?`<p>${t('diodeConfiguredAc')}</p>`:''}<p>${e(t('acSummary',{frequency:fmt(panel.inspectHz),sources:acInputs || t('noSourcesShort'),output:acText}))}</p><p class="soft-note">${alg}</p>${incremental?`<details><summary>${t('diodeTangentPreview')}</summary>${provenance}${tangentDrawing?`<div class="schematic-svg">${tangentDrawing.html}</div>`:`<pre class="table-wrap">${e(JSON.stringify(incremental.tangent.document.circuit,null,2))}</pre>`}</details>`:''}</details>`;
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
function complexText(value: { re: number; im: number } | null, unit = ''): string {
  if (!value) return t('portUndefined');
  return `${fmt(value.re)}${value.im < 0 ? '' : '+'}${fmt(value.im)}j${unit ? ` ${unit}` : ''}`;
}
function portFailureText(failure: PortFailure): string {
  const keys: Record<PortFailure['status'], TranslationKey> = {
    'invalid-selection': 'portInvalidSelection', 'unsupported-exclusion': 'portUnsupportedExclusion',
    'incompatible-test': 'portIncompatible', nonunique: 'portNonunique',
    'numerical-failure': 'portNumerical',
  };
  return translate(keys[failure.status]);
}
function portWarning(failure: PortFailure): string {
  return `<div class="warning" role="status">${e(portFailureText(failure))}<details class="explanation"><summary>${t('technicalDetails')}</summary><p>${e(failure.message)}</p></details></div>`;
}
function portMatrixContent(name: 'Z' | 'Y', representation: PortRepresentation, panel: PanelConfig): string {
  if (representation.status !== 'ok') return `<p class="warning" role="status">${e(t('portUnavailable',{matrix:name,reason:portFailureText(representation)}))}</p>`;
  const ports = [{ p: panel.p, q: panel.q }, ...(panel.portMode === 2 ? [{ p: panel.p2, q: panel.q2 }] : [])];
  const labels = ports.map((port, index) => `${index + 1}: ${JSON.stringify(port.p)} → ${JSON.stringify(port.q)}`);
  return `<h3>${e(t('portMatrixTitle',{matrix:name,unit:representation.unit}))}</h3><div class="table-wrap"><table class="matrix-table"><thead><tr><th>${name === 'Z' ? 'V ↓ / I →' : 'I ↓ / V →'}</th>${labels.map(label=>`<th>${e(label)}</th>`).join('')}</tr></thead><tbody>${representation.values.map((row,index)=>`<tr><th>${e(labels[index]!)}</th>${row.map(value=>`<td>${e(complexText(value,representation.unit))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function pointCells(point: PortOperatingPoint): string {
  return `<td>${e(complexText(point.v1))}</td><td>${e(complexText(point.v2))}</td><td>${e(complexText(point.i1))}</td><td>${e(complexText(point.i2))}</td><td>${e(complexText(point.sourceToOutputGain))}</td><td>${e(complexText(point.terminalVoltageGain))}</td><td>${e(complexText(point.inputImpedance))}</td>`;
}
function loadingContent(loading: PortLoadResult): string {
  const items = [
    { label: t('portDirect'), result: loading.direct },
    { label: t('portFromZ'), result: loading.fromZ },
    { label: t('portFromY'), result: loading.fromY },
  ];
  const rows = items.map(({label,result}) => {
    if (result.status !== 'ok') return `<tr><th>${e(label)}</th><td colspan="8">${e(t('portLoadFailure',{reason:portFailureText(result)}))}</td></tr>`;
    const agreement = 'comparison' in result ? result.comparison ? result.comparison.passed ? t('portAgrees') : t('portDiffers') : t('portNoComparison') : '—';
    return `<tr><th>${e(label)}</th>${pointCells(result.point)}<td>${e(agreement)}</td></tr>`;
  }).join('');
  const limits = [loading.fromZ, loading.fromY].filter(result=>result.status==='ok').map(result=>{
    if (result.status!=='ok'||!result.comparison) return '';
    const comparison = result.comparison;
    return `<p class="soft-note">|ΔV| = ${comparison.voltageDifference.map(value=>fmt(value)).join(', ')} V ≤ ${comparison.voltageLimit.map(value=>fmt(value)).join(', ')} V; |ΔI| = ${comparison.currentDifference.map(value=>fmt(value)).join(', ')} A ≤ ${comparison.currentLimit.map(value=>fmt(value)).join(', ')} A.</p>`;
  }).join('');
  return `<p class="analysis-note">${t('portLoadIntro')}</p><div class="table-wrap"><table class="result-table"><thead><tr><th>${t('onePortCircuit')}</th><th>${t('portV1')}</th><th>${t('portV2')}</th><th>${t('portI1')}</th><th>${t('portI2')}</th><th>${t('portSourceGain')}</th><th>${t('portTerminalGain')}</th><th>${t('portInputImpedance')}</th><th>${t('portAgreement')}</th></tr></thead><tbody>${rows}</tbody></table></div>${limits}`;
}
function portFrequencyContent(panel: PanelConfig, result: Extract<PanelResult,{type:'port-frequency'}>): string {
  const analyzed: PortAnalysisResult = result.single;
  if (analyzed.status !== 'ok') return portWarning(analyzed);
  const chosen = panel.portMatrix === 'z' ? analyzed.z : analyzed.y;
  const other = panel.portMatrix === 'z' ? analyzed.y : analyzed.z;
  const chosenName = panel.portMatrix.toUpperCase() as 'Z' | 'Y';
  const otherName = panel.portMatrix === 'z' ? 'Y' : 'Z';
  const suppression = t('portSuppression',{excluded:analyzed.excludedDrive ?? t('portNoExcluded'),
    suppressed:analyzed.suppressedSources.join(', ')||t('portNoExcluded'),
    controlled:analyzed.retainedControlled.join(', ')||t('portNoExcluded')});
  const teaching = panel.portFrequencyHz === 0 && analyzed.y.status === 'ok' && analyzed.z.status !== 'ok' &&
    state.document.circuit.components.some(component=>component.type==='C') ? `<p class="soft-note">${t('portDcTeaching')}</p>` : '';
  let view: string;
  if (panel.portView === 'loading' && panel.portMode === 2 && analyzed.loading) view = loadingContent(analyzed.loading);
  else if (panel.portView === 'sweep') {
    const unit = panel.portMatrix === 'z' ? 'Ω' : 'S';
    const magnitude = result.sweep.map(sample=>({x:sample.frequencyHz,y:sample.magnitude,status:sample.status==='zero-magnitude'?'ok':sample.status}));
    const phase = result.sweep.map(sample=>({x:sample.frequencyHz,y:sample.phaseDegrees,status:sample.status}));
    const failures = result.sweep.filter(sample=>sample.status!=='ok'&&sample.status!=='zero-magnitude');
    const zeros = result.sweep.filter(sample=>sample.status==='zero-magnitude');
    view = `<p class="analysis-note">${chosenName}[${panel.portRow+1},${panel.portColumn+1}] · ${unit}</p><div class="plot-grid">${plot(magnitude,{title:t('magnitude'),xLabel:t('frequencyAxis'),yLabel:t('magnitudeWithUnit',{unit}),xLog:true})}${plot(phase,{title:t('phase'),xLabel:t('frequencyAxis'),yLabel:t('phaseWithUnit'),xLog:true,color:'orange'})}</div>${failures.length?`<p class="warning">${t('portFailureCount',{count:failures.length})}</p>`:''}${zeros.length?`<p class="warning">${t('portZeroPhase',{count:zeros.length})}</p>`:''}`;
  } else view = portMatrixContent(chosenName,chosen,panel);
  const otherStatus = other.status !== 'ok' ? `<p class="warning">${e(t('portUnavailable',{matrix:otherName,reason:portFailureText(other)}))}</p>` : '';
  const cascade = state.presetId==='port-rc-cascade' ? `<p class="soft-note">${t('portCascadeNote')}</p>` : '';
  return `<p class="analysis-note">${t('portDefinition')}</p>${teaching}${view}${otherStatus}${cascade}<details class="explanation"><summary>${t('panelExplanation')}</summary><p>${e(suppression)}</p><p>${t('portEvidence')}</p></details>`;
}
function panelField(panel: PanelConfig, field: NumericPanelField, label: string, unit = ''): string {
  const shown = panel.pending[field] ?? String(panel[field]);
  return `<div class="field"><label for="${panel.id}-${field}">${e(label)}${unit ? ` <span class="unit-note">(${e(unit)})</span>` : ''}</label><input id="${panel.id}-${field}" data-panel-id="${panel.id}" data-panel-field="${field}" type="text" inputmode="decimal" value="${e(shown)}" aria-invalid="${!!panel.errors[field]}"><small class="field-error">${panel.errors[field] ? e(translate(panel.errors[field] as TranslationKey,{field:label})) : ''}</small></div>`;
}
function panelSelect(panel: PanelConfig, field: 'input'|'output'|'p'|'q'|'p2'|'q2'|'diodeId', label: string, options: {value:string;label:string}[]): string {
  const current = panel[field];
  return `<div class="field"><label for="${panel.id}-${field}">${e(label)}</label><select id="${panel.id}-${field}" data-panel-id="${panel.id}" data-panel-field="${field}">${!options.some(o=>o.value===current) ? `<option value="${e(current)}" selected>${e(t('resMissingOption',{id:current}))}</option>` : ''}${options.map(o=>`<option value="${e(o.value)}"${o.value===current?' selected':''}>${e(o.label)}</option>`).join('')}</select></div>`;
}
function panelChoice(panel: PanelConfig, field: string, label: string,
  current: string, options: { value: string; label: string }[]): string {
  return `<div class="field"><label for="${panel.id}-${field}">${e(label)}</label><select id="${panel.id}-${field}" data-panel-id="${panel.id}" data-panel-field="${field}">${options.map(option=>`<option value="${e(option.value)}"${option.value===current?' selected':''}>${e(option.label)}</option>`).join('')}</select></div>`;
}
function portPanelSettings(panel: PanelConfig): string {
  const nodes = state.document.circuit.nodes.map(node=>({value:node,label:JSON.stringify(node)}));
  const driveOptions = state.document.circuit.components.filter(component=>component.type==='V' &&
    ((component.p===panel.p&&component.n===panel.q)||(component.p===panel.q&&component.n===panel.p)))
    .map(component=>({value:component.id,label:component.id}));
  if (panel.externalDrive && !driveOptions.some(option=>option.value===panel.externalDrive))
    driveOptions.unshift({value:panel.externalDrive,label:t('portMissingExternal',{id:panel.externalDrive})});
  const mode = panelChoice(panel,'portMode',t('portMode'),String(panel.portMode),[
    {value:'1',label:t('portOne')},{value:'2',label:t('portTwo')}]);
  const terminals = `<div class="controls-grid">${panelSelect(panel,'p',t('portP1'),nodes)}${panelSelect(panel,'q',t('portQ1'),nodes)}${panel.portMode===2?`${panelSelect(panel,'p2',t('portP2'),nodes)}${panelSelect(panel,'q2',t('portQ2'),nodes)}`:''}</div>`;
  const external = panelChoice(panel,'externalDrive',t('portExternal'),panel.externalDrive??'',[
    {value:'',label:t('portNoExternal')},...driveOptions]);
  const view = panelChoice(panel,'portView',t('portView'),panel.portView,[
    {value:'single',label:t('portSingle')},{value:'sweep',label:t('portSweep')},
    ...(panel.portMode===2?[{value:'loading',label:t('portLoading')}]:[])]);
  const matrix = panelChoice(panel,'portMatrix',t('portMatrix'),panel.portMatrix,[
    {value:'z',label:'Z (Ω)'},{value:'y',label:'Y (S)'}]);
  const rows = panel.portMode===2 ? `<div class="controls-grid">${panelChoice(panel,'portRow',t('portRow'),String(panel.portRow),[
    {value:'0',label:`1: ${JSON.stringify(panel.p)} → ${JSON.stringify(panel.q)}`},
    {value:'1',label:`2: ${JSON.stringify(panel.p2)} → ${JSON.stringify(panel.q2)}`}])}${panelChoice(panel,'portColumn',t('portColumn'),String(panel.portColumn),[
    {value:'0',label:`1: ${JSON.stringify(panel.p)} → ${JSON.stringify(panel.q)}`},
    {value:'1',label:`2: ${JSON.stringify(panel.p2)} → ${JSON.stringify(panel.q2)}`}])}</div>` : '';
  const single = panelField(panel,'portFrequencyHz',t('portFrequency'),'Hz');
  const sweep = `<div class="controls-grid">${panelField(panel,'portMinHz',t('minimum'),'Hz')}${panelField(panel,'portMaxHz',t('maximum'),'Hz')}${panelField(panel,'portPoints',t('samples'))}</div>`;
  const load = panel.portMode===2 ? `<div class="controls-grid">${panelField(panel,'portSourceResistance',t('portSourceResistance'),'Ω')}${panelChoice(panel,'portLoadOpen',t('portLoadKind'),panel.portLoadOpen?'open':'resistor',[
    {value:'resistor',label:t('portResistiveLoad')},{value:'open',label:t('portOpenLoad')}])}${panel.portLoadOpen?'':panelField(panel,'portLoadResistance',t('portLoadResistance'),'Ω')}</div>` : '';
  return `${mode}${terminals}${external}<div class="controls-grid">${view}${matrix}${single}</div>${panel.portView==='sweep'?`${rows}${sweep}`:''}${panel.portView==='loading'?load:''}`;
}
function panelSettings(panel: PanelConfig): string {
  const outputs = state.document.circuit.observations.map(o=>({value:o.id,label:o.id}));
  const inputs = state.document.experiment.sources.map(s=>({value:s.id,label:s.id}));
  const nodes = state.document.circuit.nodes.map(n=>({value:n,label:n}));
  const diodes = state.document.circuit.components.filter(c=>c.type==='D').map(c=>({value:c.id,label:c.id}));
  if (panel.type==='diode-characteristic') return `${panelSelect(panel,'diodeId',t('diodeSelected'),diodes)}<div class="controls-grid">${panelField(panel,'curveMinV',t('minimum'),'V')}${panelField(panel,'curveMaxV',t('maximum'),'V')}${panelField(panel,'curvePoints',t('diodeCurvePoints'))}</div>`;
  if (panel.type==='dc-sweep') return `${panelSelect(panel,'input',t('diodeSweepSource'),inputs)}${panelSelect(panel,'output',t('diodeSweepOutput'),outputs)}<div class="controls-grid">${panelField(panel,'sweepMin',t('diodeSweepMin'),sourceUnit(panel.input))}${panelField(panel,'sweepMax',t('diodeSweepMax'),sourceUnit(panel.input))}${panelField(panel,'sweepCount',t('diodeSweepCount'))}</div>`;
  if (panel.type==='dc' && isNonlinearDocument(state.document)) return panelSelect(panel,'diodeId',t('diodeSelected'),diodes);
  if (panel.type==='frequency') return `${panelSelect(panel,'input',t('independentInput'),inputs)}${panelSelect(panel,'output',t('measuredOutput'),outputs)}<div class="controls-grid">${panelField(panel,'minHz',t('minimum'),'Hz')}${panelField(panel,'maxHz',t('maximum'),'Hz')}${panelField(panel,'points',t('samples'))}${panelField(panel,'inspectHz',t('acInspectFrequency'),'Hz')}</div>`;
  if (panel.type==='transient') return `${panelSelect(panel,'output',t('measuredOutput'),outputs)}<div class="controls-grid">${panelField(panel,'duration',t('duration'),'s')}${panelField(panel,'step',t('timeStep'),'s')}</div>`;
  if (panel.type==='port') return `<div class="controls-grid">${panelSelect(panel,'p',t('onePortPositive'),nodes)}${panelSelect(panel,'q',t('onePortNegative'),nodes)}${panelField(panel,'load',t('onePortLoad'),'Ω')}</div>`;
  if (panel.type==='port-frequency') return portPanelSettings(panel);
  if (panel.type==='equations') return panelSelect(panel,'output',t('measuredOutput'),outputs);
  return `<p class="muted small">${t('panelSummaryDc')}</p>`;
}
function panelSummary(panel: PanelConfig): string {
  if(panel.type==='diode-characteristic')return `${t('panelDiodeCharacteristic')}: ${panel.diodeId}, ${fmt(panel.curveMinV)}–${fmt(panel.curveMaxV)} V`;
  if(panel.type==='dc-sweep')return `${t('panelDcSweep')}: ${panel.input} → ${panel.output}, ${panel.sweepCount}`;
  if(panel.type==='frequency') return t('panelSummaryFrequency',{input:panel.input,output:panel.output,min:fmt(panel.minHz),max:fmt(panel.maxHz),points:panel.points});
  if(panel.type==='transient') return t('panelSummaryTransient',{output:panel.output,duration:fmt(panel.duration),step:fmt(panel.step)});
  if(panel.type==='port') return t('panelSummaryPort',{p:panel.p,q:panel.q,load:fmt(panel.load)});
  if(panel.type==='port-frequency') return t('portSummary',{count:panel.portMode,frequency:fmt(panel.portFrequencyHz),matrix:panel.portMatrix.toUpperCase()});
  if(panel.type==='equations') return t('panelSummaryEquations',{output:panel.output});
  return t('panelSummaryDc');
}
function renderPanel(panel: PanelConfig, index: number): string {
  let content = '';
  let result: PanelResult | null = null;
  if (!panel.collapsed) {
    result = calculator.calculate(panel,state);
    content = panel.selectionNeeded ? `<p class="warning" role="status">${t('panelSelectionNeeded',{field:t(panel.selectionNeeded==='input'?'independentInput':panel.selectionNeeded==='output'?'measuredOutput':panel.selectionNeeded==='diode'?'diodeSelected':panel.selectionNeeded==='externalDrive'?'portExternal':'onePortPositive')})}</p>` : !result ? `<p class="warning">${t('resultNeedsValid')}</p>` :
      result.type==='dc' ? dcContent(result.assembly,result.dc) :
      result.type==='nonlinear-dc' ? nonlinearDcContent(panel,result) :
      result.type==='frequency' ? frequencyContent(panel,result) :
      result.type==='transient' ? transientContent(panel,result) :
      result.type==='equations' ? equationContent(panel,result) :
      result.type==='nonlinear-equations' ? nonlinearEquationContent(result) :
      result.type==='diode-characteristic' ? characteristicContent(panel,result) :
      result.type==='dc-sweep' ? sweepContent(panel) :
      result.type==='nonlinear-failure' ? `<div class="warning" role="status">${result.reason==='unsupported-panel'?t('diodeUnavailablePanel'):result.reason==='missing-diode'?t('diodeUnavailableModel'):t('diodeBiasFailure',{reason:diodeFailureReason(result.reason)})}</div>` :
      result.type==='port' ? portContent(panel,result) : portFrequencyContent(panel,result);
  }
  const error = Object.keys(panel.errors).length ? `<p class="warning" role="status">${t('panelLastValid')}</p>` : '';
  const controls = (action:string,key:TranslationKey,symbol:string,disabled=false) => `<button type="button" class="panel-icon" data-panel-action="${action}" data-panel-id="${panel.id}" aria-label="${translate(key)}" title="${translate(key)}" ${disabled?'disabled':''}>${symbol}</button>`;
  const sweepComplete = panel.type==='dc-sweep' && sweeps.canExport(panel,state,workspace,!document.hidden);
  const exportable = result?.type==='frequency' || result?.type==='transient' ||
    result?.type==='port-frequency' || sweepComplete;
  return `<section class="panel analysis-panel ${panel.expanded?'expanded':''}" data-panel="${panel.id}" aria-label="${translate(panelKeys[panel.type])}"><div class="panel-head"><div class="panel-heading"><label for="${panel.id}-type">${t('panelType')}</label><select id="${panel.id}-type" data-panel-id="${panel.id}" data-panel-field="type">${panelTypes.map(type=>`<option value="${type}"${type===panel.type?' selected':''}>${translate(panelKeys[type])}</option>`).join('')}</select></div><div class="panel-tools">${controls('up','panelUp','↑',index===0)}${controls('down','panelDown','↓',index===workspace.panels.length-1)}${controls('wide',panel.expanded?'panelNormal':'panelFull','⤢')}${controls('collapse',panel.collapsed?'panelExpand':'panelCollapse',panel.collapsed?'▾':'▴')}${controls('remove','panelRemove','×')}</div></div><p class="panel-summary">${e(panelSummary(panel))}</p>${panel.collapsed ? '' : `<details class="panel-settings" data-panel-settings="${panel.id}" ${panel.settingsOpen||panel.selectionNeeded?'open':''}><summary>${t('panelSettings')}</summary>${panelSettings(panel)}</details>${error}<div class="panel-result">${content}</div>${exportable&&!panel.selectionNeeded ? `<button type="button" class="button quiet panel-export" data-panel-action="export" data-panel-id="${panel.id}">${t('exportCsv')}</button>` : ''}`}</section>`;
}
function renderPanels(): void {
  sweeps.reconcile(state,workspace,!document.hidden);
  const grid=byId('analysis-grid');
  grid.innerHTML=workspace.panels.length?workspace.panels.map(renderPanel).join(''):`<div class="panel"><p>${t('panelEmpty')}</p></div>`;
  const add=byId('add-analysis') as HTMLButtonElement;
  add.disabled=workspace.panels.length>=3; add.title=add.disabled?t('addLimit'):'';
  byId('analysis-limit').textContent=add.disabled?t('addLimit'):'';
}
async function startSweep(panel: PanelConfig): Promise<void> {
  const running=sweeps.start(panel,state,workspace,()=>!document.hidden,view=>{
    // Keep the live Cancel button connected while progress advances.
    const status=document.querySelector<HTMLElement>(`[data-panel="${panel.id}"] [data-sweep-progress]`);
    if(status)status.textContent=t('diodeSweepProgress',{done:view.points.length,total:panel.sweepCount});
  },()=>renderPanels());
  renderPanels();
  await running;
}
function renderAll(): void {
  sweeps.reconcile(state,workspace,!document.hidden);
  renderStatic(); renderCircuitChoice(); renderView(); renderSchematic(); renderInspector(); renderSources();
  renderGuide();
  (byId('sources-details') as HTMLDetailsElement).open = sourceOpen;
  if (workspace.view==='analyze') renderPanels();
  if (workspace.view!=='editor') renderJson();
  byId('import-error').textContent=importIssue?documentIssueText(importIssue,'import'):'';
}
document.addEventListener('visibilitychange',()=>{
  sweeps.reconcile(state,workspace,!document.hidden);
  if (!document.hidden && workspace.view==='analyze') renderPanels();
});
function validatedChange(): void {
  const focused = (document.activeElement as HTMLElement | null)?.id;
  inputDrafts.clear(); inputIssues.clear(); reconcilePanels(workspace,state); renderAll();
  if (focused) document.getElementById(focused)?.focus({preventScroll:true});
}
function openView(view: WorkspaceView): void {
  if (workspace.view!=='editor') previousView=workspace.view;
  workspace.view=view; sweeps.reconcile(state,workspace,!document.hidden); renderAll();
  const target = view==='editor' ? byId('return-workspace') : view==='analyze' ? byId('schematic-title') : byId('transform-method');
  target.setAttribute('tabindex','-1'); target.focus({preventScroll:true});
}
function loadPreset(id: string): void {
  const wasSuggested=workspace.layoutIsSuggested&&workspace.panels.every(p=>!Object.keys(p.pending).length);
  state=createLab(id);
  if(wasSuggested)suggestedLayout(workspace,state);
  validatedChange();
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
    } else if(kind.startsWith('diode.')) {
      const c=d.circuit.components.find(c=>c.id===id);
      if(!c||c.type!=='D')throw new Error('Unknown diode');
      const parameter=kind.slice('diode.'.length) as keyof typeof c.model;
      if(parameter==='kind')throw new Error('Diode model kind is fixed');
      Object.assign(c.model,{[parameter]:value});
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
// Some assistive input paths emit input and blur without a change event. The
// pending value is already recorded by `input`; commit it when focus leaves.
document.addEventListener('focusout', event => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.dataset.panelField) return;
  const panel = workspace.panels.find(candidate => candidate.id === target.dataset.panelId);
  if (!panel || panel.pending[target.dataset.panelField] === undefined) return;
  if (handlePanelFieldChange(workspace, state, panel.id, target.dataset.panelField, target.value)) renderPanels();
});
document.addEventListener('toggle',event=>{
  const target=event.target;
  if(target instanceof HTMLDetailsElement&&target.id==='sources-details')sourceOpen=target.open;
  if(target instanceof HTMLDetailsElement&&target.id==='study-guide-details')guideOpen=target.open;
  if(target instanceof HTMLDetailsElement&&target.dataset.panelSettings){
    const panel=workspace.panels.find(p=>p.id===target.dataset.panelSettings);if(panel)panel.settingsOpen=target.open;
  }
},true);
document.addEventListener('change',async event=>{
  const target=event.target;
  if(target instanceof HTMLSelectElement&&target.id==='transform-method'){
    transformMethod.method=target.value==='resistor'?'resistor':'dc';renderView();return;
  }
  if(target instanceof HTMLInputElement&&target.id==='import-file'){
    const file=target.files?.[0];if(!file)return;
    try{const result=importNative(state,await file.text());if(!result.ok){importIssue={kind:'validation',code:result.errorCode??'invalid-document',params:result.errorParams??{}};renderAll();return;}importIssue=null;validatedChange();}
    catch{importIssue={kind:'read'};renderAll();}
    finally{target.value='';}return;
  }
  if(target instanceof HTMLSelectElement&&target.id==='circuit-select'){
    if(target.value==='custom')return;
    loadPreset(target.value);return;
  }
  if((target instanceof HTMLInputElement||target instanceof HTMLSelectElement)&&target.dataset.panelField){
    if(handlePanelFieldChange(workspace,state,target.dataset.panelId??'',target.dataset.panelField,target.value)) {
      // A panel's chosen observation also identifies the measurement marked in
      // the circuit drawing. Other panels retain their independent selections.
      if(target.dataset.panelField==='output' && state.document.circuit.observations.some(o=>o.id===target.value)) {
        state.output=target.value;
        renderSchematic();
      }
      renderPanels();
    }
    return;
  }
  if((target instanceof HTMLInputElement||target instanceof HTMLSelectElement)&&target.dataset.kind)editField(target);
});
document.addEventListener('click',event=>{
  const target=event.target;if(!(target instanceof Element))return;
  const guideAction=target.closest<HTMLButtonElement>('[data-guide-action]');
  if(guideAction){openGuideAction(guideAction.dataset.guideAction as GuideAction);return;}
  if(target.closest('#guide-replace-cancel')){pendingGuideAction=null;renderGuide();return;}
  if(target.closest('#guide-replace-confirm')&&pendingGuideAction){
    const selected=(byId('guide-replace-panel') as HTMLSelectElement).value;
    const panel=workspace.panels.find(p=>p.id===selected);
    if(panel){const next=pendingGuideAction;pendingGuideAction=null;const result=guideNavigation(workspace,state,next,panel.id);if(result.kind==='focus')focusGuidePanel(result.panelId);}
    return;
  }
  const lang=target.closest<HTMLButtonElement>('[data-language]');
  if(lang){const focus=(document.activeElement as HTMLElement|null)?.id;setLanguage(lang.dataset.language as Language);persistLanguage(language(),storage);renderAll();if(focus)document.getElementById(focus)?.focus({preventScroll:true});return;}
  const view=target.closest<HTMLButtonElement>('[data-view]');if(view){openView(view.dataset.view as WorkspaceView);return;}
  const editorView=target.closest<HTMLButtonElement>('[data-editor-view]');if(editorView){workspace.editorView=editorView.dataset.editorView==='json'?'json':'form';renderView();return;}
  const comp=target.closest<HTMLElement>('[data-component],[data-schematic-component]');
  if(comp){
    const fromSchematic=comp.dataset.schematicComponent!==undefined;
    state.selectedComponent=comp.dataset.component??comp.dataset.schematicComponent??null;
    inspectorContribOpen=false;renderInspector();renderSchematic();if(workspace.view==='analyze')renderPanels();
    if(fromSchematic){const replacement=Array.from(document.querySelectorAll<HTMLElement>('[data-schematic-component]'))
      .find(element=>element.dataset.schematicComponent===state.selectedComponent);replacement?.focus({preventScroll:true});}
    return;
  }
  const panelButton=target.closest<HTMLButtonElement>('[data-panel-action]');
  if(panelButton){const panel=workspace.panels.find(p=>p.id===panelButton.dataset.panelId);if(!panel)return;
    const action=panelButton.dataset.panelAction;
    if(action==='open-comparison'){openPortComparison(transformMethod,panel,(p,q,load)=>onePortUI.useSelection(p,q,load),()=>openView('transform'));return;}
    if(action==='fit-bias'){
      const result=calculator.calculate(panel,state);
      if(result?.type==='diode-characteristic'&&result.bias.status==='ok'){
        const q=result.bias.diodes[panel.diodeId];
        if(q){
          const model=result.diode.model;
          const thermal=model.idealityFactor*boltzmannJPerK*model.temperatureK/elementaryChargeC;
          // The ideal exponential rises about e-fold per thermal voltage;
          // keep Q and its local slope visible on a signed linear current axis.
          const span=Math.max(.03,thermal);
          panel.curveMinV=q.terminalVoltageV-2*span;
          panel.curveMaxV=q.terminalVoltageV+span;
          delete panel.pending.curveMinV;delete panel.pending.curveMaxV;
          delete panel.errors.curveMinV;delete panel.errors.curveMaxV;
          workspace.layoutIsSuggested=false;renderPanels();}
      }return;
    }
    if(action==='run-sweep'){void startSweep(panel);return;}
    if(action==='cancel-sweep'){
      sweeps.cancel(panel.id);renderPanels();return;
    }
    if(action==='export'){
      if(panel.type==='dc-sweep'){
        const view=sweeps.get(panel.id);
        if(view?.result&&sweeps.canExport(panel,state,workspace,!document.hidden))
          download(`circuits-${panel.type}-${panel.id}.csv`,dcSweepCsv(view.result),'text/csv');
      }else{const result=calculator.calculate(panel,state);
        if(result&&(result.type==='frequency'||result.type==='transient'||result.type==='port-frequency'))
          download(`circuits-${panel.type}-${panel.id}.csv`,panelCsv(panel,result),'text/csv');}
      return;
    }
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
    if(!result.ok){jsonDirty=true;jsonIssue={kind:'validation',code:result.errorCode??'invalid-document',params:result.errorParams??{}};renderJson();return;}
    jsonDirty=false;jsonIssue=null;validatedChange();return;
  }
  if(button.id==='restore-json'){jsonDirty=false;jsonIssue=null;renderJson();return;}
  if(button.id==='export-json')download('circuits-unfolded.json',exportNative(state),'application/json');
});
document.addEventListener('keydown',event=>{
  if(event.key!=='Enter'&&event.key!==' ')return;
  const target=event.target;
  if(target instanceof Element&&target.matches('[data-schematic-component]')){
    event.preventDefault();target.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  }
});
function focusGuidePanel(id: string): void {
  workspace.layoutIsSuggested=false;
  openView('analyze');
  const panel=document.querySelector<HTMLElement>(`[data-panel="${id}"]`);
  panel?.setAttribute('tabindex','-1');panel?.focus({preventScroll:true});panel?.scrollIntoView({block:'nearest'});
}
function openGuideAction(action:GuideAction): void {
  const result=guideNavigation(workspace,state,action);
  if(result.kind==='transform'){transformMethod.method='resistor';openView('transform');}
  else if(result.kind==='focus')focusGuidePanel(result.panelId);
  else if(result.kind==='replacement-required'){pendingGuideAction=action;renderGuide();}
}
renderAll();
