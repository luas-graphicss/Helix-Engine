import { API_MANIFEST } from '@/engine/scripting/api-manifest';
import { HELIX_DECLARATIONS } from '@/engine/scripting/typings/helix-dts';
export type ApiMemberKind = 'method' | 'property' | 'namespace';
export interface ApiMember {
    readonly name: string;
    readonly kind: ApiMemberKind;
    readonly signature: string;
    readonly detail: string;
    readonly doc: string;
    readonly children: readonly ApiMember[] | null;
}
export interface HelixApiIndex {
    readonly root: readonly ApiMember[];
    membersAt(path: readonly string[]): readonly ApiMember[] | null;
    find(path: readonly string[]): ApiMember | null;
}
const QUOTES = new Set(['"', "'", '`']);
interface Declaration {
    readonly body: string;
    readonly parents: readonly string[];
}
interface Statement {
    readonly text: string;
    readonly doc: string;
}
function cleanDoc(comment: string): string {
    return comment
        .replace(/^\/\*\*\s?/, '')
        .replace(/\s*\*\/$/, '')
        .split('\n')
        .map((line) => line.replace(/^\s*\*\s?/, ''))
        .join('\n')
        .trim();
}
function splitStatements(body: string): Statement[] {
    const statements: Statement[] = [];
    let current = '';
    let doc = '';
    let depth = 0;
    let quote: string | null = null;
    const flush = () => {
        const text = current.trim();
        current = '';
        if (!text)
            return;
        statements.push({ text, doc });
        doc = '';
    };
    for (let index = 0; index < body.length; index++) {
        const char = body[index];
        if (quote) {
            current += char;
            if (char === '\\') {
                current += body[index + 1] ?? '';
                index++;
            }
            else if (char === quote)
                quote = null;
            continue;
        }
        if (QUOTES.has(char)) {
            quote = char;
            current += char;
            continue;
        }
        if (char === '/' && body[index + 1] === '*') {
            const end = body.indexOf('*/', index + 2);
            const comment = body.slice(index, end === -1 ? body.length : end + 2);
            if (comment.startsWith('/**') && depth === 0)
                doc = cleanDoc(comment);
            index = end === -1 ? body.length : end + 1;
            continue;
        }
        if (char === '/' && body[index + 1] === '/') {
            const end = body.indexOf('\n', index);
            index = (end === -1 ? body.length : end) - 1;
            continue;
        }
        if (char === '=' && body[index + 1] === '>') {
            current += '=>';
            index++;
            continue;
        }
        if (char === '(' || char === '[' || char === '{' || char === '<')
            depth++;
        else if (char === ')' || char === ']' || char === '}' || char === '>')
            depth = Math.max(0, depth - 1);
        if ((char === '\n' || char === ';') && depth === 0) {
            flush();
            continue;
        }
        current += char;
    }
    flush();
    return statements;
}
function extractDeclarations(source: string): Map<string, Declaration> {
    const declarations = new Map<string, Declaration>();
    const heading = /export (?:interface|class) ([A-Za-z_]\w*)(?:<[^{]*?>)?(?:\s+extends\s+([^{]+?))?(?:\s+implements\s+[^{]+?)?\s*\{/g;
    for (let match = heading.exec(source); match; match = heading.exec(source)) {
        const open = match.index + match[0].length;
        let depth = 1;
        let quote: string | null = null;
        let index = open;
        while (index < source.length && depth > 0) {
            const char = source[index];
            if (quote) {
                if (char === '\\')
                    index++;
                else if (char === quote)
                    quote = null;
            }
            else if (QUOTES.has(char)) {
                quote = char;
            }
            else if (char === '/' && source[index + 1] === '*') {
                const end = source.indexOf('*/', index + 2);
                index = end === -1 ? source.length : end + 1;
            }
            else if (char === '/' && source[index + 1] === '/') {
                const end = source.indexOf('\n', index);
                index = end === -1 ? source.length : end;
            }
            else if (char === '{') {
                depth++;
            }
            else if (char === '}') {
                depth--;
            }
            index++;
        }
        const parents = (match[2] ?? '')
            .split(',')
            .map((item) => /^\s*([A-Za-z_]\w*)/.exec(item)?.[1])
            .filter((name): name is string => Boolean(name));
        declarations.set(match[1], { body: source.slice(open, index - 1), parents });
        heading.lastIndex = index;
    }
    return declarations;
}
const MEMBER_HEAD = /^(readonly\s+)?([A-Za-z_$][\w$]*)\s*(\?)?\s*([(:<])/;
const TYPE_REFERENCE = /^(?:typeof\s+)?([A-Z]\w*)$/;
function returnTypeOf(signature: string): string {
    const open = signature.indexOf('(');
    if (open === -1)
        return '';
    let depth = 0;
    for (let index = open; index < signature.length; index++) {
        const char = signature[index];
        if (char === '(')
            depth++;
        else if (char === ')') {
            depth--;
            if (depth === 0) {
                const rest = signature.slice(index + 1).trim();
                return rest.startsWith(':') ? rest.slice(1).trim() : '';
            }
        }
    }
    return '';
}
function shorten(type: string): string {
    const compact = type.replace(/\s+/g, ' ').trim();
    return compact.length > 48 ? `${compact.slice(0, 45)}…` : compact;
}
class DeclarationReader {
    private readonly declarations: Map<string, Declaration>;
    private readonly parsed = new Map<string, readonly ApiMember[]>();
    constructor(source: string) {
        this.declarations = extractDeclarations(source);
    }
    members(typeName: string, trail: readonly string[] = []): readonly ApiMember[] {
        const cached = this.parsed.get(typeName);
        if (cached)
            return cached;
        const declaration = this.declarations.get(typeName);
        if (!declaration || trail.includes(typeName))
            return [];
        const nextTrail = [...trail, typeName];
        const own = this.membersOf(declaration.body, nextTrail);
        const result = [...own];
        for (const parent of declaration.parents) {
            for (const member of this.members(parent, nextTrail)) {
                if (!result.some((existing) => existing.name === member.name))
                    result.push(member);
            }
        }
        this.parsed.set(typeName, result);
        return result;
    }
    private membersOf(body: string, trail: readonly string[]): ApiMember[] {
        const result: ApiMember[] = [];
        for (const { text, doc } of splitStatements(body)) {
            const head = MEMBER_HEAD.exec(text);
            if (!head)
                continue;
            const [, , name, , opener] = head;
            const signature = text.replace(/\s+/g, ' ').replace(/^readonly\s+/, '').trim();
            if (opener === '(' || opener === '<') {
                result.push({ name, kind: 'method', signature, detail: shorten(returnTypeOf(signature)), doc, children: null });
                continue;
            }
            const type = signature.slice(signature.indexOf(':') + 1).trim();
            const children = this.childrenOf(type, trail);
            result.push({ name, kind: children ? 'namespace' : 'property', signature, detail: shorten(type), doc, children });
        }
        return result;
    }
    private childrenOf(type: string, trail: readonly string[]): readonly ApiMember[] | null {
        const reference = TYPE_REFERENCE.exec(type);
        let children: readonly ApiMember[] | null = null;
        if (reference && this.declarations.has(reference[1]))
            children = this.members(reference[1], trail);
        else if (type.startsWith('{') && type.endsWith('}'))
            children = this.membersOf(type.slice(1, -1), trail);
        return children && children.length > 0 ? children : null;
    }
}
function manifestFallback(name: string): ApiMember | null {
    const namespace = API_MANIFEST.find((entry) => entry.name === name);
    if (!namespace)
        return null;
    const groups = new Map<string, string[]>();
    const direct: string[] = [];
    for (const member of namespace.members) {
        const dot = member.indexOf('.');
        if (dot === -1)
            direct.push(member);
        else {
            const group = member.slice(0, dot);
            const list = groups.get(group) ?? [];
            list.push(member.slice(dot + 1));
            groups.set(group, list);
        }
    }
    const children: ApiMember[] = [
        ...direct.map((member): ApiMember => ({ name: member, kind: 'property', signature: `${name}.${member}`, detail: '', doc: '', children: null })),
        ...Array.from(groups, ([group, members]): ApiMember => ({
            name: group,
            kind: 'namespace',
            signature: `${name}.${group}`,
            detail: '',
            doc: '',
            children: members.map((member) => ({ name: member, kind: 'property', signature: `${name}.${group}.${member}`, detail: '', doc: '', children: null })),
        })),
    ];
    return { name, kind: 'namespace', signature: `helix.${name}`, detail: '', doc: `Seção ${namespace.section} da API`, children };
}
function buildIndex(): HelixApiIndex {
    const reader = new DeclarationReader(HELIX_DECLARATIONS);
    const fromDeclarations = reader.members('Helix');
    const root: ApiMember[] = [...fromDeclarations];
    for (const namespace of API_MANIFEST) {
        const existing = root.find((member) => member.name === namespace.name);
        if (existing && existing.children && existing.children.length > 0)
            continue;
        const fallback = manifestFallback(namespace.name);
        if (!fallback)
            continue;
        if (existing)
            root.splice(root.indexOf(existing), 1, { ...fallback, doc: existing.doc || fallback.doc });
        else
            root.push(fallback);
    }
    const find = (path: readonly string[]): ApiMember | null => {
        let members: readonly ApiMember[] = root;
        let found: ApiMember | null = null;
        for (const segment of path) {
            found = members.find((member) => member.name === segment) ?? null;
            if (!found)
                return null;
            members = found.children ?? [];
        }
        return found;
    };
    return {
        root,
        find,
        membersAt: (path) => {
            if (path.length === 0)
                return root;
            const member = find(path);
            return member?.children ?? null;
        },
    };
}
let cached: HelixApiIndex | null = null;
export function helixApiIndex(): HelixApiIndex {
    if (!cached)
        cached = buildIndex();
    return cached;
}
