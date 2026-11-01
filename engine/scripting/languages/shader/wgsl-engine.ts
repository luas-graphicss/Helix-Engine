import type { ForeignCompileInput, ForeignCompileOutput, ScriptLanguageEngine } from '../language-engine';
import { compileWgslShader, type NagaModule } from './wgsl-compiler';
const NAGA_WASM_URL = '/vendor/naga/naga_bg.wasm';
export function wgslEngine(): ScriptLanguageEngine {
    let naga: NagaModule | null = null;
    let version: string | null = null;
    return {
        label: 'WGSL',
        languages: ['wgsl'],
        get loaded() {
            return naga !== null;
        },
        get version() {
            return version;
        },
        async load() {
            if (naga)
                return;
            const module = await import('naga-wasm');
            await module.init(NAGA_WASM_URL);
            naga = module;
            version = `naga ${module.nagaVersion}`;
        },
        compile(input: ForeignCompileInput): ForeignCompileOutput {
            if (!naga)
                throw new Error('O compilador WGSL (naga) ainda não foi carregado.');
            return compileWgslShader(naga, input);
        },
        createGame() {
            return Promise.reject(new Error('Shaders não executam como scripts: ligue-os com helix.post.custom.add ou helix.material.fromShader.'));
        },
    };
}
