'use client';
import { ChevronDown, LayoutTemplate } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { GUI_SURFACE_PRESETS } from '@/engine/gui/world/gui-surface-settings';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
import { attachGuiSurface, canCarrySurface } from '@/engine/editor/operations/gui-surface-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
export function GuiAttachSection({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    if (entity.kind === 'gui' || entity.guiSurface || !canCarrySurface(entity))
        return null;
    return (<CollapsibleSection title="Interface" defaultOpen={false}>
      <ActionRow>
        <ActionButton icon={LayoutTemplate} variant="primary" title="Mostra uma tela da biblioteca sobre este ator" onClick={() => attachGuiSurface(session, entity)}>
          Anexar interface
        </ActionButton>
        <DropdownMenu>
          <DropdownMenuTrigger render={<button type="button" className="flex h-6 items-center gap-1 rounded-sm border border-border px-1.5 text-3xs font-medium text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground [&_svg]:size-3"/>}>
            Com preset
            <ChevronDown aria-hidden className="text-muted-foreground"/>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={`${MENU_CONTENT_CLASS} w-72`}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className={MENU_LABEL_CLASS}>Pontos de partida</DropdownMenuLabel>
              {GUI_SURFACE_PRESETS.map((preset) => (<DropdownMenuItem key={preset.id} className={`${MENU_ITEM_CLASS} flex-col items-start gap-0 py-1.5`} onClick={() => attachGuiSurface(session, entity, preset.id)}>
                  <span>{preset.label}</span>
                  <span className="text-3xs leading-relaxed text-pretty text-muted-foreground">{preset.description}</span>
                </DropdownMenuItem>))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </ActionRow>
      <p className="px-2 py-0.5 text-3xs leading-relaxed text-pretty text-muted-foreground">
        {entity.mesh ? 'Uma TV na face da frente, um pôster colado na parede, um nome flutuando sobre a cabeça: a interface segue o ator e o seu tamanho.' : 'Um painel ou uma placa presos a este ator: a interface vai junto quando ele se move.'}
      </p>
    </CollapsibleSection>);
}
