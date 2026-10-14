import type { NativeDocument } from '../src/model.js';
import type { BrowserDocument } from './native-document.js';
import type { Point, WiringGraph } from './wiring-graph.js';

export interface ProjectPlacement extends Point { component: string; turns: number }
export type ProjectVertex = { id: string; kind: 'terminal'; component: string; role: 'p' | 'n' }
  | ({ id: string; kind: 'junction' | 'free' } & Point);
export interface ProjectDrawing {
  drawingVersion: 1;
  placements: ProjectPlacement[];
  vertices: ProjectVertex[];
  edges: { id: string; a: string; b: string; bends: Point[] }[];
  bindings: { node: string; vertex: string }[];
  reference: string;
  observations: { observation: string; p: string; n: string }[];
  viewport?: { x: number; y: number; width: number; height: number };
}
export interface CircuitProject {
  format: 'circuits-unfolded-project'; projectVersion: 1;
  document: NativeDocument; drawing: ProjectDrawing;
}
export interface ProjectDiagnostic { code: string; path: string; id?: string; message: string }
export type ProjectResult =
  | { status: 'ok'; project: CircuitProject; graph: WiringGraph; warnings: ProjectDiagnostic[] }
  | { status: 'unsupported'; document: BrowserDocument; diagnostics: ProjectDiagnostic[] }
  | { status: 'invalid'; stage: 'envelope' | 'native' | 'drawing' | 'draft';
      diagnostics: ProjectDiagnostic[]; document?: BrowserDocument };
export const PROJECT_LIMITS = Object.freeze({ bytes: 2 * 1024 * 1024, depth: 32,
  values: 100000, components: 40, vertices: 240, edges: 320, nodes: 240,
  observations: 240, bends: 64, coordinate: 1e6, viewportExtent: 2e6 });
