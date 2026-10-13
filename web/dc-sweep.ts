import { solveOperatingPoint } from '../src/diode-operating-point.js';
import { isBjtDocument, copyBrowserDocument, type BrowserDocument } from './native-document.js';

export interface DcSweepPoint { sourceValue: number; output: number | null; status: string }
export interface DcSweepResult { status: 'complete' | 'cancelled'; points: DcSweepPoint[];
  sourceId: string; sourceUnit: 'V' | 'A'; observationId: string; observationUnit: 'V' | 'A' }
export interface DcSweepConfig { sourceId: string; observationId: string; minimum: number; maximum: number; count: number }

/** Browser limit checked before dense nonlinear assembly. */
export function nonlinearUnknownCount(document: BrowserDocument): number {
  return document.circuit.nodes.filter(node => node !== '0').length +
    document.circuit.components.filter(c => ['L', 'V', 'VCVS', 'CCVS', 'D'].includes(c.type)).length;
}

/**
 * Sample a declared source coordinate without mutating the applied document.
 * Each point yields to the event loop; only a successful nonlinear point may
 * seed the next Newton solve. The caller invalidates a run via isCurrent.
 */
export async function runDcSweep(document: BrowserDocument, config: DcSweepConfig,
  isCurrent: () => boolean, onPoint: (point: DcSweepPoint, index: number) => void = () => {}): Promise<DcSweepResult> {
  if (isBjtDocument(document)) throw new RangeError('BJT source sweep is unavailable');
  const source = document.circuit.components.find(c => c.id === config.sourceId);
  const observation = document.circuit.observations.find(o => o.id === config.observationId);
  if (!source || (source.type !== 'V' && source.type !== 'I') || !observation ||
      !Number.isFinite(config.minimum) || !Number.isFinite(config.maximum) || config.maximum <= config.minimum ||
      !Number.isInteger(config.count) || config.count < 2 || config.count > 121)
    throw new RangeError('Select a source and observation with finite ordered bounds and 2–121 samples');
  if (document.circuit.schemaVersion === 2 && nonlinearUnknownCount(document) > 64)
    throw new RangeError('The nonlinear browser limit is 64 unknowns');
  const result: DcSweepResult = { status: 'cancelled', points: [], sourceId: config.sourceId,
    sourceUnit: source.type === 'V' ? 'V' : 'A', observationId: config.observationId,
    observationUnit: observation.type === 'voltage' ? 'V' : 'A' };
  let warmStart: number[] | undefined;
  for (let index = 0; index < config.count; index++) {
    if (!isCurrent()) return result;
    // Convex interpolation avoids overflowing (maximum−minimum) when the
    // declared finite endpoints have opposite extreme signs.
    const fraction = index / (config.count - 1);
    const sourceValue = (1 - fraction) * config.minimum + fraction * config.maximum;
    const sample = copyBrowserDocument(document);
    if (isBjtDocument(sample)) throw new RangeError('BJT source sweep is unavailable');
    sample.experiment.sources.find(s => s.id === config.sourceId)!.dc = sourceValue;
    let point: DcSweepPoint;
    try {
      const solved = sample.circuit.schemaVersion === 2
        ? solveOperatingPoint(sample, warmStart ? { initialGuess: warmStart } : {}) : solveOperatingPoint(sample);
      if (solved.status === 'ok') {
        const value = solved.observations[config.observationId]?.value;
        const output = typeof value === 'number' ? value : value?.re;
        point = { sourceValue, output: output !== undefined && Number.isFinite(output) ? output : null,
          status: output !== undefined && Number.isFinite(output) ? 'ok' : 'numeric-range' };
        warmStart = sample.circuit.schemaVersion === 2 && 'kind' in solved ? solved.x : undefined;
      } else {
        point = { sourceValue, output: null, status: solved.status === 'failed' ? solved.code : solved.status };
        warmStart = undefined;
      }
    } catch { point = { sourceValue, output: null, status: 'numeric-range' }; warmStart = undefined; }
    if (!isCurrent()) return result;
    result.points.push(point);
    onPoint(point, index);
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  if (isCurrent()) result.status = 'complete';
  return result;
}

export function dcSweepCsv(result: DcSweepResult): string {
  if (result.status !== 'complete') throw new RangeError('Sweep is incomplete or stale');
  const cell = (value: string | number | null): string => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const line = (values: (string | number | null)[]): string => values.map(cell).join(',');
  return [line(['source_id', 'observation_id', 'source_unit', 'observation_unit',
    'source_value', 'output_value', 'status']),
    ...result.points.map(point => line([result.sourceId, result.observationId, result.sourceUnit,
      result.observationUnit, point.sourceValue, point.output, point.status]))].join('\n') + '\n';
}
