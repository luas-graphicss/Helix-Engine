import { SnapshotBuffer } from '@/engine/net/sync/snapshot-buffer';
import { createTransformState, type TransformState } from '@/engine/net/sync/transform-state';
import { createCheckList } from '../support/check-list';
const checks = createCheckList('Buffer de snapshots: interpolação, espera e extrapolação');
function at(x: number): TransformState {
    const transform = createTransformState();
    transform.position[0] = x;
    return transform;
}
function sampleX(buffer: SnapshotBuffer, timeMs: number): number | null {
    const target = createTransformState();
    return buffer.sample(timeMs, target) ? target.position[0] : null;
}
const buffer = new SnapshotBuffer();
checks.check('buffer vazio não tem amostra', sampleX(buffer, 100) === null);
buffer.push(100, at(10), false);
checks.near('um único snapshot mais novo que o render segura a pose', sampleX(buffer, 40) ?? NaN, 10);
checks.near('um único snapshot no passado também segura a pose', sampleX(buffer, 400) ?? NaN, 10);
buffer.push(200, at(20), false);
checks.near('render antes do primeiro snapshot usa o mais antigo', sampleX(buffer, 50) ?? NaN, 10);
checks.near('entre dois snapshots a pose é interpolada', sampleX(buffer, 150) ?? NaN, 15);
checks.near('depois do último a pose segue a velocidade recente', sampleX(buffer, 250) ?? NaN, 25);
checks.near('a extrapolação para depois de um limite', sampleX(buffer, 5000) ?? NaN, 32);
buffer.push(300, at(90), true);
checks.near('teleporte não é interpolado', sampleX(buffer, 250) ?? NaN, 20);
checks.near('teleporte não é extrapolado', sampleX(buffer, 400) ?? NaN, 90);
buffer.push(150, at(15), false);
checks.near('snapshot atrasado entra na ordem certa', sampleX(buffer, 125) ?? NaN, 12.5);
buffer.clear();
checks.check('limpar esvazia o buffer', sampleX(buffer, 100) === null && buffer.latestTimeMs === null);
checks.finish();
