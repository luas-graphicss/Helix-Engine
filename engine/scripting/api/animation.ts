import * as mat4 from '@/engine/core/math/mat4';
import * as quat from '@/engine/core/math/quat';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { ANIMATION_PATHS, type AnimationDocument, type AnimationPath } from '@/engine/core/animation/animation-document';
import { SEMANTIC_BONES, type SemanticBone } from '@/engine/core/animation/bone-roles';
import { createEmptyDocument, createTrack, replaceTrack, setDocumentDuration, setKey, trackAt } from '@/engine/core/animation/track-editing';
import { getAnimationDocument } from '@/engine/animation/clip-registry';
import { LIMB_IDS, availableLimbs, resolveLimb, type LimbId } from '@/engine/animation/ik/limb-chains';
import { solveTwoBoneIk } from '@/engine/animation/ik/two-bone-ik';
import { AnimationPlayer, type PlayOptions } from '@/engine/animation/playback/animation-player';
import { SkeletonClip } from '@/engine/animation/skeleton-clip';
import { Pose } from '@/engine/character/rig/pose';
import { Entity } from '@/engine/core/scene/entity';
import type { Rig } from '@/engine/core/scene/rig';
import { rigOwnerOf, riggedEntities } from '@/engine/editor/animation/animation-editor';
import { ensureAnimationDocument, saveAnimationToLibrary } from '@/engine/editor/operations/animation-operations';
import { HelixArgumentError, HelixError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import { optionalNumber, requireEntity, requireFunction, requireNumber, requireObject, requireOneOf, requireString, toVec3, xyz } from '../runtime/values';
const scratchPosition = vec3.create();
const scratchRotation = quat.create();
interface ScriptPlayer {
    readonly owner: Entity;
    readonly player: AnimationPlayer;
    readonly clips: Map<string, SkeletonClip>;
    lastState: 'stopped' | 'playing' | 'paused';
    lastPhase: number;
}
export function createAnimationApi(host: RuntimeHost) {
    const { session, bus } = host;
    const players = new Map<Entity, ScriptPlayer>();
    function rigOwner(value: unknown, member: string): Entity {
        const entity = requireEntity(value, member);
        const owner = rigOwnerOf(entity);
        if (!owner || !owner.rig)
            throw new HelixArgumentError(member, `${entity.name} não tem esqueleto (nem nos filhos).`);
        return owner;
    }
    function rigOf(value: unknown, member: string): {
        owner: Entity;
        rig: Rig;
    } {
        const owner = rigOwner(value, member);
        return { owner, rig: owner.rig as Rig };
    }
    function playerOf(value: unknown, member: string): ScriptPlayer {
        const owner = rigOwner(value, member);
        let entry = players.get(owner);
        if (!entry) {
            entry = { owner, player: new AnimationPlayer(owner), clips: new Map(), lastState: 'stopped', lastPhase: 0 };
            const current = entry;
            entry.player.onEvent((event, clip) => {
                bus.emit('animation.event', { entity: owner, name: event.name, time: event.time, clip: clip.name }, owner.id);
                bus.emit(`animation.event:${event.name}`, { entity: owner, name: event.name, time: event.time, clip: clip.name }, owner.id);
            });
            players.set(owner, current);
        }
        return entry;
    }
    async function documentOf(value: unknown, member: string): Promise<AnimationDocument> {
        if (value && typeof value === 'object' && Array.isArray((value as {
            tracks?: unknown;
        }).tracks) && typeof (value as {
            duration?: unknown;
        }).duration === 'number') {
            return value as AnimationDocument;
        }
        const asset = host.resolveAsset(value, member, 'animation');
        const document = getAnimationDocument(asset.id) ?? (await ensureAnimationDocument(session, asset.id));
        if (!document)
            throw new HelixError(`${member}: não foi possível ler a animação "${asset.name}".`);
        return document;
    }
    function documentSync(value: unknown, member: string): AnimationDocument | null {
        if (value && typeof value === 'object' && Array.isArray((value as {
            tracks?: unknown;
        }).tracks))
            return value as AnimationDocument;
        const asset = host.resolveAsset(value, member, 'animation');
        return getAnimationDocument(asset.id);
    }
    function clipFor(entry: ScriptPlayer, document: AnimationDocument, key: string | null): SkeletonClip {
        if (key) {
            const cached = entry.clips.get(key);
            if (cached && cached.document === document)
                return cached;
        }
        const clip = new SkeletonClip(document, entry.player.rig);
        if (key)
            entry.clips.set(key, clip);
        if (clip.unresolvedJoints.length > 0 && clip.unresolvedJoints.length === document.tracks.length) {
            host.log('warn', `A animação "${document.name}" não encontrou nenhuma junta em ${entry.owner.name}: nomes do esqueleto diferentes (${clip.unresolvedJoints.slice(0, 4).join(', ')}…).`);
        }
        return clip;
    }
    function playOptions(value: unknown, member: string): PlayOptions {
        if (value === undefined || value === null)
            return {};
        const options = requireObject(value, member, 'as opções de reprodução');
        const out: PlayOptions = {};
        if (options.loop !== undefined)
            out.loop = Boolean(options.loop);
        if (options.speed !== undefined)
            out.speed = requireNumber(options.speed, member, 'speed');
        if (options.fadeIn !== undefined)
            out.fadeIn = requireNumber(options.fadeIn, member, 'fadeIn');
        if (options.startTime !== undefined)
            out.startTime = requireNumber(options.startTime, member, 'startTime');
        return out;
    }
    function setLocomotion(owner: Entity, enabled: boolean): void {
        const characters = session.playtest.characters;
        if (!characters)
            return;
        for (const instance of characters.instances) {
            if (instance.entity === owner || rigOwnerOf(instance.entity) === owner)
                instance.locomotionEnabled = enabled;
        }
    }
    function locomotionOf(owner: Entity): boolean {
        const characters = session.playtest.characters;
        if (!characters)
            return true;
        for (const instance of characters.instances) {
            if (instance.entity === owner || rigOwnerOf(instance.entity) === owner)
                return instance.locomotionEnabled;
        }
        return true;
    }
    async function play(entityValue: unknown, clipValue: unknown, optionsValue?: unknown): Promise<AnimationPlayer> {
        const member = 'helix.animation.play';
        const entry = playerOf(entityValue, member);
        const document = await documentOf(clipValue, member);
        const key = typeof clipValue === 'string' ? clipValue : null;
        const clip = clipFor(entry, document, key);
        if (!host.running)
            return entry.player;
        setLocomotion(entry.owner, false);
        entry.player.play(clip, playOptions(optionsValue, member));
        entry.lastState = entry.player.playbackState;
        entry.lastPhase = entry.player.phase;
        bus.emit('animation.started', { entity: entry.owner, clip: clip.name, duration: clip.duration }, entry.owner.id);
        return entry.player;
    }
    function wrapPlayer(entry: ScriptPlayer) {
        const { player, owner } = entry;
        return {
            get entity() {
                return owner;
            },
            get clip() {
                return player.currentClip?.name ?? null;
            },
            get state() {
                return player.playbackState;
            },
            get playing() {
                return player.playing;
            },
            get time() {
                return player.time;
            },
            set time(value: number) {
                player.seek(requireNumber(value, 'player.time'));
            },
            get speed() {
                return player.speed;
            },
            set speed(value: number) {
                player.setSpeed(requireNumber(value, 'player.speed'));
            },
            get loop() {
                return player.loop;
            },
            set loop(value: boolean) {
                player.setLoop(Boolean(value));
            },
            get duration() {
                return player.duration;
            },
            get phase() {
                return player.phase;
            },
            play: (clip: unknown, options?: unknown) => play(owner, clip, options),
            pause: () => player.pause(),
            resume: () => player.resume(),
            togglePlay: () => player.togglePlay(),
            stop: () => {
                player.stop();
                setLocomotion(owner, true);
            },
            seek: (time: unknown) => player.seek(requireNumber(time, 'player.seek', 'o tempo')),
            setSpeed: (speed: unknown) => player.setSpeed(requireNumber(speed, 'player.setSpeed', 'a velocidade')),
            setLoop: (loop: unknown) => player.setLoop(Boolean(loop)),
            rest: () => player.rest(),
            onEvent: (handler: unknown) => {
                const fn = requireFunction<(event: {
                    name: string;
                    time: number;
                    clip: string;
                }) => void>(handler, 'player.onEvent');
                const scriptOwner = host.current;
                return player.onEvent((event, clip) => host.invoke(scriptOwner, 'animation.event', () => fn({ name: event.name, time: event.time, clip: clip.name })));
            },
            exclude: (joint: unknown, excluded: unknown = true) => {
                const entity = jointEntity(owner, joint, 'player.exclude');
                if (excluded)
                    player.excluded.add(entity);
                else
                    player.excluded.delete(entity);
            },
        };
    }
    function jointEntity(owner: Entity, jointValue: unknown, member: string): Entity {
        const rig = owner.rig as Rig;
        if (jointValue instanceof Entity) {
            if (rig.jointIndex(jointValue) === -1)
                throw new HelixArgumentError(member, `${jointValue.name} não é junta de ${owner.name}.`);
            return jointValue;
        }
        if (typeof jointValue === 'number') {
            const joint = rig.joints[jointValue];
            if (!joint)
                throw new HelixArgumentError(member, `junta ${jointValue} fora do esqueleto (${rig.jointCount} juntas).`);
            return joint;
        }
        const name = requireString(jointValue, member, 'a junta');
        let index = rig.jointByName(name);
        if (index === -1 && (SEMANTIC_BONES as readonly string[]).includes(name))
            index = rig.semantic[name as SemanticBone];
        if (index === -1)
            throw new HelixArgumentError(member, `junta "${name}" não existe em ${owner.name}. Juntas: ${rig.names.slice(0, 8).join(', ')}${rig.names.length > 8 ? '…' : ''}.`);
        return rig.joints[index];
    }
    function describeRig(rig: Rig) {
        const roles: Partial<Record<SemanticBone, string>> = {};
        for (const role of SEMANTIC_BONES) {
            const index = rig.semantic[role];
            if (index !== -1)
                roles[role] = rig.names[index];
        }
        return {
            name: rig.name,
            jointCount: rig.jointCount,
            joints: rig.names.map((name, index) => ({ name, parent: rig.parents[index], entity: rig.joints[index] })),
            roles,
            profile: rig.profile,
            unitScale: rig.unitScale,
            limbs: availableLimbs(rig),
        };
    }
    function tick(dt: number): void {
        for (const [owner, entry] of players) {
            if (!session.scene.root.contains(owner)) {
                players.delete(owner);
                continue;
            }
            const { player } = entry;
            if (!player.currentClip)
                continue;
            const before = player.phase;
            player.update(dt);
            const state = player.playbackState;
            if (entry.lastState === 'playing' && state === 'paused' && !player.loop) {
                bus.emit('animation.finished', { entity: owner, clip: player.currentClip.name }, owner.id);
            }
            else if (state === 'playing' && player.loop && player.phase < before && dt > 0) {
                bus.emit('animation.looped', { entity: owner, clip: player.currentClip.name }, owner.id);
            }
            entry.lastState = state;
            entry.lastPhase = player.phase;
        }
    }
    host.updaters.add(tick);
    host.disposers.add(() => {
        for (const entry of players.values()) {
            entry.player.stop();
            setLocomotion(entry.owner, true);
        }
        players.clear();
    });
    const ik = {
        limbs: () => LIMB_IDS.slice(),
        available: (entity: unknown) => availableLimbs(rigOf(entity, 'helix.animation.ik.available').rig),
        solve: (entity: unknown, limbValue: unknown, targetValue: unknown, poleValue?: unknown) => {
            const member = 'helix.animation.ik.solve';
            const { rig } = rigOf(entity, member);
            const limb = requireOneOf(limbValue, LIMB_IDS, member, 'o membro') as LimbId;
            const joints = resolveLimb(rig, limb);
            if (!joints)
                throw new HelixArgumentError(member, `o esqueleto não tem as juntas do membro ${limb}.`);
            const target = toVec3(targetValue, member);
            const pole = poleValue === undefined || poleValue === null ? null : toVec3(poleValue, member);
            session.scene.updateWorldMatrices();
            return solveTwoBoneIk({ upper: rig.joints[joints.upper], lower: rig.joints[joints.lower], end: rig.joints[joints.end] }, target, pole);
        },
    };
    const api = {
        document: (asset: unknown) => documentOf(asset, 'helix.animation.document'),
        documentSync: (asset: unknown) => documentSync(asset, 'helix.animation.documentSync'),
        clip: async (entity: unknown, asset: unknown) => {
            const entry = playerOf(entity, 'helix.animation.clip');
            const document = await documentOf(asset, 'helix.animation.clip');
            return clipFor(entry, document, typeof asset === 'string' ? asset : null);
        },
        player: (entity: unknown) => wrapPlayer(playerOf(entity, 'helix.animation.player')),
        hasPlayer: (entity: unknown) => {
            const owner = rigOwnerOf(requireEntity(entity, 'helix.animation.hasPlayer'));
            return owner !== null && players.has(owner);
        },
        play,
        pause: (entity: unknown) => playerOf(entity, 'helix.animation.pause').player.pause(),
        resume: (entity: unknown) => playerOf(entity, 'helix.animation.resume').player.resume(),
        togglePlay: (entity: unknown) => playerOf(entity, 'helix.animation.togglePlay').player.togglePlay(),
        stop: (entity: unknown) => {
            const entry = playerOf(entity, 'helix.animation.stop');
            entry.player.stop();
            setLocomotion(entry.owner, true);
        },
        seek: (entity: unknown, time: unknown) => playerOf(entity, 'helix.animation.seek').player.seek(requireNumber(time, 'helix.animation.seek', 'o tempo')),
        setSpeed: (entity: unknown, speed: unknown) => playerOf(entity, 'helix.animation.setSpeed').player.setSpeed(requireNumber(speed, 'helix.animation.setSpeed', 'a velocidade')),
        setLoop: (entity: unknown, loop: unknown) => playerOf(entity, 'helix.animation.setLoop').player.setLoop(Boolean(loop)),
        rest: (entity: unknown) => {
            const entry = playerOf(entity, 'helix.animation.rest');
            entry.player.stop();
            entry.player.rest();
        },
        onEvent: (entity: unknown, handler: unknown) => wrapPlayer(playerOf(entity, 'helix.animation.onEvent')).onEvent(handler),
        locomotion: (entity: unknown, enabled?: unknown) => {
            const owner = rigOwner(entity, 'helix.animation.locomotion');
            if (enabled === undefined)
                return locomotionOf(owner);
            setLocomotion(owner, Boolean(enabled));
            return Boolean(enabled);
        },
        rig: (entity: unknown) => describeRig(rigOf(entity, 'helix.animation.rig').rig),
        hasRig: (entity: unknown) => rigOwnerOf(requireEntity(entity, 'helix.animation.hasRig')) !== null,
        rigged: () => riggedEntities(session),
        roles: () => SEMANTIC_BONES.slice(),
        joint: (entity: unknown, joint: unknown) => jointEntity(rigOwner(entity, 'helix.animation.joint'), joint, 'helix.animation.joint'),
        jointByRole: (entity: unknown, role: unknown) => {
            const { rig } = rigOf(entity, 'helix.animation.jointByRole');
            const name = requireOneOf(role, SEMANTIC_BONES, 'helix.animation.jointByRole', 'o papel') as SemanticBone;
            const index = rig.semantic[name];
            return index === -1 ? null : (rig.joints[index] ?? null);
        },
        jointWorld: (entity: unknown, joint: unknown) => {
            const owner = rigOwner(entity, 'helix.animation.jointWorld');
            const target = jointEntity(owner, joint, 'helix.animation.jointWorld');
            session.scene.updateWorldMatrices();
            mat4.getTranslation(scratchPosition, target.worldMatrix);
            quat.fromMat4Rotation(scratchRotation, target.worldMatrix);
            return { position: xyz(scratchPosition), rotation: { x: scratchRotation[0], y: scratchRotation[1], z: scratchRotation[2], w: scratchRotation[3] } };
        },
        attach: (entity: unknown, target: unknown, joint: unknown, offset?: unknown) => {
            const member = 'helix.animation.attach';
            const child = requireEntity(entity, member, 'o ator a prender');
            const owner = rigOwner(target, member);
            const socket = jointEntity(owner, joint, member);
            if (child.contains(socket))
                throw new HelixError(`${member}: ${socket.name} está dentro de ${child.name}.`);
            session.scene.updateWorldMatrices();
            socket.insert(child, socket.children.length);
            const options = offset === undefined || offset === null ? {} : requireObject(offset, member, 'o deslocamento');
            if (options.position !== undefined)
                toVec3(options.position, member, child.transform.position);
            else
                vec3.set(child.transform.position, 0, 0, 0);
            if (options.rotation !== undefined)
                toVec3(options.rotation, member, child.transform.rotation);
            else
                vec3.set(child.transform.rotation, 0, 0, 0);
            if (options.scale !== undefined)
                toVec3(options.scale, member, child.transform.scale);
            bus.emit('scene.reparented', { entity: child, oldParent: null });
            session.notify();
            return child;
        },
        evaluate: (entity: unknown, time?: unknown) => {
            const entry = playerOf(entity, 'helix.animation.evaluate');
            const { player } = entry;
            const pose = new Pose(player.rig.jointCount);
            if (time !== undefined) {
                const clip = player.currentClip;
                if (!clip)
                    throw new HelixError('helix.animation.evaluate: o player não tem clipe.');
                clip.evaluate(requireNumber(time, 'helix.animation.evaluate', 'o tempo'), pose, player.loop);
            }
            else {
                player.evaluate(pose);
            }
            return player.rig.names.map((name, index) => {
                const rotation = pose.rotation(index);
                return { name, position: xyz(pose.position(index)), rotation: { x: rotation[0], y: rotation[1], z: rotation[2], w: rotation[3] }, scale: xyz(pose.scale(index)) };
            });
        },
        ik,
        paths: () => ANIMATION_PATHS.slice(),
        create: (name: unknown, options?: unknown) => {
            const member = 'helix.animation.create';
            const settings = options === undefined ? {} : requireObject(options, member);
            return createEmptyDocument(requireString(name, member), {
                frameRate: settings.frameRate === undefined ? undefined : requireNumber(settings.frameRate, member, 'frameRate'),
                duration: settings.duration === undefined ? undefined : requireNumber(settings.duration, member, 'duration'),
                loop: settings.loop === undefined ? undefined : Boolean(settings.loop),
            });
        },
        setKey: (document: unknown, joint: unknown, path: unknown, time: unknown, value: unknown) => {
            const member = 'helix.animation.setKey';
            const doc = requireDocument(document, member);
            const jointName = requireString(joint, member, 'a junta');
            const trackPath = requireOneOf(path, ANIMATION_PATHS, member, 'o caminho') as AnimationPath;
            const at = requireNumber(time, member, 'o tempo');
            const values = keyValue(value, trackPath, member);
            const existing = trackAt(doc, jointName, trackPath) ?? createTrack(jointName, trackPath);
            let next = replaceTrack(doc, jointName, trackPath, setKey(existing, at, values));
            if (at > next.duration)
                next = setDocumentDuration(next, at);
            return next;
        },
        addEvent: (document: unknown, time: unknown, name: unknown) => {
            const member = 'helix.animation.addEvent';
            const doc = requireDocument(document, member);
            const events = [...doc.events, { time: requireNumber(time, member, 'o tempo'), name: requireString(name, member, 'o nome do evento') }].sort((a, b) => a.time - b.time);
            return { ...doc, events };
        },
        setDuration: (document: unknown, seconds: unknown) => setDocumentDuration(requireDocument(document, 'helix.animation.setDuration'), requireNumber(seconds, 'helix.animation.setDuration', 'a duração')),
        save: async (document: unknown, name?: unknown) => {
            const doc = requireDocument(document, 'helix.animation.save');
            const named = name === undefined ? doc : { ...doc, name: requireString(name, 'helix.animation.save') };
            const asset = await saveAnimationToLibrary(session, named);
            if (!asset)
                throw new HelixError('helix.animation.save: não foi possível salvar a animação na biblioteca.');
            return asset;
        },
        tick: (dt: unknown) => tick(optionalNumber(dt, host.time.delta, 'helix.animation.tick')),
        get playing() {
            let count = 0;
            for (const entry of players.values())
                if (entry.player.playing)
                    count++;
            return count;
        },
    };
    function requireDocument(value: unknown, member: string): AnimationDocument {
        if (value && typeof value === 'object' && Array.isArray((value as {
            tracks?: unknown;
        }).tracks))
            return value as AnimationDocument;
        throw new HelixArgumentError(member, 'esperava um AnimationDocument (helix.animation.create ou helix.animation.document).');
    }
    function keyValue(value: unknown, path: AnimationPath, member: string): Float32Array {
        const size = path === 'rotation' ? 4 : 3;
        if (value && typeof value === 'object' && !Array.isArray(value) && !ArrayBuffer.isView(value)) {
            const v = value as {
                x?: unknown;
                y?: unknown;
                z?: unknown;
                w?: unknown;
            };
            const out = new Float32Array(size);
            out[0] = requireNumber(v.x, member, 'x');
            out[1] = requireNumber(v.y, member, 'y');
            out[2] = requireNumber(v.z, member, 'z');
            if (size === 4)
                out[3] = v.w === undefined ? 1 : requireNumber(v.w, member, 'w');
            return out;
        }
        const list = value as ArrayLike<number>;
        if (!list || typeof list.length !== 'number' || list.length < size) {
            if (path === 'rotation' && list && list.length === 3) {
                const euler: Vec3 = vec3.set(vec3.create(), list[0], list[1], list[2]);
                const q = quat.fromEulerDegrees(quat.create(), euler);
                return new Float32Array([q[0], q[1], q[2], q[3]]);
            }
            throw new HelixArgumentError(member, `o valor de ${path} precisa de ${size} números.`);
        }
        const out = new Float32Array(size);
        for (let i = 0; i < size; i++)
            out[i] = Number(list[i]);
        return out;
    }
    return api;
}
export type AnimationApi = ReturnType<typeof createAnimationApi>;
