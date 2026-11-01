import { ProjectDatabase } from '@/engine/core/storage/project-database';
import type { ProjectRecord } from './project-record';
import { SceneStore, type SceneSnapshotInfo } from './scene-store';
export function sceneSnapshotsKey(projectId: string): readonly [
    string,
    string
] {
    return ['scene-snapshots', projectId];
}
export async function listProjectSnapshots(record: ProjectRecord): Promise<SceneSnapshotInfo[]> {
    const database = new ProjectDatabase(record.databaseName);
    try {
        return await new SceneStore(database).listSnapshots();
    }
    finally {
        await database.close();
    }
}
