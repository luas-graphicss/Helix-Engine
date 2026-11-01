import { SearchQuery, getSearchQuery, search, setSearchQuery } from '@codemirror/search';
import type { EditorState, Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import type { CodeFindState } from '../code-editor';
const MATCH_LIMIT = 10000;
export function queryFor(find: CodeFindState): SearchQuery {
    return new SearchQuery({ search: find.query, caseSensitive: find.matchCase, regexp: find.regex, wholeWord: find.wholeWord, replace: find.replacement, literal: !find.regex });
}
export function applyFindState(view: EditorView, find: CodeFindState): void {
    const next = queryFor(find);
    if (getSearchQuery(view.state).eq(next))
        return;
    view.dispatch({ effects: setSearchQuery.of(next) });
}
export function hasSearchableQuery(query: SearchQuery): boolean {
    return query.search.length > 0 && query.valid;
}
export interface MatchSummary {
    readonly total: number;
    readonly current: number;
}
export function summarizeMatches(state: EditorState, query: SearchQuery = getSearchQuery(state)): MatchSummary {
    if (!hasSearchableQuery(query))
        return { total: 0, current: -1 };
    const { from, to } = state.selection.main;
    const cursor = query.getCursor(state);
    let total = 0;
    let current = -1;
    for (let step = cursor.next(); !step.done; step = cursor.next()) {
        if (step.value.from === from && step.value.to === to)
            current = total;
        total++;
        if (total >= MATCH_LIMIT)
            break;
    }
    return { total, current };
}
const matchDecoration = Decoration.mark({ class: 'cm-searchMatch' });
const selectedMatchDecoration = Decoration.mark({ class: 'cm-searchMatch cm-searchMatch-selected' });
const matchHighlighter = ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
        this.decorations = this.highlight(view);
    }
    update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged || getSearchQuery(update.state) !== getSearchQuery(update.startState)) {
            this.decorations = this.highlight(update.view);
        }
    }
    private highlight(view: EditorView): DecorationSet {
        const query = getSearchQuery(view.state);
        if (!hasSearchableQuery(query))
            return Decoration.none;
        const { from: selectionFrom, to: selectionTo } = view.state.selection.main;
        const ranges = [];
        for (const { from, to } of view.visibleRanges) {
            const cursor = query.getCursor(view.state, Math.max(0, from - 250), Math.min(view.state.doc.length, to + 250));
            for (let step = cursor.next(); !step.done; step = cursor.next()) {
                const { from: start, to: end } = step.value;
                if (start === end)
                    continue;
                const selected = start === selectionFrom && end === selectionTo;
                ranges.push((selected ? selectedMatchDecoration : matchDecoration).range(start, end));
                if (ranges.length >= 2000)
                    break;
            }
        }
        return Decoration.set(ranges, true);
    }
}, { decorations: (plugin) => plugin.decorations });
function matchReporter(report: (summary: MatchSummary) => void): Extension {
    return EditorView.updateListener.of((update) => {
        const queryChanged = getSearchQuery(update.state) !== getSearchQuery(update.startState);
        if (!update.docChanged && !update.selectionSet && !queryChanged)
            return;
        if (!hasSearchableQuery(getSearchQuery(update.state))) {
            if (queryChanged || update.docChanged)
                report({ total: 0, current: -1 });
            return;
        }
        report(summarizeMatches(update.state));
    });
}
export function searchExtensions(report: (summary: MatchSummary) => void): Extension {
    return [search({ top: true }), matchHighlighter, matchReporter(report)];
}
