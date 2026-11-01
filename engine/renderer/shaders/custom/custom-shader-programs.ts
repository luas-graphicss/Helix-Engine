import type { GL } from '@/engine/renderer/gl/context';
import { ShaderCompileError, ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { sceneLightingDefines } from '@/engine/renderer/lighting/scene-lighting-uniforms';
import { MESH_VERTEX_SHADER, meshFragmentShader } from '@/engine/renderer/shaders/mesh.glsl';
import { POST_SHADER_VERTEX } from './custom-shader.glsl';
import type { CompiledShaderBundle } from './shader-bundle';
import { ShaderUniformBinder, type ShaderBinderOptions } from './shader-uniform-binder';
export type SurfaceVariant = 'opaque' | 'skinned' | 'transparent';
export interface CustomProgram {
    readonly program: ShaderProgram;
    binder: ShaderUniformBinder | null;
    failure: string | null;
}
interface Entry extends CustomProgram {
    lastUsedFrame: number;
}
const UNUSED_FRAMES = 240;
const WARMUPS_PER_FRAME = 2;
export class CustomShaderPrograms {
    private readonly entries = new Map<string, Entry>();
    private readonly warmQueue: {
        key: string;
        sources: () => [
            string,
            string
        ];
    }[] = [];
    private frame = 0;
    constructor(private readonly gl: GL, private readonly defines: ShaderDefines, private readonly report: (message: string) => void) { }
    post(bundle: CompiledShaderBundle, binderOptions: ShaderBinderOptions): CustomProgram {
        return this.acquire(`post|${bundle.key}`, bundle, binderOptions, () => this.postSources(bundle));
    }
    surface(bundle: CompiledShaderBundle, variant: SurfaceVariant, binderOptions: ShaderBinderOptions): CustomProgram {
        return this.acquire(`surface|${variant}|${bundle.key}`, bundle, binderOptions, () => this.surfaceSources(bundle, variant));
    }
    warm(bundle: CompiledShaderBundle): void {
        const key = bundle.model === 'post' ? `post|${bundle.key}` : `surface|opaque|${bundle.key}`;
        if (this.entries.has(key) || this.warmQueue.some((item) => item.key === key))
            return;
        const sources = bundle.model === 'post' ? () => this.postSources(bundle) : () => this.surfaceSources(bundle, 'opaque');
        this.warmQueue.push({ key, sources });
    }
    private postSources(bundle: CompiledShaderBundle): [
        string,
        string
    ] {
        return [POST_SHADER_VERTEX, bundle.fragment];
    }
    private surfaceSources(bundle: CompiledShaderBundle, variant: SurfaceVariant): [
        string,
        string
    ] {
        const fragment = meshFragmentShader(bundle.fragment);
        switch (variant) {
            case 'skinned':
                return [withDefines(MESH_VERTEX_SHADER, { SKINNED: true }), withDefines(fragment, this.defines)];
            case 'transparent':
                return [MESH_VERTEX_SHADER, withDefines(fragment, sceneLightingDefines(this.defines, 'direct'))];
            default:
                return [MESH_VERTEX_SHADER, withDefines(fragment, this.defines)];
        }
    }
    private acquire(key: string, bundle: CompiledShaderBundle, binderOptions: ShaderBinderOptions, sources: () => [
        string,
        string
    ]): CustomProgram {
        const entry = this.ensure(key, sources);
        entry.lastUsedFrame = this.frame;
        if (!entry.binder && !entry.failure)
            this.settle(entry, bundle, binderOptions);
        return entry;
    }
    private ensure(key: string, sources: () => [
        string,
        string
    ]): Entry {
        let entry = this.entries.get(key);
        if (!entry) {
            const [vertex, fragment] = sources();
            entry = { program: new ShaderProgram(this.gl, vertex, fragment), binder: null, failure: null, lastUsedFrame: this.frame };
            this.entries.set(key, entry);
        }
        return entry;
    }
    private drainWarmQueue(): void {
        for (let i = 0; i < WARMUPS_PER_FRAME && this.warmQueue.length > 0; i++) {
            const { key, sources } = this.warmQueue.shift()!;
            if (this.entries.has(key))
                continue;
            const entry = this.ensure(key, sources);
            try {
                void entry.program.ready;
            }
            catch {
                this.release(entry);
                this.entries.delete(key);
            }
        }
    }
    private settle(entry: Entry, bundle: CompiledShaderBundle, binderOptions: ShaderBinderOptions): void {
        try {
            if (!entry.program.ready)
                return;
            const handle = entry.program.handle;
            if (!handle)
                return;
            entry.binder = new ShaderUniformBinder(this.gl, handle, bundle, binderOptions);
        }
        catch (cause) {
            entry.failure = cause instanceof ShaderCompileError ? cause.message : cause instanceof Error ? cause.message : String(cause);
            this.report(`${bundle.name}: o driver recusou o programa do shader (${bundle.model}). ${entry.failure}`);
        }
    }
    get pending(): number {
        let count = 0;
        for (const entry of this.entries.values()) {
            if (entry.lastUsedFrame === this.frame && !entry.binder && !entry.failure)
                count++;
        }
        return count;
    }
    endFrame(): void {
        this.frame++;
        this.drainWarmQueue();
        if (this.frame % 60 !== 0)
            return;
        for (const [key, entry] of this.entries) {
            if (this.frame - entry.lastUsedFrame < UNUSED_FRAMES)
                continue;
            this.release(entry);
            this.entries.delete(key);
        }
    }
    dispose(): void {
        this.warmQueue.length = 0;
        for (const entry of this.entries.values())
            this.release(entry);
        this.entries.clear();
    }
    private release(entry: Entry): void {
        entry.binder?.dispose();
        entry.program.dispose();
    }
}
