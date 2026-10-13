import type { Observation } from '../src/model.js';
import type { DraftComponent } from './builder.js';
import { addComponent, addNode, addObservation, applyBuilder, builderConflict, changeInitial, changeWaveform,
  componentReferences, createBuilder, deviceTypes, newBuilder, nodeReferences, reloadBuilder,
  removeComponent, removeNode, renameNode, syncCleanBuilder, touchBuilder, type BuilderState,
  type RenameNodeResult } from './builder.js';
import { validationSummary } from './diagnostics.js';
import { t, translate, type TranslationKey } from './i18n.js';
import type { LabState } from './lab.js';
import { escapeHtml } from './schematic.js';

type Getter = () => LabState;
const e = (value: string | number): string => escapeHtml(String(value));
const attr = (path: string) => `data-builder-field="${e(path)}" id="builder-${e(path.replaceAll(':', '-'))}"`;
const input = (label: string, path: string, value: string, unit = '') =>
  `<div class="field"><label for="builder-${e(path.replaceAll(':', '-'))}">${e(label)}${unit ? ` <span class="unit-note">(${e(unit)})</span>` : ''}</label><input type="text" inputmode="decimal" ${attr(path)} value="${e(value)}"></div>`;
const select = (label: string, path: string, value: string, options: readonly { value: string; label: string }[]) =>
  `<div class="field"><label for="builder-${e(path.replaceAll(':', '-'))}">${e(label)}</label><select ${attr(path)}>${options.map(o => `<option value="${e(o.value)}"${o.value === value ? ' selected' : ''}>${e(o.label)}</option>`).join('')}</select></div>`;
const button = (key: TranslationKey, action: string, index = '') =>
  `<button type="button" class="button outline" data-builder-action="${action}" data-index="${e(index)}">${translate(key)}</button>`;
const rowTitle = (id: string, type: string) => `<h3>${e(id)} · ${e(type)}</h3>`;
const unit = (type: DraftComponent['type']) => type === 'R' || type === 'CCVS' ? 'Ω' : type === 'C' ? 'F' : type === 'L' ? 'H' : type === 'VCCS' ? 'S' : '';
const typeKeys: Record<DraftComponent['type'], TranslationKey> = {
  R: 'builderTypeR', C: 'builderTypeC', L: 'builderTypeL', V: 'builderTypeV', I: 'builderTypeI',
  VCVS: 'builderTypeVCVS', VCCS: 'builderTypeVCCS', CCVS: 'builderTypeCCVS', CCCS: 'builderTypeCCCS', D: 'builderTypeD',
};
export class BuilderUI {
  readonly builder: BuilderState;
  private notice = '';
  private selectedType: DraftComponent['type'] = 'R';
  private selectedObservation: Observation['type'] = 'voltage';
  private nodePending = new Map<string, string>();
  private nodeErrors = new Map<string, Exclude<RenameNodeResult, { ok: true }>['code']>();
  constructor(private readonly root: HTMLElement, private readonly state: Getter, private readonly applied: () => void) {
    this.builder = createBuilder(state());
    root.addEventListener('input', event => this.edit(event.target));
    root.addEventListener('change', event => this.edit(event.target, true));
    root.addEventListener('click', event => this.click(event.target));
  }
  hasUnappliedDraft(): boolean { return this.builder.dirty || this.nodePending.size > 0; }
  startNew(): void { this.clearNodeEdits(); newBuilder(this.builder, this.state()); this.render(); }
  private fieldName(path: string): string {
    const [section, index, field] = path.split(':');
    if (section === 'component') {
      const c = this.builder.draft.circuit.components[Number(index)];
      return `${c?.id ?? index} · ${field === 'value' ? t('value') : field === 'gain' ? t('gain') : t('builderDiodeModel')}`;
    }
    if (section === 'source') {
      const s = this.builder.draft.experiment.sources[Number(index)];
      const names: Record<string, string> = { dc: t('dcValue'), 'ac.re': t('acReal'), 'ac.im': t('acImaginary'),
        'waveform.value': t('timeValue'), 'waveform.at': t('at'), 'waveform.before': t('before'),
        'waveform.after': t('after'), 'waveform.offset': t('offset'), 'waveform.amplitudePeak': t('peakAmplitude'),
        'waveform.frequencyHz': t('frequency'), 'waveform.phaseRadians': t('phase') };
      return `${s?.id ?? index} · ${names[field ?? ''] ?? field}`;
    }
    if (section === 'initial') return t('builderInitialFor', { id: this.builder.draft.experiment.initial.kind === 'storage'
      ? this.builder.draft.experiment.initial.values[Number(index)]?.id ?? index ?? '' : '' });
    return path;
  }
  render(): void {
    if (syncCleanBuilder(this.builder, this.state())) this.clearNodeEdits();
    // A stale editable draft remains visible with its conflict. Only the v3
    // placeholder is unsupported; explicit New creates an editable v1 draft.
    if (this.builder.unsupported) {
      this.root.innerHTML = `<p class="warning">${t('bjtFormUnavailable')}</p>`;
      return;
    }
    const d = this.builder.draft, nodes = d.circuit.nodes.map(n => ({ value: n, label: n }));
    const controls = d.circuit.components.filter(c => c.type === 'V' || c.type === 'VCVS' || c.type === 'CCVS').map(c => ({ value: c.id, label: c.id }));
    const componentOptions = d.circuit.components.map(c => ({ value: c.id, label: `${c.id} · ${c.type}` }));
    const conflict = builderConflict(this.builder, this.state());
    const status = conflict ? t('builderConflict') : this.builder.dirty ? t('builderUnapplied') : t('builderSynced');
    const err = this.builder.error;
    this.root.innerHTML = `<p class="muted small">${t('builderHint')}</p>
      <p class="soft-note">${t('builderOrientation')}</p>
      <p class="builder-status" role="status">${status}</p>
      ${this.notice ? `<div class="warning" role="alert">${e(this.notice)}</div>` : ''}
      ${err ? `<div class="error-card" role="alert">${e(err.code === 'builderConflict' ? t('builderConflict') : err.code === 'builderFinite' ? t('builderFinite', { field: this.fieldName(String(err.params.field ?? '')) }) : validationSummary(err.code, err.params))}</div>` : ''}
      <div class="file-actions">${button('builderNew', 'new')}${button('builderCopy', 'copy')}</div>
      <div class="subheading">${t('builderNodes')}</div>
      ${d.circuit.nodes.map((n, i) => `<div class="builder-row"><div class="field"><label for="builder-node-${i}">${t('builderNode')} ${i + 1}</label><input id="builder-node-${i}" data-builder-field="node:${i}:id" value="${e(this.nodePending.get(n) ?? n)}" ${n === '0' ? 'readonly' : ''} ${this.nodeErrors.has(n) ? 'aria-invalid="true"' : ''}>${this.nodeErrors.has(n) ? `<span class="field-error" role="alert">${e(translate(this.nodeErrors.get(n)!))}</span>` : ''}</div>${n === '0' ? '' : button('builderRemove', 'remove-node', String(i))}</div>`).join('')}
      ${button('builderAddNode', 'add-node')}
      <div class="subheading">${t('builderComponents')}</div>
      ${d.circuit.components.map((c, i) => `<div class="builder-card" data-builder-row="component:${i}">${rowTitle(c.id, c.type)}
        ${input(t('builderLabel'), `component:${i}:label`, c.label ?? '')}
        <div class="field-row">${select('p', `component:${i}:p`, c.p, nodes)}${select('n', `component:${i}:n`, c.n, nodes)}</div>
        ${'value' in c ? input(t('value'), `component:${i}:value`, c.value, unit(c.type)) : ''}
        ${'gain' in c ? input(t('gain'), `component:${i}:gain`, c.gain, unit(c.type)) : ''}
        ${c.type === 'D' ? `<p class="muted small">${t('diodeModelNote')}</p><div class="controls-grid">${input(t('diodeIs'),`component:${i}:saturationCurrentA`,c.model.saturationCurrentA,'A')}${input(t('diodeIdeality'),`component:${i}:idealityFactor`,c.model.idealityFactor)}${input(t('diodeRs'),`component:${i}:seriesResistanceOhm`,c.model.seriesResistanceOhm,'Ω')}${input(t('diodeTemperature'),`component:${i}:temperatureK`,c.model.temperatureK,'K')}</div>` : ''}
        ${'cp' in c ? `<div class="field-row">${select(t('builderControlP'), `component:${i}:cp`, c.cp, nodes)}${select(t('builderControlN'), `component:${i}:cn`, c.cn, nodes)}</div>` : ''}
        ${'control' in c ? select(t('builderControlBranch'), `component:${i}:control`, c.control, [{ value: '', label: t('builderChooseBranch') }, ...controls]) : ''}
        ${button('builderRemove', 'remove-component', String(i))}</div>`).join('')}
      <div class="field-row">${select(t('builderDeviceType'), 'add:type', this.selectedType, deviceTypes.map(type => ({ value: type, label: translate(typeKeys[type]) })))}<div class="builder-add">${button('builderAddComponent', 'add-component')}</div></div>
      <div class="subheading">${t('builderObservations')}</div>
      ${d.circuit.observations.map((o, i) => `<div class="builder-card" data-builder-row="observation:${i}">${rowTitle(o.id, t(o.type === 'voltage' ? 'builderVoltage' : 'builderCurrent'))}
        ${input(t('builderLabel'), `observation:${i}:label`, o.label ?? '')}
        ${o.type === 'voltage' ? `<div class="field-row">${select('p', `observation:${i}:p`, o.p, nodes)}${select('n', `observation:${i}:n`, o.n, nodes)}</div>`
          : select(t('builderMeasuredBranch'), `observation:${i}:component`, o.component, componentOptions)}
        ${button('builderRemove', 'remove-observation', String(i))}</div>`).join('')}
      <div class="field-row">${select(t('builderObservationType'), 'add:observation', this.selectedObservation,
        [{ value: 'voltage', label: t('builderVoltage') }, { value: 'current', label: t('builderCurrent') }])}<div class="builder-add">${button('builderAddObservation', 'add-observation')}</div></div>
      <div class="subheading">${t('builderSources')}</div>
      <p class="muted small">${t('builderDefaults')}</p>
      ${d.experiment.sources.map((s, i) => {
        const source = d.circuit.components.find(c => c.id === s.id);
        const u = source?.type === 'I' ? 'A' : 'V';
        return `<div class="builder-card" data-builder-row="source:${i}">${rowTitle(s.id, u)}
          ${input(t('dcValue'), `source:${i}:dc`, s.dc, u)}
          <label class="builder-check"><input type="checkbox" data-builder-field="source:${i}:ac-enabled" ${s.ac ? 'checked' : ''}>${t('builderAcEnabled')}</label>
          ${s.ac ? `<div class="field-row">${input(t('acReal'), `source:${i}:ac.re`, s.ac.re, `${u} RMS`)}${input(t('acImaginary'), `source:${i}:ac.im`, s.ac.im, `${u} RMS`)}</div>` : ''}
          ${select(t('transientWaveform'), `source:${i}:waveform.type`, s.waveform?.type ?? 'none', [
            { value: 'none', label: t('builderNoWaveform') }, { value: 'constant', label: t('constant') },
            { value: 'step', label: t('scheduledStep') }, { value: 'sinusoid', label: t('sinusoid') }])}
          ${s.waveform?.type === 'constant' ? input(t('timeValue'), `source:${i}:waveform.value`, s.waveform.value, u) : ''}
          ${s.waveform?.type === 'step' ? `<div class="field-row">${input(t('at'), `source:${i}:waveform.at`, s.waveform.at, 's')}${input(t('before'), `source:${i}:waveform.before`, s.waveform.before, u)}${input(t('after'), `source:${i}:waveform.after`, s.waveform.after, u)}</div>` : ''}
          ${s.waveform?.type === 'sinusoid' ? `<div class="field-row">${input(t('offset'), `source:${i}:waveform.offset`, s.waveform.offset, u)}${input(t('peakAmplitude'), `source:${i}:waveform.amplitudePeak`, s.waveform.amplitudePeak, u)}${input(t('frequency'), `source:${i}:waveform.frequencyHz`, s.waveform.frequencyHz, 'Hz')}${input(t('phase'), `source:${i}:waveform.phaseRadians`, s.waveform.phaseRadians, 'rad')}</div><p class="muted small">${t('peakVsRms')}</p>` : ''}
          </div>`;
      }).join('') || `<p class="muted small">${t('noSource')}</p>`}
      <div class="subheading">${t('initialization')}</div>
      ${select(t('policy'), 'initial:kind', d.experiment.initial.kind, [{ value: 'equilibrium', label: t('equilibriumBefore') }, { value: 'storage', label: t('specifiedStorage') }])}
      ${d.experiment.initial.kind === 'storage' ? d.experiment.initial.values.map((v, i) => input(t('builderInitialFor', { id: v.id }), `initial:${i}:value`, v.value,
        d.circuit.components.find(c => c.id === v.id)?.type === 'C' ? 'V' : 'A')).join('') : ''}
      <p class="muted small">${t('storageHint')}</p>
      <div class="file-actions">${button('builderApply', 'apply')}${button('builderDiscard', 'discard')}</div>`;
    if (err?.field) this.root.querySelector<HTMLInputElement>(`#builder-${err.field.replaceAll(':', '-')}`)?.setAttribute('aria-invalid', 'true');
  }
  private clearNodeEdits(): void { this.nodePending.clear(); this.nodeErrors.clear(); }
  private commitNode(id: string): boolean {
    const pending = this.nodePending.get(id);
    if (pending === undefined) return true;
    const result = renameNode(this.builder, this.builder.draft.circuit.nodes.indexOf(id), pending);
    if (!result.ok) { this.nodeErrors.set(id, result.code); return false; }
    this.nodePending.delete(id); this.nodeErrors.delete(id);
    return true;
  }
  private edit(target: EventTarget | null, changed = false): void {
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    const path = target.dataset.builderField; if (!path) return;
    const [section, indexText, key] = path.split(':');
    if (section === 'add') {
      if (indexText === 'type') this.selectedType = target.value as DraftComponent['type'];
      if (indexText === 'observation') this.selectedObservation = target.value as Observation['type'];
      return;
    }
    if (section === 'node') {
      const index = Number(indexText);
      const id = this.builder.draft.circuit.nodes[index];
      if (id === undefined || id === '0') return;
      this.nodePending.set(id, target.value);
      this.nodeErrors.delete(id);
      touchBuilder(this.builder);
      if (changed) { this.commitNode(id); this.render(); }
      else this.root.querySelector<HTMLElement>('.builder-status')!.textContent = t('builderUnapplied');
      return;
    }
    const d = this.builder.draft;
    if (section === 'component') {
      const c = d.circuit.components[Number(indexText)]; if (!c || !key) return;
      if (key === 'p' || key === 'n') c[key] = target.value;
      else if (key === 'label') { if (target.value) c.label = target.value; else delete c.label; }
      else if (key === 'value' && 'value' in c) c.value = target.value;
      else if (key === 'gain' && 'gain' in c) c.gain = target.value;
      else if (c.type === 'D' && key in c.model && key !== 'kind') Object.assign(c.model, { [key]: target.value });
      else if ((key === 'cp' || key === 'cn') && 'cp' in c) c[key] = target.value;
      else if (key === 'control' && 'control' in c) c.control = target.value;
    } else if (section === 'observation') {
      const o = d.circuit.observations[Number(indexText)]; if (!o || !key) return;
      if (key === 'label') { if (target.value) o.label = target.value; else delete o.label; }
      else if ((key === 'p' || key === 'n') && o.type === 'voltage') o[key] = target.value;
      else if (key === 'component' && o.type === 'current') o.component = target.value;
    } else if (section === 'source') {
      const s = d.experiment.sources[Number(indexText)]; if (!s || !key) return;
      if (key === 'dc') s.dc = target.value;
      else if (key === 'ac-enabled' && changed) {
        if (target instanceof HTMLInputElement && target.checked) s.ac = { re: '0', im: '0' }; else delete s.ac;
      } else if (key === 'ac.re' && s.ac) s.ac.re = target.value;
      else if (key === 'ac.im' && s.ac) s.ac.im = target.value;
      else if (key === 'waveform.type' && changed) changeWaveform(this.builder, s.id, target.value as 'none' | 'constant' | 'step' | 'sinusoid');
      else if (key.startsWith('waveform.') && s.waveform) {
        const field = key.slice('waveform.'.length);
        if (field in s.waveform) Object.assign(s.waveform, { [field]: target.value });
      }
    } else if (section === 'initial') {
      if (indexText === 'kind' && changed) changeInitial(this.builder, target.value as 'equilibrium' | 'storage');
      else if (key === 'value' && d.experiment.initial.kind === 'storage') {
        const v = d.experiment.initial.values[Number(indexText)]; if (v) v.value = target.value;
      }
    }
    touchBuilder(this.builder); this.notice = '';
    if (changed && (target instanceof HTMLSelectElement || target.type === 'checkbox')) this.render();
    else this.root.querySelector<HTMLElement>('.builder-status')!.textContent = t('builderUnapplied');
  }
  private click(target: EventTarget | null): void {
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('[data-builder-action]'); if (!button) return;
    const action = button.dataset.builderAction, index = Number(button.dataset.index);
    this.notice = '';
    if (action === 'new') { this.clearNodeEdits(); newBuilder(this.builder, this.state()); }
    else if (action === 'copy' || action === 'discard') { this.clearNodeEdits(); reloadBuilder(this.builder, this.state()); }
    else if (action === 'add-node') addNode(this.builder);
    else if (action === 'remove-node') {
      const id = this.builder.draft.circuit.nodes[index];
      const refs = id === undefined ? [] : nodeReferences(this.builder, id);
      if (id === '0') this.notice = t('builderGroundProtected');
      else if (refs.length) this.notice = t('builderNodeReferenced', { id: id ?? '', refs: refs.join(', ') });
      else if (id !== undefined) {
        removeNode(this.builder, id);
        this.nodePending.delete(id); this.nodeErrors.delete(id);
      }
    } else if (action === 'add-component') addComponent(this.builder, this.selectedType);
    else if (action === 'remove-component') {
      const id = this.builder.draft.circuit.components[index]?.id;
      const refs = id === undefined ? [] : componentReferences(this.builder, id);
      if (refs.length) this.notice = t('builderComponentReferenced', { id: id ?? '', refs: refs.join(', ') });
      else if (id !== undefined) removeComponent(this.builder, id);
    } else if (action === 'add-observation') addObservation(this.builder, this.selectedObservation);
    else if (action === 'remove-observation') {
      this.builder.draft.circuit.observations.splice(index, 1); touchBuilder(this.builder);
    } else if (action === 'apply') {
      if (![...this.nodePending.keys()].every(id => this.commitNode(id))) { this.render(); return; }
      const result = applyBuilder(this.builder, this.state());
      if (result.ok) { this.clearNodeEdits(); this.applied(); }
    }
    this.render();
  }
}
