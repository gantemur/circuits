import type { Complex } from './complex.js';

interface Branch { id: string; p: string; n: string; label?: string }
export type Component =
  | (Branch & { type: 'R' | 'C' | 'L'; value: number })
  | (Branch & { type: 'V' | 'I' })
  | (Branch & { type: 'VCVS' | 'VCCS'; cp: string; cn: string; gain: number })
  | (Branch & { type: 'CCVS' | 'CCCS'; control: string; gain: number });
export type Observation =
  | { id: string; type: 'voltage'; p: string; n: string; label?: string }
  | { id: string; type: 'current'; component: string; label?: string };
export interface Circuit {
  schemaVersion: 1; label?: string; nodes: string[];
  components: Component[]; observations: Observation[];
}
export type Waveform =
  | { type: 'constant'; value: number }
  | { type: 'step'; at: number; before: number; after: number }
  | { type: 'sinusoid'; offset: number; amplitudePeak: number; frequencyHz: number; phaseRadians: number };
export interface SourceValue { id: string; dc: number; ac?: Complex; waveform?: Waveform }
export type InitialCondition = { kind: 'equilibrium' }
  | { kind: 'storage'; values: { id: string; value: number }[] };
export interface Experiment {
  schemaVersion: 1; label?: string; sources: SourceValue[]; initial: InitialCondition;
}
export interface NativeDocument { circuit: Circuit; experiment: Experiment }
export class ValidationError extends Error {
  readonly status = 'validation-error';
  constructor(message: string) { super(message); this.name = 'ValidationError'; }
}
export const voltageBranch = (c: Component): boolean => ['V', 'VCVS', 'CCVS'].includes(c.type);
export const independent = (c: Component): boolean => c.type === 'V' || c.type === 'I';

type Obj = Record<string, unknown>;
function object(v: unknown, at: string): Obj {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ValidationError(`${at}: expected object`);
  return v as Obj;
}
function fields(v: Obj, keys: string[], at: string) {
  for (const key of Object.keys(v)) if (!keys.includes(key)) throw new ValidationError(`${at}: unsupported field ${key}`);
}
function string(v: unknown, at: string): string {
  if (typeof v !== 'string' || !v.length) throw new ValidationError(`${at}: expected nonempty string`);
  return v;
}
function number(v: unknown, at: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new ValidationError(`${at}: expected finite number`);
  return v;
}
function array(v: unknown, at: string): unknown[] {
  if (!Array.isArray(v)) throw new ValidationError(`${at}: expected array`);
  return v;
}
function unique(ids: string[], at: string) {
  if (new Set(ids).size !== ids.length) throw new ValidationError(`${at}: duplicate IDs`);
}
function label(v: Obj) { if (v.label !== undefined) string(v.label, 'label'); }
function node(v: unknown, nodes: Set<string>): string {
  const id = string(v, 'terminal');
  if (!nodes.has(id)) throw new ValidationError(`Missing node ${id}`);
  return id;
}
export function validateCircuit(value: unknown): Circuit {
  const c = object(value, 'circuit');
  fields(c, ['schemaVersion', 'label', 'nodes', 'components', 'observations'], 'circuit');
  if (c.schemaVersion !== 1) throw new ValidationError('Unknown circuit schemaVersion');
  label(c);
  const nodes = array(c.nodes, 'nodes').map(n => string(n, 'node'));
  unique(nodes, 'nodes');
  if (!nodes.includes('0')) throw new ValidationError('Missing reference node 0');
  const ns = new Set(nodes);
  const components = array(c.components, 'components').map(raw => {
    const d = object(raw, 'component');
    string(d.id, 'component.id'); label(d); node(d.p, ns); node(d.n, ns);
    const base = ['id', 'label', 'type', 'p', 'n'];
    switch (d.type) {
      case 'R': case 'C': case 'L':
        fields(d, [...base, 'value'], 'passive');
        if (number(d.value, 'value') <= 0) throw new ValidationError('Passive value must be positive');
        break;
      case 'V': case 'I': fields(d, base, 'source'); break;
      case 'VCVS': case 'VCCS':
        fields(d, [...base, 'cp', 'cn', 'gain'], 'voltage-controlled source');
        node(d.cp, ns); node(d.cn, ns); number(d.gain, 'gain'); break;
      case 'CCVS': case 'CCCS':
        fields(d, [...base, 'control', 'gain'], 'current-controlled source');
        string(d.control, 'control'); number(d.gain, 'gain'); break;
      default: throw new ValidationError(`Unsupported device type ${String(d.type)}`);
    }
    return d as unknown as Component;
  });
  unique(components.map(d => d.id), 'components');
  for (const d of components) if (d.type === 'CCVS' || d.type === 'CCCS') {
    const control = components.find(e => e.id === d.control);
    if (!control || !voltageBranch(control)) throw new ValidationError(`${d.id}: control must name a retained voltage-source-type branch`);
  }
  const observations = array(c.observations, 'observations').map(raw => {
    const o = object(raw, 'observation'); string(o.id, 'observation.id'); label(o);
    if (o.type === 'voltage') {
      fields(o, ['id', 'label', 'type', 'p', 'n'], 'observation'); node(o.p, ns); node(o.n, ns);
    } else if (o.type === 'current') {
      fields(o, ['id', 'label', 'type', 'component'], 'observation');
      if (!components.some(d => d.id === o.component)) throw new ValidationError('Observation names undefined component');
    } else throw new ValidationError(`Unsupported observation ${String(o.type)}`);
    return o as unknown as Observation;
  });
  unique(observations.map(o => o.id), 'observations');
  return value as Circuit;
}
export function validateExperiment(value: unknown, circuit: Circuit): Experiment {
  const e = object(value, 'experiment');
  fields(e, ['schemaVersion', 'label', 'sources', 'initial'], 'experiment'); label(e);
  if (e.schemaVersion !== 1) throw new ValidationError('Unknown experiment schemaVersion');
  const ids = circuit.components.filter(independent).map(c => c.id);
  const sources = array(e.sources, 'sources').map(raw => {
    const s = object(raw, 'source'); fields(s, ['id', 'dc', 'ac', 'waveform'], 'source');
    const id = string(s.id, 'source.id'); number(s.dc, 'dc');
    if (!ids.includes(id)) throw new ValidationError(`Unknown independent source ${id}`);
    if (s.ac !== undefined) {
      const ac = object(s.ac, 'ac'); fields(ac, ['re', 'im'], 'ac'); number(ac.re, 'ac.re'); number(ac.im, 'ac.im');
    }
    if (s.waveform !== undefined) {
      const w = object(s.waveform, 'waveform');
      switch (w.type) {
        case 'constant': fields(w, ['type', 'value'], 'constant'); number(w.value, 'value'); break;
        case 'step':
          fields(w, ['type', 'at', 'before', 'after'], 'step');
          number(w.at, 'at'); number(w.before, 'before'); number(w.after, 'after'); break;
        case 'sinusoid':
          fields(w, ['type', 'offset', 'amplitudePeak', 'frequencyHz', 'phaseRadians'], 'sinusoid');
          number(w.offset, 'offset'); number(w.phaseRadians, 'phaseRadians');
          if (number(w.amplitudePeak, 'amplitudePeak') < 0 || number(w.frequencyHz, 'frequencyHz') < 0)
            throw new ValidationError('Sinusoid amplitudePeak and frequencyHz must be nonnegative');
          break;
        default: throw new ValidationError('Unsupported waveform');
      }
    }
    return id;
  });
  unique(sources, 'sources');
  if (sources.length !== ids.length) throw new ValidationError('Supply every independent source, including zero-valued sources');
  const initial = object(e.initial, 'initial');
  if (initial.kind === 'equilibrium') fields(initial, ['kind'], 'initial');
  else if (initial.kind === 'storage') {
    fields(initial, ['kind', 'values'], 'initial');
    const storage = circuit.components.filter(c => c.type === 'C' || c.type === 'L').map(c => c.id);
    const supplied = array(initial.values, 'initial.values').map(raw => {
      const v = object(raw, 'storage value'); fields(v, ['id', 'value'], 'storage value');
      const id = string(v.id, 'storage.id'); number(v.value, 'storage.value');
      if (!storage.includes(id)) throw new ValidationError(`Unknown storage component ${id}`);
      return id;
    });
    unique(supplied, 'initial values');
    if (supplied.length !== storage.length) throw new ValidationError('Supply every capacitor voltage and inductor current');
  } else throw new ValidationError('Unsupported initial condition');
  return value as Experiment;
}
export function validateDocument(value: unknown): NativeDocument {
  const d = object(value, 'document'); fields(d, ['circuit', 'experiment'], 'document');
  const circuit = validateCircuit(d.circuit); validateExperiment(d.experiment, circuit);
  return value as NativeDocument;
}
export function parseDocument(json: string): NativeDocument {
  let value: unknown;
  try { value = JSON.parse(json); } catch { throw new ValidationError('Invalid JSON'); }
  return validateDocument(value);
}
export const serializeDocument = (d: NativeDocument): string => JSON.stringify(validateDocument(d), null, 2);
export function sourceAt(source: SourceValue, time: number, side: 'left' | 'right' = 'right'): number {
  const w = source.waveform;
  if (!w) return source.dc;
  if (w.type === 'constant') return w.value;
  if (w.type === 'step') return time < w.at || (time === w.at && side === 'left') ? w.before : w.after;
  return w.offset + w.amplitudePeak * Math.sin(2 * Math.PI * w.frequencyHz * time + w.phaseRadians);
}
