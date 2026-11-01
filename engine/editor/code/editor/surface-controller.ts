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
