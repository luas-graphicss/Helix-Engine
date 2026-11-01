import { allocateVfxId, VFX_EMITTER_TINTS, VFX_MAX_EMITTERS, type VfxDocument, type VfxEmitter, type VfxModule } from './vfx-document';
export function findEmitter(document: VfxDocument, id: string | null): VfxEmitter | null {
    if (!id)
        return null;
    return document.emitters.find((emitter) => emitter.id === id) ?? null;
}
export function findModule(emitter: VfxEmitter | null, id: string | null): VfxModule | null {
    if (!emitter || !id)
        return null;
    return emitter.modules.find((module) => module.id === id) ?? null;
}
export function updateEmitter(document: VfxDocument, id: string, update: (emitter: VfxEmitter) => VfxEmitter): VfxDocument {
    let changed = false;
    const emitters = document.emitters.map((emitter) => {
        if (emitter.id !== id)
            return emitter;
        const next = update(emitter);
        if (next !== emitter)
            changed = true;
        return next;
    });
    return changed ? { ...document, emitters } : document;
}
export function updateModule(document: VfxDocument, emitterId: string, moduleId: string, update: (module: VfxModule) => VfxModule): VfxDocument {
    return updateEmitter(document, emitterId, (emitter) => {
        let changed = false;
        const modules = emitter.modules.map((module) => {
            if (module.id !== moduleId)
                return module;
            const next = update(module);
            if (next !== module)
                changed = true;
            return next;
        });
        return changed ? { ...emitter, modules } : emitter;
    });
}
export function uniqueEmitterName(document: VfxDocument, desired: string, ignoreId: string | null = null): string {
    const taken = new Set(document.emitters.filter((emitter) => emitter.id !== ignoreId).map((emitter) => emitter.name));
    if (!taken.has(desired))
        return desired;
    const base = desired.replace(/\s\d+$/, '');
    for (let suffix = 2;; suffix++) {
        const candidate = `${base} ${suffix}`;
        if (!taken.has(candidate))
            return candidate;
    }
}
export function insertEmitter(document: VfxDocument, emitter: VfxEmitter, index = document.emitters.length): VfxDocument {
    if (document.emitters.length >= VFX_MAX_EMITTERS)
        return document;
    const tint = emitter.tint ?? VFX_EMITTER_TINTS[document.emitters.length % VFX_EMITTER_TINTS.length];
    const named = { ...emitter, name: uniqueEmitterName(document, emitter.name), tint };
    const emitters = [...document.emitters];
    emitters.splice(Math.max(0, Math.min(index, emitters.length)), 0, named);
    return { ...document, emitters };
}
export function removeEmitter(document: VfxDocument, id: string): VfxDocument {
    const emitters = document.emitters.filter((emitter) => emitter.id !== id);
    return emitters.length === document.emitters.length ? document : { ...document, emitters };
}
export function moveEmitter(document: VfxDocument, id: string, toIndex: number): VfxDocument {
    const from = document.emitters.findIndex((emitter) => emitter.id === id);
    if (from === -1)
        return document;
    const clamped = Math.max(0, Math.min(toIndex, document.emitters.length - 1));
    if (clamped === from)
        return document;
    const emitters = [...document.emitters];
    const [moved] = emitters.splice(from, 1);
    emitters.splice(clamped, 0, moved);
    return { ...document, emitters };
}
export function cloneEmitter(emitter: VfxEmitter, name = `${emitter.name} cópia`): VfxEmitter {
    return {
        ...emitter,
        id: allocateVfxId('e'),
        name,
        spawn: { ...emitter.spawn, bursts: emitter.spawn.bursts.map((burst) => ({ ...burst, id: allocateVfxId('b') })) },
        modules: emitter.modules.map((module) => ({ ...module, id: allocateVfxId('m') })),
    };
}
export function duplicateEmitter(document: VfxDocument, id: string): VfxDocument {
    const index = document.emitters.findIndex((emitter) => emitter.id === id);
    if (index === -1)
        return document;
    const copy = cloneEmitter(document.emitters[index]);
    return insertEmitter(document, { ...copy, tint: VFX_EMITTER_TINTS[document.emitters.length % VFX_EMITTER_TINTS.length] }, index + 1);
}
export function insertModule(document: VfxDocument, emitterId: string, module: VfxModule, index?: number): VfxDocument {
    return updateEmitter(document, emitterId, (emitter) => {
        const modules = [...emitter.modules];
        modules.splice(index === undefined ? modules.length : Math.max(0, Math.min(index, modules.length)), 0, module);
        return { ...emitter, modules };
    });
}
export function removeModule(document: VfxDocument, emitterId: string, moduleId: string): VfxDocument {
    return updateEmitter(document, emitterId, (emitter) => {
        const modules = emitter.modules.filter((module) => module.id !== moduleId);
        return modules.length === emitter.modules.length ? emitter : { ...emitter, modules };
    });
}
export function moveModule(document: VfxDocument, emitterId: string, moduleId: string, toIndex: number): VfxDocument {
    return updateEmitter(document, emitterId, (emitter) => {
        const from = emitter.modules.findIndex((module) => module.id === moduleId);
        if (from === -1)
            return emitter;
        const clamped = Math.max(0, Math.min(toIndex, emitter.modules.length - 1));
        if (clamped === from)
            return emitter;
        const modules = [...emitter.modules];
        const [moved] = modules.splice(from, 1);
        modules.splice(clamped, 0, moved);
        return { ...emitter, modules };
    });
}
export function duplicateModule(document: VfxDocument, emitterId: string, moduleId: string): VfxDocument {
    return updateEmitter(document, emitterId, (emitter) => {
        const index = emitter.modules.findIndex((module) => module.id === moduleId);
        if (index === -1)
            return emitter;
        const modules = [...emitter.modules];
        modules.splice(index + 1, 0, { ...emitter.modules[index], id: allocateVfxId('m') });
        return { ...emitter, modules };
    });
}
export function patchObject<T extends object>(target: T, patch: Partial<T>): T {
    for (const key of Object.keys(patch) as Array<keyof T>) {
        if (!Object.is(target[key], patch[key]))
            return { ...target, ...patch };
    }
    return target;
}
