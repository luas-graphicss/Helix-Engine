import { clamp, degToRad, lerp, radToDeg } from '@/engine/core/math/scalar';
import * as vec3 from '@/engine/core/math/vec3';
import { createCheckList } from '../../support/check-list';
const AXIS_X = vec3.create(1, 0, 0);
const AXIS_Y = vec3.create(0, 1, 0);
const AXIS_Z = vec3.create(0, 0, 1);
const QUARTER_TURN = Math.PI / 2;
const FULL_TURN = Math.PI * 2;
const checks = createCheckList('Escalares e vetores de três componentes');
function scalars(): void {
    checks.near('clamp devolve o valor que já está no intervalo', clamp(0.3, 0, 1), 0.3);
    checks.near('clamp limita acima do máximo', clamp(5, 0, 1), 1);
    checks.near('clamp limita abaixo do mínimo', clamp(-5, 0, 1), 0);
    checks.near('lerp interpola entre os extremos', lerp(2, 10, 0.25), 4);
    checks.near('degToRad converte meia volta', degToRad(180), Math.PI);
    checks.near('radToDeg desfaz degToRad', radToDeg(degToRad(37.5)), 37.5);
}
function arithmetic(): void {
    const a = vec3.create(1, -2, 3);
    const b = vec3.create(-4, 5, 0.5);
    const out = vec3.create();
    checks.nearAll('add soma componente a componente', vec3.add(out, a, b), [-3, 3, 3.5]);
    checks.nearAll('subtract subtrai componente a componente', vec3.subtract(out, a, b), [5, -7, 2.5]);
    checks.nearAll('scale multiplica pelo escalar', vec3.scale(out, a, -2), [-2, 4, -6]);
    checks.nearAll('scaleAndAdd soma o segundo vetor escalado', vec3.scaleAndAdd(out, a, b, 2), [-7, 8, 4]);
    checks.near('dot soma os produtos das componentes', vec3.dot(a, b), -12.5);
    checks.near('length mede a norma euclidiana', vec3.length(vec3.create(3, 4, 12)), 13);
    checks.near('distance mede a norma da diferença', vec3.distance(a, b), Math.hypot(5, -7, 2.5));
    checks.nearAll('copy e set gravam as três componentes', vec3.copy(out, vec3.set(vec3.create(), 7, 8, 9)), [7, 8, 9]);
}
function crossProduct(): void {
    const a = vec3.create(1, -2, 3);
    const b = vec3.create(-4, 5, 0.5);
    const cross = vec3.cross(vec3.create(), a, b);
    const aliased = vec3.copy(vec3.create(), a);
    checks.nearAll('cross segue a regra da mão direita', vec3.cross(vec3.create(), AXIS_X, AXIS_Y), AXIS_Z);
    checks.near('cross é perpendicular ao primeiro vetor', vec3.dot(cross, a), 0);
    checks.near('cross é perpendicular ao segundo vetor', vec3.dot(cross, b), 0);
    checks.nearAll('cross troca de sinal ao inverter a ordem', vec3.cross(vec3.create(), b, a), vec3.scale(vec3.create(), cross, -1));
    checks.nearAll('cross aceita a saída no mesmo vetor da entrada', vec3.cross(aliased, aliased, b), cross);
}
function normalization(): void {
    const unit = vec3.normalize(vec3.create(), vec3.create(3, -4, 12));
    checks.near('normalize devolve norma um', vec3.length(unit), 1);
    checks.nearAll('normalize mantém a direção', unit, [3 / 13, -4 / 13, 12 / 13]);
    checks.nearAll('normalize do vetor nulo continua nulo', vec3.normalize(vec3.create(1, 1, 1), vec3.create()), [0, 0, 0]);
}
function rotation(): void {
    const v = vec3.create(0.3, -1.2, 2.5);
    const axis = vec3.normalize(vec3.create(), vec3.create(1, 2, -0.5));
    const rotated = vec3.rotateAroundAxis(vec3.create(), v, axis, 1.1);
    const aliased = vec3.copy(vec3.create(), v);
    checks.nearAll('rotateY leva +X a −Z em um quarto de volta', vec3.rotateY(vec3.create(), AXIS_X, QUARTER_TURN), [0, 0, -1]);
    checks.nearAll('rotateY concorda com rotateAroundAxis no eixo Y', vec3.rotateY(vec3.create(), v, 0.7), vec3.rotateAroundAxis(vec3.create(), v, AXIS_Y, 0.7));
    checks.near('rotateAroundAxis preserva a norma', vec3.length(rotated), vec3.length(v));
    checks.near('rotateAroundAxis preserva a componente ao longo do eixo', vec3.dot(rotated, axis), vec3.dot(v, axis));
    checks.nearAll('rotateAroundAxis volta ao início depois de uma volta inteira', vec3.rotateAroundAxis(vec3.create(), v, axis, FULL_TURN), v);
    checks.nearAll('rotateAroundAxis aceita a saída no mesmo vetor da entrada', vec3.rotateAroundAxis(aliased, aliased, axis, 1.1), rotated);
}
scalars();
arithmetic();
crossProduct();
normalization();
rotation();
checks.finish();
