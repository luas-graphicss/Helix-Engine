'use client';
import { FlipHorizontal2, FlipVertical2 } from 'lucide-react';
import type { GuiIcon, GuiImage, GuiImageFit } from '@/engine/gui/document/gui-document';
import { setGuiIcon } from '@/engine/editor/operations/gui-element-operations';
import { setGuiIconStyle, setGuiImage } from '@/engine/editor/operations/gui-property-operations';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
import { GuiColorField } from '../fields/gui-color-field';
import { GuiIconPicker } from '../fields/gui-icon-picker';
import { GuiImagePicker } from '../fields/gui-image-picker';
import { GuiInsetsField } from '../fields/gui-insets-field';
import { GuiNumberField } from '../fields/gui-number-field';
import { useGuiEdit } from '../use-gui-edit';
const FIT_OPTIONS: ReadonlyArray<{
    value: GuiImageFit;
    label: string;
}> = [
    { value: 'stretch', label: 'Esticar' },
    { value: 'contain', label: 'Conter (sem cortar)' },
    { value: 'cover', label: 'Cobrir (corta sobras)' },
    { value: 'tile', label: 'Repetir (azulejo)' },
    { value: 'slice', label: '9 fatias (bordas fixas)' },
];
export function GuiImageSection({ image }: {
    image: GuiImage;
}) {
    const { session, end } = useGuiEdit();
    return (<CollapsibleSection title="Imagem">
      <GuiImagePicker value={image.assetId} onChange={(assetId) => setGuiImage(session, { assetId }, 'Trocar imagem')}/>
      <PropertyRow label="Ajuste">
        <SelectField label="Modo de ajuste da imagem" options={FIT_OPTIONS} value={image.fit} onChange={(fit) => setGuiImage(session, { fit }, 'Alterar ajuste da imagem')}/>
      </PropertyRow>
      {image.fit === 'slice' && <GuiInsetsField label="Fatias" value={image.slice} onChange={(slice) => setGuiImage(session, { slice }, 'Alterar fatias da imagem', { merge: 'image-slice' })} onEnd={end}/>}
      <GuiColorField label="Tingimento" color={image.tint} alpha={image.tintAlpha} onChange={(patch) => setGuiImage(session, { ...(patch.color !== undefined && { tint: patch.color }), ...(patch.alpha !== undefined && { tintAlpha: patch.alpha }) }, 'Alterar tingimento', { merge: 'image-tint' })} onEnd={end}/>
      <PropertyRow label="Espelhar">
        <IconButton label="Espelhar horizontalmente" size="sm" active={image.flipX} onClick={() => setGuiImage(session, { flipX: !image.flipX }, 'Espelhar imagem')}>
          <FlipHorizontal2 />
        </IconButton>
        <IconButton label="Espelhar verticalmente" size="sm" active={image.flipY} onClick={() => setGuiImage(session, { flipY: !image.flipY }, 'Espelhar imagem')}>
          <FlipVertical2 />
        </IconButton>
      </PropertyRow>
    </CollapsibleSection>);
}
export function GuiIconSection({ icon }: {
    icon: GuiIcon;
}) {
    const { session, end } = useGuiEdit();
    return (<CollapsibleSection title="Ícone">
      <GuiIconPicker value={icon.name} onChange={(name) => name && setGuiIcon(session, [...session.gui.selectedIds], name)}/>
      <GuiColorField label="Cor" color={icon.color} alpha={icon.alpha} onChange={(patch) => setGuiIconStyle(session, patch, 'Alterar cor do ícone', { merge: 'icon-color' })} onEnd={end}/>
      <PropertyRow label="Traço">
        <GuiNumberField label="Espessura do traço" unit="px" value={icon.strokeWidth} min={0.5} max={4} step={0.25} precision={2} onChange={(strokeWidth) => setGuiIconStyle(session, { strokeWidth }, 'Alterar traço do ícone', { merge: 'icon-stroke' })} onEnd={end}/>
      </PropertyRow>
    </CollapsibleSection>);
}
