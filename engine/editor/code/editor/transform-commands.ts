import { EditorSelection, type ChangeSpec } from '@codemirror/state';
import type { Command, EditorView } from '@codemirror/view';
function selectedLineRange(view: EditorView) {
    const { from, to } = view.state.selection.main;
    const first = view.state.doc.lineAt(from);
    const last = view.state.doc.lineAt(to);
    return { from: first.from, to: last.to, first, last };
}
export const duplicateLine: Command = (view) => {
    const transaction = view.state.changeByRange((range) => {
        if (range.empty) {
            const line = view.state.doc.lineAt(range.head);
            const text = `\n${line.text}`;
            return { changes: { from: line.to, insert: text }, range: EditorSelection.cursor(range.head + text.length) };
        }
        const text = view.state.sliceDoc(range.from, range.to);
        return { changes: { from: range.to, insert: text }, range: EditorSelection.range(range.to, range.to + text.length) };
    });
    view.dispatch(transaction, { scrollIntoView: true, userEvent: 'input.duplicate' });
    return true;
};
export const sortLines: Command = (view) => {
    const { from, to, first, last } = selectedLineRange(view);
    if (first.number === last.number)
        return false;
    const lines = view.state.sliceDoc(from, to).split('\n');
    const sorted = [...lines].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    if (sorted.every((line, index) => line === lines[index]))
        return true;
    view.dispatch({ changes: { from, to, insert: sorted.join('\n') }, selection: EditorSelection.range(from, to), userEvent: 'input.sort' });
    return true;
};
function transformSelections(view: EditorView, transform: (text: string) => string, userEvent: string): boolean {
    const changes = view.state.changeByRange((range) => {
        const target = range.empty ? view.state.wordAt(range.head) : range;
        if (!target || target.from === target.to)
            return { range };
        const text = view.state.sliceDoc(target.from, target.to);
        const next = transform(text);
        if (next === text)
            return { range };
        return { changes: { from: target.from, to: target.to, insert: next }, range: EditorSelection.range(target.from, target.from + next.length) };
    });
    if (changes.changes.empty)
        return false;
    view.dispatch(changes, { userEvent, scrollIntoView: true });
    return true;
}
export const toUpperCase: Command = (view) => transformSelections(view, (text) => text.toLocaleUpperCase(), 'input.case');
export const toLowerCase: Command = (view) => transformSelections(view, (text) => text.toLocaleLowerCase(), 'input.case');
export const trimTrailingWhitespace: Command = (view) => {
    const changes: ChangeSpec[] = [];
    const { doc } = view.state;
    for (let number = 1; number <= doc.lines; number++) {
        const line = doc.line(number);
        const match = /[ \t]+$/.exec(line.text);
        if (match)
            changes.push({ from: line.to - match[0].length, to: line.to });
    }
    if (changes.length === 0)
        return false;
    view.dispatch({ changes, userEvent: 'delete.trim' });
    return true;
};
