import { validateDocument, type Circuit, type Experiment, type NativeDocument } from './model.js';
import { nonlinearBiasFingerprint, type NonlinearDocument } from './nonlinear-model.js';
import type { NonlinearSuccess } from './diode-operating-point.js';

export interface TangentSuccess {
  status: 'ok'; document: NativeDocument;
  bias: { circuit: NonlinearDocument['circuit']; dcSources: { id: string; dc: number }[];
    nodeVoltagesV: Record<string, number>; diodeCurrentsA: Record<string, number> };
  meaning: 'increments-around-recorded-bias';
}
export interface TangentFailure {
  status: 'unavailable'; code: 'stale-bias' | 'unrepresentable-resistance'; message: string;
}

/**
 * Construct the delta-variable v1 circuit at a *verified current* bias.
 * The Newton affine row includes a bias-dependent constant. In increments,
 * that constant cancels, leaving δi = gterminal δv, hence a plain resistor.
 * AC source increments remain declared; DC increments and storage increments
 * start at zero. No bias metadata is placed in native scientific fields.
 */
export function createDiodeTangent(point: NonlinearSuccess, current: NonlinearDocument): TangentSuccess | TangentFailure {
  let solved: string;
  let now: string;
  try {
    solved = nonlinearBiasFingerprint(point.document);
    now = nonlinearBiasFingerprint(current);
  } catch {
    return { status: 'unavailable', code: 'stale-bias', message: 'Current circuit or source document is invalid or changed' };
  }
  if (solved !== point.biasFingerprint || now !== point.biasFingerprint)
    return { status: 'unavailable', code: 'stale-bias', message: 'Circuit or source changed after the operating point was solved' };
  const components: Circuit['components'] = [];
  for (const device of point.document.circuit.components) {
    if (device.type !== 'D') { components.push(device); continue; }
    const resistance = point.diodes[device.id]!.differentialResistanceOhm;
    if (resistance === null || !Number.isFinite(resistance) || resistance <= 0)
      return { status: 'unavailable', code: 'unrepresentable-resistance', message: `${device.id}: finite positive differential resistance unavailable` };
    components.push({ id: device.id, ...(device.label === undefined ? {} : { label: device.label }),
      type: 'R', p: device.p, n: device.n, value: resistance });
  }
  const circuit: Circuit = { ...point.document.circuit, schemaVersion: 1, components };
  const sources = current.experiment.sources.map(source => ({ id: source.id, dc: 0,
    ...(source.ac === undefined ? {} : { ac: source.ac }) }));
  const initial: Experiment['initial'] = current.experiment.initial.kind === 'equilibrium'
    ? { kind: 'equilibrium' }
    : { kind: 'storage', values: current.experiment.initial.values.map(v => ({ id: v.id, value: 0 })) };
  const experiment: Experiment = { schemaVersion: 1,
    ...(current.experiment.label === undefined ? {} : { label: current.experiment.label }),
    sources, initial };
  // The v1 validator returns its argument; clone afterward so edits to a
  // displayed operating-point snapshot cannot mutate the tangent document.
  const document = JSON.parse(JSON.stringify(validateDocument({ circuit, experiment }))) as NativeDocument;
  const nodeVoltagesV: Record<string, number> = Object.create(null);
  for (const node of circuit.nodes) nodeVoltagesV[node] = node === '0' ? 0 : point.unknowns[`V(${node})`]!;
  const diodeCurrentsA: Record<string, number> = Object.create(null);
  for (const device of point.document.circuit.components) if (device.type === 'D')
    diodeCurrentsA[device.id] = point.diodes[device.id]!.currentA;
  const biasCircuit = JSON.parse(JSON.stringify(point.document.circuit)) as NonlinearDocument['circuit'];
  return { status: 'ok', document, bias: { circuit: biasCircuit,
    dcSources: point.document.experiment.sources.map(s => ({ id: s.id, dc: s.dc })),
    nodeVoltagesV, diodeCurrentsA }, meaning: 'increments-around-recorded-bias' };
}
