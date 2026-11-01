import { DatabaseZap } from 'lucide-react';
export function RegistryUnavailable({ message }: {
    message: string | null;
}) {
    return (<div role="alert" className="m-6 flex max-w-2xl flex-col gap-3 rounded-lg border border-destructive/50 bg-surface p-5 shadow-raised">
      <div className="flex items-center gap-2.5">
        <DatabaseZap className="size-4 shrink-0 text-destructive" aria-hidden/>
        <h2 className="text-sm font-medium text-foreground">Os jogos não podem ser guardados neste navegador</h2>
      </div>
      {message && <p className="rounded-sm border border-border bg-surface-sunken px-3 py-2 font-mono text-2xs leading-relaxed text-muted-foreground shadow-well">{message}</p>}
      <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
        Janelas anônimas e alguns bloqueadores de conteúdo desativam o armazenamento local que a engine usa. Abra a engine numa janela normal ou em outro navegador. Arquivos{' '}
        <code className="font-mono">.helix</code> exportados antes continuam válidos e podem ser importados lá.
      </p>
    </div>);
}
