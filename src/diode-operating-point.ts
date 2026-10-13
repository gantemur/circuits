import { dcSettings, physicalRows, solveDcNewton, dcFailure as failure } from './nonlinear-dc.js';
import { assemble, currentRow, type Assembly } from './assembly.js';
import { solveDC, type AnalysisResult } from './analysis.js';
import { complex } from './complex.js';
import { validateDocument, type NativeDocument } from './model.js';
import { dot, zeros, type Label, type Matrix,
  type Residual, type Tolerances } from './numeric.js';
import { linearCore, nonlinearBiasFingerprint, ownedNonlinearDocument, validateNonlinearDocument,
  type Diode, type NonlinearDocument } from './nonlinear-model.js';

export const boltzmannJPerK = 1.380649e-23;
export const elementaryChargeC = 1.602176634e-19;
const ordered = (a: Diode, b: Diode): number => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export interface DiodeEvaluation {
  terminalVoltageV: number; junctionVoltageV: number; currentA: number;
  modelCurrentA: number; junctionConductanceS: number; terminalConductanceS: number;
  differentialResistanceOhm: number | null;
}
export interface DiodeSystem {
  document: NonlinearDocument; linear: Assembly; diodes: Diode[];
  unknowns: Label[]; rows: Label[]; dcInputs: number[];
}
export interface NonlinearEvaluation {
  residual: number[]; jacobian: Matrix; diode: Record<string, DiodeEvaluation>;
  terms: number[][]; physicalTerms: number[][];
}
export interface PhysicalResidual extends Residual {
  physicalAllowance: number; arithmeticAllowance: number;
}
export interface OperatingPointOptions {
  maxIterations?: number; maxBacktracks?: number; initialGuess?: number[];
  currentScaleA?: number; voltageScaleV?: number; tolerance?: Partial<Tolerances>;
}
export interface NewtonTrace {
  iteration: number; damping: number; merit: number;
  voltageCorrectionV: number; currentCorrectionA: number;
}
export interface DevicePower { id: string; voltageV: number; currentA: number; absorbedW: number }
export interface NonlinearSuccess {
  status: 'ok'; kind: 'nonlinear'; x: number[]; unknowns: Record<string, number>;
  observations: Record<string, { value: number; unit: 'V' | 'A' }>;
  diodes: Record<string, DiodeEvaluation>; residuals: PhysicalResidual[]; groundKcl: Residual;
  powers: DevicePower[]; powerBalanceW: number; powerToleranceW: number;
  trace: NewtonTrace[]; document: NonlinearDocument; biasFingerprint: string;
}
export interface OperatingPointFailure {
  status: 'failed'; code: 'numeric-range' | 'linearized-system' | 'line-search' | 'iteration-limit'
    | 'physical-residual' | 'degenerate-jacobian' | 'power-balance';
  message: string; trace: NewtonTrace[]; linearStatus?: string;
}
export type NonlinearResult = NonlinearSuccess | OperatingPointFailure;

/**
 * Evaluate a memoryless Shockley-series branch at terminal voltage V and
 * p→n auxiliary current A. With eta=n*kB*T/q (V), vj=v-Rs*i (V), the model
 * current is Is*expm1(vj/eta) (A) and gj=Is*exp(vj/eta)/eta (S).
 * `expm1` preserves accuracy near zero; gj is not recovered from i+Is,
 * which loses reverse-bias digits. Return null when a derived quantity is
 * outside floating-point range, never a clipped substitute law.
 */
export function evaluateDiode(diode: Diode, terminalVoltageV: number, currentA: number): DiodeEvaluation | null {
  const model = diode.model;
  const eta = model.idealityFactor * boltzmannJPerK * model.temperatureK / elementaryChargeC;
  const junctionVoltageV = terminalVoltageV - model.seriesResistanceOhm * currentA;
  const normalized = junctionVoltageV / eta;
  const exponential = Math.exp(normalized);
  const modelCurrentA = model.saturationCurrentA * Math.expm1(normalized);
  // Log-domain product avoids an intermediate Is/eta underflow or overflow.
  // In particular, reverse gj is not reconstructed as (i+Is)/eta.
  const junctionConductanceS = Math.exp(Math.log(model.saturationCurrentA) - Math.log(eta) + normalized);
  const seriesProduct = model.seriesResistanceOhm * junctionConductanceS;
  const terminalConductanceS = junctionConductanceS / (1 + seriesProduct);
  const differentialResistanceOhm = junctionConductanceS === 0 ? null :
    model.seriesResistanceOhm + 1 / junctionConductanceS;
  const essential = [eta, junctionVoltageV, normalized, exponential, modelCurrentA,
    junctionConductanceS, seriesProduct, terminalConductanceS];
  if (eta <= 0 || essential.some(v => !Number.isFinite(v)) || !Number.isFinite(terminalVoltageV) || !Number.isFinite(currentA))
    return null;
  return { terminalVoltageV, junctionVoltageV, currentA, modelCurrentA,
    junctionConductanceS, terminalConductanceS,
    differentialResistanceOhm: differentialResistanceOhm !== null && Number.isFinite(differentialResistanceOhm) && differentialResistanceOhm > 0
      ? differentialResistanceOhm : null };
}

/**
 * Assemble an owned DC system with N v1 unknowns plus m diode currents.
 * Existing K, B, row labels, and source ordering come from `assemble`; m
 * sorted diode law rows follow those N rows. Capacitor E stamps do not enter
 * DC, while inductor/controlled-source constraints remain in K.
 */
export function assembleDiodeSystem(input: NonlinearDocument): DiodeSystem {
  const document = ownedNonlinearDocument(input);
  const linear = assemble(linearCore(document).circuit);
  const diodes = document.circuit.components.filter((c): c is Diode => c.type === 'D').sort(ordered);
  const unknowns = [...linear.unknowns, ...diodes.map(d => ({ id: `I(${d.id})`, unit: 'A' as const, description: `${d.id} anode-to-cathode current` }))];
  const rows = [...linear.rows, ...diodes.map(d => ({ id: `law(${d.id})`, unit: 'A' as const, description: 'iD-Is expm1((Vp-Vn-Rs iD)/eta)=0' }))];
  const dcInputs = linear.inputs.map(input => document.experiment.sources.find(source => source.id === input.id)!.dc);
  return { document, linear, diodes, unknowns, rows, dcInputs };
}

/**
 * Input x has N+m real coordinates (node volts and branch amperes). Output F
 * has N+m rows: KCL/diode laws in A and linear branch constraints in V;
 * J is (N+m)×(N+m), with each entry carrying row-unit/column-unit. F is
 * Kx-Bu in old rows, plus diode KCL currents and constitutive rows. J is
 * the exact derivative of that same residual. Every diode stamp
 * adds to matrix entries; p=n therefore cancels incidence rather than being
 * broken by assignment. `terms` retain expanded arithmetic operands for a
 * roundoff allowance; `physicalTerms` use branch voltage/current quantities
 * for a separate, unit-aware model residual allowance.
 */
export function evaluateDiodeSystem(system: DiodeSystem, x: number[]): NonlinearEvaluation | null {
  const n = system.linear.unknowns.length;
  if (x.length !== system.unknowns.length || x.some(v => !Number.isFinite(v))) return null;
  const jacobian = zeros(x.length);
  const terms: number[][] = system.rows.map(() => []);
  const residual = Array<number>(x.length).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const coefficient = system.linear.K[i]![j]!;
      jacobian[i]![j] = coefficient;
      terms[i]!.push(coefficient * x[j]!);
    }
    // Preserve each source contribution before cancellation in the physical
    // allowance. Two large opposing sources must not erase the scale of the
    // arithmetic used to evaluate this KCL or constraint row.
    for (let input = 0; input < system.dcInputs.length; input++)
      terms[i]!.push(-system.linear.B[i]![input]! * system.dcInputs[input]!);
    residual[i] = terms[i]!.reduce((sum, term) => sum + term, 0);
  }
  const diode: Record<string, DiodeEvaluation> = Object.create(null);
  for (let k = 0; k < system.diodes.length; k++) {
    const device = system.diodes[k]!;
    const branch = n + k;
    const pi = system.linear.nodeIndex.get(device.p);
    const ni = system.linear.nodeIndex.get(device.n);
    const voltage = (pi === undefined ? 0 : x[pi]!) - (ni === undefined ? 0 : x[ni]!);
    const evaluation = evaluateDiode(device, voltage, x[branch]!);
    if (!evaluation) return null;
    diode[device.id] = evaluation;
    if (pi !== undefined) {
      jacobian[pi]![branch] = jacobian[pi]![branch]! + 1;
      terms[pi]!.push(x[branch]!);
      residual[pi] = residual[pi]! + x[branch]!;
      jacobian[branch]![pi] = jacobian[branch]![pi]! - evaluation.junctionConductanceS;
    }
    if (ni !== undefined) {
      jacobian[ni]![branch] = jacobian[ni]![branch]! - 1;
      terms[ni]!.push(-x[branch]!);
      residual[ni] = residual[ni]! - x[branch]!;
      jacobian[branch]![ni] = jacobian[branch]![ni]! + evaluation.junctionConductanceS;
    }
    jacobian[branch]![branch] = 1 + device.model.seriesResistanceOhm * evaluation.junctionConductanceS;
    terms[branch]!.push(x[branch]!, -evaluation.modelCurrentA);
    residual[branch] = x[branch]! - evaluation.modelCurrentA;
  }
  const physicalTerms = physicalContributions(system, x, diode);
  if ([...residual, ...jacobian.flat(), ...terms.flat(), ...physicalTerms.flat()].some(v => !Number.isFinite(v))) return null;
  return { residual, jacobian, diode, terms, physicalTerms };
}

/**
 * Reconstruct the noncancelled device contributions in each physical row.
 * A resistor contributes (Vp-Vn)/R amperes to KCL, not G*Vp and -G*Vn
 * separately. Likewise voltage constraints compare terminal and control
 * differences in volts; a shift of all nodes cannot enlarge their scale.
 */
function physicalContributions(
  system: DiodeSystem, x: number[], diode: Record<string, DiodeEvaluation>,
): number[][] {
  const rows: number[][] = system.rows.map(() => []);
  const sourceValues = new Map(system.linear.inputs.map((input, index) => [input.id, system.dcInputs[index]!]));
  const diodeRows = new Map(system.diodes.map((device, index) => [device.id, system.linear.unknowns.length + index]));
  const nodeVoltage = (id: string): number => id === '0' ? 0 : x[system.linear.nodeIndex.get(id)!]!;
  const branchVoltage = (p: string, n: string): number => nodeVoltage(p) - nodeVoltage(n);
  const branchCurrent = (id: string): number => x[system.linear.branchIndex.get(id)!]!;
  const sourceValue = (id: string): number => sourceValues.get(id)!;
  const contributeCurrent = (p: string, n: string, current: number): void => {
    if (p === n) return; // A same-node branch has no external KCL incidence.
    const pi = system.linear.nodeIndex.get(p);
    const ni = system.linear.nodeIndex.get(n);
    if (pi !== undefined) rows[pi]!.push(current);
    if (ni !== undefined) rows[ni]!.push(-current);
  };
  for (const device of system.document.circuit.components) {
    if (device.type === 'D') {
      const current = diode[device.id]!.currentA;
      contributeCurrent(device.p, device.n, current);
      rows[diodeRows.get(device.id)!]!.push(current, -diode[device.id]!.modelCurrentA);
      continue;
    }
    let current = 0;
    switch (device.type) {
      case 'R': current = branchVoltage(device.p, device.n) / device.value; break;
      case 'C': break; // A capacitor is open at DC.
      case 'L': case 'V': case 'VCVS': case 'CCVS': current = branchCurrent(device.id); break;
      case 'I': current = sourceValue(device.id); break;
      case 'VCCS': current = device.gain * branchVoltage(device.cp, device.cn); break;
      case 'CCCS': current = device.gain * branchCurrent(device.control); break;
    }
    contributeCurrent(device.p, device.n, current);
    const row = system.linear.branchIndex.get(device.id);
    if (row === undefined) continue;
    const voltage = branchVoltage(device.p, device.n);
    switch (device.type) {
      case 'L': rows[row]!.push(-voltage); break;
      case 'V': rows[row]!.push(voltage, -sourceValue(device.id)); break;
      case 'VCVS': rows[row]!.push(voltage, -device.gain * branchVoltage(device.cp, device.cn)); break;
      case 'CCVS': rows[row]!.push(voltage, -device.gain * branchCurrent(device.control)); break;
    }
  }
  return rows;
}

function defaultCurrentScale(system: DiodeSystem): number {
  // A fixed pre-search KCL scale: use declared DC voltage magnitudes across
  // conductances and the largest prescribed current. This changes line-search
  // weighting, never the physical acceptance tolerances. Ordinary 1 kΩ/1 V
  // examples retain the former 1 mA scale.
  const sourceValues = new Map(system.linear.inputs.map((input, index) => [input.id, system.dcInputs[index]!]));
  const nominalVoltageV = Math.max(1, ...system.document.circuit.components
    .filter(device => device.type === 'V')
    .map(device => Math.abs(sourceValues.get(device.id)!)));
  let scale = 1e-3;
  for (const device of system.document.circuit.components) {
    let candidate = 0;
    if (device.type === 'R') candidate = nominalVoltageV / device.value;
    if (device.type === 'I') candidate = Math.abs(sourceValues.get(device.id)!);
    if (device.type === 'VCCS') candidate = Math.abs(device.gain) * nominalVoltageV;
    if (Number.isFinite(candidate)) scale = Math.max(scale, candidate);
  }
  return scale;
}

function describe(system: DiodeSystem, x: number[], evaluation: NonlinearEvaluation,
  trace: NewtonTrace[], t: Tolerances): NonlinearResult {
  const residuals = physicalRows(system, evaluation, t);
  if (residuals.some(row => !row.passed)) return failure('physical-residual', 'Unclipped physical equations exceed row-unit tolerances', trace);
  const original = system.document.circuit;
  const nodeVoltage = (id: string) => id === '0' ? 0 : x[system.linear.nodeIndex.get(id)!]!;
  const powers: DevicePower[] = [];
  const currents = new Map<string, number>();
  for (const device of original.components) {
    let currentA: number;
    if (device.type === 'D') currentA = evaluation.diode[device.id]!.currentA;
    else {
      const row = currentRow(system.linear, device);
      currentA = row.kind === 'derivative' ? 0 : dot(row.C, x.slice(0, system.linear.unknowns.length)) + dot(row.D, system.dcInputs);
    }
    const voltageV = nodeVoltage(device.p) - nodeVoltage(device.n);
    const absorbedW = voltageV * currentA;
    if (![currentA, voltageV, absorbedW].every(Number.isFinite))
      return failure('numeric-range', 'A device current or power exceeds numeric range', trace);
    powers.push({ id: device.id, voltageV, currentA, absorbedW });
    currents.set(device.id, currentA);
    if (device.type === 'D') {
      const junctionW = evaluation.diode[device.id]!.junctionVoltageV * currentA;
      const seriesW = device.model.seriesResistanceOhm * currentA * currentA;
      const allowanceW = t.voltageAbsolute * t.currentAbsolute + t.relative *
        (Math.abs(absorbedW) + Math.abs(junctionW) + Math.abs(seriesW));
      if (![junctionW, seriesW, allowanceW].every(Number.isFinite) ||
        Math.abs(absorbedW - (junctionW + seriesW)) > allowanceW)
        return failure('power-balance', `${device.id}: diode power decomposition failed`, trace);
    }
  }
  const groundTerms: number[] = [];
  for (const device of original.components) {
    if (device.p === '0') groundTerms.push(currents.get(device.id)!);
    if (device.n === '0') groundTerms.push(-currents.get(device.id)!);
  }
  const groundValue = groundTerms.reduce((sum, term) => sum + term, 0);
  const groundAllowance = t.currentAbsolute + t.relative * groundTerms.reduce((sum, term) => sum + Math.abs(term), 0);
  const groundKcl: Residual = { label: 'KCL(0)', unit: 'A', value: complex(groundValue),
    absolute: Math.abs(groundValue), tolerance: groundAllowance, passed: Math.abs(groundValue) <= groundAllowance };
  if (!Number.isFinite(groundValue) || !Number.isFinite(groundAllowance) || !groundKcl.passed)
    return failure('physical-residual', 'Ground KCL did not balance', trace);
  const powerBalanceW = powers.reduce((sum, power) => sum + power.absorbedW, 0);
  const powerToleranceW = t.voltageAbsolute * t.currentAbsolute + t.relative *
    powers.reduce((sum, power) => sum + Math.abs(power.absorbedW), 0);
  if (![powerBalanceW, powerToleranceW].every(Number.isFinite) || Math.abs(powerBalanceW) > powerToleranceW)
    return failure('power-balance', 'Signed device powers did not balance', trace);
  const observations: NonlinearSuccess['observations'] = Object.create(null);
  for (const observation of original.observations) {
    const value = observation.type === 'voltage' ? nodeVoltage(observation.p) - nodeVoltage(observation.n)
      : currents.get(observation.component)!;
    if (!Number.isFinite(value)) return failure('numeric-range', 'An observation exceeds numeric range', trace);
    observations[observation.id] = { value, unit: observation.type === 'voltage' ? 'V' : 'A' };
  }
  const unknowns: Record<string, number> = Object.create(null);
  system.unknowns.forEach((label, i) => { unknowns[label.id] = x[i]!; });
  return { status: 'ok', kind: 'nonlinear', x: [...x], unknowns, observations,
    diodes: evaluation.diode, residuals, groundKcl, powers, powerBalanceW, powerToleranceW,
    trace, document: ownedNonlinearDocument(system.document),
    biasFingerprint: nonlinearBiasFingerprint(system.document) };
}

/**
 * Solve F(x,uDC)=0 from a deterministic zero guess or supplied N+m real
 * coordinates. Each iteration solves J*delta=-F without an inverse, then
 * halves alpha until max(|F_A|/currentScaleA, |F_V|/voltageScaleV) decreases.
 * Those fixed A/V scales are chosen before trials and never recomputed from
 * a candidate. A small step is insufficient: success requires every original
 * row's dimensioned residual allowance, finite final Jacobian, ground KCL,
 * and signed-power checks. Budget, singular correction, and numeric range
 * failures are explicit; none proves global absence of a nonlinear root.
 */
export function solveDiodeOperatingPoint(input: NonlinearDocument, options: OperatingPointOptions = {}): NonlinearResult {
  validateNonlinearDocument(input);
  const system = assembleDiodeSystem(input);
  const config = dcSettings(options, system, defaultCurrentScale(system));
  const solved = solveDcNewton(system, config, x => evaluateDiodeSystem(system, x));
  if (solved.status !== 'ok') return solved;
  return describe(system, solved.x, solved.evaluation, solved.trace, config.tolerance);
}

/** v1 documents run through the unchanged linear DC solver. */
export function solveOperatingPoint(document: NativeDocument | NonlinearDocument,
  options: OperatingPointOptions = {}): AnalysisResult | NonlinearResult {
  if (document.circuit.schemaVersion === 1) {
    const validated = validateDocument(document);
    return solveDC(assemble(validated.circuit), validated.experiment, options.tolerance);
  }
  return solveDiodeOperatingPoint(document as NonlinearDocument, options);
}
