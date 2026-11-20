import { axisControl, buttonControl, type ControlDescriptor } from './control-descriptor';
export const CUSTOM_CONTROL_KINDS = ['button', 'axis'] as const;
export type CustomControlKind = (typeof CUSTOM_CONTROL_KINDS)[number];
export interface CustomControl {
    readonly id: string;
    readonly kind: CustomControlKind;
}
export interface CustomDeviceLayout {
    readonly name: string;
    readonly controls: readonly CustomControl[];
}
export function customLayoutControls(layout: CustomDeviceLayout): ControlDescriptor[] {
    return layout.controls.map((control) => (control.kind === 'axis' ? axisControl(control.id, control.id) : buttonControl(control.id, control.id)));
}
