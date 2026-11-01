import { HOOK_NAMES, hookAliases } from '../foreign-values';
export const LUA_PRELUDE_CHUNK = '[helix]';
export const LUA_KIND_KEY = '@hx';
export function luaPreludeSource(): string {
    const hooks = HOOK_NAMES.map((name) => `{ "${name}", "${hookAliases(name)[0]}" }`).join(', ');
    return `
`;
}
