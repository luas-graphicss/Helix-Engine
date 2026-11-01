import { meshDataToObjFile } from '@/engine/assets/export/obj-exporter';
import { ingestFiles } from '@/engine/assets/library/asset-ingest';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { AddAssetCommand } from '@/engine/editor/commands/asset-library-commands';
import { renderModelThumbnail } from '@/engine/editor/library/model-thumbnail-renderer';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { getTriangleCount, type MeshData } from '@/engine/renderer/geometry/mesh-data';
const LOG_SOURCE = 'Biblioteca';
export async function saveMeshToLibrary(session: EditorSession, mesh: MeshData, name: string): Promise<LibraryAsset> {
    const triangles = getTriangleCount(mesh);
    if (triangles === 0)
        throw new Error('a malha não tem triângulos.');
    const { library } = session;
    library.setBusy(`Salvando ${name}…`);
    try {
        const report = await ingestFiles(library, [meshDataToObjFile(mesh, name)], { renderModel: renderModelThumbnail });
        const duplicate = report.duplicates[0];
        if (duplicate) {
            session.log.info(LOG_SOURCE, `${name} já está na biblioteca como ${duplicate.existing.name}.`);
            return duplicate.existing;
        }
        const added = report.added[0];
        if (!added)
            throw new Error(report.failures[0]?.message ?? 'a malha não pôde ser lida como modelo.');
        session.history.execute(new AddAssetCommand(library, added.snapshot, added.scene));
        const asset = added.snapshot.asset;
        session.log.info(LOG_SOURCE, `${asset.name} salvo na biblioteca (${triangles} ${triangles === 1 ? 'triângulo' : 'triângulos'}).`);
        return asset;
    }
    finally {
        library.setBusy(null);
    }
}
