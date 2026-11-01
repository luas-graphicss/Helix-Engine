'use client';
import { useEffect, useRef } from 'react';
import { highlightingFor, syntaxTree } from '@codemirror/language';
import { getSearchQuery } from '@codemirror/search';
import type { EditorState } from '@codemirror/state';
import { highlightTree } from '@lezer/highlight';
import type { ScriptLanguageId } from '@/engine/scripting/script-languages';
import type { CodeSurfaceController } from '../editor/surface-controller';
import { hasSearchableQuery } from '../editor/search-bridge';
const MINIMAP_WIDTH = 84;
const ROW_HEIGHT = 2;
const ROW_GAP = 1;
const CHAR_WIDTH = 1.2;
const PADDING = 6;
const MAX_COLORED_CHARS = 200000;
const MAX_MATCH_LINES = 5000;
type Tone = 'text' | 'comment' | 'keyword' | 'string' | 'definition';
function toneOf(className: string | null): Tone | null {
    if (!className)
        return null;
    if (className.includes('comment'))
        return 'comment';
    if (className.includes('keyword'))
        return 'keyword';
    if (className.includes('string'))
        return 'string';
    if (className.includes('definition') || className.includes('typeName') || className.includes('className'))
        return 'definition';
    return null;
}
interface Segment {
    readonly from: number;
    readonly to: number;
    readonly tone: Tone;
}
function colorSegments(state: EditorState): Segment[] {
    if (state.doc.length > MAX_COLORED_CHARS)
        return [];
    const segments: Segment[] = [];
    const tree = syntaxTree(state);
    highlightTree(tree, { style: (tags) => highlightingFor(state, tags) }, (from, to, className) => {
        const tone = toneOf(className);
        if (tone)
            segments.push({ from, to, tone });
    });
    return segments;
}
function readColor(element: HTMLElement, variable: string, fallback: string): string {
    const value = getComputedStyle(element).getPropertyValue(variable).trim();
    return value || fallback;
}
type CodeMinimapProps = {
    controller: CodeSurfaceController;
    language: ScriptLanguageId;
};
export function CodeMinimap({ controller, language }: CodeMinimapProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const dragging = useRef(false);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const context = canvas.getContext('2d');
        if (!context)
            return;
        const { view } = controller;
        const scroller = view.scrollDOM;
        const draw = () => {
            const { state } = view;
            const ratio = window.devicePixelRatio || 1;
            const height = canvas.clientHeight;
            if (canvas.width !== MINIMAP_WIDTH * ratio || canvas.height !== Math.round(height * ratio)) {
                canvas.width = MINIMAP_WIDTH * ratio;
                canvas.height = Math.round(height * ratio);
            }
            context.setTransform(ratio, 0, 0, ratio, 0, 0);
            context.clearRect(0, 0, MINIMAP_WIDTH, height);
            const { doc } = state;
            const lineCount = doc.lines;
            const rowPitch = ROW_HEIGHT + ROW_GAP;
            const natural = lineCount * rowPitch + PADDING * 2;
            const scale = natural > height ? (height - PADDING * 2) / (lineCount * rowPitch) : 1;
            const pitch = rowPitch * scale;
            const barHeight = Math.max(1, ROW_HEIGHT * scale);
            const maxWidth = MINIMAP_WIDTH - PADDING * 2;
            const colors: Record<Tone, string> = {
                text: readColor(canvas, '--foreground', '#dde1ea'),
                comment: readColor(canvas, '--code-comment', '#8a90a0'),
                keyword: readColor(canvas, '--code-keyword', '#e08080'),
                string: readColor(canvas, '--code-string', '#a0c070'),
                definition: readColor(canvas, '--code-definition', '#e0c070'),
            };
            const muted = readColor(canvas, '--muted-foreground', '#8a90a0');
            const primary = readColor(canvas, '--primary', '#e8a24a');
            const warning = readColor(canvas, '--warning', '#f0d060');
            const matchLines = new Set<number>();
            const query = getSearchQuery(state);
            if (hasSearchableQuery(query)) {
                const cursor = query.getCursor(state);
                for (let step = cursor.next(); !step.done && matchLines.size < MAX_MATCH_LINES; step = cursor.next())
                    matchLines.add(doc.lineAt(step.value.from).number);
            }
            const segments = colorSegments(state);
            let segmentIndex = 0;
            const cursorLine = doc.lineAt(state.selection.main.head).number;
            for (let number = 1; number <= lineCount; number++) {
                const line = doc.line(number);
                const text = line.text;
                const trimmed = text.trimStart();
                const y = PADDING + (number - 1) * pitch;
                if (trimmed.length > 0) {
                    const indentChars = text.length - trimmed.length;
                    const indent = Math.min(maxWidth * 0.6, indentChars * CHAR_WIDTH);
                    const width = Math.min(maxWidth - indent, trimmed.length * CHAR_WIDTH);
                    context.globalAlpha = 0.42;
                    context.fillStyle = colors.text;
                    context.fillRect(PADDING + indent, y, Math.max(1, width), barHeight);
                    while (segmentIndex < segments.length && segments[segmentIndex].to <= line.from)
                        segmentIndex++;
                    for (let index = segmentIndex; index < segments.length && segments[index].from < line.to; index++) {
                        const segment = segments[index];
                        const from = Math.max(segment.from, line.from + indentChars) - line.from - indentChars;
                        const to = Math.min(segment.to, line.to) - line.from - indentChars;
                        if (to <= from)
                            continue;
                        const x = PADDING + indent + from * CHAR_WIDTH;
                        const w = Math.min(maxWidth - indent - from * CHAR_WIDTH, (to - from) * CHAR_WIDTH);
                        if (w <= 0)
                            continue;
                        context.globalAlpha = segment.tone === 'comment' ? 0.5 : 0.85;
                        context.fillStyle = colors[segment.tone];
                        context.fillRect(x, y, Math.max(1, w), barHeight);
                    }
                }
                if (matchLines.has(number)) {
                    context.globalAlpha = 0.9;
                    context.fillStyle = warning;
                    context.fillRect(1, y, 3, barHeight);
                }
            }
            context.globalAlpha = 0.9;
            context.fillStyle = primary;
            context.fillRect(MINIMAP_WIDTH - 4, PADDING + (cursorLine - 1) * pitch, 3, Math.max(barHeight, 2));
            const total = Math.max(1, scroller.scrollHeight);
            const viewTop = (scroller.scrollTop / total) * (lineCount * pitch) + PADDING;
            const viewHeight = Math.max(8, (scroller.clientHeight / total) * (lineCount * pitch));
            context.fillStyle = muted;
            context.globalAlpha = 0.12;
            context.fillRect(0, viewTop, MINIMAP_WIDTH, viewHeight);
            context.globalAlpha = 0.35;
            context.fillRect(0, viewTop, MINIMAP_WIDTH, 1);
            context.fillRect(0, viewTop + viewHeight - 1, MINIMAP_WIDTH, 1);
            context.globalAlpha = 1;
        };
        let frame = 0;
        const schedule = () => {
            if (frame)
                return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                draw();
            });
        };
        draw();
        const stopUpdates = controller.onUpdate(schedule);
        scroller.addEventListener('scroll', schedule, { passive: true });
        const observer = new ResizeObserver(schedule);
        observer.observe(canvas);
        observer.observe(scroller);
        return () => {
            stopUpdates();
            scroller.removeEventListener('scroll', schedule);
            observer.disconnect();
            if (frame)
                cancelAnimationFrame(frame);
        };
    }, [controller, language]);
    const scrollTo = (clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const scroller = controller.view.scrollDOM;
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientY - rect.top - PADDING) / Math.max(1, rect.height - PADDING * 2)));
        scroller.scrollTop = ratio * scroller.scrollHeight - scroller.clientHeight / 2;
    };
    return (<canvas ref={canvasRef} role="presentation" aria-hidden className="h-full shrink-0 cursor-pointer border-l border-border/70 bg-surface-sunken select-none" style={{ width: MINIMAP_WIDTH }} onPointerDown={(event) => {
            dragging.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            scrollTo(event.clientY);
        }} onPointerMove={(event) => {
            if (dragging.current)
                scrollTo(event.clientY);
        }} onPointerUp={(event) => {
            dragging.current = false;
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}/>);
}
