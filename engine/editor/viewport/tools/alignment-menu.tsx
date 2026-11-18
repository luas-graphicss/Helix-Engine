'use client';
import { AlignCenterVertical, AlignEndVertical, AlignHorizontalSpaceAround, AlignStartVertical } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { IconButton } from '@/engine/ui/icon-button';
import { MENU_CONTENT_CLASS } from '@/engine/editor/menus/menu-styles';
import { alignableEntities, alignSelected, distributeSelected, MIN_ALIGNED_ACTORS, MIN_DISTRIBUTED_ACTORS } from '@/engine/editor/operations/alignment-operations';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import type { AlignEdge } from '@/engine/editor/transform/alignment/selection-alignment';
import { AXIS_INDICES, AXIS_LABELS } from '@/engine/editor/transform/gizmo/gizmo-frame';
import { HUD_GROUP_CLASS } from '../hud-styles';
const EDGES: ReadonlyArray<{
    edge: AlignEdge;
    label: string;
    icon: LucideIcon;
}> = [
    { edge: 'min', label: 'mínimo', icon: AlignStartVertical },
    { edge: 'center', label: 'centro', icon: AlignCenterVertical },
    { edge: 'max', label: 'máximo', icon: AlignEndVertical },
];
const AXIS_TEXT_CLASS: readonly string[] = ['text-axis-x', 'text-axis-y', 'text-axis-z'];
export function AlignmentMenu() {
    const session = useSessionTopic('scene', 'selection', 'playtest');
    const count = alignableEntities(session).length;
    if (count < MIN_ALIGNED_ACTORS || session.playtest.isPossessing)
        return null;
    const principal = session.selectedEntity?.name ?? 'ator principal';
    return (<div className={HUD_GROUP_CLASS}>
      <Popover>
        <PopoverTrigger render={<IconButton label="Alinhar e distribuir a seleção" size="sm"/>}>
          <AlignCenterVertical />
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={4} className={cn(MENU_CONTENT_CLASS, 'w-auto min-w-0 gap-1.5 p-2')}>
          <PopoverTitle className="max-w-48 truncate text-3xs font-medium tracking-wider text-muted-foreground uppercase" title={`Alinhar a ${principal}`}>
            Alinhar a {principal}
          </PopoverTitle>
          <div className="flex flex-col gap-0.5">
            {AXIS_INDICES.map((axis) => (<div key={axis} role="group" aria-label={`Eixo ${AXIS_LABELS[axis]}`} className="flex items-center gap-0.5">
                <span aria-hidden className={cn('w-4 text-center font-mono text-2xs font-semibold', AXIS_TEXT_CLASS[axis])}>
                  {AXIS_LABELS[axis]}
                </span>
                {EDGES.map(({ edge, label, icon: Icon }) => (<IconButton key={edge} label={`Alinhar pelo ${label} em ${AXIS_LABELS[axis]}`} size="md" onClick={() => alignSelected(session, axis, edge)}>
                    <Icon />
                  </IconButton>))}
                <span aria-hidden className="mx-1 h-4 w-px bg-border"/>
                <IconButton label={count < MIN_DISTRIBUTED_ACTORS ? `Distribuir em ${AXIS_LABELS[axis]} (selecione três atores ou mais)` : `Distribuir com espaços iguais em ${AXIS_LABELS[axis]}`} size="md" disabled={count < MIN_DISTRIBUTED_ACTORS} onClick={() => distributeSelected(session, axis)}>
                  <AlignHorizontalSpaceAround />
                </IconButton>
              </div>))}
          </div>
        </PopoverContent>
      </Popover>
    </div>);
}
