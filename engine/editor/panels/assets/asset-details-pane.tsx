'use client';
import type { ReactNode } from 'react';
import { AudioLines, Boxes, Clapperboard, Download, FileCode2, Film, ImagePlus, LayoutTemplate, Paintbrush, PersonStanding, PlusSquare, RefreshCw, ScanSearch, Sparkles, Square, Trash2, Type, Volume2, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IMPORT_FORMATS } from '@/engine/assets/import/import-registry';
import { assetKindInfo } from '@/engine/assets/library/asset-kinds';
import type { AudioAssetDetails, LibraryAsset } from '@/engine/assets/library/asset-types';
import { countEnabledEffects } from '@/engine/audio/clip/audio-effects';
import { busInfo } from '@/engine/audio/mixer/mixer-settings';
import { formatDb, formatSemitones } from '@/engine/audio/core/decibels';
import { ANIMATION_EXPORT_FORMATS } from '@/engine/core/animation/animation-io';
import { SEMANTIC_BONE_LABELS, SEMANTIC_BONES } from '@/engine/core/animation/bone-roles';
import { useAudioEditor } from '@/engine/editor/audio/ui/use-audio-editor';
import { formatBytes, formatInteger } from '@/engine/editor/import/dialog/import-format';
import { exportAnimationAsset, extractAnimationsFromModelAsset } from '@/engine/editor/operations/animation-operations';
import { activateLibraryAsset, pickLibraryAssetThumbnail, regenerateLibraryAssetThumbnail, removeLibraryAsset, setLibraryAssetTags } from '@/engine/editor/operations/asset-library-operations';
import { reanalyzeAudioAsset, toggleQuickAudioPreview } from '@/engine/editor/operations/audio-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { SCRIPT_RUN_CONTEXT_LABEL } from '@/engine/scripting/script-document';
import { scriptLanguage } from '@/engine/scripting/script-languages';
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
            return <AudioDetailRows details={details}/>;
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
        case 'gui':
            return (<>
          <InfoRow label="Referência">
            {details.referenceWidth}×{details.referenceHeight}
          </InfoRow>
          <InfoRow label="Elementos">{formatInteger(details.elements)}</InfoRow>
          <InfoRow label="No jogo">{details.enabled ? `Visível · ordem ${details.displayOrder}` : 'Oculta'}</InfoRow>
          {(details.fontAssetIds.length > 0 || details.imageAssetIds.length > 0) && (<InfoRow label="Depende de">
              {[
                        details.fontAssetIds.length > 0 ? `${details.fontAssetIds.length} ${details.fontAssetIds.length === 1 ? 'fonte' : 'fontes'}` : null,
                        details.imageAssetIds.length > 0 ? `${details.imageAssetIds.length} ${details.imageAssetIds.length === 1 ? 'imagem' : 'imagens'}` : null,
                    ]
                        .filter(Boolean)
                        .join(' · ')}
            </InfoRow>)}
        </>);
        case 'font':
            return (<>
          <InfoRow label="Família">{details.family}</InfoRow>
          <InfoRow label="Estilo">
            {details.style} · peso {details.weight}
            {details.italic ? ' · itálico' : ''}
          </InfoRow>
        </>);
        case 'video':
            return (<>
          <InfoRow label="Resolução">{details.width > 0 ? `${details.width}×${details.height}` : 'Não lida pelo navegador'}</InfoRow>
          <InfoRow label="Duração">{formatDuration(details.durationSeconds)}</InfoRow>
          <InfoRow label="Áudio">{details.hasAudio === null ? 'Desconhecido' : details.hasAudio ? 'Com faixa de áudio' : 'Sem áudio'}</InfoRow>
          <InfoRow label="Uso">Elemento de vídeo nas telas · telão ou monitor no mundo (arraste para o viewport)</InfoRow>
        </>);
        case 'vfx':
            return (<>
          <InfoRow label="Emissores">{details.emitters}</InfoRow>
          <InfoRow label="Partículas">{formatInteger(details.particleBudget)} no máximo</InfoRow>
          <InfoRow label="Ciclo">
            {formatClipDuration(details.durationSeconds)}
            {details.loop ? ' · em laço' : ' · uma vez'}
          </InfoRow>
          {details.textureAssetIds.length > 0 && (<InfoRow label="Depende de">
              {details.textureAssetIds.length} {details.textureAssetIds.length === 1 ? 'textura' : 'texturas'}
            </InfoRow>)}
          <InfoRow label="Uso">Ator de efeito na cena (arraste para o viewport) ou anexado a qualquer ator</InfoRow>
        </>);
        case 'script':
            return (<>
          <InfoRow label="Linguagem">
            {scriptLanguage(details.language).label} · .{scriptLanguage(details.language).extensions[0]}
          </InfoRow>
          <InfoRow label="Tamanho">
            {formatInteger(details.lines)} {details.lines === 1 ? 'linha' : 'linhas'}
          </InfoRow>
          <InfoRow label="Roda em">{SCRIPT_RUN_CONTEXT_LABEL[details.runContext]}</InfoRow>
          <InfoRow label="Entrada">{details.entry ? 'Script de entrada do jogo' : 'Pela ordem da hierarquia'}</InfoRow>
          <InfoRow label="Uso">Anexado a um ator como filho de tipo script (seção Script do inspetor), ou solto na raiz como script do mundo</InfoRow>
        </>);
        case 'prefab':
            return (<>
          <InfoRow label="Atores">
            {details.entities} {details.entities === 1 ? 'ator' : 'atores'} · raiz de tipo {details.rootKind}
          </InfoRow>
          <InfoRow label="Geometria">
            {formatInteger(details.triangles)} tris · {details.meshes} {details.meshes === 1 ? 'malha' : 'malhas'} · {details.textures} {details.textures === 1 ? 'textura' : 'texturas'}
          </InfoRow>
          {details.components.length > 0 && <InfoRow label="Componentes">{details.components.join(', ')}</InfoRow>}
          <InfoRow label="Uso">Instanciado na cena com ids novos a cada vez (arraste para o viewport ou use helix.scene.instantiatePrefab)</InfoRow>
        </>);
    }
}
function formatLabelOrUpper(format: string): string {
    const info = IMPORT_FORMATS.find((candidate) => candidate.format === format);
    return info ? info.label : format.toUpperCase();
}
const CHANNEL_LABELS: Record<number, string> = { 1: 'Mono', 2: 'Estéreo', 6: '5.1', 8: '7.1' };
function formatChannels(channels: number): string {
    return CHANNEL_LABELS[channels] ?? `${channels} canais`;
}
function formatSampleRate(sampleRate: number): string {
    return `${(sampleRate / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kHz`;
}
function AudioDetailRows({ details }: {
    details: AudioAssetDetails;
}) {
    const { analysis } = details;
    if (!analysis) {
        return (<>
        <InfoRow label="Duração">{formatDuration(details.durationSeconds)}</InfoRow>
        <InfoRow label="An��lise">Indisponível neste navegador</InfoRow>
      </>);
    }
    const silence = analysis.leadingSilence + analysis.trailingSilence;
    return (<>
      <InfoRow label="Duração">{formatDuration(analysis.durationSeconds)}</InfoRow>
      <InfoRow label="Formato PCM">
        {formatChannels(analysis.channels)} · {formatSampleRate(analysis.sampleRate)}
      </InfoRow>
      <InfoRow label="Pico">{formatDb(analysis.peakDb)}</InfoRow>
      <InfoRow label="RMS">{formatDb(analysis.rmsDb)}</InfoRow>
      <InfoRow label="Silêncio">{silence < 0.005 ? 'Nenhum nas pontas' : `${formatDuration(analysis.leadingSilence)} início · ${formatDuration(analysis.trailingSilence)} fim`}</InfoRow>
    </>);
}
function AudioClipRows({ details }: {
    details: AudioAssetDetails;
}) {
    const { clip } = details;
    const effects = countEnabledEffects(clip.effects);
    const trimmed = clip.trimStart > 0 || clip.trimEnd !== null;
    const faded = clip.fadeIn.duration > 0 || clip.fadeOut.duration > 0;
    const varied = clip.randomPitch > 0 || clip.randomVolumeDb > 0;
    return (<>
      <InfoRow label="Barramento">{busInfo(clip.bus).label}</InfoRow>
      <InfoRow label="Volume">
        {formatDb(clip.volumeDb)}
        {clip.pitch !== 0 ? ` · tom ${formatSemitones(clip.pitch)}` : ''}
      </InfoRow>
      <InfoRow label="Reprodução">
        {clip.loop ? 'Em laço' : 'Uma vez'}
        {trimmed ? ' · recortado' : ''}
        {faded ? ' · com fades' : ''}
        {varied ? ' · variação' : ''}
      </InfoRow>
      <InfoRow label="Efeitos">{effects === 0 ? 'Nenhum' : `${effects} ${effects === 1 ? 'ativo' : 'ativos'}`}</InfoRow>
    </>);
}
function RigRoles({ roles }: {
    roles: readonly string[];
}) {
    return (<ul className="flex flex-wrap gap-1 px-2 pb-1">
      {SEMANTIC_BONES.map((bone) => {
            const found = roles.includes(bone);
            return (<li key={bone} className={cn('rounded-sm border px-1 py-px text-3xs leading-4', found ? 'border-border bg-surface-raised text-foreground shadow-bevel' : 'border-border/40 bg-surface-sunken/40 text-muted-foreground/50')} title={found ? `${SEMANTIC_BONE_LABELS[bone]}: encontrado` : `${SEMANTIC_BONE_LABELS[bone]}: não encontrado`}>
            {SEMANTIC_BONE_LABELS[bone]}
          </li>);
        })}
    </ul>);
}
function AnimationExportActions({ asset }: {
    asset: LibraryAsset;
}) {
    const session = useEditorSession();
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
const PRIMARY_ACTION_LABEL: Record<LibraryAsset['kind'], string> = {
    model: 'Colocar na cena',
    texture: 'Aplicar à seleção',
    animation: 'Abrir no editor de animação',
    audio: 'Abrir no editor de áudio',
    gui: 'Abrir no designer de interface',
    font: 'Usar no texto selecionado',
    video: 'Colocar como telão na cena',
    vfx: 'Abrir no editor de efeitos',
    script: 'Abrir no editor de código',
    prefab: 'Instanciar na cena',
};
const PRIMARY_ACTION_ICON: Record<LibraryAsset['kind'], LucideIcon> = {
    model: PlusSquare,
    texture: Paintbrush,
    animation: Clapperboard,
    audio: AudioLines,
    gui: LayoutTemplate,
    font: Type,
    video: Film,
    vfx: Sparkles,
    script: FileCode2,
    prefab: Boxes,
};
export function AssetDetailsPane({ asset, onClose, onRename }: AssetDetailsPaneProps) {
    const session = useEditorSession();
    const audio = useAudioEditor();
    const Icon = ASSET_KIND_ICON[asset.kind];
    const previewing = asset.kind === 'audio' && audio.quickPreviewAssetId === asset.id;
    const primaryLabel = PRIMARY_ACTION_LABEL[asset.kind];
    const PrimaryIcon = PRIMARY_ACTION_ICON[asset.kind];
    return (<aside aria-label={`Detalhes de ${asset.name}`} className="flex max-h-[55%] w-full min-w-0 shrink-0 flex-col border-t border-border bg-surface @2xl/panel:max-h-none @2xl/panel:w-64 @2xl/panel:border-t-0 @2xl/panel:border-l">
      <header className="flex h-panelbar shrink-0 items-center gap-1 border-b border-border pr-1 pl-2">
        <button type="button" onClick={onRename} title={`${asset.name} · Renomear (F2)`} className="min-w-0 flex-1 truncate text-left text-2xs font-medium text-foreground hover:text-primary">
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
            <ul className="flex flex-col gap-0.5 px-2 font-mono text-3xs text-muted-foreground">
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

        {asset.details.kind === 'audio' && (<CollapsibleSection title="Clipe">
            <AudioClipRows details={asset.details}/>
            {!asset.details.analysis && (<ActionRow>
                <ActionButton icon={ScanSearch} className="flex-1" title="Tenta decodificar de novo para medir e desenhar a forma de onda" onClick={() => void reanalyzeAudioAsset(session, asset)}>
                  Analisar novamente
                </ActionButton>
              </ActionRow>)}
          </CollapsibleSection>)}

        <CollapsibleSection title="Etiquetas">
          <AssetTagEditor tags={asset.tags} onChange={(tags) => setLibraryAssetTags(session, asset, tags)}/>
        </CollapsibleSection>

        <CollapsibleSection title={`Arquivos (${asset.files.length})`} defaultOpen={asset.files.length > 1}>
          <ul className="flex flex-col gap-0.5 px-2">
            {asset.files.map((file) => (<li key={file.path} className="flex items-baseline justify-between gap-2 font-mono text-3xs" title={file.path}>
                <span className={cn('min-w-0 truncate', file.path === asset.primaryPath ? 'text-foreground' : 'text-muted-foreground')}>{file.path}</span>
                <span className="shrink-0 text-muted-foreground">{formatBytes(file.size)}</span>
              </li>))}
          </ul>
        </CollapsibleSection>
      </div>

      <footer className="shrink-0 border-t border-border">
        <ActionRow>
          <ActionButton variant="primary" icon={PrimaryIcon} className="flex-1" onClick={() => void activateLibraryAsset(session, asset)}>
            {primaryLabel}
          </ActionButton>
          {asset.kind === 'audio' && (<ActionButton icon={previewing ? Square : Volume2} title={previewing ? 'Parar' : 'Ouvir sem abrir no editor'} aria-pressed={previewing} onClick={() => void toggleQuickAudioPreview(session, asset)}/>)}
        </ActionRow>
        <ActionRow>
          <ActionButton icon={ImagePlus} className="flex-1" title="Escolher uma imagem como miniatura" onClick={() => pickLibraryAssetThumbnail(session, asset)}>
            Miniatura…
          </ActionButton>
          <ActionButton icon={RefreshCw} title={asset.thumbnail?.custom ? 'Voltar à miniatura automática' : 'Regenerar miniatura'} onClick={() => void regenerateLibraryAssetThumbnail(session, asset)}/>
          <ActionButton variant="danger" icon={Trash2} title="Remover da biblioteca (Ctrl+Z restaura)" onClick={() => void removeLibraryAsset(session, asset)}/>
        </ActionRow>
      </footer>
    </aside>);
}
