import type { LevelMeter } from './analysis/level-meter';
import type { AudioClipSettings } from './clip/audio-clip-settings';
import { audioContextStatus, getAudioContext, isWebAudioSupported, peekAudioContext, resumeAudioContext, subscribeAudioContext, type AudioContextStatus } from './core/audio-context';
import { AudioBufferCache } from './decode/audio-buffer-cache';
import { decodeAudioFile } from './decode/audio-decoder';
import { AudioMixer } from './mixer/audio-mixer';
import { createMixerSettings, type AudioBusId, type ClipBusId, type MixerSettings } from './mixer/mixer-settings';
import { AudioVoice, type VoiceOptions } from './playback/audio-voice';
const MAX_VOICES = 32;
export class AudioEngine {
    readonly cache = new AudioBufferCache();
    private mixer: AudioMixer | null = null;
    private mixerSettings: MixerSettings = createMixerSettings();
    private monitorGain = 1;
    private readonly voices = new Set<AudioVoice>();
    setMonitorGain(value: number): void {
        this.monitorGain = value;
        this.mixer?.setMonitorGain(value);
    }
    get supported(): boolean {
        return isWebAudioSupported();
    }
    get status(): AudioContextStatus {
        return audioContextStatus();
    }
    get context(): AudioContext | null {
        return peekAudioContext();
    }
    get voiceCount(): number {
        return this.voices.size;
    }
    get sampleRate(): number | null {
        return this.context?.sampleRate ?? null;
    }
    subscribe(listener: () => void): () => void {
        return subscribeAudioContext(listener);
    }
    load(key: string, file: () => Promise<File>): Promise<AudioBuffer> {
        return this.cache.get(key, async () => decodeAudioFile(await file()));
    }
    async unlock(): Promise<boolean> {
        if (!this.supported)
            return false;
        const running = await resumeAudioContext();
        this.ensureMixer();
        return running;
    }
    setMixerSettings(settings: MixerSettings): void {
        this.mixerSettings = settings;
        this.mixer?.apply(settings);
    }
    meter(bus: AudioBusId): LevelMeter | null {
        return this.mixer?.meter(bus) ?? null;
    }
    get limiterReductionDb(): number {
        return this.mixer?.limiterReductionDb ?? 0;
    }
    busInput(bus: ClipBusId): AudioNode {
        return this.ensureMixer().input(bus);
    }
    returnInput(): AudioNode {
        return this.ensureMixer().returnInput();
    }
    adopt(voice: AudioVoice): void {
        this.voices.add(voice);
        this.cullVoices();
    }
    play(buffer: AudioBuffer, settings: AudioClipSettings, options: VoiceOptions = {}): AudioVoice {
        const mixer = this.ensureMixer();
        const voice = new AudioVoice(getAudioContext(), buffer, settings, mixer.input(settings.bus), {
            ...options,
            onEnded: (ended) => {
                this.voices.delete(ended);
                options.onEnded?.(ended);
            },
        });
        this.voices.add(voice);
        this.cullVoices();
        voice.play();
        return voice;
    }
    createVoice(buffer: AudioBuffer, settings: AudioClipSettings, options: VoiceOptions = {}): AudioVoice {
        const mixer = this.ensureMixer();
        const voice = new AudioVoice(getAudioContext(), buffer, settings, mixer.input(settings.bus), options);
        this.voices.add(voice);
        return voice;
    }
    release(voice: AudioVoice): void {
        if (!this.voices.delete(voice))
            return;
        voice.dispose();
    }
    stopAll(fadeSeconds = 0.05): void {
        for (const voice of this.voices)
            voice.stop(fadeSeconds);
    }
    private ensureMixer(): AudioMixer {
        if (!this.mixer) {
            this.mixer = new AudioMixer(getAudioContext());
            this.mixer.apply(this.mixerSettings, true);
            this.mixer.setMonitorGain(this.monitorGain);
        }
        return this.mixer;
    }
    private cullVoices(): void {
        while (this.voices.size > MAX_VOICES) {
            const oldest = this.voices.values().next().value;
            if (!oldest)
                break;
            this.release(oldest);
        }
    }
}
