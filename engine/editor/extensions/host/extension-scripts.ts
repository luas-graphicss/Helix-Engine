import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { EditorExtensionEntry } from '@/engine/scripting/scripting-settings';
import { hasExtension, withExtension, withExtensionEnabled, withoutExtension } from './extension-entries';
function replaceExtensions(session: EditorSession, label: string, next: EditorExtensionEntry[]): void {
    const { scripting } = session.scene;
    const { host } = session.extensions;
    session.history.execute(new SetValueCommand<EditorExtensionEntry[]>(label, (entries) => {
        scripting.extensions = entries;
        host.requestSync();
        session.notify();
    }, host.entries, next));
}
export function isExtensionScript(session: EditorSession, assetId: string): boolean {
    return hasExtension(session.extensions.host.entries, assetId);
}
export function addExtensionScript(session: EditorSession, asset: LibraryAsset): void {
    const { host } = session.extensions;
    if (hasExtension(host.entries, asset.id))
        return;
    if (host.entries.length === 0)
        host.grantTrust();
    replaceExtensions(session, `Usar ${asset.name} como extensão do editor`, withExtension(host.entries, asset.id));
}
export function removeExtensionScript(session: EditorSession, assetId: string): void {
    const { host } = session.extensions;
    if (!hasExtension(host.entries, assetId))
        return;
    const name = session.library.get(assetId)?.name ?? 'o script';
    replaceExtensions(session, `Deixar de usar ${name} como extensão`, withoutExtension(host.entries, assetId));
}
export function setExtensionEnabled(session: EditorSession, assetId: string, enabled: boolean): void {
    const { host } = session.extensions;
    const entry = host.entries.find((candidate) => candidate.assetId === assetId);
    if (!entry || entry.enabled === enabled)
        return;
    const name = session.library.get(assetId)?.name ?? 'a extensão';
    replaceExtensions(session, `${enabled ? 'Ligar' : 'Desligar'} ${name}`, withExtensionEnabled(host.entries, assetId, enabled));
}
