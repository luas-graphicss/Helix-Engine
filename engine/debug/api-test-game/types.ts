import type { ScriptLanguageId } from '@/engine/scripting/script-languages';
export type DebugScriptRole = 'entry' | 'actor' | 'module' | 'asset' | 'shader';
export interface DebugScriptSpec {
    readonly name: string;
    readonly language: ScriptLanguageId;
    readonly source: string;
    readonly role: DebugScriptRole;
}
export interface GameSources {
    readonly entry: string;
    readonly actor: string;
    readonly module: string;
}
export const DEBUG_NAMES = {
    entry: 'DebugJogo',
    actor: 'DebugGirador',
    module: 'DebugUtil',
    hud: 'DebugHud',
    style: 'DebugEstilo',
    icon: 'DebugIcone',
    config: 'DebugConfig',
    post: 'DebugPost',
    surface: 'DebugSuperficie',
} as const;
export const DEBUG_ASSET_PREFIX = 'Debug';
export const DEBUG_GROUP_NAME = 'Debug';
export const DEBUG_ACTOR_NAME = 'Caixa giratória';
