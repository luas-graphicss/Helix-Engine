import { clipRate, clipRegion, type AudioClipSettings } from '@/engine/audio/clip/audio-clip-settings';
import { ClipGraph } from '@/engine/audio/graph/clip-graph';
import { scheduleFadeAutomation } from '@/engine/audio/graph/fade-curves';
const MAX_TAIL_SECONDS = 12;
const TAIL_SILENCE = 6e-5;
function effectTail(settings: AudioClipSettings): number {
    const { delay, reverb } = settings.effects;
    let tail = 0;
    if (reverb.enabled)
        tail = Math.max(tail, reverb.size + reverb.preDelay);
    if (delay.enabled) {
        const repeats = delay.feedback > 0 ? Math.log(0.001) / Math.log(Math.min(0.95, delay.feedback)) : 1;
        tail = Math.max(tail, delay.time * Math.min(60, Math.ceil(repeats)));
    }
    return Math.min(MAX_TAIL_SECONDS, tail);
}
function trimTrailingSilence(buffer: AudioBuffer, minimumFrames: number): AudioBuffer {
    let last = -1;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = data.length - 1; i > last; i--) {
            if (Math.abs(data[i]) > TAIL_SILENCE) {
                last = i;
                break;
            }
        }
    }
    const frames = Math.min(buffer.length, Math.max(minimumFrames, last + 1 + Math.round(buffer.sampleRate * 0.02)));
    if (frames >= buffer.length)
        return buffer;
    const trimmed = new AudioBuffer({ numberOfChannels: buffer.numberOfChannels, length: Math.max(1, frames), sampleRate: buffer.sampleRate });
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        trimmed.copyToChannel(buffer.getChannelData(channel).subarray(0, frames), channel);
    }
    return trimmed;
}
export async function renderClip(buffer: AudioBuffer, settings: AudioClipSettings): Promise<AudioBuffer> {
    const region = clipRegion(settings, buffer.duration);
    const rate = clipRate(settings);
    const sampleRate = buffer.sampleRate;
    const playSeconds = (region.end - region.start) / rate;
    const totalSeconds = playSeconds + effectTail(settings);
    const channels = Math.max(2, buffer.numberOfChannels);
    const offline = new OfflineAudioContext(channels, Math.max(1, Math.ceil(totalSeconds * sampleRate)), sampleRate);
    const rendered: AudioClipSettings = { ...settings, loop: false };
    const graph = new ClipGraph(offline, rendered);
    graph.output.connect(offline.destination);
    const source = offline.createBufferSource();
    source.buffer = buffer;
    source.detune.value = settings.pitch * 100;
    source.connect(graph.input);
    scheduleFadeAutomation(graph.fade.gain, rendered, region, region.start, rate, 0);
    source.start(0, region.start, region.end - region.start);
    const result = await offline.startRendering();
    return trimTrailingSilence(result, Math.ceil(playSeconds * sampleRate));
}
