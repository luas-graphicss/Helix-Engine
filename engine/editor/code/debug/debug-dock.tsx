'use client';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { type ComponentType, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, useEffect, useRef } from 'react';
import { useEditorSession, useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { IconButton } from '@/engine/ui/icon-button';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { DEBUG_PANEL_LABEL, DEBUG_PANELS, type DebugPanelId } from '../code-editor';
import { useCodeActions, useCodeSelector } from '../ui/use-code-editor';
import { DebugControls } from './debug-controls';
import { openScriptLocation, SCRIPT_LOG_SOURCES } from './debug-shared';
import { ActivityPanel } from './panels/activity-panel';
import { AnalysisPanel } from './panels/analysis-panel';
import { BreakpointsPanel } from './panels/breakpoints-panel';
import { CallStackPanel } from './panels/call-stack-panel';
import { OutputPanel } from './panels/output-panel';
import { WatchPanel } from './panels/watch-panel';
import { useDebuggerSelector } from './use-script-debugger';
const PANEL: Record<DebugPanelId, ComponentType> = {
    output: OutputPanel,
    breakpoints: BreakpointsPanel,
    callStack: CallStackPanel,
    watch: WatchPanel,
    analysis: AnalysisPanel,
    activity: ActivityPanel,
};
interface Badge {
    readonly text: string;
    readonly tone: 'neutral' | 'warning' | 'destructive' | 'success';
}
function TabBadge({ badge }: {
    badge: Badge;
}) {
    return (<span className={cn('rounded-xs px-1 py-px font-mono text-3xs leading-none tabular-nums', badge.tone === 'destructive' && 'bg-destructive/20 text-destructive', badge.tone === 'warning' && 'bg-warning/20 text-warning', badge.tone === 'success' && 'bg-axis-y/20 text-axis-y', badge.tone === 'neutral' && 'bg-surface-raised text-muted-foreground')}>
      {badge.text}
    </span>);
}
function useTabBadges(): Partial<Record<DebugPanelId, Badge>> {
    const session = useSessionTopic('log', 'assets');
    const errors = useCodeSelector((code) => code.count('error'));
    const warnings = useCodeSelector((code) => code.count('warning'));
    const breakpoints = useDebuggerSelector((d) => d.breakpoints.length);
    const enabled = useDebuggerSelector((d) => d.breakpointsEnabled);
    const paused = useDebuggerSelector((d) => d.paused !== null);
    const watches = useDebuggerSelector((d) => d.watches.length);
    const active = useDebuggerSelector((d) => d.activity.filter((item) => item.state === 'active').length);
    const faulted = useDebuggerSelector((d) => d.activity.filter((item) => item.state === 'faulted').length);
    const scriptNames = new Set<string>();
    for (const asset of session.library.all)
        if (asset.kind === 'script')
            scriptNames.add(asset.name);
    let outputErrors = 0;
    for (const entry of session.log.entries) {
        if (entry.level === 'error' && (SCRIPT_LOG_SOURCES.has(entry.source) || scriptNames.has(entry.source)))
            outputErrors++;
    }
    const badges: Partial<Record<DebugPanelId, Badge>> = {};
    if (outputErrors > 0)
        badges.output = { text: String(outputErrors), tone: 'destructive' };
    if (breakpoints > 0)
        badges.breakpoints = { text: String(breakpoints), tone: enabled ? 'neutral' : 'warning' };
    if (paused)
        badges.callStack = { text: 'pausado', tone: 'warning' };
    if (watches > 0)
        badges.watch = { text: String(watches), tone: 'neutral' };
    if (errors > 0)
        badges.analysis = { text: String(errors), tone: 'destructive' };
    else if (warnings > 0)
        badges.analysis = { text: String(warnings), tone: 'warning' };
    if (faulted > 0)
        badges.activity = { text: String(faulted), tone: 'destructive' };
    else if (active > 0)
        badges.activity = { text: String(active), tone: 'success' };
    return badges;
}
function useRevealOnPause(): void {
    const session = useEditorSession();
    const code = useCodeActions();
    const paused = useDebuggerSelector((d) => d.paused);
    const lastRevealed = useRef<number | null>(null);
    useEffect(() => {
        if (!paused || lastRevealed.current === paused.at)
            return;
        lastRevealed.current = paused.at;
        if (paused.assetId && paused.line > 0)
            openScriptLocation(session, paused.assetId, paused.line, paused.file);
        code.showDebugPanel('callStack');
    }, [paused, session, code]);
}
export function DebugDock() {
    const dock = useCodeSelector((code) => code.debugDock);
    const code = useCodeActions();
    const badges = useTabBadges();
    useRevealOnPause();
    const drag = useRef<{
        startY: number;
        startHeight: number;
    } | null>(null);
    const onHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0)
            return;
        drag.current = { startY: event.clientY, startHeight: dock.height };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
    };
    const onHandlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!drag.current)
            return;
        code.setDebugDockHeight(drag.current.startHeight + (drag.current.startY - event.clientY));
    };
    const onHandlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!drag.current)
            return;
        drag.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
    };
    const onHandleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        const step = event.shiftKey ? 40 : 10;
        if (event.key === 'ArrowUp')
            code.setDebugDockHeight(dock.height + step);
        else if (event.key === 'ArrowDown')
            code.setDebugDockHeight(dock.height - step);
        else
            return;
        event.preventDefault();
    };
    const Panel = PANEL[dock.panel];
    return (<section aria-label="Depuração" className="flex shrink-0 flex-col border-t border-border bg-surface">
      {dock.open && (<div role="separator" aria-orientation="horizontal" aria-label="Redimensionar o painel de depuração" aria-valuenow={dock.height} tabIndex={0} onPointerDown={onHandlePointerDown} onPointerMove={onHandlePointerMove} onPointerUp={onHandlePointerUp} onPointerCancel={onHandlePointerUp} onKeyDown={onHandleKeyDown} className={cn('h-1 shrink-0 cursor-row-resize touch-none bg-transparent transition-colors hover:bg-primary/40 active:bg-primary/60', FOCUS_RING_CLASS)}/>)}
      <header className="flex h-panelbar shrink-0 items-center gap-1 border-b border-border bg-linear-to-b from-bevel to-transparent px-1">
        <nav role="tablist" aria-label="Painéis de depuração" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {DEBUG_PANELS.map((id) => {
            const selected = dock.open && dock.panel === id;
            const badge = badges[id];
            return (<button key={id} type="button" role="tab" aria-selected={selected} aria-controls={`debug-panel-${id}`} onClick={() => code.selectDebugPanel(id)} className={cn('flex h-6 shrink-0 items-center gap-1.5 rounded-sm px-2 text-2xs whitespace-nowrap transition-colors', FOCUS_RING_CLASS, selected ? 'bg-surface-raised text-foreground shadow-bevel' : 'text-muted-foreground hover:bg-highlight hover:text-foreground')}>
                {DEBUG_PANEL_LABEL[id]}
                {badge && <TabBadge badge={badge}/>}
              </button>);
        })}
        </nav>
        <DebugControls className="shrink-0"/>
        <IconButton label={dock.open ? 'Recolher o painel de depuração' : 'Expandir o painel de depuração'} size="sm" aria-expanded={dock.open} onClick={() => code.toggleDebugDock()}>
          {dock.open ? <ChevronDown /> : <ChevronUp />}
        </IconButton>
      </header>
      {dock.open && (<div id={`debug-panel-${dock.panel}`} role="tabpanel" aria-label={DEBUG_PANEL_LABEL[dock.panel]} style={{ height: dock.height }} className="min-h-0 overflow-hidden">
          <Panel />
        </div>)}
    </section>);
}
