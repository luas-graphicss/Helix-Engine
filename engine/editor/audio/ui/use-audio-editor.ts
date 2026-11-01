'use client';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { LevelMeter, LevelReading } from '@/engine/audio/analysis/level-meter';
import type { AudioEngine } from '@/engine/audio/audio-engine';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { AudioEditor } from '../audio-editor';
export function useAudioEditor(): AudioEditor {
    const { audio } = useEditorSession();
    useSyncExternalStore(audio.subscribe, audio.getVersion, audio.getVersion);
    return audio;
}
export function useAudioPosition(): number {
    const { audio } = useEditorSession();
    useSyncExternalStore(audio.subscribeTime, audio.getTimeVersion, audio.getTimeVersion);
    return audio.position;
}
export interface MeterChannel {
    levelDb: number;
    peakDb: number;
}
const REDUCTION_EPSILON_DB = 0.05;
export function useLimiterReductionFrames(engine: AudioEngine, active: boolean, onFrame: (reductionDb: number) => void): void {
    const onFrameRef = useRef(onFrame);
    onFrameRef.current = onFrame;
    useEffect(() => {
        if (!active) {
            onFrameRef.current(0);
            return;
        }
        let frame = 0;
        let delivered = Number.NaN;
        const tick = () => {
            const next = Math.min(0, engine.limiterReductionDb);
            if (!(Math.abs(delivered - next) <= REDUCTION_EPSILON_DB)) {
                delivered = next;
                onFrameRef.current(next);
            }
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [engine, active]);
}
const DECAY_DB_PER_SECOND = 28;
const PEAK_HOLD_SECONDS = 1.4;
export const METER_FLOOR_DB = -72;
const FLOOR_DB = METER_FLOOR_DB;
export function useLevelMeterFrames(meter: LevelMeter | null, active: boolean, onFrame: (channels: readonly MeterChannel[], now: number) => void): void {
    const channelCount = meter?.channels ?? 2;
    const onFrameRef = useRef(onFrame);
    onFrameRef.current = onFrame;
    useEffect(() => {
        const channels: MeterChannel[] = Array.from({ length: channelCount }, () => ({ levelDb: FLOOR_DB, peakDb: FLOOR_DB }));
        if (!meter || !active) {
            onFrameRef.current(channels, performance.now());
            return;
        }
        const peakAt = new Array<number>(channelCount).fill(0);
        const readings: LevelReading[] = [];
        let frame = 0;
        let last = performance.now();
        const tick = (now: number) => {
            const dt = Math.min(0.1, (now - last) / 1000);
            last = now;
            meter.read(readings);
            for (let channel = 0; channel < channelCount; channel++) {
                const reading = readings[channel];
                const state = channels[channel];
                const instant = Math.max(FLOOR_DB, reading ? reading.peakDb : FLOOR_DB);
                state.levelDb = instant >= state.levelDb ? instant : Math.max(FLOOR_DB, state.levelDb - DECAY_DB_PER_SECOND * dt);
                if (instant >= state.peakDb || now - peakAt[channel] > PEAK_HOLD_SECONDS * 1000) {
                    state.peakDb = instant;
                    peakAt[channel] = now;
                }
            }
            onFrameRef.current(channels, now);
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [meter, active, channelCount]);
}
