import type { CompileDiagnostic } from '../../compiler/compile-types';
import type { ForeignCompileInput, ForeignCompileOutput, ForeignGame, ScriptLanguageEngine } from '../language-engine';
import { BuildClient } from '../native/build-client';
import { referencedSiblings, requireSpecifiers } from '../native/source-scan';
const REQUIRE_CALL = /(?:Helix\.)?require/;
const LABEL = 'Kotlin';
export function kotlinDependencies(source: string, siblings: readonly {
    readonly name: string;
    readonly file: string;
}[]): string[] {
    const names = requireSpecifiers(source, REQUIRE_CALL);
    for (const name of referencedSiblings(source, siblings))
        if (!names.includes(name))
            names.push(name);
    return names;
}
export class KotlinEngine implements ScriptLanguageEngine {
    readonly label = LABEL;
    readonly languages = ['kotlin'] as const;
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
                .toolchain('kotlin')
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
        const dependencies = kotlinDependencies(input.source, siblings);
        const { meta, artifact } = await this.client.build({
            language: 'kotlin',
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
        return Promise.reject(new Error('Kotlin compila para JavaScript e roda no sandbox da engine; não há runtime estrangeiro a iniciar.'));
    }
}
let shared: KotlinEngine | null = null;
export function kotlinEngine(): ScriptLanguageEngine {
    if (!shared)
        shared = new KotlinEngine();
    return shared;
}
