import type { Bjt } from '../src/bjt-model.js';
import type { BjtOperatingPointResult } from '../src/bjt-operating-point.js';
import type { LabState } from './lab.js';
import { escapeHtml as e } from './schematic.js';
import { matchingPreset } from './presets.js';
import { t } from './i18n.js';
import { diodeFailureReason } from './diagnostics.js';

const n=(x:number)=>Number.isFinite(x)?x.toPrecision(8):'—';
const table=(rows:(string|number)[][])=>`<div class="table-wrap"><table class="result-table"><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${e(typeof v==='number'?n(v):v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
export function bjtMetrics(id:string,bias:BjtOperatingPointResult|null):string {
  if(!bias||bias.status!=='ok')return `<p>${t('diodeDerivativeUnavailable')}</p>`;
  const q=bias.bjts[id]; if(!q)return '';
  const v=q.terminalVoltagesV;
  const regions={ 'forward-active':'bjtForward', 'reverse-active':'bjtReverse', saturation:'bjtSaturation',cutoff:'bjtCutoff',boundary:'bjtBoundary' } as const;
  return `<h3>${e(id)}</h3><p>${t(regions[q.region])} · ${t('bjtRegionNote')}</p>${table([
    ['V(c)−V(e)',v.c-v.e,'V'],['V(b)−V(e)',v.b-v.e,'V'],['V(b)−V(c)',v.b-v.c,'V'],
    ['iC',q.currentsA.c,'A'],['iB',q.currentsA.b,'A'],['iE',q.currentsA.e,'A'],
    ['F',q.forwardTransportA,'A'],['R',q.reverseTransportA,'A'],['gF',q.forwardConductanceS,'S'],['gR',q.reverseConductanceS,'S'],
    [t('bjtPower'),q.absorbedW,'W'],['Σ i',q.conservationResidualA,'A'],['P − P(identity)',q.powerIdentityResidualW,'W']])}
    ${q.derivativeUnderflow.forward||q.derivativeUnderflow.reverse?`<p class="warning">${t('bjtUnderflow')}</p>`:''}
    <details><summary>${t('bjtDerivatives')}</summary><p>${t('bjtJacobianNote')}</p>${table([['∂i/∂V (S)','c','b','e'],...q.jacobianS.map((row,i)=>[['c','b','e'][i]!,...row])])}</details>`;
}
export function bjtDcHtml(bias:BjtOperatingPointResult,equations=false):string {
  if(bias.status!=='ok')return `<div class="warning" role="status">${e(t('diodeBiasFailure',{reason:diodeFailureReason(bias.code)}))}</div><details><summary>${t('technicalDetails')}</summary><pre>${e(bias.message)}</pre></details>`;
  const equationsHtml=`<p>${t('bjtEquations')}</p><div class="law-box">uBE=σ(Vb−Ve), uBC=σ(Vb−Vc), VT=kB·T/q<br>F=IS·expm1(uBE/VT), R=IS·expm1(uBC/VT)<br>iC=σ[F−R−R/βR]<br>iB=σ[F/βF+R/βR]<br>iE=σ[R−F−F/βF]</div>`;
  return `<p>${t('bjtConvention')}</p>${equations?equationsHtml:''}<div class="subheading">${t('nodeVoltages')}</div>${table(Object.entries(bias.unknowns).map(([id,v])=>[id,v,id.startsWith('V(')?'V':'A']))}${Object.keys(bias.bjts).map(id=>bjtMetrics(id,bias)).join('')}
    <details><summary>${t('panelExplanation')}</summary>${equations?'':equationsHtml}<p>${t('bjtDiagnostics')}</p>${table([
      ...bias.residuals.map(r=>[r.label,r.absolute,r.unit,r.physicalAllowance,r.arithmeticAllowance]),
      ['KCL(0)',bias.groundKcl.absolute,'A',bias.groundKcl.physicalAllowance,bias.groundKcl.arithmeticAllowance],
      ['Σ P',bias.powerBalanceW,'W',bias.powerPhysicalAllowanceW,bias.powerArithmeticAllowanceW]])}</details>`;
}

/** Only three verified layouts, matched against exact preset topology. Every
 * branch ends at an explicit wire/node; arbitrary networks use the table. */
export function bjtSchematic(state:LabState):{html:string;note:string;schematic:boolean} {
  const doc=state.document;
  const topology=`<p>${e(t('nodesList',{nodes:doc.circuit.nodes.map(id=>JSON.stringify(id)).join(', ')}))}</p>`+table(doc.circuit.components.map(c=>[c.id,c.type,c.type==='Q'?`c=${c.c}; b=${c.b}; e=${c.e}`:`p=${c.p}; n=${c.n}${'cp' in c?`; cp=${c.cp}; cn=${c.cn}`:'control' in c?`; control=${c.control}`:''}`,
    c.type==='Q'?`${c.model.polarity}; IS=${c.model.transportSaturationCurrentA}; βF=${c.model.betaForward}; βR=${c.model.betaReverse}; T=${c.model.temperatureK}`:
    c.type==='D'?JSON.stringify(c.model):'value' in c?`${c.value} ${c.type==='R'?'Ω':c.type==='C'?'F':'H'}`:'gain' in c?String(c.gain):String(doc.experiment.sources.find(s=>s.id===c.id)?.dc??'')]));
  const preset=matchingPreset(doc.circuit)?.id;
  const q=doc.circuit.components.find((c):c is Bjt=>c.type==='Q');
  if(!preset?.startsWith('bjt-')||!q||q.type!=='Q')return {html:topology,note:t('unknownTopologyHint'),schematic:false};
  const wire=(x:number,y:number,X:number,Y:number)=>`<path class="wire" d="M${x} ${y}L${X} ${Y}"/>`;
  const text=(x:number,y:number,value:string)=>`<text x="${x}" y="${y}" class="schematic-small bjt-label">${e(value)}</text>`;
  const group=(id:string,body:string)=>`<g class="component${state.selectedComponent===id?' selected':''}" role="button" tabindex="0" data-schematic-component="${e(id)}" aria-label="${e(id)}">${body}</g>`;
  const resistor=(id:string,x:number,y:number,vertical=false)=>{
    const c=doc.circuit.components.find(c=>c.id===id);
    if(!c||c.type!=='R')return '';
    return group(id,vertical?`<rect class="symbol" x="${x-9}" y="${y}" width="18" height="40"/>`+text(x+16,y+12,`${id} ${Number(c.value.toPrecision(4))} Ω`):
      `<rect class="symbol" x="${x}" y="${y-9}" width="60" height="18"/>`+text(x,y-24,`${id} ${Number(c.value.toPrecision(4))} Ω`));
  };
  const source=(id:string,x:number,y:number)=>{
    if(preset==='bjt-cutoff')id+='Off';
    const value=doc.experiment.sources.find(s=>s.id===id)?.dc;
    return wire(x,y,x,y+24)+group(id,`<circle class="symbol" cx="${x}" cy="${y+46}" r="22"/>`+text(x-5,y+41,'+')+text(x-5,y+60,'−')+text(x+28,y+45,`${id}: ${n(value??0)} V`))+wire(x,y+68,x,400);
  };
  const ce=preset==='bjt-ce'||preset==='bjt-pnp';
  const follower=preset==='bjt-follower';
  let body=wire(65,400,700,400)+`<path class="ground" d="M340 400v14m-14 0h28m-23 6h18m-13 6h8"/>`+text(363,424,'0');
  body+=group(q.id,wire(240,250,295,250)+`<path class="symbol" d="M295 217v66M295 238L360 195M295 262L360 305"/>`+wire(360,195,360,150)+wire(360,305,360,350)+
    (q.model.polarity==='npn'?`<path class="symbol" d="M334 288l-12 -2 5 -10Z"/>`:`<path class="symbol" d="M315 275l12 2 -5 10Z"/>`)+text(370,250,`${q.id} ${q.model.polarity.toUpperCase()}`));
  body+=text(265,208,`b: ${q.b}`)+text(320,140,`c: ${q.c}`)+text(320,344,`e: ${q.e}`);
  if(ce) {
    body+=wire(65,250,120,250)+resistor('Rs',120,250)+wire(180,250,240,250)+source('Vs',65,250);
    body+=wire(360,45,700,45)+source('Vcc',700,45)+wire(360,45,360,75)+resistor('Rc',360,75,true)+wire(360,115,360,150);
    body+=wire(360,150,500,150)+wire(500,150,500,220)+resistor('Rl',500,220,true)+wire(500,260,500,400)+wire(360,350,360,400);
  } else {
    body+=wire(65,250,240,250)+source('Vb',65,250)+wire(360,150,700,150)+source('Vc',700,150);
    if(follower) body+=wire(360,350,450,350)+resistor('Re',450,350,true)+wire(450,390,450,400);
    else body+=wire(360,350,420,350)+wire(420,350,420,270)+wire(420,270,450,270)+source('Ve',450,270);
  }
  for(const [x,y] of [[360,150],[65,250],[360,350],[360,400]])body+=`<circle class="node-dot" cx="${x}" cy="${y}" r="3"/>`;
  return {schematic:true,note:t('bjtConvention'),html:`<div class="bjt-diagram"><svg viewBox="0 0 890 450" role="img" aria-label="${e(t('bjtDrawing'))}">${body}</svg></div><details><summary>${t('topologyTable')}</summary>${topology}</details>`};
}
