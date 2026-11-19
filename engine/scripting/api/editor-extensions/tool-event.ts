import { pointerActor, pointerGroundPoint, pointerRay, pointerSurfacePoint } from '@/engine/editor/extensions/tools/pointer-probe';
import type { ToolPointer } from '@/engine/editor/extensions/tools/tool-contribution';
import type { EditorSession } from '@/engine/editor/session/editor-session';
function once<TValue>(compute: () => TValue): () => TValue {
    let cached: {
        readonly value: TValue;
    } | null = null;
    return () => (cached ??= { value: compute() }).value;
}
export function createToolEvent(session: EditorSession, pointer: ToolPointer) {
    const ray = once(() => pointerRay(session, pointer));
    const actor = once(() => pointerActor(session, pointer));
    const point = once(() => pointerSurfacePoint(session, pointer));
    const ground = once(() => pointerGroundPoint(session, pointer));
    return {
        x: pointer.x,
        y: pointer.y,
        button: pointer.button,
        ctrl: pointer.ctrl,
        shift: pointer.shift,
        alt: pointer.alt,
        get ray() {
            return ray();
        },
        get actor() {
            return actor();
        },
        get point() {
            return point();
        },
        get ground() {
            return ground();
        },
    };
}
export type ToolEvent = ReturnType<typeof createToolEvent>;
