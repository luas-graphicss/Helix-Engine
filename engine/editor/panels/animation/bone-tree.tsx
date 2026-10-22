'use client';
import type { RefObject, UIEvent } from 'react';
import { ChevronDown, ChevronRight, ListFilter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from '@/engine/ui/icon-button';
import { SearchField } from '@/engine/ui/search-field';
import { INTERPOLATION_LABELS } from '@/engine/core/animation/track-editing';
import type { AnimationEditor } from '@/engine/editor/animation/animation-editor';
import { PATH_LABELS, ROW_HEIGHT, RULER_HEIGHT, type TimelineRow } from '@/engine/editor/animation/ui/timeline-model';
type BoneTreeProps = {
    editor: AnimationEditor;
    rows: readonly TimelineRow[];
    scrollRef: RefObject<HTMLDivElement | null>;
    onScroll: (event: UIEvent<HTMLDivElement>) => void;
};
const INDENT_PX = 12;
export function BoneTree({ editor, rows, scrollRef, onScroll }: BoneTreeProps) {
    return (<div className="flex h-full w-full flex-col border-r border-border bg-surface">
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-1" style={{ height: RULER_HEIGHT }}>
        <SearchField placeholder="Filtrar ossos" value={editor.boneFilter} onChange={(value) => editor.setBoneFilter(value)} className="h-[18px]"/>
        <IconButton label={editor.onlyAnimated ? 'Mostrar todos os ossos' : 'Só ossos animados'} size="sm" active={editor.onlyAnimated} onClick={() => editor.setOnlyAnimated(!editor.onlyAnimated)}>
          <ListFilter />
        </IconButton>
      </div>
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-width:thin]" onMouseLeave={() => editor.setHoveredBone(null)}>
        {rows.length === 0 ? (<p className="px-2 py-2 text-[10px] leading-relaxed text-pretty text-muted-foreground">
            {editor.boneFilter ? 'Nenhum osso com esse nome.' : editor.onlyAnimated ? 'Nenhum osso tem chaves ainda. Pose o personagem no viewport para gravar as primeiras.' : 'O ator não tem esqueleto.'}
          </p>) : (rows.map((row) => (row.kind === 'bone' ? <BoneRowView key={row.id} editor={editor} row={row}/> : <TrackRowView key={row.id} row={row}/>)))}
      </div>
    </div>);
}
function BoneRowView({ editor, row }: {
    editor: AnimationEditor;
    row: Extract<TimelineRow, {
        kind: 'bone';
    }>;
}) {
    const hovered = editor.hoveredBone === row.name;
    return (<div role="button" tabIndex={-1} aria-pressed={row.selected} title={row.name} onClick={(event) => editor.selectBone(row.name, event.ctrlKey || event.metaKey ? 'toggle' : 'replace')} onDoubleClick={() => editor.focusBone(row.name)} onMouseEnter={() => editor.setHoveredBone(row.name)} className={cn('flex w-full min-w-0 cursor-default items-center gap-1 border-b border-border-strong/60 pr-2 text-2xs select-none', row.selected ? 'bg-primary/15 text-primary' : hovered ? 'bg-highlight text-foreground' : 'text-foreground/85')} style={{ height: ROW_HEIGHT, paddingLeft: 4 + row.depth * INDENT_PX }}>
      {row.hasChildren ? (<button type="button" aria-label={row.collapsed ? `Expandir ${row.name}` : `Recolher ${row.name}`} aria-expanded={!row.collapsed} onClick={(event) => {
                event.stopPropagation();
                editor.toggleCollapsed(row.name);
            }} className="flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-highlight hover:text-foreground">
          {row.collapsed ? <ChevronRight className="size-3" aria-hidden/> : <ChevronDown className="size-3" aria-hidden/>}
        </button>) : (<span className="size-4 shrink-0" aria-hidden/>)}
      <span className="min-w-0 flex-1 truncate">{row.name}</span>
      {row.animated && <span aria-label="Osso animado" className={cn('size-1.5 shrink-0 rounded-full', row.selected ? 'bg-primary' : 'bg-muted-foreground/70')}/>}
    </div>);
}
function TrackRowView({ row }: {
    row: Extract<TimelineRow, {
        kind: 'track';
    }>;
}) {
    return (<div className="flex w-full min-w-0 items-center gap-1 border-b border-border-strong/60 pr-2 text-[10px] text-muted-foreground select-none" style={{ height: ROW_HEIGHT, paddingLeft: 8 + row.depth * INDENT_PX }} title={`${PATH_LABELS[row.path]} · ${INTERPOLATION_LABELS[row.interpolation]}`}>
      <span className="min-w-0 flex-1 truncate">{PATH_LABELS[row.path]}</span>
      <span className="shrink-0 font-mono text-[9px] text-muted-foreground/70">{INTERPOLATION_LABELS[row.interpolation]}</span>
    </div>);
}
