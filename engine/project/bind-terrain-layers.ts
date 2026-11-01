import type { EditorSession } from '@/engine/editor/session/editor-session';
import { terrainMaterialForDocument } from '@/engine/editor/operations/material-library-operations';
import { createAutoRule, createTerrainLayer } from '@/engine/terrain/core/terrain-layer';
import type { TerrainMaterial } from '@/engine/terrain/materials/terrain-material';
import * as vec3 from '@/engine/core/math/vec3';
import type { PendingTerrainLayer } from './scene-document/deserialize-scene';
import { restoreInto } from './scene-document/plain-data';
const FALLBACK_TERRAIN_MATERIAL = 'grass';
export function bindPendingTerrainLayers(session: EditorSession, pending: PendingTerrainLayer[], warnings: string[]): void {
    for (const { terrain, layer } of pending) {
        let material: TerrainMaterial | null = null;
        if ('catalog' in layer.material) {
            material = session.terrain.materials.get(layer.material.catalog);
            if (!material)
                warnings.push(`O material de terreno "${layer.material.catalog}" não existe mais no catálogo; a camada "${layer.name}" usa grama.`);
        }
        else {
            const document = session.materials.get(layer.material.library);
            if (document)
                material = terrainMaterialForDocument(session, document);
            else
                warnings.push(`O material da biblioteca usado pela camada "${layer.name}" foi removido; a camada usa grama.`);
        }
        material ??= session.terrain.materials.get(FALLBACK_TERRAIN_MATERIAL);
        if (!material)
            continue;
        terrain.layers.push(createTerrainLayer(material, {
            name: layer.name,
            tiling: layer.tiling,
            tint: vec3.create(layer.tint[0] ?? 1, layer.tint[1] ?? 1, layer.tint[2] ?? 1),
            normalStrength: layer.normalStrength,
            roughness: layer.roughness,
            auto: restoreInto(createAutoRule(), layer.auto),
        }));
        terrain.markSplatDirty();
    }
}
