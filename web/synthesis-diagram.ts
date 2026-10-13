import type { SynthesisMethod,SynthesisResult } from './synthesis-state.js';
import { escapeHtml } from './schematic.js';
/** Bounded generator layouts. Every wire/symbol uses actual native endpoints;
 * no guessed native topology is drawn. Larger structures use the table. */
export function synthesisDiagram(result:SynthesisResult,method:SynthesisMethod):string|null {
  if(result.native.status!=='generated'||result.mathematical.status!=='certified')return null;
  const doc=result.native.document;
  const components=doc.circuit.components;
  if(components.length>6||components.some(c=>c.type!=='R'&&c.type!=='C'))return null;
  const e=escapeHtml;
  let content='';
  const wire=(x1:number,y1:number,x2:number,y2:number)=>`<path d="M${x1} ${y1}L${x2} ${y2}"/>`;
  // Offset labels beside vertical branches so node names do not sit on wires.
  const node=(id:string,x:number,y:number,labelOffset=0)=>`<circle cx="${x}" cy="${y}" r="4"/><text x="${x+labelOffset}" y="${y+24}">${e(id)}</text>`;
  const device=(index:number,x1:number,y1:number,x2:number,y2:number):string=>{
    const c=components[index]!;
    const length=Math.hypot(x2-x1,y2-y1),angle=Math.atan2(y2-y1,x2-x1)*180/Math.PI;
    const mid=length/2;
    const symbol=c.type==='R'?`<rect x="${mid-23}" y="-9" width="46" height="18"/>`:
      `<path d="M${mid-5} -17v34M${mid+5} -17v34"/>`;
    const half=c.type==='R'?23:5;
    return `<g data-syn-edge="${e(c.id)}" data-p="${e(c.p)}" data-n="${e(c.n)}"><g transform="translate(${x1},${y1}) rotate(${angle})">${wire(0,0,mid-half,0)}${symbol}${wire(mid+half,0,length,0)}</g><text x="${(x1+x2)/2+(x1===x2?42:0)}" y="${(y1+y2)/2-25}">${e(c.id)}</text></g>`;
  };
  let width=620,height=310;
  if(method==='cauer-infinity'){
    // Trace actual series-node advances. Ground shunts go to a connected
    // bottom bus, with no unrelated node beneath a horizontal component.
    let current='port',x=60;
    const positions=new Map<string,number>([['port',60]]);
    const assignments:{index:number;x1:number;x2:number;shunt:boolean}[]=[];
    for(let i=0;i<components.length;i++){
      const c=components[i]!;
      if(c.p!==current)return null;
      if(c.type==='C'||i===components.length-1){
        if(c.n!=='0')return null;
        assignments.push({index:i,x1:x,x2:x,shunt:true});
      }else{
        if(c.n==='0'||positions.has(c.n))return null;
        assignments.push({index:i,x1:x,x2:x+180,shunt:false});x+=180;current=c.n;positions.set(current,x);
      }
    }
    if(new Set(assignments.filter(a=>a.shunt).map(a=>a.x1)).size!==assignments.filter(a=>a.shunt).length)return null;
    width=Math.max(300,x+100);
    content+=wire(60,250,x,250)+node('0',60,250);
    for(const [id,px] of positions)content+=node(id,px,80,id==='port'?0:-24);
    for(const a of assignments)content+=device(a.index,a.x1,80,a.x2,a.shunt?250:80);
  }else{
    if(!('sections' in result.mathematical))return null;
    const sections=result.mathematical.sections;
    let offset=0;
    if(method==='foster-I'){
      width=sections.length*210+100;
      let current='port';
      for(let i=0;i<sections.length;i++){
        const section=sections[i]!,first=components[offset];if(!first||first.p!==current)return null;
        const x=50+i*210,next=x+210;
        content+=node(current,x,155,-24);
        if(section.elements.length===2){
          const second=components[offset+1];if(!second||second.p!==first.p||second.n!==first.n||first.type!=='R'||second.type!=='C')return null;
          content+=wire(x,95,x,215)+wire(next,95,next,215)+device(offset,x,95,next,95)+device(offset+1,x,215,next,215);
        }else content+=device(offset,x,155,next,155);
        current=first.n;offset+=section.elements.length;
      }
      if(current!=='0')return null;
      content+=node('0',width-50,155,24);
    }else{
      width=Math.max(300,sections.length*170+80);height=400;
      content+=wire(50,60,width-50,60)+wire(50,335,width-50,335)+node('port',50,60)+node('0',50,335);
      for(let i=0;i<sections.length;i++){
        const section=sections[i]!,first=components[offset];if(!first||first.p!=='port')return null;
        const x=90+i*170;
        if(section.elements.length===2){
          const second=components[offset+1];if(!second||first.n!==second.p||second.n!=='0'||first.type!=='R'||second.type!=='C')return null;
          content+=device(offset,x,60,x,195)+device(offset+1,x,195,x,335)+node(first.n,x,195,-24);
        }else{if(first.n!=='0')return null;content+=device(offset,x,60,x,335);}
        offset+=section.elements.length;
      }
    }
    if(offset!==components.length)return null;
  }
  return `<svg class="synthesis-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${e(method)}"><g>${content}</g></svg>`;
}
