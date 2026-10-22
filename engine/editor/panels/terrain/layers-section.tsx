'use client';
import { ChevronDown, ChevronUp, PaintBucket, Palette, Plus, Sprout, Trash2, WandSparkles } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { ColorField } from '@/engine/ui/color-field';
import { PropertyRow } from '@/engine/ui/property-row';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { linearRgbToCss } from '@/engine/core/color/srgb';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
import { openMaterialEditor } from '@/engine/editor/materials/material-editor-requests';
import { materialCaption, MaterialSwatch as LibraryMaterialSwatch } from '@/engine/editor/materials/material-swatch';
import { addTerrainLayerFromDocument, isTerrainMaterialFromLibrary, libraryDocumentForTerrainMaterial } from '@/engine/editor/operations/material-library-operations';
import { addTerrainLayer, autoPaint, fillTerrainLayer, moveTerrainLayer, removeTerrainLayer, renameLayer, setLayerScalar, setLayerTint, updateLayerAutoRule, } from '@/engine/editor/operations/terrain-operations';
import type { TerrainLayer } from '@/engine/terrain/core/terrain-layer';
import { materialSupportsGrass } from '@/engine/terrain/foliage/grass-placement';
import { TERRAIN_MATERIAL_CATEGORY_LABEL, type TerrainMaterialCategory } from '@/engine/terrain/materials/terrain-material';
import type { TerrainMaterialInfo } from '@/engine/terrain/materials/terrain-material-library';
import type { TerrainTarget } from '../terrain-panel';
import { degrees, meters, percent, times } from './formatters';
const CATEGORY_ORDER: readonly TerrainMaterialCategory[] = ['grass', 'soil', 'rock', 'sand', 'snow', 'custom'];
function MaterialSwatch({ thumbnailUrl, color, className }: {
    thumbnailUrl: string | null;
    color: Parameters<typeof linearRgbToCss>[0];
    className?: string;
}) {
    return (<span className={cn('block shrink-0 overflow-hidden rounded-sm border border-border', className)} style={{ backgroundColor: linearRgbToCss(color) }} aria-hidden>
      {thumbnailUrl && <img src={thumbnailUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover"/>}
    </span>);
}
function AddLayerMenu({ target }: {
    target: TerrainTarget;
}) {
    const session = useEditorState();
    const library = session.materials.all;
    const materials = session.terrain.materials.list().filter((material) => !isTerrainMaterialFromLibrary(material.id));
    const groups = CATEGORY_ORDER.map((category) => ({ category, entries: materials.filter((material) => material.category === category) })).filter((group) => group.entries.length > 0);
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<IconButton label="Adicionar camada de material" size="sm" className="size-5 [&_svg]:size-3" disabled={!target.terrain.canAddLayer}/>}>
        <Plus />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn(MENU_CONTENT_CLASS, 'max-h-96 overflow-auto')}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className={MENU_LABEL_CLASS}>Biblioteca de materiais</DropdownMenuLabel>
          {library.length === 0 && (<DropdownMenuItem className={MENU_ITEM_CLASS} disabled>
              Nenhum material salvo ainda
            </DropdownMenuItem>)}
          {library.map((document) => (<DropdownMenuItem key={document.id} className={MENU_ITEM_CLASS} onClick={() => addTerrainLayerFromDocument(session, target.entity, document)}>
              <LibraryMaterialSwatch document={document} className="size-4" resolution={32}/>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{document.name}</span>
                <span className="truncate text-[10px] text-muted-foreground">{materialCaption(document)}</span>
              </span>
            </DropdownMenuItem>))}
          <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => openMaterialEditor({ materialId: session.materials.create().id })}>
            <Palette aria-hidden/>
            Novo material no editor…
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {groups.map((group) => (<DropdownMenuGroup key={group.category}>
            <DropdownMenuLabel className={MENU_LABEL_CLASS}>{TERRAIN_MATERIAL_CATEGORY_LABEL[group.category]}</DropdownMenuLabel>
            {group.entries.map((material: TerrainMaterialInfo) => (<DropdownMenuItem key={material.id} className={MENU_ITEM_CLASS} onClick={() => addTerrainLayer(session, target.entity, material.id)}>
                <MaterialSwatch thumbnailUrl={material.thumbnailUrl} color={material.averageColor} className="size-4"/>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{material.name}</span>
                  <span className="truncate text-[10px] text-muted-foreground">{material.description}</span>
                </span>
                {material.foliage && <Sprout className="ml-auto" aria-label="Faz crescer grama"/>}
              </DropdownMenuItem>))}
          </DropdownMenuGroup>))}
      </DropdownMenuContent>
    </DropdownMenu>);
}
function LayerRow({ target, layer, index, active }: {
    target: TerrainTarget;
    layer: TerrainLayer;
    index: number;
    active: boolean;
}) {
    const session = useEditorState();
    const { entity, terrain } = target;
    const last = terrain.layers.length - 1;
    const libraryDocument = libraryDocumentForTerrainMaterial(session, layer.material.id);
    return (<li className={cn('flex h-7 items-center gap-1 rounded-sm pr-0.5 pl-1', active ? 'bg-primary/10 ring-1 ring-inset ring-primary/40' : 'hover:bg-highlight')}>
      <button type="button" aria-pressed={active} onClick={() => session.terrain.setActiveLayer(layer.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        {libraryDocument ? (<LibraryMaterialSwatch document={libraryDocument} className="size-5" resolution={40}/>) : (<MaterialSwatch thumbnailUrl={layer.material.thumbnailUrl} color={layer.material.averageColor} className="size-5"/>)}
        <span className={cn('truncate text-2xs', active ? 'font-medium text-foreground' : 'text-muted-foreground')}>{layer.name}</span>
        {index === 0 && <span className="shrink-0 font-mono text-[9px] tracking-wider text-muted-foreground/70 uppercase">base</span>}
        {layer.auto.enabled && <WandSparkles className="size-3 shrink-0 text-primary/80" aria-label="Pintura automática ativa"/>}
        {materialSupportsGrass(layer.material) && <Sprout className="size-3 shrink-0 text-muted-foreground/70" aria-label="Aceita grama"/>}
      </button>
      <IconButton label="Mover camada para cima" size="sm" className="size-5 [&_svg]:size-3" disabled={index === 0} onClick={() => moveTerrainLayer(session, entity, layer, -1)}>
        <ChevronUp />
      </IconButton>
      <IconButton label="Mover camada para baixo" size="sm" className="size-5 [&_svg]:size-3" disabled={index === last} onClick={() => moveTerrainLayer(session, entity, layer, 1)}>
        <ChevronDown />
      </IconButton>
      <IconButton label="Remover camada" size="sm" className="size-5 hover:text-destructive [&_svg]:size-3" onClick={() => removeTerrainLayer(session, entity, layer)}>
        <Trash2 />
      </IconButton>
    </li>);
}
function LayerDetails({ target, layer }: {
    target: TerrainTarget;
    layer: TerrainLayer;
}) {
    const session = useEditorState();
    const { entity } = target;
    const { auto } = layer;
    return (<div className="mt-1 flex flex-col gap-0.5 border-t border-border pt-1.5">
      <PropertyRow label="Nome">
        <FieldInput key={`${layer.id}-${layer.name}`} defaultValue={layer.name} aria-label="Nome da camada" onBlur={(event) => renameLayer(session, layer, event.currentTarget.value)} onKeyDown={(event) => {
            if (event.key === 'Enter')
                event.currentTarget.blur();
        }}/>
      </PropertyRow>
      <SliderField label="Repetição" value={layer.tiling} min={0.25} max={64} scale="log" format={meters} onChange={(value) => setLayerScalar(session, layer, 'tiling', value)}/>
      <ColorField label="Tonalidade" value={layer.tint} onChange={(rgb) => setLayerTint(session, layer, rgb)}/>
      <SliderField label="Relevo" value={layer.normalStrength} min={0} max={3} format={times} onChange={(value) => setLayerScalar(session, layer, 'normalStrength', value)}/>
      <SliderField label="Rugosidade" value={layer.roughness} min={0} max={2} format={times} onChange={(value) => setLayerScalar(session, layer, 'roughness', value)}/>

      <ToggleField label="Automático" on={auto.enabled} onToggle={() => updateLayerAutoRule(session, layer, { enabled: !auto.enabled })}/>
      {auto.enabled && (<>
          <SliderField label="Inclin. mín." value={auto.slopeMin} min={0} max={90} step={1} format={degrees} onChange={(slopeMin) => updateLayerAutoRule(session, layer, { slopeMin })}/>
          <SliderField label="Inclin. máx." value={auto.slopeMax} min={0} max={90} step={1} format={degrees} onChange={(slopeMax) => updateLayerAutoRule(session, layer, { slopeMax })}/>
          <SliderField label="Altura mín." value={auto.heightMin} min={0} max={1} format={percent} onChange={(heightMin) => updateLayerAutoRule(session, layer, { heightMin })}/>
          <SliderField label="Altura máx." value={auto.heightMax} min={0} max={1} format={percent} onChange={(heightMax) => updateLayerAutoRule(session, layer, { heightMax })}/>
          <SliderField label="Suavidade" value={auto.softness} min={0} max={1} format={percent} onChange={(softness) => updateLayerAutoRule(session, layer, { softness })}/>
        </>)}

      <ActionRow>
        <ActionButton icon={PaintBucket} variant="primary" onClick={() => fillTerrainLayer(session, entity, layer)}>
          Preencher com {layer.name}
        </ActionButton>
        <ActionButton icon={WandSparkles} onClick={() => autoPaint(session, entity)} title="Repinta o terreno pelas regras automáticas de todas as camadas">
          Automática
        </ActionButton>
      </ActionRow>
    </div>);
}
export function LayersSection({ target }: {
    target: TerrainTarget;
}) {
    const session = useEditorState();
    const { terrain } = target;
    const activeIndex = session.terrain.activeLayerIndex;
    const activeLayer = activeIndex >= 0 ? terrain.layers[activeIndex] : null;
    return (<CollapsibleSection title="Camadas" trailing={<AddLayerMenu target={target}/>}>
      {terrain.layers.length === 0 ? (<p className="px-2 py-1 text-[10px] leading-relaxed text-pretty text-muted-foreground">Sem camadas: o terreno é desenhado com um material neutro. Adicione a primeira com o botão +.</p>) : (<ul className="flex flex-col gap-px px-2">
          {terrain.layers.map((layer, index) => (<LayerRow key={layer.id} target={target} layer={layer} index={index} active={index === activeIndex}/>))}
        </ul>)}
      {activeLayer && <LayerDetails target={target} layer={activeLayer}/>}
    </CollapsibleSection>);
}
