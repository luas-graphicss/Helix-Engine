import type { EditorSession } from '@/engine/editor/session/editor-session';
import { addCustomControl, addCustomDevice, removeCustomControl, removeCustomDevice } from '@/engine/input/actions/asset-edits';
import { uniqueName } from '@/engine/input/actions/input-names';
import type { CustomControlKind } from '@/engine/input/controls/custom-layout';
import { applyInputEdit } from './input-asset-command';
const NEW_DEVICE_NAME = 'Device';
export function addCustomInputDevice(session: EditorSession): string {
    const name = uniqueName(NEW_DEVICE_NAME, session.scene.input.customDevices.map((layout) => layout.name));
    applyInputEdit(session, 'Adicionar dispositivo customizado', (asset) => addCustomDevice(asset, name));
    return name;
}
export function addCustomInputControl(session: EditorSession, layoutName: string, id: string, kind: CustomControlKind): void {
    applyInputEdit(session, 'Adicionar controle customizado', (asset) => addCustomControl(asset, layoutName, { id, kind }));
}
export function removeCustomInputControl(session: EditorSession, layoutName: string, controlId: string): void {
    applyInputEdit(session, 'Excluir controle customizado', (asset) => removeCustomControl(asset, layoutName, controlId));
}
export function removeCustomInputDevice(session: EditorSession, layoutName: string): void {
    applyInputEdit(session, 'Excluir dispositivo customizado', (asset) => removeCustomDevice(asset, layoutName));
}
