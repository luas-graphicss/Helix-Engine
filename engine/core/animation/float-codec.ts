export function encodeFloat32Base64(values: Float32Array): string {
    const bytes = new Uint8Array(values.length * 4);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < values.length; i++)
        view.setFloat32(i * 4, values[i], true);
    let binary = '';
    const CHUNK = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + CHUNK, bytes.length)));
    }
    return btoa(binary);
}
export function decodeFloat32Base64(text: string): Float32Array {
    const binary = atob(text);
    if (binary.length % 4 !== 0)
        throw new Error('Faixa binária com tamanho inválido.');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++)
        bytes[i] = binary.charCodeAt(i);
    const view = new DataView(bytes.buffer);
    const values = new Float32Array(binary.length / 4);
    for (let i = 0; i < values.length; i++)
        values[i] = view.getFloat32(i * 4, true);
    return values;
}
export function readFloatField(value: unknown, field: string): Float32Array {
    if (typeof value === 'string')
        return decodeFloat32Base64(value);
    if (Array.isArray(value)) {
        const floats = new Float32Array(value.length);
        for (let i = 0; i < value.length; i++) {
            const number = Number(value[i]);
            if (!Number.isFinite(number))
                throw new Error(`"${field}" contém um valor não numérico na posição ${i}.`);
            floats[i] = number;
        }
        return floats;
    }
    throw new Error(`"${field}" deve ser uma lista de números ou uma string base64.`);
}
