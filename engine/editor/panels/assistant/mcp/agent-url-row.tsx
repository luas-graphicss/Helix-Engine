'use client';
import { useEffect, useState } from 'react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { copyTextToClipboard } from '@/engine/ui/clipboard';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
const COPIED_FEEDBACK_MS = 1600;
type AgentUrlRowProps = {
    url: string | null;
    onRotate: () => void;
};
export function AgentUrlRow({ url, onRotate }: AgentUrlRowProps) {
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (!copied)
            return;
        const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
        return () => clearTimeout(timer);
    }, [copied]);
    const copy = async () => {
        if (url && (await copyTextToClipboard(url)))
            setCopied(true);
    };
    return (<PropertyRow label="URL do agente" hint="Envie esta URL ao agente de IA. Quem tem a URL controla o editor enquanto a conexão estiver ativa.">
      <FieldInput aria-label="URL do agente" readOnly value={url ?? ''} placeholder="Informe a URL do Worker" spellCheck={false} onFocus={(event) => event.currentTarget.select()}/>
      <IconButton label={copied ? 'URL copiada' : 'Copiar URL do agente'} size="sm" disabled={!url} onClick={() => void copy()}>
        {copied ? <Check /> : <Copy />}
      </IconButton>
      <IconButton label="Gerar nova URL e invalidar a anterior" size="sm" onClick={onRotate}>
        <RefreshCw />
      </IconButton>
      <span role="status" className="sr-only">
        {copied ? 'URL do agente copiada' : ''}
      </span>
    </PropertyRow>);
}
