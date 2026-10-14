/** Portable drawing validation. Wires alone define the partition: symbol interiors
 * and coordinate intersections never create adjacency. No browser/Apply state is used. */
import { ValidationError } from '../src/model.js';
import { parseBrowserDocument, isLinearDocument, type BrowserDocument } from './native-document.js';
import { importWiring, nativeCandidate, documentMeaning } from './wiring-native.js';
import { handle, geometryDiagnostics, partitions, wirePoints, type WiringGraph } from './wiring-graph.js';
import { PROJECT_LIMITS as L, type CircuitProject, type ProjectDrawing, type ProjectDiagnostic, type ProjectResult } from './project-types.js';

type RecordValue = Record<string, unknown>;
class ProjectError extends Error {
  constructor(readonly issue: ProjectDiagnostic) { super(issue.message); }
}
function fail(code: string, path: string, message: string, id?: string): never {
  throw new ProjectError({ code, path, message, ...(id === undefined ? {} : { id }) });
}
function record(value: unknown, path: string, keys: string[]): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('expected-object',path,'Expected object');
  const obj = value as RecordValue;
  for (const key of Object.keys(obj)) if (!keys.includes(key)) fail('unknown-field',`${path}.${key}`,'Unrecognized field');
  return obj;
}
function array(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value)) fail('expected-array',path,'Expected array');
  if (value.length > max) fail('record-limit',path,'Too many records');
  return value;
}
function id(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.length) fail('invalid-id',path,'Expected nonempty exact string');
  return value;
}
function coordinate(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value)>L.coordinate)
    fail('coordinate',path,'Coordinate must be finite and within ±1e6');
  return value;
}
function point(value: unknown, path: string): void {
  const obj=record(value,path,['x','y']);coordinate(obj.x,path+'.x');coordinate(obj.y,path+'.y');
}
function unique(seen: Set<string>, key: string, path: string): void {
  if(seen.has(key)) fail('duplicate-id',path,'Duplicate identity',key);
  seen.add(key);
}
/** Bound work before native validation/copying. Only JSON trees are accepted by
 * the object API; reject accessors, cycles/aliases and non-JSON values explicitly. */
export function boundedJson(value: unknown): string {
  const stack=[{value,depth:0}],seen=new Set<object>();let count=0,minimumBytes=0;
  const countText=(text:string)=>{minimumBytes+=new TextEncoder().encode(text).length;if(minimumBytes>L.bytes)fail('file-limit','$','Project exceeds 2 MiB');};
  while(stack.length){
    const item=stack.pop()!;
    if(++count>L.values || item.depth>L.depth) fail('resource-limit','$','JSON tree exceeds bounds');
    if(typeof item.value==='string'&&item.value.length>L.bytes)fail('file-limit','$','String exceeds file bound');
    if(typeof item.value==='string'){countText(item.value);continue;}
    if(item.value===null || typeof item.value==='boolean')continue;
    if(typeof item.value==='number'){
      if(!Number.isFinite(item.value))fail('nonfinite','$','JSON numbers must be finite');
      continue;
    }
    if(typeof item.value!=='object')fail('non-json','$','Expected JSON data');
    if(seen.has(item.value))fail('non-json','$','Expected an unaliased JSON tree');
    seen.add(item.value);
    const proto=Object.getPrototypeOf(item.value);
    if(!Array.isArray(item.value) && proto!==Object.prototype && proto!==null)fail('non-json','$','Expected plain record');
    for(const key of Reflect.ownKeys(item.value)){
      if(Array.isArray(item.value)&&key==='length')continue;
      const descriptor=Object.getOwnPropertyDescriptor(item.value,key)!;
      if(typeof key!=='string'||!descriptor.enumerable||!('value' in descriptor))fail('non-json','$','Accessors and hidden fields are not JSON');
      if(Array.isArray(item.value)&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=item.value.length))fail('non-json','$','Decorated arrays are not JSON');
      countText(key);
      if(stack.length+count>=L.values)fail('resource-limit','$','JSON tree exceeds bounds');
      stack.push({value:descriptor.value,depth:item.depth+1});
    }
    if(Array.isArray(item.value)&&Object.keys(item.value).length!==item.value.length)fail('non-json','$','Sparse/decorated arrays are not JSON');
  }
  const json=JSON.stringify(value);
  if(new TextEncoder().encode(json).length>L.bytes)fail('file-limit','$','Project exceeds 2 MiB');
  return json;
}
function drawingShape(value: unknown): ProjectDrawing {
  const d=record(value,'drawing',['drawingVersion','placements','vertices','edges','bindings','reference','observations','viewport']);
  if(d.drawingVersion!==1)fail('drawing-version','drawing.drawingVersion','Unsupported drawing version');
  const placements=new Set<string>(),vertices=new Set<string>(),edges=new Set<string>(),nodes=new Set<string>(),observations=new Set<string>();
  array(d.placements,'drawing.placements',L.components).forEach((v,i)=>{
    const path=`drawing.placements[${i}]`,r=record(v,path,['component','x','y','turns']);
    unique(placements,id(r.component,path+'.component'),path);coordinate(r.x,path+'.x');coordinate(r.y,path+'.y');
    if(!Number.isInteger(r.turns)||Number(r.turns)<0||Number(r.turns)>3)fail('rotation',path+'.turns','Expected quarter-turn index 0..3');
  });
  array(d.vertices,'drawing.vertices',L.vertices).forEach((v,i)=>{
    const path=`drawing.vertices[${i}]`,r=record(v,path,['id','kind','component','role','x','y']);
    unique(vertices,id(r.id,path+'.id'),path);
    if(r.kind==='terminal'){
      record(v,path,['id','kind','component','role']);id(r.component,path+'.component');
      if(r.role!=='p'&&r.role!=='n')fail('terminal-role',path+'.role','Expected p or n');
    }else{
      record(v,path,['id','kind','x','y']);
      if(r.kind!=='junction'&&r.kind!=='free')fail('vertex-kind',path+'.kind','Expected terminal, junction or free');
      coordinate(r.x,path+'.x');coordinate(r.y,path+'.y');
    }
  });
  const vertex=(v:unknown,path:string)=>{const key=id(v,path);if(!vertices.has(key))fail('missing-vertex',path,'Unknown vertex',key);};
  array(d.edges,'drawing.edges',L.edges).forEach((v,i)=>{
    const path=`drawing.edges[${i}]`,r=record(v,path,['id','a','b','bends']);unique(edges,id(r.id,path+'.id'),path);
    vertex(r.a,path+'.a');vertex(r.b,path+'.b');if(r.a===r.b)fail('self-edge',path,'Wire endpoints must differ');
    array(r.bends,path+'.bends',L.bends).forEach((p,j)=>point(p,`${path}.bends[${j}]`));
  });
  array(d.bindings,'drawing.bindings',L.nodes).forEach((v,i)=>{
    const path=`drawing.bindings[${i}]`,r=record(v,path,['node','vertex']);unique(nodes,id(r.node,path+'.node'),path);vertex(r.vertex,path+'.vertex');
  });
  vertex(d.reference,'drawing.reference');
  array(d.observations,'drawing.observations',L.observations).forEach((v,i)=>{
    const path=`drawing.observations[${i}]`,r=record(v,path,['observation','p','n']);unique(observations,id(r.observation,path+'.observation'),path);vertex(r.p,path+'.p');vertex(r.n,path+'.n');
  });
  if(d.viewport!==undefined){
    const r=record(d.viewport,'drawing.viewport',['x','y','width','height']);const x=coordinate(r.x,'viewport.x'),y=coordinate(r.y,'viewport.y');
    for(const key of ['width','height'])if(typeof r[key]!=='number'||!Number.isFinite(r[key])||Number(r[key])<=0||Number(r[key])>L.viewportExtent)fail('viewport','drawing.viewport','Invalid viewport extent');
    coordinate(x+Number(r.width),'viewport.right');coordinate(y+Number(r.height),'viewport.bottom');
  }
  return structuredClone(d) as unknown as ProjectDrawing;
}

/** Scientific values come exclusively from importWiring(native). Replace only its
 * representation, allocating fresh h-handles independently of all file-local IDs. */
function reconstruct(document: CircuitProject['document'], d: ProjectDrawing): WiringGraph {
  const imported=importWiring(document);
  if(imported.status!=='editable')fail('unsupported','document','Unsupported graphical document');
  const g=imported.graph,devices=new Map(g.devices.map(dev=>[dev.id,dev]));
  if(d.placements.length!==devices.size)fail('placement-coverage','drawing.placements','One placement required per component');
  g.placements=d.placements.map(p=>{
    const device=devices.get(p.component);if(!device)fail('component-reference','drawing.placements','Unknown component',p.component);
    return {key:device.key,x:p.x,y:p.y,turns:p.turns};
  });
  const vertexIds=new Map(d.vertices.map(v=>[v.id,handle(g)]));
  const roles=new Map<string,Map<string,string>>();
  g.vertices=d.vertices.map(v=>{
    const key=vertexIds.get(v.id)!;
    if(v.kind!=='terminal')return {key,kind:v.kind};
    const device=devices.get(v.component);if(!device)fail('component-reference','drawing.vertices','Unknown terminal owner',v.component);
    const owned=roles.get(v.component)??new Map<string,string>();roles.set(v.component,owned);
    if(owned.has(v.role))fail('duplicate-terminal','drawing.vertices','Duplicate component role',v.id);
    owned.set(v.role,key);
    return {key,kind:'terminal',device:device.key,role:v.role,completion:d.edges.some(e=>e.a===v.id||e.b===v.id)?'connected':'open'};
  });
  for(const dev of g.devices){
    const owned=roles.get(dev.id);
    if(!owned?.has('p')||!owned.has('n'))fail('missing-terminal','drawing.vertices','Both ordered roles required',dev.id);
    dev.terminals=(['p','n'] as const).map(role=>({role,vertex:owned.get(role)!}));
  }
  g.points=d.vertices.filter(v=>v.kind!=='terminal').map(v=>({key:vertexIds.get(v.id)!,x:v.x,y:v.y}));
  g.edges=[];g.routes=[];
  for(const edge of d.edges){const key=handle(g);g.edges.push({key,a:vertexIds.get(edge.a)!,b:vertexIds.get(edge.b)!});g.routes.push({key,bends:structuredClone(edge.bends)});}
  const components=partitions(g),componentOf=new Map<string,number>();
  components.forEach((part,i)=>part.forEach(v=>componentOf.set(v,i)));
  const nodeOf=new Map<number,string>(),bindingOf=new Map(d.bindings.map(b=>[b.node,b]));
  if(bindingOf.size!==document.circuit.nodes.length)fail('node-coverage','drawing.bindings','Every native node needs exactly one binding');
  for(const node of document.circuit.nodes){
    const binding=bindingOf.get(node);if(!binding)fail('node-coverage','drawing.bindings','Missing native node',node);
    const index=componentOf.get(vertexIds.get(binding.vertex)!)!;
    if(nodeOf.has(index))fail('merged-nodes','drawing.bindings','Distinct native nodes share a wire component',node);
    nodeOf.set(index,node);
  }
  if(nodeOf.size!==components.length)fail('unbound-component','drawing.bindings','Extra wire-connected component has no native node');
  const nodeAt=(vertex:string)=>nodeOf.get(componentOf.get(vertex)!);
  for(const dev of document.circuit.components){
    const owned=roles.get(dev.id)!;
    for(const role of ['p','n'] as const)if(nodeAt(owned.get(role)!)!==dev[role])fail('terminal-node','drawing.vertices','Terminal is on the wrong native node',dev.id);
  }
  // Rebuild native-sensitive collections in native array order, not file order.
  g.names=document.circuit.nodes.map(node=>({key:handle(g),name:node,vertex:vertexIds.get(bindingOf.get(node)!.vertex)!}));
  g.reference=vertexIds.get(d.reference)!;
  if(nodeAt(g.reference)!=='0')fail('reference-node','drawing.reference','Reference must belong to node 0',d.reference);
  const anchors=new Map(d.observations.map(o=>[o.observation,o]));
  if(anchors.size!==document.circuit.observations.filter(o=>o.type==='voltage').length)fail('observation-coverage','drawing.observations','One anchor pair required per voltage observation');
  g.observations=g.observations.map(o=>{
    if(o.type==='current')return o;
    const anchor=anchors.get(o.id),native=document.circuit.observations.find(n=>n.id===o.id)!;
    if(!anchor||native.type!=='voltage')fail('observation-coverage','drawing.observations','Missing voltage observation',o.id);
    const p=vertexIds.get(anchor.p)!,n=vertexIds.get(anchor.n)!;
    if(nodeAt(p)!==native.p||nodeAt(n)!==native.n)fail('observation-node','drawing.observations','Ordered observation anchors disagree with native nodes',o.id);
    return {...o,p,n};
  });
  const geometry=geometryDiagnostics(g);
  if(geometry.length)fail('geometry','drawing',geometry[0]!.message);
  const candidate=nativeCandidate(g);
  if(candidate.status!=='ok')fail('native-reconstruction','drawing','Reconstructed graph is not a valid native candidate');
  if(documentMeaning(candidate.document)!==documentMeaning(document))fail('scientific-mismatch','drawing','Reconstructed scientific content differs');
  return g;
}
/** Conservative, nonfatal quality evidence independent of SVG. Overlapping
 * segment boxes can warn even for safe diagonal arrangements; no repair occurs. */
export function projectWarnings(g: WiringGraph): ProjectDiagnostic[] {
  const segments=g.edges.flatMap(edge=>{const points=wirePoints(g,edge.key);return points.slice(1).map((b,i)=>({edge,a:points[i]!,b}));});
  const overlap=(a:number,b:number,c:number,d:number)=>Math.max(Math.min(a,b),Math.min(c,d))<=Math.min(Math.max(a,b),Math.max(c,d));
  for(let i=0;i<segments.length;i++)for(const b of segments.slice(i+1)){
    const a=segments[i]!;
    if(a.edge.key===b.edge.key||[a.edge.a,a.edge.b].some(v=>v===b.edge.a||v===b.edge.b))continue;
    if(overlap(a.a.x,a.b.x,b.a.x,b.b.x)&&overlap(a.a.y,a.b.y,b.a.y,b.b.y))return [{code:'possible-wire-overlap',path:'drawing.edges',message:'Wire segment boxes overlap; inspect crossings. This is not an electrical connection.'}];
  }
  for(let i=0;i<g.placements.length;i++)for(const b of g.placements.slice(i+1)){
    const a=g.placements[i]!;
    if(Math.abs(a.x-b.x)<65&&Math.abs(a.y-b.y)<65)return [{code:'possible-symbol-overlap',path:'drawing.placements',message:'Nearby symbols may overlap; inspect the drawing.'}];
  }
  return [];
}
export function projectIssue(error: unknown): ProjectDiagnostic {
  if(error instanceof ProjectError)return error.issue;
  if(error instanceof ValidationError)return {code:'native-'+error.code,path:String(error.params.path??'document'),message:error.message};
  return {code:'invalid-project',path:'$',message:error instanceof Error?error.message:'Invalid project'};
}
export function validateProject(value: unknown): ProjectResult {
  let stage: 'envelope'|'native'|'drawing'='envelope';let document:BrowserDocument|undefined;
  try{
    const copy=JSON.parse(boundedJson(value)) as unknown;
    const p=record(copy,'$',['format','projectVersion','document','drawing']);
    if(p.format!=='circuits-unfolded-project')fail('project-format','format','Not a Circuits Unfolded project');
    if(p.projectVersion!==1)fail('project-version','projectVersion','Unsupported project version');
    stage='native';
    // Bound native collections before invoking validators that may cross-reference
    // arrays. This is a resource guard, not a replacement scientific validator.
    const native=p.document as {circuit?:RecordValue;experiment?:RecordValue}|null;
    const limit=(value:unknown,max:number,path:string)=>{
      if(Array.isArray(value)&&value.length>max)fail('record-limit',path,'Native collection exceeds project limits');
    };
    limit(native?.circuit?.components,L.components,'document.circuit.components');
    limit(native?.circuit?.nodes,L.nodes,'document.circuit.nodes');
    limit(native?.circuit?.observations,L.observations,'document.circuit.observations');
    limit(native?.experiment?.sources,L.components,'document.experiment.sources');
    const initial=native?.experiment?.initial as RecordValue|null|undefined;
    limit(initial?.values,L.components,'document.experiment.initial.values');
    document=parseBrowserDocument(JSON.stringify(p.document));
    if(!isLinearDocument(document)||document.circuit.components.some(c=>!['R','C','L','V','I'].includes(c.type)))
      return {status:'unsupported',document,diagnostics:[{code:'drawing-scope',path:'document',message:'Drawing supports native v1 R/C/L/V/I only'}]};
    stage='drawing';
    if(document.circuit.components.length>L.components||document.circuit.nodes.length>L.nodes||document.circuit.observations.length>L.observations)fail('record-limit','document','Native document exceeds graphical limits');
    const drawing=drawingShape(p.drawing),graph=reconstruct(document,drawing);
    return {status:'ok',project:{format:'circuits-unfolded-project',projectVersion:1,document,drawing},graph,warnings:projectWarnings(graph)};
  }catch(error){return {status:'invalid',stage,diagnostics:[projectIssue(error)],...(document?{document}: {})};}
}
