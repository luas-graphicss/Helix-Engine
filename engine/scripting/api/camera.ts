import * as vec3 from '@/engine/core/math/vec3';
import * as mat4 from '@/engine/core/math/mat4';
import type { Vec3 } from '@/engine/core/math/vec3';
import { createRay } from '@/engine/core/math/ray';
import type { Entity } from '@/engine/core/scene/entity';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { buildPickRay, pickEntity, pickSurfacePoint } from '@/engine/editor/viewport/pick-entity';
import { HelixArgumentError, HelixError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import { assignSettings, requireEntity, requireNumber, requireObject, toVec3 } from '../runtime/values';
const scratchPoint = vec3.create();
const scratchForward = vec3.create();
const scratchOffset = vec3.create();
export class CameraEffects {
    main: Entity | null = null;
    private shakeAmplitude = 0;
    private shakeRemaining = 0;
    private shakeDuration = 0;
    private shakeSeed = Math.random() * 1000;
    shake(amplitude: number, seconds: number): void {
        this.shakeAmplitude = Math.max(this.shakeAmplitude * (this.shakeRemaining / Math.max(this.shakeDuration, 1e-3)), amplitude);
        this.shakeDuration = Math.max(seconds, 1e-3);
        this.shakeRemaining = this.shakeDuration;
        this.shakeSeed = Math.random() * 1000;
    }
    get shaking(): boolean {
        return this.shakeRemaining > 0;
    }
    reset(): void {
        this.main = null;
        this.shakeAmplitude = 0;
        this.shakeRemaining = 0;
        this.shakeDuration = 0;
    }
    apply(dt: number, camera: PerspectiveCamera, elapsed: number): void {
        const { main } = this;
        if (main) {
            const m = main.worldMatrix;
            vec3.set(camera.position, m[12], m[13], m[14]);
            vec3.normalize(scratchForward, vec3.set(scratchForward, -m[8], -m[9], -m[10]));
            vec3.scaleAndAdd(camera.target, camera.position, scratchForward, 10);
        }
        if (this.shakeRemaining <= 0)
            return;
        this.shakeRemaining = Math.max(0, this.shakeRemaining - dt);
        const falloff = this.shakeRemaining / this.shakeDuration;
        const strength = this.shakeAmplitude * falloff * falloff;
        const t = elapsed * 23 + this.shakeSeed;
        vec3.set(scratchOffset, Math.sin(t * 1.3) * Math.cos(t * 0.7), Math.sin(t * 1.9 + 1.7), Math.cos(t * 1.1 + 0.4) * Math.sin(t * 0.5));
        vec3.scale(scratchOffset, scratchOffset, strength);
        vec3.add(camera.position, camera.position, scratchOffset);
        vec3.add(camera.target, camera.target, scratchOffset);
    }
}
export function createCameraApi(host: RuntimeHost, effects: CameraEffects) {
    const { session } = host;
    const { camera, scene } = session;
    function viewportSize(): {
        width: number;
        height: number;
        pixelRatio: number;
    } {
        const canvas = session.viewportCanvas;
        const stats = session.stats;
        const width = stats.width || canvas?.width || 1;
        const height = stats.height || canvas?.height || 1;
        const pixelRatio = stats.pixelRatio || 1;
        return { width: width / pixelRatio, height: height / pixelRatio, pixelRatio };
    }
    function normalized(x: unknown, y: unknown, member: string): [
        number,
        number
    ] {
        const px = requireNumber(x, member, 'x');
        const py = requireNumber(y, member, 'y');
        const { width, height } = viewportSize();
        if (px >= 0 && px <= 1 && py >= 0 && py <= 1 && (width > 1 || height > 1))
            return [px, py];
        return [px / width, py / height];
    }
    const player = {
        get settings() {
            return scene.player.camera;
        },
        set: (patch: unknown) => assignSettings(scene.player.camera as unknown as Record<string, unknown>, patch, 'helix.camera.player.set'),
        get control(): 'engine' | 'script' {
            return session.playtest.characters?.cameraControl ?? 'engine';
        },
        set control(value: 'engine' | 'script') {
            const characters = session.playtest.characters;
            if (value !== 'engine' && value !== 'script')
                throw new HelixArgumentError('helix.camera.player.control', 'esperava "engine" ou "script".');
            if (characters)
                characters.cameraControl = value;
        },
        get yaw() {
            return session.playtest.characters?.thirdPersonCamera.yaw ?? 0;
        },
        get pitch() {
            return session.playtest.characters?.thirdPersonCamera.pitch ?? 0;
        },
    };
    return {
        get main() {
            return effects.main ?? host.cameraEntity();
        },
        setMain: (entity: unknown) => {
            const previous = effects.main;
            effects.main = entity === null || entity === undefined ? null : requireEntity(entity, 'helix.camera.setMain');
            if (previous !== effects.main)
                host.bus.emit('camera.mainChanged', effects.main);
        },
        onMainChanged: (handler: unknown) => host.bus.on('camera.mainChanged', handler as (payload: unknown) => void, host.current),
        get position() {
            return camera.position;
        },
        get target() {
            return camera.target;
        },
        get forward() {
            return vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), camera.target, camera.position));
        },
        get fov() {
            return camera.fovDegrees;
        },
        set fov(value: number) {
            camera.fovDegrees = Math.min(170, Math.max(1, requireNumber(value, 'helix.camera.fov', 'o campo de visão em graus')));
        },
        get near() {
            return camera.near;
        },
        set near(value: number) {
            camera.near = Math.max(1e-4, requireNumber(value, 'helix.camera.near', 'o plano próximo'));
        },
        get far() {
            return camera.far;
        },
        set far(value: number) {
            camera.far = Math.max(camera.near + 1e-3, requireNumber(value, 'helix.camera.far', 'o plano distante'));
        },
        get exposure() {
            return camera.exposure;
        },
        set exposure(value: number) {
            camera.exposure = Math.max(0, requireNumber(value, 'helix.camera.exposure', 'a exposição'));
        },
        get aspect() {
            return camera.aspect;
        },
        setPose: (position: unknown, target: unknown) => {
            toVec3(position, 'helix.camera.setPose', camera.position);
            toVec3(target, 'helix.camera.setPose', camera.target);
        },
        lookAt: (target: unknown) => {
            toVec3(target, 'helix.camera.lookAt', camera.target);
        },
        get viewport() {
            return viewportSize();
        },
        get viewMatrix() {
            camera.updateMatrices();
            return camera.viewMatrix;
        },
        get projectionMatrix() {
            camera.updateMatrices();
            return camera.projectionMatrix;
        },
        get viewProjectionMatrix() {
            camera.updateMatrices();
            return camera.viewProjectionMatrix;
        },
        screenToRay: (x: unknown, y: unknown) => {
            const [u, v] = normalized(x, y, 'helix.camera.screenToRay');
            camera.updateMatrices();
            const ray = createRay();
            if (!buildPickRay(ray, camera, u, v))
                return null;
            return ray;
        },
        worldToScreen: (point: unknown) => {
            toVec3(point, 'helix.camera.worldToScreen', scratchPoint);
            camera.updateMatrices();
            const m = camera.viewProjectionMatrix;
            const x = scratchPoint[0];
            const y = scratchPoint[1];
            const z = scratchPoint[2];
            const clipW = m[3] * x + m[7] * y + m[11] * z + m[15];
            if (Math.abs(clipW) < 1e-9)
                return null;
            const ndcX = (m[0] * x + m[4] * y + m[8] * z + m[12]) / clipW;
            const ndcY = (m[1] * x + m[5] * y + m[9] * z + m[13]) / clipW;
            const ndcZ = (m[2] * x + m[6] * y + m[10] * z + m[14]) / clipW;
            const { width, height } = viewportSize();
            return { x: (ndcX * 0.5 + 0.5) * width, y: (1 - (ndcY * 0.5 + 0.5)) * height, depth: ndcZ, behind: clipW < 0 };
        },
        pick: (x: unknown, y: unknown, options?: unknown) => {
            const [u, v] = normalized(x, y, 'helix.camera.pick');
            const extra = options === undefined ? {} : requireObject(options, 'helix.camera.pick');
            scene.updateWorldMatrices();
            camera.updateMatrices();
            return pickEntity(scene, camera, u, v, {
                includeLocked: extra.includeLocked !== false,
                showCsgBrushes: extra.showCsgBrushes === true,
                lightHelpers: extra.lights === true ? 'all' : 'off',
                soundHelpers: extra.sounds === true ? 'all' : 'off',
                vfxHelpers: extra.vfx === true ? 'all' : 'off',
            });
        },
        pickPoint: (x: unknown, y: unknown) => {
            const [u, v] = normalized(x, y, 'helix.camera.pickPoint');
            scene.updateWorldMatrices();
            camera.updateMatrices();
            return pickSurfacePoint(vec3.create(), scene, camera, u, v);
        },
        shake: (amplitude: unknown, seconds: unknown = 0.5) => {
            effects.shake(requireNumber(amplitude, 'helix.camera.shake', 'a amplitude em metros'), requireNumber(seconds, 'helix.camera.shake', 'a duração'));
        },
        get shaking() {
            return effects.shaking;
        },
        fade: (color: unknown = 'black', seconds: unknown = 0.5, direction: unknown = 'out') => {
            if (direction !== 'in' && direction !== 'out')
                throw new HelixArgumentError('helix.camera.fade', 'a direção precisa ser "in" (revelar) ou "out" (cobrir).');
            return host.web.fade(typeof color === 'string' ? color : cssFromLinear(toVec3(color, 'helix.camera.fade')), requireNumber(seconds, 'helix.camera.fade', 'a duração'), direction);
        },
        player,
        frame: (entity: unknown) => {
            if (host.mode !== 'editor')
                throw new HelixError('helix.camera.frame só existe no modo editor (helix.isEditor); no jogo use helix.camera.setPose ou setMain.');
            session.focusEntity(requireEntity(entity, 'helix.camera.frame'));
        },
        mainForward: () => {
            const main = effects.main;
            if (!main)
                return vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), camera.target, camera.position));
            const m = main.worldMatrix;
            return vec3.normalize(vec3.create(), vec3.set(vec3.create(), -m[8], -m[9], -m[10]));
        },
        distanceTo: (value: unknown) => {
            if (value && typeof value === 'object' && 'worldMatrix' in (value as object)) {
                const entity = requireEntity(value, 'helix.camera.distanceTo');
                scene.updateWorldMatrices();
                mat4.getTranslation(scratchPoint, entity.worldMatrix);
            }
            else {
                toVec3(value, 'helix.camera.distanceTo', scratchPoint);
            }
            return vec3.distance(camera.position, scratchPoint);
        },
    };
}
function cssFromLinear(color: Vec3): string {
    const channel = (value: number) => Math.round(Math.min(1, Math.max(0, value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055)) * 255);
    return `rgb(${channel(color[0])}, ${channel(color[1])}, ${channel(color[2])})`;
}
