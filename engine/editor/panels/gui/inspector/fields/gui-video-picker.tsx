'use client';
import { Film } from 'lucide-react';
import { AssetImportButton } from '@/engine/editor/panels/assets/asset-import-button';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ImageBlobThumbnail } from '@/engine/ui/image-blob-thumbnail';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
const NONE = '';
type GuiVideoPickerProps = {
    label?: string;
    value: string | null;
    disabled?: boolean;
    onChange: (assetId: string | null) => void;
};
export function GuiVideoPicker({ label = 'Vídeo', value, disabled, onChange }: GuiVideoPickerProps) {
    const session = useEditorSession();
    const videos = session.library.byKind('video');
    const current = value ? session.library.get(value) : null;
    const options = [{ value: NONE, label: 'Nenhum' }, ...videos.map((asset) => ({ value: asset.id, label: asset.name }))];
    if (value && !current)
        options.push({ value, label: 'Vídeo ausente (apagado da biblioteca)' });
    return (<PropertyRow label={label}>
      <span className="flex size-control shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-surface-sunken">
        {current?.thumbnail ? <ImageBlobThumbnail blob={current.thumbnail.blob} alt=""/> : <Film className="size-3 text-muted-foreground" aria-hidden/>}
      </span>
      <SelectField label={`${label} da biblioteca`} options={options} value={value ?? NONE} disabled={disabled} onChange={(next) => onChange(next === NONE ? null : next)}/>
      <AssetImportButton kind="video" label="Importar vídeo…" disabled={disabled} onImported={(asset) => onChange(asset.id)}/>
    </PropertyRow>);
}
