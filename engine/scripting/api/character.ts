import * as vec3 from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import type { Vec3 } from '@/engine/core/math/vec3';
import { Entity } from '@/engine/core/scene/entity';
import type { CharacterInstance, CharacterRuntime } from '@/engine/character/character-runtime';
import { createCharacterActor, defaultActorName, defaultSpawnPosition, findPossessableCharacter } from '@/engine/character/character-actor';
import { uniqueEntityName } from '@/engine/core/scene/entity-utils';
import { HelixArgumentError, HelixError, HelixNotImplementedError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import { assignSettings, requireEntity, requireNumber, requireObject, toVec3 } from '../runtime/values';
const scratchQuat = quat.create();
const scratchEuler = vec3.create();
export function createCharacterApi(host: RuntimeHost) {
    const { session } = host;
    const { scene } = session;
    const wrappers = new WeakMap<CharacterInstance, object>();
    function runtime(member: string): CharacterRuntime {
        const characters = session.playtest.characters;
        if (!characters)
            throw new HelixError(`${member}: o sistema de personagem só existe com a simulação em andamento e o personagem do jogador ligado (scene.player.enabled).`);
        return characters;
    }
    function instanceOf(value: unknown, member: string): CharacterInstance {
        const entity = requireEntity(value, member);
        const instance = runtime(member).ensureInstance(entity);
        if (!instance)
            throw new HelixArgumentError(member, `${entity.name} não é um personagem da simulação (precisa do componente character).`);
        return instance;
    }
    function wrap(instance: CharacterInstance) {
        const cached = wrappers.get(instance);
        if (cached)
            return cached;
        const { controller, entity } = instance;
        const wrapper = {
            get entity() {
                return entity;
            },
            get settings() {
                return entity.character;
            },
            get isGrounded() {
                return controller.grounded;
            },
            get isCrouching() {
                return controller.crouching;
            },
            get horizontalSpeed() {
                return controller.horizontalSpeed;
            },
            get velocity() {
                return controller.velocity;
            },
            get position() {
                return controller.position;
            },
            get groundNormal() {
                return controller.groundNormal;
            },
            get height() {
                return controller.height;
            },
            get yaw() {
                return controller.yaw;
            },
            get rigidBody() {
                return controller.rigidBody;
            },
            get intent() {
                return controller.intent;
            },
            get hasRig() {
                return instance.rig !== null;
            },
            get isPossessed() {
                return session.playtest.characters?.possessed === instance;
            },
            move: (x: unknown, z: unknown) => {
                const move = controller.intent.move;
                vec3.set(move, requireNumber(x, 'character.move', 'x'), 0, requireNumber(z, 'character.move', 'z'));
                const length = vec3.length(move);
                if (length > 1)
                    vec3.scale(move, move, 1 / length);
            },
            moveRelative: (forward: unknown, right: unknown) => {
                const characters = runtime('character.moveRelative');
                const f = vec3.create();
                const r = vec3.create();
                characters.thirdPersonCamera.moveBasis(f, r);
                const move = controller.intent.move;
                vec3.set(move, 0, 0, 0);
                vec3.scaleAndAdd(move, move, f, requireNumber(forward, 'character.moveRelative', 'frente'));
                vec3.scaleAndAdd(move, move, r, requireNumber(right, 'character.moveRelative', 'direita'));
                const length = vec3.length(move);
                if (length > 1)
                    vec3.scale(move, move, 1 / length);
            },
            look: (dx: unknown, dy: unknown) => {
                runtime('character.look').thirdPersonCamera.rotate(requireNumber(dx, 'character.look', 'dx'), requireNumber(dy, 'character.look', 'dy'));
            },
            jump: () => {
                controller.intent.jump = true;
            },
            run: (value: unknown) => {
                controller.intent.run = Boolean(value);
            },
            crouch: (value: unknown) => {
                controller.intent.crouch = Boolean(value);
            },
            stop: () => {
                vec3.set(controller.intent.move, 0, 0, 0);
                controller.intent.run = false;
                controller.intent.jump = false;
            },
            setIntent: (partial: unknown) => {
                const patch = requireObject(partial, 'character.setIntent', 'a intenção');
                if (patch.move !== undefined) {
                    toVec3(patch.move, 'character.setIntent.move', controller.intent.move);
                    controller.intent.move[1] = 0;
                    const length = vec3.length(controller.intent.move);
                    if (length > 1)
                        vec3.scale(controller.intent.move, controller.intent.move, 1 / length);
                }
                if (patch.run !== undefined)
                    controller.intent.run = Boolean(patch.run);
                if (patch.crouch !== undefined)
                    controller.intent.crouch = Boolean(patch.crouch);
                if (patch.jump)
                    controller.intent.jump = true;
            },
            teleport: (positionValue: unknown, yaw?: unknown) => {
                const position = toVec3(positionValue, 'character.teleport');
                if (yaw !== undefined) {
                    controller.yaw = requireNumber(yaw, 'character.teleport', 'o rumo em graus');
                    controller.previousYaw = controller.yaw;
                }
                quat.fromEulerDegrees(scratchQuat, vec3.set(scratchEuler, 0, controller.yaw, 0));
                const center = vec3.create(position[0], position[1] + controller.height / 2, position[2]);
                const { physics } = session.playtest;
                if (physics)
                    physics.world.teleport(controller.rigidBody, center, scratchQuat);
                vec3.copy(controller.position, position);
                vec3.copy(controller.previousPosition, position);
                vec3.set(controller.velocity, 0, 0, 0);
            },
            applySettings: (patch: unknown) => {
                if (!entity.character)
                    throw new HelixError('character.applySettings: o ator perdeu o componente character.');
                assignSettings(entity.character as unknown as Record<string, unknown>, patch, 'character.applySettings');
                session.notify();
            },
        };
        wrappers.set(instance, wrapper);
        return wrapper;
    }
    return {
        of: (value: unknown) => wrap(instanceOf(value, 'helix.character.of')),
        has: (value: unknown) => {
            const entity = requireEntity(value, 'helix.character.has');
            return (session.playtest.characters?.ensureInstance(entity) ?? null) !== null;
        },
        all: () => (session.playtest.characters?.instances ?? []).map((instance) => wrap(instance)),
        get inputSource(): 'engine' | 'script' {
            return session.playtest.characters?.inputSource ?? 'engine';
        },
        set inputSource(value: 'engine' | 'script') {
            if (value !== 'engine' && value !== 'script')
                throw new HelixArgumentError('helix.character.inputSource', 'esperava "engine" ou "script".');
            runtime('helix.character.inputSource').inputSource = value;
        },
        get inputFrame() {
            return session.playtest.characters?.lastFrame ?? null;
        },
        settingsOf: (value: unknown) => requireEntity(value, 'helix.character.settingsOf').character,
        spawn: (options?: unknown) => {
            const extra = options === undefined ? {} : requireObject(options, 'helix.character.spawn');
            const overrides = extra.character === undefined ? {} : requireObject(extra.character, 'helix.character.spawn', 'character');
            const settings = { ...scene.player.character, ...overrides };
            const parent = extra.parent instanceof Entity ? extra.parent : scene.root;
            const entity = createCharacterActor(scene, parent, {
                name: typeof extra.name === 'string' && extra.name ? uniqueEntityName(scene, extra.name) : uniqueEntityName(scene, defaultActorName(settings.model)),
                settings: settings as typeof scene.player.character,
                onRigReady: () => session.notify(),
            });
            if (extra.position !== undefined)
                toVec3(extra.position, 'helix.character.spawn.position', entity.transform.position);
            else
                defaultSpawnPosition(scene, entity.transform.position);
            host.trackSpawned(entity);
            host.requestActorSync();
            session.notify();
            return entity;
        },
        findPossessable: () => findPossessableCharacter(scene),
        get controllerClass() {
            return null;
        },
        set controllerClass(_value: unknown) {
            throw new HelixNotImplementedError('helix.character.controllerClass', 'substituir o controlador por classe própria ainda não é suportado; use rigidBody cinemático + moveKinematic.');
        },
        onLanded: (handler: unknown) => host.bus.on('character.landed', handler as (payload: unknown) => void, host.current),
        onJumped: (handler: unknown) => host.bus.on('character.jumped', handler as (payload: unknown) => void, host.current),
    };
}
export function createPlayerApi(host: RuntimeHost) {
    const { session } = host;
    const { scene } = session;
    return {
        get settings() {
            return scene.player;
        },
        set: (patch: unknown) => {
            assignSettings(scene.player as unknown as Record<string, unknown>, patch, 'helix.player.set');
            session.playtest.syncPlayer();
            session.notify();
        },
        get enabled() {
            return scene.player.enabled;
        },
        set enabled(value: boolean) {
            scene.player.enabled = Boolean(value);
            session.playtest.syncPlayer();
        },
        get possessed(): Entity | null {
            return session.playtest.characters?.possessed?.entity ?? null;
        },
        get isPossessing() {
            return session.playtest.isPossessing;
        },
        possess: (value: unknown) => {
            const characters = session.playtest.characters;
            if (!characters)
                throw new HelixError('helix.player.possess: o sistema de personagem não está ativo (simulação parada ou player desligado).');
            const entity = value === null ? null : requireEntity(value, 'helix.player.possess');
            if (!characters.possess(entity))
                throw new HelixArgumentError('helix.player.possess', `${entity?.name ?? 'o ator'} não é um personagem da simulação.`);
            host.bus.emit('player.possessed', entity);
            session.notify();
        },
        unpossess: () => {
            const characters = session.playtest.characters;
            if (!characters)
                return;
            characters.possess(null);
            host.bus.emit('player.possessed', null);
            session.notify();
        },
        get cameraControl(): 'engine' | 'script' {
            return session.playtest.characters?.cameraControl ?? 'engine';
        },
        set cameraControl(value: 'engine' | 'script') {
            if (value !== 'engine' && value !== 'script')
                throw new HelixArgumentError('helix.player.cameraControl', 'esperava "engine" ou "script".');
            const characters = session.playtest.characters;
            if (characters)
                characters.cameraControl = value;
        },
        get pointerLocked() {
            return session.playtest.pointerLocked;
        },
        get transientCharacter() {
            return session.playtest.transientCharacter;
        },
        get spawnPoint(): Vec3 {
            return defaultSpawnPosition(scene, vec3.create());
        },
        onPossessed: (handler: unknown) => host.bus.on('player.possessed', handler as (payload: unknown) => void, host.current),
    };
}
