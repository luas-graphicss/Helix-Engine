import type { EditorSession } from '@/engine/editor/session/editor-session';
import { addControlScheme, removeControlScheme, updateControlScheme } from '@/engine/input/actions/asset-edits';
import type { SchemeDevice } from '@/engine/input/actions/input-asset';
import { createControlScheme } from '@/engine/input/actions/input-factories';
import { applyInputEdit } from './input-asset-command';
const NEW_SCHEME_NAME = 'Esquema';
export function addInputScheme(session: EditorSession): string {
    const scheme = createControlScheme(NEW_SCHEME_NAME);
    applyInputEdit(session, 'Adicionar esquema de controle', (asset) => addControlScheme(asset, scheme));
    return scheme.id;
}
export function renameInputScheme(session: EditorSession, schemeId: string, name: string): void {
    applyInputEdit(session, 'Renomear esquema de controle', (asset) => updateControlScheme(asset, schemeId, { name }));
}
export function setInputSchemeDevices(session: EditorSession, schemeId: string, devices: readonly SchemeDevice[]): void {
    applyInputEdit(session, 'Dispositivos do esquema', (asset) => updateControlScheme(asset, schemeId, { devices }));
}
export function removeInputScheme(session: EditorSession, schemeId: string): void {
    applyInputEdit(session, 'Excluir esquema de controle', (asset) => removeControlScheme(asset, schemeId));
}
