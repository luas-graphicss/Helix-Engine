import { clamp } from '@/engine/core/math/scalar';
import { createBurst, createEmitter, createModule, VFX_MAX_DURATION, VFX_MAX_EMITTERS, VFX_MAX_PARTICLES_PER_EMITTER, vfxModuleInfo, type VfxBurst, type VfxDocument, type VfxEmitter, type VfxInitial, type VfxModule, type VfxModuleKind, type VfxRenderer, type VfxShape, type VfxSpawn, } from '@/engine/vfx/document/vfx-document';
import { duplicateEmitter, duplicateModule, insertEmitter, insertModule, moveEmitter, moveModule, patchObject, removeEmitter, removeModule, uniqueEmitterName, updateEmitter } from '@/engine/vfx/document/vfx-tree';
import type { VfxInstance } from '@/engine/vfx/simulation/vfx-instance';
import { addVfxActor } from './vfx-world-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
const LOG_SOURCE = 'Efeitos';
export type VfxEmitterPart = 'spawn' | 'shape' | 'initial' | 'renderer';
type PartOf<P extends VfxEmitterPart> = P extends 'spawn' ? VfxSpawn : P extends 'shape' ? VfxShape : P extends 'initial' ? VfxInitial : VfxRenderer;
type Mutable<T> = {
    -readonly [K in keyof T]: T[K];
};
export function vfxMergeKey(...parts: Array<string | number>): string {
    return `vfx-doc:${parts.join(':')}`;
}
export function endVfxDocumentEdit(session: EditorSession): void {
    session.vfx.endMerge();
}
export function patchVfxDocument(session: EditorSession, patch: Partial<VfxDocument>, label: string, mergeKey?: string): void {
    const sanitized: Mutable<Partial<VfxDocument>> = { ...patch };
    if (sanitized.duration !== undefined)
        sanitized.duration = clamp(sanitized.duration, 0.05, VFX_MAX_DURATION);
    if (sanitized.prewarm !== undefined)
        sanitized.prewarm = clamp(sanitized.prewarm, 0, VFX_MAX_DURATION);
    if (sanitized.scale !== undefined)
        sanitized.scale = clamp(sanitized.scale, 0.01, 100);
    if (sanitized.cullRadius !== undefined)
        sanitized.cullRadius = Math.max(0, sanitized.cullRadius);
    session.vfx.apply(label, (document) => patchObject(document, sanitized), mergeKey);
}
export function addVfxEmitter(session: EditorSession, patch: Partial<Omit<VfxEmitter, 'id'>> = {}): void {
    const editor = session.vfx;
    const { document } = editor;
    if (!document)
        return;
    if (document.emitters.length >= VFX_MAX_EMITTERS) {
        session.log.warn(LOG_SOURCE, `Um efeito tem no máximo ${VFX_MAX_EMITTERS} emissores.`);
        return;
    }
    const emitter = createEmitter({ name: uniqueEmitterName(document, patch.name ?? 'Emissor'), ...patch });
    if (editor.apply(`Adicionar emissor ${emitter.name}`, (current) => insertEmitter(current, emitter)))
        editor.selectEmitter(emitter.id);
}
export function removeVfxEmitter(session: EditorSession, emitterId: string): void {
    const editor = session.vfx;
    const emitter = editor.document?.emitters.find((candidate) => candidate.id === emitterId);
    if (!emitter)
        return;
    editor.apply(`Remover emissor ${emitter.name}`, (document) => removeEmitter(document, emitterId));
}
export function duplicateVfxEmitter(session: EditorSession, emitterId: string): void {
    const editor = session.vfx;
    const document = editor.document;
    const emitter = document?.emitters.find((candidate) => candidate.id === emitterId);
    if (!document || !emitter)
        return;
    if (document.emitters.length >= VFX_MAX_EMITTERS) {
        session.log.warn(LOG_SOURCE, `Um efeito tem no máximo ${VFX_MAX_EMITTERS} emissores.`);
        return;
    }
    const before = document.emitters.length;
    if (editor.apply(`Duplicar emissor ${emitter.name}`, (current) => duplicateEmitter(current, emitterId))) {
        const after = editor.document;
        const index = after?.emitters.findIndex((candidate) => candidate.id === emitterId) ?? -1;
        const copy = after && after.emitters.length > before && index >= 0 ? after.emitters[index + 1] : null;
        if (copy)
            editor.selectEmitter(copy.id);
    }
}
export function moveVfxEmitter(session: EditorSession, emitterId: string, toIndex: number): void {
    session.vfx.apply('Reordenar emissores', (document) => moveEmitter(document, emitterId, toIndex));
}
export function renameVfxEmitter(session: EditorSession, emitterId: string, name: string): void {
    const editor = session.vfx;
    const document = editor.document;
    const emitter = document?.emitters.find((candidate) => candidate.id === emitterId);
    const trimmed = name.trim();
    if (!document || !emitter || !trimmed || trimmed === emitter.name)
        return;
    const unique = uniqueEmitterName(document, trimmed, emitterId);
    editor.apply(`Renomear emissor para ${unique}`, (current) => updateEmitter(current, emitterId, (target) => ({ ...target, name: unique })));
}
export function patchVfxEmitter(session: EditorSession, emitterId: string, patch: Partial<VfxEmitter>, label: string, mergeKey?: string): void {
    const sanitized: Mutable<Partial<VfxEmitter>> = { ...patch };
    if (sanitized.maxParticles !== undefined)
        sanitized.maxParticles = Math.round(clamp(sanitized.maxParticles, 1, VFX_MAX_PARTICLES_PER_EMITTER));
    if (sanitized.delay !== undefined)
        sanitized.delay = clamp(sanitized.delay, 0, VFX_MAX_DURATION);
    if (sanitized.duration !== undefined)
        sanitized.duration = clamp(sanitized.duration, 0, VFX_MAX_DURATION);
    session.vfx.apply(label, (document) => updateEmitter(document, emitterId, (emitter) => patchObject(emitter, sanitized)), mergeKey);
}
export function toggleVfxEmitter(session: EditorSession, emitterId: string): void {
    const emitter = session.vfx.document?.emitters.find((candidate) => candidate.id === emitterId);
    if (!emitter)
        return;
    patchVfxEmitter(session, emitterId, { enabled: !emitter.enabled }, `${emitter.enabled ? 'Desligar' : 'Ligar'} emissor ${emitter.name}`);
}
export function soloVfxEmitter(session: EditorSession, emitterId: string): void {
    const editor = session.vfx;
    const document = editor.document;
    if (!document)
        return;
    const alreadySolo = document.emitters.every((emitter) => emitter.enabled === (emitter.id === emitterId));
    editor.apply(alreadySolo ? 'Ligar todos os emissores' : 'Isolar emissor', (current) => ({
        ...current,
        emitters: current.emitters.map((emitter) => {
            const enabled = alreadySolo ? true : emitter.id === emitterId;
            return emitter.enabled === enabled ? emitter : { ...emitter, enabled };
        }),
    }));
}
export function patchVfxEmitterPart<P extends VfxEmitterPart>(session: EditorSession, emitterId: string, part: P, patch: Partial<PartOf<P>>, label: string, mergeKey?: string): void {
    session.vfx.apply(label, (document) => updateEmitter(document, emitterId, (emitter) => {
        const current = emitter[part] as PartOf<P>;
        const next = patchObject(current, patch);
        return next === current ? emitter : { ...emitter, [part]: next };
    }), mergeKey);
}
export function addVfxBurst(session: EditorSession, emitterId: string, time = 0): void {
    session.vfx.apply('Adicionar rajada', (document) => updateEmitter(document, emitterId, (emitter) => ({ ...emitter, spawn: { ...emitter.spawn, bursts: [...emitter.spawn.bursts, createBurst({ time })] } })));
}
export function removeVfxBurst(session: EditorSession, emitterId: string, burstId: string): void {
    session.vfx.apply('Remover rajada', (document) => updateEmitter(document, emitterId, (emitter) => ({ ...emitter, spawn: { ...emitter.spawn, bursts: emitter.spawn.bursts.filter((burst) => burst.id !== burstId) } })));
}
export function patchVfxBurst(session: EditorSession, emitterId: string, burstId: string, patch: Partial<VfxBurst>, label: string, mergeKey?: string): void {
    const sanitized: Mutable<Partial<VfxBurst>> = { ...patch };
    if (sanitized.time !== undefined)
        sanitized.time = clamp(sanitized.time, 0, VFX_MAX_DURATION);
    if (sanitized.count !== undefined)
        sanitized.count = Math.round(clamp(sanitized.count, 0, VFX_MAX_PARTICLES_PER_EMITTER));
    if (sanitized.countMax !== undefined)
        sanitized.countMax = Math.round(clamp(sanitized.countMax, 0, VFX_MAX_PARTICLES_PER_EMITTER));
    if (sanitized.cycles !== undefined)
        sanitized.cycles = Math.round(clamp(sanitized.cycles, 0, 1000));
    if (sanitized.interval !== undefined)
        sanitized.interval = clamp(sanitized.interval, 0.01, VFX_MAX_DURATION);
    if (sanitized.probability !== undefined)
        sanitized.probability = clamp(sanitized.probability, 0, 1);
    session.vfx.apply(label, (document) => updateEmitter(document, emitterId, (emitter) => {
        let changed = false;
        const bursts = emitter.spawn.bursts.map((burst) => {
            if (burst.id !== burstId)
                return burst;
            const next = patchObject(burst, sanitized);
            changed = next !== burst;
            return next;
        });
        return changed ? { ...emitter, spawn: { ...emitter.spawn, bursts } } : emitter;
    }), mergeKey);
}
export function addVfxModule(session: EditorSession, emitterId: string, kind: VfxModuleKind): void {
    const editor = session.vfx;
    const module = createModule(kind);
    if (editor.apply(`Adicionar módulo ${vfxModuleInfo(kind).label}`, (document) => insertModule(document, emitterId, module)))
        editor.selectModule(emitterId, module.id);
}
export function removeVfxModule(session: EditorSession, emitterId: string, moduleId: string): void {
    const editor = session.vfx;
    const module = editor.document?.emitters.find((emitter) => emitter.id === emitterId)?.modules.find((candidate) => candidate.id === moduleId);
    if (!module)
        return;
    editor.apply(`Remover módulo ${vfxModuleInfo(module.kind).label}`, (document) => removeModule(document, emitterId, moduleId));
}
export function duplicateVfxModule(session: EditorSession, emitterId: string, moduleId: string): void {
    const editor = session.vfx;
    const emitter = editor.document?.emitters.find((candidate) => candidate.id === emitterId);
    const index = emitter?.modules.findIndex((candidate) => candidate.id === moduleId) ?? -1;
    if (!emitter || index < 0)
        return;
    if (editor.apply(`Duplicar módulo ${vfxModuleInfo(emitter.modules[index].kind).label}`, (document) => duplicateModule(document, emitterId, moduleId))) {
        const copy = editor.document?.emitters.find((candidate) => candidate.id === emitterId)?.modules[index + 1];
        if (copy)
            editor.selectModule(emitterId, copy.id);
    }
}
export function moveVfxModule(session: EditorSession, emitterId: string, moduleId: string, toIndex: number): void {
    session.vfx.apply('Reordenar módulos', (document) => moveModule(document, emitterId, moduleId, toIndex));
}
export function toggleVfxModule(session: EditorSession, emitterId: string, moduleId: string): void {
    const module = session.vfx.document?.emitters.find((emitter) => emitter.id === emitterId)?.modules.find((candidate) => candidate.id === moduleId);
    if (!module)
        return;
    patchVfxModule(session, emitterId, moduleId, { enabled: !module.enabled } as Partial<VfxModule>, `${module.enabled ? 'Desligar' : 'Ligar'} módulo ${vfxModuleInfo(module.kind).label}`);
}
export function patchVfxModule<M extends VfxModule>(session: EditorSession, emitterId: string, moduleId: string, patch: Partial<M>, label: string, mergeKey?: string): void {
    session.vfx.apply(label, (document) => updateEmitter(document, emitterId, (emitter) => {
        let changed = false;
        const modules = emitter.modules.map((module) => {
            if (module.id !== moduleId)
                return module;
            const next = patchObject(module as M, patch);
            changed = next !== module;
            return next as VfxModule;
        });
        return changed ? { ...emitter, modules } : emitter;
    }), mergeKey);
}
export function ensureVfxStage(session: EditorSession): void {
    const editor = session.vfx;
    if (!editor.document)
        return;
    if (editor.stageEntityId !== null && session.findById(editor.stageEntityId))
        return;
    const stage = addVfxActor(session, { assetId: editor.assetId, name: editor.document.name });
    editor.setStage(stage.id);
}
export function restartVfxStage(session: EditorSession): void {
    const editor = session.vfx;
    if (editor.stageEntityId === null)
        return;
    editor.setPaused(false);
    session.vfxWorld.system.play(editor.stageEntityId);
    session.notify();
}
export function stopVfxStage(session: EditorSession): void {
    const editor = session.vfx;
    if (editor.stageEntityId === null)
        return;
    editor.setPaused(false);
    session.vfxWorld.system.stop(editor.stageEntityId);
    session.notify();
}
export function vfxStageInstance(session: EditorSession): VfxInstance | null {
    const { stageEntityId } = session.vfx;
    return stageEntityId === null ? null : session.vfxWorld.system.instanceOf(stageEntityId);
}
export function isVfxStageRunning(session: EditorSession): boolean {
    const instance = vfxStageInstance(session);
    return instance !== null && instance.state === 'playing' && !session.vfx.paused;
}
export function toggleVfxStagePlayback(session: EditorSession): void {
    const editor = session.vfx;
    if (!editor.document)
        return;
    if (editor.stageEntityId === null || !session.findById(editor.stageEntityId)) {
        ensureVfxStage(session);
        restartVfxStage(session);
        return;
    }
    const instance = vfxStageInstance(session);
    if (!instance || instance.state === 'stopped' || instance.state === 'finished') {
        restartVfxStage(session);
        return;
    }
    if (instance.state === 'paused') {
        session.vfxWorld.system.resume(editor.stageEntityId);
        editor.setPaused(false);
        session.notify();
        return;
    }
    editor.setPaused(!editor.paused);
}
export function stepVfxStage(session: EditorSession, seconds: number): void {
    const editor = session.vfx;
    if (!editor.document)
        return;
    if (editor.stageEntityId === null || !session.findById(editor.stageEntityId))
        ensureVfxStage(session);
    const instance = vfxStageInstance(session);
    if (!instance || instance.state === 'stopped' || instance.state === 'finished')
        restartVfxStage(session);
    else if (instance.state === 'paused' && editor.stageEntityId !== null)
        session.vfxWorld.system.resume(editor.stageEntityId);
    editor.stepFrame(seconds);
}
export function seekVfxStage(session: EditorSession, seconds: number): void {
    const editor = session.vfx;
    if (!editor.document)
        return;
    if (editor.stageEntityId === null || !session.findById(editor.stageEntityId))
        ensureVfxStage(session);
    const instance = vfxStageInstance(session);
    if (!instance || instance.state === 'stopped' || instance.state === 'finished')
        restartVfxStage(session);
    else if (instance.state === 'paused' && editor.stageEntityId !== null)
        session.vfxWorld.system.resume(editor.stageEntityId);
    editor.seek(seconds);
}
