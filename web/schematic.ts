import type { Bjt } from '../src/bjt-model.js';
import { bjtSchematic } from './bjt-presentation.js';
import type { Component } from '../src/model.js';
import type { Diode } from '../src/nonlinear-model.js';
import type { NativeDocument } from '../src/model.js';
import type { LabState } from './lab.js';
import { t } from './i18n.js';
import { matchingPreset } from './presets.js';
import { resistorNetworkSvg, type Positions } from './network-diagram.js';

export const escapeHtml = (value: unknown): string => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const number = (value: number): string => value !== 0 && (Math.abs(value) < .01 || Math.abs(value) >= 1e5)
  ? value.toExponential(3) : Number(value.toPrecision(5)).toString();
function item(state: LabState, id: string): Component | Diode | Bjt { return state.document.circuit.components.find(c => c.id === id)!; }
function valueLabel(c: Component | Diode | Bjt): string {
  if (c.type === 'Q') return `${c.model.polarity.toUpperCase()}; Is=${c.model.transportSaturationCurrentA} A; βF=${c.model.betaForward}; βR=${c.model.betaReverse}; T=${c.model.temperatureK} K`;
  if (c.type === 'D') return `Is=${number(c.model.saturationCurrentA)} A, n=${number(c.model.idealityFactor)}, Rs=${number(c.model.seriesResistanceOhm)} Ω, T=${number(c.model.temperatureK)} K`;
  if ('value' in c) return `${number(c.value)} ${c.type === 'R' ? 'Ω' : c.type === 'C' ? 'F' : 'H'}`;
  if ('gain' in c) return `${number(c.gain)} ${c.type === 'VCCS' ? 'S' : c.type === 'CCVS' ? 'Ω' : ''}`.trim();
  return c.type === 'V' ? t('valueSource') : t('currentSource');
}
function exactValueLabel(c: Component | Diode | Bjt): string {
  if (c.type === 'Q') return `${c.model.polarity.toUpperCase()}; Is=${c.model.transportSaturationCurrentA} A; βF=${c.model.betaForward}; βR=${c.model.betaReverse}; T=${c.model.temperatureK} K`;
  if (c.type === 'D') return `Is=${c.model.saturationCurrentA} A; n=${c.model.idealityFactor}; Rs=${c.model.seriesResistanceOhm} Ω; T=${c.model.temperatureK} K`;
  if ('value' in c) return `${c.value} ${c.type === 'R' ? 'Ω' : c.type === 'C' ? 'F' : 'H'}`;
  if ('gain' in c) return `${c.gain} ${c.type === 'VCCS' ? 'S' : c.type === 'CCVS' ? 'Ω' : ''}`.trim();
  return valueLabel(c);
}
const wire = (x1:number,y1:number,x2:number,y2:number) => `<path class="wire" d="M${x1} ${y1}L${x2} ${y2}"/>`;
const dot = (x:number,y:number) => `<circle class="node-dot" cx="${x}" cy="${y}" r="4"/>`;
const node = (x:number,name:string,selected:boolean) => `<text x="${x}" y="90" text-anchor="middle" class="schematic-label${selected?' schematic-output':''}">${escapeHtml(name)}${selected?' ◉':''}</text>`;
const ground = (x:number,y=258) => `<g class="ground"><path d="M${x-14} ${y}h28M${x-9} ${y+5}h18M${x-4} ${y+10}h8"/></g><text x="${x+21}" y="${y+7}" class="schematic-small">0</text>`;
function group(state:LabState,id:string,symbol:string,x:number,labelY:number):string {
  const c=item(state,id),selected=state.selectedComponent===id;
  return `<g class="component${selected?' selected':''}" role="button" tabindex="0" data-schematic-component="${escapeHtml(id)}" aria-label="${escapeHtml(t('selectComponent',{id,type:c.type,value:valueLabel(c)}))}"><title>${escapeHtml(id)}: ${escapeHtml(valueLabel(c))}</title>${symbol}<text x="${x}" y="${labelY}" class="component-label">${escapeHtml(id)}</text><text x="${x}" y="${labelY+15}" text-anchor="middle" class="schematic-small">${escapeHtml(valueLabel(c))}</text></g>`;
}
function resistor(state:LabState,id:string,x1:number,x2:number,y=120):string {
  const cx=(x1+x2)/2;
  return group(state,id,`<rect class="symbol" x="${x1}" y="${y-11}" width="${x2-x1}" height="22" rx="2"/>`,cx,y-30);
}
function seriesComponent(state:LabState,id:string,x1:number,x2:number,y=120):string {
  const component = item(state,id);
  if (component.type === 'R') return resistor(state,id,x1,x2,y);
  if (component.type === 'C') {
    const middle = (x1+x2)/2;
    return wire(x1,y,middle-7,y)+group(state,id,
      `<path class="symbol" d="M${middle-7} ${y-22}v44M${middle+7} ${y-22}v44"/>`,middle,y-45)+
      wire(middle+7,y,x2,y);
  }
  // Four arcs terminate exactly at the right-hand lead.
  const middle=(x1+x2)/2;
  return wire(x1,y,middle-30,y)+group(state,id,
    `<path class="symbol" d="M${middle-30} ${y}c0-25 15-25 15 0c0-25 15-25 15 0c0-25 15-25 15 0c0-25 15-25 15 0"/>`,middle,y-45)+
    wire(middle+30,y,x2,y);
}
function branchResistor(state:LabState,id:string,x:number):string {
  return wire(x,120,x,165)+group(state,id,`<rect class="symbol" x="${x-11}" y="165" width="22" height="48" rx="2"/>`,x,158)+wire(x,213,x,256)+ground(x);
}
function capacitor(state:LabState,id:string,x:number):string {
  return wire(x,120,x,183)+group(state,id,`<path class="symbol" d="M${x-22} 183h44M${x-22} 195h44"/>`,x,160)+wire(x,195,x,256)+ground(x);
}
function capacitorHorizontal(state:LabState,id:string,x1:number,x2:number):string {
  const x=(x1+x2)/2;
  return wire(x1,120,x-7,120)+group(state,id,`<path class="symbol" d="M${x-7} 98v44M${x+7} 98v44"/>`,x,75)+wire(x+7,120,x2,120);
}
function inductorVertical(state:LabState,id:string,x:number):string {
  return wire(x,120,x,160)+group(state,id,`<path class="symbol" d="M${x} 160c-24 0-24 15 0 15c-24 0-24 15 0 15c-24 0-24 15 0 15c-24 0-24 15 0 15"/>`,x,150)+wire(x,220,x,256)+ground(x);
}
function shuntComponent(state:LabState,id:string,x:number):string {
  const type=item(state,id).type;
  if(type==='R') return branchResistor(state,id,x);
  if(type==='C') return capacitor(state,id,x);
  return inductorVertical(state,id,x);
}
function inductorHorizontal(state:LabState,id:string,x1:number,x2:number):string {
  const x=(x1+x2)/2;
  return group(state,id,`<path class="symbol" d="M${x1} 120c0-25 15-25 15 0c0-25 15-25 15 0c0-25 15-25 15 0c0-25 15-25 15 0"/>`,x,75)+wire(x1+60,120,x2,120);
}
function source(state:LabState,id:string,x:number,kind:'V'|'VCVS',labelX=x+58,labelY=175):string {
  const shape=kind==='V'?`<circle class="symbol" cx="${x}" cy="184" r="25"/><path class="wire" d="M${x-8} 176h16m-8-8v16M${x-8} 194h16"/>`:
    `<path class="symbol" d="M${x} 151l27 33l-27 33l-27-33Z"/><text x="${x}" y="189" text-anchor="middle" class="schematic-label">μ</text>`;
  const upper=kind==='V'?159:151,lower=kind==='V'?209:217;
  return wire(x,120,x,upper)+group(state,id,shape,labelX,labelY)+wire(x,lower,x,256)+ground(x);
}
function wrap(state:LabState,body:string,note:string,height=305,outputOverride?:string):{html:string;note:string;schematic:boolean} {
  const selected=state.document.circuit.observations.find(o=>o.id===state.output);
  const description=outputOverride??(selected?.type==='voltage'?`V(${selected.p}) − V(${selected.n})`:
    selected?.type==='current'?`I(${selected.component})`:t('noOutputSelected'));
  const badgeY=height-30;
  const html=`<svg viewBox="0 0 690 ${height}" role="img" aria-label="${t('diagramLabel')}"><rect width="690" height="${height}" fill="#fafcf9"/><text x="22" y="29" class="schematic-small">${t('terminalOrientation')}</text>${body}<rect class="output-badge" x="330" y="${badgeY}" width="340" height="25" rx="6" fill="#fff0e8"/><text x="500" y="${badgeY+17}" text-anchor="middle" class="schematic-small schematic-output">${escapeHtml(t('outputBadge',{output:description}))}</text></svg>`;
  return { html, note, schematic:true };
}
/** Four horizontal nodes joined by three real series elements; every shunt ends at node 0. */
function ladderSchematic(state:LabState,series:string[],shunts:string[],withSource:boolean,note:string):{html:string;note:string;schematic:boolean} {
  const names=['in','a','b','out'];
  const x=[70,225,380,535];
  const selected=state.document.circuit.observations.find(o=>o.id===state.output);
  const selectedNode=selected?.type==='voltage' && selected.n==='0' ? selected.p : '';
  let svg='';
  for(let index=0;index<names.length;index++) {
    svg+=node(x[index]!,names[index]!,selectedNode===names[index])+dot(x[index]!,120);
  }
  for(let index=0;index<series.length;index++) {
    const left=x[index]!,right=x[index+1]!;
    svg+=wire(left,120,left+40,120)+seriesComponent(state,series[index]!,left+40,right-40)+wire(right-40,120,right,120);
  }
  for(let index=0;index<shunts.length;index++) svg+=shuntComponent(state,shunts[index]!,x[index+1]!);
  if(withSource) svg+=source(state,'Vin',x[0]!,'V');
  else svg+=`<text x="28" y="113" class="schematic-small">I →</text><text x="46" y="137" class="schematic-small">+</text><text x="558" y="256" class="schematic-small">−</text>`;
  return wrap(state,svg,note);
}
/** The feedback element connects a to the *output* of the ideal follower. */
function activeFilterSchematic(state:LabState,highPass:boolean):{html:string;note:string;schematic:boolean} {
  const input=70,a=225,b=380,out=535,load=630;
  const follower=item(state,'Follower');
  if(follower.type!=='VCVS') throw new Error('The matched active-filter preset requires a VCVS Follower.');
  const selected=state.document.circuit.observations.find(o=>o.id===state.output);
  const selectedNode=selected?.type==='voltage'&&selected.n==='0'?selected.p:'';
  const first=highPass?'C1':'R1',second=highPass?'C2':'R2';
  const groundShunt=highPass?'Rg':'Cg',feedback=highPass?'Rf':'Cf';
  let svg=node(input,'in',selectedNode==='in')+node(a,'a',selectedNode==='a')+
    node(b,'b',selectedNode==='b')+node(out,'out',selectedNode==='out');
  svg+=wire(input,120,123,120)+seriesComponent(state,first,123,172)+wire(172,120,a,120);
  svg+=wire(a,120,278,120)+seriesComponent(state,second,278,327)+wire(327,120,b,120);
  svg+=source(state,'Vin',input,'V')+shuntComponent(state,groundShunt,b);
  // Upper route deliberately passes above b; there is no connection at its crossing longitude.
  svg+=wire(a,120,a,55)+wire(a,55,345,55)+seriesComponent(state,feedback,345,405,55)+
    wire(405,55,out,55)+wire(out,55,out,120);
  // The follower label belongs left of its diamond, away from the RL value.
  svg+=source(state,'Follower',out,'VCVS',470,210)+wire(out,120,load,120)+branchResistor(state,'RL',load);
  // The dashed sensing lead starts at b, then reaches the VCVS control input.
  // It is not a conductive connection to the output branch.
  const outputVoltage=`V(${follower.p})−V(${follower.n})`;
  const controlVoltage=`V(${follower.cp})−V(${follower.cn})`;
  svg+=`<path class="control-wire" d="M${b} 145H475V184H508"/>`+
    `<text x="428" y="140" class="schematic-small">${escapeHtml(controlVoltage)}</text>`+
    `<text data-follower-law="equation" x="345" y="290" text-anchor="middle" class="schematic-small">${escapeHtml(outputVoltage)} = K·[${escapeHtml(controlVoltage)}]</text>`+
    `<text data-follower-law="gain" x="345" y="310" text-anchor="middle" class="schematic-small">${escapeHtml(t('followerGain',{gain:follower.gain}))}</text>`;
  svg+=dot(input,120)+dot(a,120)+dot(b,120)+dot(b,145)+dot(out,120)+dot(load,120);
  return wrap(state,svg,t(highPass?'schematicButterHigh':'schematicButterLow'),370);
}
function rlcMeasurementSchematic(state:LabState,notch:boolean):{html:string;note:string;schematic:boolean} {
  const r=notch?'Rn':'Rbp',l=notch?'Ln':'Lbp',c=notch?'Cn':'Cbp';
  // Marks sit beside their terminals. The ground mark stays above the badge.
  const marks:Record<string,{x:number;y:number}>={in:{x:90,y:143},a:{x:357,y:143},b:{x:602,y:143},'0':{x:620,y:246}};
  const selected=state.document.circuit.observations.find(o=>o.id===state.output);
  let svg=node(78,'in',false)+node(345,'a',false)+node(590,'b',false)+
    wire(78,120,184,120)+resistor(state,r,184,254)+wire(254,120,345,120)+
    wire(345,120,405,120)+seriesComponent(state,l,405,485)+wire(485,120,590,120)+
    source(state,'Vin',78,'V')+capacitor(state,c,590)+dot(78,120)+dot(345,120)+dot(590,120);
  if(selected?.type==='voltage') {
    const positive=marks[selected.p],negative=marks[selected.n];
    if(positive&&negative) svg+=`<text data-measurement-sign="positive" x="${positive.x}" y="${positive.y}" class="schematic-output">+</text>`+
      `<text data-measurement-sign="negative" x="${negative.x}" y="${negative.y}" class="schematic-output">−</text>`;
  } else if(selected?.type==='current'&&selected.component===l) {
    svg+=`<text x="414" y="152" class="schematic-output">I(a→b) →</text>`;
  }
  return wrap(state,svg,t(notch?'schematicRlcNotch':'schematicRlcBand'));
}
/** Four verified diode layouts share a source–R–output path; optional shunts
 * are explicitly wired from the output node to reference node 0. */
function diodeSchematic(state:LabState,preset:string,tangent?:NativeDocument):{html:string;note:string;schematic:boolean} {
  const devices=state.document.circuit.components.flatMap(c => c.type === 'Q'?[]:[c]);
  const drive=devices.find(c=>c.type==='V')!;
  const resistorDevice=devices.find(c=>c.type==='R')!;
  const diodes=devices.filter((c):c is Diode=>'model' in c);
  const capacitorDevice=devices.find(c=>c.type==='C');
  const selected=state.document.circuit.observations.find(o=>o.id===state.output);
  const selectedNode=selected?.type==='voltage'&&selected.n==='0'?selected.p:'';
  const inputNode=drive.p==='0'?drive.n:drive.p;
  let body=node(80,inputNode,selectedNode===inputNode)+node(500,'out',selectedNode==='out')+
    wire(80,120,210,120)+resistor(state,resistorDevice.id,210,330)+wire(330,120,500,120)+
    source(state,drive.id,80,'V')+dot(80,120)+dot(500,120);
  const branch=(diode:Diode,x:number):string=>{
    const cathodeAtBottom=diode.n==='0';
    const resistance=tangent?.circuit.components.find(c=>c.id===diode.id);
    const incremental=resistance&&resistance.type==='R';
    const symbol=incremental?`<rect class="symbol" x="${x-12}" y="170" width="24" height="48" rx="2"/>`:
      cathodeAtBottom
        ? `<path class="symbol" d="M${x-17} 174H${x+17}L${x} 195Z M${x-20} 199H${x+20}"/>`
        : `<path class="symbol" d="M${x-17} 202H${x+17}L${x} 181Z M${x-20} 177H${x+20}"/>`;
    const top=incremental?170:cathodeAtBottom?174:177;
    const bottom=incremental?218:cathodeAtBottom?199:202;
    const selectedComponent=state.selectedComponent===diode.id;
    const annotation=incremental?`rd=${number(resistance.value)} Ω`:
      cathodeAtBottom?'I ↓':'I ↑';
    const shownValue=incremental?annotation:valueLabel(diode);
    return wire(x,120,x,top)+`<g class="component${selectedComponent?' selected':''}" role="button" tabindex="0" data-schematic-component="${escapeHtml(diode.id)}" aria-label="${escapeHtml(t('selectComponent',{id:diode.id,type:incremental?'R':'D',value:shownValue}))}"><title>${escapeHtml(diode.id)}: ${escapeHtml(shownValue)}</title>${symbol}<text x="${x+27}" y="168" class="component-label">${escapeHtml(diode.id)}</text><text x="${x+27}" y="220" class="schematic-small">${escapeHtml(annotation)}</text></g>`+
      wire(x,bottom,x,256)+ground(x);
  };
  body+=branch(diodes[0]!,500);
  if(preset==='diode-pair')body+=wire(500,120,610,120)+dot(610,120)+branch(diodes[1]!,610);
  if((preset==='diode-rc'||preset==='diode-rc-step'||preset==='diode-rc-biased-sine')&&capacitorDevice)
    body+=wire(500,120,610,120)+dot(610,120)+capacitor(state,capacitorDevice.id,610);
  const drawnSource=tangent?.experiment.sources.find(s=>s.id===drive.id)??
    state.document.experiment.sources.find(s=>s.id===drive.id);
  if(drawnSource){
    const unit=drive.type==='I'?'A':'V';
    const ac=drawnSource.ac??{re:0,im:0};
    const waveform=drawnSource.waveform;
    const sourceText=tangent?`${t('diodeIncrementSource')} ${drive.id}: DC=${number(drawnSource.dc)} ${unit}`:
      waveform?.type==='step'?`${drive.id}: ${number(waveform.before)} → ${number(waveform.after)} ${unit} at ${number(waveform.at)} s`:
      waveform?.type==='sinusoid'?`${drive.id}: offset=${number(waveform.offset)} ${unit}; peak=${number(waveform.amplitudePeak)} ${unit}; f=${number(waveform.frequencyHz)} Hz`:
      waveform?.type==='constant'?`${drive.id}: constant=${number(waveform.value)} ${unit}`:
      `${drive.id}: DC=${number(drawnSource.dc)} ${unit}`;
    body+=`<text x="22" y="286" class="schematic-small">${escapeHtml(sourceText)}</text>`;
    if(tangent)body+=`<text x="22" y="304" class="schematic-small">AC=${number(ac.re)}${ac.im<0?'':'+'}${number(ac.im)}j ${unit} RMS</text>`;
  }
  const descriptions=diodes.map((diode,index)=>{
    const replacement=tangent?.circuit.components.find(c=>c.id===diode.id);
    const value=replacement?.type==='R'?`rd=${number(replacement.value)} Ω`:valueLabel(diode);
    return `<text x="22" y="${(tangent?330:310)+index*20}" class="schematic-small">${escapeHtml(diode.id)}: ${escapeHtml(value)}</text>`;
  }).join('');
  const incrementalOutput=selected?.type==='voltage'?`δV(${selected.p}) − δV(${selected.n})`:
    selected?.type==='current'?`δI(${selected.component})`:t('noOutputSelected');
  return wrap(state,body+descriptions,t(tangent?'diodeIncrementalDrawing':'diodeDrawing'),
    diodes.length>1?410:390,tangent?incrementalOutput:undefined);
}
/** Verified series rectifier: source → Rsource → anode D cathode → out,
 * with actual Rload and optional Cload shunts from out to reference 0. */
function rectifierSchematic(state:LabState):{html:string;note:string;schematic:boolean} {
  const devices=state.document.circuit.components;
  const drive=devices.find(c=>c.type==='V')!;
  const sourceResistor=devices.find(c=>c.type==='R'&&c.p==='in')!;
  const diode=devices.find((c):c is Diode=>c.type==='D')!;
  const load=devices.find(c=>c.type==='R'&&c.p==='out')!;
  const smoothing=devices.find(c=>c.type==='C');
  const selected=state.document.circuit.observations.find(o=>o.id===state.output);
  const outputSelected=selected?.type==='voltage'&&selected.p==='out'&&selected.n==='0';
  const diodeSymbol=`<path class="symbol" d="M355 104L383 120L355 136Z M391 101V139"/>`;
  const diodeGroup=group(state,diode.id,diodeSymbol,373,74);
  let body=node(80,'in',false)+node(305,'a',false)+node(500,'out',outputSelected)+
    dot(80,120)+source(state,drive.id,80,'V')+wire(80,120,170,120)+
    resistor(state,sourceResistor.id,170,260)+wire(260,120,305,120)+dot(305,120)+
    wire(305,120,355,120)+diodeGroup+wire(391,120,500,120)+dot(500,120)+
    branchResistor(state,load.id,500);
  if(smoothing) body+=wire(500,120,610,120)+dot(610,120)+capacitor(state,smoothing.id,610);
  const sourceValue=state.document.experiment.sources.find(s=>s.id===drive.id);
  const wave=sourceValue?.waveform;
  const waveLabel=wave?.type==='sinusoid'?`${drive.id}: offset=${number(wave.offset)} V; peak=${number(wave.amplitudePeak)} V; f=${number(wave.frequencyHz)} Hz`:
    sourceValue?`${drive.id}: DC=${number(sourceValue.dc)} V`:'';
  body+=`<text x="22" y="290" class="schematic-small">${escapeHtml(waveLabel)}</text>`+
    `<text x="22" y="310" class="schematic-small">${escapeHtml(diode.id)}: ${escapeHtml(valueLabel(diode))}; p=${escapeHtml('p' in diode ? diode.p : '')} → n=${escapeHtml('n' in diode ? diode.n : '')}</text>`;
  return wrap(state,body,t('diodeDrawing'),390);
}
export function diodeTangentSchematic(state:LabState,tangent:NativeDocument):{html:string;note:string;schematic:boolean}|null {
  const preset=matchingPreset(state.document.circuit)?.id;
  if(!preset?.startsWith('diode-'))return null;
  return diodeSchematic(state,preset,tangent);
}
export function schematic(state:LabState):{html:string;note:string;schematic:boolean} {
  if (state.document.circuit.schemaVersion===3) return bjtSchematic(state);
  // Preset identity alone survives value edits and imports. Confirm the actual
  // endpoint/ID topology before attaching a curated layout to a document.
  const preset=matchingPreset(state.document.circuit)?.id;
  const selected=state.document.circuit.observations.find(o=>o.id===state.output);
  const selectedNode=selected?.type==='voltage'&&selected.n==='0'?selected.p:'';
  const topology = topologyTable(state);
  const withTopology = (drawing:{html:string;note:string;schematic:boolean}) => ({
    ...drawing,
    html:`${drawing.html}<details class="schematic-topology"><summary>${t('topologyTable')}</summary>${topology}</details>`,
  });
  if(preset?.startsWith('diode-'))return withTopology(diodeSchematic(state,preset));
  if(preset==='half-wave-rectifier'||preset==='half-wave-rectifier-rc')
    return withTopology(rectifierSchematic(state));
  if(preset==='rc3-low-pass' || preset==='rc3-high-pass') {
    const low=preset==='rc3-low-pass';
    return withTopology(ladderSchematic(state,low?['R1','R2','R3']:['C1','C2','C3'],
      low?['C1','C2','C3']:['R1','R2','R3'],true,t(low?'schematicRc3Low':'schematicRc3High')));
  }
  if(preset==='rc-impedance-ladder' || preset==='rl-impedance-ladder') {
    const rc=preset==='rc-impedance-ladder';
    return withTopology(ladderSchematic(state,rc?['R1','R2','R3']:['L1','L2','L3'],
      rc?['C1','C2','C3']:['R1','R2','R3'],false,t(rc?'schematicRcLadder':'schematicRlLadder')));
  }
  if(preset==='butterworth2-low-pass' || preset==='butterworth2-high-pass')
    return withTopology(activeFilterSchematic(state,preset==='butterworth2-high-pass'));
  if(preset==='rlc-band-pass' || preset==='rlc-notch')
    return withTopology(rlcMeasurementSchematic(state,preset==='rlc-notch'));
  if(preset==='divider') {
    const svg=node(88,'in',selectedNode==='in')+node(467,'out',selectedNode==='out')+wire(88,120,218,120)+resistor(state,'R1',218,292)+wire(292,120,467,120)+dot(88,120)+dot(467,120)+source(state,'Vin',88,'V')+branchResistor(state,'R2',467);
    return withTopology(wrap(state,svg,t('schematicDivider')));
  }
  if(preset==='rc-high-pass') {
    const svg=node(88,'in',selectedNode==='in')+node(467,'out',selectedNode==='out')+wire(88,120,218,120)+capacitorHorizontal(state,'C',218,292)+wire(292,120,467,120)+dot(88,120)+dot(467,120)+source(state,'Vin',88,'V')+branchResistor(state,'R',467);
    return withTopology(wrap(state,svg,t('schematicHighpass')));
  }
  if (preset==='rc'||preset==='rc-loaded') {
    let svg=node(88,'in',selectedNode==='in')+node(467,'out',selectedNode==='out')+wire(88,120,218,120)+resistor(state,'R',218,292)+wire(292,120,467,120)+dot(88,120)+dot(467,120)+source(state,'Vin',88,'V')+capacitor(state,'C',467);
    if(preset==='rc-loaded')svg+=wire(467,120,585,120)+dot(585,120)+branchResistor(state,'RL',585);
    return withTopology(wrap(state,svg,preset==='rc-loaded'?t('schematicLoaded'):t('schematicRc')));
  }
  if(preset==='rc-cascade') {
    const svg=node(78,'in',selectedNode==='in')+node(348,'mid',selectedNode==='mid')+node(610,'out',selectedNode==='out')+
      wire(78,120,176,120)+resistor(state,'R1',176,246)+wire(246,120,433,120)+resistor(state,'R2',433,503)+wire(503,120,610,120)+
      dot(78,120)+dot(348,120)+dot(610,120)+source(state,'Vin',78,'V')+capacitor(state,'C1',348)+capacitor(state,'C2',610);
    return withTopology(wrap(state,svg,t('schematicCascade')));
  }
  if(preset==='rl') {
    const svg=node(88,'in',selectedNode==='in')+node(475,'out',selectedNode==='out')+wire(88,120,218,120)+resistor(state,'R',218,292)+wire(292,120,475,120)+dot(88,120)+dot(475,120)+source(state,'Vin',88,'V')+inductorVertical(state,'L',475);
    return withTopology(wrap(state,svg,t('schematicRl')));
  }
  if(preset==='rlc') {
    const svg=node(78,'in',selectedNode==='in')+node(350,'mid',selectedNode==='mid')+node(585,'out',selectedNode==='out')+wire(78,120,184,120)+resistor(state,'R',184,254)+wire(254,120,350,120)+wire(350,120,410,120)+inductorHorizontal(state,'L',410,485)+wire(485,120,585,120)+dot(78,120)+dot(350,120)+dot(585,120)+source(state,'Vin',78,'V')+capacitor(state,'C',585);
    return withTopology(wrap(state,svg,t('schematicRlc')));
  }
  if(preset==='vcvs') {
    const svg=node(84,'in',selectedNode==='in')+node(425,'out',selectedNode==='out')+dot(84,120)+dot(425,120)+dot(570,120)+source(state,'Vin',84,'V')+
      `<path class="control-wire" d="M128 120H345V155H388"/><text x="252" y="110" class="schematic-small">${t('controlDescription')}</text>`+
      source(state,'D',425,'VCVS')+wire(425,120,570,120)+branchResistor(state,'RL',570);
    return withTopology(wrap(state,svg,t('schematicVcvs')));
  }
  if (preset==='port-rc-section') {
    const svg=node(88,'in',selectedNode==='in')+node(467,'out',selectedNode==='out')+
      wire(88,120,218,120)+resistor(state,'R',218,292)+wire(292,120,467,120)+
      dot(88,120)+dot(467,120)+capacitor(state,'C',467);
    const drawing=withTopology(wrap(state,svg,t('schematicRc')));
    return {...drawing,html:`${drawing.html}<p class="soft-note">${t('guidePortMark')}</p>`};
  }
  if (preset==='port-rc-cascade') {
    const svg=node(78,'in',selectedNode==='in')+node(348,'mid',selectedNode==='mid')+node(610,'out',selectedNode==='out')+
      wire(78,120,176,120)+resistor(state,'R1',176,246)+wire(246,120,433,120)+
      resistor(state,'R2',433,503)+wire(503,120,610,120)+dot(78,120)+dot(348,120)+dot(610,120)+
      capacitor(state,'C1',348)+capacitor(state,'C2',610);
    const drawing=withTopology(wrap(state,svg,t('schematicCascade')));
    return {...drawing,html:`${drawing.html}<p class="soft-note">${t('guidePortMark')}</p>`};
  }
  const layouts:Record<string,Positions>={
    'res-series':{'0':{x:85,y:155},x:{x:340,y:155},out:{x:595,y:155}},
    'res-star':{'0':{x:340,y:270},a:{x:90,y:80},b:{x:590,y:80},x:{x:340,y:150}},
    'res-bridge':{'0':{x:340,y:280},a:{x:340,y:45},x:{x:100,y:160},y:{x:580,y:160}},
    'port-t':{'0':{x:340,y:270},in:{x:85,y:95},junction:{x:340,y:95},out:{x:595,y:95}},
  };
  if (preset && layouts[preset]) {
    const circuit=state.document.circuit;
    const network={nodes:circuit.nodes,edges:circuit.components.flatMap(c=>c.type==='R'?[{id:c.id,p:c.p,n:c.n,resistance:c.value}]:[])};
    const svg=resistorNetworkSvg(network,{positions:layouts[preset],retained:circuit.nodes.filter(id=>id!=='0'),
      selectedComponent:state.selectedComponent,label:t('diagramLabel'),selectable:true});
    if (!svg) return {schematic:false,note:t('unknownTopologyHint'),html:`<div class="unknown-layout"><h3>${t('unknownTopologyTitle')}</h3>${topology}</div>`};
    const observation=selected?.type==='voltage'?`V(${selected.p}) − V(${selected.n})`:selected?.type==='current'?`I(${selected.component})`:t('noOutputSelected');
    return {schematic:true,note:t('schematicNetworkNote'),html:`${svg}<p class="schematic-observation">${escapeHtml(observation)}</p>${preset==='port-t'?`<p class="soft-note">${t('guidePortMark')}</p>`:''}<details class="schematic-topology"><summary>${t('topologyTable')}</summary>${topology}</details>`};
  }
  return {schematic:false,note:t('unknownTopologyHint'),html:`<div class="unknown-layout"><h3>${t('unknownTopologyTitle')}</h3>${topology}</div>`};
}
function topologyTable(state:LabState):string {
  const nodes=state.document.circuit.nodes,components=state.document.circuit.components;
  return `<p class="muted small">${escapeHtml(t('nodesList',{nodes:nodes.map(n=>JSON.stringify(n)).join(', ')}))}</p><div class="table-wrap"><table class="result-table"><thead><tr><th>ID</th><th>Type</th><th>p</th><th>n</th><th>${t('parameter')}</th></tr></thead><tbody>${components.map(c=>`<tr><td>${escapeHtml(c.id)}</td><td>${escapeHtml(c.type)}</td><td>${escapeHtml('p' in c?c.p:c.c)}</td><td>${escapeHtml('n' in c?c.n:`b=${c.b}; e=${c.e}`)}</td><td>${escapeHtml(exactValueLabel(c))}</td></tr>`).join('')}</tbody></table></div>`;
}
