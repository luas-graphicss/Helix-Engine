import type { CompositeKind, InputActionType, InteractionKind, JoinMode } from '@/engine/input/actions/input-asset';
interface Option<TValue> {
    readonly value: TValue;
    readonly label: string;
}
export const ACTION_TYPE_LABEL: Record<InputActionType, string> = { button: 'Botão', axis: 'Eixo', vector2: 'Vetor 2D' };
export const ACTION_TYPE_OPTIONS: readonly Option<InputActionType>[] = [
    { value: 'button', label: ACTION_TYPE_LABEL.button },
    { value: 'axis', label: ACTION_TYPE_LABEL.axis },
    { value: 'vector2', label: ACTION_TYPE_LABEL.vector2 },
];
export const INTERACTION_OPTIONS: readonly Option<InteractionKind>[] = [
    { value: 'press', label: 'Pressionar' },
    { value: 'hold', label: 'Segurar' },
    { value: 'tap', label: 'Toque' },
];
export const JOIN_MODE_OPTIONS: readonly Option<JoinMode>[] = [
    { value: 'manual', label: 'Por script' },
    { value: 'buttonPress', label: 'Ao pressionar' },
];
export const COMPOSITE_LABEL: Record<CompositeKind, string> = { axis1d: 'Eixo composto', vector2: 'Vetor composto' };
const PART_LABELS = new Map([
    ['up', 'Cima'],
    ['down', 'Baixo'],
    ['left', 'Esquerda'],
    ['right', 'Direita'],
    ['negative', 'Negativo'],
    ['positive', 'Positivo'],
]);
export function partLabel(part: string): string {
    return PART_LABELS.get(part) ?? part;
}
