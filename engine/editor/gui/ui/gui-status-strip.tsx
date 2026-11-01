'use client';
import { Magnet, Spline } from 'lucide-react';
import { GUI_ELEMENT_LABELS } from '@/engine/gui/document/gui-document';
import { countGuiNodes } from '@/engine/gui/document/gui-tree';
import { cn } from '@/lib/utils';
import { selectionBounds } from '../gui-selection';
import { formatLogicalScreen, formatPhysicalPixels, screenTitle, screenTraits } from './device/gui-device-format';
import { formatZoom } from './gui-view-menus';
import { useGuiDesigner } from './use-gui-designer';
function plural(count: number, singular: string, pluralForm: string): string {
    return `${count} ${count === 1 ? singular : pluralForm}`;
}
function px(value: number): string {
    return String(Math.round(value));
}
export function GuiStatusStrip() {
    const designer = useGuiDesigner();
    const { document, options, screen } = designer;
    const layout = designer.layout();
    if (!document || !layout)
        return null;
    const bounds = selectionBounds(layout, designer.selectedIds);
    const scale = layout.offsetScale || 1;
    const primary = designer.primaryNode;
    const count = designer.selectedIds.size;
    return (<footer className="flex min-h-6 shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-border bg-surface px-2 py-0.5 font-mono text-3xs text-muted-foreground">
      <span className="shrink-0 whitespace-nowrap">{plural(countGuiNodes(document.root), 'elemento', 'elementos')}</span>
      {count > 0 && primary && (<span className="min-w-0 max-w-64 truncate text-foreground" title={count === 1 ? primary.name : undefined}>
          {count === 1 ? `${GUI_ELEMENT_LABELS[primary.kind]} · ${primary.name}` : plural(count, 'selecionado', 'selecionados')}
        </span>)}
      {bounds && (<span className="shrink-0 tabular-nums whitespace-nowrap">
          X {px(bounds.x / scale)} · Y {px(bounds.y / scale)} · {px(bounds.width / scale)} × {px(bounds.height / scale)} px
        </span>)}
      <span className="ml-auto flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5">
        <button type="button" title="Guias inteligentes" aria-pressed={options.snapGuides} onClick={() => designer.toggleOption('snapGuides')} className={cn('flex shrink-0 items-center gap-1 whitespace-nowrap transition-colors hover:text-foreground', options.snapGuides && 'text-primary')}>
          <Spline className="size-3 shrink-0" aria-hidden/>
          guias
        </button>
        <button type="button" title="Encaixar na grade" aria-pressed={options.snapGrid} onClick={() => designer.toggleOption('snapGrid')} className={cn('flex shrink-0 items-center gap-1 whitespace-nowrap transition-colors hover:text-foreground', options.snapGrid && 'text-primary')}>
          <Magnet className="size-3 shrink-0" aria-hidden/>
          grade {options.gridSize}
        </button>
        <span className="shrink-0 tabular-nums text-foreground">{formatZoom(designer.view.zoom)}</span>
        {!designer.followsReference && (<span className="hidden shrink-0 tabular-nums whitespace-nowrap @3xl/workspace:inline" title={`${screenTitle(screen)} · ${screenTraits(screen)}`}>
            {formatLogicalScreen(screen)} → {formatPhysicalPixels(screen)}
          </span>)}
        <span className="shrink-0 tabular-nums whitespace-nowrap">
          {document.referenceSize.x} × {document.referenceSize.y} ref · escala {document.scaleMode === 'none' ? 'fixa' : document.scaleMode}
        </span>
      </span>
    </footer>);
}
