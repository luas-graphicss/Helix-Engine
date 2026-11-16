import { decodeFloat32Base64, encodeFloat32Base64, readFloatField } from '@/engine/core/animation/float-codec';
import { createCheckList } from '../support/check-list';
const ONE_AS_BASE64 = 'AACAPw==';
const LARGEST_FLOAT32 = 3.4028234663852886e38;
const SMALLEST_FLOAT32 = 1.401298464324817e-45;
const MULTIPLE_CHUNKS_LENGTH = 20000;
const FIELD = 'times';
const checks = createCheckList('Codificação de faixas de ponto flutuante');
function sameValues(actual: Float32Array, expected: Float32Array): boolean {
    return actual.length === expected.length && actual.every((value, index) => Object.is(value, expected[index]));
}
function roundTrip(values: Float32Array): Float32Array {
    return decodeFloat32Base64(encodeFloat32Base64(values));
}
function encoding(): void {
    const extremes = new Float32Array([0, -0, 1, -1.5, LARGEST_FLOAT32, SMALLEST_FLOAT32, Infinity, -Infinity, Number.NaN]);
    const long = Float32Array.from({ length: MULTIPLE_CHUNKS_LENGTH }, (_, index) => Math.sin(index) * index);
    checks.check('encode grava cada valor em little-endian', encodeFloat32Base64(new Float32Array([1])) === ONE_AS_BASE64);
    checks.check('decode desfaz encode, inclusive zero negativo, infinitos e NaN', sameValues(roundTrip(extremes), extremes));
    checks.check('uma faixa vazia vira texto vazio', encodeFloat32Base64(new Float32Array(0)) === '');
    checks.check('um texto vazio vira uma faixa vazia', decodeFloat32Base64('').length === 0);
    checks.check('uma faixa maior que um bloco de codificação volta igual', sameValues(roundTrip(long), long));
    checks.throws('decode recusa um tamanho que não é múltiplo de quatro bytes', () => decodeFloat32Base64(btoa('abc')), 'tamanho inválido');
}
function fields(): void {
    checks.nearAll('readFloatField decodifica um texto base64', readFloatField(ONE_AS_BASE64, FIELD), [1]);
    checks.nearAll('readFloatField converte uma lista de números', readFloatField([1, 2.5, '3'], FIELD), [1, 2.5, 3]);
    checks.throws('readFloatField diz o campo e a posição do valor não numérico', () => readFloatField([1, 'x'], FIELD), `"${FIELD}" contém um valor não numérico na posição 1`);
    checks.throws('readFloatField recusa valores infinitos', () => readFloatField([Infinity], FIELD), FIELD);
    checks.throws('readFloatField recusa o que não é lista nem texto', () => readFloatField({ length: 2 }, FIELD), FIELD);
}
encoding();
fields();
checks.finish();
