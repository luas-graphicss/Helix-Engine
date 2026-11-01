export class HelixError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'HelixError';
    }
}
export class HelixNotImplementedError extends HelixError {
    constructor(readonly member: string, detail?: string) {
        super(`${member} ainda não está disponível nesta versão da engine.${detail ? ` ${detail}` : ''}`);
        this.name = 'HelixNotImplementedError';
    }
}
export class HelixArgumentError extends HelixError {
    constructor(member: string, detail: string) {
        super(`${member}: ${detail}`);
        this.name = 'HelixArgumentError';
    }
}
export class HelixModuleError extends HelixError {
    constructor(message: string) {
        super(message);
        this.name = 'HelixModuleError';
    }
}
export class TaskCancelledError extends HelixError {
    constructor() {
        super('Tarefa cancelada.');
        this.name = 'TaskCancelledError';
    }
}
export function isTaskCancelled(cause: unknown): boolean {
    return cause instanceof TaskCancelledError || (cause instanceof Error && cause.name === 'TaskCancelledError');
}
export function describeThrown(cause: unknown): string {
    if (cause instanceof Error)
        return cause.message || cause.name;
    if (typeof cause === 'string')
        return cause;
    try {
        return JSON.stringify(cause);
    }
    catch {
        return String(cause);
    }
}
export function errorName(cause: unknown): string {
    return cause instanceof Error ? cause.name : typeof cause;
}
