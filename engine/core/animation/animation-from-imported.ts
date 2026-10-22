import * as quat from '@/engine/core/math/quat';
import type { ImportedAnimation, ImportedNode, ImportedScene, ImportedSkin } from '@/engine/assets/import/import-types';
import type { AnimationDocument, AnimationSkeleton, AnimationTrack } from './animation-document';
import { measureDuration, validateTrack } from './animation-document';
interface NodeIndex {
    readonly byIndex: ReadonlyMap<number, ImportedNode>;
    readonly parentOf: ReadonlyMap<number, number>;
}
function indexNodes(scene: ImportedScene): NodeIndex {
    const byIndex = new Map<number, ImportedNode>();
    const parentOf = new Map<number, number>();
    const visit = (node: ImportedNode, parent: ImportedNode | null) => {
        if (node.nodeIndex !== undefined) {
            byIndex.set(node.nodeIndex, node);
            if (parent?.nodeIndex !== undefined)
                parentOf.set(node.nodeIndex, parent.nodeIndex);
        }
        for (const child of node.children)
            visit(child, node);
    };
    for (const root of scene.roots)
        visit(root, null);
    return { byIndex, parentOf };
}
function skeletonFromSkin(index: NodeIndex, skin: ImportedSkin): AnimationSkeleton | null {
    const jointByNode = new Map<number, number>();
    skin.joints.forEach((nodeIndex, joint) => jointByNode.set(nodeIndex, joint));
    const names: string[] = [];
    const parents: number[] = [];
    const positions = new Float32Array(skin.joints.length * 3);
    const rotations = new Float32Array(skin.joints.length * 4);
    const scales = new Float32Array(skin.joints.length * 3);
    for (let joint = 0; joint < skin.joints.length; joint++) {
        const node = index.byIndex.get(skin.joints[joint]);
        if (!node)
            return null;
        names.push(node.name);
        let parent = index.parentOf.get(skin.joints[joint]);
        while (parent !== undefined && !jointByNode.has(parent))
            parent = index.parentOf.get(parent);
        parents.push(parent === undefined ? -1 : (jointByNode.get(parent) as number));
        positions.set(node.position, joint * 3);
        quat.fromEulerDegrees(rotations.subarray(joint * 4, joint * 4 + 4), node.rotation);
        scales.set(node.scale, joint * 3);
    }
    return { names, parents, bindPositions: positions, bindRotations: rotations, bindScales: scales };
}
function skeletonFromAnimatedNodes(index: NodeIndex, animation: ImportedAnimation): AnimationSkeleton | null {
    const animated = new Set<number>();
    for (const channel of animation.channels)
        animated.add(channel.nodeIndex);
    const included = new Set<number>();
    for (const nodeIndex of animated) {
        let current: number | undefined = nodeIndex;
        const chain: number[] = [];
        while (current !== undefined && !included.has(current)) {
            chain.push(current);
            current = index.parentOf.get(current);
        }
        const connects = current !== undefined || chain.some((item) => animated.has(item));
        if (connects)
            for (const item of chain)
                included.add(item);
    }
    const ordered = Array.from(included).sort((a, b) => a - b);
    if (ordered.length === 0)
        return null;
    const jointByNode = new Map(ordered.map((nodeIndex, joint) => [nodeIndex, joint] as const));
    const names: string[] = [];
    const parents: number[] = [];
    const positions = new Float32Array(ordered.length * 3);
    const rotations = new Float32Array(ordered.length * 4);
    const scales = new Float32Array(ordered.length * 3);
    ordered.forEach((nodeIndex, joint) => {
        const node = index.byIndex.get(nodeIndex);
        names.push(node?.name ?? `Nó ${nodeIndex}`);
        let parent = index.parentOf.get(nodeIndex);
        while (parent !== undefined && !jointByNode.has(parent))
            parent = index.parentOf.get(parent);
        parents.push(parent === undefined ? -1 : (jointByNode.get(parent) as number));
        if (node) {
            positions.set(node.position, joint * 3);
            quat.fromEulerDegrees(rotations.subarray(joint * 4, joint * 4 + 4), node.rotation);
            scales.set(node.scale, joint * 3);
        }
        else {
            rotations[joint * 4 + 3] = 1;
            scales.fill(1, joint * 3, joint * 3 + 3);
        }
    });
    return { names, parents, bindPositions: positions, bindRotations: rotations, bindScales: scales };
}
export function skeletonFromScene(scene: ImportedScene, skinIndex = 0): AnimationSkeleton | null {
    const skin = scene.skins[skinIndex];
    return skin ? skeletonFromSkin(indexNodes(scene), skin) : null;
}
export function inferFrameRate(tracks: readonly AnimationTrack[]): number | null {
    const steps = new Map<number, number>();
    for (const track of tracks) {
        for (let i = 1; i < track.times.length; i++) {
            const step = Math.round((track.times[i] - track.times[i - 1]) * 1e4) / 1e4;
            if (step > 0)
                steps.set(step, (steps.get(step) ?? 0) + 1);
        }
    }
    let best: number | null = null;
    let bestCount = 0;
    for (const [step, count] of steps) {
        if (count > bestCount) {
            best = step;
            bestCount = count;
        }
    }
    if (best === null)
        return null;
    const rate = 1 / best;
    const usual = [24, 25, 30, 48, 50, 60, 90, 120].find((candidate) => Math.abs(candidate - rate) < 0.6);
    return usual ?? Math.round(rate * 100) / 100;
}
export interface ImportedAnimationDocumentOptions {
    fallbackName?: string;
    skinIndex?: number;
    loop?: boolean;
}
export function animationDocumentFromImported(scene: ImportedScene, animation: ImportedAnimation, options: ImportedAnimationDocumentOptions = {}): AnimationDocument {
    const index = indexNodes(scene);
    const tracks: AnimationTrack[] = [];
    for (const channel of animation.channels) {
        const node = index.byIndex.get(channel.nodeIndex);
        if (!node || channel.times.length === 0)
            continue;
        const track: AnimationTrack = { joint: node.name, path: channel.path, interpolation: channel.interpolation, times: channel.times, values: channel.values };
        if (validateTrack(track) === null)
            tracks.push(track);
    }
    const skin = scene.skins[options.skinIndex ?? 0];
    const skeleton = (skin ? skeletonFromSkin(index, skin) : null) ?? skeletonFromAnimatedNodes(index, animation);
    const name = animation.name.trim() || options.fallbackName || scene.name;
    return {
        name,
        duration: Math.max(animation.duration, measureDuration(tracks)),
        loop: options.loop ?? true,
        frameRate: inferFrameRate(tracks),
        referenceSpeed: 0,
        tracks,
        skeleton,
        events: [],
        source: { file: scene.sourceFile, format: scene.format, clip: animation.name || undefined },
        createdAt: Date.now(),
    };
}
export function animationDocumentsFromScene(scene: ImportedScene): AnimationDocument[] {
    const used = new Set<string>();
    return scene.animations.map((animation, position) => {
        const document = animationDocumentFromImported(scene, animation, { fallbackName: scene.animations.length === 1 ? scene.name : `${scene.name} ${position + 1}` });
        let name = document.name;
        for (let suffix = 2; used.has(name); suffix++)
            name = `${document.name} ${suffix}`;
        used.add(name);
        return name === document.name ? document : { ...document, name };
    });
}
