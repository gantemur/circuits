import { ExactBudget, ExactInputError, ExactResourceError, exactDivide, exactMultiply,
  exactOne, exactString, exactZero, parseExact, type ExactLimits } from './exact-rational.js';
import { InvalidFoster, checkFosterDegree, fosterSections, parseFoster, type FosterIDecomposition,
  type FosterIIDecomposition, type FosterMethod, type FosterPoleGroup, type FosterSection, type ParsedFoster } from './foster-decomposition.js';
import { generateFosterNetlist } from './foster-netlist.js';
import { functionLimit, functionsEqual, functionText, polynomialAdd, polynomialMultiply,
  reciprocalFunction, reduceFunction, zeroPolynomial, type ExactFunction, type ExactLimit,
  type RationalFunctionText } from './rational-function.js';
import type { RcNativeResult } from './synthesis-netlist.js';
import { verifyRcRealization, type RcVerification } from './synthesis-verification.js';

export interface FosterSectionCertificate extends FosterSection {
  contribution: RationalFunctionText; cumulative: RationalFunctionText; identity: true; componentIds?: string[];
}
export interface FosterCertificate {
  status: 'certified'; method: FosterMethod; quantity: 'impedance' | 'admittance';
  canonical: FosterIDecomposition | FosterIIDecomposition; poleGroups: FosterPoleGroup[];
  referenceResistanceOhm: string; referenceAngularFrequencyPerSecond: string;
  sections: FosterSectionCertificate[]; reconstructed: RationalFunctionText;
  impedanceTarget: RationalFunctionText; identity: true;
  targetEvidence: { supplied: false } | { supplied: true; target: RationalFunctionText; canceledFactor: string[]; identity: true };
  limits: { dc: ExactLimit; infinity: ExactLimit };
  impedanceLimits: { dc: ExactLimit; infinity: ExactLimit };
}
export type FosterMathematicalResult = FosterCertificate
  | { status: 'boundary'; boundary: 'short' | 'open'; reconstructed: RationalFunctionText; identity: true }
  | { status: 'invalid-input' | 'invalid-decomposition' | 'decomposition-unavailable' | 'resource-limit'; stage: string; reason: string };
export interface FosterResult { mathematical: FosterMathematicalResult; native: RcNativeResult; verification: RcVerification }
const zeroFunction = (): ExactFunction => ({ numerator: [exactZero], denominator: [exactOne] });

/** Addition in the request's domain: impedances for Foster I, admittances
 * for Foster II. Exact GCD reduction keeps removable factors explicit rather
 * than interpreting them as additional physical modes. */
function sum(a: ExactFunction, b: ExactFunction, budget: ExactBudget): ExactFunction {
  const numerator = polynomialAdd(polynomialMultiply(a.numerator, b.denominator, budget),
    polynomialMultiply(b.numerator, a.denominator, budget), budget);
  return reduceFunction(numerator, polynomialMultiply(a.denominator, b.denominator, budget), budget).value;
}
function decompositionTerms(parsed: ParsedFoster): ExactFunction[] {
  const { constant, endpoint, terms } = parsed.decomposition!;
  const first = parsed.method === 'foster-I';
  const result: ExactFunction[] = [];
  if (constant.n > 0n) result.push({ numerator: [constant], denominator: [exactOne] });
  if (endpoint.n > 0n) result.push(first
    ? { numerator: [endpoint], denominator: [exactZero, exactOne] }
    : { numerator: [exactZero, endpoint], denominator: [exactOne] });
  for (const term of terms) result.push({ numerator: first ? [term.coefficient] : [exactZero, term.coefficient],
    denominator: [term.pole, exactOne] });
  return result;
}
/** Derive contribution again from physical element laws, independently of
 * the supplied residue. Parallel RC: Z=R/(1+zRC); series RC: Y=zC/(1+zRC).
 * R and C here are normalized, dimensionless values; SI scaling is later. */
function sectionFunction(section: FosterSection, first: boolean, budget: ExactBudget): ExactFunction {
  const value = parseExact(section.elements[0]!.value, budget);
  if (section.connection === 'resistor') return { numerator: [first ? value : exactDivide(exactOne, value, budget)], denominator: [exactOne] };
  if (section.connection === 'capacitor') return first
    ? { numerator: [exactOne], denominator: [exactZero, value] }
    : { numerator: [exactZero, value], denominator: [exactOne] };
  const capacitance = parseExact(section.elements[1]!.value, budget);
  return { numerator: first ? [value] : [exactZero, capacitance],
    denominator: [exactOne, exactMultiply(value, capacitance, budget)] };
}

/** Constructive exact Foster synthesis with supplied rational rates. It
 * certifies a positive RC realization, not a general factorization procedure.
 * Certificate, native conversion and MNA evidence are deliberately separate. */
export function synthesizeRcFoster(raw: unknown, limits: Partial<ExactLimits> = {}): FosterResult {
  let budget: ExactBudget | undefined;
  const nativeUnavailable: RcNativeResult = { status: 'unavailable', reason: 'No nondegenerate exact Foster certificate' };
  const untested: RcVerification = { status: 'unresolved', reason: 'No generated native realization', samples: [] };
  let parsed: ParsedFoster;
  let certificate: FosterCertificate;
  let impedance: ExactFunction;
  try {
    budget = new ExactBudget(limits);
    parsed = parseFoster(raw, budget);
    if (!parsed.decomposition) return { mathematical: { status: 'decomposition-unavailable', stage: 'Foster decomposition',
      reason: 'Supply exact rational pole rates and coefficients; polynomial-only factorization is not supported. This is not a nonrealizability result.' },
      native: nativeUnavailable, verification: untested };
    budget.stage = 'Foster exact section reconstruction';
    const sections = fosterSections(parsed, budget);
    const terms = decompositionTerms(parsed);
    let reconstructed = zeroFunction();
    let expression = zeroFunction();
    const trace: FosterSectionCertificate[] = [];
    for (let index = 0; index < sections.length; index++) {
      const section = sections[index]!;
      const law = sectionFunction(section, parsed.method === 'foster-I', budget);
      if (!functionsEqual(law, terms[index]!, budget)) throw new Error('Internal Foster section identity failure');
      reconstructed = sum(reconstructed, law, budget);
      expression = sum(expression, terms[index]!, budget);
      checkFosterDegree(reconstructed, budget);
      trace.push({ ...section, contribution: functionText(reduceFunction(law.numerator, law.denominator, budget).value),
        cumulative: functionText(reconstructed), identity: true });
    }
    budget.stage = 'Foster exact target identity';
    if (!functionsEqual(reconstructed, expression, budget)) throw new Error('Internal Foster reconstruction failure');
    if (parsed.target && !functionsEqual(reconstructed, parsed.target, budget))
      throw new InvalidFoster('Exact decomposition does not equal the supplied target');
    if (zeroPolynomial(reconstructed.numerator)) return { mathematical: { status: 'boundary',
      boundary: parsed.method === 'foster-I' ? 'short' : 'open', reconstructed: functionText(reconstructed), identity: true },
      native: nativeUnavailable, verification: untested };
    const target = parsed.target ?? reconstructed;
    impedance = parsed.method === 'foster-I' ? target : reciprocalFunction(target, budget);
    checkFosterDegree(impedance, budget);
    const { constant, endpoint, terms: canonicalTerms } = parsed.decomposition;
    const canonical = parsed.method === 'foster-I'
      ? { rInfinity: exactString(constant), kZero: exactString(endpoint), terms: canonicalTerms.map(t => ({ pole: exactString(t.pole), residue: exactString(t.coefficient) })) }
      : { gZero: exactString(constant), cInfinity: exactString(endpoint), terms: canonicalTerms.map(t => ({ pole: exactString(t.pole), coefficient: exactString(t.coefficient) })) };
    certificate = { status: 'certified', method: parsed.method, quantity: parsed.quantity, canonical,
      poleGroups: canonicalTerms.map(t => ({ pole: exactString(t.pole), coefficient: exactString(t.coefficient), sourceIndices: t.sourceIndices })),
      referenceResistanceOhm: exactString(parsed.resistance), referenceAngularFrequencyPerSecond: exactString(parsed.frequency),
      sections: trace, reconstructed: functionText(reconstructed), impedanceTarget: functionText(impedance), identity: true,
      targetEvidence: parsed.target ? { supplied: true, target: functionText(parsed.target), canceledFactor: parsed.canceledFactor!, identity: true } : { supplied: false },
      limits: { dc: functionLimit(reconstructed, 'zero', budget), infinity: functionLimit(reconstructed, 'infinity', budget) },
      impedanceLimits: { dc: functionLimit(impedance, 'zero', budget), infinity: functionLimit(impedance, 'infinity', budget) } };
  } catch (error) {
    if (error instanceof ExactInputError || error instanceof InvalidFoster || error instanceof ExactResourceError)
      return { mathematical: { status: error instanceof ExactResourceError ? 'resource-limit' : error instanceof InvalidFoster ? 'invalid-decomposition' : 'invalid-input',
        stage: budget?.stage ?? 'input', reason: error.message }, native: nativeUnavailable, verification: untested };
    throw error;
  }
  const native = generateFosterNetlist(parsed.method, certificate.sections, parsed.resistance, parsed.frequency, budget!);
  if (native.status !== 'generated') return { mathematical: certificate, native, verification: untested };
  let offset = 0;
  for (const section of certificate.sections) {
    section.componentIds = native.elements.slice(offset, offset + section.elements.length).map(e => e.id);
    offset += section.elements.length;
  }
  const verification = verifyRcRealization(native.document, impedance, parsed.resistance, parsed.frequency, budget!);
  return { mathematical: certificate, native, verification };
}
