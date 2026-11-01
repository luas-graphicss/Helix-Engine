import { Prec, RangeSet, StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, gutter, GutterMarker, type DecorationSet } from '@codemirror/view';
export interface BreakpointMark {
    readonly line: number;
    readonly enabled: boolean;
    readonly verified: boolean;
    readonly logpoint: boolean;
    readonly conditional: boolean;
}
export interface BreakpointView {
    readonly marks: readonly BreakpointMark[];
    readonly pausedLine: number | null;
}
export const EMPTY_BREAKPOINT_VIEW: BreakpointView = { marks: [], pausedLine: null };
export function sameBreakpointView(a: BreakpointView, b: BreakpointView): boolean {
    if (a.pausedLine !== b.pausedLine || a.marks.length !== b.marks.length)
        return false;
    for (let index = 0; index < a.marks.length; index++) {
        const x = a.marks[index];
        const y = b.marks[index];
        if (x.line !== y.line || x.enabled !== y.enabled || x.verified !== y.verified || x.logpoint !== y.logpoint || x.conditional !== y.conditional)
            return false;
    }
    return true;
}
const setBreakpointView = StateEffect.define<BreakpointView>();
function markTitle(mark: BreakpointMark | null, paused: boolean): string {
    if (!mark)
        return paused ? 'O jogo está pausado nesta linha' : '';
    const kind = mark.logpoint ? 'Ponto de registro' : mark.conditional ? 'Ponto de interrupção condicional' : 'Ponto de interrupção';
    const state = !mark.enabled ? ' (desligado)' : !mark.verified ? ' (não verificado: o script ainda não compilou, ou a linha está fora de um hook reconhecido ou sem instrução)' : '';
    return `${kind}${state}${paused ? ' · pausado aqui' : ''}. Clique para remover.`;
}
class BreakpointGutterMarker extends GutterMarker {
    constructor(private readonly mark: BreakpointMark | null, private readonly paused: boolean) {
        super();
    }
    eq(other: BreakpointGutterMarker): boolean {
        if (this.paused !== other.paused)
            return false;
        if (this.mark === other.mark)
            return true;
        if (!this.mark || !other.mark)
            return false;
        const a = this.mark;
        const b = other.mark;
        return a.enabled === b.enabled && a.verified === b.verified && a.logpoint === b.logpoint && a.conditional === b.conditional;
    }
    toDOM(): HTMLElement {
        const element = document.createElement('span');
        const { mark } = this;
        const classes = ['cm-breakpoint'];
        if (mark) {
            classes.push(mark.logpoint ? 'cm-breakpoint-log' : 'cm-breakpoint-dot');
            if (!mark.enabled)
                classes.push('cm-breakpoint-disabled');
            else if (!mark.verified)
                classes.push('cm-breakpoint-unverified');
            if (mark.conditional && !mark.logpoint)
                classes.push('cm-breakpoint-conditional');
        }
        if (this.paused)
            classes.push('cm-breakpoint-paused');
        element.className = classes.join(' ');
        element.title = markTitle(mark, this.paused);
        return element;
    }
}
const SPACER = new (class extends GutterMarker {
    toDOM(): HTMLElement {
        const element = document.createElement('span');
        element.className = 'cm-breakpoint';
        return element;
    }
})();
const pausedLineDecoration = Decoration.line({ class: 'cm-debugPausedLine' });
interface BreakpointFieldValue {
    readonly view: BreakpointView;
    readonly markers: RangeSet<GutterMarker>;
    readonly decorations: DecorationSet;
}
function build(doc: {
    lines: number;
    line(n: number): {
        from: number;
    };
}, view: BreakpointView): BreakpointFieldValue {
    const markers: Array<{
        from: number;
        marker: GutterMarker;
    }> = [];
    const byLine = new Map<number, BreakpointMark>();
    for (const mark of view.marks)
        if (mark.line >= 1 && mark.line <= doc.lines)
            byLine.set(mark.line, mark);
    const paused = view.pausedLine !== null && view.pausedLine >= 1 && view.pausedLine <= doc.lines ? view.pausedLine : null;
    const lines = new Set<number>(byLine.keys());
    if (paused !== null)
        lines.add(paused);
    for (const line of Array.from(lines).sort((a, b) => a - b)) {
        markers.push({ from: doc.line(line).from, marker: new BreakpointGutterMarker(byLine.get(line) ?? null, line === paused) });
    }
    const decorations = paused !== null ? Decoration.set([pausedLineDecoration.range(doc.line(paused).from)]) : Decoration.none;
    return { view, markers: RangeSet.of(markers.map((entry) => entry.marker.range(entry.from))), decorations };
}
const breakpointField = StateField.define<BreakpointFieldValue>({
    create: (state) => build(state.doc, EMPTY_BREAKPOINT_VIEW),
    update(value, transaction) {
        for (const effect of transaction.effects)
            if (effect.is(setBreakpointView))
                return build(transaction.state.doc, effect.value);
        if (!transaction.docChanged)
            return value;
        return { view: value.view, markers: value.markers.map(transaction.changes), decorations: value.decorations.map(transaction.changes) };
    },
    provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});
export function publishBreakpoints(view: EditorView, breakpoints: BreakpointView): void {
    view.dispatch({ effects: setBreakpointView.of(breakpoints) });
}
const breakpointTheme = EditorView.baseTheme({
    '.cm-breakpoint-gutter': { width: '14px', cursor: 'pointer' },
    '.cm-breakpoint-gutter .cm-gutterElement': { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0' },
    '.cm-breakpoint': { display: 'block', width: '9px', height: '9px', borderRadius: '50%', boxSizing: 'border-box' },
    '.cm-breakpoint-dot': { backgroundColor: 'var(--destructive)' },
    '.cm-breakpoint-conditional': { boxShadow: 'inset 0 0 0 2px var(--destructive), inset 0 0 0 4px var(--surface)' },
    '.cm-breakpoint-log': { backgroundColor: 'var(--primary)', borderRadius: '2px', transform: 'rotate(45deg) scale(0.85)' },
    '.cm-breakpoint-disabled': { backgroundColor: 'transparent', border: '1.5px solid color-mix(in oklab, var(--destructive) 70%, transparent)', boxShadow: 'none' },
    '.cm-breakpoint-log.cm-breakpoint-disabled': { borderColor: 'color-mix(in oklab, var(--primary) 70%, transparent)' },
    '.cm-breakpoint-unverified': { backgroundColor: 'transparent', border: '1.5px solid var(--warning)', boxShadow: 'none' },
    '.cm-breakpoint-paused': { position: 'relative' },
    '.cm-breakpoint-paused::after': {
        content: '""',
        position: 'absolute',
        left: '-2px',
        top: '-2px',
        width: '0',
        height: '0',
        borderTop: '6.5px solid transparent',
        borderBottom: '6.5px solid transparent',
        borderLeft: '9px solid var(--warning)',
        filter: 'drop-shadow(0 0 1px var(--background))',
    },
    '.cm-breakpoint-gutter .cm-gutterElement:empty:hover::before': { content: '""', display: 'block', width: '9px', height: '9px', borderRadius: '50%', backgroundColor: 'color-mix(in oklab, var(--destructive) 35%, transparent)' },
    '.cm-debugPausedLine': { backgroundColor: 'color-mix(in oklab, var(--warning) 16%, transparent)', boxShadow: 'inset 2px 0 0 0 var(--warning)' },
});
export interface BreakpointBridgeOptions {
    readonly toggle: (line: number) => void;
}
export function breakpointExtensions(options: BreakpointBridgeOptions): Extension {
    return [
        breakpointField,
        breakpointTheme,
        Prec.highest(gutter({
            class: 'cm-breakpoint-gutter',
            markers: (view) => view.state.field(breakpointField).markers,
            initialSpacer: () => SPACER,
            domEventHandlers: {
                mousedown(view, line, event) {
                    if ((event as MouseEvent).button !== 0)
                        return false;
                    options.toggle(view.state.doc.lineAt(line.from).number);
                    return true;
                },
            },
        })),
    ];
}
