export const DEFAULT_COLLISION_LAYER = 'default';
export const MAX_COLLISION_LAYERS = 32;
export class CollisionLayers {
    private readonly names: string[] = [DEFAULT_COLLISION_LAYER];
    private readonly indices = new Map<string, number>([[DEFAULT_COLLISION_LAYER, 0]]);
    private readonly matrix: number[] = [~0 >>> 0];
    version = 0;
    list(): string[] {
        return this.names.slice();
    }
    snapshot(): CollisionLayersSnapshot {
        return { names: this.names.slice(), matrix: this.matrix.slice() };
    }
    restore(snapshot: CollisionLayersSnapshot): void {
        this.names.length = 0;
        this.indices.clear();
        this.matrix.length = 0;
        snapshot.names.forEach((name, index) => {
            this.names.push(name);
            this.indices.set(name, index);
            this.matrix.push(snapshot.matrix[index] ?? ~0 >>> 0);
        });
        if (this.names.length === 0)
            this.reset();
        this.version++;
    }
    get count(): number {
        return this.names.length;
    }
    has(name: string): boolean {
        return this.indices.has(name);
    }
    indexOf(name: string): number {
        const existing = this.indices.get(name);
        if (existing !== undefined)
            return existing;
        if (this.names.length >= MAX_COLLISION_LAYERS) {
            throw new Error(`o mundo físico já tem ${MAX_COLLISION_LAYERS} camadas de colisão; "${name}" não cabe. Camadas: ${this.names.join(', ')}.`);
        }
        const index = this.names.length;
        this.names.push(name);
        this.indices.set(name, index);
        this.matrix.push(~0 >>> 0);
        this.version++;
        return index;
    }
    nameOf(index: number): string {
        return this.names[index] ?? DEFAULT_COLLISION_LAYER;
    }
    define(names: readonly string[]): void {
        for (const name of names)
            this.indexOf(name);
    }
    setCollision(a: string, b: string, enabled: boolean): void {
        const i = this.indexOf(a);
        const j = this.indexOf(b);
        if (enabled) {
            this.matrix[i] = (this.matrix[i] | (1 << j)) >>> 0;
            this.matrix[j] = (this.matrix[j] | (1 << i)) >>> 0;
        }
        else {
            this.matrix[i] = (this.matrix[i] & ~(1 << j)) >>> 0;
            this.matrix[j] = (this.matrix[j] & ~(1 << i)) >>> 0;
        }
        this.version++;
    }
    collidesByName(a: string, b: string): boolean {
        return this.collides(this.indexOf(a), this.indexOf(b));
    }
    collides(a: number, b: number): boolean {
        return ((this.matrix[a] ?? 0) & (1 << b)) !== 0;
    }
    maskOf(names: readonly string[] | null | undefined): number {
        if (!names || names.length === 0)
            return ~0 >>> 0;
        let mask = 0;
        for (const name of names)
            mask |= 1 << this.indexOf(name);
        return mask >>> 0;
    }
    pairCollides(layerA: number, maskA: number, layerB: number, maskB: number): boolean {
        if (!this.collides(layerA, layerB))
            return false;
        return (maskA & (1 << layerB)) !== 0 && (maskB & (1 << layerA)) !== 0;
    }
    reset(): void {
        this.names.length = 1;
        this.names[0] = DEFAULT_COLLISION_LAYER;
        this.indices.clear();
        this.indices.set(DEFAULT_COLLISION_LAYER, 0);
        this.matrix.length = 1;
        this.matrix[0] = ~0 >>> 0;
        this.version++;
    }
}
export interface CollisionLayersSnapshot {
    readonly names: string[];
    readonly matrix: number[];
}
