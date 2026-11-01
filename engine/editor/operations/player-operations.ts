import { clamp } from '@/engine/core/math/scalar';
import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import { baseNameWithoutExtension, computeImportStats } from '@/engine/assets/import/import-types';
import { IMPORT_FORMAT_SUMMARY, partitionImportFiles } from '@/engine/assets/import/import-registry';
import { readModelFile } from '@/engine/assets/import/import-worker-client';
import { buildCharacterModelAsset, describeCharacterModel, MANNEQUIN_MODEL_ID, type CharacterModelAsset } from '@/engine/character/assets/character-model-asset';
import { allocateCharacterModelId, getCharacterModel, registerCharacterModel } from '@/engine/character/assets/character-model-registry';
import { findCharacterActors, findPossessableCharacter } from '@/engine/character/character-actor';
import { cloneCharacterSettings, copyCharacterSettings, type CharacterClipState, type CharacterSettings } from '@/engine/character/character-settings';
import { createPlayerCameraSettings, createPlayerSettings, type PlayerCameraSettings } from '@/engine/character/player-settings';
import { assignCharacterClip, assignCharacterScalar, CHARACTER_SCALAR_LABEL, syncActorModel, type CharacterScalar } from './character-operations';
const LOG_SOURCE = 'Personagem';
export type PlayerCameraScalar = Exclude<keyof PlayerCameraSettings, 'invertY'>;
const CAMERA_RANGE: Record<PlayerCameraScalar, [
    number,
    number
]> = {
    distance: [0.5, 30],
    minDistance: [0.5, 30],
    maxDistance: [0.5, 30],
    pitch: [-89, 89],
    minPitch: [-89, 89],
    maxPitch: [-89, 89],
    sensitivity: [0.01, 1],
    pivotHeight: [0, 2],
};
function actorsSharingProfile(scene: Scene): Entity[] {
    return findCharacterActors(scene).filter((entity) => entity.character === scene.player.character);
}
export function independentCharacterActors(scene: Scene): Entity[] {
    return findCharacterActors(scene).filter((entity) => entity.character !== scene.player.character);
}
export function playerCharacterActor(session: EditorSession): Entity | null {
    const { scene } = session;
    const actor = session.playtest.characters?.possessed?.entity ?? findPossessableCharacter(scene);
    return actor?.character && actor.character !== scene.player.character ? actor : null;
}
export function playerCharacterSettings(session: EditorSession): CharacterSettings {
    return playerCharacterActor(session)?.character ?? session.scene.player.character;
}
interface PlayerCharacterSnapshot {
    profile: CharacterSettings;
    actor: CharacterSettings | null;
}
function commitPlayerCharacter(session: EditorSession, label: string, mutate: (settings: CharacterSettings) => boolean, mergeKey?: string): boolean {
    const { scene } = session;
    const profile = scene.player.character;
    const actor = playerCharacterActor(session);
    const target = actor?.character ?? null;
    const after: PlayerCharacterSnapshot = { profile: cloneCharacterSettings(profile), actor: target ? cloneCharacterSettings(target) : null };
    const changedProfile = mutate(after.profile);
    const changedActor = after.actor ? mutate(after.actor) : false;
    if (!changedProfile && !changedActor)
        return false;
    const before: PlayerCharacterSnapshot = { profile: cloneCharacterSettings(profile), actor: target ? cloneCharacterSettings(target) : null };
    const apply = (value: PlayerCharacterSnapshot) => {
        const profileModelChanged = profile.model !== value.profile.model;
        copyCharacterSettings(profile, value.profile);
        for (const entity of actorsSharingProfile(scene))
            syncActorModel(session, entity, profileModelChanged);
        if (actor && target && value.actor) {
            const modelChanged = target.model !== value.actor.model;
            copyCharacterSettings(target, value.actor);
            syncActorModel(session, actor, modelChanged);
        }
    };
    session.history.execute(new SetValueCommand(label, apply, before, after, mergeKey));
    return true;
}
export function setPlayerEnabled(session: EditorSession, enabled: boolean): void {
    const { player } = session.scene;
    if (player.enabled === enabled)
        return;
    player.enabled = enabled;
    session.log.info(LOG_SOURCE, enabled
        ? 'Personagem do jogador ligado: a simulação volta a criar e possuir o personagem padrão.'
        : 'Personagem do jogador desligado: a simulação não cria nem possui personagem; o controle fica por conta do código do projeto.');
    session.playtest.syncPlayer();
    session.notify();
}
export function setPlayerSpawnIfMissing(session: EditorSession, value: boolean): void {
    const { player } = session.scene;
    if (player.spawnIfMissing === value)
        return;
    player.spawnIfMissing = value;
    session.notify();
}
export function setPlayerCharacterScalar(session: EditorSession, field: CharacterScalar, value: number): void {
    commitPlayerCharacter(session, CHARACTER_SCALAR_LABEL[field], (settings) => assignCharacterScalar(settings, field, value), `player:${field}`);
}
export function setPlayerClip(session: EditorSession, state: CharacterClipState, assetId: string | null): void {
    commitPlayerCharacter(session, assetId ? 'Clipe do personagem' : 'Clipe do modelo', (settings) => assignCharacterClip(session, settings, state, assetId));
}
export function setPlayerModel(session: EditorSession, modelId: string): void {
    const changed = commitPlayerCharacter(session, 'Modelo do personagem', (settings) => {
        if (settings.model === modelId)
            return false;
        settings.model = modelId;
        return true;
    });
    if (!changed)
        return;
    const asset = getCharacterModel(modelId);
    session.log.info(LOG_SOURCE, `Modelo do jogador: ${asset ? `${asset.label} (${describeCharacterModel(asset)})` : modelId}.`);
}
export function setPlayerCameraScalar(session: EditorSession, field: PlayerCameraScalar, value: number): void {
    if (!Number.isFinite(value))
        return;
    const { camera } = session.scene.player;
    const [min, max] = CAMERA_RANGE[field];
    const next = clamp(value, min, max);
    if (camera[field] === next)
        return;
    camera[field] = next;
    if (field === 'minDistance')
        camera.maxDistance = Math.max(camera.maxDistance, next);
    if (field === 'maxDistance')
        camera.minDistance = Math.min(camera.minDistance, next);
    if (field === 'minPitch')
        camera.maxPitch = Math.max(camera.maxPitch, next);
    if (field === 'maxPitch')
        camera.minPitch = Math.min(camera.minPitch, next);
    camera.distance = clamp(camera.distance, camera.minDistance, camera.maxDistance);
    camera.pitch = clamp(camera.pitch, camera.minPitch, camera.maxPitch);
    session.notify();
}
export function setPlayerCameraInvertY(session: EditorSession, invertY: boolean): void {
    const { camera } = session.scene.player;
    if (camera.invertY === invertY)
        return;
    camera.invertY = invertY;
    session.notify();
}
export function resetPlayerSettings(session: EditorSession): void {
    const { player } = session.scene;
    const defaults = createPlayerSettings();
    commitPlayerCharacter(session, 'Restaurar perfil padrão', (settings) => {
        copyCharacterSettings(settings, { ...defaults.character, model: settings.model, autoPossess: settings.autoPossess });
        return true;
    });
    Object.assign(player.camera, createPlayerCameraSettings());
    player.spawnIfMissing = defaults.spawnIfMissing;
    session.log.info(LOG_SOURCE, 'Perfil do jogador restaurado ao padrão.');
    session.notify();
}
interface ActorSnapshot {
    entity: Entity;
    settings: CharacterSettings;
}
export function applyPlayerProfileToActors(session: EditorSession): number {
    const { scene } = session;
    const actors = independentCharacterActors(scene);
    if (actors.length === 0)
        return 0;
    const profile = scene.player.character;
    const before: ActorSnapshot[] = actors.map((entity) => ({ entity, settings: cloneCharacterSettings(entity.character!) }));
    const after: ActorSnapshot[] = actors.map((entity) => ({
        entity,
        settings: { ...cloneCharacterSettings(profile), autoPossess: entity.character!.autoPossess },
    }));
    const apply = (snapshots: ActorSnapshot[]) => {
        for (const { entity, settings } of snapshots) {
            const target = entity.character;
            if (!target)
                continue;
            const modelChanged = target.model !== settings.model;
            copyCharacterSettings(target, settings);
            syncActorModel(session, entity, modelChanged);
        }
    };
    session.history.execute(new SetValueCommand(`Aplicar perfil a ${actors.length} ${actors.length === 1 ? 'ator' : 'atores'}`, apply, before, after));
    session.log.info(LOG_SOURCE, `Perfil do jogador aplicado a ${actors.length} ${actors.length === 1 ? 'ator' : 'atores'}.`);
    return actors.length;
}
export function hasPossessableActor(scene: Scene): boolean {
    return findPossessableCharacter(scene) !== null;
}
export async function importCharacterModelFiles(session: EditorSession, files: Iterable<File>): Promise<CharacterModelAsset | null> {
    const { models, bundle } = partitionImportFiles(files);
    if (models.length === 0) {
        session.log.warn(LOG_SOURCE, `Nenhum arquivo de modelo reconhecido (formatos aceitos: ${IMPORT_FORMAT_SUMMARY}).`);
        return null;
    }
    let last: CharacterModelAsset | null = null;
    for (const file of models) {
        const started = performance.now();
        try {
            const imported = await readModelFile(file, bundle);
            const asset = registerCharacterModel(buildCharacterModelAsset(imported, { id: allocateCharacterModelId(), label: baseNameWithoutExtension(file.name), source: file.name }));
            const stats = computeImportStats(imported);
            session.log.info(LOG_SOURCE, `${file.name} lido em ${Math.round(performance.now() - started)} ms: ${describeCharacterModel(asset)}, ${stats.triangles.toLocaleString('pt-BR')} triângulos.`);
            if (!asset.template)
                session.log.warn(LOG_SOURCE, `${file.name} não tem esqueleto: o modelo acompanha a cápsula sem animar.`);
            else if (!asset.clips)
                session.log.warn(LOG_SOURCE, `${file.name} não traz clipes: o modelo fica na pose de repouso enquanto se move.`);
            last = asset;
        }
        catch (cause) {
            session.log.error(LOG_SOURCE, `Falha ao ler "${file.name}": ${cause instanceof Error ? cause.message : String(cause)}`);
        }
    }
    if (last)
        setPlayerModel(session, last.id);
    return last;
}
export { MANNEQUIN_MODEL_ID };
