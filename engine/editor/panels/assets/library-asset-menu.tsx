'use client';
import { AudioLines, Boxes, Clapperboard, Copy, Download, FileCode2, ImagePlus, LayoutTemplate, Link2, MapPin, Palette, Paintbrush, Pencil, Play, PlusSquare, RefreshCw, Sparkles, Square, Trash2, Volume2 } from 'lucide-react';
import { ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut } from '@/components/ui/context-menu';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { useAudioEditor } from '@/engine/editor/audio/ui/use-audio-editor';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_SHORTCUT_CLASS } from '@/engine/editor/menus/menu-styles';
import { activateLibraryAsset, createMaterialFromLibraryTexture, pickLibraryAssetThumbnail, regenerateLibraryAssetThumbnail, removeLibraryAsset } from '@/engine/editor/operations/asset-library-operations';
import { toggleQuickAudioPreview } from '@/engine/editor/operations/audio-operations';
import { placeAudioAssetAsSource } from '@/engine/editor/operations/audio-world-operations';
import { attachGuiAssetToFace, canCarrySurface, placeGuiAssetAsSurface } from '@/engine/editor/operations/gui-surface-operations';
import { exportPrefabAsset, placePrefabAsset } from '@/engine/editor/operations/prefab-operations';
import { canCarryScript, duplicateScriptAsset, exportScriptAsset, placeScriptAssetAsActor, runScript } from '@/engine/editor/operations/script-operations';
import { duplicateVfxAsset, exportVfxDocument, loadVfxAsset } from '@/engine/editor/operations/vfx-operations';
import { attachVfxAssetToEntity, canCarryVfx, placeVfxAssetAsActor } from '@/engine/editor/operations/vfx-world-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
type LibraryAssetMenuProps = {
    asset: LibraryAsset;
    onRename: () => void;
};
export function LibraryAssetMenu({ asset, onRename }: LibraryAssetMenuProps) {
    const session = useEditorSession();
    const audio = useAudioEditor();
    const previewing = audio.quickPreviewAssetId === asset.id;
    const selected = session.selectedEntity;
    const surfaceTarget = selected && selected.mesh && canCarrySurface(selected) ? selected : null;
    const vfxTarget = selected && canCarryVfx(selected) ? selected : null;
    const scriptTarget = selected && canCarryScript(selected) ? selected : null;
    return (<ContextMenuContent className={MENU_CONTENT_CLASS}>
      <ContextMenuGroup>
        <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => void activateLibraryAsset(session, asset)}>
          {asset.kind === 'model' && <PlusSquare aria-hidden/>}
          {asset.kind === 'texture' && <Paintbrush aria-hidden/>}
          {asset.kind === 'audio' && <AudioLines aria-hidden/>}
          {asset.kind === 'animation' && <Clapperboard aria-hidden/>}
          {asset.kind === 'gui' && <LayoutTemplate aria-hidden/>}
          {asset.kind === 'vfx' && <Sparkles aria-hidden/>}
          {asset.kind === 'script' && <FileCode2 aria-hidden/>}
          {asset.kind === 'prefab' && <Boxes aria-hidden/>}
          {asset.kind === 'model' && 'Colocar na cena'}
          {asset.kind === 'texture' && 'Aplicar à seleção'}
          {asset.kind === 'audio' && 'Abrir no editor de áudio'}
          {asset.kind === 'animation' && 'Abrir no editor de animação'}
          {asset.kind === 'gui' && 'Abrir no designer de interface'}
          {asset.kind === 'vfx' && 'Abrir no editor de efeitos'}
          {asset.kind === 'script' && 'Abrir no editor de código'}
          {asset.kind === 'prefab' && 'Instanciar na cena'}
          <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Enter</ContextMenuShortcut>
        </ContextMenuItem>
        {asset.kind === 'script' && (<ContextMenuItem className={MENU_ITEM_CLASS} title={scriptTarget ? `Nasce um ator de script dentro de ${scriptTarget.name}` : 'Ator de script na raiz: um script do mundo'} onClick={() => placeScriptAssetAsActor(session, asset, scriptTarget)}>
            <Link2 aria-hidden/>
            {scriptTarget ? `Anexar a ${scriptTarget.name}` : 'Colocar na cena como script do mundo'}
          </ContextMenuItem>)}
        {asset.kind === 'script' && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => void runScript(session, asset)}>
            <Play aria-hidden/>
            Executar
          </ContextMenuItem>)}
        {asset.kind === 'script' && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => void duplicateScriptAsset(session, asset)}>
            <Copy aria-hidden/>
            Duplicar script
          </ContextMenuItem>)}
        {asset.kind === 'script' && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => void exportScriptAsset(session, asset)}>
            <Download aria-hidden/>
            Exportar arquivo de código…
          </ContextMenuItem>)}
        {asset.kind === 'vfx' && (<ContextMenuItem className={MENU_ITEM_CLASS} title={vfxTarget ? `O efeito acompanha ${vfxTarget.name}` : 'Ator de efeito sobre o alvo da câmera; arrastar para o viewport coloca no ponto atingido'} onClick={() => {
                if (vfxTarget && attachVfxAssetToEntity(session, vfxTarget, asset))
                    return;
                placeVfxAssetAsActor(session, asset);
            }}>
            <MapPin aria-hidden/>
            {vfxTarget ? `Anexar a ${vfxTarget.name}` : 'Colocar na cena como ator de efeito'}
          </ContextMenuItem>)}
        {asset.kind === 'vfx' && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => void duplicateVfxAsset(session, asset)}>
            <Copy aria-hidden/>
            Duplicar efeito
          </ContextMenuItem>)}
        {asset.kind === 'vfx' && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => void loadVfxAsset(session, asset).then(exportVfxDocument)}>
            <Download aria-hidden/>
            Exportar .hxvfx…
          </ContextMenuItem>)}
        {asset.kind === 'prefab' && (<ContextMenuItem className={MENU_ITEM_CLASS} title={selected && selected.parent ? `A instância nasce dentro de ${selected.name}` : 'A instância nasce na raiz da cena'} onClick={() => void placePrefabAsset(session, asset, { parent: selected && selected.parent ? selected : undefined })}>
            <MapPin aria-hidden/>
            {selected && selected.parent ? `Instanciar dentro de ${selected.name}` : 'Instanciar na raiz'}
          </ContextMenuItem>)}
        {asset.kind === 'prefab' && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => void exportPrefabAsset(session, asset)}>
            <Download aria-hidden/>
            Exportar .hxprefab…
          </ContextMenuItem>)}
        {asset.kind === 'audio' && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => void toggleQuickAudioPreview(session, asset)}>
            {previewing ? <Square aria-hidden/> : <Volume2 aria-hidden/>}
            {previewing ? 'Parar' : 'Ouvir'}
          </ContextMenuItem>)}
        {asset.kind === 'audio' && (<ContextMenuItem className={MENU_ITEM_CLASS} title="Fonte 3D sobre o alvo da câmera; arrastar para o viewport coloca no ponto atingido" onClick={() => placeAudioAssetAsSource(session, asset)}>
            <MapPin aria-hidden/>
            Colocar na cena como fonte de som
          </ContextMenuItem>)}
        {(asset.kind === 'gui' || asset.kind === 'video') && (<ContextMenuItem className={MENU_ITEM_CLASS} title={surfaceTarget ? `Cola na face de ${surfaceTarget.name} voltada para a câmera` : 'Painel em pé sobre o alvo da câmera; arrastar para o viewport cola na malha atingida'} onClick={() => {
                if (surfaceTarget && attachGuiAssetToFace(session, surfaceTarget, asset, null))
                    return;
                placeGuiAssetAsSurface(session, asset);
            }}>
            <LayoutTemplate aria-hidden/>
            {surfaceTarget ? `Colar em ${surfaceTarget.name}` : asset.kind === 'video' ? 'Colocar na cena como telão' : 'Colocar na cena como painel'}
          </ContextMenuItem>)}
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
        <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => void regenerateLibraryAssetThumbnail(session, asset)}>
          <RefreshCw aria-hidden/>
          {asset.thumbnail?.custom ? 'Voltar à miniatura automática' : 'Regenerar miniatura'}
        </ContextMenuItem>
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
