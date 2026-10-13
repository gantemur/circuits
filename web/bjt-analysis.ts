import { complex, type Unit } from '../src/index.js';
import { solveBjtOperatingPoint, type BjtOperatingPointResult } from '../src/bjt-operating-point.js';
import { createBjtTangent, solveBjtFrequency, bjtTransfer, type BjtFrequencyResult } from '../src/bjt-tangent.js';
import type { BjtDocument } from '../src/bjt-document.js';
import type { PanelConfig } from './workspace.js';
import type { SweepPoint } from './lab.js';
import { nonlinearUnknownCount } from './dc-sweep.js';

export type BjtPanelResult =
  | {type:'bjt-dc'|'bjt-equations'; bias:BjtOperatingPointResult}
  | {type:'bjt-unavailable'; reason:string}
  | {type:'frequency'; bjt:true; unit:`${Unit}/${Unit}`; sweep:SweepPoint[]; ac:BjtFrequencyResult;
      algebraic:{status:'not-supported';reason:string}; incremental?:never};

/** One bounded operating point per applied document/revision; frequency panels
 * retain their own sources, outputs and grids. No solve rewrites the document. */
export function browserBjtBias(document:BjtDocument):BjtOperatingPointResult {
  return nonlinearUnknownCount(document)>64 || document.circuit.components.length>128 ? {status:'failed',code:'numeric-range',
    message:'The browser limit is 64 unknowns and 128 components',trace:[]} : solveBjtOperatingPoint(document);
}
export function bjtPanel(panel:PanelConfig,document:BjtDocument,bias:BjtOperatingPointResult):BjtPanelResult {
  if(panel.type==='dc'||panel.type==='equations') return {type:panel.type==='dc'?'bjt-dc':'bjt-equations',bias};
  if(panel.type!=='frequency') return {type:'bjt-unavailable',reason:'unsupported'};
  if(bias.status!=='ok') return {type:'bjt-unavailable',reason:bias.code};
  const tangent=createBjtTangent(bias,document);
  if(tangent.status!=='ok')return {type:'bjt-unavailable',reason:tangent.code};
  const input=tangent.inputs.find(i=>i.id===panel.input);
  const output=tangent.outputs.find(o=>o.id===panel.output);
  if(!input||!output)return {type:'bjt-unavailable',reason:'missing-selection'};
  const unit=`${output.unit}/${input.unit}` as `${Unit}/${Unit}`;
  const sweep:SweepPoint[]=[];
  for(let index=0;index<panel.points;index++) {
    const frequencyHz=panel.minHz*(panel.maxHz/panel.minHz)**(index/(panel.points-1));
    const result=bjtTransfer(tangent,panel.input,panel.output,complex(0,2*Math.PI*frequencyHz));
    if(result.status!=='ok') {
      sweep.push({frequencyHz,status:result.status,value:null,magnitude:null,magnitudeDb:null,phaseDegrees:null,message:result.message});
      continue;
    }
    const {value,magnitude,phaseRadians}=result.transfer;
    sweep.push({frequencyHz,status:magnitude===0?'zero-magnitude':'ok',value,magnitude,
      magnitudeDb:magnitude>0&&(unit==='V/V'||unit==='A/A')?20*Math.log10(magnitude):null,
      phaseDegrees:magnitude>0?phaseRadians*180/Math.PI:null,message:''});
  }
  return {type:'frequency',bjt:true,unit,sweep,
    ac:solveBjtFrequency(tangent,complex(0,2*Math.PI*panel.inspectHz)),
    algebraic:{status:'not-supported',reason:'BJT tangent has no algebraic extraction'}};
}
