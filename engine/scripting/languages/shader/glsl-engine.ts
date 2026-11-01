import type { ForeignCompileInput, ForeignCompileOutput, ScriptLanguageEngine } from '../language-engine';
import { compileGlslShader } from './glsl-compiler';
import { shadingLanguageVersion } from './shader-validator';
export function glslEngine(): ScriptLanguageEngine {
    let version: string | null = null;
    return {
        label: 'GLSL',
        languages: ['glsl'],
        get loaded() {
            return version !== null;
        },
        get version() {
            return version;
        },
        async load() {
            version = shadingLanguageVersion() ?? 'GLSL ES 3.00';
        },
        compile(input: ForeignCompileInput): ForeignCompileOutput {
            return compileGlslShader(input);
        },
        createGame() {
            return Promise.reject(new Error('Shaders não executam como scripts: ligue-os com helix.post.custom.add ou helix.material.fromShader.'));
        },
    };
}
