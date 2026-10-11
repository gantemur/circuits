import type { ResistorNetwork } from '../src/kron.js';

const escapeHtml = (value: unknown): string => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export interface Position { x: number; y: number }
export type Positions = Record<string, Position>;
export interface NetworkDrawingOptions {
  positions?: Positions;
  retained?: string[];
  removed?: string[];
  generated?: string[];
  eliminated?: string[];
  introduced?: string[];
  selectedComponent?: string | null;
  selectable?: boolean;
  label: string;
}

type Segment = [Position, Position];
interface RoutedEdge {
  edge: ResistorNetwork['edges'][number];
  segments: Segment[];
  crossingSegments: Segment[];
  center: Position;
  angle: number;
}

const e = escapeHtml;
const value = (n: number): string => n === 0 ? '0' : Number(n.toPrecision(6)).toString();
const shownId = (id: string): string => /[\s,:"']/u.test(id) ? JSON.stringify(id) : id;
const point = (x: number, y: number): Position => ({ x, y });
const cross = (a: Position, b: Position): number => a.x * b.y - a.y * b.x;
const difference = (a: Position, b: Position): Position => point(a.x - b.x, a.y - b.y);
const distance = (a: Position, b: Position): number => Math.hypot(a.x - b.x, a.y - b.y);

function pointToSegmentDistance(p: Position, [a, b]: Segment): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(p, a);
  const fraction = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return distance(p, point(a.x + fraction * dx, a.y + fraction * dy));
}

/** Crossings or overlapping wire runs without a junction dot are ambiguous. */
function segmentIntersection(first: Segment, second: Segment): Position | null {
  const direction = difference(first[1], first[0]);
  const otherDirection = difference(second[1], second[0]);
  const denominator = cross(direction, otherDirection);
  const originDifference = difference(second[0], first[0]);
  if (Math.abs(denominator) < 1e-9) {
    if (Math.abs(cross(originDifference, direction)) >= 1e-9) return null;
    const lengthSquared = direction.x * direction.x + direction.y * direction.y;
    if (lengthSquared === 0) return null;
    const firstEnd = (originDifference.x * direction.x + originDifference.y * direction.y) / lengthSquared;
    const otherEnd = difference(second[1], first[0]);
    const secondEnd = (otherEnd.x * direction.x + otherEnd.y * direction.y) / lengthSquared;
    const lower = Math.max(0, Math.min(firstEnd, secondEnd));
    const upper = Math.min(1, Math.max(firstEnd, secondEnd));
    if (upper - lower <= 1e-6) return null;
    const midpoint = (lower + upper) / 2;
    return point(first[0].x + midpoint * direction.x, first[0].y + midpoint * direction.y);
  }
  const alongFirst = cross(originDifference, otherDirection) / denominator;
  const alongSecond = cross(originDifference, direction) / denominator;
  if (alongFirst < -1e-6 || alongFirst > 1 + 1e-6 || alongSecond < -1e-6 || alongSecond > 1 + 1e-6) return null;
  return point(first[0].x + alongFirst * direction.x, first[0].y + alongFirst * direction.y);
}

/** Retained terminals stay fixed. Two-terminal internals alternate above/below the direct path. */
export function networkPositions(network: ResistorNetwork, retained: string[]): Positions {
  // A null-prototype dictionary keeps native IDs such as "__proto__" as ordinary keys.
  const positions = Object.create(null) as Positions;
  const boundary = retained.filter(id => network.nodes.includes(id));
  if (boundary.length === 2) {
    positions[boundary[0]!] = point(95, 160);
    positions[boundary[1]!] = point(585, 160);
  } else {
    boundary.forEach((id, index) => {
      const angle = -Math.PI / 2 + 2 * Math.PI * index / boundary.length;
      positions[id] = point(340 + 240 * Math.cos(angle), 160 + 105 * Math.sin(angle));
    });
  }
  const internal = network.nodes.filter(id => !boundary.includes(id)).sort();
  internal.forEach((id, index) => {
    if (boundary.length === 2) {
      const row = Math.floor(index / 2);
      positions[id] = point(340 + (row % 2 ? 55 : -55), index % 2 ? 245 : 75);
    } else {
      const angle = internal.length === 1 ? 0 : 2 * Math.PI * index / internal.length;
      positions[id] = point(340 + 75 * Math.cos(angle), 160 + 60 * Math.sin(angle));
    }
  });
  return positions;
}

/** A bounded drawing: unsafe geometry is rejected so callers can show exact topology tables. */
export function resistorNetworkSvg(network: ResistorNetwork, options: NetworkDrawingOptions): string | null {
  const positions = options.positions ?? networkPositions(network, options.retained ?? []);
  if (network.nodes.some(id => !positions[id] || !Number.isFinite(positions[id]!.x) || !Number.isFinite(positions[id]!.y))) return null;
  const retained = new Set(options.retained ?? []);
  const removed = new Set(options.removed ?? []);
  const generated = new Set(options.generated ?? []);
  const eliminated = new Set(options.eliminated ?? []);
  const introduced = new Set(options.introduced ?? []);
  const pairCounts = new Map<string, number>();
  const pairs = new Map<string, number>();
  for (const edge of network.edges) {
    const key = JSON.stringify([edge.p, edge.n].sort());
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }

  const routes: RoutedEdge[] = [];
  for (const edge of network.edges) {
    const a = positions[edge.p], b = positions[edge.n];
    if (!a || !b) return null;
    const key = JSON.stringify([edge.p, edge.n].sort());
    const rank = pairs.get(key) ?? 0;
    pairs.set(key, rank + 1);
    const offset = (rank - ((pairCounts.get(key) ?? 1) - 1) / 2) * 25;
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length < 90) return null; // The 62 px symbol needs visible leads.
    const ux = dx / length, uy = dy / length;
    const normalX = -uy, normalY = ux;
    const start = point(a.x + normalX * offset, a.y + normalY * offset);
    const end = point(b.x + normalX * offset, b.y + normalY * offset);
    const center = point((start.x + end.x) / 2, (start.y + end.y) / 2);
    const left = point(center.x - ux * 31, center.y - uy * 31);
    const right = point(center.x + ux * 31, center.y + uy * 31);
    const segments: Segment[] = [[a, start], [start, left], [right, end], [end, b]];
    // Test the complete branch, including its symbol, against every unrelated
    // node. A branch may touch only its own two terminal centers.
    for (const id of network.nodes) {
      if (id === edge.p || id === edge.n) continue;
      const node = positions[id]!;
      if (segments.some(segment => pointToSegmentDistance(node, segment) < 13)) return null;
      const relative = difference(node, center);
      const along = Math.abs(relative.x * ux + relative.y * uy);
      const across = Math.abs(relative.x * normalX + relative.y * normalY);
      if (along < 44 && across < 23) return null;
    }
    routes.push({ edge, segments, crossingSegments:[[a,start],[start,end],[end,b]], center,
      angle: Math.atan2(dy, dx) * 180 / Math.PI });
  }

  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      const first = routes[i]!, second = routes[j]!;
      for (const a of first.crossingSegments) for (const b of second.crossingSegments) {
        const crossing = segmentIntersection(a, b);
        if (!crossing) continue;
        const shared = [first.edge.p, first.edge.n].filter(id => id === second.edge.p || id === second.edge.n);
        if (shared.some(id => distance(crossing, positions[id]!) < 13)) continue;
        return null;
      }
    }
  }

  const branches = routes.map(({edge, segments, center, angle}) => {
    const kind = removed.has(edge.id) ? 'removed' : generated.has(edge.id) ? 'generated' : 'unchanged';
    const selected = options.selectedComponent === edge.id;
    const label = `${shownId(edge.id)}: ${value(edge.resistance)} Ω; ${shownId(edge.p)} → ${shownId(edge.n)}`;
    const interaction = options.selectable ? `role="button" tabindex="0" data-schematic-component="${e(edge.id)}" aria-label="${e(label)}"` : '';
    const wires = segments.map(([a,b]) => `M${a.x} ${a.y}L${b.x} ${b.y}`).join('');
    return `<g class="network-edge ${kind}${selected ? ' selected' : ''}" ${interaction}><title>${e(label)}</title>`+
      `<path class="network-wire" d="${wires}"/>`+
      `<rect class="network-resistor" x="${center.x - 31}" y="${center.y - 10}" width="62" height="20" rx="2" transform="rotate(${angle} ${center.x} ${center.y})"/>`+
      `<text class="network-edge-label" x="${center.x}" y="${center.y - 25}" text-anchor="middle">${e(shownId(edge.id))} · ${e(value(edge.resistance))} Ω</text></g>`;
  }).join('');
  const nodes = network.nodes.map(id => {
    const at = positions[id]!;
    const kind = eliminated.has(id) ? 'eliminated' : introduced.has(id) ? 'introduced' : retained.has(id) ? 'retained' : '';
    const ground = id === '0' ? `<path class="network-ground" d="M${at.x} ${at.y + 6}v15m-15 0h30m-11 5h22m-7 5h14"/>` : '';
    return `<g class="network-node ${kind}"><circle cx="${at.x}" cy="${at.y}" r="5"/><text x="${at.x}" y="${at.y - 15}" text-anchor="middle">${e(shownId(id))}</text>${ground}</g>`;
  }).join('');
  return `<svg class="network-diagram" viewBox="0 0 680 320" role="img" aria-label="${e(options.label)}"><rect width="680" height="320" fill="#fafcf9"/>${branches}${nodes}</svg>`;
}
