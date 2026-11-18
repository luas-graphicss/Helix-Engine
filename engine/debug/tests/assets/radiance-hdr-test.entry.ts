import { measureExposure, toneMapRadiance } from '@/engine/assets/hdr/panorama-tone-mapping';
import { decodeRadianceHdr, radianceScale, type RadianceImage } from '@/engine/assets/hdr/radiance-hdr';
import { createCheckList } from '../support/check-list';
type Rgbe = readonly [number, number, number, number];
const HEADER = '#?RADIANCE\n# written by the test\nFORMAT=32-bit_rle_rgbe\nEXPOSURE=1\n\n';
const WHITE: Rgbe = [128, 128, 128, 129];
const BLACK: Rgbe = [0, 0, 0, 0];
const RED: Rgbe = [200, 10, 5, 130];
const checks = createCheckList('Panoramas Radiance HDR');
function ascii(text: string): number[] {
    return Array.from(text, (character) => character.charCodeAt(0));
}
function file(header: string, resolution: string, body: readonly number[]): Uint8Array {
    return new Uint8Array([...ascii(header), ...ascii(`${resolution}\n`), ...body]);
}
function flatRows(rows: readonly (readonly Rgbe[])[]): number[] {
    return rows.flatMap((row) => row.flatMap((pixel) => [...pixel]));
}
function runLengthRow(row: readonly Rgbe[]): number[] {
    const encoded = [2, 2, row.length >> 8, row.length & 0xff];
    for (let channel = 0; channel < 4; channel++) {
        const values = row.map((pixel) => pixel[channel]);
        const half = Math.floor(values.length / 2);
        encoded.push(half, ...values.slice(0, half));
        const rest = values.slice(half);
        if (rest.every((value) => value === rest[0]))
            encoded.push(128 + rest.length, rest[0]);
        else
            encoded.push(rest.length, ...rest);
    }
    return encoded;
}
function pixelAt(image: RadianceImage, x: number, y: number): number[] {
    const offset = (y * image.width + x) * 4;
    return Array.from(image.rgbe.subarray(offset, offset + 4));
}
function decoding(): void {
    const flat = decodeRadianceHdr(file(HEADER, '-Y 2 +X 2', flatRows([[WHITE, BLACK], [RED, WHITE]])));
    checks.check('a resolução vem do cabeçalho', flat.width === 2 && flat.height === 2, `${flat.width}x${flat.height}`);
    checks.nearAll('uma linha sem compressão é copiada', pixelAt(flat, 0, 1), RED);
    const wideRow: Rgbe[] = [RED, RED, BLACK, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE];
    const mixedRow: Rgbe[] = [WHITE, BLACK, RED, WHITE, BLACK, RED, WHITE, BLACK, RED, WHITE];
    const compressed = decodeRadianceHdr(file(HEADER, '-Y 2 +X 10', [...runLengthRow(wideRow), ...runLengthRow(mixedRow)]));
    checks.nearAll('uma sequência repetida é expandida', pixelAt(compressed, 9, 0), WHITE);
    checks.nearAll('os valores literais ficam na ordem', pixelAt(compressed, 2, 0), BLACK);
    checks.nearAll('a segunda linha comprimida é lida depois da primeira', pixelAt(compressed, 8, 1), RED);
    checks.check('o expoente zero é preto', radianceScale(0) === 0);
    checks.near('o expoente 136 mantém a mantissa', radianceScale(136), 1);
    checks.near('a mantissa 128 com expoente 129 vale um', 128 * radianceScale(129), 1);
}
function rejection(): void {
    const body = flatRows([[WHITE, BLACK], [RED, WHITE]]);
    checks.throws('outra assinatura é recusada', () => decodeRadianceHdr(file(HEADER.replace('#?RADIANCE', '#?PNG'), '-Y 2 +X 2', body)), 'not a Radiance HDR');
    checks.throws('outro formato de pixel é recusado', () => decodeRadianceHdr(file(HEADER.replace('rgbe', 'xyze'), '-Y 2 +X 2', body)), 'Only top-down RGBE');
    checks.throws('outra orientação é recusada', () => decodeRadianceHdr(file(HEADER, '+Y 2 +X 2', body)), 'Only top-down RGBE');
    checks.throws('um arquivo cortado é recusado', () => decodeRadianceHdr(file(HEADER, '-Y 2 +X 2', body.slice(0, 9))), 'ends before the last pixel');
    checks.throws('uma imagem grande demais é recusada', () => decodeRadianceHdr(file(HEADER, '-Y 2 +X 9000', body)), 'at most 8192');
    checks.throws('uma linha comprimida com a largura errada é recusada', () => decodeRadianceHdr(file(HEADER, '-Y 1 +X 10', [2, 2, 0, 12, 138, 7])), 'wrong width');
    checks.throws('uma sequência que passa da linha é recusada', () => decodeRadianceHdr(file(HEADER, '-Y 1 +X 10', [2, 2, 0, 10, 140, 7])), 'corrupted');
    checks.throws('um cabeçalho sem fim é recusado', () => decodeRadianceHdr(new Uint8Array(ascii('#?RADIANCE'))), 'malformed');
}
function toneMapping(): void {
    const image = decodeRadianceHdr(file(HEADER, '-Y 1 +X 3', flatRows([[BLACK, [128, 128, 128, 126], [255, 255, 255, 140]]])));
    const shown = toneMapRadiance(image, 1);
    checks.nearAll('o preto continua preto e opaco', Array.from(shown.pixels.subarray(0, 4)), [0, 0, 0, 255]);
    checks.check('um valor muito claro satura sem estourar', shown.pixels[8] === 255, String(shown.pixels[8]));
    checks.check('os tons médios ficam entre os extremos', shown.pixels[4] > 0 && shown.pixels[4] < shown.pixels[8], String(shown.pixels[4]));
    checks.check('mais exposição clareia a imagem', toneMapRadiance(image, 4).pixels[4] > shown.pixels[4]);
    const dim = decodeRadianceHdr(file(HEADER, '-Y 1 +X 2', flatRows([[[128, 128, 128, 120], [128, 128, 128, 120]]])));
    const bright = decodeRadianceHdr(file(HEADER, '-Y 1 +X 2', flatRows([[[128, 128, 128, 136], [128, 128, 128, 136]]])));
    checks.check('uma cena escura recebe mais exposição que uma clara', measureExposure(dim) > measureExposure(bright));
    checks.check('a exposição automática fica dentro dos limites', measureExposure(dim) <= 64 && measureExposure(bright) >= 1 / 64);
}
decoding();
rejection();
toneMapping();
checks.finish();
