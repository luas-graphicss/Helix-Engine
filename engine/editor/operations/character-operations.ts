import * as vec3 from '@/engine/core/math/vec3';
import { clamp } from '@/engine/core/math/scalar';
import type { Entity } from '@/engine/core/scene/entity';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import { createCharacterActor, redressCharacterActor, refitCharacterModel } from '@/engine/character/character-actor';
import { cloneCharacterSettings, copyCharacterSettings, type CharacterClipState, type CharacterSettings } from '@/engine/character/character-settings';
import { ensureAnimationDocument } from './animation-operations';
import { addEntity, spawnPosition } from './entity-operations';
export type CharacterScalar = Exclude<keyof CharacterSettings, 'autoPossess' | 'model' | 'clips'>;
const MIN_CAPSULE_BODY = 0.05;
export const CHARACTER_SCALAR_RANGE: Record<CharacterScalar, [
    number,
    number
]> = {
    radius: [0.1, 2],
    height: [0.5, 6],
    crouchHeight: [0.4, 6],
    walkSpeed: [0, 20],
    runSpeed: [0, 40],
    crouchSpeed: [0, 10],
    acceleration: [1, 200],
    braking: [1, 200],
    airControl: [0, 1],
    jumpHeight: [0, 10],
    maxSlopeDegrees: [0, 89],
    stepHeight: [0, 2],
    rotationRate: [30, 3600],
    mass: [1, 10000],
};
export const CHARACTER_SCALAR_LABEL: Record<CharacterScalar, string> = {
    radius: 'Raio da cápsula',
    height: 'Altura em pé',
    crouchHeight: 'Altura agachado',
    walkSpeed: 'Velocidade de andar',
    runSpeed: 'Velocidade de corrida',
    crouchSpeed: 'Velocidade agachado',
    acceleration: 'Aceleração',
    braking: 'Frenagem',
    airControl: 'Controle aéreo',
    jumpHeight: 'Altura do pulo',
    maxSlopeDegrees: 'Inclinação máxima',
    stepHeight: 'Altura do degrau',
    rotationRate: 'Velocidade de giro',
    mass: 'Massa',
};
export function constrainCapsule(settings: CharacterSettings): void {
    const minimum = 2 * settings.radius + MIN_CAPSULE_BODY;
    settings.height = Math.max(settings.height, minimum);
    settings.crouchHeight = clamp(settings.crouchHeight, minimum, settings.height);
}
export function assignCharacterScalar(settings: CharacterSettings, field: CharacterScalar, value: number): boolean {
    if (!Number.isFinite(value))
        return false;
    const [min, max] = CHARACTER_SCALAR_RANGE[field];
    const next = clamp(value, min, max);
    if (settings[field] === next)
        return false;
    settings[field] = next;
    constrainCapsule(settings);
    return true;
}
export function assignCharacterClip(session: EditorSession, settings: CharacterSettings, state: CharacterClipState, assetId: string | null): boolean {
    if ((settings.clips[state] ?? null) === assetId)
        return false;
    if (assetId === null)
        delete settings.clips[state];
    else {
        settings.clips[state] = assetId;
        void ensureAnimationDocument(session, assetId).then((document) => {
            if (document)
                session.notify();
        });
    }
    return true;
}
export function setCharacterClip(session: EditorSession, entity: Entity, state: CharacterClipState, assetId: string | null): void {
    const settings = entity.character;
    if (!settings || !assignCharacterClip(session, settings, state, assetId))
        return;
    session.notify();
}
export function addCharacter(session: EditorSession): Entity {
    const entity = createCharacterActor(session.scene, null, { settings: cloneCharacterSettings(session.scene.player.character), onRigReady: () => session.notify() });
    vec3.copy(entity.transform.position, spawnPosition(session, null));
    return addEntity(session, entity);
}
export function syncActorModel(session: EditorSession, entity: Entity, modelChanged: boolean): void {
    if (!modelChanged) {
        refitCharacterModel(session.scene, entity);
        return;
    }
    const selected = session.selectedEntity;
    if (selected && selected !== entity && entity.contains(selected))
        session.select(entity);
    void redressCharacterActor(session.scene, entity).then(() => {
        session.playtest.characters?.rebind(entity);
        session.notify();
    });
}
function commitSettings(session: EditorSession, entity: Entity, label: string, after: CharacterSettings, mergeKey?: string): void {
    const target = entity.character;
    if (!target)
        return;
    const apply = (value: CharacterSettings) => {
        const modelChanged = target.model !== value.model;
        copyCharacterSettings(target, value);
        syncActorModel(session, entity, modelChanged);
    };
    session.history.execute(new SetValueCommand(label, apply, cloneCharacterSettings(target), after, mergeKey));
}
export function setCharacterScalar(session: EditorSession, entity: Entity, field: CharacterScalar, value: number): void {
    const settings = entity.character;
    if (!settings)
        return;
    const after = cloneCharacterSettings(settings);
    if (!assignCharacterScalar(after, field, value))
        return;
    commitSettings(session, entity, CHARACTER_SCALAR_LABEL[field], after, `character:${entity.id}:${field}`);
}
export function setCharacterAutoPossess(session: EditorSession, entity: Entity, autoPossess: boolean): void {
    const settings = entity.character;
    if (!settings || settings.autoPossess === autoPossess)
        return;
    const after = cloneCharacterSettings(settings);
    after.autoPossess = autoPossess;
    commitSettings(session, entity, autoPossess ? 'Possuir ao simular' : 'Não possuir ao simular', after);
}
export function setCharacterModel(session: EditorSession, entity: Entity, modelId: string): void {
    const settings = entity.character;
    if (!settings || settings.model === modelId)
        return;
    const after = cloneCharacterSettings(settings);
    after.model = modelId;
    commitSettings(session, entity, 'Modelo do personagem', after);
}
