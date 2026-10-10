import { solveReal, zeros, type Matrix, type LinearFailure, type Tolerances } from './numeric.js';

export interface ResistorEdge { id: string; p: string; n: string; resistance: number }
export interface ResistorNetwork { nodes: string[]; edges: ResistorEdge[] }
/** Full, ungrounded resistor Laplacian. Node '0', if present, is an ordinary boundary terminal. */
export function resistorLaplacian(network: ResistorNetwork): Matrix {
  const { nodes, edges } = network;
  if (new Set(nodes).size !== nodes.length || nodes.some(n => typeof n !== 'string' || !n.length) || new Set(edges.map(e => e.id)).size !== edges.length)
    throw new RangeError('Resistor network needs unique nonempty node and edge IDs');
  const matrix = zeros(nodes.length);
  for (const edge of edges) {
    const p = nodes.indexOf(edge.p), n = nodes.indexOf(edge.n);
    if (!edge.id || p < 0 || n < 0 || !Number.isFinite(edge.resistance) || edge.resistance <= 0)
      throw new RangeError('Invalid resistor edge');
    const g = 1 / edge.resistance;
    matrix[p]![p] = matrix[p]![p]! + g; matrix[n]![n] = matrix[n]![n]! + g;
    matrix[p]![n] = matrix[p]![n]! - g; matrix[n]![p] = matrix[n]![p]! - g;
  }
  return matrix;
}
export function kronReduce(network: ResistorNetwork, retained: string[], options: Partial<Tolerances> = {}):
  { status: 'ok'; retained: string[]; eliminated: string[]; full: Matrix; reduced: Matrix; units: 'S' } | LinearFailure {
  const full = resistorLaplacian(network);
  if (!retained.length || new Set(retained).size !== retained.length || retained.some(n => !network.nodes.includes(n)))
    throw new RangeError('Retained terminals must be distinct network nodes');
  const boundary = retained.map(n => network.nodes.indexOf(n));
  const hidden = network.nodes.map((_, i) => i).filter(i => !boundary.includes(i));
  const ii = hidden.map(i => hidden.map(j => full[i]![j]!));
  const reduced = boundary.map(i => boundary.map(j => full[i]![j]!));
  for (let j = 0; j < boundary.length; j++) {
    const solved = solveReal(ii, hidden.map(i => full[i]![boundary[j]!]!), options);
    if (solved.status !== 'ok') return solved;
    boundary.forEach((i, k) => { reduced[k]![j] = reduced[k]![j]! - hidden.reduce((s, h, l) => s + full[i]![h]! * solved.x[l]!.re, 0); });
  }
  return { status: 'ok', retained: [...retained], eliminated: hidden.map(i => network.nodes[i]!), full, reduced, units: 'S' };
}
