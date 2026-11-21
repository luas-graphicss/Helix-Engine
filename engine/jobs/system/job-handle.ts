import type { JobCancelledError } from './job-errors';
export type JobStatus = 'waiting' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type SettledJobStatus = Extract<JobStatus, 'completed' | 'failed' | 'cancelled'>;
export type PendingJobStatus = Exclude<JobStatus, SettledJobStatus>;
export interface JobHandle<TOutput> extends PromiseLike<TOutput> {
    readonly id: number;
    readonly name: string;
    readonly status: JobStatus;
    readonly done: Promise<TOutput>;
    cancel(): void;
}
export interface JobHandleControls<TOutput> {
    readonly handle: JobHandle<TOutput>;
    advance(status: PendingJobStatus): void;
    complete(value: TOutput): void;
    fail(error: Error): void;
    abort(error: JobCancelledError): void;
    whenSettled(listener: (status: SettledJobStatus) => void): void;
}
interface Deferred<TValue> {
    readonly promise: Promise<TValue>;
    resolve(value: TValue): void;
    reject(error: Error): void;
}
function createDeferred<TValue>(): Deferred<TValue> {
    let resolve: Deferred<TValue>['resolve'] = () => undefined;
    let reject: Deferred<TValue>['reject'] = () => undefined;
    const promise = new Promise<TValue>((onResolve, onReject) => {
        resolve = onResolve;
        reject = onReject;
    });
    return { promise, resolve, reject };
}
function isSettled(status: JobStatus): status is SettledJobStatus {
    return status === 'completed' || status === 'failed' || status === 'cancelled';
}
export function createJobHandle<TOutput>(id: number, name: string, initial: PendingJobStatus, requestCancel: () => void): JobHandleControls<TOutput> {
    const deferred = createDeferred<TOutput>();
    const listeners: Array<(status: SettledJobStatus) => void> = [];
    let status: JobStatus = initial;
    const settle = (next: SettledJobStatus): boolean => {
        if (isSettled(status))
            return false;
        status = next;
        for (const listener of listeners.splice(0))
            listener(next);
        return true;
    };
    const handle: JobHandle<TOutput> = {
        id,
        name,
        get status() {
            return status;
        },
        done: deferred.promise,
        cancel: requestCancel,
        then: (onFulfilled, onRejected) => deferred.promise.then(onFulfilled, onRejected),
    };
    return {
        handle,
        advance: (next) => {
            if (!isSettled(status))
                status = next;
        },
        complete: (value) => {
            if (settle('completed'))
                deferred.resolve(value);
        },
        fail: (error) => {
            if (settle('failed'))
                deferred.reject(error);
        },
        abort: (error) => {
            if (!settle('cancelled'))
                return;
            deferred.promise.catch(() => undefined);
            deferred.reject(error);
        },
        whenSettled: (listener) => {
            if (isSettled(status))
                listener(status);
            else
                listeners.push(listener);
        },
    };
}
