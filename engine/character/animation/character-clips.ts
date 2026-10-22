import { getAnimationDocument } from '@/engine/animation/clip-registry';
import { CLIP_PROFILE, type CharacterModelAsset, type LocomotionClipKey } from '@/engine/character/assets/character-model-asset';
import { CHARACTER_CLIP_STATES, type CharacterSettings } from '@/engine/character/character-settings';
import type { AnimationClip } from './animation-clip';
import { clipFromDocument } from './clip-from-document';
import { FALL_OVERLAY, JUMP_OVERLAY, LAND_OVERLAY } from './clips/air-overlays';
import type { LocomotionClips } from './locomotion-animator';
const FALLBACK_ORDER: Record<LocomotionClipKey, readonly LocomotionClipKey[]> = {
    idle: ['walk', 'run', 'crouch'],
    walk: ['run', 'idle', 'crouch'],
    run: ['walk', 'idle', 'crouch'],
    crouch: ['idle', 'walk', 'run'],
};
export function libraryClipStates(settings: CharacterSettings): LocomotionClipKey[] {
    return CHARACTER_CLIP_STATES.filter((state) => {
        const assetId = settings.clips[state];
        return assetId !== undefined && getAnimationDocument(assetId) !== null;
    });
}
export function resolveCharacterClips(asset: CharacterModelAsset, settings: CharacterSettings): LocomotionClips | null {
    const { template } = asset;
    if (!template)
        return null;
    const chosen: Partial<Record<LocomotionClipKey, AnimationClip>> = {};
    let fromLibrary = 0;
    for (const state of CHARACTER_CLIP_STATES) {
        const assetId = settings.clips[state];
        const document = assetId ? getAnimationDocument(assetId) : null;
        if (document) {
            const profile = CLIP_PROFILE[state];
            chosen[state] = clipFromDocument(document, template, {
                name: state,
                loop: profile.loop,
                referenceSpeed: document.referenceSpeed > 0 ? document.referenceSpeed : profile.referenceSpeed,
            });
            fromLibrary++;
        }
        else if (asset.clips) {
            chosen[state] = asset.clips[state];
        }
    }
    if (fromLibrary === 0)
        return asset.clips;
    if (Object.keys(chosen).length === 0)
        return null;
    const resolve = (state: LocomotionClipKey): AnimationClip => {
        const own = chosen[state];
        if (own)
            return own;
        for (const other of FALLBACK_ORDER[state]) {
            const candidate = chosen[other];
            if (candidate)
                return candidate;
        }
        throw new Error('Nenhum clipe de locomoção disponível.');
    };
    return {
        idle: resolve('idle'),
        walk: resolve('walk'),
        run: resolve('run'),
        crouch: resolve('crouch'),
        jump: JUMP_OVERLAY,
        fall: FALL_OVERLAY,
        land: LAND_OVERLAY,
    };
}
