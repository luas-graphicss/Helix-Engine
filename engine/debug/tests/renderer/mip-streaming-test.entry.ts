import { createMeshData } from '@/engine/renderer/geometry/mesh-data';
import { mipChainBytes, rgbaLevelBytes } from '@/engine/renderer/textures/mips/mip-levels';
import { fitTopLevelsToBudget, type BudgetEntry } from '@/engine/renderer/textures/streaming/mip-budget';
import { maxTopLevel, neededTextureSize, topLevelForSize } from '@/engine/renderer/textures/streaming/mip-demand';
import { uvDensity } from '@/engine/renderer/textures/streaming/uv-density';
import { createCheckList } from '../support/check-list';
const QUAD_INDICES = [0, 1, 2, 0, 2, 3];
const checks = createCheckList('Streaming de mipmaps');
function quad(side: number, uvRepeats: number) {
    const positions = [0, 0, 0, side, 0, 0, side, side, 0, 0, side, 0];
    const normals = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
    const uvs = [0, 0, uvRepeats, 0, uvRepeats, uvRepeats, 0, uvRepeats];
    return createMeshData('quad', positions, normals, uvs, QUAD_INDICES);
}
function shrinking(baseBytes: number, topLevel: number, maxLevel: number): BudgetEntry {
    return { topLevel, maxTopLevel: maxLevel, bytesAt: (level) => baseBytes / 4 ** level };
}
function reductionLimits(): void {
    checks.check('2048 pode descer até 64 pixels', maxTopLevel(2048, 2048) === 5);
    checks.check('4096 desce um nível a mais', maxTopLevel(4096, 4096) === 6);
    checks.check('64 pixels não é reduzida', maxTopLevel(64, 64) === 0);
    checks.check('abaixo de 128 pixels não há nível a tirar', maxTopLevel(100, 100) === 0);
    checks.check('o lado curto nunca fica menor que um bloco', maxTopLevel(1024, 16) === 2);
}
function levelSelection(): void {
    checks.check('pedido do tamanho da textura fica no nível cheio', topLevelForSize(2048, 2048, 5) === 0);
    checks.check('pedido maior que a textura fica no nível cheio', topLevelForSize(2048, 9000, 5) === 0);
    checks.check('câmera encostada pede o nível cheio', topLevelForSize(2048, Infinity, 5) === 0);
    checks.check('metade do tamanho tira um nível', topLevelForSize(2048, 1024, 5) === 1);
    checks.check('o nível escolhido nunca tem menos pixels que o pedido', topLevelForSize(2048, 1025, 5) === 0 && topLevelForSize(2048, 1000, 5) === 1);
    checks.check('pedido minúsculo para no limite de redução', topLevelForSize(2048, 10, 5) === 5);
    checks.check('textura fora da tela vai ao limite de redução', topLevelForSize(2048, 0, 5) === 5);
    checks.check('pedido inválido vai ao limite de redução', topLevelForSize(2048, Number.NaN, 5) === 5);
}
function density(): void {
    checks.near('um quadrado de 2 m com a textura uma vez tem meia volta de UV por metro', uvDensity(quad(2, 1)), 0.5);
    checks.near('repetir a textura quatro vezes quadruplica a densidade', uvDensity(quad(2, 4)), 2);
    checks.check('malha sem coordenadas de textura não tem densidade', uvDensity(quad(2, 0)) === 0);
    checks.near('a 100 pixels por metro o quadrado de 2 m pede 200 pixels de textura', neededTextureSize(100, uvDensity(quad(2, 1))), 200);
    checks.near('com a textura repetida quatro vezes cada cópia pede 50 pixels', neededTextureSize(100, uvDensity(quad(2, 4))), 50);
    checks.check('sem densidade de UV o pedido é o nível cheio', neededTextureSize(100, 0) === Infinity);
}
function budget(): void {
    const entries = [shrinking(1600, 0, 3), shrinking(400, 0, 3), shrinking(4000, 1, 1)];
    checks.nearAll('com folga no orçamento nada muda', fitTopLevelsToBudget(entries, 5000), [0, 0, 1]);
    checks.nearAll('a maior textura redutível desce primeiro', fitTopLevelsToBudget(entries, 2000), [1, 0, 1]);
    checks.nearAll('a redução continua até caber', fitTopLevelsToBudget(entries, 1500), [2, 0, 1]);
    checks.nearAll('orçamento impossível para no limite de cada textura', fitTopLevelsToBudget(entries, 100), [3, 3, 1]);
    checks.nearAll('sem texturas não há o que ajustar', fitTopLevelsToBudget([], 0), []);
}
function memory(): void {
    const full = mipChainBytes(1024, 1024, 0, rgbaLevelBytes);
    const reduced = mipChainBytes(1024, 1024, 1, rgbaLevelBytes);
    checks.check('a cadeia RGBA de 1024 ocupa um terço a mais que o nível base', full === 5592404);
    checks.check('tirar o nível de cima libera exatamente o nível base', full - reduced === rgbaLevelBytes(1024, 1024));
    checks.check('o que sobra é um quarto da cadeia cheia', reduced === 1398100);
    checks.check('uma textura retangular soma os níveis até 1 × 1', mipChainBytes(8, 2, 0, rgbaLevelBytes) === (16 + 4 + 2 + 1) * 4);
}
reductionLimits();
levelSelection();
density();
budget();
memory();
checks.finish();
