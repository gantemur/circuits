import { ExactResourceError, type ExactBudget, type Rational } from './exact-rational.js';
import type { FosterMethod, FosterSection } from './foster-decomposition.js';
import type { Component } from './model.js';
import { convertRcElement, validateRcNetwork, type RcNativeResult, type RcPhysicalElement } from './synthesis-netlist.js';

/** Foster I adds section impedances along a chain; each parallel RC pair
 * shares both terminals. Foster II adds branch admittances at the port;
 * each series RC pair gets its own internal node. All positive currents
 * follow p→n from port toward return. No Cauer topology is reused here. */
export function generateFosterNetlist(method: FosterMethod, sections: FosterSection[],
  resistance: Rational, frequency: Rational, budget: ExactBudget): RcNativeResult {
  budget.stage = 'Foster native SI conversion and topology';
  try {
    const nodes = ['0', 'port'];
    const used = new Set([...nodes, 'voltage']);
    const fresh = (prefix: string): string => {
      let suffix = 1;
      while (used.has(`${prefix}${suffix}`)) suffix++;
      const id = `${prefix}${suffix}`;
      used.add(id);
      return id;
    };
    const node = (): string => {
      const id = fresh('n');
      nodes.push(id);
      return id;
    };
    const components: Component[] = [];
    const elements: RcPhysicalElement[] = [];
    let chainNode = 'port';
    for (let index = 0; index < sections.length; index++) {
      const section = sections[index]!;
      const first = method === 'foster-I';
      const start = first ? chainNode : 'port';
      const end = first && index < sections.length - 1 ? node() : '0';
      const middle = section.connection === 'series-RC' ? node() : null;
      if ((first && section.connection === 'series-RC') || (!first && section.connection === 'parallel-RC'))
        throw new RangeError('Section connection disagrees with Foster method');
      for (let device = 0; device < section.elements.length; device++) {
        const element = section.elements[device]!;
        const id = fresh(element.kind);
        const converted = convertRcElement(element, id, resistance, frequency, budget);
        const p = middle !== null && device === 1 ? middle : start;
        const n = middle !== null && device === 0 ? middle : end;
        components.push({ id, type: element.kind, p, n, value: converted.value });
        elements.push(converted);
      }
      chainNode = end;
    }
    const document = validateRcNetwork(nodes, components);
    return { status: 'generated', document, elements, port: { p: 'port', q: '0' } };
  } catch (error) {
    if (error instanceof RangeError || error instanceof ExactResourceError)
      return { status: 'unavailable', reason: error.message };
    throw error;
  }
}
