import type { ImportedScene } from '@/engine/assets/import/import-types';
import type { AnimationDocument } from '@/engine/core/animation/animation-document';
import { animationStats } from '@/engine/core/animation/animation-document';
import { skeletonFromScene } from '@/engine/core/animation/animation-from-imported';
import { resolveSemanticBones, SEMANTIC_BONES } from '@/engine/core/animation/bone-roles';
import type { AnimationAssetDetails, ModelRigDetails } from './asset-types';
export function animationAssetDetails(document: AnimationDocument): AnimationAssetDetails {
    const stats = animationStats(document);
    const jointNames = Array.from(new Set(document.tracks.map((track) => track.joint)));
    return {
        kind: 'animation',
        durationSeconds: document.duration,
        loop: document.loop,
        frameRate: document.frameRate,
        tracks: document.tracks.length,
        keyframes: stats.keyCount,
        joints: jointNames.length,
        jointNames,
        hasSkeleton: document.skeleton !== null,
        events: document.events.length,
        sourceFormat: document.source?.format ?? null,
    };
}
export function modelRigDetails(scene: ImportedScene): ModelRigDetails | null {
    const skeleton = skeletonFromScene(scene);
    if (!skeleton || skeleton.names.length === 0)
        return null;
    const semantic = resolveSemanticBones(skeleton.names);
    const roles = SEMANTIC_BONES.filter((bone) => semantic[bone] !== -1);
    const rootIndex = skeleton.parents.indexOf(-1);
    return { jointCount: skeleton.names.length, roles, rootBone: skeleton.names[rootIndex === -1 ? 0 : rootIndex] };
}
export function isAnimationOnlyScene(scene: ImportedScene): boolean {
    return scene.meshes.length === 0 && scene.animations.length > 0;
}
