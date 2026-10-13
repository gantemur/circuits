import type { NativeDocument, Circuit } from '../src/model.js';
import type { NonlinearDocument, NonlinearCircuit } from '../src/nonlinear-model.js';
import { copyBrowserDocument, type BrowserDocument } from './native-document.js';
import diodeSingle from '../fixtures/nonlinear/resistor-diode.json';
import diodeSeries from '../fixtures/nonlinear/resistor-diode-series.json';
import diodePair from '../fixtures/nonlinear/antiparallel.json';
import diodeRc from '../fixtures/nonlinear/diode-rc-tangent.json';
import diodeRcStep from '../fixtures/nonlinear/diode-rc-step.json';
import diodeRcSine from '../fixtures/nonlinear/diode-rc-biased-sine.json';
import rectifier from '../fixtures/nonlinear/half-wave-rectifier.json';
import rectifierRc from '../fixtures/nonlinear/half-wave-rectifier-rc.json';
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
import portT from '../fixtures/port-t.json';
import portRc from '../fixtures/port-rc-section.json';
import portCascade from '../fixtures/port-rc-cascade.json';
import rc3Low from '../fixtures/rc3-low-pass.json';
import rc3High from '../fixtures/rc3-high-pass.json';
import butterLow from '../fixtures/butterworth2-low-pass.json';
import butterHigh from '../fixtures/butterworth2-high-pass.json';
import rlcBand from '../fixtures/rlc-band-pass.json';
import rlcNotch from '../fixtures/rlc-notch.json';
import rcLadder from '../fixtures/rc-impedance-ladder.json';
import rlLadder from '../fixtures/rl-impedance-ladder.json';
import type { TranslationKey } from './i18n.js';

export interface Preset { id: string; titleKey: TranslationKey; subtitleKey: TranslationKey; document: BrowserDocument; defaultOutput: string; }
const diodeBrowserCopy = (input: unknown): NonlinearDocument => {
  const document = structuredClone(input) as NonlinearDocument;
  for (const source of document.experiment.sources) source.ac = { re: .001, im: 0 };
  return document;
};
const seriesBrowser = diodeBrowserCopy(diodeSeries);
for (const component of seriesBrowser.circuit.components) {
  if (component.id === 'V1') component.id = 'Vseries';
  if (component.id === 'R1') component.id = 'Rseries';
  if (component.id === 'D1') component.id = 'Dseries';
}
seriesBrowser.experiment.sources[0]!.id = 'Vseries';
for (const observation of seriesBrowser.circuit.observations) {
  if (observation.type === 'current' && observation.component === 'D1') observation.component = 'Dseries';
  if (observation.type === 'current' && observation.component === 'V1') observation.component = 'Vseries';
}
/** Browser copies use distinct exact IDs so two identical diode-RC topologies
 * cannot select one another's guide or reset target after values are edited. */
function namedTransientCopy(input: unknown, suffix: string): NonlinearDocument {
  const document = structuredClone(input) as NonlinearDocument;
  const names = new Map(document.circuit.components.map(component => [component.id, `${component.id}${suffix}`]));
  for (const component of document.circuit.components) {
    component.id = names.get(component.id)!;
    if ('control' in component) component.control = names.get(component.control) ?? component.control;
  }
  for (const source of document.experiment.sources) source.id = names.get(source.id) ?? source.id;
  for (const observation of document.circuit.observations)
    if (observation.type === 'current') observation.component = names.get(observation.component) ?? observation.component;
  if (document.experiment.initial.kind === 'storage')
    for (const value of document.experiment.initial.values) value.id = names.get(value.id) ?? value.id;
  return document;
}
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
  { id: 'port-t', titleKey: 'presetPortTTitle', subtitleKey: 'presetPortTSubtitle', document: portT as NativeDocument, defaultOutput: 'out' },
  { id: 'port-rc-section', titleKey: 'presetPortRcTitle', subtitleKey: 'presetPortRcSubtitle', document: portRc as NativeDocument, defaultOutput: 'out' },
  { id: 'port-rc-cascade', titleKey: 'presetPortCascadeTitle', subtitleKey: 'presetPortCascadeSubtitle', document: portCascade as NativeDocument, defaultOutput: 'out' },
  { id: 'rc3-low-pass', titleKey: 'presetRc3LowTitle', subtitleKey: 'presetRc3LowSubtitle', document: rc3Low as NativeDocument, defaultOutput: 'out' },
  { id: 'rc3-high-pass', titleKey: 'presetRc3HighTitle', subtitleKey: 'presetRc3HighSubtitle', document: rc3High as NativeDocument, defaultOutput: 'out' },
  { id: 'butterworth2-low-pass', titleKey: 'presetButterLowTitle', subtitleKey: 'presetButterLowSubtitle', document: butterLow as NativeDocument, defaultOutput: 'out' },
  { id: 'butterworth2-high-pass', titleKey: 'presetButterHighTitle', subtitleKey: 'presetButterHighSubtitle', document: butterHigh as NativeDocument, defaultOutput: 'out' },
  { id: 'rlc-band-pass', titleKey: 'presetRlcBandTitle', subtitleKey: 'presetRlcBandSubtitle', document: rlcBand as NativeDocument, defaultOutput: 'resistorVoltage' },
  { id: 'rlc-notch', titleKey: 'presetRlcNotchTitle', subtitleKey: 'presetRlcNotchSubtitle', document: rlcNotch as NativeDocument, defaultOutput: 'lcVoltage' },
  { id: 'rc-impedance-ladder', titleKey: 'presetRcLadderTitle', subtitleKey: 'presetRcLadderSubtitle', document: rcLadder as NativeDocument, defaultOutput: 'port' },
  { id: 'rl-impedance-ladder', titleKey: 'presetRlLadderTitle', subtitleKey: 'presetRlLadderSubtitle', document: rlLadder as NativeDocument, defaultOutput: 'port' },
  { id: 'diode-single', titleKey: 'presetDiodeSingleTitle', subtitleKey: 'presetDiodeSingleSubtitle', document: diodeBrowserCopy(diodeSingle), defaultOutput: 'vout' },
  { id: 'diode-series', titleKey: 'presetDiodeSeriesTitle', subtitleKey: 'presetDiodeSeriesSubtitle', document: seriesBrowser, defaultOutput: 'vout' },
  { id: 'diode-pair', titleKey: 'presetDiodePairTitle', subtitleKey: 'presetDiodePairSubtitle', document: diodeBrowserCopy(diodePair), defaultOutput: 'vout' },
  { id: 'diode-rc', titleKey: 'presetDiodeRcTitle', subtitleKey: 'presetDiodeRcSubtitle', document: diodeBrowserCopy(diodeRc), defaultOutput: 'vout' },
  { id: 'diode-rc-step', titleKey: 'presetDiodeStepTitle', subtitleKey: 'presetDiodeStepSubtitle', document: namedTransientCopy(diodeRcStep,'Step'), defaultOutput: 'vout' },
  { id: 'diode-rc-biased-sine', titleKey: 'presetDiodeSineTitle', subtitleKey: 'presetDiodeSineSubtitle', document: namedTransientCopy(diodeRcSine,'Sine'), defaultOutput: 'vout' },
  { id: 'half-wave-rectifier', titleKey: 'presetRectifierTitle', subtitleKey: 'presetRectifierSubtitle', document: namedTransientCopy(rectifier,'Rect'), defaultOutput: 'vout' },
  { id: 'half-wave-rectifier-rc', titleKey: 'presetRectifierRcTitle', subtitleKey: 'presetRectifierRcSubtitle', document: namedTransientCopy(rectifierRc,'Smooth'), defaultOutput: 'vout' },
];

export const copyDocument = copyBrowserDocument;
export function topologySignature(c: Circuit | NonlinearCircuit): string {
  return JSON.stringify({ nodes: [...c.nodes].sort(),
    components: c.components.map(d => ({ id: d.id, type: d.type, p: d.p, n: d.n,
      ...('cp' in d ? { cp: d.cp, cn: d.cn } : {}),
      ...('control' in d ? { control: d.control } : {}) })).sort((a,b) => a.id.localeCompare(b.id)) });
}
export function matchingPreset(c: Circuit | NonlinearCircuit): Preset | undefined {
  const signature = topologySignature(c);
  return presets.find(p => topologySignature(p.document.circuit) === signature);
}
