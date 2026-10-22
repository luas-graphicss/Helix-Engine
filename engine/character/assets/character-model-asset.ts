import { computeImportStats, type ImportedAnimation, type ImportedScene } from '@/engine/assets/import/import-types';
import { AnimationClip } from '@/engine/character/animation/animation-clip';
import type { LocomotionClips } from '@/engine/character/animation/locomotion-animator';
import { FALL_OVERLAY, JUMP_OVERLAY, LAND_OVERLAY } from '@/engine/character/animation/clips/air-overlays';
import { createSkeletonTemplate, type SkeletonTemplate } from '@/engine/character/rig/skeleton';
import { MANNEQUIN_MODEL_ID } from '@/engine/character/character-settings';
export { MANNEQUIN_MODEL_ID };
export type LocomotionClipKey = 'idle' | 'walk' | 'run' | 'crouch';
export type LocomotionStateKey = LocomotionClipKey | 'jump' | 'fall' | 'land';
export type LocomotionSource = 'file' | 'fallback' | 'procedural' | 'none';
export interface LocomotionBinding {
    readonly state: LocomotionStateKey;
    readonly source: LocomotionSource;
    readonly clipName: string | null;
}
export interface CharacterModelAsset {
    readonly id: string;
    readonly label: string;
    readonly source: string;
    readonly builtin: boolean;
    readonly imported: ImportedScene;
    readonly template: SkeletonTemplate | null;
    readonly clips: LocomotionClips | null;
    readonly bindings: readonly LocomotionBinding[];
    readonly jointCount: number;
    readonly triangles: number;
    readonly animationNames: readonly string[];
}
export interface CharacterModelOptions {
    id: string;
    label: string;
    source: string;
    builtin?: boolean;
}
export const CLIP_PROFILE: Record<LocomotionClipKey, {
    loop: boolean;
    referenceSpeed: number;
}> = {
    idle: { loop: true, referenceSpeed: 0 },
    walk: { loop: true, referenceSpeed: 1.5 },
    run: { loop: true, referenceSpeed: 4.2 },
    crouch: { loop: false, referenceSpeed: 0 },
};
const CLIP_ALIASES: Record<LocomotionClipKey, readonly string[]> = {
    idle: ['idle', 'parado', 'breathing', 'stand', 'standing'],
    walk: ['walk', 'walking', 'andar', 'andando', 'caminhar', 'caminhando'],
    run: ['run', 'running', 'correr', 'correndo', 'jog', 'jogging', 'sprint'],
    crouch: ['crouch', 'crouching', 'sneak', 'sneaking', 'agachar', 'agachado'],
};
function tokenize(name: string): string[] {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z]+/)
        .filter(Boolean);
}
function scoreName(name: string, aliases: readonly string[]): number {
    let best = 0;
    for (const token of tokenize(name)) {
        for (const alias of aliases) {
            if (token === alias)
                return 2;
            if (token.startsWith(alias))
                best = Math.max(best, 1);
        }
    }
    return best;
}
function findAnimation(scene: ImportedScene, key: LocomotionClipKey): ImportedAnimation | null {
    let best: ImportedAnimation | null = null;
    let bestScore = 0;
    for (const animation of scene.animations) {
        const score = scoreName(animation.name, CLIP_ALIASES[key]);
        if (score > bestScore) {
            best = animation;
            bestScore = score;
        }
    }
    return best;
}
interface ClipResolution {
    clips: LocomotionClips | null;
    bindings: LocomotionBinding[];
}
function resolveClips(imported: ImportedScene, template: SkeletonTemplate | null): ClipResolution {
    const procedural = (state: LocomotionStateKey): LocomotionBinding => ({ state, source: 'procedural', clipName: null });
    const none = (state: LocomotionStateKey): LocomotionBinding => ({ state, source: 'none', clipName: null });
    if (!template || imported.animations.length === 0) {
        return { clips: null, bindings: [none('idle'), none('walk'), none('run'), none('crouch'), none('jump'), none('fall'), none('land')] };
    }
    const matched: Record<LocomotionClipKey, ImportedAnimation | null> = {
        idle: findAnimation(imported, 'idle'),
        walk: findAnimation(imported, 'walk'),
        run: findAnimation(imported, 'run'),
        crouch: findAnimation(imported, 'crouch'),
    };
    const fallbackOrder: Record<LocomotionClipKey, readonly LocomotionClipKey[]> = {
        idle: ['walk', 'run', 'crouch'],
        walk: ['run', 'idle'],
        run: ['walk', 'idle'],
        crouch: ['idle', 'walk'],
    };
    const bindings: LocomotionBinding[] = [];
    const pick = (key: LocomotionClipKey): AnimationClip => {
        let animation = matched[key];
        let source: LocomotionSource = 'file';
        if (!animation) {
            source = 'fallback';
            animation = fallbackOrder[key].map((other) => matched[other]).find((candidate) => candidate !== null) ?? imported.animations[0];
        }
        bindings.push({ state: key, source, clipName: animation.name });
        const profile = CLIP_PROFILE[key];
        return new AnimationClip(animation, template, { name: key, loop: profile.loop, referenceSpeed: profile.referenceSpeed });
    };
    const clips: LocomotionClips = {
        idle: pick('idle'),
        walk: pick('walk'),
        run: pick('run'),
        crouch: pick('crouch'),
        jump: JUMP_OVERLAY,
        fall: FALL_OVERLAY,
        land: LAND_OVERLAY,
    };
    bindings.push(procedural('jump'), procedural('fall'), procedural('land'));
    return { clips, bindings };
}
export function buildCharacterModelAsset(imported: ImportedScene, options: CharacterModelOptions): CharacterModelAsset {
    const skin = imported.skins[0] ?? null;
    const template = skin ? createSkeletonTemplate(imported, skin) : null;
    const { clips, bindings } = resolveClips(imported, template);
    return {
        id: options.id,
        label: options.label,
        source: options.source,
        builtin: options.builtin ?? false,
        imported,
        template,
        clips,
        bindings,
        jointCount: template?.jointCount ?? 0,
        triangles: computeImportStats(imported).triangles,
        animationNames: imported.animations.map((animation) => animation.name),
    };
}
export function describeCharacterModel(asset: CharacterModelAsset): string {
    if (!asset.template)
        return 'sem esqueleto';
    const clips = asset.animationNames.length;
    return `${asset.jointCount} juntas · ${clips} ${clips === 1 ? 'clipe' : 'clipes'}`;
}
