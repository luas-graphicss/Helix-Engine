export type ControlKind = 'button' | 'axis' | 'vector2';
export type ControlMotion = 'state' | 'relative' | 'absolute';
export interface ControlDescriptor {
    readonly id: string;
    readonly label: string;
    readonly kind: ControlKind;
    readonly motion: ControlMotion;
}
export const VECTOR_AXES = ['x', 'y'] as const;
export const VECTOR_DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
export type VectorAxis = (typeof VECTOR_AXES)[number];
export type VectorDirection = (typeof VECTOR_DIRECTIONS)[number];
export type VectorMember = VectorAxis | VectorDirection;
export interface ResolvedControl {
    readonly descriptor: ControlDescriptor;
    readonly member: VectorMember | null;
}
const MEMBER_LABELS: Record<VectorMember, string> = { x: 'X', y: 'Y', up: '↑', down: '↓', left: '←', right: '→' };
function isVectorMember(value: string): value is VectorMember {
    return (VECTOR_AXES as readonly string[]).includes(value) || (VECTOR_DIRECTIONS as readonly string[]).includes(value);
}
export function buttonControl(id: string, label: string): ControlDescriptor {
    return { id, label, kind: 'button', motion: 'state' };
}
export function axisControl(id: string, label: string): ControlDescriptor {
    return { id, label, kind: 'axis', motion: 'state' };
}
export function vectorControl(id: string, label: string, motion: ControlMotion = 'state'): ControlDescriptor {
    return { id, label, kind: 'vector2', motion };
}
export function resolveControl(controls: readonly ControlDescriptor[], id: string): ResolvedControl | null {
    const direct = controls.find((control) => control.id === id);
    if (direct)
        return { descriptor: direct, member: null };
    const separator = id.lastIndexOf('/');
    if (separator < 0)
        return null;
    const member = id.slice(separator + 1);
    const parentId = id.slice(0, separator);
    const parent = controls.find((control) => control.id === parentId);
    return parent?.kind === 'vector2' && isVectorMember(member) ? { descriptor: parent, member } : null;
}
export function resolvedControlKind({ descriptor, member }: ResolvedControl): ControlKind {
    if (member === null)
        return descriptor.kind;
    return member === 'x' || member === 'y' ? 'axis' : 'button';
}
export function resolvedControlLabel({ descriptor, member }: ResolvedControl): string {
    return member === null ? descriptor.label : `${descriptor.label} ${MEMBER_LABELS[member]}`;
}
