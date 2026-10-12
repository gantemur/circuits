import { escapeHtml } from './schematic.js';
import { t } from './i18n.js';

export interface PlotPoint { x:number; y:number|null; status:string }
export interface PlotOverlay { label:string; points:PlotPoint[]; style:'dashed'|'dotted' }
export interface PlotMarker { label:string; x:number; y:number }
const finite=(x:number|null):x is number=>x!==null&&Number.isFinite(x);
const fmt=(v:number):string=>v===0?'0':(Math.abs(v)>=10000||Math.abs(v)<.001)?v.toExponential(1):Number(v.toPrecision(3)).toString();
/** SVG paths restart after every missing/failed point; axes state physical units. */
export function plot(points:PlotPoint[],options:{title:string;xLabel:string;yLabel:string;xLog?:boolean;color?:'teal'|'orange';
  overlays?:PlotOverlay[];markers?:PlotMarker[]}):string {
  const valid=points.filter(p=>finite(p.y)&&Number.isFinite(p.x)&&p.status==='ok');
  const overlayValid=(options.overlays??[]).flatMap(overlay=>overlay.points.filter(p=>finite(p.y)&&Number.isFinite(p.x)&&p.status==='ok'));
  const width=560,height=252,left=68,right=24,top=17,bottom=56;
  const xmin=Math.min(...points.map(p=>p.x)),xmax=Math.max(...points.map(p=>p.x));
  if(!valid.length||!Number.isFinite(xmin)||!Number.isFinite(xmax)||xmin===xmax)
    return `<div class="plot-card"><div class="plot-title">${escapeHtml(options.title)}</div><p class="warning">${t('noFiniteSamples')}</p></div>`;
  if (options.xLog && xmin <= 0)
    return `<div class="plot-card"><div class="plot-title">${escapeHtml(options.title)}</div><p class="warning">${t('noFiniteSamples')}</p></div>`;
  const xs=(x:number)=>options.xLog?Math.log10(x):x;
  const lo=xs(xmin),hi=xs(xmax);
  // Divide before subtracting. The physical interval [-1e308,+1e308]
  // is finite at both ends, although its direct binary64 width overflows.
  const xScale=Math.max(Math.abs(lo),Math.abs(hi)) || 1;
  const normalizedLo=lo/xScale, normalizedHi=hi/xScale;
  const xSpan=normalizedHi-normalizedLo;
  let ymin=Math.min(...[...valid,...overlayValid].map(p=>p.y!)),ymax=Math.max(...[...valid,...overlayValid].map(p=>p.y!));
  const yScale=Math.max(Math.abs(ymin),Math.abs(ymax)) || 1;
  let normalizedYMin=ymin/yScale, normalizedYMax=ymax/yScale;
  if(normalizedYMin===normalizedYMax){const span=Math.max(Math.abs(normalizedYMin)*.1,1e-9);normalizedYMin-=span;normalizedYMax+=span;}
  const pad=(normalizedYMax-normalizedYMin)*.08;
  normalizedYMin-=pad;normalizedYMax+=pad;
  const ySpan=normalizedYMax-normalizedYMin;
  if (![xSpan,ySpan].every(value=>Number.isFinite(value)&&value>0))
    return `<div class="plot-card"><div class="plot-title">${escapeHtml(options.title)}</div><p class="warning">${t('noFiniteSamples')}</p></div>`;
  const px=(x:number)=>left+((xs(x)/xScale-normalizedLo)/xSpan)*(width-left-right);
  const py=(y:number)=>top+((normalizedYMax-y/yScale)/ySpan)*(height-top-bottom);
  const plotUnavailable=()=>`<div class="plot-card"><div class="plot-title">${escapeHtml(options.title)}</div><p class="warning">${t('plotRangeUnavailable')}</p></div>`;
  const drawable=[...valid,...overlayValid,...(options.markers??[]).map(marker=>({x:marker.x,y:marker.y}))];
  if(drawable.some(point=>!Number.isFinite(px(point.x))||!Number.isFinite(py(point.y!)))||
      points.some(point=>Number.isFinite(point.x)&&!Number.isFinite(px(point.x)))) return plotUnavailable();
  const yTickValues=Array.from({length:5},(_,i)=>(normalizedYMax-i*ySpan/4)*yScale);
  const xTickValues=[0,.5,1].map(f=>{
    const normalizedTick=(1-f)*normalizedLo+f*normalizedHi;
    return options.xLog?10**(normalizedTick*xScale):normalizedTick*xScale;
  });
  if([...xTickValues,...yTickValues].some(value=>!Number.isFinite(value))) return plotUnavailable();
  let path='',open=false;
  for(const p of points){
    if(p.status!=='ok'||!finite(p.y)||!Number.isFinite(p.x)){open=false;continue;}
    path+=`${open?'L':'M'}${px(p.x).toFixed(2)} ${py(p.y).toFixed(2)} `;open=true;
  }
  const overlayPaths=(options.overlays??[]).map(overlay=>{
    let d='',open=false;
    for(const point of overlay.points){
      if(point.status!=='ok'||!finite(point.y)||!Number.isFinite(point.x)){open=false;continue;}
      d+=`${open?'L':'M'}${px(point.x).toFixed(2)} ${py(point.y).toFixed(2)} `;open=true;
    }
    return `<path class="plot-line overlay-${overlay.style}" fill="none" d="${d.trim()}"/>`;
  }).join('');
  const markers=(options.markers??[]).filter(marker=>Number.isFinite(marker.x)&&Number.isFinite(marker.y))
    .map(marker=>`<circle class="plot-marker" cx="${px(marker.x)}" cy="${py(marker.y)}" r="5"/><text class="plot-text" x="${px(marker.x)+8}" y="${py(marker.y)-8}">${escapeHtml(marker.label)}</text>`).join('');
  const legend=(options.overlays?.length||options.markers?.length)
    ? `<div class="legend"><span>${escapeHtml(options.title)} —</span>${(options.overlays??[]).map(overlay=>`<span class="overlay-${overlay.style}">${escapeHtml(overlay.label)}</span>`).join('')}${(options.markers??[]).map(marker=>`<span>● ${escapeHtml(marker.label)}</span>`).join('')}</div>` : '';
  const grid=Array.from({length:5},(_,i)=>{
    const y=top+i*(height-top-bottom)/4;
    const v=yTickValues[i]!;
    return `<path class="plot-gridline" fill="none" d="M${left} ${y}H${width-right}"/><text class="plot-text" x="${left-8}" y="${y+4}" text-anchor="end">${fmt(v)}</text>`;
  }).join('');
  const xTicks=[0,.5,1].map(f=>{const x=left+f*(width-left-right);
    const v=xTickValues[Math.round(f*2)]!;
    return `<path class="plot-gridline" fill="none" d="M${x} ${top}V${height-bottom}"/><text class="plot-text" x="${x}" y="${height-bottom+19}" text-anchor="middle">${fmt(v)}</text>`;}).join('');
  const failures=points.filter(p=>p.status!=='ok'&&p.status!=='zero-magnitude'&&Number.isFinite(p.x)).map(p=>{
    const x=px(p.x),y=top+8;return `<path class="plot-break" fill="none" d="M${x-3} ${y-3}l6 6m0-6l-6 6"/>`;}).join('');
  const zero=points.filter(p=>p.status==='zero-magnitude'&&Number.isFinite(p.x)).map(p=>{
    const x=px(p.x);return `<text class="plot-text schematic-output" x="${x}" y="${top+12}" text-anchor="middle">${t('zeroMarker')}</text>`;}).join('');
  const svg=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(t('plotAria',{title:options.title,x:options.xLabel,y:options.yLabel}))}"><rect width="${width}" height="${height}" fill="#fbfcfa"/>${grid}${xTicks}<path class="plot-axis" fill="none" d="M${left} ${top}V${height-bottom}H${width-right}"/><path class="plot-line ${options.color==='orange'?'orange':''}" d="${path.trim()}"/>${overlayPaths}${markers}${failures}${zero}<text class="plot-text" x="${(left+width-right)/2}" y="${height-7}" text-anchor="middle">${escapeHtml(options.xLabel)}</text><text class="plot-text" transform="translate(15 ${(top+height-bottom)/2}) rotate(-90)" text-anchor="middle">${escapeHtml(options.yLabel)}</text></svg>`;
  return `<div class="plot-card"><div class="plot-title">${escapeHtml(options.title)}</div>${svg}${legend}</div>`;
}
