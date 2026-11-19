'use client';
import { linearRgbToCss } from '@/engine/core/color/srgb';
import * as vec3 from '@/engine/core/math/vec3';
import { formatNumber, ScalarField } from '@/engine/editor/panels/inspector/number-fields';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { GraphNode, GraphValue } from '@/engine/shader-graph/document/graph-document';
import { numberOf, numbersOf, textOf } from '@/engine/shader-graph/document/graph-values';
import type { InputSocket, NodeDefinition, NodeParam, OutputSocket } from '@/engine/shader-graph/nodes/node-definition';
import type { SocketKind } from '@/engine/shader-graph/nodes/socket-types';
import { cn } from '@/lib/utils';
import { CATEGORY_ACCENT_CLASS, SOCKET_FILL_CLASS } from '../node-appearance';
import { NODE_BODY_PADDING, NODE_HEADER_HEIGHT, NODE_ROW_HEIGHT, NODE_SUMMARY_HEIGHT, NODE_WIDTH } from './canvas-geometry';
type GraphNodeCardProps = {
    node: GraphNode;
    definition: NodeDefinition;
    selected: boolean;
    failed: boolean;
    linkedInputs: ReadonlySet<string>;
    onSelect: (additive: boolean) => void;
    onValueChange: (key: string, value: GraphValue) => void;
};
function colorCss(components: readonly number[]): string {
    return linearRgbToCss(vec3.create(components[0] ?? 0, components[1] ?? 0, components[2] ?? 0));
}
function SocketHandle({ side, socketId, kind }: {
    side: 'in' | 'out';
    socketId: string;
    kind: SocketKind;
}) {
    return (<span data-socket-side={side} data-socket-id={socketId} className={cn('absolute top-1/2 flex size-4 -translate-y-1/2 cursor-crosshair items-center justify-center', side === 'in' ? '-left-2' : '-right-2')}>
      <span className={cn('size-2.5 rounded-full ring-1 ring-surface-sunken', SOCKET_FILL_CLASS[kind])}/>
    </span>);
}
function OutputRow({ socket }: {
    socket: OutputSocket;
}) {
    return (<div className="relative flex items-center justify-end px-3" style={{ height: NODE_ROW_HEIGHT }}>
      <span className="truncate text-2xs text-muted-foreground">{socket.label}</span>
      <SocketHandle side="out" socketId={socket.id} kind={socket.type}/>
    </div>);
}
function InlineValue({ socket, value, onChange }: {
    socket: InputSocket;
    value: GraphValue | undefined;
    onChange: (value: GraphValue) => void;
}) {
    if (socket.connectOnly)
        return null;
    if (socket.builtin)
        return <span className="text-3xs text-muted-foreground/70">auto</span>;
    const components = numbersOf(value, socket.fallback ?? [0]);
    if (socket.type === 'float' || socket.type === 'auto') {
        return (<div className="flex w-16">
          <ScalarField label={socket.label} value={components[0] ?? 0} onCommit={(next) => {
                if (Number.isFinite(next))
                    onChange(next);
            }}/>
        </div>);
    }
    if (socket.color)
        return <span aria-hidden className="size-3.5 rounded-xs border border-border" style={{ backgroundColor: colorCss(components) }}/>;
    return <span className="font-mono text-3xs text-muted-foreground/70">{components.map((component) => formatNumber(component, 2)).join(' ')}</span>;
}
function InputRow({ socket, linked, value, onChange }: {
    socket: InputSocket;
    linked: boolean;
    value: GraphValue | undefined;
    onChange: (value: GraphValue) => void;
}) {
    return (<div className="relative flex items-center justify-between gap-2 px-3" style={{ height: NODE_ROW_HEIGHT }}>
      <SocketHandle side="in" socketId={socket.id} kind={socket.type}/>
      <span className="truncate text-2xs text-foreground">{socket.label}</span>
      {!linked && <InlineValue socket={socket} value={value} onChange={onChange}/>}
    </div>);
}
function ParamSummary({ params, node }: {
    params: readonly NodeParam[];
    node: GraphNode;
}) {
    const { library } = useEditorSession();
    const describe = (param: NodeParam): string => {
        const value = node.values[param.id];
        switch (param.kind) {
            case 'number':
                return formatNumber(numberOf(value, param.fallback), 2);
            case 'vector':
                return numbersOf(value, param.fallback).map((component) => formatNumber(component, 2)).join(' ');
            case 'select':
                return param.options.find((option) => option.value === textOf(value, param.fallback))?.label ?? param.fallback;
            case 'texture':
                return library.get(textOf(value, ''))?.name ?? 'Sem textura';
            case 'text':
                return textOf(value, param.fallback);
            case 'color':
                return '';
        }
    };
    return (<div className="flex items-center gap-1.5 border-t border-border px-3" style={{ height: NODE_SUMMARY_HEIGHT }}>
      {params.map((param) => param.kind === 'color'
            ? <span key={param.id} aria-hidden className="size-3 shrink-0 rounded-xs border border-border" style={{ backgroundColor: colorCss(numbersOf(node.values[param.id], param.fallback)) }}/>
            : <span key={param.id} className="truncate font-mono text-3xs text-muted-foreground">{describe(param)}</span>)}
    </div>);
}
export function GraphNodeCard({ node, definition, selected, failed, linkedInputs, onSelect, onValueChange }: GraphNodeCardProps) {
    const frame = selected ? 'ring-primary' : failed ? 'ring-destructive' : 'ring-border';
    return (<div data-node-id={node.id} role="group" tabIndex={0} aria-label={`Nó ${definition.label}${selected ? ', selecionado' : ''}`} className={cn('absolute rounded-sm bg-surface-raised shadow-raised ring-1 outline-none focus-visible:ring-2', frame)} style={{ left: node.x, top: node.y, width: NODE_WIDTH }} onKeyDown={(event) => {
            if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' '))
                return;
            event.preventDefault();
            onSelect(event.shiftKey);
        }}>
      <div className="flex cursor-grab items-center gap-1.5 rounded-t-sm border-b border-border bg-surface px-2 active:cursor-grabbing" style={{ height: NODE_HEADER_HEIGHT }} title={definition.description}>
        <span aria-hidden className={cn('size-2 shrink-0 rounded-full', CATEGORY_ACCENT_CLASS[definition.category])}/>
        <span className="truncate text-2xs font-medium text-foreground">{definition.label}</span>
      </div>
      <div style={{ paddingBlock: NODE_BODY_PADDING }}>
        {definition.outputs.map((socket) => <OutputRow key={socket.id} socket={socket}/>)}
        {definition.inputs.map((socket) => <InputRow key={socket.id} socket={socket} linked={linkedInputs.has(socket.id)} value={node.values[socket.id]} onChange={(value) => onValueChange(socket.id, value)}/>)}
      </div>
      {definition.params && definition.params.length > 0 && <ParamSummary params={definition.params} node={node}/>}
    </div>);
}
