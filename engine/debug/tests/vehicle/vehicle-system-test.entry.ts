import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { cloneEntity } from '@/engine/core/scene/entity-utils';
import { Scene } from '@/engine/core/scene/scene';
import { MaterialLibrary } from '@/engine/materials/material-library';
import { createRigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import { PhysicsScene } from '@/engine/physics/scene/physics-scene';
import { deserializeScene } from '@/engine/project/scene-document/deserialize-scene';
import { serializeScene } from '@/engine/project/scene-document/serialize-scene';
import { createBox, createCylinder } from '@/engine/renderer/geometry/primitives';
import { REVERSE_GEAR } from '@/engine/vehicle/drivetrain/gearbox';
import { clearVehicleInput } from '@/engine/vehicle/input/vehicle-input';
import type { VehicleInstance } from '@/engine/vehicle/runtime/vehicle-instance';
import { VehicleSystem } from '@/engine/vehicle/runtime/vehicle-system';
import { createVehicleSettings } from '@/engine/vehicle/vehicle-settings';
import { createWheelSettings } from '@/engine/vehicle/wheel/wheel-settings';
import { createCheckList } from '../support/check-list';
const STEP = 1 / 60;
const GRAVITY = 9.81;
const CHASSIS_MASS = 1300;
const CHASSIS_SIZE = vec3.create(1.8, 0.6, 4.2);
const WHEEL_RADIUS = 0.34;
const WHEEL_DROP = 0.35;
const HALF_TRACK = 0.85;
const HALF_WHEELBASE = 1.3;
const RIDE_HEIGHT = WHEEL_RADIUS + WHEEL_DROP;
const SLOPE_DEGREES = 12;
const checks = createCheckList('Veículos na cena');
const scene = new Scene('Pista');
const ground = scene.createEntity({ name: 'ground', kind: 'mesh', mesh: createBox(600, 1, 600), rigidBody: createRigidBodySettings({ type: 'static', collider: 'box', boxSize: vec3.create(600, 1, 600) }) });
ground.transform.position[1] = -0.5;
function addWheel(car: Entity, name: string, side: number, axle: number): Entity {
    const isFront = axle > 0;
    const wheel = scene.createEntity({ name, kind: 'mesh', mesh: createCylinder(WHEEL_RADIUS, 0.25), wheel: createWheelSettings({ radius: WHEEL_RADIUS, steering: isFront, driven: !isFront, handbrake: !isFront }) }, car);
    vec3.set(wheel.transform.position, side * HALF_TRACK, -WHEEL_DROP, axle * HALF_WHEELBASE);
    vec3.set(wheel.transform.rotation, 0, 0, 90);
    return wheel;
}
function addCar(): Entity {
    const car = scene.createEntity({
        name: 'car',
        kind: 'mesh',
        mesh: createBox(CHASSIS_SIZE[0], CHASSIS_SIZE[1], CHASSIS_SIZE[2]),
        rigidBody: createRigidBodySettings({ type: 'dynamic', collider: 'box', boxSize: vec3.copy(vec3.create(), CHASSIS_SIZE), mass: CHASSIS_MASS }),
        vehicle: createVehicleSettings(),
    });
    car.transform.position[1] = RIDE_HEIGHT;
    addWheel(car, 'front-left', 1, 1);
    addWheel(car, 'front-right', -1, 1);
    addWheel(car, 'rear-left', 1, -1);
    addWheel(car, 'rear-right', -1, -1);
    return car;
}
const car = addCar();
const frontLeft = car.children[0];
const frontRight = car.children[1];
const restRotation = Array.from(frontLeft.transform.rotation);
const restPosition = Array.from(frontLeft.transform.position);
const physics = new PhysicsScene(scene);
const system = new VehicleSystem(scene, physics);
function advance(seconds: number): void {
    const steps = Math.round(seconds / STEP);
    for (let step = 0; step < steps; step++) {
        system.reconcile();
        physics.update(STEP);
        system.present();
    }
}
function requireInstance(): VehicleInstance {
    const instance = system.instanceOf(car);
    if (!instance)
        throw new Error('The car has no vehicle instance');
    return instance;
}
function headingX(): number {
    const yaw = (car.transform.rotation[1] * Math.PI) / 180;
    return Math.sin(yaw);
}
checks.check('o sistema começa sem veículos', system.instances.length === 0);
advance(2);
const vehicle = requireInstance();
const input = vehicle.input;
const totalLoad = vehicle.wheels.reduce((sum, wheel) => sum + wheel.load, 0);
checks.check('o ator com veículo ganha uma simulação com as rodas filhas', vehicle.wheels.length === 4 && vehicle.wheels.every((wheel) => wheel.entity.parent === car));
checks.check('as quatro rodas tocam o chão', vehicle.groundedWheelCount === 4);
checks.near('o carro repousa na altura em que foi montado', car.transform.position[1], RIDE_HEIGHT, 0.02);
checks.near('a suspensão sustenta o peso do chassi', totalLoad, CHASSIS_MASS * GRAVITY, CHASSIS_MASS * GRAVITY * 0.03);
checks.nearAll('rodas simétricas recebem a mesma massa', vehicle.wheels.map((wheel) => wheel.sprungMass), [325, 325, 325, 325], 0.5);
checks.check('parado, o carro não escorrega', vehicle.speed < 0.02, `velocidade ${vehicle.speed}`);
input.throttle = 1;
advance(4);
const launchSpeed = vehicle.forwardSpeed;
const freeWheelSpeed = vehicle.wheels[0].angularVelocity * WHEEL_RADIUS;
checks.check('acelerar leva o carro para frente', launchSpeed > 10 && car.transform.position[2] > 15, `velocidade ${launchSpeed}, z ${car.transform.position[2]}`);
checks.check('em linha reta o carro não deriva', Math.abs(car.transform.position[0]) < 0.3, `x ${car.transform.position[0]}`);
checks.check('o câmbio sobe de marcha', vehicle.gear >= 2, `marcha ${vehicle.gear}`);
checks.check('o giro do motor fica entre a lenta e o corte', vehicle.engineRpm >= createVehicleSettings().idleRpm && vehicle.engineRpm <= createVehicleSettings().maxRpm * 1.05, `rpm ${vehicle.engineRpm}`);
checks.near('as rodas livres giram na velocidade do chão', freeWheelSpeed, launchSpeed, launchSpeed * 0.05);
checks.check('a malha da roda gira com a simulação', Math.abs(frontLeft.transform.rotation[0] - restRotation[0]) + Math.abs(frontLeft.transform.rotation[1] - restRotation[1]) + Math.abs(frontLeft.transform.rotation[2] - restRotation[2]) > 1);
input.throttle = 0.3;
input.steer = 1;
advance(1.5);
const leftWheel = vehicle.wheelOf(frontLeft);
const rightWheel = vehicle.wheelOf(frontRight);
checks.check('virar à direita muda o rumo para a direita', headingX() < -0.15, `rumo x ${headingX()}`);
checks.check('as rodas da frente esterçam e a de dentro vira mais', leftWheel !== null && rightWheel !== null && leftWheel.steerAngle > 0 && rightWheel.steerAngle > leftWheel.steerAngle);
checks.check('as rodas de trás não esterçam', vehicle.wheels[2].steerAngle === 0 && vehicle.wheels[3].steerAngle === 0);
clearVehicleInput(input);
input.brake = 1;
advance(6);
checks.check('frear para o carro', vehicle.speed < 0.05, `velocidade ${vehicle.speed}`);
checks.check('o carro continua em pé depois da manobra', vehicle.groundedWheelCount === 4 && Math.abs(car.transform.position[1] - RIDE_HEIGHT) < 0.05, `altura ${car.transform.position[1]}`);
clearVehicleInput(input);
input.throttle = -1;
advance(2);
checks.check('acelerar para trás engata a ré', vehicle.gear === REVERSE_GEAR && vehicle.forwardSpeed < -1, `marcha ${vehicle.gear}, velocidade ${vehicle.forwardSpeed}`);
clearVehicleInput(input);
input.brake = 1;
advance(4);
const slope = (SLOPE_DEGREES * Math.PI) / 180;
vec3.set(scene.physics.gravity, 0, -GRAVITY * Math.cos(slope), -GRAVITY * Math.sin(slope));
clearVehicleInput(input);
input.handbrake = 1;
const parked = vec3.copy(vec3.create(), car.transform.position);
advance(3);
checks.check('o freio de mão segura o carro na ladeira', vec3.distance(parked, car.transform.position) < 0.05, `deslocou ${vec3.distance(parked, car.transform.position)}`);
clearVehicleInput(input);
advance(3);
checks.check('sem freio o carro desce a ladeira', vec3.distance(parked, car.transform.position) > 1, `deslocou ${vec3.distance(parked, car.transform.position)}`);
vec3.set(scene.physics.gravity, 0, -GRAVITY, 0);
const document = await serializeScene(scene, { libraryDocumentForTerrainMaterial: () => null });
const reopened = await deserializeScene(document, { materials: new MaterialLibrary(() => undefined, null) });
const reopenedCar = reopened.scene.entities.find((entity) => entity.name === 'car') ?? null;
const reopenedWheel = reopened.scene.entities.find((entity) => entity.name === 'front-left') ?? null;
checks.check('abrir a cena salva não gera avisos', reopened.warnings.length === 0, reopened.warnings.join(' | '));
checks.check('as configurações do veículo voltam com a cena', JSON.stringify(reopenedCar?.vehicle) === JSON.stringify(car.vehicle));
checks.check('o Wheel Collider volta com a cena', JSON.stringify(reopenedWheel?.wheel) === JSON.stringify(frontLeft.wheel));
checks.check('ator comum volta sem os componentes', reopened.scene.entities.find((entity) => entity.name === 'ground')?.vehicle === null && reopenedCar?.wheel === null);
const copy = cloneEntity(scene, car, null);
checks.check('duplicar copia o veículo e as rodas', copy.vehicle !== car.vehicle && JSON.stringify(copy.vehicle) === JSON.stringify(car.vehicle) && copy.children[0].wheel !== frontLeft.wheel && JSON.stringify(copy.children[0].wheel) === JSON.stringify(frontLeft.wheel));
copy.parent?.remove(copy);
frontRight.wheel = null;
advance(STEP);
checks.check('tirar o Wheel Collider de uma roda atualiza o veículo', vehicle.wheels.length === 3 && vehicle.wheelOf(frontRight) === null && Math.abs(vehicle.wheels.reduce((sum, wheel) => sum + wheel.sprungMass, 0) - CHASSIS_MASS) < 0.5);
car.vehicle = null;
advance(STEP);
checks.check('remover o componente encerra a simulação', system.instanceOf(car) === null && system.instances.length === 0);
checks.nearAll('as rodas voltam à posição de repouso', frontLeft.transform.position, restPosition, 1e-5);
checks.nearAll('as rodas voltam à rotação de repouso', frontLeft.transform.rotation, restRotation, 1e-5);
system.dispose();
physics.dispose();
checks.finish();
