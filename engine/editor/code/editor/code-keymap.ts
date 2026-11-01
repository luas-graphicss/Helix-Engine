import { acceptCompletion, closeBracketsKeymap, completionKeymap, completionStatus } from '@codemirror/autocomplete';
import { defaultKeymap, historyKeymap, indentLess, indentMore, insertTab } from '@codemirror/commands';
import { foldKeymap } from '@codemirror/language';
import { lintKeymap } from '@codemirror/lint';
import { Prec, type Extension } from '@codemirror/state';
import { EditorView, keymap, type KeyBinding } from '@codemirror/view';
import { resetCodeFontSize, stepCodeFontSize } from '@/engine/editor/code/code-preferences';
import { handleCodeShortcut } from '@/engine/editor/code/code-shortcuts';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { shortcutBindings } from '@/engine/editor/shortcuts/shortcut-bindings';
import type { CodeCommandId } from './code-commands';
export interface CodeKeymapHost {
    readonly session: EditorSession;
    run(command: CodeCommandId): boolean;
}
export function codeKeymap(host: CodeKeymapHost): Extension {
    const { session } = host;
    const { code } = session;
    const engineShortcuts = EditorView.domEventHandlers({
        keydown(event, view) {
            if (event.key === 'Escape' || event.isComposing || event.keyCode === 229)
                return false;
            const ctrl = event.ctrlKey || event.metaKey;
            if (ctrl && !event.altKey && !event.shiftKey) {
                if (event.key === '=' || event.key === '+')
                    return consume(event, () => stepCodeFontSize(1));
                if (event.key === '-')
                    return consume(event, () => stepCodeFontSize(-1));
                if (event.key === '0')
                    return consume(event, resetCodeFontSize);
            }
            const action = shortcutBindings.resolve(event, 'code');
            if (!action)
                return false;
            if (action === 'code.find' || action === 'code.replace') {
                const { from, to } = view.state.selection.main;
                const selected = from !== to ? view.state.sliceDoc(from, to).split('\n')[0] : undefined;
                return consume(event, () => code.openFind({ replace: action === 'code.replace', query: selected }));
            }
            if (action === 'code.escape')
                return false;
            if (handleCodeShortcut(event, session)) {
                event.preventDefault();
                return true;
            }
            return false;
        },
    });
    const run = (command: CodeCommandId) => () => host.run(command);
    const editing: KeyBinding[] = [
        { key: 'Tab', run: indentOrInsertTab, shift: indentLess },
        { key: 'Mod-/', run: run('toggleComment') },
        { key: 'Shift-Alt-a', run: run('toggleBlockComment') },
        { key: 'Mod-Shift-d', run: run('duplicateLine') },
        { key: 'Shift-Alt-ArrowDown', run: run('copyLineDown') },
        { key: 'Shift-Alt-ArrowUp', run: run('copyLineUp') },
        { key: 'Alt-ArrowDown', run: run('moveLineDown') },
        { key: 'Alt-ArrowUp', run: run('moveLineUp') },
        { key: 'Mod-Shift-Backspace', run: run('deleteLine') },
        { key: 'Mod-]', run: run('indentMore') },
        { key: 'Mod-[', run: run('indentLess') },
        { key: 'Mod-d', run: run('selectNextOccurrence') },
        { key: 'Mod-Shift-l', run: run('selectAllOccurrences') },
        { key: 'Mod-Alt-ArrowUp', run: run('addCursorAbove') },
        { key: 'Mod-Alt-ArrowDown', run: run('addCursorBelow') },
        { key: 'Shift-Alt-ArrowRight', run: run('expandSelection') },
        { key: 'Mod-Shift-\\', run: run('gotoMatchingBracket') },
        { key: 'Mod-Shift-[', run: run('foldCurrent') },
        { key: 'Mod-Shift-]', run: run('unfoldCurrent') },
        { key: 'Shift-Alt-f', run: run('formatDocument') },
        { key: 'F2', run: run('renameSymbol') },
        { key: 'F12', run: run('gotoDefinition') },
        { key: 'Mod-Space', run: run('triggerSuggest') },
        { key: 'Mod-Shift-Space', run: run('triggerParameterHints') },
        { key: 'F8', run: run('nextDiagnostic') },
        { key: 'Shift-F8', run: run('previousDiagnostic') },
        { key: 'Mod-g', run: run('gotoLine') },
    ];
    const escape: KeyBinding[] = [
        {
            key: 'Escape',
            run: () => {
                if (code.find.open) {
                    code.closeFind();
                    return true;
                }
                if (code.gotoLineOpen) {
                    code.closeGotoLine();
                    return true;
                }
                return false;
            },
        },
    ];
    return [
        Prec.highest(engineShortcuts),
        Prec.high(keymap.of(editing)),
        keymap.of([...closeBracketsKeymap, ...completionKeymap, ...historyKeymap, ...foldKeymap, ...lintKeymap, ...defaultKeymap]),
        Prec.lowest(keymap.of(escape)),
    ];
}
function indentOrInsertTab(view: EditorView): boolean {
    if (completionStatus(view.state) === 'active')
        return acceptCompletion(view);
    const hasSelection = view.state.selection.ranges.some((range) => !range.empty);
    return hasSelection ? indentMore(view) : insertTab(view);
}
function consume(event: KeyboardEvent, action: () => void): boolean {
    event.preventDefault();
    action();
    return true;
}
