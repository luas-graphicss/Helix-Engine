import { DEFAULT_LIFETIME_SECONDS } from '../blocks/catalog/attribute-blocks';
import { SIMULATION_HELPERS } from '../glsl/simulation-chunks.glsl';
export interface SimulationShaderParts {
    readonly declarations: string;
    readonly initialize: readonly string[];
    readonly beforeMotion: readonly string[];
    readonly afterMotion: readonly string[];
}
const BLOCK_INDENT = '        ';
export function indentBlocks(blocks: readonly string[], indent: string): string {
    return blocks
        .flatMap((block) => block.split('\n'))
        .map((line) => `${indent}${line}`)
        .join('\n');
}
export function writeSimulationShader({ declarations, initialize, beforeMotion, afterMotion }: SimulationShaderParts): string {
    return `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec4 a_positionAge;
layout(location = 1) in vec4 a_velocityLife;
layout(location = 2) in vec4 a_color;
layout(location = 3) in vec4 a_shape;
out vec4 v_positionAge;
out vec4 v_velocityLife;
out vec4 v_color;
out vec4 v_shape;
uniform float u_delta;
uniform float u_time;
uniform int u_capacity;
uniform int u_spawnStart;
uniform int u_spawnCount;
uniform uint u_spawnSerial;
${declarations}
${SIMULATION_HELPERS}
void main() {
    vec3 position = a_positionAge.xyz;
    float age = a_positionAge.w;
    vec3 velocity = a_velocityLife.xyz;
    float lifetime = a_velocityLife.w;
    vec4 color = a_color;
    float size = a_shape.x;
    float rotation = a_shape.y;
    float spin = a_shape.z;
    float seed = a_shape.w;
    float dt = u_delta;
    float time = u_time;
    int slot = gl_VertexID - u_spawnStart;
    if (slot < 0)
        slot += u_capacity;
    if (slot < u_spawnCount) {
        g_seed = vfxHash(uint(gl_VertexID) ^ vfxHash(u_spawnSerial));
        position = vec3(0.0);
        velocity = vec3(0.0);
        lifetime = ${DEFAULT_LIFETIME_SECONDS.toFixed(1)};
        color = vec4(1.0);
        size = 0.1;
        rotation = 0.0;
        spin = 0.0;
        seed = vfxRand(0u);
${indentBlocks(initialize, BLOCK_INDENT)}
        age = dt * float(slot) / float(u_spawnCount);
        position += velocity * age;
    }
    else if (age < lifetime) {
        g_seed = vfxHash(floatBitsToUint(seed) ^ vfxHash(u_spawnSerial));
${indentBlocks(beforeMotion, BLOCK_INDENT)}
        position += velocity * dt;
        rotation += spin * dt;
        age += dt;
${indentBlocks(afterMotion, BLOCK_INDENT)}
    }
    v_positionAge = vec4(position, age);
    v_velocityLife = vec4(velocity, lifetime);
    v_color = color;
    v_shape = vec4(size, rotation, spin, seed);
}
`;
}
