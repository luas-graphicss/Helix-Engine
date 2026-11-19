import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import { createPostProcessSettings } from '@/engine/core/environment/post-process-settings';
import { cloneEntity } from '@/engine/core/scene/entity-utils';
import { Scene } from '@/engine/core/scene/scene';
import { createCameraSettings } from '@/engine/camera/camera-settings';
import { drawsInMask } from '@/engine/camera/layers/layer-draws';
import { ALL_RENDER_LAYERS, renderLayerBit } from '@/engine/camera/layers/render-layers';
import { aimCameraFromEntity, applyCameraLens, applyCameraOutput, captureCameraView, resetCameraOutput, restoreCameraView, screenBackdrop } from '@/engine/renderer/camera/camera-rig';
import { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { pixelsPerTangent } from '@/engine/renderer/culling/screen-coverage';
import { VisibleSet, type CullingOptions } from '@/engine/renderer/culling/visible-set';
import { createBox } from '@/engine/renderer/geometry/primitives';
import { ShadowCascades } from '@/engine/renderer/shadows/shadow-cascades';
import { createCheckList } from '../support/check-list';
const VIEWPORT_HEIGHT = 720;
const CULLING: CullingOptions = { frustumCulling: true, minPixelSize: 0, occlusionCulling: false, lodGroups: true };
const FOREGROUND_LAYER = 1;
const checks = createCheckList('Visão das câmeras');
function project(camera: PerspectiveCamera, x: number, y: number, z: number): Float32Array {
    return mat4.transformPoint(vec3.create(), camera.viewProjectionMatrix, vec3.create(x, y, z));
}
function orthographicCamera(): PerspectiveCamera {
    const camera = new PerspectiveCamera();
    camera.projection = 'orthographic';
    camera.orthographicSize = 2;
    camera.aspect = 2;
    camera.updateMatrices();
    return camera;
}
function projection(): void {
    const perspective = new PerspectiveCamera();
    perspective.updateMatrices();
    checks.check('em perspectiva o que está longe fica menor', Math.abs(project(perspective, 1, 0, -20)[0]) < Math.abs(project(perspective, 1, 0, 0)[0]));
    checks.near('a tangente segue o campo de visão', perspective.tanHalfFov, Math.tan(Math.PI / 6));
    const orthographic = orthographicCamera();
    checks.nearAll('a borda do volume ortográfico cai na borda da tela', project(orthographic, 4, 2, 0).subarray(0, 2), [1, 1]);
    checks.near('em ortográfica a distância não muda o tamanho', project(orthographic, 1, 0, -40)[0], project(orthographic, 1, 0, 0)[0]);
    checks.check('a câmera ortográfica é inversível', orthographic.invertible);
    checks.near('a meia altura ortográfica é a mesma em qualquer distância', orthographic.halfHeightAt(300), 2);
    checks.near('a meia altura em perspectiva cresce com a distância', perspective.halfHeightAt(10), 10 * Math.tan(Math.PI / 6));
    checks.near('a cobertura ortográfica usa a distância de foco', pixelsPerTangent(orthographic, VIEWPORT_HEIGHT), (VIEWPORT_HEIGHT * 0.5) / (2 / 5));
}
function cascades(): void {
    const orthographic = orthographicCamera();
    orthographic.near = 1;
    orthographic.updateMatrices();
    const fitted = new ShadowCascades(2, 1024);
    fitted.prepare(orthographic, { min: vec3.create(-20, -20, -20), max: vec3.create(20, 20, 20) }, 60);
    const boxDiagonal = Math.hypot(2, 4);
    checks.check('as cascatas cobrem a largura inteira do volume ortográfico', fitted.desiredRadii[0] >= boxDiagonal);
}
function aiming(): void {
    const scene = new Scene();
    const entity = scene.createEntity({ name: 'top', kind: 'camera', camera: { ...createCameraSettings(), projection: 'orthographic', orthographicSize: 8, near: 0.5, far: 80 } });
    vec3.set(entity.transform.position, 3, 20, -4);
    vec3.set(entity.transform.rotation, -90, 0, 0);
    scene.updateWorldMatrices();
    const camera = new PerspectiveCamera();
    aimCameraFromEntity(camera, entity);
    applyCameraLens(camera, entity.camera ?? createCameraSettings());
    camera.updateMatrices();
    checks.check('câmera apontada para baixo continua inversível', camera.invertible);
    checks.nearAll('o chão logo abaixo cai no centro da tela', project(camera, 3, 0, -4).subarray(0, 2), [0, 0], 1e-4);
    checks.check('a lente do componente vai para a câmera', camera.orthographic && camera.orthographicSize === 8 && camera.near === 0.5 && camera.far === 80);
}
function output(): void {
    const camera = new PerspectiveCamera();
    const scenePost = createPostProcessSettings({ toneMapper: 'agx' });
    const settings = createCameraSettings();
    settings.cullingMask = renderLayerBit(FOREGROUND_LAYER);
    applyCameraOutput(camera, settings, scenePost, { backdrop: 'scene', content: 'color' });
    checks.check('sem perfil próprio a câmera usa os efeitos da cena', camera.postProcessing === null);
    checks.check('a máscara do componente vai para a câmera', camera.layerMask === renderLayerBit(FOREGROUND_LAYER));
    settings.postMode = 'custom';
    applyCameraOutput(camera, settings, scenePost, { backdrop: 'scene', content: 'color' });
    checks.check('o perfil próprio é o do componente', camera.postProcessing === settings.postProcessing);
    settings.postMode = 'off';
    applyCameraOutput(camera, settings, scenePost, { backdrop: 'scene', content: 'depth' });
    checks.check('efeitos desligados mantêm o tone mapping da cena', camera.postProcessing?.enabled === false && camera.postProcessing.toneMapper === 'agx');
    checks.check('a cena não é alterada ao desligar os efeitos', scenePost.enabled);
    checks.check('o conteúdo pedido vai para a câmera', camera.content === 'depth');
    settings.background = 'color';
    checks.check('o fundo segue o componente e a função', screenBackdrop(settings, false) === 'color' && screenBackdrop(settings, true) === 'transparent' && screenBackdrop(createCameraSettings(), false) === 'scene');
    const before = captureCameraView(new PerspectiveCamera());
    restoreCameraView(camera, before);
    checks.check('restaurar devolve a visão do editor', camera.layerMask === ALL_RENDER_LAYERS && camera.postProcessing === null && camera.content === 'color');
    camera.projection = 'orthographic';
    resetCameraOutput(camera);
    checks.check('zerar a saída volta à perspectiva sem máscara', !camera.orthographic && camera.layerMask === ALL_RENDER_LAYERS);
}
function cullingMask(): void {
    const scene = new Scene();
    scene.createEntity({ name: 'world', kind: 'mesh', mesh: createBox() });
    const weapon = scene.createEntity({ name: 'weapon', kind: 'mesh', mesh: createBox(), layer: FOREGROUND_LAYER });
    scene.updateWorldMatrices();
    const camera = new PerspectiveCamera();
    camera.updateMatrices();
    const visible = new VisibleSet();
    const names = (mask: number): string => {
        camera.layerMask = mask;
        visible.collect(scene, camera, VIEWPORT_HEIGHT, CULLING);
        return visible.meshes.map((item) => item.entity.name).sort().join(',');
    };
    checks.check('sem máscara a câmera vê todas as camadas', names(ALL_RENDER_LAYERS) === 'weapon,world');
    checks.check('a máscara esconde as camadas desmarcadas', names(renderLayerBit(0)) === 'world');
    checks.check('quem saiu da máscara continua projetando sombra', visible.casters.length === 2);
    checks.check('uma câmera só de primeiro plano vê só a arma', names(renderLayerBit(FOREGROUND_LAYER)) === 'weapon');
    checks.check('voltar a máscara devolve os atores', names(ALL_RENDER_LAYERS) === 'weapon,world');
    checks.check('a cópia de um ator mantém a camada', cloneEntity(scene, weapon, scene.root).layer === FOREGROUND_LAYER);
    const draws = [{ entityId: weapon.id }, { entityId: 9999 }];
    checks.check('listas de desenho seguem a máscara', drawsInMask(scene, draws, renderLayerBit(0)).length === 1 && drawsInMask(scene, draws, ALL_RENDER_LAYERS) === draws);
}
projection();
cascades();
aiming();
output();
cullingMask();
checks.finish();
