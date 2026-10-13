import { ExactBudget, ExactInputError, ExactResourceError, exactAdd, exactDivide, exactEqual,
  exactMultiply, exactNegate, exactOne, exactString, exactSubtract, exactZero, type Rational } from './exact-rational.js';

/** Ascending powers; [0] is the sole zero polynomial. No numerical trimming. */
export type ExactPolynomial = Rational[];
export interface ExactFunction { numerator: ExactPolynomial; denominator: ExactPolynomial }
export interface RationalFunctionText { numerator: string[]; denominator: string[] }
export function trimPolynomial(p: ExactPolynomial): ExactPolynomial {
  let end = p.length;
  while (end > 1 && p[end - 1]!.n === 0n) end--;
  return end === 0 ? [exactZero] : p.slice(0, end);
}
export const zeroPolynomial = (p: ExactPolynomial): boolean => p.every(q => q.n === 0n);
export const polynomialDegree = (p: ExactPolynomial): number => zeroPolynomial(p) ? -1 : p.length - 1;
function checkPolynomial(p: ExactPolynomial, budget: ExactBudget): void {
  budget.tick();
  // Identity products may have twice the input degree. This is a workspace
  // bound, separate from the reduced target's degree cap of eight.
  if (p.length > 2 * budget.limits.rawDegree + 1) throw new ExactResourceError(budget.stage, 'polynomial workspace degree');
}
export function polynomialAdd(a: ExactPolynomial, b: ExactPolynomial, budget: ExactBudget): ExactPolynomial {
  checkPolynomial(a, budget);
  checkPolynomial(b, budget);
  return trimPolynomial(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => exactAdd(a[i] ?? exactZero, b[i] ?? exactZero, budget)));
}
export function polynomialMultiply(a: ExactPolynomial, b: ExactPolynomial, budget: ExactBudget): ExactPolynomial {
  checkPolynomial(a, budget);
  checkPolynomial(b, budget);
  if (a.length + b.length - 1 > 2 * budget.limits.rawDegree + 1)
    throw new ExactResourceError(budget.stage, 'polynomial product degree');
  const result = Array<Rational>(a.length + b.length - 1).fill(exactZero);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++)
      result[i + j] = exactAdd(result[i + j]!, exactMultiply(a[i]!, b[j]!, budget), budget);
  }
  return trimPolynomial(result);
}
/** Euclidean long division over Q. Cancel the leading monomial exactly;
 * each iteration strictly lowers the remainder degree, including at zero. */
export function polynomialDivide(a: ExactPolynomial, b: ExactPolynomial, budget: ExactBudget): { quotient: ExactPolynomial; remainder: ExactPolynomial } {
  checkPolynomial(a, budget);
  checkPolynomial(b, budget);
  b = trimPolynomial(b);
  if (zeroPolynomial(b)) throw new ExactInputError('Polynomial division by zero');
  let remainder = trimPolynomial(a);
  const quotient = Array<Rational>(Math.max(1, remainder.length - b.length + 1)).fill(exactZero);
  while (!zeroPolynomial(remainder) && remainder.length >= b.length) {
    budget.tick();
    const shift = remainder.length - b.length;
    const coefficient = exactDivide(remainder[remainder.length - 1]!, b[b.length - 1]!, budget);
    quotient[shift] = coefficient;
    for (let j = 0; j < b.length; j++)
      remainder[j + shift] = exactSubtract(remainder[j + shift]!, exactMultiply(coefficient, b[j]!, budget), budget);
    remainder = trimPolynomial(remainder);
  }
  return { quotient: trimPolynomial(quotient), remainder };
}
export function polynomialGcd(a: ExactPolynomial, b: ExactPolynomial, budget: ExactBudget): ExactPolynomial {
  checkPolynomial(a, budget);
  checkPolynomial(b, budget);
  while (!zeroPolynomial(b)) {
    budget.tick();
    const remainder = polynomialDivide(a, b, budget).remainder;
    a = b;
    b = remainder;
  }
  if (zeroPolynomial(a)) return [exactOne];
  const lead = a[a.length - 1]!;
  return a.map(coefficient => exactDivide(coefficient, lead, budget));
}
/** Canonical denominator is monic. GCD cancellation changes neither the
 * meromorphic function nor its removable singularities, and is reported. */
export function reduceFunction(numerator: ExactPolynomial, denominator: ExactPolynomial, budget: ExactBudget): { value: ExactFunction; canceledFactor: ExactPolynomial } {
  numerator = trimPolynomial(numerator);
  denominator = trimPolynomial(denominator);
  if (zeroPolynomial(denominator)) throw new ExactInputError('Zero denominator polynomial');
  const canceledFactor = polynomialGcd(numerator, denominator, budget);
  const n = polynomialDivide(numerator, canceledFactor, budget).quotient;
  const d = polynomialDivide(denominator, canceledFactor, budget).quotient;
  const leading = d[d.length - 1]!;
  return { value: { numerator: n.map(x => exactDivide(x, leading, budget)),
    denominator: d.map(x => exactDivide(x, leading, budget)) }, canceledFactor };
}
export const functionText = (f: ExactFunction): RationalFunctionText => ({
  numerator: f.numerator.map(exactString), denominator: f.denominator.map(exactString) });
export function reciprocalFunction(f: ExactFunction, budget: ExactBudget): ExactFunction {
  return reduceFunction(f.denominator, f.numerator, budget).value;
}
export function addPolynomialToFunction(f: ExactFunction, p: ExactPolynomial, budget: ExactBudget): ExactFunction {
  return reduceFunction(polynomialAdd(f.numerator, polynomialMultiply(p, f.denominator, budget), budget), f.denominator, budget).value;
}
export function subtractPolynomialFromFunction(f: ExactFunction, p: ExactPolynomial, budget: ExactBudget): ExactFunction {
  return addPolynomialToFunction(f, p.map(exactNegate), budget);
}
export function functionsEqual(a: ExactFunction, b: ExactFunction, budget: ExactBudget): boolean {
  const left = polynomialMultiply(a.numerator, b.denominator, budget);
  const right = polynomialMultiply(b.numerator, a.denominator, budget);
  return left.length === right.length && left.every((q, i) => exactEqual(q, right[i]!));
}
export type ExactLimit = { kind: 'finite'; value: string } | { kind: 'pole'; order: number; coefficient: string };
/** Limits are algebraic, not large/small-frequency samples. A pole reports
 * its leading coefficient: F~k/z^order at zero or F~k*z^order at infinity. */
export function functionLimit(f: ExactFunction, at: 'zero' | 'infinity', budget: ExactBudget): ExactLimit {
  if (zeroPolynomial(f.numerator)) return { kind: 'finite', value: '0' };
  const index = (p: ExactPolynomial): number => at === 'infinity' ? p.length - 1 : p.findIndex(x => x.n !== 0n);
  const n = index(f.numerator), d = index(f.denominator);
  const order = at === 'infinity' ? n - d : d - n;
  const coefficient = exactString(exactDivide(f.numerator[n]!, f.denominator[d]!, budget));
  return order > 0 ? { kind: 'pole', order, coefficient }
    : { kind: 'finite', value: order === 0 ? coefficient : '0' };
}
