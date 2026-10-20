import * as vec3 from '@/engine/core/math/vec3';
import * as aabb from '@/engine/core/math/aabb';
import { degToRad } from '@/engine/core/math/scalar';
import { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import { MATERIAL_TEXTURE_SLOTS, type Material, type MaterialTextureSlot } from '@/engine/core/scene/material';
import type { Texture } from '@/engine/core/scene/texture';
import { createAmbientLight, createDirectionalLight } from '@/engine/core/scene/light';
import { createSkySettings } from '@/engine/core/environment/sky-settings';
import { sunDirectionFromTime, sunRotationFromDirection } from '@/engine/core/environment/celestial';
import { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { OrbitController } from '@/engine/renderer/camera/orbit-controller';
import { computeWorldBounds } from '@/engine/renderer/geometry/bounds';
import { materializeImportedScene, type MaterializedImport, type MaterializeOptions } from '@/engine/assets/import/import-materializer';
import type { ImportedScene } from '@/engine/assets/import/import-types';
type HiddenMaps = Partial<Record<MaterialTextureSlot, Texture | null>>;
const REFRAME_RATIO = 1.25;
const FRAME_MARGIN = 1.15;
export class ImportPreviewModel {
    readonly scene = new Scene('Pré-visualização', createSkySettings({ enabled: false, clouds: { enabled: false } }));
    readonly camera = new PerspectiveCamera();
    readonly orbit = new OrbitController(this.camera);
    readonly bounds = aabb.create();
    result: MaterializedImport | null = null;
    texturesVisible = true;
    private readonly hiddenMaps = new Map<Material, HiddenMaps>();
    private readonly center = vec3.create();
    private framedRadius = 0;
    private buildToken = 0;
    constructor() {
        const sun = this.scene.createEntity({ name: 'Sol', kind: 'light', light: createDirectionalLight() });
        sunRotationFromDirection(sun.transform.rotation, sunDirectionFromTime(vec3.create(), 10.5, 35, 0));
        this.scene.createEntity({ name: 'Ambiente', kind: 'light', light: createAmbientLight() });
        this.orbit.minDistance = 0.01;
        this.orbit.maxDistance = 100000;
    }
    get root(): Entity | null {
        return this.result?.root ?? null;
    }
    async rebuild(imported: ImportedScene, options: MaterializeOptions): Promise<MaterializedImport | null> {
        const token = ++this.buildToken;
        const result = await materializeImportedScene(this.scene, imported, options);
        if (token !== this.buildToken)
            return null;
        this.clear();
        this.result = result;
        this.scene.root.add(result.root);
        if (!this.texturesVisible)
            this.hideTextures();
        this.measure();
        const radius = aabb.isEmpty(this.bounds) ? 0 : aabb.halfDiagonal(this.bounds);
        const ratio = this.framedRadius > 0 ? radius / this.framedRadius : 0;
        if (ratio === 0 || ratio > REFRAME_RATIO || ratio < 1 / REFRAME_RATIO)
            this.frame();
        return result;
    }
    clear(): void {
        if (this.result)
            this.scene.root.remove(this.result.root);
        this.result = null;
        this.hiddenMaps.clear();
    }
    private measure(): void {
        this.scene.updateWorldMatrices();
        if (this.result)
            computeWorldBounds(this.scene, this.result.root, this.bounds);
        else
            aabb.reset(this.bounds);
    }
    frame(): void {
        this.measure();
        if (aabb.isEmpty(this.bounds)) {
            this.framedRadius = 0;
            this.orbit.focus(vec3.set(this.center, 0, 0, 0), 4);
            return;
        }
        aabb.center(this.center, this.bounds);
        const radius = Math.max(aabb.halfDiagonal(this.bounds), 0.01);
        this.framedRadius = radius;
        const distance = (radius / Math.sin(degToRad(this.camera.fovDegrees) / 2)) * FRAME_MARGIN;
        this.camera.near = Math.max(distance / 2000, 0.001);
        this.camera.far = Math.max(distance * 50, 100);
        this.orbit.focus(this.center, distance);
    }
    setTexturesVisible(visible: boolean): void {
        if (this.texturesVisible === visible)
            return;
        this.texturesVisible = visible;
        if (visible)
            this.restoreTextures();
        else
            this.hideTextures();
    }
    private hideTextures(): void {
        if (!this.result)
            return;
        for (const material of this.result.materials) {
            if (this.hiddenMaps.has(material))
                continue;
            const hidden: HiddenMaps = {};
            for (const { slot } of MATERIAL_TEXTURE_SLOTS) {
                hidden[slot] = material[slot];
                material[slot] = null;
            }
            this.hiddenMaps.set(material, hidden);
        }
    }
    private restoreTextures(): void {
        for (const [material, hidden] of this.hiddenMaps)
            Object.assign(material, hidden);
        this.hiddenMaps.clear();
    }
}
