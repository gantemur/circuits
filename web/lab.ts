import { assemble, complex, currentRow, extractFirstOrder, inputValues, outputValue, ValidationError,
  solveDC, solveFrequency, transfer, transient,
  type AnalysisResult, type Assembly, type Complex, type FirstOrderTransfer,
  type NotSupported, type TransientResult, type Unit } from '../src/index.js';
import { copyDocument, matchingPreset, presets } from './presets.js';
import { isNonlinearDocument, parseBrowserDocument, serializeBrowserDocument,
  type BrowserDocument } from './native-document.js';

export interface Settings { minHz: number; maxHz: number; points: number; inspectHz: number; duration: number; step: number }
export interface LabState {
  document: BrowserDocument; presetId: string | null; input: string; output: string;
  selectedComponent: string | null; settings: Settings; revision: number;
}
export interface SweepPoint {
  frequencyHz: number; status: string; value: Complex | null; magnitude: number | null;
  magnitudeDb: number | null; phaseDegrees: number | null; message: string;
}
export interface LabAnalysis {
  revision: number; assembly: Assembly; dc: AnalysisResult; ac: AnalysisResult;
  sweep: SweepPoint[]; transferUnit: `${Unit}/${Unit}`;
  algebraic: FirstOrderTransfer | NotSupported;
  transient: TransientResult;
  settings: Settings;
}
export interface EditResult { ok: boolean; error?: string; errorCode?: string; errorParams?: Readonly<Record<string, string | number>> }
const editError = (error: unknown): EditResult => ({ ok: false, error: error instanceof Error ? error.message : String(error),
  errorCode: error instanceof ValidationError ? error.code : 'invalid-document',
  errorParams: error instanceof ValidationError ? error.params : {} });
const defaults = (preset: string): Settings => {
  const rlcMeasurement = preset === 'rlc-band-pass' || preset === 'rlc-notch';
  const newFilter = preset.startsWith('rc3-') || preset.startsWith('butterworth2-');
  const ladder = preset.endsWith('-impedance-ladder');
  const resonanceHz = 10000 / (2 * Math.PI);
  const nonlinearTransient = preset === 'diode-rc-step' ? { duration: .0005, step: .00001 } :
    preset === 'diode-rc-biased-sine' ? { duration: .003, step: .000005 } :
    preset === 'half-wave-rectifier' ? { duration: .04, step: .0001 } :
    preset === 'half-wave-rectifier-rc' ? { duration: .06, step: .0001 } : null;
  const duration = nonlinearTransient?.duration ?? (preset === 'rc3-high-pass' ? .02 : newFilter || rlcMeasurement ? .002 :
    preset === 'rlc' ? .003 : .005);
  return {
    minHz: rlcMeasurement ? resonanceHz / 100 : newFilter ? 10 : 1,
    maxHz: rlcMeasurement ? resonanceHz * 100 : newFilter || ladder ? 1e5 :
      preset === 'rlc' ? 1e5 : 1e4,
    points: 81,
    inspectHz: rlcMeasurement ? resonanceHz : preset === 'rc' || preset === 'rc-high-pass'
      ? 1 / (2 * Math.PI * .001) : 1000,
    duration,
    step: nonlinearTransient?.step ?? (newFilter || rlcMeasurement ? duration / 1000 : preset === 'rlc' ? 1e-5 : 5e-5),
  };
};

export function createLab(presetId = 'divider'): LabState {
  const p = presets.find(p => p.id === presetId);
  if (!p) throw new RangeError(`Unknown example ${presetId}`);
  return { document: copyDocument(p.document), presetId, input: p.document.experiment.sources[0]?.id ?? '',
    output: p.defaultOutput, selectedComponent: null, settings: defaults(presetId), revision: 0 };
}
export function resetExample(state: LabState): LabState {
  return createLab(state.presetId ?? 'divider');
}
export function updateDocument(state: LabState, mutate: (d: BrowserDocument) => void): EditResult {
  try {
    const next = copyDocument(state.document); mutate(next);
    parseBrowserDocument(JSON.stringify(next));
    state.document = next; state.revision++;
    return { ok: true };
  } catch (error) { return editError(error); }
}
export function importNative(state: LabState, json: string, preserveSelection = false): EditResult {
  try {
    const next = parseBrowserDocument(json);
    const p = matchingPreset(next.circuit);
    state.document = next; state.presetId = p?.id ?? null;
    state.input = preserveSelection && next.experiment.sources.some(s => s.id === state.input)
      ? state.input : next.experiment.sources[0]?.id ?? '';
    state.output = preserveSelection && next.circuit.observations.some(o => o.id === state.output)
      ? state.output : next.circuit.observations.find(o => o.type === 'voltage')?.id ?? next.circuit.observations[0]?.id ?? '';
    state.selectedComponent = null; state.revision++;
    return { ok: true };
  } catch (error) { return editError(error); }
}
export const exportNative = (state: LabState): string => serializeBrowserDocument(state.document);

export function parseFinite(text: string, name: string, positive = false): number {
  if (!text.trim()) throw new RangeError(`${name} is required`);
  const value = Number(text);
  if (!Number.isFinite(value) || (positive && value <= 0))
    throw new RangeError(`${name} must be ${positive ? 'a positive' : 'a'} finite number`);
  return value;
}
export function validateSettings(s: Settings, sourceEvents = 0): string[] {
  const messages: Record<SettingsProblem, string> = {
    minHz: 'Minimum frequency must be from 0.001 to 1e9 Hz', maxHz: 'Maximum frequency must exceed minimum and be at most 1e9 Hz',
    points: 'Sweep points must be an integer from 2 to 241', inspectHz: 'AC inspect frequency must lie within the sweep',
    duration: 'Duration must be in (0, 10] s', step: 'Step must be positive and the run must use at most 3000 intervals, including source events',
  };
  return settingsProblems(s, sourceEvents).map(code => messages[code]);
}
export type SettingsProblem = keyof Settings;
export function settingsProblems(s: Settings, sourceEvents = 0): SettingsProblem[] {
  const errors: SettingsProblem[] = [];
  if (!Number.isFinite(s.minHz) || s.minHz < .001 || s.minHz > 1e9) errors.push('minHz');
  if (!Number.isFinite(s.maxHz) || s.maxHz <= s.minHz || s.maxHz > 1e9) errors.push('maxHz');
  if (!Number.isInteger(s.points) || s.points < 2 || s.points > 241) errors.push('points');
  if (!Number.isFinite(s.inspectHz) || s.inspectHz < s.minHz || s.inspectHz > s.maxHz) errors.push('inspectHz');
  if (!Number.isFinite(s.duration) || s.duration <= 0 || s.duration > 10) errors.push('duration');
  if (!Number.isFinite(s.step) || s.step <= 0 || s.duration/s.step + sourceEvents > 3000) errors.push('step');
  return errors;
}
export function dimensionless(unit: `${Unit}/${Unit}`): boolean { return unit === 'V/V' || unit === 'A/A'; }
export function analyze(state: LabState): LabAnalysis {
  if (isNonlinearDocument(state.document)) throw new RangeError('Use nonlinear panel analysis for a v2 diode circuit');
  const events = state.document.experiment.sources.filter(s => s.waveform?.type === 'step' && s.waveform.at >= 0 && s.waveform.at <= state.settings.duration).length;
  const errors = validateSettings(state.settings, events);
  if (errors.length) throw new RangeError(errors.join('; '));
  const assembly = assemble(state.document.circuit);
  if (!assembly.inputs.some(i => i.id === state.input) || !assembly.outputs.some(o => o.id === state.output))
    throw new RangeError('Choose an independent source and a named output');
  const unit = `${assembly.outputs.find(o => o.id === state.output)!.unit}/${assembly.inputs.find(i => i.id === state.input)!.unit}` as `${Unit}/${Unit}`;
  const dc = solveDC(assembly, state.document.experiment);
  const ac = solveFrequency(assembly, state.document.experiment, complex(0, 2*Math.PI*state.settings.inspectHz));
  const sweep: SweepPoint[] = [];
  const { minHz, maxHz, points } = state.settings;
  for (let i = 0; i < points; i++) {
    const frequencyHz = minHz * (maxHz/minHz)**(i/(points-1));
    const result = transfer(assembly, state.input, state.output, complex(0, 2*Math.PI*frequencyHz));
    if (result.status !== 'ok') {
      sweep.push({ frequencyHz, status: result.status, value: null, magnitude: null, magnitudeDb: null,
        phaseDegrees: null, message: result.message });
    } else {
      const { value, magnitude } = result.transfer;
      sweep.push({ frequencyHz, status: magnitude === 0 ? 'zero-magnitude' : 'ok', value, magnitude,
        magnitudeDb: magnitude > 0 && dimensionless(unit) ? 20*Math.log10(magnitude) : null,
        phaseDegrees: magnitude > 0 ? result.transfer.phaseRadians * 180 / Math.PI : null,
        message: magnitude === 0 ? 'Magnitude is zero; phase is undefined' : '' });
    }
  }
  const algebraic = extractFirstOrder(assembly, state.input, state.output);
  const time = transient(assembly, state.document.experiment, { stop: state.settings.duration, step: state.settings.step, maxSteps: 3000 });
  return { revision: state.revision, assembly, dc, ac, sweep, transferUnit: unit, algebraic, transient: time, settings: { ...state.settings } };
}

/** DC currents reconstructed by the kernel's own branch laws, including unobserved branches. */
export function dcBranchCurrents(analysis: LabAnalysis, state: LabState): { id: string; value: number; unit: 'A' }[] {
  if (isNonlinearDocument(state.document)) return [];
  if (analysis.dc.status !== 'ok') return [];
  const u = inputValues(analysis.assembly, state.document.experiment, 'dc');
  const caps = new Map(state.document.circuit.components.filter(c => c.type === 'C').map(c => [c.id, complex(0)]));
  return state.document.circuit.components.map(c => ({ id: c.id,
    value: outputValue(currentRow(analysis.assembly, c), analysis.dc.status === 'ok' ? analysis.dc.x : [], u, caps).re, unit: 'A' }));
}
function csvCell(value: string | number | null): string {
  const str = value === null ? '' : String(value);
  return `"${str.replaceAll('"', '""')}"`;
}
const csvRow = (values: (string | number | null)[]) => values.map(csvCell).join(',');
export function csvFor(analysis: LabAnalysis, state: LabState, kind: 'frequency' | 'transient'): string {
  if (analysis.revision !== state.revision) throw new RangeError('Results are stale; rerun analyses');
  if (kind === 'frequency') {
    const unit = analysis.transferUnit, magUnit = dimensionless(unit) ? 'dB' : unit;
    return [csvRow(['frequency_Hz', `magnitude_${magUnit}`, 'phase_deg', 'real', 'imaginary', 'ratio_unit', 'status', 'message']),
      ...analysis.sweep.map(p => csvRow([p.frequencyHz, dimensionless(unit) ? p.magnitudeDb : p.magnitude,
        p.phaseDegrees, p.value?.re ?? null, p.value?.im ?? null, unit, p.status, p.message]))].join('\n') + '\n';
  }
  const measureUnit = analysis.assembly.outputs.find(o => o.id === state.output)!.unit;
  const samples = analysis.transient.samples;
  const rows = [csvRow(['time_s', `value_${measureUnit}`, 'side', 'method', 'status', 'message']),
    ...samples.map(s => csvRow([s.time, s.observations[state.output]?.value.re ?? null, s.side,
      analysis.assembly.storage.length ? s.currentConvention : 'algebraic-at-sample', 'ok', '']))];
  if (analysis.transient.status !== 'ok')
    rows.push(csvRow([analysis.transient.time, null, '', analysis.assembly.storage.length ? 'backward-Euler' : 'algebraic-at-sample',
      analysis.transient.status, analysis.transient.message]));
  return rows.join('\n') + '\n';
}
