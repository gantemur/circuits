import { runDcSweep, type DcSweepResult } from './dc-sweep.js';
import type { LabState } from './lab.js';
import type { PanelConfig, WorkspaceState } from './workspace.js';

export interface SweepView {
  document: LabState['document'];
  revision: number;
  settings: string;
  status: 'running' | 'complete' | 'cancelled';
  points: DcSweepResult['points'];
  result: DcSweepResult | undefined;
  /** A one-way latch: restoring old settings never revives an obsolete run. */
  active: boolean;
}

export function sweepSignature(panel: PanelConfig): string {
  return JSON.stringify([panel.input, panel.output, panel.sweepMin, panel.sweepMax, panel.sweepCount]);
}

/** Owns the asynchronous run, not the scientific document or the bias cache.
 * The UI calls reconcile after its ordinary transition handlers. A run is
 * permanently retired as soon as any captured identity or setting differs.
 */
export class SweepLifecycle {
  private readonly views = new Map<string, SweepView>();

  get(panelId: string): SweepView | undefined { return this.views.get(panelId); }

  private retire(view: SweepView): void {
    view.active = false;
    view.status = 'cancelled';
    view.result = undefined;
  }

  cancel(panelId: string): void {
    const view = this.views.get(panelId);
    if (view) this.retire(view);
  }

  private matches(view: SweepView, panel: PanelConfig | undefined, state: LabState,
    workspace: WorkspaceState, pageVisible: boolean): boolean {
    return view.active && pageVisible && workspace.view === 'analyze' &&
      panel?.type === 'dc-sweep' && !panel.collapsed && !panel.selectionNeeded &&
      state.document === view.document && state.revision === view.revision &&
      sweepSignature(panel) === view.settings;
  }

  reconcile(state: LabState, workspace: WorkspaceState, pageVisible: boolean): void {
    for (const [id, view] of this.views) {
      const panel = workspace.panels.find(candidate => candidate.id === id);
      if (!this.matches(view, panel, state, workspace, pageVisible)) this.retire(view);
      if (!panel) this.views.delete(id);
    }
  }

  canExport(panel: PanelConfig, state: LabState, workspace: WorkspaceState,
    pageVisible: boolean): boolean {
    const view = this.views.get(panel.id);
    return !!view && view.status === 'complete' && !!view.result &&
      this.matches(view, panel, state, workspace, pageVisible);
  }

  async start(panel: PanelConfig, state: LabState, workspace: WorkspaceState,
    pageVisible: () => boolean, onProgress: (view: SweepView) => void,
    onFinish: (view: SweepView) => void): Promise<SweepView | null> {
    this.cancel(panel.id);
    const view: SweepView = { document: state.document, revision: state.revision,
      settings: sweepSignature(panel), status: 'running', points: [], result: undefined, active: true };
    this.views.set(panel.id, view);
    const current = (): boolean => {
      const live = this.views.get(panel.id) === view &&
        this.matches(view, workspace.panels.find(candidate => candidate.id === panel.id),
          state, workspace, pageVisible());
      if (!live) this.retire(view);
      return live;
    };
    if (!current()) return null;

    try {
      const result = await runDcSweep(view.document,
        { sourceId: panel.input, observationId: panel.output,
          minimum: panel.sweepMin, maximum: panel.sweepMax, count: panel.sweepCount },
        current, point => {
          view.points.push(point);
          if (current()) onProgress(view);
        });
      if (!current()) return view;
      view.result = result.status === 'complete' ? result : undefined;
      view.points = result.points;
      view.status = result.status;
    } catch {
      this.retire(view);
    }
    if (this.views.get(panel.id) === view) onFinish(view);
    return view;
  }
}
