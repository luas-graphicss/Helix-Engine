import { gainToDb } from '@/engine/audio/core/decibels';
export interface LevelReading {
    peakDb: number;
    rmsDb: number;
}
const FFT_SIZE = 1024;
export class LevelMeter {
    readonly input: AudioNode;
    private readonly analysers: AnalyserNode[] = [];
    private readonly scratch: Float32Array<ArrayBuffer>;
    constructor(context: BaseAudioContext, readonly channels: 1 | 2 = 2) {
        this.scratch = new Float32Array(FFT_SIZE);
        if (channels === 1) {
            const analyser = context.createAnalyser();
            analyser.fftSize = FFT_SIZE;
            this.analysers.push(analyser);
            this.input = analyser;
            return;
        }
        const splitter = context.createChannelSplitter(2);
        for (let channel = 0; channel < 2; channel++) {
            const analyser = context.createAnalyser();
            analyser.fftSize = FFT_SIZE;
            splitter.connect(analyser, channel);
            this.analysers.push(analyser);
        }
        this.input = splitter;
    }
    read(out: LevelReading[]): void {
        for (let channel = 0; channel < this.analysers.length; channel++) {
            this.analysers[channel].getFloatTimeDomainData(this.scratch);
            let peak = 0;
            let sumSquares = 0;
            for (let i = 0; i < FFT_SIZE; i++) {
                const value = this.scratch[i];
                const magnitude = Math.abs(value);
                if (magnitude > peak)
                    peak = magnitude;
                sumSquares += value * value;
            }
            const reading = out[channel] ?? (out[channel] = { peakDb: Number.NEGATIVE_INFINITY, rmsDb: Number.NEGATIVE_INFINITY });
            reading.peakDb = gainToDb(peak);
            reading.rmsDb = gainToDb(Math.sqrt(sumSquares / FFT_SIZE));
        }
    }
    dispose(): void {
        this.input.disconnect();
        for (const analyser of this.analysers)
            analyser.disconnect();
    }
}
