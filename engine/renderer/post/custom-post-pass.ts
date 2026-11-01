import { ColorRenderTarget } from '@/engine/renderer/gl/color-render-target';
import type { GL } from '@/engine/renderer/gl/context';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import type { GpuTextureCache } from '@/engine/renderer/gl/gpu-texture-cache';
import type { OverlayRenderTarget } from '@/engine/renderer/gl/scene-render-target';
import type { CustomShaderPrograms } from '@/engine/renderer/shaders/custom/custom-shader-programs';
import { POST_FIRST_USER_TEXTURE_UNIT, POST_SCENE_COLOR_UNIT, POST_SCENE_DEPTH_UNIT, POST_TEXTURE_UNIT_END } from '@/engine/renderer/shaders/custom/shader-texture-units';
import type { ShaderBinding } from '@/engine/renderer/shaders/custom/shader-values';
import type { ShaderBinderOptions, StandardShaderInputs } from '@/engine/renderer/shaders/custom/shader-uniform-binder';
export interface CustomPostEffect {
    readonly name: string;
    readonly binding: ShaderBinding;
    readonly enabled: boolean;
}
export class CustomPostPass {
    readonly stats = { drawCalls: 0 };
    private readonly scratch: [
        ColorRenderTarget,
        ColorRenderTarget
    ];
    private readonly binderOptions: ShaderBinderOptions;
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle, private readonly programs: CustomShaderPrograms, private readonly textures: GpuTextureCache, warn: (message: string) => void) {
        this.scratch = [
            new ColorRenderTarget(gl, { width: 1, height: 1, format: 'rgba8', filter: 'linear' }),
            new ColorRenderTarget(gl, { width: 1, height: 1, format: 'rgba8', filter: 'linear' }),
        ];
        this.binderOptions = {
            firstTextureUnit: POST_FIRST_USER_TEXTURE_UNIT,
            textureUnitEnd: POST_TEXTURE_UNIT_END,
            firstBlockBinding: 0,
            sceneColorUnit: POST_SCENE_COLOR_UNIT,
            sceneDepthUnit: POST_SCENE_DEPTH_UNIT,
            warn,
        };
    }
    settled = true;
    render(effects: readonly CustomPostEffect[], overlay: OverlayRenderTarget, sceneDepth: WebGLTexture, inputs: StandardShaderInputs): void {
        const { gl, triangle } = this;
        this.stats.drawCalls = 0;
        this.settled = true;
        const ready: CustomPostEffect[] = [];
        for (const effect of effects) {
            if (!effect.enabled)
                continue;
            const { bundle } = effect.binding;
            const entry = this.programs.post(bundle, this.binderOptions);
            if (entry.failure)
                continue;
            if (!entry.binder) {
                this.settled = false;
                continue;
            }
            if (bundle.standard.time !== undefined || bundle.standard.delta !== undefined)
                this.settled = false;
            ready.push(effect);
        }
        if (ready.length === 0)
            return;
        const { width, height } = overlay;
        for (const target of this.scratch)
            target.resize(width, height);
        inputs.width = width;
        inputs.height = height;
        inputs.sceneDepth = sceneDepth;
        gl.disable(gl.DEPTH_TEST);
        gl.depthMask(false);
        gl.disable(gl.BLEND);
        let input: WebGLTexture = overlay.color;
        let scratchIndex = 0;
        let result: ColorRenderTarget | null = null;
        for (let index = 0; index < ready.length; index++) {
            const effect = ready[index];
            const { program, binder } = this.programs.post(effect.binding.bundle, this.binderOptions);
            if (!binder)
                continue;
            const toOverlay = index === ready.length - 1 && input !== overlay.color;
            if (toOverlay) {
                overlay.bindForComposite();
                result = null;
            }
            else {
                result = this.scratch[scratchIndex];
                result.bind();
            }
            program.use();
            inputs.sceneColor = input;
            binder.bind(inputs, effect.binding.values, (texture) => this.textures.resolve(texture), this.textures.white);
            triangle.draw();
            this.stats.drawCalls++;
            if (result) {
                input = result.texture;
                scratchIndex ^= 1;
            }
        }
        if (result) {
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, result.framebuffer);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, overlay.compositeFramebuffer);
            gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        }
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.depthMask(true);
        gl.enable(gl.DEPTH_TEST);
    }
    dispose(): void {
        for (const target of this.scratch)
            target.dispose();
    }
}
