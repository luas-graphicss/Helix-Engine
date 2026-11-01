import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import type { BodyType } from '@/engine/physics/body/rigid-body-settings';
import { DirectionalField } from '@/engine/physics/forces/directional-field';
import { DragField } from '@/engine/physics/forces/drag-field';
import { applyExplosion } from '@/engine/physics/forces/explosion';
import { sphereRegion } from '@/engine/physics/forces/field-region';
import { RadialField } from '@/engine/physics/forces/radial-field';
import { VortexField } from '@/engine/physics/forces/vortex-field';
import { defineJointFromWorld, type WorldJointFrame } from '@/engine/physics/joints/joint-builder';
import type { Joint } from '@/engine/physics/joints/joint';
import type { JointDefinition, JointType } from '@/engine/physics/joints/joint-settings';
import { createBoxShape, createSphereShape, type ColliderShape } from '@/engine/physics/shapes/collider-shape';
import { createPhysicsSettings, PHYSICS_QUALITY_PRESETS } from '@/engine/physics/world/physics-settings';
import { PhysicsWorld } from '@/engine/physics/world/physics-world';
import { PhysicsWorkerCore } from '@/engine/physics/worker/physics-worker-core';
import { PhysicsWorkerLink, type PhysicsChannel } from '@/engine/physics/worker/physics-worker-link';
import type { PhysicsReply, PhysicsRequest } from '@/engine/physics/worker/physics-protocol';
const FRAME_DT = 1 / 60;
const identity = quat.create();
interface Check {
    name: string;
    ok: boolean;
    detail: string;
}
const checks: Check[] = [];
function check(name: string, ok: boolean, detail = ''): void {
    checks.push({ name, ok, detail });
    console.log(`${ok ? '  ok ' : 'FALHA'} ${name}${detail ? ` · ${detail}` : ''}`);
}
function createWorld(): PhysicsWorld {
    const world = new PhysicsWorld(createPhysicsSettings({ ...PHYSICS_QUALITY_PRESETS.medium }));
    world.stepBudgetMs = Infinity;
    return world;
}
function addBody(world: PhysicsWorld, type: BodyType, shape: ColliderShape, position: Vec3, mass = 1, orientation = identity): RigidBody {
    return world.createBody({ type, shape, position, orientation, mass, friction: 0.8, restitution: 0, linearDamping: 0, angularDamping: 0, gravityScale: 1, canSleep: true });
}
function addGround(world: PhysicsWorld): RigidBody {
    return addBody(world, 'static', createBoxShape(50, 0.5, 50), vec3.create(0, -0.5, 0), 0);
}
function joint(world: PhysicsWorld, type: JointType, a: RigidBody, b: RigidBody | null, frame: WorldJointFrame, overrides: Partial<JointDefinition> = {}): Joint {
    return world.createJoint(defineJointFromWorld(type, a, b, frame, overrides), a, b);
}
function run(world: PhysicsWorld, seconds: number, each?: (frame: number) => void): void {
    const frames = Math.round(seconds / FRAME_DT);
    for (let frame = 0; frame < frames; frame++) {
        world.advance(FRAME_DT);
        each?.(frame);
    }
}
function upVector(body: RigidBody): Vec3 {
    return quat.rotateVec3(vec3.create(), body.orientation, vec3.create(0, 1, 0));
}
const allFinite = (world: PhysicsWorld) => world.bodies.every((body) => body.isStateFinite());
function pendulum(): void {
    console.log('\n[pêndulo · ball com o mundo]');
    const world = createWorld();
    const bob = addBody(world, 'dynamic', createSphereShape(0.1), vec3.create(1, 0, 0));
    joint(world, 'ball', bob, null, { anchor: vec3.create(0, 0, 0) });
    let worstStretch = 0;
    let lowest = Infinity;
    let maxSpeed = 0;
    run(world, 4, () => {
        worstStretch = Math.max(worstStretch, Math.abs(vec3.length(bob.position) - 1));
        lowest = Math.min(lowest, bob.position[1]);
        maxSpeed = Math.max(maxSpeed, vec3.length(bob.linearVelocity));
    });
    check('a haste do pêndulo mantém o comprimento', worstStretch < 0.02, `esticou no máximo ${(worstStretch * 1000).toFixed(1)} mm`);
    check('o pêndulo passa pelo ponto mais baixo', lowest < -0.95, `y mínimo ${lowest.toFixed(3)}`);
    check('a energia do pêndulo é conservada (não explode)', maxSpeed > 3.8 && maxSpeed < 4.6, `velocidade máxima ${maxSpeed.toFixed(2)} m/s (esperado ≈ 4.43)`);
    check('estado finito', allFinite(world));
}
function hingeLimits(): void {
    console.log('\n[dobradiça com limites]');
    const world = createWorld();
    const bar = addBody(world, 'dynamic', createBoxShape(0.5, 0.05, 0.05), vec3.create(0.5, 2, 0));
    const hinge = joint(world, 'hinge', bar, null, { anchor: vec3.create(0, 2, 0), axis: vec3.create(0, 0, 1) }, { limits: { enabled: true, min: -0.6, max: 0.6 } });
    let worstAngle = 0;
    run(world, 3, () => {
        worstAngle = Math.max(worstAngle, Math.abs(hinge.coordinate));
    });
    check('o ângulo respeita os limites (com folga de 2°)', worstAngle < 0.6 + 0.035, `ângulo máximo ${worstAngle.toFixed(3)} rad (limite 0.6)`);
    check('a barra repousa no limite inferior', Math.abs(Math.abs(hinge.coordinate) - 0.6) < 0.03 && vec3.length(bar.linearVelocity) < 0.2, `ângulo final ${hinge.coordinate.toFixed(3)} rad, velocidade ${vec3.length(bar.linearVelocity).toFixed(3)} m/s`);
    check('a âncora não se afasta', vec3.distance(quat.rotateVec3(vec3.create(), bar.orientation, hinge.definition.localAnchorA), vec3.subtract(vec3.create(), vec3.create(0, 2, 0), bar.position)) < 0.02);
}
function hingeMotor(): void {
    console.log('\n[dobradiça com motor]');
    const world = createWorld();
    const wheel = addBody(world, 'dynamic', createBoxShape(0.5, 0.05, 0.5), vec3.create(0, 1, 0));
    const hinge = joint(world, 'hinge', wheel, null, { anchor: vec3.create(0, 1, 0), axis: vec3.create(0, 1, 0) }, { motor: { enabled: true, targetVelocity: 2, maxForce: 50 } });
    run(world, 2);
    check('o motor atinge a velocidade alvo', Math.abs(hinge.speed - 2) < 0.05, `velocidade ${hinge.speed.toFixed(3)} rad/s (alvo 2)`);
    check('sem carga o motor em regime não gasta torque', Math.abs(hinge.motorForce) < 0.05, `${hinge.motorForce.toFixed(3)} N·m`);
    check('a roda não cai (a dobradiça segura o peso)', Math.abs(wheel.position[1] - 1) < 0.02, `y ${wheel.position[1].toFixed(3)}`);
    const weak = createWorld();
    const slow = addBody(weak, 'dynamic', createBoxShape(0.5, 0.05, 0.5), vec3.create(0, 1, 0));
    const weakHinge = joint(weak, 'hinge', slow, null, { anchor: vec3.create(0, 1, 0), axis: vec3.create(0, 1, 0) }, { motor: { enabled: true, targetVelocity: 10, maxForce: 0.5 } });
    run(weak, 0.25);
    check('maxForce limita a aceleração do motor', weakHinge.speed > 0.3 && weakHinge.speed < 1.2, `velocidade após 0.25 s: ${weakHinge.speed.toFixed(3)} rad/s`);
    check('o torque do motor saturado é relatado no teto', Math.abs(weakHinge.motorForce - 0.5) < 0.01, `${weakHinge.motorForce.toFixed(3)} N·m (teto 0.5)`);
}
function sliderSpring(): void {
    console.log('\n[deslizante com mola]');
    const world = createWorld();
    const block = addBody(world, 'dynamic', createBoxShape(0.2, 0.2, 0.2), vec3.create(1, 1, 0));
    const slider = joint(world, 'slider', block, null, { anchor: vec3.create(0, 1, 0), axis: vec3.create(1, 0, 0) }, { spring: { enabled: true, hertz: 2, dampingRatio: 1, target: 0 } });
    let worstDrop = 0;
    run(world, 2.5, () => {
        worstDrop = Math.max(worstDrop, Math.abs(block.position[1] - 1));
    });
    check('a mola traz o bloco ao alvo', Math.abs(slider.coordinate) < 0.03, `translação final ${slider.coordinate.toFixed(3)} m (partiu de 1)`);
    check('o deslizante não deixa o bloco cair', worstDrop < 0.02, `desvio vertical máximo ${(worstDrop * 1000).toFixed(1)} mm`);
    check('o bloco não gira', vec3.dot(upVector(block), vec3.create(0, 1, 0)) > 0.999);
}
function fixedWeld(): void {
    console.log('\n[solda]');
    const world = createWorld();
    const brick = addBody(world, 'dynamic', createBoxShape(0.3, 0.3, 0.3), vec3.create(2, 3, 0), 5);
    joint(world, 'fixed', brick, null, { anchor: vec3.create(2, 3, 0) });
    run(world, 2);
    check('a solda segura o tijolo no ar', vec3.distance(brick.position, vec3.create(2, 3, 0)) < 0.01, `afundou ${(vec3.distance(brick.position, vec3.create(2, 3, 0)) * 1000).toFixed(1)} mm`);
    check('a solda segura a rotação', vec3.dot(upVector(brick), vec3.create(0, 1, 0)) > 0.999);
    const flexible = createWorld();
    const soft = addBody(flexible, 'dynamic', createBoxShape(0.3, 0.3, 0.3), vec3.create(2, 3, 0), 5);
    joint(flexible, 'fixed', soft, null, { anchor: vec3.create(2, 3, 0) }, { spring: { enabled: true, hertz: 3, dampingRatio: 0.5, target: 0 } });
    run(flexible, 2);
    const sag = 3 - soft.position[1];
    check('a solda flexível cede sob o peso e para', sag > 0.015 && sag < 0.05 && vec3.length(soft.linearVelocity) < 0.05, `afundou ${(sag * 1000).toFixed(1)} mm (esperado ≈ 28)`);
}
function distanceRod(): void {
    console.log('\n[haste · distance]');
    const world = createWorld();
    const top = addBody(world, 'dynamic', createSphereShape(0.1), vec3.create(0, 2, 0));
    const bottom = addBody(world, 'dynamic', createSphereShape(0.1), vec3.create(0.8, 1.2, 0));
    joint(world, 'ball', top, null, { anchor: vec3.create(0, 3, 0) });
    const rod = joint(world, 'distance', bottom, top, { anchorA: bottom.position, anchorB: top.position });
    const length = rod.definition.length;
    let worst = 0;
    run(world, 4, () => {
        worst = Math.max(worst, Math.abs(vec3.distance(top.position, bottom.position) - length));
    });
    check('o comprimento de repouso vem da distância inicial', Math.abs(length - Math.hypot(0.8, 0.8)) < 1e-6, `${length.toFixed(4)} m`);
    check('a haste mantém o comprimento no pêndulo duplo', worst < 0.03, `erro máximo ${(worst * 1000).toFixed(1)} mm`);
    check('estado finito', allFinite(world));
    const slack = createWorld();
    const anchor = addBody(slack, 'dynamic', createSphereShape(0.1), vec3.create(0, 2, 0));
    joint(slack, 'fixed', anchor, null, { anchor: anchor.position });
    const hanging = addBody(slack, 'dynamic', createSphereShape(0.1), vec3.create(0, 1.8, 0));
    joint(slack, 'distance', hanging, anchor, { anchorA: hanging.position, anchorB: anchor.position }, { limits: { enabled: true, min: 0, max: 1 } });
    run(slack, 2);
    check('os limites de distância dão folga à haste', Math.abs(vec3.distance(hanging.position, anchor.position) - 1) < 0.03, `distância final ${vec3.distance(hanging.position, anchor.position).toFixed(3)} m`);
}
function coneTwist(): void {
    console.log('\n[cone-twist]');
    const world = createWorld();
    const limb = addBody(world, 'dynamic', createBoxShape(0.1, 0.5, 0.1), vec3.create(0, 1.5, 0));
    const cone = joint(world, 'cone-twist', limb, null, { anchor: vec3.create(0, 2, 0), axis: vec3.create(0, 1, 0) }, { coneAngle: 0.4, limits: { enabled: true, min: -0.2, max: 0.2 } });
    limb.linearVelocity[0] = 4;
    limb.angularVelocity[1] = 6;
    let worstSwing = 0;
    let worstTwist = 0;
    run(world, 3, () => {
        const up = upVector(limb);
        worstSwing = Math.max(worstSwing, Math.acos(Math.min(1, Math.max(-1, up[1]))));
        worstTwist = Math.max(worstTwist, Math.abs(cone.coordinate));
    });
    check('o balanço fica dentro do cone (folga de 3°)', worstSwing < 0.4 + 0.052, `balanço máximo ${worstSwing.toFixed(3)} rad (cone 0.4)`);
    check('a torção respeita os limites (folga de 3°)', worstTwist < 0.2 + 0.052, `torção máxima ${worstTwist.toFixed(3)} rad (limite 0.2)`);
    check('o membro fica pendurado na âncora', vec3.distance(limb.position, vec3.create(0, 1.5, 0)) < 0.6 && limb.position[1] < 1.6);
}
function car(): {
    world: PhysicsWorld;
    chassis: RigidBody;
} {
    console.log('\n[carro · wheel]');
    const world = createWorld();
    addGround(world);
    const chassis = addBody(world, 'dynamic', createBoxShape(0.8, 0.2, 1.4), vec3.create(0, 0.9, 0), 40);
    const wheels: Joint[] = [];
    for (const [x, z] of [
        [-0.9, 1],
        [0.9, 1],
        [-0.9, -1],
        [0.9, -1],
    ]) {
        const wheel = addBody(world, 'dynamic', createSphereShape(0.4), vec3.create(x, 0.4, z), 3);
        wheels.push(joint(world, 'wheel', chassis, wheel, { anchor: wheel.position, axis: vec3.create(0, 1, 0), secondaryAxis: vec3.create(1, 0, 0) }, {
            spring: { enabled: true, hertz: 2.5, dampingRatio: 0.6, target: 0 },
            limits: { enabled: true, min: -0.25, max: 0.25 },
        }));
    }
    run(world, 1);
    const settledHeight = chassis.position[1];
    check('o carro assenta na suspensão sem tombar', settledHeight > 0.6 && settledHeight < 1.0 && upVector(chassis)[1] > 0.99, `altura ${settledHeight.toFixed(3)} m`);
    check('as rodas tocam o chão', world.bodies.filter((body) => body.isDynamic && body !== chassis).every((wheel) => Math.abs(wheel.position[1] - 0.4) < 0.05));
    for (const rear of [wheels[2], wheels[3]]) {
        rear.definition.motor.enabled = true;
        rear.definition.motor.targetVelocity = 12;
        rear.definition.motor.maxForce = 60;
        rear.markChanged();
    }
    const start = chassis.position[2];
    run(world, 3);
    const travelled = chassis.position[2] - start;
    check('o motor nas rodas move o carro', travelled > 3, `andou ${travelled.toFixed(2)} m em 3 s para +Z`);
    check('o chassi continua de pé', upVector(chassis)[1] > 0.98 && Math.abs(chassis.position[1] - settledHeight) < 0.2);
    check('a roda relata a rotação', Math.abs(wheels[2].speed) > 4, `${wheels[2].speed.toFixed(2)} rad/s`);
    for (const wheel of wheels) {
        wheel.definition.motor.enabled = false;
        wheel.definition.brakeTorque = 200;
        wheel.markChanged();
    }
    run(world, 2);
    check('o freio para o carro', vec3.length(chassis.linearVelocity) < 0.3, `velocidade ${vec3.length(chassis.linearVelocity).toFixed(3)} m/s`);
    for (const wheel of wheels) {
        wheel.definition.brakeTorque = 0;
        wheel.markChanged();
    }
    for (const front of [wheels[0], wheels[1]]) {
        front.definition.steeringAngle = 0.5;
        front.markChanged();
    }
    for (const rear of [wheels[2], wheels[3]]) {
        rear.definition.motor.enabled = true;
        rear.definition.motor.targetVelocity = 10;
        rear.definition.motor.maxForce = 60;
        rear.markChanged();
    }
    const headingBefore = quat.rotateVec3(vec3.create(), chassis.orientation, vec3.create(0, 0, 1));
    run(world, 3);
    const headingAfter = quat.rotateVec3(vec3.create(), chassis.orientation, vec3.create(0, 0, 1));
    const turned = Math.acos(Math.min(1, Math.max(-1, vec3.dot(headingBefore, headingAfter))));
    check('o esterço faz o carro virar', turned > 0.3, `rumo girou ${(turned * 57.3).toFixed(1)}°`);
    check('estado finito', allFinite(world));
    return { world, chassis };
}
function breaking(): void {
    console.log('\n[quebra]');
    const world = createWorld();
    let event: Joint | null = null;
    world.events.onJointBreak = (joint) => {
        event = joint;
    };
    const heavy = addBody(world, 'dynamic', createBoxShape(0.3, 0.3, 0.3), vec3.create(0, 3, 0), 100);
    const weak = joint(world, 'fixed', heavy, null, { anchor: vec3.create(0, 3, 0) }, { breakForce: 300 });
    run(world, 1);
    const broken = world.drainBrokenJoints();
    check('a junta quebra quando a reação passa de breakForce', weak.broken && event === weak && broken.length === 1 && broken[0] === weak, `peso 981 N > 300 N`);
    check('o corpo solto cai', heavy.position[1] < 2, `y ${heavy.position[1].toFixed(2)}`);
    check('a junta quebrada não é resolvida', world.stats.joints === 0 && world.joints.length === 1);
    const strong = createWorld();
    const held = addBody(strong, 'dynamic', createBoxShape(0.3, 0.3, 0.3), vec3.create(0, 3, 0), 100);
    const sturdy = joint(strong, 'fixed', held, null, { anchor: vec3.create(0, 3, 0) }, { breakForce: 2000 });
    run(strong, 1);
    check('uma junta com breakForce acima da carga não quebra', !sturdy.broken && Math.abs(held.position[1] - 3) < 0.02, `reação ${vec3.length(sturdy.reactionForce).toFixed(0)} N (esperado ≈ 981)`);
    check('a reação relatada é o peso', Math.abs(vec3.length(sturdy.reactionForce) - 981) < 60, `${vec3.length(sturdy.reactionForce).toFixed(0)} N`);
}
function removalAndCollision(): void {
    console.log('\n[ciclo de vida]');
    const world = createWorld();
    addGround(world);
    const a = addBody(world, 'dynamic', createBoxShape(0.5, 0.5, 0.5), vec3.create(0, 0.5, 0));
    const b = addBody(world, 'dynamic', createBoxShape(0.5, 0.5, 0.5), vec3.create(0, 1.2, 0));
    const weld = joint(world, 'fixed', b, a, { anchor: vec3.create(0, 0.85, 0) });
    run(world, 1);
    check('as caixas soldadas se sobrepõem sem colidir entre si', Math.abs(b.position[1] - a.position[1] - 0.7) < 0.05, `distância vertical ${(b.position[1] - a.position[1]).toFixed(3)} m (0.7 na criação)`);
    world.removeJoint(weld);
    run(world, 1.5);
    check('removida a junta, as caixas voltam a colidir e B apoia em A', b.position[1] - a.position[1] > 0.9, `distância vertical ${(b.position[1] - a.position[1]).toFixed(3)} m`);
    check('contagem de juntas nos corpos volta a zero', a.jointCount === 0 && b.jointCount === 0);
    const c = addBody(world, 'dynamic', createBoxShape(0.2, 0.2, 0.2), vec3.create(3, 2, 0));
    joint(world, 'ball', c, a, { anchor: vec3.create(1.5, 1, 0) });
    check('juntas entram na lista do mundo', world.joints.length === 1 && c.jointCount === 1 && a.jointCount === 1);
    world.removeBody(a);
    check('remover um corpo remove as juntas dele', world.joints.length === 0 && c.jointCount === 0);
    world.clear();
    check('clear limpa corpos e juntas', world.joints.length === 0 && world.bodies.length === 0 && world.ground.jointCount === 0);
}
function forceFields(): void {
    console.log('\n[campos de força]');
    const world = createWorld();
    world.settings.gravity[1] = 0;
    const leaf = addBody(world, 'dynamic', createBoxShape(0.1, 0.1, 0.1), vec3.create(0, 0, 0), 1);
    const rock = addBody(world, 'dynamic', createBoxShape(0.1, 0.1, 0.1), vec3.create(0, 2, 0), 10);
    const wind = new DirectionalField({ direction: vec3.create(1, 0, 0), strength: 5, mode: 'force' });
    world.addForceField(wind);
    run(world, 1);
    check('vento em modo força: o leve voa, o pesado quase não', leaf.position[0] > 2 && rock.position[0] < leaf.position[0] * 0.2, `folha x=${leaf.position[0].toFixed(2)} pedra x=${rock.position[0].toFixed(2)}`);
    wind.remove();
    world.clear();
    const radialWorld = createWorld();
    radialWorld.settings.gravity[1] = 0;
    const satellite = addBody(radialWorld, 'dynamic', createSphereShape(0.1), vec3.create(3, 0, 0));
    const attractor = new RadialField({ center: vec3.create(0, 0, 0), strength: -10, radius: 0, falloff: 'none' });
    radialWorld.addForceField(attractor);
    run(radialWorld, 0.5);
    check('campo radial negativo atrai', satellite.position[0] < 3 && Math.abs(satellite.position[1]) < 1e-6, `x ${satellite.position[0].toFixed(3)} (partiu de 3)`);
    attractor.strength = 10;
    const before = satellite.position[0];
    run(radialWorld, 1);
    check('inverter o sinal em tempo real repele', satellite.position[0] > before + 0.5 || satellite.linearVelocity[0] > 0, `x ${satellite.position[0].toFixed(3)}`);
    const vortexWorld = createWorld();
    vortexWorld.settings.gravity[1] = 0;
    const dust = addBody(vortexWorld, 'dynamic', createSphereShape(0.05), vec3.create(2, 0, 0));
    vortexWorld.addForceField(new VortexField({ center: vec3.create(0, 0, 0), axis: vec3.create(0, 1, 0), strength: 6, inwardStrength: 3, liftStrength: 1, radius: 0, falloff: 'none' }));
    run(vortexWorld, 0.5);
    check('o vórtice gira, puxa e levanta', dust.linearVelocity[2] < -0.5 && dust.linearVelocity[0] < 0 && dust.linearVelocity[1] > 0.3, `v = (${dust.linearVelocity[0].toFixed(2)}, ${dust.linearVelocity[1].toFixed(2)}, ${dust.linearVelocity[2].toFixed(2)})`);
    const dragWorld = createWorld();
    dragWorld.settings.gravity[1] = 0;
    const bullet = addBody(dragWorld, 'dynamic', createSphereShape(0.05), vec3.create(0, 0, 0));
    const free = addBody(dragWorld, 'dynamic', createSphereShape(0.05), vec3.create(0, 5, 0));
    bullet.linearVelocity[0] = 10;
    free.linearVelocity[0] = 10;
    const drag = new DragField({ linear: 2 });
    drag.region = sphereRegion(vec3.create(0, 0, 0), 3);
    dragWorld.addForceField(drag);
    run(dragWorld, 1);
    check('o arrasto freia quem está na região e só ele', bullet.linearVelocity[0] < 6 && Math.abs(free.linearVelocity[0] - 10) < 1e-6, `dentro ${bullet.linearVelocity[0].toFixed(2)} m/s, fora ${free.linearVelocity[0].toFixed(2)} m/s`);
    check('o arrasto não acorda corpos parados', (() => {
        const still = addBody(dragWorld, 'dynamic', createSphereShape(0.05), vec3.create(1, 0, 0));
        still.sleep();
        dragWorld.advance(FRAME_DT);
        return still.sleeping;
    })());
    const blast = createWorld();
    blast.settings.gravity[1] = 0;
    const near = addBody(blast, 'dynamic', createBoxShape(0.2, 0.2, 0.2), vec3.create(1, 0, 0));
    const far = addBody(blast, 'dynamic', createBoxShape(0.2, 0.2, 0.2), vec3.create(4, 0, 0));
    const outside = addBody(blast, 'dynamic', createBoxShape(0.2, 0.2, 0.2), vec3.create(9, 0, 0));
    const hit = applyExplosion(blast, vec3.create(0, 0, 0), 6, 20, { upwardBias: 0.3 });
    check('a explosão atinge só quem está no raio', hit === 2 && vec3.length(outside.linearVelocity) === 0, `${hit} atingidos`);
    check('a explosão empurra mais quem está perto, e para cima', near.linearVelocity[0] > far.linearVelocity[0] && far.linearVelocity[0] > 0 && near.linearVelocity[1] > 0, `perto ${near.linearVelocity[0].toFixed(2)} m/s, longe ${far.linearVelocity[0].toFixed(2)} m/s`);
}
interface LoopChannel extends PhysicsChannel {
    failNow(message: string): void;
}
function createLoopChannel(core: PhysicsWorkerCore): LoopChannel {
    let onReply: ((reply: PhysicsReply) => void) | null = null;
    let onFailure: ((message: string) => void) | null = null;
    let closed = false;
    return {
        post(request: PhysicsRequest) {
            if (closed)
                return;
            setTimeout(() => {
                if (closed)
                    return;
                core.handle(request, (reply) => {
                    setTimeout(() => {
                        if (!closed)
                            onReply?.(reply);
                    }, 0);
                });
            }, 0);
        },
        onReply(handler) {
            onReply = handler;
        },
        onFailure(handler) {
            onFailure = handler;
        },
        close() {
            closed = true;
        },
        failNow(message) {
            onFailure?.(message);
        },
    };
}
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
async function settle(link: PhysicsWorkerLink, timeoutMs = 2000): Promise<void> {
    const started = performance.now();
    while (link.busy) {
        if (performance.now() - started > timeoutMs)
            throw new Error('o elo com o worker não respondeu a tempo.');
        await sleep(0);
    }
}
function buildJointScenario(world: PhysicsWorld): {
    bob: RigidBody;
    hinge: Joint;
    wheel: Joint;
    pendulum: Joint;
} {
    addGround(world);
    const bob = addBody(world, 'dynamic', createSphereShape(0.1), vec3.create(1, 3, 0));
    const pendulum = joint(world, 'ball', bob, null, { anchor: vec3.create(0, 3, 0) });
    const disc = addBody(world, 'dynamic', createBoxShape(0.5, 0.05, 0.5), vec3.create(4, 1, 0));
    const hinge = joint(world, 'hinge', disc, null, { anchor: vec3.create(4, 1, 0), axis: vec3.create(0, 1, 0) }, { motor: { enabled: true, targetVelocity: 2, maxForce: 50 } });
    const chassis = addBody(world, 'dynamic', createBoxShape(0.8, 0.2, 0.8), vec3.create(-4, 0.9, 0), 20);
    const tyre = addBody(world, 'dynamic', createSphereShape(0.4), vec3.create(-4, 0.4, 0), 2);
    const wheel = joint(world, 'wheel', chassis, tyre, { anchor: tyre.position, axis: vec3.create(0, 1, 0), secondaryAxis: vec3.create(1, 0, 0) }, { spring: { enabled: true, hertz: 2, dampingRatio: 0.7, target: 0 } });
    return { bob, hinge, wheel, pendulum };
}
async function workerParity(): Promise<void> {
    console.log('\n[worker · paridade das juntas]');
    const local = createWorld();
    const reference = buildJointScenario(local);
    for (let frame = 0; frame < 180; frame++)
        local.advance(FRAME_DT);
    const mirror = createWorld();
    const mirrored = buildJointScenario(mirror);
    const core = new PhysicsWorkerCore();
    const channel = createLoopChannel(core);
    const link = new PhysicsWorkerLink(mirror, 'worker-copy', channel);
    mirror.attachRemote(link);
    await settle(link);
    for (let frame = 0; frame < 180; frame++) {
        mirror.advance(FRAME_DT);
        await settle(link);
    }
    const authoritative = core.authoritativeWorld!;
    check('juntas existentes apresentadas ao worker', authoritative.joints.length === mirror.joints.length, `${authoritative.joints.length} de ${mirror.joints.length}`);
    const bobDeviation = vec3.distance(mirrored.bob.position, reference.bob.position);
    check('o pêndulo espelhado ≈ pêndulo local', bobDeviation < 2e-3, `desvio ${bobDeviation.toExponential(2)}`);
    check('a velocidade do motor chega ao espelho', Math.abs(mirrored.hinge.speed - reference.hinge.speed) < 0.05 && Math.abs(mirrored.hinge.speed - 2) < 0.05, `espelho ${mirrored.hinge.speed.toFixed(3)} · local ${reference.hinge.speed.toFixed(3)} rad/s`);
    check('a reação da junta chega ao espelho', vec3.length(mirrored.pendulum.reactionForce) > 0.1 && Math.abs(vec3.length(mirrored.pendulum.reactionForce) - vec3.length(reference.pendulum.reactionForce)) < 0.5, `espelho ${vec3.length(mirrored.pendulum.reactionForce).toFixed(2)} N · local ${vec3.length(reference.pendulum.reactionForce).toFixed(2)} N`);
    check('a compressão da suspensão chega ao espelho', Math.abs(mirrored.wheel.coordinate - reference.wheel.coordinate) < 5e-3, `espelho ${mirrored.wheel.coordinate.toFixed(4)} · local ${reference.wheel.coordinate.toFixed(4)} m`);
    check('stats de juntas vêm do worker', mirror.stats.joints === local.stats.joints, `${mirror.stats.joints} vs ${local.stats.joints}`);
    mirrored.hinge.definition.motor.targetVelocity = -3;
    mirrored.hinge.markChanged();
    for (let frame = 0; frame < 90; frame++) {
        mirror.advance(FRAME_DT);
        await settle(link);
    }
    const authoritativeHinge = authoritative.joints.find((candidate) => candidate.id === mirrored.hinge.id)!;
    check('markChanged no espelho atualiza a junta do worker', authoritativeHinge.definition.motor.targetVelocity === -3 && Math.abs(mirrored.hinge.speed + 3) < 0.05, `alvo no worker ${authoritativeHinge.definition.motor.targetVelocity}, velocidade ${mirrored.hinge.speed.toFixed(3)} rad/s`);
    let eventJoint: Joint | null = null;
    mirror.events.onJointBreak = (joint) => {
        eventJoint = joint;
    };
    const heavy = addBody(mirror, 'dynamic', createBoxShape(0.3, 0.3, 0.3), vec3.create(8, 3, 0), 100);
    const fuse = joint(mirror, 'fixed', heavy, null, { anchor: vec3.create(8, 3, 0) }, { breakForce: 300 });
    for (let frame = 0; frame < 60; frame++) {
        mirror.advance(FRAME_DT);
        await settle(link);
    }
    const drained = mirror.drainBrokenJoints();
    check('junta criada com o worker ativo chega lá e quebra', fuse.broken && eventJoint === fuse && drained.includes(fuse) && heavy.position[1] < 2.5, `y ${heavy.position[1].toFixed(2)}`);
    mirror.reportJointBreak(mirrored.hinge);
    for (let frame = 0; frame < 5; frame++) {
        mirror.advance(FRAME_DT);
        await settle(link);
    }
    check('break local remove a junta do worker', authoritative.joints.every((candidate) => candidate.id !== mirrored.hinge.id));
    mirror.removeJoint(mirrored.pendulum);
    for (let frame = 0; frame < 30; frame++) {
        mirror.advance(FRAME_DT);
        await settle(link);
    }
    const offArc = vec3.distance(mirrored.bob.position, vec3.create(0, 3, 0));
    check('remover a junta no espelho solta o pêndulo no worker', authoritative.joints.every((candidate) => candidate.id !== mirrored.pendulum.id) && offArc > 1.05, `distância da âncora ${offArc.toFixed(2)} m (haste de 1 m)`);
    const lifted = addBody(mirror, 'dynamic', createBoxShape(0.2, 0.2, 0.2), vec3.create(10, 0.2, 0), 1);
    const removeHook = mirror.addPreStepHook(() => lifted.addForce(vec3.create(0, 9.81 + 4, 0)));
    for (let frame = 0; frame < 60; frame++) {
        mirror.advance(FRAME_DT);
        await settle(link);
    }
    removeHook();
    check('addForce no espelho vira força no worker', lifted.position[1] > 1.3 && lifted.position[1] < 2.6, `subiu para y ${lifted.position[1].toFixed(2)} (esperado ≈ 2.2)`);
    const jointsBefore = mirror.joints.length;
    channel.failNow('falha simulada');
    for (let frame = 0; frame < 30; frame++)
        mirror.advance(FRAME_DT);
    check('após o fallback, as juntas seguem no mundo local', mirror.backend === 'local' && mirror.joints.length === jointsBefore && mirror.stats.joints > 0 && allFinite(mirror), `${mirror.stats.joints} juntas ativas`);
}
async function main(): Promise<void> {
    console.log('Juntas e campos de força · preset medium · frames de 1/60 s');
    pendulum();
    hingeLimits();
    hingeMotor();
    sliderSpring();
    fixedWeld();
    distanceRod();
    coneTwist();
    car();
    breaking();
    removalAndCollision();
    forceFields();
    await workerParity();
    const failed = checks.filter((item) => !item.ok);
    console.log(`\n${checks.length - failed.length}/${checks.length} verificações passaram.`);
    if (failed.length > 0) {
        for (const item of failed)
            console.log(`  ✗ ${item.name}${item.detail ? ` · ${item.detail}` : ''}`);
        process.exitCode = 1;
    }
}
await main();
