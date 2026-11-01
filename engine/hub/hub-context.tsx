'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Progress } from '@/engine/core/progress';
import { ProjectDatabase } from '@/engine/core/storage/project-database';
import { backupFileName, exportBackupArchive, importProjectFiles, type ImportFailure } from '@/engine/project/project-backup';
import { exportProjectFile } from '@/engine/project/project-file';
import { projectFileName, type ProjectRecord, type ProjectTemplateId } from '@/engine/project/project-record';
import type { ProjectRegistry } from '@/engine/project/project-registry';
import { SceneStore } from '@/engine/project/scene-store';
import { readStorageHealth, requestPersistentStorage, type StorageHealth } from '@/engine/project/storage-health';
import { plural } from '@/engine/core/format/format-time';
import { triggerDownload } from '@/engine/core/transfer/download-blob';
import { useToast } from './feedback/hub-toast';
import { editorPath } from './hub-routes';
import { useProjectRegistry } from './use-project-registry';
export type HubSection = 'home' | 'projects' | 'trash';
export interface TransferJob {
    title: string;
    progress: Progress;
    status: 'running' | 'done' | 'failed';
    download?: {
        url: string;
        filename: string;
        bytes: number;
    };
    summary?: string;
    failures?: ImportFailure[];
    imported?: ProjectRecord | null;
    error?: string;
}
export type HubDialog = {
    kind: 'rename';
    record: ProjectRecord;
} | {
    kind: 'purge';
    record: ProjectRecord;
} | {
    kind: 'empty-trash';
} | {
    kind: 'history';
    record: ProjectRecord;
} | {
    kind: 'transfer';
    job: TransferJob;
};
export interface HubActions {
    createProject(template: ProjectTemplateId): Promise<void>;
    openProject(record: ProjectRecord): void;
    prefetchEditor(record: ProjectRecord): void;
    rename(record: ProjectRecord, name: string): Promise<void>;
    duplicate(record: ProjectRecord): Promise<void>;
    moveToTrash(record: ProjectRecord): Promise<void>;
    restore(record: ProjectRecord): Promise<void>;
    purge(record: ProjectRecord): Promise<void>;
    emptyTrash(): Promise<void>;
    exportProject(record: ProjectRecord): Promise<void>;
    exportBackup(): Promise<void>;
    importFiles(files: readonly File[]): Promise<void>;
    pickFilesToImport(): void;
    restoreSnapshot(record: ProjectRecord, key: string): Promise<void>;
}
interface HubContextValue {
    registry: ProjectRegistry;
    section: HubSection;
    setSection(section: HubSection): void;
    search: string;
    setSearch(value: string): void;
    dialog: HubDialog | null;
    setDialog(dialog: HubDialog | null): void;
    opening: ProjectRecord | null;
    storage: StorageHealth | null;
    protectStorage(): Promise<void>;
    actions: HubActions;
}
const HubContext = createContext<HubContextValue | null>(null);
function errorMessage(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
export function HubProvider({ children }: {
    children: ReactNode;
}) {
    const registry = useProjectRegistry();
    const router = useRouter();
    const toast = useToast();
    const [section, setSection] = useState<HubSection>('home');
    const [search, setSearch] = useState('');
    const [dialog, setDialogState] = useState<HubDialog | null>(null);
    const [opening, setOpening] = useState<ProjectRecord | null>(null);
    const [storage, setStorage] = useState<StorageHealth | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const downloadUrlRef = useRef<string | null>(null);
    const refreshStorage = useCallback(async () => {
        setStorage(await readStorageHealth());
    }, []);
    useEffect(() => {
        void refreshStorage();
    }, [refreshStorage]);
    const setDialog = useCallback((next: HubDialog | null) => {
        setDialogState((current) => {
            if (current?.kind === 'transfer' && next?.kind !== 'transfer' && downloadUrlRef.current) {
                URL.revokeObjectURL(downloadUrlRef.current);
                downloadUrlRef.current = null;
            }
            return next;
        });
    }, []);
    const updateJob = useCallback((patch: Partial<TransferJob>) => {
        setDialogState((current) => (current?.kind === 'transfer' ? { kind: 'transfer', job: { ...current.job, ...patch } } : current));
    }, []);
    const runTransfer = useCallback(async (title: string, work: (report: (progress: Progress) => void) => Promise<Partial<TransferJob>>) => {
        setDialog({ kind: 'transfer', job: { title, progress: { label: 'Preparando', fraction: 0 }, status: 'running' } });
        try {
            const result = await work((progress) => updateJob({ progress }));
            updateJob({ ...result, status: 'done', progress: { label: 'Pronto', fraction: 1 } });
        }
        catch (cause) {
            updateJob({ status: 'failed', error: errorMessage(cause) });
        }
    }, [setDialog, updateJob]);
    const offerDownload = useCallback((blob: Blob, filename: string): Partial<TransferJob> => {
        if (downloadUrlRef.current)
            URL.revokeObjectURL(downloadUrlRef.current);
        const url = URL.createObjectURL(blob);
        downloadUrlRef.current = url;
        triggerDownload(url, filename);
        return { download: { url, filename, bytes: blob.size } };
    }, []);
    const protectStorage = useCallback(async () => {
        const granted = await requestPersistentStorage();
        await refreshStorage();
        toast(granted
            ? { tone: 'success', message: 'Armazenamento persistente concedido: o navegador não apaga seus jogos para liberar espaço.' }
            : { tone: 'warning', message: 'O navegador não concedeu armazenamento persistente. Mantenha backups exportados dos seus jogos.' });
    }, [refreshStorage, toast]);
    const actions = useMemo<HubActions>(() => ({
        async createProject(template) {
            if (registry.status !== 'ready') {
                toast({ tone: 'error', message: registry.error ?? 'O registro de projetos não está disponível.' });
                return;
            }
            try {
                void requestPersistentStorage().then(refreshStorage);
                const record = await registry.create(template);
                setOpening(record);
                router.push(editorPath(record.id));
            }
            catch (cause) {
                toast({ tone: 'error', message: `Não foi possível criar o jogo: ${errorMessage(cause)}` });
            }
        },
        openProject(record) {
            setOpening(record);
            router.push(editorPath(record.id));
        },
        prefetchEditor(record) {
            router.prefetch(editorPath(record.id));
        },
        async rename(record, name) {
            try {
                await registry.rename(record.id, name);
            }
            catch (cause) {
                toast({ tone: 'error', message: `Não foi possível renomear: ${errorMessage(cause)}` });
            }
        },
        async duplicate(record) {
            try {
                const copy = await registry.duplicate(record.id);
                if (copy)
                    toast({ tone: 'success', message: `Cópia criada: "${copy.name}".` });
                void refreshStorage();
            }
            catch (cause) {
                toast({ tone: 'error', message: `Não foi possível duplicar: ${errorMessage(cause)}` });
            }
        },
        async moveToTrash(record) {
            try {
                await registry.trash(record.id);
                toast({ message: `"${record.name}" foi para a lixeira.`, action: { label: 'Desfazer', onClick: () => void registry.restore(record.id) } });
            }
            catch (cause) {
                toast({ tone: 'error', message: `Não foi possível mover para a lixeira: ${errorMessage(cause)}` });
            }
        },
        async restore(record) {
            try {
                await registry.restore(record.id);
                toast({ tone: 'success', message: `"${record.name}" voltou para os seus jogos.` });
            }
            catch (cause) {
                toast({ tone: 'error', message: `Não foi possível restaurar: ${errorMessage(cause)}` });
            }
        },
        async purge(record) {
            try {
                await registry.purge(record.id);
                toast({ message: `"${record.name}" foi excluído permanentemente.` });
                void refreshStorage();
            }
            catch (cause) {
                toast({ tone: 'error', message: `Não foi possível excluir: ${errorMessage(cause)}` });
            }
        },
        async emptyTrash() {
            try {
                await registry.emptyTrash();
                toast({ message: 'Lixeira esvaziada.' });
                void refreshStorage();
            }
            catch (cause) {
                toast({ tone: 'error', message: `Não foi possível esvaziar a lixeira: ${errorMessage(cause)}` });
            }
        },
        exportProject(record) {
            return runTransfer(`Exportando "${record.name}"`, async (report) => {
                const blob = await exportProjectFile(record, (label, fraction) => report({ label, fraction }));
                return offerDownload(blob, projectFileName(record));
            });
        },
        exportBackup() {
            const records = registry.active;
            return runTransfer(`Backup de ${plural(records.length, 'jogo', 'jogos')}`, async (report) => {
                const blob = await exportBackupArchive(records, report);
                return offerDownload(blob, backupFileName());
            });
        },
        importFiles(files) {
            if (files.length === 0)
                return Promise.resolve();
            void requestPersistentStorage().then(refreshStorage);
            return runTransfer(files.length === 1 ? `Importando "${files[0].name}"` : `Importando ${plural(files.length, 'arquivo', 'arquivos')}`, async (report) => {
                const result = await importProjectFiles(files, registry, report);
                void refreshStorage();
                const count = result.imported.length;
                return {
                    summary: count === 0 ? 'Nenhum jogo foi importado.' : `${plural(count, 'jogo importado', 'jogos importados')}.`,
                    failures: result.failures,
                    imported: count === 1 ? result.imported[0] : null,
                };
            });
        },
        pickFilesToImport() {
            fileInputRef.current?.click();
        },
        async restoreSnapshot(record, key) {
            const database = new ProjectDatabase(record.databaseName);
            try {
                await new SceneStore(database).restoreSnapshot(key);
                await registry.touchSaved(record.id, {});
                toast({ tone: 'success', message: `A cena de "${record.name}" foi restaurada. A versão anterior ficou guardada como instantâneo.` });
            }
            catch (cause) {
                toast({ tone: 'error', message: `Não foi possível restaurar a versão: ${errorMessage(cause)}` });
            }
            finally {
                await database.close();
            }
        },
    }), [registry, router, toast, refreshStorage, runTransfer, offerDownload]);
    const value = useMemo<HubContextValue>(() => ({ registry, section, setSection, search, setSearch, dialog, setDialog, opening, storage, protectStorage, actions }), [registry, section, search, dialog, setDialog, opening, storage, protectStorage, actions]);
    return (<HubContext.Provider value={value}>
      {children}
      <input ref={fileInputRef} type="file" accept=".helix,.zip,application/x-helix-project,application/zip" multiple className="hidden" tabIndex={-1} aria-hidden onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            void actions.importFiles(files);
        }}/>
    </HubContext.Provider>);
}
export function useHub(): HubContextValue {
    const context = useContext(HubContext);
    if (!context)
        throw new Error('useHub deve ser usado dentro de HubProvider.');
    return context;
}
