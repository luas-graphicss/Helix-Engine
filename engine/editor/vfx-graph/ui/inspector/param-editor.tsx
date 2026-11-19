'use client';
import { ScalarField } from '@/engine/editor/panels/inspector/number-fields';
import type { BlockParam } from '@/engine/vfx-graph/blocks/block-definition';
import { clampNumberParam, resolveSelectParam } from '@/engine/vfx-graph/blocks/param-values';
import { numbersOf, type BlockValue } from '@/engine/vfx-graph/document/block-values';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
import { ClampedNumberField } from './clamped-number-field';
import { ColorParamEditor } from './color-param-editor';
import { GradientParamEditor } from './gradient-param-editor';
type ParamEditorProps = {
    param: BlockParam;
    value: BlockValue | undefined;
    onChange: (value: BlockValue) => void;
};
const AXIS_NAMES = ['X', 'Y', 'Z'] as const;
const RANGE_NAMES = ['mínimo', 'máximo'] as const;
function unitSuffix(unit: string | undefined): string {
    return unit ? ` ${unit}` : '';
}
function ComponentFields({ label, hint, names, components, suffix, onChange }: {
    label: string;
    hint?: string;
    names: readonly string[];
    components: readonly number[];
    suffix?: string;
    onChange: (components: readonly number[]) => void;
}) {
    return (<PropertyRow label={label} hint={hint}>
      {components.map((component, index) => (<ScalarField key={names[index]} label={`${label} ${names[index]}`} value={component} suffix={suffix} onCommit={(next) => {
                if (Number.isFinite(next))
                    onChange(components.map((current, position) => (position === index ? next : current)));
            }}/>))}
    </PropertyRow>);
}
export function ParamEditor({ param, value, onChange }: ParamEditorProps) {
    switch (param.kind) {
        case 'number':
            return (<PropertyRow label={param.label} hint={param.hint}>
              <ClampedNumberField label={param.label} value={clampNumberParam(param, value)} min={param.min} max={param.max} suffix={unitSuffix(param.unit)} onCommit={onChange}/>
            </PropertyRow>);
        case 'range':
            return <ComponentFields label={param.label} hint={param.hint} names={RANGE_NAMES} components={numbersOf(value, param.fallback)} suffix={unitSuffix(param.unit)} onChange={onChange}/>;
        case 'vector':
            return <ComponentFields label={param.label} hint={param.hint} names={AXIS_NAMES} components={numbersOf(value, param.fallback)} onChange={onChange}/>;
        case 'color':
            return <ColorParamEditor label={param.label} rgba={numbersOf(value, param.fallback)} onChange={onChange}/>;
        case 'select':
            return (<PropertyRow label={param.label} hint={param.hint}>
              <SelectField label={param.label} options={param.options} value={resolveSelectParam(param, value)} onChange={onChange}/>
            </PropertyRow>);
        case 'gradient':
            return <GradientParamEditor label={param.label} stops={numbersOf(value, param.fallback)} onChange={onChange}/>;
    }
}
