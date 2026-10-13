import { currentRow, incidence } from './assembly.js';
import { measurement, scalingDescription, type Measurement } from './analysis.js';
import { add, complex, finiteComplex, mul, scale, type Complex } from './complex.js';
import { complexDot, complexMatvec, residuals, solveLinear, solveReal, tolerances, zeros,
  type Label, type LinearFailure, type Matrix, type Residual, type Tolerances } from './numeric.js';
import { bjtBiasFingerprint, ownedBjtDocument, type BjtDocument } from './bjt-document.js';
import { assembleBjtSystem, evaluateBjtSystem } from './bjt-system.js';
import { bjtTerminals, type BjtTerminal } from './bjt-model.js';
import { physicalRows } from './nonlinear-dc.js';
import type { BjtOperatingPointSuccess } from './bjt-operating-point.js';

/** y(s)=(C0+s C1)x(s)+D0 u(s). C1 is essential for capacitor currents. */
export interface BjtTangentOutput {
  id: string; unit: 'V' | 'A'; C0: number[]; C1: number[]; D0: number[];
}
export interface BjtTangent {
  status: 'ok'; meaning: 'increments-around-recorded-bias';
  document: BjtDocument; biasFingerprint: string; biasX: number[];
  E: Matrix; J: Matrix; B: Matrix; unknowns: Label[]; rows: Label[]; inputs: Label[];
  outputs: BjtTangentOutput[]; groundCurrents: BjtTangentOutput[];
}
export interface BjtTangentFailure {
  status: 'unavailable'; code: 'stale-bias' | 'unverified-bias' | 'numeric-range'; message: string;
}
export interface BjtFrequencySuccess {
  status: 'ok'; x: Complex[]; unknowns: Record<string, Measurement>;
  observations: Record<string, Measurement>; residuals: Residual[]; groundKcl: Residual;
  diagnostics: { scaledBackwardResidual: number; pivotRatio: number; scaling: string };
}
export type BjtFrequencyResult = BjtFrequencySuccess | LinearFailure | BjtTangentFailure;

/** Construct a matrix tangent, not a fabricated native-v1 transistor circuit.
 * Diode auxiliary rows remain in J; external C/L stamps are padded with zeros.
 * The full three-terminal Q Jacobian applies in every region. All native AC
 * values remain increments; original DC/initial/time fields are provenance only.
 */
export function createBjtTangent(point: BjtOperatingPointSuccess, current: BjtDocument): BjtTangent | BjtTangentFailure {
  const unavailable = (code: BjtTangentFailure['code'], message: string): BjtTangentFailure => ({ status: 'unavailable', code, message });
  try {
    if (point.status !== 'ok' || bjtBiasFingerprint(point.document) !== point.biasFingerprint ||
        bjtBiasFingerprint(current) !== point.biasFingerprint)
      return unavailable('stale-bias', 'Circuit, model or DC source changed after bias');
  } catch { return unavailable('stale-bias', 'Bias or current document is invalid'); }
  const system = assembleBjtSystem(current);
  const evaluation = evaluateBjtSystem(system, point.x);
  if (!evaluation || physicalRows(system.core, evaluation, tolerances()).some(row => !row.passed))
    return unavailable('unverified-bias', 'Recorded bias no longer satisfies the original equations');
  if (solveReal(evaluation.jacobian, point.x.map(() => 0)).status !== 'ok')
    return unavailable('unverified-bias', 'Recorded bias Jacobian is unresolved');
  const core = system.core;
  const size = core.unknowns.length;
  const E = zeros(size), B = zeros(size, core.linear.inputs.length);
  for (let i = 0; i < core.linear.unknowns.length; i++) {
    for (let j = 0; j < core.linear.unknowns.length; j++) E[i]![j] = core.linear.E[i]![j]!;
    for (let j = 0; j < core.linear.inputs.length; j++) B[i]![j] = core.linear.B[i]![j]!;
  }
  const blank = (id: string, unit: 'V' | 'A'): BjtTangentOutput => ({ id, unit,
    C0: Array<number>(size).fill(0), C1: Array<number>(size).fill(0), D0: core.dcInputs.map(() => 0) });
  const terminalRow = (id: string, terminal: BjtTerminal): BjtTangentOutput => {
    const row = blank(id, 'A');
    const device = system.bjts.find(d => d.id === id)!;
    const derivative = evaluation.bjts[id]!.jacobianS[bjtTerminals.indexOf(terminal)]!;
    bjtTerminals.forEach((t, index) => {
      const column = core.linear.nodeIndex.get(device[t]);
      if (column !== undefined) row.C0[column] = row.C0[column]! + derivative[index]!;
    });
    return row;
  };
  const branchRow = (id: string): BjtTangentOutput => {
    const row = blank(id, 'A');
    const device = core.document.circuit.components.find(d => d.id === id)!;
    if (device.type === 'D') row.C0[core.linear.unknowns.length + core.diodes.findIndex(d => d.id === id)] = 1;
    else {
      const source = currentRow(core.linear, device);
      if (source.kind === 'derivative') source.Q.forEach((value, index) => { row.C1[index] = value; });
      else {
        source.C.forEach((value, index) => { row.C0[index] = value; });
        row.D0 = [...source.D];
      }
    }
    return row;
  };
  const outputs = current.circuit.observations.map(observation => {
    let row: BjtTangentOutput;
    if (observation.type === 'voltage') {
      row = blank(observation.id, 'V');
      incidence(core.linear, observation.p, observation.n).forEach((value, index) => { row.C0[index] = value; });
    } else row = observation.type === 'current' ? branchRow(observation.component) :
      terminalRow(observation.component, observation.terminal);
    return { ...row, id: observation.id };
  });
  const groundCurrents: BjtTangentOutput[] = [];
  for (const device of current.circuit.components) {
    if (device.type === 'Q') {
      for (const terminal of bjtTerminals) if (device[terminal] === '0') groundCurrents.push(terminalRow(device.id, terminal));
    } else {
      if (device.p === '0') groundCurrents.push(branchRow(device.id));
      if (device.n === '0') {
        const row = branchRow(device.id);
        groundCurrents.push({ ...row, C0: row.C0.map(v => -v), C1: row.C1.map(v => -v), D0: row.D0.map(v => -v) });
      }
    }
  }
  const coefficients = [...E.flat(), ...B.flat(), ...outputs.flatMap(o => [...o.C0, ...o.C1, ...o.D0]),
    ...groundCurrents.flatMap(o => [...o.C0, ...o.C1, ...o.D0])];
  if (!coefficients.every(Number.isFinite)) return unavailable('numeric-range', 'Descriptor/output coefficients exceed range');
  return { status: 'ok', meaning: 'increments-around-recorded-bias', document: ownedBjtDocument(current),
    biasFingerprint: point.biasFingerprint, biasX: [...point.x], E, J: evaluation.jacobian, B,
    unknowns: core.unknowns, rows: core.rows, inputs: core.linear.inputs, outputs, groundCurrents };
}

function output(row: BjtTangentOutput, s: Complex, x: Complex[], u: Complex[]): Complex {
  return add(add(complexDot(row.C0, x), mul(s, complexDot(row.C1, x))), complexDot(row.D0, u));
}
/** Solve the full descriptor and check original row units and reference KCL.
 * No inverse of E, device capacitance, pole extraction or stability inference.
 */
function solve(tangent: BjtTangent, s: Complex, u: Complex[], options: Partial<Tolerances>): BjtFrequencyResult {
  if (!finiteComplex(s)) throw new RangeError('Finite complex frequency required');
  // The descriptor owns its document, but callers can still edit a returned
  // JS object. AC-only edits are valid increments; scientific DC edits require
  // a new bias and tangent rather than silently reusing the old Jacobian.
  try {
    if (bjtBiasFingerprint(tangent.document) !== tangent.biasFingerprint)
      return { status: 'unavailable', code: 'stale-bias', message: 'Tangent document changed; rebuild from a current bias' };
  } catch {
    return { status: 'unavailable', code: 'stale-bias', message: 'Tangent document is invalid' };
  }
  const matrix = tangent.J.map((row, i) => row.map((value, j) => add(complex(value), scale(s, tangent.E[i]![j]!))));
  const rhs = complexMatvec(tangent.B, u);
  const result = solveLinear(matrix, rhs, options);
  if (result.status !== 'ok') return result;
  const checked = residuals(matrix, rhs, result.x, tangent.rows, options);
  const groundTerms = tangent.groundCurrents.map(row => output(row, s, result.x, u));
  const groundKcl = residuals([groundTerms], [complex(0)], groundTerms.map(() => complex(1)),
    [{ id: 'KCL(0)', unit: 'A', description: 'All terminal currents entering ground-connected devices' }], options)[0]!;
  const observations: Record<string, Measurement> = Object.create(null);
  for (const row of tangent.outputs) observations[row.id] = measurement(output(row, s, result.x, u), row.unit);
  if ([...checked, groundKcl].some(row => !row.passed) || Object.values(observations).some(o => !finiteComplex(o.value) || !Number.isFinite(o.magnitude)))
    return { status: 'ill-conditioned', message: 'Incremental physical residual or output is unresolved',
      rank: result.rank, size: result.size, residuals: [...checked, groundKcl] };
  const unknowns: Record<string, Measurement> = Object.create(null);
  tangent.unknowns.forEach((label, index) => { unknowns[label.id] = measurement(result.x[index]!, label.unit); });
  if (Object.values(unknowns).some(value => !Number.isFinite(value.magnitude)))
    return { status: 'ill-conditioned', message: 'Incremental coordinate magnitude exceeds range', rank: result.rank, size: result.size };
  return { status: 'ok', x: result.x, observations, unknowns, residuals: checked, groundKcl,
    diagnostics: { scaledBackwardResidual: result.scaledBackwardResidual, pivotRatio: result.pivotRatio, scaling: scalingDescription } };
}

/** Configured RMS source increments at complex s (normally j2πf). */
export function solveBjtFrequency(tangent: BjtTangent, s: Complex, options: Partial<Tolerances> = {}): BjtFrequencyResult {
  const u = tangent.inputs.map(input => tangent.document.experiment.sources.find(source => source.id === input.id)?.ac ?? complex(0));
  return solve(tangent, s, u, options);
}
/** Unit excitation at one independent source coordinate, all others zero.
 * Controlled sources and physical loading remain in J. Gain is a derivative.
 */
export function bjtTransfer(tangent: BjtTangent, input: string, observed: string, s: Complex,
  options: Partial<Tolerances> = {}): (BjtFrequencySuccess & {
    input: string; output: string; initial: 'zero-state'; transfer: Omit<Measurement, 'unit'> & { unit: 'V/V' | 'V/A' | 'A/V' | 'A/A' };
  }) | LinearFailure | BjtTangentFailure {
  const index = tangent.inputs.findIndex(i => i.id === input);
  const row = tangent.outputs.find(o => o.id === observed);
  if (index < 0 || !row) throw new RangeError('Unknown input or observation');
  const result = solve(tangent, s, tangent.inputs.map((_, i) => complex(i === index ? 1 : 0)), options);
  if (result.status !== 'ok') return result;
  return { ...result, input, output: observed, initial: 'zero-state',
    transfer: { ...result.observations[observed]!, unit: `${row.unit}/${tangent.inputs[index]!.unit}` } };
}
