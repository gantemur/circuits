import type { LabState } from './lab.js';
import type { GuideAction } from './study-guide.js';
import { addPanel, createPanel, type WorkspaceState } from './workspace.js';

export type GuideNavigation = { kind:'transform' } | { kind:'focus'; panelId:string } |
  { kind:'replacement-required' } | { kind:'invalid-replacement' };

/** Navigate a lesson without changing the native circuit or other panel settings.
 * At the three-panel limit the caller must provide the exact panel ID chosen
 * by the student; there is no implicit replacement or panel-ID churn. */
export function guideNavigation(workspace: WorkspaceState, state: LabState, action: GuideAction,
  replaceId?: string): GuideNavigation {
  if (action==='transform') return {kind:'transform'};
  if (!replaceId) {
    const existing=workspace.panels.find(panel=>panel.type===action);
    if (existing) {existing.collapsed=false;return {kind:'focus',panelId:existing.id};}
    const added=addPanel(workspace,state,action);
    if (added) {workspace.layoutIsSuggested=false;return {kind:'focus',panelId:added.id};}
    return {kind:'replacement-required'};
  }
  const index=workspace.panels.findIndex(panel=>panel.id===replaceId);
  if (index<0) return {kind:'invalid-replacement'};
  workspace.panels[index]=createPanel(state,replaceId,action);
  workspace.layoutIsSuggested=false;
  return {kind:'focus',panelId:replaceId};
}
