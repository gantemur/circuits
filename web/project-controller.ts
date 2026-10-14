/** Portable file orchestration. Only accept() installs Graphical work; no method
 * applies a scientific document. Tokens retain identities as well as snapshots. */
import { exportProjectDraft, serializeProject, projectContentKey, parseProject, PROJECT_LIMITS,
  type ProjectResult, type ProjectDiagnostic, type ProjectDrawing } from './project-format.js';
import { importWiring, nativeCandidate, documentMeaning } from './wiring-native.js';
import { serializeBrowserDocument } from './native-document.js';
import type { WiringSession } from './wiring-interaction.js';

type Ready = Extract<ProjectResult, {status:'ok'}>;
export interface ProjectHost {
  session: WiringSession;
  viewport(): ProjectDrawing['viewport'];
  pending(): number;
  editingSnapshot(): string;
  install(candidate: Ready): void;
}
export class ProjectController {
  savedKey: string | null = null;
  status = 'idle';
  diagnostics: ProjectDiagnostic[] = [];
  candidate: Ready | null = null;
  retainedNative: string | null = null;
  fallback: Extract<ProjectResult,{status:'invalid'}>['document'] | null = null;
  replacementNeedsConsent = false;
  private provisionalCandidate = false;
  private generation = 0;
  private attempt = 0;
  private owner: ReturnType<ProjectController['capture']> | null = null;
  constructor(private host: ProjectHost) {}
  /** Called for edits, even edit-and-restore. Rendering/language changes do not call it. */
  touch(): void { this.generation++; }
  resetSaved(): void { this.savedKey = null; this.cancel(); }
  private capture() {
    const s=this.host.session, state=s.state(), draft=s.draft;
    return {attempt:this.attempt,generation:this.generation,document:state.document,revision:state.revision,
      native:serializeBrowserDocument(state.document),draft,scientific:draft?.scientificRevision,
      geometry:draft?.geometryRevision,graph:JSON.stringify(draft?.graph),
      editing:JSON.stringify([Array.from(s.pending),s.gesture,s.moving,this.host.editingSnapshot(),this.host.viewport()])};
  }
  private current(): boolean {
    if(!this.owner)return false;
    const now=this.capture();
    return Object.keys(now).every(key=>now[key as keyof typeof now]===this.owner![key as keyof typeof now]);
  }
  incomplete(): boolean {
    const s=this.host.session;
    return !!(s.pending.size+this.host.pending() || s.gesture || s.moving);
  }
  private exported(): ProjectResult | null {
    const s=this.host.session;
    if(!s.draft)return null;
    return exportProjectDraft({graph:s.draft.graph,pendingTextCount:s.pending.size+this.host.pending(),
      unfinishedWire:!!(s.gesture||s.moving)},this.host.viewport());
  }
  savedState(): 'incomplete'|'unchanged'|'changed'|'never' {
    if(this.incomplete())return 'incomplete';
    if(this.savedKey===null)return 'never';
    const result=this.exported();
    if(result?.status!=='ok')return 'incomplete';
    const key=projectContentKey(result.project);
    return key.status==='ok'&&key.key===this.savedKey?'unchanged':'changed';
  }
  scientificApplied(): boolean {
    const graph=this.host.session.draft?.graph;
    if(!graph)return false;
    const candidate=nativeCandidate(graph);
    return candidate.status==='ok'&&documentMeaning(candidate.document)===documentMeaning(this.host.session.state().document);
  }
  save(download:(name:string,text:string,type:string)=>void): boolean {
    const result=this.exported();
    if(!result){this.status='unsupported';return false;}
    if(result.status!=='ok'){this.status=this.incomplete()?'incomplete':'invalid';this.diagnostics=result.diagnostics;return false;}
    const serialized=serializeProject(result.project),key=projectContentKey(result.project);
    if(serialized.status!=='ok'||key.status!=='ok'){this.status='invalid';return false;}
    try { download('circuits-unfolded.cuf.json',serialized.json,'application/json'); }
    catch {this.status='download-failed';return false;}
    this.savedKey=key.key;this.status='exported';this.diagnostics=result.warnings;return true;
  }
  async read(file:{size:number;text():Promise<string>}):Promise<void> {
    this.provisionalCandidate=false;
    const attempt=++this.attempt;
    this.owner=this.capture();this.candidate=null;this.fallback=null;this.retainedNative=null;this.diagnostics=[];this.status='reading';
    if(file.size>PROJECT_LIMITS.bytes){this.status='resource';return;}
    let text:string;
    try {text=await file.text();}
    catch {if(attempt===this.attempt)this.status=this.current()?'read-failed':'stale';return;}
    if(attempt!==this.attempt)return;
    if(!this.current()){this.status='stale';return;}
    const result=parseProject(text);
    if(result.status==='ok') {
      this.candidate=result;this.diagnostics=result.warnings;this.status='ready';
      this.replacementNeedsConsent=this.host.session.hasDrafts()||this.incomplete();
    } else {
      this.diagnostics=result.diagnostics;
      if(result.document)this.retainedNative=JSON.stringify(result.document,null,2);
      this.status=result.status==='unsupported'?'unsupported':result.stage==='native'?'native-invalid':result.stage==='drawing'?'drawing-invalid':'invalid';
      if(result.status==='invalid'&&result.stage==='drawing'&&result.document&&importWiring(result.document).status==='editable')this.fallback=result.document;
    }
  }
  prepareFallback():void {
    if(!this.current()){this.status='stale';this.candidate=null;return;}
    if(!this.fallback)return;
    const graph=importWiring(this.fallback);
    if(graph.status!=='editable')return;
    const result=exportProjectDraft({graph:graph.graph,pendingTextCount:0,unfinishedWire:false});
    if(result.status!=='ok'){this.status='invalid';this.diagnostics=result.diagnostics;return;}
    this.provisionalCandidate=true;
    this.candidate=result;this.fallback=null;this.status='fallback-ready';this.diagnostics=result.warnings;
    this.replacementNeedsConsent=this.host.session.hasDrafts()||this.incomplete();
  }
  accept():boolean {
    if(!this.current()){this.status='stale';this.candidate=null;return false;}
    if(!this.candidate)return false;
    const key=projectContentKey(this.candidate.project);
    if(key.status!=='ok'){this.status='invalid';return false;}
    const candidate=this.candidate;
    this.host.install(candidate);
    this.savedKey=this.provisionalCandidate?null:key.key;this.candidate=null;this.fallback=null;this.owner=null;
    this.status=this.provisionalCandidate?'fallback-opened':'opened';this.attempt++;return true;
  }
  cancel():void {this.attempt++;this.owner=null;this.candidate=null;this.fallback=null;this.status='idle';this.diagnostics=[];this.retainedNative=null;}
}
