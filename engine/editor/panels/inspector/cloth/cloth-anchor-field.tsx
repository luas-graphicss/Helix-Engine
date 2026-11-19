'use client';
import type { ClothAnchor } from '@/engine/cloth/cloth-settings';
import { FOCUS_RING_CLASS, WELL_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
const ANCHOR_LABEL: Record<ClothAnchor, string> = {
    none: 'Solto',
    top: 'Borda de cima',
    bottom: 'Borda de baixo',
    left: 'Borda esquerda',
    right: 'Borda direita',
    corners: 'Quatro cantos',
};
const ANCHOR_GRID: readonly ClothAnchor[] = ['corners', 'top', 'corners', 'left', 'none', 'right', 'corners', 'bottom', 'corners'];
const ANCHOR_CELLS = ANCHOR_GRID.map((anchor, index) => ({ anchor, repeated: ANCHOR_GRID.indexOf(anchor) !== index }));
export function ClothAnchorField({ anchor, onChange }: {
    anchor: ClothAnchor;
    onChange: (anchor: ClothAnchor) => void;
}) {
    return (<div className="flex min-w-0 flex-1 items-center gap-2 py-1">
      <div role="radiogroup" aria-label="Fixação do tecido" className={cn('grid size-12 shrink-0 grid-cols-3 gap-px rounded-sm p-px', WELL_CLASS)}>
        {ANCHOR_CELLS.map((cell, index) => {
            const selected = cell.anchor === anchor;
            const className = cn('rounded-xs transition-colors duration-100', FOCUS_RING_CLASS, selected ? 'bg-primary' : 'bg-surface hover:bg-highlight');
            if (cell.repeated)
                return <button key={index} type="button" aria-hidden tabIndex={-1} onClick={() => onChange(cell.anchor)} className={className}/>;
            return <button key={index} type="button" role="radio" aria-checked={selected} aria-label={ANCHOR_LABEL[cell.anchor]} title={ANCHOR_LABEL[cell.anchor]} onClick={() => onChange(cell.anchor)} className={className}/>;
        })}
      </div>
      <span className="min-w-0 truncate text-2xs text-foreground/80">{ANCHOR_LABEL[anchor]}</span>
    </div>);
}
