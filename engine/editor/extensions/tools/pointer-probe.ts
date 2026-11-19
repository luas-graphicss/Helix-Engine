import { createRay, type Ray } from '@/engine/core/math/ray';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { intersectRayPlane } from '@/engine/editor/transform/drag/ray-math';
import { buildPickRay, pickEntity, pickSurfacePoint } from '@/engine/editor/viewport/pick-entity';
import type { ToolPointer } from './tool-contribution';
const GROUND_ORIGIN = vec3.create();
const GROUND_NORMAL = vec3.create(0, 1, 0);
export function pointerRay(session: EditorSession, pointer: ToolPointer): Ray | null {
    return buildPickRay(createRay(), session.camera, pointer.u, pointer.v);
}
export function pointerActor(session: EditorSession, pointer: ToolPointer): Entity | null {
    const { render } = session;
    return pickEntity(session.scene, session.camera, pointer.u, pointer.v, {
        lightHelpers: render.lightHelpers,
        soundHelpers: render.soundHelpers,
        vfxHelpers: render.vfxHelpers,
        selection: session.selectedIds,
    });
}
export function pointerSurfacePoint(session: EditorSession, pointer: ToolPointer): Vec3 | null {
    return pickSurfacePoint(vec3.create(), session.scene, session.camera, pointer.u, pointer.v);
}
export function pointerGroundPoint(session: EditorSession, pointer: ToolPointer): Vec3 | null {
    const ray = pointerRay(session, pointer);
    const point = vec3.create();
    return ray && intersectRayPlane(point, ray, GROUND_ORIGIN, GROUND_NORMAL) ? point : null;
}
