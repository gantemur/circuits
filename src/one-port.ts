import { assemble } from './assembly.js';
import { solveDC, type AnalysisResult, type Solution } from './analysis.js';
import { validateDocument, type Circuit, type Component, type NativeDocument, type Observation } from './model.js';

export type OnePortStatus = 'invalid-port' | 'unsupported-device' | 'invalid-load' | 'solver-failure'
  | 'zero-resistance' | 'negative-resistance' | 'nonfinite';
export type OnePortStage = 'open' | 'test' | 'short' | 'original-load' | 'thevenin-load' | 'norton-load';
export interface OnePortSolve { stage: OnePortStage; result: AnalysisResult }
export interface OnePortFailure {
  status: OnePortStatus; stage?: OnePortStage; message: string; solves: OnePortSolve[];
  vth?: number; rth?: number;
}
export interface OnePortLoadResult { voltage: number; current: number; solution: Solution }
export interface OnePortComparison {
  voltageDifference: number; currentDifference: number;
  voltageLimit: number; currentLimit: number; passed: boolean;
}
export interface OnePortSuccess {
  status: 'ok'; port: { p: string; q: string }; loadResistance: number;
  vth: number; rth: number; inorton: number; shortCurrent: number; testCurrent: number;
  suppressed: string[]; retainedControlled: string[];
  open: Solution; test: Solution; short: Solution;
  original: OnePortLoadResult; thevenin: OnePortLoadResult; norton: OnePortLoadResult;
  theveninComparison: OnePortComparison; nortonComparison: OnePortComparison;
  shortDifference: number; shortLimit: number; shortPassed: boolean;
  solves: OnePortSolve[];
  equivalentPortLabels: { positive: string; negative: string; localPositive: string; localNegative: string };
}
export type OnePortResult = OnePortSuccess | OnePortFailure;

const copy = (document: NativeDocument): NativeDocument => JSON.parse(JSON.stringify(document)) as NativeDocument;
function unused(base: NativeDocument, prefix: string): string {
  const ids = new Set([...base.circuit.components.map(c => c.id), ...base.circuit.observations.map(o => o.id)]);
  let id = prefix, index = 1;
  while (ids.has(id)) id = `${prefix}-${index++}`;
  return id;
}
function observation(base: NativeDocument, p: string, q: string): string {
  const id = unused(base, '__port_voltage');
  base.circuit.observations.push({ id, type: 'voltage', p, n: q });
  return id;
}
function solve(base: NativeDocument, stage: OnePortStage, solves: OnePortSolve[]): AnalysisResult {
  const result = solveDC(assemble(base.circuit), base.experiment);
  solves.push({ stage, result });
  return result;
}
function finite(...values: number[]): boolean { return values.every(Number.isFinite); }
function failure(status: OnePortStatus, message: string, solves: OnePortSolve[], stage?: OnePortStage,
  vth?: number, rth?: number): OnePortFailure {
  return { status, message, solves, ...(stage ? { stage } : {}), ...(vth === undefined ? {} : { vth }),
    ...(rth === undefined ? {} : { rth }) };
}
function solveFailure(result: AnalysisResult, stage: OnePortStage, solves: OnePortSolve[], vth?: number, rth?: number): OnePortFailure {
  return failure('solver-failure', `${stage}: ${result.status === 'ok' ? 'unexpected success' : `${result.status}: ${result.message}`}`,
    solves, stage, vth, rth);
}
function loadResult(document: NativeDocument, p: string, q: string, loadResistance: number,
  stage: OnePortStage, solves: OnePortSolve[]): OnePortLoadResult | OnePortFailure {
  const work = copy(document), id = unused(work, '__port_load');
  work.circuit.components.push({ id, type: 'R', p, n: q, value: loadResistance });
  const voltageId = observation(work, p, q), currentId = unused(work, '__port_load_current');
  work.circuit.observations.push({ id: currentId, type: 'current', component: id });
  const result = solve(work, stage, solves);
  if (result.status !== 'ok') return solveFailure(result, stage, solves);
  const voltage = result.observations[voltageId]!.value.re;
  const current = result.observations[currentId]!.value.re;
  if (!finite(voltage, current)) return failure('nonfinite', `${stage}: nonfinite load result`, solves, stage);
  return { voltage, current, solution: result };
}
/** Absolute difference with a relative term and physical floor (V or A). */
function compare(reference: OnePortLoadResult, equivalent: OnePortLoadResult): OnePortComparison {
  const voltageDifference = Math.abs(reference.voltage - equivalent.voltage);
  const currentDifference = Math.abs(reference.current - equivalent.current);
  const voltageLimit = 1e-9 + 1e-8 * Math.max(Math.abs(reference.voltage), Math.abs(equivalent.voltage));
  const currentLimit = 1e-12 + 1e-8 * Math.max(Math.abs(reference.current), Math.abs(equivalent.current));
  return { voltageDifference, currentDifference, voltageLimit, currentLimit,
    passed: voltageDifference <= voltageLimit && currentDifference <= currentLimit };
}
function equivalent(kind: 'thevenin' | 'norton', vth: number, rth: number, inorton: number): NativeDocument {
  const components: Component[] = kind === 'thevenin'
    ? [{ id: 'Vth', type: 'V', p: 'drive', n: '0' }, { id: 'Rth', type: 'R', p: 'drive', n: 'port', value: rth }]
    : [{ id: 'IN', type: 'I', p: '0', n: 'port' }, { id: 'Rth', type: 'R', p: 'port', n: '0', value: rth }];
  const circuit: Circuit = { schemaVersion: 1, nodes: kind === 'thevenin' ? ['0', 'drive', 'port'] : ['0', 'port'],
    components, observations: [] as Observation[] };
  return { circuit, experiment: { schemaVersion: 1, sources: [kind === 'thevenin'
    ? { id: 'Vth', dc: vth } : { id: 'IN', dc: inorton }], initial: { kind: 'equilibrium' } } };
}

/** DC terminal experiment. Positive injected current enters the network at p; load current leaves p. */
export function dcOnePort(raw: NativeDocument, p: string, q: string, loadResistance: number, testCurrent = 1): OnePortResult {
  const document = validateDocument(raw), solves: OnePortSolve[] = [];
  if (p === q || !document.circuit.nodes.includes(p) || !document.circuit.nodes.includes(q))
    return failure('invalid-port', 'Choose two distinct existing nodes', solves);
  if (document.circuit.components.some(c => c.type === 'C' || c.type === 'L'))
    return failure('unsupported-device', 'DC one-port experiment does not replace capacitors or inductors', solves);
  if (!Number.isFinite(loadResistance) || loadResistance <= 0)
    return failure('invalid-load', 'External load resistance must be finite and positive', solves);
  if (!Number.isFinite(testCurrent) || testCurrent === 0)
    return failure('nonfinite', 'Test current must be finite and nonzero', solves);

  const openDoc = copy(document), openVoltage = observation(openDoc, p, q);
  const open = solve(openDoc, 'open', solves);
  if (open.status !== 'ok') return solveFailure(open, 'open', solves);
  const vth = open.observations[openVoltage]!.value.re;
  if (!finite(vth)) return failure('nonfinite', 'Open-circuit voltage is nonfinite', solves, 'open');

  const testDoc = copy(document);
  const suppressed = testDoc.experiment.sources.map(source => source.id);
  for (const source of testDoc.experiment.sources) source.dc = 0;
  const retainedControlled = document.circuit.components.filter(c => ['VCVS', 'VCCS', 'CCVS', 'CCCS'].includes(c.type)).map(c => c.id);
  const testId = unused(testDoc, '__port_test');
  testDoc.circuit.components.push({ id: testId, type: 'I', p: q, n: p });
  testDoc.experiment.sources.push({ id: testId, dc: testCurrent });
  const testVoltage = observation(testDoc, p, q);
  const test = solve(testDoc, 'test', solves);
  if (test.status !== 'ok') return solveFailure(test, 'test', solves, vth);
  const rth = test.observations[testVoltage]!.value.re / testCurrent;
  if (!finite(rth)) return failure('nonfinite', 'Equivalent resistance is nonfinite', solves, 'test', vth);
  if (rth === 0) return failure('zero-resistance', 'Zero resistance: a finite Norton current cannot be formed', solves, 'test', vth, rth);
  if (rth < 0) return failure('negative-resistance', 'Negative resistance: positive-resistor equivalent realizations are outside this milestone', solves, 'test', vth, rth);
  const inorton = vth / rth;
  if (!finite(inorton)) return failure('nonfinite', 'Norton current exceeds numeric range', solves, 'test', vth, rth);

  const shortDoc = copy(document), shortId = unused(shortDoc, '__port_short');
  shortDoc.circuit.components.push({ id: shortId, type: 'V', p, n: q });
  shortDoc.experiment.sources.push({ id: shortId, dc: 0 });
  const shortObs = unused(shortDoc, '__port_short_current');
  shortDoc.circuit.observations.push({ id: shortObs, type: 'current', component: shortId });
  const short = solve(shortDoc, 'short', solves);
  if (short.status !== 'ok') return solveFailure(short, 'short', solves, vth, rth);
  const shortCurrent = short.observations[shortObs]!.value.re;
  if (!finite(shortCurrent)) return failure('nonfinite', 'Short-circuit current is nonfinite', solves, 'short', vth, rth);

  const original = loadResult(document, p, q, loadResistance, 'original-load', solves);
  if ('status' in original) return { ...original, vth, rth };
  const thevenin = loadResult(equivalent('thevenin', vth, rth, inorton), 'port', '0', loadResistance, 'thevenin-load', solves);
  if ('status' in thevenin) return { ...thevenin, vth, rth };
  const norton = loadResult(equivalent('norton', vth, rth, inorton), 'port', '0', loadResistance, 'norton-load', solves);
  if ('status' in norton) return { ...norton, vth, rth };
  const shortDifference = Math.abs(shortCurrent - inorton);
  const shortLimit = 1e-12 + 1e-8 * Math.max(Math.abs(shortCurrent), Math.abs(inorton));
  const theveninComparison = compare(original, thevenin), nortonComparison = compare(original, norton);
  if (!finite(shortDifference, shortLimit,
    theveninComparison.voltageDifference, theveninComparison.currentDifference,
    theveninComparison.voltageLimit, theveninComparison.currentLimit,
    nortonComparison.voltageDifference, nortonComparison.currentDifference,
    nortonComparison.voltageLimit, nortonComparison.currentLimit))
    return failure('nonfinite', 'Comparison exceeded numeric range', solves, 'norton-load', vth, rth);
  return { status: 'ok', port: { p, q }, loadResistance, vth, rth, inorton, shortCurrent, testCurrent,
    suppressed, retainedControlled, open, test, short, original, thevenin, norton,
    theveninComparison, nortonComparison,
    shortDifference, shortLimit, shortPassed: shortDifference <= shortLimit, solves,
    equivalentPortLabels: { positive: p, negative: q, localPositive: 'port', localNegative: '0' } };
}
