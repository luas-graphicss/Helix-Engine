import { importProjectFile, PROJECT_FILE_MIME } from '@/engine/project/project-file';
import type { ProjectRecord } from '@/engine/project/project-record';
import { getProjectRegistry } from '@/engine/project/project-registry';
import type { ProgressReporter } from '@/engine/core/progress';
import type { GameManifest } from './game-manifest';
const INSTALL_KEY = 'helix-player:install';
interface InstallMarker {
    readonly buildId: string;
    readonly projectId: string;
}
function readMarker(): InstallMarker | null {
    try {
        const parsed = JSON.parse(localStorage.getItem(INSTALL_KEY) ?? 'null') as Partial<InstallMarker> | null;
        return parsed && typeof parsed.buildId === 'string' && typeof parsed.projectId === 'string' ? (parsed as InstallMarker) : null;
    }
    catch {
        return null;
    }
}
function writeMarker(marker: InstallMarker | null): void {
    try {
        if (marker)
            localStorage.setItem(INSTALL_KEY, JSON.stringify(marker));
        else
            localStorage.removeItem(INSTALL_KEY);
    }
    catch {
    }
}
export interface InstalledGame {
    readonly record: ProjectRecord;
    readonly reused: boolean;
}
export async function installGamePack(manifest: GameManifest, pack: () => Promise<Blob>, onProgress: ProgressReporter): Promise<InstalledGame> {
    const registry = getProjectRegistry();
    onProgress({ label: 'Abrindo o armazenamento do jogo', fraction: 0 });
    await registry.load();
    if (registry.status === 'unavailable')
        throw new Error(registry.error ?? 'O armazenamento do navegador não está disponível para o jogo.');
    const marker = readMarker();
    const previous = marker ? registry.get(marker.projectId) : null;
    if (previous && marker?.buildId === manifest.buildId)
        return { record: previous, reused: true };
    if (previous) {
        onProgress({ label: 'Removendo a versão anterior do jogo', fraction: 0.05 });
        await registry.purge(previous.id);
        writeMarker(null);
    }
    onProgress({ label: 'Lendo o pacote do jogo', fraction: 0.1 });
    const file = new File([await pack()], 'game.helix', { type: PROJECT_FILE_MIME });
    const record = await importProjectFile(file, registry, (label, fraction) => onProgress({ label, fraction: 0.15 + fraction * 0.85 }));
    if (record.name !== manifest.name)
        await registry.rename(record.id, manifest.name);
    writeMarker({ buildId: manifest.buildId, projectId: record.id });
    return { record: registry.get(record.id) ?? record, reused: false };
}
export async function discardInstalledGame(): Promise<void> {
    const marker = readMarker();
    writeMarker(null);
    if (!marker)
        return;
    const registry = getProjectRegistry();
    await registry.load();
    if (registry.get(marker.projectId))
        await registry.purge(marker.projectId);
}
