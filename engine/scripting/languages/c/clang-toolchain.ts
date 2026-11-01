import { ConsoleStdout, Directory, File, OpenFile, PreopenDirectory, WASI, WASIProcExit, type Fd, type Inode } from '@bjorn3/browser_wasi_shim';
export interface ToolchainFiles {
    readonly sources: Readonly<Record<string, string>>;
    readonly headers: Readonly<Record<string, string>>;
}
export interface ToolchainCompileRequest extends ToolchainFiles {
    readonly file: string;
    readonly language: 'c' | 'cpp';
    readonly flags?: readonly string[];
    readonly exports?: readonly string[];
    readonly syntaxOnly?: boolean;
}
export interface ToolchainCompileResult {
    readonly wasm: Uint8Array | null;
    readonly output: string;
    readonly exitCode: number;
    readonly phase: 'compile' | 'link' | 'done';
}
export interface ToolchainOptions {
    readonly baseUrl: string;
    readonly fetchBytes?: (url: string) => Promise<Uint8Array>;
}
const CLANG_VERSION = '8.0.1';
const STACK_SIZE = 2 * 1024 * 1024;
const MAX_MEMORY = 512 * 1024 * 1024;
const ERRNO_BADF = 8;
const ERRNO_NOSYS = 52;
export class ClangToolchain {
    private clang: WebAssembly.Module | null = null;
    private lld: WebAssembly.Module | null = null;
    private sysroot: Map<string, Inode> | null = null;
    private loading: Promise<void> | null = null;
    constructor(private readonly options: ToolchainOptions) { }
    get version(): string {
        return `clang ${CLANG_VERSION}`;
    }
    get loaded(): boolean {
        return this.clang !== null && this.lld !== null && this.sysroot !== null;
    }
    load(): Promise<void> {
        if (!this.loading) {
            this.loading = (async () => {
                const [clang, lld, tar] = await Promise.all([this.compileModule('clang.wasm'), this.compileModule('lld.wasm'), this.bytes('sysroot.tar')]);
                this.sysroot = untar(tar);
                this.clang = clang;
                this.lld = lld;
            })().catch((cause: unknown) => {
                this.loading = null;
                throw cause;
            });
        }
        return this.loading;
    }
    private url(name: string): string {
        return `${this.options.baseUrl.replace(/\/?$/, '/')}${name}`;
    }
    private async bytes(name: string): Promise<Uint8Array> {
        if (this.options.fetchBytes)
            return this.options.fetchBytes(this.url(name));
        const response = await fetch(this.url(name));
        if (!response.ok)
            throw new Error(`não foi possível baixar ${name} (${response.status}).`);
        return new Uint8Array(await response.arrayBuffer());
    }
    private async compileModule(name: string): Promise<WebAssembly.Module> {
        if (!this.options.fetchBytes && typeof WebAssembly.compileStreaming === 'function') {
            const response = await fetch(this.url(name));
            if (!response.ok)
                throw new Error(`não foi possível baixar ${name} (${response.status}).`);
            try {
                return await WebAssembly.compileStreaming(response);
            }
            catch {
            }
        }
        return WebAssembly.compile(await this.bytes(name));
    }
    async compile(request: ToolchainCompileRequest): Promise<ToolchainCompileResult> {
        await this.load();
        const clang = this.clang;
        const lld = this.lld;
        const sysroot = this.sysroot;
        if (!clang || !lld || !sysroot)
            throw new Error('a toolchain C/C++ não terminou de carregar.');
        const src = new Directory(Object.entries(request.sources).map(([name, text]) => [name, textFile(text)]));
        const helix = new Directory(Object.entries(request.headers).map(([name, text]) => [name, textFile(text)]));
        const out = new Directory([]);
        const tmp = new Directory([]);
        const root = new Directory(new Map<string, Inode>([...sysroot, ['src', src], ['helix', helix], ['out', out], ['tmp', tmp]]));
        const stem = request.file.replace(/\.[^.]+$/, '');
        const object = `/out/${stem}.o`;
        const output = `/out/${stem}.wasm`;
        const isCpp = request.language === 'cpp';
        const clangArgs = [
            'clang',
            '-cc1',
            '-triple',
            'wasm32-unknown-wasi',
            '-emit-obj',
            '-disable-free',
            '-isysroot',
            '/',
            ...(isCpp ? ['-internal-isystem', '/include/c++/v1'] : []),
            '-internal-isystem',
            '/include',
            '-internal-isystem',
            `/lib/clang/${CLANG_VERSION}/include`,
            '-internal-isystem',
            '/helix',
            '-I/src',
            '-ferror-limit',
            '19',
            '-fmessage-length',
            '0',
            '-fno-caret-diagnostics',
            '-fdiagnostics-print-source-range-info',
            '-O2',
            '-fno-rtti',
            '-fvisibility',
            'hidden',
            ...(isCpp ? ['-std=c++17', '-x', 'c++'] : ['-std=c17', '-x', 'c']),
            ...(request.flags ?? []),
            ...(request.syntaxOnly ? ['-fsyntax-only'] : ['-o', object]),
            `/src/${request.file}`,
        ];
        const compiled = runTool(clang, clangArgs, root);
        if (request.syntaxOnly) {
            return { wasm: null, output: compiled.output, exitCode: compiled.exitCode, phase: compiled.exitCode === 0 ? 'done' : 'compile' };
        }
        if (compiled.exitCode !== 0 || !findFile(out, `${stem}.o`)) {
            return { wasm: null, output: compiled.output, exitCode: compiled.exitCode, phase: 'compile' };
        }
        const ldArgs = [
            'wasm-ld',
            '--no-entry',
            '--export-dynamic',
            '--export-table',
            '--export=__wasm_call_ctors',
            '--export=main',
            '--export=__stack_pointer',
            ...(request.exports ?? []).map((name) => `--export=${name}`),
            '--allow-undefined',
            '-z',
            `stack-size=${STACK_SIZE}`,
            `--max-memory=${MAX_MEMORY}`,
            '-L/lib/wasm32-wasi',
            object,
            ...(isCpp ? ['-lc++', '-lc++abi'] : []),
            '-lc',
            `/lib/clang/${CLANG_VERSION}/lib/wasi/libclang_rt.builtins-wasm32.a`,
            '-o',
            output,
        ];
        const linked = runTool(lld, ldArgs, root);
        const wasm = findFile(out, `${stem}.wasm`);
        if (linked.exitCode !== 0 || !wasm) {
            return { wasm: null, output: `${compiled.output}${linked.output}`, exitCode: linked.exitCode, phase: 'link' };
        }
        return { wasm: wasm.data.slice(), output: `${compiled.output}${linked.output}`, exitCode: 0, phase: 'done' };
    }
}
function textFile(text: string): File {
    return new File(new TextEncoder().encode(text));
}
function findFile(directory: Directory, name: string): File | null {
    const inode = directory.contents.get(name);
    return inode instanceof File ? inode : null;
}
interface ToolRun {
    readonly exitCode: number;
    readonly output: string;
}
function runTool(module: WebAssembly.Module, args: string[], root: Directory): ToolRun {
    const chunks: string[] = [];
    const collect = (line: string) => {
        chunks.push(line);
    };
    const fds: Fd[] = [new OpenFile(new File(new Uint8Array(0))), ConsoleStdout.lineBuffered(collect), ConsoleStdout.lineBuffered(collect), new PreopenDirectory('/', root.contents)];
    const wasi = new WASI(args, ['HOME=/tmp', 'TMPDIR=/tmp', 'PWD=/'], fds, { debug: false });
    const imports = legacyWasiImports(wasi);
    const instance = new WebAssembly.Instance(module, { wasi_unstable: imports, wasi_snapshot_preview1: imports });
    let exitCode = 0;
    try {
        exitCode = wasi.start(instance as never);
    }
    catch (cause) {
        if (cause instanceof WASIProcExit)
            exitCode = cause.code;
        else {
            const message = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
            chunks.push(`erro interno do compilador: ${message}`);
            exitCode = 70;
        }
    }
    return { exitCode, output: chunks.length > 0 ? `${chunks.join('\n')}\n` : '' };
}
function legacyWasiImports(wasi: WASI): Record<string, (...args: never[]) => unknown> {
    const base = wasi.wasiImport;
    const memory = () => (wasi.inst.exports.memory as WebAssembly.Memory).buffer;
    const legacy: Record<string, (...args: never[]) => unknown> = { ...base };
    const WHENCE_LEGACY_TO_PREVIEW1: Record<number, number> = { 0: 1, 1: 2, 2: 0 };
    legacy.fd_seek = ((fd: number, offset: bigint, whence: number, result: number) => base.fd_seek(fd, offset, WHENCE_LEGACY_TO_PREVIEW1[whence] ?? whence, result)) as never;
    const rewriteFilestat = (ptr: number) => {
        const view = new DataView(memory());
        const dev = view.getBigUint64(ptr, true);
        const ino = view.getBigUint64(ptr + 8, true);
        const filetype = view.getUint8(ptr + 16);
        const nlink = view.getBigUint64(ptr + 24, true);
        const size = view.getBigUint64(ptr + 32, true);
        const atim = view.getBigUint64(ptr + 40, true);
        const mtim = view.getBigUint64(ptr + 48, true);
        const ctim = view.getBigUint64(ptr + 56, true);
        view.setBigUint64(ptr, dev, true);
        view.setBigUint64(ptr + 8, ino, true);
        view.setUint8(ptr + 16, filetype);
        view.setUint32(ptr + 20, Number(nlink & 0xffffffffn), true);
        view.setBigUint64(ptr + 24, size, true);
        view.setBigUint64(ptr + 32, atim, true);
        view.setBigUint64(ptr + 40, mtim, true);
        view.setBigUint64(ptr + 48, ctim, true);
    };
    legacy.fd_filestat_get = ((fd: number, buf: number) => {
        const ret = base.fd_filestat_get(fd, buf) as number;
        if (ret === 0)
            rewriteFilestat(buf);
        return ret;
    }) as never;
    const ALL_RIGHTS = (1n << 29n) - 1n;
    legacy.fd_fdstat_get = ((fd: number, buf: number) => {
        const ret = base.fd_fdstat_get(fd, buf) as number;
        if (ret === 0) {
            const view = new DataView(memory());
            view.setBigUint64(buf + 8, ALL_RIGHTS, true);
            view.setBigUint64(buf + 16, ALL_RIGHTS, true);
        }
        return ret;
    }) as never;
    legacy.path_filestat_get = ((fd: number, flags: number, path: number, length: number, buf: number) => {
        const ret = base.path_filestat_get(fd, flags, path, length, buf) as number;
        if (ret === 0)
            rewriteFilestat(buf);
        return ret;
    }) as never;
    for (const name of ['path_symlink', 'fd_fdstat_set_flags', 'poll_oneoff', 'sock_recv', 'sock_send', 'sock_shutdown', 'proc_raise', 'sched_yield']) {
        if (!(name in legacy))
            legacy[name] = (() => (name === 'fd_fdstat_set_flags' ? 0 : ERRNO_NOSYS)) as never;
    }
    if (!('fd_prestat_get' in legacy))
        legacy.fd_prestat_get = (() => ERRNO_BADF) as never;
    return legacy;
}
