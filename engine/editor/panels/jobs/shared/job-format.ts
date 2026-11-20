import type { JobBatchInfo } from '@/engine/jobs/system/job-history';
const ONE_DECIMAL = { minimumFractionDigits: 1, maximumFractionDigits: 1 } as const;
const WHOLE_FROM_MS = 100;
export function formatMilliseconds(value: number): string {
    const amount = value >= WHOLE_FROM_MS ? Math.round(value).toLocaleString('pt-BR') : value.toLocaleString('pt-BR', ONE_DECIMAL);
    return `${amount} ms`;
}
export function formatSpeedup(value: number): string {
    return `${value.toLocaleString('pt-BR', ONE_DECIMAL)}×`;
}
export function describeJob(name: string, batch: JobBatchInfo | null): string {
    return batch ? `${name} · lote ${batch.index + 1}/${batch.count}` : name;
}
export function threadName(index: number): string {
    return `T${index + 1}`;
}
