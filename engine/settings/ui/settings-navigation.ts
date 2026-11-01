import { editorDialogs } from '@/engine/editor/dialogs/editor-dialogs';
let requestedSection: string | null = null;
export function openSettingsSection(sectionId: string): void {
    requestedSection = sectionId;
    editorDialogs.open('settings');
}
export function consumeRequestedSettingsSection(): string | null {
    const section = requestedSection;
    requestedSection = null;
    return section;
}
