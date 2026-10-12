import { assembleDiodeSystem, evaluateDiodeSystem,
  type NonlinearSuccess, type DiodeSystem, type NonlinearEvaluation } from '../src/diode-operating-point.js';
import type { NonlinearDocument } from '../src/nonlinear-model.js';
import type { NativeDocument } from '../src/model.js';
import { t } from './i18n.js';
import { escapeHtml } from './schematic.js';

/** Preserve the identity of a selected device across topology changes.
 * An empty v2 circuit still has a valid network operating point. */
export function selectedDiodeMetric(bias: NonlinearSuccess, selectedId: string):
  { kind: 'selected'; id: string; value: NonlinearSuccess['diodes'][string] } |
  { kind: 'missing'; id: string } | { kind: 'none'; id: string } {
  const ids = Object.keys(bias.diodes);
  if (!ids.length) return { kind: 'none', id: selectedId };
  const value = bias.diodes[selectedId];
  return value ? { kind: 'selected', id: selectedId, value } : { kind: 'missing', id: selectedId };
}

export function selectedDiodeMetricHtml(bias: NonlinearSuccess, selectedId: string): string {
  const metric = selectedDiodeMetric(bias, selectedId);
  if (metric.kind === 'none') return `<p class="warning" role="status">${t('diodeNoDevices')}</p>`;
  if (metric.kind === 'missing') return `<p class="warning" role="status">${t('diodeReselect',{id:escapeHtml(metric.id)})}</p>`;
  const value = metric.value;
  const format = (number: number): string => String(Number(number.toPrecision(6)));
  const resistance = value.differentialResistanceOhm === null ? t('portUndefined') :
    `${format(value.differentialResistanceOhm)} Ω`;
  return `<p class="analysis-note">${t('diodeMetricsFor',{id:escapeHtml(metric.id)})}</p>`+
    `<div class="metric-grid"><div class="metric"><div class="metric-label">${t('diodeTerminalVoltage')}</div>`+
    `<div class="metric-value">${format(value.terminalVoltageV)} V</div></div>`+
    `<div class="metric"><div class="metric-label">${t('diodeCurrent')}</div>`+
    `<div class="metric-value">${format(value.currentA)} A</div></div>`+
    `<div class="metric"><div class="metric-label">${t('diodeResistance')}</div>`+
    `<div class="metric-value">${resistance}</div></div></div>`;
}

export interface DiodeContribution {
  row: string;
  column: string;
  coefficient: number;
  units: 'A/A' | 'A/V';
  meaning: 'kcl-p' | 'kcl-n' | 'law-p' | 'law-n' | 'law-current';
  assembled: boolean;
}
export interface DiodeResidualTerm {
  row: string;
  term: string;
  valueA: number;
}

export function diodeResidualTerms(system: DiodeSystem, evaluation: NonlinearEvaluation,
  diodeId: string): DiodeResidualTerm[] {
  const diode = system.diodes.find(device => device.id === diodeId);
  const atBias = evaluation.diode[diodeId];
  if (!diode || !atBias) return [];
  return [
    { row: `KCL(${diode.p})`, term: `+I(${diode.id})`, valueA: atBias.currentA },
    { row: `KCL(${diode.n})`, term: `−I(${diode.id})`, valueA: -atBias.currentA },
    { row: `law(${diode.id})`, term: `I(${diode.id})−Is·expm1(vj/eta)`,
      valueA: atBias.currentA-atBias.modelCurrentA },
  ];
}

/** The auxiliary unknown I(D) flows p→n. Its contributions to F and J are:
 * +I in KCL(p), −I in KCL(n), and the law row
 * F_D=I−Is expm1((Vp−Vn−Rs I)/eta).
 * Hence J_D,Vp=−gj, J_D,Vn=+gj, J_D,I=1+Rs gj.
 * The caller shows both signed terms if p=n so students can see their sum
 * vanish; the assembled matrix owns the combined numerical entry.
 */
export function diodeContributions(system: DiodeSystem, evaluation: NonlinearEvaluation,
  diodeId: string): DiodeContribution[] {
  const diode = system.diodes.find(device => device.id === diodeId);
  const atBias = evaluation.diode[diodeId];
  if (!diode || !atBias) return [];
  const rows: DiodeContribution[] = [];
  const current = `I(${diode.id})`;
  const law = `law(${diode.id})`;
  const addNode = (node: string, kclSign: 1 | -1, lawSign: 1 | -1,
    kclMeaning: 'kcl-p' | 'kcl-n', lawMeaning: 'law-p' | 'law-n'): void => {
    // Show the formal ground terms for teaching, but do not claim that
    // KCL(0) or V(0) is an independent row/column in the reduced MNA solve.
    const assembled = node !== '0';
    rows.push({ row: `KCL(${node})`, column: current, coefficient: kclSign,
      units: 'A/A', meaning: kclMeaning, assembled });
    rows.push({ row: law, column: `V(${node})`,
      coefficient: lawSign * atBias.junctionConductanceS,
      units: 'A/V', meaning: lawMeaning, assembled });
  };
  addNode(diode.p, 1, -1, 'kcl-p', 'law-p');
  addNode(diode.n, -1, 1, 'kcl-n', 'law-n');
  rows.push({ row: law, column: current,
    coefficient: 1 + diode.model.seriesResistanceOhm * atBias.junctionConductanceS,
    units: 'A/A', meaning: 'law-current', assembled: true });
  return rows;
}

/** Coordinates of nonzero combined entries to highlight in the displayed J. */
export function diodeJacobianCoordinates(system: DiodeSystem, evaluation: NonlinearEvaluation,
  diodeId: string): Set<string> {
  const marked = new Set<string>();
  const combined = new Map<string, number>();
  for (const contribution of diodeContributions(system, evaluation, diodeId)) {
    const row = system.rows.findIndex(candidate => candidate.id === contribution.row);
    const column = system.unknowns.findIndex(candidate => candidate.id === contribution.column);
    if (row >= 0 && column >= 0) {
      const coordinate = `${row}:${column}`;
      combined.set(coordinate, (combined.get(coordinate) ?? 0) + contribution.coefficient);
    }
  }
  for (const [coordinate, coefficient] of combined) {
    const [row, column] = coordinate.split(':').map(Number);
    if (row !== undefined && column !== undefined && coefficient !== 0 &&
        evaluation.jacobian[row]?.[column] !== 0) marked.add(coordinate);
  }
  return marked;
}

export function currentDiodeContributions(document: NonlinearDocument,
  bias: NonlinearSuccess, diodeId: string): DiodeContribution[] {
  const system = assembleDiodeSystem(document);
  const evaluation = evaluateDiodeSystem(system, bias.x);
  return evaluation ? diodeContributions(system, evaluation, diodeId) : [];
}
export function currentDiodeResidualTerms(document: NonlinearDocument,
  bias: NonlinearSuccess, diodeId: string): DiodeResidualTerm[] {
  const system = assembleDiodeSystem(document);
  const evaluation = evaluateDiodeSystem(system, bias.x);
  return evaluation ? diodeResidualTerms(system, evaluation, diodeId) : [];
}

export interface TangentProvenance {
  sources: { id: string; biasDC: number; incrementDC: number;
    acRe: number; acIm: number; unit: 'V' | 'A' }[];
  diodes: { id: string; terminalVoltageV: number; currentA: number;
    resistanceOhm: number | null }[];
}

/** Keep the absolute solved Q separate from the zero-DC incremental source. */
export function tangentProvenance(document: NonlinearDocument, tangent: NativeDocument,
  bias: NonlinearSuccess): TangentProvenance {
  const sources = document.experiment.sources.map(source => {
    const component = document.circuit.components.find(device => device.id === source.id);
    const increment = tangent.experiment.sources.find(value => value.id === source.id);
    if (!component || !increment) throw new Error(`Missing tangent source ${source.id}`);
    return { id: source.id, biasDC: source.dc, incrementDC: increment.dc,
      acRe: increment.ac?.re ?? 0, acIm: increment.ac?.im ?? 0,
      unit: component.type === 'I' ? 'A' as const : 'V' as const };
  });
  const diodes = Object.entries(bias.diodes).map(([id, value]) => ({
    id, terminalVoltageV: value.terminalVoltageV, currentA: value.currentA,
    resistanceOhm: value.differentialResistanceOhm }));
  return { sources, diodes };
}

export function tangentProvenanceHtml(document: NonlinearDocument, tangent: NativeDocument,
  bias: NonlinearSuccess): string {
  const data = tangentProvenance(document, tangent, bias);
  const value = (number: number): string => String(Number(number.toPrecision(8)));
  const sources = data.sources.map(source => `<li>${escapeHtml(source.id)}: `+
    `${t('diodeBiasSource')} DC=${value(source.biasDC)} ${source.unit}; `+
    `${t('diodeIncrementSource')} DC=${value(source.incrementDC)} ${source.unit}, `+
    `AC=${value(source.acRe)}${source.acIm < 0 ? '' : '+'}${value(source.acIm)}j ${source.unit} RMS</li>`).join('');
  const diodes = data.diodes.map(diode => `<li>${escapeHtml(diode.id)}: `+
    `Q V=${value(diode.terminalVoltageV)} V, I=${value(diode.currentA)} A; `+
    `rd=${diode.resistanceOhm === null ? t('diodeDerivativeUnavailable') : `${value(diode.resistanceOhm)} Ω`}</li>`).join('');
  return `<div class="soft-note"><p>${t('diodeBiasProvenance')}</p><ul>${sources}${diodes}</ul></div>`;
}
