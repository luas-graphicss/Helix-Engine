import { COMPOSITE_PARTS, DEFAULT_INTERACTION, DEFAULT_PLAYER_SETTINGS, DEFAULT_PROCESSORS, type CompositeKind, type ControlScheme, type InputActionMap, type InputAsset, type InputBinding, type InputProcessors } from './input-asset';
export const KEYBOARD_MOUSE_SCHEME = 'keyboard-mouse';
export const GAMEPAD_SCHEME = 'gamepad';
export const TOUCH_SCHEME = 'touch';
export const JOYSTICK_SCHEME = 'joystick';
export const XR_SCHEME = 'xr';
const STICK_DEADZONE = 0.15;
const POINTER_LOOK_SCALE = 0.1;
const STICK: Partial<InputProcessors> = { deadzone: STICK_DEADZONE };
const POINTER_LOOK: Partial<InputProcessors> = { scale: POINTER_LOOK_SCALE };
const WASD_KEYS = ['<Keyboard>/KeyW', '<Keyboard>/KeyS', '<Keyboard>/KeyA', '<Keyboard>/KeyD'];
const ARROW_KEYS = ['<Keyboard>/ArrowUp', '<Keyboard>/ArrowDown', '<Keyboard>/ArrowLeft', '<Keyboard>/ArrowRight'];
function bind(id: string, path: string, scheme: string, processors: Partial<InputProcessors> = {}): InputBinding {
    return { id, path, composite: null, parts: [], schemes: [scheme], interaction: DEFAULT_INTERACTION, processors: { ...DEFAULT_PROCESSORS, ...processors } };
}
function bindComposite(id: string, kind: CompositeKind, scheme: string, paths: readonly string[]): InputBinding {
    const parts = COMPOSITE_PARTS[kind].map((name, index) => ({ name, path: paths[index] ?? '' }));
    return { id, path: '', composite: kind, parts, schemes: [scheme], interaction: DEFAULT_INTERACTION, processors: DEFAULT_PROCESSORS };
}
function defaultSchemes(): ControlScheme[] {
    return [
        { id: KEYBOARD_MOUSE_SCHEME, name: 'Teclado e mouse', devices: [{ layout: 'Keyboard', optional: false }, { layout: 'Mouse', optional: true }] },
        { id: GAMEPAD_SCHEME, name: 'Gamepad', devices: [{ layout: 'Gamepad', optional: false }] },
        { id: TOUCH_SCHEME, name: 'Toque', devices: [{ layout: 'Touchscreen', optional: false }] },
        { id: JOYSTICK_SCHEME, name: 'Joystick', devices: [{ layout: 'Joystick', optional: false }] },
        { id: XR_SCHEME, name: 'Controles VR', devices: [{ layout: 'XRController', optional: false }] },
    ];
}
function gameplayMap(): InputActionMap {
    return {
        id: 'gameplay',
        name: 'Gameplay',
        actions: [
            {
                id: 'gameplay.move',
                name: 'Move',
                type: 'vector2',
                bindings: [
                    bindComposite('gameplay.move.wasd', 'vector2', KEYBOARD_MOUSE_SCHEME, WASD_KEYS),
                    bindComposite('gameplay.move.arrows', 'vector2', KEYBOARD_MOUSE_SCHEME, ARROW_KEYS),
                    bind('gameplay.move.gamepad', '<Gamepad>/leftStick', GAMEPAD_SCHEME, STICK),
                    bind('gameplay.move.joystick', '<Joystick>/stick', JOYSTICK_SCHEME, STICK),
                    bind('gameplay.move.xr', '<XRController>{LeftHand}/thumbstick', XR_SCHEME, STICK),
                ],
            },
            {
                id: 'gameplay.look',
                name: 'Look',
                type: 'vector2',
                bindings: [
                    bind('gameplay.look.mouse', '<Mouse>/delta', KEYBOARD_MOUSE_SCHEME, POINTER_LOOK),
                    bind('gameplay.look.gamepad', '<Gamepad>/rightStick', GAMEPAD_SCHEME, STICK),
                    bind('gameplay.look.touch', '<Touchscreen>/primaryTouch/delta', TOUCH_SCHEME, POINTER_LOOK),
                    bind('gameplay.look.xr', '<XRController>{RightHand}/thumbstick', XR_SCHEME, STICK),
                ],
            },
            {
                id: 'gameplay.jump',
                name: 'Jump',
                type: 'button',
                bindings: [
                    bind('gameplay.jump.keyboard', '<Keyboard>/Space', KEYBOARD_MOUSE_SCHEME),
                    bind('gameplay.jump.gamepad', '<Gamepad>/buttonSouth', GAMEPAD_SCHEME),
                    bind('gameplay.jump.joystick', '<Joystick>/button1', JOYSTICK_SCHEME),
                    bind('gameplay.jump.xr', '<XRController>{RightHand}/primaryButton', XR_SCHEME),
                ],
            },
            {
                id: 'gameplay.fire',
                name: 'Fire',
                type: 'button',
                bindings: [
                    bind('gameplay.fire.mouse', '<Mouse>/leftButton', KEYBOARD_MOUSE_SCHEME),
                    bind('gameplay.fire.gamepad', '<Gamepad>/rightTrigger', GAMEPAD_SCHEME),
                    bind('gameplay.fire.joystick', '<Joystick>/trigger', JOYSTICK_SCHEME),
                    bind('gameplay.fire.touch', '<Touchscreen>/primaryTouch/press', TOUCH_SCHEME),
                    bind('gameplay.fire.xr', '<XRController>{RightHand}/trigger', XR_SCHEME),
                ],
            },
            {
                id: 'gameplay.sprint',
                name: 'Sprint',
                type: 'button',
                bindings: [bind('gameplay.sprint.keyboard', '<Keyboard>/ShiftLeft', KEYBOARD_MOUSE_SCHEME), bind('gameplay.sprint.gamepad', '<Gamepad>/leftStickPress', GAMEPAD_SCHEME)],
            },
            {
                id: 'gameplay.interact',
                name: 'Interact',
                type: 'button',
                bindings: [
                    bind('gameplay.interact.keyboard', '<Keyboard>/KeyE', KEYBOARD_MOUSE_SCHEME),
                    bind('gameplay.interact.gamepad', '<Gamepad>/buttonWest', GAMEPAD_SCHEME),
                    bind('gameplay.interact.xr', '<XRController>{RightHand}/grip', XR_SCHEME),
                ],
            },
        ],
    };
}
function interfaceMap(): InputActionMap {
    return {
        id: 'ui',
        name: 'UI',
        actions: [
            {
                id: 'ui.navigate',
                name: 'Navigate',
                type: 'vector2',
                bindings: [
                    bindComposite('ui.navigate.arrows', 'vector2', KEYBOARD_MOUSE_SCHEME, ARROW_KEYS),
                    bind('ui.navigate.dpad', '<Gamepad>/dpad', GAMEPAD_SCHEME),
                    bind('ui.navigate.stick', '<Gamepad>/leftStick', GAMEPAD_SCHEME, STICK),
                ],
            },
            {
                id: 'ui.submit',
                name: 'Submit',
                type: 'button',
                bindings: [bind('ui.submit.keyboard', '<Keyboard>/Enter', KEYBOARD_MOUSE_SCHEME), bind('ui.submit.gamepad', '<Gamepad>/buttonSouth', GAMEPAD_SCHEME)],
            },
            {
                id: 'ui.cancel',
                name: 'Cancel',
                type: 'button',
                bindings: [bind('ui.cancel.keyboard', '<Keyboard>/Escape', KEYBOARD_MOUSE_SCHEME), bind('ui.cancel.gamepad', '<Gamepad>/buttonEast', GAMEPAD_SCHEME)],
            },
        ],
    };
}
export function createDefaultInputAsset(): InputAsset {
    return { maps: [gameplayMap(), interfaceMap()], schemes: defaultSchemes(), customDevices: [], players: DEFAULT_PLAYER_SETTINGS };
}
