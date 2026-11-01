const LINK_TAG = /\{@link(?:code|plain)?\s+([^}|]+?)(?:\s*\|\s*([^}]*))?\}/g;
export function cleanDocText(text: string): string {
    return text.replace(LINK_TAG, (_match, target: string, label?: string) => (label ?? target).trim()).trim();
}
export function renderDocText(container: HTMLElement, text: string): void {
    const paragraphs = cleanDocText(text).split(/\n\s*\n/);
    for (const paragraph of paragraphs) {
        const trimmed = paragraph.trim();
        if (!trimmed)
            continue;
        const p = document.createElement('p');
        const parts = trimmed.split('`');
        parts.forEach((part, index) => {
            if (!part)
                return;
            if (index % 2 === 1) {
                const code = document.createElement('code');
                code.textContent = part;
                p.append(code);
            }
            else {
                p.append(document.createTextNode(part));
            }
        });
        container.append(p);
    }
}
export interface InfoBlock {
    readonly signature?: string | null;
    readonly doc?: string | null;
    readonly className?: string;
}
export function infoNode({ signature, doc, className }: InfoBlock): HTMLElement | null {
    const hasSignature = Boolean(signature && signature.trim());
    const hasDoc = Boolean(doc && doc.trim());
    if (!hasSignature && !hasDoc)
        return null;
    const root = document.createElement('div');
    if (className)
        root.className = className;
    if (hasSignature) {
        const line = document.createElement('div');
        line.className = 'hx-signature';
        line.textContent = signature!.trim();
        root.append(line);
    }
    if (hasDoc) {
        const block = document.createElement('div');
        block.className = 'hx-doc';
        renderDocText(block, doc!);
        root.append(block);
    }
    return root;
}
