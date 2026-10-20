import { createFbxNode, normalizeObjectName, type FbxNode, type FbxValue } from './fbx-node';
const BINARY_MAGIC = 'Kaydara FBX Binary  ';
const HEADER_BYTES = 27;
const WIDE_OFFSETS_VERSION = 7500;
const ARRAY_ELEMENT_BYTES: Record<string, number> = { f: 4, d: 8, l: 8, i: 4, b: 1 };
export function isBinaryFbx(buffer: ArrayBuffer): boolean {
    if (buffer.byteLength < HEADER_BYTES)
        return false;
    const head = new Uint8Array(buffer, 0, BINARY_MAGIC.length);
    for (let i = 0; i < BINARY_MAGIC.length; i++)
        if (head[i] !== BINARY_MAGIC.charCodeAt(i))
            return false;
    return true;
}
export function readBinaryFbxVersion(buffer: ArrayBuffer): number {
    return new DataView(buffer).getUint32(23, true);
}
async function inflate(compressed: Uint8Array): Promise<Uint8Array> {
    if (typeof DecompressionStream === 'undefined') {
        throw new Error('Este navegador não consegue descompactar os dados do FBX (DecompressionStream indisponível).');
    }
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}
class BinaryReader {
    offset = 0;
    private readonly view: DataView;
    private readonly bytes: Uint8Array;
    private readonly decoder = new TextDecoder();
    constructor(buffer: ArrayBuffer) {
        this.view = new DataView(buffer);
        this.bytes = new Uint8Array(buffer);
    }
    get length(): number {
        return this.bytes.byteLength;
    }
    uint8(): number {
        return this.view.getUint8(this.offset++);
    }
    int16(): number {
        const value = this.view.getInt16(this.offset, true);
        this.offset += 2;
        return value;
    }
    int32(): number {
        const value = this.view.getInt32(this.offset, true);
        this.offset += 4;
        return value;
    }
    uint32(): number {
        const value = this.view.getUint32(this.offset, true);
        this.offset += 4;
        return value;
    }
    int64(): number | string {
        const value = this.view.getBigInt64(this.offset, true);
        this.offset += 8;
        const asNumber = Number(value);
        return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
    }
    uint64AsNumber(): number {
        const value = this.view.getBigUint64(this.offset, true);
        this.offset += 8;
        return Number(value);
    }
    float32(): number {
        const value = this.view.getFloat32(this.offset, true);
        this.offset += 4;
        return value;
    }
    float64(): number {
        const value = this.view.getFloat64(this.offset, true);
        this.offset += 8;
        return value;
    }
    slice(length: number): Uint8Array {
        const end = Math.min(this.offset + length, this.bytes.byteLength);
        const out = this.bytes.subarray(this.offset, end);
        this.offset = end;
        return out;
    }
    string(length: number): string {
        return this.decoder.decode(this.slice(length));
    }
}
function toTypedArray(type: string, raw: Uint8Array, length: number): FbxValue {
    const elementBytes = ARRAY_ELEMENT_BYTES[type];
    const aligned = raw.byteOffset % elementBytes === 0 ? raw : raw.slice();
    const available = Math.min(length, Math.floor(aligned.byteLength / elementBytes));
    switch (type) {
        case 'f':
            return new Float32Array(aligned.buffer, aligned.byteOffset, available).slice();
        case 'd':
            return new Float64Array(aligned.buffer, aligned.byteOffset, available).slice();
        case 'i':
            return new Int32Array(aligned.buffer, aligned.byteOffset, available).slice();
        case 'l': {
            const wide = new BigInt64Array(aligned.buffer, aligned.byteOffset, available);
            const out = new Float64Array(available);
            for (let i = 0; i < available; i++)
                out[i] = Number(wide[i]);
            return out;
        }
        default:
            return Int32Array.from(aligned.subarray(0, available));
    }
}
async function readArray(reader: BinaryReader, type: string): Promise<FbxValue> {
    const length = reader.uint32();
    const encoding = reader.uint32();
    const byteLength = reader.uint32();
    const stored = reader.slice(byteLength);
    const raw = encoding === 1 ? await inflate(stored) : stored;
    return toTypedArray(type, raw, length);
}
async function readProperty(reader: BinaryReader): Promise<FbxValue> {
    const type = String.fromCharCode(reader.uint8());
    switch (type) {
        case 'Y':
            return reader.int16();
        case 'C':
            return reader.uint8() !== 0;
        case 'I':
            return reader.int32();
        case 'F':
            return reader.float32();
        case 'D':
            return reader.float64();
        case 'L':
            return reader.int64();
        case 'S':
            return normalizeObjectName(reader.string(reader.uint32()));
        case 'R':
            return reader.slice(reader.uint32());
        case 'f':
        case 'd':
        case 'l':
        case 'i':
        case 'b':
            return readArray(reader, type);
        default:
            throw new Error(`Propriedade FBX de tipo desconhecido "${type}" no deslocamento ${reader.offset - 1}.`);
    }
}
async function readNode(reader: BinaryReader, version: number): Promise<FbxNode | null> {
    const wide = version >= WIDE_OFFSETS_VERSION;
    const endOffset = wide ? reader.uint64AsNumber() : reader.uint32();
    const propertyCount = wide ? reader.uint64AsNumber() : reader.uint32();
    const propertyListLength = wide ? reader.uint64AsNumber() : reader.uint32();
    const nameLength = reader.uint8();
    if (endOffset === 0)
        return null;
    if (endOffset > reader.length)
        throw new Error('Arquivo FBX truncado: nó aponta para além do fim dos dados.');
    const node = createFbxNode(reader.string(nameLength));
    const propertiesStart = reader.offset;
    for (let i = 0; i < propertyCount; i++)
        node.props.push(await readProperty(reader));
    reader.offset = propertiesStart + propertyListLength;
    while (reader.offset < endOffset) {
        const child = await readNode(reader, version);
        if (!child)
            break;
        node.children.push(child);
    }
    reader.offset = endOffset;
    return node;
}
export async function parseBinaryFbx(buffer: ArrayBuffer): Promise<{
    root: FbxNode;
    version: number;
}> {
    const version = readBinaryFbxVersion(buffer);
    const reader = new BinaryReader(buffer);
    reader.offset = HEADER_BYTES;
    const root = createFbxNode('');
    while (reader.offset < reader.length) {
        const node = await readNode(reader, version);
        if (!node)
            break;
        root.children.push(node);
    }
    return { root, version };
}
