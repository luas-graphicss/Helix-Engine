export class ParticlePool {
    count = 0;
    readonly position: Float32Array;
    readonly velocity: Float32Array;
    readonly age: Float32Array;
    readonly lifetime: Float32Array;
    readonly size0: Float32Array;
    readonly size: Float32Array;
    readonly rotation: Float32Array;
    readonly angularVelocity: Float32Array;
    readonly color0: Float32Array;
    readonly color: Float32Array;
    readonly seed: Float32Array;
    readonly seed2: Float32Array;
    readonly frame: Float32Array;
    constructor(readonly capacity: number) {
        const n = Math.max(1, capacity);
        this.position = new Float32Array(n * 3);
        this.velocity = new Float32Array(n * 3);
        this.age = new Float32Array(n);
        this.lifetime = new Float32Array(n);
        this.size0 = new Float32Array(n);
        this.size = new Float32Array(n * 2);
        this.rotation = new Float32Array(n);
        this.angularVelocity = new Float32Array(n);
        this.color0 = new Float32Array(n * 4);
        this.color = new Float32Array(n * 4);
        this.seed = new Float32Array(n);
        this.seed2 = new Float32Array(n);
        this.frame = new Float32Array(n);
    }
    get full(): boolean {
        return this.count >= this.capacity;
    }
    allocate(): number {
        if (this.count >= this.capacity)
            return -1;
        return this.count++;
    }
    kill(index: number): void {
        const last = this.count - 1;
        if (index !== last)
            this.copy(last, index);
        this.count = last;
    }
    clear(): void {
        this.count = 0;
    }
    private copy(from: number, to: number): void {
        const { position, velocity, size, color0, color } = this;
        position[to * 3] = position[from * 3];
        position[to * 3 + 1] = position[from * 3 + 1];
        position[to * 3 + 2] = position[from * 3 + 2];
        velocity[to * 3] = velocity[from * 3];
        velocity[to * 3 + 1] = velocity[from * 3 + 1];
        velocity[to * 3 + 2] = velocity[from * 3 + 2];
        this.age[to] = this.age[from];
        this.lifetime[to] = this.lifetime[from];
        this.size0[to] = this.size0[from];
        size[to * 2] = size[from * 2];
        size[to * 2 + 1] = size[from * 2 + 1];
        this.rotation[to] = this.rotation[from];
        this.angularVelocity[to] = this.angularVelocity[from];
        for (let c = 0; c < 4; c++) {
            color0[to * 4 + c] = color0[from * 4 + c];
            color[to * 4 + c] = color[from * 4 + c];
        }
        this.seed[to] = this.seed[from];
        this.seed2[to] = this.seed2[from];
        this.frame[to] = this.frame[from];
    }
}
export class VfxRandom {
    private state: number;
    constructor(seed: number) {
        this.state = seed >>> 0 || 0x9e3779b9;
    }
    reseed(seed: number): void {
        this.state = seed >>> 0 || 0x9e3779b9;
    }
    next(): number {
        let t = (this.state += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(min: number, max: number): number {
        return min + (max - min) * this.next();
    }
    int(min: number, max: number): number {
        return Math.floor(this.range(min, max + 1));
    }
    fork(): number {
        return Math.floor(this.next() * 4294967295);
    }
}
export function hashSeed(text: string): number {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
