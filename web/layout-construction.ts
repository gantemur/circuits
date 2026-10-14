import type { NativeDocument } from '../src/model.js';
import { handle, vertexPoint, wirePoints, type Point, type WiringGraph } from './wiring-graph.js';
import { importWiring } from './wiring-native.js';
import type { LayoutWitness } from './layout-recognition.js';
const equal = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const onSegment = (p: Point, a: Point, b: Point) => (a.x === b.x && p.x === a.x && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y)) ||
  (a.y === b.y && p.y === a.y && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x));
/** Fixed template grid, in drawing units (not SI). Native import carries all
 * scientific fields. Only its provisional wires/geometry are replaced.
 * Named-net rails are explicitly prescribed by the witness; geometric crossings
 * between different nets are never joined. Verification is a separate layer. */
export function constructLayout(document: NativeDocument, witness: LayoutWitness): WiringGraph {
  const imported = importWiring(document);
  if (imported.status !== 'editable')
    throw new Error('Unsupported layout witness');
  const graph = imported.graph;
  graph.edges = [];
  graph.routes = [];
  const anchors = new Map(graph.names.map(n => [n.name, n.vertex]));
  const locations = new Map<string, {
    point: Point;
    key: string;
  }[]>();
  const vertexNets = new Map<string, string>();
  const assigned = new Set<number>();
  function junction(node: string, point: Point): string {
    const locationsOnNet = locations.get(node) ?? [];
    const existing = locationsOnNet.find(item => equal(item.point, point));
    if (existing)
      return existing.key;
    const key = locationsOnNet.length ? handle(graph) : anchors.get(node)!;
    if (locationsOnNet.length) {
      graph.vertices.push({ key, kind: 'junction' });
      graph.points.push({ key, ...point });
    }
    else
      Object.assign(graph.points.find(p => p.key === key)!, point);
    locationsOnNet.push({ key, point });
    locations.set(node, locationsOnNet);
    vertexNets.set(key, node);
    return key;
  }
  function wire(a: string, b: string, bends: Point[] = []): void {
    const key = handle(graph);
    graph.edges.push({ key, a, b });
    graph.routes.push({ key, bends });
  }
  function rail(node: string, a: Point, b: Point): void {
    if (!equal(a, b))
      wire(junction(node, a), junction(node, b));
  }
  function device(index: number, a: string, start: Point, b: string, end: Point): void {
    if (assigned.has(index))
      throw new Error('Witness repeats a device');
    assigned.add(index);
    const native = document.circuit.components[index]!;
    if (!((native.p === a && native.n === b) || (native.p === b && native.n === a)))
      throw new Error('Witness changes terminal membership');
    const horizontal = start.y === end.y;
    if (!horizontal && start.x !== end.x)
      throw new Error('Template device axis must be orthogonal');
    const x = (start.x + end.x) / 2, y = (start.y + end.y) / 2;
    const forward = native.p === a;
    const direction = horizontal ? (end.x > start.x ? 0 : 2) : (end.y > start.y ? 1 : 3);
    const item = graph.devices[index]!;
    Object.assign(graph.placements[index]!, { x, y, turns: (direction + (forward ? 0 : 2)) % 4 });
    const first = item.terminals.find(t => t.role === (forward ? 'p' : 'n'))!.vertex;
    const last = item.terminals.find(t => t.role === (forward ? 'n' : 'p'))!.vertex;
    vertexNets.set(first, a);
    vertexNets.set(last, b);
    wire(junction(a, start), first);
    // The unchanged editor renderer puts an upright value label below every
    // symbol. A vertical lower lead therefore takes a small rectangular detour
    // outside that reserved label box instead of running through the text.
    const lower = vertexPoint(graph, last);
    const bends = !horizontal && end.y > start.y
      ? [{ x: x + 180, y: lower.y }, { x: x + 180, y: y + 90 }, { x, y: y + 90 }] : [];
    wire(last, junction(b, end), bends);
  }
  const { p, q } = witness;
  if (witness.family === 'chain' || witness.family === 'cauer') {
    const offset = witness.source !== undefined && witness.stages[0]?.shunt !== undefined ? 400 : 0;
    if (witness.source !== undefined) {
      device(witness.source, p, { x: 0, y: 0 }, q, { x: 0, y: 400 });
      rail(p, { x: 0, y: 0 }, { x: offset, y: 0 });
    }
    let lastX = 0;
    for (const [index, stage] of witness.stages.entries()) {
      const x = offset + index * 400;
      if (stage.shunt !== undefined)
        device(stage.shunt, stage.node, { x, y: 0 }, q, { x, y: 400 });
      if (stage.series !== undefined)
        device(stage.series, stage.node, { x, y: 0 }, stage.next!, { x: x + 400, y: 0 });
      lastX = x;
    }
    rail(q, { x: 0, y: 400 }, { x: lastX, y: 400 });
    // Source-free starting series sections need no artificial dangling return.
    // Such unused construction anchors are removed below, not scientific nodes.
  }
  else if (witness.family === 'bridge') {
    const [left, right] = witness.midpoints;
    const [tl, bl, tr, br] = witness.arms;
    device(tl, p, { x: 600, y: 0 }, left, { x: 600, y: 300 });
    device(bl, left, { x: 600, y: 300 }, q, { x: 600, y: 600 });
    device(tr, p, { x: 1200, y: 0 }, right, { x: 1200, y: 300 });
    device(br, right, { x: 1200, y: 300 }, q, { x: 1200, y: 600 });
    device(witness.cross, left, { x: 600, y: 300 }, right, { x: 1200, y: 300 });
    rail(p, { x: 600, y: 0 }, { x: 1200, y: 0 });
    rail(q, { x: 600, y: 600 }, { x: 1200, y: 600 });
    if (witness.source !== undefined) {
      device(witness.source, p, { x: 0, y: 0 }, q, { x: 0, y: 600 });
      rail(p, { x: 0, y: 0 }, { x: 600, y: 0 });
      rail(q, { x: 0, y: 600 }, { x: 600, y: 600 });
    }
  }
  else if (witness.family === 'foster-I') {
    for (const [index, section] of witness.sections.entries()) {
      const x = index * 400;
      if (section.edges.length === 1)
        device(section.edges[0]!, section.a, { x, y: 0 }, section.b, { x: x + 400, y: 0 });
      else {
        for (const [row, edge] of section.edges.entries()) {
          const y = row * 200 - 100;
          device(edge, section.a, { x: x + 80, y }, section.b, { x: x + 320, y });
          rail(section.a, { x, y }, { x: x + 80, y });
          rail(section.b, { x: x + 320, y }, { x: x + 400, y });
        }
        rail(section.a, { x, y: -100 }, { x, y: 100 });
        rail(section.b, { x: x + 400, y: -100 }, { x: x + 400, y: 100 });
        junction(section.a, { x, y: 0 });
        junction(section.b, { x: x + 400, y: 0 });
      }
    }
  }
  else if ('paths' in witness) {
    const width = Math.max(...witness.paths.map(path => path.edges.length)) * 400 + 160;
    for (const [row, path] of witness.paths.entries()) {
      const y = row * 220;
      const cell = (width - 160) / path.edges.length;
      for (const [index, edge] of path.edges.entries())
        device(edge, path.nodes[index]!, { x: 80 + index * cell, y }, path.nodes[index + 1]!, { x: 80 + (index + 1) * cell, y });
      rail(p, { x: 0, y }, { x: 80, y });
      rail(q, { x: width - 80, y }, { x: width, y });
    }
    const height = (witness.paths.length - 1) * 220;
    rail(p, { x: 0, y: 0 }, { x: 0, y: height });
    rail(q, { x: width, y: 0 }, { x: width, y: height });
    if (witness.source !== undefined) {
      device(witness.source, p, { x: 80, y: -220 }, q, { x: width - 80, y: -220 });
      rail(p, { x: 0, y: -220 }, { x: 80, y: -220 });
      rail(q, { x: width - 80, y: -220 }, { x: width, y: -220 });
      rail(p, { x: 0, y: -220 }, { x: 0, y: 0 });
      rail(q, { x: width, y: -220 }, { x: width, y: 0 });
    }
  }
  if (assigned.size !== document.circuit.components.length)
    throw new Error('Witness omits devices');
  // Retain unused *native* nodes as separate, visible named dots below the circuit.
  let unused = 0;
  const bottom = Math.max(...graph.points.map(p => p.y), ...graph.placements.map(p => p.y)) + 180;
  for (const node of document.circuit.nodes) {
    if (!locations.has(node))
      junction(node, { x: unused++ * 300, y: bottom });
  }
  // Split prescribed same-net rails at explicit junctions. Duplicate shared rail
  // pieces are emitted only once. This does not connect different native nets.
  const oldEdges = graph.edges;
  const oldRoutes = graph.routes;
  graph.edges = [];
  graph.routes = [];
  const seen = new Set<string>();
  for (const edge of oldEdges) {
    const points = wirePoints({ ...graph, edges: oldEdges, routes: oldRoutes }, edge.key);
    let previous = edge.a;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!, b = points[i]!;
      const node = vertexNets.get(edge.a)!;
      const intermediate = (locations.get(node) ?? []).filter(v => onSegment(v.point, a, b) && !equal(v.point, a) && !equal(v.point, b))
        .sort((u, v) => Math.abs(u.point.x - a.x) + Math.abs(u.point.y - a.y) - Math.abs(v.point.x - a.x) - Math.abs(v.point.y - a.y));
      const end = i === points.length - 1 ? edge.b : junction(node, b);
      for (const next of [...intermediate.map(v => v.key), end]) {
        const identity = JSON.stringify([previous, next].sort());
        if (previous !== next && !seen.has(identity)) {
          wire(previous, next);
          seen.add(identity);
        }
        previous = next;
      }
    }
  }
  // Degree-two construction points become bends, reducing repeated net labels.
  // Native anchors and branch junctions remain explicit and inspectable.
  const protectedVertices = new Set(graph.names.map(n => n.vertex));
  for (const vertex of [...graph.vertices]) {
    if (vertex.kind === 'terminal' || protectedVertices.has(vertex.key))
      continue;
    const incident = graph.edges.filter(e => e.a === vertex.key || e.b === vertex.key);
    if (incident.length !== 2)
      continue;
    const [first, second] = incident;
    const a = first!.a === vertex.key ? first!.b : first!.a;
    const b = second!.a === vertex.key ? second!.b : second!.a;
    const path1 = wirePoints(graph, first!.key);
    const path2 = wirePoints(graph, second!.key);
    if (first!.a === vertex.key)
      path1.reverse();
    if (second!.b === vertex.key)
      path2.reverse();
    const points = [...path1, ...path2.slice(1)];
    const simplified = points.filter((point, index) => index === 0 || index === points.length - 1 ||
      !onSegment(point, points[index - 1]!, points[index + 1]!));
    graph.edges = graph.edges.filter(e => !incident.includes(e));
    graph.routes = graph.routes.filter(r => !incident.some(e => e.key === r.key));
    graph.vertices = graph.vertices.filter(v => v.key !== vertex.key);
    graph.points = graph.points.filter(p => p.key !== vertex.key);
    wire(a, b, simplified.slice(1, -1));
  }
  return graph;
}
