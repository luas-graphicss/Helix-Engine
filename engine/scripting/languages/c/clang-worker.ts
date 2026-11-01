import { ClangToolchain, type ToolchainCompileRequest, type ToolchainCompileResult } from './clang-toolchain';
export interface ClangWorkerLoad {
    readonly id: number;
    readonly kind: 'load';
    readonly baseUrl: string;
}
export interface ClangWorkerCompile {
    readonly id: number;
    readonly kind: 'compile';
    readonly request: ToolchainCompileRequest;
}
export type ClangWorkerRequest = ClangWorkerLoad | ClangWorkerCompile;
export type ClangWorkerReply = {
    readonly id: number;
    readonly ok: true;
    readonly kind: 'load';
    readonly version: string;
} | {
    readonly id: number;
    readonly ok: true;
    readonly kind: 'compile';
    readonly result: ToolchainCompileResult;
} | {
    readonly id: number;
    readonly ok: false;
    readonly error: string;
};
interface WorkerScope {
    onmessage: ((event: MessageEvent<ClangWorkerRequest>) => void) | null;
    postMessage(message: ClangWorkerReply, transfer?: Transferable[]): void;
}
const scope = self as unknown as WorkerScope;
let toolchain: ClangToolchain | null = null;
scope.onmessage = async (event) => {
    const message = event.data;
    try {
        if (message.kind === 'load') {
            if (!toolchain)
                toolchain = new ClangToolchain({ baseUrl: message.baseUrl });
            await toolchain.load();
            scope.postMessage({ id: message.id, ok: true, kind: 'load', version: toolchain.version });
            return;
        }
        if (!toolchain)
            throw new Error('a toolchain C/C++ ainda não foi carregada neste worker.');
        const result = await toolchain.compile(message.request);
        const transfer = result.wasm && result.wasm.buffer instanceof ArrayBuffer ? [result.wasm.buffer] : [];
        scope.postMessage({ id: message.id, ok: true, kind: 'compile', result }, transfer);
    }
    catch (cause) {
        scope.postMessage({ id: message.id, ok: false, error: cause instanceof Error ? cause.message : String(cause) });
    }
};
