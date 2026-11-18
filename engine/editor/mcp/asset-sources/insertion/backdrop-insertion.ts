import { toneMapRadiance, type DisplayImage } from '@/engine/assets/hdr/panorama-tone-mapping';
import { decodeRadianceHdr, RadianceFormatError } from '@/engine/assets/hdr/radiance-hdr';
import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { createMaterial } from '@/engine/core/scene/material';
import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
import { addEntity } from '@/engine/editor/operations/entity-operations';
import { importTextureFile } from '@/engine/editor/operations/texture-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { createSphere } from '@/engine/renderer/geometry/primitives';
import { safeFileName } from '../transport/file-naming';
const PANORAMA_EXTENSION = 'jpg';
const PANORAMA_MIME_TYPE = 'image/jpeg';
const PANORAMA_QUALITY = 0.92;
const DOME_RADIUS = 400;
const DOME_WIDTH_SEGMENTS = 64;
const DOME_HEIGHT_SEGMENTS = 32;
function readPanorama(bytes: Uint8Array): DisplayImage {
    try {
        return toneMapRadiance(decodeRadianceHdr(bytes));
    }
    catch (cause) {
        if (cause instanceof RadianceFormatError)
            throw new ToolFailure(`The HDRI could not be read. ${cause.message}`);
        throw cause;
    }
}
export async function convertPanorama(source: File, name: string): Promise<File> {
    const { width, height, pixels } = readPanorama(new Uint8Array(await source.arrayBuffer()));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context)
        throw new ToolFailure('The browser could not create a drawing surface to convert the HDRI.');
    context.putImageData(new ImageData(pixels, width, height), 0, 0);
    const encoded = await canvas.convertToBlob({ type: PANORAMA_MIME_TYPE, quality: PANORAMA_QUALITY });
    return new File([encoded], safeFileName(name, PANORAMA_EXTENSION), { type: PANORAMA_MIME_TYPE });
}
export async function addBackdropDome(session: EditorSession, panorama: File, name: string): Promise<Entity> {
    const texture = await importTextureFile(session, panorama, 'srgb');
    if (!texture)
        throw new ToolFailure('The converted panorama could not be decoded. Call read_console for the reason.');
    texture.wrapT = 'clamp';
    const material = createMaterial({
        name,
        baseColor: vec3.create(0, 0, 0),
        roughness: 1,
        emissive: vec3.create(1, 1, 1),
        emissiveMap: texture,
        doubleSided: true,
    });
    const dome = session.scene.createEntity({
        name,
        kind: 'mesh',
        mesh: createSphere(DOME_RADIUS, DOME_WIDTH_SEGMENTS, DOME_HEIGHT_SEGMENTS),
        material,
        castShadows: false,
        receiveShadows: false,
    }, null);
    vec3.set(dome.transform.scale, -1, 1, 1);
    return addEntity(session, dome, session.scene.root, `Adicionar fundo ${name}`);
}
