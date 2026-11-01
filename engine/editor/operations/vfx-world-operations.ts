import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { clamp } from '@/engine/core/math/scalar';
import type { Entity } from '@/engine/core/scene/entity';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { createVfxSettings, VFX_CULL_DISTANCE_MAX, VFX_SCALE_MAX, VFX_SCALE_MIN, VFX_TIME_SCALE_MAX, type VfxSettings } from '@/engine/vfx/vfx-settings';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { addEntity, spawnPosition } from './entity-operations';
const LOG_SOURCE = 'Efeitos';
const ACTOR_NAME = 'Efeito';
export type VfxScalarField = 'scale' | 'timeScale' | 'cullDistance' | 'seed';
interface Limits {
    readonly min: number;
    readonly max: number;
    readonly label: string;
    readonly integer?: boolean;
}
const SCALAR_LIMITS: Record<VfxScalarField, Limits> = {
    scale: { min: VFX_SCALE_MIN, max: VFX_SCALE_MAX, label: 'Escala do efeito' },
    timeScale: { min: 0, max: VFX_TIME_SCALE_MAX, label: 'Velocidade do efeito' },
    cullDistance: { min: 0, max: VFX_CULL_DISTANCE_MAX, label: 'Distância de ocultação do efeito' },
    seed: { min: 0, max: 4294967295, label: 'Semente do efeito', integer: true },
};
export function defaultVfxAssetId(session: EditorSession): string | null {
    return session.vfx.assetId ?? session.library.byKind('vfx')[0]?.id ?? null;
}
function assetName(session: EditorSession, assetId: string | null): string | null {
    return assetId ? (session.library.get(assetId)?.name ?? null) : null;
}
export function canCarryVfx(entity: Entity): boolean {
    return entity.parent !== null && !entity.terrain && !entity.csgBrush;
}
export interface AddVfxActorOptions {
    assetId?: string | null;
    position?: Vec3;
    name?: string;
}
export function addVfxActor(session: EditorSession, options: AddVfxActorOptions = {}): Entity {
    const assetId = options.assetId === undefined ? defaultVfxAssetId(session) : options.assetId;
    const settings = createVfxSettings({ assetId });
    const name = options.name ?? assetName(session, assetId) ?? ACTOR_NAME;
    const entity = session.scene.createEntity({ name, kind: 'vfx', vfx: settings }, null);
    vec3.copy(entity.transform.position, options.position ?? spawnPosition(session, null));
    const added = addEntity(session, entity, undefined, `Adicionar efeito ${name}`);
    if (!assetId)
        session.log.warn(LOG_SOURCE, `${added.name} não tem efeito: escolha um na seção Efeito visual do inspetor, ou crie um no painel Efeitos.`);
    return added;
}
export function placeVfxAssetAsActor(session: EditorSession, asset: LibraryAsset, position: Vec3 | null = null): Entity | null {
    if (asset.kind !== 'vfx')
        return null;
    return addVfxActor(session, { assetId: asset.id, position: position ?? undefined, name: asset.name });
}
export function attachVfx(session: EditorSession, entity: Entity, assetId: string | null = defaultVfxAssetId(session)): void {
    if (!canCarryVfx(entity))
        return;
    if (entity.vfx) {
        setVfxAsset(session, entity, assetId);
        return;
    }
    session.history.execute(new SetValueCommand<VfxSettings | null>(`Anexar efeito a ${entity.name}`, (value) => {
        entity.vfx = value;
    }, null, createVfxSettings({ assetId })));
    session.log.info(LOG_SOURCE, `${entity.name} recebeu um efeito${assetId ? ` (${assetName(session, assetId)})` : ''}; ele acompanha o ator.`);
}
export function detachVfx(session: EditorSession, entity: Entity): void {
    const current = entity.vfx;
    if (!current)
        return;
    session.history.execute(new SetValueCommand<VfxSettings | null>(`Remover efeito de ${entity.name}`, (value) => {
        entity.vfx = value;
    }, current, null));
}
export function updateVfx(session: EditorSession, entity: Entity, update: (settings: VfxSettings) => VfxSettings, label: string, mergeKey?: string): void {
    const before = entity.vfx;
    if (!before)
        return;
    const after = update(before);
    if (after === before)
        return;
    session.history.execute(new SetValueCommand(label, (value) => {
        entity.vfx = value;
    }, before, after, mergeKey));
}
export function patchVfx(session: EditorSession, entity: Entity, patch: Partial<VfxSettings>, label: string, mergeKey?: string): void {
    updateVfx(session, entity, (settings) => {
        for (const key of Object.keys(patch) as Array<keyof VfxSettings>)
            if (!Object.is(settings[key], patch[key]))
                return { ...settings, ...patch };
        return settings;
    }, label, mergeKey);
}
export function endVfxEdit(session: EditorSession): void {
    session.history.endMerge();
}
export function setVfxScalar(session: EditorSession, entity: Entity, field: VfxScalarField, value: number): void {
    const settings = entity.vfx;
    if (!settings || !Number.isFinite(value))
        return;
    const limits = SCALAR_LIMITS[field];
    const clamped = clamp(value, limits.min, limits.max);
    const next = limits.integer ? Math.round(clamped) : clamped;
    if (settings[field] === next)
        return;
    patchVfx(session, entity, { [field]: next }, limits.label, `vfx:${entity.id}:${field}`);
}
export function setVfxAsset(session: EditorSession, entity: Entity, assetId: string | null): void {
    const settings = entity.vfx;
    if (!settings || settings.assetId === assetId)
        return;
    patchVfx(session, entity, { assetId }, assetId ? `Tocar ${assetName(session, assetId)} em ${entity.name}` : `Efeito ${entity.name} sem ativo`);
}
export function attachVfxAssetToEntity(session: EditorSession, entity: Entity, asset: LibraryAsset): boolean {
    if (asset.kind !== 'vfx' || !canCarryVfx(entity))
        return false;
    attachVfx(session, entity, asset.id);
    session.log.info(LOG_SOURCE, `${entity.name} agora toca ${asset.name}.`);
    return true;
}
export function playVfx(session: EditorSession, entity: Entity): void {
    if (!entity.vfx)
        return;
    if (!entity.vfx.playInEditor && session.playtest.state !== 'playing') {
        session.log.info(LOG_SOURCE, `${entity.name} não toca no editor: ligue "Tocar no editor" para vê-lo fora do jogo.`);
        return;
    }
    session.vfxWorld.system.play(entity.id);
    session.notify();
}
export function stopVfx(session: EditorSession, entity: Entity): void {
    session.vfxWorld.system.stop(entity.id);
    session.notify();
}
export function toggleVfxPause(session: EditorSession, entity: Entity): void {
    const instance = session.vfxWorld.system.instanceOf(entity.id);
    if (!instance)
        return;
    if (instance.state === 'paused')
        session.vfxWorld.system.resume(entity.id);
    else
        session.vfxWorld.system.pause(entity.id);
    session.notify();
}
