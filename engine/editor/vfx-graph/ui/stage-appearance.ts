import type { ContextKind } from '@/engine/vfx-graph/document/effect-document';
export const STAGE_ACCENT_CLASS: Record<ContextKind, string> = {
    spawn: 'bg-code-number',
    initialize: 'bg-code-string',
    update: 'bg-code-property',
    output: 'bg-code-keyword',
};
export const STAGE_STROKE_CLASS: Record<ContextKind, string> = {
    spawn: 'stroke-code-number',
    initialize: 'stroke-code-string',
    update: 'stroke-code-property',
    output: 'stroke-code-keyword',
};
