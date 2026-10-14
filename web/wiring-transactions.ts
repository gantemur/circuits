import { wiringMeaning } from './wiring-native.js';
import { checkPoint, diagnostic, geometryDiagnostics, handle, netNames, partitions, reconcileNames, reject, required, vertexPoint, wirePoints,
  type DeviceType, type Diagnostic, type Handle, type ObservationDraft, type Point, type SourceDraft, type WiringGraph } from './wiring-graph.js';

export type WiringOperation =
  | { type: 'batch'; operations: WiringOperation[] }
  | { type: 'edit-label'; device: Handle; label: string }
  | { type: 'add-device'; deviceType: DeviceType; id: string; value?: string; label?: string; point?: Point }
  | { type: 'add-vertex'; kind: 'junction' | 'free'; point: Point; name?: string }
  | { type: 'connect'; a: Handle; b: Handle; survivingName?: string; bends?: Point[] }
  | { type: 'split-wire'; edge: Handle; segment: number; fraction: number }
  | { type: 'attach-to-segment'; vertex: Handle; edge: Handle; segment: number; fraction: number; survivingName?: string; bends?: Point[] }
  | { type: 'join-crossing'; first: Handle; firstSegment: number; second: Handle; secondSegment: number; survivingName?: string }
  | { type: 'separate'; vertex: Handle; edges: Handle[] }
  | { type: 'delete-wire'; edge: Handle }
  | { type: 'disconnect'; vertex: Handle }
  | { type: 'mark-open'; vertex: Handle }
  | { type: 'copy-device'; device: Handle; id?: string }
  | { type: 'delete-device'; device: Handle; deleteObservations?: Handle[] }
  | { type: 'rename-device'; device: Handle; id: string }
  | { type: 'rename-node'; vertex: Handle; name: string }
  | { type: 'set-reference'; vertex: Handle }
  | { type: 'move-device'; device: Handle; point: Point }
  | { type: 'rotate-device'; device: Handle; quarterTurns: number }
  | { type: 'move-vertex'; vertex: Handle; point: Point }
  | { type: 'move-bends'; edge: Handle; bends: Point[] }
  | { type: 'edit-value'; device: Handle; value: string }
  | { type: 'edit-source'; device: Handle; source: Omit<SourceDraft, 'key' | 'device'> }
  | { type: 'set-initial'; kind: 'equilibrium' | 'storage' }
  | { type: 'edit-initial'; device: Handle; value: string }
  | { type: 'add-observation'; observation: Omit<Extract<ObservationDraft, { type: 'voltage' }>, 'key'> | Omit<Extract<ObservationDraft, { type: 'current' }>, 'key'> }
  | { type: 'delete-observation'; observation: Handle };

export interface PartitionEvidence {
  partitions: Handle[][]; names: WiringGraph['names'];
  voltageObservations: { key: Handle; p: string | undefined; n: string | undefined }[];
}
export function partitionEvidence(graph: WiringGraph): PartitionEvidence {
  const names = netNames(graph);
  return { partitions: partitions(graph), names: structuredClone(graph.names),
    voltageObservations: graph.observations.flatMap(observation => observation.type === 'voltage'
      ? [{ key: observation.key, p: names.get(observation.p), n: names.get(observation.n) }] : []) };
}
function nonempty(value: string): void {
  if (typeof value !== 'string' || !value.length) reject('validation', 'empty-id', 'An exact nonempty identifier is required');
}
function deviceId(graph: WiringGraph, id: string, except?: Handle): void {
  nonempty(id);
  if (graph.devices.some(device => device.id === id && device.key !== except)) reject('validation', 'duplicate-id', 'Component ID already exists');
}
function addVertex(graph: WiringGraph, kind: 'junction' | 'free', point: Point): Handle {
  checkPoint(point);
  const key = handle(graph);
  graph.vertices.push({ key, kind });
  graph.points.push({ key, ...point });
  return key;
}
function addEdge(graph: WiringGraph, a: Handle, b: Handle, bends: Point[] = []): Handle {
  required(graph.vertices, a); required(graph.vertices, b);
  if (a === b) reject('validation', 'self-wire', 'A wire needs two distinct vertices', a);
  const key = handle(graph);
  graph.edges.push({ key, a, b });
  graph.routes.push({ key, bends: structuredClone(bends) });
  return key;
}
function removeEdges(graph: WiringGraph, keys: Handle[]): void {
  graph.edges = graph.edges.filter(edge => !keys.includes(edge.key));
  graph.routes = graph.routes.filter(route => !keys.includes(route.key));
}
function addDevice(graph: WiringGraph, operation: Extract<WiringOperation, { type: 'add-device' }>): Handle {
  deviceId(graph, operation.id);
  if (!['R', 'C', 'L', 'V', 'I'].includes(operation.deviceType)) reject('validation', 'unsupported-device', 'Unsupported graphical device');
  const key = handle(graph);
  const terminals = (['p', 'n'] as const).map(role => {
    const vertex = handle(graph);
    graph.vertices.push({ key: vertex, kind: 'terminal', device: key, role, completion: 'pending' });
    return { role, vertex };
  });
  graph.devices.push({ key, id: operation.id, type: operation.deviceType, terminals,
    ...(operation.label === undefined ? {} : { label: operation.label }),
    ...(['R', 'C', 'L'].includes(operation.deviceType) ? { value: operation.value ?? '1' } : {}) });
  graph.placements.push({ key, ...(operation.point ?? { x: 0, y: 0 }), turns: 0 });
  if (operation.deviceType === 'V' || operation.deviceType === 'I') {
    graph.sources.push({ key: handle(graph), device: key, dc: '0', ac: { re: '0', im: '0' }, waveform: { type: 'constant', value: '0' } });
  }
  if (graph.initial === 'storage' && ['C', 'L'].includes(operation.deviceType)) {
    graph.storage.push({ key: handle(graph), device: key, value: '0' });
  }
  return key;
}
/** Split a selected segment, preserving its polyline and both old endpoints.
 * No search for nearby geometry is performed. The returned vertex is the only
 * new electrical junction; callers may explicitly connect another wire to it. */
function splitWire(graph: WiringGraph, edgeKey: Handle, segment: number, fraction: number, shared?: Handle): Handle {
  const edge = required(graph.edges, edgeKey);
  const points = wirePoints(graph, edgeKey);
  if (!Number.isInteger(segment) || segment < 0 || segment >= points.length - 1 || !Number.isFinite(fraction) || fraction <= 0 || fraction >= 1)
    reject('geometry', 'split-location', 'Choose an interior point of a valid route segment', edgeKey);
  const start = points[segment]!;
  const end = points[segment + 1]!;
  const point = { x: start.x + fraction * (end.x - start.x), y: start.y + fraction * (end.y - start.y) };
  const junction = shared ?? addVertex(graph, 'junction', point);
  removeEdges(graph, [edgeKey]);
  addEdge(graph, edge.a, junction, points.slice(1, segment + 1));
  addEdge(graph, junction, edge.b, points.slice(segment + 1, -1));
  return junction;
}
function segment(graph: WiringGraph, key: Handle, index: number): [Point, Point] {
  const points = wirePoints(graph, key);
  if (!Number.isInteger(index) || index < 0 || index >= points.length - 1) reject('geometry', 'segment', 'Missing route segment', key);
  return [points[index]!, points[index + 1]!];
}
function mutate(graph: WiringGraph, operation: WiringOperation): Handle[] {
  switch (operation.type) {
    case 'batch': {
      const created: Handle[] = [];
      for (const item of operation.operations) {
        if (item.type === 'batch') reject('validation', 'nested-batch', 'Nested transactions are unsupported');
        created.push(...mutate(graph, item));
      }
      return created;
    }
    case 'edit-label': {
      const device = required(graph.devices, operation.device);
      if (operation.label.length) device.label = operation.label;
      else delete device.label;
      return [];
    }
    case 'add-device': return [addDevice(graph, operation)];
    case 'add-vertex': {
      const key = addVertex(graph, operation.kind, operation.point);
      if (operation.name !== undefined) {
        nonempty(operation.name);
        if (graph.names.some(anchor => anchor.name === operation.name)) reject('naming', 'duplicate-name', 'Net name already exists');
        graph.names.push({ key: handle(graph), vertex: key, name: operation.name });
      }
      return [key];
    }
    case 'connect': return [addEdge(graph, operation.a, operation.b, operation.bends)];
    case 'split-wire': return [splitWire(graph, operation.edge, operation.segment, operation.fraction)];
    case 'attach-to-segment': {
      required(graph.vertices, operation.vertex);
      const junction = splitWire(graph, operation.edge, operation.segment, operation.fraction);
      const wire = addEdge(graph, operation.vertex, junction, operation.bends);
      return [junction, wire];
    }
    case 'join-crossing': {
      if (operation.first === operation.second) reject('geometry', 'same-wire', 'Choose two distinct wires');
      const [a, b] = segment(graph, operation.first, operation.firstSegment);
      const [c, d] = segment(graph, operation.second, operation.secondSegment);
      const r = { x: b.x - a.x, y: b.y - a.y };
      const s = { x: d.x - c.x, y: d.y - c.y };
      const cross = r.x * s.y - r.y * s.x;
      // Parallel/collinear routes have no unique proper intersection.
      const crossRoundoff = 32 * Number.EPSILON * (Math.abs(r.x * s.y) + Math.abs(r.y * s.x));
      // This drawing-unit² allowance rejects unresolved near-parallel geometry;
      // it is not an electrical tolerance or a proximity-based connection rule.
      if (Math.abs(cross) <= crossRoundoff) reject('geometry', 'ambiguous-crossing', 'Segments have no numerically resolved unique crossing');
      const q = { x: c.x - a.x, y: c.y - a.y };
      const t = (q.x * s.y - q.y * s.x) / cross;
      const u = (q.x * r.y - q.y * r.x) / cross;
      if (!(t > 0 && t < 1 && u > 0 && u < 1)) reject('geometry', 'not-crossing', 'Select a proper interior crossing');
      const junction = splitWire(graph, operation.first, operation.firstSegment, t);
      splitWire(graph, operation.second, operation.secondSegment, u, junction);
      return [junction];
    }
    case 'separate': {
      const vertex = required(graph.vertices, operation.vertex);
      if (vertex.kind !== 'junction') reject('validation', 'junction-required', 'Only explicit junctions may be separated');
      const incident = graph.edges.filter(edge => edge.a === vertex.key || edge.b === vertex.key);
      if (!operation.edges.length || operation.edges.length >= incident.length || new Set(operation.edges).size !== operation.edges.length
        || operation.edges.some(key => !incident.some(edge => edge.key === key)))
        reject('validation', 'incident-selection', 'Choose a nonempty proper subset of incident wires');
      const split = addVertex(graph, 'junction', vertexPoint(graph, vertex.key));
      for (const key of operation.edges) {
        const edge = required(graph.edges, key);
        if (edge.a === vertex.key) edge.a = split;
        if (edge.b === vertex.key) edge.b = split;
      }
      return [split];
    }
    case 'delete-wire': required(graph.edges, operation.edge); removeEdges(graph, [operation.edge]); return [];
    case 'disconnect': {
      const vertex = required(graph.vertices, operation.vertex);
      if (vertex.kind !== 'terminal') reject('validation', 'terminal-required', 'Disconnect needs a terminal');
      removeEdges(graph, graph.edges.filter(edge => edge.a === vertex.key || edge.b === vertex.key).map(edge => edge.key));
      vertex.completion = 'pending';
      return [];
    }
    case 'mark-open': {
      const vertex = required(graph.vertices, operation.vertex);
      if (vertex.kind !== 'terminal' || graph.edges.some(edge => edge.a === vertex.key || edge.b === vertex.key))
        reject('completion', 'open-terminal', 'Only an isolated terminal can be marked intentionally open');
      vertex.completion = 'open'; return [];
    }
    case 'copy-device': {
      const original = required(graph.devices, operation.device);
      let index = 1;
      while (graph.devices.some(device => device.id === `${original.id}_copy${index}`)) index++;
      const placement = required(graph.placements, original.key);
      const key = addDevice(graph, { type: 'add-device', deviceType: original.type, id: operation.id ?? `${original.id}_copy${index}`,
        ...(original.value === undefined ? {} : { value: original.value }),
        ...(original.label === undefined ? {} : { label: original.label }), point: { x: placement.x + 60, y: placement.y + 60 } });
      required(graph.placements, key).turns = placement.turns;
      const source = graph.sources.find(value => value.device === original.key);
      const copySource = graph.sources.find(value => value.device === key);
      if (source && copySource) Object.assign(copySource, structuredClone(source), { key: copySource.key, device: key });
      const storage = graph.storage.find(value => value.device === original.key);
      const copyStorage = graph.storage.find(value => value.device === key);
      if (storage && copyStorage) copyStorage.value = storage.value;
      return [key];
    }
    case 'delete-device': {
      const device = required(graph.devices, operation.device);
      const dependents = graph.observations.filter(observation => observation.type === 'current' && observation.device === device.key);
      const requested = operation.deleteObservations ?? [];
      if (dependents.some(observation => !requested.includes(observation.key)) || requested.some(key => !dependents.some(observation => observation.key === key)))
        reject('dependency', 'current-observation', 'Explicitly remove the dependent current observations', ...dependents.map(observation => observation.key));
      graph.observations = graph.observations.filter(observation => !requested.includes(observation.key));
      // Keep terminal vertices as free physical anchors. Existing wires and voltage
      // probes remain in place; removing a device does not delete its external net.
      for (const terminal of device.terminals) {
        const point = vertexPoint(graph, terminal.vertex);
        const index = graph.vertices.findIndex(vertex => vertex.key === terminal.vertex);
        graph.vertices[index] = { key: terminal.vertex, kind: 'free' };
        graph.points.push({ key: terminal.vertex, ...point });
      }
      graph.devices = graph.devices.filter(value => value.key !== device.key);
      graph.placements = graph.placements.filter(value => value.key !== device.key);
      graph.sources = graph.sources.filter(value => value.device !== device.key);
      graph.storage = graph.storage.filter(value => value.device !== device.key);
      return [];
    }
    case 'rename-device': {
      deviceId(graph, operation.id, operation.device);
      required(graph.devices, operation.device).id = operation.id; return [];
    }
    case 'rename-node': {
      nonempty(operation.name);
      const names = netNames(graph);
      const old = names.get(operation.vertex);
      required(graph.vertices, operation.vertex);
      if ((old === '0') !== (operation.name === '0')) reject('naming', 'reference-rename', 'Use Set reference to change ground');
      if (graph.names.some(anchor => anchor.name === operation.name && anchor.name !== old)) reject('naming', 'duplicate-name', 'Net name already exists');
      graph.names.find(anchor => anchor.name === old)!.name = operation.name; return [];
    }
    case 'set-reference': {
      const names = netNames(graph);
      required(graph.vertices, operation.vertex);
      const oldName = names.get(operation.vertex)!;
      const oldReference = graph.names.find(anchor => anchor.name === '0')!;
      const newReference = graph.names.find(anchor => anchor.name === oldName)!;
      oldReference.name = oldName;
      newReference.name = '0';
      newReference.vertex = operation.vertex;
      graph.reference = operation.vertex;
      return [];
    }
    case 'move-device': Object.assign(required(graph.placements, operation.device), operation.point); return [];
    case 'rotate-device': {
      if (!Number.isInteger(operation.quarterTurns)) reject('geometry', 'rotation', 'Use integer quarter turns');
      const placement = required(graph.placements, operation.device);
      placement.turns = ((placement.turns + operation.quarterTurns) % 4 + 4) % 4; return [];
    }
    case 'move-vertex': {
      const vertex = required(graph.vertices, operation.vertex);
      if (vertex.kind === 'terminal') reject('geometry', 'move-symbol', 'Move the symbol to move its terminals');
      Object.assign(required(graph.points, vertex.key), operation.point); return [];
    }
    case 'move-bends': required(graph.routes, operation.edge).bends = structuredClone(operation.bends); return [];
    case 'edit-value': {
      const device = required(graph.devices, operation.device);
      if (!['R', 'C', 'L'].includes(device.type)) reject('validation', 'passive-required', 'Edit the source definition instead');
      device.value = operation.value; return [];
    }
    case 'edit-source': {
      const source = graph.sources.find(value => value.device === operation.device);
      if (!source) reject('dependency', 'source-required', 'No source definition for this device');
      graph.sources[graph.sources.indexOf(source)] = { ...structuredClone(operation.source), key: source.key, device: source.device }; return [];
    }
    case 'set-initial': {
      if (!['equilibrium', 'storage'].includes(operation.kind)) reject('validation', 'initial-policy', 'Unknown initialization policy');
      graph.initial = operation.kind;
      graph.storage = operation.kind === 'equilibrium' ? [] : graph.devices.filter(device => ['C', 'L'].includes(device.type)).map(device =>
        graph.storage.find(value => value.device === device.key) ?? { key: handle(graph), device: device.key, value: '0' });
      return [];
    }
    case 'edit-initial': {
      const entry = graph.storage.find(value => value.device === operation.device);
      if (!entry) reject('dependency', 'storage-required', 'No specified storage entry for this device');
      entry.value = operation.value; return [];
    }
    case 'add-observation': {
      const observation = operation.observation;
      nonempty(observation.id);
      if (graph.observations.some(value => value.id === observation.id)) reject('validation', 'duplicate-observation', 'Observation ID already exists');
      if (observation.type === 'current') required(graph.devices, observation.device);
      else { required(graph.vertices, observation.p); required(graph.vertices, observation.n); }
      const key = handle(graph);
      graph.observations.push({ ...structuredClone(observation), key }); return [key];
    }
    case 'delete-observation': required(graph.observations, operation.observation);
      graph.observations = graph.observations.filter(value => value.key !== operation.observation); return [];
    default: return reject('validation', 'unknown-operation', 'Unknown wiring transaction');
  }
}
export type TransactionResult = { status: 'ok'; graph: WiringGraph; created: Handle[]; scientific: boolean; geometry: boolean;
  before: PartitionEvidence; after: PartitionEvidence }
  | { status: 'rejected'; diagnostics: Diagnostic[] };

/** Copy-on-commit gives failed requests no partial effects. Numeric text may be
 * temporarily invalid; strict scientific validation occurs only at candidate time. */
export function transact(graph: WiringGraph, operation: WiringOperation): TransactionResult {
  try {
    const before = partitionEvidence(graph);
    const next = structuredClone(graph);
    const created = mutate(next, operation);
    for (const vertex of next.vertices) {
      if (vertex.kind !== 'terminal') continue;
      const incident = next.edges.some(edge => edge.a === vertex.key || edge.b === vertex.key);
      if (incident) vertex.completion = 'connected';
      else if (vertex.completion === 'connected') vertex.completion = 'pending';
    }
    reconcileNames(next, 'survivingName' in operation ? operation.survivingName : undefined);
    const geometryIssues = geometryDiagnostics(next);
    if (geometryIssues.length) return { status: 'rejected', diagnostics: geometryIssues };
    const after = partitionEvidence(next);
    const geometryOnly = ['move-device', 'rotate-device', 'move-vertex', 'move-bends'].includes(operation.type);
    const changed = JSON.stringify(graph) !== JSON.stringify(next);
    const geometry = changed && (geometryOnly || JSON.stringify(graph.edges) !== JSON.stringify(next.edges) || JSON.stringify([graph.placements, graph.points, graph.routes]) !== JSON.stringify([next.placements, next.points, next.routes]));
    return { status: 'ok', graph: next, created, scientific: changed && wiringMeaning(graph) !== wiringMeaning(next), geometry, before, after };
  } catch (error) { return { status: 'rejected', diagnostics: [diagnostic(error)] }; }
}
