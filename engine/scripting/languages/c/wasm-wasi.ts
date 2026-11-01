export class WasmExit extends Error {
    constructor(readonly code: number) {
        super(`exit(${code})`);
        this.name = 'WasmExit';
    }
}
export interface WasiHooks {
    write(fd: 1 | 2, line: string): void;
}
const ERRNO_SUCCESS = 0;
const ERRNO_BADF = 8;
const ERRNO_NOENT = 44;
const ERRNO_NOSYS = 52;
const ERRNO_SPIPE = 70;
const FILETYPE_CHARACTER_DEVICE = 2;
const RIGHTS_STDIO = 0x40n | 0x2n | 0x1n | 0x200000n;
type Imports = Record<string, (...args: never[]) => unknown>;
export class MinimalWasi {
    private memory: WebAssembly.Memory | null = null;
    private readonly pending: [
        string,
        string,
        string
    ] = ['', '', ''];
    private readonly decoder = new TextDecoder();
    private readonly started = typeof performance !== 'undefined' ? performance.now() : Date.now();
    constructor(private readonly hooks: WasiHooks) { }
    attach(memory: WebAssembly.Memory): void {
        this.memory = memory;
    }
    flush(): void {
        for (const fd of [1, 2] as const) {
            const rest = this.pending[fd];
            if (rest.length === 0)
                continue;
            this.pending[fd] = '';
            this.hooks.write(fd, rest);
        }
    }
    imports(names: readonly string[]): Imports {
        const base = this.base();
        const out: Imports = {};
        for (const name of names) {
            out[name] = base[name] ?? ((() => ERRNO_NOSYS) as never);
        }
        return out;
    }
    private view(): DataView {
        if (!this.memory)
            throw new Error('a memória do módulo ainda não foi ligada ao WASI.');
        return new DataView(this.memory.buffer);
    }
    private bytes(): Uint8Array {
        if (!this.memory)
            throw new Error('a memória do módulo ainda não foi ligada ao WASI.');
        return new Uint8Array(this.memory.buffer);
    }
    private emit(fd: 1 | 2, chunk: Uint8Array): void {
        const text = this.pending[fd] + this.decoder.decode(chunk, { stream: true });
        const lines = text.split('\n');
        this.pending[fd] = lines.pop() ?? '';
        for (const line of lines)
            this.hooks.write(fd, line);
    }
    private base(): Imports {
        const self = this;
        return {
            fd_write(fd: number, iovs: number, iovsLength: number, written: number) {
                const view = self.view();
                const bytes = self.bytes();
                let total = 0;
                const chunks: Uint8Array[] = [];
                for (let i = 0; i < iovsLength; i++) {
                    const ptr = view.getUint32(iovs + i * 8, true);
                    const length = view.getUint32(iovs + i * 8 + 4, true);
                    chunks.push(bytes.subarray(ptr, ptr + length));
                    total += length;
                }
                view.setUint32(written, total, true);
                if (fd !== 1 && fd !== 2)
                    return ERRNO_BADF;
                if (chunks.length === 1)
                    self.emit(fd, chunks[0]);
                else {
                    const joined = new Uint8Array(total);
                    let offset = 0;
                    for (const chunk of chunks) {
                        joined.set(chunk, offset);
                        offset += chunk.length;
                    }
                    self.emit(fd, joined);
                }
                return ERRNO_SUCCESS;
            },
            fd_read(fd: number, _iovs: number, _iovsLength: number, read: number) {
                self.view().setUint32(read, 0, true);
                return fd === 0 ? ERRNO_SUCCESS : ERRNO_BADF;
            },
            fd_pread(_fd: number, _iovs: number, _iovsLength: number, _offset: bigint, read: number) {
                self.view().setUint32(read, 0, true);
                return ERRNO_BADF;
            },
            fd_close() {
                return ERRNO_SUCCESS;
            },
            fd_seek(_fd: number, _offset: bigint, _whence: number, result: number) {
                self.view().setBigUint64(result, 0n, true);
                return ERRNO_SPIPE;
            },
            fd_tell(_fd: number, result: number) {
                self.view().setBigUint64(result, 0n, true);
                return ERRNO_SPIPE;
            },
            fd_sync() {
                return ERRNO_SUCCESS;
            },
            fd_datasync() {
                return ERRNO_SUCCESS;
            },
            fd_fdstat_get(fd: number, ptr: number) {
                if (fd > 2)
                    return ERRNO_BADF;
                const view = self.view();
                view.setUint8(ptr, FILETYPE_CHARACTER_DEVICE);
                view.setUint16(ptr + 2, 0, true);
                view.setBigUint64(ptr + 8, RIGHTS_STDIO, true);
                view.setBigUint64(ptr + 16, 0n, true);
                return ERRNO_SUCCESS;
            },
            fd_fdstat_set_flags() {
                return ERRNO_SUCCESS;
            },
            fd_filestat_get(fd: number, ptr: number) {
                if (fd > 2)
                    return ERRNO_BADF;
                const bytes = self.bytes();
                bytes.fill(0, ptr, ptr + 64);
                bytes[ptr + 16] = FILETYPE_CHARACTER_DEVICE;
                return ERRNO_SUCCESS;
            },
            fd_prestat_get() {
                return ERRNO_BADF;
            },
            fd_prestat_dir_name() {
                return ERRNO_BADF;
            },
            fd_readdir(_fd: number, _buf: number, _length: number, _cookie: bigint, used: number) {
                self.view().setUint32(used, 0, true);
                return ERRNO_BADF;
            },
            path_open() {
                return ERRNO_NOENT;
            },
            path_filestat_get() {
                return ERRNO_NOENT;
            },
            path_create_directory() {
                return ERRNO_NOSYS;
            },
            path_unlink_file() {
                return ERRNO_NOENT;
            },
            path_remove_directory() {
                return ERRNO_NOENT;
            },
            path_rename() {
                return ERRNO_NOENT;
            },
            path_readlink() {
                return ERRNO_NOENT;
            },
            path_symlink() {
                return ERRNO_NOSYS;
            },
            path_link() {
                return ERRNO_NOSYS;
            },
            proc_exit(code: number) {
                throw new WasmExit(code);
            },
            proc_raise() {
                return ERRNO_NOSYS;
            },
            sched_yield() {
                return ERRNO_SUCCESS;
            },
            environ_sizes_get(count: number, size: number) {
                const view = self.view();
                view.setUint32(count, 0, true);
                view.setUint32(size, 0, true);
                return ERRNO_SUCCESS;
            },
            environ_get() {
                return ERRNO_SUCCESS;
            },
            args_sizes_get(count: number, size: number) {
                const view = self.view();
                view.setUint32(count, 0, true);
                view.setUint32(size, 0, true);
                return ERRNO_SUCCESS;
            },
            args_get() {
                return ERRNO_SUCCESS;
            },
            clock_time_get(id: number, _precision: bigint, result: number) {
                const nanos = id === 0 ? BigInt(Math.round(Date.now() * 1e6)) : BigInt(Math.round(((typeof performance !== 'undefined' ? performance.now() : Date.now()) - self.started) * 1e6));
                self.view().setBigUint64(result, nanos, true);
                return ERRNO_SUCCESS;
            },
            clock_res_get(_id: number, result: number) {
                self.view().setBigUint64(result, 1000n, true);
                return ERRNO_SUCCESS;
            },
            random_get(ptr: number, length: number) {
                const bytes = self.bytes().subarray(ptr, ptr + length);
                if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
                    for (let offset = 0; offset < bytes.length; offset += 65536)
                        crypto.getRandomValues(bytes.subarray(offset, Math.min(offset + 65536, bytes.length)));
                }
                else {
                    for (let i = 0; i < bytes.length; i++)
                        bytes[i] = Math.floor(Math.random() * 256);
                }
                return ERRNO_SUCCESS;
            },
            poll_oneoff(subscriptions: number, events: number, count: number, written: number) {
                const view = self.view();
                for (let i = 0; i < count; i++) {
                    const subscription = subscriptions + i * 48;
                    const event = events + i * 32;
                    view.setBigUint64(event, view.getBigUint64(subscription, true), true);
                    view.setUint16(event + 8, ERRNO_SUCCESS, true);
                    view.setUint8(event + 10, view.getUint8(subscription + 8));
                    view.setBigUint64(event + 16, 0n, true);
                    view.setUint16(event + 24, 0, true);
                }
                view.setUint32(written, count, true);
                return ERRNO_SUCCESS;
            },
        };
    }
}
