import { assemble } from './assembly.js';
import { solveFrequency, type Solution } from './analysis.js';
import { abs, complex, finiteComplex, mul, scale, sub, type Complex } from './complex.js';
import { ExactInputError, ExactResourceError, exactAdd, exactDivide, exactFromNumber,
  exactMultiply, exactSubtract, exactToNumber, exactZero, type ExactBudget, type Rational } from './exact-rational.js';
import { validateDocument, type NativeDocument } from './model.js';
import { analyzePorts } from './port-analysis.js';
import type { ExactFunction, ExactPolynomial } from './rational-function.js';

export interface RcComparison { measured: Complex; expected: Complex; difference: number; limit: number; passed: boolean }
export interface RcPowerCheck {
  portVA: Complex; branchesVA: Complex; differenceVA: number; limitVA: number; passed: boolean;
}
export interface RcVerificationSample {
  sPerSecond: Complex; kind: 'RMS' | 'right-half-plane';
  impedanceOhm: Complex; admittanceSiemens: Complex;
  normalizedImpedance: RcComparison; normalizedAdmittance: RcComparison;
  currentTest: Solution; voltageTest: Solution; power: RcPowerCheck[];
}
export interface RcVerification {
  status: 'passed' | 'unresolved' | 'mismatch'; reason?: string; samples: RcVerificationSample[];
}
interface ExactComplex { re: Rational; im: Rational }
function exactComplexMultiply(a: ExactComplex, b: ExactComplex, budget: ExactBudget): ExactComplex {
  return {
    re: exactSubtract(exactMultiply(a.re, b.re, budget), exactMultiply(a.im, b.im, budget), budget),
    im: exactAdd(exactMultiply(a.re, b.im, budget), exactMultiply(a.im, b.re, budget), budget),
  };
}
function evaluatePolynomial(p: ExactPolynomial, z: ExactComplex, budget: ExactBudget): ExactComplex {
  let value: ExactComplex = { re: exactZero, im: exactZero };
  for (let index = p.length - 1; index >= 0; index--) {
    value = exactComplexMultiply(value, z, budget);
    value.re = exactAdd(value.re, p[index]!, budget);
  }
  return value;
}
/** Evaluate the supplied polynomial coefficients, not the extracted ladder.
 * Actual binary64 experiment s is decoded exactly, then divided by exact
 * omegaRef. Horner arithmetic and complex division remain rational until the
 * final reference value is rounded. No pole locations or residues are used. */
function targetValues(target: ExactFunction, s: Complex, omega: Rational, budget: ExactBudget): { z: Complex; y: Complex } {
  const coordinate = { re: exactDivide(exactFromNumber(s.re, budget), omega, budget),
    im: exactDivide(exactFromNumber(s.im, budget), omega, budget) };
  const numerator = evaluatePolynomial(target.numerator, coordinate, budget);
  const denominator = evaluatePolynomial(target.denominator, coordinate, budget);
  const quotient = (a: ExactComplex, b: ExactComplex): Complex => {
    const norm = exactAdd(exactMultiply(b.re, b.re, budget), exactMultiply(b.im, b.im, budget), budget);
    const re = exactDivide(exactAdd(exactMultiply(a.re, b.re, budget), exactMultiply(a.im, b.im, budget), budget), norm, budget);
    const im = exactDivide(exactSubtract(exactMultiply(a.im, b.re, budget), exactMultiply(a.re, b.im, budget), budget), norm, budget);
    return complex(exactToNumber(re, budget).value, exactToNumber(im, budget).value);
  };
  return { z: quotient(numerator, denominator), y: quotient(denominator, numerator) };
}
function comparison(measured: Complex, expected: Complex): RcComparison {
  const difference = abs(sub(measured, expected));
  const limit = 1e-9 + 1e-8 * Math.max(abs(measured), abs(expected));
  if (![difference, limit].every(Number.isFinite)) throw new RangeError('Nonfinite response comparison');
  return { measured, expected, difference, limit, passed: difference <= limit };
}
const voltage = (solution: Solution, node: string): Complex => node === '0' ? complex(0) : solution.unknowns[`V(${node})`]!.value;

/** S=V*conj(I), positive current entering the network. RMS voltages give
 * Re(S)=sum |VR|²/R [W], Im(S)=-omega sum C|VC|² [var]. The comparison uses
 * the declared power scale (1 V)^2/Rref, so its absolute floor has VA units.
 * Off-axis s experiments do not call this sinusoidal-power calculation. */
function powerCheck(document: NativeDocument, solution: Solution, current: Complex,
  omega: number, resistance: number): RcPowerCheck {
  const v = voltage(solution, 'port');
  const portVA = mul(v, complex(current.re, -current.im));
  let real = 0;
  let imaginary = 0;
  for (const device of document.circuit.components) {
    const drop = sub(voltage(solution, device.p), voltage(solution, device.n));
    const squaredVoltage = abs(drop) ** 2;
    if (device.type === 'R') real += squaredVoltage / device.value;
    else if (device.type === 'C') imaginary -= omega * device.value * squaredVoltage;
    else throw new RangeError('Verification requires a source-free RC realization');
  }
  const branchesVA = complex(real, imaginary);
  if (![portVA, branchesVA].every(finiteComplex)) throw new RangeError('Complex power exceeds finite range');
  const normalized = comparison(scale(portVA, resistance), scale(branchesVA, resistance));
  const differenceVA = normalized.difference / resistance;
  const limitVA = normalized.limit / resistance;
  if (![differenceVA, limitVA].every(Number.isFinite) || !(limitVA > 0))
    throw new RangeError('Physical power comparison exceeds numeric range');
  return { portVA, branchesVA, differenceVA, limitVA, passed: normalized.passed };
}

/** Small off-axis physical experiment, using the existing K+sE assembly and
 * solver. I test: q→p injection. V test: p→q clamp, so -Iclamp enters RC.
 * Source IDs are allocated against every existing ID, never overwriting one.
 * These source coordinates are Laplace-domain test amplitudes, not RMS power. */
function offAxis(document: NativeDocument, s: Complex, kind: 'I' | 'V', amplitude: number): { value: Complex; solution: Solution } {
  const work = JSON.parse(JSON.stringify(document)) as NativeDocument;
  const used = new Set([...work.circuit.nodes, ...work.circuit.components.map(c => c.id), ...work.circuit.observations.map(o => o.id)]);
  let id = '__synthesis_test';
  while (used.has(id)) id += '_';
  work.circuit.components.push({ id, type: kind, p: kind === 'I' ? '0' : 'port', n: kind === 'I' ? 'port' : '0' });
  work.experiment.sources.push({ id, dc: 0, ac: complex(amplitude) });
  validateDocument(work);
  const solution = solveFrequency(assemble(work.circuit), work.experiment, s);
  if (solution.status !== 'ok') throw new RangeError(`${kind} test: ${solution.status}: ${solution.message}`);
  const value = kind === 'I' ? scale(voltage(solution, 'port'), 1 / amplitude)
    : scale(solution.unknowns[`I(${id})`]!.value, -1 / amplitude);
  return { value, solution };
}

/** Numerical evidence is independent of exact extraction. Seven points are
 * tested: j*{.01,.1,1,10,100}, .1+j and 1+j in normalized frequency.
 * Both Z/Rref and Y*Rref must agree; existing physical residual checks are
 * unchanged. Failure/range/budget limits retain partial evidence and do not
 * revoke the caller's exact certificate. This is not interval certification. */
export function verifyRcRealization(raw: NativeDocument, target: ExactFunction,
  resistance: Rational, frequency: Rational, budget: ExactBudget): RcVerification {
  const samples: RcVerificationSample[] = [];
  budget.stage = 'independent physical verification';
  try {
    const document = validateDocument(raw);
    if (document.experiment.sources.length || document.circuit.components.some(c => c.type !== 'R' && c.type !== 'C'))
      throw new RangeError('Verification requires a source-free RC document');
    const r = exactToNumber(resistance, budget).value;
    const omegaRef = exactToNumber(frequency, budget).value;
    const injection = 1 / r;
    if (!(r > 0 && omegaRef > 0 && injection > 0) || !Number.isFinite(injection))
      throw new RangeError('Reference scales or test amplitude unavailable');
    const coordinates = [complex(0, .01), complex(0, .1), complex(0, 1), complex(0, 10), complex(0, 100), complex(.1, 1), complex(1, 1)];
    for (const coordinate of coordinates) {
      budget.stage = `physical verification z=${coordinate.re}+j${coordinate.im}`;
      let s = scale(coordinate, omegaRef);
      if (!finiteComplex(s) || !(s.im > 0) || (coordinate.re > 0 && !(s.re > 0)))
        throw new RangeError('Requested complex frequency exceeds nonzero finite range');
      let impedanceOhm: Complex;
      let admittanceSiemens: Complex;
      let currentTest: Solution;
      let voltageTest: Solution;
      if (coordinate.re === 0) {
        const result = analyzePorts(document, { ports: [{ p: 'port', q: '0' }],
          frequencyHz: s.im / (2 * Math.PI), testCurrent: injection, testVoltage: 1 });
        if (result.status !== 'ok') throw new RangeError(`Port verification: ${result.status}: ${result.message}`);
        if (result.z.status !== 'ok') throw new RangeError(`Z verification: ${result.z.status}: ${result.z.message}`);
        if (result.y.status !== 'ok') throw new RangeError(`Y verification: ${result.y.status}: ${result.y.message}`);
        if (!(result.angularFrequency > 0)) throw new RangeError('Hz conversion lost positive frequency');
        s = complex(0, result.angularFrequency);
        impedanceOhm = result.z.values[0]![0]!;
        admittanceSiemens = result.y.values[0]![0]!;
        currentTest = result.z.stages[0]!.solution;
        voltageTest = result.y.stages[0]!.solution;
      } else {
        const z = offAxis(document, s, 'I', injection);
        const y = offAxis(document, s, 'V', 1);
        impedanceOhm = z.value;
        admittanceSiemens = y.value;
        currentTest = z.solution;
        voltageTest = y.solution;
      }
      if (![impedanceOhm, admittanceSiemens, ...currentTest.x, ...voltageTest.x].every(finiteComplex))
        throw new RangeError('Nonfinite physical experiment result');
      const expected = targetValues(target, s, frequency, budget);
      const normalizedImpedance = comparison(scale(impedanceOhm, 1 / r), expected.z);
      const normalizedAdmittance = comparison(scale(admittanceSiemens, r), expected.y);
      const power = coordinate.re === 0 ? [powerCheck(document, currentTest, complex(injection), s.im, r),
        powerCheck(document, voltageTest, admittanceSiemens, s.im, r)] : [];
      samples.push({ sPerSecond: s, kind: coordinate.re === 0 ? 'RMS' : 'right-half-plane',
        impedanceOhm, admittanceSiemens, normalizedImpedance, normalizedAdmittance, currentTest, voltageTest, power });
      if (!normalizedImpedance.passed || !normalizedAdmittance.passed || power.some(p => !p.passed))
        return { status: 'mismatch', reason: 'Target response or signed complex-power comparison failed', samples };
    }
    return { status: 'passed', samples };
  } catch (error) {
    if (error instanceof RangeError || error instanceof ExactResourceError || error instanceof ExactInputError)
      return { status: 'unresolved', reason: `${budget.stage}: ${error.message}`, samples };
    throw error;
  }
}
