'use client';
import { useEditorSession, useViewportStats } from '@/engine/editor/session/editor-session-context';
import { cn } from '@/lib/utils';
type Tone = 'normal' | 'full' | 'warn';
const BAR_CLASS: Record<Tone, string> = {
    normal: 'bg-primary/70',
    full: 'bg-primary',
    warn: 'bg-warning',
};
const TEXT_CLASS: Record<Tone, string> = {
    normal: 'text-foreground/80',
    full: 'text-foreground',
    warn: 'text-warning',
};
type MeterProps = {
    label: string;
    used: number;
    total: number;
    tone: Tone;
    note?: string;
    title: string;
};
function Meter({ label, used, total, tone, note, title }: MeterProps) {
    const share = total > 0 ? Math.min(100, (used / total) * 100) : 0;
    return (<div className="flex flex-col gap-1" title={title}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-2xs text-muted-foreground">{label}</span>
        <span className={cn('shrink-0 font-mono text-3xs tabular-nums', TEXT_CLASS[tone])}>
          {used} <span className="text-muted-foreground">/ {total}</span>
          {note && <span className={cn('ml-1.5', tone === 'warn' ? 'text-warning' : 'text-muted-foreground')}>· {note}</span>}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-xs bg-surface-sunken shadow-well" aria-hidden>
        <div className={cn('h-full transition-[width] duration-300', BAR_CLASS[tone])} style={{ width: `${share}%` }}/>
      </div>
    </div>);
}
export function LightBudget() {
    const session = useEditorSession();
    const stats = useViewportStats();
    const lightsTone: Tone = stats.localLightsCulled > 0 && stats.localLights >= stats.localLightBudget ? 'warn' : stats.localLights === stats.localLightBudget ? 'full' : 'normal';
    const shadowsTone: Tone = !session.shadowsEnabled ? 'normal' : stats.localShadowDeferred > 0 ? 'warn' : stats.localShadowFaces === stats.localShadowBudget ? 'full' : 'normal';
    const culledNote = stats.localLightsCulled > 0 ? `${stats.localLightsCulled} fora do frame` : undefined;
    const shadowNote = !session.shadowsEnabled ? 'desligadas' : stats.localShadowDeferred > 0 ? `${stats.localShadowDeferred} adiada${stats.localShadowDeferred === 1 ? '' : 's'}` : stats.localShadowRendered > 0 ? `${stats.localShadowRendered} redesenhada${stats.localShadowRendered === 1 ? '' : 's'}` : stats.localShadowFaces > 0 ? 'em cache' : undefined;
    return (<div className="flex shrink-0 flex-col gap-2 border-b border-border px-2 py-2">
      <Meter label="Luzes no frame" used={stats.localLights} total={stats.localLightBudget} tone={lightsTone} note={culledNote} title="Luzes locais aceitas neste frame contra o teto do perfil da GPU. As que ficam de fora estão fora da tela ou perderam por importância."/>
      <Meter label="Faces de sombra" used={stats.localShadowFaces} total={stats.localShadowBudget} tone={shadowsTone} note={shadowNote} title="Faces do atlas de sombras ocupadas (1 por cone, 5 ou 6 por cubo). Esgotado o orçamento, as luzes menos importantes seguem sem sombra, sem derrubar a taxa de quadros."/>
      {stats.localLightTiles > 0 && (<p className="font-mono text-3xs text-muted-foreground">
          {stats.localLightTilesLit} de {stats.localLightTiles} tiles de tela tocados por alguma luz
        </p>)}
    </div>);
}
