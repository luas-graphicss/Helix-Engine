'use client';
import { Code2, RefreshCw, Unplug } from 'lucide-react';
import { openScriptAssetInEditor } from '@/engine/editor/operations/script-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { IconButton } from '@/engine/ui/icon-button';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { ToggleSwitch } from '@/engine/ui/toggle-field';
import { cn } from '@/lib/utils';
import type { ExtensionScriptState, ExtensionScriptStatus } from '../../host/extension-host';
import { removeExtensionScript, setExtensionEnabled } from '../../host/extension-scripts';
const STATE_LABEL: Record<ExtensionScriptState, string> = {
    blocked: 'bloqueada',
    disabled: 'desligada',
    missing: 'script ausente',
    loading: 'carregando',
    active: 'ativa',
    failed: 'com erro',
};
const STATE_DOT_CLASS: Record<ExtensionScriptState, string> = {
    blocked: 'bg-warning',
    disabled: 'bg-muted-foreground/40',
    missing: 'bg-destructive',
    loading: 'bg-warning',
    active: 'bg-success',
    failed: 'bg-destructive',
};
export function ExtensionScriptRow({ script }: {
    script: ExtensionScriptStatus;
}) {
    const session = useEditorSession();
    const { host } = session.extensions;
    const asset = session.library.get(script.assetId);
    const contributions = session.extensions.contributionCount(script.assetId);
    const summary = contributions > 0 ? `${STATE_LABEL[script.state]} · ${contributions}` : STATE_LABEL[script.state];
    return (<div className={cn('group flex h-control items-center gap-1.5 px-2 text-2xs text-foreground/90 hover:bg-highlight', !script.enabled && 'text-muted-foreground')}>
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', STATE_DOT_CLASS[script.state])}/>
      <button type="button" disabled={!asset} title={`${script.name} · ${STATE_LABEL[script.state]}${contributions > 0 ? ` · ${contributions} ${contributions === 1 ? 'contribuição' : 'contribuições'} ao editor` : ''}`} onClick={() => asset && void openScriptAssetInEditor(session, asset, { pin: true })} className={cn('min-w-0 flex-1 truncate rounded-xs text-left', FOCUS_RING_CLASS)}>
        {script.name}
      </button>
      <span className="shrink-0 font-mono text-3xs text-muted-foreground/70 group-focus-within:hidden group-hover:hidden">{summary}</span>
      <span className="hidden shrink-0 items-center group-focus-within:flex group-hover:flex">
        <IconButton label="Abrir no editor de código" size="xs" disabled={!asset} onClick={() => asset && void openScriptAssetInEditor(session, asset, { pin: true })}>
          <Code2 />
        </IconButton>
        <IconButton label="Recarregar" size="xs" disabled={!script.enabled || !asset} onClick={() => host.reload(script.assetId)}>
          <RefreshCw />
        </IconButton>
        <IconButton label="Deixar de usar como extensão" size="xs" className="hover:text-destructive" onClick={() => removeExtensionScript(session, script.assetId)}>
          <Unplug />
        </IconButton>
      </span>
      <ToggleSwitch label={`${script.enabled ? 'Desligar' : 'Ligar'} ${script.name}`} on={script.enabled} onToggle={() => setExtensionEnabled(session, script.assetId, !script.enabled)}/>
    </div>);
}
