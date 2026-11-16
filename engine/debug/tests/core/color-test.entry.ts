import { hexToLinearRgb, linearRgbToCss, linearRgbToHex, linearToSrgb, srgbToLinear } from '@/engine/core/color/srgb';
import * as vec3 from '@/engine/core/math/vec3';
import { createCheckList } from '../support/check-list';
const CHANNEL_LEVELS = 256;
const ROUND_TRIP_TOLERANCE = 1e-9;
const MIDDLE_GRAY_LINEAR = 0.21404114048223255;
const ROUND_TRIP_COLORS = ['#000000', '#ffffff', '#ff8000', '#1a2b3c', '#7f7f7f'];
const checks = createCheckList('Cores sRGB e lineares');
function transferCurves(): void {
    let worstRoundTrip = 0;
    let increasing = true;
    let previous = -Infinity;
    for (let level = 0; level < CHANNEL_LEVELS; level++) {
        const channel = level / (CHANNEL_LEVELS - 1);
        const linear = srgbToLinear(channel);
        worstRoundTrip = Math.max(worstRoundTrip, Math.abs(linearToSrgb(linear) - channel));
        increasing &&= linear > previous;
        previous = linear;
    }
    checks.near('srgbToLinear mantém o preto', srgbToLinear(0), 0, ROUND_TRIP_TOLERANCE);
    checks.near('srgbToLinear mantém o branco', srgbToLinear(1), 1, ROUND_TRIP_TOLERANCE);
    checks.near('srgbToLinear escurece o cinza médio', srgbToLinear(0.5), MIDDLE_GRAY_LINEAR, ROUND_TRIP_TOLERANCE);
    checks.check('linearToSrgb desfaz srgbToLinear nos 256 níveis de um canal', worstRoundTrip < ROUND_TRIP_TOLERANCE, `pior diferença ${worstRoundTrip}`);
    checks.check('srgbToLinear cresce a cada nível', increasing);
}
function hexColors(): void {
    const orange = hexToLinearRgb(vec3.create(), '#ff8000');
    checks.nearAll('hexToLinearRgb lê o branco', hexToLinearRgb(vec3.create(), '#ffffff'), [1, 1, 1]);
    checks.nearAll('hexToLinearRgb converte cada canal para linear', orange, [1, srgbToLinear(128 / 255), 0]);
    checks.nearAll('hexToLinearRgb aceita maiúsculas, espaços e a falta de #', hexToLinearRgb(vec3.create(), '  FF8000 '), orange);
    checks.nearAll('hexToLinearRgb devolve preto para a forma curta', hexToLinearRgb(vec3.create(1, 1, 1), '#fff'), [0, 0, 0]);
    checks.nearAll('hexToLinearRgb devolve preto para um texto que não é cor', hexToLinearRgb(vec3.create(1, 1, 1), 'zzzzzz'), [0, 0, 0]);
    for (const hex of ROUND_TRIP_COLORS)
        checks.check(`linearRgbToHex desfaz hexToLinearRgb para ${hex}`, linearRgbToHex(hexToLinearRgb(vec3.create(), hex)) === hex);
    checks.check('linearRgbToHex limita canais fora de [0, 1]', linearRgbToHex(vec3.create(2, -1, 0)) === '#ff0000');
    checks.check('linearRgbToCss escreve no espaço srgb-linear', linearRgbToCss(vec3.create(0.25, 0.5, 1)) === 'color(srgb-linear 0.25 0.5 1)');
}
transferCurves();
hexColors();
checks.finish();
