import { dcOnePort, type OnePortResult, type OnePortSolve } from '../src/one-port.js';
import type { LabState } from './lab.js';
import { escapeHtml, schematic } from './schematic.js';
import { statusSummary } from './diagnostics.js';
import { t, translate, type TranslationKey } from './i18n.js';

const fmt = (value: number): string => value === 0 ? '0' :
  Math.abs(value) < 0.001 || Math.abs(value) >= 1e5 ? value.toExponential(4) : Number(value.toPrecision(7)).toString();
const e = escapeHtml;
const stages: Record<OnePortSolve['stage'], TranslationKey> = {
  open: 'onePortOpen', test: 'onePortTest', short: 'onePortShort',
  'original-load': 'onePortOriginal', 'thevenin-load': 'onePortThevenin', 'norton-load': 'onePortNorton',
};
function statusText(result: OnePortResult): string {
  if (result.status === 'ok') return '';
  const keys: Record<Exclude<OnePortResult['status'], 'ok'>, TranslationKey> = {
    'invalid-port': 'onePortInvalidPort', 'unsupported-device': 'onePortUnsupported',
    'invalid-load': 'onePortInvalidLoad', 'solver-failure': 'onePortSolverFailure',
    'zero-resistance': 'onePortZeroResistance', 'negative-resistance': 'onePortNegativeResistance',
    nonfinite: 'onePortNonfinite',
  };
  const stage = result.stage && (result.status === 'solver-failure' || result.status === 'nonfinite') ? translate(stages[result.stage]) : '';
  const last = result.solves.at(-1)?.result;
  const detail = last && last.status !== 'ok' ? statusSummary(last.status) : '';
  return `${translate(keys[result.status])}${stage ? ` ${stage}.` : ''}${detail ? ` ${detail}` : ''}`;
}
function circuitDiagram(kind: 'original' | 'thevenin' | 'norton', p: string, q: string): string {
  const title = t(kind === 'original' ? 'onePortOriginal' : kind === 'thevenin' ? 'onePortThevenin' : 'onePortNorton');
  const branch = kind === 'original'
    ? `<path d="M75 25v35m0 70v35"/><rect x="29" y="60" width="92" height="70" rx="7"/><text x="75" y="102" text-anchor="middle">N</text>`
    : kind === 'thevenin'
      ? `<path d="M75 25v25m0 38v23m0 29v25"/><circle cx="75" cy="69" r="19"/><path d="M65 65h20m-10-10v20M65 75h20"/><rect x="65" y="111" width="20" height="29"/><text x="95" y="130">Rth</text><text x="103" y="76">Vth</text>`
      : `<path d="M56 25v50m0 40v50M132 25v50m0 40v50"/><circle cx="56" cy="95" r="20"/><path d="M56 105V83m0 0l-6 8m6-8l6 8"/><rect x="122" y="75" width="20" height="40"/><text x="145" y="100">Rth</text><text x="16" y="138">IN ↑</text>`;
  const rail = kind === 'norton' ? 'M56 25h144M56 165h144' : 'M75 25h125M75 165h125';
  return `<figure class="one-port-figure"><figcaption>${e(title)}</figcaption><svg viewBox="0 0 280 190" role="img" aria-label="${e(t('onePortDiagramAria',{kind:title,p,q}))}"><g class="one-port-lines"><path d="${rail}M200 25v50m0 40v50"/>${branch}<rect x="190" y="75" width="20" height="40"/></g><g class="one-port-labels"><text x="211" y="23">+ ${e(p)}</text><text x="211" y="179">− ${e(q)}</text><text x="215" y="100">RL</text><text x="215" y="139">IL ↓</text><text x="144" y="18">i ←</text></g></svg></figure>`;
}
function diagnostics(solves: OnePortSolve[]): string {
  return `<details class="one-port-diagnostics"><summary>${t('onePortDiagnostics')}</summary><p class="analysis-note">${t('onePortCriterion')}</p>${solves.map(({ stage, result }) => {
    const name = translate(stages[stage]);
    if (result.status !== 'ok') return `<p><strong>${name}</strong>: ${e(statusSummary(result.status))}</p>`;
    return `<div class="table-wrap"><table class="result-table"><caption>${name} · ${t('onePortResiduals')}</caption><thead><tr><th>${t('residualRow')}</th><th>${t('absolute')}</th><th>${t('limit')}</th><th>${t('unit')}</th></tr></thead><tbody>${[...result.residuals,result.groundKcl].map(row => `<tr><td>${e(row.label)}</td><td>${fmt(row.absolute)}</td><td>${fmt(row.tolerance)}</td><td>${row.unit}</td></tr>`).join('')}</tbody></table></div><p class="analysis-note">${t('diagnosticSummary',{residual:fmt(result.diagnostics.scaledBackwardResidual),pivot:fmt(result.diagnostics.pivotRatio)})}</p>`;
  }).join('')}</details>`;
}

export class OnePortUI {
  private p = '';
  private q = '';
  private loadText = '2000';
  private document: LabState['document'] | null = null;
  private topology = '';
  constructor(private readonly root: HTMLElement, private readonly getState: () => LabState) {
    root.addEventListener('change', event => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
      if (target.id === 'one-port-p') this.p = target.value;
      else if (target.id === 'one-port-q') this.q = target.value;
      else if (target.id === 'one-port-load') this.loadText = target.value;
      else return;
      this.render();
    });
    root.addEventListener('input', event => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.id === 'one-port-load') this.loadText = target.value;
    });
  }
  render(): void {
    const state = this.getState(), nodes = state.document.circuit.nodes;
    if (state.document !== this.document) {
      this.document = state.document;
      const topology = JSON.stringify({ nodes, components: state.document.circuit.components.map(c =>
        ({ id: c.id, type: c.type, p: c.p, n: c.n })) });
      const probe = state.document.circuit.observations.find((o): o is Extract<typeof o, { type: 'voltage' }> => o.type === 'voltage' && o.p !== o.n);
      if (topology !== this.topology || !nodes.includes(this.p) || !nodes.includes(this.q)) {
        this.p = probe?.p ?? nodes.find(n => n !== '0') ?? '0';
        this.q = probe?.n ?? (this.p === '0' ? nodes.find(n => n !== '0') ?? '0' : '0');
      }
      this.topology = topology;
    }
    const options = (selected: string) => nodes.map(n => `<option value="${e(n)}"${n === selected ? ' selected' : ''}>${e(n)}</option>`).join('');
    const load = Number(this.loadText), validLoad = this.loadText.trim() !== '' && Number.isFinite(load) && load > 0;
    const result = dcOnePort(state.document, this.p, this.q, validLoad ? load : NaN);
    const original = schematic(state);
    let outcome = `<div class="warning" role="status">${e(statusText(result))}</div>`;
    if (result.status === 'ok') {
      const rows = [
        [t('onePortOriginal'), result.original.voltage, result.original.current, '', '', ''],
        [t('onePortThevenin'), result.thevenin.voltage, result.thevenin.current,
          result.theveninComparison.voltageDifference, result.theveninComparison.currentDifference, result.theveninComparison.passed ? t('onePortAgree') : t('onePortDisagree')],
        [t('onePortNorton'), result.norton.voltage, result.norton.current,
          result.nortonComparison.voltageDifference, result.nortonComparison.currentDifference, result.nortonComparison.passed ? t('onePortAgree') : t('onePortDisagree')],
      ] as const;
      outcome = `<div class="metric-grid one-port-metrics"><div class="metric"><div class="metric-label">Vth</div><div class="metric-value">${fmt(result.vth)} V</div></div><div class="metric"><div class="metric-label">Rth</div><div class="metric-value">${fmt(result.rth)} Ω</div></div><div class="metric"><div class="metric-label">IN</div><div class="metric-value">${fmt(result.inorton)} A</div></div></div>
        <p class="analysis-note">${t('onePortTestResult',{current:fmt(result.testCurrent),voltage:fmt(result.rth*result.testCurrent)})} ${t('onePortShortCheck',{short:fmt(result.shortCurrent),difference:fmt(result.shortDifference),limit:fmt(result.shortLimit),status:result.shortPassed?t('onePortAgree'):t('onePortDisagree')})}</p>
        <div class="one-port-diagrams">${circuitDiagram('original',this.p,this.q)}${circuitDiagram('thevenin',this.p,this.q)}${circuitDiagram('norton',this.p,this.q)}</div>
        <div class="table-wrap"><table class="result-table"><caption>${t('onePortComparison')}</caption><thead><tr><th>${t('onePortCircuit')}</th><th>VL (V)</th><th>IL (A)</th><th>|ΔV| (V)</th><th>|ΔI| (A)</th><th>${t('onePortAgreement')}</th></tr></thead><tbody>${rows.map(row => `<tr><th>${e(row[0])}</th><td>${fmt(row[1])}</td><td>${fmt(row[2])}</td><td>${typeof row[3]==='number'?fmt(row[3]):'—'}</td><td>${typeof row[4]==='number'?fmt(row[4]):'—'}</td><td>${row[5]}</td></tr>`).join('')}</tbody></table></div>
        <p class="analysis-note">${t('onePortLoadFormula')}</p>`;
    } else if (result.vth !== undefined || result.rth !== undefined) {
      outcome += `<p class="analysis-note">${result.vth === undefined ? '' : `Vth = ${fmt(result.vth)} V · `}${result.rth === undefined ? '' : `Rth = ${fmt(result.rth)} Ω`}</p>`;
    }
    this.root.innerHTML = `<p class="analysis-note">${t('onePortIntro')}</p><div class="controls-grid one-port-controls"><div class="field"><label for="one-port-p">${t('onePortPositive')}</label><select id="one-port-p">${options(this.p)}</select></div><div class="field"><label for="one-port-q">${t('onePortNegative')}</label><select id="one-port-q">${options(this.q)}</select></div><div class="field"><label for="one-port-load">${t('onePortLoad')}</label><input id="one-port-load" type="number" step="any" value="${e(this.loadText)}" aria-invalid="${!validLoad}" aria-describedby="one-port-load-help"><small id="one-port-load-help" class="field-error">${validLoad?'':t('onePortInvalidLoad')}</small></div></div><p class="soft-note">${t('onePortConvention')}</p><p class="analysis-note">${t('onePortSuppression',{sources:state.document.experiment.sources.map(s=>s.id).join(', ')||t('noSourcesShort'),controlled:state.document.circuit.components.filter(c=>['VCVS','VCCS','CCVS','CCCS'].includes(c.type)).map(c=>c.id).join(', ')||t('noSourcesShort')})}</p><div class="one-port-original"><h3>${t('onePortNetworkView')}</h3><div class="one-port-network">${original.html}</div><p class="muted small">${e(original.note)}</p></div>${outcome}${diagnostics(result.solves)}`;
  }
}
