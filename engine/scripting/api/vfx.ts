import { Entity } from '@/engine/core/scene/entity';
import { VFX_BLEND_MODES, VFX_MODULE_CATALOG, VFX_RENDER_MODES, VFX_SHAPE_KINDS, createEmitter, createModule, createVfxDocument, type VfxDocument, type VfxEmitter, type VfxModuleKind, } from '@/engine/vfx/document/vfx-document';
import { normalizeVfxDocument, serializeVfxDocument } from '@/engine/vfx/document/vfx-io';
import { VFX_TEMPLATES, findVfxTemplate } from '@/engine/vfx/document/vfx-templates';
import { findEmitter, insertEmitter, insertModule, removeEmitter, removeModule, updateEmitter, updateModule } from '@/engine/vfx/document/vfx-tree';
import { VFX_BUILTIN_TEXTURES } from '@/engine/vfx/textures/vfx-texture-catalog';
import { createVfxSettings, type VfxSettings } from '@/engine/vfx/vfx-settings';
import type { VfxInstance } from '@/engine/vfx/simulation/vfx-instance';
import { loadVfxAsset, saveVfxDocumentToLibrary } from '@/engine/editor/operations/vfx-operations';
import { HelixArgumentError, HelixError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import { assignSettings, requireEntity, requireNumber, requireObject, requireOneOf, requireString, toVec3 } from '../runtime/values';
import type { SceneApi } from './scene';
const VFX_SETTING_FIELDS: ReadonlySet<string> = new Set(['assetId', 'autoPlay', 'playInEditor', 'loop', 'scale', 'timeScale', 'seed', 'cullDistance']);
const MODULE_KINDS = VFX_MODULE_CATALOG.map((info) => info.kind) as readonly VfxModuleKind[];
interface LooseEffect {
    readonly entity: Entity;
    idleFrames: number;
}
interface PendingBurst {
    readonly entity: Entity;
    readonly count: number;
    readonly emitter: unknown;
    frames: number;
}
const PENDING_BURST_TIMEOUT_FRAMES = 600;
export function createVfxApi(host: RuntimeHost, sceneApi: SceneApi) {
    const { session, bus } = host;
    const system = () => session.vfxWorld.system;
    const loose: LooseEffect[] = [];
    const pendingBursts: PendingBurst[] = [];
    const lastState = new Map<number, string>();
    function entityWithVfx(value: unknown, member: string): Entity & {
        vfx: VfxSettings;
    } {
        const entity = requireEntity(value, member);
        if (!entity.vfx)
            throw new HelixArgumentError(member, `${entity.name} não tem componente de efeito visual (helix.vfx.attach).`);
        return entity as Entity & {
            vfx: VfxSettings;
        };
    }
    function instanceOf(value: unknown, member: string): VfxInstance | null {
        return system().instanceOf(entityWithVfx(value, member).id);
    }
    function requireInstance(value: unknown, member: string): VfxInstance {
        const entity = entityWithVfx(value, member);
        const instance = system().instanceOf(entity.id);
        if (!instance)
            throw new HelixError(`${member}: o efeito de ${entity.name} ainda não foi instanciado (o documento está carregando ou o ator está invisível).`);
        return instance;
    }
    function isDocumentLike(value: unknown): value is Record<string, unknown> & {
        emitters: unknown[];
    } {
        return !!value && typeof value === 'object' && Array.isArray((value as {
            emitters?: unknown;
        }).emitters);
    }
    function requireDocument(value: unknown, member: string): VfxDocument {
        if (isDocumentLike(value))
            return normalizeVfxDocument(value, typeof value.name === 'string' ? value.name : undefined);
        throw new HelixArgumentError(member, 'esperava um VfxDocument (helix.vfx.create, fromTemplate ou document).');
    }
    async function documentOf(value: unknown, member: string): Promise<VfxDocument> {
        if (isDocumentLike(value))
            return requireDocument(value, member);
        const asset = host.resolveAsset(value, member, 'vfx');
        return loadVfxAsset(session, asset);
    }
    function emitterOf(document: VfxDocument, value: unknown, member: string): VfxEmitter {
        if (typeof value === 'number') {
            const emitter = document.emitters[value];
            if (!emitter)
                throw new HelixArgumentError(member, `emissor ${value} fora do documento (${document.emitters.length} emissores).`);
            return emitter;
        }
        const key = requireString(value, member, 'o emissor (id ou nome)');
        const emitter = findEmitter(document, key) ?? document.emitters.find((candidate) => candidate.name === key) ?? null;
        if (!emitter)
            throw new HelixArgumentError(member, `emissor "${key}" não existe. Emissores: ${document.emitters.map((candidate) => candidate.name).join(', ')}.`);
        return emitter;
    }
    function patchSettings(entity: Entity & {
        vfx: VfxSettings;
    }, patch: unknown, member: string): VfxSettings {
        const next = { ...entity.vfx } as Record<string, unknown>;
        assignSettings(next, patch, member);
        for (const key of Object.keys(next))
            if (!VFX_SETTING_FIELDS.has(key))
                throw new HelixArgumentError(member, `campo "${key}" não existe em VfxSettings. Campos: ${[...VFX_SETTING_FIELDS].join(', ')}.`);
        entity.vfx = createVfxSettings(next as Partial<VfxSettings>);
        session.notify();
        return entity.vfx;
    }
    function burstInto(instance: VfxInstance, entity: Entity, count: number, emitter: unknown, member: string): number {
        if (emitter === '*') {
            for (const simulator of instance.simulators)
                simulator.burst(count);
            return instance.simulators.length;
        }
        const target = emitter === undefined ? instance.document.emitters[0] : emitterOf(instance.document, emitter, member);
        const simulator = instance.simulators.find((candidate) => candidate.emitter.id === target?.id);
        if (!simulator)
            throw new HelixError(`${member}: o emissor não está simulando.`);
        simulator.burst(count);
        if (instance.state !== 'playing')
            system().play(entity.id);
        return 1;
    }
    function flushPendingBursts(): void {
        const sys = system();
        for (let i = pendingBursts.length - 1; i >= 0; i--) {
            const pending = pendingBursts[i];
            if (!session.scene.root.contains(pending.entity) || !pending.entity.vfx) {
                pendingBursts.splice(i, 1);
                continue;
            }
            const instance = sys.instanceOf(pending.entity.id);
            if (instance) {
                pendingBursts.splice(i, 1);
                try {
                    burstInto(instance, pending.entity, pending.count, pending.emitter, 'helix.vfx.burst');
                }
                catch (cause) {
                    host.log('warn', `helix.vfx.burst: a rajada adiada de ${pending.entity.name} falhou: ${cause instanceof Error ? cause.message : String(cause)}`);
                }
                continue;
            }
            if (++pending.frames > PENDING_BURST_TIMEOUT_FRAMES) {
                pendingBursts.splice(i, 1);
                host.log('warn', `helix.vfx.burst: o efeito de ${pending.entity.name} não chegou a instanciar; a rajada de ${pending.count} partículas foi descartada.`);
            }
        }
    }
    function particlesOf(instance: VfxInstance, emitterValue: unknown, member: string) {
        const emitter = emitterValue === undefined ? instance.document.emitters[0] : emitterOf(instance.document, emitterValue, member);
        const simulator = instance.simulators.find((candidate) => candidate.emitter.id === emitter?.id);
        if (!simulator)
            throw new HelixError(`${member}: o emissor não está simulando.`);
        const { pool } = simulator;
        return {
            emitter: simulator.emitter.name,
            get count() {
                return pool.count;
            },
            capacity: pool.capacity,
            positions: pool.position,
            velocities: pool.velocity,
            ages: pool.age,
            lifetimes: pool.lifetime,
            sizes: pool.size,
            rotations: pool.rotation,
            colors: pool.color,
            kill: (index: unknown) => pool.kill(requireNumber(index, `${member}.kill`, 'o índice')),
        };
    }
    function tick(): void {
        const sys = system();
        if (pendingBursts.length > 0)
            flushPendingBursts();
        session.scene.traverse((entity) => {
            if (!entity.vfx)
                return;
            const instance = sys.instanceOf(entity.id);
            const state = instance?.state ?? 'none';
            const previous = lastState.get(entity.id);
            if (previous !== undefined && previous !== state) {
                if (state === 'playing' && previous !== 'paused')
                    bus.emit('vfx.started', { entity }, entity.id);
                if (state === 'finished' || (state === 'stopped' && previous === 'playing'))
                    bus.emit('vfx.finished', { entity }, entity.id);
            }
            lastState.set(entity.id, state);
        });
        for (let i = loose.length - 1; i >= 0; i--) {
            const effect = loose[i];
            if (!session.scene.root.contains(effect.entity)) {
                loose.splice(i, 1);
                continue;
            }
            const instance = sys.instanceOf(effect.entity.id);
            const done = instance ? instance.state === 'finished' || (instance.state === 'stopped' && effect.idleFrames > 0) : false;
            if (done || (!instance && effect.idleFrames > 600)) {
                loose.splice(i, 1);
                sceneApi.destroy(effect.entity);
                continue;
            }
            effect.idleFrames = instance && instance.state === 'playing' ? 0 : effect.idleFrames + 1;
        }
    }
    host.updaters.add(tick);
    host.disposers.add(() => {
        loose.length = 0;
        pendingBursts.length = 0;
        lastState.clear();
    });
    const templates = {
        list: () => VFX_TEMPLATES.map((template) => ({ id: template.id, label: template.label, description: template.description, category: template.category })),
        ids: () => VFX_TEMPLATES.map((template) => template.id),
    };
    const textures = {
        list: () => [...VFX_BUILTIN_TEXTURES.map((info) => ({ kind: 'builtin' as const, id: info.id, label: info.label })), ...session.library.byKind('texture').map((asset) => ({ kind: 'asset' as const, id: asset.id, label: asset.name }))],
        builtin: (id: unknown) => ({ kind: 'builtin' as const, id: requireOneOf(id, VFX_BUILTIN_TEXTURES.map((info) => info.id), 'helix.vfx.textures.builtin', 'a textura') }),
        asset: (asset: unknown) => ({ kind: 'asset' as const, assetId: host.resolveAsset(asset, 'helix.vfx.textures.asset', 'texture').id }),
    };
}
