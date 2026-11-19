'use client';
import { useSessionTopic, useViewportStats } from '@/engine/editor/session/editor-session-context';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField } from '@/engine/ui/toggle-field';
const BYTES_PER_MEGABYTE = 1024 * 1024;
const MIN_BUDGET_MB = 64;
const MAX_BUDGET_MB = 4096;
const BUDGET_STEP_MB = 64;
const integer = (value: number) => value.toLocaleString('pt-BR');
const megabytes = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: value < 10 ? 1 : 0 })} MB`;
function Value({ children }: {
    children: React.ReactNode;
}) {
    return <span className="font-mono text-2xs text-foreground/80 tabular-nums">{children}</span>;
}
export function TextureMemorySection() {
    const session = useSessionTopic('view');
    useViewportStats();
    const settings = session.render.optimization;
    const stats = session.optimizationStats;
    const compressionAvailable = stats.textureCompressionAvailable;
    const toggleCompression = compressionAvailable ? () => session.updateOptimization({ textureCompression: !settings.textureCompression }) : undefined;
    return (<CollapsibleSection title="Memória de texturas">
      <ToggleField label="Compactar texturas" hint="Mapas de cor e de máscara dos materiais em blocos BC1 ou BC3, de 4 a 8 bits por pixel; mapas de normais e imagens de interface ficam como estão" on={compressionAvailable && settings.textureCompression} onToggle={toggleCompression}/>
      <ToggleField label="Streaming de mipmaps" hint="Cada textura fica na GPU só até o nível de mip que o tamanho em tela pede; os níveis maiores sobem quando a câmera chega perto" on={settings.mipStreaming} onToggle={() => session.updateOptimization({ mipStreaming: !settings.mipStreaming })}/>
      <SliderField label="Orçamento" value={settings.textureBudgetMb} min={MIN_BUDGET_MB} max={MAX_BUDGET_MB} step={BUDGET_STEP_MB} scale="log" disabled={!settings.mipStreaming} format={megabytes} onChange={(value) => session.updateOptimization({ textureBudgetMb: value })}/>
      <PropertyRow label="Texturas">
        <Value>
          {megabytes(stats.textureBytes / BYTES_PER_MEGABYTE)} <span className="text-muted-foreground">· {integer(stats.texturesResident)} na GPU</span>
        </Value>
      </PropertyRow>
      <PropertyRow label="Compactadas" hint="Texturas que estão na GPU em blocos BC1 ou BC3">
        <Value>
          {compressionAvailable ? (<>
              {integer(stats.texturesCompressed)} <span className="text-muted-foreground">· {integer(stats.texturesCompressing)} na fila</span>
            </>) : ('Indisponível nesta placa')}
        </Value>
      </PropertyRow>
      <PropertyRow label="Reduzidas" hint="Texturas que estão na GPU abaixo da resolução cheia, pela distância ou pelo orçamento">
        <Value>{integer(stats.texturesReduced)}</Value>
      </PropertyRow>
    </CollapsibleSection>);
}
