export type WavBitDepth = 16 | 24 | 32;
export const WAV_BIT_DEPTHS: ReadonlyArray<{
    value: WavBitDepth;
    label: string;
    description: string;
}> = [
    { value: 16, label: '16 bits', description: 'PCM inteiro: compatível com tudo, o padrão de jogos.' },
    { value: 24, label: '24 bits', description: 'PCM inteiro com mais margem para edição posterior.' },
    { value: 32, label: '32 bits (float)', description: 'Ponto flutuante: sem perda, inclusive acima de 0 dBFS.' },
];
function writeAscii(view: DataView, offset: number, text: string): void {
    for (let i = 0; i < text.length; i++)
        view.setUint8(offset + i, text.charCodeAt(i));
}
export function encodeWav(buffer: AudioBuffer, bitDepth: WavBitDepth): Blob {
    const channels = buffer.numberOfChannels;
    const frames = buffer.length;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = channels * bytesPerSample;
    const dataBytes = frames * blockAlign;
    const isFloat = bitDepth === 32;
    const headerBytes = 44;
    const out = new ArrayBuffer(headerBytes + dataBytes);
    const view = new DataView(out);
    writeAscii(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataBytes, true);
    writeAscii(view, 8, 'WAVE');
    writeAscii(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, isFloat ? 3 : 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeAscii(view, 36, 'data');
    view.setUint32(40, dataBytes, true);
    const data = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
    let offset = headerBytes;
    for (let frame = 0; frame < frames; frame++) {
        for (let channel = 0; channel < channels; channel++) {
            const sample = data[channel][frame];
            if (isFloat) {
                view.setFloat32(offset, sample, true);
            }
            else {
                const clamped = Math.max(-1, Math.min(1, sample));
                if (bitDepth === 16) {
                    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
                }
                else {
                    const value = Math.round(clamped < 0 ? clamped * 0x800000 : clamped * 0x7fffff);
                    view.setUint8(offset, value & 0xff);
                    view.setUint8(offset + 1, (value >> 8) & 0xff);
                    view.setUint8(offset + 2, (value >> 16) & 0xff);
                }
            }
            offset += bytesPerSample;
        }
    }
    return new Blob([out], { type: 'audio/wav' });
}
