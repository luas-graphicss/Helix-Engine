import type { BuiltinInput, InputSocket, OutputSocket } from './node-definition';
import type { SocketKind, SocketType } from './socket-types';
export function floatInput(id: string, label: string, fallback = 0): InputSocket {
    return { id, label, type: 'float', fallback: [fallback] };
}
export function autoInput(id: string, label: string, fallback = 0): InputSocket {
    return { id, label, type: 'auto', fallback: [fallback] };
}
export function vectorInput(id: string, label: string, type: Exclude<SocketType, 'float'>, fallback: readonly number[]): InputSocket {
    return { id, label, type, fallback };
}
export function colorInput(id: string, label: string, fallback: readonly number[]): InputSocket {
    return { id, label, type: 'vec3', fallback, color: true };
}
export function builtinInput(id: string, label: string, type: SocketType, builtin: BuiltinInput): InputSocket {
    return { id, label, type, builtin };
}
export function uvInput(): InputSocket {
    return builtinInput('uv', 'UV', 'vec2', 'uv');
}
export function timeInput(): InputSocket {
    return builtinInput('time', 'Tempo', 'float', 'time');
}
export function output(id: string, label: string, type: SocketKind): OutputSocket {
    return { id, label, type };
}
