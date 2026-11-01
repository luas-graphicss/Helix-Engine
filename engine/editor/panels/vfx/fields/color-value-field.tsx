'use client';
import { colorGradient, convertColorValue, hexToRgb, rgbToHex, VFX_COLOR_KIND_LABEL, type VfxColorKind, type VfxColorValue } from '@/engine/vfx/document/vfx-curves';
import { GuiColorField } from '@/engine/editor/panels/gui/inspector/fields/gui-color-field';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { GradientEditor } from './gradient-editor';
export type ColorValueFieldProps = {
    label: string;
    value: VfxColorValue;
    onChange: (value: VfxColorValue) => void;
    onEnd: () => void;
};
const KIND_OPTIONS: ReadonlyArray<{
    value: VfxColorKind;
    label: string;
}> = [
    { value: 'constant', label: 'Fixa' },
    { value: 'random', label: 'Entre duas' },
    { value: 'gradient', label: 'Gradiente' },
];
export function ColorValueField({ label, value, onChange, onEnd }: ColorValueFieldProps) {
    return (<>
      <PropertyRow label={label}>
        <SegmentedControl label={`Modo de ${label}`} options={KIND_OPTIONS} value={value.kind} onChange={(kind) => (onChange(convertColorValue(value, kind)), onEnd())}/>
      </PropertyRow>
      {value.kind === 'constant' && (<GuiColorField label="Cor" color={rgbToHex(value.color)} alpha={value.alpha} onChange={(patch) => {
                const rgb = patch.color ? hexToRgb(patch.color) : null;
                onChange({ ...value, ...(rgb && { color: rgb }), ...(patch.alpha !== undefined && { alpha: patch.alpha }) });
            }} onEnd={onEnd}/>)}
      {value.kind === 'random' && (<>
          <GuiColorField label="Cor A" color={rgbToHex(value.a)} alpha={value.alphaA} onChange={(patch) => {
                const rgb = patch.color ? hexToRgb(patch.color) : null;
                onChange({ ...value, ...(rgb && { a: rgb }), ...(patch.alpha !== undefined && { alphaA: patch.alpha }) });
            }} onEnd={onEnd}/>
          <GuiColorField label="Cor B" color={rgbToHex(value.b)} alpha={value.alphaB} onChange={(patch) => {
                const rgb = patch.color ? hexToRgb(patch.color) : null;
                onChange({ ...value, ...(rgb && { b: rgb }), ...(patch.alpha !== undefined && { alphaB: patch.alpha }) });
            }} onEnd={onEnd}/>
        </>)}
      {value.kind === 'gradient' && (<div className="px-2 py-0.5">
          <GradientEditor label={`${VFX_COLOR_KIND_LABEL.gradient}`} gradient={value.gradient} onChange={(gradient) => onChange(colorGradient(gradient))} onEnd={onEnd}/>
        </div>)}
    </>);
}
