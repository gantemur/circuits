import { ExactBudget, ExactInputError, ExactResourceError, exactDivide, exactOne, exactString,
  exactZero, parseExact, type ExactLimits, type Rational } from './exact-rational.js';
import { addPolynomialToFunction, functionLimit, functionsEqual, functionText, polynomialDegree,
  reciprocalFunction, reduceFunction, subtractPolynomialFromFunction, zeroPolynomial,
  type ExactFunction, type ExactLimit, type RationalFunctionText } from './rational-function.js';
import { generateRcNetlist, type RcNativeResult } from './synthesis-netlist.js';
import { verifyRcRealization, type RcVerification } from './synthesis-verification.js';

export interface RcSynthesisInput {
  quantity: 'impedance' | 'admittance'; method: 'cauer-infinity';
  numerator: string[]; denominator: string[];
  referenceResistanceOhm: string; referenceAngularFrequencyPerSecond: string;
}
export interface RcElement { kind: 'R' | 'C'; value: string }
export interface RcExtractionStage {
  index: number; domain: 'impedance' | 'admittance'; before: RationalFunctionText;
  remaining: RationalFunctionText; element: RcElement; omitted: boolean;
  positivity: 'positive' | 'initial-zero'; denominatorDegreeBefore: number;
  nextImpedanceDegree: number | null; identity: true; componentId?: string;
}
export interface RcCertificate {
  status: 'certified'; target: RationalFunctionText; canceledFactor: string[];
  inputQuantity: RcSynthesisInput['quantity']; referenceResistanceOhm: string;
  referenceAngularFrequencyPerSecond: string; elements: RcElement[];
  trace: RcExtractionStage[]; reconstructed: RationalFunctionText; identity: true;
  dc: ExactLimit; highFrequency: ExactLimit;
}
export type RcMathematicalResult = RcCertificate
  | { status: 'boundary'; boundary: 'short' | 'open'; canceledFactor: string[] }
  | { status: 'not-rc'; stage: string; reason: string; trace: RcExtractionStage[] }
  | { status: 'resource-limit' | 'invalid-input'; stage: string; reason: string };
export interface RcSynthesisResult {
  mathematical: RcMathematicalResult; native: RcNativeResult; verification: RcVerification;
}
class NotRc extends Error {}
function requireRc(condition: boolean, reason: string): asserts condition {
  if (!condition) throw new NotRc(reason);
}
function input(raw: unknown, budget: ExactBudget): { target: ExactFunction; canceledFactor: string[];
  quantity: RcSynthesisInput['quantity']; resistance: Rational; frequency: Rational } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ExactInputError('Expected synthesis object');
  const obj = raw as Record<string, unknown>;
  const keys = ['quantity', 'method', 'numerator', 'denominator', 'referenceResistanceOhm', 'referenceAngularFrequencyPerSecond'];
  if (Object.keys(obj).length !== keys.length || Object.keys(obj).some(k => !keys.includes(k)))
    throw new ExactInputError('Unexpected or missing synthesis fields');
  if (obj.method !== 'cauer-infinity' || (obj.quantity !== 'impedance' && obj.quantity !== 'admittance'))
    throw new ExactInputError('Unsupported synthesis method or quantity');
  const polynomial = (value: unknown): Rational[] => {
    if (!Array.isArray(value) || !value.length) throw new ExactInputError('Expected nonempty coefficient array');
    if (value.length > budget.limits.rawDegree + 1) throw new ExactResourceError(budget.stage, 'input degree');
    return Array.from(value, x => parseExact(x, budget));
  };
  const numerator = polynomial(obj.numerator), denominator = polynomial(obj.denominator);
  const resistance = parseExact(obj.referenceResistanceOhm, budget);
  const frequency = parseExact(obj.referenceAngularFrequencyPerSecond, budget);
  if (resistance.n <= 0n || frequency.n <= 0n) throw new ExactInputError('Reference scales must be positive');
  budget.stage = 'input canonicalization / polynomial GCD';
  const reduced = reduceFunction(numerator, denominator, budget);
  if (Math.max(polynomialDegree(reduced.value.numerator), polynomialDegree(reduced.value.denominator)) > budget.limits.degree)
    throw new ExactResourceError(budget.stage, 'reduced degree');
  return { target: reduced.value, canceledFactor: reduced.canceledFactor.map(exactString),
    quantity: obj.quantity, resistance, frequency };
}

/** Certify F(z)=r0+1/(c1*z+1/(r1+...)) without roots or floating-point
 * coefficients. Positive series R / shunt C give a passive realization;
 * exact reconstruction proves its terminal function is the supplied target.
 * For rational Stieltjes functions the process is complete: after removal of
 * rInfinity, the leading term is M0/z, M0>0; inversion extracts c=1/M0.
 * Each nonterminal pair reduces denominator degree. Noninitial R must be
 * positive. Degenerate tails stop exactly, never through tolerance clipping.
 * Numerical conversion and physical experiments are deliberately subsequent
 * results: their failure cannot revoke this algebraic certificate. */
export function synthesizeRc(raw: unknown, limits: Partial<ExactLimits> = {}): RcSynthesisResult {
  let budget: ExactBudget | undefined;
  const trace: RcExtractionStage[] = [];
  const unavailable: RcNativeResult = { status: 'unavailable', reason: 'No nondegenerate exact certificate' };
  const untested: RcVerification = { status: 'unresolved', reason: 'No generated native realization', samples: [] };
  let certificate: RcCertificate;
  let target: ExactFunction;
  let resistance: Rational;
  let frequency: Rational;
  try {
    budget = new ExactBudget(limits);
    const parsed = input(raw, budget);
    resistance = parsed.resistance;
    frequency = parsed.frequency;
    if (zeroPolynomial(parsed.target.numerator)) return {
      mathematical: { status: 'boundary', boundary: parsed.quantity === 'impedance' ? 'short' : 'open', canceledFactor: parsed.canceledFactor },
      native: unavailable, verification: untested };
    target = parsed.quantity === 'impedance' ? parsed.target : reciprocalFunction(parsed.target, budget);
    let Z = target;
    const exactElements: { kind: 'R' | 'C'; value: Rational }[] = [];
    const record = (before: ExactFunction, remaining: ExactFunction, kind: 'R' | 'C', value: Rational): RcExtractionStage => {
      const term = kind === 'R' ? [value] : [exactZero, value];
      if (!functionsEqual(before, addPolynomialToFunction(remaining, term, budget!), budget!))
        throw new Error('Internal exact extraction identity failure');
      const entry: RcExtractionStage = { index: trace.length, domain: kind === 'R' ? 'impedance' : 'admittance',
        before: functionText(before), remaining: functionText(remaining), element: { kind, value: exactString(value) },
        omitted: value.n === 0n, positivity: value.n === 0n ? 'initial-zero' : 'positive',
        denominatorDegreeBefore: polynomialDegree(before.denominator), nextImpedanceDegree: null, identity: true };
      trace.push(entry);
      if (value.n !== 0n) exactElements.push({ kind, value });
      return entry;
    };
    for (;;) {
      budget.stage = `resistor extraction ${trace.length}`;
      const degree = polynomialDegree(Z.denominator);
      requireRc(polynomialDegree(Z.numerator) <= degree, 'Impedance has a pole at infinity');
      const r = polynomialDegree(Z.numerator) < degree ? exactZero
        : exactDivide(Z.numerator[Z.numerator.length - 1]!, Z.denominator[Z.denominator.length - 1]!, budget);
      requireRc(r.n >= 0n && (trace.length === 0 || r.n > 0n), 'Required resistor is negative or noninitial zero');
      const A = subtractPolynomialFromFunction(Z, [r], budget);
      record(Z, A, 'R', r);
      if (zeroPolynomial(A.numerator)) break;
      requireRc(polynomialDegree(A.denominator) - polynomialDegree(A.numerator) === 1,
        'Strictly proper RC remainder must have relative degree one');
      budget.stage = `capacitor extraction ${trace.length}`;
      const Y = reciprocalFunction(A, budget);
      const c = exactDivide(Y.numerator[Y.numerator.length - 1]!, Y.denominator[Y.denominator.length - 1]!, budget);
      requireRc(c.n > 0n, 'Required capacitor is not positive');
      const B = subtractPolynomialFromFunction(Y, [exactZero, c], budget);
      const stage = record(Y, B, 'C', c);
      if (zeroPolynomial(B.numerator)) break;
      Z = reciprocalFunction(B, budget);
      stage.nextImpedanceDegree = polynomialDegree(Z.denominator);
      requireRc(stage.nextImpedanceDegree < degree, 'Capacitor stage did not reduce impedance degree');
    }
    budget.stage = 'exact continued-fraction reconstruction';
    let reconstructed: ExactFunction = { numerator: [exactZero], denominator: [exactOne] };
    for (let i = exactElements.length - 1; i >= 0; i--) {
      const element = exactElements[i]!;
      if (element.kind === 'R') reconstructed = addPolynomialToFunction(reconstructed, [element.value], budget);
      else {
        // A last capacitor has an open continuation: Ytail=0, not a short.
        const admittance = i === exactElements.length - 1
          ? { numerator: [exactZero], denominator: [exactOne] }
          : reciprocalFunction(reconstructed, budget);
        reconstructed = reciprocalFunction(addPolynomialToFunction(admittance, [exactZero, element.value], budget), budget);
      }
    }
    if (!functionsEqual(target, reconstructed, budget)) throw new Error('Internal reconstruction identity failure');
    certificate = { status: 'certified', target: functionText(target), canceledFactor: parsed.canceledFactor,
      inputQuantity: parsed.quantity, referenceResistanceOhm: exactString(resistance),
      referenceAngularFrequencyPerSecond: exactString(frequency),
      elements: exactElements.map(e => ({ kind: e.kind, value: exactString(e.value) })), trace,
      reconstructed: functionText(reconstructed), identity: true,
      dc: functionLimit(target, 'zero', budget), highFrequency: functionLimit(target, 'infinity', budget) };
  } catch (error) {
    const stage = budget?.stage ?? 'input';
    if (error instanceof NotRc) return { mathematical: { status: 'not-rc', stage, reason: error.message, trace }, native: unavailable, verification: untested };
    if (error instanceof ExactResourceError || error instanceof ExactInputError)
      return { mathematical: { status: error instanceof ExactResourceError ? 'resource-limit' : 'invalid-input',
        stage, reason: error.message }, native: unavailable, verification: untested };
    throw error;
  }
  const native = generateRcNetlist(certificate.elements, resistance!, frequency!, budget!);
  if (native.status !== 'generated') return { mathematical: certificate!, native, verification: untested };
  let index = 0;
  for (const stage of trace) if (!stage.omitted) stage.componentId = native.elements[index++]!.id;
  const verification = verifyRcRealization(native.document, target!, resistance!, frequency!, budget!);
  return { mathematical: certificate!, native, verification };
}
