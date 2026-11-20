import type { MatchFound } from '@/engine/net/services/matchmaking/matchmaking-types';
import { requireObject, requireString } from '../../runtime/values';
import { listen, optionalCount, optionalFlag, requireActive, settled, type MultiplayerApiContext } from './multiplayer-context';
const MATCHED_EVENT = 'multiplayer.match.found';
const API = 'helix.multiplayer.matchmaking';
export function createMatchmakingApi({ host, runtime }: MultiplayerApiContext) {
    const { matchmaking } = runtime;
    if (matchmaking)
        host.disposers.add(matchmaking.onMatched((match) => void host.bus.emit(MATCHED_EVENT, match)));
    const active = (member: string) => requireActive(runtime.matchmaking, member);
    return {
        get isSearching() {
            return runtime.matchmaking?.isSearching ?? false;
        },
        find: (queue: unknown, options?: unknown) => settled(`${API}.find`, () => {
            const record = options === undefined ? {} : requireObject(options, `${API}.find`);
            return active(`${API}.find`).find(requireString(queue, `${API}.find`, 'o nome da fila'), {
                skill: optionalCount(record.skill, `${API}.find`, 'o nível'),
                party: optionalFlag(record.party, `${API}.find`, 'a opção party'),
            });
        }),
        cancel: () => settled(`${API}.cancel`, () => active(`${API}.cancel`).cancel()),
        onMatched: (handler: unknown) => listen<MatchFound>(host, MATCHED_EVENT, handler, `${API}.onMatched`, (match) => [match]),
    };
}
