import { ValidationError, type Component, type Experiment, type Observation } from './model.js';
import { validateNonlinearDocument, type Diode, type NonlinearDocument } from './nonlinear-model.js';
import { bjtTerminals, type Bjt, type BjtTerminal } from './bjt-model.js';

export type BjtObservation = Observation | {
  id: string; label?: string; type: 'terminal-current'; component: string; terminal: BjtTerminal;
};
export interface BjtDocument {
  circuit: { schemaVersion: 3; label?: string; nodes: string[];
    components: (Component | Diode | Bjt)[]; observations: BjtObservation[] };
  experiment: Experiment;
}
function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ValidationError(`${path}: expected object`, 'expected-object', { path });
  return value as Record<string, unknown>;
}
function only(value: Record<string, unknown>, fields: string[], path: string): void {
  for (const field of Object.keys(value)) if (!fields.includes(field))
    throw new ValidationError(`${path}: unsupported field ${field}`, 'unsupported-field', { path, field });
}
function id(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.length)
    throw new ValidationError(`${path}: expected nonempty string`, 'expected-string', { path });
  return value;
}

/** Validate Q's three terminals explicitly, then validate the unchanged D/linear
 * subdocument through v2. No Q is replaced by a fictitious two-terminal device.
 * Removing Q is safe for source/storage validation: Q is neither, and controls
 * still must name an existing voltage-source-type branch in that subdocument.
 */
export function validateBjtDocument(value: unknown): BjtDocument {
  const document = record(value, 'document');
  only(document, ['circuit', 'experiment'], 'document');
  const circuit = record(document.circuit, 'circuit');
  only(circuit, ['schemaVersion', 'label', 'nodes', 'components', 'observations'], 'circuit');
  if (circuit.schemaVersion !== 3) throw new ValidationError('Expected circuit schemaVersion 3', 'invalid-schema');
  if (!Array.isArray(circuit.nodes) || !Array.isArray(circuit.components) || !Array.isArray(circuit.observations))
    throw new ValidationError('Expected nodes, components and observations arrays', 'expected-array');
  const nodes = new Set(circuit.nodes);
  const devices = new Map<string, Record<string, unknown>>();
  for (const raw of circuit.components) {
    const device = record(raw, 'component');
    const name = id(device.id, 'component.id');
    if (devices.has(name)) throw new ValidationError('Duplicate component IDs', 'duplicate-ids');
    devices.set(name, device);
    if (device.type !== 'Q') continue;
    only(device, ['id', 'type', 'label', 'c', 'b', 'e', 'model'], 'Q');
    if (device.label !== undefined) id(device.label, 'Q.label');
    for (const terminal of bjtTerminals) {
      const node = id(device[terminal], `Q.${terminal}`);
      if (!nodes.has(node)) throw new ValidationError(`Missing node ${node}`, 'missing-node', { id: node });
    }
    const model = record(device.model, 'Q.model');
    only(model, ['kind', 'polarity', 'transportSaturationCurrentA', 'betaForward', 'betaReverse', 'temperatureK'], 'Q.model');
    if (model.kind !== 'ebers-moll' || (model.polarity !== 'npn' && model.polarity !== 'pnp'))
      throw new ValidationError('Unsupported BJT model or polarity', 'unsupported-model');
    for (const field of ['transportSaturationCurrentA', 'betaForward', 'betaReverse', 'temperatureK']) {
      const number = model[field];
      if (typeof number !== 'number' || !Number.isFinite(number) || number <= 0)
        throw new ValidationError(`Q.model.${field}: expected positive finite number`, 'invalid-model', { field });
    }
  }
  const observations = new Set<string>();
  const ordinary: unknown[] = [];
  for (const raw of circuit.observations) {
    const observation = record(raw, 'observation');
    const name = id(observation.id, 'observation.id');
    if (observations.has(name)) throw new ValidationError('Duplicate observation IDs', 'duplicate-ids');
    observations.add(name);
    if (observation.type === 'terminal-current') {
      only(observation, ['id', 'label', 'type', 'component', 'terminal'], 'terminal-current');
      if (observation.label !== undefined) id(observation.label, 'observation.label');
      if (devices.get(id(observation.component, 'observation.component'))?.type !== 'Q' ||
          !bjtTerminals.includes(observation.terminal as BjtTerminal))
        throw new ValidationError('Terminal current must name Q and c, b, or e', 'invalid-observation');
    } else {
      // A Q reference is absent from the subdocument and thus rejected by v2.
      ordinary.push(raw);
    }
  }
  validateNonlinearDocument({ circuit: { ...circuit, schemaVersion: 2,
    components: circuit.components.filter(raw => record(raw, 'component').type !== 'Q'), observations: ordinary },
    experiment: document.experiment });
  return value as BjtDocument;
}
export function parseBjtDocument(json: string): BjtDocument {
  let value: unknown;
  try { value = JSON.parse(json); } catch { throw new ValidationError('Invalid JSON', 'invalid-json'); }
  return validateBjtDocument(value);
}
export function serializeBjtDocument(document: BjtDocument): string {
  return JSON.stringify(validateBjtDocument(document), null, 2);
}
export function ownedBjtDocument(document: BjtDocument): BjtDocument {
  return JSON.parse(serializeBjtDocument(document)) as BjtDocument;
}
/** Scientific static subcircuit, retaining every node and D/linear branch. */
export function bjtDiodeCore(document: BjtDocument): NonlinearDocument {
  return { circuit: { ...document.circuit, schemaVersion: 2,
    components: document.circuit.components.filter((d): d is Component | Diode => d.type !== 'Q'),
    observations: document.circuit.observations.filter((o): o is Observation => o.type !== 'terminal-current') },
    experiment: document.experiment };
}
export function bjtBiasFingerprint(document: BjtDocument): string {
  const owned = ownedBjtDocument(document);
  const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value !== null && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  };
  const dcSources = owned.experiment.sources.map(s => ({ id: s.id, dc: s.dc }))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return canonical({ circuit: owned.circuit, dcSources });
}
