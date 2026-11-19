'use client';
import * as vec3 from '@/engine/core/math/vec3';
import { ColorField } from '@/engine/ui/color-field';
import { SliderField } from '@/engine/ui/slider-field';
type ColorParamEditorProps = {
    label: string;
    rgba: readonly number[];
    onChange: (rgba: readonly number[]) => void;
};
export function ColorParamEditor({ label, rgba, onChange }: ColorParamEditorProps) {
    const [red = 0, green = 0, blue = 0, alpha = 1] = rgba;
    return (<>
      <ColorField label={label} value={vec3.create(red, green, blue)} onChange={(rgb) => onChange([rgb[0], rgb[1], rgb[2], alpha])}/>
      <SliderField label={`Opacidade (${label})`} value={alpha} min={0} max={1} onChange={(opacity) => onChange([red, green, blue, opacity])}/>
    </>);
}
