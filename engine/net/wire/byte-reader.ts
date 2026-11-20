import { WireError } from './wire-error';
const VARUINT_RADIX = 0x80;
const MAX_VARUINT_BYTES = 8;
const decoder = new TextDecoder('utf-8', { fatal: true });
export class ByteReader {
    private readonly view: DataView;
    private offset = 0;
    constructor(private readonly bytes: Uint8Array) {
        this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    }
    get remaining(): number {
        return this.bytes.length - this.offset;
    }
    u8(): number {
        return this.view.getUint8(this.claim(1));
    }
    u16(): number {
        return this.view.getUint16(this.claim(2), true);
    }
    u32(): number {
        return this.view.getUint32(this.claim(4), true);
    }
    f32(): number {
        return this.view.getFloat32(this.claim(4), true);
    }
    f64(): number {
        return this.view.getFloat64(this.claim(8), true);
    }
    bool(): boolean {
        return this.u8() !== 0;
    }
    varuint(): number {
        let value = 0;
        let scale = 1;
        for (let index = 0; index < MAX_VARUINT_BYTES; index++) {
            const byte = this.u8();
            value += (byte % VARUINT_RADIX) * scale;
            if (byte < VARUINT_RADIX)
                return value;
            scale *= VARUINT_RADIX;
        }
        throw new WireError(`varuint is longer than ${MAX_VARUINT_BYTES} bytes`);
    }
    raw(count: number): Uint8Array {
        const start = this.claim(count);
        return this.bytes.subarray(start, start + count);
    }
    block(maxBytes: number): Uint8Array {
        const length = this.varuint();
        if (length > maxBytes)
            throw new WireError(`block of ${length} bytes exceeds the ${maxBytes} byte limit`);
        return this.raw(length);
    }
    string(maxBytes: number): string {
        const encoded = this.block(maxBytes);
        try {
            return decoder.decode(encoded);
        }
        catch (cause) {
            throw new WireError('string is not valid UTF-8', { cause });
        }
    }
    private claim(count: number): number {
        if (count < 0 || count > this.remaining)
            throw new WireError(`read of ${count} bytes passes the end of the message`);
        const start = this.offset;
        this.offset += count;
        return start;
    }
}
