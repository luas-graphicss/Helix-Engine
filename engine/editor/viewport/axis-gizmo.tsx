'use client';
import { useEditorSession, useViewportStats } from '@/engine/editor/session/editor-session-context';
const AXES = [
    { label: 'X', dir: [1, 0, 0], stroke: 'stroke-axis-x', fill: 'fill-axis-x' },
    { label: 'Y', dir: [0, 1, 0], stroke: 'stroke-axis-y', fill: 'fill-axis-y' },
    { label: 'Z', dir: [0, 0, 1], stroke: 'stroke-axis-z', fill: 'fill-axis-z' },
] as const;
const RADIUS = 26;
export function AxisGizmo() {
    const { camera } = useEditorSession();
    useViewportStats();
    const view = camera.viewMatrix;
    const projected = AXES.map((axis) => {
        const [x, y, z] = axis.dir;
        const vx = view[0] * x + view[4] * y + view[8] * z;
        const vy = view[1] * x + view[5] * y + view[9] * z;
        const vz = view[2] * x + view[6] * y + view[10] * z;
        return { ...axis, sx: vx * RADIUS, sy: -vy * RADIUS, depth: vz };
    }).sort((a, b) => a.depth - b.depth);
    return (<svg width="72" height="72" viewBox="-36 -36 72 72" role="img" aria-label="Orientação dos eixos" className="font-mono text-[9px] font-semibold">
      {projected.map((axis) => (<g key={axis.label} style={{ opacity: 0.55 + (axis.depth + 1) * 0.225 }}>
          <line x1="0" y1="0" x2={axis.sx} y2={axis.sy} className={axis.stroke} strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx={axis.sx} cy={axis.sy} r="6" className={axis.fill}/>
          <text x={axis.sx} y={axis.sy} textAnchor="middle" dominantBaseline="central" className="fill-background">
            {axis.label}
          </text>
        </g>))}
      <circle cx="0" cy="0" r="2" className="fill-foreground/60"/>
    </svg>);
}
