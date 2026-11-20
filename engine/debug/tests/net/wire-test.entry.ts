import { ByteReader } from '@/engine/net/wire/byte-reader';
import { ByteWriter } from '@/engine/net/wire/byte-writer';
import { isNetValue, readNetValue, readNetValues, writeNetValue, writeNetValues, type NetValue } from '@/engine/net/wire/net-value';
import { packQuaternion, unpackQuaternion, type QuaternionTuple } from '@/engine/net/wire/quantize';
import { nextSequence, sequenceDistance } from '@/engine/net/wire/sequence';
import { createCheckList } from '../support/check-list';
const checks = createCheckList('Codificação binária da rede');
const writer = new ByteWriter(4);
writer.u8(200).u16(65000).u32(4000000000).f32(1.5).f64(Math.PI).bool(true).varuint(0).varuint(127).varuint(128).varuint(2 ** 40).string('Olá, mundo').block(Uint8Array.of(9, 8, 7));
const reader = new ByteReader(writer.toBytes());
checks.check('inteiros de tamanho fixo voltam iguais', reader.u8() === 200 && reader.u16() === 65000 && reader.u32() === 4000000000);
checks.check('ponto flutuante volta igual', reader.f32() === 1.5 && reader.f64() === Math.PI && reader.bool());
checks.check('inteiros de tamanho variável voltam iguais', reader.varuint() === 0 && reader.varuint() === 127 && reader.varuint() === 128 && reader.varuint() === 2 ** 40);
checks.check('texto com acento volta igual', reader.string(64) === 'Olá, mundo');
checks.nearAll('bloco de bytes volta igual', reader.block(8), [9, 8, 7]);
checks.check('nada sobra depois da leitura', reader.remaining === 0);
checks.throws('ler além do fim é recusado', () => new ByteReader(Uint8Array.of(1)).u32(), 'passes the end');
checks.throws('texto acima do limite é recusado', () => new ByteReader(new ByteWriter().string('abcdef').toBytes()).string(3), 'exceeds');
checks.throws('UTF-8 inválido é recusado', () => new ByteReader(Uint8Array.of(2, 0xff, 0xfe)).string(8), 'UTF-8');
checks.throws('inteiro variável sem fim é recusado', () => new ByteReader(new Uint8Array(9).fill(0xff)).varuint(), 'longer than');
checks.throws('inteiro variável negativo é recusado', () => new ByteWriter().varuint(-1), 'non-negative');
function roundTrip(value: NetValue): NetValue {
    const encoded = new ByteWriter();
    writeNetValue(encoded, value);
    return readNetValue(new ByteReader(encoded.toBytes()));
}
const sample: NetValue = { name: 'Ana', score: 1200, ratio: -0.25, alive: true, team: null, items: ['espada', 3, [1, 2], { rare: false }], debt: -42 };
checks.check('valor estruturado volta igual', JSON.stringify(roundTrip(sample)) === JSON.stringify(sample));
checks.check('inteiro grande continua exato', roundTrip(Number.MAX_SAFE_INTEGER) === Number.MAX_SAFE_INTEGER && roundTrip(-Number.MAX_SAFE_INTEGER) === -Number.MAX_SAFE_INTEGER);
const several = new ByteWriter();
writeNetValues(several, ['a', 1, null]);
checks.check('lista de argumentos volta igual', JSON.stringify(readNetValues(new ByteReader(several.toBytes()))) === '["a",1,null]');
checks.check('funções, datas e classes não são valores de rede', !isNetValue(() => 0) && !isNetValue(new Date()) && !isNetValue(new Map()) && !isNetValue(undefined));
checks.check('números não finitos não são valores de rede', !isNetValue(Number.NaN) && !isNetValue(Number.POSITIVE_INFINITY));
checks.check('chave de protótipo não é valor de rede', !isNetValue(JSON.parse('{"__proto__":{"admin":true}}')));
checks.throws('número não finito não é escrito', () => writeNetValue(new ByteWriter(), Number.NaN), 'cannot cross');
let nested: NetValue = 1;
for (let level = 0; level < 20; level++)
    nested = [nested];
checks.check('aninhamento profundo demais não é valor de rede', !isNetValue(nested));
checks.throws('aninhamento profundo demais não é escrito', () => writeNetValue(new ByteWriter(), nested), 'nested deeper');
checks.throws('aninhamento profundo demais não é lido', () => readNetValue(new ByteReader(new Uint8Array(40).fill(7).map((tag, index) => (index % 2 === 0 ? tag : 1)))), 'nested deeper');
checks.throws('coleção maior que a mensagem é recusada', () => readNetValue(new ByteReader(Uint8Array.of(7, 0xff, 0xff, 0x03))), 'does not fit');
checks.throws('marca desconhecida é recusada', () => readNetValue(new ByteReader(Uint8Array.of(99))), 'unknown value tag');
const hostile = new ByteWriter().u8(8).varuint(1).string('__proto__').u8(0).toBytes();
checks.throws('chave de protótipo vinda da rede é recusada', () => readNetValue(new ByteReader(hostile)), 'cannot cross');
const notFinite = new ByteWriter().u8(5).f64(Number.POSITIVE_INFINITY).toBytes();
checks.throws('infinito vindo da rede é recusado', () => readNetValue(new ByteReader(notFinite)), 'non-finite');
function angleBetween(a: ArrayLike<number>, b: ArrayLike<number>): number {
    const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
    return 2 * Math.acos(Math.min(1, dot));
}
const rotations: QuaternionTuple[] = [
    [0, 0, 0, 1],
    [1, 0, 0, 0],
    [0.5, 0.5, 0.5, 0.5],
    [-0.1825742, 0.3651484, -0.5477226, 0.7302967],
    [0.7071068, 0, -0.7071068, 0],
    [0, -0.3826834, 0, -0.9238795],
];
let worstAngle = 0;
for (const rotation of rotations)
    worstAngle = Math.max(worstAngle, angleBetween(rotation, unpackQuaternion(packQuaternion(rotation), [0, 0, 0, 0])));
checks.check('rotação compactada em 32 bits erra menos de 0,2 grau', worstAngle < (0.2 * Math.PI) / 180, `erro de ${(worstAngle * 180) / Math.PI} graus`);
checks.check('rotação compactada cabe em 32 bits', rotations.every((rotation) => packQuaternion(rotation) < 2 ** 32));
checks.nearAll('rotação nula vira identidade', unpackQuaternion(packQuaternion([0, 0, 0, 0]), [0, 0, 0, 0]), [0, 0, 0, 1], 2e-3);
checks.check('sequência dá a volta em 16 bits', nextSequence(65535) === 0 && sequenceDistance(2, 65534) === 4 && sequenceDistance(65534, 2) === -4);
checks.finish();
