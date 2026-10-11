import { abs, add, complex, div, finiteComplex, mul, scale, sub, type Complex } from './complex.js';

export type Matrix = number[][];
export type ComplexMatrix = Complex[][];
export type Unit = 'V' | 'A';
export interface Label { id: string; unit: Unit; description: string }
export interface Tolerances { relative: number; voltageAbsolute: number; currentAbsolute: number; pivot: number }
export const defaultTolerances: Readonly<Tolerances> = Object.freeze({
  relative: 1e-8, voltageAbsolute: 1e-9, currentAbsolute: 1e-12, pivot: 1e-12,
});
export function tolerances(options: Partial<Tolerances> = {}): Tolerances {
  const t = { ...defaultTolerances, ...options };
  if (Object.values(t).some(x => !Number.isFinite(x) || x <= 0) || t.pivot >= 1)
    throw new RangeError('Tolerances must be finite and positive; pivot must be less than 1');
  return t;
}
export const zeros = (rows: number, columns = rows): Matrix => Array.from({ length: rows }, () => Array<number>(columns).fill(0));
export const dot = (a: number[], b: number[]): number => a.reduce((s, v, i) => s + v * b[i]!, 0);
export const matvec = (a: Matrix, x: number[]): number[] => a.map(row => dot(row, x));
export const complexDot = (a: number[], x: Complex[]): Complex => a.reduce((s, v, i) => add(s, scale(x[i]!, v)), complex(0));
export const complexMatvec = (a: Matrix, x: Complex[]): Complex[] => a.map(row => complexDot(row, x));
export interface LinearFailure {
  status: 'inconsistent' | 'nonunique' | 'ill-conditioned';
  message: string; rank: number; size: number;
  residuals?: Residual[];
}
export interface LinearSuccess {
  status: 'ok'; x: Complex[]; rank: number; size: number;
  scaledBackwardResidual: number; pivotRatio: number;
}
export type LinearResult = LinearSuccess | LinearFailure;

/**
 * Solve A x = b for a small dense square complex system. Entries may carry
 * mixed physical row units (KCL in A, device constraints in V); equilibration
 * makes the pivot test dimensionless without changing the reported solution.
 * Rows are divided by their largest coefficient, then columns by their
 * largest row-scaled coefficient. With z = columnDiv * x, solve the scaled
 * system for z and undo column scaling afterward.
 *
 * Complete pivoting permutes both equations and unknowns. A zero pivot is
 * classified as inconsistent or nonunique only when the remaining RHS is
 * decisive; a tiny nonzero pivot is numerically uncertain. The returned
 * backward residual and pivot ratio are diagnostics, not forward-error or
 * condition-number guarantees. No inverse or regularization is formed.
 * This is an in-repository implementation with no external solver dependency.
 * Independent analytic and singular-system checks live in
 * test/validation-numeric.test.mjs and test/acceptance.test.mjs.
 */
export function solveLinear(matrix: ComplexMatrix, rhs: Complex[], options: Partial<Tolerances> = {}): LinearResult {
  const t = tolerances(options);
  const n = matrix.length;
  if (rhs.length !== n || matrix.some(r => r.length !== n)) throw new RangeError('Expected square system');
  const fail = (status: LinearFailure['status'], message: string, rank: number): LinearFailure => ({ status, message, rank, size: n });
  if (matrix.some(r => r.some(v => !finiteComplex(v))) || rhs.some(v => !finiteComplex(v)))
    return fail('ill-conditioned', 'Nonfinite matrix or right-hand side (numeric range exceeded)', 0);
  if (n === 0) return { status: 'ok', x: [], rank: 0, size: 0, scaledBackwardResidual: 0, pivotRatio: 1 };
  // An all-zero row/column uses divisor 1 so its rank information survives.
  const rowDiv = matrix.map(r => Math.max(...r.map(abs)) || 1);
  if (rowDiv.some(v => !Number.isFinite(v))) return fail('ill-conditioned', 'Coefficient magnitude exceeds numeric range', 0);
  // First scale each equation, then scale each unknown column of those rows.
  const rowScaled = matrix.map((r, i) => r.map(v => complex(v.re / rowDiv[i]!, v.im / rowDiv[i]!)));
  const colDiv = Array.from({ length: n }, (_, j) => Math.max(...rowScaled.map(r => abs(r[j]!))) || 1);
  // "original" here means untouched *equilibrated* coefficients, retained
  // for a backward-residual check after elimination mutates the work matrix.
  const original = rowScaled.map(r => r.map((v, j) => complex(v.re / colDiv[j]!, v.im / colDiv[j]!)));
  const originalB = rhs.map((v, i) => complex(v.re / rowDiv[i]!, v.im / rowDiv[i]!));
  if (original.some(r => r.some(v => !finiteComplex(v))) || originalB.some(v => !finiteComplex(v)))
    return fail('ill-conditioned', 'Equilibration exceeded numeric range', 0);
  const a = original.map(r => r.map(v => ({ ...v })));
  const b = originalB.map(v => ({ ...v }));
  // order[k] is the original unknown index now occupying column k.
  const order = Array.from({ length: n }, (_, i) => i);
  let smallestPivot = Infinity;
  let largestPivot = 0;
  for (let k = 0; k < n; k++) {
    // Search the remaining square block, not only the current column.
    let best = 0;
    let pivotRow = k;
    let pivotColumn = k;
    for (let i = k; i < n; i++) {
      for (let j = k; j < n; j++) {
        const magnitude = abs(a[i]![j]!);
        if (magnitude > best) {
          best = magnitude;
          pivotRow = i;
          pivotColumn = j;
        }
      }
    }
    if (!Number.isFinite(best) || b.some(v => !finiteComplex(v))) return fail('ill-conditioned', 'Elimination exceeded numeric range', k);
    if (best <= t.pivot) {
      if (best !== 0) return fail('ill-conditioned', `Scaled pivot ${best} is below ${t.pivot}; rank is numerically uncertain`, k);
      const bScale = Math.max(...originalB.map(abs));
      const inconsistent = b.slice(k).some(v => abs(v) > t.pivot * bScale);
      if (!inconsistent && b.slice(k).some(v => abs(v) !== 0))
        return fail('ill-conditioned', 'Tiny residual in a rank-deficient constraint; consistency is numerically uncertain', k);
      return fail(inconsistent ? 'inconsistent' : 'nonunique', inconsistent
        ? 'Zero constraint row has a nonzero right-hand side; constraints are inconsistent'
        : 'Rank-deficient system: unknowns (including separate ideal-source currents) are not unique', k);
    }
    // Row swaps move equations; column swaps move unknown coordinates.
    [a[k], a[pivotRow]] = [a[pivotRow]!, a[k]!];
    [b[k], b[pivotRow]] = [b[pivotRow]!, b[k]!];
    for (const row of a) [row[k], row[pivotColumn]] = [row[pivotColumn]!, row[k]!];
    [order[k], order[pivotColumn]] = [order[pivotColumn]!, order[k]!];
    const pivot = a[k]![k]!;
    smallestPivot = Math.min(smallestPivot, best);
    largestPivot = Math.max(largestPivot, best);
    for (let i = k + 1; i < n; i++) {
      const f = div(a[i]![k]!, pivot);
      a[i]![k] = complex(0);
      for (let j = k + 1; j < n; j++) a[i]![j] = sub(a[i]![j]!, mul(f, a[k]![j]!));
      b[i] = sub(b[i]!, mul(f, b[k]!));
    }
  }
  const reordered = Array.from({ length: n }, () => complex(0));
  for (let i = n - 1; i >= 0; i--) {
    let v = b[i]!;
    for (let j = i + 1; j < n; j++) v = sub(v, mul(a[i]![j]!, reordered[j]!));
    reordered[i] = div(v, a[i]![i]!);
  }
  // Back substitution follows pivoted column order. Undo that permutation
  // before undoing column equilibration.
  const z = Array.from({ length: n }, () => complex(0));
  order.forEach((j, i) => { z[j] = reordered[i]!; });
  const x = z.map((v, j) => complex(v.re / colDiv[j]!, v.im / colDiv[j]!));
  if (x.some(v => !finiteComplex(v))) return fail('ill-conditioned', 'Solution exceeded numeric range', n);
  // η = ||A_scaled z - b_scaled||∞ /
  //     (||A_scaled||∞ ||z||∞ + ||b_scaled||∞).
  const numerator = Math.max(...original.map((r, i) =>
    abs(sub(originalB[i]!, r.reduce((s, v, j) => add(s, mul(v, z[j]!)), complex(0))))));
  const matrixNorm = Math.max(...original.map(r => r.reduce((s, v) => s + abs(v), 0)));
  const denominator = matrixNorm * Math.max(...z.map(abs)) + Math.max(...originalB.map(abs));
  if (!Number.isFinite(denominator)) return fail('ill-conditioned', 'Backward-residual norm exceeds numeric range', n);
  // 0/0 is the exact homogeneous zero system and has zero residual.
  const eta = denominator === 0 ? (numerator === 0 ? 0 : Infinity) : numerator / denominator;
  if (!Number.isFinite(eta) || eta > t.relative) return fail('ill-conditioned', 'Scaled backward residual exceeds tolerance', n);
  return { status: 'ok', x, rank: n, size: n, scaledBackwardResidual: eta, pivotRatio: smallestPivot / largestPivot };
}
export function solveReal(a: Matrix, b: number[], options: Partial<Tolerances> = {}): LinearResult {
  return solveLinear(a.map(r => r.map(v => complex(v))), b.map(v => complex(v)), options);
}
export interface Residual {
  label: string; unit: Unit; value: Complex; absolute: number; tolerance: number; passed: boolean;
}
/**
 * Check each original equation A x = b after the scaled solve. Labels supply
 * the physical row unit: A for KCL, V for a branch law. The absolute floor has
 * that same unit; the relative part scales with the sum of *un-cancelled*
 * term magnitudes. This detects a large physical residual hidden by a small
 * dimensionless backward error without mixing volts and amperes.
 */
export function residuals(a: ComplexMatrix, b: Complex[], x: Complex[], labels: Label[], options: Partial<Tolerances> = {}): Residual[] {
  const t = tolerances(options);
  return a.map((row, i) => {
    const terms = row.map((v, j) => mul(v, x[j]!));
    const value = sub(terms.reduce(add, complex(0)), b[i]!);
    const reference = Math.max(abs(b[i]!), terms.reduce((s, v) => s + abs(v), 0));
    const label = labels[i]!;
    const tolerance = (label.unit === 'V' ? t.voltageAbsolute : t.currentAbsolute) + t.relative * reference;
    return { label: label.id, unit: label.unit, value, absolute: abs(value), tolerance, passed: abs(value) <= tolerance };
  });
}
