import * as mat4 from '@/engine/core/math/mat4';
import * as quat from '@/engine/core/math/quat';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { clamp } from '@/engine/core/math/scalar';
import type { AnimationDocument, AnimationInterpolation, AnimationPath } from '@/engine/core/animation/animation-document';
import { boneSide } from '@/engine/core/animation/bone-roles';
import { copyDocumentKeys, createEmptyDocument, easeDocumentKeys, keyRefKey, keysAtTime, moveDocumentKeys, pasteDocumentKeys, removeDocumentKeys, sameKeyRef, setDocumentDuration, setDocumentInterpolation, setDocumentKey, setDocumentKeyValue, stretchDocument, trackAt, type KeyClipboard, type KeyEasing, type KeyRef, } from '@/engine/core/animation/track-editing';
import type { Entity } from '@/engine/core/scene/entity';
import type { Rig } from '@/engine/core/scene/rig';
import { SkeletonClip } from '@/engine/animation/skeleton-clip';
import { AnimationPlayer } from '@/engine/animation/playback/animation-player';
import { LIMB_IDS, LIMBS, resolveLimb, type LimbId } from '@/engine/animation/ik/limb-chains';
import { solveTwoBoneIk } from '@/engine/animation/ik/two-bone-ik';
import { changedPaths, readJointPath, readSnapshotPath } from '@/engine/animation/pose/joint-keys';
import type { SkeletonOverlayRequest, SkeletonOverlayRig } from '@/engine/renderer/passes/skeleton-pass';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { applyTransformSnapshot, snapshotTransform, type TransformSnapshot } from '@/engine/editor/operations/transform-operations';
export type AnimationView = 'dopesheet' | 'curves';
export type PerformerSource = {
    readonly kind: 'clip';
} | {
    readonly kind: 'asset';
    readonly assetId: string;
};
export interface Performer {
    readonly entity: Entity;
    readonly rig: Rig;
    readonly player: AnimationPlayer;
    source: PerformerSource;
    document: AnimationDocument | null;
    readonly restore: TransformSnapshot[];
    readonly overlay: SkeletonOverlayRig;
}
interface IkDrag {
    readonly performer: Performer;
    readonly limb: LimbId;
    readonly chain: {
        upper: Entity;
        lower: Entity;
        end: Entity;
    };
    readonly target: Vec3;
    readonly hint: Vec3;
}
interface KeyDrag {
    readonly base: AnimationDocument;
    readonly refs: readonly KeyRef[];
    readonly baseTime: number;
}
type Listener = () => void;
export const DEFAULT_FRAME_RATE = 30;
export const PLAYBACK_SPEEDS: readonly number[] = [0.1, 0.25, 0.5, 1, 1.5, 2];
const LOG_SOURCE = 'Animação';
const FOCUS_DISTANCE_FACTOR = 6;
const FOCUS_MIN_DISTANCE = 0.6;
const scratchPosition = vec3.create();
const scratchOther = vec3.create();
const scratchForward = vec3.create();
export function rigDisplayName(owner: Entity): string {
    return owner.parent?.character ? owner.parent.name : owner.name;
}
export function riggedEntities(session: EditorSession): Entity[] {
    const found: Entity[] = [];
    session.scene.traverse((entity) => {
        if (entity.rig)
            found.push(entity);
    });
    return found;
}
export function rigOwnerOf(entity: Entity): Entity | null {
    if (entity.rig)
        return entity;
    for (let current: Entity | null = entity; current; current = current.parent)
        if (current.rig)
            return current;
    const stack = [...entity.children];
    while (stack.length > 0) {
        const child = stack.pop() as Entity;
        if (child.rig)
            return child;
        stack.push(...child.children);
    }
    return null;
}
function isAttached(entity: Entity, root: Entity): boolean {
    let current: Entity | null = entity;
    while (current.parent)
        current = current.parent;
    return current === root;
}
export class AnimationEditor {
    document: AnimationDocument | null = null;
    assetId: string | null = null;
    dirty = false;
    readonly performers: Performer[] = [];
    time = 0;
    playing = false;
    speed = 1;
    view: AnimationView = 'dopesheet';
    autoKey = true;
    snapToFrames = true;
    showSkeleton = true;
    xray = true;
    readonly ik: Record<LimbId, boolean> = { leftArm: true, rightArm: true, leftLeg: true, rightLeg: true };
    selectedBones: readonly string[] = [];
    hoveredBone: string | null = null;
    selectedKeys: readonly KeyRef[] = [];
    readonly collapsedBones = new Set<string>();
    boneFilter = '';
    onlyAnimated = false;
    clipboard: KeyClipboard | null = null;
    private readonly pending = new Map<Entity, TransformSnapshot>();
    private ikDrag: IkDrag | null = null;
    private keyDrag: KeyDrag | null = null;
    private version = 0;
    private timeVersion = 0;
    private readonly listeners = new Set<Listener>();
    private readonly timeListeners = new Set<Listener>();
    private readonly interceptor = (entity: Entity, before: TransformSnapshot, after: TransformSnapshot): boolean => this.interceptTransform(entity, before, after);
    constructor(private readonly session: EditorSession) { }
    readonly subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    readonly getVersion = (): number => this.version;
    readonly subscribeTime = (listener: Listener): (() => void) => {
        this.timeListeners.add(listener);
        return () => this.timeListeners.delete(listener);
    };
    readonly getTimeVersion = (): number => this.timeVersion;
    private notify(): void {
        this.version++;
        for (const listener of this.listeners)
            listener();
    }
    private notifyTime(): void {
        this.timeVersion++;
        for (const listener of this.timeListeners)
            listener();
    }
    get active(): boolean {
        return this.document !== null;
    }
    get primary(): Performer | null {
        return this.performers.find((performer) => performer.source.kind === 'clip') ?? this.performers[0] ?? null;
    }
    get rig(): Rig | null {
        return this.primary?.rig ?? null;
    }
    get frameRate(): number {
        return this.document?.frameRate ?? DEFAULT_FRAME_RATE;
    }
    get duration(): number {
        return this.document?.duration ?? 0;
    }
    get frame(): number {
        return Math.round(this.time * this.frameRate);
    }
    get pendingCount(): number {
        return this.pending.size;
    }
    get ikDragging(): boolean {
        return this.ikDrag !== null;
    }
    jointEntity(name: string, performer: Performer | null = this.primary): Entity | null {
        if (!performer)
            return null;
        const index = performer.rig.jointByName(name);
        return index === -1 ? null : performer.rig.joints[index];
    }
    performerOf(entity: Entity): Performer | null {
        return this.performers.find((performer) => performer.entity === entity || performer.rig.jointIndex(entity) !== -1) ?? null;
    }
    isPerformer(entity: Entity): boolean {
        return this.performers.some((performer) => performer.entity === entity);
    }
    open(document: AnimationDocument, target: Entity | null, options: {
        assetId?: string | null;
    } = {}): boolean {
        const owner = target ? rigOwnerOf(target) : (this.primary?.entity ?? riggedEntities(this.session)[0] ?? null);
        if (!owner?.rig) {
            this.session.log.warn(LOG_SOURCE, 'Nenhum ator com esqueleto na cena para animar. Adicione um personagem ou importe um modelo com rig.');
            return false;
        }
        const wasActive = this.active;
        this.stopInteractions();
        this.document = document;
        this.assetId = options.assetId ?? null;
        this.dirty = false;
        this.time = 0;
        this.playing = false;
        this.selectedKeys = [];
        this.pending.clear();
        if (!this.isPerformer(owner))
            this.bind(owner, { kind: 'clip' });
        else {
            const performer = this.performerOf(owner);
            if (performer)
                performer.source = { kind: 'clip' };
        }
        for (const performer of this.performers)
            this.compile(performer);
        if (!wasActive)
            this.session.transformInterceptors.add(this.interceptor);
        this.session.log.info(LOG_SOURCE, `${document.name} aberta no editor de animação sobre ${rigDisplayName(owner)}.`);
        this.notify();
        this.notifyTime();
        return true;
    }
    newClip(target: Entity | null, name = 'Nova animação'): boolean {
        return this.open(createEmptyDocument(name, { frameRate: DEFAULT_FRAME_RATE, duration: 2 }), target);
    }
    close(): void {
        if (!this.active && this.performers.length === 0)
            return;
        this.stopInteractions();
        for (const performer of [...this.performers])
            this.unbind(performer, true);
        this.document = null;
        this.assetId = null;
        this.dirty = false;
        this.selectedKeys = [];
        this.pending.clear();
        this.session.transformInterceptors.delete(this.interceptor);
        this.notify();
        this.notifyTime();
    }
    markSaved(assetId: string | null): void {
        this.assetId = assetId;
        this.dirty = false;
        this.notify();
    }
    addPerformer(entity: Entity, source: PerformerSource = { kind: 'clip' }): Performer | null {
        const owner = rigOwnerOf(entity);
        if (!owner?.rig)
            return null;
        const existing = this.performerOf(owner);
        if (existing)
            return existing;
        const performer = this.bind(owner, source);
        this.compile(performer);
        this.notify();
        return performer;
    }
    removePerformer(entity: Entity): void {
        const performer = this.performerOf(entity);
        if (!performer)
            return;
        this.unbind(performer, true);
        if (this.performers.length === 0)
            this.close();
        else
            this.notify();
    }
    setPerformerSource(entity: Entity, source: PerformerSource): void {
        const performer = this.performerOf(entity);
        if (!performer)
            return;
        performer.source = source;
        if (source.kind === 'clip')
            performer.document = null;
        this.compile(performer);
        this.notify();
    }
    setPerformerDocument(entity: Entity, document: AnimationDocument): void {
        const performer = this.performerOf(entity);
        if (!performer || performer.source.kind !== 'asset')
            return;
        performer.document = document;
        this.compile(performer);
        this.notify();
    }
    private bind(owner: Entity, source: PerformerSource): Performer {
        const rig = owner.rig as Rig;
        const sides = new Int8Array(rig.jointCount);
        rig.names.forEach((name, index) => (sides[index] = boneSide(name)));
        const performer: Performer = {
            entity: owner,
            rig,
            player: new AnimationPlayer(owner),
            source,
            document: null,
            restore: rig.joints.map(snapshotTransform),
            overlay: { joints: rig.joints, parents: rig.parents, sides, selected: new Set<number>(), hovered: -1, effectors: [] },
        };
        this.performers.push(performer);
        return performer;
    }
    private unbind(performer: Performer, restore: boolean): void {
        const index = this.performers.indexOf(performer);
        if (index === -1)
            return;
        this.performers.splice(index, 1);
        if (restore)
            performer.rig.joints.forEach((joint, jointIndex) => applyTransformSnapshot(joint, performer.restore[jointIndex]));
        for (const joint of performer.rig.joints)
            this.pending.delete(joint);
    }
    private compile(performer: Performer): void {
        const document = performer.source.kind === 'clip' ? this.document : performer.document;
        if (!document)
            return;
        const clip = new SkeletonClip(document, performer.rig);
        performer.player.replaceClip(clip);
        if (clip.unresolvedJoints.length > 0 && performer.source.kind === 'clip' && performer === this.primary) {
            this.session.log.warn(LOG_SOURCE, `${clip.unresolvedJoints.length} ${clip.unresolvedJoints.length === 1 ? 'osso do clipe não existe' : 'ossos do clipe não existem'} em ${rigDisplayName(performer.entity)}: ${clip.unresolvedJoints.slice(0, 4).join(', ')}${clip.unresolvedJoints.length > 4 ? '…' : ''}.`);
        }
    }
    snapTime(time: number): number {
        const clamped = clamp(time, 0, this.duration);
        if (!this.snapToFrames)
            return clamped;
        return clamp(Math.round(clamped * this.frameRate) / this.frameRate, 0, this.duration);
    }
    setTime(time: number, snap = this.snapToFrames): void {
        const next = snap ? this.snapTime(time) : clamp(time, 0, this.duration);
        if (next === this.time)
            return;
        this.time = next;
        this.discardPending();
        this.notifyTime();
    }
    setFrame(frame: number): void {
        this.setTime(frame / this.frameRate, false);
    }
    stepFrames(count: number): void {
        this.pause();
        this.setTime(this.frame / this.frameRate + count / this.frameRate, false);
    }
    goToStart(): void {
        this.pause();
        this.setTime(0, false);
    }
    goToEnd(): void {
        this.pause();
        this.setTime(this.duration, false);
    }
    play(): void {
        if (!this.active || this.playing)
            return;
        if (this.time >= this.duration - 1e-6 && !this.document?.loop)
            this.time = 0;
        this.playing = true;
        this.discardPending();
        this.notifyTime();
    }
    pause(): void {
        if (!this.playing)
            return;
        this.playing = false;
        if (this.snapToFrames)
            this.time = this.snapTime(this.time);
        this.notifyTime();
    }
    togglePlay(): void {
        if (this.playing)
            this.pause();
        else
            this.play();
    }
    stop(): void {
        this.playing = false;
        this.time = 0;
        this.notifyTime();
    }
    private setDocument(next: AnimationDocument): void {
        this.document = next;
        this.dirty = true;
        for (const performer of this.performers)
            if (performer.source.kind === 'clip')
                this.compile(performer);
        this.selectedKeys = this.selectedKeys.filter((ref) => {
            const track = trackAt(next, ref.joint, ref.path);
            return track !== undefined && track.times.some((time) => Math.abs(time - ref.time) <= 1e-4);
        });
        if (this.time > next.duration)
            this.time = next.duration;
        this.notify();
        this.notifyTime();
    }
    commit(label: string, next: AnimationDocument, mergeKey?: string): void {
        if (!this.document || next === this.document)
            return;
        this.commitFrom(label, this.document, next, mergeKey);
    }
    private commitFrom(label: string, before: AnimationDocument, after: AnimationDocument, mergeKey?: string): void {
        if (before === after)
            return;
        this.session.history.execute(new SetValueCommand<AnimationDocument>(label, (document) => this.setDocument(document), before, after, mergeKey));
    }
    endKeyDrag(cancel = false): void {
        const drag = this.keyDrag;
        if (!drag || !this.document)
            return;
        this.keyDrag = null;
        const result = this.document;
        this.document = drag.base;
        if (cancel || result === drag.base) {
            this.selectedKeys = drag.refs;
            for (const performer of this.performers)
                if (performer.source.kind === 'clip')
                    this.compile(performer);
            this.notify();
            return;
        }
        const refs = this.selectedKeys;
        this.commitFrom(refs.length === 1 ? 'Mover chave' : `Mover ${refs.length} chaves`, drag.base, result);
        this.selectedKeys = refs;
        this.notify();
    }
    syncSelection(): void {
        if (this.performers.length === 0)
            return;
        const names: string[] = [];
        for (const entity of this.session.selectedEntities()) {
            for (const performer of this.performers) {
                const index = performer.rig.jointIndex(entity);
                if (index !== -1 && !names.includes(performer.rig.names[index]))
                    names.push(performer.rig.names[index]);
            }
        }
        const changed = names.length !== this.selectedBones.length || names.some((name, index) => name !== this.selectedBones[index]);
        if (!changed)
            return;
        this.selectedBones = names;
        this.notify();
    }
    private interceptTransform(entity: Entity, before: TransformSnapshot, after: TransformSnapshot): boolean {
        if (!this.document)
            return false;
        const performer = this.performerOf(entity);
        if (!performer || performer.rig.jointIndex(entity) === -1)
            return false;
        const paths = changedPaths(before, after);
        if (paths.length === 0)
            return true;
        const index = performer.rig.jointIndex(entity);
        const name = performer.rig.names[index];
        if (performer.source.kind !== 'clip') {
            return true;
        }
        if (!this.autoKey) {
            this.pending.set(entity, after);
            this.notify();
            return true;
        }
        let next = this.document;
        const time = this.snapTime(this.time);
        for (const path of paths)
            next = setDocumentKey(next, name, path, time, readSnapshotPath(after, path));
        this.commit(`Chave em ${name}`, next, `anim:key:${name}:${time.toFixed(4)}`);
        return true;
    }
    private discardPending(): void {
        if (this.pending.size === 0)
            return;
        this.pending.clear();
        this.notify();
    }
    beginIkDrag(performer: Performer, limb: LimbId): boolean {
        if (!this.document || !this.ik[limb] || performer.source.kind !== 'clip')
            return false;
        const joints = resolveLimb(performer.rig, limb);
        if (!joints)
            return false;
        const upper = performer.rig.joints[joints.upper];
        const lower = performer.rig.joints[joints.lower];
        const end = performer.rig.joints[joints.end];
        if (!upper || !lower || !end)
            return false;
        this.session.scene.updateWorldMatrices();
        const target = vec3.create();
        mat4.getTranslation(target, end.worldMatrix);
        const hint = vec3.create();
        this.bendHint(performer, limb, hint);
        this.ikDrag = { performer, limb, chain: { upper, lower, end }, target, hint };
        this.pause();
        this.notify();
        return true;
    }
    updateIkDrag(target: Vec3): void {
        if (!this.ikDrag)
            return;
        vec3.copy(this.ikDrag.target, target);
    }
    get ikTarget(): Vec3 | null {
        return this.ikDrag?.target ?? null;
    }
    get ikEffector(): Entity | null {
        return this.ikDrag?.chain.end ?? null;
    }
    endIkDrag(cancel = false): void {
        const drag = this.ikDrag;
        if (!drag)
            return;
        this.ikDrag = null;
        if (cancel || !this.document) {
            this.notify();
            return;
        }
        this.solveIk(drag);
        const { rig } = drag.performer;
        const time = this.snapTime(this.time);
        const upperName = rig.names[rig.jointIndex(drag.chain.upper)];
        const lowerName = rig.names[rig.jointIndex(drag.chain.lower)];
        if (!this.autoKey) {
            this.pending.set(drag.chain.upper, snapshotTransform(drag.chain.upper));
            this.pending.set(drag.chain.lower, snapshotTransform(drag.chain.lower));
            this.notify();
            return;
        }
        let next = this.document;
        next = setDocumentKey(next, upperName, 'rotation', time, readJointPath(drag.chain.upper, 'rotation'));
        next = setDocumentKey(next, lowerName, 'rotation', time, readJointPath(drag.chain.lower, 'rotation'));
        this.commit(`IK ${LIMBS[drag.limb].label.toLowerCase()}`, next);
    }
    private bendHint(performer: Performer, limb: LimbId, out: Vec3): Vec3 {
        const actor = performer.entity.parent ?? performer.entity;
        vec3.set(scratchForward, 0, 0, LIMBS[limb].bend === 'forward' ? 1 : -1);
        mat4.transformDirection(out, actor.worldMatrix, scratchForward);
        return vec3.normalize(out, out);
    }
    private solveIk(drag: IkDrag): void {
        this.session.scene.updateWorldMatrices();
        solveTwoBoneIk(drag.chain, drag.target, drag.hint);
    }
    private stopInteractions(): void {
        if (this.ikDrag)
            this.endIkDrag(true);
        if (this.keyDrag)
            this.endKeyDrag(true);
    }
    tick(dt: number): void {
        if (!this.document || this.performers.length === 0)
            return;
        if (this.session.playtest.isRunning)
            return;
        for (const performer of [...this.performers]) {
            if (!isAttached(performer.entity, this.session.scene.root))
                this.unbind(performer, false);
        }
        if (this.performers.length === 0) {
            this.close();
            return;
        }
        if (this.playing) {
            let next = this.time + dt * this.speed;
            if (this.document.loop) {
                next = next % this.duration;
                if (next < 0)
                    next += this.duration;
            }
            else if (next >= this.duration) {
                next = this.duration;
                this.playing = false;
            }
            this.time = next;
            this.notifyTime();
        }
        const dragged = this.session.gizmo.active !== null ? this.session.selectedEntity : null;
        for (const performer of this.performers) {
            const { player } = performer;
            player.excluded.clear();
            if (dragged && performer.rig.jointIndex(dragged) !== -1)
                player.excluded.add(dragged);
            for (const joint of this.pending.keys())
                if (performer.rig.jointIndex(joint) !== -1)
                    player.excluded.add(joint);
            if (!player.currentClip)
                continue;
            player.seek(this.time);
            player.apply();
        }
        if (this.ikDrag)
            this.solveIk(this.ikDrag);
    }
    overlayRequest(): SkeletonOverlayRequest | null {
        if (!this.active || !this.showSkeleton || this.performers.length === 0 || this.session.playtest.isRunning)
            return null;
        const rigs: SkeletonOverlayRig[] = [];
        for (const performer of this.performers) {
            const { overlay, rig } = performer;
            overlay.selected.clear();
            for (const name of this.selectedBones) {
                const index = rig.jointByName(name);
                if (index !== -1)
                    overlay.selected.add(index);
            }
            overlay.hovered = this.hoveredBone ? rig.jointByName(this.hoveredBone) : -1;
            const effectors: Array<{
                joint: number;
                active: boolean;
            }> = [];
            if (performer.source.kind === 'clip') {
                for (const limb of LIMB_IDS) {
                    if (!this.ik[limb])
                        continue;
                    const joints = resolveLimb(rig, limb);
                    if (joints)
                        effectors.push({ joint: joints.end, active: this.ikDrag?.limb === limb && this.ikDrag.performer === performer });
                }
            }
            overlay.effectors = effectors;
            rigs.push(overlay);
        }
        return { rigs, xray: this.xray };
    }
}
