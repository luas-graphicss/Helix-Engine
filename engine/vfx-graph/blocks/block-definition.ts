import type { ContextKind } from '../document/effect-document';
export const BLOCK_CATEGORIES = ['emission', 'shape', 'attribute', 'velocity', 'force', 'collision', 'appearance'] as const;
export type BlockCategory = (typeof BLOCK_CATEGORIES)[number];
export const GRADIENT_STOPS = 4;
export const GRADIENT_STOP_FLOATS = 5;
interface ParamBase {
    readonly id: string;
    readonly label: string;
    readonly hint?: string;
}
export interface NumberParam extends ParamBase {
    readonly kind: 'number';
    readonly fallback: number;
    readonly min?: number;
    readonly max?: number;
    readonly unit?: string;
}
export interface RangeParam extends ParamBase {
    readonly kind: 'range';
    readonly fallback: readonly [number, number];
    readonly unit?: string;
}
export interface VectorParam extends ParamBase {
    readonly kind: 'vector';
    readonly fallback: readonly [number, number, number];
}
export interface ColorParam extends ParamBase {
    readonly kind: 'color';
    readonly fallback: readonly [number, number, number, number];
}
export interface SelectOption {
    readonly value: string;
    readonly label: string;
}
export interface SelectParam extends ParamBase {
    readonly kind: 'select';
    readonly fallback: string;
    readonly options: readonly SelectOption[];
}
export interface GradientParam extends ParamBase {
    readonly kind: 'gradient';
    readonly fallback: readonly number[];
}
export type BlockParam = NumberParam | RangeParam | VectorParam | ColorParam | SelectParam | GradientParam;
export interface BlockScope {
    uniform(paramId: string): string;
    choice(paramId: string): string;
    gradient(paramId: string, position: string): string;
    salt(): string;
}
export interface BlockDefinition {
    readonly type: string;
    readonly label: string;
    readonly description: string;
    readonly stage: ContextKind;
    readonly category: BlockCategory;
    readonly params: readonly BlockParam[];
    readonly afterMotion?: boolean;
    readonly emit?: (scope: BlockScope) => string;
}
