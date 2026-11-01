'use client';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CARD_CLASS } from '@/engine/ui/surface-styles';
import { formatBytes } from '@/engine/project/storage-health';
import { useHub } from '../hub-context';
export function StorageStatus() {
    const { storage, protectStorage, registry } = useHub();
    if (!storage || registry.status === 'unavailable')
        return null;
    const { persisted, usage, quota } = storage;
    const ratio = usage !== null && quota ? Math.min(1, usage / quota) : null;
    const Icon = persisted ? ShieldCheck : ShieldAlert;
    return (<section aria-labelledby="storage-title" className={cn('flex flex-col gap-2.5 p-3', CARD_CLASS)}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="storage-title" className="text-3xs font-semibold tracking-wider text-foreground/90 uppercase">
          Armazenamento local
        </h2>
        <Icon className={cn('size-3.5', persisted ? 'text-success' : 'text-warning')} aria-hidden/>
      </div>
      <p className="text-3xs leading-relaxed text-muted-foreground text-pretty">
        {persisted
            ? 'Protegido: o navegador não apaga seus jogos para liberar espaço. Mesmo assim, exporte backups de tempos em tempos.'
            : 'Não protegido: se faltar espaço, o navegador pode apagar seus jogos. Exporte backups e ative a proteção.'}
      </p>
      {ratio !== null && usage !== null && quota !== null && (<div className="flex flex-col gap-1">
          <div className="h-1 w-full overflow-hidden rounded-xs bg-surface-sunken shadow-well" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)} aria-label="Espaço usado">
            <div className="h-full bg-primary" style={{ width: `${Math.max(1, ratio * 100)}%` }}/>
          </div>
          <span className="font-mono text-3xs text-muted-foreground">
            {formatBytes(usage)} de {formatBytes(quota)}
          </span>
        </div>)}
      {!persisted && (<Button size="xs" variant="outline" className="self-start" onClick={() => void protectStorage()}>
          Proteger armazenamento
        </Button>)}
    </section>);
}
