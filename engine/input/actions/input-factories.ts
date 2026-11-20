import { COMPOSITE_PARTS, DEFAULT_INTERACTION, DEFAULT_PROCESSORS, type CompositeKind, type ControlScheme, type InputAction, type InputActionMap, type InputActionType, type InputBinding } from './input-asset';
const ID_LENGTH = 8;
export function createInputId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, ID_LENGTH)}`;
}
export function createBinding(path: string, schemes: readonly string[] = []): InputBinding {
    return { id: createInputId('binding'), path, composite: null, parts: [], schemes, interaction: DEFAULT_INTERACTION, processors: DEFAULT_PROCESSORS };
}
export function createCompositeBinding(kind: CompositeKind, schemes: readonly string[] = []): InputBinding {
    const parts = COMPOSITE_PARTS[kind].map((name) => ({ name, path: '' }));
    return { id: createInputId('binding'), path: '', composite: kind, parts, schemes, interaction: DEFAULT_INTERACTION, processors: DEFAULT_PROCESSORS };
}
export function createAction(name: string, type: InputActionType): InputAction {
    return { id: createInputId('action'), name, type, bindings: [] };
}
export function createActionMap(name: string): InputActionMap {
    return { id: createInputId('map'), name, actions: [] };
}
export function createControlScheme(name: string): ControlScheme {
    return { id: createInputId('scheme'), name, devices: [] };
}
