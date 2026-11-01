'use client';
import { SCRIPT_RUN_CONTEXT_DESCRIPTION, type ScriptRunContext } from '@/engine/scripting/script-document';
import { SCRIPT_CONTEXT_SHORT, SCRIPT_CONTEXT_TONE } from '@/engine/scripting/script-sides';
import { cn } from '@/lib/utils';
import { ClientIcon, ServerIcon, SharedIcon, type CodeIcon } from '../icons/code-icons';
export const CONTEXT_ICON: Record<ScriptRunContext, CodeIcon> = { server: ServerIcon, client: ClientIcon, shared: SharedIcon };
export function ContextIcon({ context, className }: {
    context: ScriptRunContext;
    className?: string;
}) {
    const Icon = CONTEXT_ICON[context];
    return <Icon aria-hidden className={cn(SCRIPT_CONTEXT_TONE[context], className)}/>;
}
export function ContextChip({ context, quiet = false, className }: {
    context: ScriptRunContext;
    quiet?: boolean;
    className?: string;
}) {
    if (quiet && context === 'shared')
        return null;
    return (<span title={SCRIPT_RUN_CONTEXT_DESCRIPTION[context]} className={cn('inline-flex shrink-0 items-center gap-1 rounded-xs border border-border px-1 font-mono text-3xs leading-4 whitespace-nowrap', SCRIPT_CONTEXT_TONE[context], className)}>
      <ContextIcon context={context} className="size-2.5"/>
      {SCRIPT_CONTEXT_SHORT[context]}
    </span>);
}
export function ContextDot({ context, className }: {
    context: ScriptRunContext;
    className?: string;
}) {
    if (context === 'shared')
        return null;
    return <span aria-label={SCRIPT_CONTEXT_SHORT[context]} title={SCRIPT_RUN_CONTEXT_DESCRIPTION[context]} className={cn('size-1.5 shrink-0 rounded-full bg-current', SCRIPT_CONTEXT_TONE[context], className)}/>;
}
