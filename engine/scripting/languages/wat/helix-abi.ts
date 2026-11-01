export type WasmValueType = 'i32' | 'i64' | 'f32' | 'f64' | 'v128' | 'funcref' | 'externref';
export interface WasmFunctionSignature {
    readonly params: readonly WasmValueType[];
    readonly results: readonly WasmValueType[];
}
const I32: WasmValueType = 'i32';
const F64: WasmValueType = 'f64';
function signature(params: readonly WasmValueType[], results: readonly WasmValueType[] = []): WasmFunctionSignature {
    return { params, results };
}
export const HELIX_ABI: Readonly<Record<string, WasmFunctionSignature>> = {
    retain: signature([I32], [I32]),
    release: signature([I32]),
    type: signature([I32], [I32]),
    equals: signature([I32, I32], [I32]),
    root: signature([], [I32]),
    script: signature([], [I32]),
    self: signature([], [I32]),
    require: signature([I32, I32], [I32]),
    number: signature([F64], [I32]),
    boolean: signature([I32], [I32]),
    string: signature([I32, I32], [I32]),
    null: signature([], [I32]),
    array: signature([], [I32]),
    object: signature([], [I32]),
    function: signature([I32, I32, I32], [I32]),
    callback: signature([I32], [I32]),
    pool: signature([I32], [I32]),
    to_number: signature([I32], [F64]),
    to_boolean: signature([I32], [I32]),
    string_bytes: signature([I32], [I32]),
    string_copy: signature([I32, I32, I32], [I32]),
    string_read: signature([I32, I32, I32], [I32]),
    get: signature([I32, I32, I32], [I32]),
    index: signature([I32, I32], [I32]),
    set: signature([I32, I32, I32, I32]),
    set_index: signature([I32, I32, I32]),
    has: signature([I32, I32, I32], [I32]),
    delete: signature([I32, I32, I32]),
    length: signature([I32], [I32]),
    keys: signature([I32], [I32]),
    call: signature([I32, I32, I32], [I32]),
    invoke: signature([I32, I32, I32, I32, I32], [I32]),
    construct: signature([I32, I32, I32], [I32]),
    log: signature([I32, I32, I32]),
    throw: signature([I32, I32]),
    now: signature([], [F64]),
    fault_cell: signature([I32]),
    fault_take: signature([I32, I32], [I32]),
};
export const HELIX_IMPORT_MODULES: ReadonlySet<string> = new Set(['helix', 'env']);
export const WASI_IMPORT_MODULES: ReadonlySet<string> = new Set(['wasi_snapshot_preview1', 'wasi_unstable']);
export function formatSignature({ params, results }: WasmFunctionSignature): string {
    const parts: string[] = [];
    if (params.length > 0)
        parts.push(`(param ${params.join(' ')})`);
    if (results.length > 0)
        parts.push(`(result ${results.join(' ')})`);
    return parts.length > 0 ? parts.join(' ') : 'sem parâmetros nem resultado';
}
export function sameSignature(a: WasmFunctionSignature, b: WasmFunctionSignature): boolean {
    return a.params.length === b.params.length && a.results.length === b.results.length && a.params.every((type, index) => type === b.params[index]) && a.results.every((type, index) => type === b.results[index]);
}
