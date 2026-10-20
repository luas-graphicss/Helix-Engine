'use client';
import { Atom, RotateCcw } from 'lucide-react';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { PropertyRow } from '@/engine/ui/property-row';
import { IconButton } from '@/engine/ui/icon-button';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import * as vec3 from '@/engine/core/math/vec3';
import { matchPhysicsQuality, type PhysicsQuality } from '@/engine/physics/world/physics-settings';
import { Vector3Input } from './inspector/number-fields';
const QUALITY_OPTIONS: readonly {
    value: PhysicsQuality;
    label: string;
}[] = [
    { value: 'low', label: 'Baixa' },
    { value: 'medium', label: 'Média' },
    { value: 'high', label: 'Alta' },
];
const TIMESTEP_OPTIONS: readonly {
    value: number;
    label: string;
}[] = [
    { value: 30, label: '30 Hz' },
    { value: 60, label: '60 Hz' },
    { value: 120, label: '120 Hz' },
];
const integer = (value: number) => String(Math.round(value));
const hertz = (value: number) => `${Math.round(value)} Hz`;
const metersPerSecond = (value: number) => `${Number(value.toFixed(2))} m/s`;
const radiansPerSecond = (value: number) => `${Number(value.toFixed(2))} rad/s`;
const millimeters = (value: number) => `${Number((value * 1000).toFixed(1))} mm`;
const seconds = (value: number) => `${Number(value.toFixed(2))} s`;
const meters = (value: number) => `${Math.round(value)} m`;
const ratio = (value: number) => Number(value.toFixed(1)).toString();
export function PhysicsPanel() {
    const session = useEditorState();
    const physics = session.scene.physics;
    const quality = matchPhysicsQuality(physics);
    const stepRate = Math.round(1 / physics.fixedTimestep);
    const gravityMagnitude = vec3.length(physics.gravity);
    const running = session.playtest.isRunning;
    return (<div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border p-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-surface-raised text-muted-foreground">
          <Atom className="size-4" aria-hidden/>
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-semibold text-foreground">Mundo físico</span>
          <span className="truncate font-mono text-[10px] text-muted-foreground">
            {gravityMagnitude.toFixed(2)} m/s² · {stepRate} Hz × {physics.substeps} subpassos
            {running ? ' · em simulação' : ''}
          </span>
        </div>
        <IconButton label="Restaurar parâmetros padrão" size="sm" onClick={() => session.resetPhysicsSettings()}>
          <RotateCcw />
        </IconButton>
      </div>

      <div className="flex-1 overflow-auto">
        <CollapsibleSection title="Gravidade">
          <PropertyRow label="Aceleração">
            <Vector3Input label="Gravidade" values={physics.gravity} onCommit={(axis, value) => session.setGravityComponent(axis, value)}/>
          </PropertyRow>
          <p className="px-2 pb-1 text-[10px] leading-relaxed text-pretty text-muted-foreground">
            Terra é −9,81 em Y. Valores positivos invertem a queda; a escala por corpo multiplica este vetor.
          </p>
        </CollapsibleSection>

        <CollapsibleSection title="Simulação">
          <PropertyRow label="Qualidade">
            <SegmentedControl label="Qualidade da simulação" options={QUALITY_OPTIONS} value={quality} onChange={(value) => session.applyPhysicsQuality(value)}/>
          </PropertyRow>
          <PropertyRow label="Passo fixo">
            <SegmentedControl label="Taxa do passo fixo" options={TIMESTEP_OPTIONS} value={TIMESTEP_OPTIONS.some((option) => option.value === stepRate) ? stepRate : null} onChange={(value) => session.updatePhysics({ fixedTimestep: 1 / value })}/>
          </PropertyRow>
          <SliderField label="Subpassos" value={physics.substeps} min={1} max={16} step={1} format={integer} onChange={(value) => session.updatePhysics({ substeps: value })}/>
          <SliderField label="Iterações" value={physics.solverIterations} min={1} max={8} step={1} format={integer} onChange={(value) => session.updatePhysics({ solverIterations: value })}/>
          <SliderField label="Relaxamento" value={physics.relaxIterations} min={0} max={4} step={1} format={integer} onChange={(value) => session.updatePhysics({ relaxIterations: value })}/>
          <ToggleField label="Warm starting" on={physics.warmStarting} onToggle={() => session.updatePhysics({ warmStarting: !physics.warmStarting })}/>
        </CollapsibleSection>

        <CollapsibleSection title="Contatos">
          <SliderField label="Rigidez" value={physics.contactHertz} min={5} max={120} step={1} format={hertz} onChange={(value) => session.updatePhysics({ contactHertz: value })}/>
          <SliderField label="Amortecimento" value={physics.contactDampingRatio} min={0} max={20} step={0.5} format={ratio} onChange={(value) => session.updatePhysics({ contactDampingRatio: value })}/>
          <SliderField label="Empurrão máx." value={physics.contactPushMaxVelocity} min={0.5} max={10} step={0.1} format={metersPerSecond} onChange={(value) => session.updatePhysics({ contactPushMaxVelocity: value })}/>
          <SliderField label="Tolerância" value={physics.linearSlop} min={0.001} max={0.02} step={0.0005} format={millimeters} onChange={(value) => session.updatePhysics({ linearSlop: value })}/>
          <SliderField label="Antecipação" value={physics.speculativeDistance} min={0.005} max={0.2} step={0.005} format={millimeters} onChange={(value) => session.updatePhysics({ speculativeDistance: value })}/>
          <SliderField label="Limiar de quique" value={physics.restitutionThreshold} min={0} max={5} step={0.1} format={metersPerSecond} onChange={(value) => session.updatePhysics({ restitutionThreshold: value })}/>
        </CollapsibleSection>

        <CollapsibleSection title="Repouso">
          <ToggleField label="Adormecer corpos" on={physics.sleepEnabled} onToggle={() => session.updatePhysics({ sleepEnabled: !physics.sleepEnabled })}/>
          <SliderField label="Vel. linear" value={physics.sleepLinearThreshold} min={0.005} max={0.5} step={0.005} disabled={!physics.sleepEnabled} format={metersPerSecond} onChange={(value) => session.updatePhysics({ sleepLinearThreshold: value })}/>
          <SliderField label="Vel. angular" value={physics.sleepAngularThreshold} min={0.005} max={0.5} step={0.005} disabled={!physics.sleepEnabled} format={radiansPerSecond} onChange={(value) => session.updatePhysics({ sleepAngularThreshold: value })}/>
          <SliderField label="Tempo" value={physics.timeToSleep} min={0.1} max={3} step={0.1} disabled={!physics.sleepEnabled} format={seconds} onChange={(value) => session.updatePhysics({ timeToSleep: value })}/>
        </CollapsibleSection>

        <CollapsibleSection title="Limites">
          <SliderField label="Vel. máxima" value={physics.maxLinearSpeed} min={10} max={500} step={5} format={metersPerSecond} onChange={(value) => session.updatePhysics({ maxLinearSpeed: value })}/>
          <SliderField label="Limite de queda" value={physics.fallLimitY} min={-2000} max={-10} step={10} format={meters} onChange={(value) => session.updatePhysics({ fallLimitY: value })}/>
          <p className="px-2 pb-1 text-[10px] leading-relaxed text-pretty text-muted-foreground">
            Corpos abaixo do limite de queda são desativados e registrados no console, em vez de cair para sempre.
          </p>
        </CollapsibleSection>
      </div>
    </div>);
}
