import { complex, type Complex } from './complex.js';
import { type Assembly } from './assembly.js';
import { describeSolution, inputValues, type AnalysisResult, type Solution } from './analysis.js';
import { validateExperiment, type Experiment } from './model.js';
import { dot, matvec, residuals, solveReal, tolerances, type Label, type LinearFailure, type LinearSuccess, type Tolerances } from './numeric.js';

export interface InitializationFailure {
  status: 'unsupported-initialization'; message: string; cause: LinearFailure | { status: string; message: string };
}
export interface Initialized { status: 'ok'; solution: Solution; storageValues: number[]; storageRates: number[] }
/**
 * Find an instantaneous state compatible with prescribed capacitor voltages
 * and inductor currents q (V and A respectively) at real source values u.
 * Assembly supplies E=F*S. Solve the (N+M)×(N+M) augmented system
 * [K F; S 0][x; qdot]=[Bu; q], rather than inverting possibly singular E.
 * The top rows retain physical KCL/branch laws; the lower rows enforce q=Sx.
 * Nonunique, contradictory, impulsive, and unsupported high-index starts are
 * explicit failures. See the RC/RLC and ideal-forcing acceptance cases.
 */
export function initialize(a: Assembly, u: Complex[], q: number[], options: Partial<Tolerances> = {}): Initialized | InitializationFailure {
  const n = a.unknowns.length;
  const m = a.storage.length;
  if (q.length !== m || q.some(v => !Number.isFinite(v)) || u.length !== a.inputs.length || u.some(v => v.im !== 0 || !Number.isFinite(v.re)))
    throw new RangeError('Initializer requires finite real inputs and one value per storage element');
  const matrix = a.K.map((row, i) => [...row, ...a.storage.map(s => s.F[i]!)]);
  for (const s of a.storage) matrix.push([...s.S, ...Array<number>(m).fill(0)]);
  const rhs = [...matvec(a.B, u.map(v => v.re)), ...q];
  const labels: Label[] = [...a.rows, ...a.storage.map(s => ({ id: `initial(${s.id})`, unit: s.unit, description: 'Prescribed storage state' }))];
  const linear = solveReal(matrix, rhs, options);
  if (linear.status !== 'ok') return { status: 'unsupported-initialization',
    message: 'Storage state and algebraic constraints do not define a unique finite initialization. Ideal impulses, dependent storage constraints, and high-index initialization are unsupported.', cause: linear };
  const rows = residuals(matrix.map(r => r.map(v => complex(v))), rhs.map(v => complex(v)), linear.x, labels, options);
  const storageRates = linear.x.slice(n).map(v => v.re);
  const caps = new Map<string, Complex>();
  a.storage.forEach((s, i) => {
    const d = a.circuit.components.find(d => d.id === s.id)!;
    if (d.type === 'C') caps.set(s.id, complex(d.value * storageRates[i]!));
  });
  const solution = describeSolution(a, u, { ...linear, x: linear.x.slice(0, n) }, rows, caps, options);
  if (solution.status !== 'ok') return { status: 'unsupported-initialization', message: 'Initialization residual check failed', cause: solution };
  return { status: 'ok', solution, storageValues: q, storageRates };
}
export interface TransientOptions {
  start?: number; stop: number; step: number; maxSteps?: number; tolerances?: Partial<Tolerances>;
}
export interface TimeSample extends Solution {
  time: number; side: 'left' | 'right' | 'regular';
  currentConvention: 'instantaneous-compatible' | 'backward-Euler-at-end-of-interval';
}
export interface TransientSuccess {
  status: 'ok'; samples: TimeSample[];
  initialization: { kind: Experiment['initial']['kind']; storageValues: Record<string, number>; method: string };
  method: 'backward-Euler'; requestedStep: number; tolerances: Tolerances;
}
export type TransientFailure = (InitializationFailure | LinearFailure | { status: 'step-limit'; message: string }) & { time: number; samples: TimeSample[] };
export type TransientResult = TransientSuccess | TransientFailure;
/**
 * Integrate E xdot + K x = B u by backward Euler on finite real time (s).
 * Preserve storage continuity at scheduled source steps: record the left
 * limit, then solve compatible right-side algebraic variables and rates.
 * Each regular endpoint solves (K+E/h)x_next=Bu_next+Ex_previous/h.
 * Residual checks use A and V units; first-order time error is not hidden by
 * the linear-solve tolerance. Step limits and incompatible events fail openly.
 */
export function transient(a: Assembly, e: Experiment, config: TransientOptions): TransientResult {
  validateExperiment(e, a.circuit);
  const start = config.start ?? 0;
  const { stop, step } = config;
  const maxSteps = config.maxSteps ?? 100000;
  const tol = tolerances(config.tolerances);
  if (![start, stop, step].every(Number.isFinite) || step <= 0 || stop <= start || !Number.isInteger(maxSteps) || maxSteps < 1)
    throw new RangeError('Require finite start < stop, positive step, and positive integer maxSteps');
  const samples: TimeSample[] = [];
  const left = inputValues(a, e, 'time', start, 'left');
  let q: number[];
  let equilibrium: LinearSuccess | undefined;
  if (e.initial.kind === 'equilibrium') {
    const dc = solveReal(a.K, matvec(a.B, left.map(v => v.re)), tol);
    if (dc.status !== 'ok') return { status: 'unsupported-initialization', message: 'No unique equilibrium at the left starting source values', cause: dc, time: start, samples };
    equilibrium = dc;
    q = a.storage.map(s => dot(s.S, dc.x.map(v => v.re)));
  } else {
    const initial = e.initial;
    q = a.storage.map(s => initial.values.find(v => v.id === s.id)!.value);
  }
  const initialization = { kind: e.initial.kind, storageValues: Object.fromEntries(a.storage.map((s, i) => [s.id, q[i]!])),
    method: 'Solve [K F; S 0] with E=F*S; storage voltages/currents prescribed and algebraic variables recomputed' };
  let initialized = initialize(a, left, q, tol);
  // A constant-source equilibrium already supplies x and zero storage rates. This
  // also admits a voltage-clamped capacitor at rest, without claiming a general
  // high-index initializer. A subsequent conflicting step still goes through the
  // continuity-constrained initializer and is rejected at the event itself.
  const constantBeforeStart = e.sources.every(s => s.waveform?.type !== 'sinusoid'
    || s.waveform.amplitudePeak === 0 || s.waveform.frequencyHz === 0);
  if (initialized.status !== 'ok' && initialized.cause.status === 'nonunique' && equilibrium && constantBeforeStart) {
    const rhs = matvec(a.B, left.map(v => v.re));
    const rows = residuals(a.K.map(r => r.map(v => complex(v))), rhs.map(v => complex(v)), equilibrium.x, a.rows, tol);
    const caps = new Map(a.circuit.components.filter(c => c.type === 'C').map(c => [c.id, complex(0)]));
    const solution = describeSolution(a, left, equilibrium, rows, caps, tol);
    if (solution.status === 'ok') {
      initialized = { status: 'ok', solution, storageValues: q, storageRates: q.map(() => 0) };
      initialization.method = 'Unique constant-source DC equilibrium with zero storage rates; event restart still enforces storage continuity';
    }
  }
  if (initialized.status !== 'ok') return { ...initialized, time: start, samples };
  // Every scheduled step is a segment boundary. Deduplicate simultaneous
  // source events, but retain exact event times for left/right samples.
  const events = [...new Set(e.sources.flatMap(s =>
    s.waveform?.type === 'step' && s.waveform.at >= start && s.waveform.at <= stop
      ? [s.waveform.at] : []))].sort((a, b) => a - b);
  let current = initialized.solution;
  let time = start;
  const push = (solution: Solution, side: TimeSample['side'], currentConvention: TimeSample['currentConvention']) => {
    samples.push({ ...solution, time, side, currentConvention });
  };
  push(current, events.includes(start) ? 'left' : 'regular', 'instantaneous-compatible');
  const restart = (): InitializationFailure | undefined => {
    const q = a.storage.map(s => dot(s.S, current.x.map(v => v.re)));
    const right = initialize(a, inputValues(a, e, 'time', time, 'right'), q, tol);
    if (right.status !== 'ok') return right;
    current = right.solution; push(current, 'right', 'instantaneous-compatible');
    return undefined;
  };
  if (events.includes(start)) {
    const failure = restart(); if (failure) return { ...failure, time, samples };
  }
  let steps = 0;
  let segmentStart = start;
  let segmentStep = 0;
  while (time < stop) {
    if (steps++ >= maxSteps) return { status: 'step-limit', message: 'Maximum step count exceeded', time, samples };
    const boundary = events.find(t => t > time) ?? stop;
    // Integer-indexed segment grid avoids accumulated t += h drift and tiny final steps.
    let next = Math.min(segmentStart + (++segmentStep) * step, boundary, stop);
    const target = Math.min(boundary, stop);
    // Avoid a spurious final roundoff-sized step, without coalescing distinct scheduled events.
    if (next < target && target - next <= 8 * Number.EPSILON * Math.max(Math.abs(target), Math.abs(time), step)) next = target;
    const h = next - time;
    if (h <= 0) return { status: 'step-limit', message: 'Step cannot advance representable time', time, samples };
    const event = events.includes(next);
    const u = inputValues(a, e, 'time', next, event ? 'left' : 'right');
    // Divide the specified BE equation by h so residual rows retain A and V units.
    const matrix = a.K.map((row, i) => row.map((v, j) => v + a.E[i]![j]! / h));
    const previous = current.x.map(v => v.re);
    const rhs = matvec(a.B, u.map(v => v.re)).map((v, i) => v + dot(a.E[i]!, previous) / h);
    const linear = solveReal(matrix, rhs, tol);
    if (linear.status !== 'ok') return { ...linear, time: next, samples };
    const caps = new Map<string, Complex>();
    for (const s of a.storage) {
      const d = a.circuit.components.find(d => d.id === s.id)!;
      if (d.type === 'C') caps.set(s.id, complex(d.value * (dot(s.S, linear.x.map(v => v.re)) - dot(s.S, previous)) / h));
    }
    const physicalRows = residuals(matrix.map(r => r.map(v => complex(v))), rhs.map(v => complex(v)), linear.x, a.rows, tol);
    const result: AnalysisResult = describeSolution(a, u, linear, physicalRows, caps, tol);
    if (result.status !== 'ok') return { ...result, time: next, samples };
    current = result; time = next;
    push(current, event ? 'left' : 'regular', 'backward-Euler-at-end-of-interval');
    if (event) {
      const failure = restart(); if (failure) return { ...failure, time, samples };
      segmentStart = time; segmentStep = 0;
    }
  }
  return { status: 'ok', samples, initialization, method: 'backward-Euler', requestedStep: step, tolerances: tol };
}
