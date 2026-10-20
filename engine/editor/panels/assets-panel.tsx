'use client';
import { useState } from 'react';
import { Box, Image, Paintbrush, Shapes, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SearchField } from '@/engine/ui/search-field';
import { ToolbarSeparator } from '@/engine/ui/toolbar-separator';
import { TextureThumbnail } from '@/engine/ui/texture-thumbnail';
import { cn } from '@/lib/utils';
import { linearRgbToCss } from '@/engine/core/color/srgb';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { PRIMITIVES } from '@/engine/editor/primitives/primitive-catalog';
import { PRIMITIVE_ICON } from '@/engine/editor/menus/add-entity-model';
import { addMeshInstance, addPrimitive } from '@/engine/editor/operations/entity-operations';
import { getTriangleCount } from '@/engine/renderer/geometry/mesh-data';
type Category = 'primitives' | 'mesh' | 'texture' | 'material';
const CATEGORIES: ReadonlyArray<{
    id: Category;
    label: string;
    icon: LucideIcon;
    tint: string;
}> = [
    { id: 'primitives', label: 'Primitivas', icon: Shapes, tint: 'bg-primary' },
    { id: 'mesh', label: 'Malhas', icon: Box, tint: 'bg-axis-z' },
    { id: 'texture', label: 'Texturas', icon: Image, tint: 'bg-axis-x' },
    { id: 'material', label: 'Materiais', icon: Paintbrush, tint: 'bg-axis-y' },
];
type TileProps = {
    name: string;
    caption: string;
    tint: string;
    title: string;
    onActivate?: () => void;
    children: React.ReactNode;
};
function AssetTile({ name, caption, tint, title, onActivate, children }: TileProps) {
    return (<button type="button" title={title} onClick={onActivate} onDoubleClick={onActivate} className="group flex w-[88px] flex-col gap-1 rounded-sm p-1 text-left transition-colors hover:bg-highlight focus-visible:outline-1 focus-visible:outline-primary">
      <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-sm border border-border bg-surface-sunken">
        {children}
        <span aria-hidden className={cn('absolute inset-x-0 bottom-0 h-[3px]', tint)}/>
      </span>
      <span className="w-full truncate text-2xs text-foreground">{name}</span>
      <span className="w-full truncate text-[10px] text-muted-foreground">{caption}</span>
    </button>);
}
export function AssetsPanel() {
    const session = useEditorState();
    const [category, setCategory] = useState<Category>('primitives');
    const [query, setQuery] = useState('');
    const normalizedQuery = query.trim().toLowerCase();
    const matches = (name: string) => normalizedQuery === '' || name.toLowerCase().includes(normalizedQuery);
    const counts: Record<Category, number> = {
        primitives: PRIMITIVES.length,
        mesh: session.assets.byKind('mesh').length,
        texture: session.assets.byKind('texture').length,
        material: session.assets.byKind('material').length,
    };
    const activeCategory = CATEGORIES.find((item) => item.id === category) ?? CATEGORIES[0];
    const tiles = (() => {
        switch (category) {
            case 'primitives':
                return PRIMITIVES.filter((primitive) => matches(primitive.label)).map((primitive) => {
                    const Icon = PRIMITIVE_ICON[primitive.kind];
                    return (<AssetTile key={primitive.kind} name={primitive.label} caption={primitive.description} tint={activeCategory.tint} title={`Adicionar ${primitive.label} à cena`} onActivate={() => addPrimitive(session, primitive.kind)}>
              <Icon className="size-7 text-muted-foreground transition-colors group-hover:text-foreground" strokeWidth={1.5} aria-hidden/>
            </AssetTile>);
                });
            case 'mesh':
                return session.assets
                    .byKind('mesh')
                    .filter((asset) => matches(asset.name))
                    .map((asset) => (<AssetTile key={asset.id} name={asset.name} caption={`${getTriangleCount(asset.mesh).toLocaleString('pt-BR')} tris`} tint={activeCategory.tint} title={`Instanciar ${asset.name} (de ${asset.source})`} onActivate={() => addMeshInstance(session, asset.name, asset.mesh, asset.material)}>
              <Box className="size-7 text-muted-foreground transition-colors group-hover:text-foreground" strokeWidth={1.5} aria-hidden/>
            </AssetTile>));
            case 'texture':
                return session.assets
                    .byKind('texture')
                    .filter((asset) => matches(asset.name))
                    .map((asset) => (<AssetTile key={asset.id} name={asset.name} caption={`${asset.texture.width}×${asset.texture.height} · ${asset.texture.colorSpace}`} tint={activeCategory.tint} title={asset.texture.sourcePath || asset.source}>
              <TextureThumbnail texture={asset.texture}/>
            </AssetTile>));
            case 'material':
                return session.assets
                    .byKind('material')
                    .filter((asset) => matches(asset.name))
                    .map((asset) => (<AssetTile key={asset.id} name={asset.name} caption={`de ${asset.source}`} tint={activeCategory.tint} title={asset.name}>
              <span className="size-8 rounded-full border border-border-strong" style={{ backgroundColor: linearRgbToCss(asset.material.baseColor) }}/>
            </AssetTile>));
        }
    })();
    return (<div className="flex h-full">
      <aside className="flex w-44 shrink-0 flex-col border-r border-border">
        <div className="flex h-8 shrink-0 items-center border-b border-border px-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          Biblioteca
        </div>
        <div className="flex-1 overflow-auto py-1">
          {CATEGORIES.map((item) => {
            const Icon = item.icon;
            const active = item.id === category;
            return (<button key={item.id} type="button" onClick={() => setCategory(item.id)} className={cn('flex h-6 w-full items-center gap-1.5 pr-2 pl-2 text-left text-2xs transition-colors', active ? 'bg-primary/15 text-foreground' : 'text-foreground/90 hover:bg-highlight')}>
                <Icon className={cn('size-3.5', active ? 'text-primary' : 'text-muted-foreground')} aria-hidden/>
                <span className="truncate">{item.label}</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">{counts[item.id]}</span>
              </button>);
        })}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border px-2">
          <nav aria-label="Caminho" className="flex items-center gap-0.5 font-mono text-2xs text-muted-foreground">
            <span>Biblioteca</span>
            <ChevronRight className="size-3" aria-hidden/>
            <span className="text-foreground">{activeCategory.label}</span>
          </nav>
          <ToolbarSeparator />
          <SearchField placeholder="Buscar ativos" value={query} onChange={setQuery} className="max-w-64"/>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">{tiles.length} itens</span>
        </div>
        {tiles.length > 0 ? (<div className="flex flex-1 flex-wrap content-start gap-1 overflow-auto p-2">{tiles}</div>) : (<div className="flex flex-1 items-center justify-center p-6 text-center text-2xs text-muted-foreground">
            {normalizedQuery ? 'Nenhum ativo corresponde ao filtro.' : 'Nenhum ativo importado nesta categoria ainda.'}
          </div>)}
      </div>
    </div>);
}
