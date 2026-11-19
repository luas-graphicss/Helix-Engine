import { normalizeShortcut } from '@/engine/editor/extensions/shortcuts/shortcut-chord';
import { HelixArgumentError } from '../../runtime/script-errors';
import { requireString } from '../../runtime/values';
export function shortcutOf(value: unknown, member: string): string | null {
    if (value === undefined)
        return null;
    const shortcut = normalizeShortcut(requireString(value, member, 'o atalho'));
    if (shortcut === null)
        throw new HelixArgumentError(member, `o atalho "${String(value)}" não foi entendido. Use o formato "Ctrl+Shift+G".`);
    return shortcut;
}
