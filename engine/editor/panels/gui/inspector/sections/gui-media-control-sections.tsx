'use client';
import { FlipHorizontal2, FlipVertical2, RotateCcw } from 'lucide-react';
import type { GuiMediaBlend, GuiVideoControl, GuiVideoFit, GuiVideoPlayOn, GuiViewportControl } from '@/engine/gui/document/gui-document';
import { setGuiControl, setGuiFlag, type GuiEditOptions } from '@/engine/editor/operations/gui-property-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SelectField } from '@/engine/ui/select-field';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { GuiColorField } from '../fields/gui-color-field';
import { GuiImagePicker } from '../fields/gui-image-picker';
import { GuiNumberField } from '../fields/gui-number-field';
import { GuiVideoPicker } from '../fields/gui-video-picker';
import { useGuiEdit } from '../use-gui-edit';
const FIT_OPTIONS: ReadonlyArray<{
    value: GuiVideoFit;
    label: string;
}> = [
    { value: 'cover', label: 'Cobrir (corta sobras)' },
    { value: 'contain', label: 'Conter (sem cortar)' },
    { value: 'stretch', label: 'Esticar' },
];
const PLAY_ON_OPTIONS: ReadonlyArray<{
    value: GuiVideoPlayOn;
    label: string;
}> = [
    { value: 'start', label: 'Ao abrir' },
    { value: 'hover', label: 'Ao passar o mouse' },
    { value: 'manual', label: 'Por comando' },
];
export const BLEND_OPTIONS: ReadonlyArray<{
    value: GuiMediaBlend;
    label: string;
}> = [
    { value: 'normal', label: 'Normal' },
    { value: 'screen', label: 'Clarear (screen)' },
    { value: 'multiply', label: 'Multiplicar' },
    { value: 'add', label: 'Somar (brilho)' },
    { value: 'overlay', label: 'Sobrepor (overlay)' },
];
const CAMERA_OPTIONS: ReadonlyArray<{
    value: GuiViewportControl['camera'];
    label: string;
}> = [
    { value: 'orbit', label: 'Órbita' },
    { value: 'entity', label: 'Câmera da cena' },
];
const mergeOf = (merge?: string): GuiEditOptions | undefined => (merge ? { merge } : undefined);
const seconds = (value: number) => `${value.toFixed(1)} s`;
const percent = (value: number) => `${Math.round(value * 100)} %`;
const degrees = (value: number) => `${Math.round(value)}°`;
export function GuiVideoFields({ control, interactable }: {
    control: GuiVideoControl;
    interactable: boolean;
}) {
    const { session, end } = useGuiEdit();
    const edit = (patch: Partial<GuiVideoControl>, label: string, merge?: string) => setGuiControl(session, 'video', patch, label, mergeOf(merge));
    const asset = control.assetId ? session.library.get(control.assetId) : null;
    const duration = asset?.details.kind === 'video' ? (asset.details.durationSeconds ?? 0) : 0;
    const maxTime = Math.max(duration, control.endTime ?? 0, control.startTime, 1);
    return (<>
      <GuiVideoPicker value={control.assetId} onChange={(assetId) => edit({ assetId }, assetId ? 'Trocar vídeo' : 'Remover vídeo')}/>
      <PropertyRow label="Ajuste">
        <SelectField label="Modo de ajuste do vídeo" options={FIT_OPTIONS} value={control.fit} onChange={(fit) => edit({ fit }, 'Alterar ajuste do vídeo')}/>
      </PropertyRow>
      <PropertyRow label="Toca">
        <SelectField label="Gatilho de reprodução" options={PLAY_ON_OPTIONS} value={control.playOn} onChange={(playOn) => edit({ playOn }, 'Alterar gatilho do vídeo')}/>
      </PropertyRow>
      {control.playOn === 'hover' && <ToggleField label="Recomeça a cada entrada" on={control.restartOnPlay} onToggle={() => edit({ restartOnPlay: !control.restartOnPlay }, 'Alternar reinício do vídeo')}/>}
      <ToggleField label="Laço" on={control.loop} onToggle={() => edit({ loop: !control.loop }, 'Alternar laço do vídeo')}/>
      <PropertyRow label="Recorte">
        <GuiNumberField label="Início do recorte" unit="s" value={control.startTime} min={0} max={maxTime} step={0.1} precision={1} onChange={(startTime) => edit({ startTime, ...(control.endTime !== null && control.endTime < startTime ? { endTime: startTime } : {}) }, 'Alterar recorte do vídeo', 'video-start')} onEnd={end}/>
        <GuiNumberField label="Fim do recorte" unit="s" value={control.endTime ?? duration} min={control.startTime} max={maxTime} step={0.1} precision={1} onChange={(endTime) => edit({ endTime: duration > 0 && endTime >= duration ? null : endTime }, 'Alterar recorte do vídeo', 'video-end')} onEnd={end}/>
      </PropertyRow>
      <SliderField label="Velocidade" value={control.speed} min={0.1} max={4} step={0.05} scale="log" format={(value) => `${value.toFixed(2)}×`} onChange={(speed) => edit({ speed }, 'Alterar velocidade do vídeo', 'video-speed')}/>
      <ToggleField label="Sem som" on={control.muted} onToggle={() => edit({ muted: !control.muted }, 'Alternar som do vídeo')}/>
      {!control.muted && <SliderField label="Volume" value={control.volume} min={0} max={1} step={0.01} format={percent} onChange={(volume) => edit({ volume }, 'Alterar volume do vídeo', 'video-volume')}/>}
      <ToggleField label="Clique alterna" on={control.clickToggles} onToggle={() => {
            const next = !control.clickToggles;
            edit({ clickToggles: next }, 'Alternar clique no vídeo');
            if (next && !interactable)
                setGuiFlag(session, 'interactable', true);
        }}/>
      <ToggleField label="Barra de controles" on={control.showControls} onToggle={() => edit({ showControls: !control.showControls }, 'Alternar controles do vídeo')}/>
      <PropertyRow label="Mistura">
        <SelectField label="Modo de mistura do vídeo" options={BLEND_OPTIONS} value={control.blend} onChange={(blend) => edit({ blend }, 'Alterar mistura do vídeo')}/>
      </PropertyRow>
      <GuiColorField label="Gradação" color={control.tint} alpha={control.tintAlpha} onChange={(patch) => edit({ ...(patch.color !== undefined && { tint: patch.color }), ...(patch.alpha !== undefined && { tintAlpha: patch.alpha }) }, 'Alterar gradação do vídeo', 'video-tint')} onEnd={end}/>
      <PropertyRow label="Espelhar">
        <IconButton label="Espelhar horizontalmente" size="sm" active={control.flipX} onClick={() => edit({ flipX: !control.flipX }, 'Espelhar vídeo')}>
          <FlipHorizontal2 />
        </IconButton>
        <IconButton label="Espelhar verticalmente" size="sm" active={control.flipY} onClick={() => edit({ flipY: !control.flipY }, 'Espelhar vídeo')}>
          <FlipVertical2 />
        </IconButton>
      </PropertyRow>
      <GuiImagePicker label="Pôster" value={control.posterAssetId} onChange={(posterAssetId) => edit({ posterAssetId }, posterAssetId ? 'Definir pôster do vídeo' : 'Remover pôster do vídeo')}/>
    </>);
}
function useEntityNames(filter: 'camera' | 'target'): Array<{
    value: string;
    label: string;
}> {
    const session = useEditorSession();
    const names: Array<{
        value: string;
        label: string;
    }> = [];
    session.scene.traverse((entity) => {
        if (entity === session.scene.root)
            return;
        if (filter === 'camera' ? entity.kind === 'camera' : entity.kind !== 'light' && entity.kind !== 'sound' && entity.kind !== 'camera')
            names.push({ value: entity.name, label: entity.name });
    });
    return names;
}
export function GuiViewportFields({ control, interactable }: {
    control: GuiViewportControl;
    interactable: boolean;
}) {
    const { session, end } = useGuiEdit();
    const edit = (patch: Partial<GuiViewportControl>, label: string, merge?: string) => setGuiControl(session, 'viewport', patch, label, mergeOf(merge));
    const cameras = useEntityNames('camera');
    const targets = useEntityNames('target');
    const cameraOptions = [{ value: '', label: 'Câmera principal da cena' }, ...cameras];
    const targetOptions = [{ value: '', label: 'Origem da cena' }, ...targets];
    if (control.cameraName && !cameras.some((option) => option.value === control.cameraName))
        cameraOptions.push({ value: control.cameraName, label: `${control.cameraName} (não está na cena)` });
    if (control.targetName && !targets.some((option) => option.value === control.targetName))
        targetOptions.push({ value: control.targetName, label: `${control.targetName} (não está na cena)` });
    return (<>
      <PropertyRow label="Olha por">
        <SegmentedControl label="Modo de câmera da visão" options={CAMERA_OPTIONS} value={control.camera} onChange={(camera) => edit({ camera }, 'Alterar câmera da visão')}/>
      </PropertyRow>
      {control.camera === 'entity' ? (<PropertyRow label="Câmera">
          <SelectField label="Ator de câmera" options={cameraOptions} value={control.cameraName} onChange={(cameraName) => edit({ cameraName }, 'Escolher câmera da visão')}/>
        </PropertyRow>) : (<>
          <PropertyRow label="Em torno de">
            <SelectField label="Ator alvo da órbita" options={targetOptions} value={control.targetName} onChange={(targetName) => edit({ targetName }, 'Escolher alvo da visão')}/>
          </PropertyRow>
          <SliderField label="Distância" value={control.distance} min={0.2} max={60} step={0.1} scale="log" suffix=" m" editable onChange={(distance) => edit({ distance: Math.max(0.05, distance) }, 'Alterar distância da visão', 'viewport-distance')}/>
          <PropertyRow label="Ângulos">
            <GuiNumberField label="Giro horizontal" unit="°" value={control.yaw} step={1} precision={0} onChange={(yaw) => edit({ yaw: ((yaw + 180) % 360) - 180 }, 'Alterar ângulo da visão', 'viewport-yaw')} onEnd={end}/>
            <GuiNumberField label="Inclinação" unit="°" value={control.pitch} min={-89} max={89} step={1} precision={0} onChange={(pitch) => edit({ pitch }, 'Alterar ângulo da visão', 'viewport-pitch')} onEnd={end}/>
          </PropertyRow>
          <SliderField label="Giro automático" value={control.autoRotate} min={-90} max={90} step={1} format={(value) => `${Math.round(value)}°/s`} onChange={(autoRotate) => edit({ autoRotate }, 'Alterar giro automático', 'viewport-spin')}/>
          <ToggleField label="Jogador orbita" on={control.interactive} onToggle={() => {
                const next = !control.interactive;
                edit({ interactive: next }, 'Alternar órbita interativa');
                if (next && !interactable)
                    setGuiFlag(session, 'interactable', true);
            }}/>
          {control.interactive && (<PropertyRow label="Zoom">
              <GuiNumberField label="Distância mínima" unit="mín" value={control.minDistance} min={0.05} max={control.maxDistance} step={0.1} precision={1} onChange={(minDistance) => edit({ minDistance }, 'Alterar zoom da visão', 'viewport-min')} onEnd={end}/>
              <GuiNumberField label="Distância máxima" unit="máx" value={control.maxDistance} min={control.minDistance} max={1000} step={0.1} precision={1} onChange={(maxDistance) => edit({ maxDistance }, 'Alterar zoom da visão', 'viewport-max')} onEnd={end}/>
            </PropertyRow>)}
        </>)}
      <SliderField label="Campo de visão" value={control.fov} min={10} max={120} step={1} format={degrees} onChange={(fov) => edit({ fov }, 'Alterar campo de visão', 'viewport-fov')}/>
      <SliderField label="Resolução" value={control.resolutionScale} min={0.25} max={1} step={0.05} format={percent} onChange={(resolutionScale) => edit({ resolutionScale }, 'Alterar resolução da visão', 'viewport-res')}/>
      <SliderField label="Quadros/s" value={control.frameRate} min={0} max={60} step={1} format={(value) => (value === 0 ? 'Todos' : `${Math.round(value)} fps`)} onChange={(frameRate) => edit({ frameRate }, 'Alterar quadros da visão', 'viewport-fps')}/>
      <ToggleField label="Grade do editor" on={control.grid} onToggle={() => edit({ grid: !control.grid }, 'Alternar grade da visão')}/>
      <PropertyRow label="Mistura">
        <SelectField label="Modo de mistura da visão" options={BLEND_OPTIONS} value={control.blend} onChange={(blend) => edit({ blend }, 'Alterar mistura da visão')}/>
      </PropertyRow>
      <GuiColorField label="Gradação" color={control.tint} alpha={control.tintAlpha} onChange={(patch) => edit({ ...(patch.color !== undefined && { tint: patch.color }), ...(patch.alpha !== undefined && { tintAlpha: patch.alpha }) }, 'Alterar gradação da visão', 'viewport-tint')} onEnd={end}/>
      <PropertyRow label="Enquadramento">
        <IconButton label="Restaurar enquadramento padrão" size="sm" onClick={() => edit({ distance: 6, yaw: 35, pitch: -18, fov: 45 }, 'Restaurar enquadramento da visão')}>
          <RotateCcw />
        </IconButton>
        <span className="text-3xs text-muted-foreground">Cada visão renderiza a cena de novo: use resolução e quadros menores em telas com várias.</span>
      </PropertyRow>
    </>);
}
