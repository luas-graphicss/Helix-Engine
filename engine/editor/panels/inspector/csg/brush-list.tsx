'use client';
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { IconButton } from '@/engine/ui/icon-button';
import type { Entity } from '@/engine/core/scene/entity';
import { getTriangleCount } from '@/engine/renderer/geometry/mesh-data';
import { CSG_OPERATION_LABEL } from '@/engine/geometry/csg/csg-settings';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { cycleBrushOperation, moveBrush, setBrushEnabled } from '@/engine/editor/operations/csg-operations';
import { cn } from '@/lib/utils';
import { CSG_OPERATION_BADGE } from './csg-icons';
type BrushRowProps = {
    brush: Entity;
    index: number;
    count: number;
};
function BrushRow({ brush, index, count }: BrushRowProps) {
    const session = useEditorState();
    const settings = brush.csgBrush;
    if (!settings)
        return null;
    const badge = CSG_OPERATION_BADGE[settings.operation];
    const muted = !settings.enabled || !brush.visible;
    const selected = session.isSelected(brush);
    return (<div className={cn('group/brush flex h-6 items-center gap-1 pr-1 pl-2', selected && 'bg-primary/10', muted && 'opacity-60')}>
      <button type="button" onClick={() => cycleBrushOperation(session, brush)} title={`${CSG_OPERATION_LABEL[settings.operation]} · clique para alternar a operação`} aria-label={`Operação: ${CSG_OPERATION_LABEL[settings.operation]}. Alternar`} className={cn('flex size-4 shrink-0 items-center justify-center rounded-xs font-mono text-[10px] font-semibold transition-opacity hover:opacity-80', badge.className)}>
        {badge.sign}
      </button>
      <button type="button" onClick={() => session.select(brush)} className="min-w-0 flex-1 truncate text-left text-2xs text-foreground hover:underline" title={`Selecionar ${brush.name}`}>
        {brush.name}
      </button>
      {brush.mesh && <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{getTriangleCount(brush.mesh).toLocaleString('pt-BR')}</span>}
      <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/brush:opacity-100 focus-within:opacity-100">
        <IconButton label="Mover antes" size="sm" className="size-5 [&_svg]:size-3" disabled={index === 0} onClick={() => moveBrush(session, brush, -1)}>
          <ChevronUp />
        </IconButton>
        <IconButton label="Mover depois" size="sm" className="size-5 [&_svg]:size-3" disabled={index === count - 1} onClick={() => moveBrush(session, brush, 1)}>
          <ChevronDown />
        </IconButton>
      </span>
      <IconButton label={settings.enabled ? 'Desativar pincel' : 'Ativar pincel'} size="sm" className="size-5 [&_svg]:size-3" onClick={() => setBrushEnabled(session, brush, !settings.enabled)}>
        {settings.enabled ? <Eye /> : <EyeOff />}
      </IconButton>
    </div>);
}
export function BrushList({ brushes }: {
    brushes: readonly Entity[];
}) {
    return (<>
      <div className="flex items-center justify-between px-2 pt-2 pb-0.5">
        <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          Pincéis{brushes.length > 0 ? ` · ${brushes.length}` : ''}
        </span>
        {brushes.length > 1 && <span className="text-[10px] text-muted-foreground">aplicados de cima para baixo</span>}
      </div>
      {brushes.length === 0 ? (<p className="px-2 pb-1 text-[10px] leading-relaxed text-pretty text-muted-foreground">
          Sem pincéis: a malha é a original. Adicione uma forma abaixo ou arraste atores de malha para dentro deste ator na hierarquia.
        </p>) : (brushes.map((brush, index) => <BrushRow key={brush.id} brush={brush} index={index} count={brushes.length}/>))}
    </>);
}
