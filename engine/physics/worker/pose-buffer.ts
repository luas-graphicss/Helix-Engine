import type { RigidBody } from '@/engine/physics/body/rigid-body';
const HEADER_INTS = 8;
const HEADER_VERSION = 0;
const HEADER_CAPACITY = 1;
const HEADER_BODY_COUNT = 2;
const HEADER_INTERPOLATION = 3;
const HEADER_STEPS = 4;
export const POSE_SLOT_FLOATS = 24;
const SLOT_POSITION = 0;
const SLOT_PREVIOUS_POSITION = 3;
const SLOT_ORIENTATION = 6;
const SLOT_PREVIOUS_ORIENTATION = 10;
const SLOT_LINEAR_VELOCITY = 14;
const SLOT_ANGULAR_VELOCITY = 17;
const SLOT_FLAGS = 20;
const SLOT_SLEEP_TIME = 21;
export const POSE_FLAG_VALID = 1;
export const POSE_FLAG_SLEEPING = 2;
export const POSE_FLAG_OUT_OF_BOUNDS = 4;
export const POSE_BUFFER_INITIAL_CAPACITY = 256;
export class PoseBuffer {
    readonly header: Int32Array;
    private readonly headerFloats: Float32Array;
    readonly slots: Float32Array;
    readonly capacity: number;
    static byteLength(capacity: number): number {
        return (HEADER_INTS + capacity * POSE_SLOT_FLOATS) * Float32Array.BYTES_PER_ELEMENT;
    }
    static allocate(capacity: number, shared: boolean): PoseBuffer {
        const bytes = PoseBuffer.byteLength(capacity);
        const buffer = shared ? new SharedArrayBuffer(bytes) : new ArrayBuffer(bytes);
        const poses = new PoseBuffer(buffer);
        poses.header[HEADER_CAPACITY] = capacity;
        return poses;
    }
    static capacityOf(byteLength: number): number {
        return Math.max(0, Math.floor(byteLength / Float32Array.BYTES_PER_ELEMENT - HEADER_INTS) / POSE_SLOT_FLOATS) | 0;
    }
    constructor(readonly buffer: ArrayBufferLike) {
        this.capacity = PoseBuffer.capacityOf(buffer.byteLength);
        this.header = new Int32Array(buffer, 0, HEADER_INTS);
        this.headerFloats = new Float32Array(buffer, 0, HEADER_INTS);
        this.slots = new Float32Array(buffer, HEADER_INTS * Float32Array.BYTES_PER_ELEMENT, this.capacity * POSE_SLOT_FLOATS);
    }
    get shared(): boolean {
        return typeof SharedArrayBuffer !== 'undefined' && this.buffer instanceof SharedArrayBuffer;
    }
    get version(): number {
        return this.shared ? Atomics.load(this.header, HEADER_VERSION) : this.header[HEADER_VERSION];
    }
    get bodyCount(): number {
        return this.header[HEADER_BODY_COUNT];
    }
    get interpolation(): number {
        return this.headerFloats[HEADER_INTERPOLATION];
    }
    get steps(): number {
        return this.header[HEADER_STEPS];
    }
    writeBody(slot: number, body: RigidBody): void {
        const base = slot * POSE_SLOT_FLOATS;
        const data = this.slots;
        const p = body.position;
        const pp = body.previousPosition;
        const q = body.orientation;
        const pq = body.previousOrientation;
        const v = body.linearVelocity;
        const w = body.angularVelocity;
        data[base + SLOT_POSITION] = p[0];
        data[base + SLOT_POSITION + 1] = p[1];
        data[base + SLOT_POSITION + 2] = p[2];
        data[base + SLOT_PREVIOUS_POSITION] = pp[0];
        data[base + SLOT_PREVIOUS_POSITION + 1] = pp[1];
        data[base + SLOT_PREVIOUS_POSITION + 2] = pp[2];
        data[base + SLOT_ORIENTATION] = q[0];
        data[base + SLOT_ORIENTATION + 1] = q[1];
        data[base + SLOT_ORIENTATION + 2] = q[2];
        data[base + SLOT_ORIENTATION + 3] = q[3];
        data[base + SLOT_PREVIOUS_ORIENTATION] = pq[0];
        data[base + SLOT_PREVIOUS_ORIENTATION + 1] = pq[1];
        data[base + SLOT_PREVIOUS_ORIENTATION + 2] = pq[2];
        data[base + SLOT_PREVIOUS_ORIENTATION + 3] = pq[3];
        data[base + SLOT_LINEAR_VELOCITY] = v[0];
        data[base + SLOT_LINEAR_VELOCITY + 1] = v[1];
        data[base + SLOT_LINEAR_VELOCITY + 2] = v[2];
        data[base + SLOT_ANGULAR_VELOCITY] = w[0];
        data[base + SLOT_ANGULAR_VELOCITY + 1] = w[1];
        data[base + SLOT_ANGULAR_VELOCITY + 2] = w[2];
        data[base + SLOT_FLAGS] = POSE_FLAG_VALID | (body.sleeping ? POSE_FLAG_SLEEPING : 0) | (body.outOfBounds ? POSE_FLAG_OUT_OF_BOUNDS : 0);
        data[base + SLOT_SLEEP_TIME] = body.sleepTime;
    }
    clearSlot(slot: number): void {
        this.slots.fill(0, slot * POSE_SLOT_FLOATS, (slot + 1) * POSE_SLOT_FLOATS);
    }
    commit(bodyCount: number, interpolation: number, steps: number): void {
        this.header[HEADER_BODY_COUNT] = bodyCount;
        this.headerFloats[HEADER_INTERPOLATION] = interpolation;
        this.header[HEADER_STEPS] = steps;
        if (this.shared)
            Atomics.add(this.header, HEADER_VERSION, 1);
        else
            this.header[HEADER_VERSION]++;
    }
    copyTo(target: Float32Array): void {
        target.set(this.slots.subarray(0, Math.min(this.slots.length, target.length)));
    }
}
export const poseSlot = {
    flags(data: Float32Array, slot: number): number {
        return data[slot * POSE_SLOT_FLOATS + SLOT_FLAGS];
    },
    isValid(data: Float32Array, slot: number): boolean {
        return (data[slot * POSE_SLOT_FLOATS + SLOT_FLAGS] & POSE_FLAG_VALID) !== 0;
    },
    readInto(data: Float32Array, slot: number, body: RigidBody): boolean {
        const base = slot * POSE_SLOT_FLOATS;
        const flags = data[base + SLOT_FLAGS];
        if ((flags & POSE_FLAG_VALID) === 0)
            return false;
        const p = body.position;
        const pp = body.previousPosition;
        const q = body.orientation;
        const pq = body.previousOrientation;
        const v = body.linearVelocity;
        const w = body.angularVelocity;
        p[0] = data[base + SLOT_POSITION];
        p[1] = data[base + SLOT_POSITION + 1];
        p[2] = data[base + SLOT_POSITION + 2];
        pp[0] = data[base + SLOT_PREVIOUS_POSITION];
        pp[1] = data[base + SLOT_PREVIOUS_POSITION + 1];
        pp[2] = data[base + SLOT_PREVIOUS_POSITION + 2];
        q[0] = data[base + SLOT_ORIENTATION];
        q[1] = data[base + SLOT_ORIENTATION + 1];
        q[2] = data[base + SLOT_ORIENTATION + 2];
        q[3] = data[base + SLOT_ORIENTATION + 3];
        pq[0] = data[base + SLOT_PREVIOUS_ORIENTATION];
        pq[1] = data[base + SLOT_PREVIOUS_ORIENTATION + 1];
        pq[2] = data[base + SLOT_PREVIOUS_ORIENTATION + 2];
        pq[3] = data[base + SLOT_PREVIOUS_ORIENTATION + 3];
        v[0] = data[base + SLOT_LINEAR_VELOCITY];
        v[1] = data[base + SLOT_LINEAR_VELOCITY + 1];
        v[2] = data[base + SLOT_LINEAR_VELOCITY + 2];
        w[0] = data[base + SLOT_ANGULAR_VELOCITY];
        w[1] = data[base + SLOT_ANGULAR_VELOCITY + 1];
        w[2] = data[base + SLOT_ANGULAR_VELOCITY + 2];
        body.sleeping = (flags & POSE_FLAG_SLEEPING) !== 0;
        body.outOfBounds = (flags & POSE_FLAG_OUT_OF_BOUNDS) !== 0;
        body.sleepTime = data[base + SLOT_SLEEP_TIME];
        body.updateRotation();
        return true;
    },
    poseDiffers(data: Float32Array, slot: number, body: RigidBody): boolean {
        const base = slot * POSE_SLOT_FLOATS;
        const p = body.position;
        const q = body.orientation;
        return (p[0] !== data[base + SLOT_POSITION] || p[1] !== data[base + SLOT_POSITION + 1] || p[2] !== data[base + SLOT_POSITION + 2] ||
            q[0] !== data[base + SLOT_ORIENTATION] || q[1] !== data[base + SLOT_ORIENTATION + 1] || q[2] !== data[base + SLOT_ORIENTATION + 2] || q[3] !== data[base + SLOT_ORIENTATION + 3]);
    },
    velocityDiffers(data: Float32Array, slot: number, body: RigidBody): boolean {
        const base = slot * POSE_SLOT_FLOATS;
        const v = body.linearVelocity;
        const w = body.angularVelocity;
        return (v[0] !== data[base + SLOT_LINEAR_VELOCITY] || v[1] !== data[base + SLOT_LINEAR_VELOCITY + 1] || v[2] !== data[base + SLOT_LINEAR_VELOCITY + 2] ||
            w[0] !== data[base + SLOT_ANGULAR_VELOCITY] || w[1] !== data[base + SLOT_ANGULAR_VELOCITY + 1] || w[2] !== data[base + SLOT_ANGULAR_VELOCITY + 2]);
    },
    wasSleeping(data: Float32Array, slot: number): boolean {
        return (data[slot * POSE_SLOT_FLOATS + SLOT_FLAGS] & POSE_FLAG_SLEEPING) !== 0;
    },
};
