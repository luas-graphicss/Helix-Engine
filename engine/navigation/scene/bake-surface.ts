import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
import { bakeNavMesh } from '../bake/bake-nav-mesh';
import type { NavMesh } from '../mesh/nav-mesh';
import type { NavSurfaceSettings } from '../surface/nav-surface-settings';
import { collectBakeInput } from './collect-bake-input';
export interface NavSurfaceReport {
    readonly surfaceName: string;
    readonly mesh: NavMesh | null;
    readonly milliseconds: number;
    readonly requestedCellSize: number;
}
const DEFAULT_SURFACE_NAME = 'Superfície padrão';
export function bakeSurface(scene: Scene, surface: Entity | null, settings: NavSurfaceSettings): NavSurfaceReport {
    const startedAt = performance.now();
    const mesh = bakeNavMesh(collectBakeInput(scene, surface, settings), settings);
    return { surfaceName: surface?.name ?? DEFAULT_SURFACE_NAME, mesh, milliseconds: performance.now() - startedAt, requestedCellSize: settings.cellSize };
}
