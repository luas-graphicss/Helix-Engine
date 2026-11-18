import { formatAssetReference, parseAssetReference } from '@/engine/editor/mcp/asset-sources/catalog/asset-reference';
import type { AssetVariant } from '@/engine/editor/mcp/asset-sources/catalog/asset-source';
import { licenseLabelFromCode, licenseLabelFromUrl, requiresAttribution } from '@/engine/editor/mcp/asset-sources/catalog/license-label';
import { chooseVariant, describeVariant } from '@/engine/editor/mcp/asset-sources/catalog/variant-selection';
import { listPolyHavenVariants, resolvePolyHavenFiles } from '@/engine/editor/mcp/asset-sources/providers/poly-haven/poly-haven-files';
import { fileExtensionOf, fileStemOf, safeFileName } from '@/engine/editor/mcp/asset-sources/transport/file-naming';
import { parseHttpsUrl, recordAtPath, textAt } from '@/engine/editor/mcp/asset-sources/transport/json-reading';
import { createCheckList } from '../../support/check-list';
const FILE_HOST = 'https://dl.polyhaven.org/file/ph-assets';
const checks = createCheckList('Fontes externas de assets');
function hosted(path: string, size: number): { url: string; size: number } {
    return { url: `${FILE_HOST}/${path}`, size };
}
const MODEL_FILES = {
    gltf: {
        '1k': {
            gltf: {
                ...hosted('Models/gltf/1k/Barrel_01/Barrel_01_1k.gltf', 2711),
                include: {
                    'Barrel_01.bin': hosted('Models/gltf/8k/Barrel_01/Barrel_01.bin', 81756),
                    'textures/Barrel_01_diff_1k.jpg': hosted('Models/jpg/1k/Barrel_01/Barrel_01_diff_1k.jpg', 179308),
                },
            },
        },
        '2k': { gltf: { ...hosted('Models/gltf/2k/Barrel_01/Barrel_01_2k.gltf', 2711), include: {} } },
        '16k': { gltf: { ...hosted('Models/gltf/16k/Barrel_01/Barrel_01_16k.gltf', 2711), include: {} } },
    },
    fbx: { '1k': { fbx: { ...hosted('Models/fbx/1k/Barrel_01/Barrel_01_1k.fbx', 97052), include: {} } } },
    blend: { '1k': { blend: hosted('Models/blend/1k/Barrel_01/Barrel_01_1k.blend', 195364) } },
};
const TEXTURE_FILES = {
    Diffuse: {
        '1k': { jpg: hosted('Textures/jpg/1k/brick/brick_diffuse_1k.jpg', 100), png: hosted('Textures/png/1k/brick/brick_diffuse_1k.png', 400) },
        '2k': { jpg: hosted('Textures/jpg/2k/brick/brick_diffuse_2k.jpg', 900) },
    },
    nor_gl: { '1k': { jpg: hosted('Textures/jpg/1k/brick/brick_nor_gl_1k.jpg', 200) }, '4k': { jpg: hosted('Textures/jpg/4k/brick/brick_nor_gl_4k.jpg', 5000) } },
    arm: { '1k': { jpg: hosted('Textures/jpg/1k/brick/brick_arm_1k.jpg', 300) } },
    Rough: { '1k': { jpg: hosted('Textures/jpg/1k/brick/brick_rough_1k.jpg', 50) } },
};
const PANORAMA_FILES = {
    hdri: {
        '1k': { hdr: hosted('HDRIs/hdr/1k/sky_1k.hdr', 1500000), exr: hosted('HDRIs/exr/1k/sky_1k.exr', 1400000) },
        '8k': { hdr: hosted('HDRIs/hdr/8k/sky_8k.hdr', 102973096) },
    },
    tonemapped: hosted('HDRIs/extra/Tonemapped%20JPG/sky.jpg', 48676915),
};
const INSECURE_FILES = { hdri: { '1k': { hdr: { url: 'http://dl.polyhaven.org/sky_1k.hdr', size: 10 } } } };
function labels(variants: readonly AssetVariant[]): string {
    return variants.map(describeVariant).join(', ');
}
function references(): void {
    const reference = formatAssetReference({ sourceId: 'polyhaven', kind: 'model', assetId: 'Barrel_01' });
    checks.check('a referência junta fonte, tipo e id', reference === 'polyhaven:model:Barrel_01', reference);
    const parsed = parseAssetReference(' openverse:image:2f0c:extra ');
    checks.check('a leitura devolve a fonte', parsed.sourceId === 'openverse', parsed.sourceId);
    checks.check('a leitura devolve o tipo', parsed.kind === 'image', parsed.kind);
    checks.check('o id mantém os dois-pontos que tiver', parsed.assetId === '2f0c:extra', parsed.assetId);
    checks.throws('um tipo desconhecido é recusado', () => parseAssetReference('polyhaven:video:clip'), 'not an asset reference');
    checks.throws('uma referência sem id é recusada', () => parseAssetReference('polyhaven:model:'), 'not an asset reference');
}
function variantChoice(): void {
    const variants: AssetVariant[] = [
        { format: 'gltf', quality: '2k', bytes: 10 },
        { format: 'gltf', quality: '1k', bytes: 5 },
        { format: 'fbx', quality: '1k', bytes: 7 },
    ];
    const none = { format: null, quality: null };
    checks.check('sem escolha vale a primeira variante', describeVariant(chooseVariant(variants, none, 'Barril')) === 'gltf 2k');
    checks.check('o formato ignora maiúsculas', describeVariant(chooseVariant(variants, { format: 'FBX', quality: null }, 'Barril')) === 'fbx 1k');
    checks.check('a qualidade sozinha usa o primeiro formato que a tem', describeVariant(chooseVariant(variants, { format: null, quality: '1k' }, 'Barril')) === 'gltf 1k');
    checks.throws('um formato ausente lista os disponíveis', () => chooseVariant(variants, { format: 'usd', quality: null }, 'Barril'), 'Formats: gltf, fbx');
    checks.throws('uma qualidade ausente lista as disponíveis', () => chooseVariant(variants, { format: 'gltf', quality: '8k' }, 'Barril'), 'Qualities: 2k, 1k');
    checks.throws('um asset sem variantes é recusado', () => chooseVariant([], none, 'Barril'), 'no file in a format');
    checks.check('uma variante sem qualidade mostra só o formato', describeVariant({ format: 'glb', quality: null, bytes: null }) === 'glb');
}
function licenses(): void {
    checks.check('uma licença CC BY por URL', licenseLabelFromUrl('https://creativecommons.org/licenses/by/4.0/') === 'CC BY 4.0');
    checks.check('o domínio público por URL', licenseLabelFromUrl('http://creativecommons.org/publicdomain/zero/1.0/') === 'CC0 1.0');
    checks.check('uma licença não comercial por código', licenseLabelFromCode('by-nc', '3.0') === 'CC BY-NC 3.0');
    checks.check('o código cc0 sem versão', licenseLabelFromCode('cc0') === 'CC0');
    checks.check('uma URL de outro site fica como veio', licenseLabelFromUrl('https://example.com/terms') === 'https://example.com/terms');
    checks.check('um site com nome parecido não passa por Creative Commons', licenseLabelFromUrl('https://notcreativecommons.org/licenses/by/4.0/') === 'https://notcreativecommons.org/licenses/by/4.0/');
    checks.check('um código vazio fica desconhecido', licenseLabelFromCode(' ') === 'Unknown license');
    checks.check('CC0 dispensa crédito', !requiresAttribution('CC0 1.0'));
    checks.check('CC BY exige crédito', requiresAttribution('CC BY 4.0'));
}
function fileNames(): void {
    checks.check('a extensão sai em minúsculas', fileExtensionOf('Rain.WAV') === 'wav');
    checks.check('um nome sem ponto não tem extensão', fileExtensionOf('rain') === '');
    checks.check('a pontuação vira sublinhado', safeFileName('Rain, Moderate, C.wav', 'mp3') === 'Rain_Moderate_C.mp3', safeFileName('Rain, Moderate, C.wav', 'mp3'));
    checks.check('os acentos caem', fileStemOf('Árvore antiga.png') === 'Arvore_antiga', fileStemOf('Árvore antiga.png'));
    checks.check('um caminho não escapa da pasta', fileStemOf('../../etc/passwd') === 'etc_passwd', fileStemOf('../../etc/passwd'));
    checks.check('um nome vazio recebe um padrão', fileStemOf('...') === 'asset', fileStemOf('...'));
    checks.check('o nome é limitado', fileStemOf('a'.repeat(200)).length === 64);
}
function jsonReading(): void {
    checks.check('https é aceito', parseHttpsUrl('https://cdn.polyhaven.com/a.png')?.hostname === 'cdn.polyhaven.com');
    checks.check('http é recusado', parseHttpsUrl('http://cdn.polyhaven.com/a.png') === null);
    checks.check('um esquema de script é recusado', parseHttpsUrl('javascript:alert(1)') === null);
    checks.check('credenciais na URL são recusadas', parseHttpsUrl('https://user:pass@example.com/a.png') === null);
    checks.check('uma chave herdada não é lida', recordAtPath({}, 'constructor') === null);
    checks.check('uma chave herdada de texto fica vazia', textAt({}, 'toString') === '');
}
function polyHavenModels(): void {
    const variants = listPolyHavenVariants('model', MODEL_FILES);
    checks.check('as variantes de modelo seguem a ordem de preferência', labels(variants) === 'gltf 2k, gltf 1k, fbx 1k', labels(variants));
    checks.check('o tamanho soma os arquivos incluídos', variants[1].bytes === 2711 + 81756 + 179308, String(variants[1].bytes));
    const files = resolvePolyHavenFiles('model', MODEL_FILES, 'gltf', '1k');
    const names = files.map((file) => file.name).join(', ');
    checks.check('o glTF vem com o .bin e as texturas pelo nome do arquivo', names === 'Barrel_01_1k.gltf, Barrel_01.bin, Barrel_01_diff_1k.jpg', names);
    checks.check('uma qualidade herdada do protótipo não resolve nada', resolvePolyHavenFiles('model', MODEL_FILES, 'gltf', '__proto__').length === 0);
    checks.check('um formato sem importador não aparece', !labels(variants).includes('blend'));
}
function polyHavenTextures(): void {
    const variants = listPolyHavenVariants('texture', TEXTURE_FILES);
    checks.check('as variantes de textura exigem o mapa de cor', labels(variants) === 'jpg 2k, jpg 1k, png 1k', labels(variants));
    const maps = resolvePolyHavenFiles('texture', TEXTURE_FILES, 'jpg', '1k');
    const slots = maps.map((map) => map.slots.join('+')).join(', ');
    checks.check('cada mapa vai para o slot do material', slots === 'baseColorMap, normalMap, metallicRoughnessMap+occlusionMap', slots);
    checks.check('o tamanho soma só os mapas usados', variants[1].bytes === 600, String(variants[1].bytes));
    checks.check('sem mapa de cor não há variante', resolvePolyHavenFiles('texture', TEXTURE_FILES, 'jpg', '4k').length === 0);
}
function polyHavenPanoramas(): void {
    const variants = listPolyHavenVariants('hdri', PANORAMA_FILES);
    checks.check('os panoramas ficam nas qualidades leves', labels(variants) === 'hdr 1k', labels(variants));
    checks.check('uma URL sem https é descartada', listPolyHavenVariants('hdri', INSECURE_FILES).length === 0);
}
references();
variantChoice();
licenses();
fileNames();
jsonReading();
polyHavenModels();
polyHavenTextures();
polyHavenPanoramas();
checks.finish();
