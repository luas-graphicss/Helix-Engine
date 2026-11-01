'use client';
import { FieldInput } from '@/engine/ui/field-input';
import { RangeInput } from '@/engine/ui/range-input';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SelectField } from '@/engine/ui/select-field';
import { ToggleSwitch } from '@/engine/ui/toggle-field';
import { ENGINE_SETTINGS, type SettingId, type SettingValue } from '../engine-settings-schema';
import { engineSettings, useEngineSetting } from '../engine-settings-store';
import { formatSettingNumber, type NumberSetting, type SelectSetting, type TextSetting } from '../setting-definitions';
import { cn } from '@/lib/utils';
const SEGMENTED_MAX_OPTIONS = 4;
const SEGMENTED_MAX_LABEL_LENGTH = 14;
function NumberControl({ id, definition, value }: {
    id: SettingId;
    definition: NumberSetting;
    value: number;
}) {
    const commit = (next: number) => engineSettings.set(id, next as SettingValue<typeof id>);
    const commitText = (text: string) => {
        const parsed = Number.parseFloat(text.replace(',', '.'));
        if (Number.isFinite(parsed) && parsed !== value)
            commit(parsed);
    };
    return (<>
      <RangeInput label={definition.label} value={value} min={definition.min} max={definition.max} step={definition.step} scale={definition.scale} valueText={formatSettingNumber(definition, value)} onChange={commit}/>
      <FieldInput key={`${id}-${value}`} defaultValue={formatSettingNumber(definition, value)} aria-label={`${definition.label} (valor)`} className="w-[4.75rem] flex-none" onBlur={(event) => commitText(event.currentTarget.value)} onKeyDown={(event) => {
            if (event.key === 'Enter')
                event.currentTarget.blur();
        }}/>
    </>);
}
function SelectControl({ id, definition, value }: {
    id: SettingId;
    definition: SelectSetting;
    value: string;
}) {
    const commit = (next: string) => engineSettings.set(id, next as SettingValue<typeof id>);
    const segmented = definition.options.length <= SEGMENTED_MAX_OPTIONS && definition.options.every((option) => option.label.length <= SEGMENTED_MAX_LABEL_LENGTH);
    return segmented ? <SegmentedControl label={definition.label} options={definition.options} value={value} onChange={commit}/> : <SelectField label={definition.label} options={definition.options} value={value} onChange={commit}/>;
}
function TextControl({ id, definition, value }: {
    id: SettingId;
    definition: TextSetting;
    value: string;
}) {
    const commit = (next: string) => {
        if (next.trim() !== value)
            engineSettings.set(id, next as SettingValue<typeof id>);
    };
    return (<FieldInput key={`${id}-${value}`} defaultValue={value} placeholder={definition.placeholder} maxLength={definition.maxLength} aria-label={definition.label} spellCheck={false} className={cn('w-full', definition.monospace && 'font-mono')} onBlur={(event) => commit(event.currentTarget.value)} onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229)
                event.currentTarget.blur();
        }}/>);
}
export function SettingControl({ id }: {
    id: SettingId;
}) {
    const definition = ENGINE_SETTINGS[id];
    const value = useEngineSetting(id);
    switch (definition.type) {
        case 'boolean':
            return <ToggleSwitch label={definition.label} on={value as boolean} onToggle={() => engineSettings.set(id, !value as SettingValue<typeof id>)}/>;
        case 'number':
            return <NumberControl id={id} definition={definition} value={value as number}/>;
        case 'select':
            return <SelectControl id={id} definition={definition} value={value as string}/>;
        case 'text':
            return <TextControl id={id} definition={definition} value={value as string}/>;
    }
}
