/** Browser-independent interaction state; unfinished gestures never enter the graph. */
import { createWiringDraft, commitWiring, wiringConflict, wiringDirty, synchronizeWiring, checkpointWiring,
  undoWiring, redoWiring, type WiringDraft } from './wiring-draft.js';
import { emptyWiring, type Diagnostic, type Point, type Handle } from './wiring-graph.js';
import { nativeCandidate, documentMeaning } from './wiring-native.js';
import { transact, type WiringOperation } from './wiring-transactions.js';
import { importNative, type LabState } from './lab.js';
export const WIRING_LIMITS = { devices: 40, vertices: 240, wires: 320 };
export type WiringSelection = { kind: 'device' | 'vertex' | 'edge'; key: Handle; segment?: number } | null;
export class WiringSession {
  draft: WiringDraft | null = null;
  selection: WiringSelection = null;
  gesture: { start: Handle; bends: Point[] } | null = null;
  moving = false;
  pending = new Map<string, string>();
  issue: Diagnostic | null = null;
  status: 'idle' | 'valid' | 'applied' | 'unsupported' | 'oversize' = 'idle';
  constructor(readonly state: () => LabState) { this.reload(); }
  hasDrafts(): boolean { return !!(this.gesture || this.pending.size || this.draft && wiringDirty(this.draft)); }
  oversized(): boolean {
    const graph = this.draft?.graph;
    return !!graph && (graph.devices.length > WIRING_LIMITS.devices || graph.vertices.length > WIRING_LIMITS.vertices || graph.edges.length > WIRING_LIMITS.wires);
  }
  reload(): void {
    const result = createWiringDraft(this.state());
    this.draft = 'graph' in result ? result : null;
    this.status = this.draft ? this.oversized() ? 'oversize' : 'idle' : 'unsupported';
    this.pending.clear(); this.gesture = null; this.selection = null; this.issue = null;
  }
  sync(): void {
    if (this.hasDrafts()) return;
    if (!this.draft) { this.reload(); return; }
    const result = synchronizeWiring(this.draft, this.state());
    if (result === 'unsupported') this.reload();
    if (result === 'synchronized') { this.selection = null; this.issue = null; this.status = this.oversized() ? 'oversize' : 'idle'; }
  }
  blank(): void {
    // Explicit New is a new independent draft, even on an unsupported document.
    const seed = createWiringDraft({document: {circuit:{schemaVersion:1,nodes:['0'],components:[],observations:[]},
      experiment:{schemaVersion:1,sources:[],initial:{kind:'equilibrium'}}},revision:0});
    if (!('graph' in seed)) return;
    this.draft = seed;
    checkpointWiring(seed, this.state());
    seed.graph = emptyWiring('storage');
    this.pending.clear(); this.gesture = null; this.selection = null; this.issue = null; this.status = 'idle';
  }
  execute(operation: WiringOperation): Handle[] | null {
    if (!this.draft || this.oversized()) return null;
    const preview = transact(this.draft.graph, operation);
    if (preview.status !== 'ok') { this.issue = preview.diagnostics[0]!; return null; }
    if (preview.graph.devices.length>WIRING_LIMITS.devices || preview.graph.vertices.length>WIRING_LIMITS.vertices || preview.graph.edges.length>WIRING_LIMITS.wires) {
      this.issue = {category:'validation',code:'editor-limit',handles:[],message:'Graphical size limit exceeded'};
      return null;
    }
    const result = commitWiring(this.draft, operation);
    if(result.status!=='ok')return null;
    this.issue = null; this.status = 'idle';
    return result.created;
  }
  cancel(): void { this.gesture = null; this.moving = false; }
  begin(vertex: Handle): void { this.gesture = {start:vertex,bends:[]}; this.moving = false; }
  finish(vertex: Handle, survivingName?: string): boolean {
    if (!this.gesture) return false;
    const result = this.execute({type:'connect',a:this.gesture.start,b:vertex,bends:this.gesture.bends,
      ...(survivingName ? {survivingName} : {})});
    if (!result) return false;
    this.gesture = null; return true;
  }
  history(redo: boolean): void {
    if (!this.draft) return;
    this.cancel();
    (redo ? redoWiring : undoWiring)(this.draft);
    this.selection = null; this.issue = null; this.status = 'idle';
  }
  validate(): ReturnType<typeof nativeCandidate> | null {
    if (!this.draft) return null;
    if (this.gesture || this.pending.size) {
      this.issue = {category:'completion',code:'pending-properties',handles:[],message:'Commit property text or cancel the unfinished wire first'};
      return null;
    }
    const result = nativeCandidate(this.draft.graph);
    this.issue = result.status === 'invalid' ? result.diagnostics[0]! : null;
    this.status = result.status === 'ok' ? 'valid' : 'idle';
    return result;
  }
  apply(): boolean {
    if (!this.draft || wiringConflict(this.draft,this.state())) {
      this.issue = {category:'conflict',code:'obsolete-base',handles:[],message:'The applied circuit changed. Discard explicitly to reload.'};
      return false;
    }
    const result = this.validate();
    if (!result || result.status !== 'ok') return false;
    const state = this.state();
    if (documentMeaning(result.document) !== documentMeaning(state.document)) {
      const imported = importNative(state, JSON.stringify(result.document), true);
      if (!imported.ok) { this.issue = {category:'validation',code:imported.errorCode??'invalid-document',handles:[],message:'Native application failed'}; return false; }
    }
    checkpointWiring(this.draft,state);
    this.status = 'applied';
    return true;
  }
}
