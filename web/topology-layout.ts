import type { NativeDocument } from '../src/model.js';
import { parseBrowserDocument, type BrowserDocument } from './native-document.js';
import { constructLayout } from './layout-construction.js';
import { recognizeLayout, type LayoutOptions, type LayoutWitness } from './layout-recognition.js';
import { verifyLayout, type LayoutEvidence } from './layout-verification.js';
import type { WiringGraph } from './wiring-graph.js';
import type { CircuitProject } from './project-types.js';
export { recognizeLayout, constructLayout, verifyLayout };
export type { LayoutOptions, LayoutWitness, LayoutEvidence };
export type LayoutResult = {
  status: 'generated';
  document: NativeDocument;
  witness: LayoutWitness;
  graph: WiringGraph;
  project: CircuitProject;
  evidence: LayoutEvidence;
} | {
  status: 'invalid' | 'unsupported' | 'unrecognized' | 'quality-rejected';
  reason: string;
  document?: BrowserDocument;
  evidence?: LayoutEvidence;
};
/** Native-only, pure boundary. A project envelope is not accepted or stripped:
 * callers must not accidentally arrange a saved drawing. No revision, history,
 * applied document, viewport or production browser state is owned here. */
export function generateTopologyLayout(input: unknown, options: LayoutOptions = {}): LayoutResult {
  let document: BrowserDocument;
  try {
    document = parseBrowserDocument(JSON.stringify(input));
  }
  catch (error) {
    return { status: 'invalid', reason: error instanceof Error ? error.message : String(error) };
  }
  if (document.circuit.schemaVersion !== 1 || document.circuit.components.some(c => !['R', 'C', 'L', 'V', 'I'].includes(c.type)))
    return { status: 'unsupported', reason: 'Only native v1 R/C/L/V/I drawings are supported', document };
  const native = document as NativeDocument;
  const recognition = recognizeLayout(native, options);
  if (recognition.status !== 'recognized')
    return { ...recognition, document };
  try {
    const graph = constructLayout(native, recognition.witness);
    const { evidence, project } = verifyLayout(native, graph);
    if (project.status !== 'ok' || !evidence.geometryComplete || evidence.issues.length)
      return { status: 'quality-rejected', reason: evidence.issues.join(', '), document, evidence };
    return { status: 'generated', document: native, witness: recognition.witness, graph, project: project.project, evidence };
  }
  catch (error) {
    return { status: 'quality-rejected', reason: error instanceof Error ? error.message : String(error), document };
  }
}
