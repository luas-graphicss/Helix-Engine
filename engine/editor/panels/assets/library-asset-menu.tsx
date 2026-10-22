'use client';
import { Clapperboard, ImagePlus, Palette, Paintbrush, Pause, Pencil, Play, PlusSquare, RefreshCw, Trash2 } from 'lucide-react';
import { ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut } from '@/components/ui/context-menu';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_SHORTCUT_CLASS } from '@/engine/editor/menus/menu-styles';
import { activateLibraryAsset, createMaterialFromLibraryTexture, pickLibraryAssetThumbnail, playingLibraryAudioId, regenerateLibraryAssetThumbnail, removeLibraryAsset, } from '@/engine/editor/operations/asset-library-operations';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
type LibraryAssetMenuProps = {
    asset: LibraryAsset;
    onRename: () => void;
};
export function LibraryAssetMenu({ asset, onRename }: LibraryAssetMenuProps) {
    const session = useEditorState();
    const playing = playingLibraryAudioId() === asset.id;
    const hasAutomaticThumbnail = asset.kind !== 'audio';
    return (<ContextMenuContent className={MENU_CONTENT_CLASS}>
      <ContextMenuGroup>
        <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => void activateLibraryAsset(session, asset)}>
          {asset.kind === 'model' && <PlusSquare aria-hidden/>}
          {asset.kind === 'texture' && <Paintbrush aria-hidden/>}
          {asset.kind === 'audio' && (playing ? <Pause aria-hidden/> : <Play aria-hidden/>)}
          {asset.kind === 'animation' && <Clapperboard aria-hidden/>}
          {asset.kind === 'model' && 'Colocar na cena'}
          {asset.kind === 'texture' && 'Aplicar à seleção'}
          {asset.kind === 'audio' && (playing ? 'Parar' : 'Ouvir')}
          {asset.kind === 'animation' && 'Abrir no editor de animação'}
          <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Enter</ContextMenuShortcut>
        </ContextMenuItem>
        {asset.kind === 'texture' && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => void createMaterialFromLibraryTexture(session, asset)}>
            <Palette aria-hidden/>
            Criar material com esta textura
          </ContextMenuItem>)}
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuItem className={MENU_ITEM_CLASS} onClick={onRename}>
          <Pencil aria-hidden/>
          Renomear
          <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>F2</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => pickLibraryAssetThumbnail(session, asset)}>
          <ImagePlus aria-hidden/>
          Definir miniatura…
        </ContextMenuItem>
        {hasAutomaticThumbnail && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => void regenerateLibraryAssetThumbnail(session, asset)}>
            <RefreshCw aria-hidden/>
            {asset.thumbnail?.custom ? 'Voltar à miniatura automática' : 'Regenerar miniatura'}
          </ContextMenuItem>)}
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuItem className={MENU_ITEM_CLASS} variant="destructive" onClick={() => void removeLibraryAsset(session, asset)}>
          <Trash2 aria-hidden/>
          Remover da biblioteca
          <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuGroup>
    </ContextMenuContent>);
}
