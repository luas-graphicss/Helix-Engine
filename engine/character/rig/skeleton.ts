import * as quat from '@/engine/core/math/quat';
import type { ImportedNode, ImportedScene, ImportedSkin } from '@/engine/assets/import/import-types';
import { resolveSemanticBones, stripBonePrefix, SEMANTIC_BONES, type SemanticBone } from '@/engine/core/animation/bone-roles';
import type { Rig } from '@/engine/core/scene/rig';
import { Pose } from './pose';
export { SEMANTIC_BONES, stripBonePrefix };
export type { SemanticBone };
export interface SkeletonTemplate {
    readonly jointCount: number;
    readonly names: readonly string[];
    readonly parents: Int32Array;
    readonly order: Int32Array;
    readonly bind: Pose;
    readonly semantic: Readonly<Record<SemanticBone, number>>;
    readonly jointByNode: ReadonlyMap<number, number>;
    readonly unitScale: number;
}
interface NodeIndex {
    byIndex: Map<number, ImportedNode>;
    parentOf: Map<number, number>;
}
function indexNodes(scene: ImportedScene): NodeIndex {
    const byIndex = new Map<number, ImportedNode>();
    const parentOf = new Map<number, number>();
    const visit = (node: ImportedNode, parent: ImportedNode | null): void => {
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
function topologicalOrder(parents: Int32Array): Int32Array {
    const jointCount = parents.length;
    const order = new Int32Array(jointCount);
    const depth = (joint: number): number => (parents[joint] === -1 ? 0 : 1 + depth(parents[joint]));
    Array.from({ length: jointCount }, (_, joint) => joint)
        .sort((a, b) => depth(a) - depth(b))
        .forEach((joint, position) => (order[position] = joint));
    return order;
}
export function createSkeletonTemplateFromRig(rig: Rig): SkeletonTemplate {
    const { jointCount } = rig;
    const bind = new Pose(jointCount);
    bind.positions.set(rig.bindPositions);
    bind.rotations.set(rig.bindRotations);
    bind.scales.set(rig.bindScales);
    const jointByNode = new Map<number, number>();
    for (let joint = 0; joint < jointCount; joint++)
        jointByNode.set(joint, joint);
    return {
        jointCount,
        names: rig.names,
        parents: rig.parents,
        order: topologicalOrder(rig.parents),
        bind,
        semantic: rig.semantic,
        jointByNode,
        unitScale: rig.unitScale,
    };
}
export function createSkeletonTemplate(scene: ImportedScene, skin: ImportedSkin): SkeletonTemplate {
    const { byIndex, parentOf } = indexNodes(scene);
    const jointCount = skin.joints.length;
    const jointByNode = new Map<number, number>();
    skin.joints.forEach((nodeIndex, joint) => jointByNode.set(nodeIndex, joint));
    const names: string[] = [];
    const parents = new Int32Array(jointCount);
    const bind = new Pose(jointCount);
    skin.joints.forEach((nodeIndex, joint) => {
        const node = byIndex.get(nodeIndex);
        if (!node)
            throw new Error(`${skin.name}: junta aponta para o nó ${nodeIndex}, que não existe na cena.`);
        names.push(node.name);
        let parentNode = parentOf.get(nodeIndex);
        while (parentNode !== undefined && !jointByNode.has(parentNode))
            parentNode = parentOf.get(parentNode);
        parents[joint] = parentNode === undefined ? -1 : (jointByNode.get(parentNode) as number);
        bind.position(joint).set(node.position);
        quat.fromEulerDegrees(bind.rotation(joint), node.rotation);
        bind.scale(joint).set(node.scale);
    });
    const order = topologicalOrder(parents);
    const semantic = resolveSemanticBones(names);
    let unitScale = 1;
    const rootJoint = order[0];
    for (let ancestor = parentOf.get(skin.joints[rootJoint]); ancestor !== undefined; ancestor = parentOf.get(ancestor)) {
        unitScale *= byIndex.get(ancestor)?.scale[1] ?? 1;
    }
    return { jointCount, names, parents, order, bind, semantic, jointByNode, unitScale };
}
