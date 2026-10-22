import { IMPORT_ACCEPT } from '@/engine/assets/import/import-registry';
import { pickFiles } from '@/engine/editor/files/file-picker';
import { requestImport } from './import-requests';
export function openImportFilePicker(): void {
    void pickFiles({ accept: IMPORT_ACCEPT, multiple: true }).then(requestImport);
}
