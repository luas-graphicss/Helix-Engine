'use client';
import type { Entity } from '@/engine/core/scene/entity';
import { effectiveLightRange, LIGHT_ANIMATION_LABEL, LOCAL_LIGHT_LABEL, LOCAL_LIGHT_SHORT_LABEL, LOCAL_LIGHT_TYPES, MAX_SPOT_ANGLE, shadowFaceCount, type AmbientLight, type DirectionalLight, type LightAnimation, type LocalLight, type LocalLightType, } from '@/engine/core/scene/light';
import type { LocalShadowState } from '@/engine/renderer/passes/local-shadow-pass';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { ColorField } from '@/engine/ui/color-field';
import { FieldInput } from '@/engine/ui/field-input';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField, ToggleSwitch } from '@/engine/ui/toggle-field';
import { useEditorSession, useViewportStats } from '@/engine/editor/session/editor-session-context';
import { applyLightPreset, setLightColor, setLightIntensity, setLightShadows, setLocalLightAnimation, setLocalLightColorMode, setLocalLightDimension, setLocalLightScalar, setLocalLightShadowScalar, setLocalLightTemperature, setLocalLightTwoSided, setLocalLightType, setSpotAngles, type LightColorMode, } from '@/engine/editor/operations/light-operations';
import { cn } from '@/lib/utils';
import { KelvinField } from './light/kelvin-field';
import { LightPresetsMenu } from './light/light-presets-menu';
const TYPE_OPTIONS: ReadonlyArray<{
    value: LocalLightType;
    label: string;
}> = LOCAL_LIGHT_TYPES.map((type) => ({ value: type, label: LOCAL_LIGHT_SHORT_LABEL[type] }));
const COLOR_MODE_OPTIONS: ReadonlyArray<{
    value: LightColorMode;
    label: string;
}> = [
    { value: 'rgb', label: 'RGB' },
    { value: 'kelvin', label: 'Kelvin' },
];
const ANIMATION_OPTIONS: ReadonlyArray<{
    value: LightAnimation;
    label: string;
}> = (['none', 'flicker', 'pulse', 'strobe'] as const).map((value) => ({
    value,
    label: LIGHT_ANIMATION_LABEL[value],
}));
const meters = (value: number) => `${Number(value.toFixed(2))} m`;
const degrees = (value: number) => `${Number(value.toFixed(1))}°`;
const hertz = (value: number) => `${Number(value.toFixed(2))} Hz`;
const percent = (value: number) => `${Math.round(value * 100)}%`;
const falloffLabel = (value: number) => (Math.abs(value - 2) < 1e-3 ? '2 · físico' : String(Number(value.toFixed(2))));
type Tone = 'ok' | 'info' | 'warn' | 'muted';
const TONE_CLASS: Record<Tone, string> = {
    ok: 'border-axis-y/50 text-axis-y',
    info: 'border-primary/50 text-primary',
    warn: 'border-warning/60 text-warning',
    muted: 'border-border text-muted-foreground',
};
interface ShadowStatusView {
    readonly tone: Tone;
    readonly label: string;
    readonly hint: string;
}
function describeShadowStatus(viewportShadows: boolean, state: LocalShadowState | undefined): ShadowStatusView {
    if (!viewportShadows)
        return { tone: 'muted', label: 'Sombras desligadas no viewport', hint: 'Ative as sombras no menu de visualização para ver o resultado.' };
    switch (state) {
        case 'rendered':
            return { tone: 'ok', label: 'Renderizada neste frame', hint: 'As faces foram redesenhadas porque a luz ou algo ao alcance mudou.' };
        case 'cached':
            return { tone: 'info', label: 'Em cache', hint: 'Nada mudou ao alcance: as faces do frame anterior foram reaproveitadas, custo zero.' };
        case 'deferred':
            return { tone: 'warn', label: 'Adiada: orçamento esgotado', hint: 'As luzes mais importantes ficaram com as faces. Reduza o alcance ou desligue sombras de luzes secundárias.' };
        default:
            return { tone: 'muted', label: 'Sem faces neste frame', hint: 'A luz está fora da tela, sem contribuição visível ou sem projetores ao alcance.' };
    }
}
function facesLabel(light: LocalLight): string {
    const faces = shadowFaceCount(light);
    if (faces === 1)
        return '1 face (cone)';
    return faces === 6 ? '6 faces (cubo)' : '5 faces (cubo sem a traseira)';
}
function StatusChip({ tone, children }: {
    tone: Tone;
    children: React.ReactNode;
}) {
    return <span className={cn('inline-flex h-5 items-center rounded-sm border px-1.5 font-mono text-3xs tracking-wide', TONE_CLASS[tone])}>{children}</span>;
}
function Hint({ children }: {
    children: React.ReactNode;
}) {
    return <p className="px-2 py-0.5 text-3xs leading-relaxed text-pretty text-muted-foreground">{children}</p>;
}
function SunSection({ entity, light }: {
    entity: Entity;
    light: DirectionalLight;
}) {
    const session = useEditorSession();
    return (<CollapsibleSection title="Luz direcional">
      <SliderField label="Intensidade" value={light.intensity} min={0} max={20} step={0.05} editable onChange={(value) => setLightIntensity(session, entity, value)}/>
      <ColorField label="Cor" value={light.color} onChange={(rgb) => setLightColor(session, entity, 'color', rgb)}/>
      <ToggleField label="Projeta sombras" on={light.castShadows} onToggle={() => setLightShadows(session, entity, !light.castShadows)}/>
    </CollapsibleSection>);
}
function AmbientSection({ entity, light }: {
    entity: Entity;
    light: AmbientLight;
}) {
    const session = useEditorSession();
    return (<CollapsibleSection title="Luz ambiente">
      <SliderField label="Intensidade" value={light.intensity} min={0} max={3} step={0.01} editable onChange={(value) => setLightIntensity(session, entity, value)}/>
      <ColorField label="Céu" value={light.skyColor} onChange={(rgb) => setLightColor(session, entity, 'skyColor', rgb)}/>
      <ColorField label="Chão" value={light.groundColor} onChange={(rgb) => setLightColor(session, entity, 'groundColor', rgb)}/>
    </CollapsibleSection>);
}
function ShapeRows({ entity, light }: {
    entity: Entity;
    light: LocalLight;
}) {
    const session = useEditorSession();
    switch (light.type) {
        case 'spot':
            return (<>
          <SliderField label="Ângulo interno" value={light.innerAngle} min={0} max={MAX_SPOT_ANGLE} step={0.5} format={degrees} onChange={(value) => setSpotAngles(session, entity, { innerAngle: value })}/>
          <SliderField label="Ângulo externo" value={light.outerAngle} min={1} max={MAX_SPOT_ANGLE} step={0.5} format={degrees} onChange={(value) => setSpotAngles(session, entity, { outerAngle: value })}/>
        </>);
        case 'rect':
            return (<>
          <SliderField label="Largura" value={light.width} min={0.05} max={10} scale="log" editable suffix=" m" onChange={(value) => setLocalLightDimension(session, entity, 'width', value)}/>
          <SliderField label="Altura" value={light.height} min={0.05} max={10} scale="log" editable suffix=" m" onChange={(value) => setLocalLightDimension(session, entity, 'height', value)}/>
          <ToggleField label="Dupla face" on={light.twoSided} onToggle={() => setLocalLightTwoSided(session, entity, !light.twoSided)}/>
        </>);
        case 'disc':
            return (<>
          <SliderField label="Raio" value={light.radius} min={0.02} max={5} scale="log" editable suffix=" m" onChange={(value) => setLocalLightDimension(session, entity, 'radius', value)}/>
          <ToggleField label="Dupla face" on={light.twoSided} onToggle={() => setLocalLightTwoSided(session, entity, !light.twoSided)}/>
        </>);
        case 'tube':
            return <SliderField label="Comprimento" value={light.length} min={0.05} max={10} scale="log" editable suffix=" m" onChange={(value) => setLocalLightDimension(session, entity, 'length', value)}/>;
        default:
            return null;
    }
}
function LocalLightMainSection({ entity, light }: {
    entity: Entity;
    light: LocalLight;
}) {
    const session = useEditorSession();
    const colorMode: LightColorMode = light.temperature === null ? 'rgb' : 'kelvin';
    const autoRange = light.range <= 0;
    const range = effectiveLightRange(light);
    return (<CollapsibleSection title={`Luz · ${LOCAL_LIGHT_LABEL[light.type]}`} trailing={<LightPresetsMenu onPick={(preset) => applyLightPreset(session, entity, preset)}/>}>
      <PropertyRow label="Tipo">
        <SegmentedControl label="Tipo de luz" options={TYPE_OPTIONS} value={light.type} onChange={(type) => setLocalLightType(session, entity, type)}/>
      </PropertyRow>
      <PropertyRow label="Cor">
        <SegmentedControl label="Modo de cor" options={COLOR_MODE_OPTIONS} value={colorMode} onChange={(mode) => setLocalLightColorMode(session, entity, mode)}/>
      </PropertyRow>
      {colorMode === 'rgb' ? (<ColorField label="Cor da luz" value={light.color} onChange={(rgb) => setLightColor(session, entity, 'color', rgb)}/>) : (<KelvinField value={light.temperature ?? 4000} onChange={(kelvin) => setLocalLightTemperature(session, entity, kelvin)}/>)}
      <SliderField label="Intensidade" value={light.intensity} min={0.1} max={1000} scale="log" editable onChange={(value) => setLightIntensity(session, entity, value)}/>
      <ToggleField label="Alcance automático" on={autoRange} onToggle={() => setLocalLightScalar(session, entity, 'range', autoRange ? range : 0)}/>
      <SliderField label={autoRange ? 'Alcance efetivo' : 'Alcance'} value={range} min={0.25} max={200} scale="log" editable suffix=" m" disabled={autoRange} onChange={(value) => setLocalLightScalar(session, entity, 'range', value)}/>
      <SliderField label="Queda" value={light.falloff} min={0.5} max={6} step={0.05} format={falloffLabel} onChange={(value) => setLocalLightScalar(session, entity, 'falloff', value)}/>
      <SliderField label="Raio da fonte" value={light.sourceRadius} min={0} max={2} step={0.005} editable suffix=" m" onChange={(value) => setLocalLightScalar(session, entity, 'sourceRadius', value)}/>
      <SliderField label="Especular" value={light.specular} min={0} max={2} step={0.01} format={percent} onChange={(value) => setLocalLightScalar(session, entity, 'specular', value)}/>
      <ShapeRows entity={entity} light={light}/>
    </CollapsibleSection>);
}
function LocalLightShadowSection({ entity, light }: {
    entity: Entity;
    light: LocalLight;
}) {
    const session = useEditorSession();
    const stats = useViewportStats();
    const { shadow } = light;
    const status = describeShadowStatus(session.shadowsEnabled, stats.localShadowStatus.get(entity.id));
    const budget = `${stats.localShadowFaces}/${stats.localShadowBudget} faces em uso`;
    return (<CollapsibleSection title="Sombra" trailing={<ToggleSwitch label="Projetar sombra" on={shadow.enabled} onToggle={() => setLightShadows(session, entity, !shadow.enabled)}/>}>
      {shadow.enabled ? (<>
          <PropertyRow label="Estado" hint={status.hint}>
            <span title={status.hint} className="flex min-w-0">
              <StatusChip tone={status.tone}>{status.label}</StatusChip>
            </span>
          </PropertyRow>
          <PropertyRow label="Custo">
            <FieldInput readOnly value={`${facesLabel(light)} · ${budget}`} aria-label="Faces de sombra"/>
          </PropertyRow>
          <SliderField label="Suavidade" value={shadow.softness} min={0} max={1} step={0.01} format={percent} onChange={(value) => setLocalLightShadowScalar(session, entity, 'softness', value)}/>
          <SliderField label="Força" value={shadow.strength} min={0} max={1} step={0.01} format={percent} onChange={(value) => setLocalLightShadowScalar(session, entity, 'strength', value)}/>
          <SliderField label="Viés" value={shadow.bias} min={0} max={1} step={0.01} format={percent} onChange={(value) => setLocalLightShadowScalar(session, entity, 'bias', value)}/>
          <SliderField label="Viés normal" value={shadow.normalBias} min={0} max={8} step={0.05} onChange={(value) => setLocalLightShadowScalar(session, entity, 'normalBias', value)}/>
        </>) : null}
    </CollapsibleSection>);
}
function LocalLightAnimationSection({ entity, light }: {
    entity: Entity;
    light: LocalLight;
}) {
    const session = useEditorSession();
    return (<CollapsibleSection title="Animação" defaultOpen={light.animation !== 'none'}>
      <PropertyRow label="Modo">
        <SegmentedControl label="Animação da luz" options={ANIMATION_OPTIONS} value={light.animation} onChange={(animation) => setLocalLightAnimation(session, entity, animation)}/>
      </PropertyRow>
      {light.animation !== 'none' && (<>
          <SliderField label="Velocidade" value={light.animationSpeed} min={0.1} max={30} scale="log" editable suffix=" Hz" format={hertz} onChange={(value) => setLocalLightScalar(session, entity, 'animationSpeed', value)}/>
          <SliderField label="Profundidade" value={light.animationAmount} min={0} max={1} step={0.01} format={percent} onChange={(value) => setLocalLightScalar(session, entity, 'animationAmount', value)}/>
        </>)}
    </CollapsibleSection>);
}
export function LightSection({ entity }: {
    entity: Entity;
}) {
    const light = entity.light;
    if (!light)
        return null;
    if (light.type === 'directional')
        return <SunSection entity={entity} light={light}/>;
    if (light.type === 'ambient')
        return <AmbientSection entity={entity} light={light}/>;
    return (<>
      <LocalLightMainSection entity={entity} light={light}/>
      <LocalLightShadowSection entity={entity} light={light}/>
      <LocalLightAnimationSection entity={entity} light={light}/>
    </>);
}
