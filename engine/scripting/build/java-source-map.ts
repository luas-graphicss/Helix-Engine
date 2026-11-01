const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_VALUES = new Map<string, number>();
for (let index = 0; index < BASE64.length; index++)
    BASE64_VALUES.set(BASE64[index], index);
interface RawSourceMap {
    readonly version?: number;
    readonly file?: string;
    readonly sourceRoot?: string;
    readonly sources?: readonly string[];
    readonly mappings?: string;
}
export function restrictSourceMapTo(json: string, file: string): string {
    const parsed = JSON.parse(json) as RawSourceMap;
    const sources = parsed.sources ?? [];
    const wanted = new Set<number>();
    sources.forEach((source, index) => {
        const base = source.split('/').pop() ?? source;
        if (base === file)
            wanted.add(index);
    });
    const lines = (parsed.mappings ?? '').split(';');
    const byLine = new Map<number, {
        column: number;
        line: number;
        originalColumn: number;
    }[]>();
    let sourceIndex = 0;
    let originalLine = 0;
    let originalColumn = 0;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        if (!line)
            continue;
        let generatedColumn = 0;
        for (const segment of line.split(',')) {
            if (!segment)
                continue;
            const fields = decodeVlq(segment);
            generatedColumn += fields[0];
            if (fields.length < 4)
                continue;
            sourceIndex += fields[1];
            originalLine += fields[2];
            originalColumn += fields[3];
            if (!wanted.has(sourceIndex))
                continue;
            let bucket = byLine.get(lineIndex);
            if (!bucket)
                byLine.set(lineIndex, (bucket = []));
            bucket.push({ column: generatedColumn, line: originalLine, originalColumn });
        }
    }
    const mapped = Array.from(byLine.keys()).sort((a, b) => a - b);
    for (let i = 0; i + 1 < mapped.length; i++) {
        const from = mapped[i];
        const to = mapped[i + 1];
        if (to - from > MAX_GAP)
            continue;
        const bucket = byLine.get(from)!;
        const last = bucket[bucket.length - 1];
        for (let line = from + 1; line < to; line++)
            byLine.set(line, [{ column: 0, line: last.line, originalColumn: last.originalColumn }]);
    }
    const out: string[] = [];
    let lastLine = 0;
    let lastColumn = 0;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const bucket = byLine.get(lineIndex);
        if (!bucket) {
            out.push('');
            continue;
        }
        let emittedColumn = 0;
        const segments: string[] = [];
        for (const entry of bucket) {
            segments.push(encodeVlq([entry.column - emittedColumn, 0, entry.line - lastLine, entry.originalColumn - lastColumn]));
            emittedColumn = entry.column;
            lastLine = entry.line;
            lastColumn = entry.originalColumn;
        }
        out.push(segments.join(','));
    }
    return JSON.stringify({ version: 3, file: parsed.file ?? 'script.js', sources: [file], names: [], mappings: out.join(';') });
}
const MAX_GAP = 40;
export function shiftGeneratedLines(json: string, lines: number): string {
    if (lines <= 0)
        return json;
    const parsed = JSON.parse(json) as {
        mappings?: string;
    };
    parsed.mappings = ';'.repeat(lines) + (parsed.mappings ?? '');
    return JSON.stringify(parsed);
}
function decodeVlq(segment: string): number[] {
    const values: number[] = [];
    let value = 0;
    let shift = 0;
    for (const char of segment) {
        const digit = BASE64_VALUES.get(char);
        if (digit === undefined)
            throw new Error(`caractere inválido no source map: "${char}".`);
        value += (digit & 31) << shift;
        if (digit & 32) {
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
function encodeVlq(values: readonly number[]): string {
    let out = '';
    for (const value of values) {
        let vlq = value < 0 ? (-value << 1) | 1 : value << 1;
        do {
            let digit = vlq & 31;
            vlq >>>= 5;
            if (vlq > 0)
                digit |= 32;
            out += BASE64[digit];
        } while (vlq > 0);
    }
    return out;
}
