import type { GuiTextStyle } from '@/engine/gui/document/gui-document';
import { guiFontString } from '@/engine/gui/fonts/gui-font-registry';
export interface GuiTextLayout {
    readonly lines: readonly string[];
    readonly width: number;
    readonly height: number;
    readonly lineHeight: number;
    readonly fontSize: number;
    readonly font: string;
}
const CACHE_LIMIT = 4000;
const MIN_FIT_SIZE = 6;
type SpacingContext = CanvasRenderingContext2D & {
    letterSpacing?: string;
};
export function displayText(style: GuiTextStyle): string {
    return style.uppercase ? style.content.toUpperCase() : style.content;
}
export class GuiTextMeasurer {
    private context: SpacingContext | null = null;
    private readonly cache = new Map<string, GuiTextLayout>();
    private ensureContext(): SpacingContext | null {
        if (this.context)
            return this.context;
        if (typeof document === 'undefined')
            return null;
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        this.context = canvas.getContext('2d') as SpacingContext | null;
        return this.context;
    }
    invalidate(): void {
        this.cache.clear();
    }
    measureWidth(text: string, font: string, letterSpacing: number): number {
        const context = this.ensureContext();
        if (!context)
            return text.length * 8;
        context.font = font;
        if ('letterSpacing' in context)
            context.letterSpacing = `${letterSpacing}px`;
        return context.measureText(text).width;
    }
    layout(style: GuiTextStyle, cssFamily: string, maxWidth: number | null, maxHeight: number | null): GuiTextLayout {
        const text = displayText(style);
        const key = `${cssFamily}|${style.size}|${style.weight}|${style.italic ? 1 : 0}|${style.lineHeight}|${style.letterSpacing}|${style.wrap ? 1 : 0}|${style.fitToBox ? 1 : 0}|${maxWidth === null ? '' : Math.round(maxWidth)}|${maxHeight === null ? '' : Math.round(maxHeight)}|${text}`;
        const cached = this.cache.get(key);
        if (cached)
            return cached;
        let size = style.size;
        let result = this.layoutAt(style, cssFamily, text, size, maxWidth);
        if (style.fitToBox && (maxWidth !== null || maxHeight !== null)) {
            let guard = 0;
            while (size > MIN_FIT_SIZE && guard++ < 60 && ((maxWidth !== null && result.width > maxWidth + 0.5) || (maxHeight !== null && result.height > maxHeight + 0.5))) {
                size = Math.max(MIN_FIT_SIZE, size - Math.max(1, size * 0.08));
                result = this.layoutAt(style, cssFamily, text, size, maxWidth);
            }
        }
        if (this.cache.size >= CACHE_LIMIT)
            this.cache.clear();
        this.cache.set(key, result);
        return result;
    }
    private layoutAt(style: GuiTextStyle, cssFamily: string, text: string, size: number, maxWidth: number | null): GuiTextLayout {
        const font = guiFontString(style, cssFamily, size);
        const spacing = style.letterSpacing * (size / style.size);
        const lineHeight = size * style.lineHeight;
        const paragraphs = text.split('\n');
        const lines: string[] = [];
        for (const paragraph of paragraphs) {
            if (!style.wrap || maxWidth === null || maxWidth <= 0) {
                lines.push(paragraph);
                continue;
            }
            this.wrapParagraph(paragraph, font, spacing, maxWidth, lines);
        }
        if (lines.length === 0)
            lines.push('');
        let width = 0;
        for (const line of lines)
            width = Math.max(width, this.measureWidth(line, font, spacing));
        return { lines, width, height: lines.length * lineHeight, lineHeight, fontSize: size, font };
    }
    private wrapParagraph(paragraph: string, font: string, spacing: number, maxWidth: number, into: string[]): void {
        const words = paragraph.split(' ');
        let current = '';
        const pushWord = (word: string) => {
            const candidate = current ? `${current} ${word}` : word;
            if (this.measureWidth(candidate, font, spacing) <= maxWidth || !current) {
                if (!current && this.measureWidth(word, font, spacing) > maxWidth) {
                    let chunk = '';
                    for (const char of word) {
                        if (chunk && this.measureWidth(chunk + char, font, spacing) > maxWidth) {
                            into.push(chunk);
                            chunk = '';
                        }
                        chunk += char;
                    }
                    current = chunk;
                    return;
                }
                current = candidate;
                return;
            }
            into.push(current);
            current = '';
            pushWord(word);
        };
        for (const word of words)
            pushWord(word);
        into.push(current);
    }
}
export const guiTextMeasurer = new GuiTextMeasurer();
