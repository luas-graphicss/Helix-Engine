import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { normalizeJobSettings, type JobSettings } from '@/engine/jobs/settings/job-settings';
const HISTORY_LABEL = 'Configuração de jobs';
export function updateJobSettings(session: EditorSession, patch: Partial<JobSettings>): void {
    const before = structuredClone(session.scene.jobs);
    const next = normalizeJobSettings({ ...before, ...patch });
    if (JSON.stringify(next) === JSON.stringify(before))
        return;
    const fields = Object.keys(patch);
    const mergeKey = fields.length === 1 ? `jobs.${fields[0]}` : undefined;
    session.history.execute(new SetValueCommand<JobSettings>(HISTORY_LABEL, (value) => {
        Object.assign(session.scene.jobs, value);
        session.scripts.jobs.configure(session.scene.jobs);
        session.notify();
    }, before, next, mergeKey));
}
