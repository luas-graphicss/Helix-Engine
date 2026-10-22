'use client';
import { useEffect, useRef, type DragEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
export interface TileRename {
    onCommit: (name: string) => void;
    onCancel: () => void;
}
type AssetTileProps = {
    name: string;
    caption: string;
    tint: string;
    title: string;
    badge?: string;
    selected?: boolean;
    draggable?: boolean;
    onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
    onClick?: (event: MouseEvent<HTMLDivElement>) => void;
    onDoubleClick?: () => void;
    onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
    rename?: TileRename | null;
    children: ReactNode;
};
function RenameInput({ initial, rename }: {
    initial: string;
    rename: TileRename;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const committed = useRef(false);
    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);
    const commit = () => {
        if (committed.current)
            return;
        committed.current = true;
        rename.onCommit(inputRef.current?.value ?? initial);
    };
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        event.stopPropagation();
        if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229)
            commit();
        else if (event.key === 'Escape') {
            committed.current = true;
            rename.onCancel();
        }
    };
    return (<input ref={inputRef} defaultValue={initial} aria-label="Novo nome do ativo" onKeyDown={onKeyDown} onBlur={commit} onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} className="h-4 w-full rounded-[1px] border border-primary/70 bg-input px-1 text-2xs text-foreground outline-none"/>);
}
export function AssetTile({ name, caption, tint, title, badge, selected = false, draggable = false, onDragStart, onClick, onDoubleClick, onContextMenu, rename, children }: AssetTileProps) {
    return (<div role="option" aria-selected={selected} aria-label={name} tabIndex={0} title={title} draggable={draggable} onDragStart={onDragStart} onClick={onClick} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu} data-asset-tile className={cn('group flex w-[88px] cursor-default flex-col gap-1 rounded-sm p-1 text-left transition-colors outline-none', selected ? 'bg-primary/15 ring-1 ring-primary/60 ring-inset' : 'hover:bg-highlight', 'focus-visible:ring-1 focus-visible:ring-primary', draggable && 'cursor-grab active:cursor-grabbing')}>
      <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-sm border border-border bg-surface-sunken">
        {children}
        {badge && (<span className="absolute top-1 right-1 rounded-[2px] bg-background/80 px-1 font-mono text-[9px] leading-3 tracking-wider text-muted-foreground uppercase">{badge}</span>)}
        <span aria-hidden className={cn('absolute inset-x-0 bottom-0 h-[3px]', tint)}/>
      </span>
      {rename ? <RenameInput initial={name} rename={rename}/> : <span className="w-full truncate text-2xs text-foreground">{name}</span>}
      <span className="w-full truncate text-[10px] text-muted-foreground">{caption}</span>
    </div>);
}
