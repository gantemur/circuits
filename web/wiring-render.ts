import { escapeHtml } from './schematic.js';
import { netNames, vertexPoint, wirePoints, type Point, type WiringGraph } from './wiring-graph.js';
import { wt } from './wiring-copy.js';
import type { WiringSelection } from './wiring-interaction.js';
const e = (value: string | number) => escapeHtml(String(value));
export interface ViewBox { x:number; y:number; width:number; height:number }
export function fitWiring(graph: WiringGraph): ViewBox {
  const points = [...graph.vertices.map(vertex=>vertexPoint(graph,vertex.key)), ...graph.routes.flatMap(route=>route.bends)];
  const xs=points.map(point=>point.x),ys=points.map(point=>point.y);
  const x=Math.min(0,...xs)-90,y=Math.min(0,...ys)-90;
  return {x,y,width:Math.max(600,Math.max(0,...xs)-x+90),height:Math.max(360,Math.max(0,...ys)-y+90)};
}
function segments(graph: WiringGraph) {
  return graph.edges.flatMap(edge=>{const points=wirePoints(graph,edge.key);return points.slice(1).map((b,index)=>({edge,a:points[index]!,b,index}));});
}
/** Conservative drawing-quality check, never an electrical connectivity test.
 * Axis-aligned boxes deliberately warn for some safe diagonal arrangements.
 * A shared endpoint exempts only the endpoint itself, not overlapping routes. */
export function ambiguousWiring(graph: WiringGraph): boolean {
  const lines = segments(graph);
  const overlap = (a:number,b:number,c:number,d:number) =>
    Math.max(Math.min(a,b),Math.min(c,d)) <= Math.min(Math.max(a,b),Math.max(c,d));
  const boxesOverlap = (a:Point,b:Point,c:Point,d:Point) =>
    overlap(a.x,b.x,c.x,d.x) && overlap(a.y,b.y,c.y,d.y);
  const equal = (a:Point,b:Point) => a.x===b.x && a.y===b.y;
  // Trim only a shared endpoint's visible dot. Collinear wires that overlap
  // farther from that dot remain ambiguous even when electrically connected.
  const trim = (point:Point,other:Point):Point => {
    const length = Math.hypot(other.x-point.x,other.y-point.y);
    const fraction = Math.min(.49, 8/Math.max(length,1));
    return {x:point.x+(other.x-point.x)*fraction,y:point.y+(other.y-point.y)*fraction};
  };
  for (let i=0;i<lines.length;i++) {
    const line = lines[i]!;
    for (const placement of graph.placements) {
      if (boxesOverlap(line.a,line.b,
        {x:placement.x-20,y:placement.y-20},{x:placement.x+20,y:placement.y+20})) return true;
    }
    for (const vertex of graph.vertices) {
      if (vertex.key===line.edge.a || vertex.key===line.edge.b) continue;
      const point = vertexPoint(graph,vertex.key);
      // A dot on another wire could falsely imply a junction. Conservative
      // boxes also catch obscured terminals near diagonal routes.
      if (boxesOverlap(line.a,line.b,{x:point.x-6,y:point.y-6},{x:point.x+6,y:point.y+6})) return true;
    }
    for (const other of lines.slice(i+1)) {
      if (line.edge.key===other.edge.key) continue;
      let a=line.a,b=line.b,c=other.a,d=other.b;
      const shared = [line.edge.a,line.edge.b].find(v=>v===other.edge.a||v===other.edge.b);
      if (shared) {
        const point=vertexPoint(graph,shared);
        if(equal(a,point)) a=trim(a,b);
        if(equal(b,point)) b=trim(b,a);
        if(equal(c,point)) c=trim(c,d);
        if(equal(d,point)) d=trim(d,c);
      }
      if (boxesOverlap(a,b,c,d)) return true;
    }
  }
  for (let i=0;i<graph.placements.length;i++) {
    const placement=graph.placements[i]!;
    for (const other of graph.placements.slice(i+1)) {
      if (Math.abs(placement.x-other.x)<65 && Math.abs(placement.y-other.y)<65) return true;
    }
    for (const vertex of graph.vertices) {
      if (vertex.kind==='terminal' && vertex.device===placement.key) continue;
      const point=vertexPoint(graph,vertex.key);
      if(Math.abs(point.x-placement.x)<26 && Math.abs(point.y-placement.y)<26) return true;
    }
  }
  return false;
}
function symbol(type:string):string {
  if(type==='R')return '<path d="M-30 0H-20M20 0H30"/><rect x="-20" y="-8" width="40" height="16"/>';
  if(type==='C')return '<path d="M-30 0H-5M5 0H30M-5 -17V17M5 -17V17"/>';
  if(type==='L')return '<path d="M-30 0H-20 C-20 -18,-10 -18,-10 0 C-10 -18,0 -18,0 0 C0 -18,10 -18,10 0 C10 -18,20 -18,20 0 H30"/>';
  const law=type==='V'?'<path d="M-11 0H-3M-7 -4V4M5 0H12"/>':'<path d="M-10 0H10M5 -5L10 0 5 5"/>';
  return `<path d="M-30 0H-17M17 0H30"/><circle r="17"/>${law}`;
}
export function renderWiringSvg(graph:WiringGraph,selection:WiringSelection,view:ViewBox,gesture:{start:string;bends:Point[]}|null):string {
  const names=netNames(graph);
  const wires=segments(graph).map(({edge,a,b,index})=>`<g data-w-edge="${edge.key}" data-w-segment="${index}" tabindex="0" role="button" aria-label="${e(wt('wire'))} ${edge.key} ${e(wt('segment'))} ${index}"><path class="wire-hit" d="M${a.x} ${a.y}L${b.x} ${b.y}"/><path class="wire-line ${selection?.kind==='edge'&&selection.key===edge.key?'selected':''}" d="M${a.x} ${a.y}L${b.x} ${b.y}"/></g>`).join('');
  const devices=graph.devices.map(device=>{
    const placement=graph.placements.find(p=>p.key===device.key)!;
    return `<g data-w-device="${device.key}" tabindex="0" role="button" aria-label="${e(wt('device'))} ${e(device.id)}" class="w-device ${selection?.kind==='device'&&selection.key===device.key?'selected':''}"><title>${e(device.id)} ${e(device.label??'')}</title><g transform="translate(${placement.x} ${placement.y}) rotate(${placement.turns*90})"><rect class="device-hit" x="-25" y="-24" width="50" height="48"/>${symbol(device.type)}</g><text x="${placement.x}" y="${placement.y+48}" text-anchor="middle">${e(device.id.length>18?device.id.slice(0,15)+'…':device.id)} · ${e(device.value??device.type)}</text></g>`;
  }).join('');
  const vertices=graph.vertices.map(vertex=>{
    const p=vertexPoint(graph,vertex.key),pending=vertex.kind==='terminal'&&vertex.completion==='pending';
    const status=vertex.kind==='terminal'?wt(vertex.completion==='open'?'intentionallyOpen':vertex.completion):wt(vertex.kind);
    const label=vertex.kind==='terminal'?`${graph.devices.find(d=>d.key===vertex.device)!.id}.${vertex.role}`:names.get(vertex.key)!;
    const isNameAnchor=graph.names.some(anchor=>anchor.vertex===vertex.key);
    const terminalText=vertex.kind==='terminal'?vertex.role+(pending?' ?':'')+(isNameAnchor?' · '+names.get(vertex.key):''):'';
    const ground=vertex.key===graph.reference?`<path d="M${p.x} ${p.y+6}v10m-12 0h24m-19 5h14m-10 5h6"/>`:'';
    return `<g data-w-vertex="${vertex.key}" tabindex="0" role="button" aria-label="${e(label)} · ${e(status)}" class="w-vertex ${pending?'pending':''} ${selection?.kind==='vertex'&&selection.key===vertex.key?'selected':''}"><circle class="vertex-hit" cx="${p.x}" cy="${p.y}" r="13"/><circle cx="${p.x}" cy="${p.y}" r="${vertex.kind==='terminal'?6:4}"/>${ground}<text x="${p.x+9}" y="${p.y-10}">${e(vertex.kind==='terminal'?terminalText:label.length>16?label.slice(0,13)+'…':label)}</text><title>${e(label)} · ${e(names.get(vertex.key)!)} · ${e(status)}</title></g>`;
  }).join('');
  const draft=gesture?`<polyline class="wire-pending" points="${[vertexPoint(graph,gesture.start),...gesture.bends].map(p=>`${p.x},${p.y}`).join(' ')}"/>`:'';
  return `<svg id="w-canvas" xmlns="http://www.w3.org/2000/svg" viewBox="${view.x} ${view.y} ${view.width} ${view.height}" aria-label="${e(wt('title'))}" role="group">${wires}${devices}${vertices}${draft}</svg>`;
}
export function wiringTopology(graph:WiringGraph):string {
  const names=netNames(graph);
  return `<div class="table-scroll"><table><thead><tr><th>${e(wt('device'))}</th><th>p</th><th>n</th><th>${e(wt('value'))}</th></tr></thead><tbody>${graph.devices.map(device=>`<tr><th>${e(device.id)} · ${device.type}</th>${device.terminals.map(t=>`<td>${e(names.get(t.vertex)!)} · ${e(wt((graph.vertices.find(v=>v.key===t.vertex) as {completion:'open'|'pending'|'connected'}).completion==='open'?'intentionallyOpen':(graph.vertices.find(v=>v.key===t.vertex) as {completion:'pending'|'connected'}).completion))}</td>`).join('')}<td>${e(device.value??'—')}</td></tr>`).join('')}</tbody></table></div><p class="small">${e(wt('tableHint'))}</p>`;
}
