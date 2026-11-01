'use client';
import { useEffect, useState } from 'react';
import type { CompiledScript } from '@/engine/scripting/compiler/compile-types';
import type { ForeignGameHost } from '@/engine/scripting/languages/language-engine';
export default function PhpCheckPage() {
    const [result, setResult] = useState('carregando…');
    useEffect(() => {
        const lines: string[] = [];
        const say = (line: string) => {
            lines.push(line);
            setResult(lines.join('\n'));
        };
        const started = performance.now();
        void (async () => {
            const { ensureLanguageEngine } = await import('@/engine/scripting/languages/language-engine');
            const { buildScriptSource } = await import('@/engine/scripting/script-templates');
            const engine = await ensureLanguageEngine('php');
            say(`engine ${engine.label} ${engine.version ?? '?'} carregado em ${(performance.now() - started).toFixed(0)}ms`);
            const source = buildScriptSource('php', 'actor', 'Porta');
            const compiled = await engine.compile({ assetId: 'a1', name: 'Porta', file: 'Porta.php', source });
            say(`compile: ${compiled.artifact ? 'artefato ok' : 'sem artefato'}, ${compiled.diagnostics.length} diagnósticos`);
            const bad = await engine.compile({ assetId: 'a2', name: 'Ruim', file: 'Ruim.php', source: '<?php\nclass Ruim {\n  function x() { $a = ; }\n}' });
            say(`compile ruim: ${bad.diagnostics.map((d) => `${d.severity} L${d.line}: ${d.message}`).join(' | ')}`);
            const logs: string[] = [];
            const host: ForeignGameHost = {
                helix: { time: { now: 2 }, task: { wait: (s: number) => new Promise((r) => setTimeout(() => r(`esperou ${s}`), 10)) } },
                console: (level, message, location) => logs.push(`${level}: ${message} @${location?.file ?? '?'}:${location?.line ?? 0}`),
                resolveScript: () => null,
                compiledById: () => null,
                requireForeign: () => null,
                moduleNames: () => [],
                assetIdOfFile: () => null,
                enter: () => undefined,
                exit: () => undefined,
                currentOwner: () => null,
                invoke: (_owner, _label, fn) => fn(),
            };
            const game = await engine.createGame(host);
            const script = { assetId: 'a1', name: 'Porta', language: 'php', key: 'k1', artifact: compiled.artifact, dependencies: [] } as unknown as CompiledScript;
            const hooks = game.instantiate(script, { helix: { ...host.helix, self: { name: 'Porta 1' } }, script: {} } as never);
            say(`hooks: ${Object.keys(hooks).join(', ')}`);
            (hooks.onStart as () => void)();
            (hooks.onUpdate as (dt: number) => void)(0.016);
            (hooks.onDestroy as () => void)();
            const gen = {
                assetId: 'a3',
                name: 'Espera',
                language: 'php',
                key: 'k3',
                artifact: new TextEncoder().encode(`<?php\nfinal class Espera extends \\Helix\\Script { public function onStart(): \\Generator { $r = yield $this->helix->task->wait(1); return "voltou: $r"; } }`),
                dependencies: [],
            } as unknown as CompiledScript;
            const waited = await (game.instantiate(gen, { helix: host.helix, script: {} } as never).onStart as () => Promise<unknown>)();
            say(`gerador: ${String(waited)}`);
            say(`console:\n${logs.map((l) => `  ${l}`).join('\n')}`);
            game.dispose();
            say(`total ${(performance.now() - started).toFixed(0)}ms — FIM`);
        })().catch((cause: unknown) => say(`erro: ${cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause)}`));
    }, []);
    return <pre data-testid="php-result">{result}</pre>;
}
