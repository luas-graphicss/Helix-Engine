'use client';
import { blockDefinition } from '@/engine/vfx-graph/blocks/block-catalog';
import { clampNumberParam, resolveSelectParam } from '@/engine/vfx-graph/blocks/param-values';
import { CONTEXT_DEFINITIONS } from '@/engine/vfx-graph/contexts/context-catalog';
import { BLOCK_ROW_HEIGHT, CONTEXT_FOOTER_HEIGHT, CONTEXT_HEADER_HEIGHT, CONTEXT_WIDTH } from '@/engine/vfx-graph/document/context-layout';
import type { EffectBlock, EffectContext } from '@/engine/vfx-graph/document/effect-document';
import { CheckBox } from '@/engine/ui/check-box';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { STAGE_ACCENT_CLASS } from '../stage-appearance';
import { useVfxGraph } from '../use-vfx-graph';
import { AddBlockMenu } from './add-block-menu';
export type ContextProblem = 'error' | 'warning';
type ContextCardProps = {
    context: EffectContext;
    selected: boolean;
    focusedBlockId: string | null;
    problem: ContextProblem | null;
    failedBlocks: ReadonlySet<string>;
};
interface SettingSummary {
    readonly text: string;
    readonly hint: string;
}
const COUNT_FORMAT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const PROBLEM_FRAME_CLASS: Record<ContextProblem, string> = { error: 'ring-destructive', warning: 'ring-warning' };
function settingSummary(context: EffectContext): SettingSummary | null {
    const setting = CONTEXT_DEFINITIONS[context.kind].settings.at(0);
    const value = setting ? context.values[setting.id] : undefined;
    if (setting?.kind === 'select') {
        const choice = resolveSelectParam(setting, value);
        const text = setting.options.find((option) => option.value === choice)?.label ?? choice;
        return { text, hint: `${setting.label}: ${text}` };
    }
    if (setting?.kind === 'number') {
        const text = COUNT_FORMAT.format(clampNumberParam(setting, value));
        return { text, hint: `${setting.label}: ${text}` };
    }
    return null;
}
function blockTone(block: EffectBlock, failed: boolean): string {
    if (failed)
        return 'text-destructive';
    return block.enabled ? 'text-foreground' : 'text-muted-foreground line-through';
}
function FlowPort({ side, accent }: {
    side: 'in' | 'out';
    accent: string;
}) {
    return (<span data-flow-port={side} className={cn('absolute left-1/2 flex size-4 -translate-x-1/2 cursor-crosshair items-center justify-center', side === 'in' ? '-top-2' : '-bottom-2')}>
      <span className={cn('size-2.5 rounded-full ring-1 ring-surface-sunken', accent)}/>
    </span>);
}
function BlockRow({ contextId, block, focused, failed }: {
    contextId: string;
    block: EffectBlock;
    focused: boolean;
    failed: boolean;
}) {
    const editor = useVfxGraph();
    const definition = blockDefinition(block.type);
    const label = definition?.label ?? 'Bloco desconhecido';
    return (<li className={cn('flex items-center gap-1.5 pl-2', focused && 'bg-primary/15')} style={{ height: BLOCK_ROW_HEIGHT }}>
      <CheckBox checked={block.enabled} label={`${label}: ligado`} onChange={(enabled) => editor.setBlockEnabled(contextId, block.id, enabled)}/>
      <button type="button" aria-pressed={focused} title={definition?.description} onClick={() => editor.selectBlock(contextId, block.id)} className={cn('h-full min-w-0 flex-1 truncate pr-2 text-left text-2xs transition-colors duration-100 hover:bg-highlight', FOCUS_RING_CLASS, blockTone(block, failed || !definition))}>
        {label}
      </button>
    </li>);
}
export function ContextCard({ context, selected, focusedBlockId, problem, failedBlocks }: ContextCardProps) {
    const editor = useVfxGraph();
    const definition = CONTEXT_DEFINITIONS[context.kind];
    const accent = STAGE_ACCENT_CLASS[context.kind];
    const summary = settingSummary(context);
    const frame = selected ? 'ring-primary' : problem ? PROBLEM_FRAME_CLASS[problem] : 'ring-border';
    return (<div data-context-id={context.id} role="group" tabIndex={0} aria-label={`Contexto de ${definition.label}${selected ? ', selecionado' : ''}`} className={cn('absolute rounded-sm bg-surface-raised shadow-raised ring-1 outline-none focus-visible:ring-2', frame)} style={{ left: context.x, top: context.y, width: CONTEXT_WIDTH }} onKeyDown={(event) => {
            if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' '))
                return;
            event.preventDefault();
            editor.selectContext(context.id, event.shiftKey);
        }}>
      {context.kind !== 'spawn' && <FlowPort side="in" accent={accent}/>}
      <div className="flex cursor-grab items-center gap-1.5 rounded-t-sm border-b border-border bg-surface px-2 active:cursor-grabbing" style={{ height: CONTEXT_HEADER_HEIGHT }} title={definition.description}>
        <span aria-hidden className={cn('size-2 shrink-0 rounded-full', accent)}/>
        <span className="truncate text-2xs font-medium text-foreground">{definition.label}</span>
        {summary && <span className="ml-auto shrink-0 pl-2 font-mono text-3xs text-muted-foreground" title={summary.hint}>{summary.text}</span>}
      </div>
      <ul>
        {context.blocks.map((block) => <BlockRow key={block.id} contextId={context.id} block={block} focused={block.id === focusedBlockId} failed={failedBlocks.has(block.id)}/>)}
      </ul>
      <div className={cn(context.blocks.length > 0 && 'border-t border-border')} style={{ height: CONTEXT_FOOTER_HEIGHT }}>
        <AddBlockMenu stage={context.kind} onAdd={(type) => editor.addBlock(context.id, type)}/>
      </div>
      {context.kind !== 'output' && <FlowPort side="out" accent={accent}/>}
    </div>);
}
