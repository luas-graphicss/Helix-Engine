import type { TextureColorSpace } from '@/engine/core/scene/texture';
import type { ShaderModel } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
import type { SocketKind, SocketType } from './socket-types';
export type NodeCategory = 'input' | 'texture' | 'math' | 'vector' | 'uv' | 'procedural' | 'shading' | 'effect' | 'post' | 'output';
export type BuiltinInput = 'uv' | 'normal' | 'worldPosition' | 'viewDirection' | 'time';
export interface InputSocket {
    readonly id: string;
    readonly label: string;
    readonly type: SocketKind;
    readonly fallback?: readonly number[];
    readonly builtin?: BuiltinInput;
    readonly color?: boolean;
    readonly connectOnly?: boolean;
}
export interface OutputSocket {
    readonly id: string;
    readonly label: string;
    readonly type: SocketKind;
}
export interface SelectOption {
    readonly value: string;
    readonly label: string;
}
export interface NumberParam {
    readonly kind: 'number';
    readonly id: string;
    readonly label: string;
    readonly fallback: number;
}
export interface ColorParam {
    readonly kind: 'color';
    readonly id: string;
    readonly label: string;
    readonly fallback: readonly number[];
}
export interface VectorParam {
    readonly kind: 'vector';
    readonly id: string;
    readonly label: string;
    readonly fallback: readonly number[];
}
export interface SelectParam {
    readonly kind: 'select';
    readonly id: string;
    readonly label: string;
    readonly options: readonly SelectOption[];
    readonly fallback: string;
}
export interface TextureParam {
    readonly kind: 'texture';
    readonly id: string;
    readonly label: string;
}
export interface TextParam {
    readonly kind: 'text';
    readonly id: string;
    readonly label: string;
    readonly fallback: string;
}
export type NodeParam = NumberParam | ColorParam | VectorParam | SelectParam | TextureParam | TextParam;
export interface GlslChunk {
    readonly name: string;
    readonly source: string;
    readonly requires?: readonly GlslChunk[];
}
export interface NodeEmitContext {
    readonly model: ShaderModel;
    readonly resolvedType: SocketType;
    input(id: string): string;
    number(id: string): number;
    text(id: string): string;
    components(id: string): readonly number[];
    builtin(name: BuiltinInput): string;
    local(type: SocketType, expression: string): string;
    numericUniform(key: string, type: SocketType, value: readonly number[]): string;
    textureUniform(assetId: string | null, colorSpace: TextureColorSpace): string;
    include(chunk: GlslChunk): void;
}
export interface NodeDefinition {
    readonly type: string;
    readonly label: string;
    readonly category: NodeCategory;
    readonly description: string;
    readonly models?: readonly ShaderModel[];
    readonly inputs: readonly InputSocket[];
    readonly outputs: readonly OutputSocket[];
    readonly params?: readonly NodeParam[];
    emit(context: NodeEmitContext): Readonly<Record<string, string>>;
}
