export interface PredictedInput<TInput> {
    readonly tick: number;
    readonly input: TInput;
}
interface PredictedFrame<TState, TInput> extends PredictedInput<TInput> {
    state: TState;
}
export interface PredictionModel<TState, TInput> {
    readonly deltaSeconds: number;
    step(state: TState, input: TInput, deltaSeconds: number): TState;
    diverged(predicted: TState, authoritative: TState): boolean;
}
const DEFAULT_CAPACITY = 128;
export class PredictionBuffer<TState, TInput> {
    private frames: PredictedFrame<TState, TInput>[] = [];
    constructor(private readonly model: PredictionModel<TState, TInput>, private readonly capacity = DEFAULT_CAPACITY) { }
    get pendingCount(): number {
        return this.frames.length;
    }
    predict(tick: number, input: TInput, current: TState): TState {
        const state = this.model.step(current, input, this.model.deltaSeconds);
        this.frames.push({ tick, input, state });
        if (this.frames.length > this.capacity)
            this.frames.shift();
        return state;
    }
    recentInputs(limit: number): PredictedInput<TInput>[] {
        return this.frames.slice(-limit).map(({ tick, input }) => ({ tick, input }));
    }
    reconcile(acknowledgedTick: number, authoritative: TState): TState | null {
        const acknowledged = this.frames.find((frame) => frame.tick === acknowledgedTick);
        this.frames = this.frames.filter((frame) => frame.tick > acknowledgedTick);
        if (acknowledged && !this.model.diverged(acknowledged.state, authoritative))
            return null;
        let state = authoritative;
        for (const frame of this.frames) {
            state = this.model.step(state, frame.input, this.model.deltaSeconds);
            frame.state = state;
        }
        return state;
    }
}
