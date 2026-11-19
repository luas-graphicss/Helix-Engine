import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
import { isFullViewport, type CameraSettings, type CameraViewport } from '../camera-settings';
export interface ActiveCamera {
    readonly entity: Entity;
    readonly settings: CameraSettings;
}
export interface CameraLayer extends ActiveCamera {
    readonly viewport: CameraViewport;
    readonly overlay: boolean;
}
export interface CameraFramePlan {
    readonly main: ActiveCamera | null;
    readonly layers: readonly CameraLayer[];
    readonly textures: readonly ActiveCamera[];
}
interface OrderedCamera extends ActiveCamera {
    readonly order: number;
}
function collectActiveCameras(scene: Scene): OrderedCamera[] {
    const cameras: OrderedCamera[] = [];
    scene.traverseVisible((entity) => {
        const settings = entity.camera;
        if (settings?.enabled)
            cameras.push({ entity, settings, order: cameras.length });
    });
    return cameras;
}
function byDrawOrder(a: OrderedCamera, b: OrderedCamera): number {
    return a.settings.priority - b.settings.priority || a.order - b.order;
}
function overlayLayers(base: ActiveCamera, active: ReadonlyMap<number, OrderedCamera>): CameraLayer[] {
    const layers: CameraLayer[] = [];
    for (const id of base.settings.overlays) {
        const overlay = active.get(id);
        if (overlay && overlay.settings.role === 'overlay')
            layers.push({ entity: overlay.entity, settings: overlay.settings, viewport: base.settings.viewport, overlay: true });
    }
    return layers;
}
function lastFullScreenIndex(cameras: readonly ActiveCamera[]): number {
    for (let index = cameras.length - 1; index >= 0; index--) {
        if (isFullViewport(cameras[index].settings.viewport))
            return index;
    }
    return -1;
}
export function planCameraFrame(scene: Scene): CameraFramePlan {
    const cameras = collectActiveCameras(scene);
    const active = new Map(cameras.map((camera) => [camera.entity.id, camera]));
    const bases = cameras.filter((camera) => camera.settings.role === 'base').sort(byDrawOrder);
    const screen = bases.filter((camera) => camera.settings.target === 'screen');
    const mainIndex = lastFullScreenIndex(screen);
    const main = mainIndex >= 0 ? screen[mainIndex] : null;
    const layers: CameraLayer[] = main ? overlayLayers(main, active) : [];
    for (const base of screen.slice(mainIndex + 1)) {
        layers.push({ entity: base.entity, settings: base.settings, viewport: base.settings.viewport, overlay: false });
        layers.push(...overlayLayers(base, active));
    }
    return { main, layers, textures: bases.filter((camera) => camera.settings.target === 'texture') };
}
export function overlayCandidates(scene: Scene, base: Entity): Entity[] {
    const stacked = new Set(base.camera?.overlays ?? []);
    return scene.entities.filter((entity) => entity !== base && entity.camera?.role === 'overlay' && !stacked.has(entity.id));
}
export function baseCamerasStacking(scene: Scene, overlay: Entity): Entity[] {
    return scene.entities.filter((entity) => entity.camera?.role === 'base' && entity.camera.overlays.includes(overlay.id));
}
