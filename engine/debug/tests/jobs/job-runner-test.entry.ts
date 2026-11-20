import { collectTransferables } from '@/engine/jobs/memory/transferables';
import { compileJobProgram, describeJobFunction, type JobContext } from '@/engine/jobs/program/job-program';
import { createJobToolkit } from '@/engine/jobs/program/job-toolkit';
import type { JobRequest } from '@/engine/jobs/protocol/job-messages';
import { JobRunner } from '@/engine/jobs/worker/job-runner';
import { createCheckList } from '../support/check-list';
const checks = createCheckList('Execução de jobs dentro da thread');
const toolkit = createJobToolkit();
const runner = new JobRunner(toolkit);
const context: JobContext = { ...toolkit, index: 0, start: 0, end: 0, thread: 0, output: null };
function request(overrides: Partial<JobRequest>): JobRequest {
    return { jobId: 1, thread: 0, programId: 1, source: null, input: null, range: { index: 0, start: 0, end: 0 }, output: null, ...overrides };
}
const compiled = await runner.run(request({ source: '(input) => input + 1', input: 1 }));
checks.check('a thread compila o código recebido e roda o job', compiled.response.ok && compiled.response.value === 2);
const cached = await runner.run(request({ input: 5 }));
checks.check('o código já recebido não precisa ser reenviado', cached.response.ok && cached.response.value === 6);
const unknown = await runner.run(request({ programId: 77 }));
checks.check('programa nunca recebido vira erro do job', !unknown.response.ok && unknown.response.error.message.includes('ainda não recebeu'));
const described = await runner.run(request({ programId: 2, thread: 3, source: '(input, job) => [job.index, job.start, job.end, job.thread, typeof job.math.noise.perlin2]', range: { index: 2, start: 10, end: 20 } }));
checks.check('o job conhece o lote, a thread e a matemática', described.response.ok && String(described.response.value) === '2,10,20,3,function');
const write = '(input, job) => { job.output[0] = 42; }';
const copy = await runner.run(request({ programId: 3, source: write, output: { mode: 'copy', kind: 'int32', length: 2 } }));
checks.check('saída sem memória compartilhada volta junto com a resposta', copy.response.ok && copy.response.output?.[0] === 42 && copy.transfer.length === 1);
const sharedMemory = new SharedArrayBuffer(8);
const inPlace = await runner.run(request({ programId: 3, output: { mode: 'shared', kind: 'int32', buffer: sharedMemory, byteOffset: 4, length: 1 } }));
checks.check('saída compartilhada é escrita no lugar e não é copiada', inPlace.response.ok && inPlace.response.output === null && new Int32Array(sharedMemory)[1] === 42 && inPlace.transfer.length === 0);
const local = new Float32Array(4);
const transfer = collectTransferables({ local, again: local.subarray(1), shared: new Float32Array(sharedMemory), nested: [new Uint8Array(2)], empty: new Uint8Array(0) });
checks.check('buffers comuns são transferidos uma vez e os compartilhados ficam', transfer.length === 2 && transfer.includes(local.buffer));
const holder = {
    double(input: unknown) {
        return Number(input) * 2;
    },
    async later(input: unknown) {
        return Number(input) + 1;
    },
};
checks.check('função declarada mantém o próprio código', describeJobFunction(function triple(input: number) {
    return input * 3;
}).startsWith('function triple'));
checks.check('método de objeto vira função compilável', compileJobProgram(describeJobFunction(holder.double))(4, context) === 8);
checks.check('método assíncrono continua assíncrono', (await compileJobProgram(describeJobFunction(holder.later))(4, context)) === 5);
checks.check('arrow function roda como está', compileJobProgram(describeJobFunction((input: unknown) => Number(input) - 1))(4, context) === 3);
checks.throws('função nativa é recusada', () => describeJobFunction(Math.max), 'nativas');
checks.throws('globais do navegador são bloqueados no job', () => compileJobProgram('() => fetch("/segredo")')(null, context), 'fetch não existe dentro de um job');
checks.finish();
