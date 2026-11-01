'use client';
import { ImageOff } from 'lucide-react';
import { AssetImportButton } from '@/engine/editor/panels/assets/asset-import-button';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ImageBlobThumbnail } from '@/engine/ui/image-blob-thumbnail';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
const NONE = '';
type GuiImagePickerProps = {
    label?: string;
    value: string | null;
    disabled?: boolean;
    onChange: (assetId: string | null) => void;
};
export function GuiImagePicker({ label = 'Imagem', value, disabled, onChange }: GuiImagePickerProps) {
    const session = useEditorSession();
    const textures = session.library.byKind('texture');
    const current = value ? session.library.get(value) : null;
    const options = [{ value: NONE, label: 'Nenhuma' }, ...textures.map((asset) => ({ value: asset.id, label: asset.name }))];
    if (value && !current)
        options.push({ value, label: 'Imagem ausente (apagada da biblioteca)' });
    return (<PropertyRow label={label}>
      <span className="flex size-control shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-surface-sunken">
        {current?.thumbnail ? <ImageBlobThumbnail blob={current.thumbnail.blob} alt=""/> : <ImageOff className="size-3 text-muted-foreground" aria-hidden/>}
      </span>
      <SelectField label={`${label} da biblioteca`} options={options} value={value ?? NONE} disabled={disabled} onChange={(next) => onChange(next === NONE ? null : next)}/>
      <AssetImportButton kind="texture" label="Importar imagem…" disabled={disabled} onImported={(asset) => onChange(asset.id)}/>
    </PropertyRow>);
}
