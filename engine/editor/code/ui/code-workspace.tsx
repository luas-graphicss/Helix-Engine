'use client';
import { shallowEqual } from '@/engine/editor/session/editor-session-context';
import { isShaderLanguage } from '@/engine/scripting/script-languages';
import { DebugDock } from '../debug/debug-dock';
import { CodeEmptyState } from './code-empty-state';
import { CodeFindBar } from './code-find-bar';
import { CodeStatusStrip } from './code-status-strip';
import { CodeSurface } from './code-surface';
import { CodeTabStrip } from './code-tab-strip';
import { CodeToolbar } from './code-toolbar';
import { ShaderInfoBar } from './shader-info-bar';
import { useCodeSelector } from './use-code-editor';
export function CodeEditorBody({ autoFocus = true }: {
    autoFocus?: boolean;
}) {
    const { activeId, shader, findOpen, statusStrip } = useCodeSelector((code) => {
        const active = code.activeTab;
        return { activeId: active?.assetId ?? null, shader: active ? isShaderLanguage(active.document.language) : false, findOpen: code.find.open, statusStrip: code.options.statusStrip };
    }, shallowEqual);
    return (<>
      <CodeTabStrip />
      {activeId && shader && <ShaderInfoBar assetId={activeId}/>}
      {activeId && findOpen && <CodeFindBar assetId={activeId}/>}
      <div className="relative min-h-0 min-w-0 flex-1">{activeId && <CodeSurface key={activeId} assetId={activeId} autoFocus={autoFocus}/>}</div>
      <DebugDock />
      {statusStrip && <CodeStatusStrip />}
    </>);
}
export function CodeWorkspace() {
    const isOpen = useCodeSelector((code) => code.isOpen);
    if (!isOpen)
        return <CodeEmptyState />;
    return (<div className="@container/workspace absolute inset-0 flex flex-col overflow-hidden bg-surface-sunken">
      <CodeToolbar />
      <CodeEditorBody />
    </div>);
}
