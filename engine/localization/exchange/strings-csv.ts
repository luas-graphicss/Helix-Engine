import { canonicalLocaleTag } from '../locale/locale-tag';
import { normalizeEntryKey } from '../settings/entry-key';
import { createLocaleEntry, findLocale, type LocalizationSettings, type StringEntry } from '../settings/localization-settings';
import { parseCsv, serializeCsv } from './csv-text';
const KEY_COLUMN = 'key';
const NOTE_COLUMN = 'note';
const NO_NOTE_COLUMN = -1;
export interface StringsImport {
    readonly settings: LocalizationSettings;
    readonly added: number;
    readonly updated: number;
    readonly skipped: number;
    readonly newLocales: readonly string[];
}
interface ColumnLayout {
    readonly note: number;
    readonly locales: ReadonlyMap<number, string>;
}
export class StringsCsvError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'StringsCsvError';
    }
}
function columnName(name: string): string {
    return name.trim().toLowerCase();
}
function readLayout(header: readonly string[]): ColumnLayout {
    if (columnName(header[0] ?? '') !== KEY_COLUMN)
        throw new StringsCsvError(`A primeira coluna do CSV precisa se chamar "${KEY_COLUMN}".`);
    let note = NO_NOTE_COLUMN;
    const locales = new Map<number, string>();
    for (let column = 1; column < header.length; column++) {
        const tag = canonicalLocaleTag(header[column]);
        if (columnName(header[column]) === NOTE_COLUMN)
            note = column;
        else if (tag !== null)
            locales.set(column, tag);
    }
    if (locales.size === 0)
        throw new StringsCsvError('O CSV não tem coluna de idioma. Use o código do idioma no cabeçalho, como en ou pt-BR.');
    return { note, locales };
}
function mergeRow(entry: StringEntry, row: readonly string[], layout: ColumnLayout): StringEntry {
    const noteCell = layout.note === NO_NOTE_COLUMN ? '' : (row[layout.note] ?? '');
    const note = noteCell === '' ? entry.note : noteCell;
    const values = { ...entry.values };
    let changed = note !== entry.note;
    for (const [column, tag] of layout.locales) {
        const text = row[column] ?? '';
        if (text === '' || values[tag] === text)
            continue;
        values[tag] = text;
        changed = true;
    }
    return changed ? { key: entry.key, note, values } : entry;
}
export function exportStringsCsv(settings: LocalizationSettings): string {
    const tags = settings.locales.map((locale) => locale.tag);
    const rows = settings.strings.map((entry) => [entry.key, entry.note, ...tags.map((tag) => entry.values[tag] ?? '')]);
    return serializeCsv([[KEY_COLUMN, NOTE_COLUMN, ...tags], ...rows]);
}
export function importStringsCsv(settings: LocalizationSettings, text: string): StringsImport {
    const [header, ...rows] = parseCsv(text);
    if (!header)
        throw new StringsCsvError('O CSV está vazio.');
    const layout = readLayout(header);
    const newLocales = [...new Set(layout.locales.values())].filter((tag) => !findLocale(settings, tag));
    const entries = new Map(settings.strings.map((entry) => [entry.key, entry]));
    let added = 0;
    let updated = 0;
    let skipped = 0;
    for (const row of rows) {
        if (row.every((cell) => cell.trim() === ''))
            continue;
        const key = normalizeEntryKey(row[0]);
        if (key === null) {
            skipped++;
            continue;
        }
        const current = entries.get(key);
        const merged = mergeRow(current ?? { key, note: '', values: {} }, row, layout);
        if (!current)
            added++;
        else if (merged !== current)
            updated++;
        entries.set(key, merged);
    }
    if (added === 0 && updated === 0 && newLocales.length === 0)
        return { settings, added, updated, skipped, newLocales };
    const locales = [...settings.locales, ...newLocales.map(createLocaleEntry)];
    return { settings: { ...settings, locales, strings: [...entries.values()] }, added, updated, skipped, newLocales };
}
