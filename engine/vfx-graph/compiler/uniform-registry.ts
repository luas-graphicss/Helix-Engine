export interface EffectUniform {
    readonly name: string;
    readonly value: readonly number[];
}
const GLSL_TYPES = ['float', 'vec2', 'vec3', 'vec4'] as const;
const SALT_STRIDE = 4;
export class UniformRegistry {
    private readonly uniforms = new Map<string, EffectUniform>();
    private salt = 0;
    declare(name: string, value: readonly number[]): string {
        this.uniforms.set(name, { name, value });
        return name;
    }
    nextSalt(): string {
        this.salt += SALT_STRIDE;
        return `${this.salt}u`;
    }
    get list(): EffectUniform[] {
        return Array.from(this.uniforms.values());
    }
    get declarations(): string {
        return this.list.map((uniform) => `uniform ${GLSL_TYPES[uniform.value.length - 1]} ${uniform.name};`).join('\n');
    }
}
