'use client';
import { GUI_ROOT_ID, type GuiPoint } from '@/engine/gui/document/gui-document';
import type { GuiBox, GuiLayoutEntry, GuiLayoutResult } from '@/engine/gui/layout/gui-layout';
import { applyMatrix, matrixMultiply, type GuiMatrix } from '@/engine/gui/layout/gui-matrix';
import type { GuiViewState } from '../gui-designer';
import type { GuiSnapGuide } from '../gui-snapping';
import { GUI_HANDLES, HANDLE_SIZE, handlePositions } from './gui-canvas-interaction';
export interface GuiSelectionFrame {
    readonly box: GuiBox;
    readonly world: GuiMatrix;
    readonly rotation: number;
    readonly single: boolean;
    readonly entry: GuiLayoutEntry | null;
}
export interface OverlayDragView {
    readonly marquee?: GuiBox;
    readonly draw?: GuiBox;
    readonly guides?: readonly GuiSnapGuide[];
    readonly targetId?: string | null;
    readonly rotating?: number | null;
}
interface GuiCanvasOverlayProps {
    readonly layout: GuiLayoutResult;
    readonly view: GuiViewState;
    readonly width: number;
    readonly height: number;
    readonly selectedIds: ReadonlySet<string>;
    readonly hoveredId: string | null;
    readonly frame: GuiSelectionFrame | null;
    readonly outlines: boolean;
    readonly drag: OverlayDragView | null;
    readonly hideHandles: boolean;
}
const GUIDE_COLOR = '#ff4fa3';
function viewMatrix(view: GuiViewState): GuiMatrix {
    return [view.zoom, 0, 0, view.zoom, view.panX, view.panY];
}
function polygonPoints(matrix: GuiMatrix, box: GuiBox): string {
    const corners = [applyMatrix(matrix, box.x, box.y), applyMatrix(matrix, box.x + box.width, box.y), applyMatrix(matrix, box.x + box.width, box.y + box.height), applyMatrix(matrix, box.x, box.y + box.height)];
    return corners.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
}
function entryPolygon(entry: GuiLayoutEntry, screen: GuiMatrix): string {
    return polygonPoints(matrixMultiply(screen, entry.world), { x: 0, y: 0, width: entry.width, height: entry.height });
}
function formatSize(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
export function GuiCanvasOverlay({ layout, view, width, height, selectedIds, hoveredId, frame, outlines, drag, hideHandles }: GuiCanvasOverlayProps) {
    const screen = viewMatrix(view);
    const hovered = hoveredId && !selectedIds.has(hoveredId) ? layout.entries.get(hoveredId) : null;
    const target = drag?.targetId ? layout.entries.get(drag.targetId) : null;
    const frameMatrix = frame ? matrixMultiply(screen, frame.world) : null;
    const handles = frame && frameMatrix ? handlePositions(frame.box) : null;
    const sizeAnchor = frame && frameMatrix ? applyMatrix(frameMatrix, frame.box.x + frame.box.width / 2, frame.box.y + frame.box.height) : null;
    const scale = layout.offsetScale || 1;
    return (<svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden>
      {outlines &&
            layout.order.map((entry) => entry.node.id === GUI_ROOT_ID || !entry.node.visible ? null : <polygon key={entry.node.id} points={entryPolygon(entry, screen)} fill="none" stroke="rgba(79,157,219,0.35)" strokeWidth={1}/>)}

      {target && target.node.id !== GUI_ROOT_ID && <polygon points={entryPolygon(target, screen)} fill="rgba(79,157,219,0.06)" stroke="var(--primary)" strokeWidth={1.5} strokeDasharray="6 4"/>}

      {hovered && !drag && <polygon points={entryPolygon(hovered, screen)} fill="none" stroke="var(--primary)" strokeWidth={1.5}/>}

      {[...selectedIds].map((id) => {
            const entry = layout.entries.get(id);
            return entry ? <polygon key={id} points={entryPolygon(entry, screen)} fill="none" stroke="var(--primary)" strokeWidth={1} opacity={0.9}/> : null;
        })}

      {frame && frameMatrix && (<g>
          <polygon points={polygonPoints(frameMatrix, frame.box)} fill="none" stroke="var(--primary)" strokeWidth={1.5}/>
          {!hideHandles &&
                handles &&
                GUI_HANDLES.map((handle) => {
                    const point = applyMatrix(frameMatrix, handles[handle].x, handles[handle].y);
                    return (<rect key={handle} x={point.x - HANDLE_SIZE / 2} y={point.y - HANDLE_SIZE / 2} width={HANDLE_SIZE} height={HANDLE_SIZE} rx={1.5} fill="var(--surface)" stroke="var(--primary)" strokeWidth={1.5} transform={frame.rotation ? `rotate(${frame.rotation} ${point.x} ${point.y})` : undefined}/>);
                })}
          {frame.single && frame.entry && !hideHandles && <AnchorMarker entry={frame.entry} screen={screen}/>}
          {sizeAnchor && (<SizeBadge at={sizeAnchor} label={drag?.rotating !== null && drag?.rotating !== undefined ? `${drag.rotating.toFixed(0)}°` : `${formatSize(Math.round((frame.box.width / scale) * 10) / 10)} × ${formatSize(Math.round((frame.box.height / scale) * 10) / 10)}`}/>)}
        </g>)}

      {drag?.guides?.map((guide, index) => {
            const a = guide.axis === 'x' ? applyMatrix(screen, guide.at, guide.from) : applyMatrix(screen, guide.from, guide.at);
            const b = guide.axis === 'x' ? applyMatrix(screen, guide.at, guide.to) : applyMatrix(screen, guide.to, guide.at);
            return (<g key={index} stroke={GUIDE_COLOR} strokeWidth={1}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>
            {guide.axis === 'x' ? (<>
                <line x1={a.x - 4} y1={a.y} x2={a.x + 4} y2={a.y}/>
                <line x1={b.x - 4} y1={b.y} x2={b.x + 4} y2={b.y}/>
              </>) : (<>
                <line x1={a.x} y1={a.y - 4} x2={a.x} y2={a.y + 4}/>
                <line x1={b.x} y1={b.y - 4} x2={b.x} y2={b.y + 4}/>
              </>)}
          </g>);
        })}

      {drag?.marquee && <rect x={drag.marquee.x * view.zoom + view.panX} y={drag.marquee.y * view.zoom + view.panY} width={drag.marquee.width * view.zoom} height={drag.marquee.height * view.zoom} fill="rgba(79,157,219,0.1)" stroke="var(--primary)" strokeWidth={1}/>}

      {drag?.draw && (<g>
          <rect x={drag.draw.x * view.zoom + view.panX} y={drag.draw.y * view.zoom + view.panY} width={drag.draw.width * view.zoom} height={drag.draw.height * view.zoom} fill="rgba(79,157,219,0.12)" stroke="var(--primary)" strokeWidth={1.5} strokeDasharray="4 3"/>
          <SizeBadge at={{ x: (drag.draw.x + drag.draw.width / 2) * view.zoom + view.panX, y: (drag.draw.y + drag.draw.height) * view.zoom + view.panY }} label={`${formatSize(Math.round(drag.draw.width / scale))} × ${formatSize(Math.round(drag.draw.height / scale))}`}/>
        </g>)}
    </svg>);
}
function SizeBadge({ at, label }: {
    at: GuiPoint;
    label: string;
}) {
    const width = label.length * 6.2 + 12;
    return (<g transform={`translate(${at.x - width / 2}, ${at.y + 8})`}>
      <rect width={width} height={16} rx={3} fill="var(--primary)"/>
      <text x={width / 2} y={11.5} textAnchor="middle" fontSize={10} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fill="#ffffff">
        {label}
      </text>
    </g>);
}
function AnchorMarker({ entry, screen }: {
    entry: GuiLayoutEntry;
    screen: GuiMatrix;
}) {
    const { anchor } = entry.node.rect;
    const point = applyMatrix(matrixMultiply(screen, entry.world), anchor.x * entry.width, anchor.y * entry.height);
    return (<g>
      <circle cx={point.x} cy={point.y} r={4} fill="none" stroke="var(--primary)" strokeWidth={1.5}/>
      <circle cx={point.x} cy={point.y} r={1.2} fill="var(--primary)"/>
    </g>);
}
