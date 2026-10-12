import { validateCircuit, validateExperiment, ValidationError, type Circuit, type Component,
  type Experiment, type NativeDocument, type Observation } from './model.js';

/** Current is positive from anode p to cathode n. All parameters are explicit SI values. */
export interface Diode {
  id: string; type: 'D'; p: string; n: string; label?: string;
  model: { kind: 'shockley-series'; saturationCurrentA: number; idealityFactor: number;
    seriesResistanceOhm: number; temperatureK: number };
}
export interface NonlinearCircuit {
  schemaVersion: 2; label?: string; nodes: string[];
  components: (Component | Diode)[]; observations: Observation[];
}
export interface NonlinearDocument { circuit: NonlinearCircuit; experiment: Experiment }

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new ValidationError(`${path}: expected object`, 'expected-object', { path });
  return value as Record<string, unknown>;
}
function only(value: Record<string, unknown>, names: string[], path: string): void {
  for (const name of Object.keys(value)) if (!names.includes(name))
    throw new ValidationError(`${path}: unsupported field ${name}`, 'unsupported-field', { path, field: name });
}
function positive(value: unknown, path: string, allowZero = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (allowZero ? value < 0 : value <= 0))
    throw new ValidationError(`${path}: expected ${allowZero ? 'nonnegative' : 'positive'} finite number`, 'invalid-model', { path });
  return value;
}

/**
 * Strict v2 validation delegates all unchanged linear/reference/source rules to
 * v1 validation. Each diode is replaced *only in the validation proxy* by a
 * passive R, so duplicate IDs, exact node references, current observations,
 * and control-branch restrictions retain their established meaning. The
 * returned document still contains the original D branches.
 */
export function validateNonlinearDocument(value: unknown): NonlinearDocument {
  const document = record(value, 'document');
  only(document, ['circuit', 'experiment'], 'document');
  const circuit = record(document.circuit, 'circuit');
  only(circuit, ['schemaVersion', 'label', 'nodes', 'components', 'observations'], 'circuit');
  if (circuit.schemaVersion !== 2) throw new ValidationError('Expected nonlinear circuit schemaVersion 2', 'invalid-schema');
  if (!Array.isArray(circuit.components)) throw new ValidationError('Expected components array', 'expected-array');
  const proxyComponents = circuit.components.map((raw, index) => {
    const component = record(raw, `components[${index}]`);
    if (component.type !== 'D') return raw;
    const path = `components[${index}]`;
    only(component, ['id', 'label', 'type', 'p', 'n', 'model'], path);
    const model = record(component.model, `${path}.model`);
    only(model, ['kind', 'saturationCurrentA', 'idealityFactor', 'seriesResistanceOhm', 'temperatureK'], `${path}.model`);
    if (model.kind !== 'shockley-series') throw new ValidationError('Unsupported diode model', 'unsupported-model');
    positive(model.saturationCurrentA, `${path}.model.saturationCurrentA`);
    positive(model.idealityFactor, `${path}.model.idealityFactor`);
    positive(model.seriesResistanceOhm, `${path}.model.seriesResistanceOhm`, true);
    positive(model.temperatureK, `${path}.model.temperatureK`);
    return { id: component.id, label: component.label, type: 'R', p: component.p, n: component.n, value: 1 };
  });
  const proxy: Circuit = { ...circuit, schemaVersion: 1, components: proxyComponents } as Circuit;
  validateCircuit(proxy);
  validateExperiment(document.experiment, proxy);
  return value as NonlinearDocument;
}

export function parseNonlinearDocument(json: string): NonlinearDocument {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new ValidationError('Invalid JSON', 'invalid-json'); }
  return validateNonlinearDocument(parsed);
}
export function serializeNonlinearDocument(document: NonlinearDocument): string {
  return JSON.stringify(validateNonlinearDocument(document), null, 2);
}
/** Only circuit and independent DC values determine this memoryless DC bias. */
export function nonlinearBiasFingerprint(document: NonlinearDocument): string {
  // Validate first: JSON normalization alone would silently erase unsupported
  // fields or turn nonfinite numbers into null. Ownership uses this same
  // serialized form, where an optional undefined property is absent.
  const validated = ownedNonlinearDocument(document);
  const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value !== null && typeof value === 'object') {
      const entry = value as Record<string, unknown>;
      return `{${Object.keys(entry).sort().map(key => `${JSON.stringify(key)}:${canonical(entry[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  };
  const dcSources = validated.experiment.sources.map(source => ({ id: source.id, dc: source.dc }))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return canonical({ circuit: validated.circuit, dcSources });
}
export function ownedNonlinearDocument(document: NonlinearDocument): NonlinearDocument {
  return JSON.parse(serializeNonlinearDocument(document)) as NonlinearDocument;
}

/** Remove diodes only for linear MNA assembly; diode observations are restored by the nonlinear result. */
export function linearCore(document: NonlinearDocument): NativeDocument {
  return { circuit: { ...document.circuit, schemaVersion: 1,
    components: document.circuit.components.filter((c): c is Component => c.type !== 'D'),
    observations: document.circuit.observations.filter(o => o.type !== 'current' ||
      document.circuit.components.find(c => c.id === o.component)?.type !== 'D') },
    experiment: document.experiment };
}
