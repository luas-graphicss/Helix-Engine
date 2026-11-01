import 'server-only';
import { spawn } from 'node:child_process';
export interface RunOptions {
    readonly cwd: string;
    readonly env?: Readonly<Record<string, string>>;
    readonly timeoutMs: number;
    readonly maxOutputBytes?: number;
}
export interface RunResult {
    readonly code: number | null;
    readonly signal: NodeJS.Signals | null;
    readonly stdout: string;
    readonly stderr: string;
    readonly timedOut: boolean;
    readonly durationMs: number;
}
const DEFAULT_MAX_OUTPUT = 4 * 1024 * 1024;
export function run(command: string, args: readonly string[], options: RunOptions): Promise<RunResult> {
    const started = performance.now();
    const limit = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT;
    return new Promise((resolve, reject) => {
        const env = { ...processEnvironment(), ...options.env } as NodeJS.ProcessEnv;
        const child = spawn(command, [...args], { cwd: options.cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
        const stdout = new OutputBuffer(limit);
        const stderr = new OutputBuffer(limit);
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            child.kill('SIGKILL');
        }, options.timeoutMs);
        child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
        child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
        child.on('error', (cause) => {
            clearTimeout(timer);
            reject(cause);
        });
        child.on('close', (code, signal) => {
            clearTimeout(timer);
            resolve({ code, signal, stdout: stdout.text(), stderr: stderr.text(), timedOut, durationMs: performance.now() - started });
        });
    });
}
function processEnvironment(): Record<string, string> {
    const inherited: Record<string, string> = {};
    for (const key of ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'USER', 'JAVA_HOME']) {
        const value = process.env[key];
        if (value !== undefined)
            inherited[key] = value;
    }
    return inherited;
}
class OutputBuffer {
    private readonly chunks: Buffer[] = [];
    private size = 0;
    private truncated = false;
    constructor(private readonly limit: number) { }
    push(chunk: Buffer): void {
        if (this.size >= this.limit) {
            this.truncated = true;
            return;
        }
        const room = this.limit - this.size;
        const kept = chunk.length > room ? chunk.subarray(0, room) : chunk;
        if (kept.length < chunk.length)
            this.truncated = true;
        this.chunks.push(kept);
        this.size += kept.length;
    }
    text(): string {
        const text = Buffer.concat(this.chunks).toString('utf8');
        return this.truncated ? `${text}\n[saída truncada em ${this.limit} bytes]` : text;
    }
}
