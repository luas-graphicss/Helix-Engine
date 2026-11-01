import { closeBrackets } from '@codemirror/autocomplete';
import { foldGutter } from '@codemirror/language';
import { highlightSelectionMatches } from '@codemirror/search';
import { Compartment, type Extension } from '@codemirror/state';
import { drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, highlightTrailingWhitespace, highlightWhitespace, lineNumbers } from '@codemirror/view';
import { indentationMarkers } from '@replit/codemirror-indentation-markers';
import type { CodeViewOptions } from '../code-editor';
const CURSOR_BLINK_MS = 1200;
export function lineHeightFor(fontSize: number, ratio: number): number {
    return Math.round(fontSize * ratio);
}
const EXTENSIONS = {
    gutters: guttersFor,
    wrap: (options: CodeViewOptions): Extension => (options.wordWrap ? EditorView.lineWrapping : []),
    whitespace: (options: CodeViewOptions): Extension => (options.whitespace ? [highlightWhitespace(), highlightTrailingWhitespace()] : []),
    activeLine: (options: CodeViewOptions): Extension => (options.highlightLine ? [highlightActiveLine(), highlightActiveLineGutter()] : []),
    guides: (options: CodeViewOptions): Extension => (options.indentGuides ? indentationMarkers({ hideFirstIndent: true, thickness: 1 }) : []),
    selection: (options: CodeViewOptions): Extension => drawSelection({ cursorBlinkRate: options.cursorBlink ? CURSOR_BLINK_MS : 0 }),
    brackets: (options: CodeViewOptions): Extension => (options.autoCloseBrackets ? closeBrackets() : []),
    matches: (options: CodeViewOptions): Extension => (options.selectionMatches ? highlightSelectionMatches({ minSelectionLength: 2, wholeWords: false }) : []),
    font: (options: CodeViewOptions): Extension => fontFor(options.fontSize, options.lineHeight),
} satisfies Record<string, (options: CodeViewOptions) => Extension>;
type CompartmentKey = keyof typeof EXTENSIONS;
const DEPENDENCIES: Record<CompartmentKey, readonly (keyof CodeViewOptions)[]> = {
    gutters: ['lineNumbers', 'folding'],
    wrap: ['wordWrap'],
    whitespace: ['whitespace'],
    activeLine: ['highlightLine'],
    guides: ['indentGuides'],
    selection: ['cursorBlink'],
    brackets: ['autoCloseBrackets'],
    matches: ['selectionMatches'],
    font: ['fontSize', 'lineHeight'],
};
const KEYS = Object.keys(EXTENSIONS) as CompartmentKey[];
export class ViewOptionCompartments {
    private readonly compartments = Object.fromEntries(KEYS.map((key) => [key, new Compartment()])) as Record<CompartmentKey, Compartment>;
    private current: CodeViewOptions;
    constructor(options: CodeViewOptions) {
        this.current = options;
    }
    initial(): Extension {
        return KEYS.map((key) => this.compartments[key].of(EXTENSIONS[key](this.current)));
    }
    apply(view: EditorView, options: CodeViewOptions): void {
        const previous = this.current;
        if (previous === options)
            return;
        this.current = options;
        const changed = KEYS.filter((key) => DEPENDENCIES[key].some((option) => previous[option] !== options[option]));
        if (changed.length > 0)
            view.dispatch({ effects: changed.map((key) => this.compartments[key].reconfigure(EXTENSIONS[key](options))) });
    }
    sync(view: EditorView, options: CodeViewOptions): void {
        this.current = options;
        view.dispatch({ effects: KEYS.map((key) => this.compartments[key].reconfigure(EXTENSIONS[key](options))) });
    }
}
function guttersFor(options: CodeViewOptions): Extension {
    const extensions: Extension[] = [];
    if (options.lineNumbers)
        extensions.push(lineNumbers());
    if (options.folding) {
        extensions.push(foldGutter({
            markerDOM(open) {
                const marker = document.createElement('span');
                marker.textContent = open ? '▾' : '▸';
                marker.setAttribute('aria-hidden', 'true');
                marker.className = open ? '' : 'cm-foldGutter-folded';
                return marker;
            },
        }));
    }
    return extensions;
}
function fontFor(fontSize: number, ratio: number): Extension {
    const lineHeight = lineHeightFor(fontSize, ratio);
    return EditorView.theme({
        '&': { fontSize: `${fontSize}px` },
        '.cm-content, .cm-gutters': { lineHeight: `${lineHeight}px` },
    });
}
