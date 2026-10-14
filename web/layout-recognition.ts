import type { NativeDocument } from '../src/model.js';
/** Indices address the original native arrays. They are not ID encodings.
 * Endpoints are ordered spatially here; native p/n roles remain untouched. */
export interface LayoutEdge {
  index: number;
  type: string;
  a: string;
  b: string;
}
export interface LayoutPath {
  nodes: string[];
  edges: number[];
}
export type LayoutWitness = {
  family: 'chain' | 'cauer';
  p: string;
  q: string;
  source?: number;
  stages: {
    node: string;
    shunt?: number;
    series?: number;
    next?: string;
  }[];
} | {
  family: 'parallel' | 'foster-II';
  p: string;
  q: string;
  source?: number;
  paths: LayoutPath[];
} | {
  family: 'foster-I';
  p: string;
  q: string;
  sections: {
    a: string;
    b: string;
    edges: number[];
  }[];
} | {
  family: 'bridge';
  p: string;
  q: string;
  source?: number;
  midpoints: [string, string];
  arms: [number, number, number, number];
  cross: number;
};
export interface LayoutOptions {
  port?: readonly [string, string];
}
export type Recognition = {
  status: 'recognized';
  witness: LayoutWitness;
} | {
  status: 'unrecognized';
  reason: string;
};
const other = (edge: LayoutEdge, node: string) => edge.a === node ? edge.b : edge.a;
/** Bounded structural recognition: no values, labels or lexical ID ordering.
 * Single source selects a port only when the caller did not provide one. All
 * passive edges must be consumed; unused native nodes are deliberately allowed.
 * This is topology recognition, not a claim of a synthesis certificate. */
export function recognizeLayout(document: NativeDocument, options: LayoutOptions = {}): Recognition {
  const edges: LayoutEdge[] = document.circuit.components.map((c, index) => ({ index, type: c.type, a: c.p, b: c.n }));
  const fail = (reason: string): Recognition => ({ status: 'unrecognized', reason });
  if (!edges.length || edges.length > 16 || document.circuit.nodes.length > 32)
    return fail('layout-size: require 1–16 devices and at most 32 nodes');
  if (edges.some(e => e.a === e.b))
    return fail('self-loop');
  const sources = edges.filter(e => e.type === 'V' || e.type === 'I');
  if (sources.length > 1 || sources.some(e => e.type !== 'V'))
    return fail('source-pattern');
  const source = sources[0];
  const port = options.port ?? (source ? [source.a, source.b] : undefined);
  if (!port)
    return fail('port-required');
  const [p, q] = port;
  if (p === q || !document.circuit.nodes.includes(p) || !document.circuit.nodes.includes(q))
    return fail('invalid-port');
  if (source && !((source.a === p && source.b === q) || (source.a === q && source.b === p)))
    return fail('source-port-mismatch');
  const passive = edges.filter(e => e !== source);
  if (!passive.length)
    return fail('empty-passive-network');
  const at = (node: string, pool = passive) => pool.filter(e => e.a === node || e.b === node);
  const between = (a: string, b: string) => passive.filter(e => (e.a === a && e.b === b) || (e.a === b && e.b === a));
  const sourceField = source ? { source: source.index } : {};
  // A bridge has exactly four arm edges and one midpoint edge. The first
  // midpoint follows native node order, so changing values cannot swap arms.
  const usedNodes = document.circuit.nodes.filter(n => at(n).length > 0);
  const mids = usedNodes.filter(n => n !== p && n !== q);
  if (passive.length === 5 && passive.every(e => e.type === 'R') && mids.length === 2) {
    const [a, b] = mids as [string, string];
    const groups = [between(p, a), between(a, q), between(p, b), between(b, q), between(a, b)];
    if (groups.every(g => g.length === 1))
      return { status: 'recognized', witness: { family: 'bridge', p, q, ...sourceField,
          midpoints: [a, b], arms: groups.slice(0, 4).map(g => g[0]!.index) as [number, number, number, number], cross: groups[4]![0]!.index } };
  }
  // Cauer/elementary path: remove at most one shunt at each visited node,
  // then follow the only forward edge. No guessing at a branch fork.
  const stages: Extract<LayoutWitness, {
    family: 'chain' | 'cauer';
  }>['stages'] = [];
  const remaining = new Set(passive);
  const visited = new Set<string>();
  let node = p;
  while (!visited.has(node)) {
    visited.add(node);
    const incident = at(node, [...remaining]);
    const shunts = incident.filter(e => other(e, node) === q);
    const forward = incident.filter(e => other(e, node) !== q);
    if (shunts.length > 1 || forward.length > 1 || !incident.length)
      break;
    const shunt = shunts[0], series = forward[0];
    stages.push({ node, ...(shunt ? { shunt: shunt.index } : {}), ...(series ? { series: series.index, next: other(series, node) } : {}) });
    if (shunt)
      remaining.delete(shunt);
    if (!series)
      break;
    remaining.delete(series);
    node = other(series, node);
  }
  // Consuming every edge is insufficient: a dangling path must not be
  // described as a ladder terminating at a separate, unused return node.
  if (!remaining.size && stages.at(-1)?.shunt !== undefined) {
    const cauer = !source && stages.every(s => (s.series === undefined || edges[s.series]!.type === 'R')
      && (s.shunt === undefined || edges[s.shunt]!.type === 'C' || (s.series === undefined && edges[s.shunt]!.type === 'R')));
    if (source || cauer)
      return { status: 'recognized', witness: { family: source ? 'chain' : 'cauer', p, q, ...sourceField, stages } };
  }
  // Series-of-bundles: quotient each unordered parallel edge bundle. The
  // quotient must be a simple path; RC pairs retain both physical branches.
  if (!source && passive.every(e => e.type === 'R' || e.type === 'C')) {
    const sections: Extract<LayoutWitness, {
      family: 'foster-I';
    }>['sections'] = [];
    const left = new Set(passive);
    const seen = new Set<string>();
    node = p;
    while (node !== q && !seen.has(node)) {
      seen.add(node);
      const incident = at(node, [...left]);
      const neighbors = [...new Set(incident.map(e => other(e, node)))];
      if (neighbors.length !== 1)
        break;
      const next = neighbors[0]!;
      if (!(incident.length === 1 || (incident.length === 2 && new Set(incident.map(e => e.type)).size === 2)))
        break;
      sections.push({ a: node, b: next, edges: incident.map(e => e.index) });
      incident.forEach(e => left.delete(e));
      node = next;
    }
    if (node === q && !left.size && sections.some(s => s.edges.length === 2))
      return { status: 'recognized', witness: { family: 'foster-I', p, q, sections } };
  }
  // Parallel paths: every internal node has degree two and belongs to just
  // one path. Native component order chooses branch order at the positive port.
  const paths: LayoutPath[] = [];
  const consumed = new Set<LayoutEdge>();
  for (const first of at(p)) {
    if (consumed.has(first))
      continue;
    const path: LayoutPath = { nodes: [p], edges: [] };
    let edge = first;
    node = p;
    for (let step = 0; step <= passive.length; step++) {
      if (consumed.has(edge))
        break;
      consumed.add(edge);
      path.edges.push(edge.index);
      node = other(edge, node);
      path.nodes.push(node);
      if (node === q)
        break;
      const incident = at(node);
      if (node === p || incident.length !== 2)
        break;
      edge = incident.find(e => e !== edge)!;
    }
    if (node !== q)
      return fail('branch-or-cycle');
    paths.push(path);
  }
  if (paths.length >= 2 && consumed.size === passive.length) {
    const rcBranches = paths.every(path => {
      const types = path.edges.map(index => edges[index]!.type);
      if (types.some(type => type !== 'R' && type !== 'C')) return false;
      if (types.length === 1) return true;
      return types.length === 2 && types[0] !== types[1];
    });
    const foster = !source && rcBranches && paths.some(path => path.edges.length === 2);
    return { status: 'recognized', witness: { family: foster ? 'foster-II' : 'parallel', p, q, ...sourceField, paths } };
  }
  return fail('no-supported-pattern');
}
