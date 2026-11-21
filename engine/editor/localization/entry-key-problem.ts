import { hasEntry } from '@/engine/localization/edits/entry-edits';
import { MAX_ENTRY_KEY_LENGTH, normalizeEntryKey } from '@/engine/localization/settings/entry-key';
import type { LocalizedEntry } from '@/engine/localization/settings/localization-settings';
export function entryKeyProblem(entries: readonly LocalizedEntry[], name: string): string | null {
    const key = normalizeEntryKey(name);
    if (key === null)
        return `Use até ${MAX_ENTRY_KEY_LENGTH} letras, números, ".", "-", "_" ou "/", sem espaços.`;
    return hasEntry(entries, key) ? `A chave "${key}" já existe.` : null;
}
