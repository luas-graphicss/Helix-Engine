'use client';
import { GuiCanvas } from './gui-canvas';
import { GuiEmptyState } from './gui-empty-state';
import { GuiStatusStrip } from './gui-status-strip';
import { GuiToolbar } from './gui-toolbar';
import { useGuiDesigner } from './use-gui-designer';
export function GuiWorkspace() {
    const designer = useGuiDesigner();
    if (!designer.isOpen)
        return <GuiEmptyState />;
    return (<div className="@container/workspace absolute inset-0 flex flex-col overflow-hidden bg-surface-sunken">
      <GuiToolbar />
      <GuiCanvas />
      <GuiStatusStrip />
    </div>);
}
