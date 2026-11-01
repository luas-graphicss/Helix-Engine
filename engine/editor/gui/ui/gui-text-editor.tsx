'use client';
import { useEffect, useRef, type CSSProperties } from 'react';
import type { GuiLayoutEntry, GuiLayoutResult } from '@/engine/gui/layout/gui-layout';
import { matrixMultiply, matrixTranslate } from '@/engine/gui/layout/gui-matrix';
import { guiFonts } from '@/engine/gui/fonts/gui-font-registry';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { GuiDesigner } from '../gui-designer';
interface GuiTextEditorProps {
    readonly designer: GuiDesigner;
    readonly layout: GuiLayoutResult;
    readonly entry: GuiLayoutEntry;
}
export function GuiTextEditor({ designer, layout, entry }: GuiTextEditorProps) {
    const session = useEditorSession();
    const ref = useRef<HTMLTextAreaElement>(null);
    const style = entry.node.text;
    const box = entry.textBox ?? { x: 0, y: 0, width: entry.width, height: entry.height };
    useEffect(() => {
        const element = ref.current;
        if (!element)
            return;
        element.focus({ preventScroll: true });
        element.select();
    }, []);
    if (!style)
        return null;
    const { view } = designer;
    const matrix = matrixMultiply([view.zoom, 0, 0, view.zoom, view.panX, view.panY], matrixTranslate(entry.world, box.x, box.y));
    const scale = layout.offsetScale;
    const multiline = entry.node.kind !== 'input' || entry.node.control?.kind !== 'input' || entry.node.control.multiline;
    const content = entry.node.kind === 'input' && entry.node.control?.kind === 'input' ? entry.node.control.value : style.content;
    const commit = (value: string) => {
        designer.updateNodes('Editar texto', [entry.node.id], (node) => {
            if (node.kind === 'input' && node.control?.kind === 'input')
                return { ...node, control: { ...node.control, value } };
            return node.text ? { ...node, text: { ...node.text, content: value } } : node;
        }, `gui-text-${entry.node.id}`);
    };
    const css: CSSProperties = {
        position: 'absolute',
        left: 0,
        top: 0,
        width: Math.max(8, box.width),
        height: Math.max(style.size * scale * style.lineHeight, box.height),
        transform: `matrix(${matrix.join(',')})`,
        transformOrigin: '0 0',
        fontFamily: guiFonts.cssFamily(style.family),
        fontSize: style.size * scale,
        fontWeight: style.weight,
        fontStyle: style.italic ? 'italic' : 'normal',
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing * scale,
        textAlign: style.align,
        textTransform: style.uppercase ? 'uppercase' : 'none',
        color: 'transparent',
        caretColor: style.color,
        background: 'transparent',
        border: 'none',
        outline: 'none',
        padding: 0,
        margin: 0,
        resize: 'none',
        overflow: 'hidden',
        whiteSpace: style.wrap ? 'pre-wrap' : 'pre',
        wordBreak: 'break-word',
    };
    return (<textarea ref={ref} aria-label={`Texto de ${entry.node.name}`} value={content} spellCheck={false} style={css} onChange={(event) => commit(event.currentTarget.value)} onBlur={() => {
            session.history.endMerge();
            designer.endTextEdit();
        }} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Escape' || (event.key === 'Enter' && (!multiline || event.ctrlKey || event.metaKey) && !event.shiftKey)) {
                event.preventDefault();
                event.currentTarget.blur();
            }
        }}/>);
}
