import { linearRgbToHex } from '@/engine/core/color/srgb';
import type { Entity } from '@/engine/core/scene/entity';
const COORDINATE_PRECISION = 1000;
const CHILD_ID_LIMIT = 40;
function rounded(vector: ArrayLike<number>): number[] {
    return Array.from(vector, (component) => Math.round(component * COORDINATE_PRECISION) / COORDINATE_PRECISION);
}
export function summarizeEntity(entity: Entity): object {
    const { transform, material, light, rigidBody, script, terrain } = entity;
    return {
        id: entity.id,
        name: entity.name,
        kind: entity.kind,
        parentId: entity.parent?.id ?? null,
        visible: entity.visible,
        locked: entity.locked,
        position: rounded(transform.position),
        rotation: rounded(transform.rotation),
        scale: rounded(transform.scale),
        childCount: entity.children.length,
        childIds: entity.children.slice(0, CHILD_ID_LIMIT).map((child) => child.id),
        material: material
            ? { color: linearRgbToHex(material.baseColor), roughness: material.roughness, metallic: material.metallic, opacity: material.opacity, emissiveIntensity: material.emissiveIntensity }
            : undefined,
        light: light ? { type: light.type, intensity: light.intensity } : undefined,
        rigidBody: rigidBody ? { type: rigidBody.type, collider: rigidBody.collider, mass: rigidBody.mass, friction: rigidBody.friction, restitution: rigidBody.restitution } : undefined,
        script: script ? { scriptId: script.assetId, enabled: script.enabled } : undefined,
        terrain: terrain ? { size: terrain.size, waterEnabled: terrain.water.enabled, waterLevel: terrain.water.level } : undefined,
    };
}
