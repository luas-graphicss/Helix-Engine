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
