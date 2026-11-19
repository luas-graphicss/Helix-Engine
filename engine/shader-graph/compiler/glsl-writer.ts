import type { TextureColorSpace } from '@/engine/core/scene/texture';
import type { ShaderModel } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
import type { BuiltinInput, GlslChunk } from '../nodes/node-definition';
import type { SocketType } from '../nodes/socket-types';
export interface TextureUniform {
    readonly kind: 'texture';
    readonly name: string;
    readonly assetId: string | null;
    readonly colorSpace: TextureColorSpace;
}
export interface NumericUniform {
    readonly kind: 'numeric';
    readonly name: string;
    readonly type: SocketType;
    readonly value: readonly number[];
}
export type GraphUniform = TextureUniform | NumericUniform;
export interface BuiltinValue {
    readonly expression: string;
    readonly type: SocketType;
}
const POST_WORLD_POSITION = 'helixWorldPosition(vUv, texture(uSceneDepth, vUv).r)';
const BUILTINS: Record<ShaderModel, Record<BuiltinInput, BuiltinValue>> = {
    surface: {
        uv: { expression: 's.uv', type: 'vec2' },
        normal: { expression: 's.normal', type: 'vec3' },
        worldPosition: { expression: 's.worldPosition', type: 'vec3' },
        viewDirection: { expression: 's.viewDirection', type: 'vec3' },
        time: { expression: 'uTime', type: 'float' },
    },
    post: {
        uv: { expression: 'vUv', type: 'vec2' },
        normal: { expression: 'vec3(0.0, 0.0, 1.0)', type: 'vec3' },
        worldPosition: { expression: POST_WORLD_POSITION, type: 'vec3' },
        viewDirection: { expression: `normalize(uCameraPosition - ${POST_WORLD_POSITION})`, type: 'vec3' },
        time: { expression: 'uTime', type: 'float' },
    },
};
const ENTRY_POINT: Record<ShaderModel, string> = {
    surface: 'void surface(inout HelixSurface s) {',
    post: 'void main() {',
};
function uniformSuffix(key: string): string {
    const cleaned = key
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return cleaned === '' ? 'value' : cleaned;
}
export class GlslWriter {
    readonly uniforms: GraphUniform[] = [];
    animated = false;
    private readonly statements: string[] = [];
    private readonly chunks = new Map<string, string>();
    constructor(private readonly model: ShaderModel) { }
    builtin(name: BuiltinInput): BuiltinValue {
        if (name === 'time')
            this.animated = true;
        return BUILTINS[this.model][name];
    }
    declare(type: SocketType, name: string, expression: string): void {
        this.statements.push(`  ${type} ${name} = ${expression};`);
    }
    statement(line: string): void {
        this.statements.push(`  ${line}`);
    }
    include(chunk: GlslChunk): void {
        if (this.chunks.has(chunk.name))
            return;
        for (const required of chunk.requires ?? [])
            this.include(required);
        this.chunks.set(chunk.name, chunk.source);
    }
    numericUniform(key: string, type: SocketType, value: readonly number[]): string {
        const name = `sg_${type}_${uniformSuffix(key)}`;
        if (!this.uniforms.some((uniform) => uniform.name === name))
            this.uniforms.push({ kind: 'numeric', name, type, value });
        return name;
    }
    textureUniform(assetId: string | null, colorSpace: TextureColorSpace): string {
        const textures = this.uniforms.filter((uniform) => uniform.kind === 'texture');
        const existing = textures.find((uniform) => uniform.assetId === assetId && uniform.colorSpace === colorSpace);
        if (existing)
            return existing.name;
        const name = `sg_texture${textures.length}`;
        this.uniforms.push({ kind: 'texture', name, assetId, colorSpace });
        return name;
    }
    assemble(): string {
        const declarations = this.uniforms.map((uniform) => `uniform ${uniform.kind === 'texture' ? 'sampler2D' : uniform.type} ${uniform.name};`);
        const body = [ENTRY_POINT[this.model], ...this.statements, '}'].join('\n');
        const sections = [declarations.join('\n'), ...this.chunks.values(), body].filter((section) => section !== '');
        return `${sections.join('\n\n')}\n`;
    }
}
