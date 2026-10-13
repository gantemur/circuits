import { assemble } from './assembly.js';
import { ExactResourceError, exactDivide, exactMultiply, exactString, exactToNumber,
  parseExact, type ExactBudget, type Rational } from './exact-rational.js';
import { parseDocument, serializeDocument, validateDocument, type Component, type NativeDocument } from './model.js';
import type { RcElement } from './rc-synthesis.js';

export interface RcPhysicalElement {
  id: string; kind: 'R' | 'C'; normalized: string; exactSI: string;
  value: number; discrepancy: string; relativeError: number;
}
export type RcNativeResult = {
  status: 'generated'; document: NativeDocument; port: { p: 'port'; q: '0' }; elements: RcPhysicalElement[];
} | { status: 'unavailable'; reason: string };

/** Realize the continued fraction as a physical ladder. Each R advances the
 * path toward ground; C shunts the current node to ground. The final R ends
 * at ground, whereas a final C leaves no further series path. Initial zero
 * R was omitted by extraction, so the first C attaches directly to port.
 * Values are SI: R=Rref*r [ohm], C=c/(Rref*omegaRef) [farad]. */
export function generateRcNetlist(elements: RcElement[], resistance: Rational,
  frequency: Rational, budget: ExactBudget): RcNativeResult {
  budget.stage = 'native SI conversion and topology';
  try {
    const nodes = ['0', 'port'];
    const components: Component[] = [];
    const physical: RcPhysicalElement[] = [];
    let node = 'port';
    let resistorIndex = 0;
    let capacitorIndex = 1;
    for (let index = 0; index < elements.length; index++) {
      const element = elements[index]!;
      const id = element.kind === 'R' ? `R${resistorIndex++}` : `C${capacitorIndex++}`;
      const converted = convertRcElement(element, id, resistance, frequency, budget);
      let next = '0';
      if (element.kind === 'R' && index < elements.length - 1) {
        next = `n${nodes.length - 1}`;
        nodes.push(next);
      }
      components.push({ id, type: element.kind, p: node, n: next, value: converted.value });
      physical.push(converted);
      if (element.kind === 'R') node = next;
    }
    const roundTrip = validateRcNetwork(nodes, components);
    return { status: 'generated', document: roundTrip, port: { p: 'port', q: '0' }, elements: physical };
  } catch (error) {
    if (error instanceof RangeError || error instanceof ExactResourceError)
      return { status: 'unavailable', reason: error.message };
    throw error;
  }
}

/** Shared SI conversion; no topology assumptions. Preserve the accepted
 * operation order, rounding discrepancy, conductance and relative-error checks. */
export function convertRcElement(element: RcElement, id: string, resistance: Rational,
  frequency: Rational, budget: ExactBudget): RcPhysicalElement {
  const normalized = parseExact(element.value, budget);
  const si = element.kind === 'R' ? exactMultiply(resistance, normalized, budget)
    : exactDivide(normalized, exactMultiply(resistance, frequency, budget), budget);
  const converted = exactToNumber(si, budget);
  if (!(converted.value > 0) || converted.relativeError > 8 * Number.EPSILON)
    throw new RangeError('Positive SI value cannot be represented with adequate relative accuracy');
  if (element.kind === 'R' && !Number.isFinite(1 / converted.value))
    throw new RangeError('Resistor conductance exceeds finite native range');
  return { id, kind: element.kind, normalized: element.value, exactSI: exactString(si), ...converted };
}

/** Shared source-free RC graph, storage initialization, strict round-trip and
 * finite-stamp checks. Generators independently establish their topology. */
export function validateRcNetwork(nodes: string[], components: Component[]): NativeDocument {
  // Graph check is independent of continued-fraction reconstruction. No
  // dangling omitted node, self-loop, disconnected component, or lost return
  // is accepted, including the capacitor-only and terminal-resistor cases.
  const reached = new Set(['port']);
  for (let pass = 0; pass < nodes.length; pass++) {
    for (const component of components) {
      if (component.p === component.n) throw new RangeError('Degenerate ladder branch');
      if (reached.has(component.p)) reached.add(component.n);
      if (reached.has(component.n)) reached.add(component.p);
    }
  }
  if (!components.length || nodes.some(id => !reached.has(id))) throw new RangeError('Disconnected ladder');
  const document = validateDocument({
    circuit: { schemaVersion: 1, nodes, components,
      observations: [{ id: 'voltage', type: 'voltage', p: 'port', n: '0' }] },
    experiment: { schemaVersion: 1, sources: [], initial: { kind: 'storage',
      values: components.filter(c => c.type === 'C').map(c => ({ id: c.id, value: 0 })) } },
  });
  const roundTrip = parseDocument(serializeDocument(document));
  const assembly = assemble(roundTrip.circuit);
  if (![assembly.E, assembly.K, assembly.B].every(matrix => matrix.every(row => row.every(Number.isFinite))))
    throw new RangeError('Assembled native entries exceed finite range');
  return roundTrip;
}
