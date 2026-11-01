import type { WasmFunctionSignature, WasmValueType } from './helix-abi';
export type WasmExternalKind = 'function' | 'table' | 'memory' | 'global' | 'tag';
export interface WasmImportInfo {
    readonly module: string;
    readonly name: string;
    readonly kind: WasmExternalKind;
    readonly signature: WasmFunctionSignature | null;
}
export interface WasmExportInfo {
    readonly name: string;
    readonly kind: WasmExternalKind;
    readonly signature: WasmFunctionSignature | null;
}
export interface WasmModuleInfo {
    readonly imports: readonly WasmImportInfo[];
    readonly exports: readonly WasmExportInfo[];
}
const SECTION_TYPE = 1;
const SECTION_IMPORT = 2;
const SECTION_FUNCTION = 3;
const SECTION_EXPORT = 7;
const FUNC_TYPE = 0x60;
const KINDS: readonly WasmExternalKind[] = ['function', 'table', 'memory', 'global', 'tag'];
const VALUE_TYPES: Readonly<Record<number, WasmValueType>> = {
    0x7f: 'i32',
    0x7e: 'i64',
    0x7d: 'f32',
    0x7c: 'f64',
    0x7b: 'v128',
    0x70: 'funcref',
    0x6f: 'externref',
};
class ByteReader {
    private offset = 0;
    private readonly decoder = new TextDecoder();
    constructor(private readonly bytes: Uint8Array) { }
    get position(): number {
        return this.offset;
    }
    get done(): boolean {
        return this.offset >= this.bytes.length;
    }
    seek(position: number): void {
        this.offset = position;
    }
    byte(): number {
        if (this.offset >= this.bytes.length)
            throw new RangeError('fim do módulo');
        return this.bytes[this.offset++];
    }
    u32(): number {
        let result = 0;
        let shift = 0;
        for (;;) {
            const byte = this.byte();
            result |= (byte & 0x7f) << shift;
            if ((byte & 0x80) === 0)
                return result >>> 0;
            shift += 7;
            if (shift > 35)
                throw new RangeError('LEB128 longo demais');
        }
    }
    skipLeb(): void {
        for (;;)
            if ((this.byte() & 0x80) === 0)
                return;
    }
    name(): string {
        const length = this.u32();
        const slice = this.bytes.subarray(this.offset, this.offset + length);
        this.offset += length;
        return this.decoder.decode(slice);
    }
    valueType(): WasmValueType {
        const code = this.byte();
        const type = VALUE_TYPES[code];
        if (type)
            return type;
        if (code === 0x63 || code === 0x64) {
            this.skipLeb();
            return 'funcref';
        }
        throw new RangeError(`tipo de valor desconhecido 0x${code.toString(16)}`);
    }
    limits(): void {
        const flags = this.byte();
        this.skipLeb();
        if (flags & 0x01)
            this.skipLeb();
    }
}
type TypeTable = ReadonlyArray<WasmFunctionSignature | null>;
function readTypes(reader: ByteReader, end: number): TypeTable {
    const types: Array<WasmFunctionSignature | null> = [];
    const count = reader.u32();
    for (let index = 0; index < count && reader.position < end; index++) {
        const form = reader.byte();
        if (form !== FUNC_TYPE) {
            types.push(null);
            reader.seek(end);
            break;
        }
        const params: WasmValueType[] = [];
        const results: WasmValueType[] = [];
        const paramCount = reader.u32();
        for (let p = 0; p < paramCount; p++)
            params.push(reader.valueType());
        const resultCount = reader.u32();
        for (let r = 0; r < resultCount; r++)
            results.push(reader.valueType());
        types.push({ params, results });
    }
    return types;
}
function readImports(reader: ByteReader, end: number, types: TypeTable): WasmImportInfo[] {
    const imports: WasmImportInfo[] = [];
    const count = reader.u32();
    for (let index = 0; index < count && reader.position < end; index++) {
        const module = reader.name();
        const name = reader.name();
        const kind = reader.byte();
        switch (kind) {
            case 0x00: {
                const typeIndex = reader.u32();
                imports.push({ module, name, kind: 'function', signature: types[typeIndex] ?? null });
                break;
            }
            case 0x01:
                reader.valueType();
                reader.limits();
                imports.push({ module, name, kind: 'table', signature: null });
                break;
            case 0x02:
                reader.limits();
                imports.push({ module, name, kind: 'memory', signature: null });
                break;
            case 0x03:
                reader.valueType();
                reader.byte();
                imports.push({ module, name, kind: 'global', signature: null });
                break;
            case 0x04:
                reader.byte();
                reader.u32();
                imports.push({ module, name, kind: 'tag', signature: null });
                break;
            default:
                return imports;
        }
    }
    return imports;
}
function readFunctionTypes(reader: ByteReader, end: number): number[] {
    const indices: number[] = [];
    const count = reader.u32();
    for (let index = 0; index < count && reader.position < end; index++)
        indices.push(reader.u32());
    return indices;
}
function readExports(reader: ByteReader, end: number, types: TypeTable, functionSpace: ReadonlyArray<WasmFunctionSignature | null>): WasmExportInfo[] {
    const exports: WasmExportInfo[] = [];
    const count = reader.u32();
    for (let index = 0; index < count && reader.position < end; index++) {
        const name = reader.name();
        const kind = KINDS[reader.byte()];
        const target = reader.u32();
        if (!kind)
            return exports;
        exports.push({ name, kind, signature: kind === 'function' ? (functionSpace[target] ?? null) : null });
    }
    void types;
    return exports;
}
export function readWasmModuleInfo(binary: Uint8Array): WasmModuleInfo {
    const empty: WasmModuleInfo = { imports: [], exports: [] };
    if (binary.length < 8 || binary[0] !== 0x00 || binary[1] !== 0x61 || binary[2] !== 0x73 || binary[3] !== 0x6d)
        return empty;
    const reader = new ByteReader(binary);
    reader.seek(8);
    let types: TypeTable = [];
    let imports: WasmImportInfo[] = [];
    let functionTypes: number[] = [];
    let exports: WasmExportInfo[] = [];
    try {
        while (!reader.done) {
            const id = reader.byte();
            const size = reader.u32();
            const start = reader.position;
            const end = start + size;
            if (id === SECTION_TYPE)
                types = readTypes(reader, end);
            else if (id === SECTION_IMPORT)
                imports = readImports(reader, end, types);
            else if (id === SECTION_FUNCTION)
                functionTypes = readFunctionTypes(reader, end);
            else if (id === SECTION_EXPORT) {
                const functionSpace = [...imports.filter((entry) => entry.kind === 'function').map((entry) => entry.signature), ...functionTypes.map((typeIndex) => types[typeIndex] ?? null)];
                exports = readExports(reader, end, types, functionSpace);
                break;
            }
            reader.seek(end);
        }
    }
    catch {
        return { imports, exports };
    }
    return { imports, exports };
}
