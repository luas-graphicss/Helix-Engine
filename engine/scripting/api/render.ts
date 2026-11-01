import * as vec3 from '@/engine/core/math/vec3';
import * as mat4 from '@/engine/core/math/mat4';
import * as aabb from '@/engine/core/math/aabb';
import { assignPostProcessSettings, createPostProcessSettings, findPostProcessPreset, matchPostProcessPreset, POST_PROCESS_PRESETS, TONE_MAPPERS, type PostProcessSettings, } from '@/engine/core/environment/post-process-settings';
import type { Renderer } from '@/engine/renderer/renderer';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import type { LightHelperMode } from '@/engine/renderer/passes/light-helper-pass';
import type { SoundHelperMode } from '@/engine/renderer/passes/sound-helper-pass';
import type { VfxHelperMode } from '@/engine/renderer/passes/vfx-helper-pass';
import type { CustomPostEffect } from '@/engine/renderer/post/custom-post-pass';
import type { CompiledShaderBundle } from '@/engine/renderer/shaders/custom/shader-bundle';
import type { ShaderBinding } from '@/engine/renderer/shaders/custom/shader-values';
import { HelixArgumentError, HelixError, HelixNotImplementedError } from '../runtime/script-errors';
import type { FrameHookFn, FrameInfo, RuntimeHost } from '../runtime/runtime-host';
import type { ScriptOwner } from '../runtime/runtime-context';
import type { ShaderUniforms } from '../runtime/shader-bindings';
import { assignSettings, requireEntity, requireFunction, requireNumber, requireObject, requireOneOf, requireString } from '../runtime/values';
export const RENDER_PASSES = ['shadow', 'localShadow', 'depthPrepass', 'mesh', 'terrain', 'grass', 'water', 'sky', 'vfx', 'guiSurface', 'post', 'overlays'] as const;
export type RenderPassName = (typeof RENDER_PASSES)[number];
const HELPER_MODES = ['off', 'selected', 'all'] as const;
const EASINGS = ['linear', 'easeIn', 'easeOut', 'easeInOut'] as const;
type Easing = (typeof EASINGS)[number];
export class MutableFrameInfo implements FrameInfo {
    gl: WebGL2RenderingContext | null = null;
    width = 0;
    height = 0;
    pixelRatio = 1;
    elapsed = 0;
    delta = 0;
    frame = 0;
    readonly view = mat4.create();
    readonly projection = mat4.create();
    readonly viewProjection = mat4.create();
    readonly cameraPosition = vec3.create();
    sceneColor: WebGLTexture | null = null;
    sceneDepth: WebGLTexture | null = null;
    hdr = true;
}
export interface CustomPostEntry extends CustomPostEffect {
    readonly name: string;
    readonly binding: ShaderBinding;
    enabled: boolean;
    readonly owner: ScriptOwner | null;
}
export interface CustomPostHandle {
    readonly name: string;
    enabled: boolean;
    readonly uniforms: ShaderUniforms;
    remove(): void;
}
export class RenderState {
    enabled = true;
    readonly disabledPasses = new Set<RenderPassName>();
    readonly frame = new MutableFrameInfo();
    readonly programs = new Set<ShaderProgram>();
    readonly customPost: CustomPostEntry[] = [];
    shaderWarmup: CompiledShaderBundle[] = [];
    reset(): void {
        this.enabled = true;
        this.disabledPasses.clear();
        for (const program of this.programs)
            program.dispose();
        this.programs.clear();
        this.customPost.length = 0;
        this.shaderWarmup = [];
    }
    isPassEnabled(name: RenderPassName): boolean {
        return this.enabled && !this.disabledPasses.has(name);
    }
}
function ease(kind: Easing, t: number): number {
    switch (kind) {
        case 'easeIn':
            return t * t;
        case 'easeOut':
            return 1 - (1 - t) * (1 - t);
        case 'easeInOut':
            return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        default:
            return t;
    }
}
function resolveNumericPath(root: Record<string, unknown>, path: string, member: string): {
    target: Record<string, unknown>;
    key: string;
} {
    const parts = path.split('.');
    let target: Record<string, unknown> = root;
    for (let index = 0; index < parts.length - 1; index++) {
        const next = target[parts[index]];
        if (!next || typeof next !== 'object')
            throw new HelixArgumentError(member, `"${path}" não existe nas configurações.`);
        target = next as Record<string, unknown>;
    }
    const key = parts[parts.length - 1];
    if (typeof target[key] !== 'number')
        throw new HelixArgumentError(member, `"${path}" não é um campo numérico.`);
    return { target, key };
}
export function createPostApi(host: RuntimeHost) {
    const { session } = host;
    const settings = session.scene.postProcessing;
    function tween(root: Record<string, unknown>, path: unknown, value: unknown, seconds: unknown, easing: unknown, member: string): Promise<void> {
        const { target, key } = resolveNumericPath(root, requireString(path, member, 'o caminho do campo'), member);
        const to = requireNumber(value, member, 'o valor final');
        const duration = Math.max(0, requireNumber(seconds, member, 'a duração'));
        const kind = easing === undefined ? 'easeInOut' : requireOneOf(easing, EASINGS, member, 'a suavização');
        const from = target[key] as number;
        if (duration === 0) {
            target[key] = to;
            return Promise.resolve();
        }
        const owner = host.current;
        return new Promise<void>((resolve) => {
            let elapsed = 0;
            const step = () => {
                elapsed += host.time.delta;
                const t = Math.min(1, elapsed / duration);
                target[key] = from + (to - from) * ease(kind, t);
                if (t >= 1)
                    resolve();
                else
                    host.scheduler.nextFrame(owner, step);
            };
            host.scheduler.nextFrame(owner, step);
        });
    }
    return {
        get settings() {
            return settings;
        },
        set: (patch: unknown) => {
            assignSettings(settings as unknown as Record<string, unknown>, patch, 'helix.post.set');
            session.notify();
        },
        get enabled() {
            return settings.enabled;
        },
        set enabled(value: boolean) {
            session.updatePostProcess({ enabled: Boolean(value) });
        },
        get exposure() {
            return settings.exposure;
        },
        set exposure(value: number) {
            session.updatePostProcess({ exposure: requireNumber(value, 'helix.post.exposure', 'a exposição') });
        },
        get toneMapper() {
            return settings.toneMapper;
        },
        set toneMapper(value: PostProcessSettings['toneMapper']) {
            session.updatePostProcess({ toneMapper: requireOneOf(value, TONE_MAPPERS, 'helix.post.toneMapper', 'o tone mapper') });
        },
        toneMappers: () => TONE_MAPPERS.slice(),
        get whiteBalance() {
            return settings.whiteBalance;
        },
        get grading() {
            return settings.grading;
        },
        get bloom() {
            return settings.bloom;
        },
        get depthOfField() {
            return settings.depthOfField;
        },
        get vignette() {
            return settings.vignette;
        },
        get chromaticAberration() {
            return settings.chromaticAberration;
        },
        get filmGrain() {
            return settings.filmGrain;
        },
        get lensDistortion() {
            return settings.lensDistortion;
        },
        get sharpen() {
            return settings.sharpen;
        },
        presets: () => POST_PROCESS_PRESETS.map((preset) => ({ id: preset.id, label: preset.name, description: preset.description })),
        applyPreset: (id: unknown) => {
            const presetId = requireString(id, 'helix.post.applyPreset', 'o id do preset');
            if (!findPostProcessPreset(presetId))
                throw new HelixArgumentError('helix.post.applyPreset', `preset "${presetId}" desconhecido. Presets: ${POST_PROCESS_PRESETS.map((preset) => preset.id).join(', ')}.`);
            session.applyPostProcessPreset(presetId);
        },
        currentPreset: () => matchPostProcessPreset(settings),
        assign: (target: unknown, source: unknown) => assignPostProcessSettings(target as PostProcessSettings, source as PostProcessSettings),
        create: (options?: unknown) => createPostProcessSettings(options === undefined ? {} : (requireObject(options, 'helix.post.create') as Parameters<typeof createPostProcessSettings>[0])),
        snapshot: () => {
            const copy = createPostProcessSettings();
            assignPostProcessSettings(copy, settings);
            return copy;
        },
        focusOn: (entity: unknown) => {
            const target = requireEntity(entity, 'helix.post.focusOn');
            const bounds = host.boundsOf(target);
            const center = vec3.create();
            if (aabb.isEmpty(bounds)) {
                session.scene.updateWorldMatrices();
                mat4.getTranslation(center, target.worldMatrix);
            }
            else {
                vec3.set(center, (bounds.min[0] + bounds.max[0]) / 2, (bounds.min[1] + bounds.max[1]) / 2, (bounds.min[2] + bounds.max[2]) / 2);
            }
            settings.depthOfField.focusDistance = vec3.distance(session.camera.position, center);
            return settings.depthOfField.focusDistance;
        },
        get compareSplit(): number | null {
            return session.render.postCompare.enabled ? session.render.postCompare.split : null;
        },
        set compareSplit(value: number | null) {
            if (value === null)
                session.updatePostCompare({ enabled: false });
            else
                session.updatePostCompare({ enabled: true, split: Math.min(1, Math.max(0, requireNumber(value, 'helix.post.compareSplit', 'a divisão'))) });
        },
        tween: (path: unknown, value: unknown, seconds: unknown, easing?: unknown) => tween(settings as unknown as Record<string, unknown>, path, value, seconds, easing, 'helix.post.tween'),
        custom: createCustomPostApi(host),
    };
}
function createCustomPostApi(host: RuntimeHost) {
    const { renderState: state, shaders } = host;
    const list = state.customPost;
    function find(target: unknown, member: string): CustomPostEntry | null {
        if (typeof target === 'string')
            return list.find((entry) => entry.name === target) ?? null;
        if (typeof target === 'object' && target !== null && 'name' in target)
            return list.find((entry) => entry.name === (target as {
                name: unknown;
            }).name) ?? null;
        throw new HelixArgumentError(member, 'esperava o nome do efeito ou o objeto devolvido por helix.post.custom.add.');
    }
    function remove(entry: CustomPostEntry): boolean {
        const index = list.indexOf(entry);
        if (index < 0)
            return false;
        list.splice(index, 1);
        shaders.release(entry.binding);
        return true;
    }
    const handles = new WeakMap<CustomPostEntry, CustomPostHandle>();
    function handleFor(entry: CustomPostEntry): CustomPostHandle {
        const cached = handles.get(entry);
        if (cached)
            return cached;
        const handle: CustomPostHandle = {
            get name() {
                return entry.name;
            },
            get enabled() {
                return entry.enabled;
            },
            set enabled(value: boolean) {
                entry.enabled = Boolean(value);
            },
            uniforms: shaders.uniforms(entry.binding),
            remove: () => {
                remove(entry);
            },
        };
        handles.set(entry, handle);
        return handle;
    }
    return {
        add: (pass: unknown): CustomPostHandle => {
            const member = 'helix.post.custom.add';
            const options = requireObject(pass, member, 'o efeito');
            const asset = options.fragment ?? options.shader;
            if (asset === undefined)
                throw new HelixArgumentError(member, 'informe o ativo de shader em `fragment` (nome, id ou o próprio ativo).');
            const binding = shaders.bind(asset, 'post', options.uniforms, member);
            const name = options.name === undefined ? binding.bundle.name : requireString(options.name, member, 'o nome do efeito');
            const previous = list.find((entry) => entry.name === name);
            const entry: CustomPostEntry = { name, binding, enabled: options.enabled === undefined ? true : Boolean(options.enabled), owner: host.current };
            if (previous) {
                shaders.release(previous.binding);
                list[list.indexOf(previous)] = entry;
            }
            else {
                list.push(entry);
            }
            host.current?.track(() => {
                remove(entry);
            });
            return handleFor(entry);
        },
        get: (target: unknown): CustomPostHandle | null => {
            const entry = find(target, 'helix.post.custom.get');
            return entry ? handleFor(entry) : null;
        },
        remove: (target: unknown): boolean => {
            const entry = find(target, 'helix.post.custom.remove');
            return entry ? remove(entry) : false;
        },
        list: () => list.map((entry) => ({ name: entry.name, shader: entry.binding.bundle.name, enabled: entry.enabled })),
        clear: () => {
            for (const entry of list.slice())
                remove(entry);
        },
    };
}
export function createRenderApi(host: RuntimeHost, state: RenderState) {
    const { session } = host;
    function renderer(member: string): Renderer {
        const current = session.viewportRenderer;
        if (!current)
            throw new HelixError(`${member}: o renderizador do viewport ainda não existe neste momento.`);
        return current;
    }
    function hook(list: Array<{
        owner: ScriptOwner | null;
        fn: FrameHookFn;
    }>, fnValue: unknown, member: string): () => void {
        const fn = requireFunction<FrameHookFn>(fnValue, member);
        const entry = { owner: host.current, fn };
        list.push(entry);
        const remove = () => {
            const index = list.indexOf(entry);
            if (index >= 0)
                list.splice(index, 1);
        };
        host.current?.track(remove);
        return remove;
    }
    function passHook(map: Map<string, Array<{
        owner: ScriptOwner | null;
        fn: FrameHookFn;
    }>>, nameValue: unknown, fnValue: unknown, member: string): () => void {
        const name = requireOneOf(nameValue, RENDER_PASSES, member, 'o passe');
        let list = map.get(name);
        if (!list) {
            list = [];
            map.set(name, list);
        }
        return hook(list, fnValue, member);
    }
    const passes = Object.fromEntries(RENDER_PASSES.map((name) => [
        name,
        {
            get enabled() {
                return !state.disabledPasses.has(name);
            },
            set enabled(value: boolean) {
                if (value)
                    state.disabledPasses.delete(name);
                else
                    state.disabledPasses.add(name);
            },
        },
    ])) as Record<RenderPassName, {
        enabled: boolean;
    }>;
    const helperMode = (value: unknown, member: string) => requireOneOf(value, HELPER_MODES, member, 'o modo');
    return {
        get enabled() {
            return state.enabled;
        },
        set enabled(value: boolean) {
            state.enabled = Boolean(value);
        },
        passes,
        passNames: () => RENDER_PASSES.slice(),
        get showGrid() {
            return session.showGrid;
        },
        set showGrid(value: boolean) {
            if (session.showGrid !== Boolean(value))
                session.toggleGrid();
        },
        get shadows() {
            return session.shadowsEnabled;
        },
        set shadows(value: boolean) {
            if (session.shadowsEnabled !== Boolean(value))
                session.toggleShadows();
        },
        get showCsgBrushes() {
            return session.render.showCsgBrushes;
        },
        set showCsgBrushes(value: boolean) {
            if (session.render.showCsgBrushes !== Boolean(value))
                session.toggleCsgBrushes();
        },
        get lightHelpers() {
            return session.render.lightHelpers;
        },
        set lightHelpers(value: LightHelperMode) {
            session.setLightHelpers(helperMode(value, 'helix.render.lightHelpers') as LightHelperMode);
        },
        get soundHelpers() {
            return session.render.soundHelpers;
        },
        set soundHelpers(value: SoundHelperMode) {
            session.setSoundHelpers(helperMode(value, 'helix.render.soundHelpers') as SoundHelperMode);
        },
        get vfxHelpers() {
            return session.render.vfxHelpers;
        },
        set vfxHelpers(value: VfxHelperMode) {
            session.setVfxHelpers(helperMode(value, 'helix.render.vfxHelpers') as VfxHelperMode);
        },
        get culling() {
            return session.render.culling;
        },
        get lod() {
            return session.render.lod;
        },
        get myriad() {
            return session.render.myriad;
        },
        get terrainMaterialCache() {
            return session.render.terrain.materialCache;
        },
        set terrainMaterialCache(value: boolean) {
            if (session.render.terrain.materialCache !== Boolean(value))
                session.toggleTerrainMaterialCache();
        },
        get profileGpu() {
            return session.render.profileGpu;
        },
        set profileGpu(value: boolean) {
            session.setGpuProfiling(Boolean(value));
        },
        get renderOnDemand() {
            return session.render.renderOnDemand;
        },
        set renderOnDemand(value: boolean) {
            session.setRenderOnDemand(Boolean(value));
        },
        get pixelRatio() {
            return renderer('helix.render.pixelRatio').maxPixelRatio;
        },
        set pixelRatio(value: number) {
            renderer('helix.render.pixelRatio').maxPixelRatio = Math.min(4, Math.max(0.25, requireNumber(value, 'helix.render.pixelRatio', 'a razão de pixels')));
            session.notify();
        },
        get profile() {
            return renderer('helix.render.profile').profile;
        },
        setProfile: (patch: unknown) => {
            assignSettings(renderer('helix.render.setProfile').profile as unknown as Record<string, unknown>, patch, 'helix.render.setProfile');
        },
        get stats() {
            return session.stats;
        },
        get frame() {
            return state.frame;
        },
        onBeforeFrame: (fn: unknown) => hook(host.frameHooks.before, fn, 'helix.render.onBeforeFrame'),
        onAfterFrame: (fn: unknown) => hook(host.frameHooks.after, fn, 'helix.render.onAfterFrame'),
        onBeforePass: (name: unknown, fn: unknown) => passHook(host.frameHooks.beforePass, name, fn, 'helix.render.onBeforePass'),
        onAfterPass: (name: unknown, fn: unknown) => passHook(host.frameHooks.afterPass, name, fn, 'helix.render.onAfterPass'),
        custom: {
            add: (pass: unknown) => {
                const options = requireObject(pass, 'helix.render.custom.add', 'o passe');
                const name = requireString(options.name, 'helix.render.custom.add', 'o nome do passe');
                const after = requireOneOf(options.after ?? 'post', RENDER_PASSES, 'helix.render.custom.add', 'o passe de referência (after)');
                const render = requireFunction<FrameHookFn>(options.render, 'helix.render.custom.add', 'render(gl, frame)');
                const entry = { owner: host.current, name, after, render };
                host.frameHooks.custom.push(entry);
                const remove = () => {
                    const index = host.frameHooks.custom.indexOf(entry);
                    if (index >= 0)
                        host.frameHooks.custom.splice(index, 1);
                };
                host.current?.track(remove);
                return remove;
            },
            list: () => host.frameHooks.custom.map((entry) => ({ name: entry.name, after: entry.after })),
        },
        get gl() {
            return renderer('helix.render.gl').gl;
        },
        get canvas() {
            return session.viewportCanvas;
        },
        get capabilities() {
            return renderer('helix.render.capabilities').capabilities;
        },
        createProgram: (vertexSource: unknown, fragmentSource: unknown, defines?: unknown) => {
            const gl = renderer('helix.render.createProgram').gl;
            let prefix = '';
            if (defines !== undefined) {
                for (const [key, value] of Object.entries(requireObject(defines, 'helix.render.createProgram', 'os defines')))
                    prefix += `#define ${key} ${value === true ? '1' : String(value)}\n`;
            }
            const withDefines = (source: string) => {
                const text = requireString(source, 'helix.render.createProgram', 'o código do shader');
                if (!prefix)
                    return text;
                const versionEnd = text.startsWith('#version') ? text.indexOf('\n') + 1 : 0;
                return text.slice(0, versionEnd) + prefix + text.slice(versionEnd);
            };
            const program = new ShaderProgram(gl, withDefines(vertexSource as string), withDefines(fragmentSource as string));
            state.programs.add(program);
            host.current?.track(() => {
                program.dispose();
                state.programs.delete(program);
            });
            return program;
        },
        createTexture: () => {
            throw new HelixNotImplementedError('helix.render.createTexture', 'use helix.render.gl.createTexture() diretamente por enquanto.');
        },
        createRenderTarget: () => {
            throw new HelixNotImplementedError('helix.render.createRenderTarget', 'alvos de render próprios ainda não têm fábrica; monte um framebuffer com helix.render.gl.');
        },
        createMesh: () => {
            throw new HelixNotImplementedError('helix.render.createMesh', 'malhas de GPU soltas ainda não são expostas; use helix.mesh em um ator.');
        },
        fullscreenTriangle: () => {
            throw new HelixNotImplementedError('helix.render.fullscreenTriangle');
        },
        shaders: {
            override: () => {
                throw new HelixNotImplementedError('helix.render.shaders.override', 'a troca dos shaders da engine por ativos ainda não está ligada.');
            },
        },
        skybox: () => {
            throw new HelixNotImplementedError('helix.render.skybox', 'skybox por textura ainda não é suportado; desligue helix.sky.enabled e desenhe em onBeforePass("sky").');
        },
    };
}
