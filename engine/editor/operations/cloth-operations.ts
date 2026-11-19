import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { createMaterial } from '@/engine/core/scene/material';
import { getClothPreset, type ClothPresetId } from '@/engine/cloth/cloth-presets';
import { clampClothScalar, cloneClothSettings, type ClothAnchor, type ClothQuality, type ClothScalar, type ClothSettings } from '@/engine/cloth/cloth-settings';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { addEntity, defaultParent, spawnPosition } from './entity-operations';
interface Wearer {
    readonly entity: Entity;
    readonly height: number;
    readonly radius: number;
}
const SCALAR_LABEL: Record<ClothScalar, string> = {
    anchorBand: 'Faixa presa do tecido',
    density: 'Densidade do tecido',
    stretchStiffness: 'Firmeza do tecido',
    bendStiffness: 'Rigidez do tecido',
    damping: 'Amortecimento do tecido',
    gravityScale: 'Gravidade do tecido',
    windSpeed: 'Velocidade do vento no tecido',
    windDirection: 'Direção do vento no tecido',
    windTurbulence: 'Rajadas no tecido',
    airDrag: 'Arrasto do ar no tecido',
    thickness: 'Espessura do tecido',
    friction: 'Atrito do tecido',
};
const ANCHOR_LABEL: Record<ClothAnchor, string> = {
    none: 'Soltar tecido',
    top: 'Prender tecido por cima',
    bottom: 'Prender tecido por baixo',
    left: 'Prender tecido pela esquerda',
    right: 'Prender tecido pela direita',
    corners: 'Prender tecido pelos cantos',
};
const ACTOR_COLOR: Record<ClothPresetId, Vec3> = {
    sheet: vec3.create(0.82, 0.8, 0.74),
    flag: vec3.create(0.72, 0.16, 0.14),
    cape: vec3.create(0.2, 0.24, 0.42),
    garment: vec3.create(0.5, 0.34, 0.24),
};
const ACTOR_LIFT: Record<ClothPresetId, number> = { sheet: 2, flag: 1.2, cape: 0.35, garment: 0.45 };
const CLOTH_ROUGHNESS = 0.85;
const SHOULDER_HEIGHT_RATIO = 0.8;
const WAIST_HEIGHT_RATIO = 0.56;
const BACK_CLEARANCE = 0.04;
function applyCloth(session: EditorSession, entity: Entity, label: string, next: ClothSettings | null, mergeKey?: string): void {
    session.history.execute(new SetValueCommand<ClothSettings | null>(label, (value) => {
        entity.cloth = value;
    }, entity.cloth, next, mergeKey));
}
function findWearer(session: EditorSession, presetId: ClothPresetId): Wearer | null {
    const selected = session.selectedEntity;
    if (!selected?.character || (presetId !== 'cape' && presetId !== 'garment'))
        return null;
    return { entity: selected, height: selected.character.height, radius: selected.character.radius };
}
function wornPosition(presetId: ClothPresetId, wearer: Wearer, mesh: MeshData): Vec3 {
    const top = getLocalBounds(mesh).max[1];
    if (presetId === 'cape')
        return vec3.create(0, wearer.height * SHOULDER_HEIGHT_RATIO - top, -wearer.radius - BACK_CLEARANCE);
    return vec3.create(0, wearer.height * WAIST_HEIGHT_RATIO - top, 0);
}
export function canBecomeCloth(entity: Entity): boolean {
    return entity.mesh !== null && !entity.cloth && !entity.skin && !entity.csg && !entity.csgBrush;
}
export function addClothActor(session: EditorSession, presetId: ClothPresetId): Entity {
    const preset = getClothPreset(presetId);
    const mesh = preset.createMesh();
    const entity = session.scene.createEntity({
        name: mesh.name,
        kind: 'mesh',
        mesh,
        material: createMaterial({ name: mesh.name, baseColor: vec3.copy(vec3.create(), ACTOR_COLOR[presetId]), roughness: CLOTH_ROUGHNESS, doubleSided: true }),
        cloth: cloneClothSettings(preset.settings),
    }, null);
    const wearer = findWearer(session, presetId);
    if (wearer) {
        vec3.copy(entity.transform.position, wornPosition(presetId, wearer, mesh));
        return addEntity(session, entity, wearer.entity, `Vestir ${mesh.name.toLowerCase()} em ${wearer.entity.name}`);
    }
    vec3.copy(entity.transform.position, spawnPosition(session, mesh));
    entity.transform.position[1] += ACTOR_LIFT[presetId];
    return addEntity(session, entity, defaultParent(session));
}
export function addCloth(session: EditorSession, entity: Entity): void {
    if (!canBecomeCloth(entity))
        return;
    applyCloth(session, entity, 'Transformar em tecido', cloneClothSettings(getClothPreset('garment').settings));
}
export function removeCloth(session: EditorSession, entity: Entity): void {
    if (!entity.cloth)
        return;
    applyCloth(session, entity, 'Remover tecido', null);
}
export function applyClothPreset(session: EditorSession, entity: Entity, presetId: ClothPresetId): void {
    if (!entity.cloth)
        return;
    const preset = getClothPreset(presetId);
    applyCloth(session, entity, `Perfil de tecido: ${preset.label.toLowerCase()}`, cloneClothSettings(preset.settings));
}
export function setClothScalar(session: EditorSession, entity: Entity, key: ClothScalar, value: number): void {
    const current = entity.cloth;
    if (!current || !Number.isFinite(value))
        return;
    const clamped = clampClothScalar(key, value);
    if (clamped === current[key])
        return;
    applyCloth(session, entity, SCALAR_LABEL[key], { ...current, [key]: clamped }, `cloth:${entity.id}:${key}`);
}
export function setClothAnchor(session: EditorSession, entity: Entity, anchor: ClothAnchor): void {
    const current = entity.cloth;
    if (!current || current.anchor === anchor)
        return;
    applyCloth(session, entity, ANCHOR_LABEL[anchor], { ...current, anchor });
}
export function setClothQuality(session: EditorSession, entity: Entity, quality: ClothQuality): void {
    const current = entity.cloth;
    if (!current || current.quality === quality)
        return;
    applyCloth(session, entity, 'Qualidade do tecido', { ...current, quality });
}
export function setClothBodyCollision(session: EditorSession, entity: Entity, collideWithBodies: boolean): void {
    const current = entity.cloth;
    if (!current || current.collideWithBodies === collideWithBodies)
        return;
    applyCloth(session, entity, collideWithBodies ? 'Ligar colisão do tecido' : 'Desligar colisão do tecido', { ...current, collideWithBodies });
}
