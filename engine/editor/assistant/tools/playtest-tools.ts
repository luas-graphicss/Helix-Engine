import { clamp } from '@/engine/core/math/scalar';
import type { LogEntry, LogLevel } from '@/engine/editor/session/editor-log';
import type { AssistantTool } from './assistant-tool';
import { choice, integer, number, parameters } from './tool-parameters';
const PLAYTEST_ACTIONS = ['play', 'pause', 'stop'] as const;
const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];
const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const DEFAULT_ENTRY_COUNT = 40;
const MAX_ENTRY_COUNT = 200;
const MAX_WAIT_SECONDS = 10;
function formatEntry(entry: LogEntry): string {
    const location = entry.location ? ` (${entry.location.file}:${entry.location.line})` : '';
    const repeat = entry.repeat > 1 ? ` x${entry.repeat}` : '';
    return `[${entry.level}] ${entry.source}: ${entry.message}${location}${repeat}`;
}
function pause(seconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}
const controlPlaytest: AssistantTool = {
    name: 'control_playtest',
    title: 'Controlar o playtest',
    access: 'run',
    description: 'Starts, pauses or stops the playtest. Stopping restores the scene to its edited state. Scripts start asynchronously, so read the console a moment after playing.',
    parameters: parameters({ action: choice('What to do with the playtest.', PLAYTEST_ACTIONS) }, ['action']),
    run(session, input) {
        const { playtest } = session;
        switch (input.choice('action', PLAYTEST_ACTIONS)) {
            case 'play':
                playtest.play();
                break;
            case 'pause':
                playtest.pause();
                break;
            case 'stop':
                playtest.stop();
                break;
        }
        return { state: playtest.state };
    },
};
const readConsole: AssistantTool = {
    name: 'read_console',
    title: 'Ler o console',
    access: 'read',
    description: 'Returns the latest editor console entries: script errors, physics warnings and engine messages.',
    parameters: parameters({
        limit: integer(`Entries to return, newest last. Default ${DEFAULT_ENTRY_COUNT}, at most ${MAX_ENTRY_COUNT}.`),
        minimumLevel: choice('Lowest level to include. Default info.', LOG_LEVELS),
        waitSeconds: number(`Seconds to wait before reading, at most ${MAX_WAIT_SECONDS}. Use it right after starting the playtest.`),
    }),
    async run(session, input) {
        const waitSeconds = clamp(input.optionalNumber('waitSeconds') ?? 0, 0, MAX_WAIT_SECONDS);
        if (waitSeconds > 0)
            await pause(waitSeconds);
        const minimum = LEVEL_RANK[input.optionalChoice('minimumLevel', LOG_LEVELS) ?? 'info'];
        const limit = clamp(input.optionalInteger('limit') ?? DEFAULT_ENTRY_COUNT, 1, MAX_ENTRY_COUNT);
        const entries = session.log.entries.filter((entry) => LEVEL_RANK[entry.level] >= minimum).slice(-limit);
        return entries.length === 0 ? 'The console has no matching entries.' : entries.map(formatEntry).join('\n');
    },
};
export const PLAYTEST_TOOLS: readonly AssistantTool[] = [controlPlaytest, readConsole];
