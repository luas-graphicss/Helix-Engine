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
