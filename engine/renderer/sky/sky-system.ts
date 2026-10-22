import type { GL } from '@/engine/renderer/gl/context';
import type { GlCapabilities } from '@/engine/renderer/gl/capabilities';
import type { RenderProfile } from '@/engine/renderer/quality/render-profile';
import type { ColorFormat } from '@/engine/renderer/gl/color-render-target';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import type { ShaderDefines } from '@/engine/renderer/gl/shader-source';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { FrameLighting } from '@/engine/renderer/lighting/frame-lighting';
import type { SkySettings } from '@/engine/core/environment/sky-settings';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { AtmosphereLuts } from './atmosphere-luts';
import { CloudLayerState } from './cloud-layer-state';
import { CloudPass } from './cloud-pass';
import { CloudShadowMap } from './cloud-shadow-map';
import { createCloudNoiseTextures, disposeCloudNoiseTextures, type CloudNoiseTextures } from './noise/cloud-noise-textures';
import { createSkyFrame, resolveSkyFrame, type SkyFrame } from './sky-frame';
import { SkyPass } from './sky-pass';
export interface SkyLightingBinding {
    skyLighting: boolean;
    readonly lightingLut: WebGLTexture;
    readonly skyViewLut: WebGLTexture;
    skyViewValid: boolean;
    readonly moonDirection: Vec3;
    readonly moonIrradiance: Vec3;
    shadowOnMoon: boolean;
    readonly cloudShadow: {
        enabled: boolean;
        readonly texture: WebGLTexture;
        readonly region: Float32Array;
    };
}
export function hdrShaderDefines(capabilities: GlCapabilities): ShaderDefines {
    return { HDR_ENCODED: !capabilities.floatColorTargets };
}
export class SkySystem {
    readonly frame: SkyFrame = createSkyFrame();
    readonly binding: SkyLightingBinding;
    readonly stats = { drawCalls: 0, cloudWidth: 0, cloudHeight: 0 };
    private readonly noise: CloudNoiseTextures;
    private readonly luts: AtmosphereLuts;
    private readonly clouds = new CloudLayerState();
    private readonly cloudShadow: CloudShadowMap;
    private readonly cloudPass: CloudPass;
    private readonly skyPass: SkyPass;
    private cloudsRenderedLastFrame = false;
    constructor(private readonly gl: GL, capabilities: GlCapabilities, triangle: FullscreenTriangle, private readonly profile: RenderProfile) {
        const format: ColorFormat = capabilities.floatColorTargets ? 'rgba16f' : 'rgba8';
        const defines = hdrShaderDefines(capabilities);
        this.noise = createCloudNoiseTextures(gl);
        this.luts = new AtmosphereLuts(gl, format, defines, triangle);
        this.cloudShadow = new CloudShadowMap(gl, triangle);
        this.cloudPass = new CloudPass(gl, format, defines, triangle);
        this.skyPass = new SkyPass(gl, defines, triangle);
        this.binding = {
            skyLighting: false,
            lightingLut: this.luts.lighting.texture,
            skyViewLut: this.luts.skyView.texture,
            skyViewValid: false,
            moonDirection: vec3.create(0, -1, 0),
            moonIrradiance: vec3.create(),
            shadowOnMoon: false,
            cloudShadow: { enabled: false, texture: this.cloudShadow.target.texture, region: this.cloudShadow.region },
        };
    }
    update(settings: SkySettings, lighting: FrameLighting, camera: PerspectiveCamera, canvasWidth: number, canvasHeight: number, deltaSeconds: number): SkyFrame {
        const { gl, frame, binding } = this;
        resolveSkyFrame(frame, settings, lighting);
        this.stats.drawCalls = 0;
        binding.skyLighting = frame.skyLighting;
        binding.skyViewValid = frame.enabled;
        binding.shadowOnMoon = frame.shadowOnMoon;
        vec3.copy(binding.moonDirection, frame.moonDirection);
        if (frame.enabled)
            vec3.copy(binding.moonIrradiance, frame.moonIrradiance);
        else
            vec3.set(binding.moonIrradiance, 0, 0, 0);
        binding.cloudShadow.enabled = false;
        if (!frame.enabled) {
            this.cloudsRenderedLastFrame = false;
            return frame;
        }
        gl.disable(gl.DEPTH_TEST);
        this.luts.update(frame);
        this.stats.drawCalls += this.luts.stats.drawCalls;
        this.clouds.update(settings.clouds, deltaSeconds);
        if (frame.cloudsEnabled && camera.invertible) {
            if (settings.clouds.shadows) {
                binding.cloudShadow.enabled = this.cloudShadow.render(frame.shadowCasterDirection, camera.position, this.clouds, this.noise);
                this.stats.drawCalls += this.cloudShadow.stats.drawCalls;
            }
            if (!this.cloudsRenderedLastFrame)
                this.cloudPass.invalidateHistory();
            this.cloudsRenderedLastFrame = this.cloudPass.render({
                camera,
                frame,
                quality: settings.clouds.quality,
                stepsPerFrame: this.profile.cloudStepsPerFrame,
                interleave: this.profile.cloudInterleave,
                luts: this.luts,
                clouds: this.clouds,
                noise: this.noise,
                canvasWidth,
                canvasHeight,
            });
            this.stats.drawCalls += this.cloudPass.stats.drawCalls;
            this.stats.cloudWidth = this.cloudPass.stats.width;
            this.stats.cloudHeight = this.cloudPass.stats.height;
        }
        else {
            this.cloudsRenderedLastFrame = false;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.enable(gl.DEPTH_TEST);
        return frame;
    }
    renderBackground(camera: PerspectiveCamera, width: number, height: number, elapsedSeconds: number): number {
        if (!this.frame.enabled || !camera.invertible)
            return 0;
        this.skyPass.render({
            camera,
            frame: this.frame,
            luts: this.luts,
            clouds: this.cloudsRenderedLastFrame ? this.cloudPass.texture : null,
            width,
            height,
            elapsedSeconds,
        });
        return 1;
    }
    dispose(): void {
        this.skyPass.dispose();
        this.cloudPass.dispose();
        this.cloudShadow.dispose();
        this.luts.dispose();
        disposeCloudNoiseTextures(this.gl, this.noise);
    }
}
