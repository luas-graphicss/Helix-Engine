import * as vec3 from '@/engine/core/math/vec3';
import * as mat4 from '@/engine/core/math/mat4';
import * as aabb from '@/engine/core/math/aabb';
import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import type { Material } from '@/engine/core/scene/material';
import { DEFAULT_MATERIALIZE_OPTIONS, materializeImportedScene, type MaterializedImport } from '@/engine/assets/import/import-materializer';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import type { CharacterModelAsset } from '@/engine/character/assets/character-model-asset';
import type { SkeletonTemplate } from './skeleton';
import { applyPose, Pose } from './pose';
export interface CharacterRig {
    readonly root: Entity;
    readonly armature: Entity;
    readonly joints: ReadonlyArray<Entity | null>;
    readonly template: SkeletonTemplate;
}
export const RIG_ROOT_NAME = 'Esqueleto';
export const STATIC_MODEL_ROOT_NAME = 'Modelo';
interface MannequinLook {
    name: string;
    baseColor: readonly [
        number,
        number,
        number
    ];
    roughness: number;
    metallic: number;
}
const SURFACE_LOOK: MannequinLook = { name: 'Manequim · Superfície', baseColor: [0.58, 0.6, 0.63], roughness: 0.55, metallic: 0.08 };
const JOINTS_LOOK: MannequinLook = { name: 'Manequim · Juntas', baseColor: [0.1, 0.11, 0.125], roughness: 0.6, metallic: 0.35 };
const rigs = new WeakMap<Entity, CharacterRig>();
const scratchInverse = mat4.create();
const scratchRelative = mat4.create();
const scratchSkinFrame = mat4.create();
const scratchBox = aabb.create();
const scratchBounds = aabb.create();
function applyLook(material: Material, look: MannequinLook): void {
    material.name = look.name;
    vec3.set(material.baseColor, look.baseColor[0], look.baseColor[1], look.baseColor[2]);
    material.roughness = look.roughness;
    material.metallic = look.metallic;
    material.doubleSided = false;
}
function isJointsPart(name: string): boolean {
    return /joint/i.test(name);
}
function styleMannequin(result: MaterializedImport): void {
    for (const material of result.materials)
        applyLook(material, isJointsPart(material.name) ? JOINTS_LOOK : SURFACE_LOOK);
    for (const child of result.root.children) {
        if (!child.mesh)
            continue;
        child.name = isJointsPart(child.name) ? 'Juntas' : 'Superfície';
    }
}
export function findModelRoot(root: Entity): Entity | null {
    return root.children.find((child) => child.name === RIG_ROOT_NAME || child.name === STATIC_MODEL_ROOT_NAME) ?? null;
}
export function hasModel(root: Entity): boolean {
    return findModelRoot(root) !== null;
}
function measureModel(scene: Scene, modelRoot: Entity): {
    min: number;
    max: number;
} | null {
    const parent = modelRoot.parent;
    if (!parent)
        return null;
    scene.updateWorldMatrices();
    if (!mat4.invert(scratchInverse, parent.worldMatrix))
        return null;
    aabb.reset(scratchBounds);
    scene.traverse((entity) => {
        if (!entity.mesh)
            return;
        const { skin } = entity;
        if (entity.mesh.skinning && skin && skin.joints.length > 0) {
            mat4.multiply(scratchSkinFrame, skin.joints[0].worldMatrix, skin.inverseBindMatrices.subarray(0, 16));
            mat4.multiply(scratchRelative, scratchInverse, scratchSkinFrame);
        }
        else {
            mat4.multiply(scratchRelative, scratchInverse, entity.worldMatrix);
        }
        aabb.transform(scratchBox, getLocalBounds(entity.mesh), scratchRelative);
        aabb.union(scratchBounds, scratchBounds, scratchBox);
    }, modelRoot);
    if (aabb.isEmpty(scratchBounds))
        return null;
    return { min: scratchBounds.min[1], max: scratchBounds.max[1] };
}
export function fitModelToHeight(scene: Scene, modelRoot: Entity, height: number): void {
    const measured = measureModel(scene, modelRoot);
    if (!measured)
        return;
    const { transform } = modelRoot;
    const currentScale = transform.scale[1] || 1;
    const modelHeight = (measured.max - measured.min) / currentScale;
    if (!(modelHeight > 1e-6))
        return;
    const bottom = (measured.min - transform.position[1]) / currentScale;
    const scale = height / modelHeight;
    vec3.set(transform.scale, scale, scale, scale);
    transform.position[1] = -bottom * scale;
}
export async function instantiateCharacterModel(scene: Scene, root: Entity, asset: CharacterModelAsset, height: number): Promise<CharacterRig | null> {
    const rootName = asset.template ? RIG_ROOT_NAME : STATIC_MODEL_ROOT_NAME;
    const result = await materializeImportedScene(scene, asset.imported, { ...DEFAULT_MATERIALIZE_OPTIONS, rootName });
    const modelRoot = result.root;
    if (asset.builtin)
        styleMannequin(result);
    root.add(modelRoot);
    fitModelToHeight(scene, modelRoot, height);
    const { template } = asset;
    if (!template)
        return null;
    const joints = asset.imported.skins[0].joints.map((nodeIndex) => result.nodes.get(nodeIndex) ?? null);
    if (asset.clips) {
        const restPose = new Pose(template.jointCount);
        asset.clips.idle.evaluate(0, restPose);
        applyPose(joints, restPose);
    }
    const rig: CharacterRig = { root, armature: modelRoot, joints, template };
    rigs.set(root, rig);
    return rig;
}
export function removeCharacterModel(root: Entity): Entity | null {
    const modelRoot = findModelRoot(root);
    if (modelRoot)
        root.remove(modelRoot);
    rigs.delete(root);
    return modelRoot;
}
export function resolveCharacterRig(scene: Scene, root: Entity, asset: CharacterModelAsset): CharacterRig | null {
    const cached = rigs.get(root);
    if (cached)
        return cached;
    const { template } = asset;
    if (!template)
        return null;
    const byName = new Map<string, Entity>();
    let armature: Entity | null = null;
    scene.traverse((entity) => {
        if (entity === root)
            return;
        if (!byName.has(entity.name))
            byName.set(entity.name, entity);
        if (!armature && entity.name === RIG_ROOT_NAME)
            armature = entity;
    }, root);
    if (!armature)
        return null;
    const joints = template.names.map((name) => byName.get(name) ?? null);
    if (joints.every((joint) => joint === null))
        return null;
    const rig: CharacterRig = { root, armature, joints, template };
    rigs.set(root, rig);
    return rig;
}
