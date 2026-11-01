import type { ScriptLanguageId } from '@/engine/scripting/script-languages';
export interface ServerRuntimeModule {
    readonly id: string;
    readonly language: ScriptLanguageId;
    readonly specifier: string;
    readonly file: string;
    readonly entry: string;
}
export const SERVER_RUNTIME_MODULES: readonly ServerRuntimeModule[] = [
    { id: 'csharp', language: 'csharp', specifier: '@helix/csharp', file: 'runtime/csharp.mjs', entry: 'engine/scripting/languages/csharp/runtime/index.ts' },
    { id: 'gdscript', language: 'gdscript', specifier: '@helix/gdscript', file: 'runtime/gdscript.mjs', entry: 'engine/scripting/languages/gdscript/runtime/index.ts' },
];
export const SERVER_RUNTIME_API = '/api/server-runtime';
export function serverRuntimeModule(id: string): ServerRuntimeModule | undefined {
    return SERVER_RUNTIME_MODULES.find((module) => module.id === id);
}
export function runtimeModuleForLanguage(language: ScriptLanguageId): ServerRuntimeModule | undefined {
    return SERVER_RUNTIME_MODULES.find((module) => module.language === language);
}
export function serverRuntimeUrl(module: ServerRuntimeModule): string {
    return `${SERVER_RUNTIME_API}/${module.id}`;
}
