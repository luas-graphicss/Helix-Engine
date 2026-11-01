export function isIndexedDbSupported(): boolean {
    return typeof indexedDB !== 'undefined';
}
export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Falha na operação do IndexedDB.'));
    });
}
export function transactionDone(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Falha na transação do IndexedDB.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Transação do IndexedDB abortada.'));
    });
}
export function deleteDatabase(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error(`Não foi possível apagar o banco "${name}".`));
        request.onblocked = () => reject(new Error(`O banco "${name}" está aberto em outra aba e não pôde ser apagado.`));
    });
}
export async function listDatabaseNames(): Promise<string[]> {
    if (!isIndexedDbSupported() || typeof indexedDB.databases !== 'function')
        return [];
    try {
        const infos = await indexedDB.databases();
        return infos.map((info) => info.name).filter((name): name is string => typeof name === 'string');
    }
    catch {
        return [];
    }
}
export type DatabaseUpgrade = (db: IDBDatabase, oldVersion: number) => void;
export class BrowserDatabase {
    private connection: Promise<IDBDatabase> | null = null;
    constructor(readonly name: string, private readonly version: number, private readonly upgrade: DatabaseUpgrade) { }
    open(): Promise<IDBDatabase> {
        if (!this.connection) {
            this.connection = new Promise((resolve, reject) => {
                const request = indexedDB.open(this.name, this.version);
                request.onupgradeneeded = (event) => this.upgrade(request.result, event.oldVersion);
                request.onsuccess = () => {
                    const db = request.result;
                    db.onversionchange = () => {
                        db.close();
                        this.connection = null;
                    };
                    resolve(db);
                };
                request.onerror = () => reject(request.error ?? new Error(`Não foi possível abrir o banco "${this.name}".`));
                request.onblocked = () => reject(new Error(`O banco "${this.name}" está bloqueado por outra aba.`));
            });
            this.connection.catch(() => {
                this.connection = null;
            });
        }
        return this.connection;
    }
    async withTransaction<T>(stores: string | string[], mode: IDBTransactionMode, run: (transaction: IDBTransaction) => T): Promise<T> {
        const db = await this.open();
        const transaction = db.transaction(stores, mode);
        const result = run(transaction);
        await transactionDone(transaction);
        return result;
    }
    async getAll<T>(store: string): Promise<T[]> {
        const db = await this.open();
        return requestToPromise(db.transaction(store, 'readonly').objectStore(store).getAll() as IDBRequest<T[]>);
    }
    async get<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
        const db = await this.open();
        return requestToPromise(db.transaction(store, 'readonly').objectStore(store).get(key) as IDBRequest<T | undefined>);
    }
    async put(store: string, value: unknown): Promise<void> {
        await this.withTransaction(store, 'readwrite', (transaction) => {
            transaction.objectStore(store).put(value);
        });
    }
    async delete(store: string, key: IDBValidKey): Promise<void> {
        await this.withTransaction(store, 'readwrite', (transaction) => {
            transaction.objectStore(store).delete(key);
        });
    }
    async close(): Promise<void> {
        const pending = this.connection;
        this.connection = null;
        if (!pending)
            return;
        try {
            ;
            (await pending).close();
        }
        catch {
        }
    }
}
