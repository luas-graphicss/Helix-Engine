'use client';
import { EffectPreviewView } from './effect-preview-view';
import { EffectInspector } from './inspector/effect-inspector';
export function EffectSidePanel() {
    return (<aside aria-label="Pré-visualização e propriedades do efeito" className="flex w-72 shrink-0 flex-col border-l border-border bg-surface">
      <EffectPreviewView />
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
        <EffectInspector />
      </div>
    </aside>);
}
