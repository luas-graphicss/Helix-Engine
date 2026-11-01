import type { GL } from './context';
import type { GlCapabilities, GpuTier } from './capabilities';
export type GpuTierSource = 'forced' | 'measured' | 'cached' | 'heuristic';
export interface GpuBenchmarkResult {
    readonly score: number;
    readonly tier: GpuTier;
    readonly source: 'measured' | 'cached';
}
export type GpuBenchmarkMode = 'auto' | 'cached' | 'off';
const LOW_BELOW = 1.0;
const HIGH_FROM = 3.5;
const BENCHMARK_VERSION = 1;
const STORAGE_KEY = 'helix.gpu-benchmark';
const TARGET_SIZE = 512;
const ITERATIONS = 32;
const PROBE_SIZE = 128;
const PROBE_SLOW_MS = 20;
const MIN_SAMPLE_MS = 8;
const MAX_PASSES = 256;
const DEADLINE_MS = 120;
const VERTEX_SOURCE = `#version 300 es
layout(location = 0) in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;
const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
uniform float uSeed;
out vec4 oColor;
void main() {
  vec2 p = gl_FragCoord.xy * 0.001 + uSeed;
  vec3 v = vec3(p, uSeed);
  for (int i = 0; i < ${ITERATIONS}; i++) {
    v = sin(v.yzx * 1.37 + v.zxy) * 0.5 + v * 0.5 + 0.01 * float(i);
  }
  oColor = vec4(fract(v), 1.0);
}`;
export function classifyGpuScore(score: number): GpuTier {
    if (score < LOW_BELOW)
        return 'low';
    if (score >= HIGH_FROM)
        return 'high';
    return 'mid';
}
interface StoredBenchmark {
    version: number;
    renderer: string;
    score: number;
}
function readStored(renderer: string): number | null {
    try {
        const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
        if (!raw)
            return null;
        const stored = JSON.parse(raw) as Partial<StoredBenchmark>;
        if (stored.version !== BENCHMARK_VERSION || stored.renderer !== renderer)
            return null;
        return typeof stored.score === 'number' && Number.isFinite(stored.score) ? stored.score : null;
    }
    catch {
        return null;
    }
}
function writeStored(renderer: string, score: number): void {
    try {
        const stored: StoredBenchmark = { version: BENCHMARK_VERSION, renderer, score };
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(stored));
    }
    catch {
    }
}
export function clearGpuBenchmarkCache(): void {
    try {
        globalThis.localStorage?.removeItem(STORAGE_KEY);
    }
    catch {
    }
}
export function runGpuBenchmark(gl: GL, capabilities: GlCapabilities, mode: GpuBenchmarkMode): GpuBenchmarkResult | null {
    if (mode === 'off')
        return null;
    if (capabilities.software)
        return { score: 0, tier: 'low', source: 'measured' };
    const cached = readStored(capabilities.renderer);
    if (cached !== null)
        return { score: cached, tier: classifyGpuScore(cached), source: 'cached' };
    if (mode === 'cached')
        return null;
    const score = measure(gl);
    if (score === null)
        return null;
    writeStored(capabilities.renderer, score);
    return { score, tier: classifyGpuScore(score), source: 'measured' };
}
function measure(gl: GL): number | null {
    const program = compileProbe(gl);
    if (!program)
        return null;
    const seed = gl.getUniformLocation(program, 'uSeed');
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (!vao || !buffer || !texture || !framebuffer) {
        gl.deleteProgram(program);
        return null;
    }
    const started = performance.now();
    let best = 0;
    try {
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, TARGET_SIZE, TARGET_SIZE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
            return null;
        gl.useProgram(program);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.BLEND);
        gl.disable(gl.SCISSOR_TEST);
        const timed = (size: number, passes: number): number => {
            gl.viewport(0, 0, size, size);
            const begin = performance.now();
            for (let i = 0; i < passes; i++) {
                gl.uniform1f(seed, i * 0.013);
                gl.drawArrays(gl.TRIANGLES, 0, 3);
            }
            gl.finish();
            return performance.now() - begin;
        };
        const throughput = (size: number, passes: number, ms: number): number => (size * size * passes) / 1e6 / Math.max(ms, 1e-3);
        timed(PROBE_SIZE, 1);
        const probeMs = timed(PROBE_SIZE, 4);
        best = throughput(PROBE_SIZE, 4, probeMs);
        if (probeMs >= PROBE_SLOW_MS)
            return best;
        let passes = 4;
        while (performance.now() - started < DEADLINE_MS) {
            const ms = timed(TARGET_SIZE, passes);
            if (ms >= MIN_SAMPLE_MS) {
                best = Math.max(best, throughput(TARGET_SIZE, passes, ms));
                break;
            }
            best = Math.max(best, throughput(TARGET_SIZE, passes, ms));
            if (passes >= MAX_PASSES)
                break;
            passes *= 2;
        }
        return best;
    }
    catch {
        return best > 0 ? best : null;
    }
    finally {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.useProgram(null);
        gl.deleteFramebuffer(framebuffer);
        gl.deleteTexture(texture);
        gl.deleteBuffer(buffer);
        gl.deleteVertexArray(vao);
        gl.deleteProgram(program);
    }
}
function compileProbe(gl: GL): WebGLProgram | null {
    const vertex = gl.createShader(gl.VERTEX_SHADER);
    const fragment = gl.createShader(gl.FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program)
        return null;
    gl.shaderSource(vertex, VERTEX_SOURCE);
    gl.compileShader(vertex);
    gl.shaderSource(fragment, FRAGMENT_SOURCE);
    gl.compileShader(fragment);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        return null;
    }
    return program;
}
