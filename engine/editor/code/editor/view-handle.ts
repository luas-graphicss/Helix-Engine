import { startCompletion } from '@codemirror/autocomplete';
import { addCursorAbove, addCursorBelow, copyLineDown, copyLineUp, cursorMatchingBracket, deleteLine, indentLess, indentMore, moveLineDown, moveLineUp, redo, selectAll, selectParentSyntax, toggleBlockComment, toggleComment, undo } from '@codemirror/commands';
import { foldAll, foldCode, unfoldAll, unfoldCode } from '@codemirror/language';
import { nextDiagnostic, previousDiagnostic } from '@codemirror/lint';
import { findNext, findPrevious, getSearchQuery, replaceAll, replaceNext, selectMatches, selectNextOccurrence, selectSelectionMatches } from '@codemirror/search';
import { EditorSelection } from '@codemirror/state';
import { EditorView, type Command } from '@codemirror/view';
import type { CodeEditor } from '../code-editor';
import type { LanguageIntelligence } from '../intelligence/language-intelligence';
import type { CodeCommandId } from './code-commands';
import type { CodeViewHandle } from './code-view-handle';
import { hasSearchableQuery } from './search-bridge';
import { duplicateLine, sortLines, toLowerCase, toUpperCase, trimTrailingWhitespace } from './transform-commands';
export interface ViewHandleHost {
    readonly view: EditorView;
    readonly code: CodeEditor;
    readonly assetId: string;
    intelligence(): LanguageIntelligence | null;
}
const BUILT_IN: Partial<Record<CodeCommandId, Command>> = {
    undo,
    redo,
    selectAll,
    toggleComment,
    toggleBlockComment,
    duplicateLine,
    deleteLine,
    moveLineUp,
    moveLineDown,
    copyLineUp,
    copyLineDown,
    indentMore,
    indentLess,
    selectNextOccurrence,
    selectAllOccurrences: selectSelectionMatches,
    addCursorAbove,
    addCursorBelow,
    expandSelection: selectParentSyntax,
    gotoMatchingBracket: cursorMatchingBracket,
    foldCurrent: foldCode,
    unfoldCurrent: unfoldCode,
    foldAll,
    unfoldAll,
    triggerSuggest: startCompletion,
    nextDiagnostic,
    previousDiagnostic,
    sortLines,
    toUpperCase,
    toLowerCase,
    trimTrailingWhitespace,
};
export function createViewHandle(host: ViewHandleHost): CodeViewHandle {
    const { view, code, assetId } = host;
    const gotoLine = (line: number, column = 1): void => {
        const { doc } = view.state;
        const target = doc.line(Math.max(1, Math.min(line, doc.lines)));
        const offset = Math.min(target.from + Math.max(0, column - 1), target.to);
        view.dispatch({ selection: EditorSelection.cursor(offset), effects: EditorView.scrollIntoView(offset, { y: 'center' }), userEvent: 'select' });
        view.focus();
    };
    const withFocus = (command: Command): boolean => {
        const applied = command(view);
        if (applied)
            view.focus();
        return applied;
    };
    const searchable = () => hasSearchableQuery(getSearchQuery(view.state));
    return {
        assetId,
        focus: () => view.focus(),
        selectedText: () => {
            const { from, to } = view.state.selection.main;
            return from === to ? '' : view.state.sliceDoc(from, to);
        },
        gotoLine,
        lineCount: () => view.state.doc.lines,
        findNext: () => searchable() && findNext(view),
        findPrevious: () => searchable() && findPrevious(view),
        replaceNext: () => searchable() && replaceNext(view),
        replaceAll: () => searchable() && replaceAll(view),
        selectAllMatches: () => searchable() && withFocus(selectMatches),
        canRun: (command) => {
            switch (command) {
                case 'formatDocument':
                    return Boolean(host.intelligence()?.formatDocument);
                case 'renameSymbol':
                    return Boolean(host.intelligence()?.renameSymbol);
                case 'gotoDefinition':
                    return Boolean(host.intelligence()?.gotoDefinition);
                case 'triggerParameterHints':
                    return Boolean(host.intelligence()?.showSignatureHelp);
                default:
                    return command in BUILT_IN || command === 'gotoLine';
            }
        },
        run: (command) => {
            const builtIn = BUILT_IN[command];
            if (builtIn)
                return withFocus(builtIn);
            const intelligence = host.intelligence();
            switch (command) {
                case 'gotoLine':
                    code.openGotoLine();
                    return true;
                case 'formatDocument':
                    if (!intelligence?.formatDocument)
                        return false;
                    void intelligence.formatDocument(view);
                    return true;
                case 'renameSymbol':
                    if (!intelligence?.renameSymbol)
                        return false;
                    void intelligence.renameSymbol(view);
                    return true;
                case 'gotoDefinition':
                    if (!intelligence?.gotoDefinition)
                        return false;
                    void intelligence.gotoDefinition(view);
                    return true;
                case 'triggerParameterHints':
                    return intelligence?.showSignatureHelp ? intelligence.showSignatureHelp(view) : false;
                default:
                    return false;
            }
        },
    };
}
