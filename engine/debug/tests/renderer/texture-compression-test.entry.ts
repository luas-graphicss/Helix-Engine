import { blockLevelBytes } from '@/engine/renderer/textures/compression/block-format';
import { encodeBlocks } from '@/engine/renderer/textures/compression/block-encoder';
import { canBlockCompress, compressMipChain } from '@/engine/renderer/textures/compression/compressed-mip-chain';
import { downsampleLevel } from '@/engine/renderer/textures/mips/mip-downsampler';
import { mipChainBytes, mipLevelCount, rgbaLevelBytes } from '@/engine/renderer/textures/mips/mip-levels';
import type { PixelLevel } from '@/engine/renderer/textures/mips/pixel-level';
import { createCheckList } from '../support/check-list';
const CHANNELS = 4;
const BLOCK_SIZE = 4;
const RED_BLUE_STEP = 255 / 31;
const GREEN_STEP = 255 / 63;
const checks = createCheckList('Compressão de texturas em blocos');
type Rgba = readonly [number, number, number, number];
function createLevel(width: number, height: number, colorAt: (x: number, y: number) => Rgba): PixelLevel {
    const pixels = new Uint8Array(width * height * CHANNELS);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++)
            pixels.set(colorAt(x, y), (y * width + x) * CHANNELS);
    }
    return { pixels, width, height };
}
function expandRgb565(color: number): [number, number, number] {
    const red = color >> 11;
    const green = (color >> 5) & 63;
    const blue = color & 31;
    return [(red << 3) | (red >> 2), (green << 2) | (green >> 4), (blue << 3) | (blue >> 2)];
}
function decodeColorBlock(encoded: Uint8Array, offset: number): number[][] {
    const first = expandRgb565(encoded[offset] | (encoded[offset + 1] << 8));
    const second = expandRgb565(encoded[offset + 2] | (encoded[offset + 3] << 8));
    const palette = [first, second, first.map((value, channel) => Math.round((2 * value + second[channel]) / 3)), first.map((value, channel) => Math.round((value + 2 * second[channel]) / 3))];
    const colors: number[][] = [];
    for (let pixel = 0; pixel < BLOCK_SIZE * BLOCK_SIZE; pixel++) {
        const row = encoded[offset + 4 + Math.floor(pixel / BLOCK_SIZE)];
        colors.push(palette[(row >> ((pixel % BLOCK_SIZE) * 2)) & 3]);
    }
    return colors;
}
function decodeAlphaBlock(encoded: Uint8Array, offset: number): number[] {
    const highest = encoded[offset];
    const lowest = encoded[offset + 1];
    const palette = [highest, lowest];
    for (let step = 1; step < 7; step++)
        palette.push(Math.round(((7 - step) * highest + step * lowest) / 7));
    const alphas: number[] = [];
    for (let half = 0; half < 2; half++) {
        const start = offset + 2 + half * 3;
        const bits = encoded[start] | (encoded[start + 1] << 8) | (encoded[start + 2] << 16);
        for (let pixel = 0; pixel < 8; pixel++)
            alphas.push(palette[(bits >> (pixel * 3)) & 7]);
    }
    return alphas;
}
function largestColorError(level: PixelLevel, encoded: Uint8Array, colorOffset: number, stride: number): number {
    let largest = 0;
    const blocksWide = level.width / BLOCK_SIZE;
    for (let y = 0; y < level.height; y++) {
        for (let x = 0; x < level.width; x++) {
            const blockIndex = Math.floor(y / BLOCK_SIZE) * blocksWide + Math.floor(x / BLOCK_SIZE);
            const decoded = decodeColorBlock(encoded, blockIndex * stride + colorOffset)[(y % BLOCK_SIZE) * BLOCK_SIZE + (x % BLOCK_SIZE)];
            const source = (y * level.width + x) * CHANNELS;
            for (let channel = 0; channel < 3; channel++)
                largest = Math.max(largest, Math.abs(decoded[channel] - level.pixels[source + channel]));
        }
    }
    return largest;
}
function colorBlocks(): void {
    const solid = createLevel(4, 4, () => [200, 100, 50, 255]);
    const solidError = largestColorError(solid, encodeBlocks(solid, 'bc1'), 0, 8);
    checks.check('uma cor única volta dentro do passo de 5:6:5 bits', solidError <= RED_BLUE_STEP / 2 + 0.5, `erro ${solidError}`);
    const checker = createLevel(8, 8, (x, y) => ((x + y) % 2 === 0 ? [255, 255, 255, 255] : [0, 0, 0, 255]));
    checks.check('preto e branco alternados voltam exatos', largestColorError(checker, encodeBlocks(checker, 'bc1'), 0, 8) === 0);
    const ramp = createLevel(16, 16, (x) => [x * 17, x * 17, x * 17, 255]);
    const rampError = largestColorError(ramp, encodeBlocks(ramp, 'bc1'), 0, 8);
    checks.check('uma rampa de cinza erra menos que um terço do intervalo do bloco', rampError <= 17, `erro ${rampError}`);
    const opposed = createLevel(4, 4, (x) => [x * 85, 255 - x * 85, 128, 255]);
    const opposedError = largestColorError(opposed, encodeBlocks(opposed, 'bc1'), 0, 8);
    checks.check('canais que variam em sentidos opostos seguem a diagonal certa', opposedError <= 24, `erro ${opposedError}`);
    const greenOnly = createLevel(4, 4, (x, y) => [40, (x + y * 4) * 16, 40, 255]);
    const greenError = largestColorError(greenOnly, encodeBlocks(greenOnly, 'bc1'), 0, 8);
    checks.check('uma variação só de verde usa os quatro tons do bloco', greenError <= 40 + GREEN_STEP, `erro ${greenError}`);
}
function alphaBlocks(): void {
    const uniform = createLevel(4, 4, () => [10, 20, 30, 77]);
    checks.check('alfa constante volta exato', decodeAlphaBlock(encodeBlocks(uniform, 'bc3'), 0).every((alpha) => alpha === 77));
    const ramp = createLevel(4, 4, (x, y) => [0, 0, 0, (x + y * 4) * 17]);
    const decoded = decodeAlphaBlock(encodeBlocks(ramp, 'bc3'), 0);
    let largest = 0;
    for (let pixel = 0; pixel < decoded.length; pixel++)
        largest = Math.max(largest, Math.abs(decoded[pixel] - ramp.pixels[pixel * CHANNELS + 3]));
    checks.check('uma rampa de alfa erra no máximo meio degrau de oito tons', largest <= 255 / 14 + 1, `erro ${largest}`);
    checks.check('os extremos da rampa de alfa são exatos', decoded[0] === 0 && decoded[15] === 255);
    const encoded = encodeBlocks(ramp, 'bc3');
    checks.check('o bloco com alfa ocupa dezesseis bytes', encoded.byteLength === 16);
}
function chains(): void {
    const opaque = compressMipChain(createLevel(64, 16, (x, y) => [x * 4, y * 16, 90, 255]), true);
    checks.check('textura opaca vira BC1', opaque.format === 'bc1');
    checks.check('a cadeia desce até 1 × 1', opaque.levels.length === mipLevelCount(64, 16) && opaque.levels.length === 7);
    checks.check('o nível base ocupa meio byte por pixel', opaque.levels[0].byteLength === 64 * 16 * 0.5);
    checks.check('níveis menores que um bloco ainda ocupam um bloco', opaque.levels[6].byteLength === 8 && opaque.levels[4].byteLength === blockLevelBytes('bc1', 4, 1));
    const translucent = compressMipChain(createLevel(8, 8, (x) => [255, 255, 255, x * 36]), false);
    checks.check('textura com transparência vira BC3', translucent.format === 'bc3');
    const compressedBytes = opaque.levels.reduce((bytes, level) => bytes + level.byteLength, 0);
    checks.check('BC1 ocupa um oitavo da cadeia RGBA', compressedBytes * 7 < mipChainBytes(64, 16, 0, rgbaLevelBytes));
    checks.check('lados em potência de dois podem ser compactados', canBlockCompress(1024, 4));
    checks.check('lados fora de potência de dois ficam de fora', !canBlockCompress(1000, 512));
    checks.check('lados menores que um bloco ficam de fora', !canBlockCompress(2, 2));
}
function downsampling(): void {
    const contrast = createLevel(2, 2, (x) => (x === 0 ? [0, 0, 0, 0] : [255, 255, 255, 255]));
    const linear = downsampleLevel(contrast, false);
    checks.check('dados lineares são reduzidos pela média dos bytes', linear.pixels[0] === 128 && linear.width === 1 && linear.height === 1);
    const srgb = downsampleLevel(contrast, true);
    checks.check('cores sRGB são reduzidas pela média da luz', srgb.pixels[0] === 188, `obtido ${srgb.pixels[0]}`);
    checks.check('o alfa é sempre reduzido pela média dos bytes', srgb.pixels[3] === 128);
    const strip = downsampleLevel(createLevel(4, 1, (x) => [x * 60, 0, 0, 255]), false);
    checks.check('uma faixa de um pixel de altura só reduz a largura', strip.width === 2 && strip.height === 1 && strip.pixels[0] === 30 && strip.pixels[4] === 150);
}
colorBlocks();
alphaBlocks();
chains();
downsampling();
checks.finish();
