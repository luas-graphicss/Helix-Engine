const factories = new Map<string, () => unknown>();
const instances = new Map<string, unknown>();
export function registerBuiltinModule(specifier: string, factory: () => unknown): void {
    factories.set(specifier, factory);
    instances.delete(specifier);
}
export function builtinModule(specifier: string): unknown {
    if (instances.has(specifier))
        return instances.get(specifier);
    const factory = factories.get(specifier);
    if (!factory)
        return undefined;
    const instance = factory();
    instances.set(specifier, instance);
    return instance;
}
export function isBuiltinModule(specifier: string): boolean {
    return factories.has(specifier);
}
