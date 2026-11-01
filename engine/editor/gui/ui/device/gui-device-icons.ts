import { Gamepad2, Laptop, Monitor, Ruler, Smartphone, Tablet, Target, Tv, type LucideIcon } from 'lucide-react';
import type { GuiDeviceCategory } from '@/engine/gui/devices/device-model';
export const GUI_DEVICE_CATEGORY_ICONS: Record<GuiDeviceCategory, LucideIcon> = {
    phone: Smartphone,
    tablet: Tablet,
    laptop: Laptop,
    desktop: Monitor,
    handheld: Gamepad2,
    tv: Tv,
    custom: Ruler,
};
export const GUI_REFERENCE_SCREEN_ICON: LucideIcon = Target;
