import { getAudioContext, isWebAudioSupported } from '@/engine/audio/core/audio-context';
import { describeAudioFormat } from '@/engine/audio/core/audio-formats';
function extensionOf(fileName: string): string {
    const dot = fileName.lastIndexOf('.');
    return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
    if (!isWebAudioSupported())
        throw new Error('Web Audio API indisponível neste navegador.');
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength === 0)
        throw new Error(`"${file.name}" está vazio.`);
    try {
        return await getAudioContext().decodeAudioData(bytes);
    }
    catch (cause) {
        const format = describeAudioFormat(extensionOf(file.name));
        const detail = cause instanceof Error && cause.message ? ` (${cause.message})` : '';
        throw new Error(`Este navegador não decodifica ${format}${detail}.`);
    }
}
