import type { CustomDeviceLayout } from '../controls/custom-layout';
export const INPUT_ACTION_TYPES = ['button', 'axis', 'vector2'] as const;
export type InputActionType = (typeof INPUT_ACTION_TYPES)[number];
export const INTERACTION_KINDS = ['press', 'hold', 'tap'] as const;
export type InteractionKind = (typeof INTERACTION_KINDS)[number];
export const COMPOSITE_KINDS = ['axis1d', 'vector2'] as const;
export type CompositeKind = (typeof COMPOSITE_KINDS)[number];
export const JOIN_MODES = ['manual', 'buttonPress'] as const;
export type JoinMode = (typeof JOIN_MODES)[number];
export const COMPOSITE_PARTS: Record<CompositeKind, readonly string[]> = {
    axis1d: ['negative', 'positive'],
    vector2: ['up', 'down', 'left', 'right'],
};
export const COMPOSITE_FOR_TYPE: Record<InputActionType, CompositeKind | null> = { button: null, axis: 'axis1d', vector2: 'vector2' };
export const ALL_MAPS = '';
export const MAX_LOCAL_PLAYERS = 8;
export interface InputInteraction {
    readonly kind: InteractionKind;
    readonly duration: number;
}
export interface InputProcessors {
    readonly deadzone: number;
    readonly scale: number;
    readonly invertX: boolean;
    readonly invertY: boolean;
}
export interface CompositePart {
    readonly name: string;
    readonly path: string;
}
export interface InputBinding {
    readonly id: string;
    readonly path: string;
    readonly composite: CompositeKind | null;
    readonly parts: readonly CompositePart[];
    readonly schemes: readonly string[];
    readonly interaction: InputInteraction;
    readonly processors: InputProcessors;
}
export interface InputAction {
    readonly id: string;
    readonly name: string;
    readonly type: InputActionType;
    readonly bindings: readonly InputBinding[];
}
export interface InputActionMap {
    readonly id: string;
    readonly name: string;
    readonly actions: readonly InputAction[];
}
export interface SchemeDevice {
    readonly layout: string;
    readonly optional: boolean;
}
export interface ControlScheme {
    readonly id: string;
    readonly name: string;
    readonly devices: readonly SchemeDevice[];
}
export interface InputPlayerSettings {
    readonly maxPlayers: number;
    readonly joinMode: JoinMode;
    readonly defaultMap: string;
}
export interface InputAsset {
    maps: readonly InputActionMap[];
    schemes: readonly ControlScheme[];
    customDevices: readonly CustomDeviceLayout[];
    players: InputPlayerSettings;
}
export const DEFAULT_INTERACTION: InputInteraction = { kind: 'press', duration: 0.4 };
export const DEFAULT_PROCESSORS: InputProcessors = { deadzone: 0, scale: 1, invertX: false, invertY: false };
export const DEFAULT_PLAYER_SETTINGS: InputPlayerSettings = { maxPlayers: 4, joinMode: 'manual', defaultMap: ALL_MAPS };
