import { SourceMapBuilder } from './source-map';
export interface SourcePosition {
    readonly line: number;
    readonly column: number;
}
const MARK = '\u0001';
const MARKER = /\u0001(\d+):(\d+)\u0001/g;
export class JsWriter {
    private readonly lines: string[] = [];
    private current = '';
    private depth = 0;
    private readonly map: SourceMapBuilder;
    constructor(file: string, source: string, private readonly indentUnit = '  ') {
        this.map = new SourceMapBuilder(file, source);
    }
    static marker(span: SourcePosition): string {
        return `${MARK}${span.line}:${span.column}${MARK}`;
    }
    get line(): number {
        return this.lines.length + 1;
    }
    indent(): void {
        this.depth++;
    }
    dedent(): void {
        if (this.depth > 0)
            this.depth--;
    }
    write(text: string): void {
        const parts = text.split('\n');
        for (let index = 0; index < parts.length; index++) {
            if (index > 0)
                this.newline();
            this.append(parts[index]);
        }
    }
    writeLine(text = ''): void {
        this.write(text);
        this.newline();
    }
    open(text: string): void {
        this.writeLine(text);
        this.indent();
    }
    close(text = '}'): void {
        this.dedent();
        this.writeLine(text);
    }
    private append(text: string): void {
        if (text.length === 0)
            return;
        if (this.current.length === 0)
            this.current = this.indentUnit.repeat(this.depth);
        MARKER.lastIndex = 0;
        let last = 0;
        let match: RegExpExecArray | null;
        while ((match = MARKER.exec(text)) !== null) {
            this.current += text.slice(last, match.index);
            this.map.addMapping(this.line, this.current.length + 1, Number(match[1]), Number(match[2]));
            last = match.index + match[0].length;
        }
        this.current += text.slice(last);
    }
    private newline(): void {
        this.lines.push(this.current);
        this.current = '';
    }
    toCode(): string {
        const tail = this.current.length > 0 ? [this.current] : [];
        return [...this.lines, ...tail].join('\n');
    }
    toSourceMap(): string {
        return this.map.toJSON();
    }
}
