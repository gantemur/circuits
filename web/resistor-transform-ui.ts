import { resistorCandidateKey, resistorCandidates, transformResistors, type ResistorCandidate, type ResistorOperation,
  type ResistorTransformResult } from '../src/resistor-transform.js';
import type { ResistorNetwork } from '../src/kron.js';
import type { LabState } from './lab.js';
import { isNonlinearDocument } from './native-document.js';
import { exportNative } from './lab.js';
import { presets } from './presets.js';
import { escapeHtml } from './schematic.js';
import { resistorNetworkSvg, networkPositions } from './network-diagram.js';
import { t, translate, type TranslationKey } from './i18n.js';

const e = escapeHtml;
const fmt = (n: number): string => n === 0 ? '0' : Math.abs(n) < .001 || Math.abs(n) >= 1e5 ? n.toExponential(6) : Number(n.toPrecision(9)).toString();
const methods: Record<ResistorOperation, TranslationKey> = { parallel:'resParallel', series:'resSeries', 'star-delta':'resStarDelta',
  'delta-star':'resDeltaStar', 'star-mesh':'resStarMesh', kron:'resKron' };
const formulas: Record<ResistorOperation, TranslationKey> = { parallel:'resFormulaParallel', series:'resFormulaSeries',
  'star-delta':'resFormulaStarDelta', 'delta-star':'resFormulaDeltaStar', 'star-mesh':'resFormulaStarMesh', kron:'resFormulaKron' };
const issueKeys: Record<string, TranslationKey> = { device:'resUnsupported', terminals:'resInvalidTerminals', ground:'resGroundRequired',
  edges:'resInvalidChoice', parallel:'resInvalidParallel', series:'resInvalidSeries', center:'resInvalidCenter',
  star:'resInvalidStar', delta:'resInvalidDelta', operation:'resInvalidChoice', 'internal-island':'resDisconnected',
  solve:'resNumerical', range:'resNumerical', nonfinite:'resNumerical', 'row-sum':'resNumerical', symmetry:'resNumerical',
  'positive-offdiagonal':'resNumerical', 'internal-solve':'resNumerical', 'internal-kcl':'resNumerical',
  matrix:'resMismatch', current:'resMismatch', power:'resMismatch', underflow:'resNumerical' };
const table = (network: ResistorNetwork, title: string): string => `<div class="res-network"><h3>${e(title)}</h3><p class="analysis-note">${t('resNodes')}: ${network.nodes.map(id=>e(JSON.stringify(id))).join(', ')}</p><div class="table-wrap"><table class="result-table"><thead><tr><th>ID</th><th>p</th><th>n</th><th>R (Ω)</th></tr></thead><tbody>${network.edges.map(edge=>`<tr><td>${e(edge.id)}</td><td>${e(edge.p)}</td><td>${e(edge.n)}</td><td>${fmt(edge.resistance)}</td></tr>`).join('')}</tbody></table></div></div>`;
const matrix = (values: number[][], terminals: string[], title: string): string => `<div class="table-wrap"><table class="matrix-table"><caption>${e(title)} (S)</caption><thead><tr><th>i ↓ / u →</th>${terminals.map(id=>`<th>${e(id)}</th>`).join('')}</tr></thead><tbody>${values.map((row,i)=>`<tr><th>${e(terminals[i]!)}</th>${row.map(value=>`<td>${fmt(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

/** One declared boundary experiment. Λ is N×N S, V is N V, I=ΛV is N A.
 * Positive current enters each network. Other boundary voltages are clamped,
 * not left open. This is illustrative; the independent kernel checks remain authoritative.
 * Nonfinite display products fail closed and never become teaching values. */
export function terminalExperiment(response: number[][], retained: string[]): { voltages: number[]; currents: number[] } | null {
  const driven = retained.findIndex(id => id !== '0');
  if (driven < 0 || response.length !== retained.length) return null;
  const voltages = retained.map((_, index) => index === driven ? 1 : 0);
  const currents: number[] = [];
  for (const row of response) {
    if (row.length !== retained.length) return null;
    let current = 0;
    for (let index = 0; index < row.length; index++) {
      if (!Number.isFinite(row[index]!)) return null;
      current += row[index]! * voltages[index]!;
    }
    if (!Number.isFinite(current)) return null;
    currents.push(current);
  }
  return { voltages, currents };
}

function candidateLabel(candidate: ResistorCandidate, network: ResistorNetwork): string {
  const selection = candidate.selection;
  const ids = selection.edges?.map(id=>JSON.stringify(id)).join(' + ') ?? '';
  if (selection.operation === 'parallel') return t('resCandidateParallel',{ids});
  if (selection.operation === 'series') {
    const [first,second]=(selection.edges??[]).map(id=>network.edges.find(edge=>edge.id===id));
    const center=first&&second?[first.p,first.n].find(id=>id===second.p||id===second.n)??'':'';
    return t('resCandidateSeries',{ids,center:JSON.stringify(center)});
  }
  if (selection.operation === 'star-delta') return t('resCandidateStarDelta',{center:JSON.stringify(selection.center ?? '')});
  if (selection.operation === 'delta-star') return t('resCandidateDeltaStar',{ids});
  if (selection.operation === 'star-mesh') return t('resCandidateStarMesh',{center:JSON.stringify(selection.center ?? '')});
  return t('resCandidateKron');
}
function unavailable(operation: ResistorOperation, network: ResistorNetwork, retained: string[]): string {
  const internal = network.nodes.filter(id=>id!=='0'&&!retained.includes(id));
  if (operation === 'series') {
    const degree=(id:string)=>network.edges.filter(edge=>edge.p===id||edge.n===id).length;
    if (retained.some(id=>id!=='0'&&degree(id)===2)) return t('resRetainedJunction');
    if (internal.some(id=>degree(id)>2)) return t('resBranchedJunction');
    return internal.length ? t('resNoSeriesBranch') : t('resNoInternal');
  }
  if (operation === 'star-delta' || operation === 'star-mesh') return internal.length ? t('resNoStar') : t('resNoInternal');
  if (operation === 'delta-star') return t('resNoTriangle');
  if (operation === 'parallel') return t('resNoParallel');
  return t('resNoInternal');
}
export interface ResistorUIActions {
  hasDrafts(): boolean;
  apply(json: string): boolean;
  loadExample(id: string): void;
  openAnalyze(): void;
  refresh?(): void;
}
interface Preview { baseJson: string; revision: number; choiceKey: string; retained: string[]; result: Extract<ResistorTransformResult,{status:'ok'}> }
interface Applied { originalJson: string; transformedJson: string; revision: number; originPreset: string | null }

/** UI session state is separate from the validated native document and the numerical helper. */
export class ResistorTransformUI {
  private retained: string[] = [];
  private initialized = false;
  private operation: ResistorOperation = 'kron';
  private choiceKey = resistorCandidateKey({operation:'kron'});
  private showOriginal = true;
  private preview: Preview | null = null;
  private applied: Applied | null = null;
  private confirming: 'use' | 'return' | null = null;
  private notice: TranslationKey | null = null;
  private latestJson: string | null = null;
  constructor(private readonly root: HTMLElement, private readonly getState: () => LabState,
    private readonly actions?: ResistorUIActions) {
    root.addEventListener('change', event => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
      if (target instanceof HTMLSelectElement && target.dataset.resTerminal !== undefined) this.retained[Number(target.dataset.resTerminal)] = target.value;
      else if (target.id === 'res-operation') { this.operation = target.value as ResistorOperation; this.choiceKey = ''; }
      else if (target.id === 'res-choice') this.choiceKey = target.value;
      else return;
      this.invalidate(); this.render();
    });
    root.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const view = target.closest<HTMLElement>('[data-res-view]')?.dataset.resView;
      if (view === 'original' || view === 'equivalent') { this.showOriginal = view === 'original'; this.render(); return; }
      const terminal = target.closest<HTMLElement>('[data-res-terminal-action]');
      if (terminal) {
        const index = Number(terminal.dataset.resTerminalIndex);
        switch (terminal.dataset.resTerminalAction) {
          case 'add': this.retained.push(''); break;
          case 'remove': this.retained.splice(index,1); break;
          case 'up': if(index>0)[this.retained[index-1],this.retained[index]]=[this.retained[index]!,this.retained[index-1]!]; break;
          case 'down': if(index<this.retained.length-1)[this.retained[index],this.retained[index+1]]=[this.retained[index+1]!,this.retained[index]!]; break;
        }
        this.invalidate(); this.render(); return;
      }
      if (target.closest('#res-reset-terminals')) { this.retained = this.defaultTerminals(); this.invalidate(); this.render(); return; }
      const example = target.closest<HTMLElement>('[data-res-example]');
      if (example) {
        // This explicit teaching-example action starts a new resistor exercise.
        // Ordinary preset changes still preserve selections and expose missing IDs.
        this.retained=[];this.initialized=false;this.operation=example.dataset.resExample==='res-series'?'series':
          example.dataset.resExample==='res-star'?'star-delta':'kron';this.choiceKey='';this.invalidate();
        this.actions?.loadExample(example.dataset.resExample!);return;
      }
      if (target.closest('#res-preview')) { this.createPreview(); this.render(); return; }
      if (target.closest('#res-use')) { this.tryApply('use'); return; }
      if (target.closest('#res-return')) { this.tryApply('return'); return; }
      if (target.closest('#res-confirm')) { if (this.confirming) this.tryApply(this.confirming,true); return; }
      if (target.closest('#res-cancel')) { this.confirming=null; this.render(); return; }
      if (target.closest('#res-analyze')) { this.actions?.openAnalyze(); return; }
      const current=this.currentPreview();
      if (target.closest('#res-export') && current && this.latestJson===current.result.json) {
        const url=URL.createObjectURL(new Blob([this.latestJson],{type:'application/json'}));
        const link=document.createElement('a'); link.href=url;link.download='circuits-resistor-transform.json';
        document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      }
    });
  }
  private invalidate(): void { this.preview=null; this.latestJson=null; this.confirming=null; this.notice=null; this.failure=null; }
  private defaultTerminals(): string[] {
    const circuit=this.getState().document.circuit;
    const observations=circuit.observations.filter(o=>o.type==='voltage').flatMap(o=>o.type==='voltage'?[o.p,o.n]:[]);
    return [...new Set([...observations,'0'])];
  }
  private network(): ResistorNetwork {
    const circuit=this.getState().document.circuit;
    return {nodes:circuit.nodes,edges:circuit.components.filter(c=>c.type==='R').map(c=>({id:c.id,p:c.p,n:c.n,resistance:'value' in c ? c.value : NaN}))};
  }
  private currentPreview(): Preview | null {
    const preview=this.preview;
    if (!preview) return null;
    const state=this.getState();
    if (preview.revision!==state.revision || preview.baseJson!==exportNative(state) ||
      preview.choiceKey!==this.choiceKey || JSON.stringify(preview.retained)!==JSON.stringify(this.retained)) return null;
    return preview;
  }
  private createPreview(): void {
    this.invalidate();
    const state=this.getState(),native=state.document;
    if (isNonlinearDocument(native)) { this.notice='diodeUnavailableTransform'; return; }
    const candidate=resistorCandidates(this.network(),this.retained).find(c=>c.key===this.choiceKey&&c.selection.operation===this.operation);
    if (!candidate) { this.notice='resNoChoice'; return; }
    const result=transformResistors(native,this.retained,candidate.selection);
    if (result.status!=='ok') { this.failure=result; return; }
    this.failure=null;
    this.preview={baseJson:exportNative(state),revision:state.revision,choiceKey:this.choiceKey,retained:[...this.retained],result};
    this.latestJson=result.json;
  }
  private failure: Exclude<ResistorTransformResult,{status:'ok'}> | null = null;
  private tryApply(action:'use'|'return', confirmed=false): void {
    if (!this.actions) return;
    const state=this.getState(),native=state.document;
    if (isNonlinearDocument(native)) { this.notice='diodeUnavailableTransform'; return; }
    const preview=this.currentPreview();
    const applied=this.applied;
    if (action==='use' && !preview || action==='return' && (!applied || applied.revision!==state.revision || applied.transformedJson!==exportNative(state))) {
      this.notice='resStale';this.confirming=null;this.render();return;
    }
    if (this.actions.hasDrafts() && !confirmed) { this.confirming=action;this.render();return; }
    const json=action==='use' ? preview!.result.json : applied!.originalJson;
    // Recheck the exact candidate and full helper verification at the action boundary.
    if (action==='use') {
      const selection=resistorCandidates(this.network(),this.retained).find(c=>c.key===this.choiceKey)?.selection;
      const checked=selection&&transformResistors(native,this.retained,selection);
      if (!checked || checked.status!=='ok' || checked.json!==json) { this.invalidate();this.notice='resStale';this.render();return; }
    }
    const prior=this.applied;
    const origin=action==='use' ? prior && prior.revision===state.revision && prior.transformedJson===exportNative(state)
      ? prior.originalJson : preview!.baseJson : null;
    const originPreset=action==='use' ? prior && prior.revision===state.revision && prior.transformedJson===exportNative(state)
      ? prior.originPreset : state.presetId : null;
    if (!this.actions.apply(json)) { this.notice='resStale';this.render();return; }
    if (action==='use') this.applied={originalJson:origin!,transformedJson:exportNative(this.getState()),revision:this.getState().revision,originPreset};
    else this.applied=null;
    this.invalidate();this.failure=null;this.retained=this.defaultTerminals();
    this.notice=action==='use'?'resUsed':'resReturned';
    this.actions.refresh?.();
    this.render();
  }
  guideOrigin(): string | null {
    const applied=this.applied,state=this.getState();
    return applied && applied.revision===state.revision && applied.transformedJson===exportNative(state)
      ? applied.originPreset : null;
  }
  render(): void {
    const state=this.getState(),circuit=state.document.circuit;
    if (isNonlinearDocument(state.document)) {
      this.root.innerHTML = `<div class="warning" role="status">${t('diodeUnavailableTransform')}</div>`;
      return;
    }
    if(!this.initialized){this.retained=this.defaultTerminals();this.initialized=true;}
    const network=this.network(),retained=[...this.retained];
    const internal=network.nodes.filter(id=>!retained.includes(id));
    const choices=resistorCandidates(network,retained).filter(c=>c.selection.operation===this.operation &&
      (c.selection.operation!=='kron'||internal.length>0));
    if (!this.choiceKey && this.operation==='kron') this.choiceKey=resistorCandidateKey({operation:'kron'});
    const choice=choices.find(c=>c.key===this.choiceKey);
    const duplicate=new Set(retained.filter(Boolean)).size!==retained.filter(Boolean).length;
    const missing=retained.filter(id=>id!==''&&!circuit.nodes.includes(id));
    const valid=retained.length>=2&&retained.every(Boolean)&&!duplicate&&!missing.length&&retained.includes('0');
    const blockers=circuit.components.filter(c=>c.type!=='R').map(c=>`${c.id} (${c.type})`);
    const preview=this.currentPreview();
    this.latestJson=preview?.result.json??null;
    const methodOptions=(Object.keys(methods) as ResistorOperation[]).map(key=>`<option value="${key}"${key===this.operation?' selected':''}>${translate(methods[key])}</option>`).join('');
    const choiceOptions=choices.map(c=>`<option value="${e(c.key)}"${c.key===this.choiceKey?' selected':''}>${e(candidateLabel(c,network))}</option>`).join('');
    const terminalRows=retained.map((id,index)=>`<div class="res-terminal-row"><div class="field"><label for="res-terminal-${index}">${t('resTerminal',{number:index+1})}</label><select id="res-terminal-${index}" data-res-terminal="${index}" aria-invalid="${id===''||!circuit.nodes.includes(id)||retained.indexOf(id)!==index}"><option value=""${id===''?' selected':''}>${t('resChooseTerminal')}</option>${!circuit.nodes.includes(id)&&id!==''?`<option value="${e(id)}" selected>${e(t('resMissingOption',{id:JSON.stringify(id)}))}</option>`:''}${circuit.nodes.map(node=>`<option value="${e(node)}"${id===node?' selected':''}>${e(JSON.stringify(node))}</option>`).join('')}</select></div><div class="res-terminal-actions"><button type="button" class="button quiet" data-res-terminal-action="up" data-res-terminal-index="${index}" aria-label="${t('resMoveUp',{number:index+1})}"${index===0?' disabled':''}>↑</button><button type="button" class="button quiet" data-res-terminal-action="down" data-res-terminal-index="${index}" aria-label="${t('resMoveDown',{number:index+1})}"${index===retained.length-1?' disabled':''}>↓</button><button type="button" class="button quiet" data-res-terminal-action="remove" data-res-terminal-index="${index}" aria-label="${t('resRemoveTerminal',{number:index+1})}">×</button></div></div>`).join('');
    let content='';
    if(blockers.length)content=`<p class="warning" role="status">${t('resBlocked',{devices:blockers.map(e).join(', ')})}</p>${['res-series','res-star','res-bridge'].map(id=>{
      const preset=presets.find(item=>item.id===id)!;
      return `<button type="button" class="button outline" data-res-example="${id}">${t('resOpenExample',{name:translate(preset.titleKey)})}</button>`;
    }).join('')}`;
    else if(!valid)content=`<p class="warning" role="status">${t(missing.length?'resMissingTerminal':!retained.includes('0')?'resGroundRequired':'resInvalidTerminals')}${missing.length?` ${missing.map(id=>e(JSON.stringify(id))).join(', ')}`:''}</p>`;
    else content=`${choices.length===0?`<p class="warning" role="status">${e(unavailable(this.operation,network,retained))}</p>`:''}${choice?`<p class="analysis-note">${e(candidateLabel(choice,network))}. ${translate(formulas[this.operation])}</p>`:''}<button type="button" id="res-preview" class="button" ${choice?'':'disabled'}>${t('resPreview')}</button>`;
    if(this.failure)content+=`<p class="warning" role="status">${translate(issueKeys[this.failure.code]??'resNumerical')} <details><summary>${t('resTechnical')}</summary>${e(this.failure.detail)}</details></p>`;
    if(preview)content+=this.previewContent(preview.result);
    const mayReturn=this.applied&&this.applied.revision===state.revision&&this.applied.transformedJson===exportNative(state);
    if(mayReturn)content+=`<button type="button" id="res-return" class="button outline">${t('resReturn')}</button>`;
    if(this.notice)content+=`<p class="warning" role="status">${translate(this.notice)}</p>`;
    if(this.confirming)content+=`<div class="warning" role="alert"><p>${t('resDraftConflict')}</p><button type="button" id="res-confirm" class="button">${t('resConfirm')}</button><button type="button" id="res-cancel" class="button quiet">${t('resCancel')}</button></div>`;
    this.root.innerHTML=`<p class="analysis-note">${t('resIntro')}</p><div class="res-terminal-controls"><div class="field-label">${t('resRetained')}</div><p class="analysis-note">${t('resOrderHint')}</p>${terminalRows}<div class="file-actions"><button type="button" class="button quiet" data-res-terminal-action="add">${t('resAddTerminal')}</button><button type="button" id="res-reset-terminals" class="button quiet">${t('resResetTerminals')}</button></div></div><div class="controls-grid"><div class="field"><label for="res-operation">${t('resOperation')}</label><select id="res-operation">${methodOptions}</select></div><div class="field"><label for="res-choice">${t('resOperand')}</label><select id="res-choice"><option value="">${t('resChoose')}</option>${choiceOptions}</select></div></div><div class="res-result">${content}</div>`;
  }
  private previewContent(result: Extract<ResistorTransformResult,{status:'ok'}>): string {
    const before=terminalExperiment(result.originalResponse,result.retained);
    const after=terminalExperiment(result.transformedResponse,result.retained);
    const currentA=before&&this.operation==='series'&&result.retained.length===2
      ? Math.abs(before.currents[result.retained.findIndex(id=>id!=='0')]!) : null;
    const currentMilliamp=currentA===null ? null : currentA*1000;
    const seriesCurrent=currentA===null ? '' : `<p class="analysis-note">${currentMilliamp!==null&&Number.isFinite(currentMilliamp)
      ? t('resSeriesCurrent',{current:fmt(currentMilliamp)})
      : t('resSeriesCurrentAmp',{current:fmt(currentA)})}</p>`;
    const experiment=before&&after?`<p class="analysis-note">${t('resExperiment',{voltages:result.retained.map((id,index)=>`${e(JSON.stringify(id))}=${fmt(before.voltages[index]!)} V`).join('; ')})}</p>${seriesCurrent}<div class="table-wrap"><table class="result-table"><thead><tr><th>${t('resTerminalHeading')}</th><th>${t('resOriginalCurrent')}</th><th>${t('resTransformedCurrent')}</th></tr></thead><tbody>${result.retained.map((id,index)=>`<tr><th>${e(JSON.stringify(id))}</th><td>${fmt(before.currents[index]!)} A</td><td>${fmt(after.currents[index]!)} A</td></tr>`).join('')}</tbody></table></div><p class="soft-note">I_B = ΛV_B. ${t('resClamped')}</p>`:`<p class="warning">${t('resExperimentUnavailable')}</p>`;
    const summary=this.operation==='series'&&result.removed.length===2 ? (()=>{
      const values=result.original.edges.filter(edge=>result.removed.includes(edge.id)).map(edge=>edge.resistance);
      return `<p class="res-equation">${values.map(v=>`${fmt(v)} Ω`).join(' + ')} → ${fmt(result.generated[0]!.resistance)} Ω</p>`;
    })():`<p class="res-equation">${t('resChanges',{removed:result.removed.map(e).join(', ')||'—',generated:result.generated.map(edge=>`${e(edge.id)} ${fmt(edge.resistance)} Ω`).join(', ')||'—',eliminated:result.eliminated.map(e).join(', ')||'—',introduced:result.introduced.map(e).join(', ')||'—'})}</p>`;
    const positions=networkPositions(result.original,result.retained);
    const originalSvg=resistorNetworkSvg(result.original,{positions,retained:result.retained,removed:result.removed,eliminated:result.eliminated,label:t('resOriginal')});
    const transformedPositions=Object.assign(Object.create(null),positions,networkPositions(result.transformed,result.retained));
    const transformedSvg=resistorNetworkSvg(result.transformed,{positions:transformedPositions,retained:result.retained,generated:result.generated.map(edge=>edge.id),introduced:result.introduced,label:t('resTransformed')});
    const large=result.original.nodes.length>12||result.transformed.nodes.length>12||
      result.original.edges.length>18||result.transformed.edges.length>18;
    const fullView=large||!originalSvg||!transformedSvg?`<p class="warning">${t('resLargeLayout')}</p>${table(result.original,t('resOriginal'))}${table(result.transformed,t('resTransformed'))}`:
      `<div class="one-port-view-switch" role="group"><button type="button" class="button quiet" data-res-view="original" aria-pressed="${this.showOriginal}">${t('originalView')}</button><button type="button" class="button quiet" data-res-view="equivalent" aria-pressed="${!this.showOriginal}">${t('equivalentOnly')}</button></div><div class="one-port-layout res-layout"><div class="one-port-original ${this.showOriginal?'mobile-selected':''}"><h3>${t('resOriginal')}</h3>${originalSvg}</div><div class="one-port-equivalent-view ${this.showOriginal?'':'mobile-selected'}"><h3>${t('resTransformed')}</h3>${transformedSvg}</div></div>`;
    const localNodes=[...new Set([...result.original.edges.filter(edge=>result.removed.includes(edge.id)).flatMap(edge=>[edge.p,edge.n]),...result.eliminated])];
    const localBefore:ResistorNetwork={nodes:localNodes,edges:result.original.edges.filter(edge=>result.removed.includes(edge.id))};
    const localAfter:ResistorNetwork={nodes:[...new Set(result.generated.flatMap(edge=>[edge.p,edge.n]))],edges:result.generated};
    const localIsSmall=localBefore.nodes.length<=10&&localAfter.nodes.length<=10&&
      localBefore.edges.length<=12&&localAfter.edges.length<=12;
    const localBeforeSvg=localIsSmall?resistorNetworkSvg(localBefore,{retained:result.retained,label:t('resLocalBefore'),removed:result.removed,eliminated:result.eliminated}):null;
    const localAfterSvg=localIsSmall?resistorNetworkSvg(localAfter,{retained:result.retained,label:t('resLocalAfter'),generated:result.generated.map(edge=>edge.id),introduced:result.introduced}):null;
    const local=result.removed.length||result.generated.length?`<details class="res-local"><summary>${t('resLocal')}</summary><p class="soft-note">${t('resLocalNote')}</p>${localBeforeSvg&&localAfterSvg?`<div class="res-diagram-grid"><div>${localBeforeSvg}</div><div>${localAfterSvg}</div></div>`:`<p class="warning">${t('resLargeLayout')}</p>${table(localBefore,t('resLocalBefore'))}${table(localAfter,t('resLocalAfter'))}`}</details>`:'';
    return `<div class="res-preview" role="status"><strong>${t('resVerified')}</strong>${summary}${experiment}${fullView}${local}<details class="res-detail"><summary>${t('resTerminalEquations')}</summary>${matrix(result.originalResponse,result.retained,t('resOriginalResponse'))}${matrix(result.transformedResponse,result.retained,t('resTransformedResponse'))}</details><details class="res-detail"><summary>${t('resVerification')}</summary><p>${t('resEvidence')}</p><p>${t('resAgreement',{matrix:fmt(result.check.maxMatrixDifference),current:fmt(result.check.maxCurrentDifference),power:fmt(result.check.maxPowerDifference)})}</p><p>${t('resLimits',{matrix:fmt(result.check.matrixLimit),current:fmt(result.check.currentLimit),power:fmt(result.check.powerLimit)})}</p>${table(result.original,t('resOriginal'))}${table(result.transformed,t('resTransformed'))}</details><details class="res-detail"><summary>${t('resJsonPreview')}</summary><textarea class="res-json" readonly aria-label="${t('resJsonPreview')}">${e(result.json)}</textarea></details><div class="file-actions"><button type="button" id="res-use" class="button">${t('resUse')}</button><button type="button" id="res-export" class="button outline">${t('resExport')}</button><button type="button" id="res-analyze" class="button quiet">${t('resOpenAnalyze')}</button></div></div>`;
  }
}
