'use client';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleSwitch } from '@/engine/ui/toggle-field';
import { ColorField } from '@/engine/ui/color-field';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { setWaterEnabled, setWaterFoamEnabled, updateWaterFoam, updateWaterSettings } from '@/engine/editor/operations/terrain-operations';
import type { WaterSettings } from '@/engine/terrain/water/water-settings';
import type { WaterFoamSettings } from '@/engine/terrain/water/water-foam-settings';
import type { TerrainTarget } from '../terrain-panel';
import { degrees, meters, percent, seconds, times } from './formatters';
const LEVEL_MARGIN = 5;
function SubHeading({ children }: {
    children: string;
}) {
    return <span className="px-2 pt-2 pb-0.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{children}</span>;
}
function Hint({ children }: {
    children: string;
}) {
    return <p className="px-2 py-1 text-[10px] leading-relaxed text-pretty text-muted-foreground">{children}</p>;
}
function FoamSection({ target }: {
    target: TerrainTarget;
}) {
    const session = useEditorState();
    const { entity, terrain } = target;
    const { foam } = terrain.water;
    const set = <K extends keyof WaterFoamSettings>(key: K) => (value: WaterFoamSettings[K]) => updateWaterFoam(session, entity, { [key]: value });
    return (<CollapsibleSection title="Espuma" trailing={<ToggleSwitch label="Espuma ativa" on={foam.enabled} onToggle={() => setWaterFoamEnabled(session, entity, !foam.enabled)}/>}>
      {!foam.enabled && <Hint>Desligada. A superfície fica limpa: sem linha de contato na margem, sem cristas brancas e sem bolhas submersas.</Hint>}

      <SubHeading>Margem</SubHeading>
      <SliderField label="Largura" value={foam.shoreWidth} min={0} max={10} format={meters} disabled={!foam.enabled} onChange={set('shoreWidth')}/>
      <SliderField label="Cobertura" value={foam.shoreAmount} min={0} max={1} format={percent} disabled={!foam.enabled} onChange={set('shoreAmount')}/>

      <SubHeading>Cristas</SubHeading>
      <SliderField label="Cobertura" value={foam.crestAmount} min={0} max={1} format={percent} disabled={!foam.enabled} onChange={set('crestAmount')}/>
      <SliderField label="Limiar" value={foam.crestBias} min={0} max={1} format={percent} disabled={!foam.enabled} onChange={set('crestBias')}/>
      <SliderField label="Persistência" value={foam.persistence} min={0} max={6} step={0.1} format={seconds} disabled={!foam.enabled} onChange={set('persistence')}/>
      {foam.enabled && foam.crestAmount > 0 && terrain.water.waveHeight < 0.15 && (<Hint>Cristas só espumam em ondas íngremes: suba a altura das ondas ou reduza o comprimento para vê-las rebentar.</Hint>)}

      <SubHeading>Padrão</SubHeading>
      <SliderField label="Escala" value={foam.scale} min={0.25} max={6} scale="log" format={meters} disabled={!foam.enabled} onChange={set('scale')}/>
      <SliderField label="Nitidez" value={foam.sharpness} min={0} max={1} format={percent} disabled={!foam.enabled} onChange={set('sharpness')}/>
      <SliderField label="Bolhas" value={foam.bubbles} min={0} max={1} format={percent} disabled={!foam.enabled} onChange={set('bubbles')}/>
      <SliderField label="Brilho" value={foam.brightness} min={0.3} max={1} format={percent} disabled={!foam.enabled} onChange={set('brightness')}/>
    </CollapsibleSection>);
}
export function WaterSection({ target }: {
    target: TerrainTarget;
}) {
    const session = useEditorState();
    const { entity, terrain } = target;
    const { water } = terrain;
    const { minHeight, maxHeight } = terrain.tiles;
    const set = <K extends Exclude<keyof WaterSettings, 'foam'>>(key: K) => (value: WaterSettings[K]) => updateWaterSettings(session, entity, { [key]: value });
    return (<>
      <CollapsibleSection title="Água" trailing={<ToggleSwitch label="Água ativa" on={water.enabled} onToggle={() => setWaterEnabled(session, entity, !water.enabled)}/>}>
        {!water.enabled && <Hint>Desligada. Ao ligar, a superfície entra a um terço da altura do relevo e enche tudo o que estiver abaixo dela.</Hint>}
        <SliderField label="Nível" value={water.level} min={Math.floor(minHeight - LEVEL_MARGIN)} max={Math.ceil(maxHeight + LEVEL_MARGIN)} step={0.05} format={meters} onChange={set('level')}/>
        <ColorField label="Cor rasa" value={water.shallowColor} onChange={(shallowColor) => updateWaterSettings(session, entity, { shallowColor })}/>
        <ColorField label="Cor funda" value={water.deepColor} onChange={(deepColor) => updateWaterSettings(session, entity, { deepColor })}/>
        <SliderField label="Claridade" value={water.clarity} min={0.2} max={60} scale="log" format={meters} onChange={set('clarity')}/>

        <SubHeading>Ondas</SubHeading>
        <SliderField label="Altura" value={water.waveHeight} min={0} max={3} format={meters} onChange={set('waveHeight')}/>
        <SliderField label="Comprimento" value={water.waveLength} min={0.5} max={120} scale="log" format={meters} onChange={set('waveLength')}/>
        <SliderField label="Velocidade" value={water.waveSpeed} min={0} max={4} format={times} onChange={set('waveSpeed')}/>
        <SliderField label="Direção" value={water.waveDirection} min={0} max={360} step={1} format={degrees} onChange={set('waveDirection')}/>
        <SliderField label="Agitação" value={water.choppiness} min={0} max={1} format={percent} onChange={set('choppiness')}/>
        <SliderField label="Vento" value={water.ripples} min={0} max={2} format={percent} onChange={set('ripples')}/>

        <SubHeading>Superfície</SubHeading>
        <SliderField label="Reflexo" value={water.reflectivity} min={0} max={1} format={percent} onChange={set('reflectivity')}/>
        <SliderField label="Rugosidade" value={water.roughness} min={0.02} max={0.6} format={percent} onChange={set('roughness')}/>
        <SliderField label="Refração" value={water.refraction} min={0} max={1} format={percent} onChange={set('refraction')}/>
        <SliderField label="Translucidez" value={water.subsurface} min={0} max={1} format={percent} onChange={set('subsurface')}/>
        <SliderField label="Cáusticas" value={water.caustics} min={0} max={1} format={percent} onChange={set('caustics')}/>
      </CollapsibleSection>

      {water.enabled && <FoamSection target={target}/>}
    </>);
}
