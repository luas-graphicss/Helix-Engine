import type TS from 'typescript';
import type { CompileDiagnostic } from './compile-types';
import { HELIX_PATH, LIB_DIR, ScriptProjectIndex, type ProjectScript } from './project-index';
export type { ModuleLanguage, ProjectScript, ProjectScriptLanguage } from './project-index';
export { scriptVirtualPath, stripSpecifierExtension } from './project-index';
export interface TypeScriptRuntime {
    readonly ts: typeof TS;
    readonly libs: ReadonlyMap<string, string>;
    readonly version: string;
}
const BUNDLE_URL = '/vendor/typescript/bundle.json';
let runtimePromise: Promise<TypeScriptRuntime> | null = null;
interface LibBundle {
    version: string;
    libs: Record<string, string>;
    messages: Record<string, string>;
}
export function isTypeScriptLoaded(): boolean {
    return loadedRuntime !== null;
}
let loadedRuntime: TypeScriptRuntime | null = null;
export function loadTypeScript(): Promise<TypeScriptRuntime> {
    if (!runtimePromise) {
        runtimePromise = (async () => {
            const [module, response] = await Promise.all([import('typescript'), fetch(BUNDLE_URL)]);
            if (!response.ok)
                throw new Error(`Não foi possível carregar a biblioteca padrão do TypeScript (${response.status} em ${BUNDLE_URL}).`);
            const bundle = (await response.json()) as LibBundle;
            const ts = (module.default ?? module) as typeof TS;
            const localizable = ts as unknown as {
                setLocalizedDiagnosticMessages?: (messages: Record<string, string>) => void;
            };
            localizable.setLocalizedDiagnosticMessages?.(bundle.messages);
            const runtime: TypeScriptRuntime = { ts, libs: new Map(Object.entries(bundle.libs)), version: ts.version };
            loadedRuntime = runtime;
            return runtime;
        })().catch((cause: unknown) => {
            runtimePromise = null;
            throw cause;
        });
    }
    return runtimePromise;
}
export interface TypeScriptEmit {
    readonly code: string | null;
    readonly sourceMap: string | null;
    readonly diagnostics: readonly CompileDiagnostic[];
    readonly dependencies: readonly string[];
}
export interface TypeScriptCheck {
    readonly diagnostics: readonly CompileDiagnostic[];
    readonly dependencies: readonly string[];
}
const OUT_DIR = '/out';
interface VersionedSnapshot extends TS.IScriptSnapshot {
    readonly path: string;
    readonly version: number;
}
