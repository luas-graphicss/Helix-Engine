import type { ImportedScene } from '@/engine/assets/import/import-types';
import type { Vec3 } from '@/engine/core/math/vec3';
import { summarizeEntity } from '@/engine/editor/assistant/tools/entity-summary';
import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
import { addFilesToLibrary } from '@/engine/editor/operations/asset-library-operations';
import { DEFAULT_IMPORT_OPTIONS, instantiateImportedScene, parseImportFiles, type ImportPlacement } from '@/engine/editor/operations/import-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
export interface ModelInsertion {
    readonly name: string;
    readonly placement: ImportPlacement;
    readonly position: Vec3 | null;
    readonly saveToLibrary: boolean;
}
const DURATION_PRECISION = 100;
function describeRig(scene: ImportedScene): object {
    return {
        skeletons: scene.skins.length,
        joints: scene.skins.reduce((total, skin) => total + skin.joints.length, 0),
        animations: scene.animations.map(({ name, duration }) => ({ name, seconds: Math.round(duration * DURATION_PRECISION) / DURATION_PRECISION })),
    };
}
export async function insertModel(session: EditorSession, files: File[], insertion: ModelInsertion): Promise<object> {
    const [model] = await parseImportFiles(session, files);
    if (!model)
        throw new ToolFailure('The downloaded model could not be read. Call read_console for the reason or try another format.');
    const root = await instantiateImportedScene(session, model.scene, {
        ...DEFAULT_IMPORT_OPTIONS,
        rootName: insertion.name,
        placement: insertion.position ? 'target' : insertion.placement,
        placementPoint: insertion.position,
        frameAfterImport: false,
    });
    if (insertion.saveToLibrary)
        await addFilesToLibrary(session, files, { parsedScenes: new Map([[model.file, model.scene]]) });
    return { entity: summarizeEntity(root), ...describeRig(model.scene) };
}
