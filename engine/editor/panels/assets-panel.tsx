'use client';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Box, ChevronRight, FolderPlus, LoaderCircle, Plus, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ASSET_KINDS, LIBRARY_FORMAT_SUMMARY } from '@/engine/assets/library/asset-kinds';
import type { AssetKind, LibraryAsset } from '@/engine/assets/library/asset-types';
import { formatBytes } from '@/engine/editor/import/dialog/import-format';
import { materialCaption, MaterialSwatch } from '@/engine/editor/materials/material-swatch';
import { openMaterialEditor } from '@/engine/editor/materials/material-editor-requests';
import { PRIMITIVE_ICON } from '@/engine/editor/menus/add-entity-model';
import { activateLibraryAsset, addFilesToLibrary, pickFilesForLibrary, removeLibraryAsset, renameLibraryAsset } from '@/engine/editor/operations/asset-library-operations';
import { addMeshInstance, addPrimitive } from '@/engine/editor/operations/entity-operations';
import { applyLibraryMaterialToEntity, describeApplyTarget, materialTargetKind } from '@/engine/editor/operations/material-library-operations';
import { PRIMITIVES } from '@/engine/editor/primitives/primitive-catalog';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { useFileDrop } from '@/engine/editor/viewport/use-file-drop';
import type { MaterialDocument } from '@/engine/materials/material-document';
import { getTriangleCount } from '@/engine/renderer/geometry/mesh-data';
import { SearchField } from '@/engine/ui/search-field';
import { SelectField } from '@/engine/ui/select-field';
import { TextureThumbnail } from '@/engine/ui/texture-thumbnail';
import { ToolbarSeparator } from '@/engine/ui/toolbar-separator';
import { findCategory, isLibraryCategory, LIBRARY_CATEGORIES, SCENE_CATEGORIES, type AssetCategory, type AssetCategoryId } from './assets/asset-categories';
import { AssetDetailsPane } from './assets/asset-details-pane';
import { AssetTile } from './assets/asset-tile';
import { LibraryAssetTile } from './assets/library-asset-tile';
type SortMode = 'recent' | 'name' | 'size' | 'kind';
const SORT_OPTIONS: ReadonlyArray<{
    value: SortMode;
    label: string;
}> = [
    { value: 'recent', label: 'Recentes' },
    { value: 'name', label: 'Nome' },
    { value: 'size', label: 'Tamanho' },
    { value: 'kind', label: 'Tipo' },
];
const KIND_ORDER: Record<LibraryAsset['kind'], number> = { model: 0, animation: 1, texture: 2, audio: 3 };
function sortAssets(assets: LibraryAsset[], mode: SortMode): LibraryAsset[] {
    const byName = (a: LibraryAsset, b: LibraryAsset) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
    switch (mode) {
        case 'recent':
            return assets.sort((a, b) => b.createdAt - a.createdAt);
        case 'name':
            return assets.sort(byName);
        case 'size':
            return assets.sort((a, b) => b.size - a.size);
        case 'kind':
            return assets.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || byName(a, b));
    }
}
function matchesQuery(asset: LibraryAsset, query: string): boolean {
    return asset.name.toLowerCase().includes(query) || asset.format.includes(query) || asset.tags.some((tag) => tag.includes(query));
}
function CategoryButton({ category, count, active, onSelect }: {
    category: AssetCategory;
    count: number;
    active: boolean;
    onSelect: () => void;
}) {
    const Icon = category.icon;
    return (<button type="button" onClick={onSelect} aria-pressed={active} className={cn('flex h-6 w-full items-center gap-1.5 pr-2 pl-2 text-left text-2xs transition-colors', active ? 'bg-primary/15 text-foreground' : 'text-foreground/90 hover:bg-highlight')}>
      <Icon className={cn('size-3.5', active ? 'text-primary' : 'text-muted-foreground')} aria-hidden/>
      <span className="truncate">{category.label}</span>
      <span className="ml-auto font-mono text-[10px] text-muted-foreground">{count}</span>
    </button>);
}
function SidebarHeading({ children }: {
    children: ReactNode;
}) {
    return <div className="px-2 pt-2 pb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{children}</div>;
}
function EmptyState({ icon: Icon, title, hint }: {
    icon: typeof Box;
    title: string;
    hint?: string;
}) {
    return (<div className="flex flex-1 flex-col items-center justify-center gap-1.5 p-6 text-center">
      <Icon className="size-6 text-muted-foreground/60" strokeWidth={1.5} aria-hidden/>
      <p className="text-2xs text-foreground/80">{title}</p>
      {hint && <p className="max-w-xs text-[10px] leading-4 text-muted-foreground">{hint}</p>}
    </div>);
}
export function AssetsPanel() {
    const session = useEditorState();
    const { library, materials, resources } = session;
    const [category, setCategory] = useState<AssetCategoryId>('all');
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<SortMode>('recent');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const drop = useFileDrop((files) => void addFilesToLibrary(session, files));
    const normalizedQuery = query.trim().toLowerCase();
    const matches = (name: string) => normalizedQuery === '' || name.toLowerCase().includes(normalizedQuery);
    const activeCategory = findCategory(category);
    const inLibrary = isLibraryCategory(category);
    const selectedAsset = selectedId ? library.get(selectedId) : null;
    const counts: Record<AssetCategoryId, number> = {
        all: library.size,
        model: library.byKind('model').length,
        animation: library.byKind('animation').length,
        texture: library.byKind('texture').length,
        audio: library.byKind('audio').length,
        material: materials.size,
        primitives: PRIMITIVES.length,
        'scene-mesh': resources.byKind('mesh').length,
        'scene-texture': resources.byKind('texture').length,
    };
    const fileAssetCategory = category === 'all' || ASSET_KINDS.some((info) => info.kind === category);
    const visibleAssets = fileAssetCategory
        ? sortAssets((category === 'all' ? library.all : library.byKind(category as AssetKind)).filter((asset) => normalizedQuery === '' || matchesQuery(asset, normalizedQuery)), sort)
        : [];
    const target = session.selectedEntity;
    const applyTargetLabel = materialTargetKind(target) ? describeApplyTarget(target) : null;
    const activateLibraryMaterial = (document: MaterialDocument) => {
        if (target && materialTargetKind(target))
            applyLibraryMaterialToEntity(session, target, document);
        else
            openMaterialEditor({ materialId: document.id });
    };
    const selectCategory = (next: AssetCategoryId) => {
        setCategory(next);
        setRenamingId(null);
        if (!isLibraryCategory(next))
            setSelectedId(null);
    };
    const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (renamingId || !inLibrary)
            return;
        const index = visibleAssets.findIndex((asset) => asset.id === selectedId);
        const focusTile = (position: number) => {
            const next = visibleAssets[position];
            if (!next)
                return;
            setSelectedId(next.id);
            event.currentTarget.querySelectorAll<HTMLElement>('[data-asset-tile]')[position]?.focus();
        };
        switch (event.key) {
            case 'Delete':
            case 'Backspace':
                if (!selectedAsset)
                    return;
                void removeLibraryAsset(session, selectedAsset);
                break;
            case 'F2':
                if (!selectedAsset)
                    return;
                setRenamingId(selectedAsset.id);
                break;
            case 'Enter':
                if (!selectedAsset)
                    return;
                void activateLibraryAsset(session, selectedAsset);
                break;
            case 'Escape':
                if (!selectedId)
                    return;
                setSelectedId(null);
                break;
            case 'ArrowRight':
                focusTile(index < 0 ? 0 : Math.min(index + 1, visibleAssets.length - 1));
                break;
            case 'ArrowLeft':
                focusTile(index < 0 ? 0 : Math.max(index - 1, 0));
                break;
            default:
                return;
        }
        event.preventDefault();
        event.stopPropagation();
    };
    const tiles = (() => {
        switch (category) {
            case 'all':
            case 'model':
            case 'animation':
            case 'texture':
            case 'audio':
                return visibleAssets.map((asset) => (<LibraryAssetTile key={asset.id} asset={asset} selected={asset.id === selectedId} rename={renamingId === asset.id
                        ? {
                            onCommit: (name) => {
                                renameLibraryAsset(session, asset, name);
                                setRenamingId(null);
                            },
                            onCancel: () => setRenamingId(null),
                        }
                        : null} onSelect={() => setSelectedId(asset.id)} onRenameRequest={() => {
                        setSelectedId(asset.id);
                        setRenamingId(asset.id);
                    }}/>));
            case 'material':
                return materials.all
                    .filter((document) => matches(document.name))
                    .map((document) => (<AssetTile key={document.id} name={document.name} caption={materialCaption(document)} tint={activeCategory.tint} title={applyTargetLabel ? `${applyTargetLabel} (duplo clique abre no editor)` : 'Abrir no editor de materiais'} onClick={() => activateLibraryMaterial(document)} onDoubleClick={() => openMaterialEditor({ materialId: document.id })}>
              <MaterialSwatch document={document} className="size-full rounded-none border-0" resolution={96}/>
            </AssetTile>));
            case 'primitives':
                return PRIMITIVES.filter((primitive) => matches(primitive.label)).map((primitive) => {
                    const Icon = PRIMITIVE_ICON[primitive.kind];
                    return (<AssetTile key={primitive.kind} name={primitive.label} caption={primitive.description} tint={activeCategory.tint} title={`Adicionar ${primitive.label} à cena`} onClick={() => addPrimitive(session, primitive.kind)}>
              <Icon className="size-7 text-muted-foreground transition-colors group-hover:text-foreground" strokeWidth={1.5} aria-hidden/>
            </AssetTile>);
                });
            case 'scene-mesh':
                return resources
                    .byKind('mesh')
                    .filter((resource) => matches(resource.name))
                    .map((resource) => (<AssetTile key={resource.id} name={resource.name} caption={`${getTriangleCount(resource.mesh).toLocaleString('pt-BR')} tris`} tint={activeCategory.tint} title={`Instanciar ${resource.name} (de ${resource.source})`} onClick={() => addMeshInstance(session, resource.name, resource.mesh, resource.material)}>
              <Box className="size-7 text-muted-foreground transition-colors group-hover:text-foreground" strokeWidth={1.5} aria-hidden/>
            </AssetTile>));
            case 'scene-texture':
                return resources
                    .byKind('texture')
                    .filter((resource) => matches(resource.name))
                    .map((resource) => (<AssetTile key={resource.id} name={resource.name} caption={`${resource.texture.width}×${resource.texture.height} · ${resource.texture.colorSpace}`} tint={activeCategory.tint} title={resource.texture.sourcePath || resource.source}>
              <TextureThumbnail texture={resource.texture}/>
            </AssetTile>));
        }
    })();
    const totalBytes = library.all.reduce((total, asset) => total + asset.size, 0);
    const emptyState = (() => {
        if (tiles.length > 0)
            return null;
        if (inLibrary && library.status === 'loading')
            return <EmptyState icon={LoaderCircle} title="Carregando biblioteca…"/>;
        if (normalizedQuery)
            return <EmptyState icon={Box} title="Nenhum ativo corresponde ao filtro."/>;
        if (inLibrary && category !== 'material') {
            return <EmptyState icon={FolderPlus} title="Sua biblioteca está vazia nesta categoria." hint={`Arraste ${LIBRARY_FORMAT_SUMMARY} para cá ou use Adicionar… (Ctrl+B). Os ativos ficam guardados neste navegador e podem ser reutilizados em qualquer cena.`}/>;
        }
        if (category === 'material')
            return <EmptyState icon={activeCategory.icon} title="Nenhum material na biblioteca." hint="Crie um no editor de materiais (M) ou salve o material de um ator pelo menu de contexto."/>;
        return <EmptyState icon={activeCategory.icon} title="Nada nesta categoria ainda." hint="Importe um modelo (Ctrl+I) ou coloque um ativo da biblioteca na cena."/>;
    })();
    return (<div className="flex h-full">
      <aside className="flex w-44 shrink-0 flex-col border-r border-border">
        <div className="flex h-8 shrink-0 items-center border-b border-border px-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Ativos</div>
        <div className="flex-1 overflow-auto pb-1">
          <SidebarHeading>Biblioteca</SidebarHeading>
          {LIBRARY_CATEGORIES.map((item) => (<CategoryButton key={item.id} category={item} count={counts[item.id]} active={item.id === category} onSelect={() => selectCategory(item.id)}/>))}
          <SidebarHeading>Cena</SidebarHeading>
          {SCENE_CATEGORIES.map((item) => (<CategoryButton key={item.id} category={item} count={counts[item.id]} active={item.id === category} onSelect={() => selectCategory(item.id)}/>))}
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col" {...drop.handlers}>
        <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border px-2">
          <nav aria-label="Caminho" className="flex items-center gap-0.5 font-mono text-2xs text-muted-foreground">
            <span>{inLibrary ? 'Biblioteca' : 'Cena'}</span>
            <ChevronRight className="size-3" aria-hidden/>
            <span className="text-foreground">{activeCategory.label}</span>
          </nav>
          <ToolbarSeparator />
          <SearchField placeholder="Buscar por nome, etiqueta ou formato" value={query} onChange={setQuery} className="max-w-64"/>
          {inLibrary && category !== 'material' && (<>
              <div className="w-28 shrink-0">
                <SelectField label="Ordenar por" options={SORT_OPTIONS} value={sort} onChange={setSort}/>
              </div>
              <button type="button" onClick={() => pickFilesForLibrary(session)} title="Adicionar arquivos à biblioteca (Ctrl+B)" className="flex h-6 shrink-0 items-center gap-1 rounded-sm border border-dashed border-border-strong px-2 text-2xs text-foreground transition-colors hover:border-primary/60 hover:bg-highlight focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary">
                <Plus className="size-3.5 text-primary" aria-hidden/>
                Adicionar…
              </button>
            </>)}
          <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
            {tiles.length} {tiles.length === 1 ? 'item' : 'itens'}
          </span>
        </div>

        <div className="flex min-h-0 flex-1">
          <div role="listbox" aria-label={`${activeCategory.label} em ${inLibrary ? 'Biblioteca' : 'Cena'}`} onKeyDown={onGridKeyDown} className="flex min-w-0 flex-1 flex-wrap content-start gap-1 overflow-auto p-2">
            {emptyState ?? tiles}
          </div>
          {selectedAsset && inLibrary && (<AssetDetailsPane asset={selectedAsset} onClose={() => setSelectedId(null)} onRename={() => setRenamingId(selectedAsset.id)}/>)}
        </div>

        <footer className="flex h-6 shrink-0 items-center gap-1.5 border-t border-border px-2 font-mono text-[10px] text-muted-foreground">
          {library.busy ? (<>
              <LoaderCircle className="size-3 shrink-0 animate-spin text-primary" aria-hidden/>
              <span className="truncate text-foreground">{library.busy}</span>
            </>) : library.error ? (<>
              <TriangleAlert className="size-3 shrink-0 text-warning" aria-hidden/>
              <span className="truncate text-warning" title={library.error}>
                {library.error}
              </span>
            </>) : (<span className="truncate">
              {library.size} {library.size === 1 ? 'ativo' : 'ativos'} · {formatBytes(totalBytes)}
            </span>)}
          <span className="ml-auto shrink-0">{library.status === 'unavailable' ? 'Sem persistência' : 'Guardado neste navegador'}</span>
        </footer>

        {drop.active && (<div className="pointer-events-none absolute inset-1 flex items-center justify-center rounded-sm border border-dashed border-primary bg-background/60">
            <span className="rounded-sm border border-border bg-surface-raised px-3 py-1.5 font-mono text-2xs text-foreground">Solte para guardar na biblioteca</span>
          </div>)}
      </div>
    </div>);
}
