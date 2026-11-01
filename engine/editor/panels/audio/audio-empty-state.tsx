'use client';
import { AudioLines, FolderOpen, Globe, Plus, SlidersHorizontal } from 'lucide-react';
import { AUDIO_FORMAT_SUMMARY } from '@/engine/audio/core/audio-formats';
import { TestSignalMenu } from '@/engine/editor/audio/ui/test-signal-menu';
import { useAudioEditor } from '@/engine/editor/audio/ui/use-audio-editor';
import { openAudioAssetInEditor, pickAudioFilesForLibrary } from '@/engine/editor/operations/audio-operations';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { ActionButton } from '@/engine/ui/action-button';
const MAX_RECENT = 6;
export function AudioEmptyState() {
    const session = useSessionTopic('assets');
    const editor = useAudioEditor();
    const sounds = session.library.byKind('audio').slice(0, MAX_RECENT);
    return (<div className="flex h-full flex-col items-center justify-center gap-3 overflow-y-auto px-4 py-3 text-center">
      <div className="flex items-center gap-2 text-muted-foreground">
        <AudioLines className="size-4" aria-hidden/>
        <span className="text-2xs">Nenhum áudio aberto</span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <ActionButton icon={Plus} variant="primary" className="flex-none" onClick={() => pickAudioFilesForLibrary(session)}>
          Adicionar áudio…
        </ActionButton>
        {sounds.map((asset) => (<ActionButton key={asset.id} icon={FolderOpen} className="max-w-40 flex-none" title={`Abrir ${asset.name}`} onClick={() => void openAudioAssetInEditor(session, asset, { play: false })}>
            <span className="truncate">{asset.name}</span>
          </ActionButton>))}
        {sounds.length === 0 && <TestSignalMenu className="flex-none" onGenerated={(asset) => void openAudioAssetInEditor(session, asset, { play: false })}/>}
        <ActionButton icon={SlidersHorizontal} className="flex-none" title="Faders, mudo e solo dos barramentos da cena" onClick={() => editor.setView('mixer')}>
          Mesa de som
        </ActionButton>
        <ActionButton icon={Globe} className="flex-none" title="Fontes e zonas acústicas colocadas no mundo" onClick={() => editor.setView('scene')}>
          Áudio 3D da cena
        </ActionButton>
      </div>
      <p className="max-w-md text-3xs leading-relaxed text-pretty text-muted-foreground">
        {editor.engine.supported
            ? `Abra um som da biblioteca (duplo clique) para ouvir, recortar, aplicar fades e efeitos sem alterar o arquivo. Formatos: ${AUDIO_FORMAT_SUMMARY}.`
            : 'Este navegador não oferece Web Audio: a prévia, a forma de onda e os efeitos ficam indisponíveis.'}
      </p>
    </div>);
}
