'use client';
import { HierarchyPanel } from '@/engine/editor/panels/hierarchy-panel';
import { InspectorPanel } from '@/engine/editor/panels/inspector-panel';
import { GuiInspectorPanel } from '@/engine/editor/panels/gui/gui-inspector-panel';
import { GuiLayersPanel } from '@/engine/editor/panels/gui/gui-layers-panel';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
export function WorkspaceHierarchyPanel() {
    const session = useSessionTopic('workspace');
    return session.workspace === 'gui' ? <GuiLayersPanel /> : <HierarchyPanel />;
}
export function WorkspaceInspectorPanel() {
    const session = useSessionTopic('workspace');
    return session.workspace === 'gui' ? <GuiInspectorPanel /> : <InspectorPanel />;
}
