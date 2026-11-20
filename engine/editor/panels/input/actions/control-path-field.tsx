'use client';
import { Ear } from 'lucide-react';
import { useLiveDevices } from '@/engine/editor/input/live-devices-context';
import { useControlListener } from '@/engine/editor/input/use-control-listener';
import type { InputActionType } from '@/engine/input/actions/input-asset';
import { BUILT_IN_LAYOUTS, formatControlPath, parseControlPath } from '@/engine/input/controls/control-path';
import type { CustomDeviceLayout } from '@/engine/input/controls/custom-layout';
import { layoutControls, layoutLabel, LEFT_HAND, RIGHT_HAND, USAGE_LABELS } from '@/engine/input/controls/device-layouts';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
import { controlOptions, type ControlOption } from './control-options';
import { ListenOverlay } from './listen-overlay';
const NO_DEVICE = '';
const ANY_HAND = '';
const XR_LAYOUT = 'XRController';
const HAND_OPTIONS: readonly ControlOption[] = [
    { value: ANY_HAND, label: 'Qualquer mão' },
    { value: LEFT_HAND, label: USAGE_LABELS[LEFT_HAND] },
    { value: RIGHT_HAND, label: USAGE_LABELS[RIGHT_HAND] },
];
type ControlPathFieldProps = {
    path: string;
    expected: InputActionType;
    customLayouts: readonly CustomDeviceLayout[];
    onChange: (path: string) => void;
};
export function ControlPathField({ path, expected, customLayouts, onChange }: ControlPathFieldProps) {
    const listener = useControlListener(useLiveDevices());
    const parsed = parseControlPath(path);
    const layout = parsed?.layout ?? NO_DEVICE;
    const control = parsed?.control ?? '';
    const usage = parsed?.usage ?? null;
    const optionsOf = (candidate: string) => controlOptions(layoutControls(candidate, customLayouts), expected);
    const layouts = [...BUILT_IN_LAYOUTS, ...customLayouts.map((custom) => custom.name)].filter((candidate) => candidate === layout || optionsOf(candidate).length > 0);
    const layoutOptions = [{ value: NO_DEVICE, label: 'Nenhum' }, ...(layout === NO_DEVICE || layouts.includes(layout) ? layouts : [layout, ...layouts]).map((candidate) => ({ value: candidate, label: layoutLabel(candidate) }))];
    const known = optionsOf(layout);
    const controls = control === '' || known.some((option) => option.value === control) ? known : [{ value: control, label: control }, ...known];
    const changeLayout = (next: string) => {
        const first = next === NO_DEVICE ? undefined : optionsOf(next)[0];
        onChange(first ? formatControlPath(next, first.value) : '');
    };
    return (<>
      <PropertyRow label="Dispositivo">
        <SelectField label="Dispositivo do controle" options={layoutOptions} value={layout} onChange={changeLayout}/>
      </PropertyRow>
      {layout === XR_LAYOUT && (<PropertyRow label="Mão">
          <SelectField label="Mão do controle VR" options={HAND_OPTIONS} value={usage ?? ANY_HAND} onChange={(hand) => onChange(formatControlPath(layout, control, hand === ANY_HAND ? null : hand))}/>
        </PropertyRow>)}
      {layout !== NO_DEVICE && (<PropertyRow label="Controle">
          <SelectField label="Controle" options={controls} value={control} onChange={(next) => onChange(formatControlPath(layout, next, usage))}/>
        </PropertyRow>)}
      <ActionRow>
        <ActionButton icon={Ear} variant="primary" onClick={() => listener.start(expected, onChange)}>
          Escutar controle
        </ActionButton>
      </ActionRow>
      {listener.active && <ListenOverlay onCancel={listener.cancel}/>}
    </>);
}
