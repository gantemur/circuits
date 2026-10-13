import type { ExactLimit } from '../src/rational-function.js';
import { synthesisWorkerSource } from './synthesis-worker-source.js';
import { SynthesisSession, synthesisMethods, synthesisJson, synthesisCsv, adoptSynthesis, synthesisPortHandoff,
  type SynthesisMethod,type SynthesisView,type SynthesisDraft } from './synthesis-state.js';
import { st,type SynthesisText } from './synthesis-copy.js';
import { synthesisDiagram } from './synthesis-diagram.js';
import { escapeHtml } from './schematic.js';
import { exportNative,type LabState } from './lab.js';
import type { WorkspaceState } from './workspace.js';
const e=(v:unknown):string=>escapeHtml(String(v));
const methodName=(m:SynthesisMethod):string=>st(m==='cauer-infinity'?'cauer':m==='foster-I'?'fosterI':'fosterII');
const polynomial=(s:string):string=>s.split(',').map((a,i)=>`(${a.trim()})${i?'z'+(i===1?'':`^${i}`):''}`).join(' + ');
const expression=(d:SynthesisDraft):string=>`${d.quantity==='impedance'?'F':'G'}(z) = (${polynomial(d.numerator)}) / (${polynomial(d.denominator)})`;
const fmt=(v:number):string=>v===0?'0':Number(v.toPrecision(7)).toString();
const cx=(v:{re:number;im:number}):string=>`${fmt(v.re)} ${v.im<0?'−':'+'} ${fmt(Math.abs(v.im))}i`;
const exactFunction=(f:{numerator:string[];denominator:string[]}):string=>`(${polynomial(f.numerator.join(','))}) / (${polynomial(f.denominator.join(','))})`;
const limitText=(v:ExactLimit):string=>v.kind==='finite'?v.value:`∞ (${st('poleOrder')} ${v.order}; ${st('coefficient')} ${v.coefficient})`;
function mathLabel(view:SynthesisView):string {
  const m=view.result!.mathematical;
  switch(m.status){
    case 'certified':return st('certified');case 'boundary':return st(m.boundary);case 'not-rc':return st('rejected');
    case 'invalid-input':return st('invalid');case 'resource-limit':return st('resource');
    case 'invalid-decomposition':return st('invalidDecomp');case 'decomposition-unavailable':return st('noDecomp');
  }
}
/** Expose the certificate's already-checked identities; no algebra runs here. */
function extractionSteps(view:SynthesisView):string {
  const m=view.result!.mathematical;
  if(m.status!=='certified')return '';
  const steps='trace' in m?m.trace.map(step=>{
    const domain=step.domain==='impedance'?'Z':'Y';
    return `<li><p>${domain}: <code>${e(exactFunction(step.before))}</code></p>
      <p>${e(st(step.omitted?'omitted':'selectedTerm'))}: ${step.element.kind} = ${e(step.element.value)} (${e(st('normalized'))})</p>
      <p>${e(st('remainder'))}: <code>${e(exactFunction(step.remaining))}</code></p></li>`;
  }):m.sections.map(section=>`<li><p>${section.elements.map(v=>`${v.kind} = ${e(v.value)}`).join('; ')} (${e(st('normalized'))})</p>
    <p>${e(st('selectedTerm'))}: <code>${e(exactFunction(section.contribution))}</code></p>
    <p>${e(st('cumulative'))}: <code>${e(exactFunction(section.cumulative))}</code></p></li>`);
  return `<ol class="synthesis-steps">${steps.join('')}</ol>`;
}
/** Pure result renderer: never invokes a synthesis or numerical kernel. */
export function synthesisResultHtml(view:SynthesisView,current:boolean):string {
  const r=view.result;if(!r)return '';
  const m=r.mathematical;
  let html=`<article class="panel synthesis-card" data-synthesis-result="${view.method}"><h3>${e(methodName(view.method))}</h3>${current?'':`<p class="warning">${e(st('stale'))}</p>`}
    <p><strong>${e(st('math'))}:</strong> ${e(mathLabel(view))}</p><p><strong>${e(st('native'))}:</strong> ${e(st(r.native.status==='generated'?'generated':'notGenerated'))}</p>
    <p><strong>${e(st('numerical'))}:</strong> ${e(st(r.verification.status==='passed'?'passed':r.verification.status==='mismatch'?'mismatch':'unresolved'))}</p>
    <p class="synthesis-formula">${e(expression(view.snapshot))}</p><p class="synthesis-formula">Rref = ${e(view.snapshot.resistance)} Ω; omegaRef = ${e(view.snapshot.frequency)} rad/s</p>`;
  if(m.status==='certified'){
    const limits='impedanceLimits' in m?m.impedanceLimits:{dc:m.dc,infinity:m.highFrequency};
    html+=`<p>${e(st('identity'))}: <code>${e(exactFunction(m.reconstructed))}</code> = ${view.method==='foster-II'?'G':'F'}(z)</p><p>${e(st('limits'))}: <code>${e(limitText(limits.dc))} / ${e(limitText(limits.infinity))}</code></p>`;
    const diagram=synthesisDiagram(r,view.method);
    if(r.native.status==='generated'){
      html+=diagram?`<div class="synthesis-scroll">${diagram}</div>`:`<p>${e(st('fallback'))}</p>`;
      html+=`<h4>${e(st('values'))}</h4><div class="synthesis-scroll"><table><thead><tr><th>ID</th><th>${e(st('normalized'))}</th><th>${e(st('physical'))}</th></tr></thead><tbody>${r.native.elements.map(v=>`<tr><th>${e(v.id)}</th><td>${e(v.normalized)}</td><td>${e(fmt(v.value))} ${v.kind==='R'?'Ω':'F'}</td></tr>`).join('')}</tbody></table></div>
        <details><summary>${e(st('rounding'))}</summary><pre>${e(JSON.stringify(r.native.elements,null,2))}</pre></details>
        <details open><summary>${e(st('topology'))}</summary><div class="synthesis-scroll"><table><thead><tr><th>ID</th><th>p → n</th><th>R / C</th></tr></thead><tbody>${r.native.document.circuit.components.map(c=>`<tr><th>${e(c.id)}</th><td>${e(c.p)} → ${e(c.n)}</td><td>${e(c.type)}</td></tr>`).join('')}</tbody></table></div></details>`;
      if(r.verification.status!=='passed')html+=`<p class="warning">${e(st('unverified'))}</p>`;
      html+=`<div class="file-actions"><button class="button" data-syn-apply="${view.method}" ${!current||r.verification.status!=='passed'?'disabled':''}>${e(st('apply'))}</button><button class="button outline" data-syn-json="${view.method}" ${!current?'disabled':''}>${e(st('export'))}</button></div>`;
    }
    html+=`<details><summary>${e(st('steps'))}</summary>${extractionSteps(view)}</details>`;
  }
  if(r.verification.samples.length){
    html+=`<h4>${e(st('samples'))}</h4><div class="synthesis-scroll"><table><thead><tr><th>s (1/s)</th><th>Z (Ω)</th><th>Y (S)</th><th>${e(st('difference'))} Z; Y</th></tr></thead><tbody>${r.verification.samples.map(s=>`<tr><td>${e(cx(s.sPerSecond))}</td><td>${e(cx(s.impedanceOhm))}</td><td>${e(cx(s.admittanceSiemens))}</td><td>${e(fmt(s.normalizedImpedance.difference))} / ${e(fmt(s.normalizedImpedance.limit))}; ${e(fmt(s.normalizedAdmittance.difference))} / ${e(fmt(s.normalizedAdmittance.limit))}</td></tr>`).join('')}</tbody></table></div>
      <p>${e(st('power'))}: ${r.verification.samples.flatMap(s=>s.power).filter(p=>p.passed).length}/${r.verification.samples.flatMap(s=>s.power).length}</p>
      <button class="button quiet" data-syn-csv="${view.method}" ${!current?'disabled':''}>${e(st('csv'))}</button>`;
  }
  const diagnostics={mathematical:m,native:r.native.status==='unavailable'?r.native:null,verification:r.verification};
  return html+`<details><summary>${e(st('details'))}</summary><pre>${e(JSON.stringify(diagnostics,null,2))}</pre></details></article>`;
}
interface Actions {hasDrafts:()=>boolean;changed:()=>void;openAnalyze:(id:string)=>void;download:(name:string,text:string,type:string)=>void}
export class SynthesisUI {
  readonly session:SynthesisSession;
  private confirmation:{method:SynthesisMethod;token:number}|null=null;
  private adopted:{snapshot:string;frequencyHz:number}|null=null;
  constructor(private root:HTMLElement,private state:()=>LabState,private workspace:WorkspaceState,private actions:Actions){
    this.session=new SynthesisSession(()=>{
      if(typeof Worker==='undefined'||!synthesisWorkerSource||typeof URL.createObjectURL!=='function')throw new Error('Worker unavailable');
      const url=URL.createObjectURL(new Blob([synthesisWorkerSource],{type:'text/javascript'}));
      try{return {worker:new Worker(url),release:()=>URL.revokeObjectURL(url)};}catch(error){URL.revokeObjectURL(url);throw error;}
    },()=>this.renderResults());
    root.addEventListener('input',event=>{
      const target=event.target;if(!(target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement||target instanceof HTMLSelectElement))return;
      const field=target.dataset.synField as keyof SynthesisDraft|undefined;if(!field)return;
      this.confirmation=null;
      const value=target instanceof HTMLInputElement&&target.type==='checkbox'?target.checked:target.value;
      this.session.edit(field,value as never);this.updateExpression();
    });
    root.addEventListener('change',event=>{
      const target=event.target;if(!(target instanceof HTMLInputElement||target instanceof HTMLSelectElement))return;
      if(target.id==='synthesis-preset'&&target.value){this.confirmation=null;this.session.preset(target.value);this.render();}
      if(target.dataset.synMethod){
        this.session.cancel();this.session.selected=synthesisMethods.filter(m=>root.querySelector<HTMLInputElement>(`[data-syn-method="${m}"]`)?.checked);this.renderResults();
      }
    });
    root.addEventListener('click',event=>{
      const target=event.target;if(!(target instanceof Element))return;
      if(target.closest('#synthesis-run')){this.confirmation=null;this.session.start();return;}
      if(target.closest('#synthesis-cancel')){this.session.cancel();return;}
      const apply=target.closest<HTMLElement>('[data-syn-apply]');if(apply){this.apply(apply.dataset.synApply as SynthesisMethod);return;}
      if(target.closest('#synthesis-confirm')&&this.confirmation){const c=this.confirmation;if(this.session.current(c.method)?.token===c.token)this.apply(c.method,true);return;}
      if(target.closest('#synthesis-no')){this.confirmation=null;this.renderResults();return;}
      const json=target.closest<HTMLElement>('[data-syn-json]');if(json){const method=json.dataset.synJson as SynthesisMethod;const value=synthesisJson(this.session,method);if(value)this.actions.download(`synthesis-${method}.json`,value,'application/json');return;}
      const csv=target.closest<HTMLElement>('[data-syn-csv]');if(csv){const method=csv.dataset.synCsv as SynthesisMethod;const value=synthesisCsv(this.session,method);if(value)this.actions.download(`synthesis-${method}.csv`,value,'text/csv');return;}
      if(target.closest('#synthesis-analyze')&&this.adopted){
        const replacement=this.root.querySelector<HTMLSelectElement>('#synthesis-replace')?.value;
        const id=synthesisPortHandoff(this.workspace,this.state(),this.adopted.snapshot,replacement,this.adopted.frequencyHz);
        if(id)this.actions.openAnalyze(id);else this.renderResults();
      }
    });
  }
  leave():void{this.session.cancel();}
  private apply(method:SynthesisMethod,confirmed=false):void{
    const result=adoptSynthesis(this.session,method,this.state(),this.actions.hasDrafts(),confirmed);
    if(result.status==='confirmation-required')this.confirmation={method,token:this.session.current(method)!.token};
    if(result.status==='applied'){this.confirmation=null;this.adopted={snapshot:result.snapshot,frequencyHz:result.frequencyHz};this.actions.changed();}
    this.renderResults();
  }
  private updateExpression():void{
    const output=this.root.querySelector('#synthesis-expression');if(output)output.textContent=expression(this.session.draft);
    const preset=this.root.querySelector<HTMLSelectElement>('#synthesis-preset');if(preset)preset.value=this.session.presetId;
  }
  render():void{
    const d=this.session.draft;
    const field=(key:keyof SynthesisDraft,label:string,area=false):string=>`<label>${e(label)}${area?`<textarea rows="3"`:`<input type="text"`} id="syn-${key}" data-syn-field="${key}" spellcheck="false" ${area?'':`value="${e(d[key])}"`}>${area?`${e(d[key])}</textarea>`:''}</label>`;
    const decomp=(first:boolean):string=>`<details open><summary>${e(st(first?'fosterI':'fosterII'))}</summary><label><input type="checkbox" data-syn-field="${first?'fosterI':'fosterII'}" ${d[first?'fosterI':'fosterII']?'checked':''}> ${e(st('decomp'))}</label>${field(first?'rInfinity':'gZero',first?'rInfinity':'gZero')}${field(first?'kZero':'cInfinity',first?'kZero':'cInfinity')}${field(first?'termsI':'termsII',st(first?'termsI':'termsII'),true)}</details>`;
    this.root.innerHTML=`<h2 id="synthesis-title" tabindex="-1">${e(st('title'))}</h2><p>${e(st('intro'))}</p><p>${e(st('exact'))}</p><details><summary>${e(st('methods'))}</summary><p>${e(st('teaching'))}</p></details>
      <div class="panel synthesis-controls"><label>${e(st('preset'))}<select id="synthesis-preset"><option value="">—</option>${['principal','resistor','capacitor','finite','irrational'].map(id=>`<option value="${id}">${e(st(id as SynthesisText))}</option>`).join('')}</select></label>
      <div class="controls-grid"><label>${e(st('quantity'))}<select id="syn-quantity" data-syn-field="quantity"><option value="impedance" ${d.quantity==='impedance'?'selected':''}>${e(st('impedance'))}</option><option value="admittance" ${d.quantity==='admittance'?'selected':''}>${e(st('admittance'))}</option></select></label>${field('numerator',st('numerator'))}${field('denominator',st('denominator'))}${field('resistance',st('resistance'))}${field('frequency',st('frequency'))}</div>
      <p>${e(st('pending'))}: <code id="synthesis-expression"></code></p><fieldset><legend>${e(st('methods'))}</legend>${synthesisMethods.map(m=>`<label class="inline"><input type="checkbox" data-syn-method="${m}" ${this.session.selected.includes(m)?'checked':''}>${e(methodName(m))}</label>`).join('')}</fieldset><div class="synthesis-decompositions">${decomp(true)}${decomp(false)}</div></div>
      <div class="file-actions"><button class="button" id="synthesis-run">${e(st('run'))}</button><button class="button outline" id="synthesis-cancel">${e(st('cancel'))}</button></div>
      <div id="synthesis-state" role="status" aria-live="polite"></div><p>${e(st('evidence'))}</p><div id="synthesis-adoption"></div><div id="synthesis-results" class="synthesis-results"></div>`;
    this.updateExpression();this.renderResults();
  }
  private renderResults():void{
    const state=this.root.querySelector('#synthesis-state'),results=this.root.querySelector('#synthesis-results'),adopt=this.root.querySelector('#synthesis-adoption');if(!state||!results||!adopt)return;
    const status=this.session.status;
    state.innerHTML=`<p>${e(st(status==='execution-unavailable'?'unavailable':status==='execution-error'?'execution':status))}</p>${this.session.error?`<details><summary>${e(st('details'))}</summary><pre>${e(this.session.error)}</pre></details>`:''}${this.session.lastAccepted?`<details><summary>${e(st('accepted'))}</summary><code>${e(expression(this.session.lastAccepted))}</code></details>`:''}`;
    (this.root.querySelector('#synthesis-run') as HTMLButtonElement).disabled=status==='running'||!this.session.selected.length;
    (this.root.querySelector('#synthesis-cancel') as HTMLButtonElement).disabled=status!=='running';
    results.innerHTML=[...this.session.views.values()].filter(v=>v.result).map(v=>synthesisResultHtml(v,!!this.session.current(v.method))).join('')||`<p>${e(st('empty'))}</p>`;
    adopt.innerHTML=this.confirmation?`<div class="warning"><p>${e(st('confirm'))}</p><button class="button" id="synthesis-confirm">${e(st('yes'))}</button><button class="button quiet" id="synthesis-no">${e(st('no'))}</button></div>`:'';
    if(this.adopted){
      const current=exportNative(this.state())===this.adopted.snapshot;
      const full=this.workspace.panels.length>=3;
      adopt.innerHTML+=`<div class="panel"><p>${e(st(current?'adopted':'staleAdoption'))}</p>${current&&full?`<label>${e(st('replace'))}<select id="synthesis-replace">${this.workspace.panels.map(p=>`<option value="${e(p.id)}">${e(p.id)} · ${e(p.type)}</option>`).join('')}</select></label>`:''}<button class="button" id="synthesis-analyze" ${current?'':'disabled'}>${e(st(full?'replaceButton':'analyze'))}</button></div>`;
    }
  }
}
