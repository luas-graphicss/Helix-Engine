import type { InputInteraction } from '../actions/input-asset';
export type InteractionSignal = 'started' | 'performed' | 'canceled';
export type SignalEmitter = (signal: InteractionSignal) => void;
export interface InteractionStep {
    interaction: InputInteraction;
    continuous: boolean;
    actuated: boolean;
    changed: boolean;
    delta: number;
}
export class InteractionTracker {
    private actuated = false;
    private resolved = false;
    private elapsed = 0;
    step({ interaction, continuous, actuated, changed, delta }: InteractionStep, emit: SignalEmitter): void {
        const wasActuated = this.actuated;
        this.actuated = actuated;
        if (actuated && !wasActuated)
            this.begin(interaction, emit);
        else if (actuated)
            this.sustain(interaction, continuous && changed, delta, emit);
        else if (wasActuated)
            this.end(interaction, emit);
    }
    private begin({ kind }: InputInteraction, emit: SignalEmitter): void {
        this.elapsed = 0;
        this.resolved = false;
        emit('started');
        if (kind === 'press')
            emit('performed');
    }
    private sustain({ kind, duration }: InputInteraction, valueChanged: boolean, delta: number, emit: SignalEmitter): void {
        if (kind === 'press') {
            if (valueChanged)
                emit('performed');
            return;
        }
        this.elapsed += delta;
        if (this.resolved || this.elapsed < duration)
            return;
        this.resolved = true;
        emit(kind === 'hold' ? 'performed' : 'canceled');
    }
    private end({ kind }: InputInteraction, emit: SignalEmitter): void {
        if (kind !== 'tap')
            emit('canceled');
        else if (!this.resolved)
            emit('performed');
    }
}
