import { plural } from '@/engine/core/format/format-time';
import { triggerDownload } from '@/engine/core/transfer/download-blob';
import { pickFiles } from '@/engine/editor/files/file-picker';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { StringsCsvError, exportStringsCsv, importStringsCsv, type StringsImport } from '@/engine/localization/exchange/strings-csv';
import { editLocalization } from './localization-edit';
const LOG_SOURCE = 'Localização';
const CSV_ACCEPT = '.csv,text/csv';
const CSV_TYPE = 'text/csv;charset=utf-8';
const CSV_SUFFIX = '-textos.csv';
const DEFAULT_FILE_STEM = 'jogo';
const DOWNLOAD_URL_LIFETIME_MS = 60000;
const UNSAFE_FILE_CHARACTERS = /[^\p{L}\p{N}_-]+/gu;
const EDGE_DASHES = /^-+|-+$/g;
function csvFileName(projectName: string): string {
    const stem = projectName.trim().replace(UNSAFE_FILE_CHARACTERS, '-').replace(EDGE_DASHES, '');
    return `${stem || DEFAULT_FILE_STEM}${CSV_SUFFIX}`;
}
function describeImport(result: StringsImport): string {
    const parts = [plural(result.added, 'texto novo', 'textos novos'), plural(result.updated, 'texto atualizado', 'textos atualizados')];
    if (result.newLocales.length > 0)
        parts.push(`${plural(result.newLocales.length, 'idioma novo', 'idiomas novos')} (${result.newLocales.join(', ')})`);
    if (result.skipped > 0)
        parts.push(plural(result.skipped, 'linha ignorada por chave inválida', 'linhas ignoradas por chave inválida'));
    return parts.join(', ');
}
function readImport(session: EditorSession, text: string, source: string): StringsImport | null {
    try {
        return importStringsCsv(session.scene.localization, text);
    }
    catch (cause) {
        if (!(cause instanceof StringsCsvError))
            throw cause;
        session.log.error(LOG_SOURCE, `${source} não foi importado. ${cause.message}`);
        return null;
    }
}
export function exportLocalizedStrings(session: EditorSession): void {
    const url = URL.createObjectURL(new Blob([exportStringsCsv(session.scene.localization)], { type: CSV_TYPE }));
    const filename = csvFileName(session.projectName);
    setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
    triggerDownload(url, filename);
    session.log.info(LOG_SOURCE, `Textos exportados para "${filename}".`);
}
export function importLocalizedStringsText(session: EditorSession, text: string, source: string): StringsImport | null {
    const result = readImport(session, text, source);
    if (result === null)
        return null;
    if (result.settings !== session.scene.localization)
        editLocalization(session, 'Importar textos', () => result.settings);
    session.log.info(LOG_SOURCE, `${source}: ${describeImport(result)}.`);
    return result;
}
export async function importLocalizedStrings(session: EditorSession): Promise<void> {
    const [file] = await pickFiles({ accept: CSV_ACCEPT });
    if (file)
        importLocalizedStringsText(session, await file.text(), file.name);
}
