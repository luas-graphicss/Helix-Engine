import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { SCRIPT_RUN_CONTEXT_LABEL, type ScriptRunContext } from './script-document';
import { isShaderLanguage, type ScriptLanguageId } from './script-languages';
export type GameSide = 'client' | 'server';
export const GAME_SIDES: readonly GameSide[] = ['server', 'client'];
export const SCRIPT_CONTEXT_ORDER: readonly ScriptRunContext[] = ['server', 'shared', 'client'];
export const SCRIPT_CONTEXT_SHORT: Record<ScriptRunContext, string> = { shared: 'Ambos', client: 'Cliente', server: 'Servidor' };
export const SCRIPT_CONTEXT_HINT: Record<ScriptRunContext, string> = {
    server: 'Nunca sai do servidor: regras, pontuação, inventário, validação. O jogador não recebe este código.',
    shared: 'Entra no cliente e no servidor: módulos, constantes, lógica que os dois lados precisam reproduzir.',
    client: 'Só na máquina do jogador: câmera, interface, entrada e efeitos. Nada aqui tem autoridade.',
};
export const SCRIPT_CONTEXT_TONE: Record<ScriptRunContext, string> = {
    server: 'text-warning',
    shared: 'text-muted-foreground',
    client: 'text-axis-z',
};
export function contextLabel(context: ScriptRunContext): string {
    return SCRIPT_RUN_CONTEXT_LABEL[context];
}
export function runsOn(context: ScriptRunContext, side: GameSide): boolean {
    return context === 'shared' || context === side;
}
export function contextOf(asset: LibraryAsset): ScriptRunContext | null {
    return asset.kind === 'script' && asset.details.kind === 'script' ? asset.details.runContext : null;
}
export function scriptsForSide(assets: readonly LibraryAsset[], side: GameSide): LibraryAsset[] {
    return assets.filter((asset) => {
        if (asset.kind !== 'script' || asset.details.kind !== 'script')
            return false;
        if (isShaderLanguage(asset.details.language))
            return side === 'client';
        return runsOn(asset.details.runContext, side);
    });
}
export function groupScriptsByContext(assets: readonly LibraryAsset[]): Array<{
    context: ScriptRunContext;
    assets: LibraryAsset[];
}> {
    return SCRIPT_CONTEXT_ORDER.map((context) => ({ context, assets: assets.filter((asset) => contextOf(asset) === context) })).filter((group) => group.assets.length > 0);
}
export function contextsFor(language: ScriptLanguageId): readonly ScriptRunContext[] {
    return isShaderLanguage(language) ? ['client'] : SCRIPT_CONTEXT_ORDER;
}
