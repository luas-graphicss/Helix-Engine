'use client';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { HelixLogo } from '@/engine/boot/helix-logo';
import { ENGINE_NAME, ENGINE_VERSION_LABEL } from '@/engine/core/engine-info';
import { PROJECT_FORMAT_VERSION } from '@/engine/project/project-record';
import { WELL_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { useViewportStats } from '../session/editor-session-context';
interface AboutDialogProps {
    open: boolean;
    onOpenChange(open: boolean): void;
}
const TIER_LABEL = { high: 'alta', mid: 'média', low: 'baixa' } as const;
function SpecRow({ label, value }: {
    label: string;
    value: string;
}) {
    return (<div className="flex items-baseline justify-between gap-4 px-3 py-1.5">
      <dt className="shrink-0 text-2xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-mono text-2xs text-foreground" title={value}>
        {value}
      </dd>
    </div>);
}
export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
    const stats = useViewportStats();
    const gpu = stats.gpuName || 'Não informada pelo navegador';
    const tier = stats.softwareRenderer ? 'renderização por software' : `classe ${TIER_LABEL[stats.gpuTier] ?? stats.gpuTier}`;
    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-sm border-border-strong p-0 sm:max-w-sm">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex shrink-0 flex-col items-center gap-2.5 bg-[radial-gradient(ellipse_at_top,var(--surface-raised),var(--surface)_70%)] px-6 pt-6 pb-5 text-center">
            <HelixLogo size={56}/>
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-base font-semibold tracking-[0.3em] text-foreground uppercase">Helix</DialogTitle>
              <span className="font-mono text-3xs tracking-[0.3em] text-muted-foreground uppercase">Engine</span>
            </div>
            <span className="rounded-sm border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-2xs text-primary">{ENGINE_VERSION_LABEL}</span>
            <DialogDescription className="max-w-64 text-pretty">
              {ENGINE_NAME}: uma engine 3D para a web. Os jogos vivem neste navegador e saem dele num arquivo <span className="font-mono">.helix</span>.
            </DialogDescription>
          </div>
          <dl className={cn('mx-4 mb-4 shrink-0 divide-y divide-border rounded-sm', WELL_CLASS)}>
            <SpecRow label="Versão" value={ENGINE_VERSION_LABEL}/>
            <SpecRow label="Formato de projeto" value={`v${PROJECT_FORMAT_VERSION}`}/>
            <SpecRow label="Gráficos" value="WebGL 2"/>
            <SpecRow label="Placa de vídeo" value={gpu}/>
            <SpecRow label="Perfil detectado" value={tier}/>
            <SpecRow label="Armazenamento" value="IndexedDB, neste navegador"/>
          </dl>
        </div>
      </DialogContent>
    </Dialog>);
}
