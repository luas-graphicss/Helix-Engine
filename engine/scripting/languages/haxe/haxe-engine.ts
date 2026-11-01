import type { CompileDiagnostic } from '../../compiler/compile-types';
import { identifierFromName } from '../../script-templates';
import type { ForeignCompileInput, ForeignCompileOutput, ForeignGame, ScriptLanguageEngine } from '../language-engine';
import { BuildClient } from '../native/build-client';
import { stripCLikeComments } from '../native/source-scan';
const REQUIRE_CALL = /\b(?:Helix\.)?require\s*\(\s*(['"])((?:(?!\1)[^\\\n]|\\.)*)\1\s*\)/g;
const LABEL = 'Haxe';
export function haxeModuleName(file: string): string {
    return identifierFromName(file.replace(/\.[^.]+$/, ''));
}
export function haxeDependencies(source: string, siblings: readonly {
    readonly name: string;
    readonly file: string;
}[]): string[] {
    const body = stripCLikeComments(source);
    const names: string[] = [];
    for (const match of body.matchAll(REQUIRE_CALL)) {
        const name = match[2].replace(/\\(.)/g, '$1').trim();
        if (name && !names.includes(name))
            names.push(name);
    }
    for (const sibling of siblings) {
        const module = haxeModuleName(sibling.file);
        if (new RegExp(`(?<![\\w.])${module}(?![\\w])`).test(body) && !names.includes(sibling.name))
            names.push(sibling.name);
    }
    return names;
}
export class HaxeEngine implements ScriptLanguageEngine {
    readonly label = LABEL;
    readonly languages = ['haxe'] as const;
    private readonly decoder = new TextDecoder();
    private loading: Promise<void> | null = null;
    private toolchain: string | null = null;
    constructor(private readonly client: BuildClient = new BuildClient()) { }
    get loaded(): boolean {
        return this.toolchain !== null;
    }
    get version(): string | null {
        return this.toolchain;
    }
    load(): Promise<void> {
        if (!this.loading) {
            this.loading = this.client
                .toolchain('haxe')
                .then((status) => {
                this.toolchain = status.version;
            })
                .catch((cause: unknown) => {
                this.loading = null;
                throw cause;
            });
        }
        return this.loading;
    }
    async compile(input: ForeignCompileInput): Promise<ForeignCompileOutput> {
        const siblings = (input.siblings ?? []).filter((sibling) => sibling.file !== input.file);
        const dependencies = haxeDependencies(input.source, siblings);
        const { meta, artifact } = await this.client.build({
            language: 'haxe',
            file: input.file,
            source: input.source,
            siblings: siblings.map((sibling) => ({ file: sibling.file, source: sibling.source })),
        });
        const diagnostics: CompileDiagnostic[] = [...meta.diagnostics];
        const failed = (): ForeignCompileOutput => ({ artifact: null, code: null, sourceMap: null, diagnostics, dependencies });
        if (!meta.ok || diagnostics.some((diagnostic) => diagnostic.severity === 'error'))
            return failed();
        if (!artifact || meta.artifact?.kind !== 'js') {
            diagnostics.push({ severity: 'error', message: 'o serviço de build não devolveu o módulo JavaScript do script.', line: 1, column: 1, code: 'build-service', source: LABEL });
            return failed();
        }
        return { artifact: null, code: this.decoder.decode(artifact), sourceMap: meta.artifact.sourceMap ?? null, diagnostics, dependencies };
    }
    createGame(): Promise<ForeignGame> {
        return Promise.reject(new Error('Haxe compila para JavaScript e roda no sandbox da engine; não há runtime estrangeiro a iniciar.'));
    }
}
let shared: HaxeEngine | null = null;
export function haxeEngine(): ScriptLanguageEngine {
    if (!shared)
        shared = new HaxeEngine();
    return shared;
}
