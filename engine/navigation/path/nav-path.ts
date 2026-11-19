import type { Vec3 } from '@/engine/core/math/vec3';
import type { NavLinkEdge } from '../mesh/nav-link';
export type NavPathStatus = 'complete' | 'partial' | 'invalid';
export interface NavPath {
    readonly status: NavPathStatus;
    readonly corners: readonly Vec3[];
    readonly links: readonly (NavLinkEdge | null)[];
    readonly length: number;
}
export const INVALID_PATH: NavPath = { status: 'invalid', corners: [], links: [], length: 0 };
