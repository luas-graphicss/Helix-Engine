import type { ProjectDatabase } from '@/engine/core/storage/project-database';
import type { AssetLibrary } from '@/engine/assets/library/asset-library';
import type { MaterialLibrary } from '@/engine/materials/material-library';
import type { ProjectRecord } from './project-record';
import type { ProjectRegistry } from './project-registry';
import type { SceneStore } from './scene-store';
export interface ProjectContext {
    readonly id: string;
    readonly registry: ProjectRegistry;
    readonly database: ProjectDatabase;
    readonly scenes: SceneStore;
    readonly materials: MaterialLibrary;
    readonly library: AssetLibrary;
}
export function projectRecordOf(context: ProjectContext): ProjectRecord | null {
    return context.registry.get(context.id);
}
