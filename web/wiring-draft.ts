import { serializeBrowserDocument, type BrowserDocument } from './native-document.js';
import { importWiring, nativeCandidate, type ImportWiring } from './wiring-native.js';
import { transact, type WiringOperation, type TransactionResult } from './wiring-transactions.js';
import { type Diagnostic, type WiringGraph } from './wiring-graph.js';

export interface AppliedWiringDocument { document: BrowserDocument; revision: number }
interface Ownership extends AppliedWiringDocument { snapshot: string }
interface Change { field: keyof WiringGraph; before: unknown; after: unknown }
interface HistoryEntry { operation: WiringOperation; changes: Change[]; scientific: boolean; geometry: boolean }
export interface WiringDraft {
  graph: WiringGraph; scientificRevision: number; geometryRevision: number;
  ownership: Ownership; checkpoint: string; history: HistoryEntry[]; redo: HistoryEntry[]; historyLimit: number;
}
/** Object property order is not scientific content; native array order is retained. */
function canonical(value: unknown): string {
  const order = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(order);
    if (item && typeof item === 'object') {
      const entries = Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
      return Object.fromEntries(entries.map(([key, child]) => [key, order(child)]));
    }
    return item;
  };
  return JSON.stringify(order(value));
}
function owner(applied: AppliedWiringDocument): Ownership {
  return { ...applied, snapshot: serializeBrowserDocument(applied.document) };
}
export function createWiringDraft(applied: AppliedWiringDocument, historyLimit = 100): WiringDraft | Extract<ImportWiring, { status: 'unsupported' }> {
  if (!Number.isInteger(historyLimit) || historyLimit < 1 || historyLimit > 1000) throw new Error('History limit must be 1..1000');
  const imported = importWiring(applied.document);
  if (imported.status !== 'editable') return imported;
  return { graph: imported.graph, scientificRevision: 0, geometryRevision: 0, ownership: owner(applied),
    checkpoint: canonical(imported.graph), history: [], redo: [], historyLimit };
}
export function wiringConflict(draft: WiringDraft, applied: AppliedWiringDocument): boolean {
  if (draft.ownership.document !== applied.document || draft.ownership.revision !== applied.revision) return true;
  try {
    return draft.ownership.snapshot !== serializeBrowserDocument(applied.document);
  } catch {
    // Even an invalid in-place mutation invalidates ownership. Apply must not
    // overwrite that external change just because its numeric revision is old.
    return true;
  }
}
export function wiringDirty(draft: WiringDraft): boolean { return canonical(draft.graph) !== draft.checkpoint; }
export function commitWiring(draft: WiringDraft, operation: WiringOperation): TransactionResult {
  const result = transact(draft.graph, operation);
  if (result.status !== 'ok') return result;
  const changes: Change[] = [];
  // Scope history to changed model collections and metadata, excluding ownership,
  // diagnostics and any DOM. Each transaction is exactly one bounded history step.
  for (const field of Object.keys(draft.graph) as (keyof WiringGraph)[]) {
    if (canonical(draft.graph[field]) !== canonical(result.graph[field])) {
      changes.push({ field, before: structuredClone(draft.graph[field]), after: structuredClone(result.graph[field]) });
    }
  }
  // A previously absent optional label would also need inclusion if label editing
  // is added; current operations never add or remove top-level model fields.
  if (changes.length) {
    draft.history.push({ operation: structuredClone(operation), changes, scientific: result.scientific, geometry: result.geometry });
    if (draft.history.length > draft.historyLimit) draft.history.shift();
    draft.redo = [];
    draft.graph = result.graph;
    if (result.scientific) draft.scientificRevision++;
    if (result.geometry) draft.geometryRevision++;
  }
  return result;
}
function travel(draft: WiringDraft, direction: 'undo' | 'redo'): boolean {
  const from = direction === 'undo' ? draft.history : draft.redo;
  const to = direction === 'undo' ? draft.redo : draft.history;
  const entry = from.pop();
  if (!entry) return false;
  for (const change of entry.changes) {
    Object.assign(draft.graph, { [change.field]: structuredClone(direction === 'undo' ? change.before : change.after) });
  }
  to.push(entry);
  if (entry.scientific) draft.scientificRevision++;
  if (entry.geometry) draft.geometryRevision++;
  return true;
}
export const undoWiring = (draft: WiringDraft): boolean => travel(draft, 'undo');
export const redoWiring = (draft: WiringDraft): boolean => travel(draft, 'redo');

/** Synchronize only untouched drafts; geometry work is work worth preserving too.
 * Explicit discard is the only operation allowed to replace a dirty draft. */
export function synchronizeWiring(draft: WiringDraft, applied: AppliedWiringDocument, discard = false): 'unchanged' | 'conflict' | 'unsupported' | 'synchronized' {
  if (!discard && !wiringConflict(draft, applied)) return 'unchanged';
  if (!discard && wiringDirty(draft)) return 'conflict';
  const imported = importWiring(applied.document);
  if (imported.status !== 'editable') return 'unsupported';
  draft.graph = imported.graph;
  draft.ownership = owner(applied);
  draft.checkpoint = canonical(draft.graph);
  draft.history = [];
  draft.redo = [];
  draft.scientificRevision++;
  draft.geometryRevision++;
  return 'synchronized';
}
export function applyWiring(draft: WiringDraft, applied: AppliedWiringDocument):
  { status: 'applied' | 'unchanged' } | { status: 'invalid'; diagnostics: Diagnostic[] } {
  if (wiringConflict(draft, applied)) return { status: 'invalid', diagnostics: [{ category: 'conflict', code: 'obsolete-base', handles: [], message: 'The applied document changed; synchronize or discard explicitly before applying' }] };
  const candidate = nativeCandidate(draft.graph);
  if (candidate.status !== 'ok') return candidate;
  const changed = canonical(candidate.document) !== canonical(applied.document);
  if (changed) {
    applied.document = candidate.document;
    applied.revision++;
  }
  draft.ownership = owner(applied);
  draft.checkpoint = canonical(draft.graph);
  return { status: changed ? 'applied' : 'unchanged' };
}
