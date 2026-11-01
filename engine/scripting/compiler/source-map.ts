export interface SourceMapping {
    readonly generatedLine: number;
    readonly generatedColumn: number;
    readonly originalLine: number;
    readonly originalColumn: number;
}
export interface DecodedSourceMap {
    readonly mappings: readonly SourceMapping[];
}
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_VALUES = new Map<string, number>();
for (let index = 0; index < BASE64.length; index++)
    BASE64_VALUES.set(BASE64[index], index);
function decodeVlqSegment(segment: string): number[] {
    const values: number[] = [];
    let value = 0;
    let shift = 0;
    for (const char of segment) {
        const digit = BASE64_VALUES.get(char);
        if (digit === undefined)
            throw new Error(`Caractere inválido no source map: "${char}".`);
        const continuation = digit & 32;
        value += (digit & 31) << shift;
        if (continuation) {
            shift += 5;
            continue;
        }
        const negative = value & 1;
        value >>>= 1;
        values.push(negative ? -value : value);
        value = 0;
        shift = 0;
    }
    return values;
}
function encodeVlq(value: number): string {
    let vlq = value < 0 ? (-value << 1) | 1 : value << 1;
    let encoded = '';
    do {
        let digit = vlq & 31;
        vlq >>>= 5;
        if (vlq > 0)
            digit |= 32;
        encoded += BASE64[digit];
    } while (vlq > 0);
    return encoded;
}
export class SourceMapBuilder {
    private readonly lines = new Map<number, Array<{
        generatedColumn: number;
        originalLine: number;
        originalColumn: number;
    }>>();
    constructor(private readonly file: string, private readonly sourceContent: string | null = null) { }
    addMapping(generatedLine: number, generatedColumn: number, originalLine: number, originalColumn: number): void {
        let segments = this.lines.get(generatedLine);
        if (!segments) {
            segments = [];
            this.lines.set(generatedLine, segments);
        }
        segments.push({ generatedColumn: generatedColumn - 1, originalLine: originalLine - 1, originalColumn: Math.max(0, originalColumn - 1) });
    }
    toJSON(): string {
        const lastLine = this.lines.size === 0 ? 0 : Math.max(...this.lines.keys());
        const encodedLines: string[] = [];
        let previousOriginalLine = 0;
        let previousOriginalColumn = 0;
        for (let line = 1; line <= lastLine; line++) {
            const segments = this.lines.get(line);
            if (!segments) {
                encodedLines.push('');
                continue;
            }
            segments.sort((a, b) => a.generatedColumn - b.generatedColumn);
            let previousGeneratedColumn = 0;
            const encoded: string[] = [];
            for (const segment of segments) {
                encoded.push(encodeVlq(segment.generatedColumn - previousGeneratedColumn) + encodeVlq(0) + encodeVlq(segment.originalLine - previousOriginalLine) + encodeVlq(segment.originalColumn - previousOriginalColumn));
                previousGeneratedColumn = segment.generatedColumn;
                previousOriginalLine = segment.originalLine;
                previousOriginalColumn = segment.originalColumn;
            }
            encodedLines.push(encoded.join(','));
        }
        return JSON.stringify({
            version: 3,
            file: this.file.replace(/\.[^.]+$/, '.js'),
            sources: [this.file],
            sourcesContent: this.sourceContent === null ? undefined : [this.sourceContent],
            names: [],
            mappings: encodedLines.join(';'),
        });
    }
}
export function decodeSourceMap(json: string): DecodedSourceMap {
    const parsed = JSON.parse(json) as {
        mappings?: string;
    };
    const encoded = parsed.mappings ?? '';
    const mappings: SourceMapping[] = [];
    let originalLine = 0;
    let originalColumn = 0;
    let sourceIndex = 0;
    const lines = encoded.split(';');
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        let generatedColumn = 0;
        const line = lines[lineIndex];
        if (!line)
            continue;
        for (const segment of line.split(',')) {
            if (!segment)
                continue;
            const fields = decodeVlqSegment(segment);
            generatedColumn += fields[0];
            if (fields.length < 4)
                continue;
            sourceIndex += fields[1];
            originalLine += fields[2];
            originalColumn += fields[3];
            if (sourceIndex !== 0)
                continue;
            mappings.push({ generatedLine: lineIndex + 1, generatedColumn, originalLine: originalLine + 1, originalColumn: originalColumn + 1 });
        }
    }
    return { mappings };
}
export function originalPositionFor(map: DecodedSourceMap, generatedLine: number, generatedColumn: number): {
    line: number;
    column: number;
} | null {
    let best: SourceMapping | null = null;
    let first: SourceMapping | null = null;
    for (const mapping of map.mappings) {
        if (mapping.generatedLine !== generatedLine) {
            if (mapping.generatedLine > generatedLine)
                break;
            continue;
        }
        if (!first)
            first = mapping;
        if (mapping.generatedColumn <= generatedColumn - 1)
            best = mapping;
        else
            break;
    }
    const found = best ?? first;
    return found ? { line: found.originalLine, column: found.originalColumn } : null;
}
