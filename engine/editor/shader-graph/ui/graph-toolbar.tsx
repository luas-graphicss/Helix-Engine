'use client';
import { ChevronDown, FileOutput, Plus, Trash2, Unplug, Zap } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
import { createBlankShaderGraph, createShaderGraphFromTemplate, deleteActiveShaderGraph, exportShaderGraphScript, toggleShaderGraphLink } from '@/engine/editor/operations/shader-graph-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { SHADER_MODEL_LABEL, type ShaderModel } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
import { GRAPH_TEMPLATES } from '@/engine/shader-graph/templates/template-catalog';
import { FieldInput } from '@/engine/ui/field-input';
import { PanelToolbar } from '@/engine/ui/panel-toolbar';
import { TOOLBAR_CHIP_CLASS } from '@/engine/ui/surface-styles';
import { ToolbarSeparator } from '@/engine/ui/toolbar-separator';
import { cn } from '@/lib/utils';
import { useShaderGraph } from './use-shader-graph';
const TEMPLATE_GROUPS: readonly {
    model: ShaderModel;
    label: string;
    blank: string;
}[] = [
    { model: 'surface', label: 'Superfície', blank: 'Superfície em branco' },
    { model: 'post', label: 'Pós-processo', blank: 'Efeito de tela em branco' },
];
function GraphPicker() {
    const session = useEditorSession();
    const editor = useShaderGraph();
    const { active } = editor;
    if (!active)
        return null;
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" title="Trocar de grafo" className={cn(TOOLBAR_CHIP_CLASS, 'max-w-44 font-sans text-2xs text-foreground')}/>}>
        <span className="truncate">{active.name}</span>
        <ChevronDown className="size-3 shrink-0" aria-hidden/>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={MENU_CONTENT_CLASS}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className={MENU_LABEL_CLASS}>Grafos do projeto</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={active.id} onValueChange={(id: string) => editor.open(id)}>
            {editor.graphs.map((record) => (<DropdownMenuRadioItem key={record.id} value={record.id} className={MENU_ITEM_CLASS}>
                <span className="truncate">{record.name}</span>
                <span className="ml-auto pl-4 text-3xs text-muted-foreground">{SHADER_MODEL_LABEL[record.graph.model]}</span>
              </DropdownMenuRadioItem>))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => deleteActiveShaderGraph(session)}>
          <Trash2 aria-hidden/>
          Excluir {active.name}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>);
}
function NewGraphMenu() {
    const session = useEditorSession();
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" title="Criar um grafo em branco ou a partir de um modelo" className={TOOLBAR_CHIP_CLASS}/>}>
        <Plus className="size-3" aria-hidden/>
        <span className="font-sans text-2xs">Novo</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={`${MENU_CONTENT_CLASS} grid w-[26rem] grid-cols-2 items-start gap-x-1 p-1.5`}>
        {TEMPLATE_GROUPS.map((group) => (<DropdownMenuGroup key={group.model} className="flex min-w-0 flex-col">
            <DropdownMenuLabel className={`${MENU_LABEL_CLASS} pl-2`}>{group.label}</DropdownMenuLabel>
            <DropdownMenuItem className={`${MENU_ITEM_CLASS} pl-2`} onClick={() => createBlankShaderGraph(session, group.model)}>
              {group.blank}
            </DropdownMenuItem>
            {GRAPH_TEMPLATES.filter((template) => template.model === group.model).map((template) => (<DropdownMenuItem key={template.id} className={`${MENU_ITEM_CLASS} pl-2`} title={template.description} onClick={() => createShaderGraphFromTemplate(session, template.id)}>
                <span className="truncate">{template.label}</span>
              </DropdownMenuItem>))}
          </DropdownMenuGroup>))}
      </DropdownMenuContent>
    </DropdownMenu>);
}
function LinkButton() {
    const session = useEditorSession();
    const editor = useShaderGraph();
    const { active } = editor;
    if (!active)
        return null;
    const target = editor.link.linkedTarget(active.id);
    const post = active.graph.model === 'post';
    const label = target === null ? (post ? 'Ligar no viewport' : 'Aplicar à seleção') : post ? 'Desligar do viewport' : `Remover de ${target}`;
    const hint = post
        ? 'Roda o efeito na cadeia de pós-processamento do viewport da cena, ao vivo'
        : 'Põe o shader no material do ator selecionado na cena, ao vivo';
    return (<button type="button" title={hint} aria-pressed={target !== null} onClick={() => toggleShaderGraphLink(session)} className={cn(TOOLBAR_CHIP_CLASS, target !== null && 'text-primary hover:text-primary')}>
      {target === null ? <Zap className="size-3" aria-hidden/> : <Unplug className="size-3" aria-hidden/>}
      <span className="max-w-40 truncate font-sans text-2xs">{label}</span>
    </button>);
}
export function GraphToolbar() {
    const session = useEditorSession();
    const editor = useShaderGraph();
    const { active } = editor;
    if (!active)
        return null;
    return (<PanelToolbar className="bg-surface">
      <GraphPicker />
      <NewGraphMenu />
      <ToolbarSeparator />
      <FieldInput key={`${active.id}-${active.name}`} defaultValue={active.name} aria-label="Nome do grafo" className="max-w-48 flex-none" onBlur={(event) => editor.rename(event.currentTarget.value)} onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229)
                event.currentTarget.blur();
        }}/>
      <span className="shrink-0 text-3xs tracking-wider text-muted-foreground uppercase">{SHADER_MODEL_LABEL[active.graph.model]}</span>
      <div className="flex-1"/>
      <LinkButton />
      <button type="button" title="Cria ou atualiza um shader GLSL na biblioteca de ativos, para usar nos scripts do jogo" onClick={() => void exportShaderGraphScript(session)} className={TOOLBAR_CHIP_CLASS}>
        <FileOutput className="size-3" aria-hidden/>
        <span className="font-sans text-2xs">Exportar GLSL</span>
      </button>
    </PanelToolbar>);
}
