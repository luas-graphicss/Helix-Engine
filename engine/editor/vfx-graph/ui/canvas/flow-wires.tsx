import type { VfxGraphDocument } from '@/engine/vfx-graph/document/effect-document';
import { cn } from '@/lib/utils';
import { STAGE_STROKE_CLASS } from '../stage-appearance';
import { flowInPoint, flowOutPoint, flowPath, type CanvasPoint } from './canvas-geometry';
export interface PendingFlow {
    readonly fromId: string;
    readonly to: CanvasPoint;
}
type FlowWiresProps = {
    graph: VfxGraphDocument;
    pendingFlow: PendingFlow | null;
};
export function FlowWires({ graph, pendingFlow }: FlowWiresProps) {
    const contexts = new Map(graph.contexts.map((context) => [context.id, context]));
    const pendingOrigin = pendingFlow ? contexts.get(pendingFlow.fromId) : undefined;
    return (<svg aria-hidden className="pointer-events-none absolute top-0 left-0 overflow-visible" width={1} height={1}>
      {graph.links.map((link) => {
            const from = contexts.get(link.from);
            const to = contexts.get(link.to);
            if (!from || !to)
                return null;
            return <path key={link.id} d={flowPath(flowOutPoint(from), flowInPoint(to))} className={cn('fill-none stroke-2', STAGE_STROKE_CLASS[from.kind])}/>;
        })}
      {pendingFlow && pendingOrigin && <path d={flowPath(flowOutPoint(pendingOrigin), pendingFlow.to)} strokeDasharray="5 4" className={cn('fill-none stroke-2', STAGE_STROKE_CLASS[pendingOrigin.kind])}/>}
    </svg>);
}
