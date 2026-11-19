'use client';
import * as vec3 from '@/engine/core/math/vec3';
import { ScalarField } from '@/engine/editor/panels/inspector/number-fields';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import type { GraphNode, GraphValue } from '@/engine/shader-graph/document/graph-document';
import { numberOf, numbersOf, textOf } from '@/engine/shader-graph/document/graph-values';
import { nodeDefinition } from '@/engine/shader-graph/nodes/node-catalog';
import type { InputSocket, NodeParam } from '@/engine/shader-graph/nodes/node-definition';
import { componentCount } from '@/engine/shader-graph/nodes/socket-types';
import { ColorField } from '@/engine/ui/color-field';
import { FieldInput } from '@/engine/ui/field-input';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
import { useShaderGraph } from './use-shader-graph';
const NO_TEXTURE = '';
type ValueEditorProps = {
    label: string;
    onChange: (value: GraphValue) => void;
};
function toColor(components: readonly number[]) {
    return vec3.create(components[0] ?? 0, components[1] ?? 0, components[2] ?? 0);
}
function ComponentFields({ label, components, onChange }: ValueEditorProps & {
    components: readonly number[];
}) {
    return (<PropertyRow label={label}>
      {components.map((component, index) => (<ScalarField key={index} label={`${label} ${index + 1}`} value={component} onCommit={(next) => {
                if (Number.isFinite(next))
                    onChange(components.map((current, position) => (position === index ? next : current)));
            }}/>))}
    </PropertyRow>);
}
function NumberEditor({ label, value, onChange }: ValueEditorProps & {
    value: number;
}) {
    return (<PropertyRow label={label}>
      <ScalarField label={label} value={value} onCommit={(next) => {
            if (Number.isFinite(next))
                onChange(next);
        }}/>
    </PropertyRow>);
}
function TextureEditor({ label, value, onChange }: ValueEditorProps & {
    value: string;
}) {
    const session = useSessionTopic('assets');
    const options = [{ value: NO_TEXTURE, label: 'Nenhuma' }, ...session.library.byKind('texture').map((asset) => ({ value: asset.id, label: asset.name }))];
    return (<PropertyRow label={label} hint="Texturas vêm da biblioteca de ativos do projeto">
      <SelectField label={label} options={options} value={options.some((option) => option.value === value) ? value : NO_TEXTURE} onChange={onChange}/>
    </PropertyRow>);
}
function ParamEditor({ param, node, onChange }: {
    param: NodeParam;
    node: GraphNode;
    onChange: (value: GraphValue) => void;
}) {
    const value = node.values[param.id];
    switch (param.kind) {
        case 'number':
            return <NumberEditor label={param.label} value={numberOf(value, param.fallback)} onChange={onChange}/>;
        case 'color':
            return <ColorField label={param.label} value={toColor(numbersOf(value, param.fallback))} onChange={(rgb) => onChange(Array.from(rgb))}/>;
        case 'vector':
            return <ComponentFields label={param.label} components={numbersOf(value, param.fallback)} onChange={onChange}/>;
        case 'select':
            return (<PropertyRow label={param.label}>
              <SelectField label={param.label} options={param.options} value={textOf(value, param.fallback)} onChange={onChange}/>
            </PropertyRow>);
        case 'texture':
            return <TextureEditor label={param.label} value={textOf(value, NO_TEXTURE)} onChange={onChange}/>;
        case 'text':
            return (<PropertyRow label={param.label}>
              <FieldInput key={textOf(value, param.fallback)} defaultValue={textOf(value, param.fallback)} aria-label={param.label} onBlur={(event) => {
                    const text = event.currentTarget.value.trim();
                    if (text !== '')
                        onChange(text);
                }} onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229)
                        event.currentTarget.blur();
                }}/>
            </PropertyRow>);
    }
}
function InputEditor({ socket, node, linked, onChange }: {
    socket: InputSocket;
    node: GraphNode;
    linked: boolean;
    onChange: (value: GraphValue) => void;
}) {
    if (linked || socket.builtin) {
        return (<PropertyRow label={socket.label}>
          <span className="text-2xs text-muted-foreground">{linked ? 'Vem da ligação' : 'Automático'}</span>
        </PropertyRow>);
    }
    const inlineType = socket.type === 'auto' ? 'float' : socket.type;
    const stored = numbersOf(node.values[socket.id], socket.fallback ?? [0]);
    const components = Array.from({ length: componentCount(inlineType) }, (_, index) => stored[index] ?? 0);
    if (inlineType === 'float')
        return <NumberEditor label={socket.label} value={components[0]} onChange={onChange}/>;
    if (socket.color)
        return <ColorField label={socket.label} value={toColor(components)} onChange={(rgb) => onChange(Array.from(rgb))}/>;
    return <ComponentFields label={socket.label} components={components} onChange={onChange}/>;
}
function SelectionHint({ selected }: {
    selected: number;
}) {
    return (<p className="px-2 py-3 text-3xs leading-relaxed text-pretty text-muted-foreground">
      {selected > 1
            ? `${selected} nós selecionados. Arraste para mover todos ou exclua com a tecla de apagar.`
            : 'Selecione um nó para editar os valores. Clique em um nó da biblioteca para criá-lo, puxe de uma saída até uma entrada para ligar e arraste a ponta de uma ligação para desfazê-la.'}
    </p>);
}
export function NodeProperties() {
    const editor = useShaderGraph();
    const graph = editor.document;
    const node = editor.selectedNode;
    if (!graph)
        return null;
    if (!node)
        return <SelectionHint selected={editor.selection.size}/>;
    const definition = nodeDefinition(node.type);
    if (!definition)
        return <p className="px-2 py-3 text-3xs text-destructive">Este nó veio de uma versão que a engine não conhece: exclua-o para o grafo voltar a compilar.</p>;
    const linked = new Set(graph.links.filter((link) => link.to.node === node.id).map((link) => link.to.socket));
    const editable = definition.inputs.filter((socket) => !socket.connectOnly);
    return (<div className="flex flex-col gap-1 py-2">
      <header className="flex flex-col gap-0.5 px-2 pb-1">
        <h3 className="text-2xs font-medium text-foreground">{definition.label}</h3>
        <p className="text-3xs leading-relaxed text-pretty text-muted-foreground">{definition.description}</p>
      </header>
      {definition.params?.map((param) => <ParamEditor key={param.id} param={param} node={node} onChange={(value) => editor.setValue(node.id, param.id, value)}/>)}
      {editable.map((socket) => <InputEditor key={socket.id} socket={socket} node={node} linked={linked.has(socket.id)} onChange={(value) => editor.setValue(node.id, socket.id, value)}/>)}
    </div>);
}
