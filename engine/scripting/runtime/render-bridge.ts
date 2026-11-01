import type { CustomPostEffect } from '@/engine/renderer/post/custom-post-pass';
import type { ScriptDebugLine, ScriptRenderPass, ScriptRenderRequest } from '@/engine/renderer/script-hooks';
import type { CompiledShaderBundle } from '@/engine/renderer/shaders/custom/shader-bundle';
import type { RenderState } from '../api/render';
import type { ScriptOwner } from './runtime-context';
import type { FrameHookFn, FrameHooks, RuntimeHost } from './runtime-host';
type HookEntry = {
    owner: ScriptOwner | null;
    fn: FrameHookFn;
};
class GlStateGuard {
    private viewport: Int32Array = new Int32Array(4);
    private depthTest = true;
    private depthMask = true;
    private depthFunc = 0;
    private blend = false;
    private cullFace = true;
    private scissor = false;
    private framebuffer: WebGLFramebuffer | null = null;
    private program: WebGLProgram | null = null;
    private vao: WebGLVertexArrayObject | null = null;
    capture(gl: WebGL2RenderingContext): void {
        this.viewport = gl.getParameter(gl.VIEWPORT) as Int32Array;
        this.depthTest = gl.isEnabled(gl.DEPTH_TEST);
        this.depthMask = gl.getParameter(gl.DEPTH_WRITEMASK) as boolean;
        this.depthFunc = gl.getParameter(gl.DEPTH_FUNC) as number;
        this.blend = gl.isEnabled(gl.BLEND);
        this.cullFace = gl.isEnabled(gl.CULL_FACE);
        this.scissor = gl.isEnabled(gl.SCISSOR_TEST);
        this.framebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
        this.program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null;
        this.vao = gl.getParameter(gl.VERTEX_ARRAY_BINDING) as WebGLVertexArrayObject | null;
    }
    restore(gl: WebGL2RenderingContext): void {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.viewport(this.viewport[0], this.viewport[1], this.viewport[2], this.viewport[3]);
        toggle(gl, gl.DEPTH_TEST, this.depthTest);
        gl.depthMask(this.depthMask);
        gl.depthFunc(this.depthFunc);
        toggle(gl, gl.BLEND, this.blend);
        toggle(gl, gl.CULL_FACE, this.cullFace);
        toggle(gl, gl.SCISSOR_TEST, this.scissor);
        gl.useProgram(this.program);
        gl.bindVertexArray(this.vao);
        gl.activeTexture(gl.TEXTURE0);
    }
}
function toggle(gl: WebGL2RenderingContext, cap: number, on: boolean): void {
    if (on)
        gl.enable(cap);
    else
        gl.disable(cap);
}
export class ScriptRenderBridge implements ScriptRenderRequest {
    private readonly guard = new GlStateGuard();
    private readonly failed = new Set<HookEntry | FrameHooks['custom'][number]>();
    constructor(private readonly host: RuntimeHost, private readonly state: RenderState, private readonly hooks: FrameHooks) { }
    get enabled(): boolean {
        return this.state.enabled;
    }
    get hasHooks(): boolean {
        const { hooks, state } = this;
        return (hooks.before.length > 0 ||
            hooks.after.length > 0 ||
            hooks.custom.length > 0 ||
            hooks.beforePass.size > 0 ||
            hooks.afterPass.size > 0 ||
            state.disabledPasses.size > 0 ||
            state.customPost.length > 0);
    }
    get frame() {
        return this.state.frame;
    }
    get debugLines(): readonly ScriptDebugLine[] {
        return this.host.debug.lines;
    }
    get customPost(): readonly CustomPostEffect[] {
        return this.state.customPost;
    }
    takeShaderWarmup(): readonly CompiledShaderBundle[] {
        const bundles = this.state.shaderWarmup;
        if (bundles.length === 0)
            return bundles;
        this.state.shaderWarmup = [];
        return bundles;
    }
    isPassEnabled(pass: ScriptRenderPass): boolean {
        return this.state.isPassEnabled(pass);
    }
    warn(message: string): void {
        this.host.log('warn', message, { source: 'Shaders' });
    }
    before(): void {
        const { frame } = this.state;
        const { time } = this.host;
        frame.elapsed = time.now;
        frame.delta = time.delta;
        frame.frame = time.frame;
        this.run(this.hooks.before, 'helix.render.onBeforeFrame');
    }
    beforePass(pass: ScriptRenderPass): void {
        const list = this.hooks.beforePass.get(pass);
        if (list)
            this.run(list, `helix.render.onBeforePass("${pass}")`);
    }
    afterPass(pass: ScriptRenderPass): void {
        const list = this.hooks.afterPass.get(pass);
        if (list)
            this.run(list, `helix.render.onAfterPass("${pass}")`);
        const custom = this.hooks.custom;
        if (custom.length === 0)
            return;
        for (const entry of custom.slice()) {
            if (entry.after !== pass || this.failed.has(entry))
                continue;
            this.call(entry.owner, entry.render, `passe "${entry.name}"`, () => {
                this.failed.add(entry);
                const index = custom.indexOf(entry);
                if (index >= 0)
                    custom.splice(index, 1);
            });
        }
    }
    after(): void {
        this.run(this.hooks.after, 'helix.render.onAfterFrame');
    }
    reset(): void {
        this.failed.clear();
    }
    private run(list: HookEntry[], phase: string): void {
        if (list.length === 0)
            return;
        for (const entry of list.slice()) {
            if (this.failed.has(entry))
                continue;
            this.call(entry.owner, entry.fn, phase, () => {
                this.failed.add(entry);
                const index = list.indexOf(entry);
                if (index >= 0)
                    list.splice(index, 1);
            });
        }
    }
    private call(owner: ScriptOwner | null, fn: FrameHookFn, phase: string, onFailure: () => void): void {
        const { frame } = this.state;
        const gl = frame.gl;
        if (gl)
            this.guard.capture(gl);
        let completed = false;
        this.host.invoke(owner, phase, () => {
            fn(gl, frame);
            completed = true;
        });
        if (gl)
            this.guard.restore(gl);
        if (!completed) {
            onFailure();
            this.host.log('warn', `${phase} removido depois do erro; salve o script para registrá-lo de novo.`, { source: owner?.name });
        }
    }
}
