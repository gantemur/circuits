import type { LabState } from './lab.js';
import { serializeBrowserDocument } from './native-document.js';
// Only explicit user/handoff choices are recorded. Default panel guesses do not
// acquire layout authority. Identity + monotone revision prevents change/restore.
const accepted = new WeakMap<object,{revision:number; snapshot:string; port:[string,string]}>();
export function rememberLayoutPort(state:LabState, p:string, q:string):void {
  if (p===q || !state.document.circuit.nodes.includes(p) || !state.document.circuit.nodes.includes(q)) return;
  accepted.set(state.document,{revision:state.revision,snapshot:serializeBrowserDocument(state.document),port:[p,q]});
}
export function acceptedLayoutPort(state:LabState):[string,string]|undefined {
  const value=accepted.get(state.document);
  if (value?.revision!==state.revision || value.snapshot!==serializeBrowserDocument(state.document)) return undefined;
  return [...value.port];
}
