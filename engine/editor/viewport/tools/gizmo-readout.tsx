'use client';
import { cn } from '@/lib/utils';
import { useLiveEdits } from '@/engine/editor/session/editor-session-context';
import { HUD_NOTE_CLASS } from '../hud-styles';
export function GizmoReadout() {
    const { gizmo } = useLiveEdits();
    if (!gizmo.readout)
        return null;
    return (<span aria-hidden className={cn(HUD_NOTE_CLASS, 'tabular-nums')}>
      {gizmo.readout}
    </span>);
}
