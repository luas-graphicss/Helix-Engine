'use client';
import { Camera } from 'lucide-react';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { CanvasMount } from './canvas-mount';
const MIN_ASPECT = 0.5;
const MAX_ASPECT = 3;
export function CameraPreview() {
    const session = useSessionTopic('view', 'selection', 'scene', 'playtest');
    const { preview } = session.cameras;
    if (!preview)
        return null;
    const name = session.scene.findById(preview.entityId)?.name ?? 'Câmera';
    const aspect = Math.max(MIN_ASPECT, Math.min(preview.aspect, MAX_ASPECT));
    return (<figure aria-label={`Prévia da câmera ${name}`} className="pointer-events-none absolute bottom-2 left-2 flex w-56 flex-col overflow-hidden rounded-sm border border-border bg-surface-overlay/95 shadow-overlay">
      <figcaption className="flex items-center gap-1.5 px-2 py-1 font-mono text-2xs text-foreground">
        <Camera className="size-3 shrink-0 text-primary" aria-hidden/>
        <span className="truncate">{name}</span>
        <span className="ml-auto shrink-0 text-muted-foreground">prévia</span>
      </figcaption>
      <CanvasMount canvas={preview.canvas} className="w-full bg-surface-sunken" style={{ aspectRatio: aspect }}/>
    </figure>);
}
