import type { ScriptDocument } from '@/engine/scripting/script-document';
import { countScriptLines } from '@/engine/scripting/script-document';
import type { ScriptLanguageId } from '@/engine/scripting/script-languages';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { codeViewOptionsFromSettings } from './code-preferences';
import type { CodeViewHandle } from './editor/code-view-handle';
export type CodePresentation = 'workspace' | 'window' | 'tab';
export const CODE_PRESENTATIONS: readonly CodePresentation[] = ['workspace', 'window', 'tab'];
export const CODE_PRESENTATION_LABEL: Record<CodePresentation, string> = {
    workspace: 'Área de trabalho',
    window: 'Janela flutuante',
    tab: 'Aba do navegador',
};
export const CODE_PRESENTATION_HINT: Record<CodePresentation, string> = {
    workspace: 'O editor ocupa o centro, no lugar do viewport (como a Interface)',
    window: 'Uma janela sobre a cena, para programar olhando o viewport',
    tab: 'Uma aba separada do navegador, para um segundo monitor',
};
export interface CodeWindowRect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
export const CODE_WINDOW_MIN_WIDTH = 420;
export const CODE_WINDOW_MIN_HEIGHT = 260;
export type DebugPanelId = 'output' | 'breakpoints' | 'callStack' | 'watch' | 'analysis' | 'activity';
export const DEBUG_PANELS: readonly DebugPanelId[] = ['output', 'breakpoints', 'callStack', 'watch', 'analysis', 'activity'];
export const DEBUG_PANEL_LABEL: Record<DebugPanelId, string> = {
    output: 'Saída',
    breakpoints: 'Pontos de interrupção',
    callStack: 'Pilha de chamadas',
    watch: 'Observar',
    analysis: 'Análise',
    activity: 'Atividade de código',
};
export const DEBUG_DOCK_MIN_HEIGHT = 120;
export const DEBUG_DOCK_MAX_HEIGHT = 720;
export interface DebugDockState {
    readonly open: boolean;
    readonly panel: DebugPanelId;
    readonly height: number;
}
export interface CodeViewOptions {
    readonly lineNumbers: boolean;
    readonly wordWrap: boolean;
    readonly minimap: boolean;
    readonly whitespace: boolean;
    readonly highlightLine: boolean;
    readonly indentGuides: boolean;
    readonly folding: boolean;
    readonly cursorBlink: boolean;
    readonly autoSuggest: boolean;
    readonly autoCloseBrackets: boolean;
    readonly selectionMatches: boolean;
    readonly previewTabs: boolean;
    readonly statusStrip: boolean;
    readonly fontSize: number;
    readonly lineHeight: number;
}
export interface CodeCursor {
    readonly line: number;
    readonly column: number;
    readonly selectionLength: number;
    readonly selectionLines: number;
}
export interface CodeTab {
    readonly assetId: string;
    readonly document: ScriptDocument;
    readonly savedSource: string;
    readonly savedMeta: string;
    readonly cursor: CodeCursor;
    readonly scrollTop: number;
    readonly preview: boolean;
}
export type CodeDiagnosticSeverity = 'error' | 'warning' | 'info';
export interface CodeDiagnostic {
    readonly id: string;
    readonly assetId: string;
    readonly severity: CodeDiagnosticSeverity;
    readonly line: number;
    readonly column: number;
    readonly endLine?: number;
    readonly endColumn?: number;
    readonly message: string;
    readonly code?: string;
    readonly source: string;
}
export type CodeCompileState = 'unavailable' | 'idle' | 'compiling' | 'ok' | 'failed';
export type CodeVerifierStatus = 'idle' | 'loading' | 'checking' | 'ok' | 'unavailable';
export interface CodeVerifierState {
    readonly status: CodeVerifierStatus;
    readonly detail: string;
    readonly errors: number;
    readonly warnings: number;
}
export const IDLE_VERIFIER: CodeVerifierState = { status: 'idle', detail: '', errors: 0, warnings: 0 };
export interface CodeCommandEntry {
    readonly id: number;
    readonly language: ScriptLanguageId | null;
    readonly text: string;
    readonly at: number;
}
export interface CodeFindState {
    readonly open: boolean;
    readonly replace: boolean;
    readonly query: string;
    readonly replacement: string;
    readonly matchCase: boolean;
    readonly wholeWord: boolean;
    readonly regex: boolean;
    readonly current: number;
    readonly total: number;
}
export interface SurfaceState {
    dispose(): void;
}
const MAX_COMMAND_HISTORY = 100;
type Listener = () => void;
function metaKey(document: ScriptDocument): string {
    return `${document.runContext}|${document.entry ? 1 : 0}|${document.language}`;
}
export const INITIAL_CURSOR: CodeCursor = { line: 1, column: 1, selectionLength: 0, selectionLines: 0 };
export class CodeEditor {
    tabs: readonly CodeTab[] = [];
    activeId: string | null = null;
    presentation: CodePresentation = 'workspace';
    windowOpen = false;
    windowMaximized = false;
    windowRect: CodeWindowRect = { x: 96, y: 72, width: 860, height: 520 };
    options: CodeViewOptions = codeViewOptionsFromSettings();
    find: CodeFindState = { open: false, replace: false, query: '', replacement: '', matchCase: false, wholeWord: false, regex: false, current: -1, total: 0 };
    gotoLineOpen = false;
    debugDock: DebugDockState = { open: true, panel: 'output', height: 220 };
    commandBarVisible = true;
    commandHistory: readonly CodeCommandEntry[] = [];
    commandDraft = '';
    diagnostics: readonly CodeDiagnostic[] = [];
    liveDiagnostics: ReadonlyMap<string, readonly CodeDiagnostic[]> = new Map();
    verifiers: ReadonlyMap<string, CodeVerifierState> = new Map();
    view: CodeViewHandle | null = null;
    compileState: CodeCompileState = 'idle';
    compileMessage = 'Nada compilado ainda: Compilar confere o projeto; Executar roda o script ativo; Play roda o jogo.';
    openCount = 0;
    standalone = false;
    pendingReveal: {
        assetId: string;
        line: number;
    } | null = null;
    private version = 0;
    private readonly listeners = new Set<Listener>();
    private nextCommandId = 1;
    private readonly surfaceStates = new Map<string, SurfaceState>();
    constructor(private readonly session: EditorSession) { }
    readonly subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    readonly getVersion = (): number => this.version;
    notify(): void {
        this.version++;
        for (const listener of this.listeners)
            listener();
    }
    get activeTab(): CodeTab | null {
        return this.activeId ? (this.tabs.find((tab) => tab.assetId === this.activeId) ?? null) : null;
    }
    get isOpen(): boolean {
        return this.tabs.length > 0;
    }
    tab(assetId: string): CodeTab | null {
        return this.tabs.find((tab) => tab.assetId === assetId) ?? null;
    }
    isDirty(tab: CodeTab): boolean {
        return tab.document.source !== tab.savedSource || metaKey(tab.document) !== tab.savedMeta;
    }
    get dirtyTabs(): CodeTab[] {
        return this.tabs.filter((tab) => this.isDirty(tab));
    }
    get anyDirty(): boolean {
        return this.tabs.some((tab) => this.isDirty(tab));
    }
    open(document: ScriptDocument, assetId: string, options: {
        pin?: boolean;
        line?: number;
    } = {}): void {
        const existing = this.tab(assetId);
        if (existing) {
            if (options.pin && existing.preview)
                this.replaceTab(assetId, { ...existing, preview: false });
            this.activeId = assetId;
        }
        else {
            const preview = !options.pin && this.options.previewTabs;
            const tab: CodeTab = {
                assetId,
                document,
                savedSource: document.source,
                savedMeta: metaKey(document),
                cursor: INITIAL_CURSOR,
                scrollTop: 0,
                preview,
            };
            const previewIndex = preview ? this.tabs.findIndex((candidate) => candidate.preview && !this.isDirty(candidate)) : -1;
            const tabs = [...this.tabs];
            if (previewIndex !== -1)
                tabs.splice(previewIndex, 1, tab);
            else
                tabs.push(tab);
            this.tabs = tabs;
            this.activeId = assetId;
        }
        if (options.line !== undefined)
            this.pendingReveal = { assetId, line: options.line };
        this.openCount++;
        this.notify();
    }
    pin(assetId: string): void {
        const tab = this.tab(assetId);
        if (!tab || !tab.preview)
            return;
        this.replaceTab(assetId, { ...tab, preview: false });
        this.notify();
    }
    close(assetId: string): void {
        const index = this.tabs.findIndex((tab) => tab.assetId === assetId);
        if (index === -1)
            return;
        const tabs = this.tabs.filter((tab) => tab.assetId !== assetId);
        this.tabs = tabs;
        if (this.activeId === assetId)
            this.activeId = tabs[Math.min(index, tabs.length - 1)]?.assetId ?? null;
        this.forgetLive([assetId]);
        this.notify();
    }
    closeOthers(assetId: string): void {
        this.forgetLive(this.tabs.filter((tab) => tab.assetId !== assetId).map((tab) => tab.assetId));
        this.tabs = this.tabs.filter((tab) => tab.assetId === assetId);
        this.activeId = this.tab(assetId) ? assetId : null;
        this.notify();
    }
    closeAll(): void {
        if (this.tabs.length === 0)
            return;
        this.forgetLive(this.tabs.map((tab) => tab.assetId));
        this.tabs = [];
        this.activeId = null;
        this.notify();
    }
    private forgetLive(assetIds: readonly string[]): void {
        if (assetIds.length === 0)
            return;
        const live = new Map(this.liveDiagnostics);
        const verifiers = new Map(this.verifiers);
        for (const assetId of assetIds) {
            live.delete(assetId);
            verifiers.delete(assetId);
            this.surfaceStates.get(assetId)?.dispose();
            this.surfaceStates.delete(assetId);
        }
        this.liveDiagnostics = live;
        this.verifiers = verifiers;
    }
    surfaceState(assetId: string): SurfaceState | null {
        return this.surfaceStates.get(assetId) ?? null;
    }
    setSurfaceState(assetId: string, state: SurfaceState): void {
        if (!this.tab(assetId)) {
            state.dispose();
            return;
        }
        this.surfaceStates.set(assetId, state);
    }
    setActive(assetId: string): void {
        if (this.activeId === assetId || !this.tab(assetId))
            return;
        this.activeId = assetId;
        this.notify();
    }
    cycle(direction: 1 | -1): void {
        if (this.tabs.length < 2 || !this.activeId)
            return;
        const index = this.tabs.findIndex((tab) => tab.assetId === this.activeId);
        const next = (index + direction + this.tabs.length) % this.tabs.length;
        this.setActive(this.tabs[next].assetId);
    }
    move(assetId: string, index: number): void {
        const from = this.tabs.findIndex((tab) => tab.assetId === assetId);
        if (from === -1)
            return;
        const tabs = [...this.tabs];
        const [tab] = tabs.splice(from, 1);
        tabs.splice(Math.max(0, Math.min(index, tabs.length)), 0, tab);
        this.tabs = tabs;
        this.notify();
    }
    updateSource(assetId: string, source: string, cursor?: CodeCursor): void {
        const tab = this.tab(assetId);
        if (!tab || tab.document.source === source)
            return;
        this.replaceTab(assetId, { ...tab, document: { ...tab.document, source }, cursor: cursor ?? tab.cursor, preview: false });
        this.notify();
    }
    updateDocument(assetId: string, patch: Partial<Pick<ScriptDocument, 'runContext' | 'entry' | 'language'>>): void {
        const tab = this.tab(assetId);
        if (!tab)
            return;
        const document = { ...tab.document, ...patch };
        if (metaKey(document) === metaKey(tab.document))
            return;
        this.replaceTab(assetId, { ...tab, document, preview: false });
        this.notify();
    }
    updateCursor(assetId: string, cursor: CodeCursor, scrollTop?: number): void {
        const tab = this.tab(assetId);
        if (!tab)
            return;
        const same = tab.cursor.line === cursor.line && tab.cursor.column === cursor.column && tab.cursor.selectionLength === cursor.selectionLength && (scrollTop === undefined || tab.scrollTop === scrollTop);
        if (same)
            return;
        this.replaceTab(assetId, { ...tab, cursor, scrollTop: scrollTop ?? tab.scrollTop });
        this.notify();
    }
    markSaved(assetId: string, document: ScriptDocument = this.tab(assetId)?.document ?? createEmpty()): void {
        const tab = this.tab(assetId);
        if (!tab)
            return;
        this.replaceTab(assetId, { ...tab, document, savedSource: document.source, savedMeta: metaKey(document), preview: false });
        this.notify();
    }
    syncName(assetId: string, name: string): void {
        const tab = this.tab(assetId);
        if (!tab || tab.document.name === name)
            return;
        this.replaceTab(assetId, { ...tab, document: { ...tab.document, name } });
        this.notify();
    }
    syncSaved(assetId: string, document: ScriptDocument): void {
        const tab = this.tab(assetId);
        if (!tab || this.isDirty(tab))
            return;
        this.replaceTab(assetId, { ...tab, document, savedSource: document.source, savedMeta: metaKey(document) });
        this.notify();
    }
    revert(assetId: string): void {
        const tab = this.tab(assetId);
        if (!tab || !this.isDirty(tab))
            return;
        this.replaceTab(assetId, { ...tab, document: { ...tab.document, source: tab.savedSource } });
        this.notify();
    }
    consumeReveal(assetId: string): number | null {
        if (!this.pendingReveal || this.pendingReveal.assetId !== assetId)
            return null;
        const { line } = this.pendingReveal;
        this.pendingReveal = null;
        return line;
    }
    setPresentation(presentation: CodePresentation): void {
        if (this.presentation === presentation)
            return;
        this.presentation = presentation;
        if (presentation === 'window')
            this.windowOpen = true;
        this.notify();
    }
    openWindow(): void {
        if (this.windowOpen && this.presentation === 'window')
            return;
        this.presentation = 'window';
        this.windowOpen = true;
        this.notify();
    }
    closeWindow(): void {
        if (!this.windowOpen)
            return;
        this.windowOpen = false;
        this.notify();
    }
    toggleWindowMaximized(): void {
        this.windowMaximized = !this.windowMaximized;
        this.notify();
    }
    setWindowRect(rect: CodeWindowRect): void {
        this.windowRect = {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.max(CODE_WINDOW_MIN_WIDTH, Math.round(rect.width)),
            height: Math.max(CODE_WINDOW_MIN_HEIGHT, Math.round(rect.height)),
        };
        this.notify();
    }
    setOptions(options: CodeViewOptions): void {
        const current = this.options;
        if ((Object.keys(options) as (keyof CodeViewOptions)[]).every((key) => current[key] === options[key]))
            return;
        this.options = options;
        this.notify();
    }
    openFind(options: {
        replace?: boolean;
        query?: string;
    } = {}): void {
        this.gotoLineOpen = false;
        this.find = { ...this.find, open: true, replace: options.replace ?? this.find.replace, query: options.query ?? this.find.query };
        this.notify();
    }
    closeFind(): void {
        if (!this.find.open)
            return;
        this.find = { ...this.find, open: false, current: -1 };
        this.notify();
    }
    updateFind(patch: Partial<Omit<CodeFindState, 'open'>>): void {
        this.find = { ...this.find, ...patch };
        this.notify();
    }
    reportFindMatches(total: number, current: number): void {
        if (this.find.total === total && this.find.current === current)
            return;
        this.find = { ...this.find, total, current };
        this.notify();
    }
    openGotoLine(): void {
        if (this.gotoLineOpen)
            return;
        this.gotoLineOpen = true;
        this.notify();
    }
    closeGotoLine(): void {
        if (!this.gotoLineOpen)
            return;
        this.gotoLineOpen = false;
        this.notify();
    }
    showDebugPanel(panel: DebugPanelId): void {
        if (this.debugDock.open && this.debugDock.panel === panel)
            return;
        this.debugDock = { ...this.debugDock, open: true, panel };
        this.notify();
    }
    selectDebugPanel(panel: DebugPanelId): void {
        if (this.debugDock.open && this.debugDock.panel === panel)
            this.setDebugDockOpen(false);
        else
            this.showDebugPanel(panel);
    }
    setDebugDockOpen(open: boolean): void {
        if (this.debugDock.open === open)
            return;
        this.debugDock = { ...this.debugDock, open };
        this.notify();
    }
    toggleDebugDock(): void {
        this.setDebugDockOpen(!this.debugDock.open);
    }
    setDebugDockHeight(height: number): void {
        const clamped = Math.round(Math.max(DEBUG_DOCK_MIN_HEIGHT, Math.min(DEBUG_DOCK_MAX_HEIGHT, height)));
        if (clamped === this.debugDock.height)
            return;
        this.debugDock = { ...this.debugDock, height: clamped };
        this.notify();
    }
    attachView(view: CodeViewHandle): void {
        this.view = view;
        this.notify();
    }
    detachView(view: CodeViewHandle): void {
        if (this.view !== view)
            return;
        this.view = null;
        this.notify();
    }
    setCommandBarVisible(visible: boolean): void {
        if (this.commandBarVisible === visible)
            return;
        this.commandBarVisible = visible;
        this.notify();
    }
    toggleCommandBar(): void {
        this.setCommandBarVisible(!this.commandBarVisible);
    }
    setCommandDraft(text: string): void {
        if (this.commandDraft === text)
            return;
        this.commandDraft = text;
        this.notify();
    }
    recordCommand(text: string, language: ScriptLanguageId | null): CodeCommandEntry {
        const entry: CodeCommandEntry = { id: this.nextCommandId++, language, text, at: Date.now() };
        const last = this.commandHistory.at(-1);
        const history = last && last.text === text ? [...this.commandHistory.slice(0, -1), entry] : [...this.commandHistory, entry];
        this.commandHistory = history.slice(-MAX_COMMAND_HISTORY);
        this.commandDraft = '';
        this.notify();
        return entry;
    }
    clearCommandHistory(): void {
        if (this.commandHistory.length === 0)
            return;
        this.commandHistory = [];
        this.notify();
    }
    setDiagnostics(diagnostics: readonly CodeDiagnostic[]): void {
        this.diagnostics = diagnostics;
        this.notify();
    }
    setLiveDiagnostics(assetId: string, diagnostics: readonly CodeDiagnostic[], verifier: CodeVerifierState): void {
        const live = new Map(this.liveDiagnostics);
        live.set(assetId, diagnostics);
        this.liveDiagnostics = live;
        this.setVerifier(assetId, verifier);
    }
    setVerifier(assetId: string, verifier: CodeVerifierState): void {
        const verifiers = new Map(this.verifiers);
        verifiers.set(assetId, verifier);
        this.verifiers = verifiers;
        this.notify();
    }
    verifierFor(assetId: string): CodeVerifierState {
        return this.verifiers.get(assetId) ?? IDLE_VERIFIER;
    }
    diagnosticsFor(assetId: string): readonly CodeDiagnostic[] {
        const live = this.liveDiagnostics.get(assetId);
        if (live)
            return live;
        return this.diagnostics.filter((diagnostic) => diagnostic.assetId === assetId);
    }
    count(severity: CodeDiagnosticSeverity): number {
        let total = 0;
        const seen = new Set<string>();
        for (const [assetId, diagnostics] of this.liveDiagnostics) {
            seen.add(assetId);
            for (const diagnostic of diagnostics)
                if (diagnostic.severity === severity)
                    total++;
        }
        for (const diagnostic of this.diagnostics)
            if (!seen.has(diagnostic.assetId) && diagnostic.severity === severity)
                total++;
        return total;
    }
    setCompileState(state: CodeCompileState, message: string): void {
        this.compileState = state;
        this.compileMessage = message;
        this.notify();
    }
    get openLines(): number {
        return this.tabs.reduce((total, tab) => total + countScriptLines(tab.document.source), 0);
    }
    get owner(): EditorSession {
        return this.session;
    }
    private replaceTab(assetId: string, next: CodeTab): void {
        this.tabs = this.tabs.map((tab) => (tab.assetId === assetId ? next : tab));
    }
}
function createEmpty(): ScriptDocument {
    return { version: 1, name: 'Script', language: 'luau', source: '', runContext: 'shared', entry: false, createdAt: Date.now() };
}
