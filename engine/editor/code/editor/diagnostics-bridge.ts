import { lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint';
import type { EditorState, Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { CodeDiagnostic } from '../code-editor';
function offsetOf(state: EditorState, line: number, column: number): number {
    const lines = state.doc.lines;
    const safeLine = Math.max(1, Math.min(line, lines));
    const info = state.doc.line(safeLine);
    return Math.max(info.from, Math.min(info.from + Math.max(0, column - 1), info.to));
}
function rangeOf(state: EditorState, diagnostic: CodeDiagnostic): {
    from: number;
    to: number;
} {
    const from = offsetOf(state, diagnostic.line, diagnostic.column);
    if (diagnostic.endLine !== undefined && diagnostic.endColumn !== undefined) {
        const to = offsetOf(state, diagnostic.endLine, diagnostic.endColumn);
        if (to > from)
            return { from, to };
    }
    const word = state.wordAt(from);
    if (word && word.to > from)
        return { from, to: word.to };
    const line = state.doc.lineAt(from);
    if (from >= line.to && line.to > line.from)
        return { from: line.to - 1, to: line.to };
    return { from, to: Math.min(from + 1, line.to) };
}
export function toLintDiagnostics(state: EditorState, diagnostics: readonly CodeDiagnostic[]): Diagnostic[] {
    const converted: Diagnostic[] = [];
    for (const diagnostic of diagnostics) {
        const { from, to } = rangeOf(state, diagnostic);
        converted.push({
            from,
            to,
            severity: diagnostic.severity,
            message: diagnostic.message,
            source: diagnostic.code ? `${diagnostic.source} · ${diagnostic.code}` : diagnostic.source,
        });
    }
    return converted.sort((a, b) => a.from - b.from || a.to - b.to);
}
export function publishDiagnostics(view: EditorView, diagnostics: readonly CodeDiagnostic[]): void {
    view.dispatch(setDiagnostics(view.state, toLintDiagnostics(view.state, diagnostics)));
}
export function diagnosticsExtensions(): Extension {
    return [lintGutter({ hoverTime: 150 })];
}
