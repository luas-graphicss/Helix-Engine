'use client';
import { Pause } from 'lucide-react';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { setAssetDragData } from '@/engine/editor/library/asset-drag';
import { activateLibraryAsset, playingLibraryAudioId } from '@/engine/editor/operations/asset-library-operations';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { ImageBlobThumbnail } from '@/engine/ui/image-blob-thumbnail';
import { ASSET_KIND_ICON, ASSET_KIND_TINT } from './asset-categories';
import { describeLibraryAsset, formatBadge } from './asset-format';
import { AssetTile, type TileRename } from './asset-tile';
import { LibraryAssetMenu } from './library-asset-menu';
type LibraryAssetTileProps = {
    asset: LibraryAsset;
    selected: boolean;
    rename: TileRename | null;
    onSelect: () => void;
    onRenameRequest: () => void;
};
function AssetThumbnail({ asset }: {
    asset: LibraryAsset;
}) {
    const Icon = ASSET_KIND_ICON[asset.kind];
    const playing = playingLibraryAudioId() === asset.id;
    return (<>
      {asset.thumbnail ? (<ImageBlobThumbnail blob={asset.thumbnail.blob} alt=""/>) : (<Icon className="size-7 text-muted-foreground transition-colors group-hover:text-foreground" strokeWidth={1.5} aria-hidden/>)}
      {playing && (<span className="absolute inset-0 flex items-center justify-center bg-background/50">
          <Pause className="size-5 text-primary" aria-hidden/>
        </span>)}
    </>);
}
const ACTIVATION_HINT: Record<LibraryAsset['kind'], string> = {
    model: 'Duplo clique coloca na cena · arraste para o viewport para posicionar',
    texture: 'Duplo clique aplica à seleção · arraste sobre um ator no viewport',
    audio: 'Duplo clique reproduz',
    animation: 'Duplo clique abre no editor de animação sobre o ator selecionado · exporte pelos detalhes',
};
export function LibraryAssetTile({ asset, selected, rename, onSelect, onRenameRequest }: LibraryAssetTileProps) {
    const session = useEditorState();
    return (<ContextMenu>
      <ContextMenuTrigger render={<AssetTile name={asset.name} caption={describeLibraryAsset(asset)} tint={ASSET_KIND_TINT[asset.kind]} title={`${asset.name}\n${ACTIVATION_HINT[asset.kind]}`} badge={formatBadge(asset)} selected={selected} draggable={rename === null} rename={rename} onDragStart={(event) => {
                onSelect();
                setAssetDragData(event.dataTransfer, asset);
            }} onClick={onSelect} onDoubleClick={() => void activateLibraryAsset(session, asset)} onContextMenu={onSelect}>
            <AssetThumbnail asset={asset}/>
          </AssetTile>}/>
      <LibraryAssetMenu asset={asset} onRename={onRenameRequest}/>
    </ContextMenu>);
}
