import { clamp } from '@/engine/core/math/scalar';
import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import { baseNameWithoutExtension, computeImportStats } from '@/engine/assets/import/import-types';
import { IMPORT_FORMAT_SUMMARY, importModelFile, partitionImportFiles } from '@/engine/assets/import/import-registry';
import { buildCharacterModelAsset, describeCharacterModel, MANNEQUIN_MODEL_ID, type CharacterModelAsset } from '@/engine/character/assets/character-model-asset';
import { allocateCharacterModelId, getCharacterModel, registerCharacterModel } from '@/engine/character/assets/character-model-registry';
import { findCharacterActors, findPossessableCharacter } from '@/engine/character/character-actor';
import { cloneCharacterSettings, copyCharacterSettings, type CharacterClipState, type CharacterSettings } from '@/engine/character/character-settings';
import { createPlayerCameraSettings, createPlayerSettings, type PlayerCameraSettings } from '@/engine/character/player-settings';
import { assignCharacterClip, assignCharacterScalar, syncActorModel, type CharacterScalar } from './character-operations';
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
export function setPlayerEnabled(session: EditorSession, enabled: boolean): void {
    const { player } = session.scene;
    if (player.enabled === enabled)
        return;
    player.enabled = enabled;
    session.log.info(LOG_SOURCE, enabled
        ? 'Personagem do jogador ligado: a simulação volta a criar e possuir o personagem padrão.'
        : 'Personagem do jogador desligado: a simulação não cria nem possui personagem; o controle fica por conta do código do projeto.');
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
    const { scene } = session;
    if (!assignCharacterScalar(scene.player.character, field, value))
        return;
    for (const entity of actorsSharingProfile(scene))
        syncActorModel(session, entity, false);
    session.notify();
}
export function setPlayerClip(session: EditorSession, state: CharacterClipState, assetId: string | null): void {
    if (!assignCharacterClip(session, session.scene.player.character, state, assetId))
        return;
    session.notify();
}
export function setPlayerModel(session: EditorSession, modelId: string): void {
    const { scene } = session;
    const { character } = scene.player;
    if (character.model === modelId)
        return;
    character.model = modelId;
    for (const entity of actorsSharingProfile(scene))
        syncActorModel(session, entity, true);
    const asset = getCharacterModel(modelId);
    session.log.info(LOG_SOURCE, `Modelo do jogador: ${asset ? `${asset.label} (${describeCharacterModel(asset)})` : modelId}.`);
    session.notify();
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
    const { scene } = session;
    const { player } = scene;
    const defaults = createPlayerSettings();
    const model = player.character.model;
    copyCharacterSettings(player.character, { ...defaults.character, model });
    Object.assign(player.camera, createPlayerCameraSettings());
    player.spawnIfMissing = defaults.spawnIfMissing;
    for (const entity of actorsSharingProfile(scene))
        syncActorModel(session, entity, false);
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
            const imported = await importModelFile(file, bundle);
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
