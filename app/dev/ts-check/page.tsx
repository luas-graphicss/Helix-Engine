'use client';
import { useEffect, useState } from 'react';
export default function TypeScriptCheckPage() {
    const [result, setResult] = useState('carregando…');
    useEffect(() => {
        const started = performance.now();
        void import('typescript')
            .then((ts) => {
            const output = ts.transpileModule('export const x: number = 1 + 1; console.log(x)', {
                compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, sourceMap: true },
                fileName: 'Teste.ts',
            });
            setResult(`ts ${ts.version} em ${(performance.now() - started).toFixed(0)}ms\n${output.outputText}\n${output.sourceMapText ?? ''}`);
        })
            .catch((cause: unknown) => setResult(`erro: ${cause instanceof Error ? cause.message : String(cause)}`));
    }, []);
    return <pre data-testid="ts-result">{result}</pre>;
}
