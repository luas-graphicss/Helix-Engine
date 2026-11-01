import { deserializeCompiledScripts } from '@/engine/build/compiled-scripts';
import type { ProgressReporter } from '@/engine/core/progress';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { OPEN_PROJECT_SESSION_FRACTION, openProject } from '@/engine/project/open-project';
import { applyRuntimeSessionSettings } from '@/engine/settings/apply/session-settings';
import type { GameManifest } from './game-manifest';
import { adoptGameSettings } from './game-settings';
import { discardInstalledGame, installGamePack } from './player-install';
export const GAME_PACK_PATH = './game/game.helix';
export const GAME_SCRIPTS_PATH = './game/scripts.json';
export const GAME_MANIFEST_PATH = './game/helix-game.json';
export const PLAYER_SESSION_FRACTION = OPEN_PROJECT_SESSION_FRACTION;
async function fetchGameFile(path: string, what: string): Promise<Response> {
    const response = await fetch(path);
    if (!response.ok)
        throw new Error(`${what} não está no pacote do jogo (${path}: HTTP ${response.status}).`);
    return response;
}
export async function bootPlayer(manifest: GameManifest, onProgress: ProgressReporter): Promise<EditorSession> {
    adoptGameSettings(manifest);
    onProgress({ label: 'Lendo os scripts do jogo', fraction: 0.02 });
    const scriptsPromise = fetchGameFile(GAME_SCRIPTS_PATH, 'A lista de scripts')
        .then((response) => response.json())
        .then(deserializeCompiledScripts);
    const pack = () => fetchGameFile(GAME_PACK_PATH, 'O conteúdo do jogo').then((response) => response.blob());
    const installProgress: ProgressReporter = ({ label, fraction }) => onProgress({ label, fraction: 0.05 + fraction * 0.35 });
    const openProgress: ProgressReporter = ({ label, fraction }) => onProgress({ label, fraction: 0.4 + (fraction / OPEN_PROJECT_SESSION_FRACTION) * (PLAYER_SESSION_FRACTION - 0.4) });
    const openOptions = { persist: false, warmCompiler: false } as const;
    let installed = await installGamePack(manifest, pack, installProgress);
    let session: EditorSession;
    try {
        session = await openProject(installed.record.id, openProgress, openOptions);
    }
    catch (cause) {
        if (!installed.reused)
            throw cause;
        await discardInstalledGame();
        installed = await installGamePack(manifest, pack, installProgress);
        session = await openProject(installed.record.id, openProgress, openOptions);
    }
    const scripts = await scriptsPromise;
    session.scripts.compiler.seal(scripts);
    applyRuntimeSessionSettings(session);
    session.showGrid = false;
    session.render.perfHud = false;
    session.tool = 'select';
    session.playtest.setTimeScale(1);
    session.log.info('Jogo', `${manifest.name} ${manifest.version} · ${scripts.length} ${scripts.length === 1 ? 'script pré-compilado' : 'scripts pré-compilados'} · Helix Player ${manifest.engine.electron}.`);
    return session;
}
