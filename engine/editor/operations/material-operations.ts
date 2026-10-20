import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { clamp } from '@/engine/core/math/scalar';
import type { Entity } from '@/engine/core/scene/entity';
import type { AlphaMode, Material, MaterialTextureSlot } from '@/engine/core/scene/material';
import type { Texture } from '@/engine/core/scene/texture';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
export type MaterialScalar = 'roughness' | 'metallic' | 'opacity' | 'emissiveIntensity' | 'normalScale' | 'occlusionStrength' | 'alphaCutoff';
export type MaterialColor = 'baseColor' | 'emissive';
const SCALAR_RANGE: Record<MaterialScalar, [
    number,
    number
]> = {
    roughness: [0, 1],
    metallic: [0, 1],
    opacity: [0, 1],
    emissiveIntensity: [0, 100],
    normalScale: [0, 4],
    occlusionStrength: [0, 1],
    alphaCutoff: [0, 1],
};
const SCALAR_LABEL: Record<MaterialScalar, string> = {
    roughness: 'Rugosidade',
    metallic: 'Metálico',
    opacity: 'Opacidade',
    emissiveIntensity: 'Intensidade emissiva',
    normalScale: 'Escala da normal',
    occlusionStrength: 'Força da oclusão',
    alphaCutoff: 'Corte alfa',
};
export function setMaterialScalar(session: EditorSession, entity: Entity, field: MaterialScalar, value: number): void {
    const { material } = entity;
    if (!material || !Number.isFinite(value))
        return;
    const [min, max] = SCALAR_RANGE[field];
    const next = clamp(value, min, max);
    if (material[field] === next)
        return;
    session.history.execute(new SetValueCommand(SCALAR_LABEL[field], (v) => {
        material[field] = v;
    }, material[field], next, `material:${entity.id}:${field}`));
}
export function setMaterialColor(session: EditorSession, entity: Entity, field: MaterialColor, linearRgb: Vec3): void {
    const { material } = entity;
    if (!material)
        return;
    const target = material[field];
    session.history.execute(new SetValueCommand(field === 'baseColor' ? 'Cor base' : 'Cor emissiva', (value) => vec3.copy(target, value), vec3.copy(vec3.create(), target), vec3.copy(vec3.create(), linearRgb), `material:${entity.id}:${field}`));
}
export function setMaterialAlphaMode(session: EditorSession, entity: Entity, mode: AlphaMode): void {
    const { material } = entity;
    if (!material || material.alphaMode === mode)
        return;
    session.history.execute(new SetValueCommand('Modo alfa', (value) => {
        material.alphaMode = value;
    }, material.alphaMode, mode));
}
export function setMaterialDoubleSided(session: EditorSession, entity: Entity, doubleSided: boolean): void {
    const { material } = entity;
    if (!material || material.doubleSided === doubleSided)
        return;
    session.history.execute(new SetValueCommand('Dupla face', (value) => {
        material.doubleSided = value;
    }, material.doubleSided, doubleSided));
}
export function setMaterialTexture(session: EditorSession, entity: Entity, slot: MaterialTextureSlot, texture: Texture | null): void {
    const { material } = entity;
    if (!material || material[slot] === texture)
        return;
    session.history.execute(new SetValueCommand(texture ? `Vincular ${texture.name}` : 'Remover textura', (value) => {
        material[slot] = value;
    }, material[slot], texture));
}
export function setEntityMaterial(session: EditorSession, entity: Entity, material: Material | null): void {
    if (entity.material === material)
        return;
    session.history.execute(new SetValueCommand(material ? `Aplicar ${material.name}` : 'Remover material', (value) => {
        entity.material = value;
    }, entity.material, material));
}
