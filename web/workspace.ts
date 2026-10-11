import { assemble, complex, extractFirstOrder, solveDC, solveFrequency, transfer, transient,
  type Assembly, type AnalysisResult, type FirstOrderTransfer, type NotSupported,
  type TransientResult, type Unit } from '../src/index.js';
import { dcOnePort, type OnePortResult } from '../src/one-port.js';
import type { LabState, SweepPoint } from './lab.js';

export type PanelType = 'dc' | 'frequency' | 'transient' | 'equations' | 'port';
export type WorkspaceView = 'analyze' | 'transform' | 'editor';
export type EditorView = 'form' | 'json';
export interface PanelConfig {
  id: string; type: PanelType; input: string; output: string;
  minHz: number; maxHz: number; points: number; inspectHz: number;
  duration: number; step: number; p: string; q: string; load: number;
  collapsed: boolean; expanded: boolean; settingsOpen: boolean;
  pending: Record<string, string>; errors: Record<string, string>;
  selectionNeeded: string | null;
}
export interface WorkspaceState {
  view: WorkspaceView; editorView: EditorView; panels: PanelConfig[]; nextId: number; layoutIsSuggested: boolean;
  transform: { p: string; q: string; load: number; representation: 'thevenin' | 'norton'; showOriginal: boolean };
}
export type PanelResult =
  | { type: 'dc'; assembly: Assembly; dc: AnalysisResult }
  | { type: 'frequency'; assembly: Assembly; unit: `${Unit}/${Unit}`; sweep: SweepPoint[];
      ac: AnalysisResult; algebraic: FirstOrderTransfer | NotSupported }
  | { type: 'transient'; assembly: Assembly; time: TransientResult }
  | { type: 'equations'; assembly: Assembly; dc: AnalysisResult }
  | { type: 'port'; port: OnePortResult };

const defaultType = (preset: string | null): PanelType[] => preset === 'divider' ? ['dc', 'port'] :
  preset === 'vcvs' ? ['dc', 'frequency'] : ['frequency', 'transient'];
const defaultPort = (state: LabState): [string, string] => {
  const nodes = state.document.circuit.nodes;
  const probe = state.document.circuit.observations.find(o => o.type === 'voltage' && o.p !== o.n);
  const p = probe?.type === 'voltage' ? probe.p : nodes.find(n => n !== '0') ?? '0';
  const q = probe?.type === 'voltage' ? probe.n : p === '0' ? nodes.find(n => n !== '0') ?? '0' : '0';
  return [p, q];
};
export function createPanel(state: LabState, id: string, type: PanelType): PanelConfig {
  const [p, q] = defaultPort(state);
  return { id, type, input: state.input, output: state.output, ...state.settings,
    p, q, load: 2000, collapsed: false, expanded: type === 'equations', settingsOpen: false,
    pending: {}, errors: {}, selectionNeeded: null };
}
export function createWorkspace(state: LabState): WorkspaceState {
  const [p, q] = defaultPort(state);
  const types = defaultType(state.presetId);
  return { view: 'analyze', editorView: 'form', layoutIsSuggested: true, panels: types.map((type, i) => createPanel(state, `panel-${i + 1}`, type)),
    nextId: types.length + 1, transform: { p, q, load: 2000, representation: 'thevenin', showOriginal: true } };
}
export function addPanel(workspace: WorkspaceState, state: LabState, type: PanelType = 'dc'): PanelConfig | null {
  if (workspace.panels.length >= 3) return null;
  const panel = createPanel(state, `panel-${workspace.nextId++}`, type);
  workspace.panels.push(panel); return panel;
}
export function removePanel(workspace: WorkspaceState, id: string): void {
  workspace.panels = workspace.panels.filter(p => p.id !== id);
}
export function movePanel(workspace: WorkspaceState, id: string, direction: -1 | 1): void {
  const i = workspace.panels.findIndex(p => p.id === id), j = i + direction;
  if (i < 0 || j < 0 || j >= workspace.panels.length) return;
  [workspace.panels[i], workspace.panels[j]] = [workspace.panels[j]!, workspace.panels[i]!];
}
export function suggestedLayout(workspace: WorkspaceState, state: LabState): void {
  workspace.panels = defaultType(state.presetId).map(type => createPanel(state, `panel-${workspace.nextId++}`, type));
  workspace.layoutIsSuggested = true;
}
/** Keep valid choices; expose missing references instead of relabeling old results. */
export function reconcilePanels(workspace: WorkspaceState, state: LabState): void {
  const inputs = state.document.experiment.sources.map(s => s.id);
  const outputs = state.document.circuit.observations.map(o => o.id);
  const nodes = state.document.circuit.nodes;
  for (const p of workspace.panels) {
    const missing = p.type === 'frequency' && !inputs.includes(p.input) ? 'input' :
      ['frequency', 'transient', 'equations'].includes(p.type) && !outputs.includes(p.output) ? 'output' :
      p.type === 'port' && (!nodes.includes(p.p) || !nodes.includes(p.q)) ? 'port' : null;
    p.selectionNeeded = missing;
  }
}
/** The panel type selector's production transition, including reference reconciliation. */
export function changePanelType(workspace: WorkspaceState, panel: PanelConfig, type: PanelType, state: LabState): void {
  panel.type = type; panel.collapsed = false; panel.settingsOpen = false;
  panel.errors = {}; panel.pending = {};
  reconcilePanels(workspace, state);
  workspace.layoutIsSuggested = false;
}
const limits = (p: PanelConfig, state: LabState): string | null => {
  if (p.type === 'frequency') {
    if (!Number.isFinite(p.minHz) || p.minHz < .001 || p.minHz > 1e9) return 'settingMinHz';
    if (!Number.isFinite(p.maxHz) || p.maxHz <= p.minHz || p.maxHz > 1e9) return 'settingMaxHz';
    if (!Number.isInteger(p.points) || p.points < 2 || p.points > 241) return 'settingPoints';
    if (!Number.isFinite(p.inspectHz) || p.inspectHz < p.minHz || p.inspectHz > p.maxHz) return 'settingInspectHz';
  }
  if (p.type === 'transient') {
    if (!Number.isFinite(p.duration) || p.duration <= 0 || p.duration > 10) return 'settingDuration';
    const events = state.document.experiment.sources.filter(s => s.waveform?.type === 'step' && s.waveform.at >= 0 && s.waveform.at <= p.duration).length;
    if (!Number.isFinite(p.step) || p.step <= 0 || p.duration / p.step + events > 3000) return 'settingStep';
  }
  if (p.type === 'port' && (!Number.isFinite(p.load) || p.load <= 0)) return 'onePortInvalidLoad';
  return null;
};
export type NumericPanelField = 'minHz' | 'maxHz' | 'points' | 'inspectHz' | 'duration' | 'step' | 'load';
export function editPanelNumber(panel: PanelConfig, state: LabState, field: NumericPanelField, text: string): boolean {
  panel.pending[field] = text;
  const value = Number(text);
  if (!text.trim() || !Number.isFinite(value)) { panel.errors[field] = 'finiteField'; return false; }
  const before = panel[field]; panel[field] = value;
  const error = limits(panel, state);
  if (error) { panel[field] = before; panel.errors[field] = error; return false; }
  delete panel.pending[field]; delete panel.errors[field]; return true;
}
export function editPanelSelection(panel: PanelConfig, field: 'input' | 'output' | 'p' | 'q', value: string, state: LabState): void {
  panel[field] = value;
  const inputs = state.document.experiment.sources.map(s => s.id), outputs = state.document.circuit.observations.map(o => o.id), nodes = state.document.circuit.nodes;
  panel.selectionNeeded = panel.type === 'frequency' && !inputs.includes(panel.input) ? 'input' :
    ['frequency', 'transient', 'equations'].includes(panel.type) && !outputs.includes(panel.output) ? 'output' :
    panel.type === 'port' && (!nodes.includes(panel.p) || !nodes.includes(panel.q)) ? 'port' : null;
}
/** Shared transition used by the panel field change event and interaction tests. */
export function handlePanelFieldChange(workspace: WorkspaceState, state: LabState,
  panelId: string, field: string, value: string): boolean {
  const panel = workspace.panels.find(p => p.id === panelId);
  if (!panel) return false;
  if (field === 'type') {
    if (!['dc','frequency','transient','equations','port'].includes(value)) return false;
    changePanelType(workspace, panel, value as PanelType, state);
  } else if (field === 'input' || field === 'output' || field === 'p' || field === 'q') {
    editPanelSelection(panel, field, value, state);
  } else if (['minHz','maxHz','points','inspectHz','duration','step','load'].includes(field)) {
    editPanelNumber(panel, state, field as NumericPanelField, value);
  } else return false;
  workspace.layoutIsSuggested = false;
  return true;
}
export class PanelCalculator {
  private cache = new Map<string, PanelResult>();
  private assemblyRevision = -1;
  private assembly: Assembly | null = null;
  private document: LabState['document'] | null = null;
  private assemblyFor(state: LabState): Assembly {
    if (this.assemblyRevision !== state.revision || !this.assembly || this.document !== state.document) {
      this.assembly = assemble(state.document.circuit); this.assemblyRevision = state.revision;
      this.document = state.document;
      this.cache.clear();
    }
    return this.assembly;
  }
  calculate(panel: PanelConfig, state: LabState): PanelResult | null {
    if (panel.selectionNeeded || limits(panel, state)) return null;
    if (this.document !== state.document || this.assemblyRevision !== state.revision) {
      this.cache.clear(); this.assembly = null; this.assemblyRevision = state.revision; this.document = state.document;
    }
    const key = JSON.stringify([state.revision, panel.type, panel.input, panel.output, panel.minHz, panel.maxHz,
      panel.points, panel.inspectHz, panel.duration, panel.step, panel.p, panel.q, panel.load]);
    const cached = this.cache.get(key); if (cached) return cached;
    let result: PanelResult;
    if (panel.type === 'port') result = { type: 'port', port: dcOnePort(state.document, panel.p, panel.q, panel.load) };
    else {
      const a = this.assemblyFor(state);
      if (panel.type === 'dc') result = { type: 'dc', assembly: a, dc: solveDC(a, state.document.experiment) };
      else if (panel.type === 'equations') result = { type: 'equations', assembly: a, dc: solveDC(a, state.document.experiment) };
      else if (panel.type === 'transient') {
        if (!a.outputs.some(o => o.id === panel.output)) return null;
        result = { type: 'transient', assembly: a, time: transient(a, state.document.experiment,
          { stop: panel.duration, step: panel.step, maxSteps: 3000 }) };
      } else {
        const input = a.inputs.find(i => i.id === panel.input), output = a.outputs.find(o => o.id === panel.output);
        if (!input || !output) return null;
        const unit = `${output.unit}/${input.unit}` as `${Unit}/${Unit}`;
        const sweep: SweepPoint[] = [];
        for (let i = 0; i < panel.points; i++) {
          const frequencyHz = panel.minHz * (panel.maxHz / panel.minHz) ** (i / (panel.points - 1));
          const r = transfer(a, panel.input, panel.output, complex(0, 2 * Math.PI * frequencyHz));
          if (r.status !== 'ok') sweep.push({ frequencyHz, status: r.status, value: null,
            magnitude: null, magnitudeDb: null, phaseDegrees: null, message: r.message });
          else { const { value, magnitude } = r.transfer;
            sweep.push({ frequencyHz, status: magnitude === 0 ? 'zero-magnitude' : 'ok', value, magnitude,
              magnitudeDb: magnitude > 0 && (unit === 'V/V' || unit === 'A/A') ? 20 * Math.log10(magnitude) : null,
              phaseDegrees: magnitude > 0 ? r.transfer.phaseRadians * 180 / Math.PI : null,
              message: magnitude === 0 ? 'Magnitude is zero; phase is undefined' : '' }); }
        }
        result = { type: 'frequency', assembly: a, unit, sweep,
          ac: solveFrequency(a, state.document.experiment, complex(0, 2 * Math.PI * panel.inspectHz)),
          algebraic: extractFirstOrder(a, panel.input, panel.output) };
      }
    }
    this.cache.set(key, result); return result;
  }
}
const csvCell = (value: string | number | null) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const row = (values: (string | number | null)[]) => values.map(csvCell).join(',');
export function panelCsv(panel: PanelConfig, result: PanelResult): string {
  if (panel.type !== result.type || (result.type !== 'frequency' && result.type !== 'transient')) throw new RangeError('No CSV for this panel');
  if (result.type === 'frequency') {
    const dim = result.unit === 'V/V' || result.unit === 'A/A';
    return [row(['frequency_Hz', `magnitude_${dim ? 'dB' : result.unit}`, 'phase_deg', 'real', 'imaginary', 'ratio_unit', 'status', 'message']),
      ...result.sweep.map(p => row([p.frequencyHz, dim ? p.magnitudeDb : p.magnitude, p.phaseDegrees,
        p.value?.re ?? null, p.value?.im ?? null, result.unit, p.status, p.message]))].join('\n') + '\n';
  }
  const unit = result.assembly.outputs.find(o => o.id === panel.output)?.unit ?? 'V';
  const method = result.assembly.storage.length ? 'backward-Euler' : 'algebraic-at-sample';
  const samples = result.time.samples.map(s => row([s.time, s.observations[panel.output]?.value.re ?? null,
    s.side, result.assembly.storage.length ? s.currentConvention : method, 'ok', '']));
  return [row(['time_s', `value_${unit}`, 'side', 'method', 'status', 'message']), ...samples,
    ...(result.time.status === 'ok' ? [] : [row([result.time.time, null, '', method, result.time.status, result.time.message])])].join('\n') + '\n';
}
