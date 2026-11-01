'use client';
import type { GuiFontFamily } from '@/engine/gui/document/gui-document';
import { GUI_BUILTIN_FONTS, fontAssetFamily, fontAssetIdOf } from '@/engine/gui/fonts/gui-font-registry';
import { AssetImportButton } from '@/engine/editor/panels/assets/asset-import-button';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
type GuiFontPickerProps = {
    value: GuiFontFamily;
    disabled?: boolean;
    onChange: (family: GuiFontFamily) => void;
};
export function GuiFontPicker({ value, disabled, onChange }: GuiFontPickerProps) {
    const session = useEditorSession();
    const imported = session.library.byKind('font');
    const options = [
        ...GUI_BUILTIN_FONTS.map((font) => ({ value: font.id, label: font.label })),
        ...imported.map((asset) => ({ value: fontAssetFamily(asset.id), label: `${asset.name} (importada)` })),
    ];
    const missingAssetId = fontAssetIdOf(value);
    if (missingAssetId && !imported.some((asset) => asset.id === missingAssetId))
        options.push({ value, label: 'Fonte ausente (apagada da biblioteca)' });
    return (<PropertyRow label="Fonte">
      <SelectField label="Família tipográfica" options={options} value={value} disabled={disabled} onChange={onChange}/>
      <AssetImportButton kind="font" label="Importar fonte…" disabled={disabled} onImported={(asset) => onChange(fontAssetFamily(asset.id))}/>
    </PropertyRow>);
}
