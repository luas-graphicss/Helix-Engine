import type { ScriptLanguageId } from '@/engine/scripting/script-languages';
export interface ServerBundleModule {
    readonly id: string;
    readonly specifier: string;
    readonly file: string;
    readonly entry: string;
    readonly summary: string;
}
export interface ServerRuntimeModule extends ServerBundleModule {
    readonly language: ScriptLanguageId;
}
export const SERVER_RUNTIME_MODULES: readonly ServerRuntimeModule[] = [
    { id: 'csharp', language: 'csharp', specifier: '@helix/csharp', file: 'runtime/csharp.mjs', entry: 'engine/scripting/languages/csharp/runtime/index.ts', summary: 'Runtime de csharp para o servidor: o código compilado o pede como "@helix/csharp".' },
    { id: 'gdscript', language: 'gdscript', specifier: '@helix/gdscript', file: 'runtime/gdscript.mjs', entry: 'engine/scripting/languages/gdscript/runtime/index.ts', summary: 'Runtime de gdscript para o servidor: o código compilado o pede como "@helix/gdscript".' },
];
export const MULTIPLAYER_HOST_MODULE: ServerBundleModule = {
    id: 'multiplayer',
    specifier: '@helix/multiplayer',
    file: 'runtime/multiplayer.mjs',
    entry: 'engine/net/server-bundle/multiplayer-host.ts',
    summary: 'Sessões, lobby, matchmaking e relay do multiplayer para o servidor hospedado.',
};
export const SERVER_RUNTIME_API = '/api/server-runtime';
export function serverBundleModule(id: string): ServerBundleModule | undefined {
    return id === MULTIPLAYER_HOST_MODULE.id ? MULTIPLAYER_HOST_MODULE : SERVER_RUNTIME_MODULES.find((module) => module.id === id);
}
export function runtimeModuleForLanguage(language: ScriptLanguageId): ServerRuntimeModule | undefined {
    return SERVER_RUNTIME_MODULES.find((module) => module.language === language);
}
export function serverRuntimeUrl(module: ServerBundleModule): string {
    return `${SERVER_RUNTIME_API}/${module.id}`;
}
