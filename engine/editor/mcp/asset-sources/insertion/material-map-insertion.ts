import type { Entity } from '@/engine/core/scene/entity';
import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
import { setMaterialScalar, setMaterialTexture } from '@/engine/editor/operations/material-operations';
import { colorSpaceForSlot, importTextureFile } from '@/engine/editor/operations/texture-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { DownloadedFile } from './package-download';
export function requireOwnMaterial(session: EditorSession, entity: Entity): void {
    if (!entity.material)
        throw new ToolFailure(`"${entity.name}" has no material. Textures apply to meshes such as primitives and the meshes of imported models.`);
    const libraryMaterial = session.materials.forMaterial(entity.material);
    if (libraryMaterial)
        throw new ToolFailure(`"${entity.name}" uses the library material "${libraryMaterial.name}", which is edited in the material editor. Pick an entity with its own material.`);
}
export async function applyMaterialMaps(session: EditorSession, entity: Entity, maps: readonly DownloadedFile[]): Promise<object[]> {
    requireOwnMaterial(session, entity);
    const applied: object[] = [];
    for (const { file, slots } of maps) {
        if (slots.length === 0)
            continue;
        const texture = await importTextureFile(session, file, colorSpaceForSlot(slots[0]));
        if (!texture)
            throw new ToolFailure(`"${file.name}" could not be decoded as an image. Call read_console for the reason.`);
        for (const slot of slots) {
            setMaterialTexture(session, entity, slot, texture);
            applied.push({ slot, texture: texture.name, width: texture.width, height: texture.height });
        }
    }
    if (maps.some(({ slots }) => slots.includes('metallicRoughnessMap'))) {
        setMaterialScalar(session, entity, 'metallic', 1);
        setMaterialScalar(session, entity, 'roughness', 1);
    }
    return applied;
}
