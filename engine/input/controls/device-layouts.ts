import { axisControl, buttonControl, vectorControl, type ControlDescriptor } from './control-descriptor';
import { isBuiltInLayout, type BuiltInLayout } from './control-path';
import { customLayoutControls, type CustomDeviceLayout } from './custom-layout';
export const ANY_KEY = 'anyKey';
export const PRIMARY_TOUCH = 'primaryTouch';
export const TOUCH_SLOT_COUNT = 5;
export const LEFT_HAND = 'LeftHand';
export const RIGHT_HAND = 'RightHand';
const DEFAULT_JOYSTICK_AXES = 4;
const DEFAULT_JOYSTICK_BUTTONS = 12;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const FUNCTION_KEY_COUNT = 12;
const NAMED_KEYS: readonly (readonly [
    id: string,
    label: string
])[] = [
    ['Space', 'Espaço'],
    ['Enter', 'Enter'],
    ['Escape', 'Esc'],
    ['Tab', 'Tab'],
    ['Backspace', 'Backspace'],
    ['ShiftLeft', 'Shift esquerdo'],
    ['ShiftRight', 'Shift direito'],
    ['ControlLeft', 'Ctrl esquerdo'],
    ['ControlRight', 'Ctrl direito'],
    ['AltLeft', 'Alt esquerdo'],
    ['AltRight', 'Alt direito'],
    ['ArrowUp', 'Seta ↑'],
    ['ArrowDown', 'Seta ↓'],
    ['ArrowLeft', 'Seta ←'],
    ['ArrowRight', 'Seta →'],
    ['CapsLock', 'Caps Lock'],
    ['Insert', 'Insert'],
    ['Delete', 'Delete'],
    ['Home', 'Home'],
    ['End', 'End'],
    ['PageUp', 'Page Up'],
    ['PageDown', 'Page Down'],
    ['Minus', '-'],
    ['Equal', '='],
    ['BracketLeft', '['],
    ['BracketRight', ']'],
    ['Semicolon', ';'],
    ['Quote', "'"],
    ['Comma', ','],
    ['Period', '.'],
    ['Slash', '/'],
    ['Backslash', '\\'],
    ['Backquote', '`'],
    ['NumpadAdd', 'Num +'],
    ['NumpadSubtract', 'Num -'],
    ['NumpadMultiply', 'Num *'],
    ['NumpadDivide', 'Num /'],
    ['NumpadEnter', 'Num Enter'],
    ['NumpadDecimal', 'Num .'],
];
function keyboardControls(): ControlDescriptor[] {
    const controls = [buttonControl(ANY_KEY, 'Qualquer tecla')];
    for (const letter of LETTERS)
        controls.push(buttonControl(`Key${letter}`, letter));
    for (let digit = 0; digit < 10; digit++)
        controls.push(buttonControl(`Digit${digit}`, String(digit)));
    for (const [id, label] of NAMED_KEYS)
        controls.push(buttonControl(id, label));
    for (let index = 1; index <= FUNCTION_KEY_COUNT; index++)
        controls.push(buttonControl(`F${index}`, `F${index}`));
    for (let digit = 0; digit < 10; digit++)
        controls.push(buttonControl(`Numpad${digit}`, `Num ${digit}`));
    return controls;
}
export function touchSlotId(slot: number): string {
    return `touch${slot}`;
}
function touchControls(slot: string, label: string): ControlDescriptor[] {
    return [buttonControl(`${slot}/press`, label), vectorControl(`${slot}/delta`, `${label} · movimento`, 'relative'), vectorControl(`${slot}/position`, `${label} · posição`, 'absolute')];
}
function touchscreenControls(): ControlDescriptor[] {
    const controls = touchControls(PRIMARY_TOUCH, 'Toque principal');
    for (let slot = 0; slot < TOUCH_SLOT_COUNT; slot++)
        controls.push(...touchControls(touchSlotId(slot), `Toque ${slot + 1}`));
    return controls;
}
export function joystickControls(axisCount: number, buttonCount: number): ControlDescriptor[] {
    const controls = [vectorControl('stick', 'Manche'), buttonControl('trigger', 'Gatilho')];
    for (let index = 0; index < axisCount; index++)
        controls.push(axisControl(`axis${index}`, `Eixo ${index}`));
    for (let index = 0; index < buttonCount; index++)
        controls.push(buttonControl(`button${index}`, `Botão ${index}`));
    return controls;
}
export const KEYBOARD_CONTROLS: readonly ControlDescriptor[] = keyboardControls();
export const MOUSE_CONTROLS: readonly ControlDescriptor[] = [
    buttonControl('leftButton', 'Botão esquerdo'),
    buttonControl('rightButton', 'Botão direito'),
    buttonControl('middleButton', 'Botão do meio'),
    buttonControl('backButton', 'Botão voltar'),
    buttonControl('forwardButton', 'Botão avançar'),
    vectorControl('delta', 'Movimento', 'relative'),
    vectorControl('scroll', 'Rolagem', 'relative'),
    vectorControl('position', 'Posição', 'absolute'),
];
export const TOUCHSCREEN_CONTROLS: readonly ControlDescriptor[] = touchscreenControls();
export const GAMEPAD_CONTROLS: readonly ControlDescriptor[] = [
    buttonControl('buttonSouth', 'Botão inferior (A / ✕)'),
    buttonControl('buttonEast', 'Botão direito (B / ○)'),
    buttonControl('buttonWest', 'Botão esquerdo (X / □)'),
    buttonControl('buttonNorth', 'Botão superior (Y / △)'),
    buttonControl('leftShoulder', 'Ombro esquerdo (LB)'),
    buttonControl('rightShoulder', 'Ombro direito (RB)'),
    buttonControl('leftTrigger', 'Gatilho esquerdo (LT)'),
    buttonControl('rightTrigger', 'Gatilho direito (RT)'),
    buttonControl('select', 'Select'),
    buttonControl('start', 'Start'),
    buttonControl('leftStickPress', 'Clique do analógico esquerdo (L3)'),
    buttonControl('rightStickPress', 'Clique do analógico direito (R3)'),
    buttonControl('home', 'Home'),
    vectorControl('leftStick', 'Analógico esquerdo'),
    vectorControl('rightStick', 'Analógico direito'),
    vectorControl('dpad', 'Direcional'),
];
export const XR_CONTROLLER_CONTROLS: readonly ControlDescriptor[] = [
    buttonControl('trigger', 'Gatilho'),
    buttonControl('grip', 'Punho'),
    buttonControl('primaryButton', 'Botão primário (A / X)'),
    buttonControl('secondaryButton', 'Botão secundário (B / Y)'),
    buttonControl('thumbstickPress', 'Clique do analógico'),
    buttonControl('touchpadPress', 'Clique do touchpad'),
    vectorControl('thumbstick', 'Analógico'),
    vectorControl('touchpad', 'Touchpad'),
];
const BUILT_IN_CONTROLS: Record<BuiltInLayout, readonly ControlDescriptor[]> = {
    Keyboard: KEYBOARD_CONTROLS,
    Mouse: MOUSE_CONTROLS,
    Touchscreen: TOUCHSCREEN_CONTROLS,
    Gamepad: GAMEPAD_CONTROLS,
    Joystick: joystickControls(DEFAULT_JOYSTICK_AXES, DEFAULT_JOYSTICK_BUTTONS),
    XRController: XR_CONTROLLER_CONTROLS,
};
export const LAYOUT_LABELS: Record<BuiltInLayout, string> = {
    Keyboard: 'Teclado',
    Mouse: 'Mouse',
    Touchscreen: 'Tela de toque',
    Gamepad: 'Gamepad',
    Joystick: 'Joystick',
    XRController: 'Controle VR',
};
export const USAGE_LABELS: Record<string, string> = {
    [LEFT_HAND]: 'mão esquerda',
    [RIGHT_HAND]: 'mão direita',
};
export function layoutLabel(layout: string): string {
    return isBuiltInLayout(layout) ? LAYOUT_LABELS[layout] : layout;
}
export function layoutControls(layout: string, customLayouts: readonly CustomDeviceLayout[]): readonly ControlDescriptor[] {
    if (isBuiltInLayout(layout))
        return BUILT_IN_CONTROLS[layout];
    const custom = customLayouts.find((candidate) => candidate.name === layout);
    return custom ? customLayoutControls(custom) : [];
}
