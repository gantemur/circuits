import { type Component, type Observation,
  type Waveform, ValidationError, voltageBranch } from '../src/model.js';
import type { Diode } from '../src/nonlinear-model.js';
import { parseBrowserDocument, serializeBrowserDocument, type BrowserDocument } from './native-document.js';
import { exportNative, importNative, type EditResult, type LabState } from './lab.js';

type NumberText = string;
type Branch = { id: string; p: string; n: string; label?: string };
export type DraftComponent =
  | (Branch & { type: 'R' | 'C' | 'L'; value: NumberText })
  | (Branch & { type: 'V' | 'I' })
  | (Branch & { type: 'VCVS' | 'VCCS'; cp: string; cn: string; gain: NumberText })
  | (Branch & { type: 'CCVS' | 'CCCS'; control: string; gain: NumberText })
  | (Branch & { type: 'D'; model: { kind: 'shockley-series'; saturationCurrentA: NumberText;
    idealityFactor: NumberText; seriesResistanceOhm: NumberText; temperatureK: NumberText } });
export type DraftWaveform =
  | { type: 'constant'; value: NumberText }
  | { type: 'step'; at: NumberText; before: NumberText; after: NumberText }
  | { type: 'sinusoid'; offset: NumberText; amplitudePeak: NumberText; frequencyHz: NumberText; phaseRadians: NumberText };
export interface BuilderDraft {
  circuit: { schemaVersion: 1 | 2; label?: string; nodes: string[]; components: DraftComponent[]; observations: Observation[] };
  experiment: { schemaVersion: 1; label?: string; sources: { id: string; dc: NumberText; ac?: { re: NumberText; im: NumberText }; waveform?: DraftWaveform }[];
    initial: { kind: 'equilibrium' } | { kind: 'storage'; values: { id: string; value: NumberText }[] } };
}
export interface BuilderState { draft: BuilderDraft; base: string; baseDocument: BrowserDocument; dirty: boolean; error: BuilderError | null }
export interface BuilderError { code: string; params: Readonly<Record<string, string | number>>; field?: string; raw?: string }
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const text = (value: number): string => String(value);
const waveformDraft = (w: Waveform): DraftWaveform => {
  if (w.type === 'constant') return { type: 'constant', value: text(w.value) };
  if (w.type === 'step') return { type: 'step', at: text(w.at), before: text(w.before), after: text(w.after) };
  return { type: 'sinusoid', offset: text(w.offset), amplitudePeak: text(w.amplitudePeak), frequencyHz: text(w.frequencyHz), phaseRadians: text(w.phaseRadians) };
};
export function draftFromDocument(document: BrowserDocument): BuilderDraft {
  const d = clone(document);
  return { circuit: { ...d.circuit, components: d.circuit.components.map(c => {
    if ('value' in c) return { ...c, value: text(c.value) };
    if ('gain' in c) return { ...c, gain: text(c.gain) };
    if (c.type === 'D') return { ...c, model: { ...c.model,
      saturationCurrentA: text(c.model.saturationCurrentA), idealityFactor: text(c.model.idealityFactor),
      seriesResistanceOhm: text(c.model.seriesResistanceOhm), temperatureK: text(c.model.temperatureK) } };
    return c;
  }) }, experiment: { ...d.experiment, sources: d.experiment.sources.map(s => {
    const { ac, waveform, ...rest } = s;
    return { ...rest, dc: text(s.dc), ...(ac ? { ac: { re: text(ac.re), im: text(ac.im) } } : {}),
      ...(waveform ? { waveform: waveformDraft(waveform) } : {}) };
  }),
    initial: d.experiment.initial.kind === 'storage'
      ? { kind: 'storage', values: d.experiment.initial.values.map(v => ({ id: v.id, value: text(v.value) })) }
      : { kind: 'equilibrium' } } };
}
export function createBuilder(state: LabState): BuilderState {
  return { draft: draftFromDocument(state.document), base: exportNative(state), baseDocument: state.document, dirty: false, error: null };
}
export function reloadBuilder(builder: BuilderState, state: LabState): void {
  Object.assign(builder, createBuilder(state));
}
export function newBuilder(builder: BuilderState, state: LabState): void {
  builder.draft = { circuit: { schemaVersion: 1, nodes: ['0'], components: [], observations: [] },
    experiment: { schemaVersion: 1, sources: [], initial: { kind: 'equilibrium' } } };
  builder.base = exportNative(state); builder.baseDocument = state.document; builder.dirty = true; builder.error = null;
}
export function builderConflict(builder: BuilderState, state: LabState): boolean {
  return builder.baseDocument !== state.document || builder.base !== exportNative(state);
}
export function syncCleanBuilder(builder: BuilderState, state: LabState): boolean {
  if (builder.dirty || !builderConflict(builder, state)) return false;
  reloadBuilder(builder, state);
  return true;
}
export function touchBuilder(builder: BuilderState): void { builder.dirty = true; builder.error = null; }
export function freshId(prefix: string, ids: readonly string[]): string {
  let n = 1; while (ids.includes(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}
export function addNode(builder: BuilderState): string {
  const id = freshId('n', builder.draft.circuit.nodes);
  builder.draft.circuit.nodes.push(id); touchBuilder(builder); return id;
}
export type RenameNodeResult = { ok: true } | { ok: false; code: 'builderNodeEmpty' | 'builderNodeDuplicate' | 'builderNodeGroundName' | 'builderGroundProtected' | 'builderUnknownNode' };
export function renameNode(builder: BuilderState, index: number, id: string): RenameNodeResult {
  const old = builder.draft.circuit.nodes[index];
  if (old === undefined) return { ok: false, code: 'builderUnknownNode' };
  if (old === '0') return { ok: false, code: 'builderGroundProtected' };
  if (!id.trim()) return { ok: false, code: 'builderNodeEmpty' };
  if (id === '0') return { ok: false, code: 'builderNodeGroundName' };
  if (id !== old && builder.draft.circuit.nodes.includes(id)) return { ok: false, code: 'builderNodeDuplicate' };
  if (id === old) return { ok: true };
  // Rename is a deliberate refactor of this draft, so every reference follows it.
  builder.draft.circuit.nodes[index] = id;
  for (const c of builder.draft.circuit.components) {
    if (c.p === old) c.p = id; if (c.n === old) c.n = id;
    if ('cp' in c) { if (c.cp === old) c.cp = id; if (c.cn === old) c.cn = id; }
  }
  for (const o of builder.draft.circuit.observations) if (o.type === 'voltage') {
    if (o.p === old) o.p = id; if (o.n === old) o.n = id;
  }
  touchBuilder(builder);
  return { ok: true };
}
export function nodeReferences(builder: BuilderState, id: string): string[] {
  return [...builder.draft.circuit.components.filter(c => c.p === id || c.n === id || ('cp' in c && (c.cp === id || c.cn === id))).map(c => c.id),
    ...builder.draft.circuit.observations.filter(o => o.type === 'voltage' && (o.p === id || o.n === id)).map(o => o.id)];
}
export function removeNode(builder: BuilderState, id: string): string[] {
  if (id === '0') return ['0'];
  const refs = nodeReferences(builder, id); if (refs.length) return refs;
  builder.draft.circuit.nodes = builder.draft.circuit.nodes.filter(n => n !== id); touchBuilder(builder); return [];
}
export const deviceTypes = ['R', 'C', 'L', 'V', 'I', 'VCVS', 'VCCS', 'CCVS', 'CCCS', 'D'] as const;
export function addComponent(builder: BuilderState, type: Component['type'] | 'D'): DraftComponent {
  const d = builder.draft, id = freshId(type, d.circuit.components.map(c => c.id));
  const p = d.circuit.nodes.find(n => n !== '0') ?? '0', n = '0';
  let c: DraftComponent;
  if (type === 'R' || type === 'C' || type === 'L') c = { id, type, p, n, value: '1' };
  else if (type === 'D') {
    c = { id, type, p, n, model: { kind: 'shockley-series', saturationCurrentA: '1e-12',
      idealityFactor: '1', seriesResistanceOhm: '0', temperatureK: '300' } };
    d.circuit.schemaVersion = 2;
  }
  else if (type === 'V' || type === 'I') c = { id, type, p, n };
  else if (type === 'VCVS' || type === 'VCCS') c = { id, type, p, n, cp: p, cn: n, gain: '1' };
  else c = { id, type, p, n, control: d.circuit.components.find(x => voltageBranch(x as Component))?.id ?? '', gain: '1' };
  d.circuit.components.push(c);
  if (type === 'V' || type === 'I') d.experiment.sources.push({ id, dc: '0', ac: { re: '0', im: '0' }, waveform: { type: 'constant', value: '0' } });
  if ((type === 'C' || type === 'L') && d.experiment.initial.kind === 'storage') d.experiment.initial.values.push({ id, value: '0' });
  touchBuilder(builder); return c;
}
export function componentReferences(builder: BuilderState, id: string): string[] {
  return [...builder.draft.circuit.components.filter(c => 'control' in c && c.control === id).map(c => c.id),
    ...builder.draft.circuit.observations.filter(o => o.type === 'current' && o.component === id).map(o => o.id)];
}
export function removeComponent(builder: BuilderState, id: string): string[] {
  const refs = componentReferences(builder, id); if (refs.length) return refs;
  builder.draft.circuit.components = builder.draft.circuit.components.filter(c => c.id !== id);
  builder.draft.experiment.sources = builder.draft.experiment.sources.filter(s => s.id !== id);
  if (builder.draft.experiment.initial.kind === 'storage')
    builder.draft.experiment.initial.values = builder.draft.experiment.initial.values.filter(v => v.id !== id);
  touchBuilder(builder); return [];
}
export function addObservation(builder: BuilderState, type: Observation['type']): Observation {
  const d = builder.draft, id = freshId(type === 'voltage' ? 'v' : 'i', d.circuit.observations.map(o => o.id));
  const o: Observation = type === 'voltage' ? { id, type, p: d.circuit.nodes.find(n => n !== '0') ?? '0', n: '0' }
    : { id, type, component: d.circuit.components[0]?.id ?? '' };
  d.circuit.observations.push(o); touchBuilder(builder); return o;
}
export function changeInitial(builder: BuilderState, kind: 'equilibrium' | 'storage'): void {
  const old = builder.draft.experiment.initial;
  builder.draft.experiment.initial = kind === 'equilibrium' ? { kind }
    : { kind, values: builder.draft.circuit.components.filter(c => c.type === 'C' || c.type === 'L')
      .map(c => ({ id: c.id, value: old.kind === 'storage' ? old.values.find(v => v.id === c.id)?.value ?? '0' : '0' })) };
  touchBuilder(builder);
}
export function changeWaveform(builder: BuilderState, id: string, type: 'none' | Waveform['type']): void {
  const source = builder.draft.experiment.sources.find(s => s.id === id); if (!source) return;
  if (type === 'none') delete source.waveform;
  else if (type === 'constant') source.waveform = { type, value: source.dc };
  else if (type === 'step') source.waveform = { type, at: '0', before: '0', after: source.dc };
  else source.waveform = { type, offset: '0', amplitudePeak: '1', frequencyHz: '100', phaseRadians: '0' };
  touchBuilder(builder);
}
function finite(value: string, field: string): number {
  const number = value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(number)) throw { code: 'builderFinite', params: { field }, field } satisfies BuilderError;
  return number;
}
export function documentFromDraft(d: BuilderDraft): BrowserDocument {
  const circuit = { ...d.circuit, components: d.circuit.components.map((c, i) => {
    if ('value' in c) return { ...c, value: finite(c.value, `component:${i}:value`) };
    if ('gain' in c) return { ...c, gain: finite(c.gain, `component:${i}:gain`) };
    if (c.type === 'D') return { ...c, model: { ...c.model,
      saturationCurrentA: finite(c.model.saturationCurrentA, `component:${i}:saturationCurrentA`),
      idealityFactor: finite(c.model.idealityFactor, `component:${i}:idealityFactor`),
      seriesResistanceOhm: finite(c.model.seriesResistanceOhm, `component:${i}:seriesResistanceOhm`),
      temperatureK: finite(c.model.temperatureK, `component:${i}:temperatureK`) } } satisfies Diode;
    return { ...c };
  }) };
  const experiment = { ...d.experiment, sources: d.experiment.sources.map((s, i) => ({ ...s,
    dc: finite(s.dc, `source:${i}:dc`),
    ...(s.ac ? { ac: { re: finite(s.ac.re, `source:${i}:ac.re`), im: finite(s.ac.im, `source:${i}:ac.im`) } } : {}),
    ...(s.waveform ? { waveform: Object.fromEntries(Object.entries(s.waveform).map(([k, v]) =>
      [k, k === 'type' ? v : finite(v, `source:${i}:waveform.${k}`)])) as Waveform } : {}) })),
    initial: d.experiment.initial.kind === 'storage'
      ? { kind: 'storage' as const, values: d.experiment.initial.values.map((v, i) => ({ id: v.id, value: finite(v.value, `initial:${i}:value`) })) }
      : { kind: 'equilibrium' as const } };
  return parseBrowserDocument(JSON.stringify({ circuit, experiment }));
}
export function applyBuilder(builder: BuilderState, state: LabState): EditResult {
  if (builderConflict(builder, state)) {
    builder.error = { code: 'builderConflict', params: {} }; return { ok: false, errorCode: 'builderConflict' };
  }
  try {
    const next = documentFromDraft(builder.draft);
    const result = importNative(state, serializeBrowserDocument(next), true);
    if (!result.ok) return result;
    reloadBuilder(builder, state); return result;
  } catch (error) {
    builder.error = error instanceof ValidationError ? { code: error.code, params: error.params, raw: error.message }
      : (typeof error === 'object' && error !== null && 'code' in error ? error as BuilderError
        : { code: 'documentRejected', params: {}, raw: error instanceof Error ? error.message : String(error) });
    return { ok: false, errorCode: builder.error.code, errorParams: builder.error.params, error: builder.error.raw ?? '' };
  }
}
