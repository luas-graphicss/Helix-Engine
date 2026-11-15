const SUMMARY_VALUE_LIMIT = 48;
const SUMMARY_LIMIT = 160;
const DETAIL_LIMIT = 20000;
type ToolCallInput = Readonly<Record<string, unknown>>;
function clip(value: string, limit: number): string {
    return value.length > limit ? `${value.slice(0, limit)}…` : value;
}
function render(value: unknown): string {
    return typeof value === 'string' ? value : JSON.stringify(value);
}
export function summarizeInput(input: ToolCallInput): string {
    const fields = Object.entries(input).map(([key, value]) => `${key}: ${clip(render(value).replace(/\s+/g, ' '), SUMMARY_VALUE_LIMIT)}`);
    return clip(fields.join(' · '), SUMMARY_LIMIT);
}
export function detailInput(input: ToolCallInput): string {
    const fields = Object.entries(input).map(([key, value]) => {
        const rendered = render(value);
        return rendered.includes('\n') ? `${key}:\n${rendered}` : `${key}: ${rendered}`;
    });
    return clip(fields.join('\n'), DETAIL_LIMIT);
}
