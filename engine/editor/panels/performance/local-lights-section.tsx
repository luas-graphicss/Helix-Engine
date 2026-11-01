'use client';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { ToggleField } from '@/engine/ui/toggle-field';
import { useEditorSession, useViewportStats } from '@/engine/editor/session/editor-session-context';
import { cn } from '@/lib/utils';
const integer = (value: number) => value.toLocaleString('pt-BR');
function Value({ children, warn = false }: {
    children: React.ReactNode;
    warn?: boolean;
}) {
    return <span className={cn('font-mono text-2xs tabular-nums', warn ? 'text-warning' : 'text-foreground/80')}>{children}</span>;
}
export function LocalLightsSection() {
    const session = useEditorSession();
    const stats = useViewportStats();
    const cached = Math.max(stats.localShadowFaces - stats.localShadowRendered, 0);
    const tileShare = stats.localLightTiles > 0 ? Math.round((stats.localLightTilesLit / stats.localLightTiles) * 100) : 0;
    return (<CollapsibleSection title="Luzes locais">
      <ToggleField label="Sombras locais" on={session.shadowsEnabled} onToggle={() => session.toggleShadows()}/>
      <PropertyRow label="No frame">
        <Value warn={stats.localLightsCulled > 0 && stats.localLights >= stats.localLightBudget}>
          {integer(stats.localLights)} <span className="text-muted-foreground">/ {integer(stats.localLightBudget)} · {integer(stats.localLightsCulled)} fora</span>
        </Value>
      </PropertyRow>
      <PropertyRow label="Tiles tocados">
        <Value>
          {integer(stats.localLightTilesLit)} <span className="text-muted-foreground">/ {integer(stats.localLightTiles)} · {tileShare}% da tela</span>
        </Value>
      </PropertyRow>
      <PropertyRow label="Faces de sombra">
        <Value warn={stats.localShadowDeferred > 0}>
          {integer(stats.localShadowFaces)} <span className="text-muted-foreground">/ {integer(stats.localShadowBudget)}</span>
        </Value>
      </PropertyRow>
        <PropertyRow label="Redesenhadas">
          <Value>
            {integer(stats.localShadowRendered)} <span className="text-muted-foreground">· {integer(cached)} em cache</span>
            {stats.localShadowPostponed > 0 ? <span className="text-muted-foreground"> · {integer(stats.localShadowPostponed)} na fila</span> : null}
          </Value>
        </PropertyRow>
      <PropertyRow label="Adiadas">
        <Value warn={stats.localShadowDeferred > 0}>{stats.localShadowDeferred > 0 ? `${integer(stats.localShadowDeferred)} luz(es) sem face` : 'Nenhuma'}</Value>
      </PropertyRow>
      <PropertyRow label="Draws de sombra">
        <Value>{integer(stats.localShadowDrawCalls)}</Value>
      </PropertyRow>
      <p className="px-2 pb-1 text-3xs leading-relaxed text-pretty text-muted-foreground">
        O custo por pixel depende dos tiles tocados, não do número de luzes. Sombras só redesenham quando a luz ou algo ao alcance muda; o resto sai do cache.
      </p>
    </CollapsibleSection>);
}
