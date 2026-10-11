import type { PanelConfig } from './workspace.js';

export interface TransformMethodState { method: 'dc' | 'resistor' }

/** The Analyze port action always opens its matching DC comparison. */
export function openPortComparison(method: TransformMethodState, panel: Pick<PanelConfig,'p'|'q'|'load'>,
  useSelection: (p: string, q: string, load: number) => void, openTransform: () => void): void {
  method.method='dc';
  useSelection(panel.p,panel.q,panel.load);
  openTransform();
}
