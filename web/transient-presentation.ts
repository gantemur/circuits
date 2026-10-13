import type { NonlinearTransientResult, TransientSample } from '../src/diode-transient.js';
import type { NonlinearDocument } from '../src/nonlinear-model.js';
import { t } from './i18n.js';
import { plot, type PlotPoint } from './plot.js';
import { escapeHtml } from './schematic.js';
import type { TransientRunView } from './transient-run.js';

const e = (value: unknown): string => escapeHtml(value);
const n = (value: number | null | undefined): string => value == null ? '—' :
  value === 0 ? '0' : Number.isFinite(value) ? Number(value.toPrecision(8)).toString() : String(value);
const table = (headings: string[], rows: (string | number)[][]): string =>
  `<div class="table-wrap"><table class="result-table"><thead><tr>${headings.map(h => `<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${e(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const values = (entries: Record<string, { value: number; unit: string }>): string =>
  table(['ID', t('value'), t('unit')], Object.entries(entries).map(([id, value]) => [id, n(value.value), value.unit]));

/** The browser reads only accepted, owned kernel samples; no transient state is Q. */
export function transientSampleDetails(sample: TransientSample): string {
  const diodeRows = Object.entries(sample.diodes).map(([id, diode]) =>
    [id, n(diode.terminalVoltageV), n(diode.junctionVoltageV), n(diode.currentA)]);
  const storageRows = sample.storage.map(storage =>
    [storage.id, n(storage.value), storage.unit, n(storage.rate), storage.rateUnit]);
  const branchRows = sample.powers.map(power =>
    [power.id, n(power.voltageV), n(power.currentA), n(power.absorbedW), n(power.powerArithmeticAllowanceW)]);
  const residualRows = [...sample.residuals, sample.groundKcl].map(row =>
    [row.label, n(row.value.re), row.unit, n(row.physicalAllowance), n(row.arithmeticAllowance)]);
  const correctionRows = sample.trace.map(trace =>
    [trace.iteration, n(trace.damping), n(trace.voltageCorrectionV), n(trace.currentCorrectionA),
      trace.storageRateCorrection.map(c => `${c.id}: ${n(c.value)} ${c.unit}`).join('; ')]);
  return `<p>${e(t('transientConvention'))}</p>
    <h4>${t('transientObservations')}</h4>${values(sample.observations)}
    <h4>${t('transientWaveforms')}</h4>${values(sample.sources)}
    <h4>${t('transientUnknowns')}</h4>${values(sample.unknowns)}
    <h4>${t('transientDiodes')}</h4>${table(['ID','Vterminal (V)','Vjunction (V)','I (A)'],diodeRows)}
    <h4>${t('transientStorage')}</h4>${table(['ID',t('value'),t('unit'),'rate','rate unit'],storageRows)}
    <h4>${t('transientBranchPowers')}</h4>${table(['ID','V (V)','I (A)','Pabs (W)',`${t('transientArithmetic')} (W)`],branchRows)}
    <h4>${t('transientRows')} · ${t('transientGround')}</h4>${table(['row','residual','unit',t('transientPhysical'),t('transientArithmetic')],residualRows)}
    <h4>${t('transientPower')}</h4>${table(['ΣP (W)',`${t('transientPhysical')} (W)`,`${t('transientArithmetic')} (W)`],
      [[n(sample.powerBalanceW),n(sample.powerPhysicalAllowanceW),n(sample.powerArithmeticAllowanceW)]])}
    <h4>${t('transientEnergy')}</h4>${table(['W (J)','D_BE (J)','balance (J)',`${t('transientPhysical')} (J)`,`${t('transientArithmetic')} (J)`],
      [[n(sample.energyJ),n(sample.backwardEulerDissipationJ),n(sample.energyBalanceJ),
        n(sample.energyPhysicalAllowanceJ),n(sample.energyArithmeticAllowanceJ)]])}
    <h4>${t('transientNewton')}</h4>${table(['iteration','damping','ΔV (V)','ΔI (A)','storage rate'],correctionRows)}`;
}

const waveform = (source: NonlinearDocument['experiment']['sources'][number]): string => {
  const value = source.waveform;
  if (!value) return t('transientDcSource',{id:source.id,value:n(source.dc)});
  if (value.type === 'constant') return t('transientConstantSource',{id:source.id,value:n(value.value)});
  if (value.type === 'step') return t('transientStepSource',{id:source.id,before:n(value.before),after:n(value.after),time:n(value.at)});
  return t('transientSineSource',{id:source.id,offset:n(value.offset),peak:n(value.amplitudePeak),frequency:n(value.frequencyHz),phase:n(value.phaseRadians)});
};

/** Same-time left/right points remain consecutive, yielding a vertical SVG segment. */
export function transientResultHtml(panelId: string, document: NonlinearDocument, outputId: string, duration: number,
  step: number, view: TransientRunView | undefined, selectedIndex: number, overlay: boolean,
  otherRunning: boolean, blocked: string | null, eventsOpen = false, diagnosticsOpen = false): string {
  const observation = document.circuit.observations.find(value => value.id === outputId);
  const unit = observation?.type === 'current' ? 'A' : 'V';
  const intro = `<p class="analysis-note">${e(outputId)} (${unit}). ${e(t('transientRequest',{duration:n(duration),step:n(step)}))}</p>`;
  const initial = document.experiment.initial.kind === 'equilibrium'
    ? t('transientEquilibriumLeft') :
      `${t('transientPrescribed')}: ${document.experiment.initial.values.map(value => `${value.id}=${n(value.value)}`).join(', ')}`;
  const definitions = `<p>${t('transientInitial')}: ${e(initial)}</p><p>${t('transientWaveforms')}: ${e(document.experiment.sources.map(waveform).join('; '))}</p>
    <p><button type="button" class="button quiet" data-transient-edit>${t('transientEditSources')}</button></p>`;
  const running = view?.status === 'running';
  const controls = `<div class="file-actions"><button type="button" class="button" data-panel-action="run-transient" data-panel-id="${e(panelId)}" data-transient-blocked="${!!blocked}" data-transient-other-running="${otherRunning}" ${blocked || running || otherRunning ? 'disabled' : ''}>${t('transientRun')}</button>${running ? `<button type="button" class="button quiet" data-panel-action="cancel-transient" data-panel-id="${e(panelId)}">${t('transientCancel')}</button>` : ''}</div>`;
  const state = !view ? t('transientIdle') : view.status === 'running' ? t('transientRunning') :
    view.status === 'complete' ? t('transientComplete') : view.status === 'cancelled' ? t('transientCancelled') :
    view.status === 'invalidated' ? t('transientInvalidated') : view.status === 'execution-unavailable' ? t('transientUnavailable') :
    view.status === 'execution-error' ? t('transientExecutionError',{reason:view.error ?? ''}) : '';
  const blockedText = blocked ? `<p class="warning" role="status">${e(blocked)}</p>` :
    otherRunning ? `<p class="warning" role="status" data-transient-other-running-note>${t('transientOtherRunning')}</p>` : '';
  let html = `${intro}${definitions}${controls}${blockedText}${state ? `<p role="status">${e(state)}</p>` : ''}`;
  const result = view?.result;
  if (!result) return html;
  if (result.status === 'failed') {
    html += `<p class="warning" role="status">${e(t('transientFailureDetail',{time:n(result.time),stage:result.stage,code:result.code}))}</p>`;
  }
  const samples = result.samples;
  if (!samples.length) return html + `<p class="warning">${t('transientNoPrefix')}</p>`;
  // The prior selection may outlive a longer run. The option and its details
  // must refer to the same accepted sample in the new result.
  const shownIndex = Math.max(0, Math.min(samples.length - 1, selectedIndex));
  const selected = samples[shownIndex]!;
  const distinctTimes = new Set(samples.map(sample => sample.time));
  const points: PlotPoint[] = samples.map(sample => ({ x:sample.time,
    y:sample.observations[outputId]?.value ?? null, status:'ok' }));
  if (result.status === 'failed') points.push({ x:result.time, y:null, status:'failed' });
  if (distinctTimes.size === 1) {
    html += `<p>${t('transientSingleTime')}</p>`;
    html += table([t('timeAxis'),t('transientSide'),`${outputId} (${unit})`],
      samples.map(sample => [n(sample.time),t(`transient${sample.side[0]!.toUpperCase()}${sample.side.slice(1)}` as 'transientLeft'|'transientRight'|'transientRegular'),n(sample.observations[outputId]?.value)]));
  } else {
    const overlaySources = unit === 'V' && overlay ? document.experiment.sources
      .filter(source => document.circuit.components.some(c => c.id === source.id && c.type === 'V')) : [];
    html += plot(points,{title:`${outputId} (${unit})`,xLabel:t('timeAxis'),yLabel:`${outputId} (${unit})`,
      overlays:overlaySources.map(source => ({ label:`${source.id} (${unit})`,style:'dashed',
        points:samples.map(sample => ({x:sample.time,y:sample.sources[source.id]?.value ?? null,status:'ok'})) }))});
  }
  if (unit === 'V' && document.experiment.sources.some(source =>
      document.circuit.components.some(c => c.id === source.id && c.type === 'V'))) {
    html += `<label><input type="checkbox" data-transient-overlay ${overlay ? 'checked' : ''}>${t('transientSourceOverlay')}</label>
      <p class="muted small">${t('transientSourceOverlayNote')}</p>`;
  }
  const eventSamples = samples.filter(sample => sample.side !== 'regular');
  if (eventSamples.length) html += `<details class="explanation" data-transient-details="events" ${eventsOpen?'open':''}><summary>${t('transientEventTable')}</summary>${table(
    [t('timeAxis'),t('transientSide'),`${outputId} (${unit})`,...document.experiment.sources.map(s => s.id)],
    eventSamples.map(sample => [n(sample.time),t(sample.side==='left'?'transientLeft':'transientRight'),n(sample.observations[outputId]?.value),
      ...document.experiment.sources.map(source => n(sample.sources[source.id]?.value))]))}</details>`;
  html += `<details class="explanation" data-transient-details="diagnostics" ${diagnosticsOpen?'open':''}><summary>${t('transientSampleDiagnostics')}</summary><label>${t('transientSample')}
    <select data-transient-sample>${samples.map((sample,index) => `<option value="${index}" ${index===shownIndex?'selected':''}>${n(sample.time)} s · ${t(sample.side==='left'?'transientLeft':sample.side==='right'?'transientRight':'transientRegular')} · #${index+1}</option>`).join('')}</select></label>
    <p>${t('transientInterval')}: ${n(selected.intervalSeconds)}; ${e(selected.currentConvention)}</p>
    ${transientSampleDetails(selected)}</details><p class="muted small">${t('transientNotCertified')}</p>`;
  return html;
}

const cell = (value: string | number | null): string => `"${String(value ?? '').replaceAll('"','""')}"`;
const line = (values: (string | number | null)[]): string => values.map(cell).join(',');
export function transientCsv(result: NonlinearTransientResult, outputId: string): string {
  const unit = result.document.circuit.observations.find(o => o.id === outputId)?.type === 'current' ? 'A' : 'V';
  const rows = result.samples.map(sample => line([outputId,unit,sample.time,sample.side,
    sample.intervalSeconds,sample.currentConvention,sample.observations[outputId]?.value ?? null,
    'accepted','','']));
  if (result.status === 'failed') rows.push(line([outputId,unit,result.time,'',null,'',null,
    'failed',result.stage,result.code]));
  return [line(['observation_id','unit','time_s','side','interval_s','current_convention',
    'value','sample_status','failure_stage','failure_code']),...rows].join('\n')+'\n';
}

/**
 * A focused time-field input retires the one active worker synchronously.
 * Update only the other panels' stale Run controls, leaving the focused input
 * in the DOM for its native change and blur events to commit pending text.
 */
export function releaseOtherTransientRunControls(root: ParentNode): void {
  for (const button of Array.from(root.querySelectorAll<HTMLButtonElement>(
      'button[data-panel-action="run-transient"][data-transient-other-running="true"]'))) {
    button.disabled = button.dataset.transientBlocked === 'true';
    button.dataset.transientOtherRunning = 'false';
  }
  for (const note of Array.from(root.querySelectorAll<HTMLElement>('[data-transient-other-running-note]')))
    note.remove();
}
