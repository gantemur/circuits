import { generateTopologyLayout, verifyLayout, type LayoutResult } from './topology-layout.js';
import { nativeCandidate, documentMeaning } from './wiring-native.js';
import { checkpointWiring, replaceWiringGeometry, wiringDirty } from './wiring-draft.js';
import { serializeBrowserDocument } from './native-document.js';
import { acceptedLayoutPort } from './layout-port.js';
import type { WiringSession } from './wiring-interaction.js';
import type { WiringGraph } from './wiring-graph.js';
export interface LayoutHost {
  session:WiringSession;
  pending():number;
  editingSnapshot():string;
  installed(initial:boolean):void;
}
type Generated=Extract<LayoutResult,{status:'generated'}>;
/** Synchronous bounded proposals. No worker, timer or file read can implicitly
 * install geometry. Preview authorization is independent of project consent. */
export class LayoutController {
  port:[string,string]=['',''];
  status='idle';
  initialStatus='idle';
  family:Generated['witness']['family']|null=null;
  proposal:Generated|null=null;
  before:WiringGraph|null=null;
  private generation=0;
  private owner:ReturnType<LayoutController['capture']>|null=null;
  private initialized: {draft:WiringSession['draft'];document:object;revision:number;snapshot:string}|null=null;
  constructor(private host:LayoutHost) {}
  touch():void { this.generation++; }
  private incomplete():boolean {
    const s=this.host.session;
    return !!(this.host.pending() || s.pending.size || s.gesture || s.moving);
  }
  private capture() {
    const s=this.host.session;
    const state=s.state();
    const draft=s.draft;
    const candidate=draft?nativeCandidate(draft.graph):null;
    return {generation:this.generation,document:state.document,revision:state.revision,
      applied:serializeBrowserDocument(state.document),draft,scientific:draft?.scientificRevision,
      geometry:draft?.geometryRevision,graph:JSON.stringify(draft?.graph),
      native:candidate?.status==='ok'?documentMeaning(candidate.document):null,
      editing:JSON.stringify([Array.from(s.pending),s.gesture,s.moving,this.host.pending(),this.host.editingSnapshot()]),
      port:JSON.stringify(this.port)};
  }
  private current():boolean {
    if (!this.owner) return false;
    const now=this.capture();
    return Object.keys(now).every(key=>now[key as keyof typeof now]===this.owner![key as keyof typeof now]);
  }
  reconcile():void {
    if (this.proposal && !this.current()) {
      this.proposal=null;
      this.before=null;
      this.status='stale';
    }
  }
  setPort(role:0|1,value:string):void {
    this.touch();
    this.port[role]=value;
    this.reconcile();
  }
  private outcome(result:LayoutResult):string {
    if (result.status==='generated') return 'verified';
    if (result.status==='unrecognized' && result.reason==='port-required') return 'port-required';
    if (result.status==='unrecognized' && ['invalid-port','source-port-mismatch'].includes(result.reason)) return 'invalid-port';
    return result.status;
  }
  /** Called only at browser initialization or after eligible session sync. A
   * saved project, dirty draft or incomplete gesture is never initialized here. */
  initialize():boolean {
    const s=this.host.session;
    const draft=s.draft;
    // A just-applied user drawing can be clean but still owns history. Do not
    // reinterpret that drawing as a fresh native-only import.
    if (!draft || draft.history.length || draft.redo.length || s.independentProject ||
        s.hasDrafts() || this.incomplete() || wiringDirty(draft)) return false;
    const state=s.state();
    const snapshot=serializeBrowserDocument(state.document);
    if (this.initialized?.draft===draft && this.initialized.document===state.document &&
      this.initialized.revision===state.revision && this.initialized.snapshot===snapshot) return false;
    this.initialized={draft,document:state.document,revision:state.revision,snapshot};
    const stale=!!this.proposal || this.status==='stale';
    this.cancel();
    if(stale)this.status='stale';
    this.port=acceptedLayoutPort(state)??['',''];
    const result=generateTopologyLayout(state.document,this.port[0]&&this.port[1]?{port:this.port}:{});
    this.initialStatus=this.outcome(result);
    this.family=null;
    if (result.status!=='generated') return false;
    draft.graph=structuredClone(result.graph);
    checkpointWiring(draft,state);
    this.family=result.witness.family;
    this.host.installed(true);
    return true;
  }
  suggest():boolean {
    this.touch();
    this.proposal=null;
    this.before=null;
    this.owner=null;
    const draft=this.host.session.draft;
    if (!draft || this.incomplete()) {this.status='incomplete';return false;}
    const native=nativeCandidate(draft.graph);
    if (native.status!=='ok') {this.status='invalid';return false;}
    const sourceFree=native.document.experiment.sources.length===0;
    if (sourceFree && (!this.port[0] || !this.port[1])) {this.status='port-required';return false;}
    const result=generateTopologyLayout(native.document,sourceFree?{port:this.port}:{});
    this.status=this.outcome(result);
    if (result.status!=='generated') return false;
    this.proposal=result;
    this.before=structuredClone(draft.graph);
    this.owner=this.capture();
    return true;
  }
  adopt():boolean {
    if (!this.proposal || !this.current()) {this.status='stale';this.proposal=null;return false;}
    if (this.incomplete()) {this.status='incomplete';return false;}
    const s=this.host.session;
    const draft=s.draft!;
    // Recheck science and geometry at the installation boundary; a displayed
    // preview is not itself authority to replace the current graph.
    const old=nativeCandidate(draft.graph);
    const next=nativeCandidate(this.proposal.graph);
    if (old.status!=='ok' || next.status!=='ok' || documentMeaning(old.document)!==documentMeaning(next.document)) {
      this.status='invalid';this.proposal=null;this.before=null;return false;
    }
    let check;
    try {check=verifyLayout(old.document,this.proposal.graph);}
    catch {this.status='quality-rejected';this.proposal=null;this.before=null;return false;}

    if (!check.evidence.geometryComplete || check.evidence.issues.length || !replaceWiringGeometry(draft,this.proposal.graph)) {
      this.status='quality-rejected';this.proposal=null;this.before=null;return false;
    }
    s.selection=null;
    s.cancel();
    s.issue=null;
    s.status='idle';
    this.family=this.proposal.witness.family;
    this.proposal=null;
    this.before=null;
    this.owner=null;
    this.status='adopted';
    this.touch();
    this.host.installed(false);
    return true;
  }
  cancel():void {
    this.touch();
    this.proposal=null;
    this.before=null;
    this.owner=null;
    this.status='idle';
  }
}
