'use client';
import { ChevronDown, ChevronUp, CopyPlus, Crosshair, Diff, FlipHorizontal2, Hammer, PackageOpen, RefreshCw, Scissors, ShieldCheck, SquareArrowOutUpRight, Undo2, Unlink } from 'lucide-react';
import { ContextMenuCheckboxItem, ContextMenuItem, ContextMenuLabel, ContextMenuRadioGroup, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, } from '@/components/ui/context-menu';
import type { Entity } from '@/engine/core/scene/entity';
import { CSG_OPERATIONS, CSG_OPERATION_LABEL, CSG_SHAPE_LABEL, type CsgOperation } from '@/engine/geometry/csg/csg-settings';
import { brushesOf, canBeCsgBrush, canBeCsgTarget } from '@/engine/geometry/csg/csg-roles';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { addCsgBrush, consolidateCsg, convertToBrushes, extractCsgResult, hollowCsgTarget, mirrorBrush, moveBrush, rebuildCsg, releaseBrush, repeatBrush, revertCsg, selectBrushTarget, setBrushEnabled, setBrushOperation, setCsgLive, setCsgShowBrushes, sliceCsgTarget, } from '@/engine/editor/operations/csg-operations';
import { csgCollisionState, useMeshColliderForCsg } from '@/engine/editor/operations/csg-physics-operations';
import { AXIS_LABEL, type Axis, type AxisSide } from '@/engine/editor/csg/brush-placement';
import { CSG_BRUSH_SHAPES, CSG_SHAPE_ICON } from '@/engine/editor/panels/inspector/csg/csg-icons';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS, MENU_SHORTCUT_CLASS } from './menu-styles';
const AXES: readonly Axis[] = [0, 1, 2];
const SIDES: readonly AxisSide[] = [1, -1];
const SELECTION_VERB: Record<CsgOperation, (target: string) => string> = {
    subtract: (target) => `Subtrair selecionados de ${target}`,
    union: (target) => `Unir selecionados a ${target}`,
    intersect: (target) => `Interseção dos selecionados com ${target}`,
};
function BrushActions({ brush }: {
    brush: Entity;
}) {
    const session = useEditorState();
    const settings = brush.csgBrush;
    const target = brush.parent;
    if (!settings || !target)
        return null;
    const siblings = brushesOf(target);
    const index = siblings.indexOf(brush);
    return (<ContextMenuSub>
      <ContextMenuSubTrigger className={MENU_ITEM_CLASS}>
        <Diff aria-hidden/>
        Pincel CSG
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className={MENU_CONTENT_CLASS}>
        <ContextMenuLabel className={MENU_LABEL_CLASS}>Operação</ContextMenuLabel>
        <ContextMenuRadioGroup value={settings.operation} onValueChange={(value) => setBrushOperation(session, brush, value as CsgOperation)}>
          {CSG_OPERATIONS.map((operation) => (<ContextMenuRadioItem key={operation} value={operation} className={MENU_ITEM_CLASS}>
              {CSG_OPERATION_LABEL[operation]}
            </ContextMenuRadioItem>))}
        </ContextMenuRadioGroup>
        <ContextMenuCheckboxItem className={MENU_ITEM_CLASS} checked={settings.enabled} onCheckedChange={(checked) => setBrushEnabled(session, brush, checked === true)}>
          Pincel ativo
        </ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuLabel className={MENU_LABEL_CLASS}>Ordem · {index + 1} de {siblings.length}</ContextMenuLabel>
        <ContextMenuItem className={MENU_ITEM_CLASS} disabled={index <= 0} onClick={() => moveBrush(session, brush, -1)}>
          <ChevronUp aria-hidden/>
          Aplicar antes
          <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Alt+↑</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem className={MENU_ITEM_CLASS} disabled={index >= siblings.length - 1} onClick={() => moveBrush(session, brush, 1)}>
          <ChevronDown aria-hidden/>
          Aplicar depois
          <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Alt+↓</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuLabel className={MENU_LABEL_CLASS}>Espelhar no alvo</ContextMenuLabel>
        {AXES.map((axis) => (<ContextMenuItem key={axis} className={MENU_ITEM_CLASS} onClick={() => mirrorBrush(session, brush, axis)}>
            <FlipHorizontal2 aria-hidden/>
            Espelhar em {AXIS_LABEL[axis]}
          </ContextMenuItem>))}
        <ContextMenuLabel className={MENU_LABEL_CLASS}>Repetir (mais uma cópia)</ContextMenuLabel>
        {AXES.map((axis) => (<ContextMenuItem key={axis} className={MENU_ITEM_CLASS} onClick={() => repeatBrush(session, brush, { count: 1, axis })}>
            <CopyPlus aria-hidden/>
            Repetir em {AXIS_LABEL[axis]}
          </ContextMenuItem>))}
        <ContextMenuSeparator />
        <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => selectBrushTarget(session, brush)}>
          <Crosshair aria-hidden/>
          Selecionar alvo
        </ContextMenuItem>
        <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => releaseBrush(session, brush)}>
          <Unlink aria-hidden/>
          Soltar pincel
        </ContextMenuItem>
      </ContextMenuSubContent>
    </ContextMenuSub>);
}
function TargetActions({ entity }: {
    entity: Entity;
}) {
    const session = useEditorState();
    const settings = entity.csg;
    const others = session.selectedEntities().filter((selected) => selected !== entity && canBeCsgBrush(selected) && !selected.contains(entity));
    const collision = csgCollisionState(entity);
    return (<ContextMenuSub>
      <ContextMenuSubTrigger className={MENU_ITEM_CLASS}>
        <Diff aria-hidden/>
        CSG
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className={MENU_CONTENT_CLASS}>
        <ContextMenuLabel className={MENU_LABEL_CLASS}>Subtrair um pincel novo</ContextMenuLabel>
        {CSG_BRUSH_SHAPES.map((shape) => {
            const Icon = CSG_SHAPE_ICON[shape];
            return (<ContextMenuItem key={shape} className={MENU_ITEM_CLASS} onClick={() => addCsgBrush(session, entity, shape)}>
              <Icon aria-hidden/>
              {CSG_SHAPE_LABEL[shape]}
              {shape === 'box' && <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>B</ContextMenuShortcut>}
              {shape === 'cylinder' && <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Shift+B</ContextMenuShortcut>}
            </ContextMenuItem>);
        })}
        <ContextMenuSeparator />
        <ContextMenuLabel className={MENU_LABEL_CLASS}>Modelagem</ContextMenuLabel>
        <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => hollowCsgTarget(session, entity)}>
          <PackageOpen aria-hidden/>
          Escavar (oco)
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger className={MENU_ITEM_CLASS}>
            <Scissors aria-hidden/>
            Fatiar
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className={MENU_CONTENT_CLASS}>
            {AXES.map((axis) => SIDES.map((side) => (<ContextMenuItem key={`${axis}${side}`} className={MENU_ITEM_CLASS} onClick={() => sliceCsgTarget(session, entity, axis, side)}>
                  Remover metade {side > 0 ? '+' : '−'}{AXIS_LABEL[axis]}
                </ContextMenuItem>)))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        {others.length > 0 && (<>
            <ContextMenuSeparator />
            <ContextMenuLabel className={MENU_LABEL_CLASS}>
              {others.length === 1 ? `${others[0].name} como pincel` : `${others.length} selecionados como pincéis`}
            </ContextMenuLabel>
            {CSG_OPERATIONS.map((operation) => (<ContextMenuItem key={operation} className={MENU_ITEM_CLASS} onClick={() => convertToBrushes(session, entity, others, operation)}>
                {SELECTION_VERB[operation](entity.name)}
              </ContextMenuItem>))}
          </>)}
        {settings && (<>
            <ContextMenuSeparator />
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => rebuildCsg(session, entity)}>
              <RefreshCw aria-hidden/>
              Reconstruir agora
            </ContextMenuItem>
            <ContextMenuCheckboxItem className={MENU_ITEM_CLASS} checked={settings.live} onCheckedChange={(checked) => setCsgLive(session, entity, checked === true)}>
              Reconstruir ao vivo
            </ContextMenuCheckboxItem>
            <ContextMenuCheckboxItem className={MENU_ITEM_CLASS} checked={settings.showBrushes} onCheckedChange={(checked) => setCsgShowBrushes(session, entity, checked === true)}>
              Mostrar pincéis
            </ContextMenuCheckboxItem>
            {collision !== 'mesh' && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => useMeshColliderForCsg(session, entity)}>
                <ShieldCheck aria-hidden/>
                {collision === 'none' ? 'Adicionar colisor de malha' : 'Colisão: usar malha (acompanha furos)'}
              </ContextMenuItem>)}
            <ContextMenuSeparator />
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => extractCsgResult(session, entity)}>
              <SquareArrowOutUpRight aria-hidden/>
              Extrair resultado como ator
            </ContextMenuItem>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => consolidateCsg(session, entity)}>
              <Hammer aria-hidden/>
              Consolidar (fixar resultado)
              <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+Alt+B</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem className={MENU_ITEM_CLASS} variant="destructive" onClick={() => revertCsg(session, entity)}>
              <Undo2 aria-hidden/>
              Reverter à malha original
            </ContextMenuItem>
          </>)}
      </ContextMenuSubContent>
    </ContextMenuSub>);
}
export function CsgContextActions({ entity }: {
    entity: Entity;
}) {
    if (entity.csgBrush)
        return <BrushActions brush={entity}/>;
    if (canBeCsgTarget(entity))
        return <TargetActions entity={entity}/>;
    return null;
}
