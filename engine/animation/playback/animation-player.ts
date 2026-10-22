import type { AnimationEvent } from '@/engine/core/animation/animation-document';
import * as quat from '@/engine/core/math/quat';
import { clamp } from '@/engine/core/math/scalar';
import type { Entity } from '@/engine/core/scene/entity';
import type { Rig } from '@/engine/core/scene/rig';
import { applyPose, blendPoses, Pose } from '@/engine/character/rig/pose';
import type { SkeletonClip } from '../skeleton-clip';
export interface PlayOptions {
    loop?: boolean;
    speed?: number;
    fadeIn?: number;
    startTime?: number;
}
export type AnimationEventListener = (event: AnimationEvent, clip: SkeletonClip) => void;
export type PlayerState = 'stopped' | 'playing' | 'paused';
function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
}
export class AnimationPlayer {
    readonly rig: Rig;
    readonly excluded = new Set<Entity>();
    private clip: SkeletonClip | null = null;
    private state: PlayerState = 'stopped';
    private currentTime = 0;
    private currentSpeed = 1;
    private currentLoop = true;
    private readonly pose: Pose;
    private readonly fadePose: Pose;
    private fadeRemaining = 0;
    private fadeDuration = 0;
    private readonly listeners = new Set<AnimationEventListener>();
    constructor(readonly owner: Entity) {
        if (!owner.rig)
            throw new Error(`${owner.name} não tem esqueleto para animar.`);
        this.rig = owner.rig;
        this.pose = new Pose(this.rig.jointCount);
        this.fadePose = new Pose(this.rig.jointCount);
    }
    get currentClip(): SkeletonClip | null {
        return this.clip;
    }
    get playbackState(): PlayerState {
        return this.state;
    }
    get playing(): boolean {
        return this.state === 'playing';
    }
    get time(): number {
        return this.currentTime;
    }
    get speed(): number {
        return this.currentSpeed;
    }
    get loop(): boolean {
        return this.currentLoop;
    }
    get duration(): number {
        return this.clip?.duration ?? 0;
    }
    get phase(): number {
        return this.clip ? clamp(this.currentTime / this.clip.duration, 0, 1) : 0;
    }
    play(clip: SkeletonClip, options: PlayOptions = {}): void {
        const fadeIn = options.fadeIn ?? 0;
        if (fadeIn > 0 && this.clip) {
            this.fadePose.copy(this.pose);
            this.fadeRemaining = fadeIn;
            this.fadeDuration = fadeIn;
        }
        else {
            this.fadeRemaining = 0;
        }
        this.clip = clip;
        this.currentLoop = options.loop ?? clip.loop;
        this.currentSpeed = options.speed ?? 1;
        this.currentTime = options.startTime ?? 0;
        this.state = 'playing';
    }
    replaceClip(clip: SkeletonClip): void {
        this.clip = clip;
        this.currentLoop = clip.loop;
        if (this.state === 'stopped')
            this.currentTime = 0;
    }
    pause(): void {
        if (this.state === 'playing')
            this.state = 'paused';
    }
    resume(): void {
        if (this.clip && this.state !== 'playing')
            this.state = 'playing';
    }
    togglePlay(): void {
        if (this.state === 'playing')
            this.pause();
        else
            this.resume();
    }
    stop(): void {
        this.state = 'stopped';
        this.currentTime = 0;
        this.fadeRemaining = 0;
    }
    seek(time: number): void {
        this.currentTime = this.clip ? (this.currentLoop ? time : clamp(time, 0, this.clip.duration)) : 0;
    }
    setSpeed(speed: number): void {
        if (Number.isFinite(speed))
            this.currentSpeed = speed;
    }
    setLoop(loop: boolean): void {
        this.currentLoop = loop;
    }
    onEvent(listener: AnimationEventListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    update(dt: number): void {
        const { clip } = this;
        if (!clip)
            return;
        if (this.state === 'playing') {
            const previous = this.currentTime;
            let next = previous + dt * this.currentSpeed;
            if (this.currentLoop) {
                next = clip.wrap(next);
            }
            else if (next >= clip.duration || next <= 0) {
                next = clamp(next, 0, clip.duration);
                this.state = 'paused';
            }
            this.fireCrossedEvents(previous, next, dt * this.currentSpeed);
            this.currentTime = next;
        }
        if (this.fadeRemaining > 0)
            this.fadeRemaining = Math.max(0, this.fadeRemaining - dt);
        this.apply();
    }
    apply(): void {
        const { clip } = this;
        if (!clip)
            return;
        this.evaluate(this.pose);
        if (this.excluded.size === 0) {
            applyPose(this.rig.joints, this.pose);
            return;
        }
        this.rig.joints.forEach((joint, index) => {
            if (this.excluded.has(joint))
                return;
            joint.transform.position.set(this.pose.position(index));
            quat.toEulerDegrees(joint.transform.rotation, this.pose.rotation(index));
            joint.transform.scale.set(this.pose.scale(index));
        });
    }
    evaluate(out: Pose): void {
        const { clip } = this;
        if (!clip)
            return;
        clip.evaluate(this.currentTime, out, this.currentLoop);
        if (this.fadeRemaining > 0 && this.fadeDuration > 0) {
            const weight = smoothstep(1 - this.fadeRemaining / this.fadeDuration);
            blendPoses(out, this.fadePose, out, weight);
        }
    }
    rest(): void {
        this.rig.applyBindPose();
    }
    private fireCrossedEvents(previous: number, next: number, step: number): void {
        const { clip } = this;
        if (!clip || this.listeners.size === 0 || clip.document.events.length === 0 || step === 0)
            return;
        const forward = step > 0;
        const crossed = (time: number): boolean => {
            if (forward) {
                return previous <= next ? time > previous && time <= next : time > previous || time <= next;
            }
            return previous >= next ? time < previous && time >= next : time < previous || time >= next;
        };
        for (const event of clip.document.events) {
            if (!crossed(event.time))
                continue;
            for (const listener of this.listeners)
                listener(event, clip);
        }
    }
}
