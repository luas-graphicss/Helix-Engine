'use client';
import { PackageOpen, Scissors, SquareArrowOutUpRight } from 'lucide-react';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import type { Entity } from '@/engine/core/scene/entity';
import { CSG_SHAPE_LABEL } from '@/engine/geometry/csg/csg-settings';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { addCsgBrush, extractCsgResult, hollowCsgTarget, sliceCsgTarget } from '@/engine/editor/operations/csg-operations';
import { AXIS_LABEL, type Axis, type AxisSide } from '@/engine/editor/csg/brush-placement';
import { CSG_BRUSH_SHAPES, CSG_SHAPE_ICON } from './csg-icons';
const SLICES: ReadonlyArray<{
    axis: Axis;
    side: AxisSide;
}> = [
    { axis: 0, side: 1 },
    { axis: 0, side: -1 },
    { axis: 1, side: 1 },
    { axis: 1, side: -1 },
    { axis: 2, side: 1 },
    { axis: 2, side: -1 },
];
export function BrushShapeButtons({ target }: {
    target: Entity;
}) {
    const session = useEditorState();
    return (<div className="grid grid-cols-6 gap-1 px-2 py-1">
      {CSG_BRUSH_SHAPES.map((shape) => {
            const Icon = CSG_SHAPE_ICON[shape];
            return (<button key={shape} type="button" title={`Subtrair ${CSG_SHAPE_LABEL[shape].toLowerCase()} de ${target.name}`} aria-label={`Adicionar pincel ${CSG_SHAPE_LABEL[shape].toLowerCase()}`} onClick={() => addCsgBrush(session, target, shape)} className="flex h-7 items-center justify-center rounded-sm border border-dashed border-border-strong text-muted-foreground transition-colors hover:border-primary/60 hover:bg-highlight hover:text-foreground [&_svg]:size-3.5">
            <Icon aria-hidden/>
          </button>);
        })}
    </div>);
}
function SliceButtons({ target }: {
    target: Entity;
}) {
    const session = useEditorState();
    return (<div className="flex items-center gap-1 px-2 pb-1">
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Scissors className="size-3" aria-hidden/>
        Fatiar
      </span>
      <div className="grid flex-1 grid-cols-6 gap-1">
        {SLICES.map(({ axis, side }) => {
            const label = `${side > 0 ? '+' : '−'}${AXIS_LABEL[axis]}`;
            return (<button key={label} type="button" title={`Remover a metade ${label} de ${target.name}`} onClick={() => sliceCsgTarget(session, target, axis, side)} className="h-6 rounded-sm border border-border font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/60 hover:bg-highlight hover:text-foreground">
              {label}
            </button>);
        })}
      </div>
    </div>);
}
export function TargetTools({ target }: {
    target: Entity;
}) {
    const session = useEditorState();
    return (<>
      <BrushShapeButtons target={target}/>
      <SliceButtons target={target}/>
      <ActionRow>
        <ActionButton icon={PackageOpen} onClick={() => hollowCsgTarget(session, target)} title="Subtrai a própria malha encolhida, deixando paredes finas">
          Escavar
        </ActionButton>
        {target.csg && (<ActionButton icon={SquareArrowOutUpRight} onClick={() => extractCsgResult(session, target)} title="Cria um ator comum com o resultado atual; este alvo continua editável">
            Extrair resultado
          </ActionButton>)}
      </ActionRow>
    </>);
}
