'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { ScriptDebugger } from '@/engine/scripting/debug/script-debugger';
import { useDebuggerSelector } from '../debug/use-script-debugger';
import { sameBreakpointView, type BreakpointView } from '../editor/breakpoint-bridge';
import { CodeSurfaceController } from '../editor/surface-controller';
import { CodeGotoLine } from './code-goto-line';
import { CodeMinimap } from './code-minimap';
import { useCodeEditor } from './use-code-editor';
function breakpointViewOf(scriptDebugger: ScriptDebugger, assetId: string): BreakpointView {
    const marks = scriptDebugger.breakpointsOf(assetId).map((breakpoint) => {
        const status = scriptDebugger.statusOf(breakpoint);
        return { line: breakpoint.line, enabled: breakpoint.enabled && scriptDebugger.breakpointsEnabled, verified: status.verified, logpoint: breakpoint.logMessage !== null, conditional: breakpoint.condition !== null };
    });
    const { paused } = scriptDebugger;
    return { marks, pausedLine: paused && paused.assetId === assetId && paused.line > 0 ? paused.line : null };
}
type CodeSurfaceProps = {
    assetId: string;
    autoFocus?: boolean;
};
export function CodeSurface({ assetId, autoFocus = true }: CodeSurfaceProps) {
    const session = useEditorSession();
    const code = useCodeEditor();
    const hostRef = useRef<HTMLDivElement>(null);
    const [controller, setController] = useState<CodeSurfaceController | null>(null);
    const tab = code.tab(assetId);
    useLayoutEffect(() => {
        const parent = hostRef.current;
        const current = code.tab(assetId);
        if (!parent || !current)
            return;
        const created = new CodeSurfaceController(session, current, { parent, autoFocus });
        setController(created);
        return () => {
            created.dispose();
            setController(null);
        };
    }, [session, code, assetId]);
    const source = tab?.document.source ?? null;
    const language = tab?.document.language ?? null;
    useEffect(() => {
        if (source !== null)
            controller?.syncSource(source);
    }, [controller, source]);
    useEffect(() => {
        if (language !== null)
            controller?.syncLanguage(language);
    }, [controller, language]);
    useEffect(() => controller?.syncOptions(code.options), [controller, code.options]);
    useEffect(() => controller?.syncFind(code.find), [controller, code.find]);
    const diagnostics = useMemo(() => code.diagnosticsFor(assetId), [code, code.liveDiagnostics, code.diagnostics, assetId]);
    useEffect(() => controller?.syncDiagnostics(diagnostics), [controller, diagnostics]);
    const breakpoints = useDebuggerSelector((scriptDebugger) => breakpointViewOf(scriptDebugger, assetId), sameBreakpointView);
    useEffect(() => controller?.syncBreakpoints(breakpoints), [controller, breakpoints]);
    if (!tab)
        return null;
    return (<div className="absolute inset-0 flex min-w-0 bg-surface-sunken">
      <div ref={hostRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden font-mono [&_.cm-editor]:h-full" style={{ fontVariantLigatures: 'none' }}/>
      {code.options.minimap && controller && <CodeMinimap controller={controller} language={tab.document.language}/>}
      {code.gotoLineOpen && controller && <CodeGotoLine handle={controller.handle} line={tab.cursor.line}/>}
    </div>);
}
