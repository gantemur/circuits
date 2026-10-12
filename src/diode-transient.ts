import { assembleDiodeSystem, evaluateDiodeSystem, solveDiodeOperatingPoint,
  type DiodeSystem, type NonlinearEvaluation, type PhysicalResidual } from './diode-operating-point.js';
import { sourceAt, type Component } from './model.js';
import { ownedNonlinearDocument, validateNonlinearDocument, type NonlinearDocument } from './nonlinear-model.js';
import { complex } from './complex.js';
import { dot, solveReal, tolerances, type Matrix, type Tolerances, type Unit } from './numeric.js';

export interface NonlinearTransientOptions {
  start?: number; stop: number; step: number;
  maxIntervals?: number; maxIterations?: number; maxBacktracks?: number;
  maxUnknowns?: number; tolerance?: Partial<Tolerances>;
}
export interface TransientTrace {
  iteration: number; damping: number; merit: number;
  voltageCorrectionV: number; currentCorrectionA: number;
  storageRateCorrection: { id: string; value: number; unit: 'V/s' | 'A/s' }[];
}
export interface TransientStorage {
  id: string; unit: Unit; value: number; rate: number; rateUnit: 'V/s' | 'A/s';
}
export interface TransientSample {
  time: number; side: 'left' | 'right' | 'regular'; intervalSeconds: number;
  currentConvention: 'instantaneous-compatible' | 'backward-Euler-at-end-of-interval';
  x: number[]; unknowns: Record<string, { value: number; unit: Unit }>;
  sources: Record<string, { value: number; unit: Unit }>;
  observations: Record<string, { value: number; unit: Unit }>;
  diodes: NonNullable<ReturnType<typeof evaluateDiodeSystem>>['diode'];
  storage: TransientStorage[];
  powers: { id: string; voltageV: number; currentA: number; absorbedW: number }[];
  residuals: PhysicalResidual[]; groundKcl: PhysicalResidual;
  powerBalanceW: number; powerToleranceW: number;
  energyJ: number; backwardEulerDissipationJ: number | null;
  energyBalanceJ: number | null; energyToleranceJ: number | null;
  trace: TransientTrace[];
}
export interface TransientInitialization {
  kind: 'equilibrium' | 'storage'; method: string;
  storageValues: Record<string, number>; sourceValues: Record<string, number>;
}
export interface NonlinearTransientSuccess {
  status: 'ok'; document: NonlinearDocument; options: EffectiveOptions;
  initialization: TransientInitialization; samples: TransientSample[];
  method: 'backward-Euler';
}
export interface NonlinearTransientFailure {
  status: 'failed'; document: NonlinearDocument; options: EffectiveOptions;
  initialization: TransientInitialization | null; samples: TransientSample[];
  stage: 'equilibrium' | 'initialization' | 'step' | 'event' | 'grid';
  time: number; code: 'numeric-range' | 'linearized-system' | 'line-search' |
    'iteration-limit' | 'physical-residual' | 'degenerate-jacobian' |
    'inconsistent' | 'nonunique' | 'step-limit' | 'time-resolution' | 'power-balance';
  message: string; cause?: string; trace: TransientTrace[];
}
export type NonlinearTransientResult = NonlinearTransientSuccess | NonlinearTransientFailure;

type EffectiveOptions = Omit<Required<NonlinearTransientOptions>, 'tolerance'> & { tolerance: Tolerances };

type Stage = { kind: 'initialization'; q: number[] } | { kind: 'step'; q: number[]; h: number };
interface Evaluated {
  base: NonlinearEvaluation; residual: number[]; jacobian: Matrix;
  physical: number[][]; arithmetic: number[][]; constraints: number[];
}
interface SolveOk { status: 'ok'; x: number[]; rates: number[]; evaluation: Evaluated; trace: TransientTrace[] }
interface SolveFailed { status: 'failed'; code: NonlinearTransientFailure['code']; message: string; cause?: string; trace: TransientTrace[] }
type SolveResult = SolveOk | SolveFailed;

function effectiveOptions(input: NonlinearTransientOptions): EffectiveOptions {
  const options = { start: input.start ?? 0, stop: input.stop, step: input.step,
    maxIntervals: input.maxIntervals ?? 10000, maxIterations: input.maxIterations ?? 60,
    maxBacktracks: input.maxBacktracks ?? 30, maxUnknowns: input.maxUnknowns ?? 64,
    tolerance: tolerances(input.tolerance) };
  if (![options.start, options.stop, options.step].every(Number.isFinite) ||
    options.stop <= options.start || options.step <= 0 || options.maxUnknowns > 64 ||
    ![options.maxIntervals, options.maxIterations, options.maxBacktracks, options.maxUnknowns]
      .every(value => Number.isSafeInteger(value) && value > 0))
    throw new RangeError('Require finite start < stop, positive step, and positive workload limits');
  return options;
}

function sourceValues(system: DiodeSystem, time: number, side: 'left' | 'right'): number[] {
  return system.linear.inputs.map(input => {
    const source = system.document.experiment.sources.find(value => value.id === input.id)!;
    return sourceAt(source, time, side);
  });
}
function storageValues(system: DiodeSystem, x: number[]): number[] {
  // S is m×N; the extra diode-current columns are zero by construction.
  return system.linear.storage.map(storage => dot(storage.S, x));
}
function failed(code: SolveFailed['code'], message: string, trace: TransientTrace[], cause?: string): SolveFailed {
  return { status: 'failed', code, message, trace, ...(cause ? { cause } : {}) };
}

/**
 * Evaluate the physical augmented equations. N static coordinates include
 * non-ground node volts, linear branch amperes, then sorted diode amperes;
 * m storage rates are V/s for C and A/s for L. Initialization has N+m
 * equations [r+Φw; Sx-q]=0. A step has N equations
 * r(x,u)+Φ(Sx-qprevious)/h=0. Φ is N×m, S is m×N; E=ΦS is
 * never inverted. Branch differences are formed before Φ multiplication.
 */
function evaluate(system: DiodeSystem, variables: number[], stage: Stage): Evaluated | null {
  const n = system.unknowns.length;
  const m = system.linear.storage.length;
  const x = variables.slice(0, n);
  const base = evaluateDiodeSystem(system, x);
  if (!base) return null;
  const q = storageValues(system, x);
  const rates = stage.kind === 'initialization'
    ? variables.slice(n) : q.map((value, i) => (value - stage.q[i]!) / stage.h);
  if (rates.length !== m || [...q, ...rates].some(value => !Number.isFinite(value))) return null;
  const residual = [...base.residual];
  const jacobian = base.jacobian.map(row => [...row]);
  const physical = base.physicalTerms.map(row => [...row]);
  const arithmetic = base.terms.map(row => [...row]);
  for (let k = 0; k < m; k++) {
    const storage = system.linear.storage[k]!;
    for (let i = 0; i < n; i++) {
      const contribution = (storage.F[i] ?? 0) * rates[k]!;
      residual[i] = residual[i]! + contribution;
      physical[i]!.push(contribution);
      arithmetic[i]!.push(contribution);
      if (stage.kind === 'step') {
        // The evaluated companion current uses the *difference* q-qprevious.
        // Its cancellation budget also accounts for the two storage operands
        // whose subtraction preceded multiplication by F/h. This is an
        // arithmetic allowance only; physical scaling uses the actual rate.
        arithmetic[i]!.push(Math.abs(storage.F[i] ?? 0) *
          (Math.abs(q[k]!) + Math.abs(stage.q[k]!)) / stage.h);
      }
      if (stage.kind === 'initialization') jacobian[i]!.push(storage.F[i] ?? 0);
      else for (let j = 0; j < n; j++)
        jacobian[i]![j] = jacobian[i]![j]! + (storage.F[i] ?? 0) * (storage.S[j] ?? 0) / stage.h;
    }
  }
  const constraints: number[] = [];
  if (stage.kind === 'initialization') {
    for (let k = 0; k < m; k++) {
      constraints.push(q[k]! - stage.q[k]!);
      jacobian.push([...system.linear.storage[k]!.S, ...Array<number>(n - system.linear.unknowns.length + m).fill(0)]);
      physical.push([q[k]!, -stage.q[k]!]);
      arithmetic.push([q[k]!, -stage.q[k]!]);
    }
  }
  if ([...residual, ...constraints, ...jacobian.flat(), ...physical.flat(), ...arithmetic.flat()]
    .some(value => !Number.isFinite(value))) return null;
  return { base, residual: [...residual, ...constraints], jacobian, physical, arithmetic, constraints };
}

function checkedRows(system: DiodeSystem, stage: Stage, evaluated: Evaluated, t: Tolerances): PhysicalResidual[] {
  const labels = [...system.rows, ...stage.kind === 'initialization'
    ? system.linear.storage.map(s => ({ id: `initial(${s.id})`, unit: s.unit })) : []];
  return labels.map((label, i) => {
    const physicalSum = evaluated.physical[i]!.reduce((sum, v) => sum + Math.abs(v), 0);
    const arithmeticSum = evaluated.arithmetic[i]!.reduce((sum, v) => sum + Math.abs(v), 0);
    const floor = label.unit === 'V' ? t.voltageAbsolute : t.currentAbsolute;
    const physicalAllowance = floor + t.relative * physicalSum;
    const arithmeticAllowance = 8 * (evaluated.arithmetic[i]!.length + 1) * Number.EPSILON * arithmeticSum;
    const tolerance = physicalAllowance + arithmeticAllowance;
    const value = evaluated.residual[i]!;
    return { label: label.id, unit: label.unit, value: complex(value), absolute: Math.abs(value),
      tolerance, physicalAllowance, arithmeticAllowance,
      passed: Number.isFinite(tolerance) && Math.abs(value) <= tolerance };
  });
}
function merit(evaluated: Evaluated, scales: number[]): number {
  return Math.max(0, ...evaluated.residual.map((value, i) => Math.abs(value) / scales[i]!));
}
function solve(system: DiodeSystem, stage: Stage, guess: number[], options: EffectiveOptions): SolveResult {
  const n = system.unknowns.length;
  const m = system.linear.storage.length;
  let variables = stage.kind === 'initialization' ? [...guess, ...Array<number>(m).fill(0)] : [...guess];
  let current = evaluate(system, variables, stage);
  const trace: TransientTrace[] = [];
  if (!current) return failed('numeric-range', 'Initial augmented evaluation exceeds numeric range', trace);
  // Fixed dimensioned merit scales guide search only. Source operands, present
  // branch contributions, and storage companion terms enter before line search.
  const scales = current.residual.map((_, i) => {
    const unit = i < n ? system.rows[i]!.unit : system.linear.storage[i - n]!.unit;
    const floor = unit === 'V' ? 1 : 1e-3;
    const physical = current!.physical[i]!.reduce((sum, v) => sum + Math.abs(v), 0);
    const companion = stage.kind === 'step' ? system.linear.storage.reduce((sum, storage, k) =>
      sum + Math.abs(storage.F[i] ?? 0) * Math.abs(stage.q[k]!) / stage.h, 0) : 0;
    return Math.max(floor, physical, companion);
  });
  for (let iteration = 0; iteration <= options.maxIterations; iteration++) {
    if (checkedRows(system, stage, current, options.tolerance).every(row => row.passed)) {
      const regular = solveReal(current.jacobian, Array<number>(current.jacobian.length).fill(0), options.tolerance);
      if (regular.status !== 'ok') return failed(
        stage.kind === 'initialization' && regular.status === 'nonunique' ? 'nonunique' : 'degenerate-jacobian',
        'Final augmented Jacobian is unresolved', trace, regular.status);
      const x = variables.slice(0, n);
      const rates = stage.kind === 'initialization' ? variables.slice(n)
        : storageValues(system, x).map((q, i) => (q - stage.q[i]!) / stage.h);
      return { status: 'ok', x, rates, evaluation: current, trace };
    }
    if (iteration === options.maxIterations) break;
    const correction = solveReal(current.jacobian, current.residual.map(value => -value), options.tolerance);
    if (correction.status !== 'ok') return failed(
      correction.status === 'inconsistent' ? 'inconsistent' : correction.status === 'nonunique' ? 'nonunique' : 'linearized-system',
      'Newton correction system is unresolved', trace, correction.status);
    const delta = correction.x.map(value => value.re);
    if (delta.some(value => !Number.isFinite(value))) return failed('numeric-range', 'Newton correction exceeds range', trace);
    const before = merit(current, scales);
    let accepted = false;
    for (let backtrack = 0; backtrack < options.maxBacktracks; backtrack++) {
      const damping = 2 ** -backtrack;
      const candidate = variables.map((value, i) => value + damping * delta[i]!);
      const trial = evaluate(system, candidate, stage);
      if (!trial) continue;
      const after = merit(trial, scales);
      if (after < before * (1 - 1e-4 * damping)) {
        variables = candidate; current = trial; accepted = true;
        trace.push({ iteration: iteration + 1, damping, merit: after,
          voltageCorrectionV: Math.max(0, ...delta.map((value, i) =>
            i < n && system.unknowns[i]!.unit === 'V' ? Math.abs(damping * value) : 0)),
          currentCorrectionA: Math.max(0, ...delta.map((value, i) =>
            i < n && system.unknowns[i]!.unit === 'A' ? Math.abs(damping * value) : 0)),
          storageRateCorrection: stage.kind === 'initialization'
            ? system.linear.storage.map((s, i) => ({ id: s.id, value: damping * delta[n + i]!,
              unit: s.unit === 'V' ? 'V/s' : 'A/s' })) : [] });
        break;
      }
    }
    if (!accepted) return failed('line-search', 'No finite merit-decreasing trial within backtrack budget', trace);
  }
  return failed('iteration-limit', 'Augmented physical equations did not converge', trace);
}

function sample(system: DiodeSystem, stage: Stage, solved: SolveOk, time: number,
  side: TransientSample['side'], intervalSeconds: number, t: Tolerances,
  previous?: TransientSample): TransientSample | SolveFailed {
  const x = solved.x;
  const q = storageValues(system, x);
  const node = (id: string) => id === '0' ? 0 : x[system.linear.nodeIndex.get(id)!]!;
  const voltage = (p: string, n: string) => node(p) - node(n);
  const sources = new Map(system.linear.inputs.map((input, i) => [input.id, system.dcInputs[i]!]));
  const storageIndex = new Map(system.linear.storage.map((s, i) => [s.id, i]));
  const currents = new Map<string, number>();
  const powers: TransientSample['powers'] = [];
  for (const device of system.document.circuit.components) {
    let currentA: number;
    switch (device.type) {
      case 'D': currentA = solved.evaluation.base.diode[device.id]!.currentA; break;
      case 'R': currentA = voltage(device.p, device.n) / device.value; break;
      case 'C': currentA = device.value * solved.rates[storageIndex.get(device.id)!]!; break;
      case 'L': case 'V': case 'VCVS': case 'CCVS':
        currentA = x[system.linear.branchIndex.get(device.id)!]!; break;
      case 'I': currentA = sources.get(device.id)!; break;
      case 'VCCS': currentA = device.gain * voltage(device.cp, device.cn); break;
      case 'CCCS': currentA = device.gain * x[system.linear.branchIndex.get(device.control)!]!; break;
    }
    const voltageV = voltage(device.p, device.n);
    const absorbedW = voltageV * currentA;
    if (![voltageV, currentA, absorbedW].every(Number.isFinite))
      return failed('numeric-range', 'Reconstructed current or power exceeds range', solved.trace);
    currents.set(device.id, currentA);
    powers.push({ id: device.id, voltageV, currentA, absorbedW });
    if (device.type === 'D') {
      const junctionW = solved.evaluation.base.diode[device.id]!.junctionVoltageV * currentA;
      const seriesW = device.model.seriesResistanceOhm * currentA * currentA;
      const allowance = t.voltageAbsolute * t.currentAbsolute + t.relative *
        (Math.abs(absorbedW) + Math.abs(junctionW) + Math.abs(seriesW));
      if (![junctionW, seriesW, allowance].every(Number.isFinite) ||
        Math.abs(absorbedW - junctionW - seriesW) > allowance)
        return failed('power-balance', `${device.id}: diode power decomposition failed`, solved.trace);
    }
  }
  const groundTerms: number[] = [];
  for (const device of system.document.circuit.components) {
    if (device.p === '0') groundTerms.push(currents.get(device.id)!);
    if (device.n === '0') groundTerms.push(-currents.get(device.id)!);
  }
  const ground = groundTerms.reduce((sum, value) => sum + value, 0);
  const groundMagnitude = groundTerms.reduce((sum, value) => sum + Math.abs(value), 0);
  const groundPhysical = t.currentAbsolute + t.relative * groundMagnitude;
  const groundArithmetic = 8 * (groundTerms.length + 1) * Number.EPSILON * groundMagnitude;
  const groundTolerance = groundPhysical + groundArithmetic;
  const groundKcl: PhysicalResidual = { label: 'KCL(0)', unit: 'A', value: complex(ground),
    absolute: Math.abs(ground), tolerance: groundTolerance, physicalAllowance: groundPhysical,
    arithmeticAllowance: groundArithmetic, passed: Number.isFinite(groundTolerance) && Math.abs(ground) <= groundTolerance };
  const residuals = checkedRows(system, stage, solved.evaluation, t);
  if (!groundKcl.passed || residuals.some(row => !row.passed))
    return failed('physical-residual', 'A physical A/V residual exceeds its allowance', solved.trace);
  const powerBalanceW = powers.reduce((sum, item) => sum + item.absorbedW, 0);
  const powerMagnitude = powers.reduce((sum, item) => sum + Math.abs(item.absorbedW), 0);
  const powerToleranceW = t.voltageAbsolute * t.currentAbsolute + t.relative * powerMagnitude +
    8 * (powers.length + 1) * Number.EPSILON * powerMagnitude;
  if (![powerBalanceW, powerToleranceW].every(Number.isFinite) || Math.abs(powerBalanceW) > powerToleranceW)
    return failed('power-balance', 'Endpoint device powers do not balance', solved.trace);
  let energyJ = 0;
  let backwardEulerDissipationJ = 0;
  for (let i = 0; i < system.linear.storage.length; i++) {
    const s = system.linear.storage[i]!;
    const device = system.document.circuit.components.find(d => d.id === s.id)! as Component & { value: number };
    const value = q[i]!;
    const delta = previous ? value - previous.storage[i]!.value : 0;
    energyJ += 0.5 * device.value * value * value;
    backwardEulerDissipationJ += 0.5 * device.value * delta * delta;
  }
  let energyBalanceJ: number | null = null;
  let energyToleranceJ: number | null = null;
  if (previous && stage.kind === 'step') {
    const nonstorageW = powers.filter(power => !storageIndex.has(power.id))
      .reduce((sum, power) => sum + power.absorbedW, 0);
    energyBalanceJ = energyJ - previous.energyJ + intervalSeconds * nonstorageW + backwardEulerDissipationJ;
    const magnitude = Math.abs(energyJ) + Math.abs(previous.energyJ) +
      intervalSeconds * powerMagnitude + backwardEulerDissipationJ;
    energyToleranceJ = intervalSeconds * powerToleranceW +
      t.relative * (Math.abs(energyJ) + Math.abs(previous.energyJ) + backwardEulerDissipationJ) +
      16 * (powers.length + system.linear.storage.length + 1) * Number.EPSILON * magnitude;
    if (!Number.isFinite(energyBalanceJ) || !Number.isFinite(energyToleranceJ) ||
      Math.abs(energyBalanceJ) > energyToleranceJ)
      return failed('power-balance', 'Backward-Euler joule identity failed', solved.trace);
  }
  if (![energyJ, backwardEulerDissipationJ].every(Number.isFinite))
    return failed('numeric-range', 'Storage energy exceeds numeric range', solved.trace);
  const observations: TransientSample['observations'] = Object.create(null);
  for (const observation of system.document.circuit.observations) {
    const value = observation.type === 'voltage' ? voltage(observation.p, observation.n)
      : currents.get(observation.component)!;
    if (!Number.isFinite(value)) return failed('numeric-range', 'Observation exceeds numeric range', solved.trace);
    observations[observation.id] = { value, unit: observation.type === 'voltage' ? 'V' : 'A' };
  }
  const unknowns: TransientSample['unknowns'] = Object.create(null);
  system.unknowns.forEach((label, i) => { unknowns[label.id] = { value: x[i]!, unit: label.unit }; });
  const sourceRecord: TransientSample['sources'] = Object.create(null);
  system.linear.inputs.forEach((label, i) => { sourceRecord[label.id] = { value: system.dcInputs[i]!, unit: label.unit }; });
  return { time, side, intervalSeconds,
    currentConvention: stage.kind === 'step' ? 'backward-Euler-at-end-of-interval' : 'instantaneous-compatible',
    x: [...x], unknowns, sources: sourceRecord, observations,
    diodes: JSON.parse(JSON.stringify(solved.evaluation.base.diode)),
    storage: system.linear.storage.map((s, i) => ({ id: s.id, unit: s.unit, value: q[i]!, rate: solved.rates[i]!,
      rateUnit: s.unit === 'V' ? 'V/s' : 'A/s' })), powers, residuals, groundKcl,
    powerBalanceW, powerToleranceW, energyJ, backwardEulerDissipationJ: stage.kind === 'step' ? backwardEulerDissipationJ : null,
    energyBalanceJ, energyToleranceJ, trace: solved.trace };
}

/**
 * Headless fixed nominal-step backward Euler. Each source step is reached
 * with left values, then an independent right-side [J Φ; S 0] solve retains
 * q exactly; no impulse or hidden retry is introduced. A failed solve returns
 * only previously accepted samples. A finite residual verifies the stated
 * model equations, not time accuracy, root uniqueness, or stability.
 */
export function nonlinearTransient(input: NonlinearDocument, config: NonlinearTransientOptions): NonlinearTransientResult {
  validateNonlinearDocument(input);
  const options = effectiveOptions(config);
  const components = input.circuit.components;
  const estimatedUnknowns = input.circuit.nodes.length - 1 +
    components.filter(device => ['L', 'V', 'VCVS', 'CCVS', 'D'].includes(device.type)).length;
  const storageCount = components.filter(device => device.type === 'C' || device.type === 'L').length;
  // Check before assembleDiodeSystem allocates dense N×N matrices.
  if (estimatedUnknowns + storageCount > options.maxUnknowns)
    throw new RangeError('Augmented system exceeds maxUnknowns');
  const system = assembleDiodeSystem(input);
  const document = ownedNonlinearDocument(system.document);
  const n = system.unknowns.length;
  const samples: TransientSample[] = [];
  let initialization: TransientInitialization | null = null;
  const fail = (stage: NonlinearTransientFailure['stage'], time: number, result: SolveFailed): NonlinearTransientFailure =>
    ({ status: 'failed', document, options, initialization, samples, stage, time,
      code: result.code, message: result.message, ...(result.cause ? { cause: result.cause } : {}), trace: result.trace });
  const setSources = (time: number, side: 'left' | 'right') => {
    system.dcInputs = sourceValues(system, time, side);
    return system.dcInputs.every(Number.isFinite);
  };
  if (!setSources(options.start, 'left'))
    return fail('initialization', options.start, failed('numeric-range', 'Time source exceeds range', []));
  let q: number[];
  let guess = Array<number>(n).fill(0);
  if (document.experiment.initial.kind === 'equilibrium') {
    // The DC helper is used only with the frozen *actual* left time values.
    // It receives an owned temporary document; the caller's dc values remain unchanged.
    const frozen = ownedNonlinearDocument(document);
    for (const source of frozen.experiment.sources) {
      const index = system.linear.inputs.findIndex(input => input.id === source.id);
      source.dc = system.dcInputs[index]!;
    }
    const equilibrium = solveDiodeOperatingPoint(frozen, {
      maxIterations: options.maxIterations, maxBacktracks: options.maxBacktracks,
      tolerance: options.tolerance,
    });
    if (equilibrium.status !== 'ok')
      return fail('equilibrium', options.start, failed(equilibrium.code,
        'Frozen-source equilibrium is unresolved', [], equilibrium.message));
    guess = [...equilibrium.x];
    q = storageValues(system, guess);
  } else {
    q = system.linear.storage.map(storage => document.experiment.initial.kind === 'storage'
      ? document.experiment.initial.values.find(value => value.id === storage.id)!.value : 0);
  }
  initialization = { kind: document.experiment.initial.kind,
    method: 'Joint [J Φ; S 0] compatible initialization at actual left source values',
    storageValues: Object.fromEntries(system.linear.storage.map((s, i) => [s.id, q[i]!])),
    sourceValues: Object.fromEntries(system.linear.inputs.map((s, i) => [s.id, system.dcInputs[i]!])) };
  const initStage: Stage = { kind: 'initialization', q };
  const initial = solve(system, initStage, guess, options);
  if (initial.status !== 'ok') return fail('initialization', options.start, initial);
  const events = [...new Set(document.experiment.sources.flatMap(source =>
    source.waveform?.type === 'step' && source.waveform.at >= options.start && source.waveform.at <= options.stop
      ? [source.waveform.at] : []))].sort((a, b) => a - b);
  let time = options.start;
  const initialSample = sample(system, initStage, initial, time, events.includes(time) ? 'left' : 'regular', 0, options.tolerance);
  if ('status' in initialSample) return fail('initialization', time, initialSample);
  let current: TransientSample = initialSample;
  samples.push(current);
  const restart = (): NonlinearTransientFailure | null => {
    const retained = current.storage.map(s => s.value);
    if (!setSources(time, 'right')) return fail('event', time, failed('numeric-range', 'Right source exceeds range', []));
    const stage: Stage = { kind: 'initialization', q: retained };
    const result = solve(system, stage, current.x, options);
    if (result.status !== 'ok') return fail('event', time, result);
    const right = sample(system, stage, result, time, 'right', 0, options.tolerance);
    if ('status' in right) return fail('event', time, right);
    current = right;
    samples.push(right);
    return null;
  };
  if (events.includes(time)) {
    const error = restart(); if (error) return error;
  }
  let intervalCount = 0;
  let segmentStart = time;
  let segmentIndex = 0;
  while (time < options.stop) {
    if (intervalCount >= options.maxIntervals)
      return fail('grid', time, failed('step-limit', 'Maximum interval count exceeded', []));
    const boundary = events.find(event => event > time) ?? options.stop;
    // Restart each nominal grid at the last event. Do not coalesce close but
    // distinct event times, even when their separation is below a tolerance.
    const gridTime = segmentStart + (++segmentIndex) * options.step;
    const next = Math.min(gridTime, boundary, options.stop);
    const h = next - time;
    if (!Number.isFinite(next) || h <= 0)
      return fail('grid', time, failed('time-resolution', 'Time cannot advance representably', []));
    const event = events.includes(next);
    if (!setSources(next, event ? 'left' : 'right'))
      return fail('step', next, failed('numeric-range', 'Time source exceeds range', []));
    const stage: Stage = { kind: 'step', q: current.storage.map(s => s.value), h };
    const result = solve(system, stage, current.x, options);
    if (result.status !== 'ok') return fail('step', next, result);
    const nextSample = sample(system, stage, result, next, event ? 'left' : 'regular', h, options.tolerance, current);
    if ('status' in nextSample) return fail('step', next, nextSample);
    current = nextSample;
    samples.push(nextSample);
    time = next;
    intervalCount++;
    if (event) {
      const error = restart(); if (error) return error;
      segmentStart = time;
      segmentIndex = 0;
    }
  }
  return { status: 'ok', document, options, initialization, samples, method: 'backward-Euler' };
}
