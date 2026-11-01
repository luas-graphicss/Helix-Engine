'use client';
import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
export function CopyCodeButton({ code }: {
    code: string;
}) {
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (!copied)
            return;
        const timer = window.setTimeout(() => setCopied(false), 2000);
        return () => window.clearTimeout(timer);
    }, [copied]);
    return (<button type="button" onClick={() => {
            void navigator.clipboard.writeText(code).then(() => setCopied(true));
        }} aria-label={copied ? 'Código copiado' : 'Copiar código'} className="flex h-7 items-center gap-1.5 rounded-sm px-2 text-xs text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground focus-visible:outline-1 focus-visible:outline-primary">
      {copied ? <Check className="size-3.5 text-success" aria-hidden/> : <Copy className="size-3.5" aria-hidden/>}
      <span>{copied ? 'Copiado' : 'Copiar'}</span>
    </button>);
}
