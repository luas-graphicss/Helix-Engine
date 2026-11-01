import { ForeignScriptError } from '../foreign-values';
import type { ForeignLocation } from '../language-engine';
import { LUA_PRELUDE_CHUNK } from './lua-prelude';
export interface LuaFrame {
    readonly file: string;
    readonly line: number;
    readonly functionName: string | null;
}
const MESSAGE_LOCATION = /^(.+?):(\d+):\s*/;
const LUAU_FRAME = /^\s*(.+?):(\d+)(?:\s+function\s+(.+))?\s*$/;
const LUA54_FRAME = /^\s*(.+?):(\d+):\s+in\s+(?:(?:function|upvalue|local|field|method|metamethod)\s+)?['<]?([^'>]*)['>]?\s*$/;
function isEngineChunk(file: string): boolean {
    return file === '[C]' || file === LUA_PRELUDE_CHUNK || file === `=${LUA_PRELUDE_CHUNK}` || file.startsWith('[string');
}
export function splitLuaMessage(message: string): {
    file: string;
    line: number;
    text: string;
} | null {
    const match = MESSAGE_LOCATION.exec(message);
    if (!match)
        return null;
    return { file: match[1], line: Number(match[2]), text: message.slice(match[0].length) };
}
export function parseLuaTraceback(trace: string): LuaFrame[] {
    const frames: LuaFrame[] = [];
    for (const raw of trace.split('\n')) {
        const line = raw.trim();
        if (!line || line === 'stack traceback:' || line.startsWith('(...tail calls'))
            continue;
        const lua54 = LUA54_FRAME.exec(line);
        const luau = lua54 ? null : LUAU_FRAME.exec(line);
        const match = lua54 ?? luau;
        if (!match)
            continue;
        const file = match[1];
        if (isEngineChunk(file))
            continue;
        const functionName = match[3]?.trim();
        frames.push({ file, line: Number(match[2]), functionName: functionName && functionName !== 'main chunk' && functionName !== '?' ? functionName : null });
    }
    return frames;
}
export interface LuaErrorOptions {
    assetIdOfFile(file: string): string | null;
    readonly errorName: string;
}
export function luaScriptError(message: string, trace: string, options: LuaErrorOptions): ForeignScriptError {
    const frames = parseLuaTraceback(trace);
    const split = splitLuaMessage(message);
    let origin: ForeignLocation | null = null;
    let text = message;
    if (split && !isEngineChunk(split.file)) {
        origin = { file: split.file, line: split.line, assetId: options.assetIdOfFile(split.file) };
        text = split.text;
    }
    if (!origin) {
        const first = frames[0];
        if (first)
            origin = { file: first.file, line: first.line, assetId: options.assetIdOfFile(first.file), functionName: first.functionName };
    }
    const traceback = frames.map((frame) => (frame.functionName ? `  em ${frame.functionName} (${frame.file}:${frame.line})` : `  em ${frame.file}:${frame.line}`)).join('\n');
    return new ForeignScriptError(text, options.errorName, origin, traceback || null);
}
