import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { clamp, degToRad } from '@/engine/core/math/scalar';
import { createRay, transformRay } from '@/engine/core/math/ray';
import type { Entity } from '@/engine/core/scene/entity';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { buildPickRay } from '@/engine/editor/viewport/pick-entity';
import type { TerrainBrushOverlay } from '@/engine/renderer/passes/terrain-pass';
import type { Terrain, TerrainHit } from '@/engine/terrain/core/terrain';
import { clampRegion, createRegion } from '@/engine/terrain/core/heightfield';
import { TerrainMaterialLibrary } from '@/engine/terrain/materials/terrain-material-library';
import { createBrushSettings, falloffHalfRadius, falloffWeight, MAX_BRUSH_RADIUS, MIN_BRUSH_RADIUS, type BrushSettings } from '@/engine/terrain/sculpt/brush';
import { erodeThermal, sculptFlatten, sculptNoise, sculptRaise, sculptSmooth, sculptTerrace, type Stamp } from '@/engine/terrain/sculpt/sculpt-tools';
import { paintLayer } from '@/engine/terrain/sculpt/paint-tool';
import { paintGrass } from '@/engine/terrain/foliage/grass-paint-tool';
import { materialSupportsGrass } from '@/engine/terrain/foliage/grass-placement';
import { createGenerationParams, type TerrainGenerationParams } from '@/engine/terrain/generation/terrain-generator';
import { TerrainStroke, type StrokeKind } from './terrain-stroke';
export type TerrainToolId = 'raise' | 'smooth' | 'flatten' | 'noise' | 'terrace' | 'erode' | 'paint' | 'grass';
export interface TerrainToolInfo {
    readonly id: TerrainToolId;
    readonly label: string;
    readonly description: string;
    readonly key: string;
}
export const TERRAIN_TOOLS: readonly TerrainToolInfo[] = [
    { id: 'raise', label: 'Elevar', description: 'Levanta o relevo sob o pincel. Shift rebaixa.', key: '1' },
    { id: 'smooth', label: 'Suavizar', description: 'Dilui arestas e ruído em formas macias.', key: '2' },
    { id: 'flatten', label: 'Achatar', description: 'Nivela à altura tocada no início da pincelada, ou a uma altura fixa.', key: '3' },
    { id: 'noise', label: 'Ruído', description: 'Acrescenta detalhe fractal ao relevo. Shift subtrai.', key: '4' },
    { id: 'terrace', label: 'Terraço', description: 'Empurra o relevo para degraus de altura regular.', key: '5' },
    { id: 'erode', label: 'Erosão', description: 'Desliza material das encostas íngremes, como o tempo faria.', key: '6' },
    { id: 'paint', label: 'Pintar', description: 'Aplica a camada ativa de material. Shift remove.', key: '7' },
    { id: 'grass', label: 'Grama', description: 'Planta grama onde o solo aceita (vegetação e terra). Shift arranca.', key: '8' },
];
const STROKE_KIND: Record<TerrainToolId, StrokeKind> = {
    raise: 'heights',
    smooth: 'heights',
    flatten: 'heights',
    noise: 'heights',
    terrace: 'heights',
    erode: 'heights',
    paint: 'splat',
    grass: 'grass',
};
export interface TerrainToolSettings {
    flattenMode: 'sample' | 'fixed';
    flattenHeight: number;
    noiseScale: number;
    terraceStep: number;
    erodeTalus: number;
}
export interface TerrainHover {
    valid: boolean;
    x: number;
    z: number;
    height: number;
}
const RAISE_RATE = 8;
const SMOOTH_RATE = 8;
const FLATTEN_RATE = 8;
const NOISE_RATE = 5;
const TERRACE_RATE = 6;
const ERODE_RATE = 3;
const PAINT_RATE = 5;
const GRASS_RATE = 4;
const MAX_STEP_SECONDS = 0.05;
const FIRST_STEP_SECONDS = 1 / 60;
const BRUSH_COLORS: Record<'sculpt' | 'invert' | 'paint' | 'grass' | 'erase', Vec3> = {
    sculpt: vec3.create(1, 0.86, 0.45),
    invert: vec3.create(0.5, 0.78, 1),
    paint: vec3.create(0.62, 1, 0.55),
    grass: vec3.create(0.4, 1, 0.78),
    erase: vec3.create(1, 0.5, 0.45),
};
export class TerrainEditor {
    readonly materials: TerrainMaterialLibrary;
    tool: TerrainToolId = 'raise';
    readonly brush: BrushSettings = createBrushSettings();
    readonly settings: TerrainToolSettings = { flattenMode: 'sample', flattenHeight: 0, noiseScale: 12, terraceStep: 4, erodeTalus: 35 };
    readonly generation: TerrainGenerationParams = createGenerationParams();
    activeLayerId: number | null = null;
    readonly hover: TerrainHover = { valid: false, x: 0, z: 0, height: 0 };
    private hoverEntityId: number | null = null;
    private readonly overlay: TerrainBrushOverlay = { entityId: 0, x: 0, z: 0, radius: 1, innerRadius: 0.5, color: vec3.create() };
    private stroke: TerrainStroke | null = null;
    private invert = false;
    private flattenTarget = 0;
    private strokeSeed = 0;
    private readonly worldRay = createRay();
    private readonly localRay = createRay();
    private readonly inverseWorld = mat4.create();
    private readonly hit: TerrainHit = { distance: 0, point: vec3.create() };
    private readonly region = createRegion();
    private readonly stamp: Stamp = { cx: 0, cz: 0, radius: 1, falloff: 'smooth', region: createRegion() };
    constructor(private readonly session: EditorSession) {
        this.materials = new TerrainMaterialLibrary(() => session.notify());
    }
    get target(): Entity | null {
        const selected = this.session.selectedEntity;
        if (selected?.terrain)
            return selected;
        let found: Entity | null = null;
        this.session.scene.traverse((entity) => {
            if (!found && entity.terrain)
                found = entity;
        });
        return found;
    }
    get activeLayerIndex(): number {
        const terrain = this.target?.terrain;
        if (!terrain || terrain.layers.length === 0)
            return -1;
        const index = terrain.layers.findIndex((layer) => layer.id === this.activeLayerId);
        return index === -1 ? 0 : index;
    }
    get isStroking(): boolean {
        return this.stroke !== null;
    }
    get brushOverlay(): TerrainBrushOverlay | null {
        if (this.session.tool !== 'terrain' || !this.hover.valid || this.hoverEntityId === null)
            return null;
        const { overlay, brush } = this;
        overlay.entityId = this.hoverEntityId;
        overlay.x = this.hover.x;
        overlay.z = this.hover.z;
        overlay.radius = brush.radius;
        overlay.innerRadius = brush.radius * falloffHalfRadius(brush.falloff);
        const kind = STROKE_KIND[this.tool];
        if (kind === 'heights')
            vec3.copy(overlay.color, this.invert ? BRUSH_COLORS.invert : BRUSH_COLORS.sculpt);
        else if (this.invert)
            vec3.copy(overlay.color, BRUSH_COLORS.erase);
        else
            vec3.copy(overlay.color, kind === 'grass' ? BRUSH_COLORS.grass : BRUSH_COLORS.paint);
        return overlay;
    }
    setTool(tool: TerrainToolId): void {
        if (this.tool === tool)
            return;
        this.tool = tool;
        this.session.notify();
    }
    updateBrush(patch: Partial<BrushSettings>): void {
        Object.assign(this.brush, patch);
        this.brush.radius = clamp(this.brush.radius, MIN_BRUSH_RADIUS, MAX_BRUSH_RADIUS);
        this.brush.strength = clamp(this.brush.strength, 0.01, 1);
        this.session.notify();
    }
    scaleBrushRadius(factor: number): void {
        this.updateBrush({ radius: this.brush.radius * factor });
    }
    updateSettings(patch: Partial<TerrainToolSettings>): void {
        Object.assign(this.settings, patch);
        this.session.notify();
    }
    updateGeneration(patch: Partial<TerrainGenerationParams>): void {
        Object.assign(this.generation, patch);
        this.session.notify();
    }
    setActiveLayer(id: number | null): void {
        if (this.activeLayerId === id)
            return;
        this.activeLayerId = id;
        this.session.notify();
    }
    setInvert(invert: boolean): void {
        this.invert = invert;
    }
    updateHover(u: number, v: number): boolean {
        const entity = this.target;
        const terrain = entity?.terrain;
        if (!entity || !terrain || !buildPickRay(this.worldRay, this.session.camera, u, v) || !mat4.invert(this.inverseWorld, entity.worldMatrix)) {
            this.hover.valid = false;
            return false;
        }
        transformRay(this.localRay, this.worldRay, this.inverseWorld);
        const hit = terrain.raycast(this.localRay.origin, this.localRay.direction, this.hit);
        if (!hit) {
            this.hover.valid = false;
            return false;
        }
        this.hover.valid = true;
        this.hover.x = hit.point[0];
        this.hover.z = hit.point[2];
        this.hover.height = hit.point[1];
        this.hoverEntityId = entity.id;
        return true;
    }
    clearHover(): void {
        this.hover.valid = false;
    }
    sampleFlattenHeight(): void {
        if (!this.hover.valid)
            return;
        this.updateSettings({ flattenMode: 'fixed', flattenHeight: Math.round(this.hover.height * 100) / 100 });
    }
    beginStroke(invert: boolean): boolean {
        const terrain = this.target?.terrain;
        if (!terrain || !this.hover.valid || this.stroke)
            return false;
        if (this.tool === 'paint' && this.activeLayerIndex < 0) {
            this.session.log.warn('Terreno', 'Adicione uma camada de material antes de pintar.');
            return false;
        }
        if (this.tool === 'grass' && !invert && !terrain.layers.some((layer) => materialSupportsGrass(layer.material))) {
            this.session.log.warn('Terreno', 'Nenhuma camada aceita grama. Adicione uma camada de vegetação ou de terra (grama, campo, terra, lama).');
            return false;
        }
        this.invert = invert;
        this.strokeSeed = Math.floor(Math.random() * 65536);
        this.flattenTarget = this.settings.flattenMode === 'fixed' ? this.settings.flattenHeight : this.hover.height;
        this.stroke = new TerrainStroke(terrain, STROKE_KIND[this.tool]);
        this.apply(terrain, FIRST_STEP_SECONDS);
        return true;
    }
    tick(deltaSeconds: number): void {
        if (!this.stroke || !this.hover.valid)
            return;
        this.apply(this.stroke.terrain, deltaSeconds);
    }
    endStroke(): void {
        const stroke = this.stroke;
        if (!stroke)
            return;
        this.stroke = null;
        const command = stroke.finish(this.strokeLabel());
        if (command)
            this.session.history.execute(command);
    }
    cancelStroke(): void {
        const stroke = this.stroke;
        if (!stroke)
            return;
        this.stroke = null;
        stroke.finish('')?.undo();
    }
    private strokeLabel(): string {
        const info = TERRAIN_TOOLS.find((tool) => tool.id === this.tool);
        const name = info?.label ?? 'Terreno';
        if (this.tool === 'raise' && this.invert)
            return 'Rebaixar terreno';
        if (this.tool === 'paint')
            return this.invert ? 'Apagar camada' : 'Pintar camada';
        if (this.tool === 'grass')
            return this.invert ? 'Arrancar grama' : 'Plantar grama';
        return `${name} terreno`;
    }
    private apply(terrain: Terrain, deltaSeconds: number): void {
        const stroke = this.stroke;
        if (!stroke)
            return;
        const { x, z } = this.hover;
        const { radius, strength, falloff } = this.brush;
        const step = Math.min(deltaSeconds, MAX_STEP_SECONDS);
        const sign = this.invert ? -1 : 1;
        const region = this.region;
        if (this.tool === 'paint') {
            paintLayer(terrain, x, z, radius, falloff, this.activeLayerIndex, sign * Math.min(strength * PAINT_RATE * step, 1), region);
            stroke.extend(region);
            return;
        }
        if (this.tool === 'grass') {
            paintGrass(terrain, x, z, radius, falloff, sign * Math.min(strength * GRASS_RATE * step, 1), region);
            stroke.extend(region);
            return;
        }
        const { heightfield, cellSize } = terrain;
        const stamp = this.stamp;
        stamp.cx = terrain.localToGrid(x);
        stamp.cz = terrain.localToGrid(z);
        stamp.radius = radius / cellSize;
        stamp.falloff = falloff;
        terrain.gridRegionAround(x, z, radius, stamp.region);
        region.x0 = stamp.region.x0;
        region.z0 = stamp.region.z0;
        region.x1 = stamp.region.x1;
        region.z1 = stamp.region.z1;
        switch (this.tool) {
            case 'raise':
                sculptRaise(heightfield, stamp, sign * strength * RAISE_RATE * step);
                break;
            case 'smooth':
                sculptSmooth(heightfield, stamp, Math.min(strength * SMOOTH_RATE * step, 1));
                break;
            case 'flatten':
                sculptFlatten(heightfield, stamp, this.flattenTarget, Math.min(strength * FLATTEN_RATE * step, 1));
                break;
            case 'noise':
                sculptNoise(heightfield, stamp, sign * strength * NOISE_RATE * step, this.settings.noiseScale / cellSize, this.strokeSeed);
                break;
            case 'terrace':
                sculptTerrace(heightfield, stamp, this.settings.terraceStep, Math.min(strength * TERRACE_RATE * step, 1));
                break;
            case 'erode': {
                const invRadius = 1 / Math.max(stamp.radius, 1e-6);
                erodeThermal(heightfield, stamp.region, cellSize, Math.tan(degToRad(this.settings.erodeTalus)), Math.min(strength * ERODE_RATE * step, 0.5), (gx, gz) => falloffWeight(Math.hypot((gx - stamp.cx) * invRadius, (gz - stamp.cz) * invRadius), falloff));
                clampRegion(region, heightfield.resolution, 1);
                break;
            }
        }
        terrain.heightsChanged(region);
        stroke.extend(region);
    }
}
