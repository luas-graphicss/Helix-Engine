'use client';
import { Copy, LayoutTemplate, Trash2 } from 'lucide-react';
import { GUI_ELEMENT_LABELS, type GuiNode } from '@/engine/gui/document/gui-document';
import { GUI_ELEMENT_ICONS } from '@/engine/editor/gui/ui/gui-element-icons';
import { useGuiDesigner } from '@/engine/editor/gui/ui/use-gui-designer';
import { deleteSelectedGuiNodes, duplicateSelectedGuiNodes, isGuiContainer, renameGuiNode } from '@/engine/editor/operations/gui-element-operations';
import { useEditorSession, useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { IconButton } from '@/engine/ui/icon-button';
import { cn } from '@/lib/utils';
import { PaletteNotice } from '../interface/palette-notice';
import { GuiAppearanceSection } from './inspector/sections/gui-appearance-section';
import { GuiBehaviorSection } from './inspector/sections/gui-behavior-section';
import { GuiControlSection } from './inspector/sections/gui-control-section';
import { GuiLayoutSection } from './inspector/sections/gui-layout-section';
import { GuiIconSection, GuiImageSection } from './inspector/sections/gui-media-sections';
import { GuiRectSection } from './inspector/sections/gui-rect-section';
import { GuiScreenInspector } from './inspector/sections/gui-screen-section';
import { GuiStatesSection } from './inspector/sections/gui-states-section';
import { GuiTextSection } from './inspector/sections/gui-text-section';
import { useShortcutHint } from '@/engine/editor/shortcuts/shortcut-bindings';
function NoScreen() {
    return (<div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
      <LayoutTemplate className="size-5 opacity-60" aria-hidden/>
      <p className="text-2xs leading-relaxed text-pretty">Nenhuma tela aberta. Abra ou crie uma na aba Telas da paleta Interface para editar suas propriedades aqui.</p>
    </div>);
}
function ElementHeader({ node, count }: {
    node: GuiNode;
    count: number;
}) {
    const session = useEditorSession();
    const hint = useShortcutHint();
    const Icon = GUI_ELEMENT_ICONS[node.kind];
    return (<div className="flex shrink-0 items-center gap-2 border-b border-border p-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-surface-raised text-muted-foreground">
        <Icon className="size-4" aria-hidden/>
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <input key={`${node.id}-${node.name}`} defaultValue={node.name} aria-label="Nome do elemento" onBlur={(event) => renameGuiNode(session, node.id, event.currentTarget.value)} onKeyDown={(event) => {
            if (event.key === 'Enter')
                event.currentTarget.blur();
            if (event.key === 'Escape') {
                event.currentTarget.value = node.name;
                event.currentTarget.blur();
            }
        }} className="h-5 w-full min-w-0 bg-transparent text-xs font-semibold text-foreground outline-none"/>
        <span className="truncate font-mono text-3xs text-muted-foreground">
          {GUI_ELEMENT_LABELS[node.kind]}
          {count > 1 && ` · ${count} selecionados`}
        </span>
      </div>
      <IconButton label={hint('Duplicar', 'gui.duplicate')} size="sm" onClick={() => duplicateSelectedGuiNodes(session)}>
        <Copy />
      </IconButton>
      <IconButton label="Excluir (Del)" size="sm" className="hover:text-destructive" onClick={() => deleteSelectedGuiNodes(session)}>
        <Trash2 />
      </IconButton>
    </div>);
}
export function GuiInspectorPanel() {
    useSessionTopic('assets', 'scene');
    const designer = useGuiDesigner();
    const document = designer.document;
    if (!document)
        return <NoScreen />;
    const nodes = designer.selectedNodes;
    const primary = designer.primaryNode ?? nodes[0] ?? null;
    const preview = designer.mode === 'preview';
    if (!primary) {
        return (<div className={cn('flex h-full flex-col', preview && 'pointer-events-none opacity-60')}>
        <GuiScreenInspector document={document}/>
      </div>);
    }
    return (<div className="flex h-full flex-col">
      <ElementHeader node={primary} count={nodes.length}/>
      {preview && <PaletteNotice>Saia da pré-visualização (Esc) para editar as propriedades.</PaletteNotice>}
      {nodes.length > 1 && !preview && <PaletteNotice>Mostrando {primary.name}; cada alteração é aplicada aos {nodes.length} elementos selecionados.</PaletteNotice>}
      <div className={cn('min-h-0 flex-1 overflow-auto', preview && 'pointer-events-none opacity-60')}>
        <GuiRectSection node={primary}/>
        {isGuiContainer(primary) && <GuiLayoutSection node={primary}/>}
        <GuiAppearanceSection node={primary}/>
        {primary.text && <GuiTextSection text={primary.text}/>}
        {primary.image && <GuiImageSection image={primary.image}/>}
        {primary.icon && <GuiIconSection icon={primary.icon}/>}
        {primary.control && <GuiControlSection control={primary.control} interactable={primary.interactable}/>}
        <GuiStatesSection node={primary}/>
        <GuiBehaviorSection node={primary}/>
      </div>
    </div>);
}
