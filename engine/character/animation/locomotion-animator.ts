import { clamp } from '@/engine/core/math/scalar';
import { blendPoses, Pose } from '@/engine/character/rig/pose';
import type { SkeletonTemplate } from '@/engine/character/rig/skeleton';
import type { AnimationClip } from './animation-clip';
import type { PoseOverlay } from './pose-overlay';
export interface LocomotionClips {
    readonly idle: AnimationClip;
    readonly walk: AnimationClip;
    readonly run: AnimationClip;
    readonly crouch: AnimationClip;
    readonly jump: PoseOverlay;
    readonly fall: PoseOverlay;
    readonly land: PoseOverlay;
}
export interface AnimatorInput {
    speed: number;
    grounded: boolean;
    crouching: boolean;
    jumped: boolean;
    landed: boolean;
    landingSpeed: number;
    crouchSpeed: number;
}
export type AnimatorState = 'stand' | 'crouch' | 'jump' | 'fall' | 'land';
const FADE_IN: Record<AnimatorState, number> = { stand: 0.2, crouch: 0.25, jump: 0.08, fall: 0.35, land: 0.06 };
const HARD_LANDING_SPEED = 5;
const FALL_DELAY = 0.15;
const LAND_CANCEL_SPEED = 1.2;
const SLOW_STRIDE_FACTOR = 0.5;
const CROUCH_IDLE_WEIGHT = 0.85;
const CROUCH_WALK_WEIGHT = 0.5;
const CROUCH_STRIDE_FACTOR = 0.6;
function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
}
export class LocomotionAnimator {
    state: AnimatorState = 'stand';
    private stateTime = 0;
    private airTime = 0;
    private gaitPhase = 0;
    private idleTime = 0;
    private fadeTime = 0;
    private fadeDuration = 0;
    private readonly fadeFrom: Pose;
    private readonly statePose: Pose;
    private readonly clipA: Pose;
    private readonly clipB: Pose;
    private readonly restPose: Pose;
    private readonly crouchPose: Pose;
    constructor(private readonly template: SkeletonTemplate, private readonly clips: LocomotionClips) {
        const { jointCount } = template;
        this.fadeFrom = new Pose(jointCount);
        this.statePose = new Pose(jointCount);
        this.clipA = new Pose(jointCount);
        this.clipB = new Pose(jointCount);
        this.restPose = new Pose(jointCount);
        this.crouchPose = new Pose(jointCount);
        clips.idle.evaluate(0, this.restPose);
        clips.crouch.evaluate(0, this.crouchPose);
    }
    update(dt: number, input: AnimatorInput, out: Pose): void {
        const next = this.nextState(input);
        if (next !== this.state)
            this.enter(next, out);
        this.stateTime += dt;
        this.airTime = input.grounded ? 0 : this.airTime + dt;
        this.evaluate(dt, input, this.statePose);
        if (this.fadeTime < this.fadeDuration) {
            this.fadeTime += dt;
            blendPoses(out, this.fadeFrom, this.statePose, smoothstep(clamp(this.fadeTime / this.fadeDuration, 0, 1)));
        }
        else {
            out.copy(this.statePose);
        }
    }
    private nextState(input: AnimatorInput): AnimatorState {
        const { state, clips } = this;
        if (input.jumped)
            return 'jump';
        if (!input.grounded) {
            if (state === 'jump')
                return this.stateTime < clips.jump.duration ? 'jump' : 'fall';
            if (state === 'fall')
                return 'fall';
            return this.airTime > FALL_DELAY ? 'fall' : state;
        }
        if (input.landed && input.landingSpeed >= HARD_LANDING_SPEED && !input.crouching)
            return 'land';
        if (state === 'land' && this.stateTime < clips.land.duration && input.speed < LAND_CANCEL_SPEED)
            return 'land';
        return input.crouching ? 'crouch' : 'stand';
    }
    private enter(next: AnimatorState, lastOutput: Pose): void {
        this.fadeFrom.copy(lastOutput);
        this.fadeTime = 0;
        this.fadeDuration = FADE_IN[next];
        this.state = next;
        this.stateTime = 0;
    }
    private evaluate(dt: number, input: AnimatorInput, out: Pose): void {
        const { clips, template } = this;
        this.idleTime += dt;
        switch (this.state) {
            case 'stand':
                this.evaluateStanding(dt, input.speed, out);
                break;
            case 'crouch':
                this.evaluateCrouching(dt, input.speed, input.crouchSpeed, out);
                break;
            case 'jump':
                out.copy(this.restPose);
                clips.jump.apply(this.stateTime, template, out);
                break;
            case 'fall':
                out.copy(this.restPose);
                clips.fall.apply(this.stateTime, template, out);
                break;
            case 'land':
                out.copy(this.restPose);
                clips.land.apply(this.stateTime, template, out);
                break;
        }
    }
    private evaluateStanding(dt: number, speed: number, out: Pose): void {
        const { idle, walk, run } = this.clips;
        const walkStride = walk.referenceSpeed * walk.duration;
        if (speed <= walk.referenceSpeed) {
            const weight = clamp(speed / walk.referenceSpeed, 0, 1);
            const stride = walkStride * (SLOW_STRIDE_FACTOR + (1 - SLOW_STRIDE_FACTOR) * weight);
            this.gaitPhase += (dt * speed) / stride;
            idle.evaluate(this.idleTime, this.clipA);
            walk.evaluatePhase(this.gaitPhase, this.clipB);
            blendPoses(out, this.clipA, this.clipB, weight);
            return;
        }
        const runStride = run.referenceSpeed * run.duration;
        const weight = clamp((speed - walk.referenceSpeed) / (run.referenceSpeed - walk.referenceSpeed), 0, 1);
        this.gaitPhase += (dt * speed) / (walkStride + (runStride - walkStride) * weight);
        walk.evaluatePhase(this.gaitPhase, this.clipA);
        run.evaluatePhase(this.gaitPhase, this.clipB);
        blendPoses(out, this.clipA, this.clipB, weight);
    }
    private evaluateCrouching(dt: number, speed: number, crouchSpeed: number, out: Pose): void {
        const { idle, walk } = this.clips;
        const referenceSpeed = Math.max(crouchSpeed, 0.1);
        const weight = clamp(speed / referenceSpeed, 0, 1);
        const stride = walk.referenceSpeed * walk.duration * CROUCH_STRIDE_FACTOR * (SLOW_STRIDE_FACTOR + (1 - SLOW_STRIDE_FACTOR) * weight);
        this.gaitPhase += (dt * speed) / stride;
        idle.evaluate(this.idleTime, this.clipA);
        blendPoses(this.clipA, this.clipA, this.crouchPose, CROUCH_IDLE_WEIGHT);
        walk.evaluatePhase(this.gaitPhase, this.clipB);
        blendPoses(this.clipB, this.clipB, this.crouchPose, CROUCH_WALK_WEIGHT);
        blendPoses(out, this.clipA, this.clipB, weight);
    }
}
