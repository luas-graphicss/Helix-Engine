import { Gamepad2, Joystick, Keyboard, Mouse, Puzzle, RectangleGoggles, Smartphone, type LucideIcon } from 'lucide-react';
import { isBuiltInLayout, type BuiltInLayout } from '@/engine/input/controls/control-path';
import { cn } from '@/lib/utils';
const LAYOUT_ICONS: Record<BuiltInLayout, LucideIcon> = {
    Keyboard,
    Mouse,
    Touchscreen: Smartphone,
    Gamepad: Gamepad2,
    Joystick,
    XRController: RectangleGoggles,
};
type DeviceIconProps = {
    layout: string;
    className?: string;
};
export function DeviceIcon({ layout, className }: DeviceIconProps) {
    const Icon = isBuiltInLayout(layout) ? LAYOUT_ICONS[layout] : Puzzle;
    return <Icon className={cn('size-3.5 shrink-0', className)} aria-hidden/>;
}
