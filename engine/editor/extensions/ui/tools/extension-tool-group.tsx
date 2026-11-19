'use client';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { formatChord } from '@/engine/editor/shortcuts/key-chord';
import { HUD_GROUP_CLASS } from '@/engine/editor/viewport/hud-styles';
import { IconButton } from '@/engine/ui/icon-button';
import { cn } from '@/lib/utils';
import { extensionIcon } from '../extension-icon';
import { useContributions } from '../use-contributions';
export function ExtensionToolGroup() {
    const { extensions } = useSessionTopic('tool');
    const tools = useContributions(extensions.tools);
    const { toolController } = extensions;
    if (tools.length === 0)
        return null;
    return (<div className={cn(HUD_GROUP_CLASS, 'flex-col')}>
      {tools.map((tool) => {
            const Icon = extensionIcon(tool.icon);
            return (<IconButton key={tool.id} label={tool.shortcut ? `${tool.title} (${formatChord(tool.shortcut)})` : tool.title} active={toolController.active === tool} onClick={() => toolController.trigger(tool)}>
            <Icon />
          </IconButton>);
        })}
    </div>);
}
