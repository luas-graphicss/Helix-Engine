import type { NodeCategory } from '@/engine/shader-graph/nodes/node-definition';
import type { SocketKind } from '@/engine/shader-graph/nodes/socket-types';
export const CATEGORY_ACCENT_CLASS: Record<NodeCategory, string> = {
    input: 'bg-code-number',
    texture: 'bg-code-string',
    uv: 'bg-code-property',
    procedural: 'bg-code-definition',
    math: 'bg-muted-foreground',
    vector: 'bg-code-type',
    shading: 'bg-warning',
    effect: 'bg-code-keyword',
    post: 'bg-primary',
    output: 'bg-success',
};
export const SOCKET_FILL_CLASS: Record<SocketKind, string> = {
    float: 'bg-code-number',
    vec2: 'bg-code-string',
    vec3: 'bg-code-type',
    vec4: 'bg-code-keyword',
    auto: 'bg-muted-foreground',
};
export const SOCKET_STROKE_CLASS: Record<SocketKind, string> = {
    float: 'stroke-code-number',
    vec2: 'stroke-code-string',
    vec3: 'stroke-code-type',
    vec4: 'stroke-code-keyword',
    auto: 'stroke-muted-foreground',
};
