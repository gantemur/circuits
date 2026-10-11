import { kronReduce, resistorLaplacian, type ResistorEdge, type ResistorNetwork } from './kron.js';
import { solveReal, type Matrix } from './numeric.js';
import { parseDocument, serializeDocument, type NativeDocument } from './model.js';

export type ResistorOperation = 'parallel' | 'series' | 'star-delta' | 'delta-star' | 'star-mesh' | 'kron';
export interface ResistorSelection { operation: ResistorOperation; edges?: string[]; center?: string }
export interface ResistorCandidate { key: string; label: string; selection: ResistorSelection }
export interface ResistorCheck { maxMatrixDifference: number; maxCurrentDifference: number; maxPowerDifference: number;
  matrixLimit: number; currentLimit: number; powerLimit: number; vectors: number }
export type ResistorTransformResult = { status: 'ok'; retained: string[]; original: ResistorNetwork;
  transformed: ResistorNetwork; eliminated: string[]; introduced: string[]; removed: string[];
  generated: ResistorEdge[]; originalResponse: Matrix; transformedResponse: Matrix;
  check: ResistorCheck; explanation: string; document: NativeDocument; json: string } |
  { status: 'unsupported' | 'invalid-selection' | 'disconnected' | 'numeric-failure' | 'not-equivalent'; code: string; detail: string };
type Failure = Extract<ResistorTransformResult, { code: string }>;
const fail = (status: Failure['status'], code: string, detail: string): Failure => ({ status, code, detail });
const finite = (n: number): boolean => Number.isFinite(n);
const sameEnds = (a: ResistorEdge, b: ResistorEdge): boolean =>
  (a.p === b.p && a.n === b.n) || (a.p === b.n && a.n === b.p);
const other = (e: ResistorEdge, node: string): string => e.p === node ? e.n : e.p;
const uniqueId = (used: Set<string>, prefix: string): string => {
  let id = prefix, index = 2;
  while (used.has(id)) id = `${prefix}_${index++}`;
  used.add(id); return id;
};
function conductance(r: number): number {
  const g = 1 / r;
  if (!finite(g) || g === 0) throw new RangeError('Conductance is outside representable positive range');
  return g;
}
function resistance(g: number): number {
  const r = 1 / g;
  if (!finite(g) || g <= 0 || !finite(r) || r <= 0 || conductance(r) === 0)
    throw new RangeError('Generated resistor is outside representable positive range');
  return r;
}
const edgeIds = (edges: ResistorEdge[]): Set<string> => new Set(edges.map(e => e.id));
const copyNetwork = (n: ResistorNetwork): ResistorNetwork => ({ nodes: [...n.nodes], edges: n.edges.map(e => ({ ...e })) });

/** Conservative, topology-only choices; the kernel still validates every requested selection. */
export function resistorCandidates(network: ResistorNetwork, retained: string[]): ResistorCandidate[] {
  const choices: ResistorCandidate[] = [{ key: 'kron', label: 'Kron · all internal nodes', selection: { operation: 'kron' } }];
  const edges = network.edges, retainedSet = new Set(retained);
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const a = edges[i]!, b = edges[j]!;
    if (sameEnds(a, b)) choices.push({ key: `parallel:${a.id}:${b.id}`, label: `Parallel · ${a.id}, ${b.id}`, selection: { operation: 'parallel', edges: [a.id, b.id] } });
  }
  for (const center of network.nodes.filter(n => n !== '0' && !retainedSet.has(n))) {
    const incident = edges.filter(e => e.p === center || e.n === center);
    const neighbors = new Set(incident.map(e => other(e, center)));
    if (incident.length === 2 && neighbors.size === 2)
      choices.push({ key: `series:${center}`, label: `Series · ${incident.map(e => e.id).join(', ')} via ${center}`, selection: { operation: 'series', edges: incident.map(e => e.id) } });
    if (neighbors.size >= 2) choices.push({ key: `mesh:${center}`, label: `Star–mesh · ${center}`, selection: { operation: 'star-mesh', center } });
    if (incident.length === 3 && neighbors.size === 3)
      choices.push({ key: `star:${center}`, label: `Star→delta · ${center}`, selection: { operation: 'star-delta', center } });
  }
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) for (let k = j + 1; k < edges.length; k++) {
    const triangle = [edges[i]!,edges[j]!,edges[k]!];
    const nodes = new Set(triangle.flatMap(e => [e.p,e.n]));
    if (nodes.size === 3 && [...nodes].every(n => triangle.filter(e => e.p === n || e.n === n).length === 2))
      choices.push({ key: `delta:${triangle.map(e => e.id).join(':')}`, label: `Delta→star · ${triangle.map(e => e.id).join(', ')}`, selection: { operation: 'delta-star', edges: triangle.map(e => e.id) } });
  }
  return choices;
}

/** Check that every connected component has a retained node; no hidden island may disappear. */
function connectedToBoundary(network: ResistorNetwork, retained: string[]): boolean {
  const seen = new Set(retained), queue = [...retained];
  for (let head = 0; head < queue.length; head++) for (const e of network.edges) {
    const next = e.p === queue[head] ? e.n : e.n === queue[head] ? e.p : null;
    if (next !== null && !seen.has(next)) { seen.add(next); queue.push(next); }
  }
  return network.nodes.every(n => seen.has(n));
}
function response(network: ResistorNetwork, retained: string[]): Matrix | Failure {
  if (!connectedToBoundary(network, retained)) return fail('disconnected','internal-island','Every connected component must meet a retained terminal.');
  const result = kronReduce(network, retained);
  if (result.status !== 'ok') return fail('numeric-failure','solve',result.message);
  // A positive path whose interior is eliminated creates a strictly positive
  // coupling. A computed zero there would silently discard a weak branch.
  const hidden=new Set(network.nodes.filter(n=>!retained.includes(n)));
  for(let i=0;i<retained.length;i++)for(let j=i+1;j<retained.length;j++){
    const target=retained[j]!,seen=new Set([retained[i]!]),queue=[retained[i]!];
    for(let head=0;head<queue.length;head++)for(const edge of network.edges){
      const next=edge.p===queue[head]?edge.n:edge.n===queue[head]?edge.p:null;
      if(next!==null&&!seen.has(next)&&(hidden.has(next)||next===target)){seen.add(next);queue.push(next);}
    }
    if(seen.has(target)&&result.reduced[i]![j]===0)
      return fail('numeric-failure','underflow','A positive terminal coupling rounded to zero.');
  }
  return result.reduced;
}
function isFailure(v: Matrix | Failure): v is Failure { return !Array.isArray(v); }

function checkResponse(a: ResistorNetwork, b: ResistorNetwork, retained: string[], original: Matrix, changed: Matrix): ResistorCheck | Failure {
  const n = retained.length, matrixLimit = 1e-12, currentLimit = 1e-12, powerLimit = 1e-12;
  let maxMatrixDifference = 0, maxCurrentDifference = 0, maxPowerDifference = 0;
  for (const m of [original, changed]) for (let i = 0; i < n; i++) {
    const row = m[i]!;
    if (row.some(v => !finite(v)) || !finite(row.reduce((s,v)=>s+v,0))) return fail('numeric-failure','nonfinite','Nonfinite response matrix.');
    const rowScale = row.reduce((s,v)=>s+Math.abs(v),0);
    if (!finite(rowScale)) return fail('numeric-failure','nonfinite','Response norm exceeds numeric range.');
    if (Math.abs(row.reduce((s,v)=>s+v,0)) > matrixLimit + 1e-8*rowScale)
      return fail('numeric-failure','row-sum','Response does not have zero row sums.');
    for (let j=0;j<n;j++) {
      if (Math.abs(row[j]! - m[j]![i]!) > matrixLimit + 1e-8*Math.max(Math.abs(row[j]!),Math.abs(m[j]![i]!)))
        return fail('numeric-failure','symmetry','Response is not symmetric.');
      if (i!==j && row[j]! > 0) return fail('numeric-failure','positive-offdiagonal','A passive response has a positive off-diagonal.');
    }
  }
  for (let i=0;i<n;i++) for (let j=0;j<n;j++) {
    const diff=Math.abs(original[i]![j]! - changed[i]![j]!);
    if (!finite(diff)) return fail('numeric-failure','nonfinite','Matrix difference exceeds numeric range.');
    maxMatrixDifference=Math.max(maxMatrixDifference,diff);
    if (diff>matrixLimit+1e-8*Math.max(Math.abs(original[i]![j]!),Math.abs(changed[i]![j]!)))
      return fail('not-equivalent','matrix','Terminal response matrices disagree.');
  }
  const vectors = [Array(n).fill(0), ...Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0)),
    Array.from({length:n},(_,i)=>i+1), Array.from({length:n},(_,i)=>i%2?-.5:1.25), Array(n).fill(3.25)];
  for (const u of vectors) {
    const currents: number[][]=[];
    for (const network of [a,b]) {
      const l = resistorLaplacian(network), boundary=retained.map(id=>network.nodes.indexOf(id));
      const hidden=network.nodes.map((_,i)=>i).filter(i=>!boundary.includes(i));
      const ii=hidden.map(i=>hidden.map(j=>l[i]![j]!));
      const rhs=hidden.map(i=>-boundary.reduce((s,j,k)=>s+l[i]![j]!*u[k]!,0));
      const solved=solveReal(ii,rhs);
      if (solved.status!=='ok') return fail('numeric-failure','internal-solve',solved.message);
      const x=network.nodes.map((_,i)=>{const k=boundary.indexOf(i);return k>=0?u[k]!:solved.x[hidden.indexOf(i)]!.re;});
      const internalResidual=hidden.map(i=>({value:l[i]!.reduce((s,v,j)=>s+v*x[j]!,0),scale:l[i]!.reduce((s,v,j)=>s+Math.abs(v*x[j]!),0)}));
      if (internalResidual.some(r=>!finite(r.value)||!finite(r.scale)||Math.abs(r.value)>currentLimit+1e-8*r.scale))
        return fail('numeric-failure','internal-kcl','Internal KCL residual exceeds current limit.');
      currents.push(boundary.map(i=>l[i]!.reduce((s,v,j)=>s+v*x[j]!,0)));
    }
    for (let i=0;i<n;i++) {
      const c0=currents[0]![i]!, c1=currents[1]![i]!, diff=Math.abs(c0-c1);
      if (!finite(c0)||!finite(c1)||!finite(diff)) return fail('numeric-failure','nonfinite','Boundary current exceeds numeric range.');
      maxCurrentDifference=Math.max(maxCurrentDifference,diff);
      if (diff>currentLimit+1e-8*Math.max(Math.abs(c0),Math.abs(c1))) return fail('not-equivalent','current','Boundary currents disagree.');
    }
    if(u.every(v=>v===u[0])&&currents.some(c=>c.some(v=>Math.abs(v)>currentLimit)))
      return fail('numeric-failure','common-shift','A common boundary-voltage shift produced nonzero current.');
    const powers=currents.map(c=>c.reduce((s,v,i)=>s+u[i]!*v,0));
    const difference=Math.abs(powers[0]!-powers[1]!);
    if (!finite(difference)) return fail('numeric-failure','nonfinite','Power exceeds numeric range.');
    maxPowerDifference=Math.max(maxPowerDifference,difference);
    if (difference>powerLimit+1e-8*Math.max(Math.abs(powers[0]!),Math.abs(powers[1]!)))
      return fail('not-equivalent','power','Terminal power disagrees.');
  }
  return {maxMatrixDifference,maxCurrentDifference,maxPowerDifference,matrixLimit,currentLimit,powerLimit,vectors:vectors.length};
}

export function transformResistors(document: NativeDocument, retained: string[], selection: ResistorSelection): ResistorTransformResult {
  const unsupported=document.circuit.components.find(c=>c.type!=='R');
  if (unsupported || document.experiment.sources.length) return fail('unsupported','device',`Only source-free resistor networks are supported${unsupported?`; found ${unsupported.id} (${unsupported.type})`:''}.`);
  const original: ResistorNetwork={nodes:[...document.circuit.nodes],edges:document.circuit.components.map(c=>({id:c.id,p:c.p,n:c.n,resistance:'value' in c ? c.value : NaN}))};
  if (!retained.length || new Set(retained).size!==retained.length || retained.some(n=>!original.nodes.includes(n)))
    return fail('invalid-selection','terminals','Choose distinct existing retained terminals.');
  if (!original.nodes.includes('0')) return fail('invalid-selection','ground','The native circuit needs node 0.');
  let transformed=copyNetwork(original), removed:string[]=[], generated:ResistorEdge[]=[], eliminated:string[]=[], introduced:string[]=[];
  let explanation='';
  try {
    resistorLaplacian(original);
    const base=response(original,retained); if(isFailure(base)) return base;
    const selected=(selection.edges??[]).map(id=>transformed.edges.find(e=>e.id===id));
    if (selected.some(e=>!e) || new Set(selection.edges??[]).size!==(selection.edges??[]).length)
      return fail('invalid-selection','edges','Select distinct existing resistors.');
    const edges=selected as ResistorEdge[], ids=edgeIds(transformed.edges);
    const make=(p:string,n:string,r:number,prefix:string)=>{generated.push({id:uniqueId(ids,prefix),p,n,resistance:r});};
    const remove=(list:ResistorEdge[])=>{const discard=new Set(list.map(e=>e.id));removed.push(...discard);transformed.edges=transformed.edges.filter(e=>!discard.has(e.id));};
    const removeNode=(node:string)=>{transformed.nodes=transformed.nodes.filter(n=>n!==node);eliminated.push(node);};
    switch(selection.operation){
      case 'parallel': {
        if(edges.length!==2||!sameEnds(edges[0]!,edges[1]!)) return fail('invalid-selection','parallel','Select two resistors with the same unordered endpoints.');
        const g=conductance(edges[0]!.resistance)+conductance(edges[1]!.resistance);
        const r=resistance(g);remove(edges);make(edges[0]!.p,edges[0]!.n,r,'R_parallel');
        explanation=`Parallel: G = 1/${edges[0]!.resistance} + 1/${edges[1]!.resistance} S; R = 1/G.`;break;
      }
      case 'series': {
        if(edges.length!==2) return fail('invalid-selection','series','Select exactly two series resistors.');
        const shared=[edges[0]!.p,edges[0]!.n].filter(n=>n===edges[1]!.p||n===edges[1]!.n);
        if(shared.length!==1) return fail('invalid-selection','series','Selected branches need one shared node.');
        const center=shared[0]!, incident=transformed.edges.filter(e=>e.p===center||e.n===center);
        if(retained.includes(center)||center==='0'||incident.length!==2||other(edges[0]!,center)===other(edges[1]!,center))
          return fail('invalid-selection','series','Shared node must be nonretained, non-ground, degree two, with distinct outer nodes.');
        const r=edges[0]!.resistance+edges[1]!.resistance;
        if(!finite(r)||conductance(r)===0) throw new RangeError('Series resistance is outside representable range');
        remove(edges);removeNode(center);make(other(edges[0]!,center),other(edges[1]!,center),r,'R_series');
        explanation=`Series: remove degree-two node ${center}; R = ${edges[0]!.resistance} + ${edges[1]!.resistance} Ω.`;break;
      }
      case 'star-delta': case 'star-mesh': {
        const center=selection.center;
        if(!center||!transformed.nodes.includes(center)||retained.includes(center)||center==='0')
          return fail('invalid-selection','center','Choose an existing nonretained, non-ground center.');
        const incident=transformed.edges.filter(e=>e.p===center||e.n===center);
        const neighbors=[...new Set(incident.map(e=>other(e,center)))];
        if(neighbors.length<2||(selection.operation==='star-delta'&&(incident.length!==3||neighbors.length!==3)))
          return fail('invalid-selection','star','Star→delta needs exactly three branches and distinct neighbors; star–mesh needs at least two neighbors.');
        const g=neighbors.map(n=>incident.filter(e=>other(e,center)===n).reduce((s,e)=>s+conductance(e.resistance),0));
        const total=g.reduce((s,v)=>s+v,0);
        if(!finite(total)||total<=0) throw new RangeError('Star conductance sum exceeds numeric range');
        remove(incident);removeNode(center);
        for(let i=0;i<neighbors.length;i++)for(let j=i+1;j<neighbors.length;j++) {
          const coupling=(g[i]!/total)*g[j]!;
          if(!finite(coupling)||coupling<=0) throw new RangeError('Star coupling underflow or overflow');
          make(neighbors[i]!,neighbors[j]!,resistance(coupling),'R_mesh');
        }
        explanation=`Eliminate ${center}: G = Σgᵢ = ${total} S; each new coupling gᵢgⱼ/G is added alongside existing neighbor branches.`;break;
      }
      case 'delta-star': {
        if(edges.length!==3) return fail('invalid-selection','delta','Select exactly three triangle resistors.');
        const nodes=[...new Set(edges.flatMap(e=>[e.p,e.n]))];
        if(nodes.length!==3||nodes.some(n=>edges.filter(e=>e.p===n||e.n===n).length!==2))
          return fail('invalid-selection','delta','Selected branches must form a three-node triangle.');
        const [a,b,c]=nodes, side=(p:string,n:string)=>edges.find(e=>(e.p===p&&e.n===n)||(e.p===n&&e.n===p))!;
        const ab=side(a!,b!).resistance,bc=side(b!,c!).resistance,ca=side(c!,a!).resistance;
        const scale=Math.max(ab,bc,ca), sum=ab/scale+bc/scale+ca/scale;
        const ra=(ab/scale)*(ca/sum),rb=(ab/scale)*(bc/sum),rc=(bc/scale)*(ca/sum);
        if([ra,rb,rc].some(r=>!finite(r)||r<=0||!finite(1/r))) throw new RangeError('Delta–star leg outside representable range');
        const center=uniqueId(new Set(transformed.nodes),'star');introduced.push(center);transformed.nodes.push(center);
        remove(edges);make(a!,center,ra,'R_star');make(b!,center,rb,'R_star');make(c!,center,rc,'R_star');
        explanation=`Delta→star: S = Rab + Rbc + Rca; ra = Rab·Rca/S, rb = Rab·Rbc/S, rc = Rbc·Rca/S. Center ${center} is introduced.`;break;
      }
      case 'kron': {
        const hidden=transformed.nodes.filter(n=>!retained.includes(n));
        if(hidden.includes('0')) return fail('invalid-selection','ground','Retain node 0 to realize a native source-free preview.');
        const reduced=base;
        for(let i=0;i<retained.length;i++)for(let j=i+1;j<retained.length;j++){
          const g=-reduced[i]![j]!;
          if(g<0) throw new RangeError('Kron response has positive off-diagonal');
          if(g>0) make(retained[i]!,retained[j]!,resistance(g),'R_kron');
        }
        removed=transformed.edges.map(e=>e.id);transformed={nodes:[...retained],edges:generated};eliminated=hidden;
        explanation=`Kron: Λ = LBB − LBI solve(LII, LIB); eliminated ${hidden.join(', ')||'no internal nodes'}. Every nonzero off-diagonal is realized as a resistor.`;break;
      }
      default: return fail('invalid-selection','operation','Unknown resistor transformation.');
    }
    if(selection.operation!=='kron') transformed.edges.push(...generated);
    resistorLaplacian(transformed);
    const changed=response(transformed,retained);if(isFailure(changed))return changed;
    const check=checkResponse(original,transformed,retained,base,changed);if(!('vectors'in check))return check;
    const observations=retained.filter(n=>n!=='0').map((n,i)=>({id:`V_${i+1}`,type:'voltage' as const,p:n,n:'0'}));
    const output:NativeDocument={circuit:{schemaVersion:1,nodes:transformed.nodes,
      components:transformed.edges.map(e=>({id:e.id,type:'R' as const,p:e.p,n:e.n,value:e.resistance})),observations},
      experiment:{schemaVersion:1,sources:[],initial:{kind:'equilibrium'}}};
    const json=serializeDocument(output);parseDocument(json);
    return {status:'ok',retained:[...retained],original,transformed,eliminated,introduced,removed,generated,
      originalResponse:base,transformedResponse:changed,check,explanation,document:output,json};
  } catch(error){return fail('numeric-failure','range',error instanceof Error?error.message:String(error));}
}
