import type { useRouter } from 'next/navigation';
import { ProjectDatabase } from '@/engine/core/storage/project-database';
import { editorPath, HUB_PATH } from '@/engine/hub/hub-routes';
import type { ProjectRecord } from '@/engine/project/project-record';
import { SceneStore } from '@/engine/project/scene-store';
import { engineSettings } from '@/engine/settings/engine-settings-store';
import { editorReopen } from '../editor-reopen';
import type { EditorSession } from '../session/editor-session';
type Router = ReturnType<typeof useRouter>;
const CLOSE_GRACE_MS = 300;
function errorMessage(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
async function saveBeforeLeaving(session: EditorSession): Promise<void> {
    session.materials.flush();
    session.library.flush();
    if (session.autosave.dirty)
        await session.autosave.saveNow();
}
export async function createProjectFromEditor(session: EditorSession, router: Router): Promise<void> {
    const { registry } = session.project;
    if (registry.status !== 'ready') {
        session.log.error('Projeto', registry.error ?? 'O registro de projetos não está disponível.');
        return;
    }
    await saveBeforeLeaving(session);
    try {
        const record = await registry.create(engineSettings.get('project.new.template'));
        session.log.info('Projeto', `"${record.name}" criado; abrindo.`);
        router.push(editorPath(record.id));
    }
    catch (cause) {
        session.log.error('Projeto', `Não foi possível criar o jogo: ${errorMessage(cause)}`);
    }
}
export async function switchToProject(session: EditorSession, router: Router, record: ProjectRecord): Promise<void> {
    if (record.id === session.project.id)
        return;
    await saveBeforeLeaving(session);
    router.push(editorPath(record.id));
}
export async function closeProject(session: EditorSession, router: Router): Promise<void> {
    await saveBeforeLeaving(session);
    router.push(HUB_PATH);
}
export async function exitEngine(session: EditorSession): Promise<boolean> {
    await saveBeforeLeaving(session);
    engineSettings.flush();
    window.close();
    await new Promise((resolve) => setTimeout(resolve, CLOSE_GRACE_MS));
    return window.closed;
}
export async function restoreAutosave(session: EditorSession, router: Router, record: ProjectRecord, key: string): Promise<void> {
    if (record.id === session.project.id) {
        session.autosave.stop();
        try {
            await saveBeforeLeaving(session);
            await session.project.scenes.restoreSnapshot(key);
        }
        catch (cause) {
            session.autosave.start();
            throw cause;
        }
        session.autosave.discard();
        editorReopen.request();
        return;
    }
    const database = new ProjectDatabase(record.databaseName);
    try {
        await new SceneStore(database).restoreSnapshot(key);
        await session.project.registry.touchSaved(record.id, {});
    }
    finally {
        await database.close();
    }
    await saveBeforeLeaving(session);
    router.push(editorPath(record.id));
}
