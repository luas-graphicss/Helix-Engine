import { vfxParticleBudget, vfxReferencedTextures, type VfxDocument } from '@/engine/vfx/document/vfx-document';
import type { VfxAssetDetails } from './asset-types';
export function vfxAssetDetails(document: VfxDocument): VfxAssetDetails {
    return {
        kind: 'vfx',
        emitters: document.emitters.length,
        particleBudget: vfxParticleBudget(document),
        durationSeconds: document.duration,
        loop: document.loop,
        textureAssetIds: vfxReferencedTextures(document),
    };
}
