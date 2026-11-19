'use client';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { CanvasMount } from './canvas-mount';
const PERCENT = 100;
function percent(value: number): string {
    return `${value * PERCENT}%`;
}
export function CameraLayers() {
    const session = useSessionTopic('view', 'playtest');
    const { layers } = session.cameras;
    if (layers.length === 0)
        return null;
    return (<div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {layers.map(({ key, canvas, viewport }) => (<CanvasMount key={key} canvas={canvas} className="absolute" style={{ left: percent(viewport.x), bottom: percent(viewport.y), width: percent(viewport.width), height: percent(viewport.height) }}/>))}
    </div>);
}
