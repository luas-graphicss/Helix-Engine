'use client';
import { ExternalLink } from 'lucide-react';
import type { AssetSource, RemoteAssetKind } from '@/engine/editor/mcp/asset-sources/catalog/asset-source';
import { readinessOf, type SourcePermission } from '@/engine/editor/mcp/asset-sources/permissions/source-permissions';
import { PropertyRow } from '@/engine/ui/property-row';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { ToggleSwitch } from '@/engine/ui/toggle-field';
import { cn } from '@/lib/utils';
import { CommittedField } from '../committed-field';
const KIND_LABEL: Record<RemoteAssetKind, string> = { model: 'modelos', texture: 'texturas', hdri: 'HDRIs', audio: 'áudio', image: 'imagens' };
type AssetSourceRowProps = {
    source: AssetSource;
    permission: SourcePermission;
    onAllowedChange: (allowed: boolean) => void;
    onApiKeyCommit: (apiKey: string) => void;
};
export function AssetSourceRow({ source, permission, onAllowedChange, onApiKeyCommit }: AssetSourceRowProps) {
    const { credential, label } = source;
    const kinds = source.kinds.map((kind) => KIND_LABEL[kind]).join(', ');
    const missingKey = readinessOf(source, permission) === 'missingKey';
    return (<li className="flex flex-col gap-px">
      <div className="flex min-h-row items-center gap-2 px-2">
        <span className="shrink-0 text-2xs text-foreground">{label}</span>
        <span className="min-w-0 flex-1 truncate text-3xs text-muted-foreground">{credential ? `${kinds} · exige chave` : kinds}</span>
        <ToggleSwitch label={`Permitir que os agentes usem ${label}`} on={permission.allowed} onToggle={() => onAllowedChange(!permission.allowed)}/>
      </div>
      {credential && permission.allowed && (<PropertyRow label={credential.label} hint={`Fica guardada neste navegador e só é enviada a ${label}.`}>
          <CommittedField aria-label={`${credential.label} de ${label}`} type="password" value={permission.apiKey} placeholder="Cole a chave" spellCheck={false} autoComplete="off" onCommit={onApiKeyCommit}/>
          <a href={credential.helpUrl} target="_blank" rel="noreferrer noopener" aria-label={`Obter a chave em ${label}`} title={`Obter a chave em ${label}`} className={cn('flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-100 hover:text-foreground', FOCUS_RING_CLASS)}>
            <ExternalLink aria-hidden className="size-3.5"/>
          </a>
        </PropertyRow>)}
      {missingKey && (<p role="status" className="px-2 pb-0.5 text-3xs text-warning">
          Sem a chave, os agentes não acessam {label}.
        </p>)}
    </li>);
}
