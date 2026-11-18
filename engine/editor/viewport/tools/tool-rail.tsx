'use client';
import { Axis3d, Mountain, MousePointer2, Move3d, Orbit, Rotate3d, Scale3d, Scaling } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from '@/engine/ui/icon-button';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import type { TransformTool } from '@/engine/editor/session/editor-session';
import { useShortcutHint } from '@/engine/editor/shortcuts/shortcut-bindings';
import { VIEWPORT_TOOL_GROUPS } from '@/engine/editor/transform/tool-catalog';
import { HUD_GROUP_CLASS } from '../hud-styles';
const TOOL_ICON: Record<TransformTool, LucideIcon> = {
    select: MousePointer2,
    translate: Move3d,
    rotate: Rotate3d,
    scale: Scale3d,
    transform: Axis3d,
    universal: Orbit,
    rect: Scaling,
    terrain: Mountain,
};
export function ToolRail() {
    const session = useSessionTopic('tool', 'playtest');
    const hint = useShortcutHint();
    if (session.playtest.isPossessing)
        return null;
    return (<div role="toolbar" aria-label="Ferramentas do viewport" aria-orientation="vertical" className="flex h-full flex-col flex-wrap content-start gap-1">
      {VIEWPORT_TOOL_GROUPS.map((group) => (<div key={group[0].id} className={cn(HUD_GROUP_CLASS, 'flex-col')}>
          {group.map(({ id, label, shortcut }) => {
                const Icon = TOOL_ICON[id];
                return (<IconButton key={id} label={hint(label, shortcut)} active={session.tool === id} onClick={() => session.setTool(id)}>
                <Icon />
              </IconButton>);
            })}
        </div>))}
    </div>);
}
