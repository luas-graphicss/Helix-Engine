import type { GameSources } from '../types';
export function jsLikeGame(typed: boolean): GameSources {
    const t = (annotation: string): string => (typed ? annotation : '');
    const label = typed ? 'TypeScript' : 'JavaScript';
    const any = t(': any');
    const entry = `                                    
`;
}
