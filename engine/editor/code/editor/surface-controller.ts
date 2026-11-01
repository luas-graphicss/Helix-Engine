import { autocompletion } from '@codemirror/autocomplete';
import { history } from '@codemirror/commands';
import { bracketMatching, indentOnInput, indentUnit as indentUnitFacet } from '@codemirror/language';
import { Compartment, EditorSelection, EditorState, Prec, type Extension } from '@codemirror/state';
import { crosshairCursor, dropCursor, EditorView, highlightSpecialChars, rectangularSelection, type ViewUpdate } from '@codemirror/view';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { indentUnit, scriptLanguage, type ScriptLanguageId } from '@/engine/scripting/script-languages';
import type { CodeCursor, CodeDiagnostic, CodeFindState, CodeTab, CodeViewOptions, SurfaceState } from '../code-editor';
import { createIntelligence } from '../intelligence/create-intelligence';
import type { LanguageIntelligence } from '../intelligence/language-intelligence';
import { languageSupport } from '../languages/language-support';
import { liveVerifierFor } from '../verification/live-verifier';
import { breakpointExtensions, publishBreakpoints, type BreakpointView } from './breakpoint-bridge';
import { codeKeymap } from './code-keymap';
import { codeThemeExtensions } from './code-theme';
import type { CodeViewHandle } from './code-view-handle';
import { diagnosticsExtensions, publishDiagnostics } from './diagnostics-bridge';
import { applyFindState, searchExtensions } from './search-bridge';
import { createViewHandle } from './view-handle';
import { ViewOptionCompartments } from './view-options';
interface SurfaceBinding {
    readonly language: Compartment;
    readonly indent: Compartment;
    readonly intelligence: Compartment;
    readonly options: ViewOptionCompartments;
    readonly link: {
        controller: CodeSurfaceController | null;
    };
    readonly loads: {
        intelligence: ScriptLanguageId | null;
    };
}
interface Snapshot extends SurfaceState {
    readonly state: EditorState;
    readonly binding: SurfaceBinding;
    readonly languageId: ScriptLanguageId;
    readonly intelligence: LanguageIntelligence | null;
}
function isSnapshot(value: SurfaceState | null): value is Snapshot {
    return value !== null && 'binding' in value;
}
export interface SurfaceMountOptions {
    readonly parent: HTMLElement;
    readonly autoFocus: boolean;
}
function cursorOf(state: EditorState): CodeCursor {
    const { from, to, head } = state.selection.main;
    const line = state.doc.lineAt(head);
    const selectionLines = from === to ? 0 : state.doc.lineAt(to).number - state.doc.lineAt(from).number + 1;
    return { line: line.number, column: head - line.from + 1, selectionLength: to - from, selectionLines };
}
function offsetOfCursor(state: EditorState, cursor: CodeCursor): number {
    const line = state.doc.line(Math.max(1, Math.min(cursor.line, state.doc.lines)));
    return Math.min(line.from + Math.max(0, cursor.column - 1), line.to);
}
function indentExtensions(languageId: ScriptLanguageId): Extension {
    const { indent } = scriptLanguage(languageId);
    return [indentUnitFacet.of(indentUnit(languageId)), EditorState.tabSize.of(indent.size)];
}
function commentTokensFallback(languageId: ScriptLanguageId): Extension {
    const { lineComment, blockComment } = scriptLanguage(languageId);
    const commentTokens = { line: lineComment ?? undefined, block: blockComment ? { open: blockComment[0], close: blockComment[1] } : undefined };
    return Prec.lowest(EditorState.languageData.of(() => [{ commentTokens }]));
}
function intelligenceExtensions(intelligence: LanguageIntelligence | null, options: CodeViewOptions): Extension {
    return [
        autocompletion({
            activateOnTyping: options.autoSuggest,
            activateOnTypingDelay: 90,
            override: intelligence?.completionSources ? [...intelligence.completionSources] : undefined,
            defaultKeymap: false,
            closeOnBlur: true,
            maxRenderedOptions: 80,
            selectOnOpen: true,
            icons: true,
            interactionDelay: 40,
        }),
        intelligence?.extensions ?? [],
    ];
}
export class CodeSurfaceController {
    readonly view: EditorView;
    readonly handle: CodeViewHandle;
    private readonly binding: SurfaceBinding;
    private readonly assetId: string;
    private languageId: ScriptLanguageId;
    private intelligence: LanguageIntelligence | null;
    private knownSource: string;
    private options: CodeViewOptions;
    private disposed = false;
    private readonly updateListeners = new Set<(update: ViewUpdate) => void>();
    constructor(private readonly session: EditorSession, tab: CodeTab, mount: SurfaceMountOptions) {
        const { code } = session;
        this.assetId = tab.assetId;
        this.languageId = tab.document.language;
        this.options = code.options;
        this.knownSource = tab.document.source;
        const previous = code.surfaceState(tab.assetId);
        const snapshot = isSnapshot(previous) && previous.state.doc.toString() === tab.document.source ? previous : null;
        if (previous && !snapshot)
            previous.dispose();
        this.binding = snapshot?.binding ?? {
            language: new Compartment(),
            indent: new Compartment(),
            intelligence: new Compartment(),
            options: new ViewOptionCompartments(code.options),
            link: { controller: null },
            loads: { intelligence: null },
        };
        this.binding.link.controller = this;
        this.intelligence = snapshot?.intelligence ?? null;
        const state = snapshot?.state ?? this.createState(tab);
        this.view = new EditorView({ state, parent: mount.parent });
        this.handle = createViewHandle({ view: this.view, code, assetId: tab.assetId, intelligence: () => this.intelligence });
        code.attachView(this.handle);
        if (snapshot) {
            this.binding.options.sync(this.view, code.options);
            if (snapshot.languageId !== tab.document.language)
                this.setLanguage(tab.document.language);
            else {
                this.view.dispatch({ effects: this.binding.intelligence.reconfigure(intelligenceExtensions(this.intelligence, code.options)) });
                this.loadIntelligence(tab.document.language);
            }
        }
        else {
            this.setLanguage(tab.document.language);
        }
        this.syncDiagnostics(code.diagnosticsFor(tab.assetId));
        if (code.find.open)
            this.syncFind(code.find);
        const reveal = code.consumeReveal(tab.assetId);
        requestAnimationFrame(() => {
            if (this.disposed)
                return;
            if (reveal !== null)
                this.handle.gotoLine(reveal);
            else
                this.view.scrollDOM.scrollTop = tab.scrollTop;
            if (mount.autoFocus)
                this.view.focus();
        });
        liveVerifierFor(session).check(tab.assetId);
    }
    private createState(tab: CodeTab): EditorState {
        const { session, binding } = this;
        const { code } = session;
        const link = binding.link;
        const extensions: Extension[] = [
            breakpointExtensions({ toggle: (line) => link.controller?.toggleBreakpoint(line) }),
            binding.options.initial(),
            binding.indent.of(indentExtensions(tab.document.language)),
            binding.language.of(languageSupport(tab.document.language)),
            binding.intelligence.of(intelligenceExtensions(null, code.options)),
            history(),
            dropCursor(),
            rectangularSelection(),
            crosshairCursor(),
            highlightSpecialChars(),
            bracketMatching(),
            indentOnInput(),
            EditorState.allowMultipleSelections.of(true),
            codeKeymap({ session, run: (command) => link.controller?.handle.run(command) ?? false }),
            searchExtensions((summary) => code.reportFindMatches(summary.total, summary.current)),
            diagnosticsExtensions(),
            codeThemeExtensions(),
            commentTokensFallback(tab.document.language),
            EditorView.updateListener.of((update) => link.controller?.handleUpdate(update)),
            EditorView.contentAttributes.of({ 'aria-label': `Código de ${tab.document.name}` }),
        ];
        const state = EditorState.create({ doc: tab.document.source, extensions });
        const offset = offsetOfCursor(state, tab.cursor);
        return state.update({ selection: EditorSelection.cursor(offset) }).state;
    }
    private handleUpdate(update: ViewUpdate): void {
        if (this.disposed)
            return;
        const { code } = this.session;
        if (update.docChanged) {
            const source = update.state.doc.toString();
            this.knownSource = source;
            code.updateSource(this.assetId, source, cursorOf(update.state));
            this.shiftBreakpoints(update);
            liveVerifierFor(this.session).schedule(this.assetId);
        }
        else if (update.selectionSet) {
            code.updateCursor(this.assetId, cursorOf(update.state));
        }
        for (const listener of this.updateListeners)
            listener(update);
    }
    onUpdate(listener: (update: ViewUpdate) => void): () => void {
        this.updateListeners.add(listener);
        return () => this.updateListeners.delete(listener);
    }
    syncSource(source: string): void {
        if (this.disposed || source === this.knownSource)
            return;
        const current = this.view.state.doc.toString();
        this.knownSource = source;
        if (current === source)
            return;
        let prefix = 0;
        const max = Math.min(current.length, source.length);
        while (prefix < max && current.charCodeAt(prefix) === source.charCodeAt(prefix))
            prefix++;
        let suffix = 0;
        while (suffix < max - prefix && current.charCodeAt(current.length - 1 - suffix) === source.charCodeAt(source.length - 1 - suffix))
            suffix++;
        this.view.dispatch({ changes: { from: prefix, to: current.length - suffix, insert: source.slice(prefix, source.length - suffix) }, userEvent: 'external' });
    }
    syncLanguage(languageId: ScriptLanguageId): void {
        if (this.disposed || languageId === this.languageId)
            return;
        this.setLanguage(languageId);
    }
    syncOptions(options: CodeViewOptions): void {
        if (this.disposed || options === this.options)
            return;
        const suggestChanged = options.autoSuggest !== this.options.autoSuggest;
        this.options = options;
        this.binding.options.apply(this.view, options);
        if (suggestChanged)
            this.view.dispatch({ effects: this.binding.intelligence.reconfigure(intelligenceExtensions(this.intelligence, options)) });
    }
    syncFind(find: CodeFindState): void {
        if (this.disposed)
            return;
        applyFindState(this.view, find.open ? find : { ...find, query: '' });
    }
    syncDiagnostics(diagnostics: readonly CodeDiagnostic[]): void {
        if (this.disposed)
            return;
        publishDiagnostics(this.view, diagnostics);
    }
    syncBreakpoints(breakpoints: BreakpointView): void {
        if (this.disposed)
            return;
        publishBreakpoints(this.view, breakpoints);
    }
    private toggleBreakpoint(line: number): void {
        if (this.disposed)
            return;
        this.session.scripts.scriptDebugger.toggle(this.assetId, line);
    }
    private shiftBreakpoints(update: ViewUpdate): void {
        const { scriptDebugger } = this.session.scripts;
        if (scriptDebugger.breakpointsOf(this.assetId).length === 0)
            return;
        const shifts: Array<{
            fromLine: number;
            delta: number;
        }> = [];
        const before = update.startState.doc;
        update.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
            const startLine = before.lineAt(fromA).number;
            const removedLines = before.lineAt(toA).number - startLine;
            const delta = inserted.lines - 1 - removedLines;
            if (delta !== 0)
                shifts.push({ fromLine: startLine + 1, delta });
        });
        for (const shift of shifts.reverse())
            scriptDebugger.shiftLines(this.assetId, shift.fromLine, shift.delta);
    }
    private setLanguage(languageId: ScriptLanguageId): void {
        this.languageId = languageId;
        this.intelligence?.dispose();
        this.intelligence = null;
        this.binding.loads.intelligence = null;
        this.view.dispatch({
            effects: [
                this.binding.language.reconfigure(languageSupport(languageId)),
                this.binding.indent.reconfigure(indentExtensions(languageId)),
                this.binding.intelligence.reconfigure(intelligenceExtensions(null, this.options)),
            ],
        });
        this.loadIntelligence(languageId);
    }
    private loadIntelligence(languageId: ScriptLanguageId): void {
        const { session, binding, assetId } = this;
        if (binding.loads.intelligence === languageId)
            return;
        binding.loads.intelligence = languageId;
        void createIntelligence({
            session,
            assetId,
            language: languageId,
            scriptName: () => session.code.tab(assetId)?.document.name ?? '',
        }).then((intelligence) => {
            const controller = binding.link.controller;
            if (!controller || controller.languageId !== languageId || controller.intelligence) {
                intelligence.dispose();
                if (!controller && binding.loads.intelligence === languageId)
                    binding.loads.intelligence = null;
                return;
            }
            controller.intelligence = intelligence;
            controller.view.dispatch({ effects: binding.intelligence.reconfigure(intelligenceExtensions(intelligence, controller.options)) });
        }, (cause: unknown) => {
            if (binding.loads.intelligence === languageId)
                binding.loads.intelligence = null;
            console.warn(`[helix] inteligência de ${languageId} indisponível:`, cause);
        });
    }
    dispose(): void {
        if (this.disposed)
            return;
        this.disposed = true;
        const { code } = this.session;
        const { view } = this;
        code.updateCursor(this.assetId, cursorOf(view.state), view.scrollDOM.scrollTop);
        code.detachView(this.handle);
        this.binding.link.controller = null;
        const { binding, languageId, intelligence } = this;
        const snapshot: Snapshot = { state: view.state, binding, languageId, intelligence, dispose: () => intelligence?.dispose() };
        view.destroy();
        this.updateListeners.clear();
        code.setSurfaceState(this.assetId, snapshot);
    }
}
