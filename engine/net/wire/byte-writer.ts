import { WireError } from './wire-error';
const INITIAL_CAPACITY = 256;
const VARUINT_RADIX = 0x80;
const encoder = new TextEncoder();
export class ByteWriter {
    private bytes: Uint8Array;
    private view: DataView;
    private offset = 0;
    constructor(capacity = INITIAL_CAPACITY) {
        this.bytes = new Uint8Array(capacity);
        this.view = new DataView(this.bytes.buffer);
    }
    get length(): number {
        return this.offset;
    }
    reset(): this {
        this.offset = 0;
        return this;
    }
    u8(value: number): this {
        const start = this.claim(1);
        this.view.setUint8(start, value);
        return this;
    }
    u16(value: number): this {
        const start = this.claim(2);
        this.view.setUint16(start, value, true);
        return this;
    }
    u32(value: number): this {
        const start = this.claim(4);
        this.view.setUint32(start, value, true);
        return this;
    }
    f32(value: number): this {
        const start = this.claim(4);
        this.view.setFloat32(start, value, true);
        return this;
    }
    f64(value: number): this {
        const start = this.claim(8);
        this.view.setFloat64(start, value, true);
        return this;
    }
    bool(value: boolean): this {
        return this.u8(value ? 1 : 0);
    }
    varuint(value: number): this {
        if (!Number.isSafeInteger(value) || value < 0)
            throw new WireError(`varuint expects a non-negative safe integer, received ${value}`);
        let rest = value;
        while (rest >= VARUINT_RADIX) {
            this.u8((rest % VARUINT_RADIX) + VARUINT_RADIX);
            rest = Math.floor(rest / VARUINT_RADIX);
        }
        return this.u8(rest);
    }
    raw(bytes: Uint8Array): this {
        const start = this.claim(bytes.length);
        this.bytes.set(bytes, start);
        return this;
    }
    block(bytes: Uint8Array): this {
        return this.varuint(bytes.length).raw(bytes);
    }
    string(text: string): this {
        return this.block(encoder.encode(text));
    }
    toBytes(): Uint8Array {
        return this.bytes.slice(0, this.offset);
    }
    private claim(count: number): number {
        const start = this.offset;
        const needed = start + count;
        if (needed > this.bytes.length)
            this.grow(needed);
        this.offset = needed;
        return start;
    }
    private grow(needed: number): void {
        const grown = new Uint8Array(Math.max(needed, this.bytes.length * 2));
        grown.set(this.bytes.subarray(0, this.offset));
        this.bytes = grown;
        this.view = new DataView(grown.buffer);
    }
}
