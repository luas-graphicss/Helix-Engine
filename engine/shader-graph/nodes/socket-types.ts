export type SocketType = 'float' | 'vec2' | 'vec3' | 'vec4';
export type SocketKind = SocketType | 'auto';
const COMPONENT_COUNT: Record<SocketType, number> = { float: 1, vec2: 2, vec3: 3, vec4: 4 };
const SWIZZLE = 'xyzw';
export const SOCKET_KIND_LABEL: Record<SocketKind, string> = {
    float: 'Número',
    vec2: 'Vetor 2',
    vec3: 'Vetor 3',
    vec4: 'Vetor 4',
    auto: 'Dinâmico',
};
export function componentCount(type: SocketType): number {
    return COMPONENT_COUNT[type];
}
export function widestType(types: Iterable<SocketType>): SocketType {
    let widest: SocketType = 'float';
    for (const type of types) {
        if (COMPONENT_COUNT[type] > COMPONENT_COUNT[widest])
            widest = type;
    }
    return widest;
}
export function formatFloat(value: number): string {
    if (!Number.isFinite(value))
        return '0.0';
    const text = String(Math.round(value * 1e6) / 1e6);
    return /[.e]/.test(text) ? text : `${text}.0`;
}
export function literal(type: SocketType, components: readonly number[]): string {
    if (type === 'float')
        return formatFloat(components[0] ?? 0);
    const parts = Array.from({ length: COMPONENT_COUNT[type] }, (_, index) => formatFloat(components[index] ?? 0));
    return `${type}(${parts.join(', ')})`;
}
export function convert(expression: string, from: SocketType, to: SocketType): string {
    if (from === to)
        return expression;
    if (from === 'float')
        return `${to}(${expression})`;
    const targetCount = COMPONENT_COUNT[to];
    if (targetCount < COMPONENT_COUNT[from])
        return `(${expression}).${SWIZZLE.slice(0, targetCount)}`;
    if (from === 'vec2')
        return to === 'vec3' ? `vec3(${expression}, 0.0)` : `vec4(${expression}, 0.0, 1.0)`;
    return `vec4(${expression}, 1.0)`;
}
