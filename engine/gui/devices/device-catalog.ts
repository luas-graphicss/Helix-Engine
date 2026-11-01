import { ANDROID_PHONES } from './catalog/android-phones';
import { ANDROID_TABLETS } from './catalog/android-tablets';
import { APPLE_IPADS } from './catalog/apple-ipad';
import { APPLE_IPHONES } from './catalog/apple-iphone';
import { DESKTOPS, LAPTOPS } from './catalog/computers';
import { HANDHELDS } from './catalog/handhelds';
import { TVS } from './catalog/tvs';
import { GUI_DEVICE_CATEGORY_LABELS, GUI_DEVICE_PLATFORM_LABELS, type GuiDeviceCategory, type GuiDeviceSpec } from './device-model';
export const GUI_DEVICE_CATEGORIES: readonly GuiDeviceCategory[] = ['phone', 'tablet', 'laptop', 'desktop', 'handheld', 'tv'];
export const GUI_DEVICE_CATALOG: readonly GuiDeviceSpec[] = [...APPLE_IPHONES, ...ANDROID_PHONES, ...APPLE_IPADS, ...ANDROID_TABLETS, ...LAPTOPS, ...DESKTOPS, ...HANDHELDS, ...TVS];
const ids = new Set<string>();
for (const device of GUI_DEVICE_CATALOG) {
    if (ids.has(device.id))
        throw new Error(`Aparelho duplicado no catálogo: ${device.id}`);
    ids.add(device.id);
}
function normalize(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}
function searchableText(device: GuiDeviceSpec): string {
    const { screen } = device;
    return normalize([device.name, device.brand, GUI_DEVICE_PLATFORM_LABELS[device.platform], GUI_DEVICE_CATEGORY_LABELS[device.category], `${screen.width}x${screen.height}`, `${screen.width}×${screen.height}`, `${screen.height}x${screen.width}`, `@${screen.dpr}`, `${screen.diagonal}`].join(' '));
}
export function searchGuiDevices(query: string, category: GuiDeviceCategory | null): GuiDeviceSpec[] {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return GUI_DEVICE_CATALOG.filter((device) => {
        if (category && device.category !== category)
            return false;
        if (terms.length === 0)
            return true;
        const text = searchableText(device);
        return terms.every((term) => text.includes(term));
    });
}
export interface GuiDeviceGroup {
    readonly category: GuiDeviceCategory;
    readonly brand: string;
    readonly devices: readonly GuiDeviceSpec[];
}
export function groupGuiDevices(devices: readonly GuiDeviceSpec[]): GuiDeviceGroup[] {
    const groups: GuiDeviceGroup[] = [];
    for (const category of GUI_DEVICE_CATEGORIES) {
        const brands = new Map<string, GuiDeviceSpec[]>();
        for (const device of devices) {
            if (device.category !== category)
                continue;
            const list = brands.get(device.brand);
            if (list)
                list.push(device);
            else
                brands.set(device.brand, [device]);
        }
        for (const [brand, list] of brands)
            groups.push({ category, brand, devices: list });
    }
    return groups;
}
