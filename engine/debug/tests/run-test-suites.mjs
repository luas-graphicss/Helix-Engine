import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const SUITE_SUFFIX = '-test.entry.ts';
const debugDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(debugDirectory, '../..');
const entryRunner = path.join(debugDirectory, 'bench/run-physics-benchmark.mjs');
const suites = readdirSync(debugDirectory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(SUITE_SUFFIX))
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)))
    .sort();
if (suites.length === 0) {
    console.error(`Nenhuma suíte *${SUITE_SUFFIX} foi encontrada em ${debugDirectory}.`);
    process.exit(1);
}
const failed = [];
for (const suite of suites) {
    console.log(`\n=== ${suite}`);
    const { status } = spawnSync(process.execPath, [entryRunner, '--entry', suite], { cwd: root, stdio: 'inherit' });
    if (status !== 0)
        failed.push(suite);
}
console.log(`\n${suites.length - failed.length}/${suites.length} suítes passaram.`);
for (const suite of failed)
    console.log(`  ✗ ${suite}`);
if (failed.length > 0)
    process.exitCode = 1;
