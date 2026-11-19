'use client';
import { Flame, Plus } from 'lucide-react';
import { createBlankEffectGraph, createEffectGraphFromTemplate } from '@/engine/editor/operations/vfx-graph-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { EFFECT_TEMPLATE_CATEGORIES, EFFECT_TEMPLATE_CATEGORY_LABEL, EFFECT_TEMPLATES } from '@/engine/vfx-graph/templates/template-catalog';
import { ActionButton } from '@/engine/ui/action-button';
import { FOCUS_RING_CLASS, GHOST_ACTION_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
export function EffectEmptyState() {
    const session = useEditorSession();
    return (<div className="@container/workspace absolute inset-0 overflow-y-auto bg-surface-sunken">
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-8">
        <header className="flex flex-col gap-1.5">
          <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Flame className="size-4 text-primary" aria-hidden/>
            Visual Effect Graph
          </h2>
          <p className="max-w-xl text-2xs leading-relaxed text-pretty text-muted-foreground">
            Efeitos de partículas simulados na GPU, montados com blocos em quatro etapas: emissão, inicialização, atualização e saída. Comece por um modelo pronto ou abra um efeito em branco.
          </p>
          <div className="flex pt-1">
            <ActionButton icon={Plus} className="flex-none" onClick={() => createBlankEffectGraph(session)}>
              Efeito em branco
            </ActionButton>
          </div>
        </header>
        {EFFECT_TEMPLATE_CATEGORIES.map((category) => (<section key={category} className="flex flex-col gap-2">
            <h3 className="text-3xs font-medium tracking-wider text-muted-foreground uppercase">{EFFECT_TEMPLATE_CATEGORY_LABEL[category]}</h3>
            <ul className="grid grid-cols-1 gap-1.5 @lg/workspace:grid-cols-2 @3xl/workspace:grid-cols-3">
              {EFFECT_TEMPLATES.filter((template) => template.category === category).map((template) => (<li key={template.id}>
                  <button type="button" onClick={() => createEffectGraphFromTemplate(session, template.id)} className={cn('flex h-full w-full flex-col gap-0.5 p-2.5 text-left', GHOST_ACTION_CLASS, FOCUS_RING_CLASS)}>
                    <span className="text-2xs font-medium text-foreground">{template.label}</span>
                    <span className="text-3xs leading-relaxed text-pretty text-muted-foreground">{template.description}</span>
                  </button>
                </li>))}
            </ul>
          </section>))}
      </div>
    </div>);
}
