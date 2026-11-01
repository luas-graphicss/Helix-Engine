import type { Texture } from '@/engine/core/scene/texture';
import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { GL } from '@/engine/renderer/gl/context';
import { reflectUniformBlocks, reflectUniforms, type ReflectedUniform } from '@/engine/renderer/gl/program-reflection';
import type { StandardShaderInput } from './custom-shader.glsl';
import { isSamplerType, type CompiledShaderBundle } from './shader-bundle';
import type { ShaderUniformValue, ShaderUniformValues } from './shader-values';
export interface StandardShaderInputs {
    time: number;
    delta: number;
    width: number;
    height: number;
    near: number;
    far: number;
    readonly view: Float32Array;
    readonly projection: Float32Array;
    readonly viewProjection: Float32Array;
    readonly inverseViewProjection: Float32Array;
    readonly cameraPosition: Float32Array;
    readonly sunDirection: Float32Array;
    readonly sunColor: Float32Array;
    sceneColor: WebGLTexture | null;
    sceneDepth: WebGLTexture | null;
}
export function createStandardShaderInputs(): StandardShaderInputs {
    return {
        time: 0,
        delta: 0,
        width: 1,
        height: 1,
        near: 0.05,
        far: 500,
        view: mat4.create(),
        projection: mat4.create(),
        viewProjection: mat4.create(),
        inverseViewProjection: mat4.create(),
        cameraPosition: vec3.create(),
        sunDirection: vec3.create(0, 1, 0),
        sunColor: vec3.create(),
        sceneColor: null,
        sceneDepth: null,
    };
}
export type TextureResolver = (texture: Texture) => WebGLTexture | null;
export interface ShaderBinderOptions {
    readonly firstTextureUnit: number;
    readonly textureUnitEnd: number;
    readonly firstBlockBinding: number;
    readonly sceneColorUnit?: number;
    readonly sceneDepthUnit?: number;
    readonly warn?: (message: string) => void;
}
interface BlockBuffer {
    readonly buffer: WebGLBuffer;
    readonly bytes: ArrayBuffer;
    readonly f32: Float32Array;
    readonly i32: Int32Array;
    readonly u32: Uint32Array;
    readonly binding: number;
    dirty: boolean;
}
interface UniformTarget {
    readonly uniform: ReflectedUniform;
    readonly block: BlockBuffer | null;
    readonly textureUnit: number;
}
type Scalar = 'f' | 'i' | 'u' | 'b';
interface TypeShape {
    readonly scalar: Scalar;
    readonly components: number;
    readonly columns: number;
    readonly rows: number;
}
const TYPE_SHAPES: ReadonlyMap<string, TypeShape> = new Map<string, TypeShape>([
    ['float', { scalar: 'f', components: 1, columns: 0, rows: 0 }],
    ['vec2', { scalar: 'f', components: 2, columns: 0, rows: 0 }],
    ['vec3', { scalar: 'f', components: 3, columns: 0, rows: 0 }],
    ['vec4', { scalar: 'f', components: 4, columns: 0, rows: 0 }],
    ['int', { scalar: 'i', components: 1, columns: 0, rows: 0 }],
    ['ivec2', { scalar: 'i', components: 2, columns: 0, rows: 0 }],
    ['ivec3', { scalar: 'i', components: 3, columns: 0, rows: 0 }],
    ['ivec4', { scalar: 'i', components: 4, columns: 0, rows: 0 }],
    ['uint', { scalar: 'u', components: 1, columns: 0, rows: 0 }],
    ['uvec2', { scalar: 'u', components: 2, columns: 0, rows: 0 }],
    ['uvec3', { scalar: 'u', components: 3, columns: 0, rows: 0 }],
    ['uvec4', { scalar: 'u', components: 4, columns: 0, rows: 0 }],
    ['bool', { scalar: 'b', components: 1, columns: 0, rows: 0 }],
    ['bvec2', { scalar: 'b', components: 2, columns: 0, rows: 0 }],
    ['bvec3', { scalar: 'b', components: 3, columns: 0, rows: 0 }],
    ['bvec4', { scalar: 'b', components: 4, columns: 0, rows: 0 }],
    ['mat2', { scalar: 'f', components: 4, columns: 2, rows: 2 }],
    ['mat3', { scalar: 'f', components: 9, columns: 3, rows: 3 }],
    ['mat4', { scalar: 'f', components: 16, columns: 4, rows: 4 }],
    ['mat2x3', { scalar: 'f', components: 6, columns: 2, rows: 3 }],
    ['mat2x4', { scalar: 'f', components: 8, columns: 2, rows: 4 }],
    ['mat3x2', { scalar: 'f', components: 6, columns: 3, rows: 2 }],
    ['mat3x4', { scalar: 'f', components: 12, columns: 3, rows: 4 }],
    ['mat4x2', { scalar: 'f', components: 8, columns: 4, rows: 2 }],
    ['mat4x3', { scalar: 'f', components: 12, columns: 4, rows: 3 }],
]);
export function uniformComponentCount(type: string): number {
    return TYPE_SHAPES.get(type)?.components ?? 0;
}
export function flattenUniformValue(value: ShaderUniformValue): number[] | null {
    if (typeof value === 'number')
        return [value];
    if (typeof value === 'boolean')
        return [value ? 1 : 0];
    if (typeof value !== 'object' || value === null)
        return null;
    if (ArrayBuffer.isView(value))
        return Array.from(value as unknown as ArrayLike<number>);
    if (!('length' in value))
        return null;
    const out: number[] = [];
    const list = value as ArrayLike<unknown>;
    for (let index = 0; index < list.length; index++) {
        const item = list[index];
        if (typeof item === 'number')
            out.push(item);
        else if (typeof item === 'boolean')
            out.push(item ? 1 : 0);
        else if (typeof item === 'object' && item !== null) {
            const nested = flattenUniformValue(item as ShaderUniformValue);
            if (!nested)
                return null;
            out.push(...nested);
        }
        else
            return null;
    }
    return out;
}
function isTexture(value: unknown): value is Texture {
    const candidate = value as Texture;
    return typeof candidate === 'object' && candidate !== null && typeof candidate.id === 'number' && 'colorSpace' in candidate && 'version' in candidate;
}
export class ShaderUniformBinder {
    private readonly targets = new Map<string, UniformTarget>();
    private readonly blocks: BlockBuffer[] = [];
    private readonly warned = new Set<string>();
    private lastValuesVersion = -1;
    private lastValues: ShaderUniformValues | null = null;
    private readonly scratch = new Float32Array(16);
    constructor(private readonly gl: GL, program: WebGLProgram, private readonly bundle: CompiledShaderBundle, private readonly options: ShaderBinderOptions) {
        const blocksByIndex = new Map<number, BlockBuffer>();
        for (const block of reflectUniformBlocks(gl, program)) {
            const buffer = gl.createBuffer();
            if (!buffer)
                throw new Error('Não foi possível alocar o buffer de uniformes do shader.');
            const bytes = new ArrayBuffer(Math.max(16, block.dataSize));
            const binding = options.firstBlockBinding + this.blocks.length;
            gl.bindBuffer(gl.UNIFORM_BUFFER, buffer);
            gl.bufferData(gl.UNIFORM_BUFFER, bytes.byteLength, gl.DYNAMIC_DRAW);
            gl.uniformBlockBinding(program, block.index, binding);
            const entry: BlockBuffer = { buffer, bytes, f32: new Float32Array(bytes), i32: new Int32Array(bytes), u32: new Uint32Array(bytes), binding, dirty: true };
            this.blocks.push(entry);
            blocksByIndex.set(block.index, entry);
        }
        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
        const fixedUnits = new Map<string, number>();
        if (options.sceneColorUnit !== undefined && bundle.standard.sceneColor)
            fixedUnits.set(bundle.standard.sceneColor, options.sceneColorUnit);
        if (options.sceneDepthUnit !== undefined && bundle.standard.sceneDepth)
            fixedUnits.set(bundle.standard.sceneDepth, options.sceneDepthUnit);
        let nextUnit = options.firstTextureUnit;
        for (const uniform of reflectUniforms(gl, program)) {
            let textureUnit = -1;
            if (isSamplerType(uniform.type)) {
                const fixed = fixedUnits.get(uniform.baseName);
                if (fixed !== undefined)
                    textureUnit = fixed;
                else if (nextUnit < options.textureUnitEnd)
                    textureUnit = nextUnit++;
                else
                    this.warnOnce(`${bundle.name}: sem unidade de textura livre para "${uniform.baseName}"; o passe permite ${options.textureUnitEnd - options.firstTextureUnit} texturas próprias.`);
            }
            this.targets.set(uniform.baseName, { uniform, block: uniform.blockIndex === -1 ? null : (blocksByIndex.get(uniform.blockIndex) ?? null), textureUnit });
        }
    }
    bind(inputs: StandardShaderInputs, values: ShaderUniformValues, resolveTexture: TextureResolver, fallback: WebGLTexture): void {
        const { gl, bundle } = this;
        for (const [input, glslName] of Object.entries(bundle.standard) as Array<[
            StandardShaderInput,
            string
        ]>) {
            const target = this.targets.get(glslName);
            if (target)
                this.writeStandard(target, input, inputs, fallback);
        }
        const valuesChanged = values !== this.lastValues || values.version !== this.lastValuesVersion;
        this.lastValues = values;
        this.lastValuesVersion = values.version;
        const bound = new Set<string>();
        for (const [key, value] of values.entries()) {
            const target = this.targets.get(key);
            if (!target)
                continue;
            bound.add(key);
            if (target.textureUnit >= 0 || target.block === null || valuesChanged)
                this.writeValue(target, value, resolveTexture, fallback);
        }
        for (const target of this.targets.values()) {
            if (target.textureUnit < 0 || bound.has(target.uniform.baseName) || bundle.standard.sceneColor === target.uniform.baseName || bundle.standard.sceneDepth === target.uniform.baseName)
                continue;
            this.bindTexture(target, fallback);
        }
        for (const block of this.blocks) {
            gl.bindBufferBase(gl.UNIFORM_BUFFER, block.binding, block.buffer);
            if (!block.dirty)
                continue;
            gl.bufferSubData(gl.UNIFORM_BUFFER, 0, block.bytes);
            block.dirty = false;
        }
    }
    dispose(): void {
        for (const block of this.blocks)
            this.gl.deleteBuffer(block.buffer);
        this.blocks.length = 0;
        this.targets.clear();
    }
    private writeStandard(target: UniformTarget, input: StandardShaderInput, inputs: StandardShaderInputs, fallback: WebGLTexture): void {
        switch (input) {
            case 'time':
                return this.writeNumbers(target, [inputs.time]);
            case 'delta':
                return this.writeNumbers(target, [inputs.delta]);
            case 'near':
                return this.writeNumbers(target, [inputs.near]);
            case 'far':
                return this.writeNumbers(target, [inputs.far]);
            case 'resolution':
                return this.writeNumbers(target, [inputs.width, inputs.height]);
            case 'view':
                return this.writeNumbers(target, inputs.view);
            case 'projection':
                return this.writeNumbers(target, inputs.projection);
            case 'viewProjection':
                return this.writeNumbers(target, inputs.viewProjection);
            case 'inverseViewProjection':
                return this.writeNumbers(target, inputs.inverseViewProjection);
            case 'cameraPosition':
                return this.writeNumbers(target, inputs.cameraPosition);
            case 'sunDirection':
                return this.writeNumbers(target, inputs.sunDirection);
            case 'sunColor':
                return this.writeNumbers(target, inputs.sunColor);
            case 'sceneColor':
                return this.bindTexture(target, inputs.sceneColor ?? fallback);
            case 'sceneDepth':
                return this.bindTexture(target, inputs.sceneDepth ?? fallback);
        }
    }
    private writeValue(target: UniformTarget, value: ShaderUniformValue, resolveTexture: TextureResolver, fallback: WebGLTexture): void {
        if (target.textureUnit >= 0 || isSamplerType(target.uniform.type)) {
            if (isTexture(value))
                this.bindTexture(target, resolveTexture(value) ?? fallback);
            else
                this.warnOnce(`${this.bundle.name}: "${target.uniform.baseName}" é ${target.uniform.type} e precisa de uma Texture.`);
            return;
        }
        const numbers = flattenUniformValue(value);
        if (!numbers) {
            this.warnOnce(`${this.bundle.name}: o valor de "${target.uniform.baseName}" (${target.uniform.type}) não é numérico.`);
            return;
        }
        this.writeNumbers(target, numbers);
    }
    private bindTexture(target: UniformTarget, handle: WebGLTexture): void {
        if (target.textureUnit < 0 || !target.uniform.location)
            return;
        const { gl } = this;
        gl.activeTexture(gl.TEXTURE0 + target.textureUnit);
        gl.bindTexture(gl.TEXTURE_2D, handle);
        gl.uniform1i(target.uniform.location, target.textureUnit);
    }
    private writeNumbers(target: UniformTarget, numbers: ArrayLike<number>): void {
        const { uniform } = target;
        const shape = TYPE_SHAPES.get(uniform.type);
        if (!shape)
            return;
        const needed = shape.components * uniform.size;
        if (numbers.length < needed) {
            this.warnOnce(`${this.bundle.name}: "${uniform.baseName}" (${uniform.type}${uniform.size > 1 ? `[${uniform.size}]` : ''}) precisa de ${needed} ${needed === 1 ? 'número' : 'números'}; recebeu ${numbers.length}.`);
            return;
        }
        if (target.block)
            this.writeBlock(target.block, uniform, shape, numbers);
        else if (uniform.location)
            this.writeDefault(uniform, shape, numbers, needed);
    }
    private writeDefault(uniform: ReflectedUniform, shape: TypeShape, numbers: ArrayLike<number>, needed: number): void {
        const { gl } = this;
        const location = uniform.location!;
        if (shape.columns > 0) {
            const data = numbers.length === needed && numbers instanceof Float32Array ? numbers : Float32Array.from(Array.prototype.slice.call(numbers, 0, needed));
            switch (uniform.type) {
                case 'mat2':
                    return gl.uniformMatrix2fv(location, false, data);
                case 'mat3':
                    return gl.uniformMatrix3fv(location, false, data);
                case 'mat4':
                    return gl.uniformMatrix4fv(location, false, data);
                case 'mat2x3':
                    return gl.uniformMatrix2x3fv(location, false, data);
                case 'mat2x4':
                    return gl.uniformMatrix2x4fv(location, false, data);
                case 'mat3x2':
                    return gl.uniformMatrix3x2fv(location, false, data);
                case 'mat3x4':
                    return gl.uniformMatrix3x4fv(location, false, data);
                case 'mat4x2':
                    return gl.uniformMatrix4x2fv(location, false, data);
                case 'mat4x3':
                    return gl.uniformMatrix4x3fv(location, false, data);
            }
            return;
        }
        if (shape.scalar === 'f') {
            const data = needed <= 16 ? this.scratch.subarray(0, needed) : new Float32Array(needed);
            for (let index = 0; index < needed; index++)
                data[index] = numbers[index];
            switch (shape.components) {
                case 1:
                    return gl.uniform1fv(location, data);
                case 2:
                    return gl.uniform2fv(location, data);
                case 3:
                    return gl.uniform3fv(location, data);
                default:
                    return gl.uniform4fv(location, data);
            }
        }
        if (shape.scalar === 'u') {
            const data = new Uint32Array(needed);
            for (let index = 0; index < needed; index++)
                data[index] = Math.max(0, Math.trunc(numbers[index])) >>> 0;
            switch (shape.components) {
                case 1:
                    return gl.uniform1uiv(location, data);
                case 2:
                    return gl.uniform2uiv(location, data);
                case 3:
                    return gl.uniform3uiv(location, data);
                default:
                    return gl.uniform4uiv(location, data);
            }
        }
        const data = new Int32Array(needed);
        for (let index = 0; index < needed; index++)
            data[index] = shape.scalar === 'b' ? (numbers[index] ? 1 : 0) : Math.trunc(numbers[index]) | 0;
        switch (shape.components) {
            case 1:
                return gl.uniform1iv(location, data);
            case 2:
                return gl.uniform2iv(location, data);
            case 3:
                return gl.uniform3iv(location, data);
            default:
                return gl.uniform4iv(location, data);
        }
    }
    private writeBlock(block: BlockBuffer, uniform: ReflectedUniform, shape: TypeShape, numbers: ArrayLike<number>): void {
        const elementStride = uniform.size > 1 ? uniform.arrayStride : 0;
        let read = 0;
        for (let element = 0; element < uniform.size; element++) {
            const base = uniform.offset + element * elementStride;
            if (shape.columns > 0) {
                for (let column = 0; column < shape.columns; column++) {
                    const start = (base + column * uniform.matrixStride) >> 2;
                    for (let row = 0; row < shape.rows; row++)
                        block.f32[start + row] = numbers[read++];
                }
                continue;
            }
            const start = base >> 2;
            for (let component = 0; component < shape.components; component++) {
                const value = numbers[read++];
                switch (shape.scalar) {
                    case 'f':
                        block.f32[start + component] = value;
                        break;
                    case 'i':
                        block.i32[start + component] = Math.trunc(value) | 0;
                        break;
                    case 'u':
                        block.u32[start + component] = Math.max(0, Math.trunc(value)) >>> 0;
                        break;
                    case 'b':
                        block.u32[start + component] = value ? 1 : 0;
                        break;
                }
            }
        }
        block.dirty = true;
    }
    private warnOnce(message: string): void {
        if (this.warned.has(message))
            return;
        this.warned.add(message);
        this.options.warn?.(message);
    }
}
