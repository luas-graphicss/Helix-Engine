import type { CustomPostEffect } from '@/engine/renderer/post/custom-post-pass';
import { createScriptFrameTarget, type ScriptDebugLine, type ScriptFrameTarget, type ScriptRenderPass, type ScriptRenderRequest } from '@/engine/renderer/script-hooks';
import type { CompiledShaderBundle } from '@/engine/renderer/shaders/custom/shader-bundle';
const NO_EFFECTS: readonly CustomPostEffect[] = [];
const NO_WARMUP: readonly CompiledShaderBundle[] = [];
export class OverlayRenderRequest implements ScriptRenderRequest {
    private base: ScriptRenderRequest | null = null;
    private readonly ownFrame = createScriptFrameTarget();
    private readonly lines: ScriptDebugLine[] = [];
    wrap(base: ScriptRenderRequest | null, overlay: readonly ScriptDebugLine[]): ScriptRenderRequest | null {
        if (overlay.length === 0)
            return base;
        this.base = base;
        this.lines.length = 0;
        for (const line of base?.debugLines ?? [])
            this.lines.push(line);
        for (const line of overlay)
            this.lines.push(line);
        return this;
    }
    get enabled(): boolean {
        return this.base?.enabled ?? true;
    }
    get hasHooks(): boolean {
        return this.base?.hasHooks ?? false;
    }
    get frame(): ScriptFrameTarget {
        return this.base?.frame ?? this.ownFrame;
    }
    get debugLines(): readonly ScriptDebugLine[] {
        return this.lines;
    }
    get customPost(): readonly CustomPostEffect[] {
        return this.base?.customPost ?? NO_EFFECTS;
    }
    takeShaderWarmup(): readonly CompiledShaderBundle[] {
        return this.base?.takeShaderWarmup() ?? NO_WARMUP;
    }
    isPassEnabled(pass: ScriptRenderPass): boolean {
        return this.base?.isPassEnabled(pass) ?? true;
    }
    warn(message: string): void {
        this.base?.warn(message);
    }
    before(): void {
        this.base?.before();
    }
    beforePass(pass: ScriptRenderPass): void {
        this.base?.beforePass(pass);
    }
    afterPass(pass: ScriptRenderPass): void {
        this.base?.afterPass(pass);
    }
    after(): void {
        this.base?.after();
    }
}
