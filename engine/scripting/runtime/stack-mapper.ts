import { originalPositionFor, type DecodedSourceMap } from '../compiler/source-map';
export const SCRIPT_URL_PREFIX = 'helix://scripts/';
export interface RegisteredSource {
    readonly assetId: string;
    readonly file: string;
    readonly sourceMap: DecodedSourceMap | null;
}
export interface MappedFrame {
    readonly functionName: string | null;
    readonly file: string;
    readonly assetId: string | null;
    readonly line: number;
    readonly column: number | null;
    readonly script: boolean;
}
export interface MappedStack {
    readonly frames: readonly MappedFrame[];
    readonly origin: MappedFrame | null;
}
const V8_FRAME = /^\s*at\s+(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/;
const GECKO_FRAME = /^\s*(.*?)@(.+?):(\d+):(\d+)\s*$/;
interface RawFrame {
    functionName: string | null;
    url: string;
    line: number;
    column: number;
}
function parseFrame(text: string): RawFrame | null {
    const v8 = V8_FRAME.exec(text);
    if (v8)
        return { functionName: v8[1]?.trim() || null, url: v8[2], line: Number(v8[3]), column: Number(v8[4]) };
    const gecko = GECKO_FRAME.exec(text);
    if (gecko)
        return { functionName: gecko[1]?.trim() || null, url: gecko[2], line: Number(gecko[3]), column: Number(gecko[4]) };
    return null;
}
function cleanFunctionName(name: string | null): string | null {
    if (!name)
        return null;
    const cleaned = name.replace(/^(async|new)\s+/, '').replace(/^Object\.<anonymous>$/, '').replace(/^eval$/, '').replace(/^Object\./, '');
    return cleaned || null;
}
export class StackMapper {
    private readonly sources = new Map<string, RegisteredSource>();
    private headerLines: number | null = null;
    static sourceUrl(file: string): string {
        return `${SCRIPT_URL_PREFIX}${encodeURI(file)}`;
    }
    register(url: string, source: RegisteredSource): void {
        this.sources.set(url, source);
    }
    unregister(url: string): void {
        this.sources.delete(url);
    }
    clear(): void {
        this.sources.clear();
    }
    sourceOf(url: string): RegisteredSource | null {
        return this.sources.get(url) ?? null;
    }
    private measureHeader(): number {
        if (this.headerLines !== null)
            return this.headerLines;
        let lines = 2;
        try {
            const probe = new Function('require', 'module', 'exports', `throw new Error("probe")\n//# sourceURL=${SCRIPT_URL_PREFIX}__probe__`);
            probe();
        }
        catch (cause) {
            const stack = cause instanceof Error ? (cause.stack ?? '') : '';
            for (const text of stack.split('\n')) {
                const frame = parseFrame(text);
                if (frame && frame.url.includes('__probe__')) {
                    lines = frame.line - 1;
                    break;
                }
            }
        }
        this.headerLines = lines;
        return lines;
    }
    map(stackOrError: string | Error | undefined | null): MappedStack {
        const stack = typeof stackOrError === 'string' ? stackOrError : (stackOrError?.stack ?? '');
        const frames: MappedFrame[] = [];
        const header = this.measureHeader();
        for (const text of stack.split('\n')) {
            const raw = parseFrame(text);
            if (!raw)
                continue;
            const source = this.sources.get(raw.url) ?? this.sources.get(decodeURI(raw.url));
            if (!source) {
                if (raw.url.startsWith(SCRIPT_URL_PREFIX))
                    continue;
                frames.push({ functionName: cleanFunctionName(raw.functionName), file: shortUrl(raw.url), assetId: null, line: raw.line, column: raw.column, script: false });
                continue;
            }
            const generatedLine = raw.line - header;
            const original = source.sourceMap ? originalPositionFor(source.sourceMap, generatedLine, raw.column) : null;
            if (source.sourceMap && !original)
                continue;
            frames.push({
                functionName: cleanFunctionName(raw.functionName),
                file: source.file,
                assetId: source.assetId,
                line: original?.line ?? Math.max(1, generatedLine),
                column: original?.column ?? raw.column,
                script: true,
            });
        }
        return { frames, origin: frames.find((frame) => frame.script) ?? null };
    }
    format(mapped: MappedStack, options: {
        includeEngine?: boolean;
    } = {}): string {
        const lines: string[] = [];
        let hiddenEngine = 0;
        for (const frame of mapped.frames) {
            if (!frame.script && !options.includeEngine) {
                hiddenEngine++;
                continue;
            }
            const where = frame.column !== null ? `${frame.file}:${frame.line}:${frame.column}` : `${frame.file}:${frame.line}`;
            lines.push(frame.functionName ? `  em ${frame.functionName} (${where})` : `  em ${where}`);
        }
        if (hiddenEngine > 0 && lines.length > 0)
            lines.push(`  … ${hiddenEngine} ${hiddenEngine === 1 ? 'quadro da engine' : 'quadros da engine'}`);
        return lines.join('\n');
    }
    callerLocation(skipFunctionNames: readonly string[] = []): MappedFrame | null {
        const mapped = this.map(new Error().stack);
        for (const frame of mapped.frames) {
            if (!frame.script)
                continue;
            if (frame.functionName && skipFunctionNames.includes(frame.functionName))
                continue;
            return frame;
        }
        return null;
    }
}
function shortUrl(url: string): string {
    try {
        const parsed = new URL(url);
        const last = parsed.pathname.split('/').filter(Boolean).pop();
        return last ?? url;
    }
    catch {
        return url;
    }
}
