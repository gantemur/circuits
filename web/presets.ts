import type { NativeDocument, Circuit } from '../src/model.js';
import rc from '../fixtures/rc.json';
import divider from '../fixtures/divider.json';
import highpass from '../fixtures/rc-high-pass.json';
import loaded from '../fixtures/rc-loaded.json';
import cascade from '../fixtures/rc-cascade.json';
import rl from '../fixtures/rl.json';
import rlc from '../fixtures/rlc.json';
import vcvs from '../fixtures/vcvs.json';
import resSeries from '../fixtures/res-series.json';
import resStar from '../fixtures/res-star.json';
import resBridge from '../fixtures/res-bridge.json';
import type { TranslationKey } from './i18n.js';

export interface Preset { id: string; titleKey: TranslationKey; subtitleKey: TranslationKey; document: NativeDocument; defaultOutput: string; }
export const presets: Preset[] = [
  { id: 'divider', titleKey: 'presetDividerTitle', subtitleKey: 'presetDividerSubtitle', document: divider as NativeDocument, defaultOutput: 'out' },
  { id: 'rc', titleKey: 'presetRcTitle', subtitleKey: 'presetRcSubtitle', document: rc as NativeDocument, defaultOutput: 'out' },
  { id: 'rc-high-pass', titleKey: 'presetHighpassTitle', subtitleKey: 'presetHighpassSubtitle', document: highpass as NativeDocument, defaultOutput: 'out' },
  { id: 'rc-loaded', titleKey: 'presetLoadedTitle', subtitleKey: 'presetLoadedSubtitle', document: loaded as NativeDocument, defaultOutput: 'out' },
  { id: 'rc-cascade', titleKey: 'presetCascadeTitle', subtitleKey: 'presetCascadeSubtitle', document: cascade as NativeDocument, defaultOutput: 'out' },
  { id: 'rl', titleKey: 'presetRlTitle', subtitleKey: 'presetRlSubtitle', document: rl as NativeDocument, defaultOutput: 'inductor' },
  { id: 'rlc', titleKey: 'presetRlcTitle', subtitleKey: 'presetRlcSubtitle', document: rlc as NativeDocument, defaultOutput: 'out' },
  { id: 'vcvs', titleKey: 'presetVcvsTitle', subtitleKey: 'presetVcvsSubtitle', document: vcvs as NativeDocument, defaultOutput: 'out' },
  { id: 'res-series', titleKey: 'presetResSeriesTitle', subtitleKey: 'presetResSeriesSubtitle', document: resSeries as NativeDocument, defaultOutput: 'out' },
  { id: 'res-star', titleKey: 'presetResStarTitle', subtitleKey: 'presetResStarSubtitle', document: resStar as NativeDocument, defaultOutput: 'Va' },
  { id: 'res-bridge', titleKey: 'presetResBridgeTitle', subtitleKey: 'presetResBridgeSubtitle', document: resBridge as NativeDocument, defaultOutput: 'Va' },
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
