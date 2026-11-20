import type { EditorSession } from '@/engine/editor/session/editor-session';
import { addAction, addActionMap, removeAction, removeActionMap, renameActionMap, updateAction } from '@/engine/input/actions/asset-edits';
import { createDefaultInputAsset } from '@/engine/input/actions/default-input-asset';
import type { InputActionType } from '@/engine/input/actions/input-asset';
import { createAction, createActionMap } from '@/engine/input/actions/input-factories';
import { applyInputEdit } from './input-asset-command';
const NEW_MAP_NAME = 'Map';
const NEW_ACTION_NAME = 'Action';
export function addInputMap(session: EditorSession): string {
    const map = createActionMap(NEW_MAP_NAME);
    applyInputEdit(session, 'Adicionar mapa de ações', (asset) => addActionMap(asset, map));
    return map.id;
}
export function renameInputMap(session: EditorSession, mapId: string, name: string): void {
    applyInputEdit(session, 'Renomear mapa de ações', (asset) => renameActionMap(asset, mapId, name));
}
export function removeInputMap(session: EditorSession, mapId: string): void {
    applyInputEdit(session, 'Excluir mapa de ações', (asset) => removeActionMap(asset, mapId));
}
export function addInputAction(session: EditorSession, mapId: string): string {
    const action = createAction(NEW_ACTION_NAME, 'button');
    applyInputEdit(session, 'Adicionar ação de entrada', (asset) => addAction(asset, mapId, action));
    return action.id;
}
export function renameInputAction(session: EditorSession, actionId: string, name: string): void {
    applyInputEdit(session, 'Renomear ação de entrada', (asset) => updateAction(asset, actionId, { name }));
}
export function setInputActionType(session: EditorSession, actionId: string, type: InputActionType): void {
    applyInputEdit(session, 'Tipo da ação de entrada', (asset) => updateAction(asset, actionId, { type }));
}
export function removeInputAction(session: EditorSession, actionId: string): void {
    applyInputEdit(session, 'Excluir ação de entrada', (asset) => removeAction(asset, actionId));
}
export function restoreDefaultInputAsset(session: EditorSession): void {
    applyInputEdit(session, 'Restaurar mapas de ações padrão', createDefaultInputAsset);
    session.log.info('Entrada', 'Mapas de ações, esquemas e jogadores restaurados ao padrão.');
}
