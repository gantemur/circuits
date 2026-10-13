import type { NonlinearDocument } from '../src/nonlinear-model.js';
import type { NonlinearTransientResult } from '../src/diode-transient.js';
import type { LabState } from './lab.js';
import type { PanelConfig, WorkspaceState } from './workspace.js';
import type { TransientWorkerReply, TransientWorkerRequest } from './nonlinear-worker-contract.js';

export type TransientRunStatus = 'running' | 'complete' | 'numerical-failure' |
  'cancelled' | 'invalidated' | 'execution-unavailable' | 'execution-error';
export interface TransientRunView {
  token: number; panelId: string; document: LabState['document']; revision: number;
  settings: string; status: TransientRunStatus; result: NonlinearTransientResult | null;
  error: string | null; active: boolean;
}
type WorkerLike = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>;
type WorkerResource = { worker: WorkerLike; release: () => void };

/** An upper bound: each distinct interior step event can restart a nominal grid. */
export function transientIntervalBound(document: NonlinearDocument, stop: number, step: number): number {
  if (!Number.isFinite(stop) || stop <= 0 || stop > 10 ||
      !Number.isFinite(step) || step <= 0) return Infinity;
  const events = new Set<number>();
  for (const source of document.experiment.sources) {
    const waveform = source.waveform;
    if (waveform?.type === 'step' && waveform.at > 0 && waveform.at < stop)
      events.add(waveform.at);
  }
  return Math.ceil(stop / step) + events.size;
}

/** N MNA/diode coordinates plus m compatible storage-rate coordinates. */
export function augmentedTransientUnknowns(document: NonlinearDocument): number {
  const components = document.circuit.components;
  const nodeVoltages = document.circuit.nodes.filter(node => node !== '0').length;
  const branchAndJunctionUnknowns = components.filter(component =>
    ['L', 'V', 'VCVS', 'CCVS', 'D'].includes(component.type)).length;
  const storageRates = components.filter(component => component.type === 'C' || component.type === 'L').length;
  return nodeVoltages + branchAndJunctionUnknowns + storageRates;
}
export const transientSignature = (panel: PanelConfig): string =>
  JSON.stringify([panel.output, panel.duration, panel.step]);

/**
 * One owned worker across all panels. A view is retired permanently on an
 * identity change; equality after a later change cannot revive it. The
 * factory makes actual Worker termination and stale callbacks testable.
 */
export class TransientRunLifecycle {
  private nextToken = 1;
  private views = new Map<string, TransientRunView>();
  private running: { view: TransientRunView; resource: WorkerResource } | null = null;
  constructor(private readonly createWorker: () => WorkerResource,
    private readonly changed: () => void) {}

  get(panelId: string): TransientRunView | undefined { return this.views.get(panelId); }
  get activePanelId(): string | null { return this.running?.view.panelId ?? null; }

  private stopWorker(view: TransientRunView): void {
    if (this.running?.view !== view) return;
    const resource = this.running.resource;
    this.running = null;
    resource.worker.onmessage = null;
    resource.worker.onerror = null;
    resource.worker.onmessageerror = null;
    resource.worker.terminate();
    resource.release();
  }
  private retire(view: TransientRunView, status: 'cancelled' | 'invalidated'): void {
    this.stopWorker(view);
    view.active = false;
    view.status = status;
    view.result = null;
  }
  cancel(panelId: string): void {
    const view = this.views.get(panelId);
    if (!view || view.status !== 'running') return;
    this.retire(view, 'cancelled');
    this.changed();
  }
  private matches(view: TransientRunView, panel: PanelConfig | undefined,
    state: LabState, workspace: WorkspaceState, visible: boolean): boolean {
    // Document object and monotone revision jointly identify an applied
    // scientific document; a later return to identical control text cannot
    // resurrect a retired run.
    return view.active && visible && workspace.view === 'analyze' &&
      panel?.type === 'transient' && !panel.collapsed && !panel.selectionNeeded &&
      Object.keys(panel.pending).filter(key => key === 'duration' || key === 'step').length === 0 &&
      state.document === view.document && state.revision === view.revision &&
      transientSignature(panel) === view.settings;
  }
  reconcile(state: LabState, workspace: WorkspaceState, visible: boolean): void {
    for (const [id, view] of this.views) {
      const panel = workspace.panels.find(candidate => candidate.id === id);
      if (!this.matches(view, panel, state, workspace, visible) && view.active)
        this.retire(view, 'invalidated');
      if (!panel) this.views.delete(id);
    }
  }
  canExport(panel: PanelConfig, state: LabState, workspace: WorkspaceState, visible: boolean): boolean {
    const view = this.views.get(panel.id);
    return !!view && !!view.result &&
      (view.status === 'complete' || (view.status === 'numerical-failure' && view.result.samples.length > 0)) &&
      this.matches(view, panel, state, workspace, visible);
  }
  start(panel: PanelConfig, state: LabState, workspace: WorkspaceState, visible: boolean): TransientRunView | null {
    this.reconcile(state, workspace, visible);
    if (this.running || state.document.circuit.schemaVersion !== 2 || panel.type !== 'transient' ||
        panel.selectionNeeded || panel.collapsed || workspace.view !== 'analyze' || !visible) return null;
    const document = state.document as NonlinearDocument;
    const hasPendingTime = panel.pending.duration !== undefined || panel.pending.step !== undefined;
    if (hasPendingTime || transientIntervalBound(document, panel.duration, panel.step) > 3000 ||
        augmentedTransientUnknowns(document) > 64) return null;
    const prior = this.views.get(panel.id);
    if (prior?.status === 'running') this.retire(prior, 'invalidated');
    const view: TransientRunView = { token: this.nextToken++, panelId: panel.id,
      document: state.document, revision: state.revision, settings: transientSignature(panel),
      status: 'running', result: null, error: null, active: true };
    this.views.set(panel.id, view);
    let resource: WorkerResource;
    try { resource = this.createWorker(); }
    catch (error) {
      view.status = 'execution-unavailable';
      view.error = error instanceof Error ? error.message : String(error);
      this.changed();
      return view;
    }
    this.running = { view, resource };
    const finish = (status: TransientRunStatus, result: NonlinearTransientResult | null, error: string | null) => {
      if (this.running?.view !== view || !view.active) return;
      this.stopWorker(view);
      view.status = status; view.result = result; view.error = error;
      this.changed();
    };
    resource.worker.onmessage = (event: MessageEvent<TransientWorkerReply>) => {
      const reply = event.data;
      if (reply?.token !== view.token) return;
      if (reply.kind !== 'result' && reply.kind !== 'error') {
        finish('execution-error', null, 'Invalid worker response'); return;
      }
      if (reply.kind === 'error') { finish('execution-error', null, reply.message); return; }
      if (!reply.result || (reply.result.status !== 'ok' && reply.result.status !== 'failed') ||
          !Array.isArray(reply.result.samples)) {
        finish('execution-error', null, 'Invalid worker result'); return;
      }
      finish(reply.result.status === 'ok' ? 'complete' : 'numerical-failure', reply.result, null);
    };
    resource.worker.onerror = () => finish('execution-error', null, 'Worker runtime error');
    resource.worker.onmessageerror = () => finish('execution-error', null, 'Worker message could not be read');
    try {
      const request: TransientWorkerRequest = { kind: 'run', token: view.token,
        document: structuredClone(document), options: { start: 0, stop: panel.duration,
          step: panel.step, maxIntervals: 3000, maxUnknowns: 64, maxIterations: 60, maxBacktracks: 30 } };
      resource.worker.postMessage(request);
    }
    catch (error) { finish('execution-error', null, error instanceof Error ? error.message : String(error)); }
    this.changed();
    return view;
  }
}
