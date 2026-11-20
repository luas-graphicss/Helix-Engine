export const JOB_BUFFER_KINDS = ['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'float32', 'float64'] as const;
export type JobBufferKind = (typeof JOB_BUFFER_KINDS)[number];
export type JobArray = Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array;
interface JobArrayConstructor {
    readonly BYTES_PER_ELEMENT: number;
    new (length: number): JobArray;
    new (buffer: ArrayBufferLike, byteOffset: number, length: number): JobArray;
}
const CONSTRUCTORS: Record<JobBufferKind, JobArrayConstructor> = {
    int8: Int8Array,
    uint8: Uint8Array,
    int16: Int16Array,
    uint16: Uint16Array,
    int32: Int32Array,
    uint32: Uint32Array,
    float32: Float32Array,
    float64: Float64Array,
};
export const MAX_JOB_BUFFER_BYTES = 1024 * 1024 * 1024;
export function isJobBufferKind(value: unknown): value is JobBufferKind {
    return typeof value === 'string' && (JOB_BUFFER_KINDS as readonly string[]).includes(value);
}
function kindOf(value: unknown): JobBufferKind | undefined {
    return JOB_BUFFER_KINDS.find((kind) => value instanceof CONSTRUCTORS[kind]);
}
export function isJobArray(value: unknown): value is JobArray {
    return kindOf(value) !== undefined;
}
export function jobArrayKind(array: JobArray): JobBufferKind {
    const kind = kindOf(array);
    if (!kind)
        throw new TypeError('O array não é um dos tipos numéricos aceitos pelos jobs.');
    return kind;
}
export function isSharedBuffer(buffer: ArrayBufferLike): buffer is SharedArrayBuffer {
    return typeof SharedArrayBuffer !== 'undefined' && buffer instanceof SharedArrayBuffer;
}
export function createJobBuffer(kind: JobBufferKind, length: number, shared: boolean): JobArray {
    const constructor = CONSTRUCTORS[kind];
    const bytes = length * constructor.BYTES_PER_ELEMENT;
    if (!Number.isInteger(length) || length < 0 || bytes > MAX_JOB_BUFFER_BYTES)
        throw new RangeError(`Tamanho de buffer inválido: ${length} elementos de ${kind} (o limite é ${MAX_JOB_BUFFER_BYTES} bytes).`);
    return shared ? new constructor(new SharedArrayBuffer(bytes), 0, length) : new constructor(length);
}
export function viewJobBuffer(kind: JobBufferKind, buffer: ArrayBufferLike, byteOffset: number, length: number): JobArray {
    return new CONSTRUCTORS[kind](buffer, byteOffset, length);
}
