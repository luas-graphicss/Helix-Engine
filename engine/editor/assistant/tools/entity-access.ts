import type { Entity } from '@/engine/core/scene/entity';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { ToolFailure } from './tool-failure';
export function requireEntity(session: EditorSession, id: number): Entity {
    const entity = session.scene.findById(id);
    if (!entity)
        throw new ToolFailure(`No entity with id ${id}. Call list_scene to get valid ids.`);
    return entity;
}
export function requireActor(session: EditorSession, id: number): Entity {
    const entity = requireEntity(session, id);
    if (entity === session.scene.root)
        throw new ToolFailure('The scene root cannot be changed.');
    return entity;
}
export function requireActors(session: EditorSession, ids: readonly number[]): Entity[] {
    return ids.map((id) => requireActor(session, id));
}
export function resolveParent(session: EditorSession, parentId: number | undefined): Entity {
    return parentId === undefined ? session.scene.root : requireEntity(session, parentId);
}
