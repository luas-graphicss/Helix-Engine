import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
const DENSITY_TOKENS = ['menubar', 'toolbar', 'statusbar', 'tabs', 'panelbar', 'row', 'control'];
const twMerge = extendTailwindMerge({
    extend: {
        theme: {
            spacing: DENSITY_TOKENS,
        },
    },
});
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
