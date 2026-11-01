import type { GpuTextureCache } from '@/engine/renderer/gl/gpu-texture-cache';
import type { CustomProgram, CustomShaderPrograms, SurfaceVariant } from '@/engine/renderer/shaders/custom/custom-shader-programs';
import { SURFACE_FIRST_USER_TEXTURE_UNIT, SURFACE_TEXTURE_UNIT_END } from '@/engine/renderer/shaders/custom/shader-texture-units';
import type { ShaderBinding } from '@/engine/renderer/shaders/custom/shader-values';
import type { ShaderBinderOptions, StandardShaderInputs } from '@/engine/renderer/shaders/custom/shader-uniform-binder';
export class MeshSurfaceShaders {
    private readonly binderOptions: ShaderBinderOptions;
    constructor(private readonly programs: CustomShaderPrograms, private readonly textures: GpuTextureCache, readonly inputs: StandardShaderInputs, warn: (message: string) => void) {
        this.binderOptions = { firstTextureUnit: SURFACE_FIRST_USER_TEXTURE_UNIT, textureUnitEnd: SURFACE_TEXTURE_UNIT_END, firstBlockBinding: 0, warn };
    }
    programFor(binding: ShaderBinding, variant: SurfaceVariant): CustomProgram | null {
        const entry = this.programs.surface(binding.bundle, variant, this.binderOptions);
        return entry.binder ? entry : null;
    }
    bind(entry: CustomProgram, binding: ShaderBinding): void {
        entry.binder?.bind(this.inputs, binding.values, (texture) => this.textures.resolve(texture), this.textures.white);
    }
    animated(binding: ShaderBinding): boolean {
        const { standard } = binding.bundle;
        return standard.time !== undefined || standard.delta !== undefined;
    }
}
