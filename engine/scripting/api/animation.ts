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
}
