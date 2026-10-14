import { rememberLayoutPort } from './layout-port.js';
import { serializeDocument } from '../src/model.js';
import type { RcSynthesisResult } from '../src/rc-synthesis.js';
import type { FosterResult } from '../src/foster-synthesis.js';
import { exportNative, importNative, type LabState } from './lab.js';
import { addPanel, createPanel, type WorkspaceState } from './workspace.js';
export const synthesisMethods = ['cauer-infinity','foster-I','foster-II'] as const;
export type SynthesisMethod = typeof synthesisMethods[number];
export type SynthesisResult = RcSynthesisResult | FosterResult;
export interface SynthesisDraft {
  quantity: 'impedance' | 'admittance'; numerator: string; denominator: string;
  resistance: string; frequency: string; fosterI: boolean; fosterII: boolean;
  rInfinity: string; kZero: string; termsI: string; gZero: string; cInfinity: string; termsII: string;
}
export function synthesisPreset(id='principal'): SynthesisDraft {
  const base: SynthesisDraft = {quantity:'impedance',numerator:'3, 4, 1',denominator:'0, 2, 1',resistance:'1000',frequency:'1000',
    fosterI:true,fosterII:true,rInfinity:'1',kZero:'3/2',termsI:'2, 1/2',gZero:'0',cInfinity:'0',termsII:'1, 1/2\n3, 1/2'};
  if(id==='resistor') return {...base,numerator:'2',denominator:'1',rInfinity:'2',kZero:'0',termsI:'',gZero:'1/2',termsII:''};
  if(id==='capacitor') return {...base,numerator:'3',denominator:'0, 1',rInfinity:'0',kZero:'3',termsI:'',cInfinity:'1/3',termsII:''};
  if(id==='finite') return {...base,numerator:'2, 1',denominator:'1, 1',rInfinity:'1',kZero:'0',termsI:'1, 1',gZero:'1/2',termsII:'2, 1/2'};
  if(id==='irrational') return {...base,denominator:'1, 3, 1',fosterI:false,fosterII:false,termsI:'',termsII:''};
  return base;
}
export interface SynthesisRequest {token:number; methods:SynthesisMethod[]; draft:SynthesisDraft}
export type SynthesisReply = {token:number; method:SynthesisMethod; result:SynthesisResult} | {token:number; error:string};
export interface SynthesisView {token:number; method:SynthesisMethod; snapshot:SynthesisDraft; active:boolean; result:SynthesisResult|null}
type Resource={worker:Pick<Worker,'postMessage'|'terminate'|'onmessage'|'onerror'|'onmessageerror'>;release:()=>void};
export const synthesisSignature=(d:SynthesisDraft,m:SynthesisMethod):string=>JSON.stringify([d.quantity,d.numerator,d.denominator,d.resistance,d.frequency,
  ...(m==='foster-I'?[d.fosterI,d.rInfinity,d.kZero,d.termsI]:m==='foster-II'?[d.fosterII,d.gZero,d.cInfinity,d.termsII]:[])]);
/** One owned, disposable worker. Editing and cancellation retire ownership
 * permanently, so restoring identical text cannot revive an old reply. */
export class SynthesisSession {
  draft=synthesisPreset(); presetId='principal'; selected:SynthesisMethod[]=[...synthesisMethods];
  views=new Map<SynthesisMethod,SynthesisView>();
  status:'idle'|'running'|'complete'|'cancelled'|'invalidated'|'execution-unavailable'|'execution-error'='idle';
  error=''; lastAccepted:SynthesisDraft|null=null;
  private serial=0;
  private running:{token:number;resource:Resource;pending:Set<SynthesisMethod>}|null=null;
  constructor(private factory:()=>Resource,private changed:()=>void){}
  private stop():void {
    const run=this.running;this.running=null;
    if(!run)return;
    run.resource.worker.onmessage=null;run.resource.worker.onerror=null;run.resource.worker.onmessageerror=null;
    run.resource.worker.terminate();run.resource.release();
  }
  cancel(status:'cancelled'|'invalidated'='cancelled'):void {
    if(!this.running)return;
    for(const method of this.running.pending){const v=this.views.get(method);if(v)v.active=false;}
    this.stop();this.status=status;this.changed();
  }
  edit<K extends keyof SynthesisDraft>(field:K,value:SynthesisDraft[K]):void {
    if(this.draft[field]===value)return;
    this.draft[field]=value;this.presetId='';
    this.cancel('invalidated');
    for(const view of this.views.values())if(synthesisSignature(view.snapshot,view.method)!==synthesisSignature(this.draft,view.method)){view.active=false;this.status='invalidated';}
    this.changed();
  }
  preset(id:string):void {
    this.cancel('invalidated');this.draft=synthesisPreset(id);this.presetId=id;
    for(const view of this.views.values())view.active=false;
    if(this.views.size)this.status='invalidated';
    this.changed();
  }
  current(method:SynthesisMethod):SynthesisView|undefined {
    const v=this.views.get(method);
    return v?.active&&synthesisSignature(v.snapshot,method)===synthesisSignature(this.draft,method)?v:undefined;
  }
  start():void {
    this.cancel();if(!this.selected.length)return;
    const token=++this.serial;
    const draft={...this.draft};
    const methods=[...this.selected];
    for(const method of methods)this.views.set(method,{token,method,snapshot:{...draft},active:true,result:null});
    this.error='';this.status='running';
    let resource:Resource;
    try{resource=this.factory();}catch(error){this.status='execution-unavailable';this.error=String(error);this.changed();return;}
    this.running={token,resource,pending:new Set(methods)};
    const fail=(message:string):void=>{
      if(this.running?.token!==token)return;
      for(const method of this.running.pending){const v=this.views.get(method);if(v)v.active=false;}
      this.stop();this.status='execution-error';this.error=message;this.changed();
    };
    resource.worker.onmessage=(event:MessageEvent<SynthesisReply>)=>{
      const reply=event.data;
      if(this.running?.token!==token||reply?.token!==token)return;
      if('error' in reply){fail(reply.error);return;}
      const view=this.current(reply.method);
      if(!this.running.pending.has(reply.method)||!view||view.token!==token)return;
      if(!reply.result?.mathematical||!reply.result.native||!reply.result.verification){fail('Malformed worker reply');return;}
      view.result=reply.result;this.running.pending.delete(reply.method);
      if(reply.result.mathematical.status==='certified')this.lastAccepted={...draft};
      if(!this.running.pending.size){this.stop();this.status='complete';}
      this.changed();
    };
    resource.worker.onerror=event=>fail(event.message);
    resource.worker.onmessageerror=()=>fail('Worker message could not be decoded');
    try{resource.worker.postMessage({token,methods,draft} satisfies SynthesisRequest);}catch(error){fail(String(error));}
    this.changed();
  }
}
/** Native inspection can retain unresolved numerical evidence; adoption may
 * only use a current, mathematically certified AND physically passed result. */
export function synthesisJson(session:SynthesisSession,method:SynthesisMethod,forApply=false):string|null {
  const result=session.current(method)?.result;
  if(!result||result.mathematical.status!=='certified'||result.native.status!=='generated')return null;
  if(forApply&&result.verification.status!=='passed')return null;
  return serializeDocument(result.native.document);
}
/** A confirmation authorizes one result against one applied-document context.
 * Identity and revision reject a change-and-restore, even when JSON is equal. */
export interface SynthesisAdoptionContext {
  method: SynthesisMethod; token: number; document: LabState['document'];
  revision: number; native: string;
}
export function synthesisAdoptionContext(session:SynthesisSession,method:SynthesisMethod,state:LabState):SynthesisAdoptionContext|null {
  const view=session.current(method);
  if(!view)return null;
  return {method,token:view.token,document:state.document,revision:state.revision,native:exportNative(state)};
}
export function synthesisAdoptionCurrent(context:SynthesisAdoptionContext,session:SynthesisSession,state:LabState):boolean {
  return context.document===state.document && context.revision===state.revision &&
    context.native===exportNative(state) && session.current(context.method)?.token===context.token;
}
export function adoptSynthesis(session:SynthesisSession,method:SynthesisMethod,state:LabState,hasDrafts:boolean,confirmed=false,context?:SynthesisAdoptionContext):
  {status:'stale'|'confirmation-required'}|{status:'applied';snapshot:string;frequencyHz:number} {
  if(context&&(context.method!==method||!synthesisAdoptionCurrent(context,session,state)))return {status:'stale'};
  const json=synthesisJson(session,method,true);
  if(!json)return {status:'stale'};
  if(hasDrafts&&!confirmed)return {status:'confirmation-required'};
  if(!importNative(state,json).ok)return {status:'stale'};
  // Choose the independently verified z=i sample; no decimal parsing of exact scales.
  const samples=session.current(method)!.result!.verification.samples;
  const frequencyHz=samples[2]!.sPerSecond.im/(2*Math.PI);
  return {status:'applied',snapshot:exportNative(state),frequencyHz};
}
/** Explicit add/replace, never repurpose an independent existing panel. */
export function synthesisPortHandoff(workspace:WorkspaceState,state:LabState,snapshot:string,replaceId?:string,frequencyHz=1000/(2*Math.PI)):string|null {
  if(exportNative(state)!==snapshot||!Number.isFinite(frequencyHz)||frequencyHz<=0)return null;
  let panel;
  if(replaceId){
    const index=workspace.panels.findIndex(p=>p.id===replaceId);if(index<0)return null;
    panel=createPanel(state,replaceId,'port-frequency');workspace.panels[index]=panel;
  }else panel=addPanel(workspace,state,'port-frequency');
  if(!panel)return null;
  panel.p='port';panel.q='0';panel.portMode=1;panel.externalDrive=null;panel.portMatrix='z';panel.portView='single';
  panel.portFrequencyHz=frequencyHz;panel.settingsOpen=true;
  rememberLayoutPort(state,panel.p,panel.q);
  workspace.layoutIsSuggested=false;
  return panel.id;
}
/** Each row carries all three overall statuses. A metadata-only row represents
 * zero accepted samples without inventing a measurement. Samples remain a
 * finite experiment record, never an all-frequency accuracy certificate. */
export function synthesisCsv(session:SynthesisSession,method:SynthesisMethod):string|null {
  const result=session.current(method)?.result;
  if(!result)return null;
  const cell=(value:string|number|boolean):string=>{
    const text=String(value);
    return /[",\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;
  };
  const row=(values:(string|number|boolean)[]):string=>values.map(cell).join(',');
  const headers=['s_real_per_s','s_imag_per_s','Z_real_ohm','Z_imag_ohm','Y_real_S','Y_imag_S',
    'Z_normalized_difference','Y_normalized_difference','Z_normalized_limit','Y_normalized_limit',
    'Z_comparison_passed','Y_comparison_passed','method','mathematical_status','native_status',
    'verification_status','verification_reason','experiment_kind','sample_index','record_type'];
  const metadata=[method,result.mathematical.status,result.native.status,result.verification.status,result.verification.reason??''];
  const rows=result.verification.samples.map((sample,index)=>row([
    sample.sPerSecond.re,sample.sPerSecond.im,sample.impedanceOhm.re,sample.impedanceOhm.im,
    sample.admittanceSiemens.re,sample.admittanceSiemens.im,
    sample.normalizedImpedance.difference,sample.normalizedAdmittance.difference,
    sample.normalizedImpedance.limit,sample.normalizedAdmittance.limit,
    sample.normalizedImpedance.passed,sample.normalizedAdmittance.passed,...metadata,sample.kind,index,'sample']));
  if(!rows.length)rows.push(row([...Array<string>(12).fill(''),...metadata,'','','metadata']));
  return [row(headers),...rows].join('\n');
}
