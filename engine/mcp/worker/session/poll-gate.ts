export type PollWake = 'released' | 'timeout' | 'superseded' | 'aborted';
export class PollGate {
    private finishCurrent: ((wake: PollWake) => void) | null = null;
    get waiting(): boolean {
        return this.finishCurrent !== null;
    }
    wait(waitMs: number, signal: AbortSignal): Promise<PollWake> {
        this.finishCurrent?.('superseded');
        return new Promise((resolve) => {
            const finish = (wake: PollWake) => {
                clearTimeout(timer);
                signal.removeEventListener('abort', onAbort);
                if (this.finishCurrent === finish)
                    this.finishCurrent = null;
                resolve(wake);
            };
            const onAbort = () => finish('aborted');
            const timer = setTimeout(() => finish('timeout'), waitMs);
            signal.addEventListener('abort', onAbort, { once: true });
            this.finishCurrent = finish;
            if (signal.aborted)
                finish('aborted');
        });
    }
    release(): void {
        this.finishCurrent?.('released');
    }
}
