import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { clamp } from '@/engine/core/math/scalar';
import type { Entity } from '@/engine/core/scene/entity';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import type { GuiVideoControl, GuiViewportControl } from '@/engine/gui/document/gui-document';
import { faceTowardCamera, nearestBoundsFace } from '@/engine/gui/world/gui-surface-frame';
import { convertGuiSurfaceContent, convertGuiSurfaceMount, createFaceMount, createGuiSurfaceSettings, createScreenContent, createVideoContent, findGuiSurfacePreset, GUI_SURFACE_CONTENT_LABEL, GUI_SURFACE_FACE_LABEL, GUI_SURFACE_MOUNT_LABEL, SURFACE_BRIGHTNESS_MAX, SURFACE_DISTANCE_MAX, SURFACE_FRAME_RATE_MAX, SURFACE_INSET_MAX, SURFACE_OFFSET_MAX, SURFACE_PIXELS_PER_METER_MAX, SURFACE_PIXELS_PER_METER_MIN, SURFACE_SIZE_MAX, SURFACE_SIZE_MIN, type GuiSurfaceBillboardMount, type GuiSurfaceContentKind, type GuiSurfaceFaceMount, type GuiSurfaceMountKind, type GuiSurfacePanelMount, type GuiSurfaceSettings, } from '@/engine/gui/world/gui-surface-settings';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { addEntity, spawnPosition } from './entity-operations';
const LOG_SOURCE = 'Interface no mundo';
const ACTOR_NAME = 'Interface';
const PANEL_SPAWN_HEIGHT = 1.2;
export type GuiSurfaceScalarField = 'pixelsPerMeter' | 'brightness' | 'opacity' | 'backdropAlpha' | 'interactionDistance' | 'frameRate' | 'cullDistance' | 'audioRange';
interface Limits {
    readonly min: number;
    readonly max: number;
    readonly label: string;
    readonly integer?: boolean;
}
const SCALAR_LIMITS: Record<GuiSurfaceScalarField, Limits> = {
    pixelsPerMeter: { min: SURFACE_PIXELS_PER_METER_MIN, max: SURFACE_PIXELS_PER_METER_MAX, label: 'Resolução da interface', integer: true },
    brightness: { min: 0, max: SURFACE_BRIGHTNESS_MAX, label: 'Brilho da interface' },
    opacity: { min: 0, max: 1, label: 'Opacidade da interface' },
    backdropAlpha: { min: 0, max: 1, label: 'Opacidade do fundo da interface' },
    interactionDistance: { min: 0, max: SURFACE_DISTANCE_MAX, label: 'Alcance da interação' },
    frameRate: { min: 0, max: SURFACE_FRAME_RATE_MAX, label: 'Quadros por segundo da interface', integer: true },
    cullDistance: { min: 0, max: SURFACE_DISTANCE_MAX, label: 'Distância de ocultação' },
    audioRange: { min: 0.1, max: SURFACE_DISTANCE_MAX, label: 'Alcance do som da interface' },
};
export function defaultSurfaceScreenId(session: EditorSession): string | null {
    return session.gui.assetId ?? session.library.byKind('gui')[0]?.id ?? null;
}
function assetName(session: EditorSession, assetId: string | null): string | null {
    return assetId ? (session.library.get(assetId)?.name ?? null) : null;
}
export function canCarrySurface(entity: Entity): boolean {
    return entity.parent !== null && !entity.terrain && !entity.csgBrush;
}
export interface AddGuiSurfaceActorOptions {
    presetId?: string;
    assetId?: string | null;
    videoAssetId?: string;
    position?: Vec3;
    name?: string;
}
export function addGuiSurfaceActor(session: EditorSession, options: AddGuiSurfaceActorOptions = {}): Entity {
    const preset = findGuiSurfacePreset(options.presetId ?? 'screen-panel') ?? findGuiSurfacePreset('screen-panel');
    let settings = preset ? preset.apply(null) : createGuiSurfaceSettings();
    if (settings.mount.kind === 'face')
        settings = { ...settings, mount: convertGuiSurfaceMount(settings.mount, 'panel') };
    if (options.videoAssetId) {
        const base = settings.content.kind === 'video' ? settings.content.video : createVideoContent(null, { loop: true, muted: false, volume: 0.8 }).video;
        settings = { ...settings, content: { kind: 'video', video: { ...base, assetId: options.videoAssetId } } };
    }
    else if (settings.content.kind === 'screen') {
        const assetId = options.assetId === undefined ? defaultSurfaceScreenId(session) : options.assetId;
        settings = { ...settings, content: createScreenContent(assetId) };
    }
    const contentName = settings.content.kind === 'screen' ? assetName(session, settings.content.assetId) : settings.content.kind === 'video' ? assetName(session, settings.content.video.assetId) : null;
    const name = options.name ?? preset?.actorName ?? contentName?.replace(/\.[^.]+$/, '') ?? ACTOR_NAME;
    const entity = session.scene.createEntity({ name, kind: 'gui', guiSurface: settings }, null);
    if (options.position) {
        vec3.copy(entity.transform.position, options.position);
    }
    else {
        const position = spawnPosition(session, null);
        position[1] += settings.mount.kind === 'billboard' ? 0 : PANEL_SPAWN_HEIGHT;
        vec3.copy(entity.transform.position, position);
    }
    const added = addEntity(session, entity, undefined, `Adicionar interface ${name}`);
    if (settings.content.kind === 'screen' && !settings.content.assetId) {
        session.log.warn(LOG_SOURCE, `${added.name} não tem tela: escolha uma na seção Interface no mundo do inspetor, ou crie uma na área Interface.`);
    }
    return added;
}
export function placeGuiAssetAsSurface(session: EditorSession, asset: LibraryAsset, position: Vec3 | null = null): Entity | null {
    if (asset.kind === 'gui')
        return addGuiSurfaceActor(session, { assetId: asset.id, position: position ?? undefined, name: asset.name.replace(/\.[^.]+$/, '') });
    if (asset.kind === 'video')
        return addGuiSurfaceActor(session, { presetId: 'tv', videoAssetId: asset.id, position: position ?? undefined, name: asset.name.replace(/\.[^.]+$/, '') });
    return null;
}
export function attachGuiAssetToFace(session: EditorSession, entity: Entity, asset: LibraryAsset, worldPoint: Vec3 | null): boolean {
    if ((asset.kind !== 'gui' && asset.kind !== 'video') || !entity.mesh || !canCarrySurface(entity))
        return false;
    const label = asset.name.replace(/\.[^.]+$/, '');
    if (entity.guiSurface) {
        const current = entity.guiSurface;
        if (asset.kind === 'gui') {
            if (current.content.kind === 'screen')
                setGuiSurfaceScreenAsset(session, entity, asset.id);
            else
                patchGuiSurface(session, entity, { content: createScreenContent(asset.id) }, `Mostrar ${label} em ${entity.name}`);
        }
        else {
            const base = current.content.kind === 'video' ? current.content.video : createVideoContent(null, { fit: 'cover', loop: true, muted: false, volume: 0.8 }).video;
            patchGuiSurface(session, entity, { content: { kind: 'video', video: { ...base, assetId: asset.id } } }, `Mostrar ${label} em ${entity.name}`);
        }
        session.log.info(LOG_SOURCE, `${entity.name} agora mostra ${label}.`);
        return true;
    }
    session.scene.updateWorldMatrices();
    const bounds = getLocalBounds(entity.mesh);
    let face = faceTowardCamera(entity.worldMatrix, bounds, session.camera);
    if (worldPoint) {
        const inverse = mat4.invert(mat4.create(), entity.worldMatrix);
        if (inverse)
            face = nearestBoundsFace(mat4.transformPoint(vec3.create(), inverse, worldPoint), bounds);
    }
    let settings: GuiSurfaceSettings;
    if (asset.kind === 'video') {
        const tv = findGuiSurfacePreset('tv')?.apply(null) ?? createGuiSurfaceSettings();
        const base = tv.content.kind === 'video' ? tv.content.video : createVideoContent().video;
        settings = { ...tv, content: { kind: 'video', video: { ...base, assetId: asset.id } }, mount: createFaceMount({ face }) };
    }
    else {
        settings = createGuiSurfaceSettings({ content: createScreenContent(asset.id), mount: createFaceMount({ face }), shading: 'screen', blend: 'transparent', interactive: true });
    }
    session.history.execute(new SetValueCommand<GuiSurfaceSettings | null>(`Colar ${label} em ${entity.name}`, (value) => {
        entity.guiSurface = value;
    }, null, settings));
    session.log.info(LOG_SOURCE, `${label} colado na face ${GUI_SURFACE_FACE_LABEL[face].toLowerCase()} de ${entity.name}; ajuste a face e a margem no inspetor.`);
    return true;
}
export function attachGuiSurface(session: EditorSession, entity: Entity, presetId?: string): void {
    if (entity.guiSurface || !canCarrySurface(entity))
        return;
    const preset = presetId ? findGuiSurfacePreset(presetId) : null;
    let settings = preset ? preset.apply(null) : createGuiSurfaceSettings({ content: createScreenContent(defaultSurfaceScreenId(session)) });
    if (preset && settings.content.kind === 'screen' && !settings.content.assetId)
        settings = { ...settings, content: createScreenContent(defaultSurfaceScreenId(session)) };
    if (!entity.mesh && settings.mount.kind === 'face')
        settings = { ...settings, mount: convertGuiSurfaceMount(settings.mount, 'panel') };
    session.history.execute(new SetValueCommand<GuiSurfaceSettings | null>(`Anexar interface a ${entity.name}`, (value) => {
        entity.guiSurface = value;
    }, null, settings));
    session.log.info(LOG_SOURCE, `${entity.name} recebeu uma interface${preset ? ` (${preset.label})` : ''}; ela acompanha o ator.`);
}
export function detachGuiSurface(session: EditorSession, entity: Entity): void {
    const current = entity.guiSurface;
    if (!current)
        return;
    session.history.execute(new SetValueCommand<GuiSurfaceSettings | null>(`Remover interface de ${entity.name}`, (value) => {
        entity.guiSurface = value;
    }, current, null));
}
export function updateGuiSurface(session: EditorSession, entity: Entity, update: (settings: GuiSurfaceSettings) => GuiSurfaceSettings, label: string, mergeKey?: string): void {
    const before = entity.guiSurface;
    if (!before)
        return;
    const after = update(before);
    if (after === before)
        return;
    session.history.execute(new SetValueCommand(label, (value) => {
        entity.guiSurface = value;
    }, before, after, mergeKey));
}
export function patchGuiSurface(session: EditorSession, entity: Entity, patch: Partial<GuiSurfaceSettings>, label: string, mergeKey?: string): void {
    updateGuiSurface(session, entity, (settings) => {
        for (const key of Object.keys(patch) as Array<keyof GuiSurfaceSettings>)
            if (!Object.is(settings[key], patch[key]))
                return { ...settings, ...patch };
        return settings;
    }, label, mergeKey);
}
export function endGuiSurfaceEdit(session: EditorSession): void {
    session.history.endMerge();
}
export function setGuiSurfaceScalar(session: EditorSession, entity: Entity, field: GuiSurfaceScalarField, value: number): void {
    const settings = entity.guiSurface;
    if (!settings || !Number.isFinite(value))
        return;
    const limits = SCALAR_LIMITS[field];
    const clamped = clamp(value, limits.min, limits.max);
    const next = limits.integer ? Math.round(clamped) : clamped;
    if (settings[field] === next)
        return;
    patchGuiSurface(session, entity, { [field]: next }, limits.label, `gui-surface:${entity.id}:${field}`);
}
export function setGuiSurfaceContentKind(session: EditorSession, entity: Entity, kind: GuiSurfaceContentKind): void {
    updateGuiSurface(session, entity, (settings) => {
        if (settings.content.kind === kind)
            return settings;
        let content = convertGuiSurfaceContent(settings.content, kind);
        if (content.kind === 'screen')
            content = createScreenContent(defaultSurfaceScreenId(session));
        return { ...settings, content };
    }, `Mostrar ${GUI_SURFACE_CONTENT_LABEL[kind].toLowerCase()} em ${entity.name}`);
}
export function setGuiSurfaceScreenAsset(session: EditorSession, entity: Entity, assetId: string | null): void {
    const settings = entity.guiSurface;
    if (!settings || settings.content.kind !== 'screen' || settings.content.assetId === assetId)
        return;
    patchGuiSurface(session, entity, { content: createScreenContent(assetId) }, assetId ? `Mostrar ${assetName(session, assetId)} em ${entity.name}` : `Interface ${entity.name} sem tela`);
}
export function patchGuiSurfaceVideo(session: EditorSession, entity: Entity, patch: Partial<GuiVideoControl>, label: string, mergeKey?: string): void {
    updateGuiSurface(session, entity, (settings) => {
        if (settings.content.kind !== 'video')
            return settings;
        const video = { ...settings.content.video, ...patch };
        for (const key of Object.keys(patch) as Array<keyof GuiVideoControl>) {
            if (!Object.is(settings.content.video[key], video[key]))
                return { ...settings, content: { kind: 'video', video } };
        }
        return settings;
    }, label, mergeKey ? `gui-surface:${entity.id}:${mergeKey}` : undefined);
}
export function patchGuiSurfaceView(session: EditorSession, entity: Entity, patch: Partial<GuiViewportControl>, label: string, mergeKey?: string): void {
    updateGuiSurface(session, entity, (settings) => {
        if (settings.content.kind !== 'view')
            return settings;
        const view = { ...settings.content.view, ...patch };
        for (const key of Object.keys(patch) as Array<keyof GuiViewportControl>) {
            if (!Object.is(settings.content.view[key], view[key]))
                return { ...settings, content: { kind: 'view', view } };
        }
        return settings;
    }, label, mergeKey ? `gui-surface:${entity.id}:${mergeKey}` : undefined);
}
export function setGuiSurfaceMountKind(session: EditorSession, entity: Entity, kind: GuiSurfaceMountKind): void {
    updateGuiSurface(session, entity, (settings) => (settings.mount.kind === kind ? settings : { ...settings, mount: convertGuiSurfaceMount(settings.mount, kind) }), `${GUI_SURFACE_MOUNT_LABEL[kind]} em ${entity.name}`);
}
export function patchGuiSurfaceFace(session: EditorSession, entity: Entity, patch: Partial<Omit<GuiSurfaceFaceMount, 'kind'>>, label: string, mergeKey?: string): void {
    updateGuiSurface(session, entity, (settings) => {
        if (settings.mount.kind !== 'face')
            return settings;
        const mount: GuiSurfaceFaceMount = {
            ...settings.mount,
            face: patch.face ?? settings.mount.face,
            offset: clamp(patch.offset ?? settings.mount.offset, 0, SURFACE_OFFSET_MAX),
            inset: clamp(patch.inset ?? settings.mount.inset, 0, SURFACE_INSET_MAX),
        };
        const same = mount.face === settings.mount.face && mount.offset === settings.mount.offset && mount.inset === settings.mount.inset;
        return same ? settings : { ...settings, mount };
    }, label, mergeKey ? `gui-surface:${entity.id}:${mergeKey}` : undefined);
}
export function setGuiSurfaceSize(session: EditorSession, entity: Entity, dimension: 'width' | 'height', value: number): void {
    if (!Number.isFinite(value))
        return;
    const next = clamp(value, SURFACE_SIZE_MIN, SURFACE_SIZE_MAX);
    updateGuiSurface(session, entity, (settings) => {
        const { mount } = settings;
        if (mount.kind === 'face' || mount[dimension] === next)
            return settings;
        return { ...settings, mount: { ...mount, [dimension]: next } as GuiSurfacePanelMount | GuiSurfaceBillboardMount };
    }, dimension === 'width' ? 'Largura da interface' : 'Altura da interface', `gui-surface:${entity.id}:${dimension}`);
}
export type GuiSurfaceVectorField = 'position' | 'rotation' | 'offset';
export function setGuiSurfaceVectorComponent(session: EditorSession, entity: Entity, field: GuiSurfaceVectorField, axis: 0 | 1 | 2, value: number): void {
    if (!Number.isFinite(value))
        return;
    updateGuiSurface(session, entity, (settings) => {
        const { mount } = settings;
        if (field === 'offset') {
            if (mount.kind !== 'billboard' || mount.offset[axis] === value)
                return settings;
            const offset = vec3.copy(vec3.create(), mount.offset);
            offset[axis] = value;
            return { ...settings, mount: { ...mount, offset } };
        }
        if (mount.kind !== 'panel' || mount[field][axis] === value)
            return settings;
        const vector = vec3.copy(vec3.create(), mount[field]);
        vector[axis] = value;
        return { ...settings, mount: { ...mount, [field]: vector } };
    }, `${field === 'rotation' ? 'Rotação' : field === 'position' ? 'Posição' : 'Deslocamento'} da interface ${'XYZ'[axis]}`, `gui-surface:${entity.id}:${field}:${axis}`);
}
export function patchGuiSurfaceBillboard(session: EditorSession, entity: Entity, patch: Partial<Pick<GuiSurfaceBillboardMount, 'lockY' | 'constantSize'>>, label: string): void {
    updateGuiSurface(session, entity, (settings) => {
        if (settings.mount.kind !== 'billboard')
            return settings;
        const mount = { ...settings.mount, ...patch };
        return mount.lockY === settings.mount.lockY && mount.constantSize === settings.mount.constantSize ? settings : { ...settings, mount };
    }, label);
}
export function applyGuiSurfacePreset(session: EditorSession, entity: Entity, presetId: string): void {
    const preset = findGuiSurfacePreset(presetId);
    if (!preset || !entity.guiSurface)
        return;
    updateGuiSurface(session, entity, (settings) => {
        let next = preset.apply(settings);
        if (!entity.mesh && next.mount.kind === 'face')
            next = { ...next, mount: convertGuiSurfaceMount(next.mount, 'panel') };
        return next;
    }, `Preset ${preset.label} em ${entity.name}`);
    session.log.info(LOG_SOURCE, `${entity.name}: preset "${preset.label}" aplicado.`);
}
