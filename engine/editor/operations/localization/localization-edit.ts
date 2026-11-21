import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { LocalizationSettings } from '@/engine/localization/settings/localization-settings';
export type LocalizationEdit = (settings: LocalizationSettings) => LocalizationSettings;
export function editLocalization(session: EditorSession, label: string, edit: LocalizationEdit): boolean {
    const before = { ...session.scene.localization };
    const after = edit(before);
    if (after === before)
        return false;
    session.history.execute(new SetValueCommand<LocalizationSettings>(label, (value) => {
        Object.assign(session.scene.localization, value);
        session.scripts.localization.refresh();
        session.notify();
    }, before, after));
    return true;
}
