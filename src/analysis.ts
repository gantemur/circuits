import { add, complex, finiteComplex, mul, polar, scale, type Complex } from './complex.js';
import { currentRow, type Assembly, type OutputRow } from './assembly.js';
import { sourceAt, validateExperiment, type Experiment } from './model.js';
import { complexDot, complexMatvec, dot, residuals, solveLinear, solveReal, type ComplexMatrix,
  type Label, type LinearFailure, type LinearSuccess, type Residual, type Tolerances, type Unit } from './numeric.js';

export interface Measurement { value: Complex; unit: Unit; magnitude: number; phaseRadians: number }
export interface TransferMeasurement extends Omit<Measurement, 'unit'> { unit: `${Unit}/${Unit}` }
export interface Solution {
  status: 'ok'; x: Complex[]; unknowns: Record<string, Measurement>; observations: Record<string, Measurement>;
  residuals: Residual[]; groundKcl: Residual;
  diagnostics: { scaledBackwardResidual: number; pivotRatio: number; scaling: string };
}
export type AnalysisResult = Solution | LinearFailure;
export const scalingDescription = 'Infinity norms after row maximum and column maximum equilibration; z=columnDiv*x. Zero/zero residual is 0. Pivot ratio is not a condition-number estimate.';
export const measurement = (value: Complex, unit: Unit): Measurement => ({ value, unit, ...polar(value) });
/** Map every independent source coordinate to DC, RMS AC, or time value. */
export function inputValues(a: Assembly, e: Experiment, mode: 'dc' | 'ac' | 'time', time = 0, side: 'left' | 'right' = 'right'): Complex[] {
  validateExperiment(e, a.circuit);
  return a.inputs.map(input => {
    const s = e.sources.find(s => s.id === input.id)!;
    return mode === 'ac' ? (s.ac ?? complex(0)) : complex(mode === 'dc' ? s.dc : sourceAt(s, time, side));
  });
}
export function outputValue(row: OutputRow | ReturnType<typeof currentRow>, x: Complex[], u: Complex[], capacitorCurrents: Map<string, Complex>): Complex {
  return row.kind === 'derivative' ? capacitorCurrents.get(row.component)!
    : add(complexDot(row.C, x), complexDot(row.D, u));
}
/**
 * Evaluate y=Cx+Du (and capacitor-rate currents), then check physical rows.
 * MNA omits ground voltage/KCL from the solve; reconstruct ground KCL by
 * summing all p→n device currents touching node 0. A successful scaled solve
 * is not enough if an unscaled A/V residual or output exceeds numeric range.
 */
export function describeSolution(a: Assembly, u: Complex[], linear: LinearSuccess, rows: Residual[], capacitorCurrents: Map<string, Complex>, options: Partial<Tolerances> = {}): AnalysisResult {
  const x = linear.x;
  const observations = Object.fromEntries(a.outputs.map(o => [o.id, measurement(outputValue(o, x, u, capacitorCurrents), o.unit)]));
  const unknowns = Object.fromEntries(a.unknowns.map((o, i) => [o.id, measurement(x[i]!, o.unit)]));
  const groundTerms: Complex[] = [];
  for (const d of a.circuit.components) {
    const i = outputValue(currentRow(a, d), x, u, capacitorCurrents);
    if (d.p === '0') groundTerms.push(i);
    if (d.n === '0') groundTerms.push(scale(i, -1));
  }
  const groundKcl = residuals([groundTerms], [complex(0)], groundTerms.map(() => complex(1)),
    [{ id: 'KCL(0)', unit: 'A', description: 'Reconstructed reference-node balance' }], options)[0]!;
  const failed = [...rows, groundKcl].find(r => !r.passed);
  if (failed || Object.values(observations).some(o => !finiteComplex(o.value)))
    return { status: 'ill-conditioned', message: failed
      ? `${failed.label}: residual ${failed.absolute} ${failed.unit} exceeds tolerance ${failed.tolerance} ${failed.unit}`
      : 'An observation exceeds numeric range', rank: linear.rank, size: linear.size, residuals: [...rows, groundKcl] };
  return { status: 'ok', x, observations, unknowns, residuals: rows, groundKcl,
    diagnostics: { scaledBackwardResidual: linear.scaledBackwardResidual, pivotRatio: linear.pivotRatio, scaling: scalingDescription } };
}
/** Solve (K+sE)x=Bu; s=0 gives DC, s=jω gives the RMS phasor response. */
function solveAt(a: Assembly, s: Complex, u: Complex[], options: Partial<Tolerances>): AnalysisResult {
  if (!finiteComplex(s)) throw new RangeError('s must have finite real and imaginary parts');
  const matrix: ComplexMatrix = a.K.map((r, i) => r.map((v, j) => add(complex(v), scale(s, a.E[i]![j]!))));
  const rhs = complexMatvec(a.B, u), linear = solveLinear(matrix, rhs, options);
  if (linear.status !== 'ok') return linear;
  const capacitorCurrents = new Map(a.circuit.components.filter(c => c.type === 'C').map(c => {
    const row = currentRow(a, c);
    return [c.id, row.kind === 'derivative' ? mul(s, complexDot(row.Q, linear.x)) : complex(0)];
  }));
  return describeSolution(a, u, linear, residuals(matrix, rhs, linear.x, a.rows, options), capacitorCurrents, options);
}
export const solveDC = (a: Assembly, e: Experiment, options: Partial<Tolerances> = {}): AnalysisResult => solveAt(a, complex(0), inputValues(a, e, 'dc'), options);
export const solveFrequency = (a: Assembly, e: Experiment, s: Complex, options: Partial<Tolerances> = {}): AnalysisResult => solveAt(a, s, inputValues(a, e, 'ac'), options);
export function acSweep(a: Assembly, e: Experiment, frequenciesHz: number[], options: Partial<Tolerances> = {}) {
  return frequenciesHz.map(frequencyHz => {
    if (!Number.isFinite(frequencyHz) || frequencyHz < 0) throw new RangeError('Frequency must be finite nonnegative Hz');
    return { frequencyHz, result: solveFrequency(a, e, complex(0, 2 * Math.PI * frequencyHz), options) };
  });
}
/**
 * Zero-state response per unit selected independent input. Other independent
 * source coordinates are zeroed for this experiment; controlled-source laws
 * remain in K. The ratio has output/input units and says nothing by itself
 * about hidden realization stability.
 */
export function transfer(a: Assembly, input: string, output: string, s: Complex, options: Partial<Tolerances> = {}):
  (Solution & { transfer: TransferMeasurement; input: string; output: string; initial: 'zero-state' }) | LinearFailure {
  const j = a.inputs.findIndex(i => i.id === input);
  if (j < 0 || !a.outputs.some(o => o.id === output)) throw new RangeError('Unknown transfer input or output');
  const result = solveAt(a, s, a.inputs.map((_, i) => complex(i === j ? 1 : 0)), options);
  if (result.status !== 'ok') return result;
  const observed = result.observations[output]!;
  return { ...result, transfer: { ...observed, unit: `${observed.unit}/${a.inputs[j]!.unit}` }, input, output, initial: 'zero-state' };
}
export interface FirstOrderTransfer {
  status: 'ok'; evidence: 'algebraically-derived-numeric-coefficients';
  dynamicCoordinate: Label; input: string; output: string;
  e: number; kr: number; br: number; cr: number; dr: number;
  numerator: [number, number]; denominator: [number, number];
  denominatorRoot: number; cancellation: boolean;
  note: string;
}
export interface NotSupported { status: 'not-supported'; message: string; reason?: 'derivative-observation' | 'storage-structure' | 'algebraic-block' | 'numeric-range' }
/**
 * Restricted one-storage-coordinate algebraic elimination. Partition x into
 * dynamic coordinate z and algebraic coordinates w. Solve Kww*v=Kwz and
 * Kww*b=Bw, then substitute w=b*u-v*z. This yields
 * (e*s+kr)z=br*u and y=cr*z+dr*u. Numerator/denominator coefficients are in
 * ascending powers of s. A derivative output, another E structure, singular
 * algebraic block, or nonfinite coefficient returns an explicit limitation.
 * No rational fitting, general symbolic algebra, or stability proof occurs.
 */
export function extractFirstOrder(a: Assembly, input: string, output: string, options: Partial<Tolerances> = {}): FirstOrderTransfer | NotSupported {
  const j = a.inputs.findIndex(i => i.id === input), o = a.outputs.find(o => o.id === output);
  if (j < 0 || !o) throw new RangeError('Unknown transfer input or output');
  if (o.kind !== 'fixed') return { status: 'not-supported', reason: 'derivative-observation', message: 'Derivative observations require numerical frequency evaluation' };
  const entries = a.E.flatMap((r, i) => r.flatMap((v, j) => v === 0 ? [] : [{ i, j, v }]));
  if (a.storage.length !== 1 || entries.length !== 1 || entries[0]!.i !== entries[0]!.j)
    return { status: 'not-supported', reason: 'storage-structure', message: 'Requires one storage element and one nonzero diagonal E entry' };
  const z = entries[0]!.i;
  const e = entries[0]!.v;
  const w = a.unknowns.map((_, i) => i).filter(i => i !== z);
  // w lists original unknown indices, excluding dynamic coordinate z.
  const Kww = w.map(i => w.map(k => a.K[i]![k]!));
  const v = solveReal(Kww, w.map(i => a.K[i]![z]!), options);
  const b = solveReal(Kww, w.map(i => a.B[i]![j]!), options);
  if (v.status !== 'ok' || b.status !== 'ok') return { status: 'not-supported', reason: 'algebraic-block', message: 'Algebraic K block is singular or numerically ill-conditioned' };
  const vz = v.x.map(v => v.re), bz = b.x.map(v => v.re);
  const Kzw = w.map(i => a.K[z]![i]!), Cw = w.map(i => o.C[i]!);
  const kr = a.K[z]![z]! - dot(Kzw, vz);
  const br = a.B[z]![j]! - dot(Kzw, bz);
  const cr = o.C[z]! - dot(Cw, vz);
  const dr = o.D[j]! + dot(Cw, bz);
  const numerator: [number, number] = [dr * kr + cr * br, dr * e], denominator: [number, number] = [kr, e];
  if (![e, kr, br, cr, dr, ...numerator, -kr / e].every(Number.isFinite))
    return { status: 'not-supported', reason: 'numeric-range', message: 'Reduction coefficients exceed numeric range' };
  return { status: 'ok', evidence: 'algebraically-derived-numeric-coefficients', dynamicCoordinate: a.unknowns[z]!,
    input, output, e, kr, br, cr, dr, numerator, denominator, denominatorRoot: -kr / e, cancellation: cr * br === 0,
    note: 'Root of the unreduced scalar denominator. A canceled input-output pole does not establish internal stability; no realization-wide pole computation.' };
}
