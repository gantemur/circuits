/** Portable files are completed snapshots, not editor recovery or scientific Apply.
 * Every operation here is pure and leaves drafts, ownership and history untouched. */
import { nativeCandidate, documentMeaning } from './wiring-native.js';
import { geometryDiagnostics, type WiringGraph } from './wiring-graph.js';
import { validateProject, projectIssue } from './project-validation.js';
import { PROJECT_LIMITS, type CircuitProject, type ProjectDrawing, type ProjectResult } from './project-types.js';
export { validateProject, validateProject as importProject } from './project-validation.js';
export * from './project-types.js';

export function parseProject(json: string): ProjectResult {
  try {
    if(typeof json!=='string'||json.length>PROJECT_LIMITS.bytes||new TextEncoder().encode(json).length>PROJECT_LIMITS.bytes)
      return {status:'invalid',stage:'envelope',diagnostics:[{code:'file-limit',path:'$',message:'Project exceeds 2 MiB'}]};
    return validateProject(JSON.parse(json));
  } catch(error) { return {status:'invalid',stage:'envelope',diagnostics:[{code:'invalid-json',path:'$',message:error instanceof Error?error.message:'Invalid JSON'}]}; }
}
function encode(graph: WiringGraph, document: CircuitProject['document'], viewport?: ProjectDrawing['viewport']): CircuitProject {
  // IDs depend only on array order, not allocation history. All references use Maps.
  const vertexIds=new Map(graph.vertices.map((v,i)=>[v.key,`v${i+1}`]));
  const deviceIds=new Map(graph.devices.map(d=>[d.key,d.id]));
  const vertex=(key:string):string=>{const value=vertexIds.get(key);if(value===undefined)throw Error('Missing vertex '+key);return value;};
  return {format:'circuits-unfolded-project',projectVersion:1,document,
    drawing:{drawingVersion:1,
      placements:graph.devices.map(d=>{const p=graph.placements.find(p=>p.key===d.key)!;return {component:d.id,x:p.x,y:p.y,turns:p.turns};}),
      vertices:graph.vertices.map(v=>{
        if(v.kind==='terminal')return {id:vertex(v.key),kind:v.kind,component:deviceIds.get(v.device)!,role:v.role};
        const p=graph.points.find(p=>p.key===v.key)!;return {id:vertex(v.key),kind:v.kind,x:p.x,y:p.y};
      }),
      edges:graph.edges.map((edge,i)=>({id:`e${i+1}`,a:vertex(edge.a),b:vertex(edge.b),bends:structuredClone(graph.routes.find(r=>r.key===edge.key)!.bends)})),
      bindings:graph.names.map(n=>({node:n.name,vertex:vertex(n.vertex)})),reference:vertex(graph.reference),
      observations:graph.observations.filter(o=>o.type==='voltage').map(o=>({observation:o.id,p:vertex(o.p),n:vertex(o.n)})),
      ...(viewport?{viewport:structuredClone(viewport)}:{})}};
}
/** Export only a completed graph. Pending text/gestures outside WiringGraph must
 * enter through exportProjectDraft; callers must never export around those guards. */
export function exportProject(graph: WiringGraph, viewport?: ProjectDrawing['viewport']): ProjectResult {
  try {
    if(graph.devices.length>PROJECT_LIMITS.components||graph.vertices.length>PROJECT_LIMITS.vertices||graph.edges.length>PROJECT_LIMITS.edges||graph.names.length>PROJECT_LIMITS.nodes||graph.observations.length>PROJECT_LIMITS.observations)
      return {status:'invalid',stage:'draft',diagnostics:[{code:'record-limit',path:'graph',message:'Graph exceeds project limits'}]};
    // Do not silently drop duplicate/orphan geometry while projecting to the DTO.
    const exactKeys=(records:{key:string}[],expected:string[])=>records.length===expected.length&&new Set(records.map(r=>r.key)).size===records.length&&records.every(r=>expected.includes(r.key));
    if(!exactKeys(graph.placements,graph.devices.map(d=>d.key))||!exactKeys(graph.points,graph.vertices.filter(v=>v.kind!=='terminal').map(v=>v.key))||!exactKeys(graph.routes,graph.edges.map(e=>e.key)))
      return {status:'invalid',stage:'draft',diagnostics:[{code:'geometry-coverage',path:'graph',message:'Geometry records must cover their owners exactly once'}]};
    const geometry=geometryDiagnostics(graph);
    if(geometry.length)return {status:'invalid',stage:'draft',diagnostics:geometry.map(d=>({code:d.code,path:'graph',message:d.message}))};
    const candidate=nativeCandidate(graph);
    if(candidate.status!=='ok')return {status:'invalid',stage:'draft',diagnostics:candidate.diagnostics.map(d=>({code:d.code,path:'graph',message:d.message}))};
    return validateProject(encode(graph,candidate.document,viewport));
  } catch(error){return {status:'invalid',stage:'draft',diagnostics:[projectIssue(error)]};}
}
export function exportProjectDraft(draft: {graph:WiringGraph; pendingTextCount:number; unfinishedWire:boolean}, viewport?:ProjectDrawing['viewport']):ProjectResult {
  if(draft.unfinishedWire!==false||!Number.isInteger(draft.pendingTextCount)||draft.pendingTextCount!==0)
    return {status:'invalid',stage:'draft',diagnostics:[{code:'incomplete-draft',path:'draft',message:'Commit pending text and complete/cancel the wire before saving'}]};
  return exportProject(draft.graph,viewport);
}
export type ProjectSerialization = {status:'ok';json:string} | Exclude<ProjectResult,{status:'ok'}>;
export function serializeProject(value:unknown):ProjectSerialization {
  const result=validateProject(value);
  if(result.status!=='ok')return result;
  return {status:'ok',json:JSON.stringify(result.project)};
}
/** Compare saved content independently of Apply. Ignores object property order
 * and file-local handle spelling; preserves native array order, vertex/edge order, anchors,
 * geometry and viewport. This is not general graph-isomorphism equivalence. */
export function projectContentKey(value:unknown): {status:'ok';key:string} | Exclude<ProjectResult,{status:'ok'}> {
  const result=validateProject(value);
  if(result.status!=='ok')return result;
  return {status:'ok',key:documentMeaning(encode(result.graph,result.project.document,result.project.drawing.viewport))};
}
