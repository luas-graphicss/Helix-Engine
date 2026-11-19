'use client';
import { X } from 'lucide-react';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { IconButton } from '@/engine/ui/icon-button';
import { extensionIcon } from '../extension-icon';
import { ExtensionGuiView } from '../gui/extension-gui-view';
export function ExtensionToolPanel() {
    const { extensions } = useSessionTopic('tool');
    const { toolController } = extensions;
    const tool = toolController.active;
    if (!tool)
        return null;
    const Icon = extensionIcon(tool.icon);
    return (<section aria-label={`Opções de ${tool.title}`} className="pointer-events-auto flex max-h-full w-60 shrink-0 flex-col overflow-hidden rounded-sm border border-border bg-surface-overlay/95 shadow-overlay backdrop-blur-sm">
      <header className="flex h-row shrink-0 items-center gap-1.5 pr-0.5 pl-2">
        <Icon className="size-3.5 shrink-0 text-primary" aria-hidden/>
        <h2 className="min-w-0 flex-1 truncate text-2xs font-semibold">{tool.title}</h2>
        <IconButton label="Sair da ferramenta (Esc)" size="xs" onClick={() => toolController.deactivate()}>
          <X />
        </IconButton>
      </header>
      {tool.surface && (<div className="min-h-0 overflow-auto border-t border-border">
          <ExtensionGuiView key={tool.id} surface={tool.surface}/>
        </div>)}
    </section>);
}
