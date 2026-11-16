import { latticeHash, wrap } from '@/engine/core/noise/lattice-hash';
import { perlin2, perlinFbm2 } from '@/engine/core/noise/perlin';
import { fbm3, ridgedFbm3, valueNoise3 } from '@/engine/core/noise/value-noise';
import { worley2, worley3 } from '@/engine/core/noise/worley';
import { createCheckList } from '../support/check-list';
const SEED = 1337;
const OTHER_SEED = 7331;
const PERIOD = 8;
const CELLS = 6;
const OCTAVES = 5;
const SAMPLE_COUNT = 4096;
const SAMPLE_SPAN = 37;
const TILING_TOLERANCE = 1e-9;
const CONTINUITY_STEP = 1e-4;
const CONTINUITY_LIMIT = 1e-3;
const MINIMUM_SPREAD = 0.5;
const checks = createCheckList('Ruído procedural');
interface Range {
    min: number;
    max: number;
}
type Field = (u: number, v: number) => number;
function samplePoint(index: number, axis: number): number {
    return latticeHash(index, axis, 0, SEED) * SAMPLE_SPAN;
}
function sampleRange(field: Field): Range {
    const range = { min: Infinity, max: -Infinity };
    for (let index = 0; index < SAMPLE_COUNT; index++) {
        const value = field(samplePoint(index, 0), samplePoint(index, 1));
        if (!(value >= range.min))
            range.min = value;
        if (!(value <= range.max))
            range.max = value;
    }
    return range;
}
function staysWithin(field: Field, min: number, max: number): boolean {
    const range = sampleRange(field);
    return range.min >= min && range.max <= max;
}
function spread(field: Field): number {
    const range = sampleRange(field);
    return range.max - range.min;
}
function differingSamples(a: Field, b: Field): number {
    let differing = 0;
    for (let index = 0; index < SAMPLE_COUNT; index++) {
        const u = samplePoint(index, 0);
        const v = samplePoint(index, 1);
        if (a(u, v) !== b(u, v))
            differing++;
    }
    return differing / SAMPLE_COUNT;
}
function lattice(): void {
    checks.check('wrap traz índices negativos para o período', wrap(-1, PERIOD) === PERIOD - 1);
    checks.check('wrap devolve zero no fim do período', wrap(PERIOD, PERIOD) === 0);
    checks.check('wrap reduz índices além do período', wrap(PERIOD + 3, PERIOD) === 3);
    checks.check('latticeHash repete o valor para a mesma entrada', latticeHash(1, 2, 3, SEED) === latticeHash(1, 2, 3, SEED));
    checks.check('latticeHash muda com a semente', latticeHash(1, 2, 3, SEED) !== latticeHash(1, 2, 3, OTHER_SEED));
    checks.check('latticeHash muda com cada coordenada', new Set([latticeHash(1, 2, 3, SEED), latticeHash(2, 2, 3, SEED), latticeHash(1, 3, 3, SEED), latticeHash(1, 2, 4, SEED)]).size === 4);
    checks.check('latticeHash fica em [0, 1)', staysWithin((u, v) => latticeHash(Math.floor(u), Math.floor(v), 5, SEED), 0, 1 - Number.EPSILON));
}
function perlin(): void {
    const field: Field = (u, v) => perlin2(u, v, PERIOD, SEED);
    const fractal: Field = (u, v) => perlinFbm2(u, v, PERIOD, OCTAVES, SEED);
    checks.check('perlin2 vale zero nos pontos da grade', perlin2(3, 5, PERIOD, SEED) === 0);
    checks.check('perlin2 fica em [−1, 1]', staysWithin(field, -1, 1));
    checks.check('perlin2 varia ao longo do campo', spread(field) > MINIMUM_SPREAD);
    checks.near('perlin2 se repete a cada período em X', perlin2(2.37 + PERIOD, 5.81, PERIOD, SEED), perlin2(2.37, 5.81, PERIOD, SEED), TILING_TOLERANCE);
    checks.near('perlin2 se repete a cada período em Y', perlin2(2.37, 5.81 + PERIOD, PERIOD, SEED), perlin2(2.37, 5.81, PERIOD, SEED), TILING_TOLERANCE);
    checks.check('perlin2 muda com a semente', differingSamples(field, (u, v) => perlin2(u, v, PERIOD, OTHER_SEED)) > 0.9);
    checks.check('perlinFbm2 fica em [0, 1]', staysWithin(fractal, 0, 1));
    checks.check('perlinFbm2 varia ao longo do campo', spread(fractal) > MINIMUM_SPREAD);
    checks.near('perlinFbm2 se repete a cada período', perlinFbm2(2.37 + PERIOD, 5.81, PERIOD, OCTAVES, SEED), perlinFbm2(2.37, 5.81, PERIOD, OCTAVES, SEED), TILING_TOLERANCE);
}
function valueNoise(): void {
    const field: Field = (u, v) => valueNoise3(u, v, 0.37, SEED);
    const step = Math.abs(valueNoise3(2.37 + CONTINUITY_STEP, 5.81, 0.37, SEED) - valueNoise3(2.37, 5.81, 0.37, SEED));
    checks.check('valueNoise3 devolve o valor da grade nos pontos inteiros', valueNoise3(2, 3, 4, SEED) === latticeHash(2, 3, 4, SEED) * 2 - 1);
    checks.check('valueNoise3 fica em [−1, 1]', staysWithin(field, -1, 1));
    checks.check('valueNoise3 varia ao longo do campo', spread(field) > MINIMUM_SPREAD);
    checks.check('valueNoise3 é contínuo entre amostras vizinhas', step < CONTINUITY_LIMIT, `salto de ${step}`);
    checks.check('fbm3 fica em [−1, 1]', staysWithin((u, v) => fbm3(u, v, 0.37, OCTAVES, SEED), -1, 1));
    checks.check('ridgedFbm3 fica em [0, 1]', staysWithin((u, v) => ridgedFbm3(u, v, 0.37, OCTAVES, SEED), 0, 1));
}
function worley(): void {
    const flat: Field = (u, v) => worley2(u, v, CELLS, SEED);
    const solid: Field = (u, v) => worley3(u, v, 0.37, CELLS, SEED);
    checks.check('worley2 fica em [0, 1]', staysWithin(flat, 0, 1));
    checks.check('worley2 varia ao longo do campo', spread(flat) > MINIMUM_SPREAD);
    checks.near('worley2 se repete a cada unidade em X', worley2(0.237 + 1, 0.581, CELLS, SEED), worley2(0.237, 0.581, CELLS, SEED), TILING_TOLERANCE);
    checks.near('worley2 se repete a cada unidade em Y', worley2(0.237, 0.581 + 1, CELLS, SEED), worley2(0.237, 0.581, CELLS, SEED), TILING_TOLERANCE);
    checks.check('worley3 fica em [0, 1]', staysWithin(solid, 0, 1));
    checks.near('worley3 se repete a cada unidade em Z', worley3(0.237, 0.581, 0.37 + 1, CELLS, SEED), worley3(0.237, 0.581, 0.37, CELLS, SEED), TILING_TOLERANCE);
}
lattice();
perlin();
valueNoise();
worley();
checks.finish();
