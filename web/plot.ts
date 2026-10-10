import { escapeHtml } from './schematic.js';
import { t } from './i18n.js';

export interface PlotPoint { x:number; y:number|null; status:string }
const finite=(x:number|null):x is number=>x!==null&&Number.isFinite(x);
const fmt=(v:number):string=>v===0?'0':(Math.abs(v)>=10000||Math.abs(v)<.001)?v.toExponential(1):Number(v.toPrecision(3)).toString();
/** SVG paths restart after every missing/failed point; axes state physical units. */
export function plot(points:PlotPoint[],options:{title:string;xLabel:string;yLabel:string;xLog?:boolean;color?:'teal'|'orange'}):string {
  const valid=points.filter(p=>finite(p.y)&&Number.isFinite(p.x)&&p.status==='ok');
  const width=560,height=252,left=68,right=24,top=17,bottom=56;
  const xmin=Math.min(...points.map(p=>p.x)),xmax=Math.max(...points.map(p=>p.x));
  if(!valid.length||!Number.isFinite(xmin)||!Number.isFinite(xmax)||xmin===xmax)
    return `<div class="plot-card"><div class="plot-title">${escapeHtml(options.title)}</div><p class="warning">${t('noFiniteSamples')}</p></div>`;
  const xs=(x:number)=>options.xLog?Math.log10(x):x;
  const lo=xs(xmin),hi=xs(xmax);
  let ymin=Math.min(...valid.map(p=>p.y!)),ymax=Math.max(...valid.map(p=>p.y!));
  if(ymin===ymax){const span=Math.max(Math.abs(ymin)*.1,1e-9);ymin-=span;ymax+=span;}
  const pad=(ymax-ymin)*.08;ymin-=pad;ymax+=pad;
  const px=(x:number)=>left+(xs(x)-lo)/(hi-lo)*(width-left-right);
  const py=(y:number)=>top+(ymax-y)/(ymax-ymin)*(height-top-bottom);
  let path='',open=false;
  for(const p of points){
    if(p.status!=='ok'||!finite(p.y)){open=false;continue;}
    path+=`${open?'L':'M'}${px(p.x).toFixed(2)} ${py(p.y).toFixed(2)} `;open=true;
  }
  const grid=Array.from({length:5},(_,i)=>{
    const y=top+i*(height-top-bottom)/4,v=ymax-i*(ymax-ymin)/4;
    return `<path class="plot-gridline" d="M${left} ${y}H${width-right}"/><text class="plot-text" x="${left-8}" y="${y+4}" text-anchor="end">${fmt(v)}</text>`;
  }).join('');
  const xTicks=[0,.5,1].map(f=>{const x=left+f*(width-left-right),v=options.xLog?10**(lo+f*(hi-lo)):xmin+f*(xmax-xmin);
    return `<path class="plot-gridline" d="M${x} ${top}V${height-bottom}"/><text class="plot-text" x="${x}" y="${height-bottom+19}" text-anchor="middle">${fmt(v)}</text>`;}).join('');
  const failures=points.filter(p=>p.status!=='ok'&&p.status!=='zero-magnitude').map(p=>{
    const x=px(p.x),y=top+8;return `<path class="plot-break" d="M${x-3} ${y-3}l6 6m0-6l-6 6"/>`;}).join('');
  const zero=points.filter(p=>p.status==='zero-magnitude').map(p=>{
    const x=px(p.x);return `<text class="plot-text schematic-output" x="${x}" y="${top+12}" text-anchor="middle">${t('zeroMarker')}</text>`;}).join('');
  const svg=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(t('plotAria',{title:options.title,x:options.xLabel,y:options.yLabel}))}"><rect width="${width}" height="${height}" fill="#fbfcfa"/>${grid}${xTicks}<path class="plot-axis" d="M${left} ${top}V${height-bottom}H${width-right}"/><path class="plot-line ${options.color==='orange'?'orange':''}" d="${path.trim()}"/>${failures}${zero}<text class="plot-text" x="${(left+width-right)/2}" y="${height-7}" text-anchor="middle">${escapeHtml(options.xLabel)}</text><text class="plot-text" transform="translate(15 ${(top+height-bottom)/2}) rotate(-90)" text-anchor="middle">${escapeHtml(options.yLabel)}</text></svg>`;
  return `<div class="plot-card"><div class="plot-title">${escapeHtml(options.title)}</div>${svg}</div>`;
}
