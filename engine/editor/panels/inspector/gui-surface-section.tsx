'use client';
import { PenLine, Plus, Trash2 } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { formatPercent } from '@/engine/audio/core/decibels';
import type { GuiVideoFit, GuiVideoPlayOn, GuiViewportCamera } from '@/engine/gui/document/gui-document';
import { GUI_TEMPLATES } from '@/engine/gui/templates/gui-templates';
import { surfaceTextureSize } from '@/engine/gui/world/gui-surface-frame';
import { GUI_SURFACE_BLEND_LABEL, GUI_SURFACE_CONTENT_LABEL, GUI_SURFACE_FACE_LABEL, GUI_SURFACE_FACES, GUI_SURFACE_MOUNT_LABEL, GUI_SURFACE_PRESETS, GUI_SURFACE_SHADING_LABEL, SURFACE_BRIGHTNESS_MAX, SURFACE_DISTANCE_MAX, SURFACE_FRAME_RATE_MAX, SURFACE_INSET_MAX, SURFACE_OFFSET_MAX, SURFACE_PIXELS_PER_METER_MAX, SURFACE_PIXELS_PER_METER_MIN, SURFACE_SIZE_MAX, SURFACE_SIZE_MIN, type GuiSurfaceBlend, type GuiSurfaceContentKind, type GuiSurfaceMountKind, type GuiSurfaceSettings, type GuiSurfaceShading, } from '@/engine/gui/world/gui-surface-settings';
import { createGuiScreen, openGuiAssetInDesigner } from '@/engine/editor/operations/gui-operations';
import { applyGuiSurfacePreset, detachGuiSurface, endGuiSurfaceEdit, patchGuiSurface, patchGuiSurfaceBillboard, patchGuiSurfaceFace, patchGuiSurfaceVideo, patchGuiSurfaceView, setGuiSurfaceContentKind, setGuiSurfaceMountKind, setGuiSurfaceScalar, setGuiSurfaceScreenAsset, setGuiSurfaceSize, setGuiSurfaceVectorComponent, } from '@/engine/editor/operations/gui-surface-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SelectField } from '@/engine/ui/select-field';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField, ToggleSwitch } from '@/engine/ui/toggle-field';
import { GuiColorField } from '@/engine/editor/panels/gui/inspector/fields/gui-color-field';
import { GuiVideoPicker } from '@/engine/editor/panels/gui/inspector/fields/gui-video-picker';
import { AudioPresetsMenu } from './audio/audio-presets-menu';
import { Vector3Input } from './number-fields';
const NONE = '';
const meters = (value: number) => `${Number(value.toFixed(2))} m`;
const degrees = (value: number) => `${Number(value.toFixed(0))}°`;
const times = (value: number) => `${Number(value.toFixed(2))}×`;
const perSecond = (value: number) => (value <= 0 ? 'quando mudar' : `${Math.round(value)} fps`);
const orNever = (value: number) => (value <= 0 ? 'nunca' : meters(value));
const orAnyDistance = (value: number) => (value <= 0 ? 'qualquer distância' : meters(value));
const CONTENT_OPTIONS = (Object.keys(GUI_SURFACE_CONTENT_LABEL) as GuiSurfaceContentKind[]).map((value) => ({ value, label: GUI_SURFACE_CONTENT_LABEL[value] }));
const SHADING_OPTIONS = (Object.keys(GUI_SURFACE_SHADING_LABEL) as GuiSurfaceShading[]).map((value) => ({ value, label: GUI_SURFACE_SHADING_LABEL[value] }));
const BLEND_OPTIONS = (Object.keys(GUI_SURFACE_BLEND_LABEL) as GuiSurfaceBlend[]).map((value) => ({ value, label: GUI_SURFACE_BLEND_LABEL[value] }));
const FACE_OPTIONS = GUI_SURFACE_FACES.map((value) => ({ value, label: GUI_SURFACE_FACE_LABEL[value] }));
const FIT_OPTIONS: ReadonlyArray<{
    value: GuiVideoFit;
    label: string;
}> = [
    { value: 'cover', label: 'Preencher' },
    { value: 'contain', label: 'Caber' },
    { value: 'stretch', label: 'Esticar' },
];
const PLAY_ON_OPTIONS: ReadonlyArray<{
    value: GuiVideoPlayOn;
    label: string;
}> = [
    { value: 'start', label: 'Ao abrir' },
    { value: 'hover', label: 'Ao mirar' },
    { value: 'manual', label: 'Por comando' },
];
const CAMERA_OPTIONS: ReadonlyArray<{
    value: GuiViewportCamera;
    label: string;
}> = [
    { value: 'entity', label: 'Câmera da cena' },
    { value: 'orbit', label: 'Órbita' },
];
function Hint({ children }: {
    children: React.ReactNode;
}) {
    return <p className="px-2 py-0.5 text-3xs leading-relaxed text-pretty text-muted-foreground">{children}</p>;
}
function textureReadout(entity: Entity, settings: GuiSurfaceSettings, frame: {
    width: number;
    height: number;
    distance: number;
} | null): string {
    if (!frame || frame.width <= 0 || frame.height <= 0)
        return entity.visible ? 'fora da imagem' : 'ator oculto';
    const size = surfaceTextureSize(frame.width, frame.height, settings.pixelsPerMeter);
    return `${meters(frame.width)} × ${meters(frame.height)} · ${size.width}×${size.height} px · a ${meters(frame.distance)}`;
}
function ScreenPicker({ entity, assetId }: {
    entity: Entity;
    assetId: string | null;
}) {
    const session = useEditorSession();
    const screens = session.library.byKind('gui');
    const asset = assetId ? (session.library.get(assetId) ?? null) : null;
    const missing = assetId !== null && asset === null;
    const live = asset !== null && session.gui.assetId === asset.id;
    const options = [{ value: NONE, label: missing ? 'Tela removida da biblioteca' : screens.length === 0 ? 'Nenhuma (crie uma tela abaixo)' : '— nenhuma —' }, ...screens.map((screen) => ({ value: screen.id, label: screen.name }))];
    const firstTemplate = GUI_TEMPLATES[0];
    return (<>
      <PropertyRow label="Tela">
        <SelectField label="Tela da biblioteca" options={options} value={asset?.id ?? NONE} onChange={(value) => setGuiSurfaceScreenAsset(session, entity, value === NONE ? null : value)}/>
        {asset && (<IconButton label="Abrir no designer de interface" size="sm" active={live} onClick={() => void openGuiAssetInDesigner(session, asset)}>
            <PenLine />
          </IconButton>)}
      </PropertyRow>
      {screens.length === 0 && firstTemplate && (<ActionRow>
          <ActionButton icon={Plus} variant="primary" title={`Cria uma tela a partir do modelo "${firstTemplate.label}" e a abre no designer`} onClick={() => void createGuiScreen(session, firstTemplate.id).then((created) => {
                if (created)
                    setGuiSurfaceScreenAsset(session, entity, created.id);
            })}>
            Criar tela…
          </ActionButton>
        </ActionRow>)}
    </>);
}
function sceneNames(session: EditorSession, entity: Entity, predicate: (candidate: Entity) => boolean): string[] {
    const names = new Set<string>();
    session.scene.traverse((node) => {
        if (node.parent !== null && node !== entity && predicate(node))
            names.add(node.name);
    });
    return [...names].sort((a, b) => a.localeCompare(b));
}
function VideoFields({ entity, settings }: {
    entity: Entity;
    settings: Extract<GuiSurfaceSettings['content'], {
        kind: 'video';
    }>;
}) {
    const session = useEditorSession();
    const { video } = settings;
    return (<>
      <GuiVideoPicker value={video.assetId} onChange={(assetId) => patchGuiSurfaceVideo(session, entity, { assetId }, assetId ? `Vídeo de ${entity.name}` : `${entity.name} sem vídeo`)}/>
      <PropertyRow label="Ajuste">
        <SegmentedControl label="Ajuste do vídeo" options={FIT_OPTIONS} value={video.fit} onChange={(fit) => patchGuiSurfaceVideo(session, entity, { fit }, `Ajuste do vídeo de ${entity.name}`)}/>
      </PropertyRow>
      <PropertyRow label="Tocar">
        <SegmentedControl label="Quando tocar" options={PLAY_ON_OPTIONS} value={video.playOn} onChange={(playOn) => patchGuiSurfaceVideo(session, entity, { playOn }, `Disparo do vídeo de ${entity.name}`)}/>
      </PropertyRow>
      <ToggleField label="Repetir" on={video.loop} onToggle={() => patchGuiSurfaceVideo(session, entity, { loop: !video.loop }, `${video.loop ? 'Tocar uma vez' : 'Repetir'} o vídeo de ${entity.name}`)}/>
      <ToggleField label="Mudo" on={video.muted} onToggle={() => patchGuiSurfaceVideo(session, entity, { muted: !video.muted }, `${video.muted ? 'Som' : 'Mudo'} no vídeo de ${entity.name}`)}/>
      <SliderField label="Volume" value={video.volume} min={0} max={1} step={0.01} disabled={video.muted} format={formatPercent} onChange={(volume) => patchGuiSurfaceVideo(session, entity, { volume }, 'Volume do vídeo', 'video:volume')}/>
      <SliderField label="Velocidade" value={video.speed} min={0.1} max={4} step={0.05} format={times} onChange={(speed) => patchGuiSurfaceVideo(session, entity, { speed }, 'Velocidade do vídeo', 'video:speed')}/>
      <ToggleField label="Barra de controle" on={video.showControls} onToggle={() => patchGuiSurfaceVideo(session, entity, { showControls: !video.showControls }, `Barra do vídeo de ${entity.name}`)}/>
      <ToggleField label="Clique alterna" on={video.clickToggles} onToggle={() => patchGuiSurfaceVideo(session, entity, { clickToggles: !video.clickToggles }, `Clique no vídeo de ${entity.name}`)}/>
      {(video.clickToggles || video.playOn === 'hover') && !entity.guiSurface?.interactive && <Hint>Requer superfície interativa.</Hint>}
    </>);
}
function ViewFields({ entity, settings }: {
    entity: Entity;
    settings: Extract<GuiSurfaceSettings['content'], {
        kind: 'view';
    }>;
}) {
    const session = useEditorSession();
    const { view } = settings;
    const cameras = sceneNames(session, entity, (candidate) => candidate.kind === 'camera');
    const targets = sceneNames(session, entity, (candidate) => candidate.kind !== 'camera' && candidate.kind !== 'light');
    const cameraOptions = [{ value: NONE, label: 'Câmera principal da cena' }, ...cameras.map((name) => ({ value: name, label: name }))];
    const targetOptions = [{ value: NONE, label: 'Origem do mundo' }, ...targets.map((name) => ({ value: name, label: name }))];
    if (view.cameraName && !cameras.includes(view.cameraName))
        cameraOptions.push({ value: view.cameraName, label: `${view.cameraName} (não está na cena)` });
    if (view.targetName && !targets.includes(view.targetName))
        targetOptions.push({ value: view.targetName, label: `${view.targetName} (não está na cena)` });
    return (<>
      <PropertyRow label="Câmera">
        <SegmentedControl label="Modo da câmera" options={CAMERA_OPTIONS} value={view.camera} onChange={(camera) => patchGuiSurfaceView(session, entity, { camera }, `Câmera da visão de ${entity.name}`)}/>
      </PropertyRow>
      {view.camera === 'entity' ? (<>
          <PropertyRow label="Ator">
            <SelectField label="Ator de câmera" options={cameraOptions} value={view.cameraName} onChange={(cameraName) => patchGuiSurfaceView(session, entity, { cameraName }, `Visão de ${entity.name} por ${cameraName || 'câmera principal'}`)}/>
          </PropertyRow>
        </>) : (<>
          <PropertyRow label="Alvo">
            <SelectField label="Ator alvo da órbita" options={targetOptions} value={view.targetName} onChange={(targetName) => patchGuiSurfaceView(session, entity, { targetName }, `Órbita de ${entity.name} em torno de ${targetName || 'origem'}`)}/>
          </PropertyRow>
          <SliderField label="Distância" value={view.distance} min={0.1} max={200} scale="log" editable suffix=" m" format={meters} onChange={(distance) => patchGuiSurfaceView(session, entity, { distance }, 'Distância da órbita', 'view:distance')}/>
          <SliderField label="Giro" value={view.yaw} min={-180} max={180} step={1} format={degrees} onChange={(yaw) => patchGuiSurfaceView(session, entity, { yaw }, 'Giro da órbita', 'view:yaw')}/>
          <SliderField label="Inclinação" value={view.pitch} min={-89} max={89} step={1} format={degrees} onChange={(pitch) => patchGuiSurfaceView(session, entity, { pitch }, 'Inclinação da órbita', 'view:pitch')}/>
          <SliderField label="Giro automático" value={view.autoRotate} min={-90} max={90} step={1} format={(value) => (value === 0 ? 'parado' : `${Math.round(value)}°/s`)} onChange={(autoRotate) => patchGuiSurfaceView(session, entity, { autoRotate }, 'Giro automático da órbita', 'view:auto')}/>
          <SliderField label="Lente" value={view.fov} min={10} max={120} step={1} format={degrees} onChange={(fov) => patchGuiSurfaceView(session, entity, { fov }, 'Lente da visão', 'view:fov')}/>
          <ToggleField label="Jogador gira" on={view.interactive} onToggle={() => patchGuiSurfaceView(session, entity, { interactive: !view.interactive }, `Órbita ${view.interactive ? 'fixa' : 'livre'} em ${entity.name}`)}/>
        </>)}
      <SliderField label="Resolução" value={view.resolutionScale} min={0.25} max={1} step={0.05} format={formatPercent} onChange={(resolutionScale) => patchGuiSurfaceView(session, entity, { resolutionScale }, 'Resolução da visão', 'view:scale')}/>
      <SliderField label="Quadros" value={view.frameRate} min={0} max={SURFACE_FRAME_RATE_MAX} step={1} format={perSecond} onChange={(frameRate) => patchGuiSurfaceView(session, entity, { frameRate: Math.round(frameRate) }, 'Quadros da visão', 'view:fps')}/>
      <ToggleField label="Grade" on={view.grid} onToggle={() => patchGuiSurfaceView(session, entity, { grid: !view.grid }, `Grade da visão de ${entity.name}`)}/>
    </>);
}
function MainSection({ entity, settings }: {
    entity: Entity;
    settings: GuiSurfaceSettings;
}) {
    const session = useEditorSession();
    const frame = session.guiWorld.system.frameOf(entity.id);
    const detachable = entity.kind !== 'gui';
    return (<CollapsibleSection title="Interface no mundo" trailing={<div className="flex items-center gap-1">
          <AudioPresetsMenu title="Pontos de partida (mantêm a tela ou o vídeo escolhidos)" presets={GUI_SURFACE_PRESETS} onPick={(presetId) => applyGuiSurfacePreset(session, entity, presetId)}/>
          {detachable && (<IconButton label="Remover interface" size="xs" className="hover:text-destructive" onClick={() => detachGuiSurface(session, entity)}>
              <Trash2 />
            </IconButton>)}
        </div>}>
      <PropertyRow label="Superfície">
        <FieldInput readOnly value={textureReadout(entity, settings, frame)} aria-label="Tamanho da superfície e da textura" title="Largura × altura no mundo · textura em pixels · distância da câmera"/>
      </PropertyRow>
      <PropertyRow label="Conteúdo">
        <SegmentedControl label="Tipo de conteúdo" options={CONTENT_OPTIONS} value={settings.content.kind} onChange={(kind) => setGuiSurfaceContentKind(session, entity, kind)}/>
      </PropertyRow>
      {settings.content.kind === 'screen' && <ScreenPicker entity={entity} assetId={settings.content.assetId}/>}
      {settings.content.kind === 'video' && <VideoFields entity={entity} settings={settings.content}/>}
      {settings.content.kind === 'view' && <ViewFields entity={entity} settings={settings.content}/>}
    </CollapsibleSection>);
}
function MountSection({ entity, settings }: {
    entity: Entity;
    settings: GuiSurfaceSettings;
}) {
    const session = useEditorSession();
    const { mount } = settings;
    const kinds: GuiSurfaceMountKind[] = entity.mesh ? ['face', 'panel', 'billboard'] : ['panel', 'billboard'];
    const options = kinds.map((value) => ({ value, label: GUI_SURFACE_MOUNT_LABEL[value] }));
    return (<CollapsibleSection title="Montagem">
      <PropertyRow label="Modo">
        <SegmentedControl label="Modo de montagem" options={options} value={kinds.includes(mount.kind) ? mount.kind : null} onChange={(kind) => setGuiSurfaceMountKind(session, entity, kind)}/>
      </PropertyRow>
      {mount.kind === 'face' && (<>
          <PropertyRow label="Face">
            <SelectField label="Face da caixa" options={FACE_OPTIONS} value={mount.face} onChange={(face) => patchGuiSurfaceFace(session, entity, { face }, `Interface na face ${GUI_SURFACE_FACE_LABEL[face].toLowerCase()} de ${entity.name}`)}/>
          </PropertyRow>
          <SliderField label="Afastamento" value={mount.offset} min={0} max={Math.min(SURFACE_OFFSET_MAX, 0.5)} step={0.001} editable suffix=" m" format={(value) => `${Number((value * 1000).toFixed(0))} mm`} onChange={(offset) => patchGuiSurfaceFace(session, entity, { offset }, 'Afastamento da face', 'face:offset')}/>
          <SliderField label="Margem" value={mount.inset} min={0} max={SURFACE_INSET_MAX} step={0.01} format={formatPercent} onChange={(inset) => patchGuiSurfaceFace(session, entity, { inset }, 'Margem da face', 'face:inset')}/>
        </>)}
      {mount.kind === 'panel' && (<>
          <PropertyRow label="Posição">
            <Vector3Input label="Posição do painel" values={mount.position} onCommit={(axis, value) => setGuiSurfaceVectorComponent(session, entity, 'position', axis, value)}/>
          </PropertyRow>
          <PropertyRow label="Rotação">
            <Vector3Input label="Rotação do painel" values={mount.rotation} suffix="°" onCommit={(axis, value) => setGuiSurfaceVectorComponent(session, entity, 'rotation', axis, value)}/>
          </PropertyRow>
          <SliderField label="Largura" value={mount.width} min={SURFACE_SIZE_MIN * 5} max={Math.min(SURFACE_SIZE_MAX, 50)} scale="log" editable suffix=" m" format={meters} onChange={(value) => setGuiSurfaceSize(session, entity, 'width', value)}/>
          <SliderField label="Altura" value={mount.height} min={SURFACE_SIZE_MIN * 5} max={Math.min(SURFACE_SIZE_MAX, 50)} scale="log" editable suffix=" m" format={meters} onChange={(value) => setGuiSurfaceSize(session, entity, 'height', value)}/>
        </>)}
      {mount.kind === 'billboard' && (<>
          <PropertyRow label="Deslocamento">
            <Vector3Input label="Deslocamento da placa" values={mount.offset} onCommit={(axis, value) => setGuiSurfaceVectorComponent(session, entity, 'offset', axis, value)}/>
          </PropertyRow>
          <SliderField label="Largura" value={mount.width} min={SURFACE_SIZE_MIN * 5} max={Math.min(SURFACE_SIZE_MAX, 50)} scale="log" editable suffix=" m" format={meters} onChange={(value) => setGuiSurfaceSize(session, entity, 'width', value)}/>
          <SliderField label="Altura" value={mount.height} min={SURFACE_SIZE_MIN * 5} max={Math.min(SURFACE_SIZE_MAX, 50)} scale="log" editable suffix=" m" format={meters} onChange={(value) => setGuiSurfaceSize(session, entity, 'height', value)}/>
          <ToggleField label="Só gira em pé" on={mount.lockY} onToggle={() => patchGuiSurfaceBillboard(session, entity, { lockY: !mount.lockY }, `Placa de ${entity.name} ${mount.lockY ? 'encara a câmera' : 'fica em pé'}`)}/>
          <ToggleField label="Tamanho fixo na tela" on={mount.constantSize} onToggle={() => patchGuiSurfaceBillboard(session, entity, { constantSize: !mount.constantSize }, `Placa de ${entity.name} com tamanho ${mount.constantSize ? 'no mundo' : 'fixo na tela'}`)}/>
        </>)}
    </CollapsibleSection>);
}
function LookSection({ entity, settings }: {
    entity: Entity;
    settings: GuiSurfaceSettings;
}) {
    const session = useEditorSession();
    const emissive = settings.shading !== 'lit';
    return (<CollapsibleSection title="Aparência">
      <PropertyRow label="Luz">
        <SegmentedControl label="Como a superfície recebe luz" options={SHADING_OPTIONS} value={settings.shading} onChange={(shading) => patchGuiSurface(session, entity, { shading }, `${GUI_SURFACE_SHADING_LABEL[shading]} em ${entity.name}`)}/>
      </PropertyRow>
      {emissive && <SliderField label="Brilho" value={settings.brightness} min={0} max={SURFACE_BRIGHTNESS_MAX} step={0.05} format={(value) => (value > 1.001 ? `${times(value)} · bloom` : times(value))} onChange={(value) => setGuiSurfaceScalar(session, entity, 'brightness', value)}/>}
      <PropertyRow label="Mistura">
        <SegmentedControl label="Mistura com o fundo" options={BLEND_OPTIONS} value={settings.blend} onChange={(blend) => patchGuiSurface(session, entity, { blend }, `Mistura ${GUI_SURFACE_BLEND_LABEL[blend].toLowerCase()} em ${entity.name}`)}/>
      </PropertyRow>
      <SliderField label="Opacidade" value={settings.opacity} min={0} max={1} step={0.01} format={formatPercent} onChange={(value) => setGuiSurfaceScalar(session, entity, 'opacity', value)}/>
      <GuiColorField label="Fundo" color={settings.backdropColor} alpha={settings.backdropAlpha} onChange={(patch) => patchGuiSurface(session, entity, { ...(patch.color !== undefined && { backdropColor: patch.color }), ...(patch.alpha !== undefined && { backdropAlpha: patch.alpha }) }, 'Fundo da interface', `gui-surface:${entity.id}:backdrop`)} onEnd={() => endGuiSurfaceEdit(session)}/>
      <ToggleField label="Dois lados" on={settings.doubleSided} onToggle={() => patchGuiSurface(session, entity, { doubleSided: !settings.doubleSided }, `Interface de ${entity.name} ${settings.doubleSided ? 'de um lado' : 'dos dois lados'}`)}/>
      {settings.shading === 'overlay' && <ToggleField label="Através das paredes" on={settings.alwaysOnTop} onToggle={() => patchGuiSurface(session, entity, { alwaysOnTop: !settings.alwaysOnTop }, `Interface de ${entity.name} ${settings.alwaysOnTop ? 'respeita' : 'ignora'} a profundidade`)}/>}
      <SliderField label="Resolução" value={settings.pixelsPerMeter} min={SURFACE_PIXELS_PER_METER_MIN} max={SURFACE_PIXELS_PER_METER_MAX} scale="log" format={(value) => `${Math.round(value)} px/m`} onChange={(value) => setGuiSurfaceScalar(session, entity, 'pixelsPerMeter', value)}/>
      <SliderField label="Redesenho" value={settings.frameRate} min={0} max={SURFACE_FRAME_RATE_MAX} step={1} format={perSecond} onChange={(value) => setGuiSurfaceScalar(session, entity, 'frameRate', value)}/>
      <SliderField label="Some além de" value={settings.cullDistance} min={0} max={Math.min(SURFACE_DISTANCE_MAX, 500)} step={1} editable suffix=" m" format={orNever} onChange={(value) => setGuiSurfaceScalar(session, entity, 'cullDistance', value)}/>
    </CollapsibleSection>);
}
function BehaviorSection({ entity, settings }: {
    entity: Entity;
    settings: GuiSurfaceSettings;
}) {
    const session = useEditorSession();
    const video = settings.content.kind === 'video';
    return (<CollapsibleSection title="Comportamento" trailing={<ToggleSwitch label="Interativa" on={settings.interactive} onToggle={() => patchGuiSurface(session, entity, { interactive: !settings.interactive }, `Interface de ${entity.name} ${settings.interactive ? 'só de leitura' : 'interativa'}`)}/>}>
      {settings.interactive ? (<>
          <SliderField label="Alcance" value={settings.interactionDistance} min={0} max={50} step={0.5} editable suffix=" m" format={orAnyDistance} onChange={(value) => setGuiSurfaceScalar(session, entity, 'interactionDistance', value)}/>
        </>) : null}
      {video && (<>
          <ToggleField label="Som espacial" on={settings.spatialAudio} onToggle={() => patchGuiSurface(session, entity, { spatialAudio: !settings.spatialAudio }, `Som do vídeo de ${entity.name} ${settings.spatialAudio ? 'uniforme' : 'espacial'}`)}/>
          {settings.spatialAudio && <SliderField label="Alcance do som" value={settings.audioRange} min={0.5} max={SURFACE_DISTANCE_MAX} scale="log" editable suffix=" m" format={meters} onChange={(value) => setGuiSurfaceScalar(session, entity, 'audioRange', value)}/>}
        </>)}
    </CollapsibleSection>);
}
