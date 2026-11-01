export interface WasmFrame {
    readonly functionIndex: number;
    readonly name: string;
    readonly offset: number;
}
export function readFunctionNames(bytes: Uint8Array): Map<number, string> {
    const names = new Map<number, string>();
    if (bytes.length < 8)
        return names;
    const decoder = new TextDecoder();
    let offset = 8;
    const readVarUint = () => {
        let result = 0;
        let shift = 0;
        for (;;) {
            const byte = bytes[offset++];
            result |= (byte & 0x7f) << shift;
            if ((byte & 0x80) === 0)
                break;
            shift += 7;
        }
        return result >>> 0;
    };
    while (offset < bytes.length) {
        const id = bytes[offset++];
        const size = readVarUint();
        const end = offset + size;
        if (id === 0) {
            const nameLength = readVarUint();
            const sectionName = decoder.decode(bytes.subarray(offset, offset + nameLength));
            offset += nameLength;
            if (sectionName === 'name') {
                while (offset < end) {
                    const subsection = bytes[offset++];
                    const subsectionSize = readVarUint();
                    const subsectionEnd = offset + subsectionSize;
                    if (subsection === 1) {
                        const count = readVarUint();
                        for (let i = 0; i < count; i++) {
                            const index = readVarUint();
                            const length = readVarUint();
                            names.set(index, decoder.decode(bytes.subarray(offset, offset + length)));
                            offset += length;
                        }
                    }
                    offset = subsectionEnd;
                }
            }
        }
        offset = end;
    }
    return names;
}
export function countFunctionImports(module: WebAssembly.Module): number {
    return WebAssembly.Module.imports(module).filter((entry) => entry.kind === 'function').length;
}
export function demangle(symbol: string): string {
    if (!symbol.startsWith('_Z'))
        return symbol;
    let position = 2;
    const parts: string[] = [];
    const readSourceName = (): string | null => {
        let length = 0;
        let digits = 0;
        while (position < symbol.length && symbol[position] >= '0' && symbol[position] <= '9') {
            length = length * 10 + (symbol.charCodeAt(position) - 48);
            position++;
            digits++;
        }
        if (digits === 0 || length === 0 || position + length > symbol.length)
            return null;
        const name = symbol.slice(position, position + length);
        position += length;
        return name;
    };
    const skipQualifiers = () => {
        while (position < symbol.length && 'KVrL'.includes(symbol[position]))
            position++;
    };
    skipQualifiers();
    if (symbol[position] === 'N') {
        position++;
        skipQualifiers();
        while (position < symbol.length && symbol[position] !== 'E') {
            const char = symbol[position];
            if (char >= '0' && char <= '9') {
                const name = readSourceName();
                if (name === null)
                    break;
                parts.push(name);
            }
            else if (char === 'C') {
                position += 2;
                parts.push(parts[parts.length - 1] ?? 'construtor');
            }
            else if (char === 'D') {
                position += 2;
                parts.push(`~${parts[parts.length - 1] ?? 'destrutor'}`);
            }
            else if (char === 'I') {
                skipTemplateArgs();
            }
            else if (char === 'S') {
                position = symbol.indexOf('_', position) + 1;
                if (position === 0)
                    break;
                parts.push('std');
            }
            else {
                break;
            }
        }
    }
    else if (symbol[position] >= '0' && symbol[position] <= '9') {
        const name = readSourceName();
        if (name)
            parts.push(name);
    }
    else if (symbol.startsWith('St', position)) {
        position += 2;
        const name = readSourceName();
        parts.push('std', name ?? '?');
    }
    return parts.length > 0 ? parts.join('::') : symbol;
    function skipTemplateArgs() {
        let depth = 0;
        while (position < symbol.length) {
            const char = symbol[position++];
            if (char === 'I')
                depth++;
            else if (char === 'E') {
                depth--;
                if (depth === 0)
                    return;
            }
        }
    }
}
const WASM_FRAME = /wasm-function\[(\d+)\]:(0x[0-9a-f]+|\d+)/i;
const INTERNAL_FRAME = /^(__|hx_|_ZN5helix|_ZNK5helix|_ZNSt|_ZNKSt|_ZSt|_ZNS|std::|helix::|dummy$|out$|pad$|fmt_|printf_core$|getint$|pop_arg$|vfprintf$|vprintf$|fprintf$|printf$|sprintf$|snprintf$|vsnprintf$|vsprintf$|puts$|putchar$|fputs$|fputc$|putc$|fwrite$|fflush$|write$|writev$|abort$|raise$|exit$|_Exit$|assert_fail|__assert|strlen$|memcpy$|memset$|malloc$|free$|calloc$|realloc$|operator new|operator delete|_Znwm$|_Znam$|_ZdlPv|_ZdaPv|wasm-function)/;
export function wasmFrames(stack: string | undefined, names: ReadonlyMap<number, string>): WasmFrame[] {
    if (!stack)
        return [];
    const frames: WasmFrame[] = [];
    for (const line of stack.split('\n')) {
        const match = WASM_FRAME.exec(line);
        if (!match)
            continue;
        const functionIndex = Number(match[1]);
        const offset = Number(match[2]);
        const fromSection = names.get(functionIndex);
        const label = /^\s*at\s+(\S+)\s+\(/.exec(line)?.[1] ?? /^([^@]+)@/.exec(line)?.[1] ?? null;
        const name = fromSection ?? (label && !label.includes('wasm') ? label : `função #${functionIndex}`);
        frames.push({ functionIndex, name, offset });
    }
    return frames;
}
export function scriptFrame(frames: readonly WasmFrame[]): WasmFrame | null {
    for (const frame of frames) {
        if (INTERNAL_FRAME.test(frame.name))
            continue;
        return frame;
    }
    return null;
}
export function formatWasmTrace(frames: readonly WasmFrame[], file: string): string {
    const lines: string[] = [];
    for (const frame of frames) {
        if (INTERNAL_FRAME.test(frame.name) && lines.length === 0)
            continue;
        lines.push(`  em ${demangle(frame.name)} (${file}+0x${frame.offset.toString(16)})`);
        if (lines.length >= 12)
            break;
    }
    return lines.join('\n');
}
