'use client';
import { useEffect, useRef } from 'react';
import { CloseIcon, PlusIcon } from '../icons/code-icons';
import { closeScriptTab } from '@/engine/editor/operations/script-operations';
import { shallowEqual, useEditorSession } from '@/engine/editor/session/editor-session-context';
import { useShortcutHint } from '@/engine/editor/shortcuts/shortcut-bindings';
import type { ScriptRunContext } from '@/engine/scripting/script-document';
import type { ScriptLanguageId } from '@/engine/scripting/script-languages';
import { SCRIPT_CONTEXT_SHORT } from '@/engine/scripting/script-sides';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import type { CodeEditor } from '../code-editor';
import { ContextDot } from './context-chip';
import { LanguageTag } from './language-tag';
import { NewScriptMenu } from './new-script-menu';
import { useCodeActions, useCodeSelector } from './use-code-editor';
interface TabSummary {
    assetId: string;
    name: string;
    language: ScriptLanguageId;
    runContext: ScriptRunContext;
    preview: boolean;
    dirty: boolean;
    active: boolean;
}
function summarizeTabs(code: CodeEditor): TabSummary[] {
    return code.tabs.map((tab) => ({
        assetId: tab.assetId,
        name: tab.document.name,
        language: tab.document.language,
        runContext: tab.document.runContext,
        preview: tab.preview,
        dirty: code.isDirty(tab),
        active: tab.assetId === code.activeId,
    }));
}
function sameSummaries(previous: TabSummary[], next: TabSummary[]): boolean {
    return previous.length === next.length && previous.every((tab, index) => shallowEqual(tab, next[index]));
}
function TabButton({ tab }: {
    tab: TabSummary;
}) {
    const session = useEditorSession();
    const code = useCodeActions();
    const hint = useShortcutHint();
    const { active, dirty } = tab;
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (active)
            ref.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, [active]);
    const close = () => void closeScriptTab(session, tab.assetId);
    return (<div ref={ref} role="tab" aria-selected={active} tabIndex={active ? 0 : -1} title={`${tab.name} · ${SCRIPT_CONTEXT_SHORT[tab.runContext].toLowerCase()}${dirty ? ' · alterações não salvas' : ''}${tab.preview ? ' · visualização (duplo clique fixa)' : ''}`} onClick={() => code.setActive(tab.assetId)} onDoubleClick={() => code.pin(tab.assetId)} onAuxClick={(event) => {
            if (event.button === 1) {
                event.preventDefault();
                close();
            }
        }} onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ')
                code.setActive(tab.assetId);
            if (event.key === 'Delete')
                close();
        }} className={cn('group relative flex h-full max-w-56 min-w-0 shrink-0 cursor-default items-center gap-1.5 border-r border-border pr-1 pl-2.5 text-2xs select-none', FOCUS_RING_CLASS, active ? 'bg-surface-sunken text-foreground shadow-[inset_0_2px_0_0_var(--primary)]' : 'text-muted-foreground hover:bg-highlight hover:text-foreground')}>
      <LanguageTag language={tab.language} silent/>
      <span className={cn('truncate', tab.preview && 'italic')}>{tab.name}</span>
      <ContextDot context={tab.runContext}/>
      {dirty && <span className="sr-only">alterações não salvas</span>}
      <button type="button" tabIndex={-1} aria-label={dirty ? `Fechar ${tab.name} (salva antes)` : `Fechar ${tab.name}`} title={hint(dirty ? 'Salvar e fechar' : 'Fechar', 'code.closeTab')} onClick={(event) => {
            event.stopPropagation();
            close();
        }} className="flex size-4 shrink-0 items-center justify-center rounded-xs text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground">
        {dirty ? (<>
            <span className="size-2 rounded-full bg-warning group-hover:hidden" aria-hidden/>
            <CloseIcon className="hidden size-3 group-hover:block" aria-hidden/>
          </>) : (<CloseIcon className={cn('size-3', !active && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')} aria-hidden/>)}
      </button>
    </div>);
}
export function CodeTabStrip() {
    const tabs = useCodeSelector(summarizeTabs, sameSummaries);
    return (<div role="tablist" aria-label="Scripts abertos" className="flex h-7 shrink-0 items-stretch border-b border-border bg-surface">
      <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => (<TabButton key={tab.assetId} tab={tab}/>))}
      </div>
      <div className="flex shrink-0 items-center px-0.5">
        <NewScriptMenu align="end" trigger={<button type="button" title="Novo script" aria-label="Novo script" className={cn('flex size-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground data-[popup-open]:bg-highlight [&_svg]:size-3.5', FOCUS_RING_CLASS)}/>} triggerContent={<PlusIcon aria-hidden/>}/>
      </div>
    </div>);
}
