import { complex } from './complex.js';
import { solveReal, tolerances, type Label, type Matrix, type Tolerances } from './numeric.js';
import type { OperatingPointOptions, OperatingPointFailure, PhysicalResidual, NewtonTrace } from './diode-operating-point.js';

/** Small internal DC contract: labeled A/V equations, not a device registry. */
export interface DcLabels { unknowns: Label[]; rows: Label[] }
export interface DcEvaluation {
  residual: number[]; jacobian: Matrix; terms: number[][]; physicalTerms: number[][];
  additionalArithmeticAllowances?: number[];
}
export function dcSettings(options: OperatingPointOptions, system: DcLabels, defaultScale: number): Required<Omit<OperatingPointOptions, 'initialGuess' | 'tolerance'>> &
  { initialGuess: number[]; tolerance: Tolerances } {
  const maxIterations = options.maxIterations ?? 60;
  const maxBacktracks = options.maxBacktracks ?? 30;
  const currentScaleA = options.currentScaleA ?? defaultScale;
  const voltageScaleV = options.voltageScaleV ?? 1;
  if (![maxIterations, maxBacktracks].every(v => Number.isSafeInteger(v) && v > 0) ||
    !Number.isFinite(currentScaleA) || currentScaleA <= 0 ||
    !Number.isFinite(voltageScaleV) || voltageScaleV <= 0)
    throw new RangeError('Iteration limits and physical merit scales must be finite and positive');
  const initialGuess = options.initialGuess ?? Array<number>(system.unknowns.length).fill(0);
  if (!Array.isArray(initialGuess) || initialGuess.length !== system.unknowns.length || initialGuess.some(v => !Number.isFinite(v)))
    throw new RangeError('Initial guess must have one finite coordinate per labeled unknown');
  return { maxIterations, maxBacktracks, currentScaleA, voltageScaleV,
    initialGuess: [...initialGuess], tolerance: tolerances(options.tolerance) };
}
export function physicalRows(system: DcLabels, evaluation: DcEvaluation, t: Tolerances): PhysicalResidual[] {
  return system.rows.map((label, i) => {
    const value = evaluation.residual[i]!;
    const absolute = Math.abs(value);
    const physicalMagnitude = evaluation.physicalTerms[i]!.reduce((sum, term) => sum + Math.abs(term), 0);
    const physicalAllowance = (label.unit === 'A' ? t.currentAbsolute : t.voltageAbsolute) +
      t.relative * physicalMagnitude;
    // Binary64 addition/multiplication and branch-voltage subtraction incur
    // O(eps) error per operation. Expanded operands bound cancellation in the
    // actual Kx-Bu evaluation; the factor covers several operations per term.
    // Both this allowance and the physical allowance have the row's A/V unit.
    const operands = evaluation.terms[i]!;
    const arithmeticAllowance = 8 * (operands.length + 1) * Number.EPSILON *
      operands.reduce((sum, term) => sum + Math.abs(term), 0) +
      (evaluation.additionalArithmeticAllowances?.[i] ?? 0);
    const allowance = physicalAllowance + arithmeticAllowance;
    return { label: label.id, unit: label.unit, value: complex(value), absolute,
      tolerance: allowance, physicalAllowance, arithmeticAllowance,
      passed: Number.isFinite(absolute) && Number.isFinite(allowance) && absolute <= allowance };
  });
}
function merit(system: DcLabels, evaluation: DcEvaluation, currentScaleA: number, voltageScaleV: number): number {
  return Math.max(0, ...evaluation.residual.map((r, i) => Math.abs(r) /
    (system.rows[i]!.unit === 'A' ? currentScaleA : voltageScaleV)));
}
export function dcFailure(code: OperatingPointFailure['code'], message: string, trace: NewtonTrace[], linearStatus?: string): OperatingPointFailure {
  return { status: 'failed', code, message, trace, ...(linearStatus === undefined ? {} : { linearStatus }) };
}

/** Existing DC iteration, shared without changing its arithmetic or stopping rules.
 * Evaluators return original equations; null rejects an out-of-range trial.
 * Physical diagnostics and regularity, never a small step alone, accept a root.
 */
export function solveDcNewton<T extends DcEvaluation>(system: DcLabels,
  config: ReturnType<typeof dcSettings>, evaluate: (x: number[]) => T | null,
  finalCheck?: (x: number[], evaluation: T) => OperatingPointFailure | undefined):
  { status: 'ok'; x: number[]; evaluation: T; trace: NewtonTrace[] } | OperatingPointFailure {
  let x = config.initialGuess;
  let evaluation = evaluate(x);
  const trace: NewtonTrace[] = [];
  let finalFailure: OperatingPointFailure | undefined;
  if (!evaluation) return dcFailure('numeric-range', 'Initial model evaluation exceeds numeric range', trace);
  for (let iteration = 0; iteration <= config.maxIterations; iteration++) {
    const rows = physicalRows(system, evaluation, config.tolerance);
    if (rows.every(row => row.passed)) {
      const regularity = solveReal(evaluation.jacobian, Array<number>(x.length).fill(0), config.tolerance);
      if (regularity.status !== 'ok') return dcFailure('degenerate-jacobian', 'Final Jacobian is singular or unresolved', trace, regularity.status);
      // Three-terminal power may require additional corrections even when
      // tiny leakage currents already fit the ordinary KCL absolute floor.
      // The diode caller supplies no callback and retains its stopping rule.
      finalFailure = finalCheck?.(x, evaluation);
      if (!finalFailure) return { status: 'ok', x, evaluation, trace };
    }
    if (iteration === config.maxIterations) break;
    const correction = solveReal(evaluation.jacobian, evaluation.residual.map(r => -r), config.tolerance);
    if (correction.status !== 'ok') return dcFailure('linearized-system', 'Newton correction system is unresolved', trace, correction.status);
    const delta = correction.x.map(v => v.re);
    if (delta.some((v, i) => !Number.isFinite(v) || correction.x[i]!.im !== 0))
      return dcFailure('numeric-range', 'Newton correction exceeds real numeric range', trace);
    const before = merit(system, evaluation, config.currentScaleA, config.voltageScaleV);
    let accepted = false;
    for (let backtrack = 0; backtrack < config.maxBacktracks; backtrack++) {
      const damping = 2 ** -backtrack;
      const candidate = x.map((value, i) => value + damping * delta[i]!);
      const trial = evaluate(candidate);
      if (!trial) continue;
      const after = merit(system, trial, config.currentScaleA, config.voltageScaleV);
      if (after < before * (1 - 1e-4 * damping)) {
        x = candidate;
        evaluation = trial;
        trace.push({ iteration: iteration + 1, damping, merit: after,
          voltageCorrectionV: Math.max(0, ...delta.map((v, i) => system.unknowns[i]!.unit === 'V' ? Math.abs(damping * v) : 0)),
          currentCorrectionA: Math.max(0, ...delta.map((v, i) => system.unknowns[i]!.unit === 'A' ? Math.abs(damping * v) : 0)) });
        accepted = true;
        break;
      }
    }
    if (!accepted) return dcFailure('line-search', 'No finite merit-decreasing Newton step within backtrack budget', trace);
  }
  if (finalFailure) return { ...finalFailure, trace };
  return dcFailure('iteration-limit', 'Physical residuals did not converge within iteration budget', trace);
}
