import type { EditorSession } from '@/engine/editor/session/editor-session';
import { addBinding, removeBinding, setCompositePartPath, updateBinding } from '@/engine/input/actions/asset-edits';
import type { CompositeKind, InputBinding, InputInteraction, InputProcessors } from '@/engine/input/actions/input-asset';
import { createBinding, createCompositeBinding } from '@/engine/input/actions/input-factories';
import { applyInputEdit } from './input-asset-command';
export function addInputBinding(session: EditorSession, actionId: string, schemes: readonly string[]): string {
    const binding = createBinding('', schemes);
    applyInputEdit(session, 'Adicionar vínculo de controle', (asset) => addBinding(asset, actionId, binding));
    return binding.id;
}
export function addInputComposite(session: EditorSession, actionId: string, kind: CompositeKind, schemes: readonly string[]): string {
    const binding = createCompositeBinding(kind, schemes);
    applyInputEdit(session, 'Adicionar vínculo composto', (asset) => addBinding(asset, actionId, binding));
    return binding.id;
}
export function setInputBindingPath(session: EditorSession, bindingId: string, part: string | null, path: string): void {
    applyInputEdit(session, 'Controle do vínculo', (asset) => (part === null ? updateBinding(asset, bindingId, { path }) : setCompositePartPath(asset, bindingId, part, path)));
}
export function toggleInputBindingScheme(session: EditorSession, binding: InputBinding, schemeId: string): void {
    const schemes = binding.schemes.includes(schemeId) ? binding.schemes.filter((id) => id !== schemeId) : [...binding.schemes, schemeId];
    applyInputEdit(session, 'Esquemas do vínculo', (asset) => updateBinding(asset, binding.id, { schemes }));
}
export function setInputBindingInteraction(session: EditorSession, bindingId: string, interaction: InputInteraction): void {
    applyInputEdit(session, 'Interação do vínculo', (asset) => updateBinding(asset, bindingId, { interaction }), `input:${bindingId}:interaction`);
}
export function setInputBindingProcessors(session: EditorSession, bindingId: string, processors: InputProcessors): void {
    applyInputEdit(session, 'Processadores do vínculo', (asset) => updateBinding(asset, bindingId, { processors }), `input:${bindingId}:processors`);
}
export function removeInputBinding(session: EditorSession, bindingId: string): void {
    applyInputEdit(session, 'Excluir vínculo de controle', (asset) => removeBinding(asset, bindingId));
}
