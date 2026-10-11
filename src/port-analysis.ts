import { assemble } from './assembly.js';
import { solveFrequency, type AnalysisResult, type Solution } from './analysis.js';
import { abs, add, complex, div, finiteComplex, mul, scale, sub, type Complex } from './complex.js';
import { validateDocument, type Component, type NativeDocument, type Observation, type SourceValue } from './model.js';
import { solveLinear } from './numeric.js';

/**
 * Frequency-domain boundary experiments for the existing linear MNA model.
 * A port is an experiment coordinate, not a device: V=V(p)-V(q), and positive
 * I enters the characterized network at p. For n=1 or 2, Z and Y are n×n
 * matrices in Ω and S with V=ZI and I=YV. The original native document is
 * immutable; every test and loading circuit is a validated temporary copy.
 *
 * Each column is measured by a separate physical test solve. A 1 V RMS
 * Thévenin source and an optional port-2 resistor define loading. The dense
 * complex MNA solver supplies rank and physical residual diagnostics; it is
 * not a certified terminal-relation algorithm. In particular, nonunique
 * internal variables may prevent a solve even when boundary behavior would
 * be unique. We neither regularize the network nor invent a matrix entry.
 */

/** A port voltage is V(p)-V(q); positive current enters the network at p. */
export interface Port { p: string; q: string }
export type PortFailureCode = 'invalid-selection' | 'unsupported-exclusion' | 'incompatible-test'
  | 'nonunique' | 'numerical-failure';
export interface PortFailure { status: PortFailureCode; message: string; stage?: string; solve?: AnalysisResult }
export interface PortStage { name: string; solution: Solution }
export interface PortMatrix {
  status: 'ok'; unit: 'Ω' | 'S'; values: Complex[][]; stages: PortStage[];
}
export type PortRepresentation = PortMatrix | PortFailure;
export type PortLoad = { kind: 'open' } | { kind: 'resistor'; resistance: number };
export interface PortLoading { sourceResistance: number; load: PortLoad }
export interface PortConfig {
  ports: [Port] | [Port, Port]; frequencyHz: number; externalDrive?: string | null;
  testCurrent?: number; testVoltage?: number; loading?: PortLoading;
}
export interface PortOperatingPoint {
  v1: Complex; v2: Complex; i1: Complex; i2: Complex;
  sourceToOutputGain: Complex; terminalVoltageGain: Complex | null; inputImpedance: Complex | null;
}
export interface PortComparison {
  voltageDifference: [number, number]; currentDifference: [number, number];
  voltageLimit: [number, number]; currentLimit: [number, number]; passed: boolean;
}
export type PortPrediction = { status: 'ok'; point: PortOperatingPoint; comparison: PortComparison | null }
  | PortFailure;
export interface PortLoadResult {
  direct: ({ status: 'ok'; point: PortOperatingPoint; solution: Solution } | PortFailure);
  fromZ: PortPrediction; fromY: PortPrediction;
}
export interface PortCharacterization {
  status: 'ok'; ports: [Port] | [Port, Port]; frequencyHz: number; angularFrequency: number;
  excludedDrive: string | null; suppressedSources: string[]; retainedControlled: string[];
  z: PortRepresentation; y: PortRepresentation; loading?: PortLoadResult;
}
export type PortAnalysisResult = PortCharacterization | PortFailure;

const zero = (): Complex => complex(0);
const copy = (document: NativeDocument): NativeDocument => JSON.parse(JSON.stringify(document)) as NativeDocument;
const finiteValues = (values: Complex[]): boolean => values.every(finiteComplex);
function failure(status: PortFailureCode, message: string, stage?: string, solve?: AnalysisResult): PortFailure {
  return { status, message, ...(stage ? { stage } : {}), ...(solve ? { solve } : {}) };
}
function solveFailure(result: AnalysisResult, stage: string): PortFailure {
  if (result.status === 'ok') return failure('numerical-failure', 'Unexpected successful solve', stage);
  const status = result.status === 'nonunique' ? 'nonunique' : result.status === 'inconsistent' ? 'incompatible-test' : 'numerical-failure';
  return failure(status, `${stage}: ${result.status}: ${result.message}`, stage, result);
}
/** Exact-ID allocation across native node, component, source, and observation namespaces. */
function fresh(document: NativeDocument, prefix: string): string {
  const used = new Set([
    ...document.circuit.nodes,
    ...document.circuit.components.map(component => component.id),
    ...document.circuit.observations.map(observation => observation.id),
    ...document.experiment.sources.map(source => source.id),
  ]);
  let id = prefix;
  let suffix = 1;
  while (used.has(id)) id = `${prefix}-${suffix++}`;
  return id;
}
function addSource(document: NativeDocument, component: Component, amplitude: number): void {
  document.circuit.components.push(component);
  const source: SourceValue = { id: component.id, dc: 0, ac: complex(amplitude) };
  document.experiment.sources.push(source);
}
function voltageObservation(document: NativeDocument, port: Port): string {
  const id = fresh(document, '__port_voltage');
  const observation: Observation = { id, type: 'voltage', p: port.p, n: port.q };
  document.circuit.observations.push(observation);
  return id;
}
function currentObservation(document: NativeDocument, component: string): string {
  const id = fresh(document, '__port_current');
  document.circuit.observations.push({ id, type: 'current', component });
  return id;
}
function solve(document: NativeDocument, angularFrequency: number): AnalysisResult | PortFailure {
  try {
    return solveFrequency(assemble(document.circuit), document.experiment, complex(0, angularFrequency));
  } catch (error) {
    return failure('numerical-failure', `The temporary experiment could not be assembled or solved: ${String(error)}`);
  }
}
function solved(result: AnalysisResult | PortFailure, stage: string): Solution | PortFailure {
  if (result.status === 'ok') return result;
  if ('rank' in result) return solveFailure(result, stage);
  return { ...result, stage };
}
function nonfinite(stage: string): PortFailure {
  return failure('numerical-failure', `${stage}: a normalized result exceeds finite numeric range`, stage);
}

/**
 * Remove only an explicitly selected independent voltage drive, preserving
 * every other independent branch and controlled law. Zero all remaining
 * source coordinates, including configured RMS AC values, for the port tests.
 * Removed-branch current observations cannot remain in the temporary schema.
 */
function characterizedNetwork(document: NativeDocument, externalDrive: string | null): NativeDocument {
  const base = copy(document);
  if (externalDrive) {
    base.circuit.components = base.circuit.components.filter(component => component.id !== externalDrive);
    base.circuit.observations = base.circuit.observations.filter(observation =>
      observation.type !== 'current' || observation.component !== externalDrive);
    base.experiment.sources = base.experiment.sources.filter(source => source.id !== externalDrive);
  }
  for (const source of base.experiment.sources) {
    source.dc = 0;
    source.ac = zero();
  }
  return base;
}

/**
 * Z column j: source current J flows q_j→p_j, so it injects positive current
 * into the network at p_j. The other external port stays open. Measuring all
 * V_i and dividing by the actual J gives Z_ij in ohms. Every column has an
 * independent physical MNA solve and its full residual diagnostics.
 */
function impedance(base: NativeDocument, ports: Port[], omega: number, amplitude: number): PortRepresentation {
  const columns: Complex[][] = [];
  const stages: PortStage[] = [];
  for (let driven = 0; driven < ports.length; driven++) {
    const work = copy(base);
    const port = ports[driven]!;
    const id = fresh(work, '__z_test');
    addSource(work, { id, type: 'I', p: port.q, n: port.p }, amplitude);
    const observations = ports.map(selected => voltageObservation(work, selected));
    const stage = `Z column ${driven + 1}`;
    const result = solved(solve(work, omega), stage);
    if (result.status !== 'ok') return result;
    const column = observations.map(observation => scale(result.observations[observation]!.value, 1 / amplitude));
    if (!finiteValues(column)) return nonfinite(stage);
    columns.push(column);
    stages.push({ name: stage, solution: result });
  }
  return { status: 'ok', unit: 'Ω', values: ports.map((_, row) => columns.map(column => column[row]!)), stages };
}

/**
 * Y column j: clamp V_j=U and every other V_k=0 with ideal voltage branches.
 * A clamp's MNA branch current points from p to q through the clamp; KCL
 * makes the current entering the *network* its negative. Divide -I_clamp by
 * the actual U to obtain Y_ij in siemens, without inverting Z.
 */
function admittance(base: NativeDocument, ports: Port[], omega: number, amplitude: number): PortRepresentation {
  const columns: Complex[][] = [];
  const stages: PortStage[] = [];
  for (let driven = 0; driven < ports.length; driven++) {
    const work = copy(base);
    const observations: string[] = [];
    for (let index = 0; index < ports.length; index++) {
      const port = ports[index]!;
      const id = fresh(work, '__y_clamp');
      addSource(work, { id, type: 'V', p: port.p, n: port.q }, index === driven ? amplitude : 0);
      observations.push(currentObservation(work, id));
    }
    const stage = `Y column ${driven + 1}`;
    const result = solved(solve(work, omega), stage);
    if (result.status !== 'ok') return result;
    const column = observations.map(observation => scale(result.observations[observation]!.value, -1 / amplitude));
    if (!finiteValues(column)) return nonfinite(stage);
    columns.push(column);
    stages.push({ name: stage, solution: result });
  }
  return { status: 'ok', unit: 'S', values: ports.map((_, row) => columns.map(column => column[row]!)), stages };
}

function operatingPoint(v1: Complex, v2: Complex, i1: Complex, i2: Complex): PortOperatingPoint | PortFailure {
  if (!finiteValues([v1, v2, i1, i2])) return nonfinite('loading');
  // Vs is the fixed 1 V RMS phasor. This ratio differs from V2/V1 when Rs>0.
  const terminalVoltageGain = abs(v1) === 0 ? null : div(v2, v1);
  const inputImpedance = abs(i1) === 0 ? null : div(v1, i1);
  const point = { v1, v2, i1, i2, sourceToOutputGain: v2, terminalVoltageGain, inputImpedance };
  if (!finiteValues([point.sourceToOutputGain, ...(terminalVoltageGain ? [terminalVoltageGain] : []),
    ...(inputImpedance ? [inputImpedance] : [])])) return nonfinite('loading');
  return point;
}
function isFailure(point: PortOperatingPoint | PortFailure): point is PortFailure { return 'status' in point; }

/** Solve two complex boundary equations; this routine never forms an inverse. */
function predict(matrix: PortMatrix, loading: PortLoading): PortOperatingPoint | PortFailure {
  const { sourceResistance, load } = loading;
  const m = matrix.values;
  const one = complex(1);
  let coefficients: Complex[][];
  let rhs: Complex[];
  if (matrix.unit === 'Ω') {
    // Unknowns I1,I2: (Z11+Rs)I1+Z12 I2=Vs; for finite RL,
    // Z21 I1+(Z22+RL)I2=0. An open port imposes I2=0.
    coefficients = [
      [add(m[0]![0]!, complex(sourceResistance)), m[0]![1]!],
      load.kind === 'open' ? [zero(), one] : [m[1]![0]!, add(m[1]![1]!, complex(load.resistance))],
    ];
    rhs = [one, zero()];
  } else {
    // Unknowns V1,V2: V1+Rs*(Y11 V1+Y12 V2)=Vs;
    // Y21 V1+(Y22+1/RL)V2=0, or Y21 V1+Y22 V2=0 if open.
    const shunt = load.kind === 'open' ? 0 : 1 / load.resistance;
    if (!Number.isFinite(shunt)) return nonfinite('Y loading');
    coefficients = [
      [add(one, scale(m[0]![0]!, sourceResistance)), scale(m[0]![1]!, sourceResistance)],
      [m[1]![0]!, add(m[1]![1]!, complex(shunt))],
    ];
    rhs = [one, zero()];
  }
  if (!coefficients.every(finiteValues)) return nonfinite(`${matrix.unit} loading`);
  const linear = solveLinear(coefficients, rhs);
  if (linear.status !== 'ok') return failure(linear.status === 'nonunique' ? 'nonunique' :
    linear.status === 'inconsistent' ? 'incompatible-test' : 'numerical-failure',
    `${matrix.unit} loading: ${linear.status}: ${linear.message}`, `${matrix.unit} loading`);
  const [first, second] = linear.x as [Complex, Complex];
  if (matrix.unit === 'Ω') {
    const i1 = first;
    const i2 = second;
    const v1 = add(mul(m[0]![0]!, i1), mul(m[0]![1]!, i2));
    const v2 = add(mul(m[1]![0]!, i1), mul(m[1]![1]!, i2));
    return operatingPoint(v1, v2, i1, i2);
  }
  const v1 = first;
  const v2 = second;
  const i1 = add(mul(m[0]![0]!, v1), mul(m[0]![1]!, v2));
  const i2 = add(mul(m[1]![0]!, v1), mul(m[1]![1]!, v2));
  return operatingPoint(v1, v2, i1, i2);
}

/** Attach the same 1 V RMS Thévenin drive and load to the *same* base network. */
function directLoad(base: NativeDocument, ports: [Port, Port], omega: number,
  loading: PortLoading): PortLoadResult['direct'] {
  const work = copy(base);
  const [input, output] = ports;
  let driveCurrentObservation: string;
  if (loading.sourceResistance === 0) {
    const id = fresh(work, '__drive');
    addSource(work, { id, type: 'V', p: input.p, n: input.q }, 1);
    driveCurrentObservation = currentObservation(work, id);
  } else {
    const driveNode = fresh(work, '__drive_node');
    work.circuit.nodes.push(driveNode);
    const id = fresh(work, '__drive');
    addSource(work, { id, type: 'V', p: driveNode, n: input.q }, 1);
    const resistorId = fresh(work, '__source_resistance');
    work.circuit.components.push({ id: resistorId, type: 'R', p: driveNode, n: input.p,
      value: loading.sourceResistance });
    driveCurrentObservation = currentObservation(work, resistorId);
  }
  const v1Observation = voltageObservation(work, input);
  const v2Observation = voltageObservation(work, output);
  let loadCurrentObservation: string | null = null;
  if (loading.load.kind === 'resistor') {
    const loadId = fresh(work, '__output_load');
    work.circuit.components.push({ id: loadId, type: 'R', p: output.p, n: output.q,
      value: loading.load.resistance });
    loadCurrentObservation = currentObservation(work, loadId);
  }
  const result = solved(solve(work, omega), 'direct loading');
  if (result.status !== 'ok') return result;
  const v1 = result.observations[v1Observation]!.value;
  const v2 = result.observations[v2Observation]!.value;
  const driveCurrent = result.observations[driveCurrentObservation]!.value;
  const i1 = loading.sourceResistance === 0 ? scale(driveCurrent, -1) : driveCurrent;
  const i2 = loadCurrentObservation ? scale(result.observations[loadCurrentObservation]!.value, -1) : zero();
  const point = operatingPoint(v1, v2, i1, i2);
  return isFailure(point) ? point : { status: 'ok', point, solution: result };
}
function comparison(reference: PortOperatingPoint, prediction: PortOperatingPoint): PortComparison {
  // These are floating-point diagnostics, not certified error bounds. Keep
  // voltage and current budgets in their own physical dimensions; the floors
  // cover cancellation near zero without treating amperes like volts.
  const voltages: [Complex, Complex][] = [[reference.v1, prediction.v1], [reference.v2, prediction.v2]];
  const currents: [Complex, Complex][] = [[reference.i1, prediction.i1], [reference.i2, prediction.i2]];
  const voltageDifference = voltages.map(([a, b]) => abs(sub(a, b))) as [number, number];
  const currentDifference = currents.map(([a, b]) => abs(sub(a, b))) as [number, number];
  const voltageLimit = voltages.map(([a, b]) => 1e-9 + 1e-8 * Math.max(abs(a), abs(b))) as [number, number];
  const currentLimit = currents.map(([a, b]) => 1e-12 + 1e-8 * Math.max(abs(a), abs(b))) as [number, number];
  return { voltageDifference, currentDifference, voltageLimit, currentLimit,
    passed: voltageDifference.every((difference, index) => difference <= voltageLimit[index]!) &&
      currentDifference.every((difference, index) => difference <= currentLimit[index]!) };
}
function loadComparison(matrix: PortRepresentation, direct: PortLoadResult['direct'],
  loading: PortLoading): PortPrediction {
  if (matrix.status !== 'ok') return matrix;
  const prediction = predict(matrix, loading);
  if (isFailure(prediction)) return prediction;
  // A direct full-state solve can fail even when the boundary prediction is
  // defined. Preserve that prediction; there is then no comparison to report.
  if (direct.status !== 'ok') return { status: 'ok', point: prediction, comparison: null };
  const checked = comparison(direct.point, prediction);
  if (![...checked.voltageDifference, ...checked.currentDifference,
    ...checked.voltageLimit, ...checked.currentLimit].every(Number.isFinite)) return nonfinite('loading comparison');
  return { status: 'ok', point: prediction, comparison: checked };
}

/**
 * Characterize one or two ordered frequency-domain ports by independent
 * current and voltage experiments, then optionally verify a physical load.
 * Matrix dimensions are n×n for n=1 or 2; entries have Ω or S units. Each
 * result carries actual solve diagnostics. Full-state failure can occur even
 * when a terminal relation is unique; it is not repaired with a pseudoinverse.
 * See docs/PHASE_2C_SPECIFICATION.md and test/port-analysis.test.mjs.
 */
export function analyzePorts(raw: NativeDocument, config: PortConfig): PortAnalysisResult {
  const document = validateDocument(raw);
  const ports = config.ports;
  const nodes = document.circuit.nodes;
  if ((ports.length !== 1 && ports.length !== 2) || ports.some(port =>
    !nodes.includes(port.p) || !nodes.includes(port.q) || port.p === port.q))
    return failure('invalid-selection', 'Choose one or two ports with distinct existing terminals');
  if (ports.length === 2 && ((ports[0]!.p === ports[1]!.p && ports[0]!.q === ports[1]!.q) ||
    (ports[0]!.p === ports[1]!.q && ports[0]!.q === ports[1]!.p)))
    return failure('invalid-selection', 'Duplicate or reversed-duplicate port coordinates are dependent');
  if (!Number.isFinite(config.frequencyHz) || config.frequencyHz < 0)
    return failure('invalid-selection', 'Frequency must be finite and nonnegative');
  const omega = 2 * Math.PI * config.frequencyHz;
  if (!Number.isFinite(omega)) return failure('numerical-failure', 'Angular frequency exceeds finite numeric range');
  const testCurrent = config.testCurrent ?? 1;
  const testVoltage = config.testVoltage ?? 1;
  if (![testCurrent, testVoltage].every(value => Number.isFinite(value) && value !== 0))
    return failure('invalid-selection', 'Test amplitudes must be finite and nonzero');
  const excluded = config.externalDrive ?? null;
  if (excluded !== null) {
    const branch = document.circuit.components.find(component => component.id === excluded);
    if (!branch || branch.type !== 'V' || !((branch.p === ports[0]!.p && branch.n === ports[0]!.q) ||
      (branch.p === ports[0]!.q && branch.n === ports[0]!.p)))
      return failure('unsupported-exclusion', 'External drive must be an independent voltage branch across port 1');
    if (document.circuit.components.some(component =>
      (component.type === 'CCCS' || component.type === 'CCVS') && component.control === excluded))
      return failure('unsupported-exclusion', 'A retained current-controlled source measures this branch; its control current cannot be removed');
  }
  if (config.loading) {
    const { sourceResistance, load } = config.loading;
    if (ports.length !== 2 || !Number.isFinite(sourceResistance) || sourceResistance < 0 ||
      (load.kind !== 'open' && (load.kind !== 'resistor' || !Number.isFinite(load.resistance) || load.resistance <= 0)))
      return failure('invalid-selection', 'Two-port loading needs finite Rs≥0 and either open or finite positive RL');
  }
  const base = characterizedNetwork(document, excluded);
  const z = impedance(base, ports, omega, testCurrent);
  const y = admittance(base, ports, omega, testVoltage);
  const loading = config.loading && ports.length === 2 ? (() => {
    const direct = directLoad(base, ports as [Port, Port], omega, config.loading!);
    return { direct, fromZ: loadComparison(z, direct, config.loading!),
      fromY: loadComparison(y, direct, config.loading!) };
  })() : undefined;
  return { status: 'ok', ports, frequencyHz: config.frequencyHz, angularFrequency: omega,
    excludedDrive: excluded, suppressedSources: base.experiment.sources.map(source => source.id),
    retainedControlled: base.circuit.components.filter(component =>
      ['VCVS', 'VCCS', 'CCVS', 'CCCS'].includes(component.type)).map(component => component.id),
    z, y, ...(loading ? { loading } : {}) };
}
