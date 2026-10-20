import type { GL } from '@/engine/renderer/gl/context';
import { INSTANCE_TEXELS } from '../data/myriad-limits';
import { DataTexture } from './data-texture';
export const INSTANCE_FLOATS = INSTANCE_TEXELS * 4;
export const INSTANCE_WORLD_OFFSET = 0;
export const INSTANCE_PREVIOUS_WORLD_OFFSET = 16;
export const INSTANCE_NORMAL_MATRIX_OFFSET = 32;
export const INSTANCE_BASE_COLOR_OFFSET = 44;
export const INSTANCE_SURFACE_OFFSET = 48;
export const INSTANCE_EMISSIVE_OFFSET = 52;
export const INSTANCE_MAP_PARAMS_OFFSET = 56;
const INITIAL_INSTANCES = 256;
const INITIAL_ENTRIES = 4096;
export class InstanceTable {
    readonly texture: DataTexture;
    data = new Float32Array(INITIAL_INSTANCES * INSTANCE_FLOATS);
    count = 0;
    constructor(gl: GL, readonly width: number) {
        this.texture = new DataTexture(gl, width, 'rgba32f', Math.ceil((INITIAL_INSTANCES * INSTANCE_TEXELS) / width));
    }
    begin(): void {
        this.count = 0;
    }
    allocate(): number {
        const offset = this.count * INSTANCE_FLOATS;
        if (offset + INSTANCE_FLOATS > this.data.length) {
            const grown = new Float32Array(this.data.length * 2);
            grown.set(this.data);
            this.data = grown;
        }
        this.count++;
        return offset;
    }
    upload(): void {
        if (this.count === 0)
            return;
        const texels = this.count * INSTANCE_TEXELS;
        this.texture.ensureRows(Math.ceil(texels / this.width));
        this.texture.upload(0, texels, this.data);
    }
    dispose(): void {
        this.texture.dispose();
    }
}
const ENTRY_WORDS = 20;
const ENTRY_BYTES = ENTRY_WORDS * 4;
export const ENTRY_ATTRIB_IDS = 0;
export const ENTRY_ATTRIB_WORLD = 1;
class EntryStaging {
    words = new Uint32Array(INITIAL_ENTRIES * ENTRY_WORDS);
    floats = new Float32Array(this.words.buffer);
    count = 0;
    reset(): void {
        this.count = 0;
    }
    push(cluster: number, instance: number, state: number, world: Float32Array): void {
        const offset = this.count * ENTRY_WORDS;
        if (offset + ENTRY_WORDS > this.words.length) {
            const grown = new Uint32Array(this.words.length * 2);
            grown.set(this.words);
            this.words = grown;
            this.floats = new Float32Array(grown.buffer);
        }
        this.words[offset] = cluster;
        this.words[offset + 1] = instance;
        this.words[offset + 2] = state;
        this.words[offset + 3] = 0;
        this.floats.set(world, offset + 4);
        this.count++;
    }
}
export class EntryList {
    readonly texture: DataTexture;
    readonly buffer: WebGLBuffer;
    readonly vao: WebGLVertexArrayObject;
    count = 0;
    doubleSidedStart = 0;
    private readonly singleSided = new EntryStaging();
    private readonly doubleSided = new EntryStaging();
    private merged = new Uint32Array(INITIAL_ENTRIES * ENTRY_WORDS);
    private texels = new Uint32Array(INITIAL_ENTRIES * 4);
    private boundFirst = -1;
    constructor(private readonly gl: GL, readonly width: number) {
        this.texture = new DataTexture(gl, width, 'rgba32ui', Math.ceil(INITIAL_ENTRIES / width));
        const buffer = gl.createBuffer();
        const vao = gl.createVertexArray();
        if (!buffer || !vao)
            throw new Error('Não foi possível alocar a lista de clusters.');
        this.buffer = buffer;
        this.vao = vao;
        gl.bindVertexArray(vao);
        gl.enableVertexAttribArray(ENTRY_ATTRIB_IDS);
        gl.vertexAttribDivisor(ENTRY_ATTRIB_IDS, 1);
        for (let column = 0; column < 4; column++) {
            gl.enableVertexAttribArray(ENTRY_ATTRIB_WORLD + column);
            gl.vertexAttribDivisor(ENTRY_ATTRIB_WORLD + column, 1);
        }
        this.pointAttributes(0);
        gl.bindVertexArray(null);
    }
    bindRange(first: number): void {
        this.gl.bindVertexArray(this.vao);
        if (first !== this.boundFirst)
            this.pointAttributes(first);
    }
    private pointAttributes(first: number): void {
        const { gl } = this;
        const base = first * ENTRY_BYTES;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.vertexAttribIPointer(ENTRY_ATTRIB_IDS, 4, gl.UNSIGNED_INT, ENTRY_BYTES, base);
        for (let column = 0; column < 4; column++) {
            gl.vertexAttribPointer(ENTRY_ATTRIB_WORLD + column, 4, gl.FLOAT, false, ENTRY_BYTES, base + 16 + column * 16);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        this.boundFirst = first;
    }
    begin(): void {
        this.singleSided.reset();
        this.doubleSided.reset();
        this.count = 0;
        this.doubleSidedStart = 0;
    }
    push(cluster: number, instance: number, state: number, world: Float32Array, doubleSided: boolean): void {
        ;
        (doubleSided ? this.doubleSided : this.singleSided).push(cluster, instance, state, world);
    }
    upload(withTexture = true): void {
        const { gl, singleSided, doubleSided } = this;
        this.doubleSidedStart = singleSided.count;
        this.count = singleSided.count + doubleSided.count;
        if (this.count === 0)
            return;
        const wordCount = this.count * ENTRY_WORDS;
        if (this.merged.length < wordCount)
            this.merged = new Uint32Array(Math.max(wordCount, this.merged.length * 2));
        const words = this.merged;
        words.set(singleSided.words.subarray(0, singleSided.count * ENTRY_WORDS));
        words.set(doubleSided.words.subarray(0, doubleSided.count * ENTRY_WORDS), singleSided.count * ENTRY_WORDS);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, words.subarray(0, wordCount), gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        if (!withTexture)
            return;
        if (this.texels.length < this.count * 4)
            this.texels = new Uint32Array(Math.max(this.count * 4, this.texels.length * 2));
        const { texels } = this;
        for (let i = 0; i < this.count; i++) {
            const w = i * ENTRY_WORDS;
            texels[i * 4] = words[w];
            texels[i * 4 + 1] = words[w + 1];
            texels[i * 4 + 2] = words[w + 2];
            texels[i * 4 + 3] = 0;
        }
        this.texture.ensureRows(this.rows);
        this.texture.upload(0, this.count, texels);
    }
    get rows(): number {
        return Math.max(1, Math.ceil(this.count / this.width));
    }
    dispose(): void {
        this.texture.dispose();
        this.gl.deleteBuffer(this.buffer);
        this.gl.deleteVertexArray(this.vao);
    }
}
