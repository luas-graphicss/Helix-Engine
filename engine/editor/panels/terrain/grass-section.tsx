'use client';
import { Eraser, PaintBucket } from 'lucide-react';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField, ToggleSwitch } from '@/engine/ui/toggle-field';
import { ColorField } from '@/engine/ui/color-field';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { useEditorState, useViewportStats } from '@/engine/editor/session/editor-session-context';
import { fillGrass, terrainSupportsGrass, updateGrassSettings } from '@/engine/editor/operations/terrain-operations';
import { MAX_GRASS_DENSITY, type GrassSettings } from '@/engine/terrain/foliage/grass-settings';
import type { TerrainTarget } from '../terrain-panel';
import { centimeters, degrees, meters, percent, perSquareMeter, seconds, times } from './formatters';
export function GrassSection({ target }: {
    target: TerrainTarget;
}) {
    const session = useEditorState();
    const { entity, terrain } = target;
    const { grass } = terrain;
    const supported = terrainSupportsGrass(terrain);
    const set = <K extends keyof GrassSettings>(key: K) => (value: GrassSettings[K]) => updateGrassSettings(session, entity, { [key]: value });
    const stats = useViewportStats();
    const blades = stats.grassBlades;
    const interactors = stats.grassInteractors;
    return (<CollapsibleSection title="Grama" trailing={<ToggleSwitch label="Grama ativa" on={grass.enabled} onToggle={() => updateGrassSettings(session, entity, { enabled: !grass.enabled })}/>}>
      <ActionRow>
        <ActionButton icon={PaintBucket} variant="primary" disabled={!supported} onClick={() => fillGrass(session, entity, 1)}>
          Cobrir o terreno
        </ActionButton>
        <ActionButton icon={Eraser} variant="danger" onClick={() => fillGrass(session, entity, 0)}>
          Limpar
        </ActionButton>
      </ActionRow>
      <p className="px-2 pb-1 text-[10px] leading-relaxed text-pretty text-muted-foreground">
        {supported
            ? `A grama nasce onde foi pintada e o solo aceita (vegetação e terra). ${blades.toLocaleString('pt-BR')} lâminas em tela.`
            : 'Nenhuma camada aceita grama: adicione uma camada de vegetação ou de solo.'}
      </p>

      <SliderField label="Densidade" value={grass.density} min={0} max={MAX_GRASS_DENSITY} step={1} format={perSquareMeter} onChange={set('density')}/>
      <SliderField label="Altura" value={grass.height} min={0.05} max={2.5} scale="log" format={centimeters} onChange={set('height')}/>
      <SliderField label="Variação alt." value={grass.heightVariation} min={0} max={1} format={percent} onChange={set('heightVariation')}/>
      <SliderField label="Largura" value={grass.width} min={0.005} max={0.2} scale="log" format={centimeters} onChange={set('width')}/>
      <SliderField label="Tufos" value={grass.clumping} min={0} max={1} format={percent} onChange={set('clumping')}/>
      <SliderField label="Curvatura" value={grass.bend} min={0} max={1} format={percent} onChange={set('bend')}/>
      <SliderField label="Inclin. máx." value={grass.maxSlope} min={0} max={90} step={1} format={degrees} onChange={set('maxSlope')}/>
      <SliderField label="Alcance" value={grass.viewDistance} min={10} max={400} scale="log" format={meters} onChange={set('viewDistance')}/>

      <SliderField label="Vento" value={grass.windStrength} min={0} max={2} format={percent} onChange={set('windStrength')}/>
      <SliderField label="Rajadas" value={grass.windSpeed} min={0} max={4} format={times} onChange={set('windSpeed')}/>
      <SliderField label="Direção" value={grass.windDirection} min={0} max={360} step={1} format={degrees} onChange={set('windDirection')}/>

      <SliderField label="Pisoteio" value={grass.trample} min={0} max={1} format={percent} onChange={set('trample')}/>
      <SliderField label="Recuperação" value={grass.recoverySeconds} min={0.5} max={30} scale="log" format={seconds} onChange={set('recoverySeconds')}/>
      <p className="px-2 pb-1 text-[10px] leading-relaxed text-pretty text-muted-foreground">
        {grass.trample > 0
            ? `O jogador e os corpos rígidos deitam a grama por onde passam. ${interactors === 0 ? 'Nada' : interactors === 1 ? '1 corpo' : `${interactors} corpos`} pisando a grama agora.`
            : 'A grama ignora o jogador e os corpos da cena.'}
      </p>

      <ColorField label="Cor da raiz" value={grass.baseColor} onChange={(baseColor) => updateGrassSettings(session, entity, { baseColor })}/>
      <ColorField label="Cor da ponta" value={grass.tipColor} onChange={(tipColor) => updateGrassSettings(session, entity, { tipColor })}/>
      <SliderField label="Variação cor" value={grass.colorVariation} min={0} max={1} format={percent} onChange={set('colorVariation')}/>
      <SliderField label="Cor do solo" value={grass.groundBlend} min={0} max={1} format={percent} onChange={set('groundBlend')}/>
      <SliderField label="Translucidez" value={grass.translucency} min={0} max={1} format={percent} onChange={set('translucency')}/>
      <ToggleField label="Visível" on={grass.enabled} onToggle={() => updateGrassSettings(session, entity, { enabled: !grass.enabled })}/>
    </CollapsibleSection>);
}
