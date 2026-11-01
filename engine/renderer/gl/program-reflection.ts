import type { GL } from './context';
export interface ReflectedUniform {
    readonly name: string;
    readonly baseName: string;
    readonly type: string;
    readonly glType: number;
    readonly size: number;
    readonly blockIndex: number;
    readonly offset: number;
    readonly arrayStride: number;
    readonly matrixStride: number;
    readonly location: WebGLUniformLocation | null;
}
export interface ReflectedUniformBlock {
    readonly name: string;
    readonly index: number;
    readonly dataSize: number;
}
const TYPE_KEYS: ReadonlyArray<[
    keyof WebGL2RenderingContext,
    string
]> = [
    ['FLOAT', 'float'],
    ['FLOAT_VEC2', 'vec2'],
    ['FLOAT_VEC3', 'vec3'],
    ['FLOAT_VEC4', 'vec4'],
    ['INT', 'int'],
    ['INT_VEC2', 'ivec2'],
    ['INT_VEC3', 'ivec3'],
    ['INT_VEC4', 'ivec4'],
    ['UNSIGNED_INT', 'uint'],
    ['UNSIGNED_INT_VEC2', 'uvec2'],
    ['UNSIGNED_INT_VEC3', 'uvec3'],
    ['UNSIGNED_INT_VEC4', 'uvec4'],
    ['BOOL', 'bool'],
    ['BOOL_VEC2', 'bvec2'],
    ['BOOL_VEC3', 'bvec3'],
    ['BOOL_VEC4', 'bvec4'],
    ['FLOAT_MAT2', 'mat2'],
    ['FLOAT_MAT3', 'mat3'],
    ['FLOAT_MAT4', 'mat4'],
    ['FLOAT_MAT2x3', 'mat2x3'],
    ['FLOAT_MAT2x4', 'mat2x4'],
    ['FLOAT_MAT3x2', 'mat3x2'],
    ['FLOAT_MAT3x4', 'mat3x4'],
    ['FLOAT_MAT4x2', 'mat4x2'],
    ['FLOAT_MAT4x3', 'mat4x3'],
    ['SAMPLER_2D', 'sampler2D'],
    ['SAMPLER_3D', 'sampler3D'],
    ['SAMPLER_CUBE', 'samplerCube'],
    ['SAMPLER_2D_SHADOW', 'sampler2DShadow'],
    ['SAMPLER_2D_ARRAY', 'sampler2DArray'],
    ['SAMPLER_2D_ARRAY_SHADOW', 'sampler2DArrayShadow'],
    ['SAMPLER_CUBE_SHADOW', 'samplerCubeShadow'],
    ['INT_SAMPLER_2D', 'isampler2D'],
    ['INT_SAMPLER_3D', 'isampler3D'],
    ['INT_SAMPLER_CUBE', 'isamplerCube'],
    ['INT_SAMPLER_2D_ARRAY', 'isampler2DArray'],
    ['UNSIGNED_INT_SAMPLER_2D', 'usampler2D'],
    ['UNSIGNED_INT_SAMPLER_3D', 'usampler3D'],
    ['UNSIGNED_INT_SAMPLER_CUBE', 'usamplerCube'],
    ['UNSIGNED_INT_SAMPLER_2D_ARRAY', 'usampler2DArray'],
];
let typeNames: Map<number, string> | null = null;
export function glslTypeName(gl: GL, glType: number): string {
    if (!typeNames)
        typeNames = new Map(TYPE_KEYS.map(([key, name]) => [gl[key] as number, name]));
    return typeNames.get(glType) ?? `0x${glType.toString(16)}`;
}
export function reflectUniforms(gl: GL, program: WebGLProgram): ReflectedUniform[] {
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    if (count === 0)
        return [];
    const indices = Array.from({ length: count }, (_, index) => index);
    const blockIndices = gl.getActiveUniforms(program, indices, gl.UNIFORM_BLOCK_INDEX) as Int32Array;
    const offsets = gl.getActiveUniforms(program, indices, gl.UNIFORM_OFFSET) as Int32Array;
    const arrayStrides = gl.getActiveUniforms(program, indices, gl.UNIFORM_ARRAY_STRIDE) as Int32Array;
    const matrixStrides = gl.getActiveUniforms(program, indices, gl.UNIFORM_MATRIX_STRIDE) as Int32Array;
    const uniforms: ReflectedUniform[] = [];
    for (let index = 0; index < count; index++) {
        const info = gl.getActiveUniform(program, index);
        if (!info)
            continue;
        const blockIndex = blockIndices[index];
        uniforms.push({
            name: info.name,
            baseName: info.name.endsWith('[0]') ? info.name.slice(0, -3) : info.name,
            type: glslTypeName(gl, info.type),
            glType: info.type,
            size: info.size,
            blockIndex,
            offset: offsets[index],
            arrayStride: arrayStrides[index],
            matrixStride: matrixStrides[index],
            location: blockIndex === -1 ? gl.getUniformLocation(program, info.name) : null,
        });
    }
    return uniforms;
}
export function reflectUniformBlocks(gl: GL, program: WebGLProgram): ReflectedUniformBlock[] {
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORM_BLOCKS) as number;
    const blocks: ReflectedUniformBlock[] = [];
    for (let index = 0; index < count; index++) {
        const name = gl.getActiveUniformBlockName(program, index);
        if (name === null)
            continue;
        blocks.push({ name, index, dataSize: gl.getActiveUniformBlockParameter(program, index, gl.UNIFORM_BLOCK_DATA_SIZE) as number });
    }
    return blocks;
}
