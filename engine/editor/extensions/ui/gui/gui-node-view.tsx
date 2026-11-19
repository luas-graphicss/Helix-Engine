'use client';
import * as vec3 from '@/engine/core/math/vec3';
import { ActionButton } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { ColorField } from '@/engine/ui/color-field';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import type { GuiNode } from '../../gui/gui-node';
import { extensionIcon } from '../extension-icon';
import { GuiActorField, GuiAssetField } from './gui-reference-fields';
import { GuiHeading, GuiHelp, GuiLabel, GuiProgress } from './gui-static-nodes';
import { GuiNumberField, GuiSelectField, GuiTextField, GuiVectorField } from './gui-value-fields';
export type GuiEmit = (key: string, value: unknown) => void;
type GuiNodeListProps = {
    nodes: readonly GuiNode[];
    emit: GuiEmit;
    inline?: boolean;
};
function GuiNodeView({ node, emit }: {
    node: GuiNode;
    emit: GuiEmit;
}) {
    const send = (value: unknown) => emit(node.key, value);
    switch (node.kind) {
        case 'label':
            return <GuiLabel node={node}/>;
        case 'heading':
            return <GuiHeading text={node.text}/>;
        case 'help':
            return <GuiHelp node={node}/>;
        case 'separator':
            return <hr className="my-1 border-border"/>;
        case 'space':
            return <div aria-hidden style={{ height: node.size }}/>;
        case 'progress':
            return <GuiProgress node={node}/>;
        case 'button':
            return (<ActionButton icon={node.icon === null ? undefined : extensionIcon(node.icon)} variant={node.variant} disabled={node.disabled} onClick={() => send(true)}>
              {node.label}
            </ActionButton>);
        case 'toggle':
            return <ToggleField label={node.label} on={node.value} onToggle={node.disabled ? undefined : () => send(!node.value)}/>;
        case 'slider':
            return <SliderField label={node.label} value={node.value} min={node.min} max={node.max} step={node.step ?? undefined} disabled={node.disabled} onChange={send}/>;
        case 'color':
            return <ColorField label={node.label} value={vec3.create(node.value[0], node.value[1], node.value[2])} onChange={node.disabled ? undefined : (rgb) => send([rgb[0], rgb[1], rgb[2]])}/>;
        case 'number':
            return <GuiNumberField node={node} onChange={send}/>;
        case 'text':
            return <GuiTextField node={node} onChange={send}/>;
        case 'select':
            return <GuiSelectField node={node} onChange={send}/>;
        case 'vector':
            return <GuiVectorField node={node} onChange={send}/>;
        case 'actor':
            return <GuiActorField node={node} onChange={send}/>;
        case 'asset':
            return <GuiAssetField node={node} onChange={send}/>;
        case 'row':
            return (<div className="flex flex-wrap items-center gap-1.5 px-2 py-1">
              <GuiNodeList nodes={node.children} emit={emit} inline/>
            </div>);
        case 'section':
            return (<CollapsibleSection title={node.title}>
              <GuiNodeList nodes={node.children} emit={emit}/>
            </CollapsibleSection>);
    }
}
export function GuiNodeList({ nodes, emit, inline = false }: GuiNodeListProps) {
    return (<>
      {nodes.map((node) => {
            const view = <GuiNodeView node={node} emit={emit}/>;
            if (node.kind !== 'button')
                return inline ? (<div key={node.key} className="min-w-0 flex-1">{view}</div>) : (<div key={node.key}>{view}</div>);
            return inline ? (<div key={node.key} className="flex">{view}</div>) : (<div key={node.key} className="flex px-2 py-1">{view}</div>);
        })}
    </>);
}
