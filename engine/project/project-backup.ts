import JSZip from 'jszip';
import { ENGINE_NAME, ENGINE_VERSION } from '@/engine/core/engine-info';
import type { ProgressReporter } from '@/engine/core/progress';
import { exportProjectFile, importProjectFile, PROJECT_FILE_EXTENSION, PROJECT_FILE_MIME } from './project-file';
import { projectFileName, type ProjectRecord } from './project-record';
import type { ProjectRegistry } from './project-registry';
export const BACKUP_FILE_EXTENSION = '.zip';
const BACKUP_MANIFEST = 'backup.json';
const BACKUP_FORMAT = 'helix-backup';
export interface ImportFailure {
    source: string;
    message: string;
}
export interface ImportResult {
    imported: ProjectRecord[];
    failures: ImportFailure[];
}
function errorMessage(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
export function backupFileName(now = new Date()): string {
    return `helix-backup-${now.toISOString().slice(0, 19).replace(/[:T]/g, '-')}${BACKUP_FILE_EXTENSION}`;
}
function entryName(record: ProjectRecord): string {
    const base = projectFileName(record).slice(0, -PROJECT_FILE_EXTENSION.length);
    return `${base}-${record.id.slice(0, 8)}${PROJECT_FILE_EXTENSION}`;
}
export function isProjectFile(file: File): boolean {
    return file.name.toLowerCase().endsWith(PROJECT_FILE_EXTENSION);
}
export function isBackupFile(file: File): boolean {
    return file.name.toLowerCase().endsWith(BACKUP_FILE_EXTENSION);
}
export async function exportBackupArchive(records: readonly ProjectRecord[], onProgress: ProgressReporter = () => { }): Promise<Blob> {
    const zip = new JSZip();
    const entries: Array<{
        entry: string;
        id: string;
        name: string;
        updatedAt: number;
    }> = [];
    for (const [index, record] of records.entries()) {
        const base = index / records.length;
        const share = 0.9 / records.length;
        const blob = await exportProjectFile(record, (label, fraction) => onProgress({ label: `${record.name}: ${label}`, fraction: base * 0.9 + fraction * share }));
        const entry = entryName(record);
        zip.file(entry, blob, { compression: 'STORE' });
        entries.push({ entry, id: record.id, name: record.name, updatedAt: record.updatedAt });
    }
    zip.file(BACKUP_MANIFEST, JSON.stringify({ format: BACKUP_FORMAT, version: 1, engine: `${ENGINE_NAME} ${ENGINE_VERSION}`, exportedAt: Date.now(), projects: entries }, null, 2));
    onProgress({ label: 'Fechando o pacote', fraction: 0.95 });
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip', compression: 'STORE' });
    onProgress({ label: 'Pronto', fraction: 1 });
    return blob;
}
export async function importBackupArchive(file: File, registry: ProjectRegistry, onProgress: ProgressReporter = () => { }): Promise<ImportResult> {
    onProgress({ label: 'Abrindo o backup', fraction: 0.02 });
    let zip: JSZip;
    try {
        zip = await JSZip.loadAsync(file);
    }
    catch (cause) {
        throw new Error(`Não foi possível abrir "${file.name}" como pacote: ${errorMessage(cause)}`);
    }
    const entries = zip.file(/\.helix$/i);
    if (entries.length === 0) {
        if (zip.file('manifest.json'))
            return importProjectFiles([file], registry, onProgress, true);
        throw new Error(`"${file.name}" não contém jogos da ${ENGINE_NAME}: nenhum arquivo ${PROJECT_FILE_EXTENSION} dentro.`);
    }
    const result: ImportResult = { imported: [], failures: [] };
    for (const [index, entry] of entries.entries()) {
        const base = index / entries.length;
        const share = 1 / entries.length;
        const name = entry.name.split('/').pop() ?? entry.name;
        try {
            const inner = new File([await entry.async('blob')], name, { type: PROJECT_FILE_MIME });
            const record = await importProjectFile(inner, registry, (label, fraction) => onProgress({ label: `${name}: ${label}`, fraction: base + fraction * share }));
            result.imported.push(record);
        }
        catch (cause) {
            result.failures.push({ source: name, message: errorMessage(cause) });
        }
    }
    onProgress({ label: 'Pronto', fraction: 1 });
    return result;
}
export async function importProjectFiles(files: readonly File[], registry: ProjectRegistry, onProgress: ProgressReporter = () => { }, forceProject = false): Promise<ImportResult> {
    const result: ImportResult = { imported: [], failures: [] };
    for (const [index, file] of files.entries()) {
        const base = index / files.length;
        const share = 1 / files.length;
        const report: ProgressReporter = ({ label, fraction }) => onProgress({ label, fraction: base + fraction * share });
        try {
            if (forceProject || isProjectFile(file)) {
                result.imported.push(await importProjectFile(file, registry, (label, fraction) => report({ label: `${file.name}: ${label}`, fraction })));
            }
            else if (isBackupFile(file)) {
                const inner = await importBackupArchive(file, registry, report);
                result.imported.push(...inner.imported);
                result.failures.push(...inner.failures);
            }
            else {
                result.failures.push({ source: file.name, message: `Só arquivos ${PROJECT_FILE_EXTENSION} (um jogo) ou ${BACKUP_FILE_EXTENSION} (backup) podem ser importados.` });
            }
        }
        catch (cause) {
            result.failures.push({ source: file.name, message: errorMessage(cause) });
        }
    }
    onProgress({ label: 'Pronto', fraction: 1 });
    return result;
}
