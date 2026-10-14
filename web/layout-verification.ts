import type { NativeDocument } from '../src/model.js';
import { geometryDiagnostics, vertexPoint, wirePoints, type Point, type WiringGraph } from './wiring-graph.js';
import { documentMeaning, nativeCandidate } from './wiring-native.js';
import { exportProject, type ProjectResult } from './project-format.js';
export interface LayoutEvidence {
  nativeEqual: boolean;
  projectValid: boolean;
  geometryComplete: boolean;
  segmentCount: number;
  segmentPairs: number;
  issues: string[];
}
const equal = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
const inside = (p: Point, b: Box) => p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom;
function touches(a: Point, b: Point, box: Box): boolean {
  return Math.max(Math.min(a.x, b.x), box.left) <= Math.min(Math.max(a.x, b.x), box.right)
    && Math.max(Math.min(a.y, b.y), box.top) <= Math.min(Math.max(a.y, b.y), box.bottom);
}
/** Independent, exhaustive checks for the bounded orthogonal candidate domain.
 * Unlike the legacy warning scan, every pair is inspected. Inflated symbol
 * boxes include visible stroke clearance. Junctions require a shared vertex,
 * not merely an equal net name or coincident coordinates. This is a drawing
 * contract, not a numerical or electromagnetic circuit test. */
export function verifyLayout(document: NativeDocument, graph: WiringGraph): {
  evidence: LayoutEvidence;
  project: ProjectResult;
} {
  const issues: string[] = [];
  const candidate = nativeCandidate(graph);
  const nativeEqual = candidate.status === 'ok' && documentMeaning(candidate.document) === documentMeaning(document);
  if (!nativeEqual)
    issues.push('native-content-changed');
  const project = exportProject(graph);
  if (project.status !== 'ok')
    issues.push('project-invalid');
  const evidence: LayoutEvidence = { nativeEqual, projectValid: project.status === 'ok', geometryComplete: false, segmentCount: 0, segmentPairs: 0, issues };
  if (geometryDiagnostics(graph).length || graph.devices.length > 16 || graph.vertices.length > 240 || graph.edges.length > 320
    || graph.routes.some(r => r.bends.length > 16)) {
    issues.push('geometry-domain');
    return { evidence, project };
  }
  const segments = graph.edges.flatMap(edge => {
    const points = wirePoints(graph, edge.key);
    return points.slice(1).map((b, index) => ({ a: points[index]!, b, edge, index, count: points.length - 1 }));
  });
  evidence.segmentCount = segments.length;
  if (segments.length > 512) {
    issues.push('segment-limit');
    return { evidence, project };
  }
  const vertices = graph.vertices.map(v => ({ vertex: v, point: vertexPoint(graph, v.key) }));
  const bodies = graph.placements.map(p => ({ key: p.key, left: p.x - 24, right: p.x + 24, top: p.y - 24, bottom: p.y + 24 }));
  const labels = graph.devices.map(d => {
    const p = graph.placements.find(p => p.key === d.key)!;
    // Ordinary rendered ID/value text, conservative 9-unit glyph advance.
    // Very long exact IDs remain in the unchanged SVG title/topology metadata.
    const text = (d.id.length > 18 ? d.id.slice(0, 15) + '…' : d.id) + ' · ' + (d.value ?? d.type);
    const half = text.length * 9 / 2 + 4;
    return { left: p.x - half, right: p.x + half, top: p.y + 34, bottom: p.y + 54 };
  });
  for (let i = 0; i < bodies.length; i++) {
    const box = bodies[i]!;
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j]!;
      if (box.left <= b.right && b.left <= box.right && box.top <= b.bottom && b.top <= box.bottom)
        issues.push('symbol-overlap');
    }
    for (const { vertex, point } of vertices) {
      if (vertex.kind === 'terminal' && vertex.device === box.key)
        continue;
      if (inside(point, box))
        issues.push('hidden-vertex');
    }
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i]!, b = labels[j]!;
      if (a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom)
        issues.push('label-overlap');
    }
    for (const label of labels) {
      if (box.left <= label.right && label.left <= box.right && box.top <= label.bottom && label.top <= box.bottom)
        issues.push('label-symbol-overlap');
    }
  }
  for (const line of segments) {
    if (equal(line.a, line.b))
      issues.push('zero-segment');
    if (line.a.x !== line.b.x && line.a.y !== line.b.y)
      issues.push('non-orthogonal');
    for (const box of bodies)
      if (touches(line.a, line.b, box))
        issues.push('wire-through-symbol');
    for (const box of labels)
      if (touches(line.a, line.b, box))
        issues.push('wire-through-value-label');
    for (const { vertex, point } of vertices) {
      if (vertex.key === line.edge.a || vertex.key === line.edge.b)
        continue;
      if (touches(line.a, line.b, { left: point.x - 6, right: point.x + 6, top: point.y - 6, bottom: point.y + 6 }))
        issues.push('unjoined-or-hidden-vertex');
    }
  }
  for (let i = 0; i < segments.length; i++) {
    const a = segments[i]!;
    for (let j = i + 1; j < segments.length; j++) {
      evidence.segmentPairs++;
      const b = segments[j]!;
      const left = Math.max(Math.min(a.a.x, a.b.x), Math.min(b.a.x, b.b.x));
      const right = Math.min(Math.max(a.a.x, a.b.x), Math.max(b.a.x, b.b.x));
      const top = Math.max(Math.min(a.a.y, a.b.y), Math.min(b.a.y, b.b.y));
      const bottom = Math.min(Math.max(a.a.y, a.b.y), Math.max(b.a.y, b.b.y));
      if (left > right || top > bottom) {
        const gap = Math.hypot(Math.max(0, left - right), Math.max(0, top - bottom));
        if (gap < 4)
          issues.push('wire-stroke-clearance');
        continue;
      }
      const point = { x: left, y: top };
      const shared = [a.edge.a, a.edge.b].find(key => key === b.edge.a || key === b.edge.b);
      const explicit = shared && equal(vertexPoint(graph, shared), point);
      const adjacentBend = a.edge.key === b.edge.key && Math.abs(a.index - b.index) === 1;
      if (left !== right || top !== bottom || (!explicit && !adjacentBend))
        issues.push('ambiguous-wire-intersection');
    }
  }
  for (const edge of graph.edges) {
    const points = wirePoints(graph, edge.key);
    for (let i = 1; i < points.length - 1; i++) {
      const a = points[i - 1]!, b = points[i]!, c = points[i + 1]!;
      if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y))
        issues.push('unnecessary-bend');
    }
  }
  const all = [...vertices.map(v => v.point), ...graph.routes.flatMap(r => r.bends)];
  const width = Math.max(...all.map(p => p.x)) - Math.min(...all.map(p => p.x)) + 180;
  const height = Math.max(...all.map(p => p.y)) - Math.min(...all.map(p => p.y)) + 180;
  if (Math.max(width / height, height / width) > 6)
    issues.push('aspect-ratio');
  evidence.geometryComplete = true;
  evidence.issues = [...new Set(issues)];
  return { evidence, project };
}
