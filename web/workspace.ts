import { abs, assemble, complex, extractFirstOrder, polar, solveDC, solveFrequency, transfer, transient,
  type Assembly, type AnalysisResult, type FirstOrderTransfer, type NotSupported,
  type TransientResult, type Unit } from '../src/index.js';
import { assembleDiodeSystem, evaluateDiodeSystem, solveDiodeOperatingPoint,
  type DiodeSystem, type NonlinearEvaluation, type NonlinearResult, type NonlinearSuccess } from '../src/diode-operating-point.js';
import { createDiodeTangent, type TangentSuccess } from '../src/diode-tangent.js';
import type { Diode, NonlinearDocument } from '../src/nonlinear-model.js';
import { diodeCharacteristic, eligibleLoadLine, type CharacteristicPoint, type LoadLine } from './diode-math.js';
import { nonlinearUnknownCount } from './dc-sweep.js';
import { isNonlinearDocument } from './native-document.js';
import { dcOnePort, type OnePortResult } from '../src/one-port.js';
import { analyzePorts, type PortAnalysisResult, type PortConfig, type PortLoad } from '../src/port-analysis.js';
import type { LabState, SweepPoint } from './lab.js';

export type PanelType = 'dc' | 'frequency' | 'transient' | 'equations' | 'port' | 'port-frequency'
  | 'diode-characteristic' | 'dc-sweep';
export type WorkspaceView = 'analyze' | 'transform' | 'editor';
export type EditorView = 'form' | 'json';
export interface PanelConfig {
  id: string; type: PanelType; input: string; output: string;
  minHz: number; maxHz: number; points: number; inspectHz: number;
  duration: number; step: number; p: string; q: string; load: number;
  portMode: 1 | 2; p2: string; q2: string; externalDrive: string | null;
  portFrequencyHz: number; portMinHz: number; portMaxHz: number; portPoints: number;
  portView: 'single' | 'sweep' | 'loading'; portMatrix: 'z' | 'y'; portRow: 0 | 1; portColumn: 0 | 1;
  portSourceResistance: number; portLoadResistance: number; portLoadOpen: boolean;
  diodeId: string; curveMinV: number; curveMaxV: number; curvePoints: number;
  sweepMin: number; sweepMax: number; sweepCount: number;
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
      ac: AnalysisResult; algebraic: FirstOrderTransfer | NotSupported;
      incremental?: { bias: NonlinearSuccess; tangent: TangentSuccess } }
  | { type: 'transient'; assembly: Assembly; time: TransientResult }
  | { type: 'equations'; assembly: Assembly; dc: AnalysisResult }
  | { type: 'port'; port: OnePortResult }
  | { type: 'port-frequency'; single: PortAnalysisResult; sweep: PortSweepPoint[] }
  | { type: 'nonlinear-dc'; bias: NonlinearResult }
  | { type: 'nonlinear-equations'; bias: NonlinearSuccess; system: DiodeSystem;
      evaluation: NonlinearEvaluation; tangent: TangentSuccess; assembly: Assembly }
  | { type: 'diode-characteristic'; diode: Diode; curve: (CharacteristicPoint | null)[];
      minimumV: number; maximumV: number; bias: NonlinearResult; loadLine: LoadLine | null }
  | { type: 'dc-sweep' }
  | { type: 'nonlinear-failure'; reason: string };

export interface PortSweepPoint {
  frequencyHz: number; status: string; value: import('../src/complex.js').Complex | null;
  magnitude: number | null; phaseDegrees: number | null; message: string;
}

const defaultType = (preset: string | null): PanelType[] => preset?.endsWith('-impedance-ladder') ? ['port-frequency', 'equations'] :
  preset === 'diode-single' || preset === 'diode-series' ? ['dc', 'diode-characteristic'] :
  preset === 'diode-pair' ? ['dc', 'dc-sweep'] : preset === 'diode-rc' ? ['dc', 'frequency'] :
  preset?.startsWith('port-') ? ['port-frequency', 'equations'] :
  preset?.startsWith('res-') ? ['dc', 'equations'] : preset === 'divider' ? ['dc', 'port'] :
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
  const impedanceLadder = state.presetId?.endsWith('-impedance-ladder');
  const portPreset = state.presetId?.startsWith('port-');
  const primary = portPreset && state.document.circuit.nodes.includes('in') ? 'in' : p;
  const secondary = state.document.circuit.nodes.includes('out') ? 'out' :
    state.document.circuit.nodes.find(node => node !== primary && node !== q) ?? primary;
  return { id, type, input: state.input, output: state.output, ...state.settings,
    p: primary, q, load: 2000, collapsed: false, expanded: type === 'equations', settingsOpen: false,
    portMode: portPreset ? 2 : 1, p2: secondary, q2: '0', externalDrive: null,
    portFrequencyHz: 1000, portMinHz: 1, portMaxHz: impedanceLadder ? 1e5 : 10000, portPoints: 81,
    portView: impedanceLadder ? 'sweep' : 'single', portMatrix: impedanceLadder ? 'z' : 'y', portRow: 0, portColumn: 0,
    portSourceResistance: 0, portLoadResistance: 2000, portLoadOpen: false,
    diodeId: state.document.circuit.components.find(c => c.type === 'D')?.id ?? '',
    // The signed linear I axis should show the initial Q/load-line intersection,
    // rather than being dominated by the exponential far above forward bias.
    // Later bias edits never recenter a student's accepted range implicitly.
    curveMinV: state.presetId === 'diode-pair' ? -.6 : state.presetId === 'diode-series' ? .47 : .44,
    curveMaxV: state.presetId === 'diode-pair' ? .6 : state.presetId === 'diode-series' ? .59 : .55,
    curvePoints: 121,
    sweepMin: state.presetId === 'diode-pair' ? -2 : 0,
    sweepMax: 2, sweepCount: state.presetId === 'diode-pair' ? 81 : 51,
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
    const missingPort = !nodes.includes(p.p) || !nodes.includes(p.q) ||
      (p.type === 'port-frequency' && p.portMode === 2 && (!nodes.includes(p.p2) || !nodes.includes(p.q2)));
    const excluded = p.externalDrive === null ? null : state.document.circuit.components.find(component =>
      component.id === p.externalDrive && component.type === 'V' &&
      ((component.p === p.p && component.n === p.q) || (component.p === p.q && component.n === p.p)));
    const missing = (p.type === 'frequency' || p.type === 'dc-sweep') && !inputs.includes(p.input) ? 'input' :
      ['frequency', 'transient', 'equations', 'dc-sweep'].includes(p.type) && !outputs.includes(p.output) ? 'output' :
      p.type === 'diode-characteristic' && !state.document.circuit.components.some(c => c.type === 'D' && c.id === p.diodeId) ? 'diode' :
      (p.type === 'port' || p.type === 'port-frequency') && missingPort ? 'port' :
      p.type === 'port-frequency' && p.externalDrive !== null && !excluded ? 'externalDrive' : null;
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
  if (p.type === 'port-frequency') {
    if (!Number.isFinite(p.portFrequencyHz) || p.portFrequencyHz < 0 || p.portFrequencyHz > 1e9) return 'portInvalidFrequency';
    if (!Number.isFinite(p.portMinHz) || p.portMinHz <= 0 || p.portMinHz > 1e9) return 'settingMinHz';
    if (!Number.isFinite(p.portMaxHz) || p.portMaxHz <= p.portMinHz || p.portMaxHz > 1e9) return 'settingMaxHz';
    if (!Number.isInteger(p.portPoints) || p.portPoints < 2 || p.portPoints > 121) return 'portInvalidPoints';
    if (!Number.isFinite(p.portSourceResistance) || p.portSourceResistance < 0) return 'portInvalidSourceResistance';
    if (!p.portLoadOpen && (!Number.isFinite(p.portLoadResistance) || p.portLoadResistance <= 0)) return 'onePortInvalidLoad';
  }
  if (p.type === 'diode-characteristic') {
    if (!Number.isFinite(p.curveMinV) || !Number.isFinite(p.curveMaxV) || p.curveMaxV <= p.curveMinV) return 'diodeInvalidRange';
    if (!Number.isInteger(p.curvePoints) || p.curvePoints < 2 || p.curvePoints > 241) return 'diodeInvalidPoints';
  }
  if (p.type === 'dc-sweep') {
    if (!Number.isFinite(p.sweepMin) || !Number.isFinite(p.sweepMax) || p.sweepMax <= p.sweepMin) return 'diodeInvalidRange';
    if (!Number.isInteger(p.sweepCount) || p.sweepCount < 2 || p.sweepCount > 121) return 'diodeInvalidPoints';
  }
  return null;
};
export type NumericPanelField = 'minHz' | 'maxHz' | 'points' | 'inspectHz' | 'duration' | 'step' | 'load'
  | 'portFrequencyHz' | 'portMinHz' | 'portMaxHz' | 'portPoints' | 'portSourceResistance' | 'portLoadResistance'
  | 'curveMinV' | 'curveMaxV' | 'curvePoints' | 'sweepMin' | 'sweepMax' | 'sweepCount';
export function editPanelNumber(panel: PanelConfig, state: LabState, field: NumericPanelField, text: string): boolean {
  panel.pending[field] = text;
  const value = Number(text);
  if (!text.trim() || !Number.isFinite(value)) { panel.errors[field] = 'finiteField'; return false; }
  const before = panel[field]; panel[field] = value;
  const error = limits(panel, state);
  if (error) { panel[field] = before; panel.errors[field] = error; return false; }
  delete panel.pending[field]; delete panel.errors[field]; return true;
}
export function editPanelSelection(panel: PanelConfig, field: 'input' | 'output' | 'p' | 'q' | 'p2' | 'q2' | 'diodeId', value: string, state: LabState): void {
  panel[field] = value;
  const inputs = state.document.experiment.sources.map(source => source.id);
  const outputs = state.document.circuit.observations.map(output => output.id);
  const nodes = state.document.circuit.nodes;
  panel.selectionNeeded = (panel.type === 'frequency' || panel.type === 'dc-sweep') && !inputs.includes(panel.input) ? 'input' :
    ['frequency', 'transient', 'equations', 'dc-sweep'].includes(panel.type) && !outputs.includes(panel.output) ? 'output' :
    panel.type === 'diode-characteristic' && !state.document.circuit.components.some(c => c.type === 'D' && c.id === panel.diodeId) ? 'diode' :
    (panel.type === 'port' || panel.type === 'port-frequency') &&
      (!nodes.includes(panel.p) || !nodes.includes(panel.q) ||
       (panel.type === 'port-frequency' && panel.portMode === 2 &&
        (!nodes.includes(panel.p2) || !nodes.includes(panel.q2)))) ? 'port' : null;
}
/** Shared transition used by the panel field change event and interaction tests. */
export function handlePanelFieldChange(workspace: WorkspaceState, state: LabState,
  panelId: string, field: string, value: string): boolean {
  const panel = workspace.panels.find(p => p.id === panelId);
  if (!panel) return false;
  if (field === 'type') {
    if (!['dc','frequency','transient','equations','port','port-frequency','diode-characteristic','dc-sweep'].includes(value)) return false;
    changePanelType(workspace, panel, value as PanelType, state);
  } else if (field === 'input' || field === 'output' || field === 'p' || field === 'q' || field === 'p2' || field === 'q2' || field === 'diodeId') {
    editPanelSelection(panel, field, value, state);
    reconcilePanels(workspace, state);
  } else if (field === 'externalDrive') {
    panel.externalDrive = value || null;
    reconcilePanels(workspace, state);
  } else if (field === 'portMode') {
    if (value !== '1' && value !== '2') return false;
    panel.portMode = Number(value) as 1 | 2;
    if (panel.portMode === 1 && panel.portView === 'loading') panel.portView = 'single';
    reconcilePanels(workspace, state);
  } else if (field === 'portView') {
    if (!['single','sweep','loading'].includes(value)) return false;
    panel.portView = value as PanelConfig['portView'];
  } else if (field === 'portMatrix') {
    if (value !== 'z' && value !== 'y') return false;
    panel.portMatrix = value;
  } else if (field === 'portRow' || field === 'portColumn') {
    if (value !== '0' && value !== '1') return false;
    panel[field] = Number(value) as 0 | 1;
  } else if (field === 'portLoadOpen') {
    if (value !== 'open' && value !== 'resistor') return false;
    panel.portLoadOpen = value === 'open';
  } else if (['minHz','maxHz','points','inspectHz','duration','step','load','portFrequencyHz',
      'portMinHz','portMaxHz','portPoints','portSourceResistance','portLoadResistance',
      'curveMinV','curveMaxV','curvePoints','sweepMin','sweepMax','sweepCount'].includes(field)) {
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
  private biasRevision = -1;
  private biasDocument: LabState['document'] | null = null;
  private bias: NonlinearResult | null = null;
  /** Inspector and panels share the same current document/revision bias. */
  currentBias(state: LabState): NonlinearResult | null {
    const document = state.document;
    return isNonlinearDocument(document) ? this.biasFor(state, document) : null;
  }
  private biasFor(state: LabState, document: NonlinearDocument): NonlinearResult {
    if (this.biasRevision === state.revision && this.biasDocument === document && this.bias) return this.bias;
    this.biasRevision = state.revision;
    this.biasDocument = document;
    this.bias = nonlinearUnknownCount(document) > 64
      ? { status: 'failed', code: 'numeric-range', message: 'The nonlinear browser limit is 64 unknowns', trace: [] }
      : solveDiodeOperatingPoint(document);
    return this.bias;
  }
  private nonlinear(panel: PanelConfig, state: LabState, document: NonlinearDocument): PanelResult {
    if (panel.type === 'transient' || panel.type === 'port' || panel.type === 'port-frequency')
      return { type: 'nonlinear-failure', reason: 'unsupported-panel' };
    if (panel.type === 'dc-sweep') return { type: 'dc-sweep' };
    if (panel.type === 'diode-characteristic') {
      const diode = document.circuit.components.find((c): c is Diode => c.type === 'D' && c.id === panel.diodeId);
      if (!diode) return { type: 'nonlinear-failure', reason: 'missing-diode' };
      const curve = Array.from({ length: panel.curvePoints }, (_, index) => {
        const fraction = index / (panel.curvePoints - 1);
        const terminalVoltageV = (1 - fraction) * panel.curveMinV + fraction * panel.curveMaxV;
        return diodeCharacteristic(diode, terminalVoltageV);
      });
      return { type: 'diode-characteristic', diode, curve, minimumV: panel.curveMinV,
        maximumV: panel.curveMaxV, bias: this.biasFor(state, document),
        loadLine: eligibleLoadLine(document, diode.id) };
    }
    const bias = this.biasFor(state, document);
    if (panel.type === 'dc') return { type: 'nonlinear-dc', bias };
    if (bias.status !== 'ok') return { type: 'nonlinear-failure', reason: bias.code };
    const tangent = createDiodeTangent(bias, document);
    if (tangent.status !== 'ok') return { type: 'nonlinear-failure', reason: tangent.code };
    const assembly = assemble(tangent.document.circuit);
    if (panel.type === 'equations') {
      const system = assembleDiodeSystem(document);
      const evaluation = evaluateDiodeSystem(system, bias.x);
      return evaluation ? { type: 'nonlinear-equations', bias, system, evaluation, tangent, assembly }
        : { type: 'nonlinear-failure', reason: 'numeric-range' };
    }
    const input = assembly.inputs.find(i => i.id === panel.input);
    const output = assembly.outputs.find(o => o.id === panel.output);
    if (!input || !output) return { type: 'nonlinear-failure', reason: 'missing-selection' };
    const unit = `${output.unit}/${input.unit}` as `${Unit}/${Unit}`;
    const sweep: SweepPoint[] = [];
    for (let index = 0; index < panel.points; index++) {
      const frequencyHz = panel.minHz * (panel.maxHz / panel.minHz) ** (index / (panel.points - 1));
      const response = transfer(assembly, panel.input, panel.output, complex(0, 2 * Math.PI * frequencyHz));
      if (response.status !== 'ok') sweep.push({ frequencyHz, status: response.status, value: null,
        magnitude: null, magnitudeDb: null, phaseDegrees: null, message: response.message });
      else {
        const { value, magnitude } = response.transfer;
        sweep.push({ frequencyHz, status: magnitude === 0 ? 'zero-magnitude' : 'ok', value, magnitude,
          magnitudeDb: magnitude > 0 && (unit === 'V/V' || unit === 'A/A') ? 20 * Math.log10(magnitude) : null,
          phaseDegrees: magnitude > 0 ? response.transfer.phaseRadians * 180 / Math.PI : null,
          message: magnitude === 0 ? 'Magnitude is zero; phase is undefined' : '' });
      }
    }
    return { type: 'frequency', assembly, unit, sweep,
      ac: solveFrequency(assembly, tangent.document.experiment, complex(0, 2 * Math.PI * panel.inspectHz)),
      algebraic: extractFirstOrder(assembly, panel.input, panel.output), incremental: { bias, tangent } };
  }
  private assemblyFor(state: LabState): Assembly {
    const document = state.document;
    if (isNonlinearDocument(document)) throw new RangeError('Linear assembly requires a v1 circuit');
    if (this.assemblyRevision !== state.revision || !this.assembly || this.document !== document) {
      this.assembly = assemble(document.circuit); this.assemblyRevision = state.revision;
      this.document = document;
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
      panel.points, panel.inspectHz, panel.duration, panel.step, panel.p, panel.q, panel.load,
      panel.portMode, panel.p2, panel.q2, panel.externalDrive, panel.portFrequencyHz, panel.portMinHz,
      panel.portMaxHz, panel.portPoints, panel.portView, panel.portMatrix, panel.portRow, panel.portColumn,
      panel.portSourceResistance, panel.portLoadResistance, panel.portLoadOpen,
      panel.diodeId, panel.curveMinV, panel.curveMaxV, panel.curvePoints,
      panel.sweepMin, panel.sweepMax, panel.sweepCount]);
    const cached = this.cache.get(key); if (cached) return cached;
    const document = state.document;
    if (isNonlinearDocument(document)) {
      const result = this.nonlinear(panel, state, document);
      this.cache.set(key, result);
      return result;
    }
    let result: PanelResult;
    if (panel.type === 'diode-characteristic') result = { type: 'nonlinear-failure', reason: 'missing-diode' };
    else if (panel.type === 'dc-sweep') result = { type: 'dc-sweep' };
    else if (panel.type === 'port') result = { type: 'port', port: dcOnePort(document, panel.p, panel.q, panel.load) };
    else if (panel.type === 'port-frequency') {
      const ports = panel.portMode === 1 ? [{ p: panel.p, q: panel.q }] as PortConfig['ports'] :
        [{ p: panel.p, q: panel.q }, { p: panel.p2, q: panel.q2 }] as PortConfig['ports'];
      const load: PortLoad = panel.portLoadOpen ? { kind: 'open' } :
        { kind: 'resistor', resistance: panel.portLoadResistance };
      const base: Omit<PortConfig, 'frequencyHz'> = { ports, externalDrive: panel.externalDrive,
        ...(panel.portMode === 2 ? { loading: { sourceResistance: panel.portSourceResistance, load } } : {}) };
      const single = analyzePorts(document, { ...base, frequencyHz: panel.portFrequencyHz });
      const sweep: PortSweepPoint[] = [];
      if (panel.portView === 'sweep') {
        for (let index = 0; index < panel.portPoints; index++) {
          const frequencyHz = panel.portMinHz *
            (panel.portMaxHz / panel.portMinHz) ** (index / (panel.portPoints - 1));
          const analyzed = analyzePorts(document, { ports, externalDrive: panel.externalDrive, frequencyHz });
          const representation = analyzed.status === 'ok' ? analyzed[panel.portMatrix] : analyzed;
          const value = representation.status === 'ok' ? representation.values[panel.portMode === 1 ? 0 : panel.portRow]![panel.portMode === 1 ? 0 : panel.portColumn]! : null;
          const magnitude = value ? abs(value) : null;
          const valid = value && Number.isFinite(magnitude);
          sweep.push({ frequencyHz, value: valid ? value : null, magnitude: valid ? magnitude : null,
            phaseDegrees: valid && magnitude! > 0 ? polar(value).phaseRadians * 180 / Math.PI : null,
            status: !valid ? representation.status === 'ok' ? 'numerical-failure' : representation.status :
              magnitude === 0 ? 'zero-magnitude' : 'ok',
            message: representation.status === 'ok' ? valid ? magnitude === 0 ? 'Phase undefined at zero magnitude' : '' : 'Nonfinite matrix entry' : representation.message });
        }
      }
      result = { type: 'port-frequency', single, sweep };
    }
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
  if (panel.type !== result.type || (result.type !== 'frequency' && result.type !== 'transient' && result.type !== 'port-frequency')) throw new RangeError('No CSV for this panel');
  if (result.type === 'port-frequency') {
    const ports = panel.portMode === 1 ? [[panel.p,panel.q]] : [[panel.p,panel.q],[panel.p2,panel.q2]];
    const unit = panel.portMatrix === 'z' ? 'ohm' : 'siemens';
    const samples = result.sweep.length ? result.sweep : (() => {
      const representation = result.single.status === 'ok' ? result.single[panel.portMatrix] : result.single;
      const value = representation.status === 'ok' ? representation.values[panel.portMode === 1 ? 0 : panel.portRow]![panel.portMode === 1 ? 0 : panel.portColumn]! : null;
      const magnitude = value ? abs(value) : null;
      const finite = magnitude !== null && Number.isFinite(magnitude);
      return [{ frequencyHz: panel.portFrequencyHz, value: finite ? value : null, magnitude: finite ? magnitude : null,
        phaseDegrees: finite && magnitude > 0 && value ? polar(value).phaseRadians * 180 / Math.PI : null,
        status: representation.status !== 'ok' ? representation.status : !finite ? 'numerical-failure' :
          magnitude === 0 ? 'zero-magnitude' : 'ok',
        message: representation.status !== 'ok' ? representation.message : !finite ? 'Nonfinite magnitude' :
          magnitude === 0 ? 'Phase undefined at zero magnitude' : '' }];
    })();
    return [row(['frequency_Hz','representation','row_port','column_port','magnitude_unit','magnitude','phase_deg',
      'real','imaginary','port1_p','port1_q','port2_p','port2_q','external_drive','source_resistance_ohm','load_kind',
      'load_resistance_ohm','status','message']),
      ...samples.map(sample => row([sample.frequencyHz,panel.portMatrix.toUpperCase(),panel.portRow+1,panel.portColumn+1,
        unit,sample.magnitude,sample.phaseDegrees,sample.value?.re ?? null,sample.value?.im ?? null,
        ports[0]![0]!,ports[0]![1]!,ports[1]?.[0] ?? '',ports[1]?.[1] ?? '',panel.externalDrive ?? '',
        panel.portSourceResistance,panel.portLoadOpen?'open':'resistor',panel.portLoadOpen?'':panel.portLoadResistance,
        sample.status,sample.message]))].join('\n')+'\n';
  }
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
