import { createTexture, setTextureImage, type Texture, type TextureColorSpace } from '@/engine/core/scene/texture';
import { MATERIAL_TEXTURE_SLOTS, type MaterialTextureSlot } from '@/engine/core/scene/material';
import type { Entity } from '@/engine/core/scene/entity';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { decodeImage, mimeTypeFromFileName } from '@/engine/assets/image-decoder';
import { setMaterialTexture } from './material-operations';
function stripExtension(fileName: string): string {
    const dot = fileName.lastIndexOf('.');
    return dot > 0 ? fileName.slice(0, dot) : fileName;
}
export function colorSpaceForSlot(slot: MaterialTextureSlot): TextureColorSpace {
    return MATERIAL_TEXTURE_SLOTS.find((entry) => entry.slot === slot)?.colorSpace ?? 'linear';
}
export async function importTextureFile(session: EditorSession, file: File, colorSpace: TextureColorSpace): Promise<Texture | null> {
    const mimeType = file.type || mimeTypeFromFileName(file.name);
    const texture = createTexture({ name: stripExtension(file.name), sourcePath: file.name, mimeType, colorSpace });
    try {
        const image = await decodeImage(file, mimeType);
        setTextureImage(texture, image);
    }
    catch (cause) {
        session.log.error('Texturas', `Não foi possível decodificar "${file.name}": ${cause instanceof Error ? cause.message : String(cause)}`);
        return null;
    }
    session.resources.addTexture(texture, file.name);
    session.log.info('Texturas', `${texture.name} importada (${texture.width}×${texture.height}, ${colorSpace === 'srgb' ? 'sRGB' : 'linear'}).`);
    return texture;
}
export async function loadTextureIntoSlot(session: EditorSession, entity: Entity, slot: MaterialTextureSlot, file: File): Promise<void> {
    const texture = await importTextureFile(session, file, colorSpaceForSlot(slot));
    if (!texture || !entity.material)
        return;
    setMaterialTexture(session, entity, slot, texture);
}
