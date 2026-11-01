const COMMENTS_AND_STRINGS = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:[^"\\\n]|\\.)*"|`[^`]*`|'(?:[^'\\\n]|\\.)*'/g;
export function stripCLikeComments(source: string): string {
    return source.replace(COMMENTS_AND_STRINGS, (match) => (match.startsWith('/') ? ' ' : match));
}
export function requireSpecifiers(source: string, callee: RegExp): string[] {
    const pattern = new RegExp(`${callee.source}\\s*\\(\\s*"((?:[^"\\\\\\n]|\\\\.)*)"\\s*\\)`, 'g');
    const names: string[] = [];
    for (const match of stripCLikeComments(source).matchAll(pattern)) {
        const name = match[1].replace(/\\"/g, '"').trim();
        if (name && !names.includes(name))
            names.push(name);
    }
    return names;
}
export function referencedSiblings(source: string, siblings: readonly {
    readonly name: string;
    readonly file: string;
}[]): string[] {
    const body = stripCLikeComments(source);
    const names: string[] = [];
    for (const sibling of siblings) {
        const type = sibling.file.replace(/\.[^.]+$/, '');
        if (!/^[A-Za-z_$][\w$]*$/.test(type))
            continue;
        if (new RegExp(`(?<![\\w$.])${type.replace(/\$/g, '\\$')}(?![\\w$])`).test(body) && !names.includes(sibling.name))
            names.push(sibling.name);
    }
    return names;
}
