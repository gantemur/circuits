import type { Diode, NonlinearDocument } from '../src/nonlinear-model.js';
import { boltzmannJPerK, elementaryChargeC } from '../src/diode-operating-point.js';

export interface CharacteristicPoint {
  terminalVoltageV: number;
  junctionVoltageV: number;
  currentA: number;
}
export interface LoadLine { sourceId: string; resistorId: string; diodeId: string;
  sourceVoltageV: number; resistanceOhm: number }

/**
 * Invert the monotone series-diode terminal law at prescribed terminal V.
 * The unknown is junction voltage vj. For V>=0, 0<=vj<=V; for V<0,
 * V<=vj<=V+Rs Is. On both intervals f(vj)=vj+Rs Is expm1(vj/eta)-V
 * changes sign and has derivative 1+Rs gj>0. Bisection preserves the
 * bracket even when a trial exponential exceeds floating-point range.
 * Return null for an unrepresentable terminal current or bracket.
 */
export function diodeCharacteristic(diode: Diode, terminalVoltageV: number): CharacteristicPoint | null {
  if (!Number.isFinite(terminalVoltageV)) return null;
  const { saturationCurrentA: Is, idealityFactor: n, seriesResistanceOhm: Rs, temperatureK: T } = diode.model;
  const eta = n * boltzmannJPerK * T / elementaryChargeC;
  if (!Number.isFinite(eta) || eta <= 0) return null;
  if (Rs === 0) {
    const currentA = Is * Math.expm1(terminalVoltageV / eta);
    return Number.isFinite(currentA) ? { terminalVoltageV, junctionVoltageV: terminalVoltageV, currentA } : null;
  }
  if (terminalVoltageV === 0) return { terminalVoltageV, junctionVoltageV: 0, currentA: 0 };
  let lower = terminalVoltageV > 0 ? 0 : terminalVoltageV;
  let upper = terminalVoltageV > 0 ? terminalVoltageV : terminalVoltageV + Rs * Is;
  if (!Number.isFinite(upper)) return null;
  // In deep reverse bias Rs·Is can be smaller than one ulp of V. Then the
  // physical junction/terminal difference is not representable in binary64;
  // the directly evaluated reverse saturation current remains meaningful.
  if (lower === upper) {
    const currentA = Is * Math.expm1(terminalVoltageV / eta);
    return Number.isFinite(currentA)
      ? { terminalVoltageV, junctionVoltageV: terminalVoltageV, currentA } : null;
  }
  for (let iteration = 0; iteration < 100; iteration++) {
    const middle = lower + (upper - lower) / 2;
    if (middle === lower || middle === upper) break;
    const currentA = Is * Math.expm1(middle / eta);
    const calculatedTerminal = middle + Rs * currentA;
    if (calculatedTerminal < terminalVoltageV) lower = middle;
    else upper = middle;
  }
  const junctionVoltageV = lower + (upper - lower) / 2;
  const currentA = Is * Math.expm1(junctionVoltageV / eta);
  if (![junctionVoltageV, currentA].every(Number.isFinite)) return null;
  return { terminalVoltageV, junctionVoltageV, currentA };
}

/**
 * Prove the exact three-device series loop before drawing I=(E-V)/R.
 * A capacitor across the diode is allowed because it is open at DC.
 * Source and resistor polarities may be reversed; E is signed so diode
 * current remains positive from its anode p to cathode n.
 */
export function eligibleLoadLine(document: NonlinearDocument, diodeId: string): LoadLine | null {
  const devices = document.circuit.components;
  const diodes = devices.filter(c => c.type === 'D');
  const resistors = devices.filter(c => c.type === 'R');
  const sources = devices.filter(c => c.type === 'V');
  const capacitors = devices.filter(c => c.type === 'C');
  if (diodes.length !== 1 || diodes[0]!.id !== diodeId || resistors.length !== 1 || sources.length !== 1 ||
      devices.length !== 3 + capacitors.length) return null;
  const diode = diodes[0]!, resistor = resistors[0]!, source = sources[0]!;
  if (capacitors.some(c => !((c.p === diode.p && c.n === diode.n) ||
      (c.p === diode.n && c.n === diode.p)))) return null;
  const other = (p: string, n: string, shared: string): string | null =>
    p === shared && n !== shared ? n : n === shared && p !== shared ? p : null;
  const sourceDC = document.experiment.sources.find(s => s.id === source.id)?.dc;
  if (sourceDC === undefined) return null;
  let sourceVoltageV: number | null = null;
  const upstream = other(resistor.p, resistor.n, diode.p);
  if (upstream && other(source.p, source.n, upstream) === diode.n)
    sourceVoltageV = source.p === upstream ? sourceDC : -sourceDC;
  const downstream = other(resistor.p, resistor.n, diode.n);
  if (downstream && other(source.p, source.n, downstream) === diode.p)
    sourceVoltageV = source.p === diode.p ? sourceDC : -sourceDC;
  if (sourceVoltageV === null || !Number.isFinite(sourceVoltageV) || !('value' in resistor)) return null;
  return { sourceId: source.id, resistorId: resistor.id, diodeId,
    sourceVoltageV, resistanceOhm: resistor.value };
}
