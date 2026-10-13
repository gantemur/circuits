import { currentRow } from './assembly.js';
import { complex } from './complex.js';
import { dot, type Tolerances } from './numeric.js';
import { bjtTerminals, type BjtEvaluation } from './bjt-model.js';
import { bjtBiasFingerprint, ownedBjtDocument, type BjtDocument } from './bjt-document.js';
import { assembleBjtSystem, evaluateBjtSystem, type BjtSystem, type BjtSystemEvaluation } from './bjt-system.js';
import { dcSettings, physicalRows, solveDcNewton, dcFailure } from './nonlinear-dc.js';
import type { DevicePower, DiodeEvaluation, NewtonTrace, OperatingPointFailure,
  OperatingPointOptions, PhysicalResidual } from './diode-operating-point.js';

export interface BjtOperatingPointSuccess {
  status: 'ok'; kind: 'bjt'; document: BjtDocument; biasFingerprint: string;
  x: number[]; unknowns: Record<string, number>;
  observations: Record<string, { value: number; unit: 'A' | 'V' }>;
  diodes: Record<string, DiodeEvaluation>; bjts: Record<string, BjtEvaluation>;
  /** Two-terminal powers only; Q's three-terminal powers are in bjts. */
  powers: DevicePower[]; residuals: PhysicalResidual[]; groundKcl: PhysicalResidual;
  powerBalanceW: number; powerPhysicalAllowanceW: number; powerArithmeticAllowanceW: number;
  trace: NewtonTrace[];
}
export type BjtOperatingPointResult = BjtOperatingPointSuccess | OperatingPointFailure;

/** Same fixed pre-search current scale as diode DC: independent currents and
 * source-implied V/R or VCCS currents. It is a globalization weight, not a
 * physical tolerance. No trial may improve merit by enlarging its denominator.
 */
function currentScale(system: BjtSystem): number {
  const sources = new Map(system.document.experiment.sources.map(s => [s.id, s.dc]));
  const nominalVoltage = Math.max(1, ...system.document.circuit.components
    .filter(d => d.type === 'V').map(d => Math.abs(sources.get(d.id)!)));
  let scale = 1e-3;
  for (const device of system.document.circuit.components) {
    let candidate = 0;
    if (device.type === 'R') candidate = nominalVoltage / device.value;
    if (device.type === 'I') candidate = Math.abs(sources.get(device.id)!);
    if (device.type === 'VCCS') candidate = Math.abs(device.gain) * nominalVoltage;
    if (Number.isFinite(candidate)) scale = Math.max(scale, candidate);
  }
  return scale;
}

/** Independently reconstruct branch currents and signed watts at a candidate.
 * Q diagnostics are three-terminal records, never an invented p/n branch.
 * Physical relative allowances use actual branch differences/net currents;
 * separate arithmetic estimates retain uncancelled numerical operands.
 */
function describe(system: BjtSystem, x: number[], evaluation: BjtSystemEvaluation,
  trace: NewtonTrace[], tolerance: Tolerances): BjtOperatingPointResult {
  const core = system.core;
  const node = (id: string) => id === '0' ? 0 : x[core.linear.nodeIndex.get(id)!]!;
  const residuals = physicalRows(core, evaluation, tolerance);
  if (residuals.some(row => !row.passed)) return dcFailure('physical-residual', 'Original static equations failed', trace);
  const currents = new Map<string, number>();
  const powers: DevicePower[] = [];
  const groundTerms: number[] = [];
  let groundArithmetic = 0;
  let powerArithmetic = 0;
  const powerTerms: number[] = [];
  const eps = Number.EPSILON;
  for (const device of system.document.circuit.components) {
    if (device.type === 'Q') {
      const q = evaluation.bjts[device.id]!;
      if (Math.abs(q.conservationResidualA) > q.conservationArithmeticAllowanceA)
        return dcFailure('physical-residual', `${device.id}: terminal-current conservation failed`, trace);
      if (Math.abs(q.powerIdentityResidualW) > q.powerArithmeticAllowanceW)
        return dcFailure('power-balance', `${device.id}: Ebers–Moll power identity failed`, trace);
      for (const terminal of bjtTerminals) if (device[terminal] === '0') {
        groundTerms.push(q.currentsA[terminal]);
        groundArithmetic += q.currentArithmeticAllowanceA[terminal];
      }
      powerTerms.push(q.absorbedW);
      powerArithmetic += q.powerArithmeticAllowanceW;
      continue;
    }
    const row = device.type === 'D' ? null : currentRow(core.linear, device);
    const currentA = device.type === 'D' ? evaluation.diode[device.id]!.currentA :
      row!.kind === 'derivative' ? 0 : dot(row!.C, x.slice(0, core.linear.unknowns.length)) + dot(row!.D, core.dcInputs);
    const voltageV = node(device.p) - node(device.n);
    const absorbedW = voltageV * currentA;
    if (![currentA, voltageV, absorbedW].every(Number.isFinite))
      return dcFailure('numeric-range', 'Branch current or power exceeds range', trace);
    currents.set(device.id, currentA);
    powers.push({ id: device.id, voltageV, currentA, absorbedW });
    powerTerms.push(absorbedW);
    const voltageArithmetic = 4 * eps * (Math.abs(node(device.p)) + Math.abs(node(device.n)));
    // For an explicit branch current, the candidate coordinate is exact data
    // here; algebraic row acceptance separately checks its constitutive law.
    let currentArithmetic = 8 * eps * Math.abs(currentA);
    if (device.type === 'R') currentArithmetic += voltageArithmetic / device.value;
    if (device.type === 'VCCS') currentArithmetic += 4 * eps * Math.abs(device.gain) *
      (Math.abs(node(device.cp)) + Math.abs(node(device.cn)));
    powerArithmetic += Math.abs(voltageV) * currentArithmetic + Math.abs(currentA) * voltageArithmetic + 8 * eps * Math.abs(absorbedW);
    if (device.p === '0') { groundTerms.push(currentA); groundArithmetic += currentArithmetic; }
    if (device.n === '0') { groundTerms.push(-currentA); groundArithmetic += currentArithmetic; }
    if (device.type === 'D') {
      const junctionW = evaluation.diode[device.id]!.junctionVoltageV * currentA;
      const seriesW = device.model.seriesResistanceOhm * currentA * currentA;
      const allowance = tolerance.voltageAbsolute * tolerance.currentAbsolute + tolerance.relative *
        (Math.abs(absorbedW) + Math.abs(junctionW) + Math.abs(seriesW));
      if (![junctionW, seriesW, allowance].every(Number.isFinite) || Math.abs(absorbedW - junctionW - seriesW) > allowance)
        return dcFailure('power-balance', `${device.id}: diode power decomposition failed`, trace);
    }
  }
  const magnitude = (values: number[]) => values.reduce((sum, value) => sum + Math.abs(value), 0);
  const groundValue = groundTerms.reduce((sum, value) => sum + value, 0);
  const physicalAllowance = tolerance.currentAbsolute + tolerance.relative * magnitude(groundTerms);
  groundArithmetic += 8 * (groundTerms.length + 1) * eps * magnitude(groundTerms);
  const groundKcl: PhysicalResidual = { label: 'KCL(0)', unit: 'A', value: complex(groundValue),
    absolute: Math.abs(groundValue), physicalAllowance, arithmeticAllowance: groundArithmetic,
    tolerance: physicalAllowance + groundArithmetic, passed: Math.abs(groundValue) <= physicalAllowance + groundArithmetic };
  const powerBalanceW = powerTerms.reduce((sum, value) => sum + value, 0);
  const powerPhysicalAllowanceW = tolerance.voltageAbsolute * tolerance.currentAbsolute + tolerance.relative * magnitude(powerTerms);
  powerArithmetic += 8 * (powerTerms.length + 1) * eps * magnitude(powerTerms);
  if (![groundValue, groundKcl.tolerance, powerBalanceW, powerPhysicalAllowanceW, powerArithmetic].every(Number.isFinite))
    return dcFailure('numeric-range', 'Physical diagnostics exceed range', trace);
  if (!groundKcl.passed) return dcFailure('physical-residual', 'Ground KCL failed', trace);
  if (Math.abs(powerBalanceW) > powerPhysicalAllowanceW + powerArithmetic)
    return dcFailure('power-balance', 'Signed network powers failed', trace);
  const observations: BjtOperatingPointSuccess['observations'] = Object.create(null);
  for (const observation of system.document.circuit.observations) {
    const value = observation.type === 'voltage' ? node(observation.p) - node(observation.n) :
      observation.type === 'terminal-current' ? evaluation.bjts[observation.component]!.currentsA[observation.terminal] :
        currents.get(observation.component)!;
    if (!Number.isFinite(value)) return dcFailure('numeric-range', 'Observation exceeds range', trace);
    observations[observation.id] = { value, unit: observation.type === 'voltage' ? 'V' : 'A' };
  }
  const unknowns: Record<string, number> = Object.create(null);
  core.unknowns.forEach((label, index) => { unknowns[label.id] = x[index]!; });
  return { status: 'ok', kind: 'bjt', document: ownedBjtDocument(system.document),
    biasFingerprint: bjtBiasFingerprint(system.document), x: [...x], unknowns, observations,
    diodes: evaluation.diode, bjts: evaluation.bjts, powers, residuals, groundKcl,
    powerBalanceW, powerPhysicalAllowanceW, powerArithmeticAllowanceW: powerArithmetic, trace };
}

/** Strict v3 DC only. Reuses the released damped Newton loop and dense solver.
 * Source waveforms/AC and absolute storage initial values do not set DC bias.
 * Singular final Jacobians and exhausted budgets are explicit limitations,
 * not proofs about all possible roots or stability.
 */
export function solveBjtOperatingPoint(document: BjtDocument, options: OperatingPointOptions = {}): BjtOperatingPointResult {
  const system = assembleBjtSystem(document);
  const config = dcSettings(options, system.core, currentScale(system));
  const solved = solveDcNewton(system.core, config, x => evaluateBjtSystem(system, x), (x, evaluation) => {
    const checked = describe(system, x, evaluation, [], config.tolerance);
    return checked.status === 'ok' ? undefined : checked;
  });
  if (solved.status !== 'ok') return solved;
  return describe(system, solved.x, solved.evaluation, solved.trace, config.tolerance);
}
