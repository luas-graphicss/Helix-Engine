import { axisControl, buttonControl, type ControlDescriptor } from './control-descriptor';
export const CUSTOM_CONTROL_KINDS = ['button', 'axis'] as const;
export type CustomControlKind = (typeof CUSTOM_CONTROL_KINDS)[number];
export const MAX_LAYOUT_NAME_LENGTH = 32;
const LAYOUT_NAME_NOISE = /[^\w -]/g;
const CONTROL_ID_NOISE = /[^\w-]/g;
export interface CustomControl {
    readonly id: string;
    readonly kind: CustomControlKind;
}
export interface CustomDeviceLayout {
    readonly name: string;
    readonly controls: readonly CustomControl[];
}
export function sanitizeLayoutName(name: string): string {
    return name.replace(LAYOUT_NAME_NOISE, '').replace(/\s+/g, ' ').trim().slice(0, MAX_LAYOUT_NAME_LENGTH);
}
export function sanitizeCustomControlId(id: string): string {
    return id.replace(CONTROL_ID_NOISE, '').slice(0, MAX_LAYOUT_NAME_LENGTH);
}
export function customLayoutControls(layout: CustomDeviceLayout): ControlDescriptor[] {
    return layout.controls.map((control) => (control.kind === 'axis' ? axisControl(control.id, control.id) : buttonControl(control.id, control.id)));
}
