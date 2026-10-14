import { validateDocument, ValidationError, type NativeDocument, type SourceValue } from '../src/model.js';
import { copyBrowserDocument, type BrowserDocument } from './native-document.js';
import { diagnostic, emptyWiring, handle, netNames, reject, required,
  type Diagnostic, type DeviceType, type WiringGraph, type WaveformDraft } from './wiring-graph.js';

export type ImportWiring = { status: 'editable'; graph: WiringGraph }
  | { status: 'unsupported'; document: BrowserDocument; reason: string };

/** Import hubs describe electrical equality, not recovered historical routing.
 * Map keys are exact native IDs, including whitespace and prototype-like strings. */
export function importWiring(input: BrowserDocument): ImportWiring {
  const document = copyBrowserDocument(input); // strict validation precedes conversion
  if (document.circuit.schemaVersion !== 1 || document.circuit.components.some(device => !['R', 'C', 'L', 'V', 'I'].includes(device.type)))
    return { status: 'unsupported', document, reason: 'Graphical editing supports only native v1 R/C/L/V/I documents' };
  const native = document as NativeDocument;
  const graph = emptyWiring(native.experiment.initial.kind);
  graph.vertices = []; graph.names = []; graph.points = [];
  if (native.circuit.label !== undefined) graph.circuitLabel = native.circuit.label;
  if (native.experiment.label !== undefined) graph.experimentLabel = native.experiment.label;
  const nodes = new Map<string, string>();
  native.circuit.nodes.forEach((name, index) => {
    const key = handle(graph);
    nodes.set(name, key);
    graph.vertices.push({ key, kind: 'junction' });
    graph.points.push({ key, x: (index % 10) * 120, y: Math.floor(index / 10) * 120 });
    graph.names.push({ key: handle(graph), vertex: key, name });
    if (name === '0') graph.reference = key;
  });
  const devices = new Map<string, string>();
  native.circuit.components.forEach((component, index) => {
    const key = handle(graph);
    devices.set(component.id, key);
    const terminals = (['p', 'n'] as const).map(role => {
      const vertex = handle(graph);
      graph.vertices.push({ key: vertex, kind: 'terminal', device: key, role, completion: 'connected' });
      const edge = handle(graph);
      graph.edges.push({ key: edge, a: vertex, b: nodes.get(component[role])! });
      graph.routes.push({ key: edge, bends: [] });
      return { role, vertex };
    });
    graph.devices.push({ key, id: component.id, type: component.type as DeviceType, terminals,
      ...(component.label === undefined ? {} : { label: component.label }),
      ...('value' in component ? { value: String(component.value) } : {}) });
    graph.placements.push({ key, x: (index % 10) * 120 + 60, y: Math.floor(index / 10) * 120 + 60, turns: 0 });
  });
  for (const source of native.experiment.sources) {
    graph.sources.push({ key: handle(graph), device: devices.get(source.id)!, ...sourceText(source) });
  }
  for (const observation of native.circuit.observations) {
    const base = { key: handle(graph), id: observation.id,
      ...(observation.label === undefined ? {} : { label: observation.label }) };
    graph.observations.push(observation.type === 'voltage'
      ? { ...base, type: 'voltage', p: nodes.get(observation.p)!, n: nodes.get(observation.n)! }
      : { ...base, type: 'current', device: devices.get(observation.component)! });
  }
  if (native.experiment.initial.kind === 'storage') {
    for (const initial of native.experiment.initial.values)
      graph.storage.push({ key: handle(graph), device: devices.get(initial.id)!, value: String(initial.value) });
  }
  return { status: 'editable', graph };
}
export function sourceText(source: SourceValue) {
  return { dc: String(source.dc),
    ...(source.ac === undefined ? {} : { ac: { re: String(source.ac.re), im: String(source.ac.im) } }),
    ...(source.waveform === undefined ? {} : { waveform: Object.fromEntries(Object.entries(source.waveform)
      .map(([key, value]) => [key, key === 'type' ? value : String(value)])) as WaveformDraft }) };
}
export function numericText(text: string): number {
  if (typeof text !== 'string' || !text.trim().length || !Number.isFinite(Number(text)))
    reject('validation', 'numeric-text', 'Enter a finite numeric value');
  return Number(text);
}

/** Native validity is intentionally independent of geometry and MNA solvability.
 * This boundary does not add leakage, ground floating nets or repair constraints. */
export function nativeCandidate(graph: WiringGraph): { status: 'ok'; document: NativeDocument } | { status: 'invalid'; diagnostics: Diagnostic[] } {
  try {
    const keys = [...graph.devices, ...graph.vertices, ...graph.edges, ...graph.names, ...graph.sources, ...graph.observations, ...graph.storage].map(item => item.key);
    if (keys.some(key => typeof key !== 'string' || !key.length) || new Set(keys).size !== keys.length)
      reject('validation', 'duplicate-handle', 'Scientific handles must be unique nonempty strings');
    if (!['equilibrium', 'storage'].includes(graph.initial)) reject('validation', 'initial-policy', 'Unknown initialization policy');
    const names = netNames(graph);
    for (const anchor of graph.names) required(graph.vertices, anchor.vertex);
    for (const vertex of graph.vertices) {
      if (!['terminal', 'junction', 'free'].includes(vertex.kind)) reject('validation', 'vertex-kind', 'Unknown graph vertex kind', vertex.key);
      if (vertex.kind !== 'terminal') continue;
      const device = required(graph.devices, vertex.device);
      if (!device.terminals.some(terminal => terminal.vertex === vertex.key && terminal.role === vertex.role))
        reject('dependency', 'terminal-owner', 'Terminal has no matching device role', vertex.key);
      const degree = graph.edges.filter(edge => edge.a === vertex.key || edge.b === vertex.key).length;
      if (vertex.completion === 'pending') reject('completion', 'pending-terminal', 'Complete or explicitly accept the open terminal', vertex.key);
      if ((vertex.completion === 'open' && degree !== 0) || (vertex.completion === 'connected' && degree === 0)
        || !['open', 'connected'].includes(vertex.completion))
        reject('completion', 'terminal-state', 'Terminal completion contradicts its explicit connections', vertex.key);
    }
    const components = graph.devices.map(device => {
      if (!['R', 'C', 'L', 'V', 'I'].includes(device.type)) reject('validation', 'unsupported-device', 'Unsupported graphical device', device.key);
      if (device.terminals.length !== 2 || device.terminals[0]!.role !== 'p' || device.terminals[1]!.role !== 'n'
        || device.terminals[0]!.vertex === device.terminals[1]!.vertex)
        reject('validation', 'terminal-roles', 'Device must have distinct ordered p,n terminal vertices', device.key);
      for (const terminal of device.terminals) {
        const vertex = required(graph.vertices, terminal.vertex);
        if (vertex.kind !== 'terminal' || vertex.device !== device.key || vertex.role !== terminal.role)
          reject('dependency', 'terminal-owner', 'Device terminal ownership mismatch', device.key);
      }
      return { id: device.id, type: device.type, p: names.get(device.terminals[0]!.vertex)!, n: names.get(device.terminals[1]!.vertex)!,
        ...(device.label === undefined ? {} : { label: device.label }),
        ...(['R', 'C', 'L'].includes(device.type) ? { value: numericText(device.value!) } : {}) };
    });
    const observations = graph.observations.map(observation => {
      const base = { id: observation.id, type: observation.type, ...(observation.label === undefined ? {} : { label: observation.label }) };
      if (observation.type === 'current') return { ...base, component: required(graph.devices, observation.device).id };
      required(graph.vertices, observation.p); required(graph.vertices, observation.n);
      return { ...base, p: names.get(observation.p), n: names.get(observation.n) };
    });
    const sources = graph.sources.map(source => ({ id: required(graph.devices, source.device).id, dc: numericText(source.dc),
      ...(source.ac === undefined ? {} : { ac: { re: numericText(source.ac.re), im: numericText(source.ac.im) } }),
      ...(source.waveform === undefined ? {} : { waveform: Object.fromEntries(Object.entries(source.waveform)
        .map(([key, value]) => [key, key === 'type' ? value : numericText(value)])) }) }));
    if (graph.initial === 'equilibrium' && graph.storage.length) reject('dependency', 'storage-policy', 'Equilibrium policy cannot contain storage entries');
    const initial = graph.initial === 'equilibrium' ? { kind: 'equilibrium' } : { kind: 'storage', values: graph.storage.map(value => ({
      id: required(graph.devices, value.device).id, value: numericText(value.value) })) };
    const document = validateDocument({ circuit: { schemaVersion: 1,
      ...(graph.circuitLabel === undefined ? {} : { label: graph.circuitLabel }),
      nodes: graph.names.map(anchor => anchor.name), components, observations },
    experiment: { schemaVersion: 1, ...(graph.experimentLabel === undefined ? {} : { label: graph.experimentLabel }), sources, initial } });
    return { status: 'ok', document };
  } catch (error) {
    const issue = error instanceof ValidationError
      ? { category: 'validation' as const, code: error.code, params: error.params, handles: [], message: error.message }
      : diagnostic(error);
    return { status: 'invalid', diagnostics: [issue] };
  }
}
