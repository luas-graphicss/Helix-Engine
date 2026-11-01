import type { PrefabJson } from '@/engine/project/prefab/prefab-document';
import type { EntityJson } from '@/engine/project/scene-document/scene-document';
import type { PrefabAssetDetails } from './asset-types';
const COMPONENT_FIELDS = ['mesh', 'material', 'light', 'terrain', 'rigidBody', 'character', 'skin', 'rig', 'csg', 'csgBrush', 'audioSource', 'audioZone', 'guiSurface', 'vfx', 'script'] as const;
const COMPONENT_LABELS: Record<(typeof COMPONENT_FIELDS)[number], string> = {
    mesh: 'malha',
    material: 'material',
    light: 'luz',
    terrain: 'terreno',
    rigidBody: 'corpo rígido',
    character: 'personagem',
    skin: 'pele',
    rig: 'esqueleto',
    csg: 'CSG',
    csgBrush: 'pincel CSG',
    audioSource: 'fonte de áudio',
    audioZone: 'zona de áudio',
    guiSurface: 'tela',
    vfx: 'efeito',
    script: 'script',
};
export function prefabAssetDetails(json: PrefabJson): PrefabAssetDetails {
    const present = new Set<(typeof COMPONENT_FIELDS)[number]>();
    const visit = (entity: EntityJson) => {
        for (const field of COMPONENT_FIELDS)
            if (entity[field] !== undefined)
                present.add(field);
        for (const child of entity.children)
            visit(child);
    };
    visit(json.root);
    return {
        kind: 'prefab',
        entities: json.stats.entities,
        triangles: json.stats.triangles,
        meshes: json.meshes.length,
        textures: json.textures.length,
        rootKind: json.stats.rootKind,
        components: COMPONENT_FIELDS.filter((field) => present.has(field)).map((field) => COMPONENT_LABELS[field]),
    };
}
