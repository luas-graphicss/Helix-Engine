import { saveAllScripts } from '@/engine/editor/operations/script-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { GameNet } from '@/engine/player/game-manifest';
import { projectRecordOf } from '@/engine/project/project-context';
import { isAuthoritative, normalizeServerUrl } from '@/engine/scripting/scripting-settings';
import type { BuildOptions } from './build-targets';
export interface PreflightReport {
    readonly errors: readonly string[];
    readonly warnings: readonly string[];
    readonly notes: readonly string[];
    readonly net: GameNet;
}
export async function preflightBuild(session: EditorSession, options: BuildOptions): Promise<PreflightReport> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const notes: string[] = [];
    if (!options.gameName.trim())
        errors.push('Dê um nome ao jogo antes de compilar.');
    if (!projectRecordOf(session.project))
        errors.push('O projeto aberto não está no registro deste navegador; salve-o como projeto antes de compilar.');
    if (session.playtest.isRunning) {
        session.playtest.stop();
        notes.push('O playtest foi parado: o jogo é compilado a partir da cena de autoria, não do estado da simulação.');
    }
    const dirty = session.code.dirtyTabs.length;
    if (dirty > 0) {
        const saved = await saveAllScripts(session, { silent: true });
        if (saved === dirty)
            notes.push(`${saved} ${saved === 1 ? 'script com alterações pendentes foi salvo' : 'scripts com alterações pendentes foram salvos'} antes de compilar.`);
        else
            errors.push(`${dirty - saved} ${dirty - saved === 1 ? 'script aberto não pôde ser salvo' : 'scripts abertos não puderam ser salvos'}; salve-os no editor de código e tente de novo.`);
    }
    const { scripting } = session.scene;
    const authoritative = isAuthoritative(scripting);
    let serverUrl: string | null = null;
    if (authoritative) {
        const normalized = normalizeServerUrl(scripting.server.url);
        if (normalized === null)
            errors.push(`O endereço do servidor do jogo ("${scripting.server.url}") não é um endereço ws:// ou wss:// válido; corrija em Código ▸ Servidor do jogo.`);
        else if (!normalized)
            errors.push('O projeto tem servidor autoritativo mas nenhum endereço hospedado: informe-o em Código ▸ Servidor do jogo (ou mude o modo para "sem servidor") antes de compilar.');
        else
            serverUrl = normalized;
    }
    if (session.scene.root.children.length === 0)
        warnings.push('A cena está vazia: o jogo abre num mundo sem atores.');
    if (scripting.entryScriptId && !session.library.get(scripting.entryScriptId))
        warnings.push('O script de entrada configurado não existe mais na biblioteca; o jogo segue a ordem da hierarquia, como o playtest.');
    return { errors, warnings, notes, net: { authoritative, serverUrl } };
}
