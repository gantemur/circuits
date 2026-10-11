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

const e = escapeHtml;
const value = (n: number): string => n === 0 ? '0' : Number(n.toPrecision(6)).toString();
const shownId = (id: string): string => /[\s,:"']/u.test(id) ? JSON.stringify(id) : id;

/** Keep retained terminals fixed in both pictures; place hidden nodes deterministically. */
export function networkPositions(network: ResistorNetwork, retained: string[]): Positions {
  const positions: Positions = {};
  const boundary = retained.filter(id => network.nodes.includes(id));
  if (boundary.length === 2) {
    positions[boundary[0]!] = { x: 95, y: 160 };
    positions[boundary[1]!] = { x: 585, y: 160 };
  } else {
    boundary.forEach((id, index) => {
      const angle = -Math.PI / 2 + 2 * Math.PI * index / boundary.length;
      positions[id] = { x: 340 + 240 * Math.cos(angle), y: 160 + 105 * Math.sin(angle) };
    });
  }
  const internal = network.nodes.filter(id => !boundary.includes(id)).sort();
  internal.forEach((id, index) => {
    const angle = internal.length === 1 ? 0 : 2 * Math.PI * index / internal.length;
    positions[id] = { x: 340 + 75 * Math.cos(angle), y: 160 + 60 * Math.sin(angle) };
  });
  return positions;
}

/** Exact graph drawing, not an electrical autorouter. Each edge is a real resistor. */
export function resistorNetworkSvg(network: ResistorNetwork, options: NetworkDrawingOptions): string {
  const positions = options.positions ?? networkPositions(network, options.retained ?? []);
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
  const branches = network.edges.map(edge => {
    const a = positions[edge.p], b = positions[edge.n];
    if (!a || !b) return '';
    const key = JSON.stringify([edge.p, edge.n].sort());
    const rank = pairs.get(key) ?? 0;
    pairs.set(key, rank + 1);
    const offset = (rank - ((pairCounts.get(key) ?? 1) - 1) / 2) * 25;
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) return '';
    const normalX = -dy / length, normalY = dx / length;
    const start = { x: a.x + normalX * offset, y: a.y + normalY * offset };
    const end = { x: b.x + normalX * offset, y: b.y + normalY * offset };
    const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const ux = dx / length, uy = dy / length;
    const left = { x: center.x - ux * 31, y: center.y - uy * 31 };
    const right = { x: center.x + ux * 31, y: center.y + uy * 31 };
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const kind = removed.has(edge.id) ? 'removed' : generated.has(edge.id) ? 'generated' : 'unchanged';
    const selected = options.selectedComponent === edge.id;
    const label = `${shownId(edge.id)}: ${value(edge.resistance)} Ω; ${shownId(edge.p)} → ${shownId(edge.n)}`;
    const interaction = options.selectable ? `role="button" tabindex="0" data-schematic-component="${e(edge.id)}" aria-label="${e(label)}"` : '';
    return `<g class="network-edge ${kind}${selected ? ' selected' : ''}" ${interaction}><title>${e(label)}</title>`+
      `<path class="network-wire" d="M${start.x} ${start.y}L${left.x} ${left.y}M${right.x} ${right.y}L${end.x} ${end.y}"/>`+
      `<rect class="network-resistor" x="${center.x - 31}" y="${center.y - 10}" width="62" height="20" rx="2" transform="rotate(${angle} ${center.x} ${center.y})"/>`+
      `<text class="network-edge-label" x="${center.x}" y="${center.y - 25}" text-anchor="middle">${e(shownId(edge.id))} · ${e(value(edge.resistance))} Ω</text></g>`;
  }).join('');
  const nodes = network.nodes.map(id => {
    const at = positions[id];
    if (!at) return '';
    const kind = eliminated.has(id) ? 'eliminated' : introduced.has(id) ? 'introduced' : retained.has(id) ? 'retained' : '';
    const ground = id === '0' ? `<path class="network-ground" d="M${at.x} ${at.y + 6}v15m-15 0h30m-11 5h22m-7 5h14"/>` : '';
    return `<g class="network-node ${kind}"><circle cx="${at.x}" cy="${at.y}" r="5"/><text x="${at.x}" y="${at.y - 15}" text-anchor="middle">${e(shownId(id))}</text>${ground}</g>`;
  }).join('');
  return `<svg class="network-diagram" viewBox="0 0 680 320" role="img" aria-label="${e(options.label)}"><rect width="680" height="320" fill="#fafcf9"/>${branches}${nodes}</svg>`;
}
