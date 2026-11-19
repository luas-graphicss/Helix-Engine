'use client';
import { Plus, Workflow } from 'lucide-react';
import { createBlankShaderGraph, createShaderGraphFromTemplate } from '@/engine/editor/operations/shader-graph-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { SHADER_MODELS, type ShaderModel } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
import { GRAPH_TEMPLATES } from '@/engine/shader-graph/templates/template-catalog';
import { ActionButton } from '@/engine/ui/action-button';
import { FOCUS_RING_CLASS, GHOST_ACTION_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
const MODEL_HEADING: Record<ShaderModel, string> = { surface: 'Materiais de superfície', post: 'Efeitos de pós-processamento' };
const BLANK_LABEL: Record<ShaderModel, string> = { surface: 'Superfície em branco', post: 'Efeito de tela em branco' };
const GALLERY_ORDER: readonly ShaderModel[] = SHADER_MODELS.toReversed();
export function GraphEmptyState() {
    const session = useEditorSession();
    return (<div className="@container/workspace absolute inset-0 overflow-y-auto bg-surface-sunken">
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-8">
        <header className="flex flex-col gap-1.5">
          <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Workflow className="size-4 text-primary" aria-hidden/>
            Shader Graph
          </h2>
          <p className="max-w-xl text-2xs leading-relaxed text-pretty text-muted-foreground">
            Monte materiais e efeitos de tela ligando nós, sem escrever GLSL. Comece por um modelo pronto e troque as ligações, ou abra um grafo em branco.
          </p>
        </header>
        {GALLERY_ORDER.map((model) => (<section key={model} className="flex flex-col gap-2">
            <h3 className="text-3xs font-medium tracking-wider text-muted-foreground uppercase">{MODEL_HEADING[model]}</h3>
            <ul className="grid grid-cols-1 gap-1.5 @lg/workspace:grid-cols-2 @3xl/workspace:grid-cols-3">
              {GRAPH_TEMPLATES.filter((template) => template.model === model).map((template) => (<li key={template.id}>
                  <button type="button" onClick={() => createShaderGraphFromTemplate(session, template.id)} className={cn('flex h-full w-full flex-col gap-0.5 p-2.5 text-left', GHOST_ACTION_CLASS, FOCUS_RING_CLASS)}>
                    <span className="text-2xs font-medium text-foreground">{template.label}</span>
                    <span className="text-3xs leading-relaxed text-pretty text-muted-foreground">{template.description}</span>
                  </button>
                </li>))}
            </ul>
            <div className="flex">
              <ActionButton icon={Plus} className="flex-none" onClick={() => createBlankShaderGraph(session, model)}>
                {BLANK_LABEL[model]}
              </ActionButton>
            </div>
          </section>))}
      </div>
    </div>);
}
