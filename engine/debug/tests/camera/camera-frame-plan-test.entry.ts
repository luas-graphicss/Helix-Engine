import type { Entity } from '@/engine/core/scene/entity';
import { Scene } from '@/engine/core/scene/scene';
import { createCameraSettings, normalizeCameraSettings, type CameraSettings, type CameraViewport } from '@/engine/camera/camera-settings';
import { baseCamerasStacking, overlayCandidates, planCameraFrame, type CameraFramePlan } from '@/engine/camera/stack/camera-frame-plan';
import { createCheckList } from '../support/check-list';
const LEFT_HALF: CameraViewport = { x: 0, y: 0, width: 0.5, height: 1 };
const RIGHT_HALF: CameraViewport = { x: 0.5, y: 0, width: 0.5, height: 1 };
const CORNER: CameraViewport = { x: 0.7, y: 0.7, width: 0.25, height: 0.25 };
const checks = createCheckList('Plano de câmeras do quadro');
function addCamera(scene: Scene, name: string, patch: Partial<CameraSettings> = {}, parent: Entity | null = scene.root): Entity {
    return scene.createEntity({ name, kind: 'camera', camera: normalizeCameraSettings({ ...createCameraSettings(), ...patch }) }, parent);
}
function layerNames(plan: CameraFramePlan): string {
    return plan.layers.map((layer) => `${layer.entity.name}${layer.overlay ? '*' : ''}`).join(',');
}
function mainName(plan: CameraFramePlan): string {
    return plan.main?.entity.name ?? '-';
}
function singleCamera(): void {
    const scene = new Scene();
    checks.check('cena sem câmera não tem visão principal', planCameraFrame(scene).main === null);
    addCamera(scene, 'main');
    const plan = planCameraFrame(scene);
    checks.check('a única câmera de tela cheia é a principal', mainName(plan) === 'main' && plan.layers.length === 0);
}
function priorities(): void {
    const scene = new Scene();
    addCamera(scene, 'low');
    addCamera(scene, 'high', { priority: 5 });
    const plan = planCameraFrame(scene);
    checks.check('entre câmeras de tela cheia vence a de maior prioridade', mainName(plan) === 'high');
    checks.check('a câmera coberta não é desenhada', plan.layers.length === 0);
    const tied = new Scene();
    addCamera(tied, 'first');
    addCamera(tied, 'second');
    checks.check('no empate vence a mais abaixo na hierarquia', mainName(planCameraFrame(tied)) === 'second');
}
function pictureInPicture(): void {
    const scene = new Scene();
    addCamera(scene, 'pip', { priority: 1, viewport: CORNER });
    addCamera(scene, 'main');
    const plan = planCameraFrame(scene);
    checks.check('a câmera de canto fica por cima da principal', mainName(plan) === 'main' && layerNames(plan) === 'pip');
    const covered = new Scene();
    addCamera(covered, 'pip', { priority: -1, viewport: CORNER });
    addCamera(covered, 'main');
    checks.check('câmera de canto com prioridade menor fica escondida', layerNames(planCameraFrame(covered)) === '');
}
function splitScreen(): void {
    const scene = new Scene();
    addCamera(scene, 'right', { priority: 2, viewport: RIGHT_HALF });
    addCamera(scene, 'left', { priority: 1, viewport: LEFT_HALF });
    const plan = planCameraFrame(scene);
    checks.check('tela dividida não tem câmera principal', plan.main === null);
    checks.check('as metades são desenhadas na ordem da prioridade', layerNames(plan) === 'left,right');
}
function stacking(): void {
    const scene = new Scene();
    const base = addCamera(scene, 'base');
    const weapon = addCamera(scene, 'weapon', { role: 'overlay' });
    const markers = addCamera(scene, 'markers', { role: 'overlay' });
    const sleeping = addCamera(scene, 'sleeping', { role: 'overlay', enabled: false });
    const other = addCamera(scene, 'other', { priority: -3 });
    base.camera = normalizeCameraSettings({ ...createCameraSettings(), overlays: [markers.id, sleeping.id, other.id, weapon.id, 999] });
    const plan = planCameraFrame(scene);
    checks.check('a pilha segue a ordem da lista e pula inativas, bases e removidas', layerNames(plan) === 'markers*,weapon*');
    checks.check('sobreposições herdam a área da base', plan.layers.every((layer) => layer.viewport === base.camera?.viewport));
    checks.check('sobreposição fora de pilha não é desenhada', layerNames(planCameraFrame(new Scene())) === '');
    checks.check('as bases que empilham uma câmera são encontradas', baseCamerasStacking(scene, weapon).map((entity) => entity.name).join() === 'base');
    checks.check('só sobreposições livres são oferecidas à pilha', overlayCandidates(scene, base).map((entity) => entity.name).join() === '');
    const half = addCamera(scene, 'half', { priority: 4, viewport: RIGHT_HALF });
    half.camera = normalizeCameraSettings({ ...createCameraSettings(), priority: 4, viewport: RIGHT_HALF, overlays: [weapon.id] });
    checks.check('cada base leva a própria pilha logo acima dela', layerNames(planCameraFrame(scene)) === 'markers*,weapon*,half,weapon*');
}
function textures(): void {
    const scene = new Scene();
    addCamera(scene, 'main');
    addCamera(scene, 'monitor', { target: 'texture', priority: 9 });
    const plan = planCameraFrame(scene);
    checks.check('câmera para textura não disputa a tela', mainName(plan) === 'main' && plan.layers.length === 0);
    checks.check('câmera para textura entra na lista de texturas', plan.textures.map((camera) => camera.entity.name).join() === 'monitor');
}
function visibility(): void {
    const scene = new Scene();
    const rig = scene.createEntity({ name: 'rig', kind: 'group' });
    addCamera(scene, 'hidden', {}, rig);
    addCamera(scene, 'off', { enabled: false });
    scene.createEntity({ name: 'legacy', kind: 'camera' });
    rig.visible = false;
    const plan = planCameraFrame(scene);
    checks.check('câmera inativa, escondida ou sem componente não desenha', plan.main === null && plan.layers.length === 0 && plan.textures.length === 0);
    rig.visible = true;
    checks.check('mostrar o pai devolve a câmera', mainName(planCameraFrame(scene)) === 'hidden');
}
singleCamera();
priorities();
pictureInPicture();
splitScreen();
stacking();
textures();
visibility();
checks.finish();
