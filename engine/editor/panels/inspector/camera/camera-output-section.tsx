'use client';
import { Layers } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import type { CameraBackground, CameraSettings, CameraTarget, CameraTextureContent } from '@/engine/camera/camera-settings';
import { baseCamerasStacking } from '@/engine/camera/stack/camera-frame-plan';
import { cameraFeedName } from '@/engine/camera/targets/camera-feeds';
import { addCameraOverlay, setCameraBackgroundColor, setCameraTexture, setCameraValue, setCameraViewport } from '@/engine/editor/operations/camera-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { ColorField } from '@/engine/ui/color-field';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SliderField } from '@/engine/ui/slider-field';
import { ScalarField } from '../number-fields';
import { CAMERA_HINT_CLASS, CAMERA_NOTICE_CLASS } from './camera-field-styles';
import { ViewportRectField } from './viewport-rect-field';
const TARGET_OPTIONS: ReadonlyArray<{
    value: CameraTarget;
    label: string;
}> = [
    { value: 'screen', label: 'Tela' },
    { value: 'texture', label: 'Textura' },
];
const CONTENT_OPTIONS: ReadonlyArray<{
    value: CameraTextureContent;
    label: string;
}> = [
    { value: 'color', label: 'Cor' },
    { value: 'depth', label: 'Profundidade' },
];
const BACKGROUND_OPTIONS: ReadonlyArray<{
    value: CameraBackground;
    label: string;
}> = [
    { value: 'sky', label: 'Céu' },
    { value: 'color', label: 'Cor sólida' },
];
const MAX_STACK_SUGGESTIONS = 3;
type SectionProps = {
    entity: Entity;
    settings: CameraSettings;
};
function formatFrameRate(value: number): string {
    return value === 0 ? 'todo quadro' : `${value} qps`;
}
function OverlayOutput({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    const stackedOn = baseCamerasStacking(session.scene, entity);
    const available = session.scene.entities.filter((candidate) => candidate.camera?.role === 'base' && candidate.camera.target === 'screen').slice(0, MAX_STACK_SUGGESTIONS);
    return (<CollapsibleSection title="Saída">
      <p className={CAMERA_HINT_CLASS}>
        Sobreposições usam a tela e a área da câmera base em que estão empilhadas e deixam o fundo transparente. Superfícies transparentes só
        aparecem sobre geometria opaca.
      </p>
      {stackedOn.length > 0 ? (<PropertyRow label="Empilhada em">
          <span className="truncate font-mono text-2xs text-foreground/80">{stackedOn.map((base) => base.name).join(', ')}</span>
        </PropertyRow>) : (<>
          <p className={CAMERA_NOTICE_CLASS}>Fora de qualquer pilha, esta câmera não aparece no jogo.</p>
          <ActionRow>
            {available.map((base) => (<ActionButton key={base.id} icon={Layers} variant="primary" onClick={() => addCameraOverlay(session, base, entity)}>
                Empilhar em {base.name}
              </ActionButton>))}
          </ActionRow>
        </>)}
    </CollapsibleSection>);
}
function TextureOutput({ entity, settings }: SectionProps) {
    const session = useEditorSession();
    const { texture } = settings;
    const commitSide = (key: 'width' | 'height', value: number) => {
        if (Number.isFinite(value))
            setCameraTexture(session, entity, { [key]: value });
    };
    return (<>
      <PropertyRow label="Resolução" hint="Largura e altura da textura, em pixels">
        <ScalarField label="Largura da textura" value={texture.width} suffix=" px" onCommit={(value) => commitSide('width', value)}/>
        <ScalarField label="Altura da textura" value={texture.height} suffix=" px" onCommit={(value) => commitSide('height', value)}/>
      </PropertyRow>
      <PropertyRow label="Conteúdo" hint="Profundidade grava a distância entre os planos de corte: preto é perto, branco é longe">
        <SegmentedControl label="Conteúdo da textura" options={CONTENT_OPTIONS} value={texture.content} onChange={(content) => setCameraTexture(session, entity, { content })}/>
      </PropertyRow>
      <SliderField label="Atualização" value={texture.frameRate} min={0} max={60} step={1} format={formatFrameRate} onChange={(frameRate) => setCameraTexture(session, entity, { frameRate })}/>
      <p className={CAMERA_HINT_CLASS}>
        Aparece como “{cameraFeedName(entity)}” nos seletores de textura dos materiais. Câmeras para textura não usam pilha.
      </p>
    </>);
}
function ScreenOutput({ entity, settings }: SectionProps) {
    const session = useEditorSession();
    return (<>
      <PropertyRow label="Prioridade" hint="Ordem de desenho entre câmeras na tela: valores maiores ficam por cima">
        <ScalarField label="Prioridade" value={settings.priority} onCommit={(value) => {
            if (Number.isFinite(value))
                setCameraValue(session, entity, 'priority', value);
        }}/>
      </PropertyRow>
      <ViewportRectField viewport={settings.viewport} onChange={(patch) => setCameraViewport(session, entity, patch)}/>
    </>);
}
export function CameraOutputSection({ entity, settings }: SectionProps) {
    const session = useEditorSession();
    if (settings.role === 'overlay')
        return <OverlayOutput entity={entity}/>;
    return (<CollapsibleSection title="Saída">
      <PropertyRow label="Destino" hint="Tela desenha no jogo; textura grava a imagem para os materiais usarem">
        <SegmentedControl label="Destino" options={TARGET_OPTIONS} value={settings.target} onChange={(target) => setCameraValue(session, entity, 'target', target)}/>
      </PropertyRow>
      {settings.target === 'screen' ? <ScreenOutput entity={entity} settings={settings}/> : <TextureOutput entity={entity} settings={settings}/>}
      <PropertyRow label="Fundo" hint="O que aparece onde não há geometria">
        <SegmentedControl label="Fundo" options={BACKGROUND_OPTIONS} value={settings.background} onChange={(background) => setCameraValue(session, entity, 'background', background)}/>
      </PropertyRow>
      {settings.background === 'color' && (<ColorField label="Cor de fundo" value={settings.backgroundColor} onChange={(rgb) => setCameraBackgroundColor(session, entity, rgb)}/>)}
    </CollapsibleSection>);
}
