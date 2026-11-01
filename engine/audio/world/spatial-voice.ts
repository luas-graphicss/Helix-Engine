import type { Vec3 } from '@/engine/core/math/vec3';
import type { AudioEngine } from '@/engine/audio/audio-engine';
import type { AudioClipSettings } from '@/engine/audio/clip/audio-clip-settings';
import { dbToGain } from '@/engine/audio/core/decibels';
import { AudioVoice, type VoiceOptions } from '@/engine/audio/playback/audio-voice';
import type { AudioSourceSettings } from './audio-source-settings';
import { clampCutoff, OPEN_FILTER_HZ } from './spatial-filter';
const POSE_SMOOTHING = 0.02;
const LEVEL_SMOOTHING = 0.06;
export function deriveSourceClip(clip: AudioClipSettings, source: AudioSourceSettings): AudioClipSettings {
    return {
        ...clip,
        pitch: Math.max(-48, Math.min(48, clip.pitch + source.pitch)),
        pan: source.spatial ? 0 : clip.pan,
        loop: source.loopMode === 'clip' ? clip.loop : source.loopMode === 'loop',
    };
}
export class SpatialVoice {
    readonly voice: AudioVoice;
    private readonly panner: PannerNode | null;
    private readonly filter: BiquadFilterNode;
    private readonly level: GainNode;
    private readonly fade: GainNode;
    private readonly send: GainNode;
    private disposed = false;
    constructor(private readonly context: AudioContext, private readonly engine: AudioEngine, buffer: AudioBuffer, clip: AudioClipSettings, source: AudioSourceSettings, busInput: AudioNode, reverbInput: AudioNode, options: VoiceOptions = {}) {
        this.panner = source.spatial ? context.createPanner() : null;
        this.filter = context.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = OPEN_FILTER_HZ;
        this.filter.Q.value = 0.5;
        this.level = context.createGain();
        this.level.gain.value = dbToGain(source.volumeDb);
        this.fade = context.createGain();
        this.fade.gain.value = 0;
        this.send = context.createGain();
        this.send.gain.value = source.reverbSend;
        if (this.panner)
            this.panner.connect(this.filter);
        this.filter.connect(this.level);
        this.level.connect(this.fade);
        this.fade.connect(busInput);
        this.fade.connect(this.send);
        this.send.connect(reverbInput);
        this.voice = new AudioVoice(context, buffer, deriveSourceClip(clip, source), this.panner ?? this.filter, options);
        engine.adopt(this.voice);
        this.applySource(source);
    }
    get spatial(): boolean {
        return this.panner !== null;
    }
    applySource(source: AudioSourceSettings): void {
        const { panner } = this;
        if (panner) {
            panner.panningModel = source.panningModel === 'hrtf' ? 'HRTF' : 'equalpower';
            panner.distanceModel = source.distanceModel;
            panner.refDistance = Math.max(1e-3, source.minDistance);
            panner.maxDistance = Math.max(source.maxDistance, source.minDistance + 1e-2);
            panner.rolloffFactor = source.distanceModel === 'linear' ? Math.min(1, source.rolloff) : source.rolloff;
            if (source.cone.enabled) {
                panner.coneInnerAngle = source.cone.innerAngle;
                panner.coneOuterAngle = Math.max(source.cone.outerAngle, source.cone.innerAngle);
                panner.coneOuterGain = dbToGain(source.cone.outerGainDb);
            }
            else {
                panner.coneInnerAngle = 360;
                panner.coneOuterAngle = 360;
                panner.coneOuterGain = 1;
            }
        }
    }
    setSend(gain: number): void {
        this.send.gain.setTargetAtTime(Math.max(0, gain), this.context.currentTime, LEVEL_SMOOTHING);
    }
    setPose(position: Vec3, forward: Vec3, immediate = false): void {
        const { panner } = this;
        if (!panner)
            return;
        const now = this.context.currentTime;
        if ('positionX' in panner && panner.positionX) {
            const params: Array<[
                AudioParam,
                number
            ]> = [
                [panner.positionX, position[0]],
                [panner.positionY, position[1]],
                [panner.positionZ, position[2]],
                [panner.orientationX, forward[0]],
                [panner.orientationY, forward[1]],
                [panner.orientationZ, forward[2]],
            ];
            for (const [param, value] of params) {
                if (immediate) {
                    param.cancelScheduledValues(now);
                    param.setValueAtTime(value, now);
                }
                else {
                    param.setTargetAtTime(value, now, POSE_SMOOTHING);
                }
            }
            return;
        }
        panner.setPosition(position[0], position[1], position[2]);
        panner.setOrientation(forward[0], forward[1], forward[2]);
    }
    setLevel(gain: number, immediate = false): void {
        const now = this.context.currentTime;
        if (immediate) {
            this.level.gain.cancelScheduledValues(now);
            this.level.gain.setValueAtTime(gain, now);
        }
        else {
            this.level.gain.setTargetAtTime(gain, now, LEVEL_SMOOTHING);
        }
    }
    setFilter(frequency: number): void {
        this.filter.frequency.setTargetAtTime(clampCutoff(frequency), this.context.currentTime, LEVEL_SMOOTHING * 2);
    }
    setDetune(cents: number): void {
        this.voice.setDetuneOffset(cents);
    }
    fadeIn(seconds: number): void {
        const now = this.context.currentTime;
        const { gain } = this.fade;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(Math.max(gain.value, 1e-4), now);
        if (seconds <= 0.005)
            gain.setValueAtTime(1, now);
        else
            gain.linearRampToValueAtTime(1, now + seconds);
    }
    fadeOutAndDispose(seconds: number): void {
        if (this.disposed)
            return;
        const now = this.context.currentTime;
        const { gain } = this.fade;
        const duration = Math.max(0.01, seconds);
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(gain.value, now);
        gain.linearRampToValueAtTime(0, now + duration);
        setTimeout(() => this.dispose(), duration * 1000 + 30);
    }
    dispose(): void {
        if (this.disposed)
            return;
        this.disposed = true;
        this.engine.release(this.voice);
        this.panner?.disconnect();
        this.filter.disconnect();
        this.level.disconnect();
        this.fade.disconnect();
        this.send.disconnect();
    }
}
