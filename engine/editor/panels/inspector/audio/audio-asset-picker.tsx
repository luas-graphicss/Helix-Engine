'use client';
import { AudioLines, Square, Volume2 } from 'lucide-react';
import { isAudioAsset } from '@/engine/assets/library/audio-asset';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { useAudioEditor } from '@/engine/editor/audio/ui/use-audio-editor';
import { TestSignalMenu } from '@/engine/editor/audio/ui/test-signal-menu';
import { AUDIO_ACCEPT, openAudioAssetInEditor, toggleQuickAudioPreview } from '@/engine/editor/operations/audio-operations';
import { AssetImportButton } from '@/engine/editor/panels/assets/asset-import-button';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ActionRow } from '@/engine/ui/action-button';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
const NONE = '';
type AudioAssetPickerProps = {
    label: string;
    assetId: string | null;
    onChange: (assetId: string | null) => void;
};
export function AudioAssetPicker({ label, assetId, onChange }: AudioAssetPickerProps) {
    const session = useEditorSession();
    const audio = useAudioEditor();
    const assets = session.library.byKind('audio').filter(isAudioAsset);
    const asset = assetId ? (assets.find((candidate) => candidate.id === assetId) ?? null) : null;
    const missing = assetId !== null && asset === null;
    const previewing = asset !== null && audio.quickPreviewAssetId === asset.id;
    const options = [
        { value: NONE, label: missing ? 'Áudio removido da biblioteca' : '— nenhum —' },
        ...assets.map((candidate) => ({ value: candidate.id, label: candidate.name })),
    ];
    const adopt = (imported: LibraryAsset) => onChange(imported.id);
    return (<>
      <PropertyRow label={label}>
        <SelectField label={label} options={options} value={asset?.id ?? NONE} onChange={(value) => onChange(value === NONE ? null : value)}/>
        {asset && (<>
            <IconButton label={previewing ? 'Parar a prévia' : 'Ouvir o clipe (prévia 2D)'} size="sm" active={previewing} onClick={() => void toggleQuickAudioPreview(session, asset)}>
              {previewing ? <Square /> : <Volume2 />}
            </IconButton>
            <IconButton label="Abrir no editor de áudio" size="sm" onClick={() => void openAudioAssetInEditor(session, asset, { play: false })}>
              <AudioLines />
            </IconButton>
          </>)}
        <AssetImportButton kind="audio" accept={AUDIO_ACCEPT} label="Importar áudio…" onImported={adopt}/>
      </PropertyRow>
      {assets.length === 0 && (<ActionRow>
          <TestSignalMenu onGenerated={adopt}/>
        </ActionRow>)}
    </>);
}
