import type { Entity } from '@/engine/core/scene/entity';
import { CompositeCommand, SetValueCommand } from '@/engine/editor/commands/set-value-command';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { FIELD_LABEL, type Axis, type TransformField } from './transform-operations';

type SelectionEditSession = Pick<EditorSession, 'history' | 'selectedIds' | 'selectionRoots' | 'transformInterceptors'> & {
    readonly playtest: Pick<EditorSession['playtest'], 'isRunning'>;
};

export function selectionEditBlock(session: Pick<SelectionEditSession, 'playtest' | 'transformInterceptors'>): 'playtest' | 'animation' | null {
    if (session.playtest.isRunning)
        return 'playtest';
    return session.transformInterceptors.size > 0 ? 'animation' : null;
}

export function editableTransformRoots(session: Pick<EditorSession, 'selectionRoots'>): Entity[] {
    return session.selectionRoots().filter((entity) => entity.parent !== null && !entity.locked && entity.kind !== 'script');
}

export function sharedTransformAxes(entities: readonly Entity[], field: TransformField): readonly [number | null, number | null, number | null] {
    function common(axis: Axis): number | null {
        const first = entities[0]?.transform[field][axis];
        if (first === undefined)
            return null;
        return entities.every((entity) => entity.transform[field][axis] === first) ? first : null;
    }
    return [common(0), common(1), common(2)];
}

export function setSelectionTransformAxis(session: SelectionEditSession, inspected: readonly Entity[], field: TransformField, axis: Axis, input: number): void {
    const value = Math.fround(input);
    if (!Number.isFinite(value) || session.selectedIds.size < 2 || selectionEditBlock(session))
        return;
    const targets = editableTransformRoots(session);
    if (targets.length !== inspected.length || targets.some((entity, index) => entity !== inspected[index]))
        return;
    const changed = targets.filter((entity) => entity.transform[field][axis] !== value);
    if (changed.length === 0)
        return;
    const count = changed.length === 1 ? '1 ator' : `${changed.length} atores`;
    const label = `${FIELD_LABEL[field]} ${'XYZ'[axis]} em ${count}`;
    const commands = changed.map((entity) => new SetValueCommand(label, (next: number) => {
        entity.transform[field][axis] = next;
    }, entity.transform[field][axis], value));
    session.history.execute(commands.length === 1 ? commands[0] : new CompositeCommand(label, commands));
}
