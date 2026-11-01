import { triggerDownload } from '@/engine/core/transfer/download-blob';
import { editorReopen } from '@/engine/editor/editor-reopen';
import { pickFiles } from '@/engine/editor/files/file-picker';
import { libraryDocumentForTerrainMaterial } from '@/engine/editor/operations/material-library-operations';
import { DEFAULT_SAVE_SLOT, GameSaveStore, type JsonValue } from '@/engine/project/game-save-store';
import { PROJECT_FORMAT_VERSION } from '@/engine/project/project-record';
import { projectRecordOf } from '@/engine/project/project-context';
import { exportProjectFile, importProjectFile } from '@/engine/project/project-file';
import { isBackupFile, isProjectFile, importBackupArchive } from '@/engine/project/project-backup';
import { serializeScene } from '@/engine/project/scene-document/serialize-scene';
import { readStorageHealth, requestPersistentStorage } from '@/engine/project/storage-health';
import { HelixArgumentError, HelixError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import { requireJson, requireString } from '../runtime/values';
export function createProjectApi(host: RuntimeHost) {
    const { session } = host;
    const { scene } = session;
    function record() {
        const found = projectRecordOf(session.project);
        if (!found)
            throw new HelixError('helix.project: o projeto aberto não está no registro (aba antiga?).');
        return found;
    }
    function serialize() {
        return serializeScene(scene, { libraryDocumentForTerrainMaterial: (id) => libraryDocumentForTerrainMaterial(session, id)?.id ?? null });
    }
    function requireEditor(member: string): void {
        if (host.mode !== 'editor')
            throw new HelixError(`${member}: só fora do jogo (modo ferramenta do editor). Durante o play a cena é transitória.`);
    }
    const autosave = {
        get state() {
            return session.autosave.state;
        },
        get dirty() {
            return session.autosave.dirty;
        },
        get lastSavedAt() {
            return session.autosave.lastSavedAt;
        },
        get error() {
            return session.autosave.error;
        },
        markDirty: () => session.autosave.markDirty(),
        flush: () => session.autosave.flush(),
    };
    return {
        get id() {
            return session.project.id;
        },
        get name() {
            return record().name;
        },
        get template() {
            return record().template;
        },
        get formatVersion() {
            return PROJECT_FORMAT_VERSION;
        },
        get createdAt() {
            return record().createdAt;
        },
        get openedAt() {
            return record().openedAt;
        },
        get updatedAt() {
            return record().updatedAt;
        },
        get stats() {
            return { ...record().stats };
        },
        info: () => {
            const found = record();
            return { id: found.id, name: found.name, template: found.template, formatVersion: PROJECT_FORMAT_VERSION, createdAt: found.createdAt, openedAt: found.openedAt, updatedAt: found.updatedAt, stats: { ...found.stats } };
        },
        rename: (name: unknown) => session.renameProject(requireString(name, 'helix.project.rename', 'o nome')),
        get settings() {
            return { sky: scene.sky, postProcessing: scene.postProcessing, physics: scene.physics, player: scene.player, audio: scene.audio, scripting: scene.scripting };
        },
        serialize,
        save: async () => {
            requireEditor('helix.project.save');
            return session.autosave.saveNow();
        },
        autosave,
        snapshots: () => session.project.scenes.listSnapshots(),
        loadSnapshot: (key: unknown) => session.project.scenes.loadSnapshot(requireString(key, 'helix.project.loadSnapshot', 'a chave')),
        restore: async (key: unknown) => {
            requireEditor('helix.project.restore');
            const snapshotKey = requireString(key, 'helix.project.restore', 'a chave');
            session.autosave.stop();
            try {
                await session.project.scenes.restoreSnapshot(snapshotKey);
            }
            catch (cause) {
                session.autosave.start();
                throw cause;
            }
            session.autosave.discard();
            editorReopen.request();
        },
        snapshotNow: async () => {
            requireEditor('helix.project.snapshotNow');
            const saved = await session.autosave.saveNow();
            if (!saved)
                throw new HelixError('helix.project.snapshotNow: não foi possível salvar a cena.');
            const list = await session.project.scenes.listSnapshots();
            return list[0] ?? null;
        },
        exportProject: async () => exportProjectFile(record()),
        download: async (blob?: unknown, name?: unknown) => {
            const file = blob instanceof Blob ? blob : await exportProjectFile(record());
            const fileName = name === undefined ? `${record().name}.helix` : requireString(name, 'helix.project.download', 'o nome do arquivo');
            const url = URL.createObjectURL(file);
            try {
                triggerDownload(url, fileName);
            }
            finally {
                setTimeout(() => URL.revokeObjectURL(url), 10000);
            }
        },
        importProject: async (file: unknown) => {
            if (!(file instanceof File))
                throw new HelixArgumentError('helix.project.importProject', 'esperava um File (.helix ou .zip).');
            const { registry } = session.project;
            if (isProjectFile(file))
                return [await importProjectFile(file, registry)];
            if (isBackupFile(file))
                return (await importBackupArchive(file, registry)).imported;
            throw new HelixArgumentError('helix.project.importProject', `${file.name} não é um projeto .helix nem um backup .zip.`);
        },
        pickFiles: (accept: unknown = '*/*', multiple: unknown = false) => pickFiles({ accept: requireString(accept, 'helix.project.pickFiles', 'os tipos aceitos'), multiple: Boolean(multiple) }),
        quota: async () => {
            const health = await readStorageHealth();
            return { used: health.usage ?? 0, total: health.quota ?? 0, persisted: health.persisted };
        },
        persisted: async () => (await readStorageHealth()).persisted,
        requestPersistence: () => requestPersistentStorage(),
    };
}
export type ProjectApi = ReturnType<typeof createProjectApi>;
function requireKey(value: unknown, member: string): string {
    const key = requireString(value, member, 'a chave').trim();
    if (!key)
        throw new HelixArgumentError(member, 'a chave não pode ser vazia.');
    if (key.includes('/'))
        throw new HelixArgumentError(member, 'a chave não pode conter "/"; use slots para agrupar.');
    return key;
}
export function createStorageApi(host: RuntimeHost) {
    const { session } = host;
    const store = new GameSaveStore(session.project.database);
    const ready = store.load();
    const transient = new Map<string, JsonValue>();
    function slotApi(slot: string) {
        const prefix = `helix.storage${slot === DEFAULT_SAVE_SLOT ? '' : `.slot("${slot}")`}`;
        return {
            name: slot,
            get: (key: unknown, fallback?: unknown) => {
                const value = store.get(slot, requireKey(key, `${prefix}.get`));
                return value === undefined ? (fallback === undefined ? null : fallback) : value;
            },
            has: (key: unknown) => store.has(slot, requireKey(key, `${prefix}.has`)),
            set: (key: unknown, value: unknown) => store.set(slot, requireKey(key, `${prefix}.set`), requireJson<JsonValue>(value, `${prefix}.set`)),
            remove: (key: unknown) => store.remove(slot, requireKey(key, `${prefix}.remove`)),
            keys: () => store.keys(slot),
            clear: () => store.clear(slot),
            snapshot: () => store.snapshot(slot),
            export: () => new Blob([JSON.stringify({ format: 'helix-save', version: 1, slot, values: store.snapshot(slot) }, null, 2)], { type: 'application/json' }),
            import: async (source: unknown) => {
                const member = `${prefix}.import`;
                let parsed: unknown = source;
                if (source instanceof Blob)
                    parsed = JSON.parse(await source.text());
                else if (typeof source === 'string')
                    parsed = JSON.parse(source);
                const payload = parsed as {
                    format?: unknown;
                    values?: unknown;
                };
                const values = payload && typeof payload === 'object' && payload.format === 'helix-save' ? payload.values : parsed;
                if (!values || typeof values !== 'object' || Array.isArray(values))
                    throw new HelixArgumentError(member, 'esperava um save exportado (objeto chave → valor).');
                await store.restore(slot, requireJson<Record<string, JsonValue>>(values, member));
            },
        };
    }
    const root = slotApi(DEFAULT_SAVE_SLOT);
    return {
        ...root,
        ready: () => ready,
        slot: (name: unknown) => slotApi(requireKey(name, 'helix.storage.slot')),
        slots: () => store.slots(),
        session: {
            get: (key: unknown, fallback?: unknown) => {
                const value = transient.get(requireKey(key, 'helix.storage.session.get'));
                return value === undefined ? (fallback === undefined ? null : fallback) : value;
            },
            has: (key: unknown) => transient.has(requireKey(key, 'helix.storage.session.has')),
            set: (key: unknown, value: unknown) => {
                transient.set(requireKey(key, 'helix.storage.session.set'), requireJson<JsonValue>(value, 'helix.storage.session.set'));
            },
            remove: (key: unknown) => transient.delete(requireKey(key, 'helix.storage.session.remove')),
            keys: () => [...transient.keys()],
            clear: () => transient.clear(),
        },
    };
}
export type StorageApi = ReturnType<typeof createStorageApi>;
