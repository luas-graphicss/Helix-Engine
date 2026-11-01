import { parseArgs } from 'node:util';
import type { PhysicsQuality } from '@/engine/physics/world/physics-settings';
import { formatPhysicsBenchmark, runPhysicsBenchmark } from './physics-benchmark';
const { values } = parseArgs({
    options: {
        counts: { type: 'string', default: '7,50,100,200' },
        frames: { type: 'string', default: '600' },
        quality: { type: 'string', default: 'medium' },
        json: { type: 'boolean', default: false },
    },
    strict: false,
});
const counts = String(values.counts)
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((count) => Number.isFinite(count) && count > 0);
const frames = Math.max(2, Number.parseInt(String(values.frames), 10) || 600);
const quality = (['low', 'medium', 'high'] as const).includes(String(values.quality) as PhysicsQuality) ? (String(values.quality) as PhysicsQuality) : 'medium';
const rows = runPhysicsBenchmark({ counts, frames, quality });
if (values.json) {
    console.log(JSON.stringify({ quality, frames, rows }, null, 2));
}
else {
    for (const line of formatPhysicsBenchmark(rows, quality))
        console.log(line);
}
