import { ExactBudget, ExactInputError, ExactResourceError, exactAdd, exactDivide, exactOne,
  exactString, exactSubtract, parseExact, type Rational } from './exact-rational.js';
import { polynomialDegree, reduceFunction, type ExactFunction, type RationalFunctionText } from './rational-function.js';
import type { RcElement } from './rc-synthesis.js';

interface FosterScales {
  referenceResistanceOhm: string; referenceAngularFrequencyPerSecond: string;
  target?: RationalFunctionText;
}
export interface FosterIDecomposition {
  rInfinity: string; kZero: string; terms: { pole: string; residue: string }[];
}
export interface FosterIIDecomposition {
  gZero: string; cInfinity: string; terms: { pole: string; coefficient: string }[];
}
/** Omission of decomposition requires target and requests an explicitly
 * unavailable factorization, not a sampled or approximated Foster result. */
export type FosterInput = FosterScales & (
  { method: 'foster-I'; quantity: 'impedance'; decomposition: FosterIDecomposition } |
  { method: 'foster-II'; quantity: 'admittance'; decomposition: FosterIIDecomposition } |
  { method: 'foster-I'; quantity: 'impedance'; target: RationalFunctionText; decomposition?: never } |
  { method: 'foster-II'; quantity: 'admittance'; target: RationalFunctionText; decomposition?: never });
export type FosterMethod = FosterInput['method'];
export interface FosterPoleGroup { pole: string; coefficient: string; sourceIndices: number[] }
export interface FosterSection {
  connection: 'resistor' | 'capacitor' | 'parallel-RC' | 'series-RC';
  elements: RcElement[];
}
export interface ParsedFoster {
  method: FosterMethod; quantity: 'impedance' | 'admittance';
  resistance: Rational; frequency: Rational;
  target?: ExactFunction; canceledFactor?: string[];
  decomposition?: { constant: Rational; endpoint: Rational; terms: { pole: Rational; coefficient: Rational; sourceIndices: number[] }[] };
}
export class InvalidFoster extends Error {}
function object(raw: unknown, required: string[], optional: string[] = []): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ExactInputError('Expected object');
  const obj = raw as Record<string, unknown>;
  if (required.some(k => !Object.hasOwn(obj, k)) || Object.keys(obj).some(k => !required.includes(k) && !optional.includes(k)))
    throw new ExactInputError('Missing or unexpected Foster fields');
  return obj;
}
export function checkFosterDegree(value: ExactFunction, budget: ExactBudget): void {
  if (Math.max(polynomialDegree(value.numerator), polynomialDegree(value.denominator)) > budget.limits.degree)
    throw new ExactResourceError(budget.stage, 'reduced degree');
}
/** Parse exact coefficients, enforce domain-specific signs, and canonicalize
 * rates by bounded exact subtraction. Equal-rate positive terms add; close
 * rates remain distinct. Original indices document every combination. */
export function parseFoster(raw: unknown, budget: ExactBudget): ParsedFoster {
  const obj = object(raw, ['method', 'quantity', 'referenceResistanceOhm', 'referenceAngularFrequencyPerSecond'], ['decomposition', 'target']);
  if (!((obj.method === 'foster-I' && obj.quantity === 'impedance') || (obj.method === 'foster-II' && obj.quantity === 'admittance')))
    throw new ExactInputError('Choose impedance Foster I or admittance Foster II');
  const resistance = parseExact(obj.referenceResistanceOhm, budget);
  const frequency = parseExact(obj.referenceAngularFrequencyPerSecond, budget);
  if (resistance.n <= 0n || frequency.n <= 0n) throw new ExactInputError('Positive reference scales required');
  const result: ParsedFoster = { method: obj.method, quantity: obj.quantity, resistance, frequency };
  if (Object.hasOwn(obj, 'target')) {
    budget.stage = 'Foster target canonicalization';
    const target = object(obj.target, ['numerator', 'denominator']);
    const polynomial = (raw: unknown): Rational[] => {
      if (!Array.isArray(raw) || !raw.length) throw new ExactInputError('Nonempty target coefficient array required');
      if (raw.length > budget.limits.rawDegree + 1) throw new ExactResourceError(budget.stage, 'input degree');
      return Array.from(raw, value => parseExact(value, budget));
    };
    const reduced = reduceFunction(polynomial(target.numerator), polynomial(target.denominator), budget);
    checkFosterDegree(reduced.value, budget);
    result.target = reduced.value;
    result.canceledFactor = reduced.canceledFactor.map(exactString);
  }
  if (!Object.hasOwn(obj, 'decomposition')) {
    if (!result.target) throw new ExactInputError('A decomposition or target is required');
    return result;
  }
  budget.stage = 'Foster decomposition canonicalization';
  const first = obj.method === 'foster-I';
  const constantKey = first ? 'rInfinity' : 'gZero';
  const endpointKey = first ? 'kZero' : 'cInfinity';
  const coefficientKey = first ? 'residue' : 'coefficient';
  const data = object(obj.decomposition, [constantKey, endpointKey, 'terms']);
  const constant = parseExact(data[constantKey], budget);
  const endpoint = parseExact(data[endpointKey], budget);
  if (constant.n < 0n || endpoint.n < 0n) throw new InvalidFoster('Endpoint coefficients must be nonnegative');
  if (!Array.isArray(data.terms)) throw new ExactInputError('Expected finite-term array');
  if (data.terms.length > budget.limits.rawDegree) throw new ExactResourceError(budget.stage, 'raw term count');
  const entries = Array.from(data.terms, (raw, index) => {
    const term = object(raw, ['pole', coefficientKey]);
    const pole = parseExact(term.pole, budget);
    const coefficient = parseExact(term[coefficientKey], budget);
    if (pole.n <= 0n || coefficient.n <= 0n) throw new InvalidFoster('Every finite pole rate and coefficient must be strictly positive');
    return { pole, coefficient, sourceIndices: [index] };
  });
  entries.sort((a, b) => {
    const difference = exactSubtract(a.pole, b.pole, budget).n;
    return difference < 0n ? -1 : difference > 0n ? 1 : 0;
  });
  const terms: typeof entries = [];
  for (const entry of entries) {
    const previous = terms[terms.length - 1];
    if (previous && previous.pole.n === entry.pole.n && previous.pole.d === entry.pole.d) {
      previous.coefficient = exactAdd(previous.coefficient, entry.coefficient, budget);
      previous.sourceIndices.push(...entry.sourceIndices);
    } else terms.push(entry);
  }
  result.decomposition = { constant, endpoint, terms };
  return result;
}

/** Map positive coefficients to normalized element laws. These values remain
 * exact; physical SI conversion belongs to the native generator. In Foster
 * II a is NOT the ordinary residue (-a*p) of the admittance at -p. */
export function fosterSections(parsed: ParsedFoster, budget: ExactBudget): FosterSection[] {
  const { constant, endpoint, terms } = parsed.decomposition!;
  const first = parsed.method === 'foster-I';
  const sections: FosterSection[] = [];
  if (constant.n > 0n) sections.push({ connection: 'resistor', elements: [{ kind: 'R',
    value: exactString(first ? constant : exactDivide(exactOne, constant, budget)) }] });
  if (endpoint.n > 0n) sections.push({ connection: 'capacitor', elements: [{ kind: 'C',
    value: exactString(first ? exactDivide(exactOne, endpoint, budget) : endpoint) }] });
  for (const { pole, coefficient } of terms) {
    const r = first ? exactDivide(coefficient, pole, budget) : exactDivide(exactOne, coefficient, budget);
    const c = first ? exactDivide(exactOne, coefficient, budget) : exactDivide(coefficient, pole, budget);
    sections.push({ connection: first ? 'parallel-RC' : 'series-RC',
      elements: [{ kind: 'R', value: exactString(r) }, { kind: 'C', value: exactString(c) }] });
  }
  return sections;
}
