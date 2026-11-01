import { createRoot } from 'react-dom/client';
import { parseGameManifest } from './game-manifest';
import { PlayerApp } from './player-app';
import { GAME_MANIFEST_PATH } from './player-boot';
function fail(message: string): void {
    const root = document.getElementById('root') ?? document.body;
    root.textContent = '';
    const box = document.createElement('div');
    box.setAttribute('role', 'alert');
    box.style.cssText = 'display:flex;height:100%;align-items:center;justify-content:center;padding:2rem;text-align:center;font:14px/1.5 system-ui,sans-serif;color:#e8e8ea;background:#101114';
    box.textContent = message;
    root.append(box);
}
async function main(): Promise<void> {
    const root = document.getElementById('root');
    if (!root)
        throw new Error('A página do jogo não tem o elemento raiz.');
    const response = await fetch(GAME_MANIFEST_PATH);
    if (!response.ok)
        throw new Error(`O manifesto do jogo não foi encontrado (HTTP ${response.status}).`);
    const manifest = parseGameManifest(await response.json());
    document.title = manifest.name;
    createRoot(root).render(<PlayerApp manifest={manifest}/>);
}
main().catch((cause: unknown) => {
    console.error('[Helix Player]', cause);
    fail(`Não foi possível iniciar o jogo: ${cause instanceof Error ? cause.message : String(cause)}`);
});
