import * as mat4 from '@/engine/core/math/mat4';
import * as aabb from '@/engine/core/math/aabb';
import type { Entity } from '@/engine/core/scene/entity';
import { computeWorldBounds } from '@/engine/renderer/geometry/bounds';
import { importModelFile, IMPORT_FORMAT_SUMMARY, partitionImportFiles } from '@/engine/assets/import/import-registry';
import { computeImportStats, type ImportedScene } from '@/engine/assets/import/import-types';
import { DEFAULT_MATERIALIZE_OPTIONS, materializeImportedScene, type MaterializeOptions } from '@/engine/assets/import/import-materializer';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { addEntity } from './entity-operations';
export type ImportPlacement = 'target' | 'origin' | 'keep';
export interface ImportOptions extends MaterializeOptions {
    placement: ImportPlacement;
    frameAfterImport: boolean;
}
export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
    ...DEFAULT_MATERIALIZE_OPTIONS,
    placement: 'target',
    frameAfterImport: true,
};
const LOG_SOURCE = 'Importação';
function describeError(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
export interface ParsedImport {
    scene: ImportedScene;
    file: File;
}
export async function parseImportFiles(session: EditorSession, files: Iterable<File>): Promise<ParsedImport[]> {
    const { models, bundle } = partitionImportFiles(files);
    if (models.length === 0) {
        session.log.warn(LOG_SOURCE, `Nenhum arquivo de modelo reconhecido (formatos aceitos: ${IMPORT_FORMAT_SUMMARY}).`);
        return [];
    }
    const parsed: ParsedImport[] = [];
    for (const file of models) {
        const started = performance.now();
        try {
            const scene = await importModelFile(file, bundle);
            const stats = computeImportStats(scene);
            session.log.info(LOG_SOURCE, `${file.name} lido em ${Math.round(performance.now() - started)} ms: ${stats.meshes} malha(s), ${stats.triangles.toLocaleString('pt-BR')} triângulos, ${stats.materials} material(is), ${stats.textures} textura(s)${stats.missingTextures > 0 ? ` (${stats.missingTextures} ausente(s))` : ''}.`);
            parsed.push({ scene, file });
        }
        catch (cause) {
            session.log.error(LOG_SOURCE, `Falha ao ler "${file.name}": ${describeError(cause)}`);
        }
    }
    return parsed;
}
function updateDetachedMatrices(session: EditorSession, root: Entity): void {
    session.scene.traverse((entity) => {
        entity.transform.updateLocalMatrix();
        if (entity.parent)
            mat4.multiply(entity.worldMatrix, entity.parent.worldMatrix, entity.transform.localMatrix);
        else
            mat4.copy(entity.worldMatrix, entity.transform.localMatrix);
    }, root);
}
function placeRootAt(session: EditorSession, root: Entity, target: ArrayLike<number>): void {
    updateDetachedMatrices(session, root);
    const bounds = computeWorldBounds(session.scene, root);
    if (aabb.isEmpty(bounds))
        return;
    const { position } = root.transform;
    position[0] += target[0] - (bounds.min[0] + bounds.max[0]) / 2;
    position[1] += target[1] - bounds.min[1];
    position[2] += target[2] - (bounds.min[2] + bounds.max[2]) / 2;
}
const WORLD_ORIGIN = [0, 0, 0] as const;
export async function instantiateImportedScene(session: EditorSession, imported: ImportedScene, options: ImportOptions = DEFAULT_IMPORT_OPTIONS): Promise<Entity> {
    const result = await materializeImportedScene(session.scene, imported, options);
    for (const texture of result.textures)
        session.assets.addTexture(texture, imported.sourceFile);
    for (const material of result.materials)
        session.assets.addMaterial(material, imported.sourceFile);
    for (const mesh of result.meshes)
        session.assets.addMesh(mesh.name, mesh.geometry, mesh.material, imported.sourceFile);
    if (options.placement === 'target')
        placeRootAt(session, result.root, session.camera.target);
    else if (options.placement === 'origin')
        placeRootAt(session, result.root, WORLD_ORIGIN);
    addEntity(session, result.root, session.scene.root, `Importar ${result.root.name}`);
    if (options.frameAfterImport)
        session.focusSelected();
    const stats = computeImportStats(imported);
    const excluded = options.excludedMeshes.size;
    session.log.info(LOG_SOURCE, `${imported.sourceFile} importado: ${stats.nodes} nó(s), ${stats.meshes - excluded} malha(s)${excluded > 0 ? ` (${excluded} omitida(s))` : ''}, ${stats.materials} material(is), ${result.textures.length} textura(s).`);
    for (const note of result.notes)
        session.log.info(LOG_SOURCE, `${imported.sourceFile}: ${note}`);
    for (const warning of imported.warnings)
        session.log.warn(LOG_SOURCE, `${imported.sourceFile}: ${warning}`);
    if (result.missingTextures > 0) {
        session.log.warn(LOG_SOURCE, `${result.missingTextures} textura(s) sem imagem; vincule-as pelo inspetor ou reimporte com os arquivos juntos.`);
    }
    return result.root;
}
