import type { GameSources } from '../types';
export function luaGame(typed: boolean): GameSources {
    const t = (annotation: string): string => (typed ? annotation : '');
    const label = typed ? 'Luau' : 'Lua';
    const entry = `                                    
`;
}
