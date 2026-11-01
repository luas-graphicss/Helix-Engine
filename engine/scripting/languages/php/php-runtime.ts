import { HelixError } from '../../runtime/script-errors';
import { PHP_INI, PHP_SCRIPT_DIR, phpPreludeSource } from './php-prelude';
const VENDOR_BASE_PATH = '/vendor/php/';
const RUNTIME_MODULE = 'php8.4-web.mjs';
const WRAPPER_MODULE = 'PhpWebBase.mjs';
const RUNTIME_VERSION = '8.4';
export type PhpEntry = (...args: unknown[]) => unknown;
export interface PhpHostFunctions {
    get(id: number, key: unknown): string;
    set(id: number, key: unknown, valueJson: string): string;
    call(fnId: number, argsJson: string): string;
    str(id: number): string;
    len(id: number): number;
    keys(id: number): string;
    console(level: string, message: string, file: unknown, line: unknown): void;
    resolve(fromKey: unknown, specifier: unknown): string;
    fatal(message: unknown, file: unknown, line: unknown): void;
}
interface PhpWasmEvent extends Event {
    readonly detail?: readonly string[];
}
interface EmscriptenFileSystem {
    writeFile(path: string, data: string | Uint8Array): void;
    mkdir(path: string): void;
    analyzePath(path: string): {
        readonly exists: boolean;
    };
}
interface PhpWasmModule {
    readonly FS: EmscriptenFileSystem;
}
export interface PhpWasmInstance extends EventTarget {
    readonly binary: Promise<PhpWasmModule>;
    run(code: string): Promise<number>;
    flush(): void;
}
export interface PhpWasmArguments {
    readonly version: string;
    readonly shared: Record<string, unknown>;
    readonly ini: string;
    readonly autoTransaction: boolean;
}
interface PhpWasmWrapper {
    new (loader: Promise<unknown>, args: PhpWasmArguments): PhpWasmInstance;
}
interface PhpWasmPackage {
    readonly wrapper: PhpWasmWrapper;
    loadRuntime(): Promise<unknown>;
}
let packagePromise: Promise<PhpWasmPackage> | null = null;
function loadPhpWasm(): Promise<PhpWasmPackage> {
    if (!packagePromise) {
        const base = new URL(VENDOR_BASE_PATH, window.location.href).href;
        packagePromise = import(`${base}${WRAPPER_MODULE}`)
            .then((module: {
            PhpWebBase?: PhpWasmWrapper;
        }) => {
            if (!module.PhpWebBase)
                throw new HelixError(`${WRAPPER_MODULE} não exporta PhpWebBase.`);
            return { wrapper: module.PhpWebBase, loadRuntime: () => import(`${base}${RUNTIME_MODULE}`) };
        })
            .catch((cause: unknown) => {
            packagePromise = null;
            throw cause;
        });
    }
    return packagePromise;
}
export class PhpBailout extends HelixError {
    constructor(readonly cause: unknown) {
        super('exit() ou um erro fatal interrompeu esta chamada');
        this.name = 'PhpBailout';
    }
}
export class PhpRuntimeExit extends HelixError {
    constructor(readonly cause: unknown) {
        super(cause instanceof Error && cause.message ? `o interpretador PHP encerrou (${cause.message})` : 'o interpretador PHP encerrou');
        this.name = 'PhpRuntimeExit';
    }
}
function isBailout(cause: unknown): boolean {
    return !!cause && typeof cause === 'object' && (cause as {
        name?: unknown;
    }).name === 'ExitStatus';
}
function isRuntimeExit(cause: unknown): boolean {
    if (!cause || typeof cause !== 'object')
        return false;
    const { name, message } = cause as {
        name?: unknown;
        message?: unknown;
    };
    if (name === 'RuntimeError' || name === 'RangeError')
        return true;
    return typeof message === 'string' && /\b(?:Aborted|unreachable|memory access out of bounds|program has already aborted|table index is out of bounds|Out of memory)\b/i.test(message);
}
export type PhpOutputLevel = 'info' | 'error';
export class PhpInstance {
    private alive = true;
    private constructor(private readonly php: PhpWasmInstance, private readonly module: PhpWasmModule, private readonly entries: ReadonlyMap<string, PhpEntry>) { }
    static async boot(host: PhpHostFunctions, onOutput: (level: PhpOutputLevel, text: string) => void): Promise<PhpInstance> {
        const { wrapper, loadRuntime } = await loadPhpWasm();
        return PhpInstance.start((args) => new wrapper(loadRuntime(), args), host, onOutput);
    }
    static async start(create: (args: PhpWasmArguments) => PhpWasmInstance, host: PhpHostFunctions, onOutput: (level: PhpOutputLevel, text: string) => void): Promise<PhpInstance> {
        const entries = new Map<string, PhpEntry>();
        const shared: Record<string, unknown> = {
            ...host,
            register: (name: unknown, entry: unknown) => {
                if (typeof name === 'string' && typeof entry === 'function')
                    entries.set(name, entry as PhpEntry);
            },
        };
        const php = create({ version: RUNTIME_VERSION, shared, ini: PHP_INI, autoTransaction: false });
        const forward = (level: PhpOutputLevel) => (event: Event) => {
            const text = ((event as PhpWasmEvent).detail ?? []).join('');
            if (text.trim())
                onOutput(level, text);
        };
        php.addEventListener('output', forward('info'));
        php.addEventListener('error', forward('error'));
        const module = await php.binary;
        await php.run(phpPreludeSource());
        php.flush();
        if (!entries.has('instantiate') || !entries.has('invoke') || !entries.has('lint') || !entries.has('recover')) {
            throw new HelixError('o prelúdio PHP não registrou as entradas da engine; o interpretador respondeu de forma inesperada.');
        }
        const dir = PHP_SCRIPT_DIR.replace(/\/$/, '');
        for (const segment of ['/helix', dir])
            if (!module.FS.analyzePath(segment).exists)
                module.FS.mkdir(segment);
        return new PhpInstance(php, module, entries);
    }
    get dead(): boolean {
        return !this.alive;
    }
    call(name: string, ...args: unknown[]): unknown {
        if (!this.alive)
            throw new PhpRuntimeExit(null);
        const entry = this.entries.get(name);
        if (!entry)
            throw new HelixError(`o prelúdio PHP não tem a entrada ${name}.`);
        try {
            return entry(...args);
        }
        catch (cause) {
            if (isBailout(cause)) {
                this.recover();
                throw new PhpBailout(cause);
            }
            if (isRuntimeExit(cause)) {
                this.alive = false;
                throw new PhpRuntimeExit(cause);
            }
            throw cause;
        }
        finally {
            this.php.flush();
        }
    }
    private recover(): void {
        const recover = this.entries.get('recover');
        if (!recover)
            return;
        try {
            recover();
        }
        catch (cause) {
            this.alive = false;
            throw new PhpRuntimeExit(cause);
        }
    }
    writeFile(path: string, content: string | Uint8Array): void {
        this.module.FS.writeFile(path, content);
    }
}
