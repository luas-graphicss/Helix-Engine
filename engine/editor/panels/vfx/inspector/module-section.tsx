'use client';
import { ArrowRight, Copy, Trash2 } from 'lucide-react';
import { vfxModuleInfo, type VfxEmitter, type VfxModule, type VfxModuleOf, type VfxSimulationSpace } from '@/engine/vfx/document/vfx-document';
import { duplicateVfxModule, endVfxDocumentEdit, patchVfxModule, removeVfxModule, toggleVfxModule, vfxMergeKey } from '@/engine/editor/operations/vfx-document-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField, ToggleSwitch } from '@/engine/ui/toggle-field';
import { CurveEditor } from '../fields/curve-editor';
import { GradientEditor } from '../fields/gradient-editor';
import { NumberRow } from '../fields/number-row';
import { Vector3Field } from '../fields/vector3-field';
const SPACE_OPTIONS: ReadonlyArray<{
    value: VfxSimulationSpace;
    label: string;
}> = [
    { value: 'local', label: 'Local' },
    { value: 'world', label: 'Mundo' },
];
const percent = (value: number) => `${Math.round(value * 100)} %`;
type Patch<M extends VfxModule> = (patch: Partial<M>, label: string, field?: string) => void;
interface ModuleFieldsProps<M extends VfxModule> {
    module: M;
    patch: Patch<M>;
    end: () => void;
}
function CurveBlock({ children }: {
    children: React.ReactNode;
}) {
    return <div className="px-2 py-0.5">{children}</div>;
}
function SizeOverLifeFields({ module, patch, end }: ModuleFieldsProps<VfxModuleOf<'sizeOverLife'>>) {
    return (<>
      <CurveBlock>
        <CurveEditor label={module.separateAxes ? 'Largura na vida' : 'Tamanho na vida'} curve={module.curve} suggestedMax={1.5} unit="×" onChange={(curve) => patch({ curve }, 'Curva de tamanho', 'curve')} onEnd={end}/>
      </CurveBlock>
      <ToggleField label="Eixos separados" on={module.separateAxes} onToggle={() => patch({ separateAxes: !module.separateAxes }, module.separateAxes ? 'Tamanho uniforme' : 'Tamanho por eixo')}/>
      {module.separateAxes && (<CurveBlock>
          <CurveEditor label="Altura na vida" curve={module.curveY} suggestedMax={1.5} unit="×" onChange={(curveY) => patch({ curveY }, 'Curva de altura', 'curveY')} onEnd={end}/>
        </CurveBlock>)}
    </>);
}
function ColorOverLifeFields({ module, patch, end }: ModuleFieldsProps<VfxModuleOf<'colorOverLife'>>) {
    return (<>
      <CurveBlock>
        <GradientEditor label="Cor e alfa na vida" gradient={module.gradient} onChange={(gradient) => patch({ gradient }, 'Gradiente na vida', 'gradient')} onEnd={end}/>
      </CurveBlock>
    </>);
}
function VelocityOverLifeFields({ module, patch, end }: ModuleFieldsProps<VfxModuleOf<'velocityOverLife'>>) {
    return (<>
      <CurveBlock>
        <CurveEditor label="Fator da velocidade" curve={module.speedCurve} suggestedMax={1.5} unit="×" onChange={(speedCurve) => patch({ speedCurve }, 'Curva de velocidade', 'speedCurve')} onEnd={end}/>
      </CurveBlock>
      <Vector3Field label="Deriva" value={module.linear} step={0.1} onChange={(linear) => patch({ linear }, 'Deriva constante', 'linear')} onEnd={end}/>
      <PropertyRow label="Espaço">
        <SegmentedControl label="Espaço da deriva" options={SPACE_OPTIONS} value={module.space} onChange={(space) => patch({ space }, `Deriva em espaço ${space}`)}/>
      </PropertyRow>
    </>);
}
function LimitVelocityFields({ module, patch, end }: ModuleFieldsProps<VfxModuleOf<'limitVelocity'>>) {
    return (<>
      <NumberRow label="Velocidade máx." value={module.speed} min={0} step={0.1} unit="m/s" onChange={(speed) => patch({ speed }, 'Velocidade máxima', 'speed')} onEnd={end}/>
      <SliderField label="Amortecer" value={module.dampen} min={0} max={1} format={percent} onChange={(dampen) => patch({ dampen }, 'Amortecimento', 'dampen')}/>
    </>);
}
function GravityFields({ module, patch, end }: ModuleFieldsProps<VfxModuleOf<'gravity'>>) {
    return (<>
      <NumberRow label="Escala" value={module.scale} min={-10} max={10} step={0.05} unit="×g" onChange={(scale) => patch({ scale }, 'Escala da gravidade', 'scale')} onEnd={end}/>
    </>);
}
function ForceFields({ module, patch, end }: ModuleFieldsProps<VfxModuleOf<'force'>>) {
    return (<>
      <Vector3Field label="Força" value={module.force} step={0.1} onChange={(force) => patch({ force }, 'Força constante', 'force')} onEnd={end}/>
      <SliderField label="Variar" value={module.randomize} min={0} max={1} format={percent} onChange={(randomize) => patch({ randomize }, 'Variação da força', 'randomize')}/>
      <PropertyRow label="Espaço">
        <SegmentedControl label="Espaço da força" options={SPACE_OPTIONS} value={module.space} onChange={(space) => patch({ space }, `Força em espaço ${space}`)}/>
      </PropertyRow>
    </>);
}
function DragFields({ module, patch, end }: ModuleFieldsProps<VfxModuleOf<'drag'>>) {
    return (<>
      <NumberRow label="Coeficiente" value={module.coefficient} min={0} max={50} step={0.1} onChange={(coefficient) => patch({ coefficient }, 'Coeficiente de arrasto', 'coefficient')} onEnd={end}/>
      <CurveBlock>
        <CurveEditor label="Arrasto na vida" curve={module.curve} suggestedMax={1.5} unit="×" onChange={(curve) => patch({ curve }, 'Curva de arrasto', 'curve')} onEnd={end}/>
      </CurveBlock>
    </>);
}
function NoiseFields({ module, patch, end }: ModuleFieldsProps<VfxModuleOf<'noise'>>) {
    return (<>
      <NumberRow label="Força" value={module.strength} min={0} max={50} step={0.1} unit="m/s²" onChange={(strength) => patch({ strength }, 'Força da turbulência', 'strength')} onEnd={end}/>
      <NumberRow label="Frequência" value={module.frequency} min={0.01} max={10} step={0.05} unit="/m" onChange={(frequency) => patch({ frequency }, 'Frequência da turbulência', 'frequency')} onEnd={end}/>
      <NumberRow label="Deslizar" value={module.scrollSpeed} min={0} max={10} step={0.05} unit="/s" onChange={(scrollSpeed) => patch({ scrollSpeed }, 'Velocidade do campo', 'scrollSpeed')} onEnd={end}/>
      <NumberRow label="Oitavas" value={module.octaves} min={1} max={4} step={1} precision={0} onChange={(octaves) => patch({ octaves }, 'Oitavas da turbulência', 'octaves')} onEnd={end}/>
      <CurveBlock>
        <CurveEditor label="Turbulência na vida" curve={module.curve} suggestedMax={1.5} unit="×" onChange={(curve) => patch({ curve }, 'Curva de turbulência', 'curve')} onEnd={end}/>
      </CurveBlock>
    </>);
}
function VortexFields({ module, patch, end }: ModuleFieldsProps<VfxModuleOf<'vortex'>>) {
    return (<>
      <Vector3Field label="Eixo" value={module.axis} step={0.1} onChange={(axis) => patch({ axis }, 'Eixo do vórtice', 'axis')} onEnd={end}/>
      <NumberRow label="Força" value={module.strength} min={-50} max={50} step={0.1} onChange={(strength) => patch({ strength }, 'Força do vórtice', 'strength')} onEnd={end}/>
      <NumberRow label="Sucção" value={module.pull} min={-20} max={20} step={0.1} onChange={(pull) => patch({ pull }, 'Sucção do vórtice', 'pull')} onEnd={end}/>
    </>);
}
function AttractorFields({ module, patch, end }: ModuleFieldsProps<VfxModuleOf<'attractor'>>) {
    return (<>
      <Vector3Field label="Posição" value={module.position} step={0.1} onChange={(position) => patch({ position }, 'Posição do atrator', 'position')} onEnd={end}/>
      <NumberRow label="Força" value={module.strength} min={-100} max={100} step={0.5} onChange={(strength) => patch({ strength }, 'Força do atrator', 'strength')} onEnd={end}/>
      <NumberRow label="Raio" value={module.radius} min={0.01} max={20} step={0.05} unit="m" onChange={(radius) => patch({ radius }, 'Raio do atrator', 'radius')} onEnd={end}/>
      <ToggleField label="Matar ao chegar" on={module.kill} onToggle={() => patch({ kill: !module.kill }, module.kill ? 'Atrator não mata' : 'Atrator mata ao chegar')}/>
    </>);
}
function OrbitFields({ module, patch, end }: ModuleFieldsProps<VfxModuleOf<'orbit'>>) {
    return (<>
      <NumberRow label="Velocidade" value={module.speed} min={-50} max={50} step={0.1} unit="rad/s" onChange={(speed) => patch({ speed }, 'Velocidade da órbita', 'speed')} onEnd={end}/>
      <NumberRow label="Radial" value={module.radial} min={-20} max={20} step={0.1} unit="m/s" onChange={(radial) => patch({ radial }, 'Velocidade radial', 'radial')} onEnd={end}/>
      <Vector3Field label="Eixo" value={module.axis} step={0.1} onChange={(axis) => patch({ axis }, 'Eixo da órbita', 'axis')} onEnd={end}/>
    </>);
}
function RotationOverLifeFields({ module, patch, end }: ModuleFieldsProps<VfxModuleOf<'rotationOverLife'>>) {
    return (<>
      <ToggleField label="Alinhar à velocidade" on={module.alignToVelocity} onToggle={() => patch({ alignToVelocity: !module.alignToVelocity }, module.alignToVelocity ? 'Giro livre' : 'Alinhar à velocidade')}/>
      {!module.alignToVelocity && (<CurveBlock>
          <CurveEditor label="Giro na vida" curve={module.curve} suggestedMin={-180} suggestedMax={180} unit="°/s" onChange={(curve) => patch({ curve }, 'Curva de giro', 'curve')} onEnd={end}/>
        </CurveBlock>)}
    </>);
}
function CollisionFields({ module, patch, end }: ModuleFieldsProps<VfxModuleOf<'collision'>>) {
    return (<>
      <NumberRow label="Altura do chão" value={module.planeHeight} step={0.05} unit="m" onChange={(planeHeight) => patch({ planeHeight }, 'Altura do plano', 'planeHeight')} onEnd={end}/>
      <SliderField label="Quicar" value={module.bounce} min={0} max={1} format={percent} onChange={(bounce) => patch({ bounce }, 'Restituição', 'bounce')}/>
      <SliderField label="Atrito" value={module.friction} min={0} max={1} format={percent} onChange={(friction) => patch({ friction }, 'Atrito', 'friction')}/>
      <SliderField label="Perder vida" value={module.lifetimeLoss} min={0} max={1} format={percent} onChange={(lifetimeLoss) => patch({ lifetimeLoss }, 'Perda de vida na colisão', 'lifetimeLoss')}/>
      <ToggleField label="Matar ao bater" on={module.killOnCollide} onToggle={() => patch({ killOnCollide: !module.killOnCollide }, module.killOnCollide ? 'Colisão quica' : 'Colisão mata')}/>
    </>);
}
function SizeBySpeedFields({ module, patch, end }: ModuleFieldsProps<VfxModuleOf<'sizeBySpeed'>>) {
    return (<>
      <CurveBlock>
        <CurveEditor label="Tamanho pela velocidade" curve={module.curve} suggestedMax={2} unit="×" onChange={(curve) => patch({ curve }, 'Curva de tamanho por velocidade', 'curve')} onEnd={end}/>
      </CurveBlock>
      <PropertyRow label="Faixa">
        <NumberPair min={module.speedMin} max={module.speedMax} unit="m/s" onChange={(speedMin, speedMax) => patch({ speedMin, speedMax }, 'Faixa de velocidade', 'speedRange')} onEnd={end}/>
      </PropertyRow>
    </>);
}
function ColorBySpeedFields({ module, patch, end }: ModuleFieldsProps<VfxModuleOf<'colorBySpeed'>>) {
    return (<>
      <CurveBlock>
        <GradientEditor label="Cor pela velocidade" gradient={module.gradient} onChange={(gradient) => patch({ gradient }, 'Gradiente por velocidade', 'gradient')} onEnd={end}/>
      </CurveBlock>
      <PropertyRow label="Faixa">
        <NumberPair min={module.speedMin} max={module.speedMax} unit="m/s" onChange={(speedMin, speedMax) => patch({ speedMin, speedMax }, 'Faixa de velocidade', 'speedRange')} onEnd={end}/>
      </PropertyRow>
    </>);
}
function NumberPair({ min, max, unit, onChange, onEnd }: {
    min: number;
    max: number;
    unit: string;
    onChange: (min: number, max: number) => void;
    onEnd: () => void;
}) {
    return (<>
      <NumberInline label="Mínimo" value={min} unit={unit} onChange={(value) => onChange(value, Math.max(value, max))} onEnd={onEnd}/>
      <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden/>
      <NumberInline label="Máximo" value={max} unit={unit} onChange={(value) => onChange(Math.min(value, min), value)} onEnd={onEnd}/>
    </>);
}
function NumberInline(props: {
    label: string;
    value: number;
    unit: string;
    onChange: (value: number) => void;
    onEnd: () => void;
}) {
    return <GuiNumber {...props}/>;
}
import { GuiNumberField } from '@/engine/editor/panels/gui/inspector/fields/gui-number-field';
function GuiNumber({ label, value, unit, onChange, onEnd }: {
    label: string;
    value: number;
    unit: string;
    onChange: (value: number) => void;
    onEnd: () => void;
}) {
    return <GuiNumberField label={label} value={value} min={0} step={0.1} unit={unit} onChange={onChange} onEnd={onEnd}/>;
}
function ModuleFields({ module, emitterId }: {
    module: VfxModule;
    emitterId: string;
}) {
    const session = useEditorSession();
    const end = () => endVfxDocumentEdit(session);
    const patch = <M extends VfxModule>(patchValue: Partial<M>, label: string, field?: string) => patchVfxModule<M>(session, emitterId, module.id, patchValue, label, field ? vfxMergeKey(emitterId, module.id, field) : undefined);
    switch (module.kind) {
        case 'sizeOverLife':
            return <SizeOverLifeFields module={module} patch={patch} end={end}/>;
        case 'colorOverLife':
            return <ColorOverLifeFields module={module} patch={patch} end={end}/>;
        case 'velocityOverLife':
            return <VelocityOverLifeFields module={module} patch={patch} end={end}/>;
        case 'limitVelocity':
            return <LimitVelocityFields module={module} patch={patch} end={end}/>;
        case 'gravity':
            return <GravityFields module={module} patch={patch} end={end}/>;
        case 'force':
            return <ForceFields module={module} patch={patch} end={end}/>;
        case 'drag':
            return <DragFields module={module} patch={patch} end={end}/>;
        case 'noise':
            return <NoiseFields module={module} patch={patch} end={end}/>;
        case 'vortex':
            return <VortexFields module={module} patch={patch} end={end}/>;
        case 'attractor':
            return <AttractorFields module={module} patch={patch} end={end}/>;
        case 'orbit':
            return <OrbitFields module={module} patch={patch} end={end}/>;
        case 'rotationOverLife':
            return <RotationOverLifeFields module={module} patch={patch} end={end}/>;
        case 'collision':
            return <CollisionFields module={module} patch={patch} end={end}/>;
        case 'sizeBySpeed':
            return <SizeBySpeedFields module={module} patch={patch} end={end}/>;
        case 'colorBySpeed':
            return <ColorBySpeedFields module={module} patch={patch} end={end}/>;
    }
}
export function ModuleSection({ emitter, module }: {
    emitter: VfxEmitter;
    module: VfxModule;
}) {
    const session = useEditorSession();
    const info = vfxModuleInfo(module.kind);
    return (<CollapsibleSection title={info.label} hint={info.description} trailing={<div className="flex items-center gap-1">
          <ToggleSwitch label={`${module.enabled ? 'Desligar' : 'Ligar'} ${info.label}`} on={module.enabled} onToggle={() => toggleVfxModule(session, emitter.id, module.id)}/>
          <IconButton label="Duplicar módulo" size="xs" onClick={() => duplicateVfxModule(session, emitter.id, module.id)}>
            <Copy />
          </IconButton>
          <IconButton label="Remover módulo" size="xs" className="hover:text-destructive" onClick={() => removeVfxModule(session, emitter.id, module.id)}>
            <Trash2 />
          </IconButton>
        </div>}>
      <ModuleFields module={module} emitterId={emitter.id}/>
    </CollapsibleSection>);
}
