export type ShaderDefines = Record<string, boolean | number | string>;
export function withDefines(source: string, defines: ShaderDefines): string {
    const lines = Object.entries(defines)
        .filter(([, value]) => value !== false)
        .map(([name, value]) => (value === true ? `#define ${name}` : `#define ${name} ${value}`));
    if (lines.length === 0)
        return source;
    const newline = source.indexOf('\n');
    return `${source.slice(0, newline + 1)}${lines.join('\n')}\n${source.slice(newline + 1)}`;
}
