import { bytesPerElement, typedArrayKind, viewTypedArray, type TypedArray, type TypedArrayKind } from './plain-data';
export interface BinaryRef {
    kind: TypedArrayKind;
    byteOffset: number;
    length: number;
}
const ALIGNMENT = 4;
export class BinaryWriter {
    private readonly chunks: Uint8Array[] = [];
    private byteLength = 0;
    private readonly refs = new Map<TypedArray, BinaryRef>();
    add(array: TypedArray): BinaryRef {
        const existing = this.refs.get(array);
        if (existing)
            return existing;
        const padding = (ALIGNMENT - (this.byteLength % ALIGNMENT)) % ALIGNMENT;
        if (padding > 0) {
            this.chunks.push(new Uint8Array(padding));
            this.byteLength += padding;
        }
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        const ref: BinaryRef = { kind: typedArrayKind(array), byteOffset: this.byteLength, length: array.length };
        this.chunks.push(bytes);
        this.byteLength += bytes.byteLength;
        this.refs.set(array, ref);
        return ref;
    }
    finish(): ArrayBuffer {
        const buffer = new ArrayBuffer(this.byteLength);
        const view = new Uint8Array(buffer);
        let offset = 0;
        for (const chunk of this.chunks) {
            view.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return buffer;
    }
}
export class BinaryReader {
    constructor(private readonly buffer: ArrayBuffer) { }
    read<T extends TypedArray>(ref: BinaryRef): T {
        const end = ref.byteOffset + ref.length * bytesPerElement(ref.kind);
        if (ref.byteOffset < 0 || end > this.buffer.byteLength) {
            throw new Error(`Referência binária fora do bloco (${ref.byteOffset}..${end} de ${this.buffer.byteLength} bytes).`);
        }
        return viewTypedArray(ref.kind, this.buffer, ref.byteOffset, ref.length) as T;
    }
}
