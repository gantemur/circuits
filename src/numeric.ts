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

/** Dense, equilibrated, complete-pivot Gaussian elimination. Never inverts or regularizes. */
export function solveLinear(matrix: ComplexMatrix, rhs: Complex[], options: Partial<Tolerances> = {}): LinearResult {
  const t = tolerances(options), n = matrix.length;
  if (rhs.length !== n || matrix.some(r => r.length !== n)) throw new RangeError('Expected square system');
  const fail = (status: LinearFailure['status'], message: string, rank: number): LinearFailure => ({ status, message, rank, size: n });
  if (matrix.some(r => r.some(v => !finiteComplex(v))) || rhs.some(v => !finiteComplex(v)))
    return fail('ill-conditioned', 'Nonfinite matrix or right-hand side (numeric range exceeded)', 0);
  if (n === 0) return { status: 'ok', x: [], rank: 0, size: 0, scaledBackwardResidual: 0, pivotRatio: 1 };
  const rowDiv = matrix.map(r => Math.max(...r.map(abs)) || 1);
  if (rowDiv.some(v => !Number.isFinite(v))) return fail('ill-conditioned', 'Coefficient magnitude exceeds numeric range', 0);
  const rowScaled = matrix.map((r, i) => r.map(v => complex(v.re / rowDiv[i]!, v.im / rowDiv[i]!)));
  const colDiv = Array.from({ length: n }, (_, j) => Math.max(...rowScaled.map(r => abs(r[j]!))) || 1);
  const original = rowScaled.map(r => r.map((v, j) => complex(v.re / colDiv[j]!, v.im / colDiv[j]!)));
  const originalB = rhs.map((v, i) => complex(v.re / rowDiv[i]!, v.im / rowDiv[i]!));
  if (original.some(r => r.some(v => !finiteComplex(v))) || originalB.some(v => !finiteComplex(v)))
    return fail('ill-conditioned', 'Equilibration exceeded numeric range', 0);
  const a = original.map(r => r.map(v => ({ ...v }))), b = originalB.map(v => ({ ...v }));
  const order = Array.from({ length: n }, (_, i) => i);
  let smallestPivot = Infinity, largestPivot = 0;
  for (let k = 0; k < n; k++) {
    let best = 0, pr = k, pc = k;
    for (let i = k; i < n; i++) for (let j = k; j < n; j++) {
      const v = abs(a[i]![j]!);
      if (v > best) { best = v; pr = i; pc = j; }
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
    [a[k], a[pr]] = [a[pr]!, a[k]!]; [b[k], b[pr]] = [b[pr]!, b[k]!];
    for (const row of a) [row[k], row[pc]] = [row[pc]!, row[k]!];
    [order[k], order[pc]] = [order[pc]!, order[k]!];
    const pivot = a[k]![k]!;
    smallestPivot = Math.min(smallestPivot, best); largestPivot = Math.max(largestPivot, best);
    for (let i = k + 1; i < n; i++) {
      const f = div(a[i]![k]!, pivot); a[i]![k] = complex(0);
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
  const z = Array.from({ length: n }, () => complex(0));
  order.forEach((j, i) => { z[j] = reordered[i]!; });
  const x = z.map((v, j) => complex(v.re / colDiv[j]!, v.im / colDiv[j]!));
  if (x.some(v => !finiteComplex(v))) return fail('ill-conditioned', 'Solution exceeded numeric range', n);
  const numerator = Math.max(...original.map((r, i) => abs(sub(originalB[i]!, r.reduce((s, v, j) => add(s, mul(v, z[j]!)), complex(0))))));
  const matrixNorm = Math.max(...original.map(r => r.reduce((s, v) => s + abs(v), 0)));
  const denominator = matrixNorm * Math.max(...z.map(abs)) + Math.max(...originalB.map(abs));
  if (!Number.isFinite(denominator)) return fail('ill-conditioned', 'Backward-residual norm exceeds numeric range', n);
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
/** Physical (unscaled) rows: amperes for KCL, volts for device constraints. */
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
