'use client';
import { useState, type DragEvent } from 'react';
import { cn } from '@/lib/utils';
import { DOCK_AREA_LABELS, DOCK_AREAS, type DockArea } from './dock-layout';
import { useDockLayout } from './dock-layout-context';
import { DOCK_PANELS } from './dock-panels';
import { isPanelDrag, readDraggedPanel } from './dock-area';
const ZONE_CLASS: Record<DockArea, string> = {
    left: 'inset-y-3 left-3 w-24',
    right: 'inset-y-3 right-3 w-24',
    bottom: 'inset-x-3 bottom-3 h-20',
};
export function DockDropZones() {
    const [layout, dock] = useDockLayout();
    const [hovered, setHovered] = useState<DockArea | null>(null);
    if (!layout.dragging)
        return null;
    const panel = DOCK_PANELS[layout.dragging];
    const onDrop = (area: DockArea) => (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        const id = readDraggedPanel(event);
        if (id)
            dock.move(id, area);
        dock.setDragging(null);
        setHovered(null);
    };
    return (<div className="pointer-events-none absolute inset-0 z-20" aria-label={`Soltar ${panel.label} numa borda para encaixar`}>
      {DOCK_AREAS.map((area) => (<div key={area} role="button" aria-label={`Encaixar ${panel.label} à ${DOCK_AREA_LABELS[area].toLowerCase()}`} className={cn('pointer-events-auto absolute flex items-center justify-center rounded-sm border border-dashed text-2xs font-medium transition-colors', ZONE_CLASS[area], hovered === area ? 'border-primary bg-primary/25 text-foreground' : 'border-primary/50 bg-background/60 text-muted-foreground')} onDragOver={(event) => {
                if (!isPanelDrag(event))
                    return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                if (hovered !== area)
                    setHovered(area);
            }} onDragLeave={() => setHovered((current) => (current === area ? null : current))} onDrop={onDrop(area)}>
          {DOCK_AREA_LABELS[area]}
        </div>))}
    </div>);
}
