import type { Component } from '../src/model.js';
import type { LabState } from './lab.js';
import { t } from './i18n.js';

export const escapeHtml = (value: unknown): string => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const number = (value: number): string => value !== 0 && (Math.abs(value) < .01 || Math.abs(value) >= 1e5)
  ? value.toExponential(3) : Number(value.toPrecision(5)).toString();
function item(state: LabState, id: string): Component { return state.document.circuit.components.find(c => c.id === id)!; }
function valueLabel(c: Component): string {
  if ('value' in c) return `${number(c.value)} ${c.type === 'R' ? 'Ω' : c.type === 'C' ? 'F' : 'H'}`;
  if ('gain' in c) return `${number(c.gain)} ${c.type === 'VCCS' ? 'S' : c.type === 'CCVS' ? 'Ω' : ''}`.trim();
  return c.type === 'V' ? t('valueSource') : t('currentSource');
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
function branchResistor(state:LabState,id:string,x:number):string {
  return wire(x,120,x,165)+group(state,id,`<rect class="symbol" x="${x-11}" y="165" width="22" height="48" rx="2"/>`,x,158)+wire(x,213,x,256)+ground(x);
}
function capacitor(state:LabState,id:string,x:number):string {
  return wire(x,120,x,173)+group(state,id,`<path class="symbol" d="M${x-22} 183h44M${x-22} 195h44"/>`,x,160)+wire(x,195,x,256)+ground(x);
}
function capacitorHorizontal(state:LabState,id:string,x1:number,x2:number):string {
  const x=(x1+x2)/2;
  return wire(x1,120,x-7,120)+group(state,id,`<path class="symbol" d="M${x-7} 98v44M${x+7} 98v44"/>`,x,75)+wire(x+7,120,x2,120);
}
function inductorVertical(state:LabState,id:string,x:number):string {
  return wire(x,120,x,160)+group(state,id,`<path class="symbol" d="M${x} 160c-24 0-24 15 0 15c-24 0-24 15 0 15c-24 0-24 15 0 15c-24 0-24 15 0 15"/>`,x,150)+wire(x,220,x,256)+ground(x);
}
function inductorHorizontal(state:LabState,id:string,x1:number,x2:number):string {
  const x=(x1+x2)/2;
  return group(state,id,`<path class="symbol" d="M${x1} 120c0-25 15-25 15 0c0-25 15-25 15 0c0-25 15-25 15 0c0-25 15-25 15 0"/>`,x,75)+wire(x1+60,120,x2,120);
}
function source(state:LabState,id:string,x:number,kind:'V'|'VCVS'):string {
  const shape=kind==='V'?`<circle class="symbol" cx="${x}" cy="184" r="25"/><path class="wire" d="M${x-8} 176h16m-8-8v16M${x-8} 194h16"/>`:
    `<path class="symbol" d="M${x} 151l27 33l-27 33l-27-33Z"/><text x="${x}" y="189" text-anchor="middle" class="schematic-label">μ</text>`;
  return wire(x,120,x,151)+group(state,id,shape,x+58,175)+wire(x,217,x,256)+ground(x);
}
function wrap(state:LabState,body:string,note:string):{html:string;note:string;schematic:boolean} {
  const selected=state.document.circuit.observations.find(o=>o.id===state.output);
  const description=selected?.type==='voltage'?`V(${selected.p}) − V(${selected.n})`:
    selected?.type==='current'?`I(${selected.component})`:t('noOutputSelected');
  const html=`<svg viewBox="0 0 690 305" role="img" aria-label="${t('diagramLabel')}"><rect width="690" height="305" fill="#fafcf9"/><text x="22" y="29" class="schematic-small">${t('terminalOrientation')}</text>${body}<rect x="330" y="275" width="340" height="25" rx="6" fill="#fff0e8"/><text x="500" y="292" text-anchor="middle" class="schematic-small schematic-output">${escapeHtml(t('outputBadge',{output:description}))}</text></svg>`;
  return { html, note, schematic:true };
}
export function schematic(state:LabState):{html:string;note:string;schematic:boolean} {
  const preset=state.presetId, selected=state.document.circuit.observations.find(o=>o.id===state.output);
  const selectedNode=selected?.type==='voltage'&&selected.n==='0'?selected.p:'';
  if(preset==='divider') {
    const svg=node(88,'in',selectedNode==='in')+node(467,'out',selectedNode==='out')+wire(88,120,218,120)+resistor(state,'R1',218,292)+wire(292,120,467,120)+dot(88,120)+dot(467,120)+source(state,'Vin',88,'V')+branchResistor(state,'R2',467);
    return wrap(state,svg,t('schematicDivider'));
  }
  if(preset==='rc-high-pass') {
    const svg=node(88,'in',selectedNode==='in')+node(467,'out',selectedNode==='out')+wire(88,120,218,120)+capacitorHorizontal(state,'C',218,292)+wire(292,120,467,120)+dot(88,120)+dot(467,120)+source(state,'Vin',88,'V')+branchResistor(state,'R',467);
    return wrap(state,svg,t('schematicHighpass'));
  }
  if (preset==='rc'||preset==='rc-loaded') {
    let svg=node(88,'in',selectedNode==='in')+node(467,'out',selectedNode==='out')+wire(88,120,218,120)+resistor(state,'R',218,292)+wire(292,120,467,120)+dot(88,120)+dot(467,120)+source(state,'Vin',88,'V')+capacitor(state,'C',467);
    if(preset==='rc-loaded')svg+=wire(467,120,585,120)+dot(585,120)+branchResistor(state,'RL',585);
    return wrap(state,svg,preset==='rc-loaded'?t('schematicLoaded'):t('schematicRc'));
  }
  if(preset==='rc-cascade') {
    const svg=node(78,'in',selectedNode==='in')+node(348,'mid',selectedNode==='mid')+node(610,'out',selectedNode==='out')+
      wire(78,120,176,120)+resistor(state,'R1',176,246)+wire(246,120,433,120)+resistor(state,'R2',433,503)+wire(503,120,610,120)+
      dot(78,120)+dot(348,120)+dot(610,120)+source(state,'Vin',78,'V')+capacitor(state,'C1',348)+capacitor(state,'C2',610);
    return wrap(state,svg,t('schematicCascade'));
  }
  if(preset==='rl') {
    const svg=node(88,'in',selectedNode==='in')+node(475,'out',selectedNode==='out')+wire(88,120,218,120)+resistor(state,'R',218,292)+wire(292,120,475,120)+dot(88,120)+dot(475,120)+source(state,'Vin',88,'V')+inductorVertical(state,'L',475);
    return wrap(state,svg,t('schematicRl'));
  }
  if(preset==='rlc') {
    const svg=node(78,'in',selectedNode==='in')+node(350,'mid',selectedNode==='mid')+node(585,'out',selectedNode==='out')+wire(78,120,184,120)+resistor(state,'R',184,254)+wire(254,120,350,120)+wire(350,120,410,120)+inductorHorizontal(state,'L',410,485)+wire(485,120,585,120)+dot(78,120)+dot(350,120)+dot(585,120)+source(state,'Vin',78,'V')+capacitor(state,'C',585);
    return wrap(state,svg,t('schematicRlc'));
  }
  if(preset==='vcvs') {
    const svg=node(84,'in',selectedNode==='in')+node(425,'out',selectedNode==='out')+dot(84,120)+dot(425,120)+dot(570,120)+source(state,'Vin',84,'V')+
      `<path class="control-wire" d="M128 120H345V155H388"/><text x="252" y="110" class="schematic-small">${t('controlDescription')}</text>`+
      source(state,'D',425,'VCVS')+wire(425,120,570,120)+branchResistor(state,'RL',570);
    return wrap(state,svg,t('schematicVcvs'));
  }
  const nodes=state.document.circuit.nodes,components=state.document.circuit.components;
  return {schematic:false,note:t('unknownTopologyHint'),
    html:`<div class="unknown-layout"><h3>${t('unknownTopologyTitle')}</h3><p class="muted small">${escapeHtml(t('nodesList',{nodes:nodes.join(', ')}))}</p><div class="table-wrap"><table class="result-table"><thead><tr><th>ID</th><th>Type</th><th>p</th><th>n</th><th>${t('parameter')}</th></tr></thead><tbody>${components.map(c=>`<tr><td>${escapeHtml(c.id)}</td><td>${escapeHtml(c.type)}</td><td>${escapeHtml(c.p)}</td><td>${escapeHtml(c.n)}</td><td>${escapeHtml(valueLabel(c))}</td></tr>`).join('')}</tbody></table></div></div>`};
}
