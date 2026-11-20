export const BUILT_IN_LAYOUTS = ['Keyboard', 'Mouse', 'Touchscreen', 'Gamepad', 'Joystick', 'XRController'] as const;
export type BuiltInLayout = (typeof BUILT_IN_LAYOUTS)[number];
export const MAX_CONTROL_PATH_LENGTH = 96;
export interface ControlPath {
    readonly layout: string;
    readonly usage: string | null;
    readonly control: string;
}
const CONTROL_PATH_PATTERN = /^<([^<>{}/]+)>(?:\{([^<>{}/]+)\})?\/(\S.*)$/;
export function parseControlPath(path: string): ControlPath | null {
    if (path.length > MAX_CONTROL_PATH_LENGTH)
        return null;
    const match = CONTROL_PATH_PATTERN.exec(path);
    return match ? { layout: match[1], usage: match[2] ?? null, control: match[3] } : null;
}
export function formatControlPath(layout: string, control: string, usage: string | null = null): string {
    return `<${layout}>${usage ? `{${usage}}` : ''}/${control}`;
}
export function isBuiltInLayout(layout: string): layout is BuiltInLayout {
    return (BUILT_IN_LAYOUTS as readonly string[]).includes(layout);
}
