import type { NativeDocument, Circuit } from '../src/model.js';
import rc from '../fixtures/rc.json';
import loaded from '../fixtures/rc-loaded.json';
import cascade from '../fixtures/rc-cascade.json';
import rl from '../fixtures/rl.json';
import rlc from '../fixtures/rlc.json';
import vcvs from '../fixtures/vcvs.json';

export interface Preset { id: string; title: string; subtitle: string; document: NativeDocument; defaultOutput: string; }
export const presets: Preset[] = [
  { id: 'rc', title: 'RC low-pass', subtitle: 'One storage element · τ = RC', document: rc as NativeDocument, defaultOutput: 'out' },
  { id: 'rc-loaded', title: 'Loaded RC', subtitle: 'The output load changes the gain', document: loaded as NativeDocument, defaultOutput: 'out' },
  { id: 'rc-cascade', title: 'Connected RC stages', subtitle: 'The second stage loads the first', document: cascade as NativeDocument, defaultOutput: 'out' },
  { id: 'rl', title: 'Series RL', subtitle: 'Current rises through an inductor', document: rl as NativeDocument, defaultOutput: 'inductor' },
  { id: 'rlc', title: 'Series RLC', subtitle: 'A damped second-order response', document: rlc as NativeDocument, defaultOutput: 'out' },
  { id: 'vcvs', title: 'Voltage amplifier', subtitle: 'VCVS with an explicit load', document: vcvs as NativeDocument, defaultOutput: 'out' },
];

export const copyDocument = (d: NativeDocument): NativeDocument => JSON.parse(JSON.stringify(d)) as NativeDocument;
export function topologySignature(c: Circuit): string {
  return JSON.stringify({ nodes: [...c.nodes].sort(),
    components: c.components.map(d => ({ id: d.id, type: d.type, p: d.p, n: d.n,
      ...('cp' in d ? { cp: d.cp, cn: d.cn } : {}),
      ...('control' in d ? { control: d.control } : {}) })).sort((a,b) => a.id.localeCompare(b.id)) });
}
export function matchingPreset(c: Circuit): Preset | undefined {
  const signature = topologySignature(c);
  return presets.find(p => topologySignature(p.document.circuit) === signature);
}
