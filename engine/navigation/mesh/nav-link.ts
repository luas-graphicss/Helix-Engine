import type { Vec3 } from '@/engine/core/math/vec3';
export interface NavLinkSource {
    readonly id: number;
    readonly start: Vec3;
    readonly end: Vec3;
    readonly bidirectional: boolean;
    readonly costOverride: number;
    readonly area: number;
}
export interface NavLinkEdge {
    readonly source: NavLinkSource;
    readonly fromPolygon: number;
    readonly toPolygon: number;
    readonly from: Vec3;
    readonly to: Vec3;
}
