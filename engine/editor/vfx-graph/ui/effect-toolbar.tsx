'use client';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
import { createBlankEffectGraph, createEffectGraphFromTemplate, deleteActiveEffectGraph } from '@/engine/editor/operations/vfx-graph-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { CONTEXT_WIDTH } from '@/engine/vfx-graph/document/context-layout';
import { EFFECT_TEMPLATE_CATEGORIES, EFFECT_TEMPLATE_CATEGORY_LABEL, EFFECT_TEMPLATES } from '@/engine/vfx-graph/templates/template-catalog';
import { FieldInput } from '@/engine/ui/field-input';
import { PanelToolbar } from '@/engine/ui/panel-toolbar';
import { TOOLBAR_CHIP_CLASS } from '@/engine/ui/surface-styles';
import { ToolbarSeparator } from '@/engine/ui/toolbar-separator';
import { cn } from '@/lib/utils';
import { nextSystemOrigin, viewCenteredOn } from './canvas/canvas-geometry';
import { useVfxGraph } from './use-vfx-graph';
const SYSTEM_TOP_INSET = 40;
function EffectPicker() {
    const session = useEditorSession();
    const editor = useVfxGraph();
    const { active } = editor;
    if (!active)
        return null;
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" title="Trocar de efeito" className={cn(TOOLBAR_CHIP_CLASS, 'max-w-44 font-sans text-2xs text-foreground')}/>}>
        <span className="truncate">{active.name}</span>
        <ChevronDown className="size-3 shrink-0" aria-hidden/>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={MENU_CONTENT_CLASS}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className={MENU_LABEL_CLASS}>Efeitos do projeto</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={active.id} onValueChange={(id: string) => editor.open(id)}>
            {editor.graphs.map((record) => (<DropdownMenuRadioItem key={record.id} value={record.id} className={MENU_ITEM_CLASS}>
                <span className="truncate">{record.name}</span>
              </DropdownMenuRadioItem>))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => deleteActiveEffectGraph(session)}>
          <Trash2 aria-hidden/>
          Excluir {active.name}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>);
}
function NewEffectMenu() {
    const session = useEditorSession();
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" title="Criar um efeito em branco ou a partir de um modelo" className={TOOLBAR_CHIP_CLASS}/>}>
        <Plus className="size-3" aria-hidden/>
        <span className="font-sans text-2xs">Novo</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={`${MENU_CONTENT_CLASS} grid w-[26rem] grid-cols-2 items-start gap-x-1 p-1.5`}>
        <DropdownMenuItem className={`${MENU_ITEM_CLASS} col-span-2 pl-2`} onClick={() => createBlankEffectGraph(session)}>
          Efeito em branco
        </DropdownMenuItem>
        <DropdownMenuSeparator className="col-span-2"/>
        {EFFECT_TEMPLATE_CATEGORIES.map((category) => (<DropdownMenuGroup key={category} className="flex min-w-0 flex-col">
            <DropdownMenuLabel className={`${MENU_LABEL_CLASS} pl-2`}>{EFFECT_TEMPLATE_CATEGORY_LABEL[category]}</DropdownMenuLabel>
            {EFFECT_TEMPLATES.filter((template) => template.category === category).map((template) => (<DropdownMenuItem key={template.id} className={`${MENU_ITEM_CLASS} pl-2`} title={template.description} onClick={() => createEffectGraphFromTemplate(session, template.id)}>
                <span className="truncate">{template.label}</span>
              </DropdownMenuItem>))}
          </DropdownMenuGroup>))}
      </DropdownMenuContent>
    </DropdownMenu>);
}
export function EffectToolbar() {
    const editor = useVfxGraph();
    const { active } = editor;
    if (!active)
        return null;
    const addSystem = () => {
        const { view, viewportSize } = editor;
        const origin = nextSystemOrigin(active.graph.contexts);
        editor.addSystem(origin.x, origin.y);
        editor.setView(viewCenteredOn(view, viewportSize, { x: origin.x + CONTEXT_WIDTH / 2, y: origin.y + (viewportSize.height / 2 - SYSTEM_TOP_INSET) / view.zoom }));
    };
    return (<PanelToolbar className="bg-surface">
      <EffectPicker />
      <NewEffectMenu />
      <ToolbarSeparator />
      <FieldInput key={`${active.id}-${active.name}`} defaultValue={active.name} aria-label="Nome do efeito" className="max-w-48 flex-none" onBlur={(event) => editor.rename(event.currentTarget.value)} onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229)
                event.currentTarget.blur();
        }}/>
      <div className="flex-1"/>
      <button type="button" title="Adiciona um sistema de partículas completo, da emissão à saída, ao lado dos que já existem" onClick={addSystem} className={TOOLBAR_CHIP_CLASS}>
        <Plus className="size-3" aria-hidden/>
        <span className="font-sans text-2xs">Sistema</span>
      </button>
    </PanelToolbar>);
}
