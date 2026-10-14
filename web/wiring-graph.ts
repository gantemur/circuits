/** Explicit editor connectivity. Coordinates never determine electrical nets. */
export type Handle = string;
export type DeviceType = 'R' | 'C' | 'L' | 'V' | 'I';
export interface Point { x: number; y: number }
export interface Device {
  key: Handle; id: string; type: DeviceType; label?: string; value?: string;
  terminals: { role: 'p' | 'n'; vertex: Handle }[];
}
export type Vertex = { key: Handle; kind: 'junction' | 'free' }
  | { key: Handle; kind: 'terminal'; device: Handle; role: 'p' | 'n'; completion: 'pending' | 'open' | 'connected' };
export interface Edge { key: Handle; a: Handle; b: Handle }
export interface NameAnchor { key: Handle; vertex: Handle; name: string }
export type WaveformDraft = { type: 'constant'; value: string }
  | { type: 'step'; at: string; before: string; after: string }
  | { type: 'sinusoid'; offset: string; amplitudePeak: string; frequencyHz: string; phaseRadians: string };
export interface SourceDraft { key: Handle; device: Handle; dc: string; ac?: { re: string; im: string }; waveform?: WaveformDraft }
export type ObservationDraft = { key: Handle; id: string; label?: string; type: 'voltage'; p: Handle; n: Handle }
  | { key: Handle; id: string; label?: string; type: 'current'; device: Handle };
export interface Placement extends Point { key: Handle; turns: number }
export interface WiringGraph {
  next: number; reference: Handle; circuitLabel?: string; experimentLabel?: string;
  devices: Device[]; vertices: Vertex[]; edges: Edge[]; names: NameAnchor[];
  sources: SourceDraft[]; observations: ObservationDraft[];
  initial: 'equilibrium' | 'storage'; storage: { key: Handle; device: Handle; value: string }[];
  placements: Placement[]; points: (Point & { key: Handle })[];
  routes: { key: Handle; bends: Point[] }[];
}
export interface Diagnostic { category: 'completion' | 'naming' | 'dependency' | 'validation' | 'geometry' | 'conflict'; code: string; handles: Handle[]; message: string; params?: Readonly<Record<string, string | number>> }
export class WiringError extends Error {
  constructor(readonly diagnostic: Diagnostic) { super(diagnostic.message); }
}
export function reject(category: Diagnostic['category'], code: string, message: string, ...handles: Handle[]): never {
  throw new WiringError({ category, code, handles, message });
}
export function diagnostic(error: unknown): Diagnostic {
  if (error instanceof WiringError) return error.diagnostic;
  return { category: 'validation', code: 'invalid-native', handles: [], message: error instanceof Error ? error.message : String(error) };
}
export function handle(graph: WiringGraph): Handle { return `h${graph.next++}`; }
export function required<T extends { key: Handle }>(items: T[], key: Handle): T {
  const item = items.find(value => value.key === key);
  if (!item) reject('dependency', 'missing-handle', `Missing graph handle ${key}`, key);
  return item;
}
export function emptyWiring(initial: WiringGraph['initial'] = 'equilibrium'): WiringGraph {
  return { next: 3, reference: 'h1', devices: [], vertices: [{ key: 'h1', kind: 'junction' }],
    edges: [], names: [{ key: 'h2', vertex: 'h1', name: '0' }], sources: [], observations: [],
    initial, storage: [], placements: [], points: [{ key: 'h1', x: 0, y: 100 }], routes: [] };
}

/** Breadth-first traversal is O(vertices + wires). Device terminals are ordinary
 * vertices: there is deliberately no adjacency through the constitutive law. */
export function partitions(graph: WiringGraph): Handle[][] {
  const adjacent = new Map(graph.vertices.map(vertex => [vertex.key, [] as Handle[]]));
  if (adjacent.size !== graph.vertices.length) reject('validation', 'duplicate-handle', 'Duplicate vertex handle');
  for (const edge of graph.edges) {
    if (!adjacent.has(edge.a) || !adjacent.has(edge.b)) reject('dependency', 'wire-endpoint', 'Wire has missing endpoint', edge.key);
    adjacent.get(edge.a)!.push(edge.b);
    adjacent.get(edge.b)!.push(edge.a);
  }
  const visited = new Set<Handle>();
  const result: Handle[][] = [];
  for (const vertex of graph.vertices) {
    if (visited.has(vertex.key)) continue;
    const queue = [vertex.key];
    visited.add(vertex.key);
    for (let index = 0; index < queue.length; index++) {
      for (const neighbor of adjacent.get(queue[index]!)!) {
        if (!visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); }
      }
    }
    result.push(queue);
  }
  return result;
}
export function freshName(graph: WiringGraph, prefix = 'n'): string {
  const used = new Set(graph.names.map(anchor => anchor.name));
  let index = 1;
  while (used.has(`${prefix}${index}`)) index++;
  return `${prefix}${index}`;
}
/** Keep anchors on their physical vertices. New split fragments receive fresh
 * names, and merges require an explicit choice instead of an arbitrary winner. */
export function reconcileNames(graph: WiringGraph, survivor?: string): void {
  for (const net of partitions(graph)) {
    const anchors = graph.names.filter(anchor => net.includes(anchor.vertex));
    if (!anchors.length) {
      graph.names.push({ key: handle(graph), vertex: net[0]!, name: freshName(graph) });
      continue;
    }
    if (anchors.length === 1) continue;
    const ground = net.includes(graph.reference);
    const winner = ground ? anchors.find(anchor => anchor.name === '0')
      : anchors.find(anchor => anchor.name === survivor);
    if (!winner) reject('naming', 'merge-choice', 'Choose the surviving name of the merged nets', ...anchors.map(anchor => anchor.key));
    if (ground) winner.vertex = graph.reference;
    graph.names = graph.names.filter(anchor => !anchors.includes(anchor) || anchor === winner);
  }
}
export function netNames(graph: WiringGraph): Map<Handle, string> {
  const result = new Map<Handle, string>();
  const used = new Set<string>();
  for (const net of partitions(graph)) {
    const anchors = graph.names.filter(anchor => net.includes(anchor.vertex));
    if (anchors.length !== 1 || !anchors[0]!.name.length || used.has(anchors[0]!.name))
      reject('naming', 'net-name', 'Each net needs one unique nonempty name', ...net);
    const name = anchors[0]!.name;
    if ((name === '0') !== net.includes(graph.reference)) reject('naming', 'reference', 'Only the reference net may be named 0', ...net);
    used.add(name);
    for (const vertex of net) result.set(vertex, name);
  }
  if (!result.has(graph.reference)) reject('naming', 'reference', 'Missing reference anchor');
  return result;
}
export const COORDINATE_LIMIT = 1e6;
export const MAX_BENDS = 64;
export function checkPoint(point: Point): void {
  if (![point.x, point.y].every(value => Number.isFinite(value) && Math.abs(value) <= COORDINATE_LIMIT))
    reject('geometry', 'coordinate', 'Coordinates must be finite and within ±1000000');
}
/** p is initially left of n. Quarter turns rotate their positions, never roles. */
export function vertexPoint(graph: WiringGraph, key: Handle): Point {
  const vertex = required(graph.vertices, key);
  if (vertex.kind !== 'terminal') {
    const point = required(graph.points, key);
    return { x: point.x, y: point.y };
  }
  const placement = required(graph.placements, vertex.device);
  const offset = vertex.role === 'p' ? -30 : 30;
  const axes = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
  const [dx, dy] = axes[placement.turns]!;
  return { x: placement.x + offset * dx, y: placement.y + offset * dy };
}
export function wirePoints(graph: WiringGraph, key: Handle): Point[] {
  const edge = required(graph.edges, key);
  return [vertexPoint(graph, edge.a), ...required(graph.routes, key).bends, vertexPoint(graph, edge.b)];
}
export function geometryDiagnostics(graph: WiringGraph): Diagnostic[] {
  try {
    for (const placement of graph.placements) {
      checkPoint(placement);
      if (!Number.isInteger(placement.turns) || placement.turns < 0 || placement.turns > 3)
        reject('geometry', 'rotation', 'Rotation must be an integer quarter turn');
    }
    for (const vertex of graph.vertices) checkPoint(vertexPoint(graph, vertex.key));
    for (const edge of graph.edges) {
      const route = required(graph.routes, edge.key);
      if (route.bends.length > MAX_BENDS) reject('geometry', 'route-limit', 'Too many bends', edge.key);
      route.bends.forEach(checkPoint);
    }
    return [];
  } catch (error) { return [{ ...diagnostic(error), category: 'geometry' }]; }
}
