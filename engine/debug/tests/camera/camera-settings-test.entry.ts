import * as vec3 from '@/engine/core/math/vec3';
import { cloneCameraSettings, createCameraSettings, isFullViewport, MAX_CAMERA_OVERLAYS, MAX_FIELD_OF_VIEW, normalizeCameraSettings, type CameraSettings } from '@/engine/camera/camera-settings';
import { CAMERA_PRESETS } from '@/engine/camera/camera-presets';
import { ALL_RENDER_LAYERS, createRenderLayerSettings, firstUnnamedRenderLayer, maskIncludesLayer, namedRenderLayers, normalizeRenderLayerSettings, RENDER_LAYER_COUNT, renderLayerBit, renderLayerName, toggleMaskLayer } from '@/engine/camera/layers/render-layers';
import { restoreInto, toPlain } from '@/engine/project/scene-document/plain-data';
import { createCheckList } from '../support/check-list';
const checks = createCheckList('Componente de câmera');
function edited(patch: Partial<CameraSettings>): CameraSettings {
    return normalizeCameraSettings({ ...createCameraSettings(), ...patch });
}
function defaults(): void {
    const settings = createCameraSettings();
    checks.check('a câmera nova é base, em perspectiva e na tela', settings.role === 'base' && settings.projection === 'perspective' && settings.target === 'screen');
    checks.check('a câmera nova ocupa a tela inteira', isFullViewport(settings.viewport));
    checks.check('a câmera nova desenha todas as camadas', settings.cullingMask === ALL_RENDER_LAYERS);
    checks.check('normalizar os padrões não muda nada', JSON.stringify(toPlain(normalizeCameraSettings(settings))) === JSON.stringify(toPlain(settings)));
}
function normalization(): void {
    const clipped = edited({ near: 5, far: 1, fieldOfView: 500, priority: 3.6, cullingMask: -1 });
    checks.check('o plano distante fica além do próximo', clipped.far > clipped.near);
    checks.near('o campo de visão respeita o teto', clipped.fieldOfView, MAX_FIELD_OF_VIEW);
    checks.check('a prioridade vira inteira', clipped.priority === 4);
    checks.check('a máscara fica nas camadas que existem', clipped.cullingMask === ALL_RENDER_LAYERS);
    const area = edited({ viewport: { x: 0.8, y: -1, width: 0.5, height: 3 } }).viewport;
    checks.near('a área não passa da borda direita', area.x + area.width, 1);
    checks.check('a área não sai por baixo nem por cima', area.y === 0 && area.height === 1);
    const overlay = edited({ role: 'overlay', overlays: [3, 4], target: 'texture' });
    checks.check('sobreposição não tem pilha própria', overlay.overlays.length === 0);
    checks.check('sobreposição sempre desenha na tela', overlay.target === 'screen');
    const stack = edited({ overlays: [7, 7, -1, 2.5, 8, 9, 10, 11] }).overlays;
    checks.check('a pilha descarta repetidos e ids inválidos', stack.join() === [7, 8, 9, 10].join());
    checks.check('a pilha respeita o limite', stack.length === MAX_CAMERA_OVERLAYS);
    const broken = edited({ fieldOfView: Number.NaN, orthographicSize: Number.NaN });
    checks.check('valores inválidos voltam ao padrão', broken.fieldOfView === 60 && broken.orthographicSize === 5);
}
function cloning(): void {
    const source = edited({ overlays: [4], postMode: 'custom' });
    const copy = cloneCameraSettings(source);
    copy.overlays.push(9);
    copy.viewport.width = 0.5;
    copy.texture.width = 64;
    copy.postProcessing.bloom.intensity = 3;
    vec3.set(copy.backgroundColor, 1, 1, 1);
    checks.check('a cópia tem a própria pilha', source.overlays.length === 1);
    checks.check('a cópia tem a própria área e textura', source.viewport.width === 1 && source.texture.width === 512);
    checks.check('a cópia tem o próprio perfil de efeitos', source.postProcessing.bloom.intensity !== 3);
    checks.check('a cópia tem a própria cor de fundo', source.backgroundColor[0] !== 1);
}
function persistence(): void {
    const source = edited({ projection: 'orthographic', orthographicSize: 12, overlays: [5, 6], priority: 2, target: 'texture', postMode: 'custom', cullingMask: 0b101 });
    source.texture.content = 'depth';
    source.postProcessing.toneMapper = 'agx';
    vec3.set(source.backgroundColor, 0.25, 0.5, 0.75);
    const restored = normalizeCameraSettings(restoreInto(createCameraSettings(), JSON.parse(JSON.stringify(toPlain(source)))));
    checks.check('salvar e abrir devolve a mesma câmera', JSON.stringify(toPlain(restored)) === JSON.stringify(toPlain(source)));
    checks.check('a cor de fundo volta como vetor', restored.backgroundColor instanceof Float32Array);
}
function presets(): void {
    const byId = new Map(CAMERA_PRESETS.map((preset) => [preset.id, preset.create()]));
    checks.check('o modelo ortográfico cria câmera ortográfica', byId.get('orthographic')?.projection === 'orthographic');
    checks.check('o modelo de sobreposição desenha só o primeiro plano', byId.get('overlay')?.role === 'overlay' && byId.get('overlay')?.cullingMask === renderLayerBit(1));
    checks.check('o modelo de textura grava numa textura', byId.get('texture')?.target === 'texture');
    checks.check('cada modelo cria uma câmera independente', CAMERA_PRESETS[0].create() !== CAMERA_PRESETS[0].create());
}
function layers(): void {
    const settings = createRenderLayerSettings();
    checks.check('a cena nasce com três camadas nomeadas', namedRenderLayers(settings).join() === '0,1,2');
    checks.check('a primeira camada livre é a seguinte', firstUnnamedRenderLayer(settings) === 3);
    checks.check('camada sem nome mostra o número', renderLayerName(settings, 7) === 'Camada 7');
    const mask = toggleMaskLayer(ALL_RENDER_LAYERS, 1);
    checks.check('alternar tira só a camada pedida', !maskIncludesLayer(mask, 1) && maskIncludesLayer(mask, 0) && maskIncludesLayer(mask, 2));
    checks.check('alternar de novo devolve a máscara', toggleMaskLayer(mask, 1) === ALL_RENDER_LAYERS);
    checks.check('camada fora da faixa cai na última', renderLayerBit(99) === renderLayerBit(RENDER_LAYER_COUNT - 1));
    const repaired = normalizeRenderLayerSettings({ names: ['', '  Mapa  ', 'x'.repeat(80)] });
    checks.check('a camada padrão nunca fica sem nome', repaired.names[0] !== '');
    checks.check('nomes são aparados e limitados', repaired.names[1] === 'Mapa' && repaired.names[2].length === 24);
    checks.check('a lista sempre tem todas as camadas', repaired.names.length === RENDER_LAYER_COUNT);
}
defaults();
normalization();
cloning();
persistence();
presets();
layers();
checks.finish();
