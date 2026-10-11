import { resistorCandidates, transformResistors, type ResistorCandidate, type ResistorOperation, type ResistorTransformResult } from '../src/resistor-transform.js';
import type { ResistorNetwork } from '../src/kron.js';
import type { LabState } from './lab.js';
import { escapeHtml } from './schematic.js';
import { t, translate, type TranslationKey } from './i18n.js';

const e=escapeHtml;
const fmt=(n:number):string=>n===0?'0':Math.abs(n)<.001||Math.abs(n)>=1e5?n.toExponential(5):Number(n.toPrecision(8)).toString();
const methods:Record<ResistorOperation,TranslationKey>={parallel:'resParallel',series:'resSeries','star-delta':'resStarDelta','delta-star':'resDeltaStar','star-mesh':'resStarMesh',kron:'resKron'};
const formulas:Record<ResistorOperation,TranslationKey>={parallel:'resFormulaParallel',series:'resFormulaSeries','star-delta':'resFormulaStarDelta','delta-star':'resFormulaDeltaStar','star-mesh':'resFormulaStarMesh',kron:'resFormulaKron'};
const issueKeys:Record<string,TranslationKey>={device:'resUnsupported',terminals:'resInvalidTerminals',ground:'resGroundRequired',edges:'resInvalidChoice',parallel:'resInvalidParallel',series:'resInvalidSeries',center:'resInvalidCenter',star:'resInvalidStar',delta:'resInvalidDelta',operation:'resInvalidChoice','internal-island':'resDisconnected',solve:'resNumerical',range:'resNumerical',nonfinite:'resNumerical','row-sum':'resNumerical',symmetry:'resNumerical','positive-offdiagonal':'resNumerical','internal-solve':'resNumerical','internal-kcl':'resNumerical',matrix:'resMismatch',current:'resMismatch',power:'resMismatch'};
const table=(network:ResistorNetwork,title:string):string=>`<div class="res-network"><h3>${e(title)}</h3><p class="analysis-note">${t('resNodes')}: ${network.nodes.map(e).join(', ')}</p><div class="table-wrap"><table class="result-table"><thead><tr><th>ID</th><th>p</th><th>n</th><th>R (Ω)</th></tr></thead><tbody>${network.edges.map(r=>`<tr><td>${e(r.id)}</td><td>${e(r.p)}</td><td>${e(r.n)}</td><td>${fmt(r.resistance)}</td></tr>`).join('')}</tbody></table></div></div>`;
const matrix=(values:number[][],terminals:string[],title:string):string=>`<div class="table-wrap"><table class="matrix-table"><caption>${e(title)} (S)</caption><thead><tr><th>i ↓ / u →</th>${terminals.map(n=>`<th>${e(n)}</th>`).join('')}</tr></thead><tbody>${values.map((row,i)=>`<tr><th>${e(terminals[i]!)}</th>${row.map(v=>`<td>${fmt(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
function candidateLabel(c:ResistorCandidate):string {
  const s=c.selection;
  return `${translate(methods[s.operation])}${s.center?` · ${e(s.center)}`:''}${s.edges?.length?` · ${s.edges.map(e).join(', ')}`:''}`;
}
export class ResistorTransformUI {
  private retainedText='';
  private initialized=false;
  private operation:ResistorOperation='kron';
  private choiceKey='kron';
  private showOriginal=true;
  private latestJson:string|null=null;
  constructor(private readonly root:HTMLElement,private readonly getState:()=>LabState) {
    root.addEventListener('input',event=>{const target=event.target;if(target instanceof HTMLInputElement&&target.id==='res-retained'){
      this.retainedText=target.value;this.latestJson=null;
      const result=root.querySelector<HTMLElement>('.res-result');
      if(result)result.innerHTML=`<p class="warning" role="status">${t('resPending')}</p>`;
    }});
    root.addEventListener('change',event=>{const target=event.target;if(!(target instanceof HTMLInputElement||target instanceof HTMLSelectElement))return;
      if(target.id==='res-retained')this.retainedText=target.value;
      else if(target.id==='res-operation') {this.operation=target.value as ResistorOperation;this.choiceKey='';}
      else if(target.id==='res-choice')this.choiceKey=target.value;
      else return;this.render();
    });
    root.addEventListener('click',event=>{const target=event.target;if(!(target instanceof Element))return;
      const view=target.closest<HTMLElement>('[data-res-view]')?.dataset.resView;
      if(view==='original'||view==='equivalent'){this.showOriginal=view==='original';this.render();return;}
      if(target.closest('#res-reset-terminals')){this.retainedText=this.defaultTerminals();this.render();return;}
      if(target.closest('#res-export')&&this.latestJson){this.render();if(!this.latestJson)return;
        const url=URL.createObjectURL(new Blob([this.latestJson],{type:'application/json'}));
        const a=document.createElement('a');a.href=url;a.download='circuits-resistor-transform.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    });
  }
  private defaultTerminals():string {
    const circuit=this.getState().document.circuit;
    const observations=circuit.observations.filter(o=>o.type==='voltage').flatMap(o=>o.type==='voltage'?[o.p,o.n]:[]);
    return [...new Set([...observations,'0'])].join(', ');
  }
  render():void {
    const state=this.getState(), circuit=state.document.circuit;
    if(!this.initialized){this.retainedText=this.defaultTerminals();this.initialized=true;}
    const retained=this.retainedText.split(',').map(s=>s.trim()).filter(Boolean);
    const network:ResistorNetwork={nodes:circuit.nodes,edges:circuit.components.filter(c=>c.type==='R').map(c=>({id:c.id,p:c.p,n:c.n,resistance:'value'in c?c.value:NaN}))};
    const choices=resistorCandidates(network,retained).filter(c=>c.selection.operation===this.operation);
    if(!this.choiceKey&&this.operation==='kron')this.choiceKey='kron';
    const choice=choices.find(c=>c.key===this.choiceKey);
    const duplicate=new Set(retained).size!==retained.length,missing=retained.filter(n=>!circuit.nodes.includes(n));
    const valid=!!retained.length&&!duplicate&&!missing.length&&retained.includes('0');
    const unsupported=circuit.components.some(c=>c.type!=='R')||state.document.experiment.sources.length>0;
    let result:ResistorTransformResult|null=null;
    if(unsupported)result=transformResistors(state.document,retained,{operation:'kron'});
    else if(valid&&choice)result=transformResistors(state.document,retained,choice.selection);
    this.latestJson=result?.status==='ok'?result.json:null;
    const methodOptions=(Object.keys(methods) as ResistorOperation[]).map(k=>`<option value="${k}"${k===this.operation?' selected':''}>${translate(methods[k])}</option>`).join('');
    const choiceOptions=choices.map(c=>`<option value="${e(c.key)}"${c.key===this.choiceKey?' selected':''}>${candidateLabel(c)}</option>`).join('');
    let content='';
    if(unsupported)content=`<p class="warning" role="status">${t('resUnsupported')}</p>`;
    else if(!valid)content=`<p class="warning" role="status">${t(missing.length?'resMissingTerminal':!retained.includes('0')?'resGroundRequired':'resInvalidTerminals')}${missing.length?` ${missing.map(e).join(', ')}`:''}</p>`;
    else if(!choice)content=`<p class="warning" role="status">${t('resNoChoice')}</p>`;
    else if(result?.status!=='ok')content=`<p class="warning" role="status">${translate(issueKeys[result?.code??'']??'resNumerical')}${result?.status==='numeric-failure'?` <details><summary>${t('resTechnical')}</summary>${e(result.detail)}</details>`:''}</p>`;
    else {
      content=`<div class="one-port-view-switch" role="group"><button type="button" class="button quiet" data-res-view="original" aria-pressed="${this.showOriginal}">${t('originalView')}</button><button type="button" class="button quiet" data-res-view="equivalent" aria-pressed="${!this.showOriginal}">${t('equivalentOnly')}</button></div>
        <div class="one-port-layout res-layout"><div class="one-port-original ${this.showOriginal?'mobile-selected':''}">${table(result.original,t('resOriginal'))}</div><div class="one-port-equivalent-view ${this.showOriginal?'':'mobile-selected'}">${table(result.transformed,t('resTransformed'))}</div></div>
        <p class="analysis-note">${translate(formulas[this.operation])}</p><p class="analysis-note">${t('resChanges',{removed:result.removed.map(e).join(', ')||'—',generated:result.generated.map(r=>e(r.id)).join(', ')||'—',eliminated:result.eliminated.map(e).join(', ')||'—',introduced:result.introduced.map(e).join(', ')||'—'})}</p>
        <div class="res-matrices">${matrix(result.originalResponse,result.retained,t('resOriginalResponse'))}${matrix(result.transformedResponse,result.retained,t('resTransformedResponse'))}</div>
        <p class="analysis-note">${t('resAgreement',{matrix:fmt(result.check.maxMatrixDifference),current:fmt(result.check.maxCurrentDifference),power:fmt(result.check.maxPowerDifference)})}</p>
        <p class="soft-note">${t('resEvidence')}</p><button type="button" id="res-export" class="button">${t('resExport')}</button>
        <details><summary>${t('resJsonPreview')}</summary><textarea class="res-json" readonly aria-label="${t('resJsonPreview')}">${e(result.json)}</textarea></details>`;
    }
    this.root.innerHTML=`<p class="analysis-note">${t('resIntro')}</p><div class="controls-grid"><div class="field"><label for="res-retained">${t('resRetained')}</label><input id="res-retained" type="text" value="${e(this.retainedText)}" aria-invalid="${!valid}"><small>${t('resOrderHint')}</small></div><div class="field"><label for="res-operation">${t('resOperation')}</label><select id="res-operation">${methodOptions}</select></div><div class="field"><label for="res-choice">${t('resOperand')}</label><select id="res-choice"><option value="">${t('resChoose')}</option>${choiceOptions}</select></div></div><button type="button" id="res-reset-terminals" class="button quiet">${t('resResetTerminals')}</button><div class="res-result">${content}</div>`;
  }
}
