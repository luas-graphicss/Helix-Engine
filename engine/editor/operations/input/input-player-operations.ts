import type { EditorSession } from '@/engine/editor/session/editor-session';
import { updatePlayerSettings } from '@/engine/input/actions/asset-edits';
import type { InputPlayerSettings } from '@/engine/input/actions/input-asset';
import { applyInputEdit } from './input-asset-command';
export function updateInputPlayers(session: EditorSession, patch: Partial<InputPlayerSettings>): void {
    applyInputEdit(session, 'Jogadores locais', (asset) => updatePlayerSettings(asset, patch), 'input:players');
}
