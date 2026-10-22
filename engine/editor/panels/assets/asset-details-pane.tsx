'use client';
import type { ReactNode } from 'react';
import { Clapperboard, Download, ImagePlus, Paintbrush, Pause, PersonStanding, Play, PlusSquare, RefreshCw, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IMPORT_FORMATS } from '@/engine/assets/import/import-registry';
import { assetKindInfo } from '@/engine/assets/library/asset-kinds';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { ANIMATION_EXPORT_FORMATS } from '@/engine/core/animation/animation-io';
import { SEMANTIC_BONE_LABELS, SEMANTIC_BONES } from '@/engine/core/animation/bone-roles';
import { formatBytes, formatInteger } from '@/engine/editor/import/dialog/import-format';
import { exportAnimationAsset, extractAnimationsFromModelAsset } from '@/engine/editor/operations/animation-operations';
import { activateLibraryAsset, pickLibraryAssetThumbnail, playingLibraryAudioId, regenerateLibraryAssetThumbnail, removeLibraryAsset, setLibraryAssetTags, } from '@/engine/editor/operations/asset-library-operations';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { IconButton } from '@/engine/ui/icon-button';
import { ImageBlobThumbnail } from '@/engine/ui/image-blob-thumbnail';
import { PropertyRow } from '@/engine/ui/property-row';
import { ASSET_KIND_ICON, ASSET_KIND_TINT } from './asset-categories';
import { describeFormat, formatClipDuration, formatDate, formatDimensions, formatDuration } from './asset-format';
import { AssetTagEditor } from './asset-tag-editor';
type AssetDetailsPaneProps = {
    asset: LibraryAsset;
    onClose: () => void;
    onRename: () => void;
};
function InfoRow({ label, children }: {
    label: string;
    children: ReactNode;
}) {
    return (<PropertyRow label={label}>
      <span className="min-w-0 truncate font-mono text-2xs text-foreground" title={typeof children === 'string' ? children : undefined}>
        {children}
      </span>
    </PropertyRow>);
}
function DetailRows({ asset }: {
    asset: LibraryAsset;
}) {
    const { details } = asset;
    switch (details.kind) {
        case 'model':
            return (<>
          <InfoRow label="Hierarquia">
            {formatInteger(details.nodes)} {details.nodes === 1 ? 'nó' : 'nós'} · {formatInteger(details.meshes)} {details.meshes === 1 ? 'malha' : 'malhas'}
          </InfoRow>
          <InfoRow label="Geometria">
            {formatInteger(details.vertices)} vértices · {formatInteger(details.triangles)} tris
          </InfoRow>
          <InfoRow label="Aparência">
            {details.materials} {details.materials === 1 ? 'material' : 'materiais'} · {details.textures} {details.textures === 1 ? 'textura' : 'texturas'}
            {details.missingTextures > 0 && ` (${details.missingTextures} ausente${details.missingTextures === 1 ? '' : 's'})`}
          </InfoRow>
          {details.dimensions && <InfoRow label="Dimensões">{formatDimensions(details.dimensions)}</InfoRow>}
          <InfoRow label="Esqueleto">{details.rig ? `${details.rig.jointCount} ${details.rig.jointCount === 1 ? 'osso' : 'ossos'} · raiz ${details.rig.rootBone}` : 'Nenhum (estático)'}</InfoRow>
          {details.rig && details.rig.roles.length > 0 && (<InfoRow label="Papéis">
              {details.rig.roles.length} de {SEMANTIC_BONES.length} reconhecidos
            </InfoRow>)}
          <InfoRow label="Animações">{details.animations.length === 0 ? 'Nenhuma embutida' : `${details.animations.length} ${details.animations.length === 1 ? 'clipe' : 'clipes'}`}</InfoRow>
        </>);
        case 'texture':
            return (<InfoRow label="Resolução">
          {details.width}×{details.height}
        </InfoRow>);
        case 'audio':
            return <InfoRow label="Duração">{formatDuration(details.durationSeconds)}</InfoRow>;
        case 'animation':
            return (<>
          <InfoRow label="Duração">
            {formatClipDuration(details.durationSeconds)}
            {details.frameRate ? ` · ${details.frameRate} fps` : ''}
            {details.loop ? ' · em ciclo' : ''}
          </InfoRow>
          <InfoRow label="Trilhas">
            {formatInteger(details.tracks)} em {details.joints} {details.joints === 1 ? 'osso' : 'ossos'} · {formatInteger(details.keyframes)} chaves
          </InfoRow>
          <InfoRow label="Esqueleto">{details.hasSkeleton ? 'Incluído (permite BVH)' : 'Só nomes de ossos'}</InfoRow>
          {details.events > 0 && <InfoRow label="Eventos">{details.events}</InfoRow>}
          {details.sourceFormat && <InfoRow label="Origem">{formatLabelOrUpper(details.sourceFormat)}</InfoRow>}
        </>);
    }
}
function formatLabelOrUpper(format: string): string {
    const info = IMPORT_FORMATS.find((candidate) => candidate.format === format);
    return info ? info.label : format.toUpperCase();
}
function RigRoles({ roles }: {
    roles: readonly string[];
}) {
    return (<ul className="flex flex-wrap gap-1 px-2 pb-1">
      {SEMANTIC_BONES.map((bone) => {
            const found = roles.includes(bone);
            return (<li key={bone} className={cn('rounded-sm border px-1 py-px text-[10px] leading-4', found ? 'border-border text-foreground' : 'border-dashed border-border/60 text-muted-foreground/60')} title={found ? `${SEMANTIC_BONE_LABELS[bone]}: encontrado` : `${SEMANTIC_BONE_LABELS[bone]}: não encontrado`}>
            {SEMANTIC_BONE_LABELS[bone]}
          </li>);
        })}
    </ul>);
}
function AnimationExportActions({ asset }: {
    asset: LibraryAsset;
}) {
    const session = useEditorState();
    const hasSkeleton = asset.details.kind === 'animation' && asset.details.hasSkeleton;
    return (<ul className="flex flex-col gap-0.5 px-2 pb-1">
      {ANIMATION_EXPORT_FORMATS.map((format) => {
            const disabled = format.requiresSkeleton && !hasSkeleton;
            return (<li key={format.id}>
            <button type="button" disabled={disabled} onClick={() => void exportAnimationAsset(session, asset, format.id)} title={disabled ? 'Este clipe não traz esqueleto; BVH precisa dele.' : format.description} className="flex w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-left text-2xs text-foreground hover:bg-surface-raised disabled:cursor-not-allowed disabled:text-muted-foreground/60 disabled:hover:bg-transparent">
              <Download className="size-3 shrink-0" aria-hidden/>
              <span className="min-w-0 flex-1 truncate">{format.label}</span>
            </button>
          </li>);
        })}
    </ul>);
}
export function AssetDetailsPane({ asset, onClose, onRename }: AssetDetailsPaneProps) {
    const session = useEditorState();
    const Icon = ASSET_KIND_ICON[asset.kind];
    const playing = playingLibraryAudioId() === asset.id;
    const primaryLabel = asset.kind === 'model' ? 'Colocar na cena' : asset.kind === 'texture' ? 'Aplicar à seleção' : asset.kind === 'animation' ? 'Abrir no editor de animação' : playing ? 'Parar' : 'Ouvir';
    const PrimaryIcon = asset.kind === 'model' ? PlusSquare : asset.kind === 'texture' ? Paintbrush : asset.kind === 'animation' ? Clapperboard : playing ? Pause : Play;
    return (<aside aria-label={`Detalhes de ${asset.name}`} className="flex w-64 shrink-0 flex-col border-l border-border bg-surface">
      <header className="flex h-8 shrink-0 items-center gap-1 border-b border-border pr-1 pl-2">
        <button type="button" onClick={onRename} title="Renomear (F2)" className="min-w-0 flex-1 truncate text-left text-2xs font-medium text-foreground hover:text-primary">
          {asset.name}
        </button>
        <IconButton label="Fechar detalhes" size="sm" onClick={onClose}>
          <X />
        </IconButton>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex gap-2 p-2">
          <span className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-surface-sunken">
            {asset.thumbnail ? <ImageBlobThumbnail blob={asset.thumbnail.blob} alt={`Miniatura de ${asset.name}`}/> : <Icon className="size-8 text-muted-foreground" strokeWidth={1.5} aria-hidden/>}
            <span aria-hidden className={cn('absolute inset-x-0 bottom-0 h-[3px]', ASSET_KIND_TINT[asset.kind])}/>
          </span>
          <dl className="flex min-w-0 flex-1 flex-col gap-1 text-2xs">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Tipo</dt>
              <dd className="truncate text-foreground">{assetKindInfo(asset.kind).label}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Formato</dt>
              <dd className="truncate text-foreground">{describeFormat(asset)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Tamanho</dt>
              <dd className="font-mono text-foreground">{formatBytes(asset.size)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Miniatura</dt>
              <dd className="truncate text-foreground">{asset.thumbnail ? (asset.thumbnail.custom ? 'Personalizada' : 'Automática') : 'Nenhuma'}</dd>
            </div>
          </dl>
        </div>

        <CollapsibleSection title="Informações">
          <DetailRows asset={asset}/>
          <InfoRow label="Adicionado">{formatDate(asset.createdAt)}</InfoRow>
          {asset.updatedAt !== asset.createdAt && <InfoRow label="Atualizado">{formatDate(asset.updatedAt)}</InfoRow>}
        </CollapsibleSection>

        {asset.details.kind === 'model' && asset.details.rig && (<CollapsibleSection title="Rig" defaultOpen={false}>
            <RigRoles roles={asset.details.rig.roles}/>
          </CollapsibleSection>)}

        {asset.details.kind === 'model' && asset.details.animations.length > 0 && (<CollapsibleSection title={`Clipes embutidos (${asset.details.animations.length})`} defaultOpen={false}>
            <ul className="flex flex-col gap-0.5 px-2 font-mono text-[10px] text-muted-foreground">
              {asset.details.animations.map((name, index) => (<li key={`${name}-${index}`} className="truncate" title={name}>
                  {name || `Clipe ${index + 1}`}
                </li>))}
            </ul>
            <ActionRow>
              <ActionButton icon={PersonStanding} className="flex-1" title="Guarda cada clipe deste modelo como uma animação da biblioteca" onClick={() => void extractAnimationsFromModelAsset(session, asset)}>
                Extrair para a biblioteca
              </ActionButton>
            </ActionRow>
          </CollapsibleSection>)}

        {asset.kind === 'animation' && (<CollapsibleSection title="Exportar">
            <AnimationExportActions asset={asset}/>
          </CollapsibleSection>)}

        <CollapsibleSection title="Etiquetas">
          <AssetTagEditor tags={asset.tags} onChange={(tags) => setLibraryAssetTags(session, asset, tags)}/>
        </CollapsibleSection>

        <CollapsibleSection title={`Arquivos (${asset.files.length})`} defaultOpen={asset.files.length > 1}>
          <ul className="flex flex-col gap-0.5 px-2">
            {asset.files.map((file) => (<li key={file.path} className="flex items-baseline justify-between gap-2 font-mono text-[10px]" title={file.path}>
                <span className={cn('min-w-0 truncate', file.path === asset.primaryPath ? 'text-foreground' : 'text-muted-foreground')}>{file.path}</span>
                <span className="shrink-0 text-muted-foreground">{formatBytes(file.size)}</span>
              </li>))}
          </ul>
        </CollapsibleSection>
      </div>

      <footer className="shrink-0 border-t border-border">
        <ActionRow>
          <ActionButton variant="primary" icon={PrimaryIcon} onClick={() => void activateLibraryAsset(session, asset)}>
            {primaryLabel}
          </ActionButton>
        </ActionRow>
        <ActionRow>
          <ActionButton icon={ImagePlus} className="flex-1" title="Escolher uma imagem como miniatura" onClick={() => pickLibraryAssetThumbnail(session, asset)}>
            Miniatura…
          </ActionButton>
          {asset.kind !== 'audio' && (<ActionButton icon={RefreshCw} title={asset.thumbnail?.custom ? 'Voltar à miniatura automática' : 'Regenerar miniatura'} onClick={() => void regenerateLibraryAssetThumbnail(session, asset)}/>)}
          <ActionButton variant="danger" icon={Trash2} title="Remover da biblioteca (Ctrl+Z restaura)" onClick={() => void removeLibraryAsset(session, asset)}/>
        </ActionRow>
      </footer>
    </aside>);
}
