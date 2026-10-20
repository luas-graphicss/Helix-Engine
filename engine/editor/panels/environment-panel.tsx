'use client';
import { CloudSun, Pause, Play } from 'lucide-react';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { PropertyRow } from '@/engine/ui/property-row';
import { IconButton } from '@/engine/ui/icon-button';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { formatTimeOfDay, moonPhaseName } from '@/engine/core/environment/celestial';
import type { CloudQuality } from '@/engine/core/environment/sky-settings';
const MINUTE = 1 / 60;
const DEFAULT_CYCLE_SPEED = 0.5;
const QUALITY_OPTIONS: readonly {
    value: CloudQuality;
    label: string;
}[] = [
    { value: 'low', label: 'Baixa' },
    { value: 'medium', label: 'Média' },
    { value: 'high', label: 'Alta' },
];
const degrees = (value: number) => `${Math.round(value)}°`;
const meters = (value: number) => `${Math.round(value).toLocaleString('pt-BR')} m`;
const metersPerSecond = (value: number) => `${Math.round(value)} m/s`;
const times = (value: number) => `${value.toFixed(1)}×`;
const percent = (value: number) => `${Math.round(value * 100)}%`;
const cycleSpeed = (value: number) => (value <= 0 ? 'Pausado' : `${value.toFixed(2)} h/s`);
export function EnvironmentPanel() {
    const session = useEditorState();
    const sky = session.scene.sky;
    const { clouds } = sky;
    const cycling = sky.cycleSpeed > 0;
    return (<div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border p-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-surface-raised text-muted-foreground">
          <CloudSun className="size-4" aria-hidden/>
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-semibold text-foreground">Céu e atmosfera</span>
          <span className="truncate font-mono text-[10px] text-muted-foreground">
            {formatTimeOfDay(sky.timeOfDay)} · {moonPhaseName(sky.moonPhase)}
          </span>
        </div>
        <IconButton label={cycling ? 'Pausar ciclo dia/noite' : 'Iniciar ciclo dia/noite'} size="sm" active={cycling} onClick={() => session.updateSky({ cycleSpeed: cycling ? 0 : DEFAULT_CYCLE_SPEED })}>
          {cycling ? <Pause /> : <Play />}
        </IconButton>
      </div>

      <div className="flex-1 overflow-auto">
        <CollapsibleSection title="Sol e hora">
          <ToggleField label="Céu físico" on={sky.enabled} onToggle={() => session.updateSky({ enabled: !sky.enabled })}/>
          <SliderField label="Hora" value={sky.timeOfDay} min={0} max={24 - MINUTE} step={MINUTE} format={formatTimeOfDay} onChange={(value) => session.updateSky({ timeOfDay: value })}/>
          <SliderField label="Ciclo" value={sky.cycleSpeed} min={0} max={4} step={0.05} format={cycleSpeed} onChange={(value) => session.updateSky({ cycleSpeed: value })}/>
          <SliderField label="Latitude" value={sky.latitude} min={-66} max={66} step={1} format={degrees} onChange={(value) => session.updateSky({ latitude: value })}/>
          <SliderField label="Azimute" value={sky.sunAzimuth} min={0} max={360} step={1} format={degrees} onChange={(value) => session.updateSky({ sunAzimuth: value })}/>
        </CollapsibleSection>

        <CollapsibleSection title="Atmosfera">
          <SliderField label="Névoa" value={sky.haze} min={0} max={1} format={percent} onChange={(value) => session.updateSky({ haze: value })}/>
          <SliderField label="Disco solar" value={sky.sunDiskScale} min={0.5} max={6} step={0.1} format={times} onChange={(value) => session.updateSky({ sunDiskScale: value })}/>
          <ToggleField label="Luz do céu" on={sky.skyLighting} onToggle={() => session.updateSky({ skyLighting: !sky.skyLighting })}/>
        </CollapsibleSection>

        <CollapsibleSection title="Lua e estrelas">
          <SliderField label="Fase" value={sky.moonPhase} min={0} max={1} format={moonPhaseName} onChange={(value) => session.updateSky({ moonPhase: value })}/>
          <SliderField label="Disco lunar" value={sky.moonScale} min={0.5} max={6} step={0.1} format={times} onChange={(value) => session.updateSky({ moonScale: value })}/>
          <SliderField label="Luar" value={sky.moonlight} min={0} max={1} format={percent} onChange={(value) => session.updateSky({ moonlight: value })}/>
          <SliderField label="Estrelas" value={sky.starsIntensity} min={0} max={3} step={0.05} format={times} onChange={(value) => session.updateSky({ starsIntensity: value })}/>
        </CollapsibleSection>

        <CollapsibleSection title="Nuvens">
          <ToggleField label="Ativas" on={clouds.enabled} onToggle={() => session.updateClouds({ enabled: !clouds.enabled })}/>
          <SliderField label="Cobertura" value={clouds.coverage} min={0} max={1} format={percent} onChange={(value) => session.updateClouds({ coverage: value })}/>
          <SliderField label="Densidade" value={clouds.density} min={0} max={1} format={percent} onChange={(value) => session.updateClouds({ density: value })}/>
          <SliderField label="Altitude" value={clouds.altitude} min={400} max={6000} step={50} format={meters} onChange={(value) => session.updateClouds({ altitude: value })}/>
          <SliderField label="Espessura" value={clouds.thickness} min={100} max={3000} step={50} format={meters} onChange={(value) => session.updateClouds({ thickness: value })}/>
          <SliderField label="Detalhe" value={clouds.detail} min={0} max={1} format={percent} onChange={(value) => session.updateClouds({ detail: value })}/>
          <SliderField label="Vento" value={clouds.windSpeed} min={0} max={60} step={1} format={metersPerSecond} onChange={(value) => session.updateClouds({ windSpeed: value })}/>
          <SliderField label="Direção" value={clouds.windDirection} min={0} max={360} step={1} format={degrees} onChange={(value) => session.updateClouds({ windDirection: value })}/>
          <ToggleField label="Sombras" on={clouds.shadows} onToggle={() => session.updateClouds({ shadows: !clouds.shadows })}/>
          <PropertyRow label="Qualidade">
            <SegmentedControl label="Qualidade das nuvens" options={QUALITY_OPTIONS} value={clouds.quality} onChange={(quality) => session.updateClouds({ quality })}/>
          </PropertyRow>
        </CollapsibleSection>
      </div>
    </div>);
}
