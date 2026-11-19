import type { GL } from '@/engine/renderer/gl/context';
import type { EffectUniform } from '../compiler/uniform-registry';
export interface UniformLocator {
    uniform(name: string): WebGLUniformLocation | null;
}
export function bindEffectUniforms(gl: GL, program: UniformLocator, uniforms: readonly EffectUniform[]): void {
    for (const { name, value } of uniforms) {
        const location = program.uniform(name);
        const [x = 0, y = 0, z = 0, w = 0] = value;
        switch (value.length) {
            case 1:
                gl.uniform1f(location, x);
                break;
            case 2:
                gl.uniform2f(location, x, y);
                break;
            case 3:
                gl.uniform3f(location, x, y, z);
                break;
            default:
                gl.uniform4f(location, x, y, z, w);
        }
    }
}
