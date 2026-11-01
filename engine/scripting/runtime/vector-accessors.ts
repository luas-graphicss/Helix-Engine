let installed = false;
export function installVectorAccessors(): void {
    if (installed)
        return;
    installed = true;
    const prototype = Float32Array.prototype as unknown as Record<string, unknown>;
    const components: Array<[
        string,
        number
    ]> = [
        ['x', 0],
        ['y', 1],
        ['z', 2],
        ['w', 3],
    ];
    for (const [name, index] of components) {
        if (Object.prototype.hasOwnProperty.call(prototype, name))
            continue;
        Object.defineProperty(prototype, name, {
            configurable: true,
            enumerable: false,
            get(this: Float32Array) {
                return this[index];
            },
            set(this: Float32Array, value: number) {
                this[index] = value;
            },
        });
    }
    const colorComponents: Array<[
        string,
        number
    ]> = [
        ['r', 0],
        ['g', 1],
        ['b', 2],
    ];
    for (const [name, index] of colorComponents) {
        if (Object.prototype.hasOwnProperty.call(prototype, name))
            continue;
        Object.defineProperty(prototype, name, {
            configurable: true,
            enumerable: false,
            get(this: Float32Array) {
                return this[index];
            },
            set(this: Float32Array, value: number) {
                this[index] = value;
            },
        });
    }
}
