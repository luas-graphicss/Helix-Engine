'use client';
import { CircleAlert, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GuiHelpLevel, GuiHelpNode, GuiLabelNode, GuiProgressNode } from '../../gui/gui-node';
const HELP_ICON: Record<GuiHelpLevel, LucideIcon> = { info: Info, warn: TriangleAlert, error: CircleAlert };
const HELP_ICON_CLASS: Record<GuiHelpLevel, string> = { info: 'text-muted-foreground', warn: 'text-warning', error: 'text-destructive' };
export function GuiLabel({ node }: {
    node: GuiLabelNode;
}) {
    return <p className={cn('px-2 py-0.5 text-2xs leading-relaxed text-pretty', node.tone === 'muted' && 'text-muted-foreground')}>{node.text}</p>;
}
export function GuiHeading({ text }: {
    text: string;
}) {
    return <h3 className="px-2 pt-2 pb-1 text-3xs font-medium tracking-wider text-muted-foreground uppercase">{text}</h3>;
}
export function GuiHelp({ node }: {
    node: GuiHelpNode;
}) {
    const Icon = HELP_ICON[node.level];
    return (<p role="note" className="mx-2 my-1 flex items-start gap-1.5 rounded-sm bg-surface-sunken px-2 py-1.5 text-2xs leading-relaxed text-pretty">
      <Icon className={cn('mt-0.5 size-3.5 shrink-0', HELP_ICON_CLASS[node.level])} aria-hidden/>
      <span>{node.text}</span>
    </p>);
}
export function GuiProgress({ node }: {
    node: GuiProgressNode;
}) {
    const percent = Math.round(node.value * 100);
    return (<div className="flex flex-col gap-1 px-2 py-1">
      {node.label && <span className="text-2xs text-muted-foreground">{node.label}</span>}
      <div role="progressbar" aria-label={node.label || 'Progresso'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-1 overflow-hidden rounded-xs bg-surface-sunken">
        <div className="h-full bg-primary transition-[width] duration-150 ease-out" style={{ width: `${percent}%` }}/>
      </div>
    </div>);
}
