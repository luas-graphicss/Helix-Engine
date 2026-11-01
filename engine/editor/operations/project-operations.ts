import { triggerDownload } from '@/engine/core/transfer/download-blob';
import { projectRecordOf } from '@/engine/project/project-context';
import { exportProjectFile } from '@/engine/project/project-file';
import { projectFileName } from '@/engine/project/project-record';
import { formatBytes } from '@/engine/project/storage-health';
import type { EditorSession } from '../session/editor-session';
const DOWNLOAD_URL_LIFETIME_MS = 60000;
function errorMessage(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
export async function saveProjectNow(session: EditorSession): Promise<boolean> {
    session.materials.flush();
    session.library.flush();
    const saved = await session.autosave.saveNow();
    if (saved)
        session.log.info('Projeto', 'Cena salva.');
    return saved;
}
export async function exportOpenProject(session: EditorSession): Promise<void> {
    const record = projectRecordOf(session.project);
    if (!record) {
        session.log.error('Projeto', 'O projeto aberto não está no registro; não há o que exportar.');
        return;
    }
    session.materials.flush();
    session.library.flush();
    if (session.autosave.dirty && !(await session.autosave.saveNow()))
        return;
    const filename = projectFileName(record);
    try {
        const blob = await exportProjectFile(record);
        const url = URL.createObjectURL(blob);
        setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
        triggerDownload(url, filename);
        session.log.info('Projeto', `Arquivo "${filename}" exportado (${formatBytes(blob.size)}).`);
    }
    catch (cause) {
        session.log.error('Projeto', `Não foi possível exportar "${filename}": ${errorMessage(cause)}`);
    }
}
